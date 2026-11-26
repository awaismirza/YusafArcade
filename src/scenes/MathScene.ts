import Phaser from "phaser";
import { setGradientBackground } from "../ui/background";
import { addChip, Chip } from "../ui/chips";
import { PALETTES } from "../ui/palettes";
import { GAME_WIDTH } from "../config";
import { gameAudio } from "../audio/sfx";
import { setTouchChrome } from "../input/touchChrome";
import { addMenuButton, FONT, getBest, saveBest, pollEndTaps, resetTaps, showGameOver, showLevelPicker } from "../ui/arcadeKit";
import { ChoiceBoard } from "../ui/choiceBoard";

const GOAL = 15;
const MAX_LEVEL = 6;
const TRACK_X0 = 80;
const TRACK_X1 = GAME_WIDTH - 80;
const TRACK_Y = 492;

type Q = { text: string; answer: number };

function rnd(a: number, b: number): number {
  return Phaser.Math.Between(a, b);
}

function makeQuestion(level: number): Q {
  switch (level) {
    case 1: {
      const a = rnd(2, 12);
      const b = rnd(2, 12);
      return Math.random() < 0.5 ? { text: `${a} + ${b} = ?`, answer: a + b } : { text: `${a + b} − ${a} = ?`, answer: b };
    }
    case 2: {
      if (Math.random() < 0.5) {
        const a = rnd(12, 80);
        const b = rnd(11, 99 - a);
        return { text: `${a} + ${b} = ?`, answer: a + b };
      }
      const a = rnd(30, 99);
      const b = rnd(11, a - 1);
      return { text: `${a} − ${b} = ?`, answer: a - b };
    }
    case 3: {
      const a = rnd(2, 10);
      const b = rnd(2, 10);
      return { text: `${a} × ${b} = ?`, answer: a * b };
    }
    case 4: {
      if (Math.random() < 0.5) {
        const b = rnd(2, 10);
        const q = rnd(2, 10);
        return { text: `${b * q} ÷ ${b} = ?`, answer: q };
      }
      const a = rnd(6, 12);
      const b = rnd(6, 12);
      return { text: `${a} × ${b} = ?`, answer: a * b };
    }
    case 5: {
      if (Math.random() < 0.5) {
        const x = rnd(5, 60);
        const a = rnd(5, 40);
        return { text: `□ + ${a} = ${x + a}`, answer: x };
      }
      const a = rnd(2, 9);
      const x = rnd(2, 10);
      return { text: `${a} × □ = ${a * x}`, answer: x };
    }
    default: {
      const a = rnd(2, 20);
      const b = rnd(2, 9);
      const c = rnd(2, 9);
      return Math.random() < 0.5
        ? { text: `${a} + ${b} × ${c} = ?`, answer: a + b * c }
        : { text: `(${a} + ${b}) × ${c} = ?`, answer: (a + b) * c };
    }
  }
}

export class MathScene extends Phaser.Scene {
  private level = 1;
  private streak = 0;
  private solved = 0;
  private lives = 3;
  private score = 0;
  private dead = false;
  private ready = false;
  private answered = false;
  private qStart = 0;
  private limit = 15000;
  private solution = "";
  private lockUntil = 0;
  private board!: ChoiceBoard;
  private qText!: Phaser.GameObjects.Text;
  private scoreText!: Chip;
  private livesText!: Chip;
  private levelText!: Chip;
  private msgText!: Phaser.GameObjects.Text;
  private bestText!: Chip;
  private bar!: Phaser.GameObjects.Rectangle;
  private rocket!: Phaser.GameObjects.Text;
  private hideMenu!: () => void;

  constructor() {
    super({ key: "Math" });
  }

  init(): void {
    this.level = 1;
    this.streak = 0;
    this.solved = 0;
    this.lives = 3;
    this.score = 0;
    this.dead = false;
    this.ready = false;
    this.answered = false;
    this.lockUntil = 0;
    resetTaps();
  }

  create(): void {
    setTouchChrome("hidden");
    setGradientBackground(this, PALETTES.math);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setTouchChrome("hidden"));

    for (let i = 0; i < 60; i++) {
      this.add.circle(rnd(0, GAME_WIDTH), rnd(0, 540), Phaser.Math.FloatBetween(0.7, 1.8), 0xffffff, Phaser.Math.FloatBetween(0.3, 0.8));
    }

    this.add.rectangle(GAME_WIDTH / 2, TRACK_Y + 22, TRACK_X1 - TRACK_X0, 6, 0x334155);
    this.add.text(TRACK_X1 + 28, TRACK_Y, "🌕", { fontFamily: FONT, fontSize: "36px" }).setOrigin(0.5);
    this.rocket = this.add.text(TRACK_X0, TRACK_Y, "🚀", { fontFamily: FONT, fontSize: "40px" }).setOrigin(0.5).setAngle(45).setDepth(5);

