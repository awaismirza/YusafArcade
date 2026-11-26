import Phaser from "phaser";
import { shade } from "./theme";

/** A glass track with a glossy fill, for progress through a quiz, a level or a timer. `set` takes 0 to 1. */
export function addProgress(scene: Phaser.Scene, x: number, y: number, w: number, color: number): { set(fraction: number): void; destroy(): void } {
  const g = scene.add.graphics().setDepth(20);
  const h = 14;
  let last = -1;
  const draw = (f: number): void => {
    g.clear();
    g.fillStyle(0x000000, 0.28);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, h / 2);
    g.lineStyle(1.5, 0xffffff, 0.3);
    g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, h / 2);
    const fw = Math.max(0, Math.min(1, f)) * (w - 4);
    if (fw > 2) {
      g.fillStyle(color, 1);
      g.fillRoundedRect(x - w / 2 + 2, y - h / 2 + 2, fw, h - 4, (h - 4) / 2);
      g.fillStyle(shade(color, 0.4), 0.6);
      g.fillRoundedRect(x - w / 2 + 4, y - h / 2 + 3, Math.max(0, fw - 4), 3, 1.5);
    }
  };
  draw(0);
  return {
    set(f: number): void {
      if (Math.abs(f - last) < 0.001) return;
      last = f;
      draw(f);
    },
    destroy(): void {
      g.destroy();
    },
  };
}
