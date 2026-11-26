import Phaser from "phaser";
import type { OrbitRig, ViewPreset } from "../games/shared/orbitRig";
import { drawGlass } from "./glass";
import { BoardGestures } from "./gestures";
import { FONT } from "./theme";

const DARK = 0x1b1640;
const PRESETS: { id: ViewPreset; label: string }[] = [
  { id: "top", label: "Top down" },
  { id: "side", label: "My side" },
  { id: "left", label: "Left corner" },
  { id: "right", label: "Right corner" },
  { id: "reset", label: "Reset" },
];

/**
 * A glass "View" button under the Menu button (drawn below pickers and game-over cards, so they cover it). Tapping it opens a list of preset camera views; choosing one glides the
 * camera there. The list closes after a choice or when View is tapped again.
 */
function addCameraButton(scene: Phaser.Scene, rig: OrbitRig): void {
  const x = 80;
  const y = 104;
  const bg = scene.add.graphics().setScrollFactor(0).setDepth(50);
  drawGlass(bg, x, y, 128, 52, { tint: DARK, alpha: 0.55, radius: 18 });
  scene.add.text(x, y, "📷  View", { fontFamily: FONT, fontSize: "19px", color: "#ffffff", fontStyle: "800" }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
  const zone = scene.add.rectangle(x, y, 128, 52, 0xffffff, 0.001).setScrollFactor(0).setDepth(52).setInteractive({ useHandCursor: true });

  const list: Phaser.GameObjects.GameObject[] = [];
  let current: ViewPreset = "reset";
  const close = (): void => {
    list.forEach((o) => o.destroy());
    list.length = 0;
  };
  const open = (): void => {
    PRESETS.forEach((p, i) => {
      const cy = y + 58 + i * 54;
      const g = scene.add.graphics().setScrollFactor(0).setDepth(53);
      drawGlass(g, x, cy, 150, 48, { tint: p.id === current ? 0x7c3aed : DARK, alpha: p.id === current ? 0.85 : 0.6, radius: 16 });
      const label = scene.add.text(x, cy, p.label, { fontFamily: FONT, fontSize: "17px", color: "#ffffff", fontStyle: "800" }).setOrigin(0.5).setScrollFactor(0).setDepth(54);
      const hit = scene.add.rectangle(x, cy, 150, 48, 0xffffff, 0.001).setScrollFactor(0).setDepth(54.5).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => {
        current = p.id;
        rig.applyPreset(p.id);
        close();
      });
      list.push(g, label, hit);
    });
  };
  zone.on("pointerdown", () => (list.length > 0 ? close() : open()));
}

/**
 * Everything a board game needs to be viewable from other angles: two-finger pinch, twist and tilt, a reliable
 * one-finger tap, and the View button. Returns the gesture tracker.
 */
export function addBoardControls(scene: Phaser.Scene, rig: OrbitRig, onTap: (x: number, y: number) => void): BoardGestures {
  addCameraButton(scene, rig);
  return new BoardGestures(scene, {
    onPinch: (s) => rig.pinch(s),
    onTwist: (r) => rig.twist(r),
    onTilt: (r) => rig.tilt(r),
    onTap,
  });
}
