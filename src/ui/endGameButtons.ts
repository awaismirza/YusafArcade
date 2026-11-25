import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";

export function addEndGameButtons(
  scene: Phaser.Scene,
  onRestart: () => void,
  onMenu: () => void
): void {
  const y = GAME_HEIGHT - 118;
  const mk = (x: number, label: string, color: number, action: () => void): void => {
    const w = 220;
    const h = 58;
    const bg = scene.add
      .rectangle(x, y, w, h, color, 0.92)
      .setScrollFactor(0)
      .setDepth(95)
      .setStrokeStyle(2, 0xffffff, 0.15)
      .setInteractive({ useHandCursor: true });
    const txt = scene.add
      .text(x, y, label, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "20px",
        color: "#ffffff",
        fontStyle: "700",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(96)
      .setInteractive({ useHandCursor: true });
    const run = (): void => action();
    bg.on("pointerdown", run);
    txt.on("pointerdown", run);
  };

  mk(GAME_WIDTH / 2 - 130, "Restart", 0x15803d, onRestart);
  mk(GAME_WIDTH / 2 + 130, "Main Menu", 0x1d4ed8, onMenu);
}