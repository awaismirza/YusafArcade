/**
 * Air hockey physics on a flat table. Pure: no three.js, no DOM.
 * Table coordinates: x across (-w/2..w/2), y along the table. Player 0 defends the bottom end (y = +h/2),
 * player 1 (or the computer) defends the top end (y = -h/2).
 */
import { clamp } from "../kit/math";

export const TABLE = { w: 6, h: 10, goalW: 2.2 };
export const PUCK_R = 0.28;
export const PADDLE_R = 0.46;
export const MAX_SPEED = 15;
const RESTITUTION = 0.92;
const WALL_BOUNCE = 0.9;
const FRICTION = 0.12;

export type Puck = { x: number; y: number; vx: number; vy: number };
/** A paddle's position now (x, y) and at the previous step (px, py). */
export type Paddle = { x: number; y: number; px: number; py: number };

export const newPuck = (): Puck => ({ x: 0, y: 0, vx: 0, vy: 0 });

/** Keeps a paddle inside its own half. Side 0 is the bottom half (y > 0), side 1 the top half. */
export function clampPaddle(side: 0 | 1, x: number, y: number): { x: number; y: number } {
  const cx = clamp(x, -TABLE.w / 2 + PADDLE_R, TABLE.w / 2 - PADDLE_R);
  const cy = side === 0 ? clamp(y, PADDLE_R, TABLE.h / 2 - PADDLE_R) : clamp(y, -TABLE.h / 2 + PADDLE_R, -PADDLE_R);
  return { x: cx, y: cy };
}

/**
 * Moves the puck for dt seconds, colliding with the paddles (which moved from (px, py) to (x, y) during dt)
 * and the walls. Returns which player scored (0 or 1) and whether a paddle hit the puck.
 */
export function stepPuck(p: Puck, paddles: Paddle[], dt: number): { goal: 0 | 1 | null; hit: boolean; wall: boolean } {
  let travel = Math.hypot(p.vx, p.vy) * dt;
  for (const k of paddles) travel = Math.max(travel, Math.hypot(k.x - k.px, k.y - k.py));
  const n = Math.max(1, Math.ceil(travel / (PUCK_R * 0.5)));
  const h = dt / n;
  let hit = false;
  let wall = false;

  for (let i = 0; i < n; i++) {
    p.x += p.vx * h;
    p.y += p.vy * h;
    const f = (i + 1) / n;
    for (const k of paddles) {
      const kx = k.px + (k.x - k.px) * f;
      const ky = k.py + (k.y - k.py) * f;
      const kvx = (k.x - k.px) / dt;
      const kvy = (k.y - k.py) / dt;
      const dx = p.x - kx;
      const dy = p.y - ky;
      const d = Math.hypot(dx, dy);
      const min = PUCK_R + PADDLE_R;
      if (d < min) {
        const nx = d > 1e-6 ? dx / d : 0;
        const ny = d > 1e-6 ? dy / d : kvy >= 0 ? 1 : -1;
        p.x = kx + nx * min;
        p.y = ky + ny * min;
        const rel = (p.vx - kvx) * nx + (p.vy - kvy) * ny;
        if (rel < 0) {
          p.vx -= (1 + RESTITUTION) * rel * nx;
          p.vy -= (1 + RESTITUTION) * rel * ny;
          hit = true;
        }
      }
    }
    // side walls
    const xr = TABLE.w / 2 - PUCK_R;
    if (p.x > xr) {
      p.x = xr;
      p.vx = -Math.abs(p.vx) * WALL_BOUNCE;
      wall = true;
    } else if (p.x < -xr) {
      p.x = -xr;
      p.vx = Math.abs(p.vx) * WALL_BOUNCE;
      wall = true;
    }
    // ends: goal inside the mouth, wall elsewhere
    const yr = TABLE.h / 2 - PUCK_R;
    if (Math.abs(p.y) > yr) {
      if (Math.abs(p.x) < TABLE.goalW / 2 - PUCK_R * 0.3) {
        if (Math.abs(p.y) > TABLE.h / 2) return { goal: p.y > 0 ? 1 : 0, hit, wall };
      } else {
        p.y = Math.sign(p.y) * yr;
        p.vy = -Math.sign(p.y) * Math.abs(p.vy) * WALL_BOUNCE;
        wall = true;
      }
    }
    const s = Math.hypot(p.vx, p.vy);
    if (s > MAX_SPEED) {
      p.vx *= MAX_SPEED / s;
      p.vy *= MAX_SPEED / s;
    }
  }
  const damp = Math.max(0, 1 - FRICTION * dt);
  p.vx *= damp;
  p.vy *= damp;
  return { goal: null, hit, wall };
}

/** Where the computer paddle (top side) moves this step. Level 0 easy, 1 medium, 2 hard. */
export function aiMove(p: Puck, k: Paddle, level: number, dt: number): { x: number; y: number } {
  const speed = [4.2, 6.5, 9.5][level] ?? 6.5;
  const home = { x: p.x * 0.45, y: -TABLE.h / 2 + 1.1 };
  let tx = home.x;
  let ty = home.y;
  if (p.y < 0.4) {
    if (p.y < k.y + 0.15) {
      // Puck got behind us: get back between it and the goal, off to the side so we do not knock it in.
      tx = p.x + (p.x > 0 ? -0.9 : 0.9);
      ty = home.y;
    } else {
      // Strike: aim at the puck from slightly behind it, towards the bottom goal.
      tx = p.x - p.vx * 0.05;
      ty = p.y - (PUCK_R + PADDLE_R) * 0.6;
    }
  }
  const dx = tx - k.x;
  const dy = ty - k.y;
  const d = Math.hypot(dx, dy);
  const step = Math.min(d, speed * dt);
  const nx = d > 1e-6 ? k.x + (dx / d) * step : k.x;
  const ny = d > 1e-6 ? k.y + (dy / d) * step : k.y;
  return clampPaddle(1, nx, ny);
}
