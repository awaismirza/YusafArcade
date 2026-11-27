/**
 * Tank Trouble rules: tanks in a maze firing shells that bounce off the walls. Pure: no three.js, no DOM.
 * World units: the maze is C x R cells of CELL units; x runs right, y runs down the screen.
 */
import { angleDiff, circleRect, mulberry32, Rect, Rng } from "../kit/math";

export const CELL = 2.2;
export const WALL_T = 0.16;
export const TANK_R = 0.42;
export const SHELL_R = 0.09;
export const SHELL_SPEED = 6.2;
export const SHELL_LIFE = 7;
export const MAX_SHELLS = 5;
const DRIVE = 3.1;
const TURN = 3.4;

export type Maze = { C: number; R: number; h: boolean[][]; v: boolean[][]; walls: Rect[] };
export type Tank = { id: number; x: number; y: number; a: number; alive: boolean; cooldown: number };
export type Shell = { x: number; y: number; vx: number; vy: number; life: number; owner: number; age: number };
export type World = { maze: Maze; tanks: Tank[]; shells: Shell[] };
export type TankEvent = { type: "fire"; tank: number } | { type: "bounce"; x: number; y: number } | { type: "hit"; tank: number; by: number; x: number; y: number };

/**
 * A maze: h[r][c] is the wall along the top edge of cell (c, r) (r = 0..R), v[r][c] the wall along the left edge
 * (c = 0..C). Built as a perfect maze, then some inner walls are knocked out so there are loops to fight around.
 */
export function makeMaze(seed: number, C = 9, R = 6): Maze {
  const rng = mulberry32(seed);
  const h = Array.from({ length: R + 1 }, () => Array(C).fill(true));
  const v = Array.from({ length: R }, () => Array(C + 1).fill(true));
  const seen = Array.from({ length: R }, () => Array(C).fill(false));
  const stack: [number, number][] = [[Math.floor(rng() * C), Math.floor(rng() * R)]];
  seen[stack[0][1]][stack[0][0]] = true;
  while (stack.length) {
    const [c, r] = stack[stack.length - 1];
    const opts: [number, number][] = [];
    if (c > 0 && !seen[r][c - 1]) opts.push([c - 1, r]);
    if (c < C - 1 && !seen[r][c + 1]) opts.push([c + 1, r]);
    if (r > 0 && !seen[r - 1][c]) opts.push([c, r - 1]);
    if (r < R - 1 && !seen[r + 1][c]) opts.push([c, r + 1]);
    if (!opts.length) {
      stack.pop();
      continue;
    }
    const [nc, nr] = opts[Math.floor(rng() * opts.length)];
    if (nc !== c) v[r][Math.max(c, nc)] = false;
    else h[Math.max(r, nr)][c] = false;
    seen[nr][nc] = true;
    stack.push([nc, nr]);
  }
  // Knock out extra inner walls for loops.
  for (let r = 1; r < R; r++) for (let c = 0; c < C; c++) if (h[r][c] && rng() < 0.28) h[r][c] = false;
  for (let r = 0; r < R; r++) for (let c = 1; c < C; c++) if (v[r][c] && rng() < 0.28) v[r][c] = false;
  return { C, R, h, v, walls: wallRects(C, R, h, v) };
}

function wallRects(C: number, R: number, h: boolean[][], v: boolean[][]): Rect[] {
  const out: Rect[] = [];
  const t = WALL_T;
  for (let r = 0; r <= R; r++) for (let c = 0; c < C; c++) if (h[r][c]) out.push({ x: c * CELL - t / 2, y: r * CELL - t / 2, w: CELL + t, h: t });
  for (let r = 0; r < R; r++) for (let c = 0; c <= C; c++) if (v[r][c]) out.push({ x: c * CELL - t / 2, y: r * CELL - t / 2, w: t, h: CELL + t });
  return out;
}

/** Cells reachable from (0, 0) through the openings: all of them for a good maze. */
export function reachable(m: Maze): number {
  const seen = new Set<number>([0]);
  const q = [0];
  while (q.length) {
    const i = q.shift()!;
    for (const j of neighbours(m, i)) if (!seen.has(j)) {
      seen.add(j);
      q.push(j);
    }
  }
  return seen.size;
}

export function neighbours(m: Maze, i: number): number[] {
  const c = i % m.C;
  const r = Math.floor(i / m.C);
  const out: number[] = [];
  if (c > 0 && !m.v[r][c]) out.push(i - 1);
  if (c < m.C - 1 && !m.v[r][c + 1]) out.push(i + 1);
  if (r > 0 && !m.h[r][c]) out.push(i - m.C);
  if (r < m.R - 1 && !m.h[r + 1][c]) out.push(i + m.C);
  return out;
}

export const cellOf = (m: Maze, x: number, y: number): number => Math.min(m.R - 1, Math.max(0, Math.floor(y / CELL))) * m.C + Math.min(m.C - 1, Math.max(0, Math.floor(x / CELL)));
export const cellCentre = (m: Maze, i: number): { x: number; y: number } => ({ x: ((i % m.C) + 0.5) * CELL, y: (Math.floor(i / m.C) + 0.5) * CELL });

