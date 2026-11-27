/** Heights of the bars above and below the game, in CSS px. */
export const CHROME_TOP = 64;
export const CHROME_BOTTOM = 56;

/** True when a screen of w x h CSS px leaves enough room around the 16:9 game for both bars. */
export function chromeFits(w: number, h: number): boolean {
  return h - (w * 9) / 16 >= CHROME_TOP + CHROME_BOTTOM;
}
