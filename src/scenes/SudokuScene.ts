import Phaser from "phaser";
import { GAME_WIDTH } from "../config";
import { gameAudio } from "../audio/sfx";
import { setTouchChrome } from "../input/touchChrome";
import { addMenuButton, FONT, makeButton, pollEndTaps, resetTaps, showGameOver, showLevelPicker } from "../ui/arcadeKit";

export class SudokuScene extends Phaser.Scene {
  private n = 4;
  private br = 2; // box rows
  private bc = 2; // box cols
  private cs = 84;
  private left = 0;
  private top = 0;
  private cur: number[][] = [];
  private given: boolean[][] = [];
  private sel: [number, number] | null = null;
  private cellRects: Phaser.GameObjects.Rectangle[][] = [];
  private cellTexts: Phaser.GameObjects.Text[][] = [];
  private startTime = 0;
  private dead = false;
  private lockUntil = 0;
  private info!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private hideMenu!: () => void;

  constructor() {
    super({ key: "Sudoku" });
  }

  init(): void {
    this.cur = [];
    this.given = [];
    this.sel = null;
    this.cellRects = [];
    this.cellTexts = [];
    this.dead = false;
    this.lockUntil = 0;
    resetTaps();
  }

  create(): void {
    setTouchChrome("hidden");
    this.cameras.main.setBackgroundColor(0x172554);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setTouchChrome("hidden"));

    this.info = this.add.text(GAME_WIDTH / 2, 30, "0s", { fontFamily: FONT, fontSize: "26px", color: "#ffffff", fontStyle: "700" }).setOrigin(0.5);
    this.hint = this.add.text(GAME_WIDTH / 2, 70, "", { fontFamily: FONT, fontSize: "19px", color: "#bfdbfe" }).setOrigin(0.5);

    this.hideMenu = addMenuButton(this, () => {
      if (!this.dead) this.scene.start("Menu");
    });

    this.input.keyboard!.on("keydown", (e: KeyboardEvent) => {
      if (this.dead || this.cur.length === 0) return;
      if (/^[1-9]$/.test(e.key)) this.setValue(Number(e.key));
      else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") this.setValue(0);
    });

