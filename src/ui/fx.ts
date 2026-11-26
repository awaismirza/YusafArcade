import Phaser from "phaser";
import { FONT } from "./theme";

const CONFETTI = [0xf87171, 0xfbbf24, 0x34d399, 0x60a5fa, 0xc084fc, 0xffffff];

/** A burst of confetti pieces that fly out, fall and fade. Every piece removes itself. */
export function confetti(scene: Phaser.Scene, x: number, y: number, opts: { count?: number; colors?: number[] } = {}): void {
  const colors = opts.colors ?? CONFETTI;
  const count = opts.count ?? 26;
  for (let i = 0; i < count; i++) {
    const piece = scene.add.rectangle(x, y, 8 + Math.random() * 6, 5 + Math.random() * 4, colors[i % colors.length]).setDepth(90).setScrollFactor(0);
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
    const sp = 140 + Math.random() * 220;
    scene.tweens.add({
      targets: piece,
      x: x + Math.cos(a) * sp,
      y: y + Math.sin(a) * sp + 160,
      angle: (Math.random() - 0.5) * 720,
      alpha: 0,
      duration: 900 + Math.random() * 500,
      ease: "Quad.easeOut",
      onComplete: () => piece.destroy(),
    });
  }
}

/** A short text that pops up, floats and fades, like "+10" or "Great!". */
export function popText(scene: Phaser.Scene, x: number, y: number, text: string, color = "#fde047"): void {
  const t = scene.add
    .text(x, y, text, { fontFamily: FONT, fontSize: "30px", color, fontStyle: "800" })
    .setOrigin(0.5)
    .setDepth(90)
    .setScrollFactor(0)
    .setShadow(0, 3, "rgba(0,0,0,0.4)", 4, false, true)
    .setScale(0.6);
  scene.tweens.add({ targets: t, scale: 1.1, duration: 160, ease: "Back.easeOut" });
  scene.tweens.add({ targets: t, y: y - 60, alpha: 0, delay: 350, duration: 600, ease: "Quad.easeIn", onComplete: () => t.destroy() });
}

/** Two confetti bursts from the lower left and right, for a win. */
export function winBurst(scene: Phaser.Scene): void {
  const w = scene.scale.width;
  const h = scene.scale.height;
  confetti(scene, w * 0.3, h * 0.75, { count: 36 });
  confetti(scene, w * 0.7, h * 0.75, { count: 36 });
}
