import Phaser from "phaser";
import { GAME_WIDTH } from "../config";
import { gameAudio } from "../audio/sfx";
import { setTouchChrome } from "../input/touchChrome";
import { addMenuButton, Btn, FONT, getBest, makeButton, pollEndTaps, resetTaps, saveBest, showGameOver, showLevelPicker } from "../ui/arcadeKit";
import { ChoiceBoard } from "../ui/choiceBoard";

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
  private title!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
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
    this.cameras.main.setBackgroundColor(this.cfg.bg);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setTouchChrome("hidden"));

    this.title = this.add.text(GAME_WIDTH / 2, 30, "", { fontFamily: FONT, fontSize: "24px", color: "#ffffff", fontStyle: "700" }).setOrigin(0.5);
    this.scoreText = this.add.text(GAME_WIDTH - 20, 24, "Score 0", { fontFamily: FONT, fontSize: "20px", color: "#fde047", fontStyle: "700" }).setOrigin(1, 0.5);
    this.add.text(GAME_WIDTH - 20, 50, `🏆 Best ${getBest(this.cfg.best)}`, { fontFamily: FONT, fontSize: "15px", color: "#fde68a" }).setOrigin(1, 0.5);
    this.prompt = this.add.text(GAME_WIDTH / 2, 82, "", { fontFamily: FONT, fontSize: "24px", color: "#e2e8f0", fontStyle: "700", align: "center", wordWrap: { width: 800 } }).setOrigin(0.5);
    this.msg = this.add
      .text(GAME_WIDTH / 2, 432, "", { fontFamily: FONT, fontSize: "21px", color: "#fde047", align: "center", wordWrap: { width: 860 } })
      .setOrigin(0.5);

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
    this.msg.setText("");
  }

  private nextRound(): void {
    this.clearRound();
    if (this.round >= ROUNDS) {
      this.finish();
      return;
    }
    this.round += 1;
    this.title.setText(`Question ${this.round} of ${ROUNDS}`);
    this.scoreText.setText(`Score ${this.score}`);

    const r = this.makeRound(this.tier);
    this.prompt.setText(r.prompt);
    if (r.visual) this.shown.push(...r.visual());

    this.board = new ChoiceBoard(this, GAME_WIDTH / 2, 262, r.cols ?? 2, r.w ?? 380, 76);
    this.board.show(
      r.options,
      r.correct,
      (ok) => {
        if (ok) {
          this.correct += 1;
          this.streak += 1;
          this.score += 10 + Math.min(this.streak - 1, 5) * 2;
          gameAudio.coin();
          this.msg.setText(`Correct! ${r.explain}`);
        } else {
          this.streak = 0;
          gameAudio.hit();
          this.msg.setText(`Not quite. ${r.explain}`);
        }
        this.scoreText.setText(`Score ${this.score}`);
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
