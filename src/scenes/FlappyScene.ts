import Phaser from "phaser";
import { FONT } from "../ui/theme";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { gameAudio } from "../audio/sfx";
import { deviceUsesTouch, touchPad } from "../input/touchPad";
import { setTouchChrome } from "../input/touchChrome";
import { addMenuButton } from "../ui/arcadeKit";
import { addEndGameButtons } from "../ui/endGameButtons";

/** Classic Flappy Bird feel: constant speed, constant gap, endless green pipes. */
const BASE = {
  gravityY: 1500,
  flap: -420,
  groundY: GAME_HEIGHT - 28,
  birdX: 200,
  speed: 190,
  gap: 160,
  spacing: 250,
  pipeW: 72,
} as const;

type PipePair = {
  scored: boolean;
  solids: Phaser.Physics.Arcade.Image[];
  x: number;
};

export class FlappyScene extends Phaser.Scene {
  private bird!: Phaser.Physics.Arcade.Sprite;
  private groundTiles: Phaser.GameObjects.TileSprite[] = [];
  private pipes: PipePair[] = [];
  private score = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private playing = false;
  private dead = false;
  private flapKey!: Phaser.Input.Keyboard.Key;
  private endShown = false;
  private hideMenu!: () => void;
  private gameOverLockUntil = 0;
  private flapPointer!: (pointer: Phaser.Input.Pointer) => void;

  constructor() {
    super({ key: "Flappy" });
  }

  init(): void {
    this.dead = false;
    this.playing = false;
    this.endShown = false;
    this.score = 0;
    this.pipes = [];
    this.groundTiles = [];
    this.gameOverLockUntil = 0;
    touchPad.flapTap = false;
    touchPad.restartTap = false;
    touchPad.retryTap = false;
    touchPad.menuTap = false;
  }

