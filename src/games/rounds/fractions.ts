/** Fraction Pizza questions. Pure: no Phaser. */
import { int, pickOf, shuffled, withCorrect } from "./rng";
import type { RoundData, Rng } from "./types";

export const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const equal = (a: [number, number], b: [number, number]): boolean => a[0] * b[1] === b[0] * a[1];
const parse = (s: string): [number, number] => s.split("/").map(Number) as [number, number];

/** Wrong fraction answers: keeps only fractions whose value differs from the answer's. */
function wrongFractions(answer: string, candidates: string[]): string[] {
  const a = parse(answer);
  return [...new Set(candidates)].filter((c) => {
    const f = parse(c);
    return f[0] > 0 && f[1] > 0 && !equal(f, a);
  });
}

function nameShaded(tier: 0 | 1, rng: Rng): RoundData {
  const n = tier === 0 ? pickOf(rng, [2, 3, 4, 5, 6, 8]) : pickOf(rng, [5, 6, 8, 9, 10, 12]);
  const k = int(rng, 1, n - 1);
  const wrong = [`${Math.min(n - 1, k + 1)}/${n}`, `${Math.max(1, k - 1)}/${n}`, `${n - k}/${n}`, `${k}/${n + 1}`, `${k}/${Math.max(2, n - 1)}`, `${k}/${n + 2}`, `${k + 1}/${n + 1}`, ...Array.from({ length: n - 1 }, (_, j) => `${j + 1}/${n}`)];
  const o = withCorrect(rng, `${k}/${n}`, shuffled(rng, wrong));
  return { prompt: "What fraction of the pizza is orange?", visual: { kind: "pizza", k, n }, ...o, explain: `${k} of the ${n} equal slices are orange, so the fraction is ${k}/${n}.`, cols: 4, w: 190, fontSize: 38 };
}

function equivalent(rng: Rng): RoundData {
  const base = pickOf<[number, number]>(rng, [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 5]]);
  const m = pickOf(rng, [2, 3, 4]);
  const right = `${base[0] * m}/${base[1] * m}`;
  const wrong: string[] = [];
  for (let guard = 0; wrong.length < 6 && guard < 60; guard++) {
    const d = int(rng, 2, 12);
    const nn = int(rng, 1, d - 1);
    if (nn * base[1] !== d * base[0]) wrong.push(`${nn}/${d}`);
  }
  const o = withCorrect(rng, right, wrong);
  return { prompt: `Which fraction is equal to ${base[0]}/${base[1]}?`, visual: { kind: "text", text: `${base[0]}/${base[1]} = ?` }, ...o, explain: `Multiply the top and bottom of ${base[0]}/${base[1]} by ${m} to get ${right}.`, cols: 4, w: 190, fontSize: 38 };
}

function bigger(rng: Rng): RoundData {
  let a: [number, number] = [1, 2];
  let b: [number, number] = [1, 3];
  for (let guard = 0; guard < 80; guard++) {
    const d1 = int(rng, 2, 10);
    const d2 = int(rng, 2, 10);
    a = [int(rng, 1, d1 - 1), d1];
    b = [int(rng, 1, d2 - 1), d2];
    if (!equal(a, b) && gcd(a[0], a[1]) === 1 && gcd(b[0], b[1]) === 1) break;
  }
  const fa = `${a[0]}/${a[1]}`;
  const fb = `${b[0]}/${b[1]}`;
  const big = a[0] * b[1] > b[0] * a[1] ? fa : fb;
  const options = [fa, fb];
  return {
    prompt: "Which fraction is bigger?",
    visual: { kind: "text", text: `${fa}   or   ${fb}` },
    options,
    correct: options.indexOf(big),
    explain: `${big} is bigger. Cross-multiply: ${a[0]}×${b[1]} = ${a[0] * b[1]} and ${b[0]}×${a[1]} = ${b[0] * a[1]}.`,
    cols: 2,
    w: 260,
    fontSize: 40,
  };
}

