/** Touch-target sizes. Run with: npm test */
import assert from "node:assert/strict";
import { hitSize, MIN_HIT } from "../src/ui/hitSize";

let passed = 0;
const check = (name: string, fn: () => void): void => {
  fn();
  passed++;
  console.log(`PASS  ${name}`);
};

check("small buttons get a 70 game-px touch area (44 CSS px on the smallest phone)", () => {
  assert.equal(MIN_HIT, 70);
  assert.deepEqual(hitSize(128, 52), { w: 128, h: 70 });
  assert.deepEqual(hitSize(40, 40), { w: 70, h: 70 });
});

check("buttons that are already big enough keep their size", () => {
  assert.deepEqual(hitSize(170, 76), { w: 170, h: 76 });
});

console.log(`${passed} hit size checks passed.`);
