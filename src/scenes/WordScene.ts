import Phaser from "phaser";
import { GAME_WIDTH } from "../config";
import { gameAudio } from "../audio/sfx";
import { setTouchChrome } from "../input/touchChrome";
import { addMenuButton, Btn, FONT, makeButton, pollEndTaps, resetTaps, showGameOver, showLevelPicker } from "../ui/arcadeKit";

const ROUNDS = 8;

type W = { word: string; clue: string; emoji?: string };

const EASY: W[] = [
  { word: "CAT", clue: "A pet that says meow", emoji: "🐱" },
  { word: "DOG", clue: "A pet that barks", emoji: "🐶" },
  { word: "SUN", clue: "It shines in the day", emoji: "☀️" },
  { word: "FISH", clue: "It swims in water", emoji: "🐟" },
  { word: "TREE", clue: "It has leaves and a trunk", emoji: "🌳" },
  { word: "BOOK", clue: "You read it", emoji: "📖" },
  { word: "STAR", clue: "It twinkles at night", emoji: "⭐" },
  { word: "MOON", clue: "It glows at night", emoji: "🌙" },
  { word: "CAKE", clue: "A sweet birthday treat", emoji: "🍰" },
  { word: "BIRD", clue: "It can fly and sing", emoji: "🐦" },
  { word: "FROG", clue: "It hops and says ribbit", emoji: "🐸" },
  { word: "APPLE", clue: "A red or green fruit", emoji: "🍎" },
  { word: "HOUSE", clue: "A place to live", emoji: "🏠" },
  { word: "TRAIN", clue: "It runs on tracks", emoji: "🚆" },
  { word: "PIZZA", clue: "Cheesy and round", emoji: "🍕" },
  { word: "ROBOT", clue: "A machine that can move", emoji: "🤖" },
];

const HARD: W[] = [
  { word: "ELEPHANT", clue: "The largest animal that lives on land" },
  { word: "PLANET", clue: "Earth, Mars and Jupiter are all this" },
  { word: "GALAXY", clue: "A huge group of stars. The Milky Way is one" },
  { word: "VOLCANO", clue: "A mountain that can erupt with hot lava" },
  { word: "DINOSAUR", clue: "A giant reptile that lived millions of years ago" },
  { word: "TELESCOPE", clue: "You use it to look at faraway stars" },
  { word: "BUTTERFLY", clue: "It starts life as a caterpillar" },
  { word: "RAINBOW", clue: "Seven colours in the sky after rain" },
  { word: "MAGNET", clue: "It attracts iron and steel" },
  { word: "PYRAMID", clue: "Ancient Egyptians built these giant tombs" },
  { word: "OXYGEN", clue: "The gas we need to breathe" },
  { word: "ISLAND", clue: "Land with water all around it" },
  { word: "SCIENTIST", clue: "A person who studies how the world works" },
  { word: "DIAMOND", clue: "A very hard, sparkly gemstone" },
  { word: "ASTRONAUT", clue: "A person who travels into space" },
  { word: "SKELETON", clue: "All the bones in your body" },
];

type Tile = { btn: Btn; ch: string; used: boolean };

export class WordScene extends Phaser.Scene {
  private words: W[] = [];
  private round = 0;
  private score = 0;
  private hints = 3;
  private hintsThisWord = 0;
  private solved = 0;
  private busy = true;
  private dead = false;
  private lockUntil = 0;
  private current: W | null = null;
  private tiles: Tile[] = [];
  private chosen: number[] = [];
  private slotRects: Phaser.GameObjects.Rectangle[] = [];
  private slotTexts: Phaser.GameObjects.Text[] = [];
  private objs: Phaser.GameObjects.GameObject[] = [];
  private title!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private clueEmoji!: Phaser.GameObjects.Text;
  private clueText!: Phaser.GameObjects.Text;
  private hintBtn!: Btn;
  private hideMenu!: () => void;

  constructor() {
    super({ key: "Words" });
  }

  init(): void {
    this.words = [];
    this.round = 0;
    this.score = 0;
    this.hints = 3;
    this.hintsThisWord = 0;
    this.solved = 0;
    this.busy = true;
    this.dead = false;
    this.lockUntil = 0;
    this.current = null;
    this.tiles = [];
    this.chosen = [];
    this.slotRects = [];
    this.slotTexts = [];
    this.objs = [];
    resetTaps();
  }

