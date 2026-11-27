/** Shape Detective: flat shapes, 3D solids and the questions about them. Pure: no Phaser. */
import { pickOf, shuffled, withCorrect } from "./rng";
import type { RoundData, Rng } from "./types";

export type Pt = { x: number; y: number };

export function regular(n: number, r: number): Pt[] {
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

/** How to draw a flat shape: a polygon, or one of the round outlines. */
export type FlatShape = { pts?: Pt[]; round?: "circle" | "oval" | "semicircle"; fact: string; sides: number };

const c = 22; // half the arm width of the cross
export const SHAPES: Record<string, FlatShape> = {
  Triangle: { pts: regular(3, 66), fact: "A triangle has 3 sides and 3 corners.", sides: 3 },
  Square: { pts: [{ x: -50, y: -50 }, { x: 50, y: -50 }, { x: 50, y: 50 }, { x: -50, y: 50 }], fact: "A square has 4 equal sides.", sides: 4 },
  Rectangle: { pts: [{ x: -75, y: -42 }, { x: 75, y: -42 }, { x: 75, y: 42 }, { x: -75, y: 42 }], fact: "A rectangle has 4 sides and 4 square corners.", sides: 4 },
  Circle: { round: "circle", fact: "A circle is round with no corners and no straight sides.", sides: 0 },
  Oval: { round: "oval", fact: "An oval is like a stretched circle, the shape of an egg.", sides: 0 },
  Semicircle: { round: "semicircle", fact: "A semicircle is half a circle: one curved side and one straight side.", sides: 1 },
  Pentagon: { pts: regular(5, 62), fact: "A pentagon has 5 sides.", sides: 5 },
  Hexagon: { pts: regular(6, 62), fact: "A hexagon has 6 sides. Honeycomb cells are hexagons!", sides: 6 },
  Heptagon: { pts: regular(7, 62), fact: "A heptagon has 7 sides.", sides: 7 },
  Octagon: { pts: regular(8, 62), fact: "An octagon has 8 sides. A stop sign is an octagon!", sides: 8 },
  Nonagon: { pts: regular(9, 62), fact: "A nonagon has 9 sides.", sides: 9 },
  Decagon: { pts: regular(10, 62), fact: "A decagon has 10 sides.", sides: 10 },
  Star: { pts: star(66), fact: "This star has 10 sides and 10 corners.", sides: 10 },
  Rhombus: { pts: [{ x: 0, y: -62 }, { x: 48, y: 0 }, { x: 0, y: 62 }, { x: -48, y: 0 }], fact: "A rhombus has 4 equal sides, like a squashed square.", sides: 4 },
  Trapezoid: { pts: [{ x: -42, y: -40 }, { x: 42, y: -40 }, { x: 78, y: 40 }, { x: -78, y: 40 }], fact: "A trapezoid has 4 sides and exactly one pair of parallel sides.", sides: 4 },
  Parallelogram: { pts: [{ x: -34, y: -40 }, { x: 80, y: -40 }, { x: 34, y: 40 }, { x: -80, y: 40 }], fact: "A parallelogram has 4 sides, and opposite sides are parallel.", sides: 4 },
  Cross: {
    pts: [
      { x: -c, y: -62 }, { x: c, y: -62 }, { x: c, y: -c }, { x: 62, y: -c }, { x: 62, y: c }, { x: c, y: c },
      { x: c, y: 62 }, { x: -c, y: 62 }, { x: -c, y: c }, { x: -62, y: c }, { x: -62, y: -c }, { x: -c, y: -c },
    ],
    fact: "This cross has 12 sides and 12 corners.",
    sides: 12,
  },
};
export const SHAPE_NAMES_2D = Object.keys(SHAPES);

export const SOLIDS: Record<string, { faces: number; edges: number; vertices: number; fact: string }> = {
  Cube: { faces: 6, edges: 12, vertices: 8, fact: "A cube has 6 square faces, like a dice." },
  Cuboid: { faces: 6, edges: 12, vertices: 8, fact: "A cuboid is a box shape with 6 rectangle faces." },
  Pyramid: { faces: 5, edges: 8, vertices: 5, fact: "This pyramid has a square base and 4 triangle faces: 5 faces." },
  "Triangular prism": { faces: 5, edges: 9, vertices: 6, fact: "A triangular prism has 2 triangle ends and 3 rectangle sides." },
  Cylinder: { faces: 3, edges: 2, vertices: 0, fact: "A cylinder has 2 flat circle faces and 1 curved face, like a tin can." },
  Cone: { faces: 2, edges: 1, vertices: 1, fact: "A cone has a flat circle base, a curved face and 1 point, like an ice-cream cone." },
  Sphere: { faces: 1, edges: 0, vertices: 0, fact: "A sphere is perfectly round, like a ball. It has 1 curved face." },
};
const EASY_SOLIDS = ["Cube", "Sphere", "Cone", "Cylinder", "Pyramid"];
const EASY = ["Triangle", "Square", "Rectangle", "Circle", "Oval", "Semicircle", "Pentagon", "Hexagon", "Star"];
const HARD = ["Pentagon", "Hexagon", "Heptagon", "Octagon", "Nonagon", "Rhombus", "Trapezoid", "Parallelogram", "Decagon", "Cross"];
const article = (name: string): string => (/^[AEIOU]/.test(name) ? "an" : "a");

export type ShapeRound = RoundData & { drawing: { kind: "flat" | "solid"; name: string } };

export function shapeRound(tier: 0 | 1, rng: Rng): ShapeRound {
  const r = rng();
  if (tier === 1 && r < 0.17) {
    const name = pickOf(rng, Object.keys(SOLIDS));
    const faces = SOLIDS[name].faces;
    const others = Object.values(SOLIDS).map((s) => s.faces);
    const wrong = shuffled(rng, [...others, faces + 1, faces - 1, faces + 2, faces * 2].filter((v) => v > 0 && v !== faces)).map(String);
    const o = withCorrect(rng, String(faces), wrong);
    return { prompt: `How many faces does ${article(name)} ${name.toLowerCase()} have?`, ...o, explain: SOLIDS[name].fact, cols: 4, w: 190, fontSize: 40, drawing: { kind: "solid", name } };
  }
  if ((tier === 0 && r < 0.25) || (tier === 1 && r < 0.35)) {
    const pool = tier === 0 ? EASY_SOLIDS : Object.keys(SOLIDS);
    const name = pickOf(rng, pool);
    const o = withCorrect(rng, name, shuffled(rng, pool));
    return { prompt: "What is the name of this 3D shape?", ...o, explain: SOLIDS[name].fact, cols: 2, w: 340, fontSize: 30, drawing: { kind: "solid", name } };
  }
  if (tier === 1 && r < 0.65) {
    const name = pickOf(rng, ["Pentagon", "Hexagon", "Heptagon", "Octagon", "Nonagon", "Decagon"]);
    const n = SHAPES[name].sides;
    const wrong = shuffled(rng, [n - 2, n - 1, n + 1, n + 2, n + 3].filter((v) => v >= 3)).map(String);
    const o = withCorrect(rng, String(n), wrong);
    return { prompt: "How many sides does this shape have?", ...o, explain: `It is ${article(name)} ${name.toLowerCase()}. ${SHAPES[name].fact}`, cols: 4, w: 190, fontSize: 40, drawing: { kind: "flat", name } };
  }
  const pool = tier === 0 ? EASY : HARD;
  const name = pickOf(rng, pool);
  const o = withCorrect(rng, name, shuffled(rng, pool));
  return { prompt: "What is the name of this shape?", ...o, explain: SHAPES[name].fact, cols: 2, w: 340, fontSize: 30, drawing: { kind: "flat", name } };
}

