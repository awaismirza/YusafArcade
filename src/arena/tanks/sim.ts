/**
 * Tank Commander simulation: tanks with separate hull and turret, ricocheting shells, mines, crates, holes and
 * power-ups on a tile map. Pure: no three.js, no DOM. One tile is one world unit; x runs right, y runs down the
 * screen (towards the viewer in 3D).
 */
import { angleDiff, circleRect, mulberry32, Rng } from "../kit/math";

export const FLOOR = 0;
export const BLOCK = 1;
export const CRATE = 2;
export const HOLE = 3;

export type Kind = "player" | "rookie" | "scout" | "sniper" | "miner" | "rapid" | "bouncer" | "hunter" | "boss";
export type KindDef = {
  name: string;
  /** Top speed in tiles per second (0 = stays put). */
  speed: number;
  shellSpeed: number;
  bounces: number;
  maxShells: number;
  reload: number;
  maxMines: number;
  hp: number;
  radius: number;
  color: number;
  blurb: string;
};
export const KINDS: Record<Kind, KindDef> = {
  player: { name: "Player", speed: 2.7, shellSpeed: 5.8, bounces: 1, maxShells: 5, reload: 0.22, maxMines: 2, hp: 1, radius: 0.4, color: 0x3b82f6, blurb: "" },
  rookie: { name: "Rookie", speed: 0, shellSpeed: 4.2, bounces: 1, maxShells: 1, reload: 2.4, maxMines: 0, hp: 1, radius: 0.4, color: 0xa16207, blurb: "Stays still, fires slowly" },
  scout: { name: "Scout", speed: 1.4, shellSpeed: 4.6, bounces: 1, maxShells: 1, reload: 2, maxMines: 0, hp: 1, radius: 0.4, color: 0x94a3b8, blurb: "Drives around" },
  sniper: { name: "Sniper", speed: 0.7, shellSpeed: 9, bounces: 0, maxShells: 1, reload: 2.6, maxMines: 0, hp: 1, radius: 0.4, color: 0x0d9488, blurb: "Very fast shells" },
  miner: { name: "Miner", speed: 1.9, shellSpeed: 4.6, bounces: 1, maxShells: 1, reload: 2.2, maxMines: 2, hp: 1, radius: 0.4, color: 0xeab308, blurb: "Drops mines" },
  rapid: { name: "Rapid", speed: 1.3, shellSpeed: 5, bounces: 1, maxShells: 3, reload: 0.4, maxMines: 0, hp: 1, radius: 0.4, color: 0xec4899, blurb: "Fires bursts of shells" },
  bouncer: { name: "Bouncer", speed: 0, shellSpeed: 7.2, bounces: 2, maxShells: 2, reload: 1.8, maxMines: 0, hp: 1, radius: 0.4, color: 0x16a34a, blurb: "Shells bounce twice" },
  hunter: { name: "Hunter", speed: 2.4, shellSpeed: 7.6, bounces: 1, maxShells: 2, reload: 1.1, maxMines: 2, hp: 1, radius: 0.4, color: 0x7c3aed, blurb: "Fast, clever, drops mines" },
  boss: { name: "Boss", speed: 1.6, shellSpeed: 7, bounces: 1, maxShells: 4, reload: 0.6, maxMines: 2, hp: 3, radius: 0.55, color: 0x1f2937, blurb: "Big — takes 3 hits" },
};
const ENEMY_CHARS: Record<string, Kind> = { r: "rookie", s: "scout", n: "sniper", m: "miner", p: "rapid", b: "bouncer", h: "hunter", X: "boss" };

export type Pt = { x: number; y: number };
export type Level = { cols: number; rows: number; grid: Uint8Array; players: Pt[]; enemies: (Pt & { kind: Kind })[] };

