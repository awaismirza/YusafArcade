import Phaser from "phaser";
import { setGradientBackground } from "../ui/background";
import { addChip, Chip } from "../ui/chips";
import { PALETTES } from "../ui/palettes";
import { RoundTile } from "../ui/roundTile";
import { LEVEL_COUNT, makeLevel } from "../games/robot/levels";
import { GAME_WIDTH } from "../config";
import { gameAudio } from "../audio/sfx";
import { setTouchChrome } from "../input/touchChrome";
import { addMenuButton, FONT, getBest, makeButton, pollEndTaps, resetTaps, saveBest, showGameOver, showLevelPicker } from "../ui/arcadeKit";

type Dir = 0 | 1 | 2 | 3; // up, right, down, left
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
const ARROWS = ["⬆️", "➡️", "⬇️", "⬅️"];
const LEVELS = LEVEL_COUNT;
const MAX_SLOTS = 12;

type Pt = { x: number; y: number };

export class RobotScene extends Phaser.Scene {
  private tier: 0 | 1 = 0;
  private size = 5;
  private cs = 64;
  private level = 0;
  private score = 0;
  private start: Pt = { x: 0, y: 0 };
  private goal: Pt = { x: 0, y: 0 };
  private walls = new Set<string>();
  private pathLen = 0;
  private maxCmds = 8;
  private program: Dir[] = [];
  private running = false;
  private dead = false;
  private lockUntil = 0;
  private levelObjs: Phaser.GameObjects.GameObject[] = [];
  private robot!: Phaser.GameObjects.Text;
  private slotRects: RoundTile[] = [];
  private slotTexts: Phaser.GameObjects.Text[] = [];
  private title!: Chip;
  private scoreText!: Chip;
  private msg!: Phaser.GameObjects.Text;
  private limitText!: Phaser.GameObjects.Text;
  private hideMenu!: () => void;

  constructor() {
    super({ key: "Robot" });
  }

  init(): void {
    this.level = 0;
    this.score = 0;
    this.program = [];
    this.running = false;
    this.dead = false;
    this.lockUntil = 0;
    this.levelObjs = [];
    this.slotRects = [];
    this.slotTexts = [];
    resetTaps();
  }

  create(): void {
    setTouchChrome("hidden");
    setGradientBackground(this, PALETTES.robot);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setTouchChrome("hidden"));

    this.title = addChip(this, GAME_WIDTH / 2, 34, { width: 200 });
    this.scoreText = addChip(this, GAME_WIDTH - 100, 34, { icon: "⭐", width: 150 });
    this.scoreText.setText("Score 0");
    this.add.text(GAME_WIDTH - 100, 74, `🏆 Best ${getBest("robot")}`, { fontFamily: FONT, fontSize: "16px", color: "#fde68a" }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 70, "Program the robot to reach the ⭐ — then press Run!", { fontFamily: FONT, fontSize: "19px", color: "#99f6e4" }).setOrigin(0.5);
    this.limitText = this.add.text(770, 120, "", { fontFamily: FONT, fontSize: "17px", color: "#ccfbf1" }).setOrigin(0.5);
    this.msg = this.add
      .text(770, 495, "", { fontFamily: FONT, fontSize: "18px", color: "#fde047", align: "center", wordWrap: { width: 300 } })
      .setOrigin(0.5);

    // command slots (right panel)
    for (let i = 0; i < MAX_SLOTS; i++) {
      const x = 640 + (i % 6) * 50;
      const y = 160 + Math.floor(i / 6) * 50;
      const r = new RoundTile(this, x, y, 44, 44, 0x134e4a, { raised: false, radius: 10 });
      const t = this.add.text(x, y, "", { fontFamily: FONT, fontSize: "26px" }).setOrigin(0.5);
      this.slotRects.push(r);
      this.slotTexts.push(t);
    }

