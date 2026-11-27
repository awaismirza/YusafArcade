# 3D Arena Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five full-screen 3D local-multiplayer games (Turbo Karts, Bomb Blast, Air Hockey 3D, Tank Trouble, Mini Golf World) in a new "3D Arena" menu tab, playable on iPad, phone and desktop.

**Architecture:** Each game is a standalone three.js app started by a thin Phaser scene (the Solar Explorer pattern). A shared kit provides the shell, HTML Soft Glass overlays, multi-touch and keyboard controls. Game rules and physics live in pure modules with node tests; the app modules render and wire input.

**Tech Stack:** TypeScript, three.js 0.187, Phaser 3.90 (menu and launch only), Vite, `npm test` (esbuild + node).

**Spec:** `docs/superpowers/specs/2026-11-27-3d-arena-games-design.md`

## Global Constraints

- Touch targets at least 44 CSS px; no hover-only UI; audio starts only after a tap or key press (`gameAudio.unlock()`).
- Local multiplayer only; no networking.
- Pure modules (`src/arena/*/rules.ts`, `physics.ts`, `track.ts`, `course.ts`) import nothing from three.js or the DOM.
- Every game: a mode picker with computer modes and "2 players (same device)", player names in words and colours, a game-over card with Play again and Menu, an always-visible exit button.
- Renderer pixel ratio capped at 1.5 (2 only on desktop); shadows only from one light; dispose every geometry, material, texture, listener and animation frame on exit.
- `npm run build` and `npm test` pass; each game runs for at least 10 s in headless Chromium on `--ipad`, `--phone` and desktop with `errors: []`.

## Review Focus

- Two fingers on the screen at once (one per player): each control must follow its own pointer id and ignore the others.
- Leaving a game mid-round (Menu, tab switch, phone lock): the loop stops, nothing keeps running or playing sound, and coming back to the menu works.
- Very small or tall viewports (phone landscape 844×390, desktop 1920×1080, iPad portrait): canvas fills the screen, controls stay on screen and do not overlap.
- Frame hitches (a slow frame of 500 ms): physics uses a clamped time step so things never tunnel through walls.
- The computer opponent getting stuck (kart against a wall, bomber trapped, tank in a corner): each AI has a recovery rule and a test or simulation covers it.

---

### Task 1: Arena kit, launcher scenes, menu tab and rules update

**Files:** Create `src/arena/kit/shell.ts`, `src/arena/kit/ui.ts`, `src/arena/kit/controls.ts`, `src/arena/kit/three.ts`, `src/arena/kit/math.ts`, `src/scenes/ArenaScenes.ts`, `tests/arena-math.test.ts`. Modify `src/scenes/MenuScene.ts`, `src/main.ts`, `AGENTS.md`, `CLAUDE.md`, `docs/SPEC.md`.

**Interfaces (produced):**
- `startShell(opts: { title: string; bg: number }): Shell` where `Shell = { root: HTMLDivElement; renderer: THREE.WebGLRenderer; size(): { w: number; h: number }; onFrame(fn: (dt: number, t: number) => void): void; onResize(fn: () => void): void; addCleanup(fn: () => void): void; dispose(): void }`; frame `dt` in seconds, clamped to 1/20.
- `ui.ts`: `showPicker(root, { title, subtitle, options: { label: string; sub?: string; color: string; value: T }[] }): Promise<T>`, `showGameOver(root, { title, detail, onAgain, onMenu })`, `addExitButton(root, onExit)`, `hud(root)` returning `{ set(id, html): void; remove(): void }`, `toast(root, text)`.
- `controls.ts`: `Keys` (shared keyboard state with `down(code): boolean`), `addJoystick(root, { side, x, y, size, color }) → { vec(): { x: number; y: number }; dispose }`, `addButton(root, { label, x, y, size, color }) → { held(): boolean; pressed(): boolean /* edge, consumed */; dispose }`; positions are CSS percentages/px relative to the root so players can have their own corners; every element uses its own pointer id.
- `math.ts` (pure): `clamp`, `lerp`, `angleDiff(a, b)`, `circleRect(cx, cy, r, rect)` returning push-out vector or null, `reflect(vx, vy, nx, ny)`, `mulberry32(seed)`.
- `ArenaScenes.ts`: one Phaser scene per game key (`Karts`, `Bombs`, `Hockey`, `Tanks`, `Golf`) that dynamic-imports `src/arena/<game>/app.ts` and calls `start(onExit): () => void`.

- [ ] Write `tests/arena-math.test.ts` (clamp, angleDiff wraps to (−π, π], reflect off a wall, circleRect push-out, mulberry32 deterministic) and see it fail; implement `math.ts`; pass.
- [ ] Implement shell, ui, controls, three helpers, launcher scenes; add the "🏆 3D Arena" tab (five tabs at 184 px spacing) and register the scenes.
- [ ] Update `AGENTS.md`, `CLAUDE.md`, `docs/SPEC.md`: desktop browsers are supported too (keyboard and mouse), mobile stays first.
- [ ] `npm run build && npm test`; commit "3D Arena kit, launcher and menu tab".

