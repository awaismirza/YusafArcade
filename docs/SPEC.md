# Yusaf Arcade: Specification

This is the source of truth for what every game in the arcade must do. [`AGENTS.md`](../AGENTS.md) holds the short rules for agents. This document holds the detail.

## 1. Purpose

A collection of learning games and classic board games for a child (ages 7–10). Each game is played in a browser, mostly on an **iPad**, usually in landscape. Games are for **one child, or two people sharing one screen**. There is no internet play.

## 2. Platform requirements

### 2.1 Target devices

Yusaf Arcade is a **browser-based game for mobile browsers only**: it runs in the browser, with no native app and no install. Desktop browsers are not a target; they are used only for development and testing.

| Device | Browser | Priority |
| --- | --- | --- |
| iPad (iPadOS 16+) | Safari | **Required** |
| iPad (iPadOS 16+) | Chrome (WebKit engine) | **Required** |
| Phones (iOS and Android), landscape | Safari, Chrome | **Required**: must be playable at phone-landscape size |
| Desktop | Any | Not a target (development and testing only) |

Safari on iPadOS uses WebKit for every browser, so test with WebKit or with the device emulation in Chromium. `scripts/shot.cjs` has `--ipad` and `--phone` modes that use real touch taps.

### 2.2 Input

- **Pointer events only** for game input. Tap and drag must work everywhere. Do not depend on hover, right-click, long-press or double-tap.
- Keyboard shortcuts are optional extras. Every game must be fully playable by touch.
- Touch targets are at least **44 × 44 CSS px** on screen.
- Pinch zoom and page scroll are disabled by the page shell (`index.html`, `touch-action: none`). Scrollable panels opt in with `data-scroll`.

### 2.3 Display

- Game canvas: **960 × 540** logical pixels (16:9), scaled with `Phaser.Scale.FIT` and centred.
- Landscape is the intended orientation. In portrait, show the "turn your iPad sideways" hint.
- Text is at least 16 px at logical size and high-contrast on its background.

### 2.4 Audio

- Audio is unlocked by the first user gesture (`gameAudio.unlock()` on the first tap).
- No autoplay. Music is optional and can be stopped at any time.

### 2.5 Storage and safety

- Game state is in memory. Best scores may use `localStorage`, but only through `getBest`/`saveBest` in `src/ui/arcadeKit.ts`, which swallow storage errors.
- No `alert`, `confirm`, `prompt`, file pickers, popups or new windows.
- No network requests are needed to play. Sprites and models ship in the build.

### 2.6 3D and WebGL

- Three.js is used for 3D games (for example, the chess board).
- Renderer: `pixelRatio` at most 2, antialiasing on, shadow maps at 1024 or below, no heavy post-processing.
- If WebGL is unavailable, the game shows a clear message and offers the 2D fallback or the menu, never a blank screen.

### 2.6a Board-game camera and look

- **Camera (all four 3D board games):** two fingers on the board: pinch to zoom, twist to turn, drag up or down to tilt. One finger only ever taps, and a tap fires on release, so a gesture can never play a move. A **View** button under the Menu button opens preset views: Top down, My side, Left corner, Right corner, Reset. Limits: tilt 20° to 85°, zoom 0.6× to 1.5× of the default. In pass-and-play the camera still turns to the player to move and keeps that player's chosen angle. Code: `src/games/shared/orbitRig.ts`, `src/ui/gestures.ts`, `src/ui/boardControls.ts`.
- **Soft Glass look:** tokens live in `src/ui/theme.ts` (font, ink, glass, accents), drawing helpers in `src/ui/glass.ts`. Buttons, pickers, game-over cards, the Menu button, HUD pills and the main menu all use them, and `addMenuButton` adds a soft gradient backdrop to the scene. Glass is faked (translucent panels with a light edge and soft shadow); the canvas layer can't blur. The Nunito font ships with the site and the game starts anyway if it loads slowly.

### 2.7 Browser compatibility checklist

Before a game is done, confirm:

- [ ] Every action works with a single tap.
- [ ] Nothing important is shown only on hover.
- [ ] Touch targets are at least 44 px on screen.
- [ ] Sound starts only after a tap.
- [ ] The "Menu" button is reachable at all times (except during the picker).
- [ ] Works at an iPad viewport (1180 × 820 CSS px, landscape) and at 16:9 scaling.
- [ ] Works with the page in portrait, showing the rotate hint.
- [ ] No console errors in a headless run.

## 3. Modes and multiplayer

Every game that involves turns must offer a **mode picker** on entry, with at least:

1. **Easy** (computer opponent, gentle play)
2. **Challenge** (computer opponent, stronger play)
3. **2 players (same iPad)** (pass-and-play)

