import Phaser from "phaser";
import { drawGlass, drawPill } from "./glass";

/**
 * A rounded card tile centred on (x, y). Raised tiles are chunky with a lip (cards, buttons, sliding tiles);
 * flat tiles are soft translucent glass (grid cells).
 */
export function drawTile(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, opts: { raised?: boolean; radius?: number } = {}): void {
  const radius = opts.radius ?? Math.min(18, h / 4);
  if (opts.raised === false) drawGlass(g, x, y, w, h, { tint: color, alpha: 0.55, radius });
  else drawPill(g, x, y, w, h, color, { radius });
}
