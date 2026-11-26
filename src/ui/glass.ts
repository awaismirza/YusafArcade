import Phaser from "phaser";
import { GLASS, shade } from "./theme";

const W = 960;
const H = 540;

type GlassOpts = { radius?: number; tint?: number; alpha?: number };

/** A frosted-glass panel centred on (x, y): soft shadow, translucent fill, lighter top band and a bright edge. */
export function drawGlass(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, opts: GlassOpts = {}): void {
  const r = Math.min(opts.radius ?? GLASS.radius, h / 2, w / 2);
  const tint = opts.tint ?? GLASS.fill;
  const alpha = opts.alpha ?? GLASS.fillAlpha;
  const left = x - w / 2;
  const top = y - h / 2;
  g.fillStyle(0x000000, GLASS.shadowAlpha);
  g.fillRoundedRect(left, top + 4, w, h, r);
  g.fillStyle(tint, alpha);
  g.fillRoundedRect(left, top, w, h, r);
  g.fillStyle(0xffffff, 0.12);
  g.fillRoundedRect(left + 2, top + 2, w - 4, h * 0.45, Math.max(2, r - 2));
  g.lineStyle(1.5, 0xffffff, GLASS.edgeAlpha);
  g.strokeRoundedRect(left, top, w, h, r);
}

/** A chunky filled button body centred on (x, y): darker lip underneath, glossy top band, light edge. */
export function drawPill(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
  opts: { pressed?: boolean; radius?: number } = {}
): void {
  const r = Math.min(opts.radius ?? h / 2.4, h / 2, w / 2);
  const left = x - w / 2;
  const top = y - h / 2 + (opts.pressed ? 3 : 0);
  const lip = opts.pressed ? 1 : 5;
  g.fillStyle(0x000000, 0.2);
  g.fillRoundedRect(left, top + lip + 2, w, h - 3, r);
  g.fillStyle(shade(color, -0.32), 1);
  g.fillRoundedRect(left, top + lip, w, h - 3, r);
  g.fillStyle(color, 1);
  g.fillRoundedRect(left, top, w, h - 3, r);
  g.fillStyle(shade(color, 0.35), 0.55);
  g.fillRoundedRect(left + 3, top + 3, w - 6, (h - 3) * 0.42, Math.max(2, r - 3));
  g.lineStyle(1.5, 0xffffff, 0.35);
  g.strokeRoundedRect(left, top, w, h - 3, r);
}

/** A soft full-screen wash and a few faint circles behind everything. Safe to call more than once per scene. */
export function addSoftBackdrop(scene: Phaser.Scene): void {
  if (scene.data.get("softBackdrop")) return;
  scene.data.set("softBackdrop", true);
  const g = scene.add.graphics().setDepth(-100).setScrollFactor(0);
  g.fillGradientStyle(0xffffff, 0xffffff, 0x000000, 0x000000, 0.1, 0.1, 0.24, 0.24);
  g.fillRect(0, 0, W, H);
  g.fillStyle(0xffffff, 0.05);
  g.fillCircle(150, 110, 170);
  g.fillCircle(830, 430, 230);
  g.fillStyle(0xffffff, 0.04);
  g.fillCircle(600, 40, 110);
}
