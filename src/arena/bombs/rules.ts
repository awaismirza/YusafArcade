/**
 * Bomb Blast rules: a Bomberman-style grid game. Pure: no three.js, no DOM.
 * Grid cells are addressed by index i = y * W + x. Players move from cell to cell.
 */
import { mulberry32, Rng } from "../kit/math";

export const W = 13;
export const H = 11;
export const FUSE = 2.5;
export const FLAME_TIME = 0.55;
export const EMPTY = 0;
export const PILLAR = 1;
export const CRATE = 2;

export type Power = "bomb" | "fire" | "speed";
export type Player = {
  id: number;
  /** Cell the player is leaving (x, y) and the cell it is moving to (tx, ty); t goes 0..1 between them. */
  x: number;
  y: number;
  tx: number;
  ty: number;
  t: number;
  dir: [number, number];
  speed: number;
  maxBombs: number;
  range: number;
  alive: boolean;
};
export type Bomb = { cell: number; owner: number; timer: number; range: number };
export type Flame = { cell: number; t: number };
export type Game = {
  cells: Uint8Array;
  hidden: Map<number, Power>;
  powers: Map<number, Power>;
  players: Player[];
  bombs: Bomb[];
  flames: Flame[];
  time: number;
};
export type GameEvent =
  | { type: "explode"; cells: number[]; at: number }
  | { type: "crate"; cell: number }
  | { type: "dead"; player: number }
  | { type: "pickup"; player: number; power: Power };

export const idx = (x: number, y: number): number => y * W + x;
export const cx = (i: number): number => i % W;
export const cy = (i: number): number => Math.floor(i / W);
const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H;
export const DIRS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
export const SPAWNS: [number, number][] = [
  [0, 0],
  [W - 1, H - 1],
  [W - 1, 0],
  [0, H - 1],
];

export function isPillar(x: number, y: number): boolean {
  return x % 2 === 1 && y % 2 === 1;
}

export function createGame(players: number, seed: number): Game {
  const rng = mulberry32(seed);
  const cells = new Uint8Array(W * H);
  const safe = new Set<number>();
  for (const [sx, sy] of SPAWNS) {
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
      if (inside(sx + dx, sy + dy)) safe.add(idx(sx + dx, sy + dy));
    }
  }
  const hidden = new Map<number, Power>();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      if (isPillar(x, y)) cells[i] = PILLAR;
      else if (!safe.has(i) && rng() < 0.72) {
        cells[i] = CRATE;
        const r = rng();
        if (r < 0.12) hidden.set(i, "bomb");
        else if (r < 0.24) hidden.set(i, "fire");
        else if (r < 0.32) hidden.set(i, "speed");
      }
    }
  }
  const ps: Player[] = [];
  for (let p = 0; p < players; p++) {
    const [x, y] = SPAWNS[p];
    ps.push({ id: p, x, y, tx: x, ty: y, t: 0, dir: [0, 1], speed: 3.4, maxBombs: 1, range: 2, alive: true });
  }
  return { cells, hidden, powers: new Map(), players: ps, bombs: [], flames: [], time: 0 };
}

/** The cell a player counts as standing in (the nearer of the two while moving). */
export function playerCell(p: Player): number {
  return p.t < 0.5 ? idx(p.x, p.y) : idx(p.tx, p.ty);
}

export function walkable(g: Game, x: number, y: number): boolean {
  if (!inside(x, y)) return false;
  const i = idx(x, y);
  if (g.cells[i] !== EMPTY) return false;
  return !g.bombs.some((b) => b.cell === i);
}

/** Steers a player one step: (dx, dy) is the wanted direction (one axis), (0, 0) to stand still. */
export function movePlayer(g: Game, id: number, dx: number, dy: number, dt: number): GameEvent[] {
  const p = g.players[id];
  const ev: GameEvent[] = [];
  if (!p.alive) return ev;
  if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
  else dx = 0;
  dx = Math.sign(dx);
  dy = Math.sign(dy);
  let left = dt * p.speed;
  const moving = p.x !== p.tx || p.y !== p.ty;
  if (moving && dx === p.x - p.tx && dy === p.y - p.ty && (dx || dy)) {
    // Turn back mid-step.
    [p.x, p.tx, p.y, p.ty] = [p.tx, p.x, p.ty, p.y];
    p.t = 1 - p.t;
    p.dir = [dx, dy];
  }
  while (left > 0) {
    if (p.x === p.tx && p.y === p.ty) {
      if (!dx && !dy) break;
      if (!walkable(g, p.x + dx, p.y + dy)) {
        p.dir = [dx, dy];
        break;
      }
      p.tx = p.x + dx;
      p.ty = p.y + dy;
      p.t = 0;
      p.dir = [dx, dy];
    }
    const need = 1 - p.t;
    if (left >= need) {
      left -= need;
      p.x = p.tx;
      p.y = p.ty;
      p.t = 0;
      const i = idx(p.x, p.y);
      const pw = g.powers.get(i);
      if (pw) {
        g.powers.delete(i);
        if (pw === "bomb") p.maxBombs = Math.min(5, p.maxBombs + 1);
        else if (pw === "fire") p.range = Math.min(6, p.range + 1);
        else p.speed = Math.min(5.6, p.speed + 0.55);
        ev.push({ type: "pickup", player: id, power: pw });
      }
    } else {
      p.t += left;
      left = 0;
    }
  }
  return ev;
}