const STARTS = (m: Maze): [number, number, number][] => [
  [0, 0, 0],
  [m.C - 1, m.R - 1, Math.PI],
  [m.C - 1, 0, Math.PI],
  [0, m.R - 1, 0],
];

export function createWorld(tanks: number, seed: number): World {
  const maze = makeMaze(seed);
  const ts: Tank[] = STARTS(maze)
    .slice(0, tanks)
    .map(([c, r, a], id) => ({ id, x: (c + 0.5) * CELL, y: (r + 0.5) * CELL, a, alive: true, cooldown: 0.6 }));
  return { maze, tanks: ts, shells: [] };
}

function pushOut(m: Maze, t: Tank): void {
  for (let k = 0; k < 3; k++) {
    for (const w of m.walls) {
      const p = circleRect(t.x, t.y, TANK_R, w);
      if (p) {
        t.x += p.nx * p.depth;
        t.y += p.ny * p.depth;
      }
    }
  }
}

/** Drives a tank: forward and turn are -1..1. Moves in small steps so it never passes through a wall. */
export function driveTank(w: World, id: number, forward: number, turn: number, dt: number): void {
  const t = w.tanks[id];
  if (!t.alive) return;
  t.a += turn * TURN * dt;
  const dist = forward * DRIVE * dt;
  const n = Math.max(1, Math.ceil(Math.abs(dist) / 0.08));
  for (let i = 0; i < n; i++) {
    t.x += (Math.cos(t.a) * dist) / n;
    t.y += (Math.sin(t.a) * dist) / n;
    pushOut(w.maze, t);
  }
  for (const o of w.tanks) {
    if (o === t || !o.alive) continue;
    const dx = t.x - o.x;
    const dy = t.y - o.y;
    const d = Math.hypot(dx, dy);
    if (d > 0 && d < TANK_R * 2) {
      t.x += (dx / d) * (TANK_R * 2 - d);
      t.y += (dy / d) * (TANK_R * 2 - d);
      pushOut(w.maze, t);
    }
  }
}

/**
 * Touch-friendly steering: (sx, sy) is the direction the player pushes the stick. The tank turns to face it and
 * drives when it roughly does. Returns the forward/turn it used.
 */
export function steerTank(w: World, id: number, sx: number, sy: number, dt: number): { forward: number; turn: number } {
  const mag = Math.min(1, Math.hypot(sx, sy));
  if (mag < 0.15) return { forward: 0, turn: 0 };
  const t = w.tanks[id];
  const want = Math.atan2(sy, sx);
  const d = angleDiff(t.a, want);
  const turn = Math.max(-1, Math.min(1, d * 3));
  const forward = Math.abs(d) < 0.6 ? mag : Math.abs(d) > 2.6 ? 0 : mag * 0.25;
  driveTank(w, id, forward, turn, dt);
  return { forward, turn };
}

export function fire(w: World, id: number): boolean {
  const t = w.tanks[id];
  if (!t.alive || t.cooldown > 0) return false;
  if (w.shells.filter((s) => s.owner === id).length >= MAX_SHELLS) return false;
  const muzzle = TANK_R + SHELL_R + 0.05;
  const s: Shell = { x: t.x, y: t.y, vx: Math.cos(t.a) * SHELL_SPEED, vy: Math.sin(t.a) * SHELL_SPEED, life: SHELL_LIFE, owner: id, age: 0 };
  // Travel out of the barrel in small steps, bouncing if the barrel is against a wall.
  moveShell(w.maze, s, muzzle / SHELL_SPEED);
  w.shells.push(s);
  t.cooldown = 0.28;
  return true;
}

/** Moves a shell, bouncing it off walls. Returns how many times it bounced. */
export function moveShell(m: Maze, s: Shell, dt: number): number {
  const dist = Math.hypot(s.vx, s.vy) * dt;
  const n = Math.max(1, Math.ceil(dist / 0.04));
  let bounces = 0;
  for (let i = 0; i < n; i++) {
    s.x += (s.vx * dt) / n;
    s.y += (s.vy * dt) / n;
    for (const w of m.walls) {
      const p = circleRect(s.x, s.y, SHELL_R, w);
      if (!p) continue;
      s.x += p.nx * p.depth;
      s.y += p.ny * p.depth;
      const dot = s.vx * p.nx + s.vy * p.ny;
      if (dot < 0) {
        s.vx -= 2 * dot * p.nx;
        s.vy -= 2 * dot * p.ny;
        bounces++;
      }
    }
  }
  return bounces;
}