function addSame(tier: 0 | 1, rng: Rng): RoundData {
  const n = tier === 0 ? pickOf(rng, [4, 5, 6, 8, 10]) : pickOf(rng, [3, 4, 5, 6, 7, 8, 9]);
  let a = 1;
  let b = 1;
  for (let guard = 0; guard < 50; guard++) {
    a = int(rng, 1, n - 1);
    b = int(rng, 1, n - 1);
    if (tier === 0 ? a + b < n : a + b <= n + 3) break;
  }
  if (tier === 0 && a + b >= n) {
    a = 1;
    b = 1;
  }
  const answer = `${a + b}/${n}`;
  const wrong = wrongFractions(answer, [`${a + b}/${n + n}`, `${a + b + 1}/${n}`, `${Math.max(1, a + b - 1)}/${n}`, `${a * b}/${n}`, `${a + b}/${n + 1}`, `${a + b + 2}/${n}`]);
  const o = withCorrect(rng, answer, shuffled(rng, wrong));
  return { prompt: `What is ${a}/${n} + ${b}/${n}?`, visual: { kind: "text", text: `${a}/${n} + ${b}/${n} = ?` }, ...o, explain: `The bottoms match, so add the tops: ${a} + ${b} = ${a + b}. The answer is ${answer}.`, cols: 4, w: 190, fontSize: 38 };
}

const SIMPLE: [number, number][] = [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [2, 5], [3, 5], [1, 6], [5, 6], [3, 8], [1, 5], [4, 5]];

function simplify(rng: Rng): RoundData {
  const [p, q] = pickOf(rng, SIMPLE);
  const m = int(rng, 2, 4);
  const answer = `${p}/${q}`;
  const wrong = wrongFractions(answer, [...shuffled(rng, SIMPLE).map(([x, y]) => `${x}/${y}`), `${p * m}/${q}`, `${p}/${q * m}`]);
  const o = withCorrect(rng, answer, wrong);
  return { prompt: `What is ${p * m}/${q * m} in its simplest form?`, visual: { kind: "text", text: `${p * m}/${q * m} = ?` }, ...o, explain: `Divide the top and bottom of ${p * m}/${q * m} by ${m} to get ${answer}.`, cols: 4, w: 190, fontSize: 38 };
}

function ofNumber(tier: 0 | 1, rng: Rng): RoundData {
  const d = pickOf(rng, tier === 0 ? [2, 3, 4, 5] : [3, 4, 5, 6, 8]);
  const k = tier === 0 ? 1 : int(rng, 1, d - 1);
  const n = d * int(rng, 2, tier === 0 ? 10 : 12);
  const answer = (n / d) * k;
  const wrong = [answer + 1, answer - 1, answer + (n / d), n - answer, n / d + k, answer * 2].filter((v) => v > 0 && v !== answer).map(String);
  const o = withCorrect(rng, String(answer), shuffled(rng, wrong));
  return { prompt: `What is ${k}/${d} of ${n}?`, visual: { kind: "text", text: `${k}/${d} of ${n} = ?` }, ...o, explain: `${n} ÷ ${d} = ${n / d}${k > 1 ? `, and ${n / d} × ${k} = ${answer}` : ""}. So ${k}/${d} of ${n} is ${answer}.`, cols: 4, w: 190, fontSize: 40 };
}

export function fractionRound(tier: 0 | 1, rng: Rng): RoundData {
  const r = rng();
  if (tier === 0) {
    if (r < 0.55) return nameShaded(0, rng);
    if (r < 0.8) return addSame(0, rng);
    return ofNumber(0, rng);
  }
  if (r < 0.25) return nameShaded(1, rng);
  if (r < 0.45) return equivalent(rng);
  if (r < 0.6) return bigger(rng);
  if (r < 0.75) return addSame(1, rng);
  if (r < 0.88) return simplify(rng);
  return ofNumber(1, rng);
}
