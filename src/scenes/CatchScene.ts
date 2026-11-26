import Phaser from "phaser";
import { FONT } from "../ui/theme";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { gameAudio } from "../audio/sfx";
import { deviceUsesTouch } from "../input/touchPad";
import { setTouchChrome } from "../input/touchChrome";
import { addMenuButton, addMovePads, pollEndTaps, resetTaps, showGameOver } from "../ui/arcadeKit";

const FRUITS = ["🍎", "🍌", "🍇", "🍊", "🍓", "🍉"];
const BASKET_Y = GAME_HEIGHT - 110;

type Item = { text: Phaser.GameObjects.Text; bomb: boolean; vy: number };

export class CatchScene extends Phaser.Scene {
  private basket!: Phaser.GameObjects.Text;
  private items: Item[] = [];
  private vel = 0;
  private score = 0;
  private lives = 3;
  private started = false;
  private dead = false;
  private nextSpawn = 0;
  private survived = 0;
  private lockUntil = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private hideMenu!: () => void;
  private pads!: { dir: () => number };
  private keys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { a: Phaser.Input.Keyboard.Key; d: Phaser.Input.Keyboard.Key };

  constructor() {
    super({ key: "Catch" });
  }

  init(): void {
    this.items = [];
    this.vel = 0;
    this.score = 0;
    this.lives = 3;
    this.started = false;
    this.dead = false;
    this.nextSpawn = 0;
    this.survived = 0;
    this.lockUntil = 0;
    resetTaps();
  }

  create(): void {
    setTouchChrome("hidden");
    this.cameras.main.setBackgroundColor(0x0ea5e9);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setTouchChrome("hidden"));

    const bg = this.add.graphics().setDepth(-5);
    bg.fillGradientStyle(0x38bdf8, 0x38bdf8, 0xbae6fd, 0xbae6fd, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 8, GAME_WIDTH, 16, 0x65a30d).setDepth(1);

    this.basket = this.add.text(GAME_WIDTH / 2, BASKET_Y, "🧺", { fontFamily: FONT, fontSize: "84px" }).setOrigin(0.5).setDepth(10);

    this.scoreText = this.add
      .text(GAME_WIDTH / 2, 30, "0", { fontFamily: FONT, fontSize: "40px", color: "#ffffff", fontStyle: "700", stroke: "#0c4a6e", strokeThickness: 6 })
      .setOrigin(0.5)
      .setDepth(50);
    this.livesText = this.add
      .text(GAME_WIDTH - 20, 30, "", { fontFamily: FONT, fontSize: "26px", color: "#ef4444" })
      .setOrigin(1, 0.5)
      .setDepth(50);
    this.hint = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, deviceUsesTouch() ? "Hold ◀ ▶ to move\nCatch fruit · dodge 💣" : "Arrow keys / A D or mouse to move\nCatch fruit · dodge 💣", {
        fontFamily: FONT,
        fontSize: "24px",
        color: "#ffffff",
        align: "center",
        stroke: "#0c4a6e",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(50);
    this.syncHud();

    this.hideMenu = addMenuButton(this, () => {
      if (!this.dead) this.scene.start("Menu");
    });
    this.pads = addMovePads(this);

    this.keys = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      a: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      d: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.input.on("pointerdown", () => gameAudio.unlock());
  }

  private begin(): void {
    if (this.started) return;
    this.started = true;
    this.hint.setVisible(false);
    gameAudio.startMusic();
  }

  private syncHud(): void {
    this.scoreText.setText(String(this.score));
    this.livesText.setText("❤️".repeat(Math.max(0, this.lives)));
  }

  private spawn(): void {
    const bomb = Math.random() < Math.min(0.32, 0.18 + this.survived * 0.002);
    const text = this.add
      .text(Phaser.Math.Between(40, GAME_WIDTH - 40), -40, bomb ? "💣" : Phaser.Utils.Array.GetRandom(FRUITS), { fontFamily: FONT, fontSize: "46px" })
      .setOrigin(0.5)
      .setDepth(8);
    this.items.push({ text, bomb, vy: Phaser.Math.Between(150, 210) + Math.min(this.survived * 4, 260) });
  }

  private loseLife(): void {
    this.lives -= 1;
    gameAudio.hit();
    this.cameras.main.shake(120, 0.005);
    if (this.lives <= 0) this.die();
  }

  private die(): void {
    this.dead = true;
    gameAudio.stopMusic();
    this.lockUntil = this.time.now + 450;
    this.hideMenu();
    showGameOver(this, `Score ${this.score}`, () => this.scene.restart(), () => this.scene.start("Menu"));
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

    let dir = this.pads.dir();
    if (this.keys.left.isDown || this.wasd.a.isDown) dir -= 1;
    if (this.keys.right.isDown || this.wasd.d.isDown) dir += 1;
    dir = Phaser.Math.Clamp(dir, -1, 1);
    if (dir !== 0) {
      this.begin();
      this.vel += (dir * 700 - this.vel) * Math.min(1, dt * 10);
    } else {
      this.vel += (0 - this.vel) * Math.min(1, dt * 14);
      if (Math.abs(this.vel) < 4) this.vel = 0;
      const p = this.input.activePointer;
      if (!deviceUsesTouch() && p.y > 70 && this.input.mousePointer.active && p.x > 0) {
        this.basket.x += (p.x - this.basket.x) * Math.min(1, dt * 12);
        if (Math.abs(p.x - this.basket.x) > 3) this.begin();
      }
    }
    this.basket.x = Phaser.Math.Clamp(this.basket.x + this.vel * dt, 50, GAME_WIDTH - 50);

    if (!this.started) return;

    this.survived += dt;
    if (time >= this.nextSpawn) {
      this.nextSpawn = time + Math.max(380, 900 - this.survived * 8);
      this.spawn();
    }

    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.text.y += it.vy * dt;
      it.text.rotation += (it.bomb ? 0 : 1.2) * dt;

      const nearBasket = Math.abs(it.text.x - this.basket.x) < 58 && it.text.y > BASKET_Y - 34 && it.text.y < BASKET_Y + 20;
      if (nearBasket) {
        if (it.bomb) {
          this.loseLife();
        } else {
          this.score += 10;
          gameAudio.coin();
        }
        it.text.destroy();
        this.items.splice(i, 1);
        if (this.dead) return;
      } else if (it.text.y > GAME_HEIGHT + 30) {
        if (!it.bomb) this.loseLife();
        it.text.destroy();
        this.items.splice(i, 1);
        if (this.dead) return;
      }
    }
    this.syncHud();
  }
}
