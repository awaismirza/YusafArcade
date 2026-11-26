/**
 * Ludo rules and a simple computer player. Pure logic with no Phaser or DOM imports.
 *
 * The board is the classic 15 × 15 cross. A token's progress `r` is:
 *   -1       in the yard (needs a 6 to come out)
 *   0..50    on the shared 52-square loop, counted from that colour's own start square
 *   51..55   in that colour's home column
 *   56       home (the centre). Finishing needs an exact roll.
 *
 * Colours go clockwise: 0 red (left), 1 green (top), 2 yellow (right), 3 blue (bottom).
 * Landing on a single opponent token that is not on a safe square sends it back to its yard.
 * Safe squares are every start square and the star square 8 steps after it.
 */

export type Cell = [number, number]; // [column, row] on the 15 × 15 grid; (0,0) is top-left

export const COLOR_NAMES = ["Red", "Green", "Yellow", "Blue"];
export const COLOR_HEX = [0xdc2626, 0x16a34a, 0xeab308, 0x2563eb];
export const FINAL = 56;
export const YARD = -1;

/** The 52 squares of the shared loop, clockwise, beginning at red's start square. */
export const TRACK: Cell[] = [
  [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
  [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],
  [7, 0], [8, 0],
  [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
  [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6],
  [14, 7], [14, 8],
  [13, 8], [12, 8], [11, 8], [10, 8], [9, 8],
  [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14],
  [7, 14], [6, 14],
  [6, 13], [6, 12], [6, 11], [6, 10], [6, 9],
  [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  [0, 7], [0, 6],
];

/** Index on TRACK of each colour's start square. */
export const START_INDEX = [0, 13, 26, 39];
/** Start squares and the star squares are safe. */
export const SAFE_INDEX = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

export const HOME_COLUMN: Cell[][] = [
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
];
export const HOME_CENTER: Cell[] = [[6, 7], [7, 6], [8, 7], [7, 8]];

/** Where the four tokens of each colour wait in their yard (half-cell coordinates). */
export const YARD_SLOTS: Cell[][] = [
  [[1.5, 1.5], [3.5, 1.5], [1.5, 3.5], [3.5, 3.5]],
  [[10.5, 1.5], [12.5, 1.5], [10.5, 3.5], [12.5, 3.5]],
  [[10.5, 10.5], [12.5, 10.5], [10.5, 12.5], [12.5, 12.5]],
  [[1.5, 10.5], [3.5, 10.5], [1.5, 12.5], [3.5, 12.5]],
];

/** Tokens per colour: `tokens[colour][i]` is the progress `r` of token i. */
export type Tokens = number[][];

export function newTokens(): Tokens {
  return [0, 1, 2, 3].map(() => [YARD, YARD, YARD, YARD]);
}

/** Index on the shared loop for a token on the loop, or -1 in the yard / home column / home. */
export function trackIndex(color: number, r: number): number {
  return r >= 0 && r <= 50 ? (START_INDEX[color] + r) % 52 : -1;
}

/** Grid cell for a token on the board (not in the yard). */
export function cellOf(color: number, r: number): Cell {
  if (r <= 50) return TRACK[(START_INDEX[color] + r) % 52];
  if (r < FINAL) return HOME_COLUMN[color][r - 51];
  return HOME_CENTER[color];
}

export function isSafe(color: number, r: number): boolean {
  const idx = trackIndex(color, r);
  return idx >= 0 && SAFE_INDEX.has(idx);
}

export type Capture = { color: number; token: number };
export type MoveOption = { token: number; from: number; to: number; captures: Capture[] };

/** The legal move (if any) for one token with one die value. */
export function moveFor(tokens: Tokens, color: number, token: number, die: number): MoveOption | null {
  const from = tokens[color][token];
  let to: number;
  if (from === YARD) {
    if (die !== 6) return null;
    to = 0;
  } else {
    to = from + die;
    if (to > FINAL) return null; // exact roll needed to finish
  }
  const captures: Capture[] = [];
  const idx = trackIndex(color, to);
  if (idx >= 0 && !SAFE_INDEX.has(idx)) {
    for (let o = 0; o < 4; o++) {
      if (o === color) continue;
      tokens[o].forEach((ro, ot) => {
        if (trackIndex(o, ro) === idx) captures.push({ color: o, token: ot });
      });
    }
  }
  return { token, from, to, captures };
}

/** Every legal move for a die value. */
export function legalMoves(tokens: Tokens, color: number, die: number): MoveOption[] {
  const out: MoveOption[] = [];
  for (let t = 0; t < 4; t++) {
    const m = moveFor(tokens, color, t, die);
    if (m) out.push(m);
  }
  return out;
}

/** Returns new tokens after a move. Captured tokens return to their yards. */
export function applyMove(tokens: Tokens, color: number, m: MoveOption): Tokens {
  const next = tokens.map((row) => row.slice());
  next[color][m.token] = m.to;
  for (const c of m.captures) next[c.color][c.token] = YARD;
  return next;
}

export function hasWon(tokens: Tokens, color: number): boolean {
  return tokens[color].every((r) => r === FINAL);
}

export function homeCount(tokens: Tokens, color: number): number {
  return tokens[color].filter((r) => r === FINAL).length;
}

/** A single turn can have at most this many rolls in a row (a 6 earns another roll). */
export const MAX_ROLLS_PER_TURN = 3;

/** True when the dice just rolled earn the player another roll. */
export function earnsBonus(values: number[]): boolean {
  return values.includes(6);
}

/** How exposed a square is: opponent tokens 1–6 squares behind it could land on it. */
function danger(tokens: Tokens, color: number, r: number): number {
  const idx = trackIndex(color, r);
  if (idx < 0 || SAFE_INDEX.has(idx)) return 0;
  let n = 0;
  for (let o = 0; o < 4; o++) {
    if (o === color) continue;
    for (const ro of tokens[o]) {
      const oi = trackIndex(o, ro);
      if (oi < 0) continue;
      const gap = (idx - oi + 52) % 52;
      if (gap >= 1 && gap <= 6) n++;
    }
  }
  return n;
}

export type Choice = { die: number; move: MoveOption };

/**
 * Computer player: picks the best (die, token) pair. Prefers captures and finishing, then leaving the yard,
 * then safe squares, and avoids landing where an opponent could easily hit it. `dice[i]` is null if used.
 */
export function chooseMove(tokens: Tokens, color: number, dice: (number | null)[], random: () => number = Math.random): Choice | null {
  let best: Choice | null = null;
  let bestScore = -Infinity;
  dice.forEach((value, die) => {
    if (value === null) return;
    for (const m of legalMoves(tokens, color, value)) {
      let score = m.to * 0.1 + random() * 0.5;
      score += m.captures.length * 60;
      for (const c of m.captures) score += tokens[c.color][c.token] * 0.4;
      if (m.to === FINAL) score += 50;
      if (m.from === YARD) score += 35;
      if (m.to > 50 && m.to < FINAL) score += 18; // into the home column: safe from capture
      if (isSafe(color, m.to)) score += 12;
      score -= danger(tokens, color, m.to) * 16;
      score += danger(tokens, color, m.from) * 10; // moving a threatened token away is good
      if (score > bestScore) {
        bestScore = score;
        best = { die, move: m };
      }
    }
  });
  return best;
}

/** All legal (die, move) pairs for the unused dice. */
export function allChoices(tokens: Tokens, color: number, dice: (number | null)[]): Choice[] {
  const out: Choice[] = [];
  dice.forEach((value, die) => {
    if (value === null) return;
    for (const move of legalMoves(tokens, color, value)) out.push({ die, move });
  });
  return out;
}

/** Colours taking part, in turn order, for a given number of seats. */
export function seatColors(players: number): number[] {
  if (players <= 2) return [0, 2]; // opposite corners
  if (players === 3) return [0, 1, 2];
  return [0, 1, 2, 3];
}
