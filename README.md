# Yusaf Arcade

A collection of arcade, learning, puzzle and board games for kids, built with [Phaser 3](https://phaser.io/), [three.js](https://threejs.org/), TypeScript and Vite. Made to be played on an iPad.

**Play it live:** https://awaismirza.github.io/YusafArcade/

## Games

- **Arcade, Learn, Puzzles:** runner, flappy, snake, maths, words, clock, sudoku and more.
- **Board Games (3D, vs the computer or 2 to 4 players on one iPad):** Checkers, Chess, Ludo, Snakes & Ladders. Pinch, twist and tilt with two fingers, or use the View button, to look from other angles.

## Commands

| Command | Description |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Start the local dev server (port 5173) |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the rules tests (chess, checkers, Ludo, Snakes & Ladders) |

## Project rules

Every game must work on an iPad browser and multiplayer is local only (pass-and-play). See [`AGENTS.md`](AGENTS.md) and [`docs/SPEC.md`](docs/SPEC.md).

## Deploying

The site is built locally and published to the `gh-pages` branch (no GitHub Actions build). In the repository settings, Pages must use **Deploy from a branch: `gh-pages` / root**.
