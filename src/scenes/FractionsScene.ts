import Phaser from "phaser";
import { FONT } from "../ui/arcadeKit";
import { fractionRound } from "../games/rounds/fractions";
import { ChoiceGameScene, GameCfg, Round } from "./ChoiceGameScene";

export class FractionsScene extends ChoiceGameScene {
  protected readonly cfg: GameCfg = {
    title: "Fraction Pizza 🍕",
    subtitle: "Slices, fractions and comparing!",
    bg: 0x7f1d1d,
    palette: "fractions",
    end: "Fraction Hero!",
    best: "fractions",
  };

  constructor() {
    super("Fractions");
  }

  private drawPizza(k: number, n: number): Phaser.GameObjects.GameObject[] {
    const g = this.add.graphics();
    const cx = 480;
    const cy = 178;
    const r = 62;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
      g.fillStyle(i < k ? 0xf97316 : 0xfef3c7, 1);
      g.slice(cx, cy, r, a0, a1, false);
      g.fillPath();
      g.lineStyle(3, 0x7c2d12, 1);
      g.slice(cx, cy, r, a0, a1, false);
      g.strokePath();
    }
    return [g];
  }

  private bigText(text: string): Phaser.GameObjects.GameObject[] {
    return [this.add.text(480, 175, text, { fontFamily: FONT, fontSize: "56px", color: "#ffffff", fontStyle: "700" }).setOrigin(0.5)];
  }

  protected makeRound(tier: 0 | 1): Round {
    const r = fractionRound(tier, Math.random);
    const v = r.visual;
    return { ...r, visual: v ? () => (v.kind === "pizza" ? this.drawPizza(v.k, v.n) : this.bigText(v.text)) : undefined };
  }
}
