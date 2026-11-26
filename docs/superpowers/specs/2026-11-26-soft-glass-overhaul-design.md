# Soft Glass overhaul: design

Status: **approved.** Steps 1 (chess pieces), 2 (shared look) and 3 (camera controls, Ludo 3D) are built. Steps 4 (questions) and 5 (arcade games' own artwork) are still to do.

## Intent and why

Yusaf Arcade is played by a child (7–10) on an iPad. The owner wants it to look like a professional game product, "like the Roblox or Apple Arcade games", and chose the **Soft Glass** direction from three mockups: calm pastel gradients, frosted-glass panels, satin pieces, rounded friendly type, smooth springy motion.

Separately, the owner reports that the chess pieces look bad in 3D and can't be seen clearly, and asks for this to be fixed **first**.

The owner also asks for: two-finger camera control and a camera-view button on the board games; better animation and colour schemes on Ludo, Chess, Checkers and Snakes & Ladders; many more questions in the puzzle and learning games; and a visual pass over every game. "All the games are equally important."

## Goals

1. Chess pieces are instantly recognisable and clearly visible against the board and each other, on an iPad in landscape.
2. One shared Soft Glass look (colours, fonts, buttons, panels, menu, pickers, game-over screens) used by every game.
3. On the four 3D board games: two-finger pinch to zoom, twist to turn, drag to tilt; a camera button with preset views; pass-and-play still turns the board to the player to move.
4. Board-game art and animation raised to the same standard: refined palettes, lighting, springy moves, squash on landing, win celebrations.
5. Learning and puzzle games have substantially more distinct questions, with no repeats within a session.
6. Every game screen, arcade action games included, gets the shared look applied.

## Non-goals

- No internet play, accounts or servers (project rule).
- No new games in this work.
- No licensed or downloaded art or models.
- No change to game rules, except extra levels or questions.

## Anti-goals (a failure even if it "works")

- A look that is pretty but hard for a child to read: low contrast, tiny type, faint buttons.
- Anything that makes the iPad stutter or run hot.
- Games that stop being fun because the polish hides what to tap.
- A mixed-up arcade where some games look new and others old.

## Constraints

- `AGENTS.md` and `docs/SPEC.md` apply: iPad first, touch only, targets at least 44 px, no hover-only UI, audio after a tap, WebGL fallback.
- The 3D scenes render offscreen and are copied into a Phaser texture each frame. The buttons, panels and text are drawn by Phaser on a canvas, so **true backdrop blur is not available**; "glass" is built from translucent gradient panels, light edge strokes and soft shadows.
- Fonts must ship with the site (no runtime dependency on Google Fonts).
- Only the npm registry is reachable from the build container. Nothing here has been or can be run on a physical iPad; checks use headless Chromium with an iPad emulation and real touch taps.
- GPU budget: the offscreen render is 1152 × 648. New effects must not add post-processing or large shadow maps.

## Approaches considered

**Chess pieces**

1. *Hand-built Staunton-style pieces, lighting and board rebalanced.* No downloads, fast, consistent with the other games. **Chosen.**
2. Import free glTF chess models. Better detail, but licensing, file size and iPad load time, and the container cannot fetch them.
3. Pre-drawn 2D pieces. Loses the camera angles the owner asked for.

**Camera gestures**

1. *Own two-pointer gesture handler on top of Phaser's pointers, driving an orbit camera with clamps.* Works with the offscreen canvas and leaves one-finger taps for play. **Chosen.**
2. three.js `OrbitControls`. It expects a real DOM element for events, so it would need synthetic events from the offscreen canvas.

**Look**

1. *Soft Glass in the shared Phaser UI kit (`arcadeKit`, `Hud`, menu, pickers, game-over), driven from one theme file.* Almost every game already uses these helpers, so one change restyles most of the arcade. **Chosen.**
2. Per-game restyling with no shared theme. More hand work and drift between games.

## Decisions

### Order of work (each step is built, tested, and reported before the next)

1. **Chess pieces and board contrast** (first, as requested).
2. **Shared Soft Glass look:** theme tokens, bundled font, buttons, panels, mode and level pickers, game-over screen, main menu.
3. **Camera controls and board-game art:** orbit/zoom/tilt gestures, camera button with presets, then per-game palette, lighting and animation work for Chess, Checkers, Ludo, Snakes & Ladders.
4. **Questions:** audit every learning and puzzle game, then expand the banks and generators.
5. **Arcade games:** apply the Soft Glass look to each action game's backgrounds, HUD and effects.

### Chess pieces (step 1)

- Redraw all six piece types with finer turned profiles: base ring, waist, collar, and distinct heads. Pawn with ball head; rook with crenellated top and a slight taper; bishop with a mitre slit and tip; queen with a crown of points and a small orb; king with a larger crown and cross; knight with a smooth bevelled head, neck, mane, ear and eye.
- Piece height ranking is visible at a glance (pawn shortest, king tallest). Pieces about 10 to 15 per cent bigger than now.
- Ivory is a warm off-white that still shades; ebony has a visible warm sheen. Tone mapping and exposure are tuned so the ivory is not blown out.
- Board: stronger contrast between light and dark squares and between the board and the backdrop; both sets of pieces must read on both square colours.
- A soft contact shadow under each piece.

### Shared look (step 2)

- One theme module defines colour tokens, radii, shadows, type sizes and motion timings. All shared UI reads from it.
- Rounded type (Nunito) bundled in the site and loaded before the first scene.
- Panels are translucent with a light edge and a soft shadow. Buttons are filled, rounded and pill-shaped with a clear pressed state and a spring on tap.
- Each game keeps a strong accent colour so it stays easy to tell apart and cheerful.

### Camera (step 3)

- Two fingers: pinch zooms, twist turns, vertical drag tilts. One finger is unchanged (select and move).
- A **View** button opens preset views: Top down, My side, Left corner, Right corner, Reset. The camera glides to the choice.
- Distance, tilt and turn are clamped so the board can't be lost. In pass-and-play, the camera still turns to the player to move unless the player has chosen a view.

### Questions (step 4)

- Audit first: count distinct questions, find repeats, and find gaps by age band (7 and 10).
- Then expand banks and generators for every learning and puzzle game, keeping the Easy and Challenge split.
- Add tests that check every question is valid (one correct answer, no duplicate choices) and that a session never repeats a question.

## Left to the builder

- Exact palettes, easing curves and particle details inside the Soft Glass direction.
- How many questions per game. The owner asked for "more"; the audit sets targets, aiming at several times today's variety.
- Which arcade games need more than a restyle.

## Process calls

- Each step ends on the working branch with tests passing, a headless iPad-emulation check and screenshots. Pushing to `main` or deploying to Pages only happens when the owner asks.
- If a step turns out much bigger than expected, stop and say so before continuing.

## Addendum 2026-11-26: steps 4 and 5 in one go

The owner asked for every game to be modernised, a full plan, and execution in one go. Calls made (owner can redirect):

- Every game keeps its own accent colour and uses shared Soft Glass pieces (score chips, progress bars, tiles, effects, gradient backgrounds, per-game palettes). A global layer gives every scene the soft backdrop and the Nunito font.
- Board games get a win celebration, capture effects and softer palettes so none looks different from Chess.
- Questions grow to roughly three to five times today's variety for ages 7 to 10, with a world-knowledge mix that includes South Asia. Validators and unit tests guard the content.
- Plan: `docs/superpowers/plans/2026-11-26-all-games-modern-look-and-questions.md`. One push to `main` at the end.
