import Phaser from "phaser";
import { hitSize } from "./hitSize";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { setTouchChrome } from "../input/touchChrome";
import { touchPad } from "../input/touchPad";
import { addEndGameButtons } from "./endGameButtons";
import { addSoftBackdrop, drawGlass, drawPill } from "./glass";
import { ACCENT, FONT, MOTION } from "./theme";

export { FONT };

/** The dark glass tint used behind white text, so it reads on any game background. */
const DARK_GLASS = 0x1b1640;

/** Small glass "Menu" button in the top-left corner. Also gives the scene its soft backdrop. Returns a hide function. */
export function addMenuButton(scene: Phaser.Scene, onMenu: () => void): () => void {
  addSoftBackdrop(scene);
  const g = scene.add.graphics().setScrollFactor(0).setDepth(60);
  drawGlass(g, 80, 42, 128, 52, { tint: DARK_GLASS, alpha: 0.55, radius: 18 });
  const label = scene.add
    .text(80, 42, "‹  Menu", { fontFamily: FONT, fontSize: "19px", color: "#ffffff", fontStyle: "800" })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(61);
  const mz = hitSize(128, 52);
  const zone = scene.add.rectangle(80, 42, mz.w, mz.h, 0xffffff, 0.001).setScrollFactor(0).setDepth(62).setInteractive({ useHandCursor: true });
  zone.on("pointerdown", onMenu);
  return () => {
    g.setVisible(false);
    label.setVisible(false);
    zone.setVisible(false);
    zone.disableInteractive();
  };
}

/** True when the pointer is over the top-left menu button area. */
export function overMenuButton(pointer: Phaser.Input.Pointer): boolean {
  return pointer.x < 150 && pointer.y < 76;
}

export function resetTaps(): void {
  touchPad.restartTap = false;
  touchPad.retryTap = false;
  touchPad.menuTap = false;
  touchPad.flapTap = false;
}

export function getBest(key: string): number {
  try {
    return Number(window.localStorage.getItem(`yusaf-best-${key}`)) || 0;
  } catch {
    return 0;
  }
}

/** Saves the score if it beats the stored best. Returns true for a new record. */
export function saveBest(key: string, score: number): boolean {
  if (score <= getBest(key)) return false;
  try {
    window.localStorage.setItem(`yusaf-best-${key}`, String(score));
  } catch {
    // storage unavailable (private mode) – ignore
  }
  return true;
}

export type Btn = {
  container: Phaser.GameObjects.Container;
  /** Only `setFillStyle` is supported: games use it to colour right and wrong answers. */
  rect: { setFillStyle(color: number, alpha?: number): void };
  text: Phaser.GameObjects.Text;
};

/**
 * A chunky rounded button: coloured body, glossy top, darker lip, and a quick press animation.
 * Calls `onClick` on pointer down, like every game expects.
 */
