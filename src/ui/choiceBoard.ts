import Phaser from "phaser";
import { Btn, makeButton } from "./arcadeKit";

/** A grid of answer buttons. Calls onPick once, colours right/wrong, then locks. */
export class ChoiceBoard {
  private btns: Btn[] = [];
  private locked = false;

  constructor(
    private scene: Phaser.Scene,
    private centerX: number,
    private topY: number,
    private cols = 2,
    private w = 380,
    private h = 76
  ) {}

  show(options: string[], correct: number, onPick: (ok: boolean) => void, fontSize = 26): void {
    this.clear();
    this.locked = false;
    options.forEach((label, i) => {
      const col = i % this.cols;
      const row = Math.floor(i / this.cols);
      const x = this.centerX + (col - (this.cols - 1) / 2) * (this.w + 20);
      const y = this.topY + row * (this.h + 16);
      const b = makeButton(
        this.scene,
        x,
        y,
        this.w,
        this.h,
        label,
        0x334155,
        () => {
          if (this.locked) return;
          this.locked = true;
          const ok = i === correct;
          b.rect.setFillStyle(ok ? 0x16a34a : 0xdc2626);
          if (!ok) this.btns[correct].rect.setFillStyle(0x16a34a);
          onPick(ok);
        },
        fontSize,
        20
      );
      this.btns.push(b);
    });
  }

  lock(): void {
    this.locked = true;
  }

  clear(): void {
    this.btns.forEach((b) => b.container.destroy());
    this.btns = [];
  }
}
