/** Checks for the checkers rules: compulsory jumps, multi-jumps, crowning, kings and the computer. Run with: npm test */
import assert from "node:assert/strict";
import { applyMove, Board, chooseMove, crowns, legalMoves, N, startBoard } from "../src/games/checkers/rules";

const empty = (): Board => Array.from({ length: N }, () => Array(N).fill(null));
let passed = 0;
const check = (name: string, fn: () => void): void => {
  fn();
  passed++;
  console.log(`PASS  ${name}`);
};

check("white has 7 opening moves", () => {
  assert.equal(legalMoves(startBoard(), "w").length, 7);
});

check("black also has 7 opening moves", () => {
  assert.equal(legalMoves(startBoard(), "b").length, 7);
});

check("a jump is compulsory when one exists", () => {
  const b = empty();
  b[5][2] = { c: "w", k: false };
  b[6][5] = { c: "w", k: false }; // a free piece that could otherwise make a plain step
  b[4][3] = { c: "b", k: false };
  const moves = legalMoves(b, "w");
  assert.ok(moves.length > 0);
  assert.ok(moves.every((m) => m.caps.length > 0), "only capturing moves are allowed");
  assert.deepEqual(moves[0].path, [[3, 4]]);
});

check("multi-jumps chain", () => {
  const b = empty();
  b[6][1] = { c: "w", k: false };
  b[5][2] = { c: "b", k: false };
  b[3][4] = { c: "b", k: false };
  const moves = legalMoves(b, "w");
  assert.equal(moves.length, 1);
  assert.equal(moves[0].caps.length, 2);
  assert.deepEqual(moves[0].path, [[4, 3], [2, 5]]);
  const after = applyMove(b, moves[0]);
  assert.equal(after[5][2], null);
  assert.equal(after[3][4], null);
  assert.equal(after[2][5]?.c, "w");
});

check("a man reaching the far row is crowned", () => {
  const b = empty();
  b[1][2] = { c: "w", k: false };
  const [m] = legalMoves(b, "w").filter((x) => x.path[0][1] === 1);
  assert.ok(crowns(b, m));
  assert.equal(applyMove(b, m)[0][1]?.k, true);
});

check("a crowning jump ends the turn", () => {
  const b = empty();
  b[2][3] = { c: "w", k: false };
  b[1][2] = { c: "b", k: false };
  b[1][4] = { c: "b", k: false };
  b[3][2] = { c: "b", k: false }; // would be jumpable backwards by a king, not by a man
  const moves = legalMoves(b, "w");
  assert.ok(moves.every((m) => m.path.length === 1), "the crowned piece must not continue jumping");
});

check("kings move backwards, men do not", () => {
  const king = empty();
  king[4][3] = { c: "w", k: true };
  assert.equal(legalMoves(king, "w").length, 4);
  const man = empty();
  man[4][3] = { c: "w", k: false };
  assert.equal(legalMoves(man, "w").length, 2);
});

check("a side with no pieces has no moves", () => {
  const b = empty();
  b[0][1] = { c: "b", k: false };
  assert.equal(legalMoves(b, "w").length, 0);
});

check("the computer always plays a legal move", () => {
  let board = startBoard();
  let side: "w" | "b" = "w";
  for (let i = 0; i < 12; i++) {
    const moves = legalMoves(board, side);
    if (moves.length === 0) break;
    const picked = side === "b" ? chooseMove(board, "hard") : moves[0];
    assert.ok(moves.some((m) => JSON.stringify(m) === JSON.stringify(picked)), "chosen move is legal");
    board = applyMove(board, picked);
    side = side === "w" ? "b" : "w";
  }
});

console.log(`\n${passed} checkers checks passed.`);
