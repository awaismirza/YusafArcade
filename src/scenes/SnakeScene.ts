import Phaser from "phaser";
import { FONT } from "../ui/theme";
import { setGradientBackground } from "../ui/background";
import { addChip, Chip } from "../ui/chips";
import { PALETTES } from "../ui/palettes";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { gameAudio } from "../audio/sfx";
import { deviceUsesTouch } from "../input/touchPad";
import { setTouchChrome } from "../input/touchChrome";
import { addDPad, addMenuButton, pollEndTaps, resetTaps, showGameOver } from "../ui/arcadeKit";

const CELL = 32;
const COLS = 30;
const ROWS = 15;
const OY = 60;

type Cell = { x: number; y: number };

export class SnakeScene extends Phaser.Scene {
  private snake: Cell[] = [];
  private dir: Cell = { x: 1, y: 0 };
  private pending: Cell | null = null;
  private food: Cell = { x: 20, y: 7 };
  private gfx!: Phaser.GameObjects.Graphics;
  private score = 0;
  private acc = 0;
  private started = false;
  private dead = false;
  private lockUntil = 0;
  private scoreText!: Chip;
  private hint!: Phaser.GameObjects.Text;
  private hideMenu!: () => void;
  private swipeStart: Phaser.Math.Vector2 | null = null;
  private keys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<"w" | "a" | "s" | "d", Phaser.Input.Keyboard.Key>;

  constructor() {
    super({ key: "Snake" });
  }

  init(): void {
    this.snake = [
      { x: 8, y: 7 },
      { x: 7, y: 7 },
      { x: 6, y: 7 },
    ];
    this.dir = { x: 1, y: 0 };
    this.pending = null;
    this.score = 0;
    this.acc = 0;
    this.started = false;
    this.dead = false;
    this.lockUntil = 0;
    this.swipeStart = null;
    resetTaps();
  }

  create(): void {
    setTouchChrome("hidden");
    this.cameras.main.setBackgroundColor(0x052e16);
    setGradientBackground(this, PALETTES.snake);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setTouchChrome("hidden"));

