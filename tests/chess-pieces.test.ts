/** Checks for the 3D chess piece builder: shapes, sizes, tap safety, cost and colour contrast. Run with: npm test */
import assert from "node:assert/strict";
import * as THREE from "three";
import { contrastRatio } from "../src/ui/colorMath";
import { buildChessPiece, CHESS_PALETTE, makeChessMaterials } from "../src/games/chess/pieces3d";
import type { Color, PieceType } from "../src/games/chess/rules";

let passed = 0;
const check = (name: string, fn: () => void): void => {
  fn();
  passed++;
  console.log(`PASS  ${name}`);
};

const TYPES: PieceType[] = ["p", "r", "n", "b", "q", "k"];
const mats = makeChessMaterials();
const build = (t: PieceType, c: Color = "w"): THREE.Group => buildChessPiece({ t, c }, mats);

const meshesOf = (g: THREE.Group): THREE.Mesh[] => {
  const out: THREE.Mesh[] = [];
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) out.push(o);
  });
  return out;
};
const isOutline = (m: THREE.Mesh): boolean => (m.material as THREE.Material).side === THREE.BackSide;
const isShadow = (m: THREE.Mesh): boolean => m.userData.role === "shadow";
const bodies = (g: THREE.Group): THREE.Mesh[] => meshesOf(g).filter((m) => !isOutline(m) && !isShadow(m));

function size(g: THREE.Group): THREE.Vector3 {
  g.updateMatrixWorld(true);
  const box = new THREE.Box3();
  for (const m of bodies(g)) box.expandByObject(m);
  return box.getSize(new THREE.Vector3());
}

check("heights rank pawn < rook < knight < bishop < queen < king", () => {
  const h = Object.fromEntries(TYPES.map((t) => [t, size(build(t)).y])) as Record<PieceType, number>;
  assert.ok(h.p < h.r, "pawn < rook");
  assert.ok(h.r < h.n, "rook < knight");
  assert.ok(h.n < h.b, "knight < bishop");
  assert.ok(h.b < h.q, "bishop < queen");
  assert.ok(h.q < h.k, "queen < king");
  assert.ok(h.k >= 1.5 * h.p, "king at least 1.5x a pawn");
});

check("every piece fits inside one square", () => {
  for (const t of TYPES) {
    const s = size(build(t));
    assert.ok(s.x <= 0.9 && s.z <= 0.9, `${t}: ${s.x.toFixed(2)} x ${s.z.toFixed(2)}`);
  }
});

check("the knight is a real shape, not a block", () => {
  const verts = bodies(build("n")).reduce((n, m) => n + m.geometry.attributes.position.count, 0);
  assert.ok(verts > 500, `knight has ${verts} vertices`);
});

check("pieces have an outline", () => {
  for (const t of TYPES) assert.ok(meshesOf(build(t)).some(isOutline), `${t} has an outline mesh`);
});

check("the shadow disc ignores taps and nothing steals the square id", () => {
  const g = build("q");
  const shadow = meshesOf(g).find(isShadow);
  assert.ok(shadow, "has a shadow disc");
  g.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 5, 0), new THREE.Vector3(0, -1, 0));
  assert.equal(ray.intersectObject(shadow!).length, 0, "ray passes through the shadow");
  for (const m of meshesOf(g)) assert.equal(m.userData.square, undefined, "no child claims a board square");
});

check("knights look towards the opponent", () => {
  const meanHeadZ = (c: Color): number => {
    const g = build("n", c);
    g.updateMatrixWorld(true);
    let sum = 0;
    let n = 0;
    const v = new THREE.Vector3();
    for (const m of bodies(g)) {
      const pos = m.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        if (v.y > 0.7) {
          sum += v.z;
          n++;
        }
      }
    }
    return sum / n;
  };
  assert.ok(meanHeadZ("w") < -0.02, "white knight looks towards -z (black's side)");
  assert.ok(meanHeadZ("b") > 0.02, "black knight looks towards +z (white's side)");
});

check("all 12 piece and colour combinations build with finite geometry", () => {
  for (const t of TYPES) {
    for (const c of ["w", "b"] as Color[]) {
      const g = build(t, c);
      assert.ok(bodies(g).length > 0, `${c}${t} has a body`);
      for (const m of meshesOf(g)) {
        const arr = m.geometry.attributes.position.array;
        for (let i = 0; i < arr.length; i++) assert.ok(Number.isFinite(arr[i]), `${c}${t} vertex ${i}`);
      }
    }
  }
});

check("the starting position is cheap to draw and shares geometry", () => {
  const order: PieceType[] = ["r", "n", "b", "q", "k", "b", "n", "r"];
  let verts = 0;
  for (const c of ["w", "b"] as Color[]) {
    for (const t of [...order, ...Array(8).fill("p")] as PieceType[]) {
      for (const m of meshesOf(build(t, c))) verts += m.geometry.attributes.position.count;
    }
  }
  assert.ok(verts <= 150000, `${verts} vertices for the 32 starting pieces`);
  assert.equal(bodies(build("p"))[0].geometry, bodies(build("p", "b"))[0].geometry, "pawns share one geometry");
});

check("palette contrast keeps pieces readable on both square colours", () => {
  const P = CHESS_PALETTE;
  assert.ok(contrastRatio(P.ivory, P.darkSquare) >= 3, "ivory on dark squares");
  assert.ok(contrastRatio(P.ebony, P.lightSquare) >= 3, "ebony on light squares");
  assert.ok(contrastRatio(P.ivory, P.lightSquare) >= 1.5, "ivory on light squares");
  assert.ok(contrastRatio(P.ebony, P.darkSquare) >= 1.8, "ebony on dark squares");
  assert.ok(contrastRatio(P.lightSquare, P.darkSquare) >= 2.5, "light squares against dark squares");
});

console.log(`\n${passed} chess piece checks passed.`);
