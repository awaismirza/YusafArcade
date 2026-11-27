import "@fontsource/nunito/latin-600.css";
import "@fontsource/nunito/latin-700.css";
import "@fontsource/nunito/latin-800.css";
import Phaser from "phaser";
import { withTimeout } from "./ui/gestureMath";
import { addSoftBackdrop } from "./ui/glass";
import { GAME_HEIGHT, GAME_WIDTH, PHYSICS } from "./config";
import { gameAudio } from "./audio/sfx";
import { deviceUsesTouch, touchPad } from "./input/touchPad";
import { BootScene } from "./scenes/BootScene";
import { BreakerScene } from "./scenes/BreakerScene";
import { DodgerScene } from "./scenes/DodgerScene";
import { FlappyScene } from "./scenes/FlappyScene";
import { StackScene } from "./scenes/StackScene";
import { CatchScene } from "./scenes/CatchScene";
import { MathScene } from "./scenes/MathScene";
import { PatternScene } from "./scenes/PatternScene";
import { QuizScene } from "./scenes/QuizScene";
import { WordScene } from "./scenes/WordScene";
import { MemoryScene } from "./scenes/MemoryScene";
import { SnakeScene } from "./scenes/SnakeScene";
import { WhackScene } from "./scenes/WhackScene";
import { GameOverScene } from "./scenes/GameOverScene";
import { GameScene } from "./scenes/GameScene";
import { MenuScene } from "./scenes/MenuScene";
import { ClockScene } from "./scenes/ClockScene";
import { FractionsScene } from "./scenes/FractionsScene";
import { OddScene } from "./scenes/OddScene";
import { OperatorScene } from "./scenes/OperatorScene";
import { RobotScene } from "./scenes/RobotScene";
import { ShapesScene } from "./scenes/ShapesScene";
import { SimonScene } from "./scenes/SimonScene";
import { SlideScene } from "./scenes/SlideScene";
import { SudokuScene } from "./scenes/SudokuScene";
import { WorldScene } from "./scenes/WorldScene";
import { SolarScene } from "./scenes/SolarScene";
import { BombsScene, GolfScene, HockeyScene, KartsScene, TanksScene } from "./scenes/ArenaScenes";
import { CheckersScene } from "./scenes/CheckersScene";
import { ChessScene } from "./scenes/ChessScene";
import { LudoScene } from "./scenes/LudoScene";
import { SnakesScene } from "./scenes/SnakesScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#1a1b26",
  input: {
    activePointers: 4,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: PHYSICS.gravityY },
      debug: false,
    },
  },
  scene: [BootScene, MenuScene, GameScene, GameOverScene, FlappyScene, DodgerScene, BreakerScene, StackScene, SnakeScene, WhackScene, MemoryScene, CatchScene, MathScene, WordScene, PatternScene, QuizScene, ClockScene, ShapesScene, WorldScene, OddScene, FractionsScene, OperatorScene, SimonScene, SlideScene, SudokuScene, RobotScene, SolarScene, CheckersScene, ChessScene, LudoScene, SnakesScene, KartsScene, BombsScene, HockeyScene, TanksScene, GolfScene],
};

// Load the bundled font before the first scene draws text. If it is slow or fails, start anyway with the fallback font.
await withTimeout(
  Promise.all([document.fonts.load("600 16px Nunito"), document.fonts.load("700 16px Nunito"), document.fonts.load("800 16px Nunito")]).then(() => undefined),
  1500,
  undefined
);

const game = new Phaser.Game(config);
// Testing aid: with ?debug=1 in the address, scripts/audit-targets.cjs can inspect the running game.
if (new URLSearchParams(window.location.search).get("debug") === "1") (window as unknown as { __yusaf?: Phaser.Game }).__yusaf = game;

// Every scene gets the soft backdrop unless it has already set its own gradient background.
game.events.once(Phaser.Core.Events.READY, () => {
  game.scene.getScenes(false).forEach((sc) => sc.events.on(Phaser.Scenes.Events.CREATE, () => addSoftBackdrop(sc)));
});

function holdButton(id: string, down: () => void, up: () => void): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    try {
      el.setPointerCapture(event.pointerId);
    } catch {
      // iPad Chrome drops the pointer if the browser chrome moves.
    }
    gameAudio.unlock();
    down();
  });
  const release = (event: PointerEvent): void => {
    if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
    up();
  };
  el.addEventListener("pointerup", release);
  el.addEventListener("pointercancel", release);
}

function bindTouchControls(): void {
  if (!deviceUsesTouch()) return;
  window.addEventListener("contextmenu", (event) => event.preventDefault());

  holdButton(
    "btn-jump",
    () => {
      touchPad.jumpHeld = true;
    },
    () => {
      touchPad.jumpHeld = false;
    }
  );
  holdButton(
    "btn-duck",
    () => {
      touchPad.duckHeld = true;
    },
    () => {
      touchPad.duckHeld = false;
    }
  );
  holdButton(
    "btn-sword",
    () => {
      touchPad.swordTap = true;
    },
    () => undefined
  );
  holdButton(
    "btn-shoot",
    () => {
      touchPad.runTap = true;
      touchPad.shootTap = true;
      touchPad.retryTap = true;
      window.dispatchEvent(new Event("yusaf-retry"));
    },
    () => undefined
  );
  holdButton(
    "btn-flap",
    () => {
      touchPad.flapTap = true;
    },
    () => undefined
  );
  holdButton(
    "btn-flap-menu",
    () => {
      touchPad.menuTap = true;
    },
    () => undefined
  );
  holdButton(
    "btn-restart",
    () => {
      touchPad.restartTap = true;
      touchPad.retryTap = true;
      window.dispatchEvent(new Event("yusaf-retry"));
    },
    () => undefined
  );
  holdButton(
    "btn-main-menu",
    () => {
      touchPad.menuTap = true;
      window.dispatchEvent(new Event("yusaf-menu"));
    },
    () => undefined
  );
}

function keepCanvasFitted(): void {
  const parent = document.getElementById("game");
  if (!parent || parent.clientWidth < 2 || parent.clientHeight < 2) return;
  game.scale.refresh();
}

function wakeGame(): void {
  game.loop.resetDelta();
  if (!game.loop.running) game.loop.wake();
}

bindTouchControls();
document.addEventListener(
  "touchmove",
  (event) => {
    // let scrollable panels (e.g. the Solar Explorer info card) scroll
    if ((event.target as Element | null)?.closest?.("[data-scroll]")) return;
    event.preventDefault();
  },
  { passive: false }
);
window.addEventListener("resize", keepCanvasFitted);
window.addEventListener("orientationchange", () => {
  window.setTimeout(keepCanvasFitted, 80);
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") wakeGame();
});
window.addEventListener("focus", wakeGame);
game.canvas.addEventListener(
  "webglcontextlost",
  (event) => {
    event.preventDefault();
    window.setTimeout(() => window.location.reload(), 250);
  },
  false
);