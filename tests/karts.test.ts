/** Turbo Karts track and driving. Run with: npm test */
import assert from "node:assert/strict";
import { mulberry32 } from "../src/arena/kit/math";
import { aiDrive, createRace, driveKart, LAPS, newAi, placings, stepRace } from "../src/arena/karts/physics";
import { buildTrack, locate, TRACKS, updateLap } from "../src/arena/karts/track";

let passed = 0;
const check = (name: string, fn: () => void): void => {
  fn();
  passed++;
  console.log(`PASS  ${name}`);
};

check("progress increases along the centre line and wraps at the finish", () => {
  for (const def of TRACKS) {
    const t = buildTrack(def);
    let prev = -1;
    let wraps = 0;
    let hint = -1;
    for (let i = 0; i < t.n; i += 3) {
      const loc = locate(t, t.xs[i], t.zs[i], hint);
      hint = loc.i;
      if (prev >= 0 && loc.s < prev) wraps++;
      prev = loc.s;
    }
    assert.equal(wraps, 0, `${def.name}: progress went backwards`);
    assert.equal(updateLap(1, t.length - 1, 0.5, t.length), 2, "crossing the line adds a lap");
    assert.equal(updateLap(2, 0.5, t.length - 1, t.length), 1, "reversing over it takes one off");
  }
});

check("the track never crosses itself (no two far-apart parts closer than its width)", () => {
  for (const def of TRACKS) {
    const t = buildTrack(def);
    for (let i = 0; i < t.n; i += 2) {
      for (let j = 0; j < t.n; j += 2) {
        const along = Math.min(Math.abs(i - j), t.n - Math.abs(i - j));
        if (along < def.width * 3) continue;
        const d = Math.hypot(t.xs[i] - t.xs[j], t.zs[i] - t.zs[j]);
        assert.ok(d > def.width + 4, `${def.name}: parts ${i} and ${j} are only ${d.toFixed(1)} apart`);
      }
    }
  }
});

check("computer karts finish 3 laps on every track", () => {
  for (const def of TRACKS) {
    const t = buildTrack(def);
    const r = createRace(t, 4);
    r.started = true;
    const ai = r.karts.map((k) => newAi(k.id));
    const rng = mulberry32(5);
    const dt = 1 / 30;
    for (let step = 0; step < 30 * 300 && r.karts.some((k) => k.finished === null); step++) {
      for (const k of r.karts) driveKart(r, k.id, aiDrive(r, k.id, ai[k.id], dt, rng), dt);
      stepRace(r, dt);
    }
    for (const k of r.karts) assert.notEqual(k.finished, null, `${def.name}: kart ${k.id} did not finish (lap ${k.lap})`);
    const times = r.karts.map((k) => k.finished!);
    console.log(`      ${def.name}: ${Math.round(t.length)} units, winner ${Math.min(...times).toFixed(1)} s`);
    assert.equal(placings(r).length, 4);
    assert.ok(LAPS === 3);
  }
});

check("leaving the road lowers the top speed", () => {
  const t = buildTrack(TRACKS[0]);
  const run = (offset: number): number => {
    const r = createRace(t, 1);
    r.started = true;
    const k = r.karts[0];
    k.x += -t.dz[k.i] * offset;
    k.z += t.dx[k.i] * offset;
    for (let i = 0; i < 40; i++) {
      driveKart(r, 0, { steer: 0, gas: 1, useItem: false }, 1 / 30);
      // keep it parallel to the road at the same offset
      const j = k.i;
      k.h = Math.atan2(t.dz[j], t.dx[j]);
      k.x = t.xs[j] + -t.dz[j] * offset;
      k.z = t.zs[j] + t.dx[j] * offset;
    }
    return k.speed;
  };
  assert.ok(run(t.width / 2 + 2) < run(0) * 0.6);
});

console.log(`${passed} kart checks passed.`);