    this.scoreText = addChip(this, GAME_WIDTH / 2, 34, { icon: "⭐", width: 170 });
    this.scoreText.setText("Score 0");
    this.bestText = addChip(this, 250, 34, { width: 150 });
    this.bestText.setText(`🏆 Best ${getBest("math")}`);
    this.levelText = addChip(this, GAME_WIDTH - 100, 34, { width: 140 });
    this.levelText.setText("Level 1");
    this.livesText = addChip(this, GAME_WIDTH - 100, 80, { width: 140 });
    this.add.rectangle(GAME_WIDTH / 2, 88, 600, 12, 0x1e293b).setDepth(2);
    this.bar = this.add.rectangle(GAME_WIDTH / 2 - 300, 88, 600, 12, 0x22c55e).setOrigin(0, 0.5).setDepth(3);
    this.qText = this.add.text(GAME_WIDTH / 2, 170, "", { fontFamily: FONT, fontSize: "64px", color: "#ffffff", fontStyle: "700" }).setOrigin(0.5);
    this.msgText = this.add.text(GAME_WIDTH / 2, 420, "", { fontFamily: FONT, fontSize: "22px", color: "#fde047" }).setOrigin(0.5);

    this.board = new ChoiceBoard(this, GAME_WIDTH / 2, 265, 2, 380, 76);
    this.hideMenu = addMenuButton(this, () => {
      if (!this.dead) this.scene.start("Menu");
    });

    showLevelPicker(this, "Math Rocket 🚀", "Solve problems to fly to the moon!\nGet 3 right in a row to level up.", (tier) => {
      this.level = tier === 0 ? 1 : 3;
      gameAudio.unlock();
      gameAudio.startMusic();
      this.syncHud();
      this.nextQuestion();
    });
    this.syncHud();
  }

  private syncHud(): void {
    this.scoreText.setText(`Score ${this.score}`);
    this.levelText.setText(`Level ${this.level}`);
    this.livesText.setText("❤️".repeat(Math.max(0, this.lives)));
  }

  private options(answer: number): { opts: string[]; correct: number } {
    const set = new Set<number>([answer]);
    const spread = Math.max(4, Math.round(answer * 0.25));
    let guard = 0;
    while (set.size < 4 && guard++ < 100) {
      const v = answer + rnd(-spread, spread);
      if (v >= 0 && v !== answer) set.add(v);
    }
    const vals = Phaser.Utils.Array.Shuffle([...set]);
    return { opts: vals.map(String), correct: vals.indexOf(answer) };
  }

  private nextQuestion(): void {
    this.msgText.setText("");
    const q = makeQuestion(this.level);
    this.qText.setText(q.text);
    const { opts, correct } = this.options(q.answer);
    this.limit = this.level >= 5 ? 22000 : 15000;
    this.answered = false;
    this.ready = true;
    this.qStart = this.time.now;
    this.solution = q.text.replace("?", String(q.answer)).replace("□", String(q.answer));
    this.board.show(opts, correct, (ok) => this.onAnswer(ok, this.solution), 34);
  }

  private onAnswer(ok: boolean, solution: string, timeout = false): void {
    if (this.answered) return;
    this.answered = true;
    this.ready = false;

    if (ok) {
      this.solved += 1;
      this.streak += 1;
      this.score += 10 + this.level * 2;
      gameAudio.coin();
      this.msgText.setText(this.streak > 1 ? `Correct! 🔥 ${this.streak} in a row` : "Correct!");
      this.tweens.add({
        targets: this.rocket,
        x: TRACK_X0 + (this.solved / GOAL) * (TRACK_X1 - TRACK_X0),
        duration: 400,
        ease: "Sine.easeOut",
      });
      if (this.streak % 3 === 0 && this.level < MAX_LEVEL) {
        this.level += 1;
        this.msgText.setText(`Level up! Now level ${this.level} ⬆️`);
      }
      this.syncHud();
      if (this.solved >= GOAL) {
        this.time.delayedCall(900, () => this.finish(true));
        return;
      }
      this.time.delayedCall(850, () => this.nextQuestion());
    } else {
      this.lives -= 1;
      this.streak = 0;
      gameAudio.hit();
      this.msgText.setText(`${timeout ? "Time's up! " : "Not quite. "}${solution}`);
      if (timeout) this.board.lock();
      this.syncHud();
      if (this.lives <= 0) {
        this.time.delayedCall(1500, () => this.finish(false));
        return;
      }
      this.time.delayedCall(1700, () => this.nextQuestion());
    }
  }

  private finish(won: boolean): void {
    this.dead = true;
    this.ready = false;
    this.board.clear();
    gameAudio.stopMusic();
    this.lockUntil = this.time.now + 500;
    this.hideMenu();
    const record = saveBest("math", this.score);
    const best = getBest("math");
    this.bestText.setText(`🏆 Best ${best}`);
    showGameOver(
      this,
      `Score ${this.score} · 🏆 Best ${best}${record ? "  — New record!" : ""}\n${this.solved}/${GOAL} solved · Level ${this.level}`,
      () => this.scene.restart(),
      () => this.scene.start("Menu"),
      won ? "Blast off! You made it! 🚀" : "Mission over"
    );
  }

  update(time: number): void {
    if (this.dead) {
      if (time < this.lockUntil) return;
      const tap = pollEndTaps();
      if (tap === "restart") this.scene.restart();
      else if (tap === "menu") this.scene.start("Menu");
      return;
    }
    if (!this.ready || this.answered) return;
    const frac = 1 - (time - this.qStart) / this.limit;
    this.bar.setScale(Math.max(0, frac), 1);
    this.bar.setFillStyle(frac > 0.5 ? 0x22c55e : frac > 0.25 ? 0xeab308 : 0xef4444);
    if (frac <= 0) this.onAnswer(false, this.solution, true);
  }
}
