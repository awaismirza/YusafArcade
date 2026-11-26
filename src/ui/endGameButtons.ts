import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { drawPill } from "./glass";
import { ACCENT, FONT } from "./theme";

/** Restart and Main Menu buttons shown on every game-over screen. */
export function addEndGameButtons(scene: Phaser.Scene, onRestart: () => void, onMenu: () => void): void {
  const y = GAME_HEIGHT - 104;
  const mk = (x: number, label: string, color: number, action: () => void): void => {
    const w = 236;
    const h = 66;
    const g = scene.add.graphics().setScrollFactor(0).setDepth(95);
    const paint = (pressed: boolean): void => {
      g.clear();
      drawPill(g, x, y, w, h, color, { pressed });
    };
    paint(false);
    scene.add
      .text(x, y - 1, label, { fontFamily: FONT, fontSize: "24px", color: "#ffffff", fontStyle: "800" })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(96)
      .setShadow(0, 2, "rgba(0,0,0,0.28)", 0, false, true);
    const zone = scene.add.rectangle(x, y, w, h, 0xffffff, 0.001).setScrollFactor(0).setDepth(97).setInteractive({ useHandCursor: true });
    zone.on("pointerdown", () => {
      paint(true);
      action();
    });
  };

  mk(GAME_WIDTH / 2 - 135, "Restart", ACCENT.green, onRestart);
  mk(GAME_WIDTH / 2 + 135, "Main Menu", ACCENT.indigo, onMenu);
}
