/**
 * Soft Glass design tokens. Pure data, no Phaser, so tests can check contrast.
 * Colours are 0xRRGGBB numbers (Phaser's format); fonts are bundled with the site (@fontsource/nunito).
 */

/** Rounded Nunito first, then emoji and system fonts so every device has something sensible. */
export const FONT = "Nunito, 'Apple Color Emoji', 'Segoe UI Emoji', system-ui, sans-serif";

export const INK = {
  /** Text on light glass. */
  dark: 0x2b2250,
  /** Text on dark or saturated colour. */
  light: 0xffffff,
};

/** Frosted-glass panel look. The canvas layer can't blur what's behind, so glass is translucent fill plus a light edge. */
export const GLASS = {
  fill: 0xffffff,
  fillAlpha: 0.2,
  edgeAlpha: 0.55,
  shadowAlpha: 0.22,
  radius: 18,
};

/** Named accents for buttons and cards. All carry white text with at least 3:1 contrast (see tests/theme.test.ts). */
export const ACCENT: Record<string, number> = {
  blue: 0x2563eb,
  indigo: 0x4f46e5,
  purple: 0x7c3aed,
  pink: 0xbe185d,
  red: 0xdc2626,
  orange: 0xc2410c,
  amber: 0xb45309,
  green: 0x15803d,
  teal: 0x0f766e,
  slate: 0x475569,
};

/** Animation timings in milliseconds. */
export const MOTION = { press: 90, spring: 220, fade: 180 };

/** Lightens (f > 0) or darkens (f < 0) a colour by mixing towards white or black. f is -1 to 1. */
export function shade(color: number, f: number): number {
  const target = f >= 0 ? 255 : 0;
  const k = Math.abs(f);
  const mix = (c: number): number => Math.round(c + (target - c) * k);
  return (mix((color >> 16) & 255) << 16) | (mix((color >> 8) & 255) << 8) | mix(color & 255);
}