export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  color: number,
  onClick: () => void,
  fontSize = 24,
  depth = 20
): Btn {
  const g = scene.add.graphics();
  let current = color;
  const paint = (pressed: boolean): void => {
    g.clear();
    drawPill(g, 0, 0, w, h, current, { pressed });
  };
  paint(false);

  const text = scene.add
    .text(0, -1, label, {
      fontFamily: FONT,
      fontSize: `${fontSize}px`,
      color: "#ffffff",
      fontStyle: "800",
      align: "center",
      wordWrap: { width: w - 24 },
    })
    .setOrigin(0.5)
    .setShadow(0, 2, "rgba(0,0,0,0.28)", 0, false, true);
  const hz = hitSize(w, h);
  const zone = scene.add.rectangle(0, 0, hz.w, hz.h, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
  const container = scene.add.container(x, y, [g, text, zone]).setDepth(depth);

  zone.on("pointerdown", () => {
    paint(true);
    text.y = 2;
    scene.time.delayedCall(MOTION.press + 40, () => {
      if (!g.active) return;
      paint(false);
      text.y = -1;
    });
    onClick();
  });
  const rect = {
    setFillStyle(c: number): void {
      current = c;
      paint(false);
    },
  };
  return { container, rect, text };
}

/** Dims the screen and draws a big glass card behind a picker. Returns the objects so the caller can destroy them. */
function pickerBackdrop(scene: Phaser.Scene, title: string, subtitle: string, titleY: number, subY: number): Phaser.GameObjects.GameObject[] {
  const items: Phaser.GameObjects.GameObject[] = [];
  items.push(scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x120d2e, 0.9).setDepth(55).setInteractive());
  const card = scene.add.graphics().setDepth(55.5);
  drawGlass(card, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 8, 900, 420, { tint: 0xffffff, alpha: 0.1, radius: 30 });
  items.push(card);
  items.push(
    scene.add
      .text(GAME_WIDTH / 2, titleY, title, { fontFamily: FONT, fontSize: "44px", color: "#ffffff", fontStyle: "800" })
      .setOrigin(0.5)
      .setDepth(56)
  );
  items.push(
    scene.add
      .text(GAME_WIDTH / 2, subY, subtitle, { fontFamily: FONT, fontSize: "19px", color: "#e4defc", align: "center", lineSpacing: 4, fontStyle: "600" })
      .setOrigin(0.5)
      .setDepth(56)
  );
  return items;
}

/** Full-screen "pick your level" card shown before a learning game starts. */
export function showLevelPicker(
  scene: Phaser.Scene,
  title: string,
  subtitle: string,
  onPick: (tier: 0 | 1) => void
): void {
  const items = pickerBackdrop(scene, title, subtitle, 120, 178);
  const pick = (tier: 0 | 1): void => {
    items.forEach((i) => i.destroy());
    onPick(tier);
  };
  const b1 = makeButton(scene, GAME_WIDTH / 2 - 210, 330, 360, 130, "🌱 Easy\nAge 7", ACCENT.green, () => pick(0), 32, 56);
  const b2 = makeButton(scene, GAME_WIDTH / 2 + 210, 330, 360, 130, "🚀 Challenge\nAge 10", ACCENT.purple, () => pick(1), 32, 56);
  items.push(b1.container, b2.container);
}

export type ModeOption = { label: string; sub: string; color: number; mode: string };

/**
 * Full-screen mode picker with up to four choices (e.g. Easy, Challenge, 2 players on one iPad).
 * Tap-only: every button is a big target, no hover needed.
 */
export function showModePicker(
  scene: Phaser.Scene,
  title: string,
  subtitle: string,
  options: ModeOption[],
  onPick: (mode: string) => void
): void {
  const items = pickerBackdrop(scene, title, subtitle, 110, 168);
  const width = options.length <= 2 ? 360 : options.length === 3 ? 270 : 214;
  const gap = options.length <= 2 ? 420 : options.length === 3 ? 300 : 228;
  options.forEach((opt, i) => {
    const x = GAME_WIDTH / 2 + (i - (options.length - 1) / 2) * gap;
    const btn = makeButton(
      scene,
      x,
      330,
      width,
      140,
      `${opt.label}\n${opt.sub}`,
      opt.color,
      () => {
        items.forEach((o) => o.destroy());
        onPick(opt.mode);
      },
      options.length >= 4 ? 22 : 26,
      56
    );
    items.push(btn.container);
  });
}