/** Map rows: `#` block, `c` crate, `o` hole, `.` floor, `1`–`4` player spawns, letters for enemies (see ENEMY_CHARS). */
export function parseMap(rows: string[]): Level {
  const cols = rows[0].length;
  const grid = new Uint8Array(cols * rows.length);
  const players: Pt[] = [];
  const enemies: (Pt & { kind: Kind })[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < cols; x++) {
      const ch = row[x] ?? ".";
      const i = y * cols + x;
      if (ch === "#") grid[i] = BLOCK;
      else if (ch === "c") grid[i] = CRATE;
      else if (ch === "o") grid[i] = HOLE;
      else if (/[1-4]/.test(ch)) players[Number(ch) - 1] = { x: x + 0.5, y: y + 0.5 };
      else if (ENEMY_CHARS[ch]) enemies.push({ x: x + 0.5, y: y + 0.5, kind: ENEMY_CHARS[ch] });
    }
  });
  return { cols, rows: rows.length, grid, players: players.filter(Boolean), enemies };
}

export type Power = "laser" | "triple" | "shield" | "speed";
export type Tank = {
  id: number;
  kind: Kind;
  team: number;
  /** Which human controls it (0, 1, 2), or -1 for the computer. */
  human: number;
  color: number;
  x: number;
  y: number;
  body: number;
  turret: number;
  hp: number;
  alive: boolean;
  cooldown: number;
  shield: number;
  speedBoost: number;
  power: { kind: "laser" | "triple"; shots: number } | null;
  /** Distance driven (for treads and track marks) and whether it moved this frame. */
  odo: number;
  moving: boolean;
};
export type Shell = { id: number; owner: number; team: number; x: number; y: number; vx: number; vy: number; bounces: number; age: number; laser: boolean; dead: boolean };
export type Mine = { x: number; y: number; owner: number; age: number; fuse: number };
export type Pickup = { x: number; y: number; kind: Power; age: number };
export type World = {
  cols: number;
  rows: number;
  grid: Uint8Array;
  tanks: Tank[];
  shells: Shell[];
  mines: Mine[];
  pickups: Pickup[];
  time: number;
  versus: boolean;
  pickupTimer: number;
  rng: Rng;
  nextShell: number;
};
export type TankEvent =
  | { type: "fire"; tank: number; x: number; y: number; angle: number }
  | { type: "bounce"; x: number; y: number }
  | { type: "pop"; x: number; y: number }
  | { type: "shellsCollide"; x: number; y: number }
  | { type: "hit"; tank: number; x: number; y: number }
  | { type: "shieldPop"; tank: number; x: number; y: number }
  | { type: "tankDead"; tank: number; by: number; x: number; y: number }
  | { type: "mineDrop"; tank: number; x: number; y: number }
  | { type: "explode"; x: number; y: number }
  | { type: "crateBreak"; tx: number; ty: number }
  | { type: "pickup"; tank: number; kind: Power };

export const SHELL_R = 0.1;
export const MINE_BLAST = 1.7;
const TURN = 10;
const TURRET_TURN = 14;

export function createWorld(level: Level, opts: { humans: number; versus: boolean; bots?: number; seed?: number; colors?: number[] }): World {
  const w: World = {
    cols: level.cols,
    rows: level.rows,
    grid: level.grid.slice(),
    tanks: [],
    shells: [],
    mines: [],
    pickups: [],
    time: 0,
    versus: opts.versus,
    pickupTimer: 4,
    rng: mulberry32(opts.seed ?? 7),
    nextShell: 1,
  };
  const total = opts.humans + (opts.bots ?? 0);
  for (let p = 0; p < total; p++) {
    const s = level.players[p] ?? { x: level.players[0].x + (p % 2 ? 1 : -1), y: level.players[0].y + (p > 1 ? 1 : 0) };
    const face = s.x < level.cols / 2 ? 0 : Math.PI;
    addTank(w, "player", s.x, s.y, opts.versus ? p : 0, p < opts.humans ? p : -1, face, opts.colors?.[p]);
  }
  if (!opts.versus) for (const e of level.enemies) addTank(w, e.kind, e.x, e.y, 1, -1, e.x < level.cols / 2 ? 0 : Math.PI);
  return w;
}

