/** Pattern Master and Math Rocket question generators. Run with: npm test */
import assert from "node:assert/strict";
import { mulberry32 } from "../src/arena/kit/math";
import { mathQuestion } from "../src/games/rounds/mathWords";
import { numberSequence, shapeSequence } from "../src/games/rounds/pattern";

let passed = 0;
const check = (name: string, fn: () => void): void => {
  fn();
  passed++;
  console.log(`PASS  ${name}`);
};

check("number patterns: six whole positive terms, and the new rules give the right sixth term", () => {
  for (const tier of [0, 1] as const) {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 500; seed++) {
      const { terms: t, rule } = numberSequence(tier, mulberry32(seed));
      assert.equal(t.length, 6);
      for (const v of t) assert.ok(Number.isInteger(v) && v > 0, `tier ${tier} seed ${seed}: ${t}`);
      assert.ok(rule.trim().length > 0);
      if (rule === "Two patterns take turns") {
        seen.add("alternating");
        assert.equal(t[4] - t[2], t[2] - t[0], "first pattern steps evenly");
        assert.equal(t[5] - t[3], t[3] - t[1], "second pattern steps evenly");
      } else if (rule === "Halve each time") {
        seen.add("halving");
        for (let i = 1; i < 6; i++) assert.equal(t[i] * 2, t[i - 1]);
      } else if (/^Add \d+, then take away \d+$/.test(rule)) {
        seen.add("addThenSubtract");
        const [a, b] = rule.match(/\d+/g)!.map(Number);
        for (let i = 1; i < 6; i++) assert.equal(t[i] - t[i - 1], i % 2 === 1 ? a : -b);
      } else if (/^Count down by \d+s$/.test(rule)) {
        seen.add("countDownBy");
        const k = Number(rule.match(/\d+/)![0]);
        for (let i = 1; i < 6; i++) assert.equal(t[i - 1] - t[i], k);
      }
    }
    const want = tier === 0 ? ["alternating", "countDownBy"] : ["alternating", "halving", "addThenSubtract"];
    for (const k of want) assert.ok(seen.has(k), `tier ${tier} never made ${k}`);
  }
});

check("shape patterns repeat cleanly, and the new units appear at Challenge", () => {
  for (const tier of [0, 1] as const) {
    const units = new Set<number>();
    for (let seed = 1; seed <= 500; seed++) {
      const { items, unit } = shapeSequence(tier, mulberry32(seed));
      assert.equal(items.length, 8);
      assert.ok(unit.length <= 4);
      items.forEach((it, i) => assert.equal(it, unit[i % unit.length]));
      units.add(new Set(unit).size * 10 + unit.length);
    }
    if (tier === 1) assert.ok(units.has(34), "a 3-symbol, 4-long unit (ABBC or ABCC) appears");
  }
});

const KINDS: Record<string, [RegExp, (n: number[]) => number]> = {
  change: [/^You pay (\d+) for a (\d+) toy\. How much change\?$/, ([a, b]) => a - b],
  groups: [/^(\d+) \w+ with (\d+) (\w+) each\. How many \3\?$/, ([a, b]) => a * b],
  share: [/^(\d+) \w+ shared equally by (\d+) friends\. How many each\?$/, ([a, b]) => a / b],
  minutes: [/^How many minutes are in (\d+) hours\?$/, ([h]) => h * 60],
  perimeter: [/^A square has sides of (\d+)\. What is its perimeter\?$/, ([s]) => s * 4],
};

check("math questions have whole answers; word problems are short, varied and correct", () => {
  for (let level = 1; level <= 6; level++) {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 500; seed++) {
      const q = mathQuestion(level, mulberry32(seed * 13 + level));
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0, `level ${level}: ${q.text} = ${q.answer}`);
      for (const [kind, [re, f]] of Object.entries(KINDS)) {
        const m = re.exec(q.text);
        if (!m) continue;
        seen.add(kind);
        assert.ok(level >= 2, "no word problems at level 1");
        assert.ok(q.text.length <= 70, `too long: ${q.text}`);
        const nums = m.slice(1).filter((x) => /^\d+$/.test(x)).map(Number);
        assert.equal(q.answer, f(nums), q.text);
        assert.ok(q.answer >= 1 && q.answer <= 200, `answer out of range: ${q.text}`);
      }
    }
    if (level >= 2) for (const k of Object.keys(KINDS)) assert.ok(seen.has(k), `level ${level} never made ${k}`);
    else assert.equal(seen.size, 0);
  }
});

console.log(`${passed} pattern and math generator checks passed.`);
