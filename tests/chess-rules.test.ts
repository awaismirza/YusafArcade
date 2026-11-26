/**
 * Move-generation checks using standard perft positions (known correct node counts).
 * Run with: npm run test:chess
 */
import assert from "node:assert/strict";
import { applyMove, legalMoves, outcome, parseFen, perft, startPosition, squareName } from "../src/games/chess/rules";

const cases: { name: string; fen: string; depths: [number, number][] }[] = [
  { name: "start position", fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", depths: [[1, 20], [2, 400], [3, 8902]] },
  {
    name: "kiwipete (castling, en passant, promotions)",
    fen: "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
    depths: [[1, 48], [2, 2039], [3, 97862]],
  },
  { name: "endgame with pins and en passant", fen: "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", depths: [[1, 14], [2, 191], [3, 2812]] },
  { name: "promotion and castling edge cases", fen: "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", depths: [[1, 6], [2, 264], [3, 9467]] },
  { name: "mixed middlegame", fen: "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8", depths: [[1, 44], [2, 1486], [3, 62379]] },
];

let failures = 0;
for (const c of cases) {
  for (const [depth, expected] of c.depths) {
    const got = perft(parseFen(c.fen), depth);
    const ok = got === expected;
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${c.name} perft(${depth}) = ${got} (expected ${expected})`);
  }
}

// Game-end detection: fool's mate is checkmate for Black after 1.f3 e5 2.g4 Qh4#.
const foolsMate = applyMove(
  applyMove(
    applyMove(
      applyMove(startPosition(), { from: 53, to: 45 }), // f2-f3
      { from: 12, to: 28 } // e7-e5
    ),
    { from: 54, to: 38 } // g2-g4
  ),
  { from: 3, to: 39 } // d8-h4
);
assert.equal(outcome(foolsMate), "checkmate", "fool's mate should be checkmate");
console.log("PASS  checkmate detected");

// Stalemate: black king on a8, white queen on b6 and white king on c8 is not legal (adjacent); use a known stalemate.
const stalemate = parseFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
assert.equal(outcome(stalemate), "stalemate");
console.log("PASS  stalemate detected");

// Castling squares are named correctly for display.
assert.equal(squareName(60), "e1");
assert.equal(squareName(0), "a8");
console.log("PASS  square names");

const startMoves = legalMoves(startPosition()).length;
assert.equal(startMoves, 20);

if (failures > 0) {
  console.error(`${failures} perft check(s) failed`);
  process.exit(1);
}
console.log("All chess rule checks passed.");
