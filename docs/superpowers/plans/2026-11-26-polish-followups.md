# Polish Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the six gaps left after the Soft Glass pass: richer question generators, 150+ easy quiz questions, Chess/Checkers capture and check effects, 3D win confetti, 44 px touch targets on phones, and a more forgiving tap on the 3D boards.

**Architecture:** Question generators move out of scenes into pure, Phaser-free modules under `src/games/rounds/` (and `src/games/robot/levels.ts`) so node tests can run hundreds of random rounds and check each is valid and has exactly one right answer; scenes only render the returned data. 3D effects move from `LudoScene` into one shared module, `src/games/shared/burst3d.ts`, used by all four board games. Touch targets get a pure `hitSize` helper plus a headless audit script that measures every interactive object at phone size.

**Tech Stack:** TypeScript, Phaser 3.90, three.js, Vite; custom test runner `npm test [-- filter]` (esbuild-bundled `tests/*.test.ts`); screenshot driver `node scripts/shot.cjs`.

**Spec:** `docs/superpowers/specs/2026-11-26-soft-glass-overhaul-design.md`; earlier plan `docs/superpowers/plans/2026-11-26-all-games-modern-look-and-questions.md` (its Task 6 Steps 1–2 and Task 7 Steps 4–5 are what this plan finishes). Repo rules: `AGENTS.md`, `docs/SPEC.md`.

## Global Constraints

- Mobile browsers only (iPad and phones in landscape); touch-first; tap targets at least 44 px on screen (the game is 960×540 scaled to fit, so on an iPhone landscape viewport 44 px is about 62 game px).
- Local pass-and-play only; no networking; no `alert`/`confirm`/`prompt`.
- Ages 7 to 10. Easy is age 7, Challenge is age 10.
- Generator modules import nothing from Phaser, three.js or the DOM, so `npm test` can run them.
- `npm run build` and `npm test` must pass before each commit; each game touched must run on `node scripts/shot.cjs … --phone` with `errors: []`.
- Commit with the trailer lines the harness gives (Co-Authored-By and Claude-Session). One push at the end: `git push origin claude/gracious-knuth-zc7you && git push origin claude/gracious-knuth-zc7you:main`.

## Review Focus

- A question with two right answers (equivalent fractions among the options, two operators giving the same result, two word-problem options equal): every generator test checks that exactly one option equals the answer.
- Negative, zero or non-whole answers in a maths question for a 7-year-old: tests assert answers are whole numbers within stated ranges.
- Long text overflowing its box (word problems, long fraction text): word problems are capped at 70 characters and a test asserts it.
- A Robot level that cannot be solved in the allowed number of commands: a breadth-first search in the test proves every generated level is solvable within `maxCmds`.
- A larger hit zone swallowing taps meant for a neighbour (Menu above View, Hint/Back/Skip in a row): the audit script reports overlapping zones larger than 4 game px and Task 5 resolves them.
- 3D effect pieces left in the scene after Restart or Menu (memory and visual leaks): effect meshes are removed in `done`, and a test counts scene children before and after an effect finishes.
- A long press that was really the start of an orbit drag selecting a square: the tap rule still requires almost no movement.

---

### Task 1: Fractions and Operator generators

**Files:**
- Create: `src/games/rounds/types.ts`, `src/games/rounds/rng.ts`, `src/games/rounds/fractions.ts`, `src/games/rounds/operator.ts`
- Modify: `src/scenes/FractionsScene.ts` (`makeRound`), `src/scenes/OperatorScene.ts` (`makeRound`, `twoStep`)
- Test: `tests/rounds-fractions-operator.test.ts`

