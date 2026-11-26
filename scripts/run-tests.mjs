// Bundles each tests/*.test.ts with esbuild (already installed via Vite) and runs it in Node.
// Usage: npm test            (all tests)
//        npm test -- chess   (only tests whose file name contains "chess")
import { build } from "esbuild";
import { readdirSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const filter = process.argv[2] ?? "";
const files = readdirSync("tests").filter((f) => f.endsWith(".test.ts") && f.includes(filter));
mkdirSync("dist-test", { recursive: true });

let failed = 0;
for (const f of files) {
  const out = `dist-test/${f.replace(/\.ts$/, ".cjs")}`;
  await build({ entryPoints: [`tests/${f}`], bundle: true, platform: "node", format: "cjs", outfile: out, logLevel: "warning" });
  console.log(`\n== ${f}`);
  const r = spawnSync("node", [out], { stdio: "inherit" });
  if (r.status !== 0) failed++;
}
if (files.length === 0) {
  console.error(`No tests match "${filter}"`);
  process.exit(1);
}
if (failed > 0) {
  console.error(`\n${failed} test file(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${files.length} test file(s) passed.`);
