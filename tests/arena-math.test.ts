/** Checks for the shared 3D Arena maths. Run with: npm test */
import assert from "node:assert/strict";
import { angleDiff, circleRect, clamp, lerp, mulberry32, reflect, segClosest } from "../src/arena/kit/math";

let passed = 0;
const check = (name: string, fn: () => void): void => {
  fn();
  passed++;
  console.log(`PASS  ${name}`);
};
const near = (a: number, b: number, eps = 1e-9): void => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

check("clamp and lerp", () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(lerp(0, 10, 0.25), 2.5);
});

check("angleDiff wraps into (-PI, PI]", () => {
  near(angleDiff(0.1, -0.1), -0.2);
  near(angleDiff(Math.PI - 0.1, -Math.PI + 0.1), 0.2);
  near(angleDiff(0, Math.PI), Math.PI);
});

check("reflect mirrors velocity off a wall normal", () => {
  const r = reflect(3, -2, 0, 1);
  near(r.x, 3);
  near(r.y, 2);
});

check("circleRect pushes a circle out of a box", () => {
  const p = circleRect(1.9, 0, 0.5, { x: 0, y: -1, w: 2, h: 2 });
  assert.ok(p);
  near(p!.nx, 1);
  near(p!.depth, 0.6);
  assert.equal(circleRect(5, 5, 0.5, { x: 0, y: 0, w: 1, h: 1 }), null);
  const inside = circleRect(0.6, 0.5, 0.2, { x: 0, y: 0, w: 1, h: 1 });
  assert.ok(inside && inside.depth > 0, "centre inside still pushes out");
});

check("segClosest finds the nearest point on a segment", () => {
  const c = segClosest(5, 3, 0, 0, 10, 0);
  near(c.x, 5);
  near(c.y, 0);
  const e = segClosest(-4, 1, 0, 0, 10, 0);
  near(e.x, 0);
});

check("mulberry32 is deterministic", () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
  const v = mulberry32(7)();
  assert.ok(v >= 0 && v < 1);
});

console.log(`${passed} arena maths checks passed.`);