  create(): void {
    setTouchChrome("hidden");
    this.cameras.main.setBackgroundColor(0x7c2d12);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setTouchChrome("hidden"));

    this.title = this.add.text(GAME_WIDTH / 2, 36, "", { fontFamily: FONT, fontSize: "26px", color: "#ffffff", fontStyle: "700" }).setOrigin(0.5);
    this.scoreText = this.add.text(GAME_WIDTH - 20, 36, "Score 0", { fontFamily: FONT, fontSize: "22px", color: "#fde047", fontStyle: "700" }).setOrigin(1, 0.5);
    this.clueEmoji = this.add.text(GAME_WIDTH / 2, 120, "", { fontFamily: FONT, fontSize: "84px" }).setOrigin(0.5);
    this.clueText = this.add
      .text(GAME_WIDTH / 2, 190, "", { fontFamily: FONT, fontSize: "24px", color: "#ffedd5", align: "center", wordWrap: { width: 800 } })
      .setOrigin(0.5);

    this.hideMenu = addMenuButton(this, () => {
      if (!this.dead) this.scene.start("Menu");
    });

    const y = 494;
    this.hintBtn = makeButton(this, GAME_WIDTH / 2 - 190, y, 170, 52, "💡 Hint (3)", 0xca8a04, () => this.hint(), 20);
    makeButton(this, GAME_WIDTH / 2, y, 170, 52, "⌫ Back", 0x475569, () => this.back(), 20);
    makeButton(this, GAME_WIDTH / 2 + 190, y, 170, 52, "Skip ▶", 0x7c3aed, () => this.skip(), 20);

    this.input.keyboard!.on("keydown", (e: KeyboardEvent) => {
      if (this.busy || this.dead) return;
      if (e.key === "Backspace") this.back();
      else if (/^[a-zA-Z]$/.test(e.key)) {
        const ch = e.key.toUpperCase();
        const idx = this.tiles.findIndex((t) => !t.used && t.ch === ch);
        if (idx >= 0) this.pickTile(idx);
      }
    });

