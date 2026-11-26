import type { QA } from "./quizEasyBank";

/** Returns a list of problems with a quiz question. Empty means it is fine. */
export function validateQA(q: QA): string[] {
  const [emoji, prompt, correct, wrong, fact] = q;
  const errs: string[] = [];
  if (!emoji || !emoji.trim()) errs.push("missing emoji");
  if (!prompt || !prompt.trim()) errs.push("missing question");
  if (!correct || !correct.trim()) errs.push("missing answer");
  if (!Array.isArray(wrong) || wrong.length !== 3) errs.push("needs exactly 3 wrong answers");
  else {
    if (wrong.some((w) => !w || !w.trim())) errs.push("empty wrong answer");
    if (new Set(wrong).size !== 3) errs.push("wrong answers repeat");
    if (wrong.includes(correct)) errs.push("a wrong answer equals the correct one");
  }
  if (!fact || !fact.trim()) errs.push("missing fun fact");
  return errs;
}

export function validateWord(w: { word: string; clue: string }): string[] {
  const errs: string[] = [];
  if (!/^[A-Z]+$/.test(w.word)) errs.push("word must be A to Z capitals only");
  if (w.word.length < 3 || w.word.length > 10) errs.push("word must be 3 to 10 letters");
  if (!w.clue || !w.clue.trim()) errs.push("missing clue");
  return errs;
}

export function validateCountry(c: { name: string; flag: string; capital: string; continent: string }): string[] {
  const errs: string[] = [];
  if (!c.name?.trim()) errs.push("missing name");
  if (!c.flag?.trim()) errs.push("missing flag");
  if (!c.capital?.trim()) errs.push("missing capital");
  if (!["Asia", "Europe", "Africa", "North America", "South America", "Oceania"].includes(c.continent)) errs.push("unknown continent");
  return errs;
}

/** The keys that appear more than once. */
export function findDuplicates<T>(items: T[], key: (t: T) => string): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const it of items) {
    const k = key(it);
    if (seen.has(k)) dup.add(k);
    seen.add(k);
  }
  return [...dup];
}
