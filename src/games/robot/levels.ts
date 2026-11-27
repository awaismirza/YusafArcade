/** Code the Robot: level layouts that are always solvable within the command limit. Pure: no Phaser. */
import type { Rng } from "../rounds/types";

export type Pt = { x: number; y: number };
export type Level = { start: Pt; goal: Pt; walls: string[]; maxCmds: number; shortest: number };
export const LEVEL_COUNT = 12;
export const MAX_SLOTS = 12;

const key = (p: Pt): string => `${p.x},${p.y}`;
const DIRS: Pt[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

/** Fewest moves from start to goal avoiding walls, or -1 if there is no way. */
export function shortestPath(size: number, walls: ReadonlySet<string>, start: Pt, goal: Pt): number {
  const dist = new Map<string, number>([[key(start), 0]]);
  const q: Pt[] = [start];
  while (q.length) {
    const p = q.shift()!;
    const d = dist.get(key(p))!;
    if (p.x === goal.x && p.y === goal.y) return d;
    for (const s of DIRS) {
      const n = { x: p.x + s.x, y: p.y + s.y };
      if (n.x < 0 || n.y < 0 || n.x >= size || n.y >= size || walls.has(key(n)) || dist.has(key(n))) continue;
      dist.set(key(n), d + 1);
      q.push(n);
    }
  }
  return -1;
}

/** Random self-avoiding walk of `length` steps from a random cell, or null if it got stuck. */
function walk(size: number, length: number, rng: Rng): Pt[] | null {
  const start = { x: Math.floor(rng() * size), y: Math.floor(rng() * size) };
  const path = [start];
  const seen = new Set([key(start)]);
  while (path.length <= length) {
    const last = path[path.length - 1];
    const options = DIRS.map((d) => ({ x: last.x + d.x, y: last.y + d.y })).filter((p) => p.x >= 0 && p.y >= 0 && p.x < size && p.y < size && !seen.has(key(p)));
    if (!options.length) return null;
    const next = options[Math.floor(rng() * options.length)];
    path.push(next);
    seen.add(key(next));
  }
  return path;
}

export function makeLevel(tier: 0 | 1, level: number, size: number, rng: Rng): Level {
  const length = tier === 0 ? Math.min(10, 2 + level) : Math.min(11, 4 + level);
  let path: Pt[] | null = null;
  for (let i = 0; i < 400 && !path; i++) path = walk(size, length, rng);
  if (!path) path = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }];
  const start = path[0];
  const goal = path[path.length - 1];
  const onPath = new Set(path.map(key));
  const cap = size * size - path.length - 2;
  const wallCount = Math.min(cap, tier === 0 ? 2 + level : 5 + level * 2);
  const walls = new Set<string>();
  for (let guard = 0; walls.size < wallCount && guard < 600; guard++) {
    const p = { x: Math.floor(rng() * size), y: Math.floor(rng() * size) };
    if (!onPath.has(key(p))) walls.add(key(p));
  }
  const shortest = shortestPath(size, walls, start, goal);
  const slack = level >= 7 ? 2 : tier === 0 ? 4 : 3;
  return { start, goal, walls: [...walls], maxCmds: Math.min(MAX_SLOTS, shortest + slack), shortest };
}
