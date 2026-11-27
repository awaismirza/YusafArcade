/**
 * Mini Golf World: the nine holes as data. Pure: no three.js, no DOM.
 * Units: the hole lies in the x/y plane (y runs towards the bottom of the screen). Every coordinate is on a 0.5 grid.
 */
import { Rect } from "../kit/math";

export type Mover =
  | { kind: "slide"; x: number; y: number; w: number; h: number; dx: number; dy: number; amp: number; period: number }
  | { kind: "spin"; x: number; y: number; len: number; width: number; period: number };
export type Slope = Rect & { ax: number; ay: number };
export type Hole = {
  name: string;
  par: number;
  tee: { x: number; y: number };
  cup: { x: number; y: number };
  /** Ground you can play on: the union of these rectangles. Its outline becomes the walls. */
  fairway: Rect[];
  bumpers: { x: number; y: number; r: number }[];
  slopes: Slope[];
  sand: Rect[];
  water: Rect[];
  movers: Mover[];
  /** Extra solid blocks inside the fairway. */
  blocks: Rect[];
};

const R = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });
const base = { bumpers: [], slopes: [], sand: [], water: [], movers: [], blocks: [] };

export const HOLES: Hole[] = [
  { ...base, name: "First Putt", par: 2, tee: { x: 1.5, y: 9 }, cup: { x: 1.5, y: 1.5 }, fairway: [R(0, 0, 3, 10.5)] },
  { ...base, name: "Dogleg", par: 3, tee: { x: 1.5, y: 10.5 }, cup: { x: 8.5, y: 1.5 }, fairway: [R(0, 0, 3, 12), R(0, 0, 10, 3)] },
  {
    ...base,
    name: "Bumper Alley",
    par: 2,
    tee: { x: 2.5, y: 11 },
    cup: { x: 2.5, y: 1 },
    fairway: [R(0, 0, 5, 12)],
    bumpers: [
      { x: 1.2, y: 6, r: 0.45 },
      { x: 3.8, y: 6, r: 0.45 },
      { x: 2.5, y: 4, r: 0.45 },
      { x: 2.5, y: 8, r: 0.45 },
    ],
  },
  {
    ...base,
    name: "Windmill",
    par: 3,
    tee: { x: 2, y: 11 },
    cup: { x: 2, y: 1.5 },
    fairway: [R(0, 0, 4, 12)],
    movers: [{ kind: "spin", x: 2, y: 6, len: 1.6, width: 0.26, period: 4 }],
  },
  {
    ...base,
    name: "Hill Climb",
    par: 3,
    tee: { x: 2, y: 11 },
    cup: { x: 2, y: 1.5 },
    fairway: [R(0, 0, 4, 12)],
    slopes: [{ ...R(0, 4, 4, 4), ax: 0, ay: 2.2 }],
  },
  {
    ...base,
    name: "Bridge",
    par: 3,
    tee: { x: 3, y: 11 },
    cup: { x: 3, y: 1.5 },
    fairway: [R(0, 0, 6, 12)],
    water: [R(0, 5, 2.5, 2), R(3.5, 5, 2.5, 2)],
  },
  {
    ...base,
    name: "Zig Zag",
    par: 4,
    tee: { x: 1.5, y: 10.5 },
    cup: { x: 1.5, y: 1.5 },
    fairway: [R(0, 9, 9, 3), R(6, 3, 3, 9), R(0, 0, 9, 3)],
    bumpers: [{ x: 7.5, y: 6, r: 0.4 }],
  },
  {
    ...base,
    name: "Slider Gates",
    par: 3,
    tee: { x: 3, y: 11 },
    cup: { x: 3, y: 1 },
    fairway: [R(0, 0, 6, 12)],
    movers: [
      { kind: "slide", x: 3, y: 4, w: 2.2, h: 0.4, dx: 1, dy: 0, amp: 1.9, period: 3 },
      { kind: "slide", x: 3, y: 8, w: 2.2, h: 0.4, dx: 1, dy: 0, amp: 1.9, period: 3.8 },
    ],
  },
  {
    ...base,
    name: "Sandy Loop",
    par: 4,
    tee: { x: 1.5, y: 8.5 },
    cup: { x: 8.5, y: 8.5 },
    fairway: [R(0, 0, 10, 3), R(0, 0, 3, 10), R(7, 0, 3, 10)],
    sand: [R(0, 0, 2, 2), R(8, 0, 2, 2)],
    bumpers: [{ x: 5, y: 1.5, r: 0.45 }],
  },
];

