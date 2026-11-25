import Phaser from "phaser";
import { ChoiceGameScene, GameCfg, Round, pick, shuffle, withAnswer } from "./ChoiceGameScene";

type Pt = { x: number; y: number };

function regular(n: number, r: number): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  });
}

function star(r: number): Pt[] {
  return Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.42;
    return { x: Math.cos(a) * rad, y: Math.sin(a) * rad };
  });
}

const SHAPES: Record<string, { pts?: Pt[]; circle?: boolean; fact: string; sides: number }> = {
  Triangle: { pts: regular(3, 66), fact: "A triangle has 3 sides and 3 corners.", sides: 3 },
  Square: { pts: [{ x: -50, y: -50 }, { x: 50, y: -50 }, { x: 50, y: 50 }, { x: -50, y: 50 }], fact: "A square has 4 equal sides.", sides: 4 },
  Rectangle: { pts: [{ x: -75, y: -42 }, { x: 75, y: -42 }, { x: 75, y: 42 }, { x: -75, y: 42 }], fact: "A rectangle has 4 sides and 4 square corners.", sides: 4 },
  Circle: { circle: true, fact: "A circle is round with no corners and no straight sides.", sides: 0 },
  Pentagon: { pts: regular(5, 62), fact: "A pentagon has 5 sides.", sides: 5 },
  Hexagon: { pts: regular(6, 62), fact: "A hexagon has 6 sides. Honeycomb cells are hexagons!", sides: 6 },
  Heptagon: { pts: regular(7, 62), fact: "A heptagon has 7 sides.", sides: 7 },
  Octagon: { pts: regular(8, 62), fact: "An octagon has 8 sides. A stop sign is an octagon!", sides: 8 },
  Decagon: { pts: regular(10, 62), fact: "A decagon has 10 sides.", sides: 10 },
  Star: { pts: star(66), fact: "This star has 10 sides and 10 corners.", sides: 10 },
  Rhombus: { pts: [{ x: 0, y: -62 }, { x: 48, y: 0 }, { x: 0, y: 62 }, { x: -48, y: 0 }], fact: "A rhombus has 4 equal sides, like a squashed square.", sides: 4 },
  Trapezoid: { pts: [{ x: -42, y: -40 }, { x: 42, y: -40 }, { x: 78, y: 40 }, { x: -78, y: 40 }], fact: "A trapezoid has 4 sides and exactly one pair of parallel sides.", sides: 4 },
  Parallelogram: { pts: [{ x: -34, y: -40 }, { x: 80, y: -40 }, { x: 34, y: 40 }, { x: -80, y: 40 }], fact: "A parallelogram has 4 sides, and opposite sides are parallel.", sides: 4 },
};

const EASY = ["Triangle", "Square", "Rectangle", "Circle", "Pentagon", "Hexagon", "Star"];
const HARD_NAMES = ["Pentagon", "Hexagon", "Heptagon", "Octagon", "Rhombus", "Trapezoid", "Parallelogram", "Decagon"];
const COLORS = [0xf97316, 0x22c55e, 0x3b82f6, 0xec4899, 0xeab308, 0xa855f7, 0x14b8a6];

const article = (name: string): string => (/^[AEIOU]/.test(name) ? "an" : "a");

export class ShapesScene extends ChoiceGameScene {
  protected readonly cfg: GameCfg = {
    title: "Shape Detective 🔷",
    subtitle: "Name the shapes and count their sides!",
    bg: 0x134e4a,
    end: "Shape Expert!",
    best: "shapes",
  };

  constructor() {
    super("Shapes");
  }

  private drawShape(name: string): Phaser.GameObjects.GameObject[] {
    const def = SHAPES[name];
    const g = this.add.graphics();
    const color = pick(COLORS);
    const cx = 480;
    const cy = 178;
    g.fillStyle(color, 1);
    g.lineStyle(4, 0xffffff, 0.9);
    if (def.circle) {
      g.fillCircle(cx, cy, 58);
      g.strokeCircle(cx, cy, 58);
    } else if (def.pts) {
      const pts = def.pts.map((p) => ({ x: p.x + cx, y: p.y + cy }));
      g.fillPoints(pts, true);
      g.strokePoints(pts, true);
    }
    return [g];
  }

  protected makeRound(tier: 0 | 1): Round {
    if (tier === 1 && Math.random() < 0.5) {
      const name = pick(["Pentagon", "Hexagon", "Heptagon", "Octagon", "Decagon"]);
      const n = SHAPES[name].sides;
      const wrong = shuffle([n - 2, n - 1, n + 1, n + 2, n + 3].filter((v) => v >= 3)).map(String);
      const o = withAnswer(String(n), wrong);
      return {
        prompt: "How many sides does this shape have?",
        visual: () => this.drawShape(name),
        options: o.options,
        correct: o.correct,
        explain: `It is ${article(name)} ${name.toLowerCase()}. ${SHAPES[name].fact}`,
        cols: 4,
        w: 190,
        fontSize: 40,
      };
    }
    const pool = tier === 0 ? EASY : HARD_NAMES;
    const name = pick(pool);
    const o = withAnswer(name, shuffle(pool));
    return {
      prompt: "What is the name of this shape?",
      visual: () => this.drawShape(name),
      options: o.options,
      correct: o.correct,
      explain: SHAPES[name].fact,
      cols: 2,
      w: 340,
      fontSize: 30,
    };
  }
}