export function placeBomb(g: Game, id: number): boolean {
  const p = g.players[id];
  if (!p.alive) return false;
  const cell = playerCell(p);
  if (g.bombs.some((b) => b.cell === cell)) return false;
  if (g.bombs.filter((b) => b.owner === id).length >= p.maxBombs) return false;
  g.bombs.push({ cell, owner: id, timer: FUSE, range: p.range });
  return true;
}

/** Cells a bomb's flames reach: stops at pillars and edges, and at (including) the first crate. */
export function blastCells(g: Game, cell: number, range: number): number[] {
  const out = [cell];
  for (const [dx, dy] of DIRS) {
    for (let r = 1; r <= range; r++) {
      const x = cx(cell) + dx * r;
      const y = cy(cell) + dy * r;
      if (!inside(x, y)) break;
      const i = idx(x, y);
      if (g.cells[i] === PILLAR) break;
      out.push(i);
      if (g.cells[i] === CRATE) break;
    }
  }
  return out;
}

/** Advances bombs and flames. Returns what happened so the app can play effects. */
export function tick(g: Game, dt: number): GameEvent[] {
  const ev: GameEvent[] = [];
  g.time += dt;
  for (const b of g.bombs) b.timer -= dt;
  // Explode (with chain reactions) every bomb whose fuse ran out.
  let guard = 0;
  while (guard++ < 50) {
    const k = g.bombs.findIndex((b) => b.timer <= 0);
    if (k < 0) break;
    const b = g.bombs[k];
    g.bombs.splice(k, 1);
    const cells = blastCells(g, b.cell, b.range);
    ev.push({ type: "explode", cells, at: b.cell });
    for (const c of cells) {
      g.flames.push({ cell: c, t: FLAME_TIME });
      const other = g.bombs.find((o) => o.cell === c);
      if (other) other.timer = 0;
      if (g.powers.has(c) && g.cells[c] === EMPTY) g.powers.delete(c);
    }
    for (const c of cells) {
      if (g.cells[c] === CRATE) {
        g.cells[c] = EMPTY;
        const pw = g.hidden.get(c);
        if (pw) {
          g.hidden.delete(c);
          g.powers.set(c, pw);
        }
        ev.push({ type: "crate", cell: c });
      }
    }
  }
  for (const f of g.flames) f.t -= dt;
  g.flames = g.flames.filter((f) => f.t > 0);
  const burning = new Set(g.flames.map((f) => f.cell));
  for (const p of g.players) {
    if (p.alive && burning.has(playerCell(p))) {
      p.alive = false;
      ev.push({ type: "dead", player: p.id });
    }
  }
  return ev;
}

export function alive(g: Game): number[] {
  return g.players.filter((p) => p.alive).map((p) => p.id);
}

// ------------------------------------------------------------------ computer player

/** Seconds until each cell is on fire (Infinity if no bomb reaches it). Counts chain reactions. */
export function dangerMap(g: Game): Float64Array {
  const d = new Float64Array(W * H).fill(Infinity);
  for (const f of g.flames) d[f.cell] = 0;
  // Effective fuse: a bomb caught in an earlier blast goes off at that time.
  const fuse = g.bombs.map((b) => b.timer);
  for (let pass = 0; pass < g.bombs.length; pass++) {
    g.bombs.forEach((b, i) => {
      for (const c of blastCells(g, b.cell, b.range)) {
        const j = g.bombs.findIndex((o) => o.cell === c);
        if (j >= 0 && fuse[j] > fuse[i]) fuse[j] = fuse[i];
      }
    });
  }
  g.bombs.forEach((b, i) => {
    for (const c of blastCells(g, b.cell, b.range)) d[c] = Math.min(d[c], Math.max(0, fuse[i]));
  });
  return d;
}

