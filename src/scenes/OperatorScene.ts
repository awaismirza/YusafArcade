import Phaser from "phaser";
import { FONT } from "../ui/arcadeKit";
import { ChoiceGameScene, GameCfg, Round, pick, shuffle } from "./ChoiceGameScene";

type Op = "+" | "−" | "×" | "÷";
const OPS: Op[] = ["+", "−", "×", "÷"];

function apply(a: number, op: Op, b: number): number | null {
  switch (op) {
    case "+":
      return a + b;
    case "−":
      return a - b;
    case "×":
      return a * b;
    default:
      return b !== 0 && a % b === 0 ? a / b : null;
  }
}

/** Standard order of operations for a op1 b op2 c. */
function applyTwo(a: number, o1: Op, b: number, o2: Op, c: number): number | null {
  const high = (o: Op): boolean => o === "×" || o === "÷";
  if (high(o2) && !high(o1)) {
    const right = apply(b, o2, c);
    return right === null ? null : apply(a, o1, right);
  }
  const left = apply(a, o1, b);
  return left === null ? null : apply(left, o2, c);
}

export class OperatorScene extends ChoiceGameScene {
  protected readonly cfg: GameCfg = {
    title: "Missing Sign ➕",
    subtitle: "Which sign makes the equation true?\n+  −  ×  ÷",
    bg: 0x3b0764,
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
    if (tier === 1 && Math.random() < 0.45) return this.twoStep();

    for (let attempt = 0; attempt < 80; attempt++) {
      const op = pick(tier === 0 ? OPS.slice(0, 3) : OPS);
      let a: number;
      let b: number;
      if (op === "+") {
        a = Phaser.Math.Between(2, tier === 0 ? 12 : 60);
        b = Phaser.Math.Between(2, tier === 0 ? 12 : 60);
      } else if (op === "−") {
        a = Phaser.Math.Between(6, tier === 0 ? 20 : 99);
        b = Phaser.Math.Between(2, a - 1);
      } else if (op === "×") {
        a = Phaser.Math.Between(2, tier === 0 ? 6 : 12);
        b = Phaser.Math.Between(2, tier === 0 ? 6 : 12);
      } else {
        b = Phaser.Math.Between(2, 12);
        a = b * Phaser.Math.Between(2, 12);
      }
      const c = apply(a, op, b) as number;
      // every other sign must give a different answer
      const clash = OPS.some((o) => o !== op && apply(a, o, b) === c);
      if (clash) continue;
      return {
        prompt: "Pick the missing sign",
        visual: () => this.eq(`${a}  □  ${b}  =  ${c}`),
        options: OPS as string[],
        correct: OPS.indexOf(op),
        explain: `${a} ${op} ${b} = ${c}`,
        cols: 4,
        w: 190,
        fontSize: 52,
      };
    }
    return { prompt: "Pick the missing sign", visual: () => this.eq("6  □  3  =  9"), options: OPS as string[], correct: 0, explain: "6 + 3 = 9", cols: 4, w: 190, fontSize: 52 };
  }

  private twoStep(): Round {
    for (let attempt = 0; attempt < 200; attempt++) {
      const o1 = pick(OPS);
      const o2 = pick(OPS);
      const a = Phaser.Math.Between(2, 12);
      const b = Phaser.Math.Between(2, 12);
      const c = Phaser.Math.Between(2, 9);
      const d = applyTwo(a, o1, b, o2, c);
      if (d === null || d < 0 || d > 150) continue;
      const rightPair = `${o1} ${o2}`;
      const others: string[] = [];
      for (const p of shuffle(OPS)) {
        for (const q of shuffle(OPS)) {
          const pair = `${p} ${q}`;
          if (pair !== rightPair && applyTwo(a, p, b, q, c) !== d) others.push(pair);
        }
      }
      if (others.length < 3) continue;
      const options = shuffle([rightPair, ...others.slice(0, 3)]);
      return {
        prompt: "Pick both missing signs (multiply and divide go first!)",
        visual: () => this.eq(`${a} □ ${b} □ ${c} = ${d}`),
        options,
        correct: options.indexOf(rightPair),
        explain: `${a} ${o1} ${b} ${o2} ${c} = ${d}`,
        cols: 4,
        w: 190,
        fontSize: 40,
      };
    }
    return this.makeRound(0);
  }
}
