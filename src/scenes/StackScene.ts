import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { gameAudio } from "../audio/sfx";
import { deviceUsesTouch } from "../input/touchPad";
import { setTouchChrome } from "../input/touchChrome";
import { addMenuButton, overMenuButton, pollEndTaps, resetTaps, showGameOver } from "../ui/arcadeKit";

const BLOCK_H = 30;
const BASE_Y = GAME_HEIGHT - 60;
const START_W = 260;

export class StackScene extends Phaser.Scene {
  private placed: Phaser.GameObjects.Rectangle[] = [];
  private moving!: Phaser.GameObjects.Rectangle;
  private dir = 1;
  private speed = 260;
  private score = 0;
  private perfects = 0;
  private dead = false;
  private started = false;
  private lockUntil = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private toast!: Phaser.GameObjects.Text;
  private hideMenu!: () => void;
  private dropKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: "Stack" });
  }

  init(): void {
    this.placed = [];
    this.dir = 1;
    this.speed = 260;
    this.score = 0;
    this.perfects = 0;
    this.dead = false;
    this.started = false;
    this.lockUntil = 0;
    resetTaps();
  }

  private colorFor(i: number): number {
    const c = Phaser.Display.Color.HSVToRGB((i * 0.045) % 1, 0.55, 0.95) as Phaser.Types.Display.ColorObject;
    return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
  }

  create(): void {
    setTouchChrome("hidden");
    this.cameras.main.setBackgroundColor(0x1e1b4b);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setTouchChrome("hidden"));

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x312e81, 0x312e81, 0x0f172a, 0x0f172a, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    bg.setScrollFactor(0).setDepth(-10);

    this.add.rectangle(GAME_WIDTH / 2, BASE_Y + BLOCK_H + 20, GAME_WIDTH, 40, 0x0f172a).setDepth(1);

    const base = this.add.rectangle(GAME_WIDTH / 2, BASE_Y, START_W, BLOCK_H, this.colorFor(0)).setStrokeStyle(2, 0xffffff, 0.35).setDepth(5);
    this.placed.push(base);

    this.scoreText = this.add
      .text(GAME_WIDTH / 2, 40, "0", { fontFamily: "system-ui, sans-serif", fontSize: "56px", color: "#ffffff", fontStyle: "700" })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(50);
    this.toast = this.add
      .text(GAME_WIDTH / 2, 100, "", { fontFamily: "system-ui, sans-serif", fontSize: "24px", color: "#fde047", fontStyle: "700" })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(50);
    this.hint = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, deviceUsesTouch() ? "Tap to drop the block" : "Click or SPACE to drop the block", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "24px",
        color: "#e2e8f0",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(50);

    this.hideMenu = addMenuButton(this, () => {
      if (!this.dead) this.scene.start("Menu");
    });

    this.dropKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.dead || overMenuButton(p)) return;
      gameAudio.unlock();
      this.drop();
    });

    this.spawnMoving();
  }

  private top(): Phaser.GameObjects.Rectangle {
    return this.placed[this.placed.length - 1];
  }

  private spawnMoving(): void {
    const t = this.top();
    const y = t.y - BLOCK_H;
    const w = t.width;
    const fromLeft = this.placed.length % 2 === 0;
    this.dir = fromLeft ? 1 : -1;
    const x = fromLeft ? w / 2 + 10 : GAME_WIDTH - w / 2 - 10;
    this.moving = this.add
      .rectangle(x, y, w, BLOCK_H, this.colorFor(this.placed.length))
      .setStrokeStyle(2, 0xffffff, 0.35)
      .setDepth(6);
  }

  private drop(): void {
    if (this.dead) return;
    if (!this.started) {
      this.started = true;
      this.hint.setVisible(false);
      gameAudio.startMusic();
    }

    const t = this.top();
    const m = this.moving;
    const offset = m.x - t.x;
    const overlap = t.width - Math.abs(offset);

    if (overlap <= 0) {
      this.fall(m.x, m.y, m.width, m.fillColor);
      m.destroy();
      this.die();
      return;
    }

    if (Math.abs(offset) < 6) {
      m.x = t.x;
      this.perfects += 1;
      this.toast.setText(this.perfects > 1 ? `Perfect x${this.perfects}!` : "Perfect!");
      this.tweens.add({ targets: this.toast, alpha: { from: 1, to: 0 }, duration: 700 });
      gameAudio.coin();
      // streak bonus: slowly regrow the block
      if (this.perfects >= 3) m.width = Math.min(START_W, m.width + 8);
    } else {
      this.perfects = 0;
      const newW = overlap;
      const newX = t.x + offset / 2;
      const cutW = Math.abs(offset);
      const cutX = offset > 0 ? newX + newW / 2 + cutW / 2 : newX - newW / 2 - cutW / 2;
      this.fall(cutX, m.y, cutW, m.fillColor);
      m.width = newW;
      m.x = newX;
      gameAudio.jump();
    }

    this.placed.push(m);
    this.score += 1;
    this.scoreText.setText(String(this.score));
    this.speed = Math.min(620, 260 + this.score * 9);

    // scroll camera so the tower top stays in view
    const targetScroll = Math.min(0, m.y - 260);
    this.tweens.add({ targets: this.cameras.main, scrollY: targetScroll, duration: 260, ease: "Sine.easeOut" });

    this.spawnMoving();
  }

  private fall(x: number, y: number, w: number, color: number): void {
    const piece = this.add.rectangle(x, y, w, BLOCK_H, color).setDepth(4);
    this.tweens.add({
      targets: piece,
      y: y + 420,
      alpha: 0,
      angle: Phaser.Math.Between(-25, 25),
      duration: 700,
      onComplete: () => piece.destroy(),
    });
  }

  private die(): void {
    this.dead = true;
    gameAudio.hit();
    gameAudio.stopMusic();
    this.lockUntil = this.time.now + 450;
    this.hideMenu();
    showGameOver(this, `Tower height ${this.score}`, () => this.scene.restart(), () => this.scene.start("Menu"));
  }

  update(time: number, delta: number): void {
    const dt = Math.min(delta, 34) / 1000;

    if (this.dead) {
      if (time < this.lockUntil) return;
      const tap = pollEndTaps();
      if (tap === "restart") this.scene.restart();
      else if (tap === "menu") this.scene.start("Menu");
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.dropKey)) this.drop();
    if (this.dead) return;

    const m = this.moving;
    m.x += this.dir * this.speed * dt;
    const half = m.width / 2;
    if (m.x > GAME_WIDTH - half - 10) {
      m.x = GAME_WIDTH - half - 10;
      this.dir = -1;
    } else if (m.x < half + 10) {
      m.x = half + 10;
      this.dir = 1;
    }
  }
}
