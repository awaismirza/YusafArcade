/**
 * Tank Commander computer players. Each kind has its own habits: Rookies sit and plink, Scouts wander, Snipers take
 * long straight shots, Bouncers bank shells off walls, Miners and Hunters drop mines, Rapids fire bursts. Every
 * computer checks its shot with the same tracer the aim line uses and never fires one that would hit itself or a
 * team-mate. Pure: no three.js, no DOM.
 */
import { angleDiff, Rng } from "../kit/math";
import { BLOCK, FLOOR, Kind, KINDS, Pt, SHELL_R, Tank, traceShot, World } from "./sim";

export type AiMem = { think: number; aim: number | null; goal: Pt | null; goalTimer: number; dodge: Pt | null; dodgeT: number; burst: number };
export const newAiMem = (): AiMem => ({ think: 0, aim: null, goal: null, goalTimer: 0, dodge: null, dodgeT: 0, burst: 0 });
export type AiCmd = { mx: number; my: number; aim: number; fire: boolean; mine: boolean };

type Habit = { think: number; samples: number; wobble: number; band: [number, number]; mineRate: number; burst: number };
const HABITS: Record<Kind, Habit> = {
  player: { think: 0.25, samples: 24, wobble: 0.02, band: [3, 7], mineRate: 0.08, burst: 1 },
  rookie: { think: 0.6, samples: 0, wobble: 0.1, band: [0, 0], mineRate: 0, burst: 1 },
  scout: { think: 0.45, samples: 6, wobble: 0.06, band: [4, 9], mineRate: 0, burst: 1 },
  sniper: { think: 0.35, samples: 0, wobble: 0.01, band: [7, 12], mineRate: 0, burst: 1 },
  miner: { think: 0.45, samples: 8, wobble: 0.05, band: [3, 7], mineRate: 0.35, burst: 1 },
  rapid: { think: 0.3, samples: 10, wobble: 0.05, band: [4, 8], mineRate: 0, burst: 3 },
  bouncer: { think: 0.3, samples: 40, wobble: 0.015, band: [0, 0], mineRate: 0, burst: 1 },
  hunter: { think: 0.2, samples: 30, wobble: 0.02, band: [2, 6], mineRate: 0.25, burst: 2 },
  boss: { think: 0.2, samples: 36, wobble: 0.02, band: [3, 7], mineRate: 0.2, burst: 3 },
};

const opponents = (w: World, t: Tank): Tank[] => w.tanks.filter((o) => o.alive && o.team !== t.team);

/** True if a straight shot from the tank at this angle would hit an opponent first (and not itself or a friend). */
function goodShot(w: World, t: Tank, angle: number): boolean {
  const tr = traceShot(w, t.x, t.y, angle, KINDS[t.kind].bounces, t.id);
  return tr.hit >= 0 && tr.hit !== t.id && w.tanks[tr.hit].team !== t.team;
}

/** Breadth-first search over tiles a tank can drive on; returns the next tile centre towards the best goal tile. */
function route(w: World, t: Tank, score: (tx: number, ty: number, steps: number) => number): Pt | null {
  const start = Math.floor(t.y) * w.cols + Math.floor(t.x);
  const prev = new Int32Array(w.cols * w.rows).fill(-2);
  const dist = new Int32Array(w.cols * w.rows).fill(-1);
  prev[start] = -1;
  dist[start] = 0;
  const q = [start];
  let best = -1;
  let bestScore = Infinity;
  while (q.length) {
    const c = q.shift()!;
    const cx = c % w.cols;
    const cy = Math.floor(c / w.cols);
    const s = score(cx, cy, dist[c]);
    if (s < bestScore) {
      bestScore = s;
      best = c;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w.cols || ny >= w.rows) continue;
      const n = ny * w.cols + nx;
      if (prev[n] !== -2 || w.grid[n] !== FLOOR) continue;
      prev[n] = c;
      dist[n] = dist[c] + 1;
      q.push(n);
    }
  }
  if (best < 0 || best === start) return null;
  let c = best;
  while (prev[c] !== start && prev[c] >= 0) c = prev[c];
  return { x: (c % w.cols) + 0.5, y: Math.floor(c / w.cols) + 0.5 };
}

/** The danger the tank should run from right now: a shell about to pass close by, or a mine. */
function threat(w: World, t: Tank): Pt | null {
  for (const m of w.mines) {
    const d = Math.hypot(m.x - t.x, m.y - t.y);
    if (d < 2) return { x: t.x - (m.x - t.x) / (d || 1), y: t.y - (m.y - t.y) / (d || 1) };
  }
  for (const s of w.shells) {
    if (s.owner === t.id && s.age < 0.3) continue;
    // closest approach in the next 0.8 s, assuming it flies straight
    const rx = t.x - s.x;
    const ry = t.y - s.y;
    const v2 = s.vx * s.vx + s.vy * s.vy;
    const tc = Math.max(0, Math.min(0.8, (rx * s.vx + ry * s.vy) / v2));
    const cx = s.x + s.vx * tc - t.x;
    const cy = s.y + s.vy * tc - t.y;
    if (Math.hypot(cx, cy) < KINDS[t.kind].radius + SHELL_R + 0.45 && tc > 0) {
      // sidestep: perpendicular to the shell, away from its line
      let px = -s.vy;
      let py = s.vx;
      if (px * -cx + py * -cy < 0) {
        px = -px;
        py = -py;
      }
      const l = Math.hypot(px, py) || 1;
      return { x: t.x + px / l, y: t.y + py / l };
    }
  }
  return null;
}

