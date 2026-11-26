import Phaser from "phaser";
import { setGradientBackground } from "../ui/background";
import { addChip, Chip } from "../ui/chips";
import { PALETTES } from "../ui/palettes";
import { RoundTile } from "../ui/roundTile";
import { FONT } from "../ui/theme";
import { GAME_WIDTH } from "../config";
import { gameAudio } from "../audio/sfx";
import { setTouchChrome } from "../input/touchChrome";
import { addMenuButton, pollEndTaps, resetTaps, showGameOver } from "../ui/arcadeKit";

const SYMBOLS = ["🍎", "🍌", "🍇", "🍒", "🐶", "🐱", "🚀", "⭐"];
const CW = 130;
const CH = 100;

type Card = {
  rect: RoundTile;
  label: Phaser.GameObjects.Text;
  sym: string;
  up: boolean;
  matched: boolean;
};

export class MemoryScene extends Phaser.Scene {
  private cards: Card[] = [];
  private first: Card | null = null;
  private busy = false;
  private moves = 0;
  private pairs = 0;
  private startTime = 0;
  private started = false;
  private dead = false;
  private lockUntil = 0;
  private movesText!: Chip;
  private timeText!: Chip;
  private hideMenu!: () => void;

  constructor() {
    super({ key: "Memory" });
  }

  init(): void {
    this.cards = [];
    this.first = null;
    this.busy = false;
    this.moves = 0;
    this.pairs = 0;
    this.startTime = 0;
    this.started = false;
    this.dead = false;
    this.lockUntil = 0;
    resetTaps();
  }

  create(): void {
    setTouchChrome("hidden");
    setGradientBackground(this, PALETTES.memory);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setTouchChrome("hidden"));

    this.movesText = addChip(this, GAME_WIDTH / 2, 34, { width: 170 });
    this.movesText.setText("Moves 0");
    this.timeText = addChip(this, GAME_WIDTH - 100, 34, { icon: "⏱", width: 120 });
    this.timeText.setText("0s");

    this.hideMenu = addMenuButton(this, () => {
      if (!this.dead) this.scene.start("Menu");
    });

    const deck = Phaser.Utils.Array.Shuffle([...SYMBOLS, ...SYMBOLS]);
    for (let i = 0; i < 16; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = GAME_WIDTH / 2 + (col - 1.5) * (CW + 16);
      const y = 138 + row * (CH + 10);
      const rect = new RoundTile(this, x, y, CW, CH, 0x6366f1)
        .setDepth(5)
        .setInteractive({ useHandCursor: true });
      const label = this.add
        .text(x, y, "?", { fontFamily: FONT, fontSize: "48px", color: "#e0e7ff", fontStyle: "700" })
        .setOrigin(0.5)
        .setDepth(6);
      const card: Card = { rect, label, sym: deck[i], up: false, matched: false };
      rect.on("pointerdown", () => this.pick(card));
      this.cards.push(card);
    }
  }

  private flip(card: Card, up: boolean, done?: () => void): void {
    card.up = up;
    this.tweens.add({
      targets: [card.rect, card.label],
      scaleX: 0,
      duration: 110,
      onComplete: () => {
        card.rect.setFillStyle(up ? 0xf8fafc : 0x6366f1);
        card.label.setText(up ? card.sym : "?").setFontSize(up ? 56 : 48).setColor(up ? "#000000" : "#e0e7ff");
        this.tweens.add({ targets: [card.rect, card.label], scaleX: 1, duration: 110, onComplete: done });
      },
    });
  }

  private pick(card: Card): void {
    if (this.dead || this.busy || card.up || card.matched) return;
    gameAudio.unlock();
    if (!this.started) {
      this.started = true;
      this.startTime = this.time.now;
      gameAudio.startMusic();
    }
    gameAudio.jump();
    this.flip(card, true);

    if (!this.first) {
      this.first = card;
      return;
    }

    const a = this.first;
    this.first = null;
    this.moves += 1;
    this.movesText.setText(`Moves ${this.moves}`);
    this.busy = true;

    if (a.sym === card.sym) {
      this.time.delayedCall(320, () => {
        a.matched = true;
        card.matched = true;
        a.rect.setFillStyle(0xbbf7d0);
        card.rect.setFillStyle(0xbbf7d0);
        gameAudio.coin();
        this.busy = false;
        this.pairs += 1;
        if (this.pairs === SYMBOLS.length) this.win();
      });
    } else {
      this.time.delayedCall(750, () => {
        this.flip(a, false);
        this.flip(card, false, () => (this.busy = false));
      });
    }
  }

  private win(): void {
    this.dead = true;
    gameAudio.stopMusic();
    this.lockUntil = this.time.now + 600;
    this.hideMenu();
    const secs = Math.floor((this.time.now - this.startTime) / 1000);
    showGameOver(this, `${this.moves} moves · ${secs}s`, () => this.scene.restart(), () => this.scene.start("Menu"), "You Win!");
  }

  update(time: number): void {
    if (this.dead) {
      if (time < this.lockUntil) return;
      const tap = pollEndTaps();
      if (tap === "restart") this.scene.restart();
      else if (tap === "menu") this.scene.start("Menu");
      return;
    }
    if (this.started) this.timeText.setText(`${Math.floor((time - this.startTime) / 1000)}s`);
  }
}
