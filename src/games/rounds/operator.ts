/** Missing Sign questions. Pure: no Phaser. */
import { int, pickOf, shuffled, withCorrect } from "./rng";
import type { RoundData, Rng } from "./types";

export type Op = "+" | "−" | "×" | "÷";
export const OPS: Op[] = ["+", "−", "×", "÷"];

export function apply(a: number, op: Op, b: number): number | null {
  switch (op) {
    case "+":
      return a + b;
    case "−":
      return a - b;
    case "×":
      return a * b;
    default:
      return b !== 0 && a % b === 0 ? a / b : null;
  }
}

/** Standard order of operations for a op1 b op2 c. */
export function applyTwo(a: number, o1: Op, b: number, o2: Op, c: number): number | null {
  const high = (o: Op): boolean => o === "×" || o === "÷";
  if (high(o2) && !high(o1)) {
    const right = apply(b, o2, c);
    return right === null ? null : apply(a, o1, right);
  }
  const left = apply(a, o1, b);
  return left === null ? null : apply(left, o2, c);
}

function missingSign(tier: 0 | 1, rng: Rng): RoundData {
  for (let attempt = 0; attempt < 80; attempt++) {
    const op = pickOf(rng, tier === 0 ? OPS.slice(0, 3) : OPS);
    let a: number;
    let b: number;
    if (op === "+") {
      a = int(rng, 2, tier === 0 ? 12 : 60);
      b = int(rng, 2, tier === 0 ? 12 : 60);
    } else if (op === "−") {
      a = int(rng, 6, tier === 0 ? 20 : 99);
      b = int(rng, 2, a - 1);
    } else if (op === "×") {
      a = int(rng, 2, tier === 0 ? 6 : 12);
      b = int(rng, 2, tier === 0 ? 6 : 12);
    } else {
      b = int(rng, 2, 12);
      a = b * int(rng, 2, 12);
    }
    const c = apply(a, op, b) as number;
    if (OPS.some((o) => o !== op && apply(a, o, b) === c)) continue; // every other sign must give a different answer
    return { prompt: "Pick the missing sign", visual: { kind: "text", text: `${a}  □  ${b}  =  ${c}` }, options: [...OPS], correct: OPS.indexOf(op), explain: `${a} ${op} ${b} = ${c}`, cols: 4, w: 190, fontSize: 52 };
  }
  return { prompt: "Pick the missing sign", visual: { kind: "text", text: "6  □  3  =  9" }, options: [...OPS], correct: 0, explain: "6 + 3 = 9", cols: 4, w: 190, fontSize: 52 };
}

function twoStep(rng: Rng): RoundData {
  for (let attempt = 0; attempt < 200; attempt++) {
    const o1 = pickOf(rng, OPS);
    const o2 = pickOf(rng, OPS);
    const a = int(rng, 2, 12);
    const b = int(rng, 2, 12);
    const c = int(rng, 2, 9);
    const d = applyTwo(a, o1, b, o2, c);
    if (d === null || d < 0 || d > 150) continue;
    const rightPair = `${o1} ${o2}`;
    const others: string[] = [];
    for (const p of shuffled(rng, OPS)) {
      for (const q of shuffled(rng, OPS)) {
        const pair = `${p} ${q}`;
        if (pair !== rightPair && applyTwo(a, p, b, q, c) !== d) others.push(pair);
      }
    }
    if (others.length < 3) continue;
    const options = shuffled(rng, [rightPair, ...others.slice(0, 3)]);
    return { prompt: "Pick both missing signs (multiply and divide go first!)", visual: { kind: "text", text: `${a} □ ${b} □ ${c} = ${d}` }, options, correct: options.indexOf(rightPair), explain: `${a} ${o1} ${b} ${o2} ${c} = ${d}`, cols: 4, w: 190, fontSize: 40 };
  }
  return missingSign(1, rng);
}

