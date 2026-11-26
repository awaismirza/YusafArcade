# All Games: Modern Look and Bigger Question Banks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every game the Soft Glass look (not just the shared chrome), finish the board games' polish, and expand the learning and puzzle games' questions several times over, with tests that keep the content valid.

**Architecture:** A few shared Phaser helpers (score chips, progress bars, tiles, effects, gradient backgrounds, per-game palettes) plus a global hook that gives every scene the soft backdrop and the Nunito font. Games adopt them with small, game-specific edits. Question content moves into data modules with pure validators that tests run over every entry.

**Tech Stack:** TypeScript, Phaser 3, three.js (board games, Solar Explorer), Vite, esbuild-run Node tests (`npm test`), Playwright via `scripts/shot.cjs`.

**Spec:** `docs/superpowers/specs/2026-11-26-soft-glass-overhaul-design.md` (steps 4 and 5 and the board-game polish; see its addendum).

## Global Constraints

- Mobile browsers only: iPad and phones in landscape; browser game; desktop is not a target.
- One finger plays; touch targets stay as large as today; no hover-only UI.
- Soft Glass look: rounded shapes, light edges, soft shadows, Nunito font from `src/ui/theme.ts`; each game keeps its own accent colour so games stay easy to tell apart.
- Text must be readable on its background: at least 4.5:1 for normal text, 3:1 for large bold text (tested in Task 1).
- Ages 7 to 10; Easy and Challenge split stays; multiplayer stays local only.
- Pure logic and data modules import no Phaser and no DOM so Node tests can run them.
- `npm run build` and `npm test` pass before each commit. One push to `main` at the very end.

## Review Focus

1. **Readability on every background.** Every game palette's text colour must contrast enough with both ends of its background. Test: `tests/palettes.test.ts` over all palettes.
2. **Invalid questions.** A question whose right answer also appears among the wrong ones, has duplicate options, or has an empty explanation. Test: validators run over every entry in every bank.
3. **Repeats in one session.** A quiz or word game must not ask the same question twice in a session. Test: `pickRounds` returns unique items, never more than the bank holds, and works when the bank is smaller than the round count.
4. **Gameplay still works after restyling.** Every arcade game must start, accept input and reach game over without errors. Verified by driving each game for a few seconds on iPad and phone emulations.
5. **Effects clean up.** Confetti and pop-ups must remove their objects. Verified by reading the helper and by checking that repeated effects don't slow a game.

---

### Task 1: Shared look helpers, palettes and the global layer

**Files:**
- Create: `src/ui/palettes.ts`, `src/ui/chips.ts`, `src/ui/progress.ts`, `src/ui/tiles.ts`, `src/ui/fx.ts`, `src/ui/background.ts`
- Modify: `src/main.ts` (install the global soft layer), all `src/scenes/*.ts` that use `fontFamily: "system-ui, ..."`
- Test: `tests/palettes.test.ts`

**Interfaces:**
- Produces (`palettes.ts`, pure): `export type GamePalette = { top: number; bottom: number; ink: number; accent: number }`; `export const PALETTES: Record<string, GamePalette>` with one entry per game key (`menu`, `batman`, `flappy`, `dodger`, `breaker`, `stack`, `snake`, `whack`, `memory`, `catch`, `math`, `words`, `quiz`, `clock`, `world`, `fractions`, `operator`, `shapes`, `solar`, `pattern`, `odd`, `simon`, `slide`, `sudoku`, `robot`, `checkers`, `chess`, `ludo`, `snakes`). `ink` is the main text colour on that background.
- Produces (`background.ts`): `setGradientBackground(scene: Phaser.Scene, p: GamePalette): void` (full-screen vertical gradient at depth -200, sets the camera background to `p.top`).
- Produces (`chips.ts`): `addChip(scene, x: number, y: number, opts?: { icon?: string; width?: number; depth?: number }): { setText(t: string): void; destroy(): void; container: Phaser.GameObjects.Container }`, a glass pill for scores, lives and timers.
- Produces (`progress.ts`): `addProgress(scene, x, y, w, color: number): { set(fraction: number): void; destroy(): void }`, a glass track with a glossy fill.
- Produces (`tiles.ts`): `drawTile(g: Phaser.GameObjects.Graphics, x, y, w, h, color: number, opts?: { raised?: boolean; face?: boolean }): void`, a rounded card tile (raised or flat) for memory, slide and sudoku.
- Produces (`fx.ts`): `confetti(scene, x, y, opts?: { count?: number; colors?: number[] }): void` and `popText(scene, x, y, text: string, color?: string): void`; both remove their own objects when done.
- Produces (`main.ts` hook): after the game is ready, every scene gets `addSoftBackdrop(scene)` on its `create` event.

