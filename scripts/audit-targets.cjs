// Touch-target audit: opens the menu and every Phaser game (start screen, then after picking the first level),
// and lists tappable objects smaller than 44 CSS px, and tappable objects that overlap each other.
//
// usage: node scripts/audit-targets.cjs [--ipad | --phone]
// Start the site first: npx vite preview --port 4173 --strictPort
// Exit code 1 when anything is too small or overlapping. The 3D Arena games are HTML/CSS and are not covered here.
const { chromium, devices } = require("playwright");

const TABS = [112, 296, 480, 664]; // Arcade, Learn, Puzzles, Board Games (the 3D Arena tab is at 848)
const COUNTS = [9, 9, 6, 4];
const XS = [170, 480, 790];
const YS = [214, 326, 438];

(async () => {
  const ipad = process.argv.includes("--ipad");
  const phone = process.argv.includes("--phone");
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const ctx = await browser.newContext(ipad ? { ...devices["iPad Pro 11 landscape"] } : phone ? { ...devices["iPhone 13 landscape"] } : { viewport: { width: 960, height: 540 } });
  const page = await ctx.newPage();
  await page.goto("http://localhost:4173/YusafArcade/?debug=1", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const vp = page.viewportSize();
  const scale = Math.min(vp.width / 960, vp.height / 540);
  const ox = (vp.width - 960 * scale) / 2;
  const oy = (vp.height - 540 * scale) / 2;
  const tap = async (x, y, wait = 900) => {
    if (ipad || phone) await page.touchscreen.tap(ox + x * scale, oy + y * scale);
    else await page.mouse.click(ox + x * scale, oy + y * scale);
    await page.waitForTimeout(wait);
  };

  const small = new Map();
  const overlaps = new Map();
  const audit = async (where) => {
    const res = await page.evaluate(() => {
      const game = window.__yusaf;
      if (!game) return { error: "no debug handle" };
      const canvas = game.canvas.getBoundingClientRect();
      const css = canvas.width / 960;
      const out = [];
      for (const sc of game.scene.getScenes(true)) {
        const items = [];
        const blockers = [];
        const visibleChain = (o) => {
          for (let p = o; p; p = p.parentContainer) if (p.visible === false || p.alpha === 0) return false;
          return true;
        };
        const label = (o) => {
          const kids = o.list || (o.parentContainer && o.parentContainer.list) || [];
          const t = kids.find((k) => k.type === "Text" && k.text);
          return (t ? t.text : o.name || o.type).replace(/\s+/g, " ").slice(0, 24);
        };
        const walk = (list) => {
          for (const o of list) {
            if (o.input && o.input.enabled && visibleChain(o)) {
              let b = o.getBounds();
              if (o.type === "Container" && o.input.hitArea) {
                // A container is measured by its hit area around its world position.
                const m = o.getWorldTransformMatrix();
                const w = o.input.hitArea.width * m.scaleX;
                const h = o.input.hitArea.height * m.scaleY;
                b = { x: m.tx - w / 2, y: m.ty - h / 2, width: w, height: h };
              }
              const depth = o.depth + (o.parentContainer ? o.parentContainer.depth : 0);
              // Full-screen blockers (picker scrims) are not buttons, but they take the taps of anything below them.
              if (b.width >= 900 && b.height >= 500) blockers.push(depth);
              else items.push({ label: label(o), x: b.x, y: b.y, w: b.width, h: b.height, depth });
            }
            if (o.list) walk(o.list);
          }
        };
        walk(sc.sys.displayList.list);
        const top = blockers.length ? Math.max(...blockers) : -Infinity;
        out.push({ scene: sc.sys.settings.key, css, items: items.filter((it) => it.depth >= top) });
      }
      return { scenes: out };
    });
    if (res.error) throw new Error(res.error);
    // HTML control bars (Batman, Flappy, game over) under the canvas.
    const html = await page.evaluate(() =>
      [...document.querySelectorAll("#touch button, #flap-bar button, #end-bar button")]
        .map((b) => ({ id: b.id, r: b.getBoundingClientRect() }))
        .filter((b) => b.r.width > 0 && b.r.height > 0)
        .map((b) => ({ id: b.id, w: b.r.width, h: b.r.height }))
    );
    for (const b of html) if (b.w < 44 || b.h < 44) small.set(`HTML  #${b.id}`, `${Math.round(b.w)} x ${Math.round(b.h)}  (${where})`);
    for (const s of res.scenes) {
      for (const it of s.items) {
        const wPx = it.w * s.css;
        const hPx = it.h * s.css;
        // Allowed: Flappy on phones shows an HTML bar (Menu + Flap, or Restart + Main Menu) with big copies of its
        // canvas buttons; that bar is what shrinks the canvas. The HTML buttons are checked separately below.
        if (s.scene === "Flappy") continue;
        if (wPx < 44 || hPx < 44) small.set(`${s.scene}  ${it.label}`, `${Math.round(wPx)} x ${Math.round(hPx)} at game ${Math.round(it.x)},${Math.round(it.y)}  (${where})`);
      }
      for (let i = 0; i < s.items.length; i++) {
        for (let j = i + 1; j < s.items.length; j++) {
          const a = s.items[i];
          const b = s.items[j];
          const ox2 = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
          const oy2 = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
          if (ox2 > 4 && oy2 > 4) overlaps.set(`${s.scene}  "${a.label}" / "${b.label}"`, `${Math.round(ox2)} x ${Math.round(oy2)} game px  (${where})`);
        }
      }
    }
  };

  await audit("menu");
  for (let t = 0; t < TABS.length; t++) {
    for (let i = 0; i < COUNTS[t]; i++) {
      await tap(TABS[t], 104, 500);
      await audit(`menu tab ${t}`);
      await tap(XS[i % 3], YS[Math.floor(i / 3)], 1400);
      await audit(`tab ${t} game ${i} start`);
      await tap(270, 328, 1400); // first level / mode
      await audit(`tab ${t} game ${i} playing`);
      // back to the menu for the next game
      await page.goto("http://localhost:4173/YusafArcade/?debug=1", { waitUntil: "networkidle" });
      await page.waitForTimeout(1200);
    }
  }

  for (const [k, v] of small) console.log(`SMALL    ${k}  ${v}`);
  for (const [k, v] of overlaps) console.log(`OVERLAP  ${k}  ${v}`);
  console.log(`targets below 44px: ${small.size}`);
  console.log(`overlaps: ${overlaps.size}`);
  await browser.close();
  process.exit(small.size || overlaps.size ? 1 : 0);
})().catch((e) => {
  console.error("FAIL", e);
  process.exit(2);
});
