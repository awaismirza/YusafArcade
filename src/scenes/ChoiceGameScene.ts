import Phaser from "phaser";
import { GAME_WIDTH } from "../config";
import { gameAudio } from "../audio/sfx";
import { setTouchChrome } from "../input/touchChrome";
import { addMenuButton, Btn, FONT, getBest, makeButton, pollEndTaps, resetTaps, saveBest, showGameOver, showLevelPicker } from "../ui/arcadeKit";
import { ChoiceBoard } from "../ui/choiceBoard";
import { setGradientBackground } from "../ui/background";
import { addChip, Chip } from "../ui/chips";
import { confetti, popText } from "../ui/fx";
import { drawGlass } from "../ui/glass";
import { PALETTES } from "../ui/palettes";
import { addProgress } from "../ui/progress";
import { shade } from "../ui/theme";

export type Round = {
  prompt: string;
  /** Draw something above the answers. Return the objects so they can be cleaned up. */
  visual?: () => Phaser.GameObjects.GameObject[];
  options: string[];
  correct: number;
  explain: string;
  cols?: number;
  w?: number;
  fontSize?: number;
};

export type GameCfg = {
  title: string;
  subtitle: string;
  bg: number;
  /** Key into PALETTES for the gradient background and accent. */
  palette?: string;
  end: string;
  best: string;
};

export const ROUNDS = 10;

/** Shared shell for 10-round multiple-choice learning games (ages 7 and 10). */
export abstract class ChoiceGameScene extends Phaser.Scene {
  protected abstract readonly cfg: GameCfg;
  protected abstract makeRound(tier: 0 | 1): Round;

  private tier: 0 | 1 = 0;
  private round = 0;
  private correct = 0;
  private streak = 0;
  private score = 0;
  private dead = false;
  private lockUntil = 0;
  private board: ChoiceBoard | null = null;
  private shown: Phaser.GameObjects.GameObject[] = [];
  private nextBtn: Btn | null = null;
  private titleChip!: Chip;
  private scoreChip!: Chip;
  private progress!: { set(f: number): void; destroy(): void };
  private msgCard!: Phaser.GameObjects.Graphics;
  private prompt!: Phaser.GameObjects.Text;
  private msg!: Phaser.GameObjects.Text;
  private hideMenu!: () => void;

  constructor(key: string) {
    super({ key });
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
    const pal = PALETTES[this.cfg.palette ?? ""];
    if (pal) setGradientBackground(this, pal);
    else this.cameras.main.setBackgroundColor(this.cfg.bg);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setTouchChrome("hidden"));

    this.titleChip = addChip(this, GAME_WIDTH / 2, 34, { width: 210 });
    this.scoreChip = addChip(this, GAME_WIDTH - 92, 34, { icon: "⭐", width: 120 });
    this.scoreChip.setText("0");
    addChip(this, GAME_WIDTH - 92, 82, { icon: "🏆", width: 120 }).setText(String(getBest(this.cfg.best)));
    this.progress = addProgress(this, GAME_WIDTH / 2, 72, 420, pal?.accent ?? 0x34d399);
    this.prompt = this.add.text(GAME_WIDTH / 2, 112, "", { fontFamily: FONT, fontSize: "26px", color: "#ffffff", fontStyle: "800", align: "center", wordWrap: { width: 800 } }).setOrigin(0.5);
    this.msgCard = this.add.graphics().setDepth(5);
    this.msg = this.add
      .text(GAME_WIDTH / 2, 436, "", { fontFamily: FONT, fontSize: "21px", color: "#fde68a", fontStyle: "700", align: "center", wordWrap: { width: 840 } })
      .setOrigin(0.5)
      .setDepth(6);

    this.hideMenu = addMenuButton(this, () => {
      if (!this.dead) this.scene.start("Menu");
    });

    showLevelPicker(this, this.cfg.title, this.cfg.subtitle, (tier) => {
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
    this.setMessage("");
  }

  /** Shows (or clears) the explanation on a soft glass card. */
  private setMessage(text: string): void {
    this.msg.setText(text);
    this.msgCard.clear();
    if (text) drawGlass(this.msgCard, GAME_WIDTH / 2, 436, Math.min(880, this.msg.width + 48), this.msg.height + 18, { tint: 0x1b1640, alpha: 0.5, radius: 22 });
  }

  private nextRound(): void {
    this.clearRound();
    if (this.round >= ROUNDS) {
      this.finish();
      return;
    }
    this.round += 1;
    this.titleChip.setText(`Question ${this.round} of ${ROUNDS}`);
    this.progress.set((this.round - 1) / ROUNDS);
    this.scoreChip.setText(String(this.score));

    const r = this.makeRound(this.tier);
    this.prompt.setText(r.prompt);
    if (r.visual) this.shown.push(...r.visual());

    this.board = new ChoiceBoard(this, GAME_WIDTH / 2, 262, r.cols ?? 2, r.w ?? 380, 76);
    const pal = PALETTES[this.cfg.palette ?? ""];
    if (pal) this.board.base = shade(pal.top, 0.12);
    this.board.show(
      r.options,
      r.correct,
      (ok) => {
        if (ok) {
          this.correct += 1;
          this.streak += 1;
          const gain = 10 + Math.min(this.streak - 1, 5) * 2;
          this.score += gain;
          gameAudio.coin();
          this.setMessage(`Correct! ${r.explain}`);
          popText(this, GAME_WIDTH / 2, 200, `+${gain}`);
          if (this.streak === 3 || this.streak === 5 || this.streak === 8) confetti(this, GAME_WIDTH / 2, 150);
        } else {
          this.streak = 0;
          gameAudio.hit();
          this.setMessage(`Not quite. ${r.explain}`);
        }
        this.scoreChip.setText(String(this.score));
        this.progress.set(this.round / ROUNDS);
        this.nextBtn = makeButton(this, GAME_WIDTH / 2, 494, 240, 52, this.round >= ROUNDS ? "Finish ▶" : "Next ▶", 0x16a34a, () => this.nextRound(), 24);
      },
      r.fontSize ?? 30
    );
  }

  private finish(): void {
    this.dead = true;
    gameAudio.stopMusic();
    this.lockUntil = this.time.now + 500;
    this.hideMenu();
    const record = saveBest(this.cfg.best, this.score);
    showGameOver(
      this,
      `${this.correct}/${ROUNDS} correct · Score ${this.score}\n🏆 Best ${getBest(this.cfg.best)}${record ? " — New record!" : ""}`,
      () => this.scene.restart(),
      () => this.scene.start("Menu"),
      this.cfg.end
    );
  }

  update(time: number): void {
    if (!this.dead || time < this.lockUntil) return;
    const tap = pollEndTaps();
    if (tap === "restart") this.scene.restart();
    else if (tap === "menu") this.scene.start("Menu");
  }
}

export function pick<T>(arr: readonly T[]): T {
  return Phaser.Utils.Array.GetRandom(arr as T[]);
}

export function shuffle<T>(arr: readonly T[]): T[] {
  return Phaser.Utils.Array.Shuffle([...arr]);
}

/** Put the correct option among distractors in a random order. */
export function withAnswer(correct: string, wrong: string[]): { options: string[]; correct: number } {
  const uniq = [...new Set(wrong.filter((w) => w !== correct))].slice(0, 3);
  const options = shuffle([correct, ...uniq]);
  return { options, correct: options.indexOf(correct) };
}
