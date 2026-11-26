/**
 * Computer opponent for chess: alpha-beta search over the rules module, with a material and
 * piece-square evaluation. Pure logic, no Phaser or DOM imports.
 */
import { applyMove, inCheck, legalMoves, pieceValue, Position, Move, Color, PieceType } from "./rules";

// Piece-square tables from White's point of view (row 0 = rank 8). Black mirrors them.
const PST: Record<PieceType, number[]> = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
};

/** Evaluation from White's point of view, in centipawns. */
export function evaluate(pos: Position): number {
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const p = pos.board[i];
    if (!p) continue;
    const table = PST[p.t];
    const pst = p.c === "w" ? table[i] : table[(7 - (i >> 3)) * 8 + (i & 7)];
    const v = pieceValue[p.t] + pst;
    score += p.c === "w" ? v : -v;
  }
  return score;
}

/** Captures first (most valuable victim, least valuable attacker), then everything else. */
function orderMoves(pos: Position, moves: Move[]): Move[] {
  const score = (m: Move): number => {
    const attacker = pos.board[m.from]!;
    const victim = m.cap ? pieceValue[m.cap.t] : 0;
    return victim * 10 - pieceValue[attacker.t] / 100 + (m.promo ? 800 : 0);
  };
  return moves.slice().sort((a, b) => score(b) - score(a));
}

/** Negamax-style alpha-beta, always scored from White's side. Returns the best score found. */
function alphaBeta(pos: Position, depth: number, alpha: number, beta: number): number {
  const moves = legalMoves(pos);
  if (moves.length === 0) {
    // Mate scores are depth-adjusted so that quicker mates are preferred.
    if (inCheck(pos, pos.turn)) return pos.turn === "w" ? -100000 - depth : 100000 + depth;
    return 0;
  }
  if (pos.half >= 100) return 0;
  if (depth === 0) return evaluate(pos);

  const maximising = pos.turn === "w";
  let best = maximising ? -Infinity : Infinity;
  for (const m of orderMoves(pos, moves)) {
    const child = applyMove(pos, m);
    const score = alphaBeta(child, depth - 1, alpha, beta);
    if (maximising) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break;
  }
  return best;
}

export type Level = "easy" | "hard";

/**
 * Picks a move for the side to move. Easy looks one move ahead and sometimes plays a random
 * legal move; hard searches three moves deep. Ties are broken randomly so games vary.
 */
export function chooseMove(pos: Position, level: Level, random: () => number = Math.random): Move {
  const moves = legalMoves(pos);
  if (level === "easy" && random() < 0.35) return moves[Math.floor(random() * moves.length)];

  const depth = level === "easy" ? 1 : 3;
  const ordered = shuffle(orderMoves(pos, moves), random);
  const maximising: Color = pos.turn;
  let best = ordered[0];
  let bestScore = maximising === "w" ? -Infinity : Infinity;
  for (const m of ordered) {
    const score = alphaBeta(applyMove(pos, m), depth - 1, -Infinity, Infinity);
    const better = maximising === "w" ? score > bestScore : score < bestScore;
    if (better) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
