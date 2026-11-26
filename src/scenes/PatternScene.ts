import Phaser from "phaser";
import { setGradientBackground } from "../ui/background";
import { addChip, Chip } from "../ui/chips";
import { PALETTES } from "../ui/palettes";
import { RoundTile } from "../ui/roundTile";
import { GAME_WIDTH } from "../config";
import { gameAudio } from "../audio/sfx";
import { setTouchChrome } from "../input/touchChrome";
import { addMenuButton, Btn, FONT, makeButton, pollEndTaps, resetTaps, showGameOver, showLevelPicker } from "../ui/arcadeKit";
import { ChoiceBoard } from "../ui/choiceBoard";

const ROUNDS = 10;

type Seq = { terms: number[]; rule: string };

function rnd(a: number, b: number): number {
  return Phaser.Math.Between(a, b);
}

function numberSequence(tier: number): Seq {
  const easy: (() => Seq)[] = [
    () => {
      const k = rnd(2, 5);
      const s = rnd(1, 10);
      return { terms: Array.from({ length: 6 }, (_, i) => s + k * i), rule: `Add ${k} each time` };
    },
    () => {
      const k = rnd(2, 5);
      const s = rnd(30, 50);
      return { terms: Array.from({ length: 6 }, (_, i) => s - k * i), rule: `Subtract ${k} each time` };
    },
    () => {
      const k = Phaser.Utils.Array.GetRandom([5, 10]);
      return { terms: Array.from({ length: 6 }, (_, i) => k * (i + 1)), rule: `Count by ${k}s` };
    },
    () => {
      const s = rnd(1, 3);
      return { terms: Array.from({ length: 6 }, (_, i) => s * 2 ** i), rule: "Double each time (× 2)" };
    },
  ];
  const hard: (() => Seq)[] = [
    () => {
      const s = rnd(1, 3);
      return { terms: Array.from({ length: 6 }, (_, i) => s * 3 ** i), rule: "Multiply by 3 each time" };
    },
    () => {
      const o = rnd(0, 3);
      return { terms: Array.from({ length: 6 }, (_, i) => (i + 1 + o) ** 2), rule: "Square numbers (1×1, 2×2, 3×3 …)" };
    },
    () => ({ terms: [1, 3, 6, 10, 15, 21], rule: "Triangular numbers: add 2, then 3, then 4 …" }),
    () => {
      const a = rnd(1, 4);
      const b = rnd(2, 6);
      const t = [a, b];
      for (let i = 2; i < 6; i++) t.push(t[i - 1] + t[i - 2]);
      return { terms: t, rule: "Fibonacci-style: add the two numbers before" };
    },
    () => {
      const a = rnd(2, 5);
      const b = rnd(6, 9);
      const t = [rnd(1, 9)];
      for (let i = 1; i < 6; i++) t.push(t[i - 1] + (i % 2 === 1 ? a : b));
      return { terms: t, rule: `Alternately add ${a} and ${b}` };
    },
    () => {
      const s = rnd(1, 6);
      const t = [s];
      for (let i = 1; i < 6; i++) t.push(t[i - 1] + i);
      return { terms: t, rule: "The jump grows: +1, +2, +3, +4 …" };
    },
    () => ({ terms: [1, 2, 4, 8, 16, 32], rule: "Powers of 2: double each time" }),
  ];
  const pool = tier === 0 ? easy : [...easy.slice(0, 2), ...hard];
  return Phaser.Utils.Array.GetRandom(pool)();
}

const EMOJI = ["🔴", "🔵", "🟡", "🟢", "🟣", "🟠", "⭐", "🔺", "🔷", "❤️"];

function shapeSequence(tier: number): { items: string[]; unit: string[] } {
  const patterns = tier === 0 ? ["AB", "AAB", "ABB", "ABC"] : ["AABB", "ABCB", "ABAC", "AABC", "ABCD"];
  const p = Phaser.Utils.Array.GetRandom(patterns);
  const letters = [...new Set(p.split(""))];
  const symbols = Phaser.Utils.Array.Shuffle([...EMOJI]).slice(0, letters.length);
  const unit = p.split("").map((ch) => symbols[letters.indexOf(ch)]);
  const items = Array.from({ length: 8 }, (_, i) => unit[i % unit.length]);
  return { items, unit };
}

export class PatternScene extends Phaser.Scene {
  private tier = 0;
  private round = 0;
  private correct = 0;
  private streak = 0;
  private score = 0;
  private dead = false;
  private lockUntil = 0;
  private board: ChoiceBoard | null = null;
  private shown: Phaser.GameObjects.GameObject[] = [];
  private nextBtn: Btn | null = null;
  private title!: Chip;
  private scoreText!: Chip;
  private msg!: Phaser.GameObjects.Text;
  private hideMenu!: () => void;

  constructor() {
    super({ key: "Pattern" });
  }

  init(): void {
    this.tier = 0;
    this.round = 0;
    this.correct = 0;
    this.streak = 0;
    this.score = 0;
    this.dead = false;
    this.lockUntil = 0;
    this.board = null;
    this.shown = [];
    this.nextBtn = null;
    resetTaps();
  }

  create(): void {
    setTouchChrome("hidden");
    setGradientBackground(this, PALETTES.pattern);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setTouchChrome("hidden"));