export function addTank(w: World, kind: Kind, x: number, y: number, team: number, human: number, face = 0, color?: number): Tank {
  const k = KINDS[kind];
  const t: Tank = { id: w.tanks.length, kind, team, human, color: color ?? k.color, x, y, body: face, turret: face, hp: k.hp, alive: true, cooldown: 0.6, shield: 0, speedBoost: 0, power: null, odo: 0, moving: false };
  w.tanks.push(t);
  return t;
}

const tileAt = (w: World, tx: number, ty: number): number => (tx < 0 || ty < 0 || tx >= w.cols || ty >= w.rows ? BLOCK : w.grid[ty * w.cols + tx]);
const solidForTank = (v: number): boolean => v !== FLOOR;
const solidForShell = (v: number): boolean => v === BLOCK || v === CRATE;

/** True if a circle at (x, y) overlaps anything a tank cannot drive through. */
export function tankBlocked(w: World, x: number, y: number, r: number): boolean {
  if (x < r || y < r || x > w.cols - r || y > w.rows - r) return true;
  for (let ty = Math.floor(y - r); ty <= Math.floor(y + r); ty++) {
    for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++) {
      if (solidForTank(tileAt(w, tx, ty)) && circleRect(x, y, r, { x: tx, y: ty, w: 1, h: 1 })) return true;
    }
  }
  return false;
}

function pushOut(w: World, t: Tank): void {
  const r = KINDS[t.kind].radius;
  for (let k = 0; k < 3; k++) {
    for (let ty = Math.floor(t.y - r) - 1; ty <= Math.floor(t.y + r) + 1; ty++) {
      for (let tx = Math.floor(t.x - r) - 1; tx <= Math.floor(t.x + r) + 1; tx++) {
        if (tx >= 0 && ty >= 0 && tx < w.cols && ty < w.rows && !solidForTank(w.grid[ty * w.cols + tx])) continue;
        const p = circleRect(t.x, t.y, r, { x: tx, y: ty, w: 1, h: 1 });
        if (p) {
          t.x += p.nx * p.depth;
          t.y += p.ny * p.depth;
        }
      }
    }
    t.x = Math.min(w.cols - r, Math.max(r, t.x));
    t.y = Math.min(w.rows - r, Math.max(r, t.y));
  }
}

/**
 * Drives a tank with a stick (sx, sy), each -1..1, y down the screen. The hull swings to the stick direction, or
 * drives backwards when that is the shorter turn, and moves straight away (slower while still turning).
 */
export function driveTank(w: World, id: number, sx: number, sy: number, dt: number): void {
  const t = w.tanks[id];
  t.moving = false;
  if (!t.alive) return;
  const mag = Math.min(1, Math.hypot(sx, sy));
  if (mag < 0.15) return;
  const k = KINDS[t.kind];
  const want = Math.atan2(sy, sx);
  const fwd = angleDiff(t.body, want);
  const back = angleDiff(t.body, want + Math.PI);
  const reverse = Math.abs(back) + 0.2 < Math.abs(fwd);
  const d = reverse ? back : fwd;
  const turn = Math.sign(d) * Math.min(Math.abs(d), TURN * dt);
  t.body += turn;
  const left = Math.abs(d - turn);
  const factor = left < 0.35 ? 1 : left < 1.2 ? 0.45 : 0.15;
  const speed = k.speed * (t.speedBoost > 0 ? 1.5 : 1) * mag * factor * (reverse ? -1 : 1);
  const dist = speed * dt;
  const n = Math.max(1, Math.ceil(Math.abs(dist) / 0.05));
  const x0 = t.x;
  const y0 = t.y;
  for (let i = 0; i < n; i++) {
    t.x += (Math.cos(t.body) * dist) / n;
    t.y += (Math.sin(t.body) * dist) / n;
    pushOut(w, t);
  }
  for (const o of w.tanks) {
    if (o === t || !o.alive) continue;
    const dx = t.x - o.x;
    const dy = t.y - o.y;
    const dd = Math.hypot(dx, dy);
    const min = k.radius + KINDS[o.kind].radius;
    if (dd > 0 && dd < min) {
      t.x += (dx / dd) * (min - dd);
      t.y += (dy / dd) * (min - dd);
      pushOut(w, t);
    }
  }
  const moved = Math.hypot(t.x - x0, t.y - y0);
  t.odo += moved;
  t.moving = moved > 1e-4;
}

