import Phaser from "phaser";
import type { GamePalette } from "./palettes";

/** A full-screen vertical gradient behind everything, plus a few faint circles. Marks the scene so the global soft wash skips it. */
export function setGradientBackground(scene: Phaser.Scene, p: GamePalette): void {
  scene.data.set("softBackdrop", true);
  scene.cameras.main.setBackgroundColor(p.top);
  const g = scene.add.graphics().setDepth(-200).setScrollFactor(0);
  g.fillGradientStyle(p.top, p.top, p.bottom, p.bottom, 1);
  g.fillRect(0, 0, 960, 540);
  g.fillStyle(0xffffff, 0.05);
  g.fillCircle(150, 110, 170);
  g.fillCircle(830, 430, 230);
}
