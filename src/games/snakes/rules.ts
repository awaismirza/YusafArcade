/**
 * Snakes and Ladders rules. Pure logic with no Phaser or DOM imports.
 *
 * A 10 × 10 board numbered 1 to 100 in a zig-zag, starting at the bottom-left. A token starts off the board (0),
 * moves forward by the dice total, climbs a ladder if it lands on its foot, and slides down a snake if it lands on
 * its head. Overshooting 100 bounces the token back by the extra amount, so every dice count can finish
 * (with 2 or 3 dice a token on 99 could never roll the exact 1 it would need).
 */

export const FINISH = 100;

/** Ladder foot -> ladder top. */
export const LADDERS: Record<number, number> = { 1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 80: 100 };
/** Snake head -> snake tail. */
export const SNAKES: Record<number, number> = { 16: 6, 47: 26, 49: 11, 56: 53, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 78 };

/** [column, row] of a square on the board, with row 0 at the bottom and column 0 on the left. */
export function cellPos(n: number): [number, number] {
  const row = Math.floor((n - 1) / 10);
  const i = (n - 1) % 10;
  return [row % 2 === 0 ? i : 9 - i, row];
}

export type Jump = "ladder" | "snake" | null;

export type MoveResult = {
  /** Square before the move. */
  from: number;
  /** Every square the token visits, in order (it goes up to 100 and back when it bounces). */
  route: number[];
  /** True when the roll went past 100 and the token bounced back. */
  bounced: boolean;
  /** Square reached by the dice, before any snake or ladder. */
  landing: number;
  /** Final square after any snake or ladder. */
  to: number;
  jump: Jump;
};

/** Plays one dice total from a square. */
export function moveToken(from: number, total: number): MoveResult {
  const route: number[] = [];
  let pos = from;
  let dir = 1;
  for (let i = 0; i < total; i++) {
    if (pos === FINISH) dir = -1; // past the end: turn round
    pos += dir;
    route.push(pos);
  }
  const bounced = dir === -1;
  const landing = pos;
  if (LADDERS[landing] !== undefined) return { from, route, bounced, landing, to: LADDERS[landing], jump: "ladder" };
  if (SNAKES[landing] !== undefined) return { from, route, bounced, landing, to: SNAKES[landing], jump: "snake" };
  return { from, route, bounced, landing, to: landing, jump: null };
}

/** A single die of 6, or a double with two or more dice, earns another roll. */
export function earnsBonus(values: number[]): boolean {
  if (values.length === 1) return values[0] === 6;
  return values.every((v) => v === values[0]);
}

/** A turn can have at most this many rolls in a row. */
export const MAX_ROLLS_PER_TURN = 3;

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/** Colours for up to four players, in turn order: red, green, yellow, blue. */
export function seatColors(players: number): number[] {
  if (players <= 2) return [0, 2];
  if (players === 3) return [0, 1, 2];
  return [0, 1, 2, 3];
}
