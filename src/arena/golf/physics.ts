/** Mini golf ball physics and a shot planner (used by tests and by the computer player). Pure. */
import { circleRect, Rect, Rng } from "../kit/math";
import { Hole, holeSize, holeWalls, Mover, onFairway } from "./course";

export const BALL_R = 0.15;
export const CUP_R = 0.2;
export const MAX_SHOT = 9;
const ROLL = 1.7;
const SAND = 7;
const CAPTURE_SPEED = 3.4;

export type Ball = { x: number; y: number; vx: number; vy: number };
export type BallState = "moving" | "stopped" | "sunk" | "water";

const inRect = (r: Rect, x: number, y: number): boolean => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export function shotVelocity(angle: number, power: number): { vx: number; vy: number } {
  const s = Math.max(0, Math.min(1, power)) * MAX_SHOT;
  return { vx: Math.cos(angle) * s, vy: Math.sin(angle) * s };
}

/** Where a moving obstacle is at time t: rectangles in local space plus a rotation about (x, y). */
export function moverPose(m: Mover, t: number): { x: number; y: number; angle: number; rects: Rect[]; vx: number; vy: number; omega: number } {
  if (m.kind === "slide") {
    const ph = (2 * Math.PI * t) / m.period;
    const off = Math.sin(ph) * m.amp;
    const speed = Math.cos(ph) * m.amp * ((2 * Math.PI) / m.period);
    return { x: m.x + m.dx * off, y: m.y + m.dy * off, angle: 0, rects: [{ x: -m.w / 2, y: -m.h / 2, w: m.w, h: m.h }], vx: m.dx * speed, vy: m.dy * speed, omega: 0 };
  }
  const omega = (2 * Math.PI) / m.period;
  return {
    x: m.x,
    y: m.y,
    angle: omega * t,
    rects: [
      { x: -m.len, y: -m.width / 2, w: m.len * 2, h: m.width },
      { x: -m.width / 2, y: -m.len, w: m.width, h: m.len * 2 },
    ],
    vx: 0,
    vy: 0,
    omega,
  };
}

function bounce(b: Ball, nx: number, ny: number, depth: number, k: number, svx = 0, svy = 0): void {
  b.x += nx * depth;
  b.y += ny * depth;
  const rvx = b.vx - svx;
  const rvy = b.vy - svy;
  const d = rvx * nx + rvy * ny;
  if (d < 0) {
    b.vx = svx + rvx - (1 + k) * d * nx;
    b.vy = svy + rvy - (1 + k) * d * ny;
  }
}

/** Moves the ball for dt seconds at hole time t. */
export function stepBall(b: Ball, h: Hole, t: number, dt: number): BallState {
  const walls = holeWalls(h);
  const speed0 = Math.hypot(b.vx, b.vy);
  const n = Math.max(1, Math.ceil((speed0 * dt) / 0.05));
  const sdt = dt / n;
  for (let i = 0; i < n; i++) {
    const tt = t + sdt * i;
    // forces
    let ax = 0;
    let ay = 0;
    for (const s of h.slopes) if (inRect(s, b.x, b.y)) {
      ax += s.ax;
      ay += s.ay;
    }
    b.vx += ax * sdt;
    b.vy += ay * sdt;
    const sp = Math.hypot(b.vx, b.vy);
    const fr = (h.sand.some((r) => inRect(r, b.x, b.y)) ? SAND : ROLL) * sdt;
    if (sp > 0) {
      const ns = Math.max(0, sp - fr);
      b.vx *= ns / sp;
      b.vy *= ns / sp;
    }
    b.x += b.vx * sdt;
    b.y += b.vy * sdt;
    // collisions
    for (const w of walls) {
      const p = circleRect(b.x, b.y, BALL_R, w);
      if (p) bounce(b, p.nx, p.ny, p.depth, 0.75);
    }
    for (const u of h.bumpers) {
      const dx = b.x - u.x;
      const dy = b.y - u.y;
      const d = Math.hypot(dx, dy);
      if (d < u.r + BALL_R && d > 0) bounce(b, dx / d, dy / d, u.r + BALL_R - d, 0.95);
    }
    for (const m of h.movers) {
      const pose = moverPose(m, tt);
      const c = Math.cos(-pose.angle);
      const s = Math.sin(-pose.angle);
      const lx = (b.x - pose.x) * c - (b.y - pose.y) * s;
      const ly = (b.x - pose.x) * s + (b.y - pose.y) * c;
      for (const r of pose.rects) {
        const p = circleRect(lx, ly, BALL_R, r);
        if (!p) continue;
        const cb = Math.cos(pose.angle);
        const sb = Math.sin(pose.angle);
        const nx = p.nx * cb - p.ny * sb;
        const ny = p.nx * sb + p.ny * cb;
        // surface speed of the blade at the ball, or of the slider
        const svx = pose.vx - pose.omega * (b.y - pose.y);
        const svy = pose.vy + pose.omega * (b.x - pose.x);
        bounce(b, nx, ny, p.depth, 0.6, svx, svy);
      }
    }
    // hazards and the cup
    if (h.water.some((r) => inRect(r, b.x, b.y))) return "water";
    const dc = Math.hypot(b.x - h.cup.x, b.y - h.cup.y);
    if (dc < CUP_R && Math.hypot(b.vx, b.vy) < CAPTURE_SPEED) {
      b.x = h.cup.x;
      b.y = h.cup.y;
      b.vx = b.vy = 0;
      return "sunk";
    }
    if (!onFairway(h, b.x, b.y)) return "water"; // escaped somehow: treat as out of bounds
  }
  const sp = Math.hypot(b.vx, b.vy);
  const onSlope = h.slopes.some((s) => inRect(s, b.x, b.y));
  if (sp < 0.04 && !onSlope) {
    b.vx = b.vy = 0;
    return "stopped";
  }
  return "moving";
}

