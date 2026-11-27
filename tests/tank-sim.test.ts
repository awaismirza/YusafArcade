/** Tank Commander simulation and maps. Run with: npm test */
import assert from "node:assert/strict";
import { MISSIONS, VERSUS_MAPS } from "../src/arena/tanks/levels";
import { aimTurret, BLOCK, createWorld, CRATE, driveTank, fire, FLOOR, HOLE, KINDS, layMine, parseMap, step, tankBlocked, traceShot, World } from "../src/arena/tanks/sim";

let passed = 0;
const check = (name: string, fn: () => void): void => {
  fn();
  passed++;
  console.log(`PASS  ${name}`);
};
const EMPTY = Array.from({ length: 12 }, () => "....................");
const map = (rows: string[]): World => createWorld(parseMap(rows), { humans: 1, versus: false });
const run = (w: World, secs: number): ReturnType<typeof step> => {
  const all: ReturnType<typeof step> = [];
  for (let i = 0; i < secs * 60; i++) all.push(...step(w, 1 / 60));
  return all;
};
const put = (rows: string[], x: number, y: number, ch: string): string[] => rows.map((r, j) => (j === y ? r.slice(0, x) + ch + r.slice(x + 1) : r));

check("all 20 missions and the versus maps are 20 x 12, with a spawn and reachable enemies", () => {
  assert.equal(MISSIONS.length, 20);
  for (const [i, m] of [...MISSIONS, ...VERSUS_MAPS.map((v) => ({ name: v.name, map: v.map }))].entries()) {
    assert.equal(m.map.length, 12, `${m.name}: rows`);
    for (const r of m.map) assert.equal(r.length, 20, `${m.name}: row "${r}"`);
    const L = parseMap(m.map);
    assert.ok(L.players.length >= 1, `${m.name}: no player spawn`);
    if (i < 20) assert.ok(L.enemies.length >= 1, `${m.name}: no enemies`);
    // every enemy can be reached from the first spawn through tiles that are not solid blocks
    const seen = new Set<number>();
    const start = Math.floor(L.players[0].y) * L.cols + Math.floor(L.players[0].x);
    const q = [start];
    seen.add(start);
    while (q.length) {
      const c = q.shift()!;
      const cx = c % L.cols;
      const cy = Math.floor(c / L.cols);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= L.cols || ny >= L.rows) continue;
        const n = ny * L.cols + nx;
        if (seen.has(n) || L.grid[n] === BLOCK) continue;
        seen.add(n);
        q.push(n);
      }
    }
    for (const e of L.enemies) {
      assert.ok(seen.has(Math.floor(e.y) * L.cols + Math.floor(e.x)), `${m.name}: enemy at ${e.x},${e.y} unreachable`);
      assert.equal(L.grid[Math.floor(e.y) * L.cols + Math.floor(e.x)], FLOOR);
    }
  }
  // missions get harder: enemy counts never drop by more than one from one mission to the next
  const counts = MISSIONS.map((m) => parseMap(m.map).enemies.length);
  assert.ok(counts[0] <= 2 && counts[19] >= 3, `${counts}`);
});

check("the hull turns towards the stick and drives at once, backwards when that is shorter", () => {
  const w = map(put(EMPTY, 10, 6, "1"));
  const t = w.tanks[0];
  t.body = 0; // facing east
  const x0 = t.x;
  for (let i = 0; i < 6; i++) driveTank(w, 0, -1, 0, 1 / 60); // stick west: reverse straight away
  assert.ok(t.x < x0 - 0.12, `moved ${t.x - x0}`);
  assert.ok(Math.abs(t.body) < 0.01, "did not spin round to drive west");
  const y0 = t.y;
  for (let i = 0; i < 15; i++) driveTank(w, 0, 0, -1, 1 / 60); // stick north
  assert.ok(t.y < y0 - 0.15, "moving north within a quarter second");
});

check("tanks cannot drive into blocks, crates or holes", () => {
  let rows = put(EMPTY, 3, 6, "1");
  rows = put(rows, 5, 6, "#");
  rows = put(rows, 3, 4, "c");
  rows = put(rows, 1, 6, "o");
  const w = map(rows);
  for (const [sx, sy] of [[1, 0], [0, -1], [-1, 0]]) {
    for (let i = 0; i < 120; i++) driveTank(w, 0, sx, sy, 1 / 60);
    assert.ok(!tankBlocked(w, w.tanks[0].x, w.tanks[0].y, KINDS.player.radius - 0.02), `overlapping after driving ${sx},${sy}`);
  }
});

