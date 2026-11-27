/** Kart driving, items and computer drivers. Pure: no three.js, no DOM. */
import { angleDiff, clamp, Rng } from "../kit/math";
import { indexAt, locate, Track, updateLap } from "./track";

export const LAPS = 3;
export const KART_R = 0.95;
const TOP = 23;
const OFF_TOP = 9;
const BOOST_TOP = 33;
const ACCEL = 13;
const BRAKE = 22;
const TURN = 2.1;

export type Item = "rocket" | "banana" | null;
export type Kart = {
  id: number;
  x: number;
  z: number;
  /** Heading: angle of travel on the ground plane, measured from +x towards +z. */
  h: number;
  speed: number;
  lap: number;
  /** Distance along the current lap, nearest track sample, and sideways offset. */
  s: number;
  i: number;
  side: number;
  boost: number;
  spin: number;
  item: Item;
  finished: number | null;
  offRoad: number;
};
export type Banana = { x: number; z: number; owner: number; age: number };
export type ItemBox = { x: number; z: number; respawn: number };
export type Race = { track: Track; karts: Kart[]; bananas: Banana[]; boxes: ItemBox[]; time: number; started: boolean };
export type Input = { steer: number; gas: number; useItem: boolean };
export type RaceEvent = { type: "boost" | "item" | "spin" | "lap" | "finish" | "bump"; kart: number; item?: Item };

/** Grid start: two by two behind the line. */
export function createRace(track: Track, karts: number): Race {
  const ks: Kart[] = [];
  for (let k = 0; k < karts; k++) {
    // The players (lowest ids) start at the back, so no kart sits between them and their camera.
    const slot = karts - 1 - k;
    const back = 4 + Math.floor(slot / 2) * 5;
    const i = indexAt(track, track.length - back);
    const lane = (slot % 2 === 0 ? -1 : 1) * track.width * 0.22;
    const x = track.xs[i] + -track.dz[i] * lane;
    const z = track.zs[i] + track.dx[i] * lane;
    const h = Math.atan2(track.dz[i], track.dx[i]);
    ks.push({ id: k, x, z, h, speed: 0, lap: 0, s: track.s[i], i, side: lane, boost: 0, spin: 0, item: null, finished: null, offRoad: 0 });
  }
  const boxes: ItemBox[] = [];
  for (const f of track.items) {
    const i = indexAt(track, f * track.length);
    for (const lane of [-0.28, 0, 0.28]) {
      boxes.push({ x: track.xs[i] + -track.dz[i] * lane * track.width, z: track.zs[i] + track.dx[i] * lane * track.width, respawn: 0 });
    }
  }
  // Karts start just behind the line, on "lap 0"; crossing it starts lap 1.
  return { track, karts: ks, bananas: [], boxes, time: 0, started: false };
}

/** How far along the race a kart is, for positions. */
export const progress = (k: Kart, t: Track): number => (k.finished !== null ? 1e9 - k.finished : k.lap * t.length + k.s);

export function placings(r: Race): number[] {
  return [...r.karts].sort((a, b) => progress(b, r.track) - progress(a, r.track)).map((k) => k.id);
}

/** Drives one kart for dt. Returns events (boost pad, item box, banana spin, new lap, finish). */
export function driveKart(r: Race, id: number, inp: Input, dt: number, topScale = 1): RaceEvent[] {
  const k = r.karts[id];
  const t = r.track;
  const ev: RaceEvent[] = [];
  if (!r.started) return ev;
  const done = k.finished !== null;
  k.boost = Math.max(0, k.boost - dt);
  if (k.spin > 0) {
    k.spin -= dt;
    k.h += dt * 9;
    k.speed *= Math.max(0, 1 - dt * 2.5);
  } else {
    const gas = done ? 0.35 : inp.gas;
    const off = Math.abs(k.side) > t.width / 2;
    const top = (k.boost > 0 ? BOOST_TOP : off ? OFF_TOP : TOP) * topScale;
    if (gas > 0) {
      const target = top * gas;
      // Speed up towards the target; above it (off the road, or after a boost) slow down quickly.
      k.speed = k.speed < target ? Math.min(target, k.speed + ACCEL * dt) : Math.max(target, k.speed - 30 * dt);
    } else if (gas < 0) k.speed = Math.max(-6, k.speed - BRAKE * dt);
    else k.speed *= Math.max(0, 1 - dt * 0.8);
    if (k.boost > 0) k.speed = Math.max(k.speed, BOOST_TOP * topScale * 0.95);
    const grip = clamp(Math.abs(k.speed) / 7, 0, 1);
    k.h += clamp(inp.steer, -1, 1) * TURN * grip * dt * Math.sign(k.speed || 1);
    if (inp.useItem && k.item && !done) {
      if (k.item === "rocket") {
        k.boost = 1.4;
        ev.push({ type: "boost", kart: id });
      } else {
        r.bananas.push({ x: k.x - Math.cos(k.h) * 2.2, z: k.z - Math.sin(k.h) * 2.2, owner: id, age: 0 });
      }
      k.item = null;
    }
  }
  // move in small steps
  const n = Math.max(1, Math.ceil((Math.abs(k.speed) * dt) / 0.6));
  for (let q = 0; q < n; q++) {
    k.x += (Math.cos(k.h) * k.speed * dt) / n;
    k.z += (Math.sin(k.h) * k.speed * dt) / n;
    const loc = locate(t, k.x, k.z, k.i);
    // Soft barrier a little outside the road: push back in and scrub speed.
    const limit = t.width / 2 + 3;
    if (Math.abs(loc.side) > limit) {
      const over = Math.abs(loc.side) - limit;
      const sgn = Math.sign(loc.side);
      k.x -= -t.dz[loc.i] * sgn * over;
      k.z -= t.dx[loc.i] * sgn * over;
      k.speed *= 0.97;
    }
  }
  const loc = locate(t, k.x, k.z, k.i);
  const prevS = k.s;
  k.i = loc.i;
  k.s = loc.s;
  k.side = loc.side;
  k.offRoad = Math.abs(k.side) > t.width / 2 ? k.offRoad + dt : 0;
  const lap = updateLap(k.lap, prevS, k.s, t.length);
  if (lap > k.lap && !done) {
    if (lap > LAPS) {
      k.finished = r.time;
      ev.push({ type: "finish", kart: id });
    } else if (lap > 1) ev.push({ type: "lap", kart: id });
  }
  k.lap = Math.min(lap, LAPS + 1);

  // boost pads
  for (const f of t.boosts) {
    const d = Math.abs(((k.s - f * t.length + t.length * 1.5) % t.length) - t.length / 2);
    if (d < 1.2 && Math.abs(k.side) < t.width * 0.35 && k.boost < 0.5) {
      k.boost = 1.1;
      ev.push({ type: "boost", kart: id });
    }
  }
  // item boxes
  for (const b of r.boxes) {
    if (b.respawn > 0) continue;
    if ((b.x - k.x) ** 2 + (b.z - k.z) ** 2 < 1.6 ** 2) {
      b.respawn = 3;
      if (!k.item && !done) {
        k.item = Math.floor(r.time * 7 + id) % 5 < 3 ? "rocket" : "banana";
        ev.push({ type: "item", kart: id, item: k.item });
      }
    }
  }
  // bananas
  for (const b of r.bananas) {
    if (b.age < 0.4 && b.owner === id) continue;
    if ((b.x - k.x) ** 2 + (b.z - k.z) ** 2 < 1.3 ** 2 && k.spin <= 0) {
      k.spin = 1;
      b.age = 999;
      ev.push({ type: "spin", kart: id });
    }
  }
  return ev;
}

