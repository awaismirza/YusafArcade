import type { Rng } from "./types";

/** Whole number from a to b, both included. */
export const int = (rng: Rng, a: number, b: number): number => a + Math.floor(rng() * (b - a + 1));

export const pickOf = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];

export function shuffled<T>(rng: Rng, xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The correct option plus up to 3 distinct wrong ones (none equal to it), in random order. */
export function withCorrect(rng: Rng, correct: string, wrong: string[]): { options: string[]; correct: number } {
  const uniq = [...new Set(wrong.filter((w) => w !== correct))].slice(0, 3);
  const options = shuffled(rng, [correct, ...uniq]);
  return { options, correct: options.indexOf(correct) };
}
