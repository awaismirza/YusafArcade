# 3D Arena: five local-multiplayer 3D games (design)

Status: approved by the owner on 2026-11-27 ("Okay, go ahead and build all 5").

## Intent

Yusaf (age 7 to 10) enjoys the existing arcade, learning, puzzle and board games. The owner now wants "advanced" 3D games modelled on popular online games, playable together on one device (local multiplayer) and alone against the computer. They must work on iPad (Safari and Chrome), phones in landscape, and now also desktop browsers.

## The five games

| Game | Like | Players | Controls |
|---|---|---|---|
| Turbo Karts | Mario Kart | 1 vs 3 computer karts, or 2 players split screen (+2 computer karts) | Touch: steer ◀ ▶ and Boost on each player's side. Keys: P1 W/A/S/D + Space, P2 arrows + Enter |
| Bomb Blast | Bomberman | 1 vs 1–3 computer, or 2–4 players on one screen | Touch: a small D-pad and 💣 button in each player's corner. Keys: P1 WASD + Space, P2 arrows + Enter |
| Air Hockey 3D | arcade air hockey | 1 vs computer (3 levels), or 2 players at opposite ends | Touch: drag your own paddle on your half. Mouse: drag. Keys: P1 WASD, P2 arrows |
| Tank Trouble | Tank Trouble / Wii Tanks | 1 vs computer tank(s), or 2–3 players | Touch: joystick + Fire per player. Keys: P1 WASD + Space, P2 arrows + Enter, P3 IJKL + O |
| Mini Golf World | Golf With Your Friends | 1–4 players, turn by turn | Drag back from the ball to aim and set power (touch or mouse) |

Every game shows whose turn or which player is which in words and colour, offers computer opponents, and offers "2 players (same device)".

## Approaches considered

1. **Phaser scene + ThreeStage (as the board games).** Reuses Phaser UI, but every frame is copied from WebGL into a Phaser texture. Fine for slow board games; too slow for split-screen racing on an iPad. Rejected.
2. **Full-screen three.js app with HTML controls (as Solar Explorer).** Phaser hands over the screen to a dedicated renderer; controls are HTML elements, which gives true multi-touch (each finger tracked separately), crisp text and easy layout per device. Chosen.
3. **A physics engine (cannon-es / Rapier).** Adds 100 to 600 kB and a dependency for physics that is simple here (circles, boxes, grids, a ball on slopes). Rejected; small hand-written physics in pure, tested modules instead.

## How it is built (decided)

- A shared kit under `src/arena/kit/`: the shell (renderer, resize, frame loop with clamped time step, pause when hidden, clean dispose, exit button), Soft Glass HTML overlays (mode picker, game over, scoreboard), multi-touch controls (joystick, buttons, steer pads) and keyboard mapping per player, and shared 3D helpers (lights, sky, confetti).
- Each game lives in `src/arena/<game>/` with a pure rules/physics module (no three.js, no DOM) tested by `npm test`, and an app module that draws and runs it.
- Phaser launches each game through one small scene class per game (like `SolarScene`), loading the game code only when chosen.
- The menu gains a fifth tab, "🏆 3D Arena".
- Rules files (`AGENTS.md`, `CLAUDE.md`, `docs/SPEC.md`) change to: mobile first, and desktop browsers are now also supported (keyboard and mouse).
- Phones: two-player modes are offered, but the computer modes come first because the screen is small.

## Goals and non-goals

- Goals: smooth play (aim for 60 fps on a recent iPad, never below 30), clear and colourful 3D, short rounds (2 to 5 minutes), a computer opponent in each game, instant restart.
- Non-goals: online play, accounts, saving anything except best scores, realistic physics.
- Anti-goals: tiny touch targets, hover-only controls, any game that cannot be exited, sound that plays before a tap.

## Left to the builder

Track and course layouts, arena sizes, colours, computer-player behaviour, scoring details and sound choices, as long as the goals above hold and the pure modules have tests.
