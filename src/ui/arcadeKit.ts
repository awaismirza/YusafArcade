import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { setTouchChrome } from "../input/touchChrome";
import { touchPad } from "../input/touchPad";
import { addEndGameButtons } from "./endGameButtons";

/** Small "Menu" button in the top-left corner. Returns a hide function. */
export function addMenuButton(scene: Phaser.Scene, onMenu: () => void): () => void {
  const bg = scene.add
    .rectangle(74, 38, 116, 40, 0x0f172a, 0.55)
    .setScrollFactor(0)
    .setDepth(60)
    .setInteractive({ useHandCursor: true });
  const label = scene.add
    .text(74, 38, "Menu", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "16px",
      color: "#f8fafc",
      fontStyle: "700",
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(61)
    .setInteractive({ useHandCursor: true });
  bg.on("pointerdown", onMenu);
  label.on("pointerdown", onMenu);
  return () => {
    bg.setVisible(false);
    label.setVisible(false);
  };
}

/** True when the pointer is over the top-left menu button area. */
export function overMenuButton(pointer: Phaser.Input.Pointer): boolean {
  return pointer.x < 140 && pointer.y < 70;
}

export function resetTaps(): void {
  touchPad.restartTap = false;
  touchPad.retryTap = false;
  touchPad.menuTap = false;
  touchPad.flapTap = false;
}

export const FONT = "system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";

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
  rect: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
};

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
  const rect = scene.add
    .rectangle(0, 0, w, h, color, 1)
    .setStrokeStyle(3, 0xffffff, 0.3)
    .setInteractive({ useHandCursor: true });
  const text = scene.add
    .text(0, 0, label, {
      fontFamily: FONT,
      fontSize: `${fontSize}px`,
      color: "#ffffff",
      fontStyle: "700",
      align: "center",
      wordWrap: { width: w - 24 },
    })
    .setOrigin(0.5);
  const container = scene.add.container(x, y, [rect, text]).setDepth(depth);
  rect.on("pointerdown", () => onClick());
  return { container, rect, text };
}

/** Full-screen "pick your level" card shown before a learning game starts. */
export function showLevelPicker(
  scene: Phaser.Scene,
  title: string,
  subtitle: string,
  onPick: (tier: 0 | 1) => void
): void {
  const items: Phaser.GameObjects.GameObject[] = [];
  items.push(scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0f172a, 0.94).setDepth(55).setInteractive());
  items.push(
    scene.add
      .text(GAME_WIDTH / 2, 120, title, { fontFamily: FONT, fontSize: "42px", color: "#ffffff", fontStyle: "700" })
      .setOrigin(0.5)
      .setDepth(56)
  );
  items.push(
    scene.add
      .text(GAME_WIDTH / 2, 176, subtitle, { fontFamily: FONT, fontSize: "20px", color: "#cbd5e1", align: "center" })
      .setOrigin(0.5)
      .setDepth(56)
  );
  const pick = (tier: 0 | 1): void => {
    items.forEach((i) => i.destroy());
    onPick(tier);
  };
  const b1 = makeButton(scene, GAME_WIDTH / 2 - 210, 330, 360, 130, "🌱 Easy\nAge 7", 0x16a34a, () => pick(0), 32, 56);
  const b2 = makeButton(scene, GAME_WIDTH / 2 + 210, 330, 360, 130, "🚀 Challenge\nAge 10", 0x7c3aed, () => pick(1), 32, 56);
  items.push(b1.container, b2.container);
}

/** Hold-to-move pads in the bottom corners. dir() returns -1, 0 or 1. */
export function addMovePads(scene: Phaser.Scene): { dir: () => number } {
  let left = false;
  let right = false;
  const make = (x: number, label: string, set: (down: boolean) => void): void => {
    const y = GAME_HEIGHT - 44;
    const bg = scene.add
      .rectangle(x, y, 170, 70, 0xffffff, 0.14)
      .setStrokeStyle(2, 0xffffff, 0.35)
      .setScrollFactor(0)
      .setDepth(40)
      .setInteractive();
    scene.add
      .text(x, y, label, { fontFamily: "system-ui, sans-serif", fontSize: "34px", color: "#ffffff" })
      .setOrigin(0.5)
      .setAlpha(0.7)
      .setScrollFactor(0)
      .setDepth(41);
    const on = (): void => {
      set(true);
      bg.setFillStyle(0xffffff, 0.3);
    };
    const off = (): void => {
      set(false);
      bg.setFillStyle(0xffffff, 0.14);
    };
    bg.on("pointerdown", on);
    bg.on("pointerup", off);
    bg.on("pointerout", off);
    bg.on("pointerupoutside", off);
  };
  make(100, "◀", (d) => (left = d));
  make(GAME_WIDTH - 100, "▶", (d) => (right = d));
  return { dir: () => (right ? 1 : 0) - (left ? 1 : 0) };
}

/** On-screen arrow pad (bottom-right). Calls onDir(dx, dy) every time an arrow is pressed. */
export function addDPad(scene: Phaser.Scene, onDir: (dx: number, dy: number) => void): void {
  const cx = GAME_WIDTH - 110;
  const cy = GAME_HEIGHT - 105;
  const size = 68;
  const make = (ox: number, oy: number, label: string, dx: number, dy: number): void => {
    const bg = scene.add
      .rectangle(cx + ox * size, cy + oy * size, size - 4, size - 4, 0xffffff, 0.2)
      .setStrokeStyle(2, 0xffffff, 0.5)
      .setScrollFactor(0)
      .setDepth(40)
      .setInteractive();
    scene.add
      .text(cx + ox * size, cy + oy * size, label, { fontFamily: "system-ui, sans-serif", fontSize: "30px", color: "#ffffff" })
      .setOrigin(0.5)
      .setAlpha(0.85)
      .setScrollFactor(0)
      .setDepth(41);
    bg.on("pointerdown", () => {
      bg.setFillStyle(0xffffff, 0.45);
      onDir(dx, dy);
    });
    const off = (): void => {
      bg.setFillStyle(0xffffff, 0.2);
    };
    bg.on("pointerup", off);
    bg.on("pointerout", off);
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
  scene.add
    .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0f172a, 0.55)
    .setScrollFactor(0)
    .setDepth(70);
  scene.add
    .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 72, title, {
      fontFamily: "system-ui, sans-serif",
      fontSize: "44px",
      color: "#fecaca",
      fontStyle: "700",
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(75);
  scene.add
    .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 16, detail, {
      fontFamily: "system-ui, sans-serif",
      fontSize: "22px",
      color: "#f8fafc",
    })
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