Rules for local multiplayer:

- Both players use the same controls on the same device. There is no networking.
- The screen always says whose turn it is, in words ("Black's turn: pass the iPad").
- Where it helps, the board turns to face the player to move.
- Both players see the same information. Nothing is hidden behind hover.
- The computer opponent and two-player mode use the same rules code.

## 4. Game rules code

- Pure logic (rules, move generation, AI) lives in its own module with no Phaser or DOM imports, so it can be unit-tested in Node (`src/games/chess/`, tests in `tests/`).
- Rendering lives in the scene file.
- The rules module is the only place that decides whether a move is legal.

## 5. Games

| Game | Category | Status | Notes |
| --- | --- | --- | --- |
| Checkers | Board Games | Live. Computer (Easy, Challenge) and two-player. | Full-screen 3D board. Standard 8×8 draughts: compulsory jumps, multi-jumps, kings (stacked discs with a gold ring). |
| Chess | Board Games | Live. Computer (Easy, Challenge) and two-player. | Full-screen 3D board. Castling, en passant, promotion (auto-queen in play), check, checkmate, stalemate, 50-move and repetition draws. Rules tested with standard perft counts. |
| Ludo | Board Games | Live. 1 player vs computer, or 2–4 players on one iPad. | Raised 3D board (rounded tiles, chunky yard trays, embossed stars, centre wedges), landing squash, confetti when a token gets home, a ring where a token is captured, and a pulse on the current start square. Choose 1, 2 or 3 dice. Dice shake and toss onto the board. A 6 brings a token out and earns a bonus roll (up to 3 rolls in a turn). Land on a lone opponent off a safe square to send it home. Exact roll to finish. |
| Snakes & Ladders | Board Games | Live. 1 player vs computer, or 2–4 players on one iPad. | 3D board with 10 snakes and 9 ladders. Choose 1, 2 or 3 dice (total is moved). A 6 on one die, or doubles on several, earns a bonus roll. Overshooting 100 bounces back. |
| Other arcade, learn and puzzle games | Arcade / Learn / Puzzles | Live | Brought to this spec as they are changed. |

### Shared 3D building blocks

| Module | What it does |
| --- | --- |
| `src/ui/threeStage.ts` | Draws a three.js scene into an offscreen canvas and hands each frame to Phaser as a texture, so the Phaser menu, buttons and touch handling keep working. Returns `null` without WebGL. |
| `src/ui/animQueue.ts` | Time-based animations and sequences, driven by the scene's `update`. |
| `src/ui/hud.ts` | Status line, hint line and counter that float over a full-screen board. |
| `src/games/shared/board8.ts` | The 8×8 wooden board, highlight markers and the camera that turns for pass-and-play. |
| `src/games/shared/dice3d.ts` | 3D dice with a shake-then-toss roll animation that settles on a chosen value. |
| `src/games/shared/pawn3d.ts` | Glossy coloured pawns. |
| `src/games/chess/pieces3d.ts` | Staunton-style chess pieces (ivory and ebony) with outlines and soft contact shadows, plus the chess board palette. Pure geometry, tested in Node. |

## 6. Build and deployment

- `npm run build` must pass. It runs `tsc -b` and then `vite build`.
- The Vite base path is `/YusafArcade/` (GitHub Pages project site).
- Deployment is built and pushed from the development environment. The deploy target is the `gh-pages` branch. GitHub Actions is not used for the build.
- Mobile Safari caches aggressively. After a deploy, a hard refresh may be needed on the iPad.

## 7. Known limits

- Ludo house rules: a token captures every opponent token on a non-safe square it lands on; there is no blocking; the first player to bring all four tokens home wins. With several dice, each die is a separate move: tap a die, then a token.
- Chess promotes pawns to Queens in play. The rules module supports all four promotion pieces, but the UI does not offer a choice yet.
- Most arcade, learning and puzzle games still use their own artwork and text styles inside the screen; only the shared UI, menu and backdrop (plus Flappy's menu button) have the Soft Glass look so far.
- On phones in landscape the 960-wide canvas shrinks buttons to about 37 to 40 px on screen, a little under the 44 px target; a phone-specific scale-up is not done.
- Nothing has been run on a physical iPad. Checks so far use a headless browser (Chromium, with a WebGL software renderer, and an iPad Pro 11 device emulation with touch taps). Confirm on a real iPad before calling a game finished.

## 8. Definition of done for a new game

1. Meets sections 2 and 3.
2. Rules live in a tested module (Node test or a documented manual test).
3. Passes `npm run build` with no type errors.
4. Plays through headless with no console errors.
5. Has been checked at an iPad viewport, and anything not verified on a real iPad is listed in the hand-off note.
