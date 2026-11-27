import { COUNTRIES } from "../src/data/countries";
import { pickRounds } from "../src/data/pickRounds";
import { QUIZ_EASY, QUIZ_HARD } from "../src/data/quizBank";
import { findDuplicates, validateCountry, validateQA, validateWord } from "../src/data/validate";
import { EASY_WORDS, HARD_WORDS } from "../src/data/wordBank";
import { ODD_EMOJI_POOLS, ODD_NUMBER_POOLS, ODD_WORD_POOLS } from "../src/data/oddPools";
import assert from "node:assert/strict";

let passed = 0;
const test = (name: string, fn: () => void): void => {
  fn();
  passed++;
  console.log(`PASS  ${name}`);
};
const eq = (a: unknown, b: unknown, msg?: string): void => assert.deepEqual(a, b, msg);
const ok = (v: unknown, msg?: string): void => assert.ok(v, msg);

test("validateQA accepts a good question and rejects bad ones", () => {
  eq(validateQA(["🐶", "Q?", "A", ["B", "C", "D"], "Fact."]), []);
  ok(validateQA(["🐶", "Q?", "A", ["A", "C", "D"], "Fact."]).length > 0, "wrong equals correct");
  ok(validateQA(["🐶", "Q?", "A", ["B", "B", "D"], "Fact."]).length > 0, "repeat wrong");
  ok(validateQA(["🐶", "", "A", ["B", "C", "D"], "Fact."]).length > 0, "empty prompt");
  ok(validateQA(["🐶", "Q?", "A", ["B", "C", "D"], ""]).length > 0, "empty fact");
});

test("validateWord and validateCountry", () => {
  eq(validateWord({ word: "CAT", clue: "pet" }), []);
  ok(validateWord({ word: "cat", clue: "pet" }).length > 0);
  ok(validateWord({ word: "AB", clue: "x" }).length > 0);
  ok(validateWord({ word: "CAT", clue: "" }).length > 0);
  eq(validateCountry({ name: "Japan", flag: "🇯🇵", capital: "Tokyo", continent: "Asia" }), []);
  ok(validateCountry({ name: "X", flag: "f", capital: "Y", continent: "Mars" }).length > 0);
});

test("findDuplicates finds repeated keys", () => {
  eq(findDuplicates(["a", "b", "a"], (x) => x), ["a"]);
  eq(findDuplicates(["a", "b"], (x) => x), []);
});

test("pickRounds returns distinct items and never more than the pool", () => {
  const p = pickRounds([1, 2, 3, 4, 5, 6], 4);
  eq(p.length, 4);
  eq(new Set(p).size, 4);
  eq(pickRounds([1, 2, 3], 10).length, 3);
  eq(pickRounds([], 5), []);
});

test("every bank entry is valid with no repeats", () => {
  for (const [name, bank] of [["quiz easy", QUIZ_EASY], ["quiz hard", QUIZ_HARD]] as const) {
    for (const q of bank) eq(validateQA(q), [], `${name}: ${q[1]}`);
    eq(findDuplicates([...bank], (q) => q[1]), [], `${name} duplicate questions`);
  }
  for (const [name, bank] of [["easy words", EASY_WORDS], ["hard words", HARD_WORDS]] as const) {
    for (const w of bank) eq(validateWord(w), [], `${name}: ${w.word}`);
    eq(findDuplicates([...bank], (w) => w.word), [], `${name} duplicates`);
  }
  for (const c of COUNTRIES) eq(validateCountry(c), [], c.name);
  eq(findDuplicates(COUNTRIES, (c) => c.name), []);
  eq(findDuplicates(COUNTRIES, (c) => c.capital), []);
  for (const pool of [...ODD_EMOJI_POOLS, ...ODD_WORD_POOLS, ...ODD_NUMBER_POOLS]) {
    ok(pool.items.length >= 5, `${pool.name} needs 5+ items`);
    eq(new Set(pool.items).size, pool.items.length, `${pool.name} has repeats`);
  }
});

test("odd-one-out pools do not share items (so there is only one right answer)", () => {
  for (const pools of [ODD_EMOJI_POOLS, ODD_WORD_POOLS]) {
    const all = pools.flatMap((p) => p.items);
    eq(findDuplicates(all, (x) => x), []);
  }
});

test("banks meet their size targets", () => {
  ok(QUIZ_EASY.length >= 150, `quiz easy ${QUIZ_EASY.length}`);
  ok(QUIZ_HARD.length >= 80, `quiz hard ${QUIZ_HARD.length}`);
  ok(EASY_WORDS.length >= 60, `easy words ${EASY_WORDS.length}`);
  ok(HARD_WORDS.length >= 60, `hard words ${HARD_WORDS.length}`);
  ok(COUNTRIES.length >= 70, `countries ${COUNTRIES.length}`);
  ok(ODD_EMOJI_POOLS.length + ODD_WORD_POOLS.length + ODD_NUMBER_POOLS.length >= 30, "odd pools");
});

console.log(`${passed} question checks passed.`);
