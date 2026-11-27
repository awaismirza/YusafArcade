// Opens a 3D Arena game, picks a mode by button text, plays for a while, saves a screenshot.
//
// usage: node scripts/arena-shot.cjs <out.png> [--ipad | --phone] <Game> "<mode button text>" [waitMs] [keys]
//   mode: one button text, or several separated by | (clicked in turn)
//   Game: Karts | Bombs | Hockey | Tanks | Golf
//   keys: optional comma list of key codes held during the wait, e.g. "KeyW,Space"
// Start the site first: npx vite preview --port 4173 --strictPort
const { chromium, devices } = require("playwright");

const TILES = { Karts: [170, 214], Bombs: [480, 214], Hockey: [790, 214], Tanks: [325, 326], Golf: [635, 326] };

(async () => {
  const args = process.argv.slice(2);
  const ipad = args.includes("--ipad");
  const phone = args.includes("--phone");
  const [out, game, mode, waitMs = "4000", keyList = ""] = args.filter((a) => !a.startsWith("--"));
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const ctx = await browser.newContext(ipad ? { ...devices["iPad Pro 11 landscape"] } : phone ? { ...devices["iPhone 13 landscape"] } : { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGE " + e));
  page.on("console", (m) => {
    if (m.type() === "error" && !/404/.test(m.text())) errors.push("CONSOLE " + m.text());
  });
  await page.goto("http://localhost:4173/YusafArcade/" + (process.env.QS || ""), { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const vp = page.viewportSize();
  const scale = Math.min(vp.width / 960, vp.height / 540);
  const ox = (vp.width - 960 * scale) / 2;
  const oy = (vp.height - 540 * scale) / 2;
  const tap = async (x, y) => {
    const px = ox + x * scale;
    const py = oy + y * scale;
    if (ipad || phone) await page.touchscreen.tap(px, py);
    else await page.mouse.click(px, py);
  };
  await tap(848, 104);
  await page.waitForTimeout(500);
  await tap(...TILES[game]);
  await page.waitForTimeout(2500);
  // "A|B" clicks button A, then button B (e.g. a mode, then a track).
  for (const label of mode ? mode.split("|") : []) {
    await page.getByText(label, { exact: false }).first().click();
    await page.waitForTimeout(600);
  }
  const keys = keyList ? keyList.split(",") : [];
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(Number(waitMs));
  for (const k of keys) await page.keyboard.up(k);
  await page.screenshot({ path: out });
  console.log("errors:", JSON.stringify(errors));
  await browser.close();
})();
