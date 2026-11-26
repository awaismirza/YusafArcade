import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { deviceUsesTouch } from "../input/touchPad";
import { setTouchChrome } from "../input/touchChrome";
import { FONT } from "../ui/arcadeKit";

type Entry = [string, string, number, string];

const ARCADE: Entry[] = [
  ["Batman Shooting", "Runner · shoot · jump", 0x1d4ed8, "Game"],
  ["Flappy Bird", "Tap through the pipes", 0x15803d, "Flappy"],
  ["Space Dodger", "Shoot rocks · power-ups", 0x7c3aed, "Dodger"],
  ["Brick Breaker", "Bounce · clear bricks", 0xdc2626, "Breaker"],
  ["Stack Tower", "Tap to drop · build high", 0xd97706, "Stack"],
  ["Snake", "Eat · grow · don't crash", 0x0f766e, "Snake"],
  ["Whack-a-Mole", "30 seconds · avoid bombs", 0x92400e, "Whack"],
  ["Memory Match", "Find all the pairs", 0x4f46e5, "Memory"],
  ["Fruit Catch", "Catch fruit · dodge bombs", 0x0284c7, "Catch"],
];

const LEARN: Entry[] = [
  ["Math Rocket 🚀", "Maths that levels up", 0x2563eb, "Math"],
  ["Word Wizard 🔤", "Unscramble & spell", 0xea580c, "Words"],
  ["Brain Quiz 🧠", "Science, space & world", 0x059669, "Quiz"],
  ["Clock Reader ⏰", "Learn to tell the time", 0x0369a1, "Clock"],
  ["World Explorer 🌍", "Flags & capital cities", 0x1d4ed8, "World"],
  ["Fraction Pizza 🍕", "Slices & fractions", 0xb91c1c, "Fractions"],
  ["Missing Sign ➕", "+ − × ÷ equations", 0x7e22ce, "Operator"],
  ["Shape Detective 🔷", "Name shapes · count sides", 0x0f766e, "Shapes"],
  ["Solar Explorer 🪐", "3D tour of the planets", 0x1e3a8a, "Solar"],
];

const PUZZLES: Entry[] = [
  ["Pattern Master 🔍", "Number & shape patterns", 0x7c3aed, "Pattern"],
  ["Odd One Out 🧐", "Spot what doesn't belong", 0xbe185d, "Odd"],
  ["Memory Lights 💡", "Watch & repeat the lights", 0x4338ca, "Simon"],
  ["Slide Puzzle 🧩", "Put the tiles in order", 0xb45309, "Slide"],
  ["Mini Sudoku 🔢", "4×4 and 6×6 number logic", 0x1e40af, "Sudoku"],
  ["Code the Robot 🤖", "Program the robot's route", 0x0d9488, "Robot"],
];

const BOARD: Entry[] = [
  ["Checkers ⚫", "Jump to capture · crown a king", 0x3f6212, "Checkers"],
];

const TABS: { name: string; note: string; games: Entry[] }[] = [
  { name: "🎮 Arcade", note: "", games: ARCADE },
  { name: "🧠 Learn", note: "Learning games for ages 7–10 · pick Easy or Challenge", games: LEARN },
  { name: "🧩 Puzzles", note: "Brain puzzles for ages 7–10 · pick Easy or Challenge", games: PUZZLES },
  { name: "🎲 Board Games", note: "Classic board games · play against the computer", games: BOARD },
];

let lastTab = 0;

export class MenuScene extends Phaser.Scene {
  private content: Phaser.GameObjects.GameObject[] = [];
  private tabs: { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }[] = [];

  constructor() {
    super({ key: "Menu" });
  }

  create(): void {
    setTouchChrome("hidden");
    this.cameras.main.setBackgroundColor(0x0f172a);
    this.content = [];
    this.tabs = [];

    this.add
      .text(GAME_WIDTH / 2, 48, "Yusaf Arcade", { fontFamily: FONT, fontSize: "40px", color: "#f8fafc", fontStyle: "700" })
      .setOrigin(0.5);

    TABS.forEach(({ name }, i) => {
      // Spread the tabs evenly around the centre, so four tabs still fit the 960px width.
      const x = GAME_WIDTH / 2 + (i - (TABS.length - 1) / 2) * 200;
      const bg = this.add.rectangle(x, 104, 186, 44, 0x1e293b).setInteractive({ useHandCursor: true });
      const label = this.add.text(x, 104, name, { fontFamily: FONT, fontSize: "20px", color: "#cbd5e1", fontStyle: "700" }).setOrigin(0.5);
      bg.on("pointerdown", () => this.show(i));
      label.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.show(i));
      this.tabs.push({ bg, label });
    });

    const hint = deviceUsesTouch() ? "Tap a game to start" : "Click a game · keyboard inside each mode";
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 28, hint, { fontFamily: FONT, fontSize: "15px", color: "#64748b" })
      .setOrigin(0.5);

    this.show(lastTab);
  }

  private show(tab: number): void {
    lastTab = tab;
    this.content.forEach((o) => o.destroy());
    this.content = [];
    this.tabs.forEach((t, i) => {
      t.bg.setFillStyle(i === tab ? 0x2563eb : 0x1e293b);
      t.label.setColor(i === tab ? "#ffffff" : "#94a3b8");
    });

    const { note, games } = TABS[tab];
    if (note) {
      this.content.push(this.add.text(GAME_WIDTH / 2, 144, note, { fontFamily: FONT, fontSize: "16px", color: "#94a3b8" }).setOrigin(0.5));
    }
    games.forEach(([title, sub, color, key], i) => {
      const rowStart = Math.floor(i / 3) * 3;
      const inRow = Math.min(3, games.length - rowStart);
      const x = GAME_WIDTH / 2 + ((i % 3) - (inRow - 1) / 2) * 310;
      const y = 208 + Math.floor(i / 3) * 108;
      this.makePlayButton(x, y, title, sub, color, () => this.scene.start(key));
    });
  }

  private makePlayButton(
    x: number,
    y: number,
    title: string,
    subtitle: string,
    color: number,
    onPick: () => void,
    w = 292,
    h = 96
  ): void {
    const bg = this.add
      .rectangle(x, y, w, h, color, 0.92)
      .setStrokeStyle(3, 0xffffff, 0.18)
      .setInteractive({ useHandCursor: true });
    const titleText = this.add
      .text(x, y - 12, title, { fontFamily: FONT, fontSize: w > 300 ? "26px" : "22px", color: "#ffffff", fontStyle: "700" })
      .setOrigin(0.5);
    const subText = this.add
      .text(x, y + 20, subtitle, { fontFamily: FONT, fontSize: "14px", color: "#e2e8f0" })
      .setOrigin(0.5);

    const go = (): void => onPick();
    bg.on("pointerover", () => bg.setFillStyle(color, 1));
    bg.on("pointerout", () => bg.setFillStyle(color, 0.92));
    bg.on("pointerdown", go);
    titleText.setInteractive({ useHandCursor: true }).on("pointerdown", go);
    subText.setInteractive({ useHandCursor: true }).on("pointerdown", go);
    this.content.push(bg, titleText, subText);
  }
}
