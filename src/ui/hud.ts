import Phaser from "phaser";
import { drawGlass } from "./glass";
import { FONT } from "./theme";
import { boardChrome } from "./boardChrome";

/**
 * Floating status display for full-screen 3D boards: a large status line at the top, a smaller hint at the
 * bottom and a compact counter at the top right. Each sits on a translucent pill so it stays readable over
 * any part of the board. Non-interactive, so taps pass through to the 3D scene.
 */
export class Hud {
  private readonly status: Phaser.GameObjects.Text;
  private readonly detail: Phaser.GameObjects.Text;
  private readonly counts: Phaser.GameObjects.Text;
  private readonly pills: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.pills = scene.add.graphics().setDepth(5);
    this.status = scene.add
      .text(480, 36, "", { fontFamily: FONT, fontSize: "30px", color: "#ffffff", fontStyle: "800", align: "center" })
      .setOrigin(0.5)
      .setDepth(6);
    this.detail = scene.add
      .text(480, 506, "", { fontFamily: FONT, fontSize: "19px", color: "#efeaff", align: "center", fontStyle: "600", wordWrap: { width: 760 }, lineSpacing: 4 })
      .setOrigin(0.5)
      .setDepth(6);
    this.counts = scene.add
      .text(944, 36, "", { fontFamily: FONT, fontSize: "18px", color: "#e4defc", align: "right", fontStyle: "700" })
      .setOrigin(1, 0.5)
      .setDepth(6);
  }

  setStatus(text: string): void {
    this.status.setText(text);
    this.redraw();
  }

  setDetail(text: string): void {
    this.detail.setText(text);
    this.redraw();
  }

  setCounts(text: string): void {
    this.counts.setText(text);
    this.redraw();
  }

  setVisible(visible: boolean): void {
    boardChrome.setVisible(visible);
    this.status.setVisible(visible);
    this.detail.setVisible(visible);
    this.counts.setVisible(visible);
    this.pills.setVisible(visible);
  }

  private redraw(): void {
    const g = this.pills;
    g.clear();
    // On iPads the bars above and below the board show these instead, so the board stays clear.
    const outside = boardChrome.isActive();
    for (const t of [this.status, this.detail, this.counts]) t.setAlpha(outside ? 0 : 1);
    if (outside) {
      boardChrome.setText("status", this.status.text);
      boardChrome.setText("detail", this.detail.text);
      boardChrome.setText("counts", this.counts.text);
      return;
    }
    const pill = (t: Phaser.GameObjects.Text, padX: number, padY: number): void => {
      if (!t.text) return;
      const w = t.width + padX * 2;
      const h = t.height + padY * 2;
      const left = t.x - t.originX * t.width - padX;
      const top = t.y - t.originY * t.height - padY;
      drawGlass(g, left + w / 2, top + h / 2, w, h, { tint: 0x1b1640, alpha: 0.5, radius: Math.min(24, h / 2) });
    };
    pill(this.status, 22, 8);
    pill(this.detail, 18, 8);
    pill(this.counts, 14, 7);
  }
}
