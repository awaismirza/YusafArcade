import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { getBest, saveBest } from "../ui/arcadeKit";
import { CLUES, Clue, EARTH_KM, PLANETS, PlanetData, SUN_DATA } from "./solarData";

type Body = {
  id: string;
  name: string;
  emoji: string;
  group: THREE.Object3D;
  radius: number;
  data: PlanetData | null;
};

type Planet = Body & { data: PlanetData; mesh: THREE.Mesh; angle: number; label: THREE.Sprite };

const QUIZ_LEN = 8;

// ---------------------------------------------------------------- textures
function rngFrom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

type Ctx = CanvasRenderingContext2D;

function blob(ctx: Ctx, x: number, y: number, rad: number, color: string, alpha: number): void {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, rad, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function bands(ctx: Ctx, w: number, h: number, r: () => number, palette: string[], minH: number, maxH: number): void {
  let y = 0;
  while (y < h) {
    const bh = minH + r() * (maxH - minH);
    ctx.fillStyle = palette[Math.floor(r() * palette.length)];
    ctx.fillRect(0, y, w, bh + 1);
    y += bh;
  }
  for (let i = 0; i < 160; i++) {
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = r() < 0.5 ? "#ffffff" : "#000000";
    ctx.fillRect(r() * w, r() * h, 20 + r() * 90, 1 + r() * 3);
  }
  ctx.globalAlpha = 1;
}

function craters(ctx: Ctx, w: number, h: number, r: () => number, dark: string, light: string, n: number): void {
  for (let i = 0; i < n; i++) {
    const x = r() * w;
    const y = r() * h;
    const rad = 3 + r() * 12;
    blob(ctx, x, y, rad, light, 0.35);
    blob(ctx, x + 1, y + 1, rad * 0.82, dark, 0.45);
  }
}

const DRAWERS: Record<string, (ctx: Ctx, w: number, h: number, r: () => number) => void> = {
  sun: (ctx, w, h, r) => {
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) blob(ctx, r() * w, r() * h, 8 + r() * 36, r() < 0.5 ? "#fde047" : "#f97316", 0.22);
  },
  mercury: (ctx, w, h, r) => {
    ctx.fillStyle = "#9ca3af";
    ctx.fillRect(0, 0, w, h);
    craters(ctx, w, h, r, "#4b5563", "#d1d5db", 90);
  },
  venus: (ctx, w, h, r) => {
    ctx.fillStyle = "#e6c88a";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 140; i++) blob(ctx, r() * w, r() * h, 14 + r() * 50, r() < 0.5 ? "#f6e3b4" : "#c79a52", 0.16);
  },
  earth: (ctx, w, h, r) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#1e40af");
    g.addColorStop(0.5, "#2563eb");
    g.addColorStop(1, "#1e40af");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let k = 0; k < 16; k++) {
      const cx = r() * w;
      const cy = h * 0.2 + r() * h * 0.6;
      for (let j = 0; j < 7; j++) blob(ctx, cx + (r() - 0.5) * 80, cy + (r() - 0.5) * 44, 12 + r() * 28, r() < 0.7 ? "#22c55e" : "#a16207", 1);
    }
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, w, 12);
    ctx.fillRect(0, h - 12, w, 12);
    for (let i = 0; i < 50; i++) blob(ctx, r() * w, r() * h, 10 + r() * 30, "#ffffff", 0.28);
  },
  mars: (ctx, w, h, r) => {
    ctx.fillStyle = "#c2410c";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) blob(ctx, r() * w, r() * h, 10 + r() * 40, r() < 0.6 ? "#7c2d12" : "#ea580c", 0.3);
    ctx.fillStyle = "#fef3c7";
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, w, 8);
    ctx.fillRect(0, h - 8, w, 8);
    ctx.globalAlpha = 1;
  },
  jupiter: (ctx, w, h, r) => {
    bands(ctx, w, h, r, ["#d6b48a", "#b9835a", "#f1e0c5", "#a4673f", "#e3c9a0", "#c79566"], 10, 30);
    ctx.fillStyle = "#b91c1c";
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(330, 168, 34, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  },
  saturn: (ctx, w, h, r) => bands(ctx, w, h, r, ["#e8d9a8", "#d8c58a", "#f0e6bf", "#c9b476"], 10, 26),
  uranus: (ctx, w, h, r) => {
    ctx.fillStyle = "#7dd3d8";
    ctx.fillRect(0, 0, w, h);
    bands(ctx, w, h, r, ["#8ee0e4", "#6fc6cc"], 30, 70);
  },
  neptune: (ctx, w, h, r) => {
    ctx.fillStyle = "#2563eb";
    ctx.fillRect(0, 0, w, h);
    bands(ctx, w, h, r, ["#2f6df0", "#1e4fc4", "#4b86f5"], 18, 44);
    blob(ctx, 150, 140, 20, "#1e3a8a", 0.6);
  },
  moon: (ctx, w, h, r) => {
    ctx.fillStyle = "#cbd5e1";
    ctx.fillRect(0, 0, w, h);
    craters(ctx, w, h, r, "#64748b", "#f1f5f9", 70);
  },
};

