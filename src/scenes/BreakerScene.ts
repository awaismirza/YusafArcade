import Phaser from "phaser";
import { FONT } from "../ui/theme";
import { drawGlass } from "../ui/glass";
import { setGradientBackground } from "../ui/background";
import { addChip, Chip } from "../ui/chips";
import { PALETTES } from "../ui/palettes";
import { RoundTile } from "../ui/roundTile";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { gameAudio } from "../audio/sfx";
import { deviceUsesTouch } from "../input/touchPad";
import { setTouchChrome } from "../input/touchChrome";
import { addMenuButton, overMenuButton, pollEndTaps, resetTaps, showGameOver } from "../ui/arcadeKit";

type Brick = { rect: RoundTile; hp: number };
type Ball = { circle: Phaser.GameObjects.Arc; vx: number; vy: number };
type Drop = { sprite: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; kind: "wide" | "multi" };

const COLS = 12;
const BRICK_W = 72;
const BRICK_H = 24;
const GAP = 4;
const TOP = 96;
const PADDLE_Y = GAME_HEIGHT - 44;
const BALL_R = 8;
const ROW_COLORS = [0xef4444, 0xf97316, 0xeab308, 0x22c55e, 0x06b6d4, 0x6366f1, 0xa855f7, 0xec4899];