### Task 2: Air Hockey 3D

**Files:** `src/arena/hockey/physics.ts`, `src/arena/hockey/app.ts`, `tests/hockey-physics.test.ts`.
- Pure: `type Table = { w: number; h: number; goalW: number }`, `stepPuck(puck, paddles, table, dt) → { goal: 0 | 1 | null; hit: boolean }` with paddle–puck elastic collision using paddle velocity, wall bounce, goal detection, max puck speed; `aiTarget(puck, paddle, level, table) → { x, y }`.
- App: neon table, glowing puck trail, paddles follow each player's finger on their own half (pointer id), first to 7, levels Easy/Medium/Hard, 2 players.
- Tests: puck bounces off side wall with mirrored x velocity; goal only inside goal width; puck never exceeds max speed; fast paddle cannot pass through puck in one 1/20 s step (sub-stepping).

### Task 3: Bomb Blast

**Files:** `src/arena/bombs/rules.ts`, `src/arena/bombs/app.ts`, `tests/bombs-rules.test.ts`.
- Pure grid game: 13×11 grid, solid pillars on even cells, random crates (seeded), power-ups (extra bomb, bigger blast, speed), bombs explode after 2.5 s in a + shape stopped by pillars and the first crate, chain reactions, players hit by flames are out; last one standing wins the round; first to 3 rounds wins.
- `createGame(players, seed)`, `move(game, id, dx, dy, dt)`, `placeBomb(game, id)`, `tick(game, dt)` returning events; `aiInput(game, id) → { dx, dy, bomb }` that avoids danger cells.
- Tests: flame stops at pillar and at first crate; chain reaction; spawn corners are always clear; AI never walks into a cell that will explode within 0.6 s when a safe move exists.

### Task 4: Tank Trouble

**Files:** `src/arena/tanks/rules.ts`, `src/arena/tanks/app.ts`, `tests/tanks-rules.test.ts`.
- Pure: maze generator (perfect maze on 7×5 cells plus a few removed walls, seeded), tank movement with wall collision (circle vs wall segments), shells that bounce up to 5 times and live 8 s, max 5 shells per tank, hit detection, rounds to 5 points; AI aims with one-bounce ray checks and moves along maze path.
- Tests: maze connects all cells; shell reflects off a horizontal and a vertical wall; a shell fired point-blank into a wall cannot pass through it in one step; tank cannot overlap a wall.

### Task 5: Mini Golf World

**Files:** `src/arena/golf/course.ts`, `src/arena/golf/physics.ts`, `src/arena/golf/app.ts`, `tests/golf.test.ts`.
- Pure: 9 holes as data (polygons of fairway made of rectangles, walls, slopes as constant acceleration zones, moving obstacles like windmill blades and sliders with periods, cup position, par); `stepBall(ball, hole, t, dt)` with friction, wall bounce, slope, cup capture when slow enough; water/out-of-bounds resets to last spot with a penalty stroke.
- App: drag-back aiming with a power arrow, camera follows ball then shows the cup, players take turns (pass the device), scorecard after each hole.
- Tests: ball stops on flat ground; bounces off walls; falls in the cup only below capture speed; every hole is finishable (a scripted search over aim angles and powers finds a hole-in-few within 10 shots).

### Task 6: Turbo Karts

**Files:** `src/arena/karts/track.ts`, `src/arena/karts/physics.ts`, `src/arena/karts/app.ts`, `tests/karts.test.ts`.
- Pure: three tracks as closed spline centre-lines with widths; `progress(track, x, z)` returning lap fraction; kart physics (accelerate, steer, drift, off-track slow-down, boost pads, kart–kart bumps); AI follows the racing line with look-ahead and catches up when behind; 3 laps; item boxes give a boost or a banana.
- App: split screen with two cameras via `setViewport`/`setScissor` in 2-player mode; minimap; lap and position HUD per player; countdown 3-2-1-GO; podium at the end.
- Tests: progress increases monotonically along the centre line and wraps at the finish; a kart driven by the AI completes 3 laps on every track within a time limit in a headless simulation; leaving the track lowers top speed.

### Task 7: Docs, full check, single push

- [ ] Update `docs/SPEC.md` games list and shared kit section.
- [ ] Run every 3D Arena game on `--ipad`, `--phone`, desktop for 10 s (and a 2-player mode); `npm run build && npm test`.
- [ ] Commit and push once: `git push origin claude/gracious-knuth-zc7you && git push origin claude/gracious-knuth-zc7you:main`.
