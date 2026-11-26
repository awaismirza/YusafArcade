# Chess Pieces Redraw Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 3D chess pieces instantly recognisable and clearly visible on an iPad, as step 1 of the Soft Glass overhaul.

**Architecture:** Move piece construction out of `ChessScene.ts` into a pure-three.js module (`pieces3d.ts`) with cached geometry, an outline, a soft contact shadow and an exported palette, so it can be unit-tested in Node. The scene then uses it, with a lower exposure, a lower camera and higher-contrast board colours.

**Tech Stack:** TypeScript, three.js (Lathe/Extrude geometry, no textures), Phaser 3 scene, esbuild-bundled Node tests (`npm test`), Playwright (global) for screenshots.

**Spec:** `docs/superpowers/specs/2026-11-26-soft-glass-overhaul-design.md` (section "Chess pieces (step 1)")

## Global Constraints

- iPad first, touch only; targets at least 44 px; WebGL must degrade (existing fallback stays) (`AGENTS.md`).
- GPU budget: offscreen render stays 1152 × 648; no post-processing; no shadow map larger than 1024.
- No downloaded or licensed assets; all pieces are procedural.
- Pure logic and geometry builders import no Phaser and no DOM (`document`/`canvas`), so they run in Node.
- Pieces about 10 to 15 per cent bigger than the current ones (use scale 1.12, baked into geometry).
- Ivory is a warm off-white that still shades (not blown out); ebony has a visible warm sheen.
- `npm run build` and `npm test` pass before each commit.
- Pushing to `main` or deploying happens only when the owner asks.

## Review Focus

1. **Tapping the new pieces.** The soft shadow disc and the outline must never swallow a tap meant for the square or piece beneath. Test: shadow disc ignores rays; outline meshes carry no `userData.square`.
2. **Knights face the right way.** A knight should look towards the opponent's side, for both colours. Test: head extent along z is negative for white and positive for black.
3. **iPad load.** A full starting position must stay cheap to draw. Test: summed vertex count for the 32 starting pieces is at most 150,000, and two pawns share one geometry.
4. **Promotion.** A pawn that becomes any of Q/R/B/N still builds a complete piece for both colours. Test: all 12 piece and colour combinations build with no NaN vertices.
5. **Pieces readable on both square colours.** Test: ivory and ebony contrast against light and dark squares meets the thresholds in Task 1.

---

### Task 1: Piece builder module, palette and contrast helper

**Files:**
- Create: `src/ui/colorMath.ts`
- Create: `src/games/chess/pieces3d.ts`
- Test: `tests/chess-pieces.test.ts`

**Interfaces:**
- Produces (`src/ui/colorMath.ts`): `export function contrastRatio(a: number, b: number): number`, the WCAG contrast ratio between two 0xRRGGBB colours (relative luminance from sRGB; result 1 to 21).
- Produces (`pieces3d.ts`):
  - `export const PIECE_SCALE = 1.12`
  - `export const CHESS_PALETTE: { ivory: number; ebony: number; lightSquare: number; darkSquare: number; plinth: number; outline: number }`
  - `export type ChessMaterials = { white: THREE.Material; black: THREE.Material; outline: THREE.Material; shadow: THREE.Material }`
  - `export function makeChessMaterials(): ChessMaterials`
  - `export function buildChessPiece(p: Piece, mats: ChessMaterials): THREE.Group` where `Piece` is from `./rules`. The group's origin sits on the square's top surface, the piece stands on y = 0, its footprint is centred on x = z = 0, and `group.scale` stays 1 (scale is baked into geometry). Geometry is cached per piece type and shared between pieces of both colours.

- [ ] **Step 1: Write the failing tests** in `tests/chess-pieces.test.ts` (same `check(name, fn)` style as `tests/ludo-rules.test.ts`; import `contrastRatio` and the module above):
  - `"heights rank pawn < rook < knight < bishop < queen < king"` using `Box3.setFromObject` on the group's non-outline, non-shadow meshes, and `king height >= 1.5 * pawn height`.
  - `"every piece fits inside one square"`: width and depth at most 0.9 for all six types.
  - `"the knight is a real shape, not a block"`: its main mesh vertex count is above 500.
  - `"pieces have an outline"`: each group has at least one mesh whose material `side === THREE.BackSide`.
  - `"the shadow disc ignores taps"`: the mesh with `userData.role === "shadow"` returns zero hits from `new THREE.Raycaster(new THREE.Vector3(0, 5, 0), new THREE.Vector3(0, -1, 0)).intersectObject(shadow)`; and no child mesh has `userData.square` set.
  - `"knights look towards the opponent"`: for a white knight the head (vertices above y = 0.7) have mean z below 0; for a black knight, above 0 (world space after `updateMatrixWorld`).
  - `"all 12 piece and colour combinations build"` with finite vertex positions (no NaN).
  - `"the starting position is cheap to draw"`: summed vertex counts of the 32 starting pieces at most 150000, and two pawns' main meshes share the same `geometry` instance.
  - `"palette contrast"`: `contrastRatio(ivory, darkSquare) >= 3`, `contrastRatio(ebony, lightSquare) >= 3`, `contrastRatio(ivory, lightSquare) >= 1.5`, `contrastRatio(ebony, darkSquare) >= 1.8`, `contrastRatio(lightSquare, darkSquare) >= 2.5`.
