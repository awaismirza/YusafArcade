// Screenshot driver for checking games in a headless browser.
//
// usage: node scripts/shot.cjs <out.png> [--ipad | --phone] "<x,y,waitMs>" ...
//
// Opens http://localhost:4173/YusafArcade/ (start it with: npx vite preview --port 4173 --strictPort),
// performs each tap in GAME coordinates (960 x 540; x < 0 means "just wait"), then saves the screenshot and prints
// `errors: [...]` listing page errors and console errors (404s are ignored).
//
//   (no flag)  desktop Chromium, 960 x 540, mouse clicks. For quick looks only: the target is mobile browsers.
//   --ipad     iPad Pro 11 landscape emulation with real touch taps.
//   --phone    iPhone 13 landscape emulation with real touch taps.
//
// Playwright is installed globally in this environment (require("playwright") works from any directory).
const { chromium, devices } = require("playwright");

(async () => {
  const args = process.argv.slice(2);
  const ipad = args.includes("--ipad");
  const phone = args.includes("--phone");
  const [out, ...steps] = args.filter((a) => !a.startsWith("--"));
  if (!out) throw new Error("usage: node scripts/shot.cjs <out.png> [--ipad | --phone] \"x,y,waitMs\" ...");

  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const ctxOptions = ipad ? { ...devices["iPad Pro 11 landscape"] } : phone ? { ...devices["iPhone 13 landscape"] } : { viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 };
  const context = await browser.newContext(ctxOptions);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGE " + e));
  page.on("console", (m) => {
    if (m.type() === "error" && !/404/.test(m.text())) errors.push("CONSOLE " + m.text());
  });

  await page.goto("http://localhost:4173/YusafArcade/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // The game canvas is scaled to fit and centred, so map game coordinates onto the viewport.
  const vp = page.viewportSize();
  const scale = Math.min(vp.width / 960, vp.height / 540);
  const ox = (vp.width - 960 * scale) / 2;
  const oy = (vp.height - 540 * scale) / 2;

  for (const step of steps) {
    const [x, y, wait] = step.split(",").map(Number);
    if (x >= 0) {
      if (ipad || phone) await page.touchscreen.tap(ox + x * scale, oy + y * scale);
      else await page.mouse.click(ox + x * scale, oy + y * scale);
    }
    await page.waitForTimeout(wait || 500);
  }

  await page.screenshot({ path: out });
  console.log("errors:", JSON.stringify(errors));
  await browser.close();
})().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