function makeTexture(id: string, seed: number): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext("2d") as Ctx;
  DRAWERS[id](ctx, 512, 256, rngFrom(seed));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d") as Ctx;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, "rgba(255,230,150,1)");
  g.addColorStop(0.3, "rgba(255,170,60,0.55)");
  g.addColorStop(1, "rgba(255,120,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function ringTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 2;
  const ctx = c.getContext("2d") as Ctx;
  for (let x = 0; x < 256; x++) {
    const t = x / 256;
    let a = 0.55 + 0.35 * Math.pow(Math.sin(t * 70), 2);
    if (t > 0.42 && t < 0.5) a = 0.06;
    if (t < 0.05 || t > 0.95) a *= 0.4;
    ctx.fillStyle = `rgba(232,217,168,${a})`;
    ctx.fillRect(x, 0, 1, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function labelSprite(text: string): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = 300;
  c.height = 70;
  const ctx = c.getContext("2d") as Ctx;
  ctx.fillStyle = "rgba(2,6,23,0.55)";
  ctx.beginPath();
  ctx.roundRect(4, 8, 292, 54, 27);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 32px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 150, 36);
  const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true, sizeAttenuation: false });
  const s = new THREE.Sprite(mat);
  s.scale.set(0.2, 0.2 * (70 / 300), 1);
  s.renderOrder = 10;
  return s;
}