- [ ] **Step 1: Failing test** `tests/palettes.test.ts`: for every entry of `PALETTES`, `contrastRatio(ink, top) >= 4.5` and `contrastRatio(ink, bottom) >= 4.5`; every required game key above exists; `accent` differs from `top`.
- [ ] **Step 2: Run** `npm test -- palettes`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement `palettes.ts`** with Soft Glass palettes (deep, slightly lifted colours with light ink), tuned until the test passes.
- [ ] **Step 4: Implement the five Phaser helpers** to the interfaces above and the global hook in `main.ts`.
- [ ] **Step 5: Replace** every `fontFamily: "system-ui, ..."` string in `src/scenes/` with the shared `FONT` (import from `../ui/theme`), without changing sizes or colours.
- [ ] **Step 6: Verify.** `npm run build && npm test`; `node scripts/shot.cjs /tmp/a.png --phone "480,214,1500"` (Flappy). Expected: pass, `errors: []`, Nunito text.
- [ ] **Step 7: Commit** `git add -A && git commit -m "Add shared look helpers, per-game palettes and a global soft layer"`

---

### Task 2: Question-game family look (ChoiceGameScene and Quiz)

**Files:**
- Modify: `src/scenes/ChoiceGameScene.ts`, `src/scenes/QuizScene.ts`, `src/ui/choiceBoard.ts`

**Interfaces:**
- Consumes: Task 1 helpers and palettes.
- Produces: `ChoiceGameScene` keeps its abstract API (`cfg: GameCfg`, `makeRound(tier)`), with `GameCfg.bg` still accepted but the gradient taken from `PALETTES[cfg.palette ?? ...]`; add optional `palette?: string` to `GameCfg`. Six games (Clock, Fractions, Odd, Operator, Shapes, World) restyle through this base class.

