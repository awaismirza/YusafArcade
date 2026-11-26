/**
 * One Soft Glass palette per game: a vertical background gradient, the main text colour (`ink`) and an accent.
 * Pure data, so tests can check that text stays readable on every background (see tests/palettes.test.ts).
 */
export type GamePalette = { top: number; bottom: number; ink: number; accent: number };

const WHITE = 0xffffff;
const DARK = 0x1b1640;

export const PALETTES: Record<string, GamePalette> = {
  menu: { top: 0x3b2f8f, bottom: 0x1a1250, ink: WHITE, accent: 0x7c3aed },
  // arcade
  batman: { top: 0x7dd3fc, bottom: 0xdbeafe, ink: DARK, accent: 0x1d4ed8 },
  flappy: { top: 0x4cc3ff, bottom: 0xcdeeff, ink: DARK, accent: 0x16a34a },
  dodger: { top: 0x1b1060, bottom: 0x050218, ink: WHITE, accent: 0xa78bfa },
  breaker: { top: 0x3b0f4d, bottom: 0x14061f, ink: WHITE, accent: 0xf43f5e },
  stack: { top: 0x4338ca, bottom: 0x1e1b4b, ink: WHITE, accent: 0xfbbf24 },
  snake: { top: 0x14532d, bottom: 0x052e16, ink: WHITE, accent: 0x84cc16 },
  whack: { top: 0x4d7c0f, bottom: 0x1a2e05, ink: WHITE, accent: 0xf59e0b },
  memory: { top: 0x3730a3, bottom: 0x1e1b4b, ink: WHITE, accent: 0x22d3ee },
  catch: { top: 0x38bdf8, bottom: 0xbae6fd, ink: 0x0c2a4a, accent: 0xf97316 },
  // learning
  math: { top: 0x1e2a78, bottom: 0x0b1020, ink: WHITE, accent: 0x38bdf8 },
  words: { top: 0x9a3412, bottom: 0x431407, ink: WHITE, accent: 0xfbbf24 },
  quiz: { top: 0x047857, bottom: 0x022c22, ink: WHITE, accent: 0x34d399 },
  clock: { top: 0x0369a1, bottom: 0x0c2d48, ink: WHITE, accent: 0xfbbf24 },
  world: { top: 0x1d4ed8, bottom: 0x172554, ink: WHITE, accent: 0x60a5fa },
  fractions: { top: 0xb91c1c, bottom: 0x450a0a, ink: WHITE, accent: 0xfca5a5 },
  operator: { top: 0x7e22ce, bottom: 0x3b0764, ink: WHITE, accent: 0xe9d5ff },
  shapes: { top: 0x0f766e, bottom: 0x042f2e, ink: WHITE, accent: 0x5eead4 },
  solar: { top: 0x1e3a8a, bottom: 0x02030a, ink: WHITE, accent: 0x93c5fd },
  // puzzles
  pattern: { top: 0x4c1d95, bottom: 0x1e1b4b, ink: WHITE, accent: 0xc4b5fd },
  odd: { top: 0xbe185d, bottom: 0x500724, ink: WHITE, accent: 0xf9a8d4 },
  simon: { top: 0x3730a3, bottom: 0x1e1b4b, ink: WHITE, accent: 0xa5b4fc },
  slide: { top: 0x92400e, bottom: 0x422006, ink: WHITE, accent: 0xfcd34d },
  sudoku: { top: 0x1e40af, bottom: 0x172554, ink: WHITE, accent: 0x93c5fd },
  robot: { top: 0x0f766e, bottom: 0x0f3d3e, ink: WHITE, accent: 0x5eead4 },
  // board games (backdrops behind the 3D board)
  checkers: { top: 0x14532d, bottom: 0x052e16, ink: WHITE, accent: 0x84cc16 },
  chess: { top: 0x33407a, bottom: 0x0b0f24, ink: WHITE, accent: 0xfbbf24 },
  ludo: { top: 0x6d4fd6, bottom: 0x241a63, ink: WHITE, accent: 0xf87171 },
  snakes: { top: 0x065f46, bottom: 0x022c22, ink: WHITE, accent: 0xfbbf24 },
};
