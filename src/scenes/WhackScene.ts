import Phaser from "phaser";
import { FONT } from "../ui/theme";
import { GAME_WIDTH } from "../config";
import { gameAudio } from "../audio/sfx";
import { setTouchChrome } from "../input/touchChrome";
import { addMenuButton, pollEndTaps, resetTaps, showGameOver } from "../ui/arcadeKit";

type Occupant = { text: Phaser.GameObjects.Text; kind: "mole" | "bomb"; until: number };
type Hole = { x: number; y: number; occ: Occupant | null };

const ROUND_MS = 30000;

export class WhackScene extends Phaser.Scene {
  private holes: Hole[] = [];
  private score = 0;
  private started = false;
  private dead = false;
  private startTime = 0;
  private nextPop = 0;
  private lockUntil = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private hideMenu!: () => void;

  constructor() {
    super({ key: "Whack" });
  }

  init(): void {
    this.holes = [];
    this.score = 0;
    this.started = false;
    this.dead = false;
    this.startTime = 0;
    this.nextPop = 0;
    this.lockUntil = 0;
    resetTaps();
  }

  create(): void {
    setTouchChrome("hidden");
    this.cameras.main.setBackgroundColor(0x4d7c0f);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setTouchChrome("hidden"));

    const bg = this.add.graphics().setDepth(-5);
    bg.fillGradientStyle(0x84cc16, 0x84cc16, 0x4d7c0f, 0x4d7c0f, 1);
    bg.fillRect(0, 0, GAME_WIDTH, 540);

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const x = GAME_WIDTH / 2 + (c - 1) * 200;
        const y = 195 + r * 120;
        this.add.ellipse(x, y + 34, 130, 38, 0x292524).setDepth(1);
        this.holes.push({ x, y, occ: null });
      }
    }

    this.scoreText = this.add
      .text(GAME_WIDTH / 2, 30, "0", { fontFamily: FONT, fontSize: "40px", color: "#ffffff", fontStyle: "700", stroke: "#14532d", strokeThickness: 6 })
      .setOrigin(0.5)
      .setDepth(50);
    this.timeText = this.add
      .text(GAME_WIDTH - 20, 30, "30s", { fontFamily: FONT, fontSize: "28px", color: "#fef08a", fontStyle: "700", stroke: "#14532d", strokeThickness: 5 })
      .setOrigin(1, 0.5)
      .setDepth(50);
    this.hint = this.add
      .text(GAME_WIDTH / 2, 100, "Tap to start · whack the 🐹 · avoid the 💣", {
        fontFamily: FONT,
        fontSize: "22px",
        color: "#ffffff",
        stroke: "#14532d",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(50);

    this.hideMenu = addMenuButton(this, () => {
      if (!this.dead) this.scene.start("Menu");
    });

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (p.x < 140 && p.y < 70) return;
      gameAudio.unlock();
      if (!this.started && !this.dead) {
        this.started = true;
        this.startTime = this.time.now;
        this.nextPop = this.time.now + 400;
        this.hint.setVisible(false);
        gameAudio.startMusic();
      }
    });
  }

  private pop(now: number): void {
    const free = this.holes.filter((h) => !h.occ);
    if (free.length === 0) return;
    const hole = Phaser.Utils.Array.GetRandom(free);
    const elapsed = now - this.startTime;
    const bomb = Math.random() < 0.2;
    const text = this.add
      .text(hole.x, hole.y + 40, bomb ? "💣" : "🐹", { fontFamily: FONT, fontSize: "76px" })
      .setOrigin(0.5, 1)
      .setDepth(2)
      .setInteractive({ useHandCursor: true });
    const occ: Occupant = { text, kind: bomb ? "bomb" : "mole", until: now + Math.max(550, 1100 - elapsed / 60) };
    hole.occ = occ;
    this.tweens.add({ targets: text, y: hole.y + 8, duration: 120 });
    text.on("pointerdown", () => this.hit(hole));
  }

  private hit(hole: Hole): void {
    const occ = hole.occ;
    if (!occ || this.dead || !this.started) return;
    hole.occ = null;
    if (occ.kind === "mole") {
      this.score += 10;
      gameAudio.coin();
    } else {
      this.score = Math.max(0, this.score - 15);
      gameAudio.hit();
      this.cameras.main.shake(140, 0.006);
    }
    this.scoreText.setText(String(this.score));
    this.tweens.add({
      targets: occ.text,
      scale: 1.4,
      alpha: 0,
      duration: 160,
      onComplete: () => occ.text.destroy(),
    });
  }

  private retract(hole: Hole): void {
    const occ = hole.occ;
    if (!occ) return;
    hole.occ = null;
    this.tweens.add({ targets: occ.text, y: hole.y + 44, duration: 120, onComplete: () => occ.text.destroy() });
  }

  update(time: number): void {
    if (this.dead) {
      if (time < this.lockUntil) return;
      const tap = pollEndTaps();
      if (tap === "restart") this.scene.restart();
      else if (tap === "menu") this.scene.start("Menu");
      return;
    }
    if (!this.started) return;

    const left = ROUND_MS - (time - this.startTime);
    this.timeText.setText(`${Math.max(0, Math.ceil(left / 1000))}s`);
    if (left <= 0) {
      this.dead = true;
      gameAudio.stopMusic();
      this.lockUntil = time + 450;
      this.hideMenu();
      for (const h of this.holes) this.retract(h);
      showGameOver(this, `Final score ${this.score}`, () => this.scene.restart(), () => this.scene.start("Menu"), "Time's Up!");
      return;
    }

    for (const h of this.holes) {
      if (h.occ && time >= h.occ.until) this.retract(h);
    }
    if (time >= this.nextPop) {
      this.pop(time);
      const elapsed = time - this.startTime;
      this.nextPop = time + Math.max(320, 750 - elapsed / 50);
    }
  }
}
