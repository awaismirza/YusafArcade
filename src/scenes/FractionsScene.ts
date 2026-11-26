import Phaser from "phaser";
import { FONT } from "../ui/arcadeKit";
import { ChoiceGameScene, GameCfg, Round, pick, shuffle, withAnswer } from "./ChoiceGameScene";

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

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
    const roll = Math.random();

    // 1) Name the shaded fraction
    if (tier === 0 || roll < 0.4) {
      const n = tier === 0 ? pick([2, 3, 4, 5, 6, 8]) : pick([5, 6, 8, 9, 10, 12]);
      const k = Phaser.Math.Between(1, n - 1);
      const wrong = [`${Math.min(n - 1, k + 1)}/${n}`, `${Math.max(1, k - 1)}/${n}`, `${n - k}/${n}`, `${k}/${n + 1}`, `${k}/${Math.max(2, n - 1)}`, `${k}/${n + 2}`, `${k + 1}/${n + 1}`, ...Array.from({ length: n - 1 }, (_, j) => `${j + 1}/${n}`)];
      const o = withAnswer(`${k}/${n}`, shuffle(wrong));
      return {
        prompt: "What fraction of the pizza is orange?",
        visual: () => this.drawPizza(k, n),
        options: o.options,
        correct: o.correct,
        explain: `${k} of the ${n} equal slices are orange, so the fraction is ${k}/${n}.`,
        cols: 4,
        w: 190,
        fontSize: 38,
      };
    }

    // 2) Equivalent fractions
    if (roll < 0.7) {
      const base = pick<[number, number]>([[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 5]]);
      const m = pick([2, 3, 4]);
      const right = `${base[0] * m}/${base[1] * m}`;
      const wrong: string[] = [];
      let guard = 0;
      while (wrong.length < 6 && guard++ < 60) {
        const d = Phaser.Math.Between(2, 12);
        const nn = Phaser.Math.Between(1, d - 1);
        if (nn * base[1] !== d * base[0]) wrong.push(`${nn}/${d}`);
      }
      const o = withAnswer(right, wrong);
      return {
        prompt: `Which fraction is equal to ${base[0]}/${base[1]}?`,
        visual: () => this.bigText(`${base[0]}/${base[1]} = ?`),
        options: o.options,
        correct: o.correct,
        explain: `Multiply the top and bottom of ${base[0]}/${base[1]} by ${m} to get ${right}.`,
        cols: 4,
        w: 190,
        fontSize: 38,
      };
    }

    // 3) Which is bigger?
    let a: [number, number];
    let b: [number, number];
    let guard = 0;
    do {
      const d1 = Phaser.Math.Between(2, 10);
      const d2 = Phaser.Math.Between(2, 10);
      a = [Phaser.Math.Between(1, d1 - 1), d1];
      b = [Phaser.Math.Between(1, d2 - 1), d2];
    } while ((a[0] * b[1] === b[0] * a[1] || gcd(a[0], a[1]) !== 1 || gcd(b[0], b[1]) !== 1) && guard++ < 80);
    const fa = `${a[0]}/${a[1]}`;
    const fb = `${b[0]}/${b[1]}`;
    const bigger = a[0] * b[1] > b[0] * a[1] ? fa : fb;
    const options = [fa, fb];
    return {
      prompt: "Which fraction is bigger?",
      visual: () => this.bigText(`${fa}   or   ${fb}`),
      options,
      correct: options.indexOf(bigger),
      explain: `${bigger} is bigger. Cross-multiply: ${a[0]}×${b[1]} = ${a[0] * b[1]} and ${b[0]}×${a[1]} = ${b[0] * a[1]}.`,
      cols: 2,
      w: 260,
      fontSize: 40,
    };
  }
}
