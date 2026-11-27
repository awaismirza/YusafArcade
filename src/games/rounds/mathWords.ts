/** Math Rocket questions, including short word problems. Pure: no Phaser. */
import { int, pickOf } from "./rng";
import type { Rng } from "./types";

export type Q = { text: string; answer: number };

/** A short word problem for levels 2 to 6. Answers are whole numbers from 1 to 200. */
export function wordProblem(level: number, rng: Rng): Q {
  const kind = pickOf(rng, ["change", "groups", "share", "minutes", "perimeter"] as const);
  const big = level >= 4;
  switch (kind) {
    case "change": {
      const pay = pickOf(rng, big ? [50, 100] : [20, 50]);
      const cost = int(rng, 5, pay - 1);
      return { text: `You pay ${pay} for a ${cost} toy. How much change?`, answer: pay - cost };
    }
    case "groups": {
      const [box, thing] = pickOf(rng, [["bags", "apples"], ["boxes", "crayons"], ["nests", "eggs"], ["teams", "players"], ["packs", "cards"]]);
      const a = int(rng, 2, big ? 9 : 5);
      const b = int(rng, 2, big ? 12 : 6);
      return { text: `${a} ${box} with ${b} ${thing} each. How many ${thing}?`, answer: a * b };
    }
    case "share": {
      const thing = pickOf(rng, ["sweets", "stickers", "marbles", "biscuits"]);
      const friends = int(rng, 2, big ? 9 : 5);
      const each = int(rng, 2, big ? 12 : 6);
      return { text: `${friends * each} ${thing} shared equally by ${friends} friends. How many each?`, answer: each };
    }
    case "minutes": {
      const h = int(rng, 2, 3);
      return { text: `How many minutes are in ${h} hours?`, answer: h * 60 };
    }
    default: {
      const s = int(rng, 2, big ? 20 : 10);
      return { text: `A square has sides of ${s}. What is its perimeter?`, answer: s * 4 };
    }
  }
}

function sum(level: number, rng: Rng): Q {
  switch (level) {
    case 1: {
      const a = int(rng, 2, 12);
      const b = int(rng, 2, 12);
      return rng() < 0.5 ? { text: `${a} + ${b} = ?`, answer: a + b } : { text: `${a + b} − ${a} = ?`, answer: b };
    }
    case 2: {
      if (rng() < 0.5) {
        const a = int(rng, 12, 80);
        const b = int(rng, 11, 99 - a);
        return { text: `${a} + ${b} = ?`, answer: a + b };
      }
      const a = int(rng, 30, 99);
      const b = int(rng, 11, a - 1);
      return { text: `${a} − ${b} = ?`, answer: a - b };
    }
    case 3: {
      const a = int(rng, 2, 10);
      const b = int(rng, 2, 10);
      return { text: `${a} × ${b} = ?`, answer: a * b };
    }
    case 4: {
      if (rng() < 0.5) {
        const b = int(rng, 2, 10);
        const q = int(rng, 2, 10);
        return { text: `${b * q} ÷ ${b} = ?`, answer: q };
      }
      const a = int(rng, 6, 12);
      const b = int(rng, 6, 12);
      return { text: `${a} × ${b} = ?`, answer: a * b };
    }
    case 5: {
      if (rng() < 0.5) {
        const x = int(rng, 5, 60);
        const a = int(rng, 5, 40);
        return { text: `□ + ${a} = ${x + a}`, answer: x };
      }
      const a = int(rng, 2, 9);
      const x = int(rng, 2, 10);
      return { text: `${a} × □ = ${a * x}`, answer: x };
    }
    default: {
      const a = int(rng, 2, 20);
      const b = int(rng, 2, 9);
      const c = int(rng, 2, 9);
      return rng() < 0.5 ? { text: `${a} + ${b} × ${c} = ?`, answer: a + b * c } : { text: `(${a} + ${b}) × ${c} = ?`, answer: (a + b) * c };
    }
  }
}

/** A question for a level from 1 to 6: from level 2, about one in three is a word problem. */
export function mathQuestion(level: number, rng: Rng): Q {
  if (level >= 2 && rng() < 0.3) return wordProblem(level, rng);
  return sum(level, rng);
}
