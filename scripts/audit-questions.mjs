// Prints how many questions each game has. Run: node scripts/audit-questions.mjs
import { readFileSync } from "node:fs";
const count = (file, re) => (readFileSync(file, "utf8").match(re) || []).length;
const qb = readFileSync("src/data/quizBank.ts", "utf8");
const [easyPart, hardPart] = qb.split("export const QUIZ_HARD");
const line = /^\s*\["/gm;
console.log("Quiz easy:", (easyPart.match(line) || []).length + count("src/data/quizEasyBank.ts", line));
console.log("Quiz hard:", (hardPart.match(line) || []).length);
console.log("Easy words:", (readFileSync("src/data/wordBank.ts", "utf8").split("HARD_WORDS")[0].match(/word:/g) || []).length);
console.log("Hard words:", (readFileSync("src/data/wordBank.ts", "utf8").split("HARD_WORDS")[1].match(/word:/g) || []).length);
console.log("Countries:", count("src/data/countries.ts", /name:/g) );
console.log("Odd pools:", count("src/data/oddPools.ts", /name:/g));
