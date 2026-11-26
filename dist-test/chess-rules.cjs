"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// tests/chess-rules.test.ts
var import_strict = __toESM(require("node:assert/strict"), 1);

// src/games/chess/rules.ts
var KNIGHT_STEPS = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
var KING_STEPS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
var DIAGONALS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
var ORTHOGONALS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
var FILES = "abcdefgh";
var squareName = (i) => `${FILES[i & 7]}${8 - (i >> 3)}`;
var inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
var opposite = (c) => c === "w" ? "b" : "w";
function startPosition() {
  return parseFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
}
function parseFen(fen) {
  const [placement, turn, castle, ep, half, full] = fen.trim().split(/\s+/);
  const board = Array(64).fill(null);
  placement.split("/").forEach((row, r) => {
    let c = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) {
        c += Number(ch);
        continue;
      }
      const t = ch.toLowerCase();
      board[r * 8 + c] = { t, c: ch === ch.toUpperCase() ? "w" : "b" };
      c++;
    }
  });
  const epIndex = ep && ep !== "-" ? (8 - Number(ep[1])) * 8 + FILES.indexOf(ep[0]) : -1;
  return {
    board,
    turn: turn === "b" ? "b" : "w",
    castling: { wK: castle.includes("K"), wQ: castle.includes("Q"), bK: castle.includes("k"), bQ: castle.includes("q") },
    ep: epIndex,
    half: Number(half ?? 0),
    full: Number(full ?? 1)
  };
}
function findKing(board, c) {
  return board.findIndex((p) => p !== null && p.t === "k" && p.c === c);
}
function isAttacked(board, sq, by) {
  const r = sq >> 3;
  const c = sq & 7;
  const pawnRow = by === "w" ? r + 1 : r - 1;
  for (const dc of [-1, 1]) {
    if (inside(pawnRow, c + dc)) {
      const p = board[pawnRow * 8 + c + dc];
      if (p && p.t === "p" && p.c === by) return true;
    }
  }
  for (const [dr, dc] of KNIGHT_STEPS) {
    if (!inside(r + dr, c + dc)) continue;
    const p = board[(r + dr) * 8 + c + dc];
    if (p && p.t === "n" && p.c === by) return true;
  }
  for (const [dr, dc] of KING_STEPS) {
    if (!inside(r + dr, c + dc)) continue;
    const p = board[(r + dr) * 8 + c + dc];
    if (p && p.t === "k" && p.c === by) return true;
  }
  const ray = (steps, types) => {
    for (const [dr, dc] of steps) {
      let rr = r + dr;
      let cc = c + dc;
      while (inside(rr, cc)) {
        const p = board[rr * 8 + cc];
        if (p) {
          if (p.c === by && types.includes(p.t)) return true;
          break;
        }
        rr += dr;
        cc += dc;
      }
    }
    return false;
  };
  return ray(DIAGONALS, ["b", "q"]) || ray(ORTHOGONALS, ["r", "q"]);
}
function inCheck(pos, side) {
  const k = findKing(pos.board, side);
  return k >= 0 && isAttacked(pos.board, k, opposite(side));
}
function pseudoMoves(pos, side) {
  const moves = [];
  const { board } = pos;
  const enemy = opposite(side);
  for (let from = 0; from < 64; from++) {
    const p = board[from];
    if (!p || p.c !== side) continue;
    const r = from >> 3;
    const c = from & 7;
    if (p.t === "p") {
      const dir = side === "w" ? -1 : 1;
      const startRow = side === "w" ? 6 : 1;
      const lastRow = side === "w" ? 0 : 7;
      const pushRow = r + dir;
      if (inside(pushRow, c) && !board[pushRow * 8 + c]) {
        addPawnMove(moves, from, pushRow * 8 + c, pushRow === lastRow, void 0, false);
        const twoRow = r + 2 * dir;
        if (r === startRow && !board[twoRow * 8 + c]) moves.push({ from, to: twoRow * 8 + c });
      }
      for (const dc of [-1, 1]) {
        if (!inside(pushRow, c + dc)) continue;
        const to = pushRow * 8 + c + dc;
        const target = board[to];
        if (target && target.c === enemy) {
          addPawnMove(moves, from, to, pushRow === lastRow, target, false);
        } else if (to === pos.ep && !target) {
          const captured = board[r * 8 + c + dc];
          if (captured && captured.t === "p" && captured.c === enemy) {
            moves.push({ from, to, ep: true, cap: captured });
          }
        }
      }
      continue;
    }
    if (p.t === "n" || p.t === "k") {
      const steps = p.t === "n" ? KNIGHT_STEPS : KING_STEPS;
      for (const [dr, dc] of steps) {
        if (!inside(r + dr, c + dc)) continue;
        const to = (r + dr) * 8 + c + dc;
        const target = board[to];
        if (!target || target.c === enemy) moves.push({ from, to, cap: target ?? void 0 });
      }
      continue;
    }
    const dirs = p.t === "b" ? DIAGONALS : p.t === "r" ? ORTHOGONALS : [...DIAGONALS, ...ORTHOGONALS];
    for (const [dr, dc] of dirs) {
      let rr = r + dr;
      let cc = c + dc;
      while (inside(rr, cc)) {
        const to = rr * 8 + cc;
        const target = board[to];
        if (!target) {
          moves.push({ from, to });
        } else {
          if (target.c === enemy) moves.push({ from, to, cap: target });
          break;
        }
        rr += dr;
        cc += dc;
      }
    }
  }
  addCastling(pos, side, moves);
  return moves;
}
function addPawnMove(moves, from, to, promotes, cap, ep) {
  if (promotes) {
    for (const promo of ["q", "r", "b", "n"]) moves.push({ from, to, promo, cap, ep });
  } else {
    moves.push({ from, to, cap, ep });
  }
}
function addCastling(pos, side, moves) {
  const { board, castling } = pos;
  const home = side === "w" ? 60 : 4;
  const king = board[home];
  if (!king || king.t !== "k" || king.c !== side) return;
  const enemy = opposite(side);
  if (isAttacked(board, home, enemy)) return;
  const canKing = side === "w" ? castling.wK : castling.bK;
  const canQueen = side === "w" ? castling.wQ : castling.bQ;
  const rook = (sq) => {
    const p = board[sq];
    return !!p && p.t === "r" && p.c === side;
  };
  if (canKing && rook(home + 3) && !board[home + 1] && !board[home + 2]) {
    if (!isAttacked(board, home + 1, enemy) && !isAttacked(board, home + 2, enemy)) {
      moves.push({ from: home, to: home + 2, castle: true });
    }
  }
  if (canQueen && rook(home - 4) && !board[home - 1] && !board[home - 2] && !board[home - 3]) {
    if (!isAttacked(board, home - 1, enemy) && !isAttacked(board, home - 2, enemy)) {
      moves.push({ from: home, to: home - 2, castle: true });
    }
  }
}
function applyMove(pos, m) {
  const board = pos.board.slice();
  const piece = board[m.from];
  const castling = { ...pos.castling };
  const mover = piece.c;
  board[m.from] = null;
  if (m.ep) board[(m.from & ~7) + (m.to & 7)] = null;
  let placed = piece;
  if (m.promo) placed = { t: m.promo, c: mover };
  board[m.to] = placed;
  if (m.castle) {
    const rookFrom = m.to > m.from ? m.from + 3 : m.from - 4;
    const rookTo = m.to > m.from ? m.from + 1 : m.from - 1;
    board[rookTo] = board[rookFrom];
    board[rookFrom] = null;
  }
  if (piece.t === "k") {
    if (mover === "w") {
      castling.wK = false;
      castling.wQ = false;
    } else {
      castling.bK = false;
      castling.bQ = false;
    }
  }
  const corner = (sq) => {
    if (sq === 63) castling.wK = false;
    if (sq === 56) castling.wQ = false;
    if (sq === 7) castling.bK = false;
    if (sq === 0) castling.bQ = false;
  };
  corner(m.from);
  corner(m.to);
  const isPawnMove = piece.t === "p";
  const doublePush = isPawnMove && Math.abs((m.to >> 3) - (m.from >> 3)) === 2;
  return {
    board,
    turn: opposite(mover),
    castling,
    ep: doublePush ? (m.from + m.to) / 2 : -1,
    half: isPawnMove || m.cap ? 0 : pos.half + 1,
    full: mover === "b" ? pos.full + 1 : pos.full
  };
}
function legalMoves(pos) {
  const side = pos.turn;
  return pseudoMoves(pos, side).filter((m) => {
    const after = applyMove(pos, m);
    return !inCheck(after, side);
  });
}
function positionKey(pos) {
  const parts = [];
  for (let i = 0; i < 64; i++) {
    const p = pos.board[i];
    parts.push(p ? p.c === "w" ? p.t.toUpperCase() : p.t : ".");
  }
  const { castling: k } = pos;
  return `${parts.join("")} ${pos.turn} ${k.wK ? "K" : ""}${k.wQ ? "Q" : ""}${k.bK ? "k" : ""}${k.bQ ? "q" : ""} ${pos.ep}`;
}
function insufficientMaterial(board) {
  const minors = board.filter((p) => p && p.t !== "k");
  if (minors.length === 0) return true;
  if (minors.length === 1 && (minors[0].t === "b" || minors[0].t === "n")) return true;
  return false;
}
function outcome(pos, history = []) {
  const moves = legalMoves(pos);
  if (moves.length === 0) return inCheck(pos, pos.turn) ? "checkmate" : "stalemate";
  if (insufficientMaterial(pos.board)) return "insufficient";
  if (pos.half >= 100) return "fifty-move";
  const key = positionKey(pos);
  if (history.filter((k) => k === key).length >= 2) return "repetition";
  return "ongoing";
}
function perft(pos, depth) {
  if (depth === 0) return 1;
  let total = 0;
  for (const m of legalMoves(pos)) total += perft(applyMove(pos, m), depth - 1);
  return total;
}

