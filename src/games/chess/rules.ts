/**
 * Chess rules: move generation, legality, check, castling, en passant, promotion and game-end detection.
 *
 * Pure logic with no Phaser or DOM imports, so it can be tested in Node (see tests/chess-rules.test.ts).
 * Squares are indices 0..63. Index 0 is a8 (top-left from White's side), index 63 is h1.
 * Row r = 0 is rank 8, row 7 is rank 1. Column c = 0 is the a-file.
 */

export type Color = "w" | "b";
export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
export type Piece = { t: PieceType; c: Color };
export type Castling = { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean };

export type Move = {
  from: number;
  to: number;
  /** Promotion piece, when a pawn reaches the last rank. */
  promo?: PieceType;
  castle?: boolean;
  ep?: boolean;
  /** The piece removed by this move, if any. */
  cap?: Piece;
};

export type Position = {
  board: (Piece | null)[];
  turn: Color;
  castling: Castling;
  /** Square a pawn just skipped over (en passant target), or -1. */
  ep: number;
  /** Half-moves since the last capture or pawn move (50-move rule). */
  half: number;
  full: number;
};

export type Outcome = "ongoing" | "checkmate" | "stalemate" | "fifty-move" | "repetition" | "insufficient";

const KNIGHT_STEPS: [number, number][] = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING_STEPS: [number, number][] = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const DIAGONALS: [number, number][] = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ORTHOGONALS: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

const FILES = "abcdefgh";
export const squareName = (i: number): string => `${FILES[i & 7]}${8 - (i >> 3)}`;
const inside = (r: number, c: number): boolean => r >= 0 && r < 8 && c >= 0 && c < 8;
const opposite = (c: Color): Color => (c === "w" ? "b" : "w");

export function startPosition(): Position {
  return parseFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
}

/** Reads a FEN string. Used for the start position and for test positions. */
export function parseFen(fen: string): Position {
  const [placement, turn, castle, ep, half, full] = fen.trim().split(/\s+/);
  const board: (Piece | null)[] = Array(64).fill(null);
  placement.split("/").forEach((row, r) => {
    let c = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) {
        c += Number(ch);
        continue;
      }
      const t = ch.toLowerCase() as PieceType;
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
    full: Number(full ?? 1),
  };
}

export function findKing(board: (Piece | null)[], c: Color): number {
  return board.findIndex((p) => p !== null && p.t === "k" && p.c === c);
}

/** True when any piece of colour `by` attacks square `sq`. */
export function isAttacked(board: (Piece | null)[], sq: number, by: Color): boolean {
  const r = sq >> 3;
  const c = sq & 7;
  // A white pawn attacks upwards (towards row 0), so it sits one row below the target.
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
  const ray = (steps: [number, number][], types: PieceType[]): boolean => {
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

export function inCheck(pos: Position, side: Color): boolean {
  const k = findKing(pos.board, side);
  return k >= 0 && isAttacked(pos.board, k, opposite(side));
}

/** Every move the side to move could make, ignoring whether it leaves its own king in check. */
function pseudoMoves(pos: Position, side: Color): Move[] {
  const moves: Move[] = [];
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
        addPawnMove(moves, from, pushRow * 8 + c, pushRow === lastRow, undefined, false);
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
        if (!target || target.c === enemy) moves.push({ from, to, cap: target ?? undefined });
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

/** A pawn reaching the last rank may promote to any of the four pieces. */
function addPawnMove(moves: Move[], from: number, to: number, promotes: boolean, cap: Piece | undefined, ep: boolean): void {
  if (promotes) {
    for (const promo of ["q", "r", "b", "n"] as PieceType[]) moves.push({ from, to, promo, cap, ep });
  } else {
    moves.push({ from, to, cap, ep });
  }
}

function addCastling(pos: Position, side: Color, moves: Move[]): void {
  const { board, castling } = pos;
  const home = side === "w" ? 60 : 4;
  const king = board[home];
  if (!king || king.t !== "k" || king.c !== side) return;
  const enemy = opposite(side);
  if (isAttacked(board, home, enemy)) return;

  const canKing = side === "w" ? castling.wK : castling.bK;
  const canQueen = side === "w" ? castling.wQ : castling.bQ;
  const rook = (sq: number): boolean => {
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

/** Applies a move and returns the new position. Does not check legality. */
export function applyMove(pos: Position, m: Move): Position {
  const board = pos.board.slice();
  const piece = board[m.from]!;
  const castling = { ...pos.castling };
  const mover = piece.c;

  board[m.from] = null;
  if (m.ep) board[(m.from & ~7) + (m.to & 7)] = null;
  let placed: Piece = piece;
  if (m.promo) placed = { t: m.promo, c: mover };
  board[m.to] = placed;

  if (m.castle) {
    const rookFrom = m.to > m.from ? m.from + 3 : m.from - 4;
    const rookTo = m.to > m.from ? m.from + 1 : m.from - 1;
    board[rookTo] = board[rookFrom];
    board[rookFrom] = null;
  }

  // Castling rights: a king move ends both; a rook leaving (or being captured on) its corner ends one.
  if (piece.t === "k") {
    if (mover === "w") {
      castling.wK = false;
      castling.wQ = false;
    } else {
      castling.bK = false;
      castling.bQ = false;
    }
  }
  const corner = (sq: number): void => {
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
    full: mover === "b" ? pos.full + 1 : pos.full,
  };
}

/** All legal moves for the side to move. */
export function legalMoves(pos: Position): Move[] {
  const side = pos.turn;
  return pseudoMoves(pos, side).filter((m) => {
    const after = applyMove(pos, m);
    return !inCheck(after, side);
  });
}

/** Legal moves starting on one square. */
export function movesFrom(pos: Position, from: number): Move[] {
  return legalMoves(pos).filter((m) => m.from === from);
}

export function positionKey(pos: Position): string {
  const parts: string[] = [];
  for (let i = 0; i < 64; i++) {
    const p = pos.board[i];
    parts.push(p ? (p.c === "w" ? p.t.toUpperCase() : p.t) : ".");
  }
  const { castling: k } = pos;
  return `${parts.join("")} ${pos.turn} ${k.wK ? "K" : ""}${k.wQ ? "Q" : ""}${k.bK ? "k" : ""}${k.bQ ? "q" : ""} ${pos.ep}`;
}

/** Insufficient material: neither side can ever deliver mate with the pieces left. */
function insufficientMaterial(board: (Piece | null)[]): boolean {
  const minors = board.filter((p) => p && p.t !== "k");
  if (minors.length === 0) return true;
  if (minors.length === 1 && (minors[0]!.t === "b" || minors[0]!.t === "n")) return true;
  return false;
}

/** Game status for the side to move. `history` holds keys of earlier positions for repetition checks. */
export function outcome(pos: Position, history: string[] = []): Outcome {
  const moves = legalMoves(pos);
  if (moves.length === 0) return inCheck(pos, pos.turn) ? "checkmate" : "stalemate";
  if (insufficientMaterial(pos.board)) return "insufficient";
  if (pos.half >= 100) return "fifty-move";
  const key = positionKey(pos);
  if (history.filter((k) => k === key).length >= 2) return "repetition";
  return "ongoing";
}

/** Counts leaf nodes to a given depth. Used by the tests to check move generation. */
export function perft(pos: Position, depth: number): number {
  if (depth === 0) return 1;
  let total = 0;
  for (const m of legalMoves(pos)) total += perft(applyMove(pos, m), depth - 1);
  return total;
}

export const pieceValue: Record<PieceType, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
