/** Small pure maths helpers shared by the 3D Arena games. No three.js, no DOM. */

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Shortest signed turn from angle a to angle b, within (-PI, PI]. */
export function angleDiff(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** Velocity (vx, vy) bounced off a surface with unit normal (nx, ny). */
export function reflect(vx: number, vy: number, nx: number, ny: number): { x: number; y: number } {
  const d = vx * nx + vy * ny;
  return { x: vx - 2 * d * nx, y: vy - 2 * d * ny };
}

export type Rect = { x: number; y: number; w: number; h: number };

/**
 * If a circle at (cx, cy) with radius r overlaps the box, returns the unit normal to push it out along and
 * how far. Returns null when they do not touch.
 */
export function circleRect(cx: number, cy: number, r: number, b: Rect): { nx: number; ny: number; depth: number } | null {
  const px = clamp(cx, b.x, b.x + b.w);
  const py = clamp(cy, b.y, b.y + b.h);
  const dx = cx - px;
  const dy = cy - py;
  const d2 = dx * dx + dy * dy;
  if (d2 > 0) {
    if (d2 >= r * r) return null;
    const d = Math.sqrt(d2);
    return { nx: dx / d, ny: dy / d, depth: r - d };
  }
  // Centre is inside the box: push out through the nearest side.
  const left = cx - b.x;
  const right = b.x + b.w - cx;
  const top = cy - b.y;
  const bottom = b.y + b.h - cy;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { nx: -1, ny: 0, depth: left + r };
  if (m === right) return { nx: 1, ny: 0, depth: right + r };
  if (m === top) return { nx: 0, ny: -1, depth: top + r };
  return { nx: 0, ny: 1, depth: bottom + r };
}

/** Closest point to (px, py) on the segment from (ax, ay) to (bx, by), and how far along it is (0..1). */
export function segClosest(px: number, py: number, ax: number, ay: number, bx: number, by: number): { x: number; y: number; t: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
  return { x: ax + dx * t, y: ay + dy * t, t };
}

/** Small seeded random number generator: returns numbers in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;
export const randInt = (rng: Rng, a: number, b: number): number => a + Math.floor(rng() * (b - a + 1));
