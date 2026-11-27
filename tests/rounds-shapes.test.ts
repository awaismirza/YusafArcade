/** Shape Detective question generator. Run with: npm test */
import assert from "node:assert/strict";
import { mulberry32 } from "../src/arena/kit/math";
import { SHAPE_NAMES_2D, shapeRound, SOLIDS } from "../src/games/rounds/shapes";

let passed = 0;
const check = (name: string, fn: () => void): void => {
  fn();
  passed++;
  console.log(`PASS  ${name}`);
};

check("there are at least 17 flat shapes and 7 solids, and the solids' counts are right", () => {
  assert.ok(SHAPE_NAMES_2D.length >= 17, `${SHAPE_NAMES_2D.length} shapes`);
  assert.ok(Object.keys(SOLIDS).length >= 7);
  for (const [name, s] of Object.entries(SOLIDS)) {
    if (["Cylinder", "Cone", "Sphere"].includes(name)) continue;
    assert.equal(s.faces - s.edges + s.vertices, 2, `${name} breaks Euler's rule`);
  }
  assert.deepEqual(SOLIDS.Cube, { ...SOLIDS.Cube, faces: 6, edges: 12, vertices: 8 });
});

check("shape rounds have one right answer, a known drawing, and solids appear", () => {
  for (const tier of [0, 1] as const) {
    let solids = 0;
    let facesQ = 0;
    for (let seed = 1; seed <= 500; seed++) {
      const r = shapeRound(tier, mulberry32(seed));
      assert.equal(new Set(r.options).size, r.options.length, `repeated option ${r.options}`);
      assert.ok(r.options.length >= 2 && r.correct >= 0 && r.correct < r.options.length);
      const known = r.drawing.kind === "flat" ? SHAPE_NAMES_2D.includes(r.drawing.name) : r.drawing.name in SOLIDS;
      assert.ok(known, `unknown drawing ${r.drawing.kind} ${r.drawing.name}`);
      if (r.drawing.kind === "solid") solids++;
      if (/^How many faces does/.test(r.prompt)) {
        facesQ++;
        assert.equal(tier, 1);
        assert.equal(r.options[r.correct], String(SOLIDS[r.drawing.name].faces));
      }
      if (r.prompt === "What is the name of this 3D shape?") assert.equal(r.options[r.correct], r.drawing.name);
    }
    assert.ok(solids >= 40, `tier ${tier}: only ${solids} solids in 500 rounds`);
    if (tier === 1) assert.ok(facesQ > 0, "no faces questions at Challenge");
  }
});

console.log(`${passed} shape generator checks passed.`);