/** Advances race time, item boxes, bananas, and kart-to-kart bumps. */
export function stepRace(r: Race, dt: number): RaceEvent[] {
  const ev: RaceEvent[] = [];
  if (r.started) r.time += dt;
  for (const b of r.boxes) b.respawn = Math.max(0, b.respawn - dt);
  for (const b of r.bananas) b.age += dt;
  r.bananas = r.bananas.filter((b) => b.age < 40);
  for (let a = 0; a < r.karts.length; a++) {
    for (let b = a + 1; b < r.karts.length; b++) {
      const p = r.karts[a];
      const q = r.karts[b];
      const dx = q.x - p.x;
      const dz = q.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > 0 && d < KART_R * 2) {
        const push = (KART_R * 2 - d) / 2;
        p.x -= (dx / d) * push;
        p.z -= (dz / d) * push;
        q.x += (dx / d) * push;
        q.z += (dz / d) * push;
        if (d < KART_R * 1.6) ev.push({ type: "bump", kart: a });
      }
    }
  }
  return ev;
}

export type AiState = { lane: number; stuck: number; reverse: number };
export const newAi = (id: number): AiState => ({ lane: ((id % 3) - 1) * 0.18, stuck: 0, reverse: 0 });

/** A computer driver: aims at a point further along the track, uses items, and gets itself unstuck. */
export function aiDrive(r: Race, id: number, st: AiState, dt: number, rng: Rng): Input {
  const k = r.karts[id];
  const t = r.track;
  if (st.reverse > 0) {
    st.reverse -= dt;
    return { steer: -Math.sign(angleDiff(k.h, Math.atan2(t.dz[k.i], t.dx[k.i]))), gas: -1, useItem: false };
  }
  if (Math.abs(k.speed) < 2 && r.started && k.spin <= 0) st.stuck += dt;
  else st.stuck = 0;
  if (st.stuck > 1.2) {
    st.stuck = 0;
    st.reverse = 0.8;
  }
  const look = 7 + Math.abs(k.speed) * 0.45;
  const j = indexAt(t, k.s + look);
  const lane = st.lane * t.width;
  const tx = t.xs[j] + -t.dz[j] * lane;
  const tz = t.zs[j] + t.dx[j] * lane;
  const want = Math.atan2(tz - k.z, tx - k.x);
  const d = angleDiff(k.h, want);
  const steer = clamp(d * 2.6, -1, 1);
  const gas = Math.abs(d) > 0.9 ? 0.55 : 1;
  let useItem = false;
  if (k.item === "rocket" && Math.abs(d) < 0.15) useItem = true;
  if (k.item === "banana" && rng() < dt * 0.6) useItem = true;
  return { steer, gas, useItem };
}

/** Rubber-banding: computers ease off when ahead of the best human and push a little when behind. */
export function aiTopScale(r: Race, id: number, humans: number[], level: number): number {
  const base = [0.86, 0.94, 1.0][level] ?? 0.94;
  if (!humans.length) return base;
  const me = progress(r.karts[id], r.track);
  const best = Math.max(...humans.map((h) => progress(r.karts[h], r.track)));
  const gap = (me - best) / r.track.length;
  return clamp(base - gap * 0.25, base - 0.12, base + 0.08);
}
