import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { deviceUsesTouch } from "../input/touchPad";
import { setTouchChrome } from "../input/touchChrome";
import { addSoftBackdrop, drawGlass, drawPill } from "../ui/glass";
import { ACCENT, FONT } from "../ui/theme";

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
  ["Checkers ⚫", "Jump to capture · crown a king", 0x15803d, "Checkers"],
  ["Chess ♟️", "3D board · checkmate the king", 0xb45309, "Chess"],
  ["Ludo 🎲", "Roll the dice · race tokens home", 0xb91c1c, "Ludo"],
  ["Snakes & Ladders 🐍", "Climb ladders · dodge snakes", 0x0f766e, "Snakes"],
];

const ARENA: Entry[] = [
  ["Turbo Karts 🏎️", "Race · split screen for 2", 0xdc2626, "Karts"],
  ["Bomb Blast 💣", "Up to 4 players · last one wins", 0xea580c, "Bombs"],
  ["Air Hockey 3D 🏒", "Face to face on one iPad", 0x0891b2, "Hockey"],
  ["Tank Trouble 🛡️", "Bouncing shells in a maze", 0x4d7c0f, "Tanks"],
  ["Mini Golf World ⛳", "9 holes · up to 4 players", 0x16a34a, "Golf"],
];

const TABS: { name: string; note: string; games: Entry[] }[] = [
  { name: "🎮 Arcade", note: "", games: ARCADE },
  { name: "🧠 Learn", note: "Learning games for ages 7–10 · pick Easy or Challenge", games: LEARN },
  { name: "🧩 Puzzles", note: "Brain puzzles for ages 7–10 · pick Easy or Challenge", games: PUZZLES },
  { name: "🎲 Board Games", note: "Classic board games · vs the computer or 2 players on one iPad", games: BOARD },
  { name: "🏆 3D Arena", note: "Big 3D games · vs the computer or friends on the same device", games: ARENA },
];

let lastTab = 0;

export class MenuScene extends Phaser.Scene {
  private content: Phaser.GameObjects.GameObject[] = [];
  private tabs: { g: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text; x: number }[] = [];

  constructor() {
    super({ key: "Menu" });
  }

  create(): void {
    setTouchChrome("hidden");
    this.cameras.main.setBackgroundColor(0x2b2266);
    addSoftBackdrop(this);
    this.content = [];
    this.tabs = [];

    this.add
      .text(GAME_WIDTH / 2, 46, "Yusaf Arcade", { fontFamily: FONT, fontSize: "46px", color: "#ffffff", fontStyle: "800" })
      .setOrigin(0.5)
      .setShadow(0, 3, "rgba(20,10,60,0.45)", 6, false, true);

    TABS.forEach(({ name }, i) => {
      // Spread the tabs evenly around the centre, so five tabs still fit the 960px width.
      const x = GAME_WIDTH / 2 + (i - (TABS.length - 1) / 2) * 184;
      const g = this.add.graphics();
      const label = this.add.text(x, 104, name, { fontFamily: FONT, fontSize: "18px", color: "#e4defc", fontStyle: "800" }).setOrigin(0.5);
      const zone = this.add.rectangle(x, 104, 176, 56, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      zone.on("pointerdown", () => this.show(i));
      this.tabs.push({ g, label, x });
    });

    const hint = deviceUsesTouch() ? "Tap a game to start" : "Click a game to start";
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 26, hint, { fontFamily: FONT, fontSize: "16px", color: "#b9b0e6", fontStyle: "600" })
      .setOrigin(0.5);

    this.show(lastTab);
  }

  private show(tab: number): void {
    lastTab = tab;
    this.content.forEach((o) => o.destroy());
    this.content = [];
    this.tabs.forEach((t, i) => {
      t.g.clear();
      if (i === tab) drawPill(t.g, t.x, 104, 172, 48, ACCENT.purple, { radius: 22 });
      else drawGlass(t.g, t.x, 104, 172, 48, { tint: 0xffffff, alpha: 0.12, radius: 22 });
      t.label.setColor(i === tab ? "#ffffff" : "#d6cef7");
    });

    const { note, games } = TABS[tab];
    if (note) {
      this.content.push(this.add.text(GAME_WIDTH / 2, 150, note, { fontFamily: FONT, fontSize: "16px", color: "#cfc6f5", fontStyle: "600" }).setOrigin(0.5));
    }
    games.forEach(([title, sub, color, key], i) => {
      const rowStart = Math.floor(i / 3) * 3;
      const inRow = Math.min(3, games.length - rowStart);
      const x = GAME_WIDTH / 2 + ((i % 3) - (inRow - 1) / 2) * 310;
      const y = 214 + Math.floor(i / 3) * 112;
      this.makePlayButton(x, y, title, sub, color, () => this.scene.start(key));
    });
  }

  private makePlayButton(x: number, y: number, title: string, subtitle: string, color: number, onPick: () => void, w = 292, h = 98): void {
    const g = this.add.graphics();
    const paint = (pressed: boolean): void => {
      g.clear();
      drawPill(g, 0, 0, w, h, color, { pressed, radius: 26 });
    };
    paint(false);
    const titleText = this.add
      .text(0, -13, title, { fontFamily: FONT, fontSize: w > 300 ? "26px" : "23px", color: "#ffffff", fontStyle: "800" })
      .setOrigin(0.5)
      .setShadow(0, 2, "rgba(0,0,0,0.3)", 0, false, true);
    const subText = this.add.text(0, 20, subtitle, { fontFamily: FONT, fontSize: "14px", color: "#ffffff", fontStyle: "600" }).setOrigin(0.5).setAlpha(0.92);
    const zone = this.add.rectangle(0, 0, w, h, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    const card = this.add.container(x, y, [g, titleText, subText, zone]);
    zone.on("pointerdown", () => {
      paint(true);
      onPick();
    });
    this.content.push(card);
  }
}