**Interfaces:**
- Produces (`types.ts`): `type Rng = () => number; type RoundData = { prompt: string; options: string[]; correct: number; explain: string; visual?: { kind: "pizza"; k: number; n: number } | { kind: "text"; text: string }; cols: number; w: number; fontSize: number }`.
- Produces (`rng.ts`): `int(rng: Rng, a: number, b: number): number` (inclusive), `pickOf<T>(rng: Rng, xs: readonly T[]): T`, `shuffled<T>(rng: Rng, xs: readonly T[]): T[]`, `withCorrect(rng: Rng, correct: string, wrong: string[]): { options: string[]; correct: number }` (de-duplicates, drops any wrong equal to correct, takes 3 wrong for 4 options).
- Produces (`fractions.ts`): `fractionRound(tier: 0 | 1, rng: Rng): RoundData`. Existing kinds move over unchanged (name the shaded fraction, equivalent, which is bigger). New kinds: `addSame` ("1/5 + 2/5 = ?", same denominator, sum below 1 for tier 0 and up to improper like 7/5 for tier 1), `simplify` ("Simplest form of 4/8?", tier 1 only), `ofNumber` ("1/4 of 20 = ?", answers whole). Equivalent-fraction options must not contain a second fraction equal in value to the answer.
- Produces (`operator.ts`): `operatorRound(tier: 0 | 1, rng: Rng): RoundData`. Existing kinds (missing sign, two-step signs) move over. New kinds: `missingNumber` ("7 × □ = 56", tier 0 uses + − ×, tier 1 adds ÷), `compare` ("Which is bigger: 6 × 4 or 5 + 18?", two options, never equal), `brackets` ("(3 + 4) × 2 = □", tier 1 only, answer at most 150).