    const board = this.add.graphics().setDepth(0);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        board.fillStyle((x + y) % 2 === 0 ? 0x1f6f3d : 0x2a8449, 1);
        board.fillRect(x * CELL, OY + y * CELL, CELL, CELL);
      }
    }
    this.gfx = this.add.graphics().setDepth(5);

    this.scoreText = addChip(this, GAME_WIDTH / 2, 30, { icon: "🍎", width: 130, depth: 50 });
    this.scoreText.setText("0");
    this.hint = this.add
      .text(GAME_WIDTH / 2, OY + (ROWS * CELL) / 2 + 60, deviceUsesTouch() ? "Use the arrow buttons (or swipe) to steer" : "Arrow keys / WASD or the arrow buttons to steer", {
        fontFamily: FONT,
        fontSize: "24px",
        color: "#ffffff",
        stroke: "#052e16",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(50);

    this.hideMenu = addMenuButton(this, () => {
      if (!this.dead) this.scene.start("Menu");
    });

    this.keys = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      w: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    addDPad(this, (dx, dy) => {
      gameAudio.unlock();
      this.turn(dx, dy);
    });

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (p.x < 140 && p.y < 70) return;
      if (p.x > GAME_WIDTH - 250 && p.y > GAME_HEIGHT - 190) return; // on the arrow pad
      gameAudio.unlock();
      this.swipeStart = new Phaser.Math.Vector2(p.x, p.y);
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!p.isDown || !this.swipeStart || this.dead) return;
      const dx = p.x - this.swipeStart.x;
      const dy = p.y - this.swipeStart.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
      if (Math.abs(dx) > Math.abs(dy)) this.turn(dx > 0 ? 1 : -1, 0);
      else this.turn(0, dy > 0 ? 1 : -1);
      this.swipeStart.set(p.x, p.y);
    });
    this.input.on("pointerup", () => (this.swipeStart = null));

    this.placeFood();
    this.draw();
  }

  private turn(x: number, y: number): void {
    if (this.dead) return;
    const base = this.pending ?? this.dir;
    if (base.x === -x && base.y === -y) return; // no reversing
    if (base.x === x && base.y === y) return;
    this.pending = { x, y };
    if (!this.started) {
      this.started = true;
      this.hint.setVisible(false);
      gameAudio.startMusic();
    }
  }

  private placeFood(): void {
    for (let tries = 0; tries < 500; tries++) {
      const c = { x: Phaser.Math.Between(0, COLS - 1), y: Phaser.Math.Between(0, ROWS - 1) };
      if (!this.snake.some((s) => s.x === c.x && s.y === c.y)) {
        this.food = c;
        return;
      }
    }
  }

  private draw(): void {
    const g = this.gfx;
    g.clear();
    g.fillStyle(0xef4444, 1);
    g.fillCircle(this.food.x * CELL + CELL / 2, OY + this.food.y * CELL + CELL / 2, CELL * 0.38);
    g.fillStyle(0x22c55e, 1);
    g.fillRect(this.food.x * CELL + CELL / 2 - 2, OY + this.food.y * CELL + 3, 4, 7);

    this.snake.forEach((c, i) => {
      g.fillStyle(i === 0 ? 0xfde047 : i % 2 === 0 ? 0x84cc16 : 0xa3e635, 1);
      g.fillRoundedRect(c.x * CELL + 2, OY + c.y * CELL + 2, CELL - 4, CELL - 4, 8);
    });
    const h = this.snake[0];
    g.fillStyle(0x0f172a, 1);
    g.fillCircle(h.x * CELL + CELL / 2 + this.dir.x * 5 - this.dir.y * 6, OY + h.y * CELL + CELL / 2 + this.dir.y * 5 + this.dir.x * 6, 3);
    g.fillCircle(h.x * CELL + CELL / 2 + this.dir.x * 5 + this.dir.y * 6, OY + h.y * CELL + CELL / 2 + this.dir.y * 5 - this.dir.x * 6, 3);
  }

  private step(): void {
    if (this.pending) {
      this.dir = this.pending;
      this.pending = null;
    }
    const head = this.snake[0];
    const next = { x: head.x + this.dir.x, y: head.y + this.dir.y };
    const eating = next.x === this.food.x && next.y === this.food.y;
    const body = eating ? this.snake : this.snake.slice(0, -1);
    if (next.x < 0 || next.y < 0 || next.x >= COLS || next.y >= ROWS || body.some((s) => s.x === next.x && s.y === next.y)) {
      this.die();
      return;
    }
    this.snake.unshift(next);
    if (eating) {
      this.score += 1;
      this.scoreText.setText(String(this.score));
      gameAudio.coin();
      this.placeFood();
    } else {
      this.snake.pop();
    }
    this.draw();
  }

  private die(): void {
    this.dead = true;
    gameAudio.hit();
    gameAudio.stopMusic();
    this.lockUntil = this.time.now + 450;
    this.hideMenu();
    showGameOver(this, `Length ${this.snake.length} · Score ${this.score}`, () => this.scene.restart(), () => this.scene.start("Menu"));
  }

  update(time: number, delta: number): void {
    if (this.dead) {
      if (time < this.lockUntil) return;
      const tap = pollEndTaps();
      if (tap === "restart") this.scene.restart();
      else if (tap === "menu") this.scene.start("Menu");
      return;
    }

    if (this.keys.left.isDown || this.wasd.a.isDown) this.turn(-1, 0);
    else if (this.keys.right.isDown || this.wasd.d.isDown) this.turn(1, 0);
    else if (this.keys.up.isDown || this.wasd.w.isDown) this.turn(0, -1);
    else if (this.keys.down.isDown || this.wasd.s.isDown) this.turn(0, 1);

    if (!this.started) return;
    this.acc += Math.min(delta, 50);
    const interval = Math.max(70, 135 - this.score * 2);
    while (this.acc >= interval && !this.dead) {
      this.acc -= interval;
      this.step();
    }
  }
}
