import Phaser from "phaser";
import { FONT } from "../ui/arcadeKit";
import { operatorRound } from "../games/rounds/operator";
import { ChoiceGameScene, GameCfg, Round } from "./ChoiceGameScene";

export class OperatorScene extends ChoiceGameScene {
  protected readonly cfg: GameCfg = {
    title: "Missing Sign ➕",
    subtitle: "Which sign makes the equation true?\n+  −  ×  ÷",
    bg: 0x3b0764,
    palette: "operator",
    end: "Sign Master!",
    best: "operator",
  };

  constructor() {
    super("Operator");
  }

  private eq(text: string): Phaser.GameObjects.GameObject[] {
    return [this.add.text(480, 175, text, { fontFamily: FONT, fontSize: "58px", color: "#ffffff", fontStyle: "700" }).setOrigin(0.5)];
  }

  protected makeRound(tier: 0 | 1): Round {
    const r = operatorRound(tier, Math.random);
    const v = r.visual;
    return { ...r, visual: v && v.kind === "text" ? () => this.eq(v.text) : undefined };
  }
}
