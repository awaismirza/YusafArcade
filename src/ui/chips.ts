import Phaser from "phaser";
import { drawGlass } from "./glass";
import { FONT } from "./theme";

export type Chip = {
  container: Phaser.GameObjects.Container;
  /** Changes the text; the pill resizes to fit. Does nothing if the text is unchanged. */
  setText(t: string): void;
  destroy(): void;
};

/** A small dark-glass pill for scores, lives, timers and levels. */
export function addChip(scene: Phaser.Scene, x: number, y: number, opts: { icon?: string; width?: number; depth?: number; color?: string } = {}): Chip {
  const container = scene.add.container(x, y).setDepth(opts.depth ?? 30).setScrollFactor(0);
  const g = scene.add.graphics();
  const text = scene.add.text(0, 0, "", { fontFamily: FONT, fontSize: "20px", color: opts.color ?? "#ffffff", fontStyle: "800" }).setOrigin(0.5);
  container.add([g, text]);
  let last = "\u0000";
  const redraw = (): void => {
    g.clear();
    drawGlass(g, 0, 0, Math.max(opts.width ?? 0, text.width + 36), 40, { tint: 0x1b1640, alpha: 0.5, radius: 20 });
  };
  return {
    container,
    setText(t: string): void {
      const full = opts.icon ? `${opts.icon} ${t}` : t;
      if (full === last) return;
      last = full;
      text.setText(full);
      redraw();
    },
    destroy(): void {
      container.destroy();
    },
  };
}