// tests/chess-rules.test.ts
var cases = [
  { name: "start position", fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", depths: [[1, 20], [2, 400], [3, 8902]] },
  {
    name: "kiwipete (castling, en passant, promotions)",
    fen: "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
    depths: [[1, 48], [2, 2039], [3, 97862]]
  },
  { name: "endgame with pins and en passant", fen: "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", depths: [[1, 14], [2, 191], [3, 2812]] },
  { name: "promotion and castling edge cases", fen: "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", depths: [[1, 6], [2, 264], [3, 9467]] },
  { name: "mixed middlegame", fen: "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8", depths: [[1, 44], [2, 1486], [3, 62379]] }
];
var failures = 0;
for (const c of cases) {
  for (const [depth, expected] of c.depths) {
    const got = perft(parseFen(c.fen), depth);
    const ok = got === expected;
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${c.name} perft(${depth}) = ${got} (expected ${expected})`);
  }
}
var foolsMate = applyMove(
  applyMove(
    applyMove(
      applyMove(startPosition(), { from: 53, to: 45 }),
      // f2-f3
      { from: 12, to: 28 }
      // e7-e5
    ),
    { from: 54, to: 38 }
    // g2-g4
  ),
  { from: 3, to: 39 }
  // d8-h4
);
import_strict.default.equal(outcome(foolsMate), "checkmate", "fool's mate should be checkmate");
console.log("PASS  checkmate detected");
var stalemate = parseFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
import_strict.default.equal(outcome(stalemate), "stalemate");
console.log("PASS  stalemate detected");
import_strict.default.equal(squareName(60), "e1");
import_strict.default.equal(squareName(0), "a8");
console.log("PASS  square names");
var startMoves = legalMoves(startPosition()).length;
import_strict.default.equal(startMoves, 20);
if (failures > 0) {
  console.error(`${failures} perft check(s) failed`);
  process.exit(1);
}
console.log("All chess rule checks passed.");
