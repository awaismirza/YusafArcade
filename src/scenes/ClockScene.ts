import Phaser from "phaser";
import { FONT } from "../ui/arcadeKit";
import { ChoiceGameScene, GameCfg, Round, pick, shuffle, withAnswer } from "./ChoiceGameScene";

const fmt = (h: number, m: number): string => `${h}:${String(m).padStart(2, "0")}`;
const wrapH = (h: number): number => ((h + 11) % 12) + 1;

export class ClockScene extends ChoiceGameScene {
  protected readonly cfg: GameCfg = {
    title: "Clock Reader ⏰",
    subtitle: "Read the clock and pick the right time!",
    bg: 0x0c4a6e,
    end: "Time Master!",
    best: "clock",
  };

  constructor() {
    super("Clock");
  }

  private drawClock(h: number, m: number): Phaser.GameObjects.GameObject[] {
    const objs: Phaser.GameObjects.GameObject[] = [];
    const cx = 480;
    const cy = 178;
    const r = 62;
    const g = this.add.graphics();
    objs.push(g);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(cx, cy, r + 4);
    g.lineStyle(5, 0x0f172a, 1);
    g.strokeCircle(cx, cy, r + 4);
    for (let i = 0; i < 12; i++) {
      const a = Phaser.Math.DegToRad(i * 30 - 90);
      g.lineStyle(2, 0x475569, 1);
      g.lineBetween(cx + Math.cos(a) * (r - 6), cy + Math.sin(a) * (r - 6), cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      const n = i === 0 ? 12 : i;
      objs.push(
        this.add
          .text(cx + Math.cos(a) * (r - 19), cy + Math.sin(a) * (r - 19), String(n), { fontFamily: FONT, fontSize: "14px", color: "#0f172a", fontStyle: "700" })
          .setOrigin(0.5)
      );
    }
    const hourA = Phaser.Math.DegToRad(((h % 12) + m / 60) * 30 - 90);
    const minA = Phaser.Math.DegToRad(m * 6 - 90);
    g.lineStyle(6, 0x0f172a, 1);
    g.lineBetween(cx, cy, cx + Math.cos(hourA) * 32, cy + Math.sin(hourA) * 32);
    g.lineStyle(4, 0x2563eb, 1);
    g.lineBetween(cx, cy, cx + Math.cos(minA) * 48, cy + Math.sin(minA) * 48);
    g.fillStyle(0xdc2626, 1);
    g.fillCircle(cx, cy, 4);
    return objs;
  }

  protected makeRound(tier: 0 | 1): Round {
    const h = Phaser.Math.Between(1, 12);
    const m = tier === 0 ? pick([0, 30]) : pick([0, 5, 10, 15, 15, 20, 25, 30, 35, 40, 45, 45, 50, 55]);
    const correct = fmt(h, m);

    const wrong: string[] = [];
    if (m % 5 === 0 && m !== 0) wrong.push(fmt(m / 5, ((h % 12) * 5) % 60)); // hands swapped
    wrong.push(fmt(wrapH(h + 1), m), fmt(wrapH(h - 1), m));
    wrong.push(fmt(h, (m + (tier === 0 ? 30 : pick([5, 10, 15, 30]))) % 60));
    wrong.push(fmt(wrapH(h + pick([2, 3, 5])), m));
    const opts = withAnswer(correct, shuffle(wrong));
    let guard = 0;
    while (opts.options.length < 4 && guard++ < 30) {
      const extra = fmt(Phaser.Math.Between(1, 12), tier === 0 ? pick([0, 30]) : pick([0, 15, 30, 45, 5, 10]));
      if (!opts.options.includes(extra)) opts.options.push(extra);
    }

    const minuteAt = m === 0 ? 12 : m / 5;
    const explain =
      m % 5 === 0
        ? `The short hour hand is near ${h} and the long minute hand points to ${minuteAt}, so it is ${correct}.`
        : `It is ${correct}.`;
    return {
      prompt: "What time does the clock show?",
      visual: () => this.drawClock(h, m),
      options: opts.options,
      correct: opts.options.indexOf(correct),
      explain,
      cols: 4,
      w: 190,
      fontSize: 34,
    };
  }
}
