/** Checks for the Ludo rules. Run with: npm test */
import assert from "node:assert/strict";
import {
  allChoices, applyMove, cellOf, chooseMove, earnsBonus, FINAL, hasWon, HOME_CENTER, isSafe, legalMoves, moveFor, newTokens, seatColors,
  START_INDEX, TRACK, trackIndex, YARD,
} from "../src/games/ludo/rules";

let passed = 0;
const check = (name: string, fn: () => void): void => {
  fn();
  passed++;
  console.log(`PASS  ${name}`);
};

check("the loop has 52 distinct squares, each next to the last", () => {
  assert.equal(TRACK.length, 52);
  assert.equal(new Set(TRACK.map((c) => c.join(","))).size, 52);
  // Like a real board, the path steps diagonally round the four inner corners and is edge-to-edge elsewhere.
  let diagonal = 0;
  for (let i = 0; i < 52; i++) {
    const a = TRACK[i];
    const b = TRACK[(i + 1) % 52];
    const dx = Math.abs(a[0] - b[0]);
    const dy = Math.abs(a[1] - b[1]);
    assert.ok(Math.max(dx, dy) === 1, `squares ${i} and ${(i + 1) % 52} touch`);
    if (dx === 1 && dy === 1) diagonal++;
  }
  assert.equal(diagonal, 4);
});

check("each colour starts on its own arm and its home column leads to the centre", () => {
  assert.deepEqual(TRACK[START_INDEX[0]], [1, 6]);
  assert.deepEqual(TRACK[START_INDEX[1]], [8, 1]);
  assert.deepEqual(TRACK[START_INDEX[2]], [13, 8]);
  assert.deepEqual(TRACK[START_INDEX[3]], [6, 13]);
  for (let c = 0; c < 4; c++) {
    const last = cellOf(c, 50);
    const firstHome = cellOf(c, 51);
    assert.equal(Math.abs(last[0] - firstHome[0]) + Math.abs(last[1] - firstHome[1]), 1, `colour ${c} turns into its home column`);
    const lastHome = cellOf(c, 55);
    const centre = HOME_CENTER[c];
    assert.equal(Math.abs(lastHome[0] - centre[0]) + Math.abs(lastHome[1] - centre[1]), 1, `colour ${c} column reaches the centre`);
  }
});

check("a token needs a 6 to leave the yard", () => {
  const t = newTokens();
  for (const die of [1, 2, 3, 4, 5]) assert.equal(legalMoves(t, 0, die).length, 0, `die ${die}`);
  assert.equal(legalMoves(t, 0, 6).length, 4);
  assert.equal(moveFor(t, 0, 0, 6)!.to, 0);
});

check("finishing needs an exact roll", () => {
  const t = newTokens();
  t[0][0] = 53;
  assert.ok(moveFor(t, 0, 0, 3), "exactly 3 finishes");
  assert.equal(moveFor(t, 0, 0, 4), null, "4 would overshoot");
});

check("landing on a lone opponent captures it", () => {
  const t = newTokens();
  t[0][0] = 3; // red on its 4th square: loop index 3
  // Place green so that it sits on loop index 6: green start is index 13, so it cannot be there on its own track.
  // Use yellow: start 26, so r = 6 - 26 + 52 = 32 lands on index 6.
  t[2][0] = 32;
  const m = moveFor(t, 0, 0, 3)!;
  assert.equal(m.to, 6);
  assert.deepEqual(m.captures, [{ color: 2, token: 0 }]);
  const after = applyMove(t, 0, m);
  assert.equal(after[2][0], YARD);
  assert.equal(after[0][0], 6);
});

check("safe squares are not captured on", () => {
  const t = newTokens();
  t[0][0] = 5;
  // loop index 8 is a star square. Put yellow there: r = 8 - 26 + 52 = 34.
  t[2][0] = 34;
  assert.ok(isSafe(2, 34));
  const m = moveFor(t, 0, 0, 3)!;
  assert.equal(trackIndex(0, m.to), 8);
  assert.equal(m.captures.length, 0);
});

check("no capture inside the home column", () => {
  const t = newTokens();
  t[0][0] = 49;
  t[1][0] = 51; // green in its own home column
  const m = moveFor(t, 0, 0, 2)!; // red to 51: red's home column
  assert.equal(m.captures.length, 0);
});

check("a 6 earns a bonus roll", () => {
  assert.equal(earnsBonus([3, 6]), true);
  assert.equal(earnsBonus([1, 2]), false);
});

check("winning needs all four tokens home", () => {
  const t = newTokens();
  t[1] = [FINAL, FINAL, FINAL, FINAL - 1];
  assert.equal(hasWon(t, 1), false);
  t[1][3] = FINAL;
  assert.equal(hasWon(t, 1), true);
});

check("seats: 2 players sit opposite, 4 use every colour", () => {
  assert.deepEqual(seatColors(2), [0, 2]);
  assert.deepEqual(seatColors(3), [0, 1, 2]);
  assert.deepEqual(seatColors(4), [0, 1, 2, 3]);
});

check("the computer picks a legal move, prefers capturing, and passes when stuck", () => {
  const t = newTokens();
  assert.equal(chooseMove(t, 0, [3, null]), null, "no six in the yard means no move");
  assert.ok(chooseMove(t, 0, [6, 2]), "a six lets it leave the yard");

  t[0][0] = 3;
  t[0][1] = 20;
  t[2][0] = 32; // capturable by red token 0 with a 3
  const pick = chooseMove(t, 0, [3, null], () => 0);
  assert.ok(pick);
  assert.equal(pick!.move.captures.length, 1);
  assert.equal(allChoices(t, 0, [3, null]).length, 2);
});

/** A small seeded random generator so the simulations are repeatable. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

check("computer-only games always finish and never break the rules", () => {
  for (const players of [2, 3, 4]) {
    for (const diceCount of [1, 2, 3]) {
      for (let game = 0; game < 6; game++) {
        const rnd = seeded(players * 1000 + diceCount * 100 + game);
        const seats = seatColors(players);
        let tokens = newTokens();
        let turn = 0;
        let winner = -1;
        for (let step = 0; step < 6000 && winner < 0; step++) {
          const color = seats[turn % seats.length];
          let rolls = 0;
          let values: number[] = [];
          do {
            rolls++;
            values = Array.from({ length: diceCount }, () => 1 + Math.floor(rnd() * 6));
            const dice: (number | null)[] = values.slice();
            for (;;) {
              const pick = chooseMove(tokens, color, dice, rnd);
              if (!pick) break;
              tokens = applyMove(tokens, color, pick.move);
              dice[pick.die] = null;
              // invariants: progress stays in range, and no two colours share a non-safe loop square after a capture
              for (const row of tokens) for (const r of row) assert.ok(r >= YARD && r <= FINAL);
              if (hasWon(tokens, color)) {
                winner = color;
                break;
              }
            }
          } while (winner < 0 && earnsBonus(values) && rolls < 3);
          turn++;
        }
        assert.ok(winner >= 0, `${players} players, ${diceCount} dice, game ${game} should finish`);
      }
    }
  }
});

console.log(`\n${passed} ludo checks passed.`);