    // arrow pad
    makeButton(this, 770, 300, 64, 56, "⬆️", 0x0d9488, () => this.add_(0), 28);
    makeButton(this, 700, 374, 64, 56, "⬅️", 0x0d9488, () => this.add_(3), 28);
    makeButton(this, 770, 374, 64, 56, "⬇️", 0x0d9488, () => this.add_(2), 28);
    makeButton(this, 840, 374, 64, 56, "➡️", 0x0d9488, () => this.add_(1), 28);
    makeButton(this, 870, 300, 64, 56, "⌫", 0x64748b, () => this.undo(), 28);
    makeButton(this, 700, 300, 64, 56, "🧹", 0x64748b, () => this.clearAll(), 28);
    makeButton(this, 740, 452, 150, 52, "▶ Run", 0x16a34a, () => this.run(), 24);
    makeButton(this, 900, 452, 80, 52, "↺", 0x7c3aed, () => this.resetRobot(), 28);

    this.input.keyboard!.on("keydown", (e: KeyboardEvent) => {
      if (this.dead || this.running) return;
      if (e.key === "ArrowUp") this.add_(0);
      else if (e.key === "ArrowRight") this.add_(1);
      else if (e.key === "ArrowDown") this.add_(2);
      else if (e.key === "ArrowLeft") this.add_(3);
      else if (e.key === "Backspace") this.undo();
      else if (e.key === "Enter") this.run();
    });

    this.hideMenu = addMenuButton(this, () => {
      if (!this.dead) this.scene.start("Menu");
    });