// -------------------------------------------------------------------- app
export function startSolar(onExit: () => void): () => void {
  let disposed = false;

  const root = document.createElement("div");
  root.id = "solar-root";
  root.style.cssText =
    "position:fixed;inset:0;z-index:200;background:#02030a;color:#fff;font-family:system-ui,-apple-system,'Apple Color Emoji',sans-serif;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;";
  document.body.appendChild(root);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;";
  root.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02030a);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2000);
  camera.position.set(0, 42, 92);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 2.5;
  controls.maxDistance = 240;
  controls.target.set(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const sunLight = new THREE.PointLight(0xfff1d0, 3.2, 0, 0);
  scene.add(sunLight);

  // stars
  const starPos = new Float32Array(1800 * 3);
  for (let i = 0; i < 1800; i++) {
    const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(450 + Math.random() * 300);
    starPos.set([v.x, v.y, v.z], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false })));

  const pickables: THREE.Object3D[] = [];
  const bodyOf = new Map<THREE.Object3D, Body>();

  const addPickSphere = (group: THREE.Object3D, body: Body, radius: number): void => {
    const pick = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(radius * 1.7, 1.3), 12, 12),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    group.add(pick);
    pickables.push(pick);
    bodyOf.set(pick, body);
  };

  // sun
  const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(5, 48, 48), new THREE.MeshBasicMaterial({ map: makeTexture("sun", 7) }));
  scene.add(sunMesh);
  const sunGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })
  );
  sunGlow.scale.set(26, 26, 1);
  scene.add(sunGlow);
  const sunBody: Body = { id: "sun", name: SUN_DATA.name, emoji: SUN_DATA.emoji, group: sunMesh, radius: 5, data: null };
  addPickSphere(sunMesh, sunBody, 5);
  const sunLabel = labelSprite("☀️ Sun");
  sunLabel.position.set(0, 7.2, 0);
  scene.add(sunLabel);

  // planets
  const planets: Planet[] = [];
  const rand = rngFrom(99);
  PLANETS.forEach((d, i) => {
    const orbit = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(Array.from({ length: 160 }, (_, k) => new THREE.Vector3(Math.cos((k / 160) * Math.PI * 2) * d.dist, 0, Math.sin((k / 160) * Math.PI * 2) * d.dist))),
      new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.35 })
    );
    scene.add(orbit);

    const group = new THREE.Group();
    const tiltGroup = new THREE.Group();
    tiltGroup.rotation.z = d.tilt;
    group.add(tiltGroup);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(d.radius, 40, 40),
      new THREE.MeshStandardMaterial({ map: makeTexture(d.id, 11 + i * 17), roughness: 0.9, metalness: 0 })
    );
    tiltGroup.add(mesh);

    if (d.id === "saturn") {
      const inner = d.radius * 1.35;
      const outer = d.radius * 2.35;
      const geo = new THREE.RingGeometry(inner, outer, 128);
      const pos = geo.attributes.position;
      const uv = geo.attributes.uv;
      const v3 = new THREE.Vector3();
      for (let k = 0; k < pos.count; k++) {
        v3.fromBufferAttribute(pos, k);
        uv.setXY(k, (v3.length() - inner) / (outer - inner), 0.5);
      }
      const ring = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: ringTexture(), side: THREE.DoubleSide, transparent: true, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      tiltGroup.add(ring);
    }

    const label = labelSprite(d.name);
    label.position.set(0, d.radius + 1.2, 0);
    group.add(label);

    const planet: Planet = { id: d.id, name: d.name, emoji: d.emoji, group, radius: d.radius, data: d, mesh, angle: rand() * Math.PI * 2, label };
    addPickSphere(group, planet, d.radius);
    scene.add(group);
    planets.push(planet);
  });

  // Earth's moon
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 20), new THREE.MeshStandardMaterial({ map: makeTexture("moon", 5), roughness: 1 }));
  scene.add(moon);
  let moonAngle = 0;
  const earth = planets.find((p) => p.id === "earth") as Planet;

  // selection ring (always faces the camera)
  const selRing = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(Array.from({ length: 64 }, (_, k) => new THREE.Vector3(Math.cos((k / 64) * Math.PI * 2), Math.sin((k / 64) * Math.PI * 2), 0))),
    new THREE.LineBasicMaterial({ color: 0xfde047 })
  );
  selRing.visible = false;
  scene.add(selRing);

  // ------------------------------------------------------------- state
  let tier: 0 | 1 = 0;
  let speed = 1;
  let focus: Body | null = null;
  let goalDist = 105;
  let adjusting = false;
  let mode: "explore" | "quiz" = "explore";
  let quiz: { qs: Clue[]; i: number; score: number; correct: number; streak: number; answered: boolean } | null = null;

  const allBodies: Body[] = [sunBody, ...planets];

  // ------------------------------------------------------------- UI
  const h = (tag: string, css: string, html = ""): HTMLElement => {
    const e = document.createElement(tag);
    e.style.cssText = css;
    e.innerHTML = html;
    return e;
  };
  const btnCss = (bg: string): string =>
    `background:${bg};color:#fff;border:1px solid rgba(255,255,255,0.25);border-radius:12px;padding:9px 14px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;touch-action:manipulation;`;
  const panelCss = "background:rgba(2,6,23,0.78);border:1px solid rgba(148,163,184,0.35);border-radius:16px;padding:14px 16px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);";

  const top = h("div", "position:absolute;left:0;right:0;top:0;display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;padding:10px 12px;pointer-events:none;");
  const backBtn = h("button", btnCss("#334155") + "pointer-events:auto;", "← Menu");
  const title = h("div", "font-size:20px;font-weight:800;letter-spacing:.3px;text-shadow:0 2px 8px #000;", "☀️ Solar System Explorer");
  const rightBox = h("div", "display:flex;gap:8px;align-items:center;pointer-events:auto;flex-wrap:wrap;justify-content:flex-end;");
  const age7 = h("button", btnCss("#16a34a"), "🌱 Age 7");
  const age10 = h("button", btnCss("#475569"), "🚀 Age 10");
  const speedWrap = h("label", "display:flex;gap:6px;align-items:center;font-size:14px;font-weight:700;background:rgba(2,6,23,.6);border-radius:12px;padding:6px 10px;", "⏱ Speed");
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "0";
  slider.max = "4";
  slider.step = "0.1";
  slider.value = "1";
  slider.style.cssText = "width:90px;";
  speedWrap.appendChild(slider);
  const quizBtn = h("button", btnCss("#7c3aed"), "🎯 Quiz");
  rightBox.append(age7, age10, speedWrap, quizBtn);
  top.append(backBtn, title, rightBox);

  const info = h("div", panelCss + "position:absolute;right:12px;top:64px;width:min(350px,92vw);max-height:calc(100% - 150px);overflow-y:auto;display:none;font-size:15px;line-height:1.4;");
  info.setAttribute("data-scroll", "1");
  const quizCard = h("div", panelCss + "position:absolute;left:50%;transform:translateX(-50%);top:64px;width:min(620px,94vw);display:none;text-align:center;");
  const hint = h("div", "position:absolute;left:12px;bottom:70px;font-size:13px;color:#cbd5e1;text-shadow:0 1px 4px #000;pointer-events:none;", "Drag to rotate · pinch or scroll to zoom · tap a planet");

  const chips = h("div", "position:absolute;left:0;right:0;bottom:0;display:flex;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));overflow-x:auto;white-space:nowrap;background:linear-gradient(transparent,rgba(2,6,23,.85));");
  chips.setAttribute("data-scroll", "1");
  const chipEls = new Map<string, HTMLElement>();
  const addChip = (id: string, label: string, dot: string): void => {
    const c = h(
      "button",
      "flex:0 0 auto;display:flex;align-items:center;gap:7px;background:rgba(30,41,59,.9);color:#fff;border:2px solid transparent;border-radius:999px;padding:9px 14px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;touch-action:manipulation;",
      `<span style="width:12px;height:12px;border-radius:50%;background:${dot};display:inline-block"></span>${label}`
    );
    c.addEventListener("click", () => onChip(id));
    chips.appendChild(c);
    chipEls.set(id, c);
  };
  addChip("overview", "Overview", "#e2e8f0");
  addChip("sun", "Sun", "#fbbf24");
  PLANETS.forEach((p) => addChip(p.id, p.name, p.color));

  root.append(top, info, quizCard, hint, chips);

  const setTierButtons = (): void => {
    age7.style.background = tier === 0 ? "#16a34a" : "#475569";
    age10.style.background = tier === 1 ? "#7c3aed" : "#475569";
  };

  const markChips = (): void => {
    chipEls.forEach((el, id) => {
      const active = id === (focus ? focus.id : "overview");
      el.style.borderColor = active ? "#fde047" : "transparent";
    });
  };

  const infoHTML = (b: Body): string => {
    const d = b.data;
    const stats = d ? d.stats : SUN_DATA.stats;
    const facts = (tier === 0 ? (d ? d.easy : SUN_DATA.easy) : d ? d.hard : SUN_DATA.hard)
      .map((f) => `<li style="margin:6px 0">${f}</li>`)
      .join("");
    const grid = stats
      .map(([k, v]) => `<div style="background:rgba(51,65,85,.6);border-radius:10px;padding:6px 9px"><div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">${k}</div><div style="font-weight:700;font-size:14px">${v}</div></div>`)
      .join("");
    const sizeBar = d
      ? `<div style="margin:10px 0 4px;font-size:12px;color:#94a3b8">Size compared with Earth</div><div style="height:10px;border-radius:6px;background:#1e293b;overflow:hidden"><div style="height:100%;width:${Math.min(100, (d.diameterKm / 139820) * 100).toFixed(1)}%;background:${d.color}"></div></div><div style="font-size:12px;color:#cbd5e1;margin-top:3px">${(d.diameterKm / EARTH_KM).toFixed(2)}× Earth's width</div>`
      : "";
    return `<div style="display:flex;justify-content:space-between;align-items:center"><div style="font-size:24px;font-weight:800">${b.emoji} ${b.name}</div><button id="info-close" style="${btnCss("#334155")}padding:4px 10px">✕</button></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px">${grid}</div>${sizeBar}
      <div style="margin-top:12px;font-weight:800;color:#fde047">${tier === 0 ? "🌱 Fun facts" : "🚀 Deep dive"}</div><ul style="padding-left:18px;margin:4px 0 0">${facts}</ul>`;
  };

  const showInfo = (b: Body | null): void => {
    if (!b || mode === "quiz") {
      info.style.display = "none";
      return;
    }
    info.innerHTML = infoHTML(b);
    info.style.display = "block";
    info.scrollTop = 0;
    info.querySelector("#info-close")?.addEventListener("click", () => {
      setFocus(null);
      showInfo(null);
    });
  };

  function setFocus(b: Body | null): void {
    focus = b;
    goalDist = b ? Math.max(b.radius * 4.4, 7) : 105;
    adjusting = true;
    markChips();
  }

  function onBody(b: Body): void {
    if (mode === "quiz") {
      if (b.data) answer(b.id);
      return;
    }
    setFocus(b);
    showInfo(b);
  }

  function onChip(id: string): void {
    if (id === "overview") {
      setFocus(null);
      showInfo(null);
      return;
    }
    if (mode === "quiz") {
      if (id !== "sun") answer(id);
      return;
    }
    const b = allBodies.find((x) => x.id === id);
    if (b) onBody(b);
  }

  // ------------------------------------------------------------- quiz
  const best = (): number => getBest("solar");

  function renderQuiz(feedback = "", fact = ""): void {
    if (!quiz) return;
    const q = quiz.qs[quiz.i];
    const last = quiz.i >= quiz.qs.length - 1;
    quizCard.innerHTML = `
      <div style="font-size:14px;color:#cbd5e1">Question ${quiz.i + 1} of ${quiz.qs.length} · Score ${quiz.score} · 🏆 Best ${best()}</div>
      <div style="font-size:24px;font-weight:800;margin:8px 0">🎯 ${q.q}</div>
      <div style="font-size:14px;color:#cbd5e1">${quiz.answered ? "" : "Tap the planet in space — or pick it from the bar below"}</div>
      ${feedback ? `<div style="font-size:18px;font-weight:700;margin-top:8px">${feedback}</div><div style="font-size:14px;color:#fde68a;margin-top:6px">💡 ${fact}</div><button id="quiz-next" style="${btnCss("#16a34a")}margin-top:10px">${last ? "See results ▶" : "Next ▶"}</button>` : ""}`;
    quizCard.querySelector("#quiz-next")?.addEventListener("click", () => {
      if (!quiz) return;
      if (last) endQuiz();
      else {
        quiz.i += 1;
        quiz.answered = false;
        setFocus(null);
        renderQuiz();
      }
    });
  }

  function answer(id: string): void {
    if (!quiz || quiz.answered) return;
    quiz.answered = true;
    const clue = quiz.qs[quiz.i];
    const right = planets.find((p) => p.id === clue.answer) as Planet;
    const ok = id === clue.answer;
    if (ok) {
      quiz.correct += 1;
      quiz.streak += 1;
      quiz.score += 10 + Math.min(quiz.streak - 1, 5) * 2;
    } else {
      quiz.streak = 0;
    }
    setFocus(right);
    const fact = (tier === 0 ? right.data.easy : right.data.hard)[Math.floor(Math.random() * 4)];
    renderQuiz(ok ? `✅ Correct! It is ${right.name}.` : `❌ Not quite — the answer is ${right.name}!`, fact);
  }

  function startQuiz(): void {
    mode = "quiz";
    quizBtn.innerHTML = "🔭 Explore";
    info.style.display = "none";
    const pool = CLUES.filter((c) => (tier === 0 ? c.tier === 0 : c.tier === 1));
    const qs = [...pool].sort(() => Math.random() - 0.5).slice(0, QUIZ_LEN);
    quiz = { qs, i: 0, score: 0, correct: 0, streak: 0, answered: false };
    setFocus(null);
    quizCard.style.display = "block";
    renderQuiz();
  }

  function endQuiz(): void {
    if (!quiz) return;
    const record = saveBest("solar", quiz.score);
    quizCard.innerHTML = `
      <div style="font-size:26px;font-weight:800">🏆 Quiz finished!</div>
      <div style="font-size:20px;margin:8px 0">${quiz.correct} of ${quiz.qs.length} correct · Score ${quiz.score}</div>
      <div style="font-size:16px;color:#fde68a">Best score: ${best()}${record ? " — New record! 🎉" : ""}</div>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:12px">
        <button id="quiz-again" style="${btnCss("#16a34a")}">Play again</button>
        <button id="quiz-explore" style="${btnCss("#334155")}">Back to exploring</button>
      </div>`;
    quizCard.querySelector("#quiz-again")?.addEventListener("click", startQuiz);
    quizCard.querySelector("#quiz-explore")?.addEventListener("click", stopQuiz);
  }

  function stopQuiz(): void {
    mode = "explore";
    quiz = null;
    quizBtn.innerHTML = "🎯 Quiz";
    quizCard.style.display = "none";
    setFocus(null);
  }

  // ------------------------------------------------------------- events
  backBtn.addEventListener("click", () => onExit());
  quizBtn.addEventListener("click", () => (mode === "quiz" ? stopQuiz() : startQuiz()));
  age7.addEventListener("click", () => {
    tier = 0;
    setTierButtons();
    if (mode === "explore" && focus) showInfo(focus);
  });
  age10.addEventListener("click", () => {
    tier = 1;
    setTierButtons();
    if (mode === "explore" && focus) showInfo(focus);
  });
  slider.addEventListener("input", () => (speed = Number(slider.value)));
  controls.addEventListener("start", () => (adjusting = false));

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down: { x: number; y: number; t: number } | null = null;
  const dom = renderer.domElement;
  dom.addEventListener("pointerdown", (e) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  dom.addEventListener("pointerup", (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const dt = performance.now() - down.t;
    down = null;
    if (moved > 9 || dt > 600) return;
    const rect = dom.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(pickables, false)[0];
    if (hit) {
      const b = bodyOf.get(hit.object);
      if (b) onBody(b);
    }
  });

  const resize = (): void => {
    const w = root.clientWidth || window.innerWidth;
    const hh = root.clientHeight || window.innerHeight;
    renderer.setSize(w, hh, false);
    camera.aspect = w / hh;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", resize);
  resize();
  setTierButtons();
  markChips();

  // ------------------------------------------------------------- loop
  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();
  const zero = new THREE.Vector3();
  let raf = 0;

  const frame = (): void => {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const sim = dt * speed;

    sunMesh.rotation.y += dt * 0.05 * Math.max(speed, 0.3);
    sunGlow.position.copy(sunMesh.position);

    for (const p of planets) {
      p.angle += (0.35 / Math.pow(p.data.periodYears, 0.6)) * sim;
      p.group.position.set(Math.cos(p.angle) * p.data.dist, 0, Math.sin(p.angle) * p.data.dist);
      p.mesh.rotation.y += p.data.spin * dt * Math.max(speed, 0.4);
    }
    moonAngle += 1.8 * sim;
    moon.position.set(earth.group.position.x + Math.cos(moonAngle) * 2.3, 0.15, earth.group.position.z + Math.sin(moonAngle) * 2.3);

    // camera follow / zoom to focus
    const target = focus ? focus.group.position : zero;
    const prev = tmp.copy(controls.target);
    controls.target.lerp(target, 1 - Math.pow(0.002, dt));
    camera.position.add(controls.target.clone().sub(prev));
    if (adjusting) {
      const offset = camera.position.clone().sub(controls.target);
      const len = offset.length();
      const next = len + (goalDist - len) * (1 - Math.pow(0.02, dt));
      offset.setLength(next);
      camera.position.copy(controls.target).add(offset);
      if (Math.abs(next - goalDist) < 0.25) adjusting = false;
    }

    if (focus) {
      selRing.visible = true;
      selRing.position.copy(focus.group.position);
      selRing.quaternion.copy(camera.quaternion);
      selRing.scale.setScalar(focus.radius * (focus.id === "saturn" ? 2.6 : 1.35));
    } else {
      selRing.visible = false;
    }

    controls.update();
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);

  // ------------------------------------------------------------- cleanup
  return (): void => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    controls.dispose();
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      const list = Array.isArray(mat) ? mat : mat ? [mat] : [];
      for (const x of list) {
        (x as THREE.MeshBasicMaterial).map?.dispose?.();
        x.dispose();
      }
    });
    renderer.dispose();
    renderer.forceContextLoss();
    root.remove();
  };
}
