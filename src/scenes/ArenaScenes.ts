import Phaser from "phaser";
import { FONT } from "../ui/theme";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { setTouchChrome } from "../input/touchChrome";
import { gameAudio } from "../audio/sfx";

type Starter = (onExit: () => void) => () => void;

/** A Phaser scene that hands the whole screen to one of the full-screen 3D Arena games. */
function arenaScene(key: string, loading: string, load: () => Promise<{ start: Starter }>): typeof Phaser.Scene {
  return class extends Phaser.Scene {
    private dispose: (() => void) | null = null;
    private closed = false;

    constructor() {
      super({ key });
    }

    create(): void {
      this.closed = false;
      setTouchChrome("hidden");
      this.cameras.main.setBackgroundColor(0x120d2e);
      const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, loading, { fontFamily: FONT, fontSize: "26px", color: "#ffffff", fontStyle: "800" }).setOrigin(0.5);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.closed = true;
        this.dispose?.();
        this.dispose = null;
        gameAudio.stopMusic();
      });
      load()
        .then(({ start }) => {
          if (this.closed) return;
          this.dispose = start(() => this.scene.start("Menu"));
          text.destroy();
        })
        .catch(() => text.setText("Sorry, this 3D game could not start on this device."));
    }
  };
}

export const KartsScene = arenaScene("Karts", "Warming up the engines… 🏎️", () => import("../arena/karts/app"));
export const BombsScene = arenaScene("Bombs", "Building the arena… 💣", () => import("../arena/bombs/app"));
export const HockeyScene = arenaScene("Hockey", "Polishing the ice… 🏒", () => import("../arena/hockey/app"));
export const TanksScene = arenaScene("Tanks", "Rolling out the tanks… 🛡️", () => import("../arena/tanks/app"));
export const GolfScene = arenaScene("Golf", "Mowing the greens… ⛳", () => import("../arena/golf/app"));