- [ ] **Step 1: Write failing tests** in `tests/rounds-fractions-operator.test.ts` (same style as `tests/palettes.test.ts`: `assert`, a `check(name, fn)` helper, final pass count). Use a seeded rng `mulberry32(seed)`. For each tier and 500 seeds assert: `options.length` is 2 or 4; options are all distinct; `0 <= correct < options.length`; `explain` and `prompt` non-empty and at most 70 characters for `prompt`. Fractions: parse the prompt for the new kinds and recompute (for `addSame` the correct option equals the sum as `a/n`; for `ofNumber` the correct option equals `n / d * k`; for `simplify` the correct option's numerator and denominator are coprime and equal in value to the prompt fraction); for equivalent-fraction rounds assert no wrong option has the same value as the answer (cross-multiply). Operator: for `missingNumber` and `brackets` re-evaluate the equation with the correct option and assert it holds; for `compare` evaluate both sides and assert the correct option is the larger. Also assert each new kind appears at least once across the 500 seeds for the tiers it belongs to (kinds are identifiable by prompt text; list the prompt prefixes in the test).
- [ ] **Step 2: Run** `npm test -- rounds-fractions` and confirm it fails (modules missing).
- [ ] **Step 3: Implement** `types.ts`, `rng.ts`, `fractions.ts`, `operator.ts` as specified. The maths helpers `gcd`, `apply`, `applyTwo` move from the scenes into these modules.
- [ ] **Step 4: Wire the scenes.** `FractionsScene.makeRound(tier)` calls `fractionRound(tier, Math.random)` and maps `visual` (`pizza` → existing `drawPizza(k, n)`, `text` → existing `bigText`) into `Round.visual`. `OperatorScene.makeRound(tier)` calls `operatorRound` and renders `visual.text` with its `eq()` helper. Delete the moved code from both scenes.
- [ ] **Step 5: Run** `npm run build && npm test`. Expected: all pass. Run `node scripts/shot.cjs /tmp/f.png --phone "378,104,500" "790,326,1200" "270,328,1500"` for Fractions and the same with `"170,438,1200"` as the tile tap for Operator (Learn tab: Fractions is row 2 right, Operator is row 3 left). Expected: `errors: []`.
- [ ] **Step 6: Commit** `git add -A && git commit -m "Fractions and Operator: pure generators with new question kinds"`.

---

### Task 2: Pattern and Math generators

**Files:**
- Create: `src/games/rounds/pattern.ts`, `src/games/rounds/mathWords.ts`
- Modify: `src/scenes/PatternScene.ts` (move `numberSequence`, `shapeSequence`), `src/scenes/MathScene.ts` (`makeQuestion`)
- Test: `tests/rounds-pattern-math.test.ts`

**Interfaces:**
- Consumes: `Rng`, `int`, `pickOf`, `shuffled` from `src/games/rounds/rng.ts` (Task 1).
- Produces (`pattern.ts`): `type Seq = { terms: number[]; rule: string }`; `numberSequence(tier: 0 | 1, rng: Rng): Seq` returning six terms. Keep every existing rule and add: `alternating` (two interleaved sequences, e.g. 1, 10, 2, 20, 3, 30 — rule "Two patterns take turns"), `halving` (64, 32, 16, 8, 4, 2 — "Halve each time", tier 1), `addThenSubtract` (+5, −2 repeating — tier 1), `countDownBy` (tier 0: 50, 45, 40 … "Count down by 5s"). `shapeSequence(tier: 0 | 1, rng: Rng): { items: string[]; unit: string[] }` gains the repeating units `"AAB"` (already tier 0), `"ABBC"` and `"ABCC"` (tier 1); every unit must repeat cleanly so the 8th item is fixed by the first seven.
- Produces (`mathWords.ts`): `type Q = { text: string; answer: number }`; `mathQuestion(level: number, rng: Rng): Q` for levels 1–6 (existing generators move over unchanged). New: `wordProblem(level: number, rng: Rng): Q` with kinds `change` (money: "You pay 50 for a 35 toy. How much change?"), `groups` ("4 bags with 6 apples each. How many apples?"), `share` ("24 sweets shared equally by 4 friends. How many each?"), `minutes` ("How many minutes are in 3 hours?", hours 2 to 5 only), `perimeter` ("A square has sides of 7. What is its perimeter?"). `mathQuestion` returns a word problem with probability 0.3 for levels 2 to 6 and never for level 1. Word-problem text is at most 70 characters; answers are whole numbers from 1 to 200.
- Consumes in scene: MathScene already calls `makeQuestion(level)` and shows `text` in `qText`; replace the call with `mathQuestion(this.level, Math.random)`. `qText` must wrap: set `wordWrap: { width: 820 }` and `align: "center"` so a 70-character problem fits two lines.

- [ ] **Step 1: Write failing tests.** For every tier (Pattern) and level 1–6 (Math), 500 seeds: Pattern terms length 6, all integers, terms positive, `rule` non-empty; recompute the sixth term from the rule family for the new kinds (e.g. halving: `terms[5] * 2 === terms[4]`; alternating: odd positions step by 1, even positions step by 10) and assert the sixth term matches. Shape sequences: `items.length === 8`, `items[i] === unit[i % unit.length]`, and the 8th item is derivable only from the unit (assert `unit.length <= 4`). Math: `answer` is a whole number at least 0; each word-problem kind appears across 500 seeds at levels 2–6; `text.length <= 70`; for `change`, `groups`, `share` and `perimeter` parse the numbers out of the text with the regex in the test and recompute the answer.
- [ ] **Step 2: Run** `npm test -- rounds-pattern` and confirm it fails.
- [ ] **Step 3: Implement** both modules and update `PatternScene` (`numberSequence(this.tier, Math.random)`, `shapeSequence(this.tier, Math.random)`; the scene keeps its distractor logic, which already guarantees four distinct options) and `MathScene`.
- [ ] **Step 4: Run** `npm run build && npm test`; screenshot Pattern and Math (`--phone`, Learn tab Math is row 1 left, Puzzles tab Pattern is row 1 left), checking the long word-problem text sits inside the screen. Expected: `errors: []`.
- [ ] **Step 5: Commit** `git add -A && git commit -m "Pattern and Math: pure generators, new rules and word problems"`.

---

### Task 3: Shapes (more shapes and solids) and Robot (12 levels)

**Files:**
- Create: `src/games/rounds/shapes.ts`, `src/games/robot/levels.ts`
- Modify: `src/scenes/ShapesScene.ts`, `src/scenes/RobotScene.ts` (`nextLevel`, `LEVELS`)
- Test: `tests/rounds-shapes.test.ts`, `tests/robot-levels.test.ts`

**Interfaces:**
- Produces (`shapes.ts`): `SHAPE_NAMES_2D: string[]` (existing 13 plus `Nonagon` (9 sides), `Oval`, `Semicircle`, `Cross`, giving 17) and `SOLIDS: Record<string, { faces: number; edges: number; vertices: number; fact: string }>` with `Cube {6,12,8}`, `Cuboid {6,12,8}`, `Pyramid (square base) {5,8,5}`, `Triangular prism {5,9,6}`, `Cylinder {3,2,0}`, `Cone {2,1,1}`, `Sphere {1,0,0}`; `shapeRound(tier: 0 | 1, rng: Rng): RoundData & { drawing: { kind: "flat" | "solid"; name: string } }`. Kinds: name the shape (existing), count the sides (existing), and new `solidName` (tier 0 uses Cube, Sphere, Cone, Cylinder, Pyramid; tier 1 uses all solids), `solidFaces` ("How many faces does a cube have?", tier 1, options drawn from true counts of other solids plus offsets, all distinct).
- Consumes in scene: `ShapesScene.drawShape(name)` gains a `solid` branch that draws each solid with Phaser Graphics in the same 480,178 area (cube: front square, top parallelogram, side parallelogram in three shades; sphere: filled circle with a lighter off-centre highlight; cone: triangle plus ellipse base; cylinder: rectangle with two ellipses; pyramid: triangle with a lighter side triangle; prisms and cuboids: same technique as the cube). Existing flat shapes keep their drawing; add point lists for `Nonagon` (`regular(9, 62)`), `Oval` (ellipse via `g.strokeEllipse`/`fillEllipse`), `Semicircle` (arc), `Cross` (12-point polygon).
- Produces (`levels.ts`): `type Pt = { x: number; y: number }; type Level = { start: Pt; goal: Pt; walls: string[]; maxCmds: number; shortest: number }` (wall keys are `"x,y"`); `makeLevel(tier: 0 | 1, level: number, size: number, rng: Rng): Level` for levels 1 to 12; `shortestPath(size: number, walls: ReadonlySet<string>, start: Pt, goal: Pt): number` (breadth-first, returns -1 if unreachable). Rules: the route length is `min(10, 2 + level)` for tier 0 and `min(11, 4 + level)` for tier 1 (the existing self-avoiding walk, moved over), walls never sit on the walk, wall count is `2 + level` (tier 0) or `5 + level * 2` capped at `size*size - routeLength - 2` (tier 1), and `maxCmds = min(12, shortest + (tier === 0 ? 4 : 3))`. Levels 6 to 12 add tighter limits: from level 7 `maxCmds = min(12, shortest + 2)`.
- Consumes in scene: `RobotScene` keeps its drawing and program logic; `LEVELS` becomes 12 (level picker text "Reach the star in 12 levels"), `nextLevel` calls `makeLevel(this.tier, this.level, this.size, Math.random)` and copies the fields into `start`, `goal`, `walls` (as a `Set`), `maxCmds`, `pathLen`.

- [ ] **Step 1: Write failing tests.** `tests/rounds-shapes.test.ts`: over 500 seeds per tier, options distinct, one correct, `drawing.name` exists in `SHAPE_NAMES_2D` or `SOLIDS`; for `solidFaces` the correct option equals `SOLIDS[name].faces`; assert `SHAPE_NAMES_2D.length >= 17` and `Object.keys(SOLIDS).length >= 7`; Euler check `faces - edges + vertices === 2` for every solid except Cylinder, Cone and Sphere. `tests/robot-levels.test.ts`: for tiers 0 and 1, levels 1–12, sizes 5 and 6, 200 seeds each: `shortestPath(...) === level.shortest`, `shortest >= 1`, `maxCmds >= shortest`, `maxCmds <= 12`, start and goal are not walls, walls are inside the grid, and `level.walls` contains no duplicates.
- [ ] **Step 2: Run** `npm test -- rounds-shapes robot-levels` (run each name separately: `npm test -- rounds-shapes` then `npm test -- robot-levels`) and confirm both fail.
- [ ] **Step 3: Implement** `shapes.ts` and `levels.ts` as specified, then update `ShapesScene` (render from `shapeRound`, add drawing code) and `RobotScene` (use `makeLevel`, `LEVELS = 12`).
- [ ] **Step 4: Run** `npm run build && npm test`; screenshot Shapes on `--phone` several times with different seeds by repeating the run until one solid is shown (a solid appears in roughly one round in six at Challenge, so press Next until one shows), and Robot Challenge level 1. Expected: shapes look like their names, `errors: []`.
- [ ] **Step 5: Commit** `git add -A && git commit -m "Shapes: more shapes and 3D solids; Robot: 12 levels with solvability tests"`.

---

### Task 4: Quiz easy to 150

**Files:**
- Modify: `src/data/quizEasyBank.ts`, `tests/questions.test.ts`

**Interfaces:**
- Consumes: `QA = [emoji, question, correct, [w1, w2, w3], fact]` from `src/data/quizEasyBank.ts`; validators already enforced by `tests/questions.test.ts`.

- [ ] **Step 1: Raise the test minimum** in `tests/questions.test.ts` from `QUIZ_EASY.length >= 140` to `>= 150`. Run `npm test -- questions` and confirm it fails with `quiz easy 141`.
- [ ] **Step 2: Add at least 12 new age-7 questions** at the end of `EASY_MORE`, none repeating an existing prompt (the duplicate test enforces it). Use these questions and correct answers, with three plausible wrong answers and a one-sentence fact each: "Which festival is called the festival of lights?" Diwali; "Which festival ends the month of fasting for Muslims?" Eid; "What do we call the first meal of the day?" Breakfast; "Which animal is known as man's best friend?" Dog; "Which colour do you get by mixing red and white?" Pink; "What is the opposite of hot?" Cold; "Which planet is the closest to the Sun?" Mercury; "How many wheels does a bicycle have?" 2; "What do we call a house made of snow and ice?" Igloo; "Which season comes after winter?" Spring; "What is the name of the biggest mammal in the sea?" Blue whale; "Which animal can change colour to hide?" Chameleon. Check each for exactly one correct answer.
- [ ] **Step 3: Run** `npm test -- questions`. Expected: PASS and `node scripts/audit-questions.mjs` prints `Quiz easy: 153` or more.
- [ ] **Step 4: Commit** `git add -A && git commit -m "Quiz: easy bank to 150+"`.

---

### Task 5: 44 px touch targets on phones

**Files:**
- Create: `src/ui/hitSize.ts`, `scripts/audit-targets.cjs`
- Modify: `src/ui/arcadeKit.ts` (`makeButton` zone line 107, `addMenuButton` zone line 24, `addMovePads` zones lines 217 and 256), `src/main.ts` (debug handle), possibly the scenes the audit names
- Test: `tests/hit-size.test.ts`

**Interfaces:**
- Produces (`hitSize.ts`): `export const MIN_HIT = 62;` (44 CSS px at the smallest supported phone scale of 0.72) and `export function hitSize(w: number, h: number): { w: number; h: number }` returning `{ w: Math.max(w, MIN_HIT), h: Math.max(h, MIN_HIT) }`.
- Produces (`main.ts`): when the page URL contains `?debug=1`, `window.__yusaf = game` (the `Phaser.Game`); otherwise nothing is exposed.
- Produces (`audit-targets.cjs`): `node scripts/audit-targets.cjs --phone` visits the Menu and every game's start screen (same tap sequence as `scripts/shot.cjs`, opening `http://localhost:4173/YusafArcade/?debug=1`), then for each active scene lists every input-enabled object whose on-screen size (bounds × canvas scale) is below 44 px in either direction, and every pair of input-enabled objects whose rectangles overlap by more than 4 game px. It prints `scene  label  widthPx x heightPx` rows and ends with `targets below 44px: N` and `overlaps: M`; exit code 1 when either count is not 0.

- [ ] **Step 1: Write failing tests** in `tests/hit-size.test.ts`: `hitSize(128, 52)` equals `{ w: 128, h: 62 }`; `hitSize(40, 40)` equals `{ w: 62, h: 62 }`; `hitSize(170, 76)` is unchanged.
- [ ] **Step 2: Run** `npm test -- hit-size` and confirm it fails.
- [ ] **Step 3: Implement** `hitSize.ts`; use it for the interactive zone (not the drawn pill) in `makeButton`, `addMenuButton` and `addMovePads`, so the look stays the same and only the touch area grows.
- [ ] **Step 4: Add the `?debug=1` handle** in `src/main.ts` after `new Phaser.Game`, and write `scripts/audit-targets.cjs` as described.
- [ ] **Step 5: Run the audit** with the preview server up (`npx vite preview --port 4173 --strictPort`): `node scripts/audit-targets.cjs --phone`. Fix every row it lists: enlarge the zone with `hitSize` where the object is a custom zone (Word letter tiles, Sudoku number pad, Robot command slots and arrows, Hint/Back/Skip row, ChoiceBoard buttons), or move the lower of two overlapping buttons (Menu above View in the board games: move View down by the overlap) until the audit prints `targets below 44px: 0` and `overlaps: 0`. Cells that are display-only (Sudoku grid, Robot grid) are not targets unless they are interactive; a Sudoku cell is interactive and must be at least 44 px: on a phone the 6×6 grid cell is 68 × 0.72 = 49 px, which passes.
- [ ] **Step 6: Run** `npm run build && npm test`; re-run the audit for `--ipad` as well. Expected: both print zero.
- [ ] **Step 7: Commit** `git add -A && git commit -m "Touch targets: 44 px hit zones and a target audit script"`.

---

### Task 6: More forgiving board taps

**Files:**
- Modify: `src/ui/gestureMath.ts` (`isTap`), `tests/orbit-rig.test.ts`

**Interfaces:**
- Produces: `isTap(t: { downMs: number; upMs: number; moved: number; multi: boolean }): boolean` is true when `!multi && moved <= 14 && upMs - downMs <= 900`. The 400 ms cap becomes 900 ms; the movement and second-finger rules are unchanged. Board taps still register on release because an orbit drag must be told apart from a tap; buttons already register on press.

- [ ] **Step 1: Write failing tests** in `tests/orbit-rig.test.ts` next to the existing `isTap` checks: a touch held 800 ms with `moved: 3` is a tap; held 1000 ms is not; held 100 ms with `moved: 20` is not (a drag); held 100 ms with `multi: true` is not. Keep the existing assertions that still hold and update any that assumed 400 ms.
- [ ] **Step 2: Run** `npm test -- orbit` and confirm it fails.
- [ ] **Step 3: Change the constant** in `isTap`.
- [ ] **Step 4: Run** `npm test`; on `--ipad` open Chess, press-and-hold a white pawn for about 700 ms with a short one-off Playwright script (`scripts/shot.cjs` cannot hold a touch): dispatch `pointerdown` on the canvas at the pawn, wait 700 ms, dispatch `pointerup`. Expected: the pawn is selected (green dots appear). Record this check in the commit message.
- [ ] **Step 5: Commit** `git add -A && git commit -m "Board taps: allow presses up to 900 ms"`.

---

### Task 7: 3D effects: capture sparkles, check pulse and 3D win confetti

**Files:**
- Create: `src/games/shared/burst3d.ts`
- Modify: `src/scenes/LudoScene.ts` (replace `burst` and `pulseRing` bodies with calls), `src/scenes/ChessScene.ts`, `src/scenes/CheckersScene.ts`, `src/scenes/SnakesScene.ts`, `src/ui/fx.ts` (remove `winBurst` once unused)
- Test: `tests/burst3d.test.ts`

**Interfaces:**
- Produces (`burst3d.ts`): `type Fx = { add(now: number, a: { dur: number; update: (p: number) => void; done?: () => void }): void }` (matches `AnimQueue.add`); `burst3d(scene: THREE.Scene, fx: Fx, now: number, at: THREE.Vector3, opts?: { count?: number; colors?: number[]; speed?: number; up?: number; dur?: number }): void` (the Ludo `burst` code generalised; defaults count 22, speed 1.2 to 3, up 2.6 to 4.6, dur 1100); `ringPulse3d(scene: THREE.Scene, fx: Fx, now: number, at: THREE.Vector3, color: number, opts?: { radius?: number; dur?: number; repeat?: number }): void` (the Ludo `pulseRing` code; `repeat` runs it that many times back to back for the check pulse); `confettiRain3d(scene: THREE.Scene, fx: Fx, now: number, center: THREE.Vector3, colors: number[]): void` (80 flat quads falling from y = center.y + 6 over an 8 by 8 area with spin, 2200 ms, removed at the end).
- Consumes: `ThreeStage.scene` and the scene's `AnimQueue` (`this.queue`, `src/ui/animQueue.ts`); square world positions: Chess uses its `sqX(i)`, `sqZ(i)` helpers with y = `TOP_Y` from `src/games/shared/board8.ts` (0.1); Checkers uses `cellX(col)`, `cellZ(row)` from the same file.

- [ ] **Step 1: Write failing tests** in `tests/burst3d.test.ts` with a fake `Fx` that stores actions and a real `THREE.Scene`: after `burst3d(scene, fx, 0, new THREE.Vector3(), { count: 10 })` the scene has 10 more children; running `update(0.5)` moves them and `update(1)` then `done()` returns the child count to its starting value; same for `ringPulse3d` (1 child during, 0 after) and `confettiRain3d` (80 during, 0 after); calling `done()` twice does not throw.
- [ ] **Step 2: Run** `npm test -- burst3d` and confirm it fails.
- [ ] **Step 3: Implement** `burst3d.ts` by moving the existing geometry and material disposal from `LudoScene.burst` and `LudoScene.pulseRing` (lines 482 to 540), and make `LudoScene` call the shared functions with identical visuals (same colours, counts, durations).
- [ ] **Step 4: Chess effects.** In `ChessScene`'s move animation where a captured piece shrinks (around line 236), call `burst3d` at the captured square with `count: 10`, white and gold colours and `speed: 0.8`. In `refreshMarkers` the king in check currently gets a static red tile; when a move leaves the side to move in check, also call `ringPulse3d(..., 0xdc2626, { radius: 0.6, repeat: 3 })` at the king's square once per move (not on every refresh, so track it in `afterMove`). Do the same capture burst in `CheckersScene.makeMove` for each square in `m.caps` (use `cellX`/`cellZ` and the piece colour).
- [ ] **Step 5: 3D win confetti.** Replace the `winBurst(this)` calls in Chess, Checkers and Snakes, and Ludo's win, with `confettiRain3d(stage.scene, this.queue, this.time.now, new THREE.Vector3(0, 0, 0), [0xfacc15, 0xff7ab8, 0x60a5fa, 0x34d399, 0xffffff])`. Skip it when `this.stage` is null (WebGL fallback) and keep the 2D `winBurst` only for that fallback path. Remove `winBurst` from `src/ui/fx.ts` if nothing else uses it.
- [ ] **Step 6: Verify.** `npm run build && npm test`; on `--ipad` play Chess to a capture (e2e4, d7d5, e4d5 by tapping squares) and screenshot 200 ms after the capture; Checkers one capture likewise (use `scripts/shot.cjs` steps with game coordinates of the squares from a first screenshot). Expected: sparkles visible at the captured square, `errors: []`. For the win confetti, add a `?debug=1` helper only if needed: otherwise call `window.__yusaf.scene.getScene("Chess").finish("checkmate")` from `page.evaluate` in a one-off script (the debug handle from Task 5) and screenshot. Expected: coloured pieces falling over the board, game-over card appears, `errors: []`, and after pressing Restart the stage has no leftover children (check `stage.scene.children.length` equals its value at game start).
- [ ] **Step 7: Commit** `git add -A && git commit -m "Board games: 3D capture sparkles, check pulse and win confetti"`.

---

### Task 8: Docs, full check and the single push

**Files:** `docs/SPEC.md`

- [ ] **Step 1: Update `docs/SPEC.md`.** Remove the "Known limits" bullets for capture sparkles, 2D confetti and ungenerated question kinds; add `src/games/rounds/`, `src/games/robot/levels.ts`, `src/games/shared/burst3d.ts`, `src/ui/hitSize.ts` and `scripts/audit-targets.cjs` to the shared-building-blocks section; note the 44 px rule is enforced by the audit script and the `?debug=1` handle.
- [ ] **Step 2: Full check.** `npm run build && npm test`; `node scripts/audit-targets.cjs --phone` and `--ipad` print zero; open every game once with the loop used before (4 tabs, tiles at x = 170/480/790, rows y = 214/326/438, Easy at 270,328) on `--phone` and the board games on `--ipad`. Expected: `errors: []` for all 28.
- [ ] **Step 3: Commit and push** `git add -A && git commit -m "Update spec after polish follow-ups"`, then `git push origin claude/gracious-knuth-zc7you && git push origin claude/gracious-knuth-zc7you:main`.
- [ ] **Step 4: Report** what changed, anything not verified (no real device), and any deferred items.
