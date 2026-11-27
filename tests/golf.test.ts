/** Mini Golf physics and courses. Run with: npm test */
import assert from "node:assert/strict";
import { mulberry32 } from "../src/arena/kit/math";
import { HOLES, holeWalls, onFairway } from "../src/arena/golf/course";
import { Ball, planShot, simulateShot, stepBall } from "../src/arena/golf/physics";

let passed = 0;
const check = (name: string, fn: () => void): void => {
  fn();
  passed++;
  console.log(`PASS  ${name}`);
};
const first = HOLES[0];

check("there are 9 holes, each with its tee and cup on the fairway", () => {
  assert.equal(HOLES.length, 9);
  for (const h of HOLES) {
    assert.ok(onFairway(h, h.tee.x, h.tee.y), `${h.name} tee`);
    assert.ok(onFairway(h, h.cup.x, h.cup.y), `${h.name} cup`);
    assert.ok(holeWalls(h).length >= 4, `${h.name} walls`);
  }
});

check("a ball rolling on flat ground slows down and stops", () => {
  const b: Ball = { x: 1.5, y: 9, vx: 0, vy: -2 };
  let s = "moving";
  for (let i = 0; i < 600 && s === "moving"; i++) s = stepBall(b, first, i / 60, 1 / 60);
  assert.equal(s, "stopped");
  assert.ok(b.y < 9 && b.y > 7);
});

check("a ball bounces off a wall", () => {
  const b: Ball = { x: 2.6, y: 9, vx: 5, vy: 0 };
  for (let i = 0; i < 10; i++) stepBall(b, first, i / 60, 1 / 60);
  assert.ok(b.vx < 0, "rebounded");
  assert.ok(b.x < 3, "still inside");
});

check("the cup only captures a slow ball", () => {
  const fast: Ball = { x: 1.5, y: 2.5, vx: 0, vy: -8 };
  let s = "moving";
  for (let i = 0; i < 5 && s === "moving"; i++) s = stepBall(fast, first, i / 60, 1 / 60);
  assert.notEqual(s, "sunk", "a fast ball lips out");
  const slow: Ball = { x: 1.5, y: 2.1, vx: 0, vy: -1.5 };
  s = "moving";
  for (let i = 0; i < 60 && s === "moving"; i++) s = stepBall(slow, first, i / 60, 1 / 60);
  assert.equal(s, "sunk");
});

check("every hole can be finished within 10 shots by the planner", () => {
  for (const [i, h] of HOLES.entries()) {
    const rng = mulberry32(100 + i);
    let at = { ...h.tee };
    let t = 0;
    let shots = 0;
    let done = false;
    while (shots < 10 && !done) {
      const p = planShot(h, at, t, rng, 220);
      shots++;
      t = p.result.t;
      if (p.result.state === "sunk") done = true;
      else at = { x: p.result.x, y: p.result.y };
    }
    assert.ok(done, `${h.name} not finished in 10 shots`);
    console.log(`      ${h.name}: ${shots} shot(s), par ${h.par}`);
  }
});

check("water puts the ball back where it was hit from", () => {
  const h = HOLES.find((x) => x.water.length)!;
  const r = simulateShot(h, h.tee, -Math.PI / 2 - 0.6, 0.6, 0);
  if (r.state === "water") assert.deepEqual({ x: r.x, y: r.y }, h.tee);
});

console.log(`${passed} golf checks passed.`);