    showLevelPicker(this, "Word Wizard 🔤", "Unscramble the letters to spell the word!\nTap the letters, or type on a keyboard.", (tier) => {
      this.words = Phaser.Utils.Array.Shuffle([...(tier === 0 ? EASY : HARD)]).slice(0, ROUNDS);
      gameAudio.unlock();
      gameAudio.startMusic();
      this.nextWord();
    });
  }

  private clearWord(): void {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    this.tiles.forEach((t) => t.btn.container.destroy());
    this.tiles = [];
    this.slotRects = [];
    this.slotTexts = [];
    this.chosen = [];
  }

  private nextWord(): void {
    this.clearWord();
    if (this.round >= this.words.length) {
      this.finish();
      return;
    }
    const w = this.words[this.round];
    this.round += 1;
    this.current = w;
    this.hintsThisWord = 0;
    this.busy = false;
    this.title.setText(`Word ${this.round} of ${this.words.length}`);
    this.scoreText.setText(`Score ${this.score}`);
    this.hintBtn.text.setText(`💡 Hint (${this.hints})`);

    if (w.emoji) {
      this.clueEmoji.setText(w.emoji);
      this.clueText.setText(`${w.clue}  ·  ${w.word.length} letters`);
    } else {
      this.clueEmoji.setText("🤔");
      this.clueText.setText(`${w.clue}\n(${w.word.length} letters)`);
    }

    const n = w.word.length;
    const slotW = 60;
    const slotGap = 10;
    const x0 = GAME_WIDTH / 2 - (n * (slotW + slotGap) - slotGap) / 2 + slotW / 2;
    for (let i = 0; i < n; i++) {
      const x = x0 + i * (slotW + slotGap);
      const r = this.add.rectangle(x, 285, slotW, 70, 0x431407).setStrokeStyle(3, 0xfdba74, 0.8);
      const t = this.add.text(x, 285, "", { fontFamily: FONT, fontSize: "40px", color: "#ffffff", fontStyle: "700" }).setOrigin(0.5);
      this.slotRects.push(r);
      this.slotTexts.push(t);
      this.objs.push(r, t);
    }

    let letters = w.word.split("");
    let guard = 0;
    do {
      letters = Phaser.Utils.Array.Shuffle(letters);
    } while (letters.join("") === w.word && guard++ < 20);

    const tileW = 62;
    const tileGap = 12;
    const tx0 = GAME_WIDTH / 2 - (n * (tileW + tileGap) - tileGap) / 2 + tileW / 2;
    letters.forEach((ch, i) => {
      const btn = makeButton(this, tx0 + i * (tileW + tileGap), 395, tileW, 72, ch, 0xea580c, () => this.pickTile(i), 38);
      this.tiles.push({ btn, ch, used: false });
    });
  }

  private refreshSlots(): void {
    this.slotTexts.forEach((t, i) => t.setText(i < this.chosen.length ? this.tiles[this.chosen[i]].ch : ""));
  }

  private pickTile(i: number): void {
    if (this.busy || this.dead || !this.current) return;
    const t = this.tiles[i];
    if (!t || t.used) return;
    if (this.chosen.length >= this.current.word.length) return;
    t.used = true;
    t.btn.container.setAlpha(0.25);
    this.chosen.push(i);
    gameAudio.jump();
    this.refreshSlots();
    if (this.chosen.length === this.current.word.length) this.check();
  }

  private back(): void {
    if (this.busy || this.dead || this.chosen.length === 0) return;
    const i = this.chosen.pop() as number;
    this.tiles[i].used = false;
    this.tiles[i].btn.container.setAlpha(1);
    this.refreshSlots();
  }

  private resetChosen(): void {
    this.chosen.forEach((i) => {
      this.tiles[i].used = false;
      this.tiles[i].btn.container.setAlpha(1);
    });
    this.chosen = [];
    this.refreshSlots();
  }

  private hint(): void {
    if (this.busy || this.dead || !this.current || this.hints <= 0) return;
    const word = this.current.word;
    let prefix = 0;
    while (prefix < this.chosen.length && this.tiles[this.chosen[prefix]].ch === word[prefix]) prefix++;
    this.resetChosen();
    this.hints -= 1;
    this.hintsThisWord += 1;
    this.hintBtn.text.setText(`💡 Hint (${this.hints})`);
    for (let j = 0; j <= prefix && j < word.length; j++) {
      const idx = this.tiles.findIndex((t) => !t.used && t.ch === word[j]);
      if (idx >= 0) {
        this.tiles[idx].used = true;
        this.tiles[idx].btn.container.setAlpha(0.25);
        this.chosen.push(idx);
      }
    }
    this.refreshSlots();
    if (this.chosen.length === word.length) this.check();
  }

  private skip(): void {
    if (this.busy || this.dead) return;
    this.busy = true;
    this.nextWord();
  }

  private check(): void {
    if (!this.current) return;
    const guess = this.chosen.map((i) => this.tiles[i].ch).join("");
    this.busy = true;
    if (guess === this.current.word) {
      this.solved += 1;
      this.score += Math.max(5, 15 - this.hintsThisWord * 5);
      this.scoreText.setText(`Score ${this.score}`);
      gameAudio.coin();
      this.slotRects.forEach((r) => r.setFillStyle(0x16a34a));
      this.time.delayedCall(950, () => this.nextWord());
    } else {
      gameAudio.hit();
      this.slotRects.forEach((r) => r.setFillStyle(0xb91c1c));
      this.cameras.main.shake(120, 0.005);
      this.time.delayedCall(600, () => {
        this.slotRects.forEach((r) => r.setFillStyle(0x431407));
        this.resetChosen();
        this.busy = false;
      });
    }
  }

  private finish(): void {
    this.dead = true;
    gameAudio.stopMusic();
    this.lockUntil = this.time.now + 500;
    this.hideMenu();
    showGameOver(this, `${this.solved}/${this.words.length} words · Score ${this.score}`, () => this.scene.restart(), () => this.scene.start("Menu"), "Word Wizard!");
  }

  update(time: number): void {
    if (!this.dead || time < this.lockUntil) return;
    const tap = pollEndTaps();
    if (tap === "restart") this.scene.restart();
    else if (tap === "menu") this.scene.start("Menu");
  }
}
