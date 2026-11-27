/** Tank Trouble rules. Run with: npm test */
import assert from "node:assert/strict";
import { circleRect, mulberry32 } from "../src/arena/kit/math";
import { aiControl, aliveTanks, CELL, createWorld, driveTank, fire, makeMaze, Maze, moveShell, newAiMemory, reachable, Shell, SHELL_R, stepWorld, TANK_R, World } from "../src/arena/tanks/rules";

let passed = 0;
const check = (name: string, fn: () => void): void => {
  fn();
  passed++;
  console.log(`PASS  ${name}`);
};
/** A 2x1 maze with only the outer walls. */
function box(): Maze {
  const C = 2;
  const R = 1;
  const h = [[true, true], [true, true]];
  const v = [[true, false, true]];
  const m = makeMaze(1, C, R);
  m.h = h;
  m.v = v;
  m.walls = [
    { x: -0.08, y: -0.08, w: C * CELL + 0.16, h: 0.16 },
    { x: -0.08, y: R * CELL - 0.08, w: C * CELL + 0.16, h: 0.16 },
    { x: -0.08, y: -0.08, w: 0.16, h: R * CELL + 0.16 },
    { x: C * CELL - 0.08, y: -0.08, w: 0.16, h: R * CELL + 0.16 },
  ];
  return m;
}

check("every maze connects all of its cells", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const m = makeMaze(seed);
    assert.equal(reachable(m), m.C * m.R, `seed ${seed}`);
  }
});

check("a shell bounces off a vertical wall and a horizontal wall", () => {
  const m = box();
  const s: Shell = { x: 2 * CELL - 0.3, y: 1, vx: 5, vy: 0, life: 5, owner: 0, age: 1 };
  assert.ok(moveShell(m, s, 0.2) >= 1);
  assert.ok(s.vx < 0, "x flipped");
  const t: Shell = { x: 1, y: 0.3, vx: 0, vy: -5, life: 5, owner: 0, age: 1 };
  moveShell(m, t, 0.2);
  assert.ok(t.vy > 0, "y flipped");
});

check("a fast shell never passes through a wall, even in a long frame", () => {
  const m = box();
  for (let k = 0; k < 50; k++) {
    const s: Shell = { x: 1 + k * 0.05, y: 1, vx: 40, vy: 7, life: 5, owner: 0, age: 1 };
    moveShell(m, s, 0.05);
    assert.ok(s.x > 0 && s.x < 2 * CELL && s.y > 0 && s.y < CELL, `escaped at ${s.x},${s.y}`);
  }
});

check("a tank cannot overlap a wall", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const w = createWorld(2, seed);
    for (let i = 0; i < 300; i++) driveTank(w, 0, 1, i % 50 < 25 ? 0.4 : -0.7, 1 / 20);
    const t = w.tanks[0];
    for (const r of w.maze.walls) {
      const p = circleRect(t.x, t.y, TANK_R, r);
      assert.ok(!p || p.depth < 0.02, `seed ${seed}: overlapping a wall by ${p?.depth}`);
    }
  }
});

check("a shell hits the enemy tank in a straight corridor", () => {
  const w: World = { maze: box(), tanks: [{ id: 0, x: 0.8, y: 1.1, a: 0, alive: true, cooldown: 0 }, { id: 1, x: 3.6, y: 1.1, a: Math.PI, alive: true, cooldown: 0 }], shells: [] };
  assert.ok(fire(w, 0));
  let hit = false;
  for (let i = 0; i < 40 && !hit; i++) hit = stepWorld(w, 1 / 20).some((e) => e.type === "hit" && e.tank === 1);
  assert.ok(hit);
  assert.deepEqual(aliveTanks(w), [0]);
  assert.ok(SHELL_R > 0);
});

check("computer tanks finish rounds against each other", () => {
  let done = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const rng = mulberry32(seed);
    const w = createWorld(2, seed);
    const mem = [newAiMemory(), newAiMemory()];
    for (let i = 0; i < 20 * 90 && aliveTanks(w).length > 1; i++) {
      for (const t of w.tanks) {
        const c = aiControl(w, t.id, mem[t.id], 1 / 20, rng);
        driveTank(w, t.id, c.forward, c.turn, 1 / 20);
        if (c.fire) fire(w, t.id);
      }
      stepWorld(w, 1 / 20);
    }
    if (aliveTanks(w).length <= 1) done++;
  }
  assert.ok(done >= 16, `only ${done}/20 rounds finished within 90 s`);
});

console.log(`${passed} tank checks passed.`);