/** Plays one shot to the end. Returns where the ball stopped (or the start spot after water) and the outcome. */
export function simulateShot(h: Hole, from: { x: number; y: number }, angle: number, power: number, t0: number, maxT = 14): { x: number; y: number; state: BallState; t: number } {
  const v = shotVelocity(angle, power);
  const b: Ball = { x: from.x, y: from.y, vx: v.vx, vy: v.vy };
  const dt = 1 / 60;
  let t = t0;
  for (let k = 0; k < maxT / dt; k++) {
    const s = stepBall(b, h, t, dt);
    t += dt;
    if (s === "sunk") return { x: b.x, y: b.y, state: s, t };
    if (s === "water") return { x: from.x, y: from.y, state: s, t };
    if (s === "stopped") return { x: b.x, y: b.y, state: s, t };
  }
  return { x: b.x, y: b.y, state: "stopped", t };
}

/** Walking distance to the cup over the fairway (0.5 grid), so the planner goes round corners. */
export function distanceField(h: Hole): (x: number, y: number) => number {
  const S = 0.5;
  const { w, h: hh } = holeSize(h);
  const C = Math.ceil(w / S);
  const RR = Math.ceil(hh / S);
  const dist = new Float64Array(C * RR).fill(Infinity);
  const ok = (c: number, r: number): boolean => c >= 0 && r >= 0 && c < C && r < RR && onFairway(h, (c + 0.5) * S, (r + 0.5) * S) && !h.water.some((q) => inRect(q, (c + 0.5) * S, (r + 0.5) * S));
  const start = Math.floor(h.cup.y / S) * C + Math.floor(h.cup.x / S);
  dist[start] = 0;
  const q = [start];
  while (q.length) {
    const i = q.shift()!;
    const c = i % C;
    const r = Math.floor(i / C);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!ok(c + dc, r + dr)) continue;
      const j = (r + dr) * C + c + dc;
      if (dist[j] > dist[i] + 1) {
        dist[j] = dist[i] + 1;
        q.push(j);
      }
    }
  }
  return (x, y) => {
    const c = Math.max(0, Math.min(C - 1, Math.floor(x / S)));
    const r = Math.max(0, Math.min(RR - 1, Math.floor(y / S)));
    const d = dist[r * C + c];
    return (d === Infinity ? 999 : d * S) + Math.hypot(x - h.cup.x, y - h.cup.y) * 0.1;
  };
}

/** Picks a good shot from a spot: tries many aims and powers and keeps the one that ends nearest the cup. */
export function planShot(h: Hole, from: { x: number; y: number }, t0: number, rng: Rng, samples = 140): { angle: number; power: number; result: ReturnType<typeof simulateShot> } {
  const field = distanceField(h);
  let best = { angle: 0, power: 0.3, result: simulateShot(h, from, 0, 0.3, t0), score: Infinity };
  const direct = Math.atan2(h.cup.y - from.y, h.cup.x - from.x);
  for (let k = 0; k < samples; k++) {
    const angle = k < samples / 3 ? direct + (rng() - 0.5) * 0.6 : rng() * Math.PI * 2;
    const power = 0.12 + rng() * 0.88;
    const result = simulateShot(h, from, angle, power, t0);
    const score = result.state === "sunk" ? -1 : result.state === "water" ? 9999 : field(result.x, result.y);
    if (score < best.score) best = { angle, power, result, score };
    if (score < 0) break;
  }
  return best;
}
