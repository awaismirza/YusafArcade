/** Heights of the bars above and below the game, in CSS px. */
export const CHROME_TOP = 64;
export const CHROME_BOTTOM = 56;
/** Narrowest and widest sidebar to the right of the game (phones in landscape), in CSS px. */
export const SIDE_MIN = 130;
export const SIDE_MAX = 220;

/** True when a screen of w x h CSS px leaves enough room around the 16:9 game for both bars. */
export function chromeFits(w: number, h: number): boolean {
  return h - (w * 9) / 16 >= CHROME_TOP + CHROME_BOTTOM;
}

export type ChromeLayout = { kind: "bars" } | { kind: "side"; width: number } | null;

/**
 * Where the board-game labels and buttons go: bars above and below the game on tall screens (iPads), a sidebar on
 * the right on wide ones (phones in landscape), or nowhere (16:9 screens keep them on the game).
 */
export function chromeLayout(w: number, h: number): ChromeLayout {
  if (chromeFits(w, h)) return { kind: "bars" };
  const spare = w - (h * 16) / 9;
  if (spare >= SIDE_MIN) return { kind: "side", width: Math.round(Math.min(SIDE_MAX, spare)) };
  return null;
}