/** Swings the turret towards an angle. */
export function aimTurret(w: World, id: number, angle: number, dt: number): void {
  const t = w.tanks[id];
  if (!t.alive) return;
  const d = angleDiff(t.turret, angle);
  t.turret += Math.sign(d) * Math.min(Math.abs(d), TURRET_TURN * dt);
}

const ownShells = (w: World, id: number): number => w.shells.filter((s) => s.owner === id && !s.dead).length;

/** Fires from the turret if loaded. Returns true if a shell left the barrel. */
export function fire(w: World, id: number, events?: TankEvent[]): boolean {
  const t = w.tanks[id];
  if (!t.alive || t.cooldown > 0) return false;
  const k = KINDS[t.kind];
  const triple = t.power?.kind === "triple";
  const laser = t.power?.kind === "laser";
  if (!laser && !triple && ownShells(w, id) >= k.maxShells) return false;
  const angles = triple ? [t.turret - 0.2, t.turret, t.turret + 0.2] : [t.turret];
  for (const a of angles) {
    const speed = laser ? 13 : k.shellSpeed;
    const s: Shell = { id: w.nextShell++, owner: id, team: t.team, x: t.x, y: t.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, bounces: laser ? 3 : k.bounces, age: 0, laser, dead: false };
    // Out of the barrel: bounces off a wall the barrel is pushed against.
    moveShell(w, s, (k.radius + 0.22) / speed, []);
    if (!s.dead) w.shells.push(s);
  }
  if (t.power && --t.power.shots <= 0) t.power = null;
  t.cooldown = k.reload;
  events?.push({ type: "fire", tank: id, x: t.x + Math.cos(t.turret) * (k.radius + 0.3), y: t.y + Math.sin(t.turret) * (k.radius + 0.3), angle: t.turret });
  return true;
}

export function layMine(w: World, id: number, events?: TankEvent[]): boolean {
  const t = w.tanks[id];
  const k = KINDS[t.kind];
  if (!t.alive || w.mines.filter((m) => m.owner === id).length >= k.maxMines) return false;
  if (w.mines.some((m) => Math.hypot(m.x - t.x, m.y - t.y) < 0.8)) return false;
  w.mines.push({ x: t.x, y: t.y, owner: id, age: 0, fuse: 10 });
  events?.push({ type: "mineDrop", tank: id, x: t.x, y: t.y });
  return true;
}

/** Moves a shell, ricocheting off blocks, crates and the edges. A shell with no bounces left pops on the next wall. */
function moveShell(w: World, s: Shell, dt: number, ev: TankEvent[]): void {
  const dist = Math.hypot(s.vx, s.vy) * dt;
  const n = Math.max(1, Math.ceil(dist / 0.05));
  for (let i = 0; i < n && !s.dead; i++) {
    s.x += (s.vx * dt) / n;
    s.y += (s.vy * dt) / n;
    let nx = 0;
    let ny = 0;
    let depth = 0;
    for (let ty = Math.floor(s.y - SHELL_R) - 1; ty <= Math.floor(s.y + SHELL_R) + 1; ty++) {
      for (let tx = Math.floor(s.x - SHELL_R) - 1; tx <= Math.floor(s.x + SHELL_R) + 1; tx++) {
        if (!solidForShell(tileAt(w, tx, ty))) continue;
        const p = circleRect(s.x, s.y, SHELL_R, { x: tx, y: ty, w: 1, h: 1 });
        if (p && p.depth > depth) {
          nx = p.nx;
          ny = p.ny;
          depth = p.depth;
        }
      }
    }
    if (depth > 0) {
      const dot = s.vx * nx + s.vy * ny;
      s.x += nx * depth;
      s.y += ny * depth;
      if (dot < 0) {
        if (s.bounces <= 0) {
          s.dead = true;
          ev.push({ type: "pop", x: s.x, y: s.y });
          return;
        }
        s.bounces -= 1;
        s.vx -= 2 * dot * nx;
        s.vy -= 2 * dot * ny;
        ev.push({ type: "bounce", x: s.x, y: s.y });
      }
    }
  }
}

