/** Checks that the Soft Glass colours are readable. Run with: npm test */
import assert from "node:assert/strict";
import { contrastRatio } from "../src/ui/colorMath";
import { ACCENT, GLASS, INK } from "../src/ui/theme";

let passed = 0;
const check = (name: string, fn: () => void): void => {
  fn();
  passed++;
  console.log(`PASS  ${name}`);
};

check("dark ink is easy to read on light glass", () => {
  assert.ok(contrastRatio(INK.dark, 0xf3eeff) >= 7, `ratio ${contrastRatio(INK.dark, 0xf3eeff).toFixed(1)}`);
});

check("white button text is readable on every named accent colour", () => {
  for (const [name, color] of Object.entries(ACCENT)) {
    assert.ok(contrastRatio(INK.light, color) >= 3, `${name}: ${contrastRatio(INK.light, color).toFixed(2)}`);
  }
});

check("glass settings are sane", () => {
  assert.ok(GLASS.fillAlpha > 0 && GLASS.fillAlpha < 0.6);
  assert.ok(GLASS.radius >= 12);
});

console.log(`\n${passed} theme checks passed.`);