    showLevelPicker(this, "Mini Sudoku 🔢", "Every row, column and box needs each number once.\nEasy: 4×4 · Challenge: 6×6", (tier) => {
      if (tier === 0) {
        this.n = 4;
        this.br = 2;
        this.bc = 2;
        this.cs = 84;
      } else {
        this.n = 6;
        this.br = 2;
        this.bc = 3;
        this.cs = 68;
      }
      gameAudio.unlock();
      gameAudio.startMusic();
      this.hint.setText(`Fill every row, column and box with 1 to ${this.n} — each number once`);
      this.startTime = this.time.now;
      this.build(tier === 0 ? 8 : 20);
    });
  }

  private valid(g: number[][], r: number, c: number, v: number): boolean {
    for (let i = 0; i < this.n; i++) {
      if (g[r][i] === v || g[i][c] === v) return false;
    }
    const r0 = Math.floor(r / this.br) * this.br;
    const c0 = Math.floor(c / this.bc) * this.bc;
    for (let i = 0; i < this.br; i++) for (let j = 0; j < this.bc; j++) if (g[r0 + i][c0 + j] === v) return false;
    return true;
  }

  private fill(g: number[][]): boolean {
    for (let r = 0; r < this.n; r++) {
      for (let c = 0; c < this.n; c++) {
        if (g[r][c] !== 0) continue;
        const nums = Phaser.Utils.Array.Shuffle(Array.from({ length: this.n }, (_, i) => i + 1));
        for (const v of nums) {
          if (this.valid(g, r, c, v)) {
            g[r][c] = v;
            if (this.fill(g)) return true;
            g[r][c] = 0;
          }
        }
        return false;
      }
    }
    return true;
  }

  private build(remove: number): void {
    const n = this.n;
    const sol: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    this.fill(sol);
    this.cur = sol.map((row) => [...row]);
    this.given = Array.from({ length: n }, () => Array(n).fill(true));

    const cells = Phaser.Utils.Array.Shuffle(Array.from({ length: n * n }, (_, i) => i)).slice(0, remove);
    for (const i of cells) {
      const r = Math.floor(i / n);
      const c = i % n;
      this.cur[r][c] = 0;
      this.given[r][c] = false;
    }

    const total = n * this.cs;
    this.left = 330 - total / 2;
    this.top = 305 - total / 2;

    for (let r = 0; r < n; r++) {
      this.cellRects.push([]);
      this.cellTexts.push([]);
      for (let c = 0; c < n; c++) {
        const x = this.left + c * this.cs + this.cs / 2;
        const y = this.top + r * this.cs + this.cs / 2;
        const rect = this.add
          .rectangle(x, y, this.cs - 2, this.cs - 2, 0xffffff)
          .setInteractive({ useHandCursor: true });
        rect.on("pointerdown", () => {
          if (this.given[r][c] || this.dead) return;
          this.sel = [r, c];
          this.refresh();
        });
        const text = this.add
          .text(x, y, "", { fontFamily: FONT, fontSize: `${Math.round(this.cs * 0.5)}px`, fontStyle: "700", color: "#0f172a" })
          .setOrigin(0.5);
        this.cellRects[r].push(rect);
        this.cellTexts[r].push(text);
      }
    }

    // thick box borders
    const g = this.add.graphics().setDepth(5);
    g.lineStyle(4, 0x0f172a, 1);
    for (let r = 0; r <= n; r += this.br) g.lineBetween(this.left, this.top + r * this.cs, this.left + total, this.top + r * this.cs);
    for (let c = 0; c <= n; c += this.bc) g.lineBetween(this.left + c * this.cs, this.top, this.left + c * this.cs, this.top + total);

    // number pad
    for (let i = 0; i <= n; i++) {
      const x = 700 + (i % 3) * 82;
      const y = 190 + Math.floor(i / 3) * 78;
      const label = i === n ? "⌫" : String(i + 1);
      makeButton(this, x, y, 72, 66, label, i === n ? 0x64748b : 0x2563eb, () => this.setValue(i === n ? 0 : i + 1), 32);
    }
    this.refresh();
  }

  private conflicts(): boolean[][] {
    const n = this.n;
    const bad: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const v = this.cur[r][c];
        if (v === 0) continue;
        for (let i = 0; i < n; i++) {
          if (i !== c && this.cur[r][i] === v) bad[r][c] = true;
          if (i !== r && this.cur[i][c] === v) bad[r][c] = true;
        }
        const r0 = Math.floor(r / this.br) * this.br;
        const c0 = Math.floor(c / this.bc) * this.bc;
        for (let i = 0; i < this.br; i++) {
          for (let j = 0; j < this.bc; j++) {
            if ((r0 + i !== r || c0 + j !== c) && this.cur[r0 + i][c0 + j] === v) bad[r][c] = true;
          }
        }
      }
    }
    return bad;
  }

  private refresh(): void {
    const bad = this.conflicts();
    for (let r = 0; r < this.n; r++) {
      for (let c = 0; c < this.n; c++) {
        const v = this.cur[r][c];
        const selected = this.sel && this.sel[0] === r && this.sel[1] === c;
        this.cellTexts[r][c].setText(v === 0 ? "" : String(v));
        this.cellTexts[r][c].setColor(bad[r][c] ? "#dc2626" : this.given[r][c] ? "#0f172a" : "#2563eb");
        this.cellRects[r][c].setFillStyle(selected ? 0xfde047 : this.given[r][c] ? 0xe2e8f0 : 0xffffff);
      }
    }
  }

  private setValue(v: number): void {
    if (this.dead || !this.sel || v > this.n) return;
    const [r, c] = this.sel;
    if (this.given[r][c]) return;
    this.cur[r][c] = v;
    gameAudio.jump();
    this.refresh();
    const bad = this.conflicts();
    const full = this.cur.every((row) => row.every((x) => x !== 0));
    if (full && !bad.some((row) => row.some(Boolean))) this.win();
  }

  private win(): void {
    this.dead = true;
    gameAudio.coin();
    gameAudio.stopMusic();
    this.lockUntil = this.time.now + 900;
    this.hideMenu();
    const secs = Math.floor((this.time.now - this.startTime) / 1000);
    this.time.delayedCall(450, () =>
      showGameOver(this, `Solved in ${secs} seconds`, () => this.scene.restart(), () => this.scene.start("Menu"), "Sudoku solved! 🎉")
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
    if (this.cur.length > 0) this.info.setText(`${Math.floor((time - this.startTime) / 1000)}s`);
  }
}
