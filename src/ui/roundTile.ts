import Phaser from "phaser";
import { drawTile } from "./tiles";

/**
 * A rounded tile that behaves like a Phaser Rectangle for the bits scenes use:
 * setFillStyle, setInteractive (via its size), tweening scale, destroy.
 */
export class RoundTile extends Phaser.GameObjects.Container {
  private g: Phaser.GameObjects.Graphics;
  private tw: number;
  private th: number;
  private opts: { raised?: boolean; radius?: number };

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, color: number, opts: { raised?: boolean; radius?: number } = {}) {
    super(scene, x, y);
    this.tw = w;
    this.th = h;
    this.opts = opts;
    this.g = scene.add.graphics();
    this.add(this.g);
    this.setSize(w, h);
    scene.add.existing(this);
    this.setFillStyle(color);
  }

  setFillStyle(color: number, _alpha?: number): this {
    this.g.clear();
    drawTile(this.g, 0, 0, this.tw, this.th, color, this.opts);
    return this;
  }

  /** Kept so scenes written for Rectangle still compile; tiles draw their own edge. */
  setStrokeStyle(..._args: unknown[]): this {
    return this;
  }
}
