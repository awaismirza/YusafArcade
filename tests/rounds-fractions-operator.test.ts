/** Fractions and Missing Sign question generators. Run with: npm test */
import assert from "node:assert/strict";
import { mulberry32 } from "../src/arena/kit/math";
import { fractionRound } from "../src/games/rounds/fractions";
import { operatorRound } from "../src/games/rounds/operator";
import { RoundData } from "../src/games/rounds/types";

let passed = 0;
const check = (name: string, fn: () => void): void => {
  fn();
  passed++;
  console.log(`PASS  ${name}`);
};
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const frac = (s: string): [number, number] => {
  const m = /^(\d+)\/(\d+)$/.exec(s);
  assert.ok(m, `not a fraction: ${s}`);
  return [Number(m![1]), Number(m![2])];
};
const sameValue = (a: string, b: string): boolean => {
  const [p, q] = frac(a);
  const [r, s] = frac(b);
  return p * s === r * q;
};
/** Evaluates "a op b" or "(a op b) op c" with + − × ÷ (× and ÷ before + and −). */
function evaluate(expr: string): number {
  const js = expr.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
  assert.ok(/^[\d\s()+\-*/]+$/.test(js), `unexpected expression ${expr}`);
  return Function(`"use strict"; return (${js});`)() as number;
}

function basics(r: RoundData, label: string): void {
  assert.ok(r.options.length === 2 || r.options.length === 4, `${label}: ${r.options.length} options`);
  assert.equal(new Set(r.options).size, r.options.length, `${label}: repeated option in ${r.options}`);
  assert.ok(r.correct >= 0 && r.correct < r.options.length, `${label}: correct index`);
  assert.ok(r.prompt.trim().length > 0 && r.prompt.length <= 70, `${label}: prompt "${r.prompt}"`);
  assert.ok(r.explain.trim().length > 0, `${label}: explain`);
}

const FRACTION_KINDS = {
  addSame: /^What is (\d+)\/(\d+) \+ (\d+)\/(\d+)\?$/,
  simplify: /^What is (\d+)\/(\d+) in its simplest form\?$/,
  ofNumber: /^What is (\d+)\/(\d+) of (\d+)\?$/,
  equivalent: /^Which fraction is equal to (\d+)\/(\d+)\?$/,
};

check("fraction rounds are valid, and the new kinds have exactly one right answer", () => {
  for (const tier of [0, 1] as const) {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 500; seed++) {
      const r = fractionRound(tier, mulberry32(seed));
      basics(r, `fractions t${tier} s${seed}`);
      const ans = r.options[r.correct];
      let m = FRACTION_KINDS.addSame.exec(r.prompt);
      if (m) {
        seen.add("addSame");
        const [a, n, b, n2] = m.slice(1).map(Number);
        assert.equal(n, n2, "same denominator");
        assert.equal(ans, `${a + b}/${n}`);
        if (tier === 0) assert.ok(a + b < n, "sum below 1 at age 7");
        for (const o of r.options) if (o !== ans) assert.ok(!sameValue(o, ans), `${o} equals ${ans}`);
      }
      m = FRACTION_KINDS.simplify.exec(r.prompt);
      if (m) {
        seen.add("simplify");
        assert.equal(tier, 1, "simplify is Challenge only");
        const [p, q] = frac(ans);
        assert.equal(gcd(p, q), 1, `${ans} is not in simplest form`);
        assert.ok(sameValue(ans, `${m[1]}/${m[2]}`));
        for (const o of r.options) if (o !== ans) assert.ok(!sameValue(o, ans), `${o} equals ${ans}`);
      }
      m = FRACTION_KINDS.ofNumber.exec(r.prompt);
      if (m) {
        seen.add("ofNumber");
        const [k, d, n] = m.slice(1).map(Number);
        assert.equal(Number(ans), (n / d) * k);
        assert.ok(Number.isInteger(Number(ans)), "whole answer");
      }
      m = FRACTION_KINDS.equivalent.exec(r.prompt);
      if (m) {
        assert.ok(sameValue(ans, `${m[1]}/${m[2]}`));
        for (const o of r.options) if (o !== ans) assert.ok(!sameValue(o, ans), `equivalent: ${o} also equals ${ans}`);
      }
    }
    for (const k of tier === 0 ? ["addSame", "ofNumber"] : ["addSame", "simplify", "ofNumber"]) assert.ok(seen.has(k), `tier ${tier} never made ${k}`);
  }
});

check("missing sign rounds are valid, and the new kinds check out", () => {
  for (const tier of [0, 1] as const) {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 500; seed++) {
      const r = operatorRound(tier, mulberry32(seed));
      basics(r, `operator t${tier} s${seed}`);
      const ans = r.options[r.correct];
      const text = r.visual && r.visual.kind === "text" ? r.visual.text : "";
      if (r.prompt === "Which number goes in the box?") {
        seen.add("missingNumber");
        const [lhs, rhs] = text.replace("□", ans).split("=");
        assert.equal(evaluate(lhs), Number(rhs), `${text} with ${ans}`);
        for (const o of r.options) if (o !== ans) assert.notEqual(evaluate(text.replace("□", o).split("=")[0]), Number(rhs), `${o} also works in ${text}`);
        if (tier === 0) assert.ok(!text.includes("÷"), "no division at age 7");
      } else if (r.prompt === "Which is bigger?") {
        seen.add("compare");
        assert.equal(r.options.length, 2);
        const [a, b] = r.options.map(evaluate);
        assert.notEqual(a, b, "never equal");
        assert.equal(evaluate(ans), Math.max(a, b));
      } else if (r.prompt === "Work out the brackets first!") {
        seen.add("brackets");
        assert.equal(tier, 1, "brackets are Challenge only");
        const lhs = text.split("=")[0];
        assert.equal(evaluate(lhs), Number(ans));
        assert.ok(Number(ans) <= 150 && Number(ans) >= 0);
      }
    }
    for (const k of tier === 0 ? ["missingNumber", "compare"] : ["missingNumber", "compare", "brackets"]) assert.ok(seen.has(k), `tier ${tier} never made ${k}`);
  }
});

console.log(`${passed} fraction and operator generator checks passed.`);
