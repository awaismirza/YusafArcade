# Tank Commander (rebuild of Tank Trouble) — design

Status: approved by the owner on 2026-11-27 ("Go").

## Why

The owner found the first Tank Trouble "really weird" and wants the 3D games to feel professionally made: smooth, playable, lots of graphics and hurdles. Tanks comes first; Karts, Bomb Blast, Air Hockey and Mini Golf get the same treatment afterwards, one at a time.

## Model

Wii Play: Tanks! (drive and aim separately, shells ricochet, mines, one new enemy type every few missions) with Tank Trouble's power-up crates.

## Decided

- **Controls.** Left stick drives straight away: the hull swings to the stick direction, driving backwards when that is the shorter turn, so there is no spin-before-move. Right side: drag an aim stick (release to fire) or tap a spot to aim there and fire; the turret glides to the aim. A dotted line shows the shell's path including bounces. A mine button. Desktop: W A S D drive, mouse aims, click fires, Space drops a mine; player 2 uses arrows, `,` `.` to turn the turret, Enter to fire, Shift for a mine.
- **Look.** A tilted 3D camera over a toy diorama on a wooden desk: wooden blocks, cork crates you can blow up, holes, toy tanks with turrets and moving treads. Track marks, exhaust smoke, muzzle flash, shell trails, ricochet sparks, explosions with debris and scorch marks, a wreck cross where a tank was destroyed, gentle screen shake.
- **Campaign.** 20 missions on hand-made maps against 8 enemy types (Rookie still and slow; Scout mobile; Sniper fast shells; Miner lays mines; Rapid fires bursts; Bouncer fast shells that bounce twice; Hunter fast and mines; Boss big, 3 hits). Mission intro card names the enemies. Lives: 5. Progress (furthest mission) is remembered on the device if storage allows; the game works without it.
- **Modes.** 1 player campaign; 2 players together in the campaign (same team); Versus for 2–3 players (optionally + computer) on arena maps, first to 5, with power-up crates (laser, triple shot, shield, speed).
- **Rules.** Shells bounce once (Bouncer twice, laser three times), shells destroy each other, shells set off mines, mines blow up crates and tanks nearby, a player can have 5 shells and 2 mines out.
- **Build.** Pure, tested simulation (`sim.ts`), computer players (`ai.ts`) and maps (`levels.ts`); `render.ts` draws and animates; `app.ts` runs modes and input. Replaces the old maze version.

## Left to the builder

Exact map layouts, speeds, colours, effect details and AI tuning, as long as missions get steadily harder, early missions are easy for a 7-year-old, and everything stays smooth on an iPad.

## Build order (plan)

1. `sim.ts` + `levels.ts` with `tests/tank-sim.test.ts` (map parsing and validity, hull steering without spin-before-move, wall/crate/hole collisions, ricochet counts, shell-vs-shell, mines and blast radius, shields and hit points, the shot-path tracer used by the aim line).
2. `ai.ts` with `tests/tank-ai.test.ts` (computer never fires a shot its own tracer says hits itself or a team-mate; bot-vs-bot missions finish; enemies keep away from mines).
3. `render.ts` (diorama, tanks, effects, aim line) and `app.ts` (modes, mission flow, touch and keyboard controls).
4. Verify on iPad, phone and desktop headless (`errors: []`), docs, commit and push.
