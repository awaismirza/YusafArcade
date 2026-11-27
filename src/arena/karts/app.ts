import * as THREE from "three";
import { gameAudio } from "../../audio/sfx";
import { addPadButton, Keys, KEYMAPS, PadButton } from "../kit/controls";
import { mulberry32 } from "../kit/math";
import { startShell } from "../kit/shell";
import { Confetti, disposeScene, gradientTexture, mat } from "../kit/three";
import { addExitButton, el, PLAYER_COLORS, PLAYER_HEX, PLAYER_NAMES, showGameOver, showPicker, toast } from "../kit/ui";
import { aiDrive, AiState, aiTopScale, createRace, driveKart, Kart, LAPS, newAi, placings, Race, stepRace } from "./physics";
import { buildTrack, locate, Track, TrackDef, TRACKS } from "./track";

type Mode = { humans: number; karts: number; level: number };
const THEMES = {
  grass: { sky: ["#7dd3fc", "#e0f2fe"], ground: 0x4d9b3a, fog: 0xcfeefd, deco: 0x15803d },
  desert: { sky: ["#fb923c", "#fde68a"], ground: 0xd9a35b, fog: 0xfcd9a0, deco: 0x4d7c0f },
  snow: { sky: ["#93c5fd", "#f1f5f9"], ground: 0xf1f5f9, fog: 0xe2e8f0, deco: 0x14532d },
};
const ordinal = (n: number): string => ["1st", "2nd", "3rd", "4th"][n] ?? `${n + 1}th`;

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** A flat strip along the track between two sideways offsets (negative = left). */
function ribbon(t: Track, from: number, to: number, y: number, vScale: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= t.n; i++) {
    const k = i % t.n;
    const nx = -t.dz[k];
    const nz = t.dx[k];
    pos.push(t.xs[k] + nx * from, y, t.zs[k] + nz * from, t.xs[k] + nx * to, y, t.zs[k] + nz * to);
    const v = (i / t.n) * (t.length / vScale);
    uv.push(0, v, 1, v);
    if (i < t.n) {
      const a = i * 2;
      // wound so the strip faces up
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function makeKart(color: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.45, 1.25), mat(color, { roughness: 0.3, metalness: 0.2 }));
  body.position.y = 0.5;
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.42, 3), mat(color, { roughness: 0.3 }));
  nose.rotation.z = Math.PI / 2;
  nose.rotation.y = Math.PI / 2;
  nose.scale.set(1, 1, 0.9);
  nose.position.set(1.15, 0.46, 0);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.8), mat(0x1f2937));
  seat.position.set(-0.45, 0.85, 0);
  const skin = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), mat(0xffd7b5));
  skin.position.set(-0.15, 1.25, 0);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.33, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), mat(color, { roughness: 0.2 }));
  helmet.position.set(-0.15, 1.3, 0);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.4), mat(0x111827, { roughness: 0.1 }));
  visor.position.set(0.12, 1.3, 0);
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 1.5), mat(0x111827));
  spoiler.position.set(-1.05, 1.0, 0);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.1), mat(0x111827));
  post.position.set(-1.0, 0.8, 0);
  g.add(body, nose, seat, skin, helmet, visor, spoiler, post);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 16);
  const wheelM = mat(0x111111, { roughness: 0.8 });
  for (const [x, z] of [[0.75, 0.72], [0.75, -0.72], [-0.75, 0.75], [-0.75, -0.75]]) {
    const w = new THREE.Mesh(wheelGeo, wheelM);
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.36, z);
    w.name = "wheel";
    g.add(w);
  }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.25, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  shadow.scale.set(1.3, 0.8, 1);
  g.add(shadow);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.1, 12), mat(0xf97316, { emissive: 0xf97316, emissiveIntensity: 2.5, transparent: true, opacity: 0.9 }));
  flame.rotation.z = Math.PI / 2;
  flame.position.set(-1.6, 0.5, 0);
  flame.name = "flame";
  flame.visible = false;
  g.add(flame);
  return g;
}

