/** Pattern Master sequences. Pure: no Phaser. */
import { int, pickOf, shuffled } from "./rng";
import type { Rng } from "./types";

export type Seq = { terms: number[]; rule: string };
const six = (f: (i: number) => number): number[] => Array.from({ length: 6 }, (_, i) => f(i));

export function numberSequence(tier: 0 | 1, rng: Rng): Seq {
  const easy: (() => Seq)[] = [
    () => {
      const k = int(rng, 2, 5);
      const s = int(rng, 1, 10);
      return { terms: six((i) => s + k * i), rule: `Add ${k} each time` };
    },
    () => {
      const k = int(rng, 2, 5);
      const s = int(rng, 30, 50);
      return { terms: six((i) => s - k * i), rule: `Subtract ${k} each time` };
    },
    () => {
      const k = pickOf(rng, [5, 10]);
      return { terms: six((i) => k * (i + 1)), rule: `Count by ${k}s` };
    },
    () => {
      const s = int(rng, 1, 3);
      return { terms: six((i) => s * 2 ** i), rule: "Double each time (× 2)" };
    },
  ];
  const alternating = (): Seq => {
    const a = int(rng, 1, 5);
    const s1 = int(rng, 1, 3);
    const b = int(rng, 1, 3) * 10;
    const s2 = pickOf(rng, [5, 10]);
    return { terms: [a, b, a + s1, b + s2, a + 2 * s1, b + 2 * s2], rule: "Two patterns take turns" };
  };
  const countDown = (): Seq => {
    const k = pickOf(rng, [2, 5, 10]);
    const start = k * int(rng, 7, 12);
    return { terms: six((i) => start - k * i), rule: `Count down by ${k}s` };
  };
  const hard: (() => Seq)[] = [
    () => {
      const s = int(rng, 1, 3);
      return { terms: six((i) => s * 3 ** i), rule: "Multiply by 3 each time" };
    },
    () => {
      const o = int(rng, 0, 3);
      return { terms: six((i) => (i + 1 + o) ** 2), rule: "Square numbers (1×1, 2×2, 3×3 …)" };
    },
    () => ({ terms: [1, 3, 6, 10, 15, 21], rule: "Triangular numbers: add 2, then 3, then 4 …" }),
    () => {
      const a = int(rng, 1, 4);
      const b = int(rng, 2, 6);
      const t = [a, b];
      for (let i = 2; i < 6; i++) t.push(t[i - 1] + t[i - 2]);
      return { terms: t, rule: "Fibonacci-style: add the two numbers before" };
    },
    () => {
      const a = int(rng, 2, 5);
      const b = int(rng, 6, 9);
      const t = [int(rng, 1, 9)];
      for (let i = 1; i < 6; i++) t.push(t[i - 1] + (i % 2 === 1 ? a : b));
      return { terms: t, rule: `Alternately add ${a} and ${b}` };
    },
    () => {
      const s = int(rng, 1, 6);
      const t = [s];
      for (let i = 1; i < 6; i++) t.push(t[i - 1] + i);
      return { terms: t, rule: "The jump grows: +1, +2, +3, +4 …" };
    },
    () => ({ terms: [1, 2, 4, 8, 16, 32], rule: "Powers of 2: double each time" }),
    () => {
      const s = int(rng, 1, 3);
      return { terms: six((i) => s * 2 ** (5 - i)), rule: "Halve each time" };
    },
    () => {
      const a = int(rng, 3, 6);
      const b = int(rng, 1, a - 1);
      const t = [int(rng, 1, 9)];
      for (let i = 1; i < 6; i++) t.push(t[i - 1] + (i % 2 === 1 ? a : -b));
      return { terms: t, rule: `Add ${a}, then take away ${b}` };
    },
  ];
  const pool = tier === 0 ? [...easy, alternating, countDown] : [...easy.slice(0, 2), ...hard, alternating];
  return pickOf(rng, pool)();
}

export const EMOJI = ["🔴", "🔵", "🟡", "🟢", "🟣", "🟠", "⭐", "🔺", "🔷", "❤️"];

/** Eight items made by repeating a short unit, so the 8th is fixed by the first seven. */
export function shapeSequence(tier: 0 | 1, rng: Rng): { items: string[]; unit: string[] } {
  const patterns = tier === 0 ? ["AB", "AAB", "ABB", "ABC"] : ["AABB", "ABCB", "ABAC", "AABC", "ABCD", "ABBC", "ABCC"];
  const p = pickOf(rng, patterns);
  const letters = [...new Set(p.split(""))];
  const symbols = shuffled(rng, EMOJI).slice(0, letters.length);
  const unit = p.split("").map((ch) => symbols[letters.indexOf(ch)]);
  return { items: Array.from({ length: 8 }, (_, i) => unit[i % unit.length]), unit };
}