- [ ] **Step 2: Run to verify failure.** Run: `npm test -- chess-pieces`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `contrastRatio`** in `src/ui/colorMath.ts` using the standard WCAG formula.
- [ ] **Step 4: Implement `pieces3d.ts`.** Staunton-style profiles per spec: base ring, waist, collar and distinct heads. Pawn: ball head. Rook: crenellated top and a slight taper. Bishop: mitre with slit and tip. Queen: crown of points and a small orb. King: larger crown and a cross. Knight: a smooth bevelled extruded head with neck, mane, ear and an eye, on a turned base; head faces -z for white and +z for black. Use `LatheGeometry` (at least 48 segments) for turned parts. Palette values (starting points, tune only if the contrast tests need it): `ivory 0xf1e6cf`, `ebony 0x2b2420`, `lightSquare 0xd9b684`, `darkSquare 0x7a4a2b`, `plinth 0x4a2c14`, `outline 0x2a1a0e`. Outline = a second mesh per part, `BackSide`, scaled about 3 per cent. Soft contact shadow = three stacked `CircleGeometry` discs with falling opacity, `userData.role = "shadow"`, `raycast` replaced by a no-op, lying just above y = 0.
- [ ] **Step 5: Run tests.** Run: `npm test -- chess-pieces`. Expected: all checks PASS.
- [ ] **Step 6: Commit.** `git add src/ui/colorMath.ts src/games/chess/pieces3d.ts tests/chess-pieces.test.ts && git commit -m "Add Staunton-style chess piece builder with palette and tests"`

---

### Task 2: Use the new pieces in the scene, tune light, camera and board

**Files:**
- Modify: `src/ui/threeStage.ts` (add optional `exposure?: number` to `StageOptions`, default 1.05, applied to `renderer.toneMappingExposure`)
- Modify: `src/scenes/ChessScene.ts` (remove the local `PROFILES` and `buildPiece`; use the new module)
- Modify: `src/games/shared/board8.ts` only if the colours need a new field
- Create: `scripts/shot.cjs`

**Interfaces:**
- Consumes: `buildChessPiece`, `makeChessMaterials`, `CHESS_PALETTE` from Task 1.
- Produces: `scripts/shot.cjs`, a screenshot driver for later steps: `node scripts/shot.cjs <out.png> [--ipad] "<x,y,waitMs>" ...`. It opens `http://localhost:4173/YusafArcade/`, performs each tap in game coordinates (960 × 540; `x < 0` means wait only), saves the PNG, prints `errors: [...]` for page errors and console errors other than 404s. With `--ipad` it uses Playwright's `iPad Pro 11 landscape` device and `touchscreen.tap`, mapping game coordinates to the scaled canvas.

- [ ] **Step 1: Create `scripts/shot.cjs`** to the interface above (it requires Playwright, which is installed globally in this environment).
- [ ] **Step 2: Baseline.** Run: `npm run build && (npx vite preview --port 4173 --strictPort &) ; node scripts/shot.cjs /tmp/chess-before.png "780,104,400" "480,208,900" "180,330,3000"`. Expected: `errors: []`; keep the image for comparison.
- [ ] **Step 3: Replace `buildPiece` in `ChessScene.ts`** with `buildChessPiece(p, this.mats)`, where `this.mats` is `makeChessMaterials()`; pass `{ light: CHESS_PALETTE.lightSquare, dark: CHESS_PALETTE.darkSquare, plinth: CHESS_PALETTE.plinth }` to `buildBoard8`; create the stage with `exposure: 0.85` and a backdrop that separates from both the plinth and the black pieces (`backdrop: ["#33407a", "#0b0f24"]` as a starting point, judged from the screenshot); lower the camera by constructing `new BoardCamera(stage.camera, 9.8, 11.2)`. The capture animation that scales a piece down must still work (it sets `group.scale`), so keep `userData.pieceSquare` on the group.
- [ ] **Step 4: Verify.** Run: `npm run build && npm test`. Expected: build OK, all test files pass. Then run: `node scripts/shot.cjs /tmp/chess-after.png "780,104,400" "480,208,900" "180,330,3000"` and view both images. Expected: `errors: []`; whole board in frame including the near edge; the six piece types distinguishable at a glance; white pieces shaded rather than flat; black pieces clearly visible on both square colours. If the board is cropped, adjust the two `BoardCamera` numbers and rerun.
- [ ] **Step 5: Play check.** Run: `node scripts/shot.cjs /tmp/chess-play.png "780,104,400" "480,208,900" "180,330,2500" "<tap a pawn>" "<tap its target>"` choosing coordinates from the after-image; Expected: the piece moves, `errors: []`, and the knight faces forward.
- [ ] **Step 6: iPad check.** Run the same first three taps with `--ipad`. Expected: `errors: []` and the same framing.
- [ ] **Step 7: Commit.** `git add -A && git commit -m "Use redrawn chess pieces; tune exposure, camera and board contrast"`

---

### Task 3: Docs and hand-off

**Files:**
- Modify: `docs/SPEC.md` (remove the "knights look blocky" known limit; note the piece module in the 3D building blocks table)
- Modify: `AGENTS.md` (verification step 3 mentions `scripts/shot.cjs --ipad`)

- [ ] **Step 1: Update both docs** as above.
- [ ] **Step 2: Run** `npm run build && npm test`. Expected: both succeed.
- [ ] **Step 3: Commit and push the branch only.** `git add -A && git commit -m "Docs: chess pieces and screenshot script" && git push origin claude/gracious-knuth-zc7you`
- [ ] **Step 4: Report** to the owner with the before and after screenshots, what could not be checked (no real iPad), and ask whether to continue to step 2 (shared Soft Glass look) or deploy this first.
