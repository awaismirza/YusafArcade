import Phaser from "phaser";
import { shapeRound, SHAPES } from "../games/rounds/shapes";
import { ChoiceGameScene, GameCfg, Round, pick } from "./ChoiceGameScene";

const COLORS = [0xf97316, 0x22c55e, 0x3b82f6, 0xec4899, 0xeab308, 0xa855f7, 0x14b8a6];

export class ShapesScene extends ChoiceGameScene {
  protected readonly cfg: GameCfg = {
    title: "Shape Detective 🔷",
    subtitle: "Name the shapes and count their sides!",
    bg: 0x134e4a,
    palette: "shapes",
    end: "Shape Expert!",
    best: "shapes",
  };

  constructor() {
    super("Shapes");
  }

  private drawShape(kind: "flat" | "solid", name: string): Phaser.GameObjects.GameObject[] {
    // Drawn around (0, 0) and scaled to fit the gap between the question (y 112) and the answers (y 224).
    const g = this.add.graphics().setPosition(480, 176).setScale(0.7);
    const color = pick(COLORS);
    const cx = 0;
    const cy = 0;
    if (kind === "solid") {
      this.drawSolid(g, name, color, cx, cy);
      return [g];
    }
    const def = SHAPES[name];
    g.fillStyle(color, 1);
    g.lineStyle(4, 0xffffff, 0.9);
    if (def.round === "circle") {
      g.fillCircle(cx, cy, 58);
      g.strokeCircle(cx, cy, 58);
    } else if (def.round === "oval") {
      g.fillEllipse(cx, cy, 150, 92);
      g.strokeEllipse(cx, cy, 150, 92);
    } else if (def.round === "semicircle") {
      g.beginPath();
      g.arc(cx, cy + 30, 70, Math.PI, 0, false);
      g.closePath();
      g.fillPath();
      g.strokePath();
    } else if (def.pts) {
      const pts = def.pts.map((p) => ({ x: p.x + cx, y: p.y + cy }));
      g.fillPoints(pts, true);
      g.strokePoints(pts, true);
    }
    return [g];
  }

  /** 3D solids drawn with three shades of the colour so they look solid. */
  private drawSolid(g: Phaser.GameObjects.Graphics, name: string, color: number, cx: number, cy: number): void {
    const base = Phaser.Display.Color.IntegerToColor(color);
    const light = base.clone().lighten(22).color;
    const dark = base.clone().darken(22).color;
    const poly = (fill: number, pts: [number, number][]): void => {
      const p = pts.map(([x, y]) => ({ x: cx + x, y: cy + y }));
      g.fillStyle(fill, 1);
      g.fillPoints(p, true);
      g.lineStyle(3, 0xffffff, 0.85);
      g.strokePoints(p, true);
    };
    const box = (w: number, h: number, d: number): void => {
      const x0 = -w / 2 - d / 4;
      const y0 = -h / 2 + d / 4;
      poly(color, [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]]);
      poly(light, [[x0, y0], [x0 + d / 2, y0 - d / 2], [x0 + w + d / 2, y0 - d / 2], [x0 + w, y0]]);
      poly(dark, [[x0 + w, y0], [x0 + w + d / 2, y0 - d / 2], [x0 + w + d / 2, y0 + h - d / 2], [x0 + w, y0 + h]]);
    };
    g.lineStyle(3, 0xffffff, 0.85);
    switch (name) {
      case "Cube":
        box(92, 92, 64);
        break;
      case "Cuboid":
        box(150, 74, 56);
        break;
      case "Pyramid":
        poly(dark, [[-70, 50], [20, 70], [0, -70]]);
        poly(color, [[20, 70], [80, 36], [0, -70]]);
        break;
      case "Triangular prism":
        poly(color, [[-80, 50], [40, 50], [40, -10], [-80, -10]]);
        poly(light, [[-80, -10], [40, -10], [70, -60], [-50, -60]]);
        poly(dark, [[40, 50], [100, 0], [70, -60], [40, -10]]);
        break;
      case "Cylinder":
        g.fillStyle(color, 1);
        g.fillRect(cx - 55, cy - 50, 110, 100);
        g.fillEllipse(cx, cy + 50, 110, 34);
        g.lineStyle(3, 0xffffff, 0.85);
        g.lineBetween(cx - 55, cy - 50, cx - 55, cy + 50);
        g.lineBetween(cx + 55, cy - 50, cx + 55, cy + 50);
        g.beginPath();
        g.arc(cx, cy + 50, 55, 0, Math.PI, false);
        g.strokePath();
        g.fillStyle(light, 1);
        g.fillEllipse(cx, cy - 50, 110, 34);
        g.strokeEllipse(cx, cy - 50, 110, 34);
        break;
      case "Cone":
        g.fillStyle(color, 1);
        g.fillEllipse(cx, cy + 48, 120, 36);
        poly(color, [[-60, 48], [60, 48], [0, -72]]);
        g.fillStyle(light, 1);
        g.fillEllipse(cx, cy + 48, 120, 36);
        g.strokeEllipse(cx, cy + 48, 120, 36);
        break;
      default: {
        // Sphere: a ball with a soft highlight.
        g.fillStyle(dark, 1);
        g.fillCircle(cx, cy, 66);
        g.fillStyle(color, 1);
        g.fillCircle(cx - 8, cy - 8, 56);
        g.fillStyle(light, 1);
        g.fillCircle(cx - 22, cy - 24, 22);
        g.fillStyle(0xffffff, 0.7);
        g.fillCircle(cx - 28, cy - 30, 8);
      }
    }
  }

  protected makeRound(tier: 0 | 1): Round {
    const r = shapeRound(tier, Math.random);
    return { ...r, visual: () => this.drawShape(r.drawing.kind, r.drawing.name) };
  }
}