function damage(t: Tank, by: number, ev: TankEvent[]): void {
  if (!t.alive) return;
  if (t.shield > 0) {
    t.shield = 0;
    ev.push({ type: "shieldPop", tank: t.id, x: t.x, y: t.y });
    return;
  }
  t.hp -= 1;
  ev.push({ type: "hit", tank: t.id, x: t.x, y: t.y });
  if (t.hp <= 0) {
    t.alive = false;
    ev.push({ type: "tankDead", tank: t.id, by, x: t.x, y: t.y });
  }
}

/** In the campaign, players' shells never hurt the other player. */
const friendly = (w: World, s: Shell, t: Tank): boolean => !w.versus && t.team === 0 && s.team === 0 && s.owner !== t.id;

function detonate(w: World, m: Mine, ev: TankEvent[]): void {
  m.fuse = -1;
  ev.push({ type: "explode", x: m.x, y: m.y });
  for (let ty = Math.floor(m.y - MINE_BLAST); ty <= Math.floor(m.y + MINE_BLAST); ty++) {
    for (let tx = Math.floor(m.x - MINE_BLAST); tx <= Math.floor(m.x + MINE_BLAST); tx++) {
      if (tx < 0 || ty < 0 || tx >= w.cols || ty >= w.rows) continue;
      if (w.grid[ty * w.cols + tx] === CRATE && Math.hypot(tx + 0.5 - m.x, ty + 0.5 - m.y) <= MINE_BLAST) {
        w.grid[ty * w.cols + tx] = FLOOR;
        ev.push({ type: "crateBreak", tx, ty });
      }
    }
  }
  for (const t of w.tanks) if (t.alive && Math.hypot(t.x - m.x, t.y - m.y) < MINE_BLAST - 0.2) damage(t, m.owner, ev);
  for (const s of w.shells) if (Math.hypot(s.x - m.x, s.y - m.y) < MINE_BLAST) s.dead = true;
  for (const o of w.mines) if (o !== m && o.fuse > 0 && Math.hypot(o.x - m.x, o.y - m.y) < MINE_BLAST) o.age = o.fuse; // chain
}

const POWERS: Power[] = ["laser", "triple", "shield", "speed"];

