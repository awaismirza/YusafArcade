/** Air Hockey physics. Run with: npm test */
import assert from "node:assert/strict";
import { aiMove, clampPaddle, MAX_SPEED, newPuck, Paddle, PADDLE_R, PUCK_R, stepPuck, TABLE } from "../src/arena/hockey/physics";

let passed = 0;
const check = (name: string, fn: () => void): void => {
  fn();
  passed++;
  console.log(`PASS  ${name}`);
};
const still = (x: number, y: number): Paddle => ({ x, y, px: x, py: y });

check("puck bounces off a side wall with mirrored x velocity", () => {
  const p = newPuck();
  p.x = TABLE.w / 2 - PUCK_R - 0.01;
  p.y = 1;
  p.vx = 4;
  p.vy = 0;
  stepPuck(p, [still(0, 4), still(0, -4)], 1 / 60);
  assert.ok(p.vx < 0, "x velocity flipped");
  assert.ok(p.x <= TABLE.w / 2 - PUCK_R + 1e-9, "stays on the table");
});

check("goal only counts inside the goal mouth", () => {
  const p = newPuck();
  p.x = 0;
  p.y = TABLE.h / 2 - 0.05;
  p.vy = 6;
  const r = stepPuck(p, [still(2, 3), still(0, -4)], 1 / 30);
  assert.equal(r.goal, 1, "puck past the bottom end scores for the top player (1)");
  const q = newPuck();
  q.x = TABLE.goalW / 2 + 0.6;
  q.y = TABLE.h / 2 - PUCK_R - 0.01;
  q.vy = 6;
  const r2 = stepPuck(q, [still(-2, 3), still(0, -4)], 1 / 30);
  assert.equal(r2.goal, null);
  assert.ok(q.vy < 0, "bounced off the end wall");
});

check("puck never exceeds the max speed", () => {
  const p = newPuck();
  p.x = 0;
  p.y = 1;
  const pad: Paddle = { x: 0, y: 1.3, px: 0, py: 4 };
  stepPuck(p, [pad, still(0, -4)], 1 / 60);
  assert.ok(Math.hypot(p.vx, p.vy) <= MAX_SPEED + 1e-9);
  assert.ok(p.vy < 0, "hit towards the top");
});

check("a fast paddle cannot pass through the puck in one long frame", () => {
  const p = newPuck();
  p.x = 0;
  p.y = 1.5;
  const pad: Paddle = { x: 0, y: 0.6, px: 0, py: 3.5 }; // moved 2.9 units up through the puck in one step
  stepPuck(p, [pad, still(0, -4)], 1 / 20);
  assert.ok(p.vy < 0, "puck was hit, not passed");
  assert.ok(p.y < 0.6, "puck is ahead of the paddle");
});

check("paddles stay in their own half", () => {
  const a = clampPaddle(0, 10, -10);
  assert.ok(a.y >= PADDLE_R && a.x <= TABLE.w / 2 - PADDLE_R);
  const b = clampPaddle(1, 0, 3);
  assert.ok(b.y <= -PADDLE_R);
});

check("computer paddle moves towards a puck in its half and home otherwise", () => {
  const p = newPuck();
  p.x = 1;
  p.y = -2;
  p.vy = -1;
  const pad = still(0, -4);
  const m = aiMove(p, pad, 1, 1 / 60);
  assert.ok(m.y >= -4 - 1e-9 && Math.hypot(m.x - pad.x, m.y - pad.y) > 0);
  const far = newPuck();
  far.y = 3;
  const home = aiMove(far, still(2, -1), 1, 1);
  assert.ok(home.y < -1, "returns towards its goal");
});

console.log(`${passed} hockey physics checks passed.`);