  create(): void {
    setTouchChrome("flappy");
    this.physics.world.gravity.y = BASE.gravityY;
    this.physics.resume();
    this.physics.disableUpdate();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      setTouchChrome("hidden");
      if (this.flapPointer) this.input.off("pointerdown", this.flapPointer);
    });

    this.cameras.main.setBackgroundColor(0x7dd3fc);

    const sky = this.add.graphics();
    sky.fillGradientStyle(0x38bdf8, 0x38bdf8, 0xe0f2fe, 0xe0f2fe, 1);
    sky.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    sky.setScrollFactor(0).setDepth(-10);

    for (let x = 0; x < GAME_WIDTH + 128; x += 64) {
      const tile = this.add
        .tileSprite(x + 32, BASE.groundY + 28, 64, 56, "flappy-ground")
        .setOrigin(0.5, 1)
        .setDepth(5);
      this.groundTiles.push(tile);
    }

    const groundBody = this.add.rectangle(GAME_WIDTH / 2, BASE.groundY + 8, GAME_WIDTH, 40, 0x000000, 0);
    this.physics.add.existing(groundBody, true);

    this.bird = this.physics.add.sprite(BASE.birdX, GAME_HEIGHT / 2, "flappy-bird");
    this.bird.setDepth(20).setCircle(14, 6, 8);
    const body = this.bird.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setCollideWorldBounds(true);
    body.setMaxVelocity(900, 900);

    this.physics.add.collider(this.bird, groundBody, () => this.die(), undefined, this);

    this.scoreText = this.add
      .text(GAME_WIDTH / 2, 56, "0", {
        fontFamily: FONT,
        fontSize: "64px",
        color: "#ffffff",
        stroke: "#0f172a",
        strokeThickness: 8,
        fontStyle: "700",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(50);

    this.hintText = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 - 20,
        deviceUsesTouch() ? "Tap Flap or tap the screen" : "SPACE or click to flap",
        {
          fontFamily: FONT,
          fontSize: "22px",
          color: "#0f172a",
        }
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(50);

    this.makeMenuButton();

    this.flapKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.flapPointer = (pointer: Phaser.Input.Pointer) => {
      if (this.dead) return;
      if (pointer.y > GAME_HEIGHT - 100 && deviceUsesTouch()) return;
      this.flap();
    };
    this.input.on("pointerdown", this.flapPointer);

    this.ensurePipesAhead();
  }

  /** Keep pipes filling the lane to the right of the bird, forever. */
  private ensurePipesAhead(): void {
    const horizon = this.bird.x + GAME_WIDTH + 200;
    let rightmost = this.bird.x + 140;
    for (const p of this.pipes) rightmost = Math.max(rightmost, p.x);
    while (rightmost < horizon) {
      rightmost += BASE.spacing;
      this.spawnPipe(rightmost);
    }
  }

  private makeMenuButton(): void {
    this.hideMenu = addMenuButton(this, () => {
      if (!this.dead) this.goMenu();
    });
  }

  private goMenu(): void {
    touchPad.menuTap = false;
    setTouchChrome("hidden");
    this.scene.start("Menu");
  }

  private restartFlappy(): void {
    touchPad.restartTap = false;
    touchPad.retryTap = false;
    touchPad.flapTap = false;
    setTouchChrome("flappy");
    this.scene.restart();
  }

  private spawnPipe(x: number): void {
    const gap = BASE.gap;
    const margin = 90;
    const minC = margin + gap / 2;
    const maxC = BASE.groundY - margin - gap / 2;
    const gapCenter = Phaser.Math.Between(minC, maxC);

    const topH = gapCenter - gap / 2;
    const bottomY = gapCenter + gap / 2;
    const bottomH = BASE.groundY - bottomY;
    const solids: Phaser.Physics.Arcade.Image[] = [];

    const top = this.physics.add
      .image(x, topH, "flappy-pipe")
      .setOrigin(0.5, 1)
      .setDepth(8)
      .setDisplaySize(BASE.pipeW, topH)
      .setImmovable(true);
    (top.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setSize(64, topH);
    solids.push(top);
    this.physics.add.overlap(this.bird, top, () => this.die(), undefined, this);

    const bottom = this.physics.add
      .image(x, bottomY, "flappy-pipe")
      .setOrigin(0.5, 0)
      .setDepth(8)
      .setDisplaySize(BASE.pipeW, bottomH)
      .setImmovable(true);
    (bottom.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setSize(64, bottomH);
    solids.push(bottom);
    this.physics.add.overlap(this.bird, bottom, () => this.die(), undefined, this);

    this.pipes.push({ scored: false, solids, x });
  }

  private flap(): void {
    if (this.dead) return;
    if (!this.playing) {
      this.playing = true;
      this.hintText.setVisible(false);
      (this.bird.body as Phaser.Physics.Arcade.Body).setAllowGravity(true);
      gameAudio.startMusic();
    }
    this.bird.setVelocityY(BASE.flap);
    gameAudio.jump();
  }

  private die(): void {
    if (this.dead) return;
    this.dead = true;
    this.playing = false;
    gameAudio.hit();
    gameAudio.stopMusic();
    this.physics.pause();

    touchPad.flapTap = false;
    touchPad.restartTap = false;
    touchPad.retryTap = false;
    touchPad.menuTap = false;
    this.gameOverLockUntil = this.time.now + 450;

    setTouchChrome("gameover");
    this.hideMenu();

    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0f172a, 0.45)
      .setScrollFactor(0)
      .setDepth(70);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 72, "Game Over", {
        fontFamily: FONT,
        fontSize: "44px",
        color: "#fecaca",
        fontStyle: "700",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(75);

    this.hintText
      .setVisible(true)
      .setDepth(76)
      .setText(`Score ${this.score} · Restart or Main Menu`);
    if (!this.endShown) {
      this.endShown = true;
      addEndGameButtons(this, () => this.restartFlappy(), () => this.goMenu());
    }
    this.bird.setTint(0xfca5a5);
    const body = this.bird.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setAllowGravity(false);
    this.tweens.add({ targets: this.bird, angle: 80, duration: 260 });
  }

  update(time: number, delta: number): void {
    const step = Math.min(delta, 34);
    if (!this.dead) {
      const world = this.physics.world as Phaser.Physics.Arcade.World & { _elapsed: number };
      if (world._elapsed > 34) world._elapsed = 34;
      world.update(time, step);
    }

    const dt = step / 1000;

    if (this.dead) {
      if (this.time.now < this.gameOverLockUntil) return;
      if (touchPad.restartTap || touchPad.retryTap) {
        this.restartFlappy();
        return;
      }
      if (touchPad.menuTap) {
        this.goMenu();
        return;
      }
      return;
    }

    if (touchPad.menuTap) {
      // The phone's HTML control bar has its own Menu button (the canvas one is small there).
      touchPad.menuTap = false;
      this.goMenu();
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.flapKey)) this.flap();
    if (touchPad.flapTap) {
      touchPad.flapTap = false;
      this.flap();
    }

    const scroll = this.playing ? BASE.speed * dt : 0;
    for (const tile of this.groundTiles) tile.tilePositionX += scroll * 0.9;

    if (this.playing) {
      this.ensurePipesAhead();

      for (let i = this.pipes.length - 1; i >= 0; i--) {
        const p = this.pipes[i];
        p.x -= scroll;
        for (const s of p.solids) s.x -= scroll;

        if (!p.scored && p.x + BASE.pipeW / 2 < this.bird.x) {
          p.scored = true;
          this.score += 1;
          this.scoreText.setText(String(this.score));
          gameAudio.coin();
        }

        if (p.x < -120) {
          p.solids.forEach((s) => s.destroy());
          this.pipes.splice(i, 1);
        }
      }

      if (this.pipes.length < 2) this.ensurePipesAhead();

      if (this.bird.y < 8 || this.bird.y > BASE.groundY) this.die();
    }
  }
}
