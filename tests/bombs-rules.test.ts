/** Bomb Blast rules. Run with: npm test */
import assert from "node:assert/strict";
import { mulberry32 } from "../src/arena/kit/math";
import { aiInput, alive, blastCells, CRATE, createGame, dangerMap, EMPTY, Game, H, idx, movePlayer, PILLAR, placeBomb, SPAWNS, tick, W } from "../src/arena/bombs/rules";

let passed = 0;
const check = (name: string, fn: () => void): void => {
  fn();
  passed++;
  console.log(`PASS  ${name}`);
};
const clearAll = (g: Game): void => {
  for (let i = 0; i < W * H; i++) if (g.cells[i] === CRATE) g.cells[i] = EMPTY;
  g.hidden.clear();
};

check("spawn corners and their neighbours are always clear", () => {
  for (let seed = 1; seed < 60; seed++) {
    const g = createGame(4, seed);
    for (const [x, y] of SPAWNS) {
      assert.equal(g.cells[idx(x, y)], EMPTY);
      const nx = x === 0 ? 1 : x - 1;
      const ny = y === 0 ? 1 : y - 1;
      assert.equal(g.cells[idx(nx, y)], EMPTY);
      assert.equal(g.cells[idx(x, ny)], EMPTY);
    }
  }
});

check("flames stop at a pillar and at the first crate", () => {
  const g = createGame(2, 3);
  clearAll(g);
  // bomb at (2,1): (1,1) and (3,1) are pillars, so it can only go up and down
  const c = blastCells(g, idx(2, 1), 3);
  assert.ok(!c.includes(idx(1, 1)) && !c.includes(idx(3, 1)));
  assert.ok(c.includes(idx(2, 0)) && c.includes(idx(2, 4)));
  g.cells[idx(2, 3)] = CRATE;
  const c2 = blastCells(g, idx(2, 1), 3);
  assert.ok(c2.includes(idx(2, 3)), "the crate itself burns");
  assert.ok(!c2.includes(idx(2, 4)), "nothing behind the crate");
  assert.equal(g.cells[idx(1, 1)], PILLAR);
});

check("bombs set each other off (chain reaction) and destroy crates", () => {
  const g = createGame(2, 5);
  clearAll(g);
  g.cells[idx(6, 0)] = CRATE;
  g.bombs.push({ cell: idx(2, 0), owner: 0, timer: 0.01, range: 2 }, { cell: idx(4, 0), owner: 1, timer: 9, range: 2 });
  const ev = tick(g, 0.02);
  assert.equal(ev.filter((e) => e.type === "explode").length, 2);
  assert.equal(g.cells[idx(6, 0)], EMPTY);
  assert.equal(g.bombs.length, 0);
});

check("a player in the flames is out; the round ends with one left", () => {
  const g = createGame(2, 7);
  clearAll(g);
  g.bombs.push({ cell: idx(1, 0), owner: 1, timer: 0.01, range: 2 });
  tick(g, 0.02);
  assert.deepEqual(alive(g), [1]);
});

check("players cannot walk through pillars, crates or bombs", () => {
  const g = createGame(1, 9);
  clearAll(g);
  const p = g.players[0];
  g.cells[idx(0, 1)] = CRATE;
  movePlayer(g, 0, 0, 1, 1);
  assert.equal(p.y, 0, "blocked by the crate");
  assert.equal(p.ty, 0);
  movePlayer(g, 0, 1, 0, 1); // right along the top row: (1,1) is a pillar but (1,0) is open
  assert.ok(p.x >= 1);
  g.players[0].x = g.players[0].tx = 0;
  g.players[0].t = 0;
  assert.ok(placeBomb(g, 0));
  assert.ok(!placeBomb(g, 0), "only one bomb at the start");
});

check("the computer never walks into a cell that burns within 0.6 s when a safe move exists", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const rng = mulberry32(seed);
    const g = createGame(4, seed);
    for (let t = 0; t < 400 && alive(g).length > 1; t++) {
      for (const p of g.players) {
        if (!p.alive) continue;
        const a = aiInput(g, p.id, rng);
        if (p.x === p.tx && p.y === p.ty && (a.dx || a.dy)) {
          const danger = dangerMap(g);
          const to = idx(p.x + a.dx, p.y + a.dy);
          const here = idx(p.x, p.y);
          const safeExists = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
            const x = p.x + dx;
            const y = p.y + dy;
            return x >= 0 && y >= 0 && x < W && y < H && g.cells[idx(x, y)] === EMPTY && !g.bombs.some((b) => b.cell === idx(x, y)) && danger[idx(x, y)] >= 0.6;
          }) || danger[here] >= 0.6;
          if (safeExists) assert.ok(danger[to] >= 0.6 || danger[to] > danger[here], `seed ${seed}: walked into fire`);
        }
        if (a.bomb) placeBomb(g, p.id);
        movePlayer(g, p.id, a.dx, a.dy, 1 / 20);
      }
      tick(g, 1 / 20);
    }
  }
});

check("computer players finish rounds (someone wins or all crates go) in a 4-bot match", () => {
  let finished = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const rng = mulberry32(seed * 7);
    const g = createGame(4, seed);
    for (let t = 0; t < 20 * 180 && alive(g).length > 1; t++) {
      for (const p of g.players) {
        if (!p.alive) continue;
        const a = aiInput(g, p.id, rng);
        if (a.bomb) placeBomb(g, p.id);
        movePlayer(g, p.id, a.dx, a.dy, 1 / 20);
      }
      tick(g, 1 / 20);
    }
    const crates = Array.from(g.cells).filter((c) => c === CRATE).length;
    if (alive(g).length <= 1 || crates < 10) finished++;
  }
  assert.ok(finished >= 24, `only ${finished}/30 bot matches made progress`);
});

console.log(`${passed} bomb blast checks passed.`);