/** Advances shells, mines, power-ups and timers. Returns what happened, for effects and sounds. */
export function step(w: World, dt: number): TankEvent[] {
  const ev: TankEvent[] = [];
  w.time += dt;
  for (const t of w.tanks) {
    t.cooldown = Math.max(0, t.cooldown - dt);
    t.shield = Math.max(0, t.shield - dt);
    t.speedBoost = Math.max(0, t.speedBoost - dt);
  }
  for (const s of w.shells) {
    s.age += dt;
    moveShell(w, s, dt, ev);
    if (s.age > 14) s.dead = true;
  }
  // shells meeting shells
  for (let i = 0; i < w.shells.length; i++) {
    const a = w.shells[i];
    if (a.dead) continue;
    for (let j = i + 1; j < w.shells.length; j++) {
      const b = w.shells[j];
      if (b.dead || Math.hypot(a.x - b.x, a.y - b.y) > SHELL_R * 2.4) continue;
      a.dead = b.dead = true;
      ev.push({ type: "shellsCollide", x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      break;
    }
  }
  // shells hitting tanks and mines
  for (const s of w.shells) {
    if (s.dead) continue;
    for (const t of w.tanks) {
      if (!t.alive || friendly(w, s, t)) continue;
      if (t.id === s.owner && s.age < 0.15) continue;
      if (Math.hypot(t.x - s.x, t.y - s.y) < KINDS[t.kind].radius + SHELL_R) {
        s.dead = true;
        damage(t, s.owner, ev);
        break;
      }
    }
    if (s.dead) continue;
    for (const m of w.mines) {
      if (m.fuse > 0 && Math.hypot(m.x - s.x, m.y - s.y) < 0.35) {
        s.dead = true;
        m.age = m.fuse;
      }
    }
  }
  w.shells = w.shells.filter((s) => !s.dead);
  // mines: fuse, or a tank driving close once armed
  for (const m of w.mines) {
    if (m.fuse <= 0) continue;
    m.age += dt;
    const near = m.age > 1.2 && w.tanks.some((t) => t.alive && Math.hypot(t.x - m.x, t.y - m.y) < 0.75);
    if (m.age >= m.fuse || near) detonate(w, m, ev);
  }
  w.mines = w.mines.filter((m) => m.fuse > 0);
  // power-up crates (Versus)
  if (w.versus) {
    w.pickupTimer -= dt;
    if (w.pickupTimer <= 0 && w.pickups.length < 2) {
      w.pickupTimer = 8;
      for (let k = 0; k < 40; k++) {
        const tx = Math.floor(w.rng() * w.cols);
        const ty = Math.floor(w.rng() * w.rows);
        const x = tx + 0.5;
        const y = ty + 0.5;
        if (w.grid[ty * w.cols + tx] !== FLOOR || w.tanks.some((t) => t.alive && Math.hypot(t.x - x, t.y - y) < 2.5)) continue;
        w.pickups.push({ x, y, kind: POWERS[Math.floor(w.rng() * POWERS.length)], age: 0 });
        break;
      }
    }
  }
  for (const p of w.pickups) p.age += dt;
  w.pickups = w.pickups.filter((p) => {
    const t = w.tanks.find((q) => q.alive && Math.hypot(q.x - p.x, q.y - p.y) < 0.75);
    if (!t) return p.age < 20;
    if (p.kind === "shield") t.shield = 10;
    else if (p.kind === "speed") t.speedBoost = 8;
    else t.power = { kind: p.kind, shots: p.kind === "laser" ? 4 : 6 };
    ev.push({ type: "pickup", tank: t.id, kind: p.kind });
    return false;
  });
  return ev;
}

/**
 * Follows a shell fired from (x, y) at `angle` with `bounces` ricochets. Returns its path (start, each bounce, end)
 * and the first tank it would hit (-1 for none). The firing tank (`self`) is ignored until the shell has left it.
 */
export function traceShot(w: World, x: number, y: number, angle: number, bounces: number, self: number, maxLen = 40): { points: Pt[]; hit: number } {
  const s: Shell = { id: 0, owner: self, team: -1, x, y, vx: Math.cos(angle), vy: Math.sin(angle), bounces, age: 0, laser: false, dead: false };
  const points: Pt[] = [{ x, y }];
  const ev: TankEvent[] = [];
  const stepLen = 0.06;
  for (let travelled = 0; travelled < maxLen && !s.dead; travelled += stepLen) {
    ev.length = 0;
    moveShell(w, s, stepLen, ev);
    if (ev.some((e) => e.type === "bounce")) points.push({ x: s.x, y: s.y });
    if (s.dead) break;
    for (const t of w.tanks) {
      if (!t.alive) continue;
      if (t.id === self && travelled < KINDS[t.kind].radius + 0.4) continue;
      if (Math.hypot(t.x - s.x, t.y - s.y) < KINDS[t.kind].radius + SHELL_R) {
        points.push({ x: s.x, y: s.y });
        return { points, hit: t.id };
      }
    }
  }
  points.push({ x: s.x, y: s.y });
  return { points, hit: -1 };
}

export const aliveTeams = (w: World): Set<number> => new Set(w.tanks.filter((t) => t.alive).map((t) => t.team));