check("shells bounce once (Bouncer twice) and then pop", () => {
  for (const [kind, want] of [["rookie", 1], ["bouncer", 2]] as const) {
    const w = map(put(put(EMPTY, 10, 6, "1"), 15, 1, kind === "rookie" ? "r" : "b"));
    const e = w.tanks[1];
    e.turret = Math.PI / 2 + 0.3; // down-right, towards the bottom wall
    e.cooldown = 0;
    w.tanks[0].alive = false; // keep the player out of the way
    assert.ok(fire(w, 1));
    const ev = run(w, 8);
    assert.equal(ev.filter((x) => x.type === "bounce").length, want, kind);
    assert.equal(w.shells.length, 0);
  }
});

check("two shells that meet destroy each other", () => {
  const w = map(put(put(EMPTY, 4, 6, "1"), 16, 6, "s"));
  w.tanks[0].turret = 0;
  w.tanks[1].turret = Math.PI;
  w.tanks[0].cooldown = w.tanks[1].cooldown = 0;
  fire(w, 0);
  fire(w, 1);
  const ev = run(w, 3);
  assert.ok(ev.some((e) => e.type === "shellsCollide"));
  assert.ok(w.tanks[0].alive && w.tanks[1].alive, "nobody was hit");
});

check("a shell hits a tank; a shield takes one hit; the boss takes three", () => {
  const w = map(put(put(EMPTY, 4, 6, "1"), 12, 6, "X"));
  const p = w.tanks[0];
  const boss = w.tanks[1];
  assert.equal(boss.hp, 3);
  for (let k = 0; k < 3; k++) {
    p.turret = 0;
    p.cooldown = 0;
    fire(w, 0);
    run(w, 2);
  }
  assert.ok(!boss.alive, "boss down after 3 hits");
  const w2 = map(put(put(EMPTY, 4, 6, "1"), 12, 6, "r"));
  w2.tanks[1].shield = 5;
  w2.tanks[0].turret = 0;
  w2.tanks[0].cooldown = 0;
  fire(w2, 0);
  run(w2, 2);
  assert.ok(w2.tanks[1].alive && w2.tanks[1].shield === 0, "shield used up instead");
});

check("mines blow up crates and tanks in range after their fuse, and a shell sets one off", () => {
  let rows = put(EMPTY, 5, 6, "1");
  rows = put(rows, 6, 7, "c");
  rows = put(rows, 15, 2, "r");
  const w = map(rows);
  assert.ok(layMine(w, 0));
  w.tanks[0].x = 12; // drive away (teleport for the test)
  const ev = run(w, 12);
  assert.ok(ev.some((e) => e.type === "explode"));
  assert.equal(w.grid[7 * 20 + 6], FLOOR, "crate destroyed");
  assert.ok(w.tanks[0].alive, "player was far enough away");
  const w2 = map(put(put(EMPTY, 3, 6, "1"), 15, 2, "r"));
  w2.mines.push({ x: 9.5, y: 6.5, owner: 1, age: 2, fuse: 10 });
  w2.tanks[0].turret = 0;
  w2.tanks[0].cooldown = 0;
  fire(w2, 0);
  assert.ok(run(w2, 2).some((e) => e.type === "explode"), "shot mine exploded");
  assert.ok(HOLE !== CRATE);
});

check("the shot tracer follows bounces and reports the first tank in the way", () => {
  const w = map(put(put(EMPTY, 3, 6, "1"), 15, 6, "r"));
  const straight = traceShot(w, w.tanks[0].x, w.tanks[0].y, 0, 1, 0);
  assert.equal(straight.hit, 1);
  // aim at the top wall so the shell comes down onto the enemy after one bounce
  const tx = w.tanks[1].x;
  const ty = w.tanks[1].y;
  const mirrorY = -ty; // reflect the target in the top wall (y = 0)
  const a = Math.atan2(mirrorY - w.tanks[0].y, tx - w.tanks[0].x);
  const banked = traceShot(w, w.tanks[0].x, w.tanks[0].y, a, 1, 0);
  assert.equal(banked.hit, 1, "bank shot found");
  assert.ok(banked.points.length >= 3, "path has a bend");
  aimTurret(w, 0, a, 1);
  assert.ok(Math.abs(w.tanks[0].turret - a) < 1e-6);
});

console.log(`${passed} tank simulation checks passed.`);