export class BreakerScene extends Phaser.Scene {
  private paddle!: RoundTile;
  private paddleW = 120;
  private wideUntil = 0;
  private bricks: Brick[] = [];
  private balls: Ball[] = [];
  private drops: Drop[] = [];
  private launched = false;
  private score = 0;
  private lives = 3;
  private level = 1;
  private dead = false;
  private lockUntil = 0;
  private scoreText!: Chip;
  private livesText!: Chip;
  private hint!: Phaser.GameObjects.Text;
  private hideMenu!: () => void;
  private keys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private leftHeld = false;
  private rightHeld = false;
  private paddleVel = 0;
  private launchKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: "Breaker" });
  }

  init(): void {
    this.bricks = [];
    this.balls = [];
    this.drops = [];
    this.launched = false;
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.dead = false;
    this.lockUntil = 0;
    this.paddleW = 120;
    this.wideUntil = 0;
    resetTaps();
  }

  create(): void {
    setTouchChrome("hidden");
    this.cameras.main.setBackgroundColor(0x0f172a);
    setGradientBackground(this, PALETTES.breaker);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setTouchChrome("hidden"));

    this.paddle = new RoundTile(this, GAME_WIDTH / 2, PADDLE_Y, this.paddleW, 14, 0xe2e8f0, { radius: 7 }).setDepth(10);

    this.scoreText = addChip(this, GAME_WIDTH / 2, 34, { icon: "⭐", width: 150, depth: 50 });
    this.livesText = addChip(this, GAME_WIDTH - 110, 34, { width: 170, depth: 50 });
    this.hint = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 70, deviceUsesTouch() ? "Hold ◀ ▶ to glide · tap to launch" : "Mouse / arrows to move · click or SPACE to launch", {
        fontFamily: FONT,
        fontSize: "20px",
        color: "#e2e8f0",
      })
      .setOrigin(0.5)
      .setDepth(50);

    this.hideMenu = addMenuButton(this, () => {
      if (!this.dead) this.scene.start("Menu");
    });

    this.leftHeld = false;
    this.rightHeld = false;
    this.paddleVel = 0;
    this.makeMoveButton(100, "◀", (down) => (this.leftHeld = down));
    this.makeMoveButton(GAME_WIDTH - 100, "▶", (down) => (this.rightHeld = down));

    this.keys = this.input.keyboard!.createCursorKeys();
    this.launchKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.dead || overMenuButton(p)) return;
      gameAudio.unlock();
      this.launch();
    });

    this.buildLevel();
    this.resetBall();
    this.syncHud();
  }

  /** Big hold-to-move pad in a bottom corner. Works with touch and mouse. */
  private makeMoveButton(x: number, label: string, set: (down: boolean) => void): void {
    const y = GAME_HEIGHT - 44;
    const g = this.add.graphics().setDepth(40);
    const paint = (down: boolean): void => {
      g.clear();
      drawGlass(g, x, y, 170, 70, { tint: 0xffffff, alpha: down ? 0.38 : 0.16, radius: 26 });
    };
    paint(false);
    const bg = this.add.rectangle(x, y, 170, 70, 0xffffff, 0.001).setDepth(42).setInteractive();
    this.add
      .text(x, y, label, { fontFamily: FONT, fontSize: "34px", color: "#ffffff" })
      .setOrigin(0.5)
      .setAlpha(0.7)
      .setDepth(41);
    const on = (): void => {
      set(true);
      paint(true);
    };
    const off = (): void => {
      set(false);
      paint(false);
    };
    bg.on("pointerdown", on);
    bg.on("pointerup", off);
    bg.on("pointerout", off);
    bg.on("pointerupoutside", off);
  }

  private buildLevel(): void {
    for (const b of this.bricks) b.rect.destroy();
    this.bricks = [];
    const rows = Math.min(4 + this.level, 8);
    const startX = (GAME_WIDTH - COLS * (BRICK_W + GAP) + GAP) / 2 + BRICK_W / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < COLS; c++) {
        const tough = this.level >= 3 && r < 2;
        const rect = new RoundTile(this, startX + c * (BRICK_W + GAP), TOP + r * (BRICK_H + GAP), BRICK_W, BRICK_H, tough ? 0x475569 : ROW_COLORS[r % ROW_COLORS.length], { radius: 7 }).setDepth(5);
        this.bricks.push({ rect, hp: tough ? 2 : 1 });
      }
    }
  }

  private ballSpeed(): number {
    return 360 + this.level * 28;
  }

  private resetBall(): void {
    for (const b of this.balls) b.circle.destroy();
    this.balls = [];
    this.launched = false;
    this.balls.push({
      circle: this.add.circle(this.paddle.x, PADDLE_Y - 14 - BALL_R, BALL_R, 0xffffff).setDepth(10),
      vx: 0,
      vy: 0,
    });
    this.hint.setVisible(true);
  }

  private launch(): void {
    if (this.launched || this.dead) return;
    this.launched = true;
    this.hint.setVisible(false);
    gameAudio.startMusic();
    const a = Phaser.Math.FloatBetween(-0.35, 0.35);
    const sp = this.ballSpeed();
    this.balls[0].vx = Math.sin(a) * sp;
    this.balls[0].vy = -Math.cos(a) * sp;
  }

  private syncHud(): void {
    this.scoreText.setText(`${this.score}`);
    this.livesText.setText(`L${this.level}  ` + "❤️".repeat(Math.max(0, this.lives)));
  }

  private setPaddleWidth(w: number): void {
    this.paddleW = w;
    this.paddle.setTileSize(w, 14, 0xe2e8f0);
  }

  private spawnDrop(x: number, y: number): void {
    const kind: "wide" | "multi" = Math.random() < 0.5 ? "wide" : "multi";
    const sprite = this.add.rectangle(x, y, 40, 20, kind === "wide" ? 0x22c55e : 0xfacc15).setStrokeStyle(2, 0xffffff).setDepth(9);
    const label = this.add
      .text(x, y, kind === "wide" ? "W" : "x3", { fontFamily: FONT, fontSize: "14px", color: "#0f172a", fontStyle: "700" })
      .setOrigin(0.5)
      .setDepth(10);
    this.drops.push({ sprite, label, kind });
  }

  private lose(): void {
    this.lives -= 1;
    gameAudio.hit();
    if (this.lives <= 0) {
      this.dead = true;
      gameAudio.stopMusic();
      this.lockUntil = this.time.now + 450;
      this.hideMenu();
      showGameOver(this, `Score ${this.score} · Level ${this.level}`, () => this.scene.restart(), () => this.scene.start("Menu"));
      return;
    }
    this.resetBall();
  }

  private stepBall(ball: Ball, dt: number): void {
    const c = ball.circle;
    c.x += ball.vx * dt;
    c.y += ball.vy * dt;

    if (c.x < BALL_R) {
      c.x = BALL_R;
      ball.vx = Math.abs(ball.vx);
    } else if (c.x > GAME_WIDTH - BALL_R) {
      c.x = GAME_WIDTH - BALL_R;
      ball.vx = -Math.abs(ball.vx);
    }
    if (c.y < BALL_R) {
      c.y = BALL_R;
      ball.vy = Math.abs(ball.vy);
    }

    // paddle
    const halfW = this.paddleW / 2;
    if (
      ball.vy > 0 &&
      c.y + BALL_R >= PADDLE_Y - 7 &&
      c.y - BALL_R <= PADDLE_Y + 7 &&
      c.x >= this.paddle.x - halfW - BALL_R &&
      c.x <= this.paddle.x + halfW + BALL_R
    ) {
      const rel = Phaser.Math.Clamp((c.x - this.paddle.x) / halfW, -1, 1);
      const a = rel * 1.05;
      const sp = this.ballSpeed();
      ball.vx = Math.sin(a) * sp;
      ball.vy = -Math.cos(a) * sp;
      c.y = PADDLE_Y - 7 - BALL_R;
      gameAudio.jump();
    }

    // bricks
    for (let i = this.bricks.length - 1; i >= 0; i--) {
      const br = this.bricks[i].rect;
      const left = br.x - BRICK_W / 2;
      const right = br.x + BRICK_W / 2;
      const top = br.y - BRICK_H / 2;
      const bottom = br.y + BRICK_H / 2;
      const nx = Phaser.Math.Clamp(c.x, left, right);
      const ny = Phaser.Math.Clamp(c.y, top, bottom);
      const dx = c.x - nx;
      const dy = c.y - ny;
      if (dx * dx + dy * dy > BALL_R * BALL_R) continue;

      if (c.x < left || c.x > right) ball.vx = c.x < left ? -Math.abs(ball.vx) : Math.abs(ball.vx);
      else ball.vy = c.y < top ? -Math.abs(ball.vy) : Math.abs(ball.vy);

      const brick = this.bricks[i];
      brick.hp -= 1;
      if (brick.hp <= 0) {
        if (Math.random() < 0.1) this.spawnDrop(br.x, br.y);
        br.destroy();
        this.bricks.splice(i, 1);
        this.score += 10 * this.level;
      } else {
        br.setFillStyle(0x94a3b8);
        this.score += 5;
      }
      gameAudio.coin();
      break;
    }
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

    // paddle input
    const pointer = this.input.activePointer;
    let dir = 0;
    if (this.keys.left.isDown || this.leftHeld) dir -= 1;
    if (this.keys.right.isDown || this.rightHeld) dir += 1;
    if (dir !== 0) {
      // eased acceleration so the paddle glides instead of jumping
      this.paddleVel += (dir * 640 - this.paddleVel) * Math.min(1, dt * 10);
    } else {
      this.paddleVel += (0 - this.paddleVel) * Math.min(1, dt * 14);
      if (Math.abs(this.paddleVel) < 4) this.paddleVel = 0;
      // desktop mouse follow only when no buttons/keys are in use
      if (!deviceUsesTouch() && pointer.y > 70 && this.input.mousePointer.active) {
        this.paddle.x += (pointer.x - this.paddle.x) * Math.min(1, dt * 14);
      }
    }
    this.paddle.x += this.paddleVel * dt;
    this.paddle.x = Phaser.Math.Clamp(this.paddle.x, this.paddleW / 2, GAME_WIDTH - this.paddleW / 2);
    if (Phaser.Input.Keyboard.JustDown(this.launchKey)) this.launch();

    if (this.wideUntil && time > this.wideUntil) {
      this.wideUntil = 0;
      this.setPaddleWidth(120);
    }

    if (!this.launched) {
      this.balls[0].circle.setPosition(this.paddle.x, PADDLE_Y - 14 - BALL_R);
    } else {
      for (let i = this.balls.length - 1; i >= 0; i--) {
        const ball = this.balls[i];
        this.stepBall(ball, dt);
        if (ball.circle.y > GAME_HEIGHT + 20) {
          ball.circle.destroy();
          this.balls.splice(i, 1);
        }
      }
      if (this.balls.length === 0) {
        this.lose();
        this.syncHud();
        return;
      }
    }

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.sprite.y += 150 * dt;
      d.label.y = d.sprite.y;
      const caught =
        Math.abs(d.sprite.x - this.paddle.x) < this.paddleW / 2 + 20 && Math.abs(d.sprite.y - PADDLE_Y) < 18;
      if (caught) {
        if (d.kind === "wide") {
          this.setPaddleWidth(190);
          this.wideUntil = time + 12000;
        } else if (this.balls.length > 0 && this.launched) {
          const src = this.balls[0];
          const sp = this.ballSpeed();
          for (const a of [-0.5, 0.5]) {
            const ang = Math.atan2(src.vy, src.vx) + a;
            this.balls.push({
              circle: this.add.circle(src.circle.x, src.circle.y, BALL_R, 0xfde047).setDepth(10),
              vx: Math.cos(ang) * sp,
              vy: Math.sin(ang) * sp,
            });
          }
        }
        gameAudio.coin();
      }
      if (caught || d.sprite.y > GAME_HEIGHT + 20) {
        d.sprite.destroy();
        d.label.destroy();
        this.drops.splice(i, 1);
      }
    }

    if (this.bricks.length === 0) {
      this.level += 1;
      this.buildLevel();
      this.resetBall();
    }
    this.syncHud();
  }
}
