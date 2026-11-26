import Phaser from "phaser";
import { setGradientBackground } from "../ui/background";
import { addChip, Chip } from "../ui/chips";
import { PALETTES } from "../ui/palettes";
import { RoundTile } from "../ui/roundTile";
import { GAME_WIDTH } from "../config";
import { gameAudio } from "../audio/sfx";
import { setTouchChrome } from "../input/touchChrome";
import { addMenuButton, FONT, getBest, pollEndTaps, resetTaps, saveBest, showGameOver, showLevelPicker } from "../ui/arcadeKit";

const PADS = [
  { base: 0xb91c1c, lit: 0xfca5a5 },
  { base: 0x1d4ed8, lit: 0x93c5fd },
  { base: 0x15803d, lit: 0x86efac },
  { base: 0xca8a04, lit: 0xfde047 },
];

type State = "idle" | "show" | "input";

export class SimonScene extends Phaser.Scene {
  private seq: number[] = [];
  private idx = 0;
  private state: State = "idle";
  private lives = 3;
  private speed = 650;
  private dead = false;
  private lockUntil = 0;
  private pads: RoundTile[] = [];
  private status!: Phaser.GameObjects.Text;
  private scoreText!: Chip;
  private livesText!: Chip;
  private hideMenu!: () => void;

  constructor() {
    super({ key: "Simon" });
  }

  init(): void {
    this.seq = [];
    this.idx = 0;
    this.state = "idle";
    this.dead = false;
    this.lockUntil = 0;
    this.pads = [];
    resetTaps();
  }

  create(): void {
    setTouchChrome("hidden");
    setGradientBackground(this, PALETTES.simon);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setTouchChrome("hidden"));

    this.scoreText = addChip(this, GAME_WIDTH / 2, 34, { width: 180 });
    this.scoreText.setText("Round 0");
    this.add.text(GAME_WIDTH - 100, 74, `🏆 Best ${getBest("simon")}`, { fontFamily: FONT, fontSize: "16px", color: "#fde68a" }).setOrigin(0.5);
    this.livesText = addChip(this, GAME_WIDTH - 100, 34, { width: 140 });
    this.status = this.add.text(GAME_WIDTH / 2, 90, "", { fontFamily: FONT, fontSize: "28px", color: "#fde047", fontStyle: "700" }).setOrigin(0.5);

    PADS.forEach((p, i) => {
      const x = GAME_WIDTH / 2 + (i % 2 === 0 ? -125 : 125);
      const y = 215 + Math.floor(i / 2) * 150;
      const pad = new RoundTile(this, x, y, 230, 136, p.base, { radius: 26 }).setInteractive({ useHandCursor: true });
      pad.on("pointerdown", () => this.press(i));
      this.pads.push(pad);
    });

    this.hideMenu = addMenuButton(this, () => {
      if (!this.dead) this.scene.start("Menu");
    });

    showLevelPicker(this, "Memory Lights 💡", "Watch the lights, then repeat the pattern!\nEach round adds one more light.", (tier) => {
      this.lives = tier === 0 ? 3 : 2;
      this.speed = tier === 0 ? 650 : 400;
      gameAudio.unlock();
      this.syncHud();
      this.time.delayedCall(500, () => this.newRound());
    });
  }

  private syncHud(): void {
    this.scoreText.setText(`Round ${this.seq.length}`);
    this.livesText.setText("❤️".repeat(Math.max(0, this.lives)));
  }

  private flash(i: number, dur: number): void {
    this.pads[i].setFillStyle(PADS[i].lit);
    gameAudio.jump();
    this.time.delayedCall(dur, () => this.pads[i].setFillStyle(PADS[i].base));
  }

  private newRound(): void {
    this.seq.push(Phaser.Math.Between(0, 3));
    this.syncHud();
    this.showSequence();
  }

  private showSequence(): void {
    this.state = "show";
    this.idx = 0;
    this.status.setText("Watch carefully… 👀");
    this.seq.forEach((p, i) => {
      this.time.delayedCall(700 + i * this.speed, () => this.flash(p, this.speed * 0.6));
    });
    this.time.delayedCall(700 + this.seq.length * this.speed, () => {
      this.state = "input";
      this.status.setText("Your turn! 👆");
    });
  }

  private press(i: number): void {
    if (this.state !== "input" || this.dead) return;
    gameAudio.unlock();
    this.flash(i, 180);
    if (i === this.seq[this.idx]) {
      this.idx += 1;
      if (this.idx === this.seq.length) {
        this.state = "idle";
        this.status.setText("Great! ⭐");
        gameAudio.coin();
        this.time.delayedCall(900, () => this.newRound());
      }
      return;
    }
    this.state = "idle";
    this.lives -= 1;
    gameAudio.hit();
    this.syncHud();
    if (this.lives <= 0) {
      this.time.delayedCall(700, () => this.finish());
    } else {
      this.status.setText("Oops! Watch again…");
      this.time.delayedCall(1200, () => this.showSequence());
    }
  }

  private finish(): void {
    this.dead = true;
    const score = Math.max(0, this.seq.length - 1);
    const record = saveBest("simon", score);
    this.lockUntil = this.time.now + 500;
    this.hideMenu();
    showGameOver(
      this,
      `You remembered ${score} light${score === 1 ? "" : "s"}\n🏆 Best ${getBest("simon")}${record ? " — New record!" : ""}`,
      () => this.scene.restart(),
      () => this.scene.start("Menu"),
      "Great memory!"
    );
  }

  update(time: number): void {
    if (!this.dead || time < this.lockUntil) return;
    const tap = pollEndTaps();
    if (tap === "restart") this.scene.restart();
    else if (tap === "menu") this.scene.start("Menu");
  }
}