/** Hold-to-move pads in the bottom corners. dir() returns -1, 0 or 1. */
export function addMovePads(scene: Phaser.Scene): { dir: () => number } {
  let left = false;
  let right = false;
  const make = (x: number, label: string, set: (down: boolean) => void): void => {
    const y = GAME_HEIGHT - 48;
    const g = scene.add.graphics().setScrollFactor(0).setDepth(40);
    const paint = (down: boolean): void => {
      g.clear();
      drawGlass(g, x, y, 170, 76, { tint: 0xffffff, alpha: down ? 0.38 : 0.16, radius: 28 });
    };
    paint(false);
    const zone = scene.add.rectangle(x, y, 170, 76, 0xffffff, 0.001).setScrollFactor(0).setDepth(42).setInteractive();
    scene.add
      .text(x, y, label, { fontFamily: FONT, fontSize: "36px", color: "#ffffff", fontStyle: "800" })
      .setOrigin(0.5)
      .setAlpha(0.85)
      .setScrollFactor(0)
      .setDepth(41);
    const on = (): void => {
      set(true);
      paint(true);
    };
    const off = (): void => {
      set(false);
      paint(false);
    };
    zone.on("pointerdown", on);
    zone.on("pointerup", off);
    zone.on("pointerout", off);
    zone.on("pointerupoutside", off);
  };
  make(100, "◀", (d) => (left = d));
  make(GAME_WIDTH - 100, "▶", (d) => (right = d));
  return { dir: () => (right ? 1 : 0) - (left ? 1 : 0) };
}

/** On-screen arrow pad (bottom-right). Calls onDir(dx, dy) every time an arrow is pressed. */
export function addDPad(scene: Phaser.Scene, onDir: (dx: number, dy: number) => void): void {
  const cx = GAME_WIDTH - 110;
  const cy = GAME_HEIGHT - 105;
  const size = 70;
  const make = (ox: number, oy: number, label: string, dx: number, dy: number): void => {
    const x = cx + ox * size;
    const y = cy + oy * size;
    const g = scene.add.graphics().setScrollFactor(0).setDepth(40);
    const paint = (down: boolean): void => {
      g.clear();
      drawGlass(g, x, y, size - 6, size - 6, { tint: 0xffffff, alpha: down ? 0.4 : 0.18, radius: 22 });
    };
    paint(false);
    const dz = hitSize(size - 6, size - 6);
    const zone = scene.add.rectangle(x, y, dz.w, dz.h, 0xffffff, 0.001).setScrollFactor(0).setDepth(42).setInteractive();
    scene.add
      .text(x, y, label, { fontFamily: FONT, fontSize: "30px", color: "#ffffff", fontStyle: "800" })
      .setOrigin(0.5)
      .setAlpha(0.9)
      .setScrollFactor(0)
      .setDepth(41);
    zone.on("pointerdown", () => {
      paint(true);
      onDir(dx, dy);
    });
    const off = (): void => paint(false);
    zone.on("pointerup", off);
    zone.on("pointerout", off);
  };
  make(0, -1, "▲", 0, -1);
  make(-1, 0, "◀", -1, 0);
  make(1, 0, "▶", 1, 0);
  make(0, 0, "▼", 0, 1);
}

export function showGameOver(
  scene: Phaser.Scene,
  detail: string,
  onRestart: () => void,
  onMenu: () => void,
  title = "Game Over"
): void {
  resetTaps();
  setTouchChrome("gameover");
  scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x120d2e, 0.55).setScrollFactor(0).setDepth(70);
  const card = scene.add.graphics().setScrollFactor(0).setDepth(74);
  drawGlass(card, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 640, 220, { tint: DARK_GLASS, alpha: 0.5, radius: 32 });
  scene.add
    .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 82, title, { fontFamily: FONT, fontSize: "46px", color: "#ffffff", fontStyle: "800", align: "center" })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(75);
  scene.add
    .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 18, detail, { fontFamily: FONT, fontSize: "22px", color: "#e4defc", fontStyle: "600", align: "center", wordWrap: { width: 560 } })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(76);
  addEndGameButtons(scene, onRestart, onMenu);
}

/** Poll the HTML end-bar taps (iPad). Returns which button was hit, if any. */
export function pollEndTaps(): "restart" | "menu" | null {
  if (touchPad.restartTap || touchPad.retryTap) {
    resetTaps();
    return "restart";
  }
  if (touchPad.menuTap) {
    resetTaps();
    return "menu";
  }
  return null;
}
