/** Tank Commander computer players. Run with: npm test */
import assert from "node:assert/strict";
import { mulberry32 } from "../src/arena/kit/math";
import { aiThink, newAiMem } from "../src/arena/tanks/ai";
import { MISSIONS } from "../src/arena/tanks/levels";
import { aimTurret, aliveTeams, createWorld, driveTank, fire, FLOOR, KINDS, layMine, parseMap, step, traceShot, World } from "../src/arena/tanks/sim";

let passed = 0;
const check = (name: string, fn: () => void): void => {
  fn();
  passed++;
  console.log(`PASS  ${name}`);
};

/** Every tank (players too) driven by the computer, for dt seconds. Returns true when one team is left. */
function play(w: World, secs: number, seed: number, onFire?: (w: World, id: number) => void): boolean {
  const rng = mulberry32(seed);
  const mems = w.tanks.map(() => newAiMem());
  const dt = 1 / 30;
  for (let i = 0; i < secs / dt; i++) {
    for (const t of w.tanks) {
      if (!t.alive) continue;
      const c = aiThink(w, t.id, mems[t.id], dt, rng);
      // Fire from the pose the computer checked, then drive and turn.
      if (c.fire) {
        onFire?.(w, t.id);
        fire(w, t.id);
      }
      if (c.mine) layMine(w, t.id);
      driveTank(w, t.id, c.mx, c.my, dt);
      aimTurret(w, t.id, c.aim, dt);
    }
    step(w, dt);
    if (aliveTeams(w).size <= 1) return true;
  }
  return false;
}

check("the computer only fires when its shot would hit an opponent, never itself or a team-mate", () => {
  let shots = 0;
  for (let m = 0; m < 12; m++) {
    const w = createWorld(parseMap(MISSIONS[m].map), { humans: 0, versus: false, bots: 2 });
    play(w, 40, 100 + m, (world, id) => {
      const t = world.tanks[id];
      const tr = traceShot(world, t.x, t.y, t.turret, KINDS[t.kind].bounces, id);
      shots++;
      assert.ok(tr.hit >= 0, `mission ${m + 1}: ${t.kind} fired at nothing`);
      assert.notEqual(tr.hit, id, `mission ${m + 1}: ${t.kind} would hit itself`);
      assert.notEqual(world.tanks[tr.hit].team, t.team, `mission ${m + 1}: ${t.kind} would hit a team-mate`);
    });
  }
  assert.ok(shots > 30, `only ${shots} shots fired`);
});

check("computer-vs-computer missions finish (someone wins) within two and a half minutes", () => {
  let done = 0;
  for (let m = 0; m < 10; m++) {
    const w = createWorld(parseMap(MISSIONS[m].map), { humans: 0, versus: false, bots: 2 });
    if (play(w, 150, 7 + m)) done++;
  }
  assert.ok(done >= 8, `only ${done}/10 missions finished`);
});

check("a computer tank backs away from a mine it is sitting next to", () => {
  const rows = Array.from({ length: 12 }, () => "....................");
  rows[6] = "..1.................";
  rows[5] = "..........s.........";
  const w = createWorld(parseMap(rows), { humans: 1, versus: false });
  const s = w.tanks[1];
  w.mines.push({ x: s.x + 0.6, y: s.y, owner: 0, age: 0.5, fuse: 10 });
  const mem = newAiMem();
  const rng = mulberry32(3);
  const d0 = Math.hypot(s.x - w.mines[0].x, s.y - w.mines[0].y);
  for (let i = 0; i < 30; i++) {
    const c = aiThink(w, 1, mem, 1 / 30, rng);
    driveTank(w, 1, c.mx, c.my, 1 / 30);
  }
  assert.ok(Math.hypot(s.x - w.mines[0].x, s.y - w.mines[0].y) > d0 + 0.5, "moved away");
  assert.equal(w.grid[0], FLOOR);
});

console.log(`${passed} tank AI checks passed.`);