- [ ] **Step 1: Restyle `ChoiceGameScene`:** gradient background, score and best as chips, a progress bar for "question n of 10", the explanation in a glass card, streak confetti on 3 in a row (`fx.confetti`), answer buttons keep `Btn.rect.setFillStyle` colouring.
- [ ] **Step 2: Restyle `QuizScene`** the same way (it duplicates the base class's layout).
- [ ] **Step 3: Verify** Odd One Out, Clock, World and Quiz on `--ipad`: open, answer one question right and one wrong. Expected: `errors: []`, right answer green, wrong red.
- [ ] **Step 4: Commit** `git add -A && git commit -m "Restyle the question games in Soft Glass"`

---

### Task 3: Learning and puzzle games

**Files:**
- Modify: `src/scenes/MathScene.ts`, `WordScene.ts`, `PatternScene.ts`, `SimonScene.ts`, `SlideScene.ts`, `SudokuScene.ts`, `RobotScene.ts`, `MemoryScene.ts`

**Interfaces:** consumes Task 1 only.

- [ ] **Step 1: Math Rocket and Word Wizard:** gradient background, chips for score, level and lives, progress bar, glass cards for the question and the word tiles; rocket and letter animations kept.
- [ ] **Step 2: Pattern, Simon, Slide, Sudoku, Robot, Memory:** tiles drawn with `drawTile` (rounded, raised), gradient backgrounds, chips for timers and moves, `fx.confetti` on a win, `fx.popText` for streaks.
- [ ] **Step 3: Verify** each of the eight games on `--phone`: open, make one move. Expected: `errors: []`, tiles still respond to taps.
- [ ] **Step 4: Commit** `git add -A && git commit -m "Restyle learning and puzzle games in Soft Glass"`

---

### Task 4: Arcade games

**Files:**
- Modify: `src/scenes/GameScene.ts` (Batman), `GameOverScene.ts`, `FlappyScene.ts`, `DodgerScene.ts`, `BreakerScene.ts`, `StackScene.ts`, `SnakeScene.ts`, `WhackScene.ts`, `CatchScene.ts`

**Interfaces:** consumes Task 1 only.

- [ ] **Step 1: Each game:** gradient sky or space backgrounds from its palette, score, lives and timer as chips, soft-shadow effects (`popText` on points, `confetti` on a new best), game-over card already shared. Gameplay, physics and balance are not changed.
- [ ] **Step 2: Verify** each game on `--ipad` and `--phone`: start it, give input, wait 6 seconds, take a screenshot. Expected: `errors: []`, game still running.
- [ ] **Step 3: Commit** `git add -A && git commit -m "Restyle arcade games in Soft Glass"`

---

### Task 5: Solar Explorer

**Files:**
- Modify: `src/solar/solarApp.ts` and its HTML/CSS (info card, buttons), `src/scenes/SolarScene.ts`

- [ ] **Step 1: Restyle** the info card, buttons and labels with the Soft Glass look (rounded glass card, Nunito, pill buttons, 44 px targets); keep the 3D scene.
- [ ] **Step 2: Verify** with `--ipad`: open Solar Explorer, tap a planet. Expected: `errors: []`, card readable.
- [ ] **Step 3: Commit** `git add -A && git commit -m "Restyle Solar Explorer in Soft Glass"`

---

### Task 6: Board games finishing touches

**Files:**
- Modify: `src/scenes/ChessScene.ts`, `CheckersScene.ts`, `SnakesScene.ts`, `LudoScene.ts`, `src/games/snakes/board3d.ts`

- [ ] **Step 1: Win celebration:** a 3D confetti burst (shared helper in `src/games/shared/confetti3d.ts`, same approach as Ludo's) when a game ends in a win, in all four board games.
- [ ] **Step 2: Capture effects:** a short sparkle at the square where a piece is captured in Chess and Checkers; check pulse on the king's square in Chess.
- [ ] **Step 3: Palettes:** Checkers and Snakes & Ladders board colours moved to the Soft Glass pastel set (keeping squares, numbers, snakes and ladders easy to read).
- [ ] **Step 4: Verify** each game on `--phone`: play a move, take a screenshot. Expected: `errors: []`.
- [ ] **Step 5: Commit** `git add -A && git commit -m "Board games: win confetti, capture sparkles and softer palettes"`

---

### Task 7: Questions audit and expansion

**Files:**
- Create: `src/data/quizBank.ts` (replaces the inline hard list), `src/data/wordBank.ts`, `src/data/countries.ts`, `src/data/oddPools.ts`, `src/data/validate.ts` (pure validators), `src/data/pickRounds.ts`, `scripts/audit-questions.mjs`
- Modify: `src/data/quizEasyBank.ts`, `src/scenes/QuizScene.ts`, `WordScene.ts`, `WorldScene.ts`, `OddScene.ts`, `ShapesScene.ts`, `FractionsScene.ts`, `OperatorScene.ts`, `PatternScene.ts`, `MathScene.ts`, `RobotScene.ts`
- Test: `tests/questions.test.ts`

**Interfaces:**
- Produces (`validate.ts`): `validateQA(q: QA): string[]` (empty when valid: exactly one correct, three distinct wrong options none equal to the correct one, non-empty prompt and explanation); `validateWord(w: { word: string; clue: string }): string[]` (A to Z only, 3 to 10 letters, non-empty clue); `validateCountry(c: { name: string; flag: string; capital: string; continent: string }): string[]`; `findDuplicates<T>(items: T[], key: (t: T) => string): string[]`.
- Produces (`pickRounds.ts`): `pickRounds<T>(pool: T[], n: number, random?: () => number): T[]` returns `min(n, pool.length)` distinct items.
- Targets (roughly three to five times today): Quiz easy at least 250 and hard at least 150, words at least 150 (easy and hard), countries at least 100, Odd One Out pools at least 45, Robot at least 12 levels, Shapes at least 14 shapes, Fractions, Operator, Pattern and Math each gain at least three new question kinds.

- [ ] **Step 1: Audit.** Write `scripts/audit-questions.mjs` that prints, per game, how many distinct questions or generators exist today. Run it and keep the output as the "before".
- [ ] **Step 2: Failing tests** in `tests/questions.test.ts`: `validateQA`/`validateWord`/`validateCountry` on good and bad samples; `findDuplicates` finds repeated prompts; `pickRounds` returns distinct items, never more than the pool, and `pickRounds([1,2,3], 10)` has length 3; every entry in each bank passes its validator with no duplicate prompts or words; each bank meets its target size above.
- [ ] **Step 3: Run** `npm test -- questions`. Expected: FAIL.
- [ ] **Step 4: Implement validators and `pickRounds`;** then expand each bank to its target (ages 7 to 10; a world mix that includes South Asia; no copyrighted text) until the tests pass. Wire the scenes to the data modules and to `pickRounds`.
- [ ] **Step 5: Extend generators:** new kinds for Fractions (compare, equivalent, add same denominator), Operator (more levels), Pattern (more rules and shape patterns), Math (more word problems), Shapes (more shapes and 3D solids), Robot (levels to 12+).
- [ ] **Step 6: Verify** `npm run build && npm test`; open each changed game once on `--ipad`. Expected: pass and `errors: []`.
- [ ] **Step 7: Commit** `git add -A && git commit -m "Expand question banks and add content validators"`

---

### Task 8: Docs, full check and the single push

**Files:** `docs/SPEC.md`, `README.md`, the design doc (status)

- [ ] **Step 1: Update docs** (question banks and validators, new helpers, game list and status).
- [ ] **Step 2: Full check.** `npm run build && npm test`; open every one of the 31 scenes once on `--phone` and the board games and a sample on `--ipad`. Expected: `errors: []` throughout.
- [ ] **Step 3: Commit** docs, then push once: `git push origin claude/gracious-knuth-zc7you && git push origin claude/gracious-knuth-zc7you:main`.
- [ ] **Step 4: Report** what changed, rulings, deferred minors, and what could not be verified (no real device).