/** Breadth-first distances (in steps) from a cell over walkable cells. The start may hold a bomb. */
function bfs(g: Game, start: number, avoid?: (i: number, steps: number) => boolean): { dist: Int32Array; prev: Int32Array } {
  const dist = new Int32Array(W * H).fill(-1);
  const prev = new Int32Array(W * H).fill(-1);
  dist[start] = 0;
  const q = [start];
  while (q.length) {
    const i = q.shift()!;
    for (const [dx, dy] of DIRS) {
      const x = cx(i) + dx;
      const y = cy(i) + dy;
      if (!walkable(g, x, y)) continue;
      const j = idx(x, y);
      if (dist[j] >= 0) continue;
      if (avoid && avoid(j, dist[i] + 1)) continue;
      dist[j] = dist[i] + 1;
      prev[j] = i;
      q.push(j);
    }
  }
  return { dist, prev };
}

function firstStep(prev: Int32Array, start: number, goal: number): number {
  let c = goal;
  while (prev[c] !== start && prev[c] >= 0) c = prev[c];
  return c;
}

/** True if, standing at cell `from` after dropping a bomb there, a safe cell is close enough to reach in time. */
function canEscape(g: Game, id: number, from: number): boolean {
  const p = g.players[id];
  const test: Game = { ...g, bombs: [...g.bombs, { cell: from, owner: id, timer: FUSE, range: p.range }] };
  const danger = dangerMap(test);
  const { dist } = bfs(test, from, (j, steps) => danger[j] < steps / p.speed + 0.35);
  for (let i = 0; i < W * H; i++) if (dist[i] >= 0 && danger[i] === Infinity && dist[i] / p.speed < FUSE - 0.4) return true;
  return false;
}

/** What a computer player wants to do this frame. */
export function aiInput(g: Game, id: number, rng: Rng): { dx: number; dy: number; bomb: boolean } {
  const p = g.players[id];
  const none = { dx: 0, dy: 0, bomb: false };
  if (!p.alive) return none;
  if (p.x !== p.tx || p.y !== p.ty) return { dx: p.tx - p.x, dy: p.ty - p.y, bomb: false }; // finish the step
  const here = idx(p.x, p.y);
  const danger = dangerMap(g);
  const step = (to: number): { dx: number; dy: number; bomb: boolean } => ({ dx: cx(to) - p.x, dy: cy(to) - p.y, bomb: false });
  const unsafe = (j: number, steps: number): boolean => danger[j] < steps / p.speed + 0.6;

  // 1) In danger: run to the nearest safe cell.
  if (danger[here] < Infinity) {
    const { dist, prev } = bfs(g, here, unsafe);
    let best = -1;
    for (let i = 0; i < W * H; i++) if (dist[i] > 0 && danger[i] === Infinity && (best < 0 || dist[i] < dist[best])) best = i;
    if (best >= 0) return step(firstStep(prev, here, best));
    // No fully safe cell: move to whichever reachable cell burns latest.
    let late = here;
    for (const [dx, dy] of DIRS) {
      if (walkable(g, p.x + dx, p.y + dy) && danger[idx(p.x + dx, p.y + dy)] > danger[late]) late = idx(p.x + dx, p.y + dy);
    }
    return late === here ? none : step(late);
  }

  // 2) Next to a crate or an opponent in line: drop a bomb if we can get away.
  const myBombs = g.bombs.filter((b) => b.owner === id).length;
  if (myBombs < p.maxBombs) {
    const reach = blastCells(g, here, p.range);
    const hitsCrate = reach.some((c) => g.cells[c] === CRATE);
    const hitsFoe = g.players.some((o) => o.alive && o.id !== id && reach.includes(playerCell(o)));
    if ((hitsCrate || hitsFoe) && canEscape(g, id, here) && rng() < 0.9) return { dx: 0, dy: 0, bomb: true };
  }

  // 3) Walk (only through safe cells) towards a power-up, a cell next to a crate, or an opponent.
  const { dist, prev } = bfs(g, here, (j) => danger[j] < Infinity);
  let target = -1;
  let score = Infinity;
  for (let i = 0; i < W * H; i++) {
    if (dist[i] <= 0) continue;
    let s = Infinity;
    if (g.powers.has(i)) s = dist[i] - 4;
    else if (DIRS.some(([dx, dy]) => inside(cx(i) + dx, cy(i) + dy) && g.cells[idx(cx(i) + dx, cy(i) + dy)] === CRATE)) s = dist[i];
    else if (g.players.some((o) => o.alive && o.id !== id && playerCell(o) === i)) s = dist[i] + 1;
    if (s < score) {
      score = s;
      target = i;
    }
  }
  if (target < 0) {
    // Nothing to do: wander to a random safe neighbour now and then.
    if (rng() < 0.05) {
      const opts = DIRS.filter(([dx, dy]) => walkable(g, p.x + dx, p.y + dy) && danger[idx(p.x + dx, p.y + dy)] === Infinity);
      if (opts.length) {
        const [dx, dy] = opts[Math.floor(rng() * opts.length)];
        return { dx, dy, bomb: false };
      }
    }
    return none;
  }
  return step(firstStep(prev, here, target));
}
