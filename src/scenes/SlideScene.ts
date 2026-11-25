import Phaser from "phaser";
import { GAME_WIDTH } from "../config";
import { gameAudio } from "../audio/sfx";
import { setTouchChrome } from "../input/touchChrome";
import { addMenuButton, FONT, pollEndTaps, resetTaps, showGameOver, showLevelPicker } from "../ui/arcadeKit";

export class SlideScene extends Phaser.Scene {
  private n = 3;
  private size = 110;
  private grid: number[][] = [];
  private tiles = new Map<number, Phaser.GameObjects.Container>();
  private moves = 0;
  private startTime = 0;
  private started = false;
  private dead = false;
  private lockUntil = 0;
  private info!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private hideMenu!: () => void;

  constructor() {
    super({ key: "Slide" });
  }

  init(): void {
    this.grid = [];
    this.tiles = new Map();
    this.moves = 0;
    this.started = false;
    this.dead = false;
    this.lockUntil = 0;
    resetTaps();
  }

  create(): void {
    setTouchChrome("hidden");
    this.cameras.main.setBackgroundColor(0x422006);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setTouchChrome("hidden"));

    this.info = this.add.text(GAME_WIDTH / 2, 30, "Moves 0 · 0s", { fontFamily: FONT, fontSize: "26px", color: "#ffffff", fontStyle: "700" }).setOrigin(0.5);
    this.hint = this.add.text(GAME_WIDTH / 2, 76, "", { fontFamily: FONT, fontSize: "20px", color: "#fed7aa" }).setOrigin(0.5);

    this.hideMenu = addMenuButton(this, () => {
      if (!this.dead) this.scene.start("Menu");
    });

    this.input.keyboard!.on("keydown", (e: KeyboardEvent) => {
      if (this.dead || this.grid.length === 0) return;
      const [br, bc] = this.blank();
      if (e.key === "ArrowLeft") this.tryMoveCell(br, bc + 1);
      else if (e.key === "ArrowRight") this.tryMoveCell(br, bc - 1);
      else if (e.key === "ArrowUp") this.tryMoveCell(br + 1, bc);
      else if (e.key === "ArrowDown") this.tryMoveCell(br - 1, bc);
    });

    showLevelPicker(this, "Slide Puzzle 🧩", "Slide the tiles to put the numbers in order.\nEasy: 3×3 · Challenge: 4×4", (tier) => {
      this.n = tier === 0 ? 3 : 4;
      this.size = tier === 0 ? 112 : 94;
      gameAudio.unlock();
      this.hint.setText(`Put the numbers in order: 1 → ${this.n * this.n - 1}`);
      this.build();
    });
  }

  private pos(r: number, c: number): { x: number; y: number } {
    const total = this.n * this.size;
    return { x: GAME_WIDTH / 2 - total / 2 + this.size / 2 + c * this.size, y: 305 - total / 2 + this.size / 2 + r * this.size };
  }

  private blank(): [number, number] {
    for (let r = 0; r < this.n; r++) for (let c = 0; c < this.n; c++) if (this.grid[r][c] === 0) return [r, c];
    return [0, 0];
  }

  private build(): void {
    const n = this.n;
    this.grid = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => (r === n - 1 && c === n - 1 ? 0 : r * n + c + 1)));

    // shuffle with random legal moves so it is always solvable
    let br = n - 1;
    let bc = n - 1;
    let last: [number, number] | null = null;
    const steps = n === 3 ? 90 : 220;
    for (let i = 0; i < steps; i++) {
      const options: [number, number][] = [
        [br - 1, bc],
        [br + 1, bc],
        [br, bc - 1],
        [br, bc + 1],
      ];
      const legal = options.filter(([r, c]) => r >= 0 && c >= 0 && r < n && c < n && !(last && last[0] === r && last[1] === c));
      const [r, c] = Phaser.Utils.Array.GetRandom(legal);
      this.grid[br][bc] = this.grid[r][c];
      this.grid[r][c] = 0;
      last = [br, bc];
      br = r;
      bc = c;
    }
    if (this.isSolved()) {
      this.build();
      return;
    }

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const v = this.grid[r][c];
        if (v === 0) continue;
        const { x, y } = this.pos(r, c);
        const rect = this.add
          .rectangle(0, 0, this.size - 8, this.size - 8, 0xf59e0b)
          .setStrokeStyle(3, 0xffffff, 0.5)
          .setInteractive({ useHandCursor: true });
        const text = this.add
          .text(0, 0, String(v), { fontFamily: FONT, fontSize: `${Math.round(this.size * 0.42)}px`, color: "#451a03", fontStyle: "700" })
          .setOrigin(0.5);
        const box = this.add.container(x, y, [rect, text]).setDepth(10);
        rect.on("pointerdown", () => {
          const [tr, tc] = this.find(v);
          this.tryMoveCell(tr, tc);
        });
        this.tiles.set(v, box);
      }
    }
    this.refreshColors();
  }

  private find(v: number): [number, number] {
    for (let r = 0; r < this.n; r++) for (let c = 0; c < this.n; c++) if (this.grid[r][c] === v) return [r, c];
    return [0, 0];
  }

  private isSolved(): boolean {
    const n = this.n;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const expected = r === n - 1 && c === n - 1 ? 0 : r * n + c + 1;
        if (this.grid[r][c] !== expected) return false;
      }
    }
    return true;
  }

  /** Tiles that are in the right place turn green. */
  private refreshColors(): void {
    this.tiles.forEach((box, v) => {
      const [r, c] = this.find(v);
      const right = v === r * this.n + c + 1;
      (box.list[0] as Phaser.GameObjects.Rectangle).setFillStyle(right ? 0x4ade80 : 0xf59e0b);
    });
  }

  private tryMoveCell(r: number, c: number): void {
    if (this.dead || r < 0 || c < 0 || r >= this.n || c >= this.n) return;
    const [br, bc] = this.blank();
    if (Math.abs(r - br) + Math.abs(c - bc) !== 1) return;
    const v = this.grid[r][c];
    this.grid[br][bc] = v;
    this.grid[r][c] = 0;
    if (!this.started) {
      this.started = true;
      this.startTime = this.time.now;
    }
    this.moves += 1;
    gameAudio.jump();
    const target = this.pos(br, bc);
    const box = this.tiles.get(v);
    if (box) this.tweens.add({ targets: box, x: target.x, y: target.y, duration: 90 });
    this.refreshColors();
    if (this.isSolved()) this.win();
  }

  private win(): void {
    this.dead = true;
    gameAudio.coin();
    this.lockUntil = this.time.now + 700;
    this.hideMenu();
    const secs = Math.floor((this.time.now - this.startTime) / 1000);
    this.time.delayedCall(450, () =>
      showGameOver(this, `Solved in ${this.moves} moves · ${secs}s`, () => this.scene.restart(), () => this.scene.start("Menu"), "Puzzle solved! 🎉")
    );
  }

  update(time: number): void {
    if (this.dead) {
      if (time < this.lockUntil) return;
      const tap = pollEndTaps();
      if (tap === "restart") this.scene.restart();
      else if (tap === "menu") this.scene.start("Menu");
      return;
    }
    if (this.started) this.info.setText(`Moves ${this.moves} · ${Math.floor((time - this.startTime) / 1000)}s`);
  }
}