    this.title = addChip(this, GAME_WIDTH / 2, 34, { width: 200 });
    this.scoreText = addChip(this, GAME_WIDTH - 100, 34, { icon: "⭐", width: 150 });
    this.scoreText.setText("Score 0");
    this.msg = this.add.text(GAME_WIDTH / 2, 432, "", { fontFamily: FONT, fontSize: "22px", color: "#fde047", align: "center", wordWrap: { width: 860 } }).setOrigin(0.5);

    this.hideMenu = addMenuButton(this, () => {
      if (!this.dead) this.scene.start("Menu");
    });

    showLevelPicker(this, "Pattern Master 🔍", "Find the rule and pick what comes next!\nNumber patterns and shape patterns.", (tier) => {
      this.tier = tier;
      gameAudio.unlock();
      gameAudio.startMusic();
      this.nextRound();
    });
  }

  private clearRound(): void {
    this.shown.forEach((o) => o.destroy());
    this.shown = [];
    this.board?.clear();
    this.nextBtn?.container.destroy();
    this.nextBtn = null;
    this.msg.setText("");
  }

  private box(x: number, y: number, label: string, size: number, color = 0x312e81): void {
    const r = new RoundTile(this, x, y, 88, 88, color);
    const t = this.add.text(x, y, label, { fontFamily: FONT, fontSize: `${size}px`, color: "#ffffff", fontStyle: "700" }).setOrigin(0.5);
    this.shown.push(r, t);
  }

  private nextRound(): void {
    this.clearRound();
    if (this.round >= ROUNDS) {
      this.finish();
      return;
    }
    this.round += 1;
    this.title.setText(`Puzzle ${this.round} of ${ROUNDS}`);
    this.scoreText.setText(`Score ${this.score}`);

    const numberMode = Math.random() < (this.tier === 0 ? 0.5 : 0.65);
    let explain = "";
    let opts: string[] = [];
    let correct = 0;
    let cols = 2;
    let w = 300;
    let fontSize = 34;

    if (numberMode) {
      const { terms, rule } = numberSequence(this.tier);
      const shownTerms = terms.slice(0, 5);
      const answer = terms[5];
      const startX = GAME_WIDTH / 2 - (shownTerms.length * 104) / 2 + 52 - 52;
      shownTerms.forEach((n, i) => this.box(startX + i * 104, 170, String(n), 34));
      this.box(startX + 5 * 104, 170, "?", 44, 0x7c3aed);
      const set = new Set<number>([answer]);
      let guard = 0;
      while (set.size < 4 && guard++ < 100) {
        const v = answer + rnd(-Math.max(3, Math.round(answer * 0.3)), Math.max(3, Math.round(answer * 0.3)));
        if (v > 0 && v !== answer) set.add(v);
      }
      const vals = Phaser.Utils.Array.Shuffle([...set]);
      opts = vals.map(String);
      correct = vals.indexOf(answer);
      explain = `Rule: ${rule}. The answer is ${answer}.`;
    } else {
      const { items, unit } = shapeSequence(this.tier);
      const shownItems = items.slice(0, 7);
      const answer = items[7];
      const startX = GAME_WIDTH / 2 - (8 * 100) / 2 + 50;
      shownItems.forEach((s, i) => this.box(startX + i * 100, 170, s, 44));
      this.box(startX + 7 * 100, 170, "?", 44, 0x7c3aed);
      const pool = [...new Set(EMOJI.filter((e) => e !== answer))];
      const wrong = Phaser.Utils.Array.Shuffle(pool).slice(0, 3);
      const all = Phaser.Utils.Array.Shuffle([answer, ...wrong]);
      opts = all;
      correct = all.indexOf(answer);
      cols = 4;
      w = 190;
      fontSize = 52;
      explain = `The pattern ${unit.join(" ")} repeats. Next is ${answer}.`;
    }

    const label = this.add
      .text(GAME_WIDTH / 2, 100, numberMode ? "What number comes next?" : "What comes next?", { fontFamily: FONT, fontSize: "22px", color: "#c7d2fe" })
      .setOrigin(0.5);
    this.shown.push(label);

    this.board = new ChoiceBoard(this, GAME_WIDTH / 2, 262, cols, w, 76);
    this.board.show(
      opts,
      correct,
      (ok) => {
        if (ok) {
          this.correct += 1;
          this.streak += 1;
          this.score += 10 + Math.min(this.streak - 1, 5) * 2;
          gameAudio.coin();
          this.msg.setText(`Correct! ${explain}`);
        } else {
          this.streak = 0;
          gameAudio.hit();
          this.msg.setText(`Not quite. ${explain}`);
        }
        this.scoreText.setText(`Score ${this.score}`);
        this.nextBtn = makeButton(this, GAME_WIDTH / 2, 492, 240, 52, this.round >= ROUNDS ? "Finish ▶" : "Next ▶", 0x16a34a, () => this.nextRound(), 24);
      },
      fontSize
    );
  }

  private finish(): void {
    this.dead = true;
    gameAudio.stopMusic();
    this.lockUntil = this.time.now + 500;
    this.hideMenu();
    showGameOver(this, `${this.correct}/${ROUNDS} correct · Score ${this.score}`, () => this.scene.restart(), () => this.scene.start("Menu"), "Pattern Master!");
  }

  update(time: number): void {
    if (!this.dead || time < this.lockUntil) return;
    const tap = pollEndTaps();
    if (tap === "restart") this.scene.restart();
    else if (tap === "menu") this.scene.start("Menu");
  }
}