function missingNumber(tier: 0 | 1, rng: Rng): RoundData {
  const op = pickOf(rng, tier === 0 ? OPS.slice(0, 3) : OPS);
  let a: number;
  let x: number;
  if (op === "+") {
    a = int(rng, 2, tier === 0 ? 20 : 50);
    x = int(rng, 2, tier === 0 ? 20 : 50);
  } else if (op === "−") {
    a = int(rng, 10, tier === 0 ? 30 : 99);
    x = int(rng, 1, a - 1);
  } else if (op === "×") {
    a = int(rng, 2, tier === 0 ? 6 : 12);
    x = int(rng, 2, tier === 0 ? 6 : 12);
  } else {
    x = int(rng, 2, 10);
    a = x * int(rng, 2, 10);
  }
  const c = apply(a, op, x) as number;
  const wrong = [x + 1, x - 1, x + 2, x - 2, x + 10, c].filter((w) => w > 0 && w !== x && apply(a, op, w) !== c).map(String);
  const o = withCorrect(rng, String(x), shuffled(rng, wrong));
  return { prompt: "Which number goes in the box?", visual: { kind: "text", text: `${a} ${op} □ = ${c}` }, ...o, explain: `${a} ${op} ${x} = ${c}`, cols: 4, w: 190, fontSize: 44 };
}

function expression(tier: 0 | 1, rng: Rng): { text: string; value: number } {
  for (;;) {
    const op = pickOf(rng, tier === 0 ? OPS.slice(0, 3) : OPS);
    const a = int(rng, 2, tier === 0 ? 12 : 30);
    const b = int(rng, 2, tier === 0 ? 9 : 12);
    const v = apply(a, op, b);
    if (v !== null && v >= 0) return { text: `${a} ${op} ${b}`, value: v };
  }
}

function compare(tier: 0 | 1, rng: Rng): RoundData {
  let e1 = expression(tier, rng);
  let e2 = expression(tier, rng);
  for (let guard = 0; guard < 50 && (e1.value === e2.value || e1.text === e2.text); guard++) e2 = expression(tier, rng);
  if (e1.value === e2.value) {
    e1 = { text: "6 × 4", value: 24 };
    e2 = { text: "5 + 18", value: 23 };
  }
  const big = e1.value > e2.value ? e1 : e2;
  const options = [e1.text, e2.text];
  return { prompt: "Which is bigger?", visual: { kind: "text", text: `${e1.text}   or   ${e2.text}` }, options, correct: options.indexOf(big.text), explain: `${e1.text} = ${e1.value} and ${e2.text} = ${e2.value}, so ${big.text} is bigger.`, cols: 2, w: 300, fontSize: 40 };
}

function brackets(rng: Rng): RoundData {
  const sub = rng() < 0.4;
  const a = int(rng, 3, 12);
  const b = sub ? int(rng, 1, a - 1) : int(rng, 2, 12);
  const c = int(rng, 2, 6);
  const inner = sub ? a - b : a + b;
  const answer = inner * c;
  const noBrackets = sub ? a - b * c : a + b * c;
  const op = sub ? "−" : "+";
  const wrong = [noBrackets, answer + c, answer - c, answer + 1, inner + c].filter((w) => w >= 0 && w !== answer).map(String);
  const o = withCorrect(rng, String(answer), shuffled(rng, wrong));
  return { prompt: "Work out the brackets first!", visual: { kind: "text", text: `(${a} ${op} ${b}) × ${c} = □` }, ...o, explain: `${a} ${op} ${b} = ${inner}, then ${inner} × ${c} = ${answer}.`, cols: 4, w: 190, fontSize: 44 };
}

export function operatorRound(tier: 0 | 1, rng: Rng): RoundData {
  const r = rng();
  if (tier === 0) {
    if (r < 0.55) return missingSign(0, rng);
    if (r < 0.8) return missingNumber(0, rng);
    return compare(0, rng);
  }
  if (r < 0.3) return twoStep(rng);
  if (r < 0.55) return missingSign(1, rng);
  if (r < 0.7) return missingNumber(1, rng);
  if (r < 0.85) return compare(1, rng);
  return brackets(rng);
}
