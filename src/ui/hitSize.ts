/** Smallest touch area in game pixels: 44 CSS px at the smallest phone scale we measured (0.63, iPhone 13 landscape). */
export const MIN_HIT = 70;

/** The touch-area size for a control drawn at w x h: never smaller than MIN_HIT either way. */
export function hitSize(w: number, h: number): { w: number; h: number } {
  return { w: Math.max(w, MIN_HIT), h: Math.max(h, MIN_HIT) };
}
