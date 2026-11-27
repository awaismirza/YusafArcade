import * as THREE from "three";
import { gameAudio } from "../../audio/sfx";
import { Keys } from "../kit/controls";
import { mulberry32 } from "../kit/math";
import { startShell } from "../kit/shell";
import { addLights, Confetti, disposeScene, gradientTexture, mat, shadowed } from "../kit/three";
import { addExitButton, el, hud, PLAYER_COLORS, PLAYER_HEX, PLAYER_NAMES, showGameOver, showPicker, toast } from "../kit/ui";
import { Hole, HOLES, holeSize, holeWalls } from "./course";
import { Ball, BALL_R, CUP_R, moverPose, planShot, shotVelocity, stepBall } from "./physics";

const MAX_STROKES = 8;
type Mode = { players: number; computer: boolean };
type Golfer = { name: string; color: string; hex: number; cpu: boolean; strokes: number[] };

export function start(onExit: () => void): () => void {
  const shell = startShell("#0c3b1e");
  const { root, renderer } = shell;
  const keys = new Keys();
  shell.addCleanup(() => keys.dispose());

  const scene = new THREE.Scene();
  scene.background = gradientTexture("#93c5fd", "#bbf7d0");
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  const sun = addLights(scene, { shadowSize: 10, hemiGround: 0x4d7c0f });

  // A big lawn under every hole.
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), mat(0x65a30d, { roughness: 1 }));
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.y = -0.3;
  lawn.receiveShadow = true;
  scene.add(lawn);

  // ---------------------------------------------------------------- hole <-> world mapping
  let hole: Hole = HOLES[0];
  let tall = true;
  let size = holeSize(hole);
  /** World position of a hole point. Tall holes are turned on their side so they fill a landscape screen. */
  const toWorld = (x: number, y: number, h = 0): THREE.Vector3 =>
    tall ? new THREE.Vector3(size.h / 2 - y, h, x - size.w / 2) : new THREE.Vector3(x - size.w / 2, h, y - size.h / 2);
  const fromWorld = (v: THREE.Vector3): { x: number; y: number } => (tall ? { x: v.z + size.w / 2, y: size.h / 2 - v.x } : { x: v.x + size.w / 2, y: v.z + size.h / 2 });
  /** Rotation (around world y) that matches the mapping, for meshes laid out in hole space. */
  const holeGroup = new THREE.Group();
  scene.add(holeGroup);
  const moverMeshes: { mover: Hole["movers"][number]; obj: THREE.Object3D }[] = [];
  let flag: THREE.Mesh | null = null;

  const box = (x: number, y: number, w: number, h: number, height: number, m: THREE.Material, y0 = 0): THREE.Mesh => {
    const ww = tall ? h : w;
    const dd = tall ? w : h;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(ww, height, dd), m);
    mesh.position.copy(toWorld(x + w / 2, y + h / 2, y0 + height / 2));
    return mesh;
  };

  const buildHole = (): void => {
    for (const c of [...holeGroup.children]) {
      holeGroup.remove(c);
      disposeScene(c);
    }
    moverMeshes.length = 0;
    size = holeSize(hole);
    tall = size.h > size.w;
    const fairM = mat(0x22c55e, { roughness: 0.85 });
    for (const r of hole.fairway) holeGroup.add(shadowed(box(r.x, r.y, r.w, r.h, 0.12, fairM, -0.12), false, true));
    const slopeM = mat(0x16a34a, { roughness: 0.85 });
    for (const s of hole.slopes) {
      holeGroup.add(shadowed(box(s.x, s.y, s.w, s.h, 0.02, slopeM, 0), false, true));
      // arrows show which way the hill pushes the ball
      const ang = Math.atan2(s.ay, s.ax);
      for (let i = 0; i < 3; i++) {
        const a = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 3), mat(0xbbf7d0, { roughness: 0.6 }));
        const px = s.x + s.w * (0.25 + 0.25 * i);
        const py = s.y + s.h / 2;
        a.position.copy(toWorld(px, py, 0.05));
        const d = toWorld(px + Math.cos(ang), py + Math.sin(ang), 0.05).sub(a.position).normalize();
        a.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
        holeGroup.add(a);
      }
    }
    const sandM = mat(0xf5deb3, { roughness: 1 });
    for (const s of hole.sand) holeGroup.add(shadowed(box(s.x, s.y, s.w, s.h, 0.02, sandM, 0), false, true));
    const waterM = mat(0x38bdf8, { roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.85, emissive: 0x0369a1, emissiveIntensity: 0.3 });
    for (const s of hole.water) holeGroup.add(box(s.x, s.y, s.w, s.h, 0.03, waterM, 0.002));
    const wallM = mat(0xb45309, { roughness: 0.6 });
    for (const w of holeWalls(hole)) holeGroup.add(shadowed(box(w.x, w.y, w.w, w.h, 0.32, wallM, -0.1)));
    for (const b of hole.bumpers) {
      const g = new THREE.Group();
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(b.r, b.r, 0.35, 28), mat(0xef4444, { roughness: 0.35 }));
      cyl.position.y = 0.17;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(b.r * 0.8, 0.05, 8, 28), mat(0xffffff));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.36;
      g.add(cyl, ring);
      g.position.copy(toWorld(b.x, b.y));
      holeGroup.add(shadowed(g));
    }
    for (const m of hole.movers) {
      const g = new THREE.Group();
      if (m.kind === "spin") {
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.6, 16), mat(0xf8fafc));
        hub.position.y = 0.3;
        g.add(hub);
        const bladeM = mat(0x7c3aed, { roughness: 0.4 });
        const b1 = new THREE.Mesh(new THREE.BoxGeometry(m.len * 2, 0.3, m.width), bladeM);
        const b2 = new THREE.Mesh(new THREE.BoxGeometry(m.width, 0.3, m.len * 2), bladeM);
        b1.position.y = b2.position.y = 0.15;
        g.add(b1, b2);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.5, 4), mat(0xdc2626));
        roof.position.y = 0.85;
        g.add(roof);
      } else {
        const ww = tall ? m.h : m.w;
        const dd = tall ? m.w : m.h;
        const blk = new THREE.Mesh(new THREE.BoxGeometry(ww, 0.4, dd), mat(0x2563eb, { roughness: 0.4 }));
        blk.position.y = 0.2;
        g.add(blk);
      }
      holeGroup.add(shadowed(g));
      moverMeshes.push({ mover: m, obj: g });
    }
    // cup, flag and tee
    const cup = new THREE.Mesh(new THREE.CircleGeometry(CUP_R * 1.15, 28), new THREE.MeshBasicMaterial({ color: 0x0a0a0a }));
    cup.rotation.x = -Math.PI / 2;
    cup.position.copy(toWorld(hole.cup.x, hole.cup.y, 0.003));
    holeGroup.add(cup);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 8), mat(0xf8fafc));
    pole.position.copy(toWorld(hole.cup.x, hole.cup.y, 0.8));
    holeGroup.add(shadowed(pole));
    flag = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.34, 6, 1), new THREE.MeshStandardMaterial({ color: 0xfacc15, side: THREE.DoubleSide, roughness: 0.6 }));
    flag.position.copy(toWorld(hole.cup.x, hole.cup.y, 1.43)).add(new THREE.Vector3(0.28, 0, 0));
    holeGroup.add(shadowed(flag));
    const tee = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.28, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
    tee.rotation.x = -Math.PI / 2;
    tee.position.copy(toWorld(hole.tee.x, hole.tee.y, 0.004));
    holeGroup.add(tee);
    // Low-poly trees around the hole.
    const trunkM = mat(0x92400e);
    const leafM = [mat(0x15803d), mat(0x166534), mat(0x4d7c0f)];
    const half = new THREE.Vector2((tall ? size.h : size.w) / 2, (tall ? size.w : size.h) / 2);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const r = 2.4 + ((i * 37) % 7) * 0.4;
      const x = Math.cos(a) * (half.x + r);
      const z = Math.sin(a) * (half.y + r);
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.5, 6), trunkM);
      trunk.position.y = 0.25;
      const top = new THREE.Mesh(new THREE.ConeGeometry(0.45 + (i % 3) * 0.12, 1.1 + (i % 4) * 0.2, 7), leafM[i % 3]);
      top.position.y = 0.95;
      tree.add(trunk, top);
      tree.position.set(x, -0.3, z);
      tree.scale.setScalar(0.7);
      holeGroup.add(shadowed(tree));
    }
    sun.shadow.camera.left = sun.shadow.camera.bottom = -Math.max(size.w, size.h);
    sun.shadow.camera.right = sun.shadow.camera.top = Math.max(size.w, size.h);
    sun.shadow.camera.updateProjectionMatrix();
    fitCamera();
  };

  const fitCamera = (): void => {
    const { w, h } = shell.size();
    camera.aspect = w / h;
    const sx = (tall ? size.h : size.w) + 2;
    const sz = (tall ? size.w : size.h) + 3.2;
    const vFov = (camera.fov * Math.PI) / 180;
    const d = Math.max(sz / 2 / Math.tan(vFov / 2), sx / 2 / (Math.tan(vFov / 2) * camera.aspect)) * 1.05;
    const elev = (60 * Math.PI) / 180;
    camera.position.set(0, Math.sin(elev) * d, Math.cos(elev) * d - 0.5);
    camera.lookAt(0, 0, -0.5);
    camera.updateProjectionMatrix();
  };
  shell.onResize(fitCamera);

  // ---------------------------------------------------------------- ball and aim arrow
  const ballMesh = shadowed(new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 24, 16), mat(0xffffff, { roughness: 0.25 })));
  scene.add(ballMesh);
  const ring = new THREE.Mesh(new THREE.RingGeometry(BALL_R * 1.6, BALL_R * 2.1, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
  ring.rotation.x = -Math.PI / 2;
  scene.add(ring);
  const arrow = new THREE.Group();
  const shaftM = new THREE.MeshBasicMaterial({ color: 0x22c55e });
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 0.09), shaftM);
  shaft.position.x = 0.5;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 12), shaftM);
  head.rotation.z = -Math.PI / 2;
  arrow.add(shaft, head);
  scene.add(arrow);
  const dots: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
    scene.add(d);
    dots.push(d);
  }

  // ---------------------------------------------------------------- game state
  let mode: Mode = { players: 1, computer: false };
  let golfers: Golfer[] = [];
  let holeIndex = 0;
  let turn = 0;
  let stroke = 0;
  let phase: "pick" | "aim" | "rolling" | "between" | "over" = "pick";
  const ball: Ball = { x: 0, y: 0, vx: 0, vy: 0 };
  let lastSpot = { x: 0, y: 0 };
  let aimAngle = 0;
  let aimPower = 0.4;
  let holeTime = 0;
  let cpuWait = 0;
  let confetti: Confetti | null = null;
  const rng = mulberry32((Date.now() & 0xffff) + 11);
  const info = hud(root, { left: "50%", top: "max(10px, env(safe-area-inset-top))" }, true);
  const tip = el("div", "ar-chip", "", root);
  Object.assign(tip.style, { position: "absolute", left: "50%", bottom: "max(12px, env(safe-area-inset-bottom))", transform: "translateX(-50%)", zIndex: "20", pointerEvents: "none" });

  const golfer = (): Golfer => golfers[turn];
  const total = (g: Golfer): number => g.strokes.reduce((a, b) => a + b, 0);
  const renderInfo = (): void => {
    info.set("hole", `⛳ Hole ${holeIndex + 1}/9 · ${hole.name} · Par ${hole.par}`);
    const g = golfer();
    if (g) info.set("who", `<span style="color:${g.color}">●</span> ${g.name}'s turn · Stroke ${stroke + 1}`, g.color);
    tip.innerHTML = g?.cpu
      ? "The computer is lining up its shot…"
      : shell.desktop
        ? "Drag back from anywhere to aim, let go to putt · or ← → aim, ↑ ↓ power, Space to putt"
        : "Drag back like a slingshot, let go to putt";
  };

  const placeBall = (x: number, y: number): void => {
    ball.x = x;
    ball.y = y;
    ball.vx = ball.vy = 0;
    lastSpot = { x, y };
    aimAngle = Math.atan2(hole.cup.y - y, hole.cup.x - x);
    aimPower = 0.4;
  };

  const startTurn = (): void => {
    stroke = 0;
    placeBall(hole.tee.x, hole.tee.y);
    phase = "aim";
    cpuWait = 1.1;
    renderInfo();
    toast(root, `${golfer().name}'s turn`, 700, golfer().color);
  };

  const startHole = (i: number): void => {
    holeIndex = i;
    hole = HOLES[i];
    holeTime = 0;
    buildHole();
    turn = 0;
    startTurn();
  };

  const shoot = (angle: number, power: number): void => {
    if (phase !== "aim" || power < 0.05) return;
    const v = shotVelocity(angle, power);
    lastSpot = { x: ball.x, y: ball.y };
    ball.vx = v.vx;
    ball.vy = v.vy;
    stroke += 1;
    phase = "rolling";
    gameAudio.jump();
    renderInfo();
  };

  const scorecard = (onNext: () => void, last: boolean): void => {
    const scrim = el("div", "ar-scrim", "", root);
    const rows = golfers
      .map((g) => `<tr><td style="color:${g.color};text-align:left;padding-right:10px">● ${g.name}</td>${HOLES.map((_, i) => `<td>${g.strokes[i] ?? ""}</td>`).join("")}<td><b>${total(g)}</b></td></tr>`)
      .join("");
    const par = `<tr style="opacity:.7"><td style="text-align:left">Par</td>${HOLES.map((h) => `<td>${h.par}</td>`).join("")}<td>${HOLES.reduce((a, h) => a + h.par, 0)}</td></tr>`;
    const card = el(
      "div",
      "ar-card",
      `<h2>${last ? "Final scores" : `After hole ${holeIndex + 1}`}</h2>
       <div style="overflow-x:auto"><table style="border-collapse:collapse;margin:0 auto 12px;font-weight:800;font-size:clamp(13px,2.6vmin,18px)">
       <tr style="opacity:.7"><td></td>${HOLES.map((_, i) => `<td style="padding:2px 6px">${i + 1}</td>`).join("")}<td>Total</td></tr>${par}${rows}</table></div>`,
      scrim
    );
    const b = el("button", "ar-btn", last ? "See the winner ▶" : "Next hole ▶", card);
    b.style.background = "#16a34a";
    b.addEventListener("click", () => {
      scrim.remove();
      onNext();
    });
  };

  const finishTurn = (): void => {
    golfer().strokes[holeIndex] = stroke;
    if (turn < golfers.length - 1) {
      turn += 1;
      window.setTimeout(startTurn, 900);
      return;
    }
    phase = "between";
    const last = holeIndex === HOLES.length - 1;
    window.setTimeout(
      () =>
        scorecard(() => {
          if (!last) startHole(holeIndex + 1);
          else gameOver();
        }, last),
      900
    );
  };

  const gameOver = (): void => {
    phase = "over";
    gameAudio.stopMusic();
    const ranked = [...golfers].sort((a, b) => total(a) - total(b));
    const best = ranked[0];
    const parTotal = HOLES.reduce((a, h) => a + h.par, 0);
    confetti = new Confetti(scene, new THREE.Vector3(0, 0, 0), 9);
    showGameOver(root, {
      title: golfers.length === 1 ? `You finished in ${total(best)}! 🎉` : best.cpu ? "The computer wins this time" : `${best.name} wins! 🎉`,
      detail: ranked.map((g, i) => `${i + 1}. ${g.name} ${total(g)}`).join("  ·  ") + `  (par ${parTotal})`,
      onAgain: () => {
        gameAudio.startMusic();
        beginMatch();
      },
      onMenu: onExit,
    });
  };

  const beginMatch = (): void => {
    confetti?.dispose();
    confetti = null;
    golfers = [];
    for (let p = 0; p < mode.players; p++) golfers.push({ name: PLAYER_NAMES[p], color: PLAYER_COLORS[p], hex: PLAYER_HEX[p], cpu: false, strokes: [] });
    if (mode.computer) golfers.push({ name: "Computer", color: PLAYER_COLORS[1], hex: PLAYER_HEX[1], cpu: true, strokes: [] });
    // Testing aid: ?golfHole=4 starts on hole 4.
    const jump = Number(new URLSearchParams(window.location.search).get("golfHole"));
    startHole(jump >= 1 && jump <= HOLES.length ? jump - 1 : 0);
  };

  const choose = async (): Promise<void> => {
    phase = "pick";
    mode = await showPicker<Mode>(root, {
      title: "Mini Golf World ⛳",
      subtitle: "9 crazy holes: windmills, hills, bumpers and water!\nDrag back to aim, let go to putt. Fewest strokes wins.",
      options: [
        { label: "🏌️ Practice", sub: "1 player", color: "#16a34a", value: { players: 1, computer: false } },
        { label: "🤖 vs Computer", sub: "1 player", color: "#7c3aed", value: { players: 1, computer: true } },
        { label: "👫 2 Players", sub: "pass the device", color: "#0369a1", value: { players: 2, computer: false } },
        { label: "👨‍👩‍👦 3 Players", sub: "pass the device", color: "#ea580c", value: { players: 3, computer: false } },
        { label: "👨‍👩‍👧‍👦 4 Players", sub: "pass the device", color: "#db2777", value: { players: 4, computer: false } },
      ],
    });
    gameAudio.unlock();
    gameAudio.startMusic();
    beginMatch();
  };

  // ---------------------------------------------------------------- drag to aim
  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ground = (cx: number, cy: number): THREE.Vector3 | null => {
    const r = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera);
    const v = new THREE.Vector3();
    return raycaster.ray.intersectPlane(plane, v) ? v : null;
  };
  let drag: { id: number; sx: number; sy: number; start: THREE.Vector3 } | null = null;
  const canvas = renderer.domElement;
  const human = (): boolean => phase === "aim" && !!golfer() && !golfer().cpu;
  const onDown = (e: PointerEvent): void => {
    gameAudio.unlock();
    if (!human() || drag) return;
    const g = ground(e.clientX, e.clientY);
    if (!g) return;
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, start: g };
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };
  const onMove = (e: PointerEvent): void => {
    if (!drag || e.pointerId !== drag.id) return;
    const g = ground(e.clientX, e.clientY);
    if (!g) return;
    const a = fromWorld(drag.start);
    const b = fromWorld(g);
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const { w, h } = shell.size();
    const px = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy);
    if (Math.hypot(dx, dy) > 0.05) aimAngle = Math.atan2(dy, dx);
    aimPower = Math.min(1, px / (0.38 * Math.min(w, h)));
  };
  const onUp = (e: PointerEvent): void => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    if (aimPower >= 0.06) shoot(aimAngle, aimPower);
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", () => (drag = null));
  shell.addCleanup(() => {
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
  });

  // ---------------------------------------------------------------- loop
  shell.onFrame((dt) => {
    holeTime += dt;
    for (const { mover, obj } of moverMeshes) {
      const p = moverPose(mover, holeTime);
      obj.position.copy(toWorld(p.x, p.y));
      // A turn of +a in hole space is a turn of -a around the world's up axis (for both layouts).
      obj.rotation.y = -p.angle;
    }
    if (flag) {
      const pos = flag.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        pos.setZ(i, Math.sin(holeTime * 5 + x * 6) * 0.05 * (x + 0.28));
      }
      pos.needsUpdate = true;
    }

    if (phase === "aim" && golfer()) {
      if (golfer().cpu) {
        cpuWait -= dt;
        if (cpuWait <= 0) {
          const p = planShot(hole, ball, holeTime, rng, 60);
          aimAngle = p.angle + (rng() - 0.5) * 0.12;
          aimPower = Math.min(1, p.power * (0.92 + rng() * 0.16));
          shoot(aimAngle, aimPower);
        }
      } else {
        if (keys.down("ArrowLeft")) aimAngle -= dt * 1.6;
        if (keys.down("ArrowRight")) aimAngle += dt * 1.6;
        if (keys.down("ArrowUp")) aimPower = Math.min(1, aimPower + dt * 0.6);
        if (keys.down("ArrowDown")) aimPower = Math.max(0.05, aimPower - dt * 0.6);
        if (keys.pressed("Space") || keys.pressed("Enter")) shoot(aimAngle, aimPower);
      }
    }

    if (phase === "rolling") {
      const steps = 2;
      for (let s = 0; s < steps && phase === "rolling"; s++) {
        const st = stepBall(ball, hole, holeTime, dt / steps);
        if (st === "sunk") {
          gameAudio.coin();
          const rel = stroke - hole.par;
          const word = stroke === 1 ? "Hole in one! 🌟" : rel <= -2 ? "Eagle! 🦅" : rel === -1 ? "Birdie! 🐦" : rel === 0 ? "Par 👍" : `${stroke} strokes`;
          toast(root, word, 1000, "#facc15");
          if (stroke === 1 || rel < 0) {
            confetti?.dispose();
            confetti = new Confetti(scene, toWorld(hole.cup.x, hole.cup.y), 3, 50);
          }
          phase = "between";
          finishTurn();
        } else if (st === "water") {
          gameAudio.hit();
          toast(root, "Splash! +1", 800, "#38bdf8");
          stroke += 1;
          placeBall(lastSpot.x, lastSpot.y);
          phase = stroke >= MAX_STROKES ? "between" : "aim";
          cpuWait = 1;
          if (phase === "between") finishTurn();
          renderInfo();
        } else if (st === "stopped") {
          if (stroke >= MAX_STROKES) {
            toast(root, "Picked up", 700);
            phase = "between";
            finishTurn();
          } else {
            placeBall(ball.x, ball.y);
            phase = "aim";
            cpuWait = 0.9;
            renderInfo();
          }
        }
      }
    }

    // draw ball, aim arrow and the dotted line
    const visible = phase !== "pick" && phase !== "over";
    ballMesh.visible = ring.visible = visible;
    ballMesh.position.copy(toWorld(ball.x, ball.y, BALL_R));
    ring.position.copy(toWorld(ball.x, ball.y, 0.006));
    if (golfer()) (ring.material as THREE.MeshBasicMaterial).color.setHex(golfer().hex);
    const showAim = phase === "aim" && !!golfer();
    arrow.visible = showAim;
    dots.forEach((d) => (d.visible = showAim));
    if (showAim) {
      const len = 0.4 + aimPower * 2.4;
      const p0 = toWorld(ball.x, ball.y, 0.12);
      const p1 = toWorld(ball.x + Math.cos(aimAngle), ball.y + Math.sin(aimAngle), 0.12);
      const dir = p1.sub(p0).normalize();
      arrow.position.copy(p0);
      arrow.rotation.set(0, Math.atan2(-dir.z, dir.x), 0);
      shaft.scale.x = len;
      shaft.position.x = len / 2;
      head.position.x = len + 0.15;
      shaftM.color.setHSL(0.33 - aimPower * 0.33, 0.85, 0.5);
      dots.forEach((d, i) => d.position.copy(p0).addScaledVector(dir, len + 0.5 + i * 0.35 * (0.5 + aimPower)));
    }
    confetti?.update(dt);
    renderer.render(scene, camera);
  });

  addExitButton(root, onExit);
  buildHole();
  void choose();

  return () => {
    gameAudio.stopMusic();
    confetti?.dispose();
    disposeScene(scene);
    shell.dispose();
  };
}
