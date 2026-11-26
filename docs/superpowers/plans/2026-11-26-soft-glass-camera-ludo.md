# Soft Glass Look, Board-Game Cameras and 3D Ludo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every game the shared Soft Glass look, add two-finger camera gestures and a camera-view button to all four board games, and make Ludo's board and effects properly 3D.

**Architecture:** Pure, tested modules hold the maths (orbit camera rig, gesture maths, theme contrast). Phaser-side modules (glass drawing helpers, gesture tracker, camera button) sit on top and are reused by every board game. The shared UI kit (`arcadeKit.ts`, `Hud`, menu) is restyled once, which restyles almost every game, plus a soft backdrop added through `addMenuButton` (which nearly every scene already calls).

**Tech Stack:** TypeScript, Phaser 3 (canvas UI), three.js (offscreen 3D), `@fontsource/nunito` (bundled font), esbuild-run Node tests (`npm test`), Playwright (global) via `scripts/shot.cjs`.

**Spec:** `docs/superpowers/specs/2026-11-26-soft-glass-overhaul-design.md` (steps 2 and 3)

## Global Constraints

- Mobile browsers only: iPad and phones in landscape; browser game; desktop is not a target (`AGENTS.md`).
- Touch targets at least 44 px on screen; no hover-only UI; one finger still just plays (select and move).
- Glass is faked (translucent gradient panels, light edge strokes, soft shadows); no backdrop blur in the canvas layer.
- Fonts ship with the site (`@fontsource/nunito`); game must still start if the font fails to load within 1500 ms.
- Offscreen 3D render stays 1152 × 648; no post-processing; shadow maps at most 1024.
- Multiplayer is local only; pass-and-play keeps turning the board to the player to move.
- Pure logic imports no Phaser and no DOM so it runs in Node tests.
- `npm run build` and `npm test` pass before each commit. One push to `main` at the very end (owner's instruction).

## Review Focus

1. **Gestures must not play moves.** Putting a second finger down, or dragging, must never select or move a piece. Test: `isTap` is false when a second pointer joined, when the finger moved more than 14 game px, or when it was held longer than 400 ms.
2. **The camera cannot get lost.** Pitch between 20° and 85°, zoom within 0.6× to 1.5× of the default, never NaN, never below the board. Test: extreme twist, tilt and pinch inputs keep the rig inside those bounds.
3. **Pass-and-play keeps the player's chosen angle.** Flipping the seat turns the camera by 180° and keeps the player's own offset. Test: `setBaseYaw` keeps `yawOffset`.
4. **A slow or failed font load never blocks the game.** Test: `withTimeout` resolves with the fallback after the limit and passes through a fast result.
5. **Answer buttons still recolour.** The learning games colour right and wrong answers through `Btn.rect.setFillStyle`; the new button must still honour it. Verified by a screenshot after tapping an answer in a learning game.

---

### Task 1: Orbit camera rig and gesture maths

**Files:**
- Create: `src/games/shared/orbitRig.ts`
- Create: `src/ui/gestureMath.ts`
- Test: `tests/orbit-rig.test.ts`

**Interfaces:**
- Produces (`gestureMath.ts`): `pinchScale(d0: number, d1: number): number` (d1/d0, 1 when d0 is 0), `twistDelta(a0: number, a1: number): number` (shortest signed angle in (-π, π]), `tiltDelta(dyGamePx: number): number` (radians, `-dy * 0.006`, so dragging up raises the camera), `isTap(t: { downMs: number; upMs: number; moved: number; multi: boolean }): boolean` (true only if `!multi`, `moved <= 14`, `upMs - downMs <= 400`), `withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T>`.
- Produces (`orbitRig.ts`): `type ViewPreset = "reset" | "top" | "side" | "left" | "right"`; `class OrbitRig { constructor(camera: THREE.PerspectiveCamera, cfg: { target: THREE.Vector3; distance: number; elevationDeg: number }); setBaseYaw(rad: number): void; applyPreset(p: ViewPreset): void; pinch(scale: number): void; twist(rad: number): void; tilt(rad: number): void; update(): void; readonly yawOffset: number; readonly elevation: number; readonly distance: number }`. `update()` eases the camera toward its goals each frame and points it at `target`.
- Bounds: elevation 20° to 85°; distance 0.6× to 1.5× of `cfg.distance`. Presets (relative to the base yaw): `reset` = default; `top` = elevation 80°; `side` = elevation 30°, distance × 0.85; `left` = yaw offset -40°; `right` = yaw offset +40° (both at default elevation).

- [ ] **Step 1: Write failing tests** in `tests/orbit-rig.test.ts` (same `check` style as other tests): `pinchScale`, `twistDelta` wraps (3.0 → -3.0 gives a small positive delta), `tiltDelta` sign, `isTap` four cases (quick tap true; multi true→false; moved 20→false; held 500 ms→false), `withTimeout` (fast value passes; slow promise returns fallback), rig default position matches `distance`/`elevationDeg` after `update()` run 200 times, extreme `tilt(10)`/`tilt(-10)`/`pinch(100)`/`pinch(0.001)`/`twist(1000)` stay within bounds with finite camera position and `camera.position.y > 0`, `applyPreset("top")` converges to 80°, `left`/`right` offsets, `setBaseYaw(Math.PI)` keeps `yawOffset` and the camera ends at z < 0.
- [ ] **Step 2: Run** `npm test -- orbit-rig`. Expected: FAIL (modules not found).
- [ ] **Step 3: Implement both modules** to the interfaces above (smoothing: exponential, factor about 0.12 per `update()`).
- [ ] **Step 4: Run** `npm test -- orbit-rig`. Expected: all PASS.
- [ ] **Step 5: Commit** `git add -A && git commit -m "Add orbit camera rig and gesture maths with tests"`

---

### Task 2: Soft Glass theme, bundled font and drawing helpers

**Files:**
- Modify: `package.json` (dependency `@fontsource/nunito`), `src/main.ts` (load font before creating the game, with `withTimeout`)
- Create: `src/ui/theme.ts`, `src/ui/glass.ts`
- Test: `tests/theme.test.ts`

**Interfaces:**
- Consumes: `withTimeout` (Task 1), `contrastRatio` from `src/ui/colorMath.ts`.
- Produces (`theme.ts`): `export const FONT: string` (Nunito stack with system fallbacks), `export const INK = { dark: 0x2b2250, light: 0xffffff }`, `export const GLASS = { fill: 0xffffff, fillAlpha: 0.2, edgeAlpha: 0.55, shadowAlpha: 0.22, radius: 18 }`, `export const ACCENT: Record<string, number>` (named accent colours reused by games), `export const MOTION = { press: 90, spring: 220 }`.
- Produces (`glass.ts`, Phaser): `export function drawGlass(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, opts?: { radius?: number; tint?: number; alpha?: number }): void` (rounded translucent panel with light edge and soft shadow, centred on x, y); `export function drawPill(g, x, y, w, h, color: number, opts?: { pressed?: boolean; lip?: boolean }): void` (filled rounded button body with top highlight and darker lip); `export function addSoftBackdrop(scene: Phaser.Scene): void` (full-screen gradient wash plus three faint circles at depth -100, idempotent per scene).

- [ ] **Step 1: Failing tests** in `tests/theme.test.ts`: `contrastRatio(INK.dark, 0xf3eeff) >= 7` (dark text on light glass); `contrastRatio(INK.light, ACCENT[name]) >= 3` for every named accent that carries white button text (large bold text threshold).
- [ ] **Step 2: Run** `npm test -- theme`. Expected: FAIL.
- [ ] **Step 3: Install and wire the font.** `npm install @fontsource/nunito`; import weights 600, 700 and 800 (`@fontsource/nunito/latin-<w>.css`) in `main.ts`; before `new Phaser.Game`, await `withTimeout(Promise.all([document.fonts.load("600 16px Nunito"), document.fonts.load("700 16px Nunito"), document.fonts.load("800 16px Nunito")]), 1500, undefined)`.
- [ ] **Step 4: Implement `theme.ts` and `glass.ts`.** Pick accent colours that pass the test; adjust until it passes.
- [ ] **Step 5: Run** `npm test -- theme && npm run build`. Expected: PASS and a clean build.
- [ ] **Step 6: Commit** `git add -A && git commit -m "Add Soft Glass theme, bundled Nunito font and glass drawing helpers"`

---

### Task 3: Restyle the shared UI kit, HUD, menu and HTML bars

**Files:**
- Modify: `src/ui/arcadeKit.ts`, `src/ui/hud.ts`, `src/ui/endGameButtons.ts`, `src/scenes/MenuScene.ts`, `index.html`

**Interfaces:**
- Consumes: `FONT`, `INK`, `GLASS`, `ACCENT`, `MOTION`, `drawGlass`, `drawPill`, `addSoftBackdrop` (Task 2).
- Produces: `arcadeKit.ts` keeps every existing export and signature (`makeButton`, `showLevelPicker`, `showModePicker`, `showGameOver`, `addMenuButton`, `addMovePads`, `addDPad`, `getBest`, `saveBest`, `FONT`, `Btn`), with one change: `Btn.rect` becomes `{ setFillStyle(color: number, alpha?: number): Btn["rect"] }` (a tiny interface), so `choiceBoard.ts` keeps working. `FONT` is re-exported from `theme.ts`.

- [ ] **Step 1: Restyle `makeButton`** to a rounded gradient pill with top highlight, darker lip and a press spring (`MOTION.press`); `rect.setFillStyle` redraws the pill in the new colour. Keep the hit area at least 44 px high on screen.
- [ ] **Step 2: Restyle** `addMenuButton` (glass pill with a small back chevron), `showLevelPicker`, `showModePicker` (glass card on a soft scrim, rounded option buttons, titles in `INK.light` on a darkened scrim, never below 16 px), `showGameOver` and `addEndGameButtons`, `addMovePads`, `addDPad` (glass discs). `addMenuButton` also calls `addSoftBackdrop(scene)`.
- [ ] **Step 3: Restyle `Hud`** pills with `drawGlass` (translucent white-tinted gradient, light edge) while keeping text readable (white text on a dark-tinted glass, or dark text on light glass, whichever passes contrast).
- [ ] **Step 4: Restyle `MenuScene`** (soft gradient background, tab pills with a clear selected state, game cards as rounded gradient glass-topped cards with the game title in Nunito 800, emoji kept) and `index.html` (page background gradient, `#end-bar`/`#flap-bar`/`#touch` buttons as rounded gradient pills with a pressed state, font stack Nunito then system).
- [ ] **Step 5: Verify.** `npm run build && npm test`; then `node scripts/shot.cjs /tmp/menu.png --phone "-1,0,1500"`, `... "780,104,400"` for the Board Games tab, and a learning game answer tap (Learn tab → Math Rocket → Easy → tap an answer) with `--ipad`. Expected: `errors: []`; text readable; right and wrong answers still change colour.
- [ ] **Step 6: Commit** `git add -A && git commit -m "Restyle shared UI, HUD, menu and HTML bars in Soft Glass"`

---

### Task 4: Gesture tracker, camera button and the four board games

**Files:**
- Create: `src/ui/gestures.ts` (Phaser two-finger tracker), `src/ui/cameraButton.ts`
- Modify: `src/games/shared/board8.ts` (replace `BoardCamera` with an `OrbitRig`-based camera), `src/scenes/ChessScene.ts`, `src/scenes/CheckersScene.ts`, `src/scenes/LudoScene.ts`, `src/scenes/SnakesScene.ts`

**Interfaces:**
- Consumes: `OrbitRig`, `ViewPreset` and the gesture maths (Task 1); glass helpers (Task 2).
- Produces (`gestures.ts`): `class BoardGestures { constructor(scene: Phaser.Scene, h: { onPinch(scale: number): void; onTwist(rad: number): void; onTilt(rad: number): void; onTap(x: number, y: number): void }); destroy(): void }`. Two fingers down: pinch, twist and midpoint-vertical drag call the handlers with per-frame deltas, and any tap in progress is cancelled. A single finger produces `onTap` on pointer-up only if `isTap` holds.
- Produces (`cameraButton.ts`): `export function addCameraButton(scene: Phaser.Scene, rig: OrbitRig): void` places a glass "View" button below the Menu button (touch height at least 44 px on screen) that opens a list of five presets (Top down, My side, Left corner, Right corner, Reset) and closes on choice.
- Produces (`board8.ts`): `BoardCamera` keeps its `flipped` field and `update()`, now backed by an `OrbitRig` (`BoardCamera` gains `rig: OrbitRig`), so Chess and Checkers keep working; flipping calls `rig.setBaseYaw(flipped ? Math.PI : 0)`.

- [ ] **Step 1: Implement `gestures.ts`** with Phaser pointers (`this.input.pointer1`, `pointer2`); implement `cameraButton.ts`.
- [ ] **Step 2: Rebuild `BoardCamera` on `OrbitRig`** (chess default: elevation about 41°, distance about 14.9, target (0, 0.5, 0.35); same framing as today).
- [ ] **Step 3: Wire Chess and Checkers:** replace their `POINTER_DOWN` handlers with `BoardGestures.onTap`; pinch, twist and tilt drive `camCtl.rig`; add the camera button.
- [ ] **Step 4: Wire Ludo and Snakes:** give each an `OrbitRig` with their current camera as the default (Ludo about 59° elevation; Snakes about 57°), replace their `POINTER_DOWN` handlers and static camera with the rig, add the camera button. In Ludo/Snakes the turn does not flip the board.
- [ ] **Step 5: Verify gestures.** Using Playwright's CDP touch emulation (`Input.dispatchTouchEvent`) in a throwaway script, send a two-finger pinch-out and a twist on Chess; expected: screenshots before and after differ (board larger and turned) and no piece moved (HUD still says "White starts."). Tap the View button and choose "Top down" in each of the four games with `--phone`; expected: view changes, `errors: []`.
- [ ] **Step 6: Run** `npm run build && npm test`. Expected: pass.
- [ ] **Step 7: Commit** `git add -A && git commit -m "Add two-finger camera gestures and a view button to all board games"`

---

### Task 5: Make Ludo properly 3D

**Files:**
- Modify: `src/games/ludo/board3d.ts`, `src/scenes/LudoScene.ts`

**Interfaces:**
- Consumes: `OrbitRig` wiring from Task 4; `AnimQueue` from `src/ui/animQueue.ts`.
- Produces: no new exports needed outside these files; `buildLudoBoard()` keeps its signature and return type.

- [ ] **Step 1: Board relief.** Raised, rounded track tiles (`RoundedBoxGeometry`), raised yard trays with a chunky rim and dished token nests, embossed gold 3D stars, a thicker bevelled frame, and a four-faced centre pyramid in the four colours with a gold finial. Soft Glass pastel palette that keeps the four colours easy to tell apart.
- [ ] **Step 2: Piece effects in `LudoScene`.** Squash-and-stretch when a token lands; a confetti burst of small coloured spheres when a token reaches home; a ring pulse when a token is captured; a soft pulse on a colour's start square when it is that colour's turn. All built from `AnimQueue`; none may change game rules.
- [ ] **Step 3: Verify.** `npm run build && npm test`; screenshot Ludo at default and at "Top down" and "My side" with `--phone` and `--ipad`; play a roll and a token move. Expected: `errors: []`; visibly raised board; tokens, dice and effects still readable.
- [ ] **Step 4: Commit** `git add -A && git commit -m "Give Ludo a raised 3D board and landing, home and capture effects"`

---

### Task 6: Docs, full check and the single push

**Files:**
- Modify: `docs/SPEC.md` (camera controls, theme, Ludo), `README.md` (one line)

- [ ] **Step 1: Update docs** (camera controls table: pinch, twist, tilt, View button presets; Soft Glass tokens live in `src/ui/theme.ts`).
- [ ] **Step 2: Full check.** `npm run build && npm test`; `--ipad` and `--phone` screenshots of the menu, Chess, Checkers, Ludo and Snakes & Ladders, plus one arcade game (Flappy Bird) and one learning game; expected `errors: []` for each.
- [ ] **Step 3: Commit** the docs, then **push once**: `git push origin claude/gracious-knuth-zc7you && git push origin claude/gracious-knuth-zc7you:main`. Expected: both succeed.
- [ ] **Step 4: Report** what changed, what could not be verified (no real iPad or phone), and rulings made.