/**
 * Walls along the outline of a hole's fairway (cells of 0.5 that are inside, next to cells that are outside),
 * plus its blocks. Thickness 0.2, placed just outside the playable ground.
 */
export function holeWalls(h: Hole): Rect[] {
  const cached = wallCache.get(h);
  if (cached) return cached;
  const S = 0.5;
  const inside = (x: number, y: number): boolean => h.fairway.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  const T = 0.2;
  const out: Rect[] = [];
  let maxX = 0;
  let maxY = 0;
  for (const r of h.fairway) {
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  for (let y = 0; y < maxY; y += S) {
    for (let x = 0; x < maxX; x += S) {
      const cx = x + S / 2;
      const cy = y + S / 2;
      if (!inside(cx, cy)) continue;
      if (!inside(cx - S, cy)) out.push({ x: x - T, y: y - T, w: T, h: S + 2 * T });
      if (!inside(cx + S, cy)) out.push({ x: x + S, y: y - T, w: T, h: S + 2 * T });
      if (!inside(cx, cy - S)) out.push({ x: x - T, y: y - T, w: S + 2 * T, h: T });
      if (!inside(cx, cy + S)) out.push({ x: x - T, y: y + S, w: S + 2 * T, h: T });
    }
  }
  const walls = [...mergeWalls(out), ...h.blocks];
  wallCache.set(h, walls);
  return walls;
}
const wallCache = new WeakMap<Hole, Rect[]>();

/** Joins wall pieces that line up into longer walls (fewer meshes and fewer collision checks). */
function mergeWalls(ws: Rect[]): Rect[] {
  const key = (r: Rect): string => `${r.x.toFixed(2)},${r.y.toFixed(2)},${r.w.toFixed(2)},${r.h.toFixed(2)}`;
  const uniq = new Map<string, Rect>();
  for (const w of ws) uniq.set(key(w), { ...w });
  let list = [...uniq.values()];
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < list.length; i++) {
      for (let j = 0; j < list.length; j++) {
        if (i === j) continue;
        const a = list[i];
        const b = list[j];
        const eq = (p: number, q: number): boolean => Math.abs(p - q) < 1e-6;
        // horizontal pieces in a row
        if (eq(a.y, b.y) && eq(a.h, b.h) && a.w > a.h && b.w > b.h && a.x < b.x && b.x <= a.x + a.w + 1e-6) {
          list[i] = { x: a.x, y: a.y, w: Math.max(a.x + a.w, b.x + b.w) - a.x, h: a.h };
          list.splice(j, 1);
          merged = true;
          break outer;
        }
        // vertical pieces in a column
        if (eq(a.x, b.x) && eq(a.w, b.w) && a.h > a.w && b.h > b.w && a.y < b.y && b.y <= a.y + a.h + 1e-6) {
          list[i] = { x: a.x, y: a.y, w: a.w, h: Math.max(a.y + a.h, b.y + b.h) - a.y };
          list.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
    if (list.length > 400) break;
  }
  list = list.filter((r) => r.w > 0 && r.h > 0);
  return list;
}

export function onFairway(h: Hole, x: number, y: number): boolean {
  return h.fairway.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}

export function holeSize(h: Hole): { w: number; h: number } {
  let w = 0;
  let hh = 0;
  for (const r of h.fairway) {
    w = Math.max(w, r.x + r.w);
    hh = Math.max(hh, r.y + r.h);
  }
  return { w, h: hh };
}