/** Advances shells; a shell can hit its own tank once it has been flying for a moment. */
export function stepWorld(w: World, dt: number): TankEvent[] {
  const ev: TankEvent[] = [];
  for (const t of w.tanks) t.cooldown = Math.max(0, t.cooldown - dt);
  for (const s of w.shells) {
    if (moveShell(w.maze, s, dt) > 0) ev.push({ type: "bounce", x: s.x, y: s.y });
    s.life -= dt;
    s.age += dt;
    for (const t of w.tanks) {
      if (!t.alive) continue;
      if (t.id === s.owner && s.age < 0.25) continue;
      if (Math.hypot(t.x - s.x, t.y - s.y) < TANK_R + SHELL_R) {
        t.alive = false;
        s.life = 0;
        ev.push({ type: "hit", tank: t.id, by: s.owner, x: t.x, y: t.y });
        break;
      }
    }
  }
  w.shells = w.shells.filter((s) => s.life > 0);
  return ev;
}

/** Follows a shell fired at `angle` from tank `id` for a few seconds. Returns the tank it would hit, or -1. */
export function simulateShot(w: World, id: number, angle: number, seconds = 2.2): number {
  const t = w.tanks[id];
  const s: Shell = { x: t.x, y: t.y, vx: Math.cos(angle) * SHELL_SPEED, vy: Math.sin(angle) * SHELL_SPEED, life: seconds, owner: id, age: 0 };
  moveShell(w.maze, s, (TANK_R + SHELL_R + 0.05) / SHELL_SPEED);
  const h = 1 / 30;
  for (let k = 0; k < seconds / h; k++) {
    moveShell(w.maze, s, h);
    s.age += h;
    for (const o of w.tanks) {
      if (!o.alive) continue;
      if (o.id === id && s.age < 0.25) continue;
      if (Math.hypot(o.x - s.x, o.y - s.y) < TANK_R + SHELL_R + 0.05) return o.id;
    }
  }
  return -1;
}

export type AiMemory = { aim: number | null; think: number; lastX: number; lastY: number; stuck: number; reverse: number };
export const newAiMemory = (): AiMemory => ({ aim: null, think: 0, lastX: 0, lastY: 0, stuck: 0, reverse: 0 });

/** The computer tank: looks for a shot (straight or off the walls), otherwise drives towards the nearest enemy. */
export function aiControl(w: World, id: number, mem: AiMemory, dt: number, rng: Rng, level = 1): { forward: number; turn: number; fire: boolean } {
  const t = w.tanks[id];
  if (!t.alive) return { forward: 0, turn: 0, fire: false };
  mem.think -= dt;
  if (mem.think <= 0) {
    mem.think = level === 0 ? 0.45 : 0.25;
    mem.aim = null;
    const tries = level === 0 ? 10 : 20;
    for (let k = 0; k < tries; k++) {
      const a = t.a + (k === 0 ? 0 : (rng() - 0.5) * Math.PI * 2);
      const hit = simulateShot(w, id, a, level === 0 ? 1.2 : 2.2);
      if (hit >= 0 && hit !== id) {
        mem.aim = a;
        break;
      }
    }
    // stuck detection
    if (Math.hypot(t.x - mem.lastX, t.y - mem.lastY) < 0.05) mem.stuck += 0.25;
    else mem.stuck = 0;
    mem.lastX = t.x;
    mem.lastY = t.y;
    if (mem.stuck > 1.2) {
      mem.reverse = 0.6;
      mem.stuck = 0;
    }
  }
  if (mem.reverse > 0) {
    mem.reverse -= dt;
    return { forward: -0.8, turn: 0.6, fire: false };
  }
  if (mem.aim !== null) {
    const d = angleDiff(t.a, mem.aim);
    return { forward: 0, turn: Math.max(-1, Math.min(1, d * 4)), fire: Math.abs(d) < 0.06 };
  }
  // Drive along the maze towards the nearest living enemy.
  const foes = w.tanks.filter((o) => o.alive && o.id !== id);
  if (!foes.length) return { forward: 0, turn: 0, fire: false };
  const m = w.maze;
  const start = cellOf(m, t.x, t.y);
  const prev = new Map<number, number>([[start, -1]]);
  const q = [start];
  const goals = new Set(foes.map((o) => cellOf(m, o.x, o.y)));
  let goal = -1;
  while (q.length) {
    const i = q.shift()!;
    if (goals.has(i)) {
      goal = i;
      break;
    }
    for (const j of neighbours(m, i)) if (!prev.has(j)) {
      prev.set(j, i);
      q.push(j);
    }
  }
  let next = start;
  if (goal >= 0 && goal !== start) {
    next = goal;
    while (prev.get(next) !== start && prev.get(next)! >= 0) next = prev.get(next)!;
  }
  const c = goal === start ? { x: foes[0].x, y: foes[0].y } : cellCentre(m, next);
  const want = Math.atan2(c.y - t.y, c.x - t.x);
  const d = angleDiff(t.a, want);
  return { forward: Math.abs(d) < 0.5 ? 0.9 : 0.1, turn: Math.max(-1, Math.min(1, d * 3)), fire: false };
}

export const aliveTanks = (w: World): number[] => w.tanks.filter((t) => t.alive).map((t) => t.id);