export function start(onExit: () => void): () => void {
  const shell = startShell("#0f172a");
  const { root, renderer } = shell;
  renderer.shadowMap.enabled = false; // blob shadows instead: much faster for a big track
  const keys = new Keys();
  shell.addCleanup(() => keys.dispose());

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7280, 1.3));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(40, 80, 30);
  scene.add(sun);
  const world = new THREE.Group();
  scene.add(world);

  let mode: Mode = { humans: 1, karts: 4, level: 1 };
  let def: TrackDef = TRACKS[0];
  let track: Track = buildTrack(def);
  let race: Race = createRace(track, 4);
  let kartMeshes: THREE.Group[] = [];
  let boxMeshes: THREE.Mesh[] = [];
  const bananaMeshes = new Map<object, THREE.Mesh>();
  let ais: AiState[] = [];
  let cams: THREE.PerspectiveCamera[] = [];
  let phase: "pick" | "countdown" | "race" | "done" = "pick";
  let countdown = 0;
  let finishTimer = 0;
  let confetti: Confetti | null = null;
  const rng = mulberry32((Date.now() & 0xffff) + 21);

  // ---------------------------------------------------------------- textures
  const asphalt = canvasTex(64, 128, (g) => {
    g.fillStyle = "#4b5563";
    g.fillRect(0, 0, 64, 128);
    for (let i = 0; i < 300; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? "0,0,0" : "255,255,255"},0.06)`;
      g.fillRect(Math.random() * 64, Math.random() * 128, 2, 2);
    }
    g.fillStyle = "#f8fafc";
    g.fillRect(30, 10, 4, 50);
    g.fillStyle = "#e5e7eb";
    g.fillRect(0, 0, 3, 128);
    g.fillRect(61, 0, 3, 128);
  });
  const curbTex = canvasTex(8, 64, (g) => {
    g.fillStyle = "#ef4444";
    g.fillRect(0, 0, 8, 32);
    g.fillStyle = "#ffffff";
    g.fillRect(0, 32, 8, 32);
  });
  const checker = canvasTex(64, 16, (g) => {
    for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) {
      g.fillStyle = (x + y) % 2 ? "#111827" : "#ffffff";
      g.fillRect(x * 8, y * 8, 8, 8);
    }
  });
  const chevron = canvasTex(64, 64, (g) => {
    g.fillStyle = "#facc15";
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = "#f97316";
    for (const y of [8, 30]) {
      g.beginPath();
      g.moveTo(8, y + 22);
      g.lineTo(32, y);
      g.lineTo(56, y + 22);
      g.lineTo(46, y + 22);
      g.lineTo(32, y + 10);
      g.lineTo(18, y + 22);
      g.fill();
    }
  });
  const questionTex = canvasTex(64, 64, (g) => {
    const grad = g.createLinearGradient(0, 0, 64, 64);
    grad.addColorStop(0, "#f472b6");
    grad.addColorStop(0.5, "#a78bfa");
    grad.addColorStop(1, "#38bdf8");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = "#ffffff";
    g.font = "800 44px Nunito, system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("?", 32, 35);
  });
  shell.addCleanup(() => [asphalt, curbTex, checker, chevron, questionTex].forEach((t) => t.dispose()));

  // ---------------------------------------------------------------- build the world for a track
  const buildWorld = (): void => {
    for (const c of [...world.children]) {
      world.remove(c);
      disposeScene(c);
    }
    const th = THEMES[def.theme];
    if (scene.background instanceof THREE.Texture) scene.background.dispose();
    scene.background = gradientTexture(th.sky[0], th.sky[1]);
    scene.fog = new THREE.Fog(th.fog, 60, 190);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), mat(th.ground, { roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    world.add(ground);
    const w = track.width;
    world.add(new THREE.Mesh(ribbon(track, -w / 2 - 1, -w / 2, 0.03, 3), new THREE.MeshStandardMaterial({ map: curbTex, roughness: 0.7 })));
    world.add(new THREE.Mesh(ribbon(track, w / 2, w / 2 + 1, 0.03, 3), new THREE.MeshStandardMaterial({ map: curbTex, roughness: 0.7 })));
    world.add(new THREE.Mesh(ribbon(track, -w / 2, w / 2, 0.04, 8), new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.85 })));
    // start line
    const line = new THREE.Mesh(new THREE.PlaneGeometry(1.6, w), new THREE.MeshBasicMaterial({ map: checker }));
    line.rotation.x = -Math.PI / 2;
    line.rotation.z = -Math.atan2(track.dz[0], track.dx[0]);
    line.position.set(track.xs[0], 0.06, track.zs[0]);
    world.add(line);
    // arch over the start
    const archM = mat(0xdc2626, { roughness: 0.4 });
    for (const sgn of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6, 0.6), archM);
      post.position.set(track.xs[0] + -track.dz[0] * sgn * (w / 2 + 1.5), 3, track.zs[0] + track.dx[0] * sgn * (w / 2 + 1.5));
      world.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(w + 3.6, 1.2, 0.5), mat(0x111827));
    beam.position.set(track.xs[0], 6, track.zs[0]);
    beam.rotation.y = -Math.atan2(track.dz[0], track.dx[0]) + Math.PI / 2;
    world.add(beam);
    // boost pads
    for (const f of def.boosts) {
      const i = Math.round(f * track.n) % track.n;
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(2.6, track.width * 0.6), new THREE.MeshBasicMaterial({ map: chevron }));
      pad.rotation.x = -Math.PI / 2;
      pad.rotation.z = -Math.atan2(track.dz[i], track.dx[i]) - Math.PI / 2;
      pad.position.set(track.xs[i], 0.07, track.zs[i]);
      world.add(pad);
    }
    // scenery, kept clear of the road
    const n = 160;
    const dummy = new THREE.Object3D();
    const top =
      def.theme === "desert"
        ? new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.6, 3.2, 8), mat(0x4d7c0f), n)
        : new THREE.InstancedMesh(new THREE.ConeGeometry(1.6, 4, 7), mat(th.deco), n);
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 1.2, 6), mat(def.theme === "desert" ? 0xb45309 : 0x7c2d12), n);
    let placed = 0;
    for (let tries = 0; tries < 3000 && placed < n; tries++) {
      const x = (rng() - 0.5) * 220;
      const z = (rng() - 0.5) * 180;
      const loc = locate(track, x, z);
      if (Math.abs(loc.side) < track.width / 2 + 5 || Math.hypot(x - track.xs[loc.i], z - track.zs[loc.i]) < track.width / 2 + 5) continue;
      const s = 0.8 + rng() * 0.8;
      dummy.position.set(x, def.theme === "desert" ? 1.6 * s : 3 * s, z);
      dummy.scale.setScalar(s);
      dummy.rotation.y = rng() * 6;
      dummy.updateMatrix();
      top.setMatrixAt(placed, dummy.matrix);
      dummy.position.y = 0.6 * s;
      dummy.updateMatrix();
      trunk.setMatrixAt(placed, dummy.matrix);
      placed++;
    }
    top.count = trunk.count = placed;
    world.add(top, trunk);
    // mountains far away
    const hillM = mat(def.theme === "snow" ? 0xcbd5e1 : def.theme === "desert" ? 0xc2410c : 0x3f6212, { roughness: 1, flatShading: true });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const hill = new THREE.Mesh(new THREE.ConeGeometry(18 + (i % 3) * 8, 26 + (i % 4) * 9, 6), hillM);
      hill.position.set(Math.cos(a) * 170, 10, Math.sin(a) * 150);
      world.add(hill);
    }
  };

  // ---------------------------------------------------------------- cameras, HUD and controls
  type Hud = { box: HTMLDivElement; lap: HTMLDivElement; pos: HTMLDivElement; item: HTMLDivElement };
  let huds: Hud[] = [];
  let pads: { left: PadButton; right: PadButton; item: PadButton }[] = [];
  const mini = el("canvas", "", "", root) as HTMLCanvasElement;
  Object.assign(mini.style, { position: "absolute", right: "max(10px, env(safe-area-inset-right))", top: "max(10px, env(safe-area-inset-top))", width: "clamp(110px, 22vmin, 190px)", zIndex: "18", pointerEvents: "none", borderRadius: "16px", background: "rgba(20,16,60,0.45)" });
  mini.width = 200;
  mini.height = 150;
  const divider = el("div", "", "", root);
  Object.assign(divider.style, { position: "absolute", left: "50%", top: "0", bottom: "0", width: "4px", marginLeft: "-2px", background: "rgba(255,255,255,0.8)", zIndex: "12", display: "none" });

  const buildUi = (): void => {
    huds.forEach((h) => h.box.remove());
    pads.forEach((p) => [p.left, p.right, p.item].forEach((b) => b.dispose()));
    huds = [];
    pads = [];
    const split = mode.humans === 2;
    divider.style.display = split ? "" : "none";
    mini.style.right = split ? "auto" : "max(10px, env(safe-area-inset-right))";
    mini.style.left = split ? "50%" : "auto";
    mini.style.transform = split ? "translateX(-50%)" : "";
    mini.style.top = split ? "max(10px, env(safe-area-inset-top))" : "max(10px, env(safe-area-inset-top))";
    for (let p = 0; p < mode.humans; p++) {
      const box = el("div", "ar-hud", "", root);
      const leftPct = split ? (p === 0 ? "0%" : "50%") : "0%";
      // Player 1's chips sit right of the Menu button; player 2's at the far right of their half (clear of the minimap).
      if (p === 0) Object.assign(box.style, { left: `calc(${leftPct} + 120px)`, alignItems: "flex-start" });
      else Object.assign(box.style, { right: "12px", alignItems: "flex-end" });
      Object.assign(box.style, { top: "max(10px, env(safe-area-inset-top))", flexDirection: "column" });
      const pos = el("div", "ar-chip", "", box);
      pos.style.fontSize = "clamp(20px,5vmin,40px)";
      pos.style.borderColor = PLAYER_COLORS[p];
      const lap = el("div", "ar-chip", "", box);
      const item = el("div", "ar-chip", "", box);
      huds.push({ box, lap, pos, item });
      if (!shell.desktop) {
        const base = split ? (p === 0 ? 0 : 50) : 0;
        const width = split ? 50 : 100;
        const left = addPadButton(root, { left: `calc(${base}% + 14px)`, bottom: "16px" }, "◀", PLAYER_COLORS[p], 1.05);
        const right = addPadButton(root, { left: `calc(${base}% + 14px + 19vmin)`, bottom: "16px" }, "▶", PLAYER_COLORS[p], 1.05);
        const item2 = addPadButton(root, { left: `calc(${base + width}% - 14px - 19vmin)`, bottom: "16px" }, "🎁", "#7c3aed", 1.05);
        pads.push({ left, right, item: item2 });
      }
    }
  };

  const fitCams = (): void => {
    const { w, h } = shell.size();
    const aspect = mode.humans === 2 ? w / 2 / h : w / h;
    for (const c of cams) {
      c.aspect = aspect;
      c.updateProjectionMatrix();
    }
  };
  shell.onResize(fitCams);

  const drawMini = (): void => {
    const g = mini.getContext("2d")!;
    g.clearRect(0, 0, mini.width, mini.height);
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < track.n; i++) {
      minX = Math.min(minX, track.xs[i]);
      maxX = Math.max(maxX, track.xs[i]);
      minZ = Math.min(minZ, track.zs[i]);
      maxZ = Math.max(maxZ, track.zs[i]);
    }
    const sc = Math.min((mini.width - 24) / (maxX - minX), (mini.height - 24) / (maxZ - minZ));
    const px = (x: number): number => 12 + (x - minX) * sc + ((mini.width - 24) - (maxX - minX) * sc) / 2;
    const pz = (z: number): number => 12 + (z - minZ) * sc + ((mini.height - 24) - (maxZ - minZ) * sc) / 2;
    g.strokeStyle = "rgba(255,255,255,0.9)";
    g.lineWidth = 6;
    g.lineJoin = "round";
    g.beginPath();
    for (let i = 0; i <= track.n; i += 2) {
      const k = i % track.n;
      if (i === 0) g.moveTo(px(track.xs[k]), pz(track.zs[k]));
      else g.lineTo(px(track.xs[k]), pz(track.zs[k]));
    }
    g.closePath();
    g.stroke();
    for (const k of [...race.karts].reverse()) {
      g.fillStyle = PLAYER_COLORS[k.id];
      g.beginPath();
      g.arc(px(k.x), pz(k.z), k.id < mode.humans ? 7 : 5, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#fff";
      g.lineWidth = 2;
      g.stroke();
    }
  };

  // ---------------------------------------------------------------- race flow
  const name = (id: number): string => (id < mode.humans ? PLAYER_NAMES[id] : `${PLAYER_NAMES[id]} 🤖`);

  const setupRace = (): void => {
    track = buildTrack(def);
    buildWorld();
    race = createRace(track, mode.karts);
    kartMeshes.forEach((m) => {
      scene.remove(m);
      disposeScene(m);
    });
    kartMeshes = race.karts.map((k) => {
      const m = makeKart(PLAYER_HEX[k.id]);
      scene.add(m);
      return m;
    });
    boxMeshes = race.boxes.map((b) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), new THREE.MeshStandardMaterial({ map: questionTex, transparent: true, opacity: 0.92, emissive: 0x6d28d9, emissiveIntensity: 0.25 }));
      m.position.set(b.x, 1.1, b.z);
      world.add(m);
      return m;
    });
    for (const m of bananaMeshes.values()) world.remove(m);
    bananaMeshes.clear();
    ais = race.karts.map((k) => newAi(k.id));
    cams = Array.from({ length: mode.humans }, () => new THREE.PerspectiveCamera(62, 1, 0.1, 400));
    fitCams();
    cams.forEach((c, i) => placeCam(c, race.karts[i], 1));
    buildUi();
    phase = "countdown";
    countdown = 3.2;
    finishTimer = 0;
    confetti?.dispose();
    confetti = null;
    toast(root, "3", 600);
    window.setTimeout(() => phase === "countdown" && toast(root, "2", 600), 1000);
    window.setTimeout(() => phase === "countdown" && toast(root, "1", 600), 2000);
  };

  const placeCam = (c: THREE.PerspectiveCamera, k: Kart, lerpF: number): void => {
    const dx = Math.cos(k.h);
    const dz = Math.sin(k.h);
    const want = new THREE.Vector3(k.x - dx * 7.5, 3.4, k.z - dz * 7.5);
    c.position.lerp(want, lerpF);
    c.lookAt(k.x + dx * 4, 1.1, k.z + dz * 4);
    const fov = k.boost > 0 ? 72 : 62;
    if (Math.abs(c.fov - fov) > 0.1) {
      c.fov += (fov - c.fov) * Math.min(1, lerpF * 2);
      c.updateProjectionMatrix();
    }
  };

  const results = (): void => {
    phase = "done";
    gameAudio.stopMusic();
    const order = placings(race);
    const winner = order[0];
    confetti = new Confetti(scene, new THREE.Vector3(race.karts[winner].x, 0, race.karts[winner].z), 8);
    const humanBest = order.find((id) => id < mode.humans);
    const title =
      mode.humans === 2
        ? winner < 2
          ? `${PLAYER_NAMES[winner]} wins! 🏆`
          : `${PLAYER_NAMES[order.find((id) => id < 2) ?? 0]} beat the other player!`
        : humanBest === winner
          ? "You won the race! 🏆"
          : `You came ${ordinal(order.indexOf(0))}!`;
    showGameOver(root, {
      title,
      detail: order.map((id, i) => `${ordinal(i)} ${name(id)}${race.karts[id].finished !== null ? ` ${race.karts[id].finished!.toFixed(1)}s` : ""}`).join("\n"),
      onAgain: () => {
        gameAudio.startMusic();
        setupRace();
      },
      onMenu: onExit,
    });
  };

  const choose = async (): Promise<void> => {
    phase = "pick";
    mode = await showPicker<Mode>(root, {
      title: "Turbo Karts 🏎️",
      subtitle: shell.desktop
        ? "3 laps! Hit the yellow arrows to boost and grab 🎁 boxes for rockets and bananas.\nRed: A D steer, S brake, Space item · Blue: ← → steer, ↓ brake, Enter item"
        : "3 laps! Your kart drives itself forward: steer with ◀ ▶ and tap 🎁 to use an item.\nHit the yellow arrows to boost!",
      options: [
        { label: "🌱 1 Player", sub: "vs 3 computers · Easy", color: "#16a34a", value: { humans: 1, karts: 4, level: 0 } },
        { label: "🔥 1 Player", sub: "vs 3 computers · Fast", color: "#dc2626", value: { humans: 1, karts: 4, level: 2 } },
        { label: "👫 2 Players", sub: "split screen + 2 computers", color: "#0369a1", value: { humans: 2, karts: 4, level: 0 } },
        { label: "👫 2 Players", sub: "split screen, just you two", color: "#7c3aed", value: { humans: 2, karts: 2, level: 0 } },
      ],
    });
    def = await showPicker<TrackDef>(root, {
      title: "Pick a track",
      options: TRACKS.map((t, i) => ({ label: ["🌳", "🌵", "❄️"][i] + " " + t.name, color: ["#16a34a", "#ea580c", "#0284c7"][i], value: t })),
    });
    gameAudio.unlock();
    gameAudio.startMusic();
    setupRace();
  };

  // ---------------------------------------------------------------- loop
  const humanInput = (p: number): { steer: number; gas: number; useItem: boolean } => {
    const m = KEYMAPS[p];
    const pad = pads[p];
    const steer = (keys.down(m.right) || pad?.right.held() ? 1 : 0) - (keys.down(m.left) || pad?.left.held() ? 1 : 0);
    const gas = keys.down(m.down) ? -1 : 1;
    const useItem = keys.pressed(m.act) || (pad?.item.pressed() ?? false);
    return { steer, gas, useItem };
  };

  shell.onFrame((dt, t) => {
    if (phase === "countdown") {
      countdown -= dt;
      if (countdown <= 0) {
        phase = "race";
        race.started = true;
        toast(root, "GO!", 600, "#facc15");
      }
    }
    if (phase === "race" || phase === "done") {
      const humans = Array.from({ length: mode.humans }, (_, i) => i);
      for (const k of race.karts) {
        const inp = k.id < mode.humans ? humanInput(k.id) : aiDrive(race, k.id, ais[k.id], dt, rng);
        const scale = k.id < mode.humans ? 1 : aiTopScale(race, k.id, humans, mode.level);
        for (const e of driveKart(race, k.id, inp, dt, scale)) {
          if (k.id >= mode.humans) continue;
          if (e.type === "boost") gameAudio.jump();
          else if (e.type === "item") gameAudio.coin();
          else if (e.type === "spin") gameAudio.hit();
          else if (e.type === "lap") toast(root, k.id === 0 || mode.humans === 1 ? `Lap ${race.karts[k.id].lap}/${LAPS}` : `${PLAYER_NAMES[k.id]}: lap ${race.karts[k.id].lap}`, 800, PLAYER_COLORS[k.id]);
          else if (e.type === "finish") toast(root, `${PLAYER_NAMES[k.id]} finished ${ordinal(placings(race).indexOf(k.id))}!`, 1200, PLAYER_COLORS[k.id]);
        }
      }
      stepRace(race, dt);
      if (phase === "race") {
        const humansDone = race.karts.slice(0, mode.humans).every((k) => k.finished !== null);
        if (humansDone) {
          finishTimer += dt;
          if (finishTimer > 2.5) results();
        }
      }
    }

    // meshes
    race.karts.forEach((k, i) => {
      const m = kartMeshes[i];
      if (!m) return;
      m.position.set(k.x, 0, k.z);
      m.rotation.y = -k.h;
      m.children.forEach((c) => {
        if (c.name === "wheel") c.rotation.y += k.speed * dt * 2.5;
        if (c.name === "flame") {
          c.visible = k.boost > 0;
          c.scale.setScalar(0.8 + Math.random() * 0.5);
        }
      });
      m.position.y = Math.abs(k.side) > track.width / 2 ? Math.abs(Math.sin(t * 25)) * 0.06 : 0;
    });
    race.boxes.forEach((b, i) => {
      const m = boxMeshes[i];
      if (!m) return;
      m.visible = b.respawn <= 0;
      m.rotation.y = t * 1.5 + i;
      m.rotation.x = t * 0.7;
      m.position.y = 1.1 + Math.sin(t * 2 + i) * 0.2;
    });
    const live = new Set<object>(race.bananas.filter((b) => b.age < 900));
    for (const [b, m] of bananaMeshes) if (!live.has(b)) {
      world.remove(m);
      m.geometry.dispose();
      bananaMeshes.delete(b);
    }
    for (const b of live) {
      if (bananaMeshes.has(b)) continue;
      const bb = b as Race["bananas"][number];
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.14, 8, 16, Math.PI * 1.2), mat(0xfacc15, { roughness: 0.4 }));
      m.position.set(bb.x, 0.35, bb.z);
      m.rotation.set(Math.PI / 2, 0, 0.4);
      world.add(m);
      bananaMeshes.set(b, m);
    }

    // HUD
    const order = placings(race);
    huds.forEach((h, p) => {
      const k = race.karts[p];
      h.pos.innerHTML = `${ordinal(order.indexOf(p))}`;
      h.lap.innerHTML = k.finished !== null ? "🏁 Finished!" : `Lap ${Math.max(1, Math.min(LAPS, k.lap))}/${LAPS}`;
      h.item.innerHTML = k.item === "rocket" ? "🚀 Rocket" : k.item === "banana" ? "🍌 Banana" : "🎁 —";
    });
    drawMini();

    // render each player's view
    const { w, h } = shell.size();
    cams.forEach((c, i) => placeCam(c, race.karts[i], 1 - Math.exp(-dt * 7)));
    if (cams.length === 2) {
      renderer.setScissorTest(true);
      for (let i = 0; i < 2; i++) {
        renderer.setViewport(i * (w / 2), 0, w / 2, h);
        renderer.setScissor(i * (w / 2), 0, w / 2, h);
        renderer.render(scene, cams[i]);
      }
      renderer.setScissorTest(false);
    } else if (cams.length === 1) {
      renderer.setViewport(0, 0, w, h);
      renderer.render(scene, cams[0]);
    } else {
      // picker on screen: show a slow fly-over of the track
      const c = flyCam;
      c.aspect = w / h;
      c.updateProjectionMatrix();
      c.position.set(Math.cos(t * 0.15) * 120, 70, Math.sin(t * 0.15) * 100);
      c.lookAt(0, 0, 0);
      renderer.setViewport(0, 0, w, h);
      renderer.render(scene, c);
    }
    confetti?.update(dt);
  });
  const flyCam = new THREE.PerspectiveCamera(50, 1, 0.1, 600);

  addExitButton(root, onExit);
  buildWorld();
  void choose();

  return () => {
    gameAudio.stopMusic();
    pads.forEach((p) => [p.left, p.right, p.item].forEach((b) => b.dispose()));
    confetti?.dispose();
    disposeScene(scene);
    shell.dispose();
  };
}