    showLevelPicker(this, "Code the Robot 🤖", "Give the robot step-by-step arrow commands.\nAvoid the rocks and reach the star in 12 levels!", (tier) => {
      this.tier = tier;
      this.size = tier === 0 ? 5 : 6;
      this.cs = tier === 0 ? 64 : 62;
      gameAudio.unlock();
      gameAudio.startMusic();
      this.nextLevel();
    });
  }

  private cell(p: Pt): Pt {
    const total = this.size * this.cs;
    return { x: 330 - total / 2 + this.cs / 2 + p.x * this.cs, y: 305 - total / 2 + this.cs / 2 + p.y * this.cs };
  }

  private key(p: Pt): string {
    return `${p.x},${p.y}`;
  }

  private inside(p: Pt): boolean {
    return p.x >= 0 && p.y >= 0 && p.x < this.size && p.y < this.size;
  }

  private nextLevel(): void {
    this.levelObjs.forEach((o) => o.destroy());
    this.levelObjs = [];
    if (this.level >= LEVELS) {
      this.finish();
      return;
    }
    this.level += 1;
    this.title.setText(`Level ${this.level} of ${LEVELS}`);
    this.scoreText.setText(`Score ${this.score}`);
    this.program = [];
    this.running = false;
    this.msg.setText("");

    const lv = makeLevel(this.tier, this.level, this.size, Math.random);
    this.start = lv.start;
    this.goal = lv.goal;
    this.pathLen = lv.shortest;
    this.maxCmds = lv.maxCmds;
    this.walls = new Set(lv.walls);
    this.limitText.setText(`Use up to ${this.maxCmds} commands`);

    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const c = this.cell({ x, y });
        const isStart = x === this.start.x && y === this.start.y;
        this.levelObjs.push(new RoundTile(this, c.x, c.y, this.cs - 3, this.cs - 3, isStart ? 0x2dd4bf : (x + y) % 2 === 0 ? 0xccfbf1 : 0x99f6e4, { raised: false, radius: 8 }));
      }
    }
    this.walls.forEach((k) => {
      const [x, y] = k.split(",").map(Number);
      const c = this.cell({ x, y });
      this.levelObjs.push(this.add.text(c.x, c.y, "🪨", { fontFamily: FONT, fontSize: `${this.cs * 0.6}px` }).setOrigin(0.5).setDepth(3));
    });
    const gc = this.cell(this.goal);
    this.levelObjs.push(this.add.text(gc.x, gc.y, "⭐", { fontFamily: FONT, fontSize: `${this.cs * 0.62}px` }).setOrigin(0.5).setDepth(3));

    const sc = this.cell(this.start);
    this.robot = this.add.text(sc.x, sc.y, "🤖", { fontFamily: FONT, fontSize: `${this.cs * 0.66}px` }).setOrigin(0.5).setDepth(6);
    this.levelObjs.push(this.robot);
    this.refreshSlots();
  }

  private refreshSlots(): void {
    this.slotRects.forEach((r, i) => {
      const used = i < this.program.length;
      r.setVisible(i < this.maxCmds);
      r.setFillStyle(used ? 0x0f766e : 0x134e4a);
      this.slotTexts[i].setVisible(i < this.maxCmds);
      this.slotTexts[i].setText(used ? ARROWS[this.program[i]] : "");
    });
  }

  private add_(d: Dir): void {
    if (this.running || this.dead || !this.robot) return;
    if (this.program.length >= this.maxCmds) {
      this.msg.setText("No more room — remove a command first.");
      return;
    }
    this.program.push(d);
    gameAudio.jump();
    this.refreshSlots();
  }

  private undo(): void {
    if (this.running || this.dead) return;
    this.program.pop();
    this.refreshSlots();
  }

  private clearAll(): void {
    if (this.running || this.dead) return;
    this.program = [];
    this.refreshSlots();
  }

  private resetRobot(): void {
    if (this.running || !this.robot) return;
    const sc = this.cell(this.start);
    this.robot.setPosition(sc.x, sc.y);
  }

  private run(): void {
    if (this.running || this.dead || !this.robot) return;
    if (this.program.length === 0) {
      this.msg.setText("Add some arrow commands first!");
      return;
    }
    this.running = true;
    this.msg.setText("");
    this.resetRobot();
    let pos = { ...this.start };
    const cmds = [...this.program];

    const step = (i: number): void => {
      if (i >= cmds.length) {
        this.fail("The robot stopped before reaching the star.");
        return;
      }
      const next = { x: pos.x + DX[cmds[i]], y: pos.y + DY[cmds[i]] };
      if (!this.inside(next) || this.walls.has(this.key(next))) {
        const c = this.cell(pos);
        this.tweens.add({ targets: this.robot, x: c.x + DX[cmds[i]] * 12, y: c.y + DY[cmds[i]] * 12, yoyo: true, duration: 110 });
        this.fail(this.inside(next) ? "Bonk! The robot hit a rock." : "Bonk! The robot hit the edge.");
        return;
      }
      pos = next;
      const c = this.cell(pos);
      gameAudio.jump();
      this.tweens.add({
        targets: this.robot,
        x: c.x,
        y: c.y,
        duration: 260,
        onComplete: () => {
          if (pos.x === this.goal.x && pos.y === this.goal.y) this.success();
          else this.time.delayedCall(80, () => step(i + 1));
        },
      });
    };
    step(0);
  }

  private fail(text: string): void {
    gameAudio.hit();
    this.cameras.main.shake(120, 0.004);
    this.msg.setText(`${text} Change your commands and try again.`);
    this.time.delayedCall(900, () => {
      this.running = false;
      this.resetRobot();
    });
  }

  private success(): void {
    const extra = Math.max(0, this.program.length - this.pathLen);
    const pts = Math.max(5, 20 - extra * 2);
    this.score += pts;
    this.scoreText.setText(`Score ${this.score}`);
    gameAudio.coin();
    this.msg.setText(extra === 0 ? `Perfect route! +${pts} ⭐` : `You made it! +${pts} (a shorter route exists)`);
    this.time.delayedCall(1500, () => this.nextLevel());
  }

  private finish(): void {
    this.dead = true;
    gameAudio.stopMusic();
    this.lockUntil = this.time.now + 500;
    this.hideMenu();
    const record = saveBest("robot", this.score);
    showGameOver(
      this,
      `Score ${this.score}\n🏆 Best ${getBest("robot")}${record ? " — New record!" : ""}`,
      () => this.scene.restart(),
      () => this.scene.start("Menu"),
      "Robot Master! 🤖"
    );
  }

  update(time: number): void {
    if (!this.dead || time < this.lockUntil) return;
    const tap = pollEndTaps();
    if (tap === "restart") this.scene.restart();
    else if (tap === "menu") this.scene.start("Menu");
  }
}
