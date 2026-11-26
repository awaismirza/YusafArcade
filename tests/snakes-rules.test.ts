/** Checks for the Snakes and Ladders rules. Run with: npm test */
import assert from "node:assert/strict";
import { cellPos, earnsBonus, FINISH, LADDERS, moveToken, SNAKES, sum } from "../src/games/snakes/rules";

let passed = 0;
const check = (name: string, fn: () => void): void => {
  fn();
  passed++;
  console.log(`PASS  ${name}`);
};

check("squares are numbered in a zig-zag from the bottom-left", () => {
  assert.deepEqual(cellPos(1), [0, 0]);
  assert.deepEqual(cellPos(10), [9, 0]);
  assert.deepEqual(cellPos(11), [9, 1]);
  assert.deepEqual(cellPos(20), [0, 1]);
  assert.deepEqual(cellPos(21), [0, 2]);
  assert.deepEqual(cellPos(100), [0, 9]);
  const seen = new Set<string>();
  for (let n = 1; n <= 100; n++) seen.add(cellPos(n).join(","));
  assert.equal(seen.size, 100, "every square is distinct");
});

check("snakes go down and ladders go up", () => {
  for (const [head, tail] of Object.entries(SNAKES)) assert.ok(Number(tail) < Number(head), `snake ${head}`);
  for (const [foot, top] of Object.entries(LADDERS)) assert.ok(Number(top) > Number(foot), `ladder ${foot}`);
});

check("no snake or ladder chains into another, or sits on 100", () => {
  const starts = new Set([...Object.keys(SNAKES), ...Object.keys(LADDERS)].map(Number));
  assert.equal(starts.size, Object.keys(SNAKES).length + Object.keys(LADDERS).length, "no square starts two jumps");
  for (const end of [...Object.values(SNAKES), ...Object.values(LADDERS)]) assert.ok(end === 100 || !starts.has(end), `end ${end}`);
  assert.equal(SNAKES[100], undefined);
});

check("a plain move", () => {
  assert.deepEqual(moveToken(10, 3), { from: 10, route: [11, 12, 13], bounced: false, landing: 13, to: 13, jump: null });
});

check("landing on a ladder foot climbs it", () => {
  const r = moveToken(0, 4);
  assert.equal(r.jump, "ladder");
  assert.equal(r.landing, 4);
  assert.equal(r.to, 14);
});

check("landing on a snake head slides down", () => {
  const r = moveToken(12, 4); // 16
  assert.equal(r.jump, "snake");
  assert.equal(r.to, 6);
});

check("overshooting 100 bounces back by the extra amount", () => {
  const r = moveToken(98, 5); // 99, 100, then 2 back: 99, 98
  assert.deepEqual(r.route, [99, 100, 99, 98, 97]);
  assert.equal(r.bounced, true);
  assert.equal(r.landing, 97);
  const win = moveToken(97, 3);
  assert.equal(win.to, FINISH);
  assert.equal(win.bounced, false);
  assert.deepEqual(moveToken(99, 2).route, [100, 99], "bounces straight back");
});

check("a bounce can land on a snake", () => {
  // From 99, three steps go 100, 99, 98, and 98 is a snake head.
  const r = moveToken(99, 3);
  assert.equal(r.landing, 98);
  assert.equal(r.jump, "snake");
  assert.equal(r.to, 78);
});

check("bonus rolls: a six on one die, or doubles on several", () => {
  assert.equal(earnsBonus([6]), true);
  assert.equal(earnsBonus([5]), false);
  assert.equal(earnsBonus([3, 3]), true);
  assert.equal(earnsBonus([3, 4]), false);
  assert.equal(sum([3, 4]), 7);
});

check("random games always finish, and tokens never leave the board", () => {
  for (const diceCount of [1, 2, 3]) {
    for (let game = 0; game < 40; game++) {
      let pos = 0;
      let rolls = 0;
      while (pos !== FINISH && rolls < 20000) {
        const values = Array.from({ length: diceCount }, () => 1 + Math.floor(Math.random() * 6));
        const r = moveToken(pos, sum(values));
        assert.ok(r.to >= 0 && r.to <= FINISH);
        pos = r.to;
        rolls++;
      }
      assert.equal(pos, FINISH, `${diceCount} dice, game ${game} should finish`);
    }
  }
});

console.log(`\n${passed} snakes checks passed.`);
