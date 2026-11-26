/**
 * Checkers (English draughts) rules and computer opponent. Pure logic with no Phaser or DOM imports.
 *
 * 8×8 board, pieces on dark squares ((row + col) is odd). White starts at the bottom (rows 5–7) and moves
 * towards row 0; Black starts at the top (rows 0–2) and moves towards row 7. Jumping is compulsory, a jump can
 * chain, and a man reaching the far row is crowned and ends its turn.
 */

export type Side = "w" | "b";
export type Piece = { c: Side; k: boolean };
export type Board = (Piece | null)[][];
export type Sq = [number, number];
/** One complete turn: a simple step (path of 1, no caps) or a jump chain. */
export type Move = { from: Sq; path: Sq[]; caps: Sq[] };

export const N = 8;
export const WHITE: Side = "w";
export const BLACK: Side = "b";
/** Moves without a capture or a crown before the game is a draw (60 plies). */
export const QUIET_LIMIT = 60;

const inside = (r: number, c: number): boolean => r >= 0 && r < N && c >= 0 && c < N;
export const cloneBoard = (b: Board): Board => b.map((row) => row.map((p) => (p ? { ...p } : null)));
export const promoRow = (side: Side): number => (side === "w" ? 0 : N - 1);
export const other = (s: Side): Side => (s === "w" ? "b" : "w");

function dirsFor(p: Piece): [number, number][] {
  if (p.k) return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const f = p.c === "w" ? -1 : 1; // men only move forward
  return [[f, -1], [f, 1]];
}

export function startBoard(): Board {
  const b: Board = Array.from({ length: N }, () => Array(N).fill(null));
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if ((r + c) % 2 !== 1) continue; // pieces only sit on dark squares
      if (r < 3) b[r][c] = { c: "b", k: false };
      else if (r > 4) b[r][c] = { c: "w", k: false };
    }
  }
  return b;
}

/** Depth-first search for jump chains. `b` has the moving piece already lifted off its square. */
function collectJumps(b: Board, r: number, c: number, piece: Piece, side: Side, path: Sq[], caps: Sq[], out: Move[], from: Sq): void {
  for (const [dr, dc] of dirsFor(piece)) {
    const mr = r + dr;
    const mc = c + dc;
    const lr = r + 2 * dr;
    const lc = c + 2 * dc;
    if (!inside(lr, lc)) continue;
    const mid = b[mr][mc];
    if (!mid || mid.c === side || b[lr][lc]) continue;

    const nb = cloneBoard(b);
    nb[mr][mc] = null; // a jumped piece is removed straight away, so it can't be jumped twice
    const nPath: Sq[] = [...path, [lr, lc]];
    const nCaps: Sq[] = [...caps, [mr, mc]];
    // Reaching the far row crowns the man and ends the turn (official rule).
    if (!piece.k && lr === promoRow(side)) {
      out.push({ from, path: nPath, caps: nCaps });
      continue;
    }
    const before = out.length;
    collectJumps(nb, lr, lc, piece, side, nPath, nCaps, out, from);
    if (out.length === before) out.push({ from, path: nPath, caps: nCaps });
  }
}

/** All legal moves. If any jump exists, jumping is compulsory. */
export function legalMoves(board: Board, side: Side): Move[] {
  const jumps: Move[] = [];
  const steps: Move[] = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const p = board[r][c];
      if (!p || p.c !== side) continue;
      const from: Sq = [r, c];
      const lifted = cloneBoard(board);
      lifted[r][c] = null;
      collectJumps(lifted, r, c, p, side, [], [], jumps, from);
      for (const [dr, dc] of dirsFor(p)) {
        const nr = r + dr;
        const nc = c + dc;
        if (inside(nr, nc) && !board[nr][nc]) steps.push({ from, path: [[nr, nc]], caps: [] });
      }
    }
  }
  return jumps.length > 0 ? jumps : steps;
}

export function applyMove(board: Board, m: Move): Board {
  const nb = cloneBoard(board);
  const [fr, fc] = m.from;
  const piece = nb[fr][fc]!;
  nb[fr][fc] = null;
  for (const [r, c] of m.caps) nb[r][c] = null;
  const [lr, lc] = m.path[m.path.length - 1];
  nb[lr][lc] = { c: piece.c, k: piece.k || lr === promoRow(piece.c) };
  return nb;
}

/** True when this move crowns a man. */
export function crowns(board: Board, m: Move): boolean {
  const p = board[m.from[0]][m.from[1]];
  return !!p && !p.k && m.path[m.path.length - 1][0] === promoRow(p.c);
}

/** Score from Black's side (the computer): material, a crown bonus, and a small push forward. */
function evaluateForBlack(board: Board): number {
  let score = 0;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const p = board[r][c];
      if (!p) continue;
      const progress = p.c === "b" ? r : N - 1 - r;
      const value = (p.k ? 2.5 : 1) + progress * 0.05;
      score += p.c === BLACK ? value : -value;
    }
  }
  return score;
}

/** Minimax with alpha-beta pruning. A side with no legal moves has lost. */
export function search(board: Board, side: Side, depth: number, alpha: number, beta: number): number {
  const moves = legalMoves(board, side);
  if (moves.length === 0) return side === BLACK ? -1000 : 1000;
  if (depth === 0) return evaluateForBlack(board);
  if (side === BLACK) {
    let best = -Infinity;
    for (const m of moves) {
      best = Math.max(best, search(applyMove(board, m), WHITE, depth - 1, alpha, beta));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }
  let best = Infinity;
  for (const m of moves) {
    best = Math.min(best, search(applyMove(board, m), BLACK, depth - 1, alpha, beta));
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

export type Level = "easy" | "hard";

/** Picks Black's move. Easy sometimes plays at random and looks one move ahead; hard looks four plies ahead. */
export function chooseMove(board: Board, level: Level, random: () => number = Math.random): Move {
  const moves = legalMoves(board, BLACK);
  if (level === "easy" && random() < 0.5) return moves[Math.floor(random() * moves.length)];
  const lookAhead = level === "easy" ? 1 : 4;
  const shuffled = moves.slice().sort(() => random() - 0.5);
  let best = shuffled[0];
  let bestScore = -Infinity;
  for (const m of shuffled) {
    const score = search(applyMove(board, m), WHITE, lookAhead - 1, -Infinity, Infinity);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

export function countPieces(board: Board, side: Side): number {
  let n = 0;
  for (const row of board) for (const p of row) if (p && p.c === side) n++;
  return n;
}
