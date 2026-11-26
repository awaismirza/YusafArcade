import Phaser from "phaser";
import { FONT } from "../ui/theme";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { deviceUsesTouch, touchPad } from "../input/touchPad";
import { setTouchChrome } from "../input/touchChrome";
import { addEndGameButtons } from "../ui/endGameButtons";

export class GameOverScene extends Phaser.Scene {
  private score = 0;
  private coins = 0;
  private restarting = false;

  constructor() {
    super({ key: "GameOver" });
  }

  init(data: { score: number; coins?: number }): void {
    this.score = data.score ?? 0;
    this.coins = data.coins ?? 0;
    this.restarting = false;
    touchPad.retryTap = false;
    touchPad.restartTap = false;
    touchPad.menuTap = false;
  }

  create(): void {
    setTouchChrome("gameover");
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setTouchChrome("hidden"));

    this.cameras.main.setBackgroundColor(0x0f0f14);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 100, "Game Over", {
        fontFamily: FONT,
        fontSize: "48px",
        color: "#fc8181",
      })
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 - 40,
        `Distance ${Math.floor(this.score)} m   ·   Coins ${this.coins}`,
        {
          fontFamily: FONT,
          fontSize: "22px",
          color: "#e2e8f0",
        }
      )
      .setOrigin(0.5);

    addEndGameButtons(
      this,
      () => this.restart(),
      () => this.goMenu()
    );

    const hint = deviceUsesTouch()
      ? "Or use the Restart / Main Menu buttons below"
      : "SPACE restarts · M opens main menu";
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 36, hint, {
        fontFamily: FONT,
        fontSize: "15px",
        color: "#94a3b8",
      })
      .setOrigin(0.5);

    this.input.keyboard?.once("keydown-SPACE", () => this.restart());
    this.input.keyboard?.once("keydown-M", () => this.goMenu());
    const retry = (): void => this.restart();
    const menu = (): void => this.goMenu();
    window.addEventListener("yusaf-retry", retry);
    window.addEventListener("yusaf-menu", menu);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener("yusaf-retry", retry);
      window.removeEventListener("yusaf-menu", menu);
    });
  }

  update(): void {
    if (touchPad.restartTap || touchPad.retryTap) {
      touchPad.restartTap = false;
      touchPad.retryTap = false;
      this.restart();
    }
    if (touchPad.menuTap) {
      touchPad.menuTap = false;
      this.goMenu();
    }
  }

  private restart(): void {
    if (this.restarting) return;
    this.restarting = true;
    touchPad.restartTap = false;
    touchPad.retryTap = false;
    this.scene.start("Game");
  }

  private goMenu(): void {
    if (this.restarting) return;
    this.restarting = true;
    touchPad.menuTap = false;
    this.scene.start("Menu");
  }
}