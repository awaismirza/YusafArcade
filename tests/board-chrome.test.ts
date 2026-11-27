/** When the board games move their labels into the space around the game. Run with: npm test */
import assert from "node:assert/strict";
import { chromeFits, chromeLayout } from "../src/ui/boardChromeFit";

let passed = 0;
const check = (name: string, fn: () => void): void => {
  fn();
  passed++;
  console.log(`PASS  ${name}`);
};

check("an iPad in landscape has room above and below the 16:9 game", () => {
  assert.equal(chromeFits(1024, 768), true); // iPad 9.7"
  assert.equal(chromeFits(1194, 834), true); // iPad Pro 11"
  assert.equal(chromeFits(1366, 1024), true); // iPad Pro 12.9"
});

check("phones in landscape and 16:9 desktops do not, so the labels stay on the game", () => {
  assert.equal(chromeFits(844, 390), false); // iPhone 13
  assert.equal(chromeFits(1280, 720), false);
  assert.equal(chromeFits(1920, 1080), false);
});

check("phones in landscape get a sidebar on the right; 16:9 screens get nothing", () => {
  assert.deepEqual(chromeLayout(1194, 834), { kind: "bars" });
  assert.equal(chromeLayout(844, 390)?.kind, "side"); // iPhone 13
  assert.equal(chromeLayout(750, 342)?.kind, "side"); // iPhone in Safari with the notch letterboxed
  assert.equal(chromeLayout(915, 412)?.kind, "side"); // Android
  const w = chromeLayout(932, 430);
  assert.ok(w && w.kind === "side" && w.width >= 130 && w.width <= 220);
  assert.equal(chromeLayout(1280, 720), null);
  assert.equal(chromeLayout(1920, 1080), null);
});

console.log(`${passed} board chrome checks passed.`);
