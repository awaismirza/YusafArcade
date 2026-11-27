/** Code the Robot levels. Run with: npm test */
import assert from "node:assert/strict";
import { mulberry32 } from "../src/arena/kit/math";
import { makeLevel, shortestPath } from "../src/games/robot/levels";

let passed = 0;
const check = (name: string, fn: () => void): void => {
  fn();
  passed++;
  console.log(`PASS  ${name}`);
};

check("every level 1 to 12 can be solved within its command limit", () => {
  for (const tier of [0, 1] as const) {
    for (const size of [5, 6]) {
      for (let level = 1; level <= 12; level++) {
        for (let seed = 1; seed <= 200; seed++) {
          const L = makeLevel(tier, level, size, mulberry32(seed * 31 + level));
          const walls = new Set(L.walls);
          const tag = `tier ${tier} size ${size} level ${level} seed ${seed}`;
          assert.equal(walls.size, L.walls.length, `${tag}: duplicate walls`);
          assert.ok(!walls.has(`${L.start.x},${L.start.y}`) && !walls.has(`${L.goal.x},${L.goal.y}`), `${tag}: wall on start or goal`);
          for (const w of L.walls) {
            const [x, y] = w.split(",").map(Number);
            assert.ok(x >= 0 && y >= 0 && x < size && y < size, `${tag}: wall outside`);
          }
          assert.equal(shortestPath(size, walls, L.start, L.goal), L.shortest, tag);
          assert.ok(L.shortest >= 1, `${tag}: start is the goal`);
          assert.ok(L.maxCmds >= L.shortest && L.maxCmds <= 12, `${tag}: limit ${L.maxCmds} for shortest ${L.shortest}`);
        }
      }
    }
  }
});

check("shortestPath goes round walls and reports -1 when boxed in", () => {
  const walls = new Set(["1,0", "1,1", "1,2", "1,3"]);
  assert.equal(shortestPath(5, walls, { x: 0, y: 0 }, { x: 2, y: 0 }), 10);
  const boxed = new Set(["1,0", "0,1"]);
  assert.equal(shortestPath(5, boxed, { x: 0, y: 0 }, { x: 4, y: 4 }), -1);
});

console.log(`${passed} robot level checks passed.`);
