/** Checks that every game's text is readable on its background. Run with: npm test */
import assert from "node:assert/strict";
import { contrastRatio } from "../src/ui/colorMath";
import { PALETTES } from "../src/ui/palettes";

let passed = 0;
const check = (name: string, fn: () => void): void => {
  fn();
  passed++;
  console.log(`PASS  ${name}`);
};

const REQUIRED = [
  "menu", "batman", "flappy", "dodger", "breaker", "stack", "snake", "whack", "memory", "catch", "math", "words", "quiz", "clock", "world",
  "fractions", "operator", "shapes", "solar", "pattern", "odd", "simon", "slide", "sudoku", "robot", "checkers", "chess", "ludo", "snakes",
];

check("every game has a palette", () => {
  for (const key of REQUIRED) assert.ok(PALETTES[key], `palette for ${key}`);
});

check("text is readable on both ends of every background (at least 4.5:1)", () => {
  for (const [key, p] of Object.entries(PALETTES)) {
    assert.ok(contrastRatio(p.ink, p.top) >= 4.5, `${key}: ink on top ${contrastRatio(p.ink, p.top).toFixed(2)}`);
    assert.ok(contrastRatio(p.ink, p.bottom) >= 4.5, `${key}: ink on bottom ${contrastRatio(p.ink, p.bottom).toFixed(2)}`);
  }
});

check("each accent stands out from its background", () => {
  for (const [key, p] of Object.entries(PALETTES)) {
    assert.ok(p.accent !== p.top && p.accent !== p.bottom, `${key} accent differs`);
    assert.ok(contrastRatio(p.accent, p.bottom) >= 2, `${key}: accent on bottom ${contrastRatio(p.accent, p.bottom).toFixed(2)}`);
  }
});

console.log(`\n${passed} palette checks passed.`);