/** What a computer tank wants this frame. Apply `fire` and `mine` before driving and turning, so the shot leaves from the pose that was checked. */
export function aiThink(w: World, id: number, mem: AiMem, dt: number, rng: Rng): AiCmd {
  const t = w.tanks[id];
  const k = KINDS[t.kind];
  const h = HABITS[t.kind];
  const cmd: AiCmd = { mx: 0, my: 0, aim: t.turret, fire: false, mine: false };
  const foes = opponents(w, t);
  if (!t.alive || !foes.length) return cmd;
  const near = foes.reduce((a, b) => (Math.hypot(a.x - t.x, a.y - t.y) < Math.hypot(b.x - t.x, b.y - t.y) ? a : b));

  // ---- aiming: look for a shot every so often
  mem.think -= dt;
  if (mem.think <= 0) {
    mem.think = h.think * (0.8 + rng() * 0.4);
    mem.aim = null;
    const tries: number[] = foes.map((f) => Math.atan2(f.y - t.y, f.x - t.x));
    for (let i = 0; i < h.samples; i++) tries.push(rng() * Math.PI * 2);
    for (const a of tries) {
      if (goodShot(w, t, a)) {
        mem.aim = a + (rng() - 0.5) * h.wobble;
        break;
      }
    }
  }
  cmd.aim = mem.aim ?? Math.atan2(near.y - t.y, near.x - t.x);

  // ---- firing: only when the turret is on target and the shot still checks out
  if (mem.aim !== null && Math.abs(angleDiff(t.turret, mem.aim)) < 0.07 && t.cooldown <= 0 && goodShot(w, t, t.turret)) {
    cmd.fire = true;
    mem.burst += 1;
    if (mem.burst >= h.burst) {
      mem.burst = 0;
      mem.aim = null; // look again before the next shot
      mem.think = Math.min(mem.think, h.think);
    }
  }

  // ---- moving
  if (k.speed <= 0) return cmd;
  const danger = threat(w, t);
  if (danger) {
    mem.dodge = danger;
    mem.dodgeT = 0.35;
  }
  if (mem.dodgeT > 0 && mem.dodge) {
    mem.dodgeT -= dt;
    cmd.mx = mem.dodge.x - t.x;
    cmd.my = mem.dodge.y - t.y;
    const l = Math.hypot(cmd.mx, cmd.my) || 1;
    cmd.mx /= l;
    cmd.my /= l;
    return cmd;
  }
  mem.goalTimer -= dt;
  if (!mem.goal || mem.goalTimer <= 0 || Math.hypot(mem.goal.x - t.x, mem.goal.y - t.y) < 0.15) {
    mem.goalTimer = 0.6 + rng() * 0.6;
    const [lo, hi] = h.band;
    const jitter = rng() * 3;
    mem.goal = route(w, t, (tx, ty, steps) => {
      const d = Math.hypot(tx + 0.5 - near.x, ty + 0.5 - near.y);
      const off = d < lo ? lo - d : d > hi ? d - hi : 0;
      const mine = w.mines.some((m) => Math.hypot(tx + 0.5 - m.x, ty + 0.5 - m.y) < 2.2) ? 6 : 0;
      return off * 2 + mine + steps * 0.15 + ((tx * 7 + ty * 13 + Math.floor(jitter)) % 5) * 0.3;
    });
  }
  if (mem.goal) {
    cmd.mx = mem.goal.x - t.x;
    cmd.my = mem.goal.y - t.y;
    const l = Math.hypot(cmd.mx, cmd.my) || 1;
    cmd.mx /= l;
    cmd.my /= l;
  }
  // ---- mines: drop one now and then while driving, not right next to a friend
  if (h.mineRate > 0 && rng() < h.mineRate * dt) {
    const friendNear = w.tanks.some((o) => o.alive && o.id !== t.id && o.team === t.team && Math.hypot(o.x - t.x, o.y - t.y) < 2.5);
    const foeDist = Math.hypot(near.x - t.x, near.y - t.y);
    if (!friendNear && foeDist > 2.5 && foeDist < 9) {
      cmd.mine = true;
      mem.goalTimer = 0; // then move on
    }
  }
  return cmd;
}

/** For tests and level design: is this tile open floor? */
export const openTile = (w: World, tx: number, ty: number): boolean => w.grid[ty * w.cols + tx] !== BLOCK;
