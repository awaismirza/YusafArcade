# AGENTS.md

Rules for any AI agent (Claude, Codex, or other) working on Yusaf Arcade. `CLAUDE.md` points here, so these rules apply to every agent. The full specification lives in [`docs/SPEC.md`](docs/SPEC.md).

## Non-negotiable: every game must work in a mobile browser

Yusaf Arcade is a **browser-based game for mobile browsers only** (no native app; desktop is not a target, it is only used for development and testing). It is played by a child mainly on an **iPad (Safari, and Chrome on iPadOS)**, and must also work on phones in landscape. Every new or changed game must work there. Treat these as hard requirements, not nice-to-haves:

1. **Touch first.** Every action must work with a single tap or drag via pointer events. Hover-only UI (tooltips, `:hover` reveals, `mouseover` affordances) must not be the only way to learn or do something. Keyboard shortcuts may exist as extras, never as the only option.
2. **Targets at least 44×44 CSS px** (Phaser coordinates scale with the canvas, so check the on-screen size, not the game size).
3. **No right-click, long-press or double-tap dependencies.** Set `touch-action` appropriately and never rely on context menus.
4. **Audio unlocks on a user gesture.** Call `gameAudio.unlock()` from the first tap, as existing scenes do. Never autoplay sound.
5. **WebGL 3D must degrade gracefully.** Use `pixelRatio` ≤ 2, avoid heavy post-processing and shadow maps at high resolution, and keep draw calls low. If WebGL is unavailable, show a plain 2D fallback message instead of a blank screen.
6. **Landscape and portrait.** The canvas uses `Phaser.Scale.FIT`. Test in landscape (the intended orientation); portrait must still show a clear "turn your iPad sideways" hint rather than a broken layout.
7. **No reliance on storage that Safari may clear.** Wrap `localStorage` access in try/catch (see `src/ui/arcadeKit.ts`). Game state must not depend on it.
8. **No `alert`, `confirm`, `prompt`, file pickers or new-window popups.** They behave badly on iPadOS.
9. **Modern but safe JS.** Target `es2022` (see `vite.config.ts`). Avoid APIs that Safari lacks or ships late without a fallback (for example, `structuredClone` is fine on iOS 15.4+, but check before adding anything new).
10. **Pinch zoom and scrolling are disabled** by the page shell. New HTML overlays must respect the `touch-action: none` shell and the `data-scroll` escape hatch in `src/main.ts`.

## Multiplayer rules

- **All multiplayer is local.** Two people share one device and one screen (pass-and-play, or a split turn on the iPad). There is no internet play, no accounts, no servers and no realtime backend. Do not add networking code, WebSockets, or third-party realtime services.
- Every multiplayer game offers, on the mode picker, a **"2 players (same iPad)"** option next to the computer levels.
- Pass-and-play must be obvious: show whose turn it is in words ("Black's turn: pass the iPad"), and flip or re-orient the board to the player to move where that helps.
- Hide nothing important from the other player in a way that would need hover. Keep the rules identical for both players.
- The computer opponent and the two-player mode share the same rules code.

## Verifying your work

Before you call a game done:

1. `npm run build` must pass (this runs `tsc -b`, so type errors fail the build). Run `npm test` when you touch any game rules (`tests/`).
2. Load the built app with `vite preview` and play through the game in a headless browser. Check the browser console for errors.
3. Check the game on an iPad and on a phone in landscape with real touch taps: `node scripts/shot.cjs out.png --ipad ...` and `--phone ...` (Playwright named devices; do not override `deviceScaleFactor`). Run `npx vite preview --port 4173 --strictPort` first.
4. Note anything you could not verify (for example, a real iPad, or a live multiplayer backend) in your final message. Do not claim it works on iPad if you have not checked.

## Repository conventions

- TypeScript, Phaser 3, Vite. Three.js is available for 3D (see `src/scenes/ChessScene.ts` once it exists).
- 3D games share `src/ui/threeStage.ts`, `src/ui/animQueue.ts`, `src/ui/hud.ts` and `src/games/shared/`. Reuse them instead of setting up a new renderer.
- Game scenes live in `src/scenes/`, one file per game, and are registered in `src/main.ts` and listed in `src/scenes/MenuScene.ts`.
- Shared UI helpers belong in `src/ui/arcadeKit.ts`. Reuse them before writing new ones.
- Pure game logic (rules, AI) goes in its own module with no Phaser imports, so it can be tested in Node.
- Do not commit secrets. Realtime keys are public `VITE_` values, but still keep them in `.env.local` (gitignored), never in code.
- Never add a model name or session URL to code, docs or chat artifacts beyond the commit trailers the harness asks for.
- Only open a pull request when the user asks for one. Only push to `main` when the user asks for it.
