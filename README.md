# Yusaf Arcade

2D platformer / runner built with [Phaser 3](https://phaser.io/), TypeScript, and Vite.

**Play it live:** https://awaismirza.github.io/YusafArcade/

## Commands

| Command        | Description                          |
| -------------- | ------------------------------------ |
| `npm install`  | Install dependencies                 |
| `npm run dev`  | Start local dev server (port 5173)   |
| `npm run build`| Production build to `dist/`          |
| `npm run preview` | Serve production build locally  |

## Controls (starter scene)

- **Move:** Arrow keys or A / D  
- **Jump:** Up or W  

## Project layout

```
src/
  config.ts          — world size and physics tuning
  main.ts            — Phaser game config
  scenes/
    BootScene.ts     — generates placeholder textures
    GameScene.ts     — player, platforms, input
```

Arcade physics is enabled by default (good for platformers and endless runners). Matter.js can be added later if you need more complex physics.