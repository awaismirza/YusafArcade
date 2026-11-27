import * as THREE from "three";
import { gameAudio } from "../../audio/sfx";
import { Keys, keyVec } from "../kit/controls";
import { startShell } from "../kit/shell";
import { addLights, Confetti, disposeScene, gradientTexture, mat, shadowed } from "../kit/three";
import { addExitButton, el, hud, PLAYER_COLORS, PLAYER_HEX, PLAYER_NAMES, showGameOver, showPicker, toast } from "../kit/ui";
import { aiMove, clampPaddle, newPuck, Paddle, PADDLE_R, PUCK_R, stepPuck, TABLE } from "./physics";

const WIN = 7;
type Mode = { ai: number | null }; // ai level 0..2, or null for 2 players

/**
 * World layout: table y (its length) runs along world X so it fills a landscape screen, table x runs along world Z.
 * Player 0 (Red) defends the right end, player 1 (Blue, or the computer) the left end.
 */
const toWorld = (x: number, y: number): THREE.Vector3 => new THREE.Vector3(y, 0, x);

export function start(onExit: () => void): () => void {
  const shell = startShell("#0a0f2c");
  const { root, renderer } = shell;
  const keys = new Keys();
  shell.addCleanup(() => keys.dispose());

  const scene = new THREE.Scene();
  scene.background = gradientTexture("#1b1446", "#05060f");
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  addLights(scene, { shadowSize: 8 });

  // ---------------------------------------------------------------- table
  const L = TABLE.h;
  const W = TABLE.w;
  const table = new THREE.Group();
  const surface = new THREE.Mesh(new THREE.BoxGeometry(L, 0.3, W), mat(0x10163a, { roughness: 0.25, metalness: 0.2 }));
  surface.position.y = -0.15;
  table.add(surface);
  const legBase = new THREE.Mesh(new THREE.BoxGeometry(L + 1.2, 0.5, W + 1.2), mat(0x1e1b4b, { roughness: 0.6 }));
  legBase.position.y = -0.55;
  table.add(legBase);

  const glow = (color: number): THREE.MeshStandardMaterial => mat(color, { emissive: color, emissiveIntensity: 1.4, roughness: 0.3 });
  // rails: long sides and short ends with a gap for the goals
  const railH = 0.32;
  const railT = 0.25;
  for (const s of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(L + railT * 2, railH, railT), glow(0x7c3aed));
    r.position.set(0, railH / 2, s * (W / 2 + railT / 2));
    table.add(r);
    const seg = (W - TABLE.goalW) / 2;
    for (const t of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(railT, railH, seg), glow(s > 0 ? 0xef4444 : 0x3b82f6));
      e.position.set(s * (L / 2 + railT / 2), railH / 2, t * (TABLE.goalW / 2 + seg / 2));
      table.add(e);
    }
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, TABLE.goalW), new THREE.MeshBasicMaterial({ color: 0x020205 }));
    mouth.position.set(s * (L / 2 + 0.3), 0.01, 0);
    table.add(mouth);
  }
  // markings
  const lineMat = new THREE.MeshBasicMaterial({ color: 0x8ba4ff, transparent: true, opacity: 0.55 });
  const centre = new THREE.Mesh(new THREE.PlaneGeometry(0.06, W), lineMat);
  centre.rotation.x = -Math.PI / 2;
  centre.position.y = 0.005;
  table.add(centre);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.12, 48), lineMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.005;
  table.add(ring);
  for (const s of [-1, 1]) {
    const arc = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.46, 40, 1, s > 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI), new THREE.MeshBasicMaterial({ color: s > 0 ? 0xef4444 : 0x3b82f6, transparent: true, opacity: 0.6 }));
    arc.rotation.x = -Math.PI / 2;
    arc.position.set(s * (L / 2), 0.006, 0);
    table.add(arc);
  }
  scene.add(shadowed(table, false, true));

  // ---------------------------------------------------------------- puck and paddles
  const puckMesh = new THREE.Group();
  const puckBody = new THREE.Mesh(new THREE.CylinderGeometry(PUCK_R, PUCK_R, 0.12, 32), mat(0x111827, { roughness: 0.3 }));
  const puckTop = new THREE.Mesh(new THREE.CylinderGeometry(PUCK_R * 0.75, PUCK_R * 0.75, 0.125, 32), glow(0xfacc15));
  puckMesh.add(puckBody, puckTop);
  puckMesh.position.y = 0.06;
  scene.add(shadowed(puckMesh));
  const trail: THREE.Mesh[] = [];
  for (let i = 0; i < 10; i++) {
    const t = new THREE.Mesh(new THREE.CircleGeometry(PUCK_R * (1 - i * 0.07), 20), new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.0, depthWrite: false }));
    t.rotation.x = -Math.PI / 2;
    t.position.y = 0.01;
    scene.add(t);
    trail.push(t);
  }
  const trailPos: THREE.Vector3[] = [];

  const makePaddle = (color: number): THREE.Group => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(PADDLE_R, PADDLE_R * 1.02, 0.14, 40), mat(color, { roughness: 0.35, emissive: color, emissiveIntensity: 0.25 }));
    base.position.y = 0.07;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(PADDLE_R * 0.78, 0.05, 10, 40), mat(0xffffff, { roughness: 0.2 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.15;
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(PADDLE_R * 0.32, PADDLE_R * 0.42, 0.42, 24), mat(color, { roughness: 0.3 }));
    knob.position.y = 0.34;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(PADDLE_R * 0.34, 20, 12), mat(color, { roughness: 0.25 }));
    cap.position.y = 0.55;
    g.add(base, rim, knob, cap);
    return shadowed(g);
  };
  const paddleMeshes = [makePaddle(PLAYER_HEX[0]), makePaddle(PLAYER_HEX[1])];
  paddleMeshes.forEach((m) => scene.add(m));

  // ---------------------------------------------------------------- camera fit
  shell.onResize(() => {
    const { w, h } = shell.size();
    camera.aspect = w / h;
    // Fit the table (with margins) from straight above.
    const needW = L + 1.6;
    const needH = W + 1.6;
    const vFov = (camera.fov * Math.PI) / 180;
    const distH = needH / 2 / Math.tan(vFov / 2);
    const distW = needW / 2 / (Math.tan(vFov / 2) * camera.aspect);
    const d = Math.max(distH, distW);
    camera.position.set(0, d, d * 0.12);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0.15);
    camera.updateProjectionMatrix();
  });

  // ---------------------------------------------------------------- state
  let mode: Mode = { ai: 1 };
  const puck = newPuck();
  const paddles: Paddle[] = [
    { x: 0, y: TABLE.h / 2 - 1.1, px: 0, py: TABLE.h / 2 - 1.1 },
    { x: 0, y: -TABLE.h / 2 + 1.1, px: 0, py: -TABLE.h / 2 + 1.1 },
  ];
  const targets = [{ x: 0, y: TABLE.h / 2 - 1.1 }, { x: 0, y: -TABLE.h / 2 + 1.1 }];
  const score = [0, 0];
  let playing = false;
  let serveIn = 0;
  let confetti: Confetti | null = null;

  // Scoreboards at each end, turned to face the player sitting there.
  const boards = [0, 1].map((p) => {
    const b = el("div", "ar-chip", "", root);
    Object.assign(b.style, {
      position: "absolute",
      top: "50%",
      [p === 0 ? "right" : "left"]: "max(6px, env(safe-area-inset-right))",
      transform: `translateY(-50%) rotate(${p === 0 ? -90 : 90}deg)`,
      transformOrigin: "center",
      borderColor: PLAYER_COLORS[p],
      fontSize: "clamp(16px,3.4vmin,26px)",
      zIndex: "20",
    });
    return b;
  });
  const top = hud(root, { left: "50%", top: "max(10px, env(safe-area-inset-top))" }, true);
  const renderScore = (): void => {
    const name = (p: number): string => (p === 1 && mode.ai !== null ? "Computer" : PLAYER_NAMES[p]);
    boards[0].innerHTML = `${name(0)} ${score[0]}`;
    boards[1].innerHTML = `${name(1)} ${score[1]}`;
    top.set("goal", `First to ${WIN} 🏒`);
  };

  const resetPositions = (towards: 0 | 1 | null): void => {
    puck.x = 0;
    puck.y = towards === null ? 0 : towards === 0 ? 0.9 : -0.9;
    puck.vx = 0;
    puck.vy = 0;
    trailPos.length = 0;
    for (const [i, p] of paddles.entries()) {
      const y = i === 0 ? TABLE.h / 2 - 1.1 : -TABLE.h / 2 + 1.1;
      p.x = p.px = 0;
      p.y = p.py = y;
      targets[i] = { x: 0, y };
    }
  };

  // ---------------------------------------------------------------- input: one finger per paddle
  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const toTable = (cx: number, cy: number): { x: number; y: number } | null => {
    const r = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, hit)) return null;
    return { x: hit.z, y: hit.x };
  };
  const owner = new Map<number, 0 | 1>();
  const canvas = renderer.domElement;
  const sideOf = (cx: number): 0 | 1 => {
    const r = canvas.getBoundingClientRect();
    return cx > r.left + r.width / 2 ? 0 : 1;
  };
  const steer = (id: number, cx: number, cy: number): void => {
    const p = owner.get(id);
    if (p === undefined) return;
    const t = toTable(cx, cy);
    if (t) targets[p] = clampPaddle(p, t.x, t.y);
  };
  const onDown = (e: PointerEvent): void => {
    gameAudio.unlock();
    const side = sideOf(e.clientX);
    if (side === 1 && mode.ai !== null) return;
    for (const [id, p] of owner) if (p === side) owner.delete(id);
    owner.set(e.pointerId, side);
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    steer(e.pointerId, e.clientX, e.clientY);
  };
  const onMove = (e: PointerEvent): void => {
    if (e.pointerType === "mouse" && !owner.has(e.pointerId)) {
      // Desktop: the mouse moves the Red paddle without holding a button.
      const t = toTable(e.clientX, e.clientY);
      if (t) targets[0] = clampPaddle(0, t.x, t.y);
      return;
    }
    steer(e.pointerId, e.clientX, e.clientY);
  };
  const onUp = (e: PointerEvent): void => {
    owner.delete(e.pointerId);
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  shell.addCleanup(() => {
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onUp);
  });

  // ---------------------------------------------------------------- game flow
  const startMatch = (): void => {
    score[0] = score[1] = 0;
    resetPositions(null);
    renderScore();
    serveIn = 1.2;
    playing = true;
    toast(root, "Ready…", 700);
    window.setTimeout(() => playing && toast(root, "GO!", 500, "#facc15"), 900);
  };

  const choose = async (): Promise<void> => {
    playing = false;
    mode = await showPicker<Mode>(root, {
      title: "Air Hockey 3D 🏒",
      subtitle: shell.desktop
        ? "Move the mouse (or arrow keys) for Red. 2 players: Blue uses W A S D.\nFirst to 7 goals wins!"
        : "Drag your paddle with one finger. Red plays on the right, Blue on the left.\nFirst to 7 goals wins!",
      options: [
        { label: "🌱 vs Computer", sub: "Easy", color: "#16a34a", value: { ai: 0 } },
        { label: "🚀 vs Computer", sub: "Medium", color: "#7c3aed", value: { ai: 1 } },
        { label: "🔥 vs Computer", sub: "Hard", color: "#dc2626", value: { ai: 2 } },
        { label: "👫 2 Players", sub: "same device", color: "#0369a1", value: { ai: null } },
      ],
    });
    gameAudio.unlock();
    startMatch();
  };

  const goal = (scorer: 0 | 1): void => {
    score[scorer] += 1;
    renderScore();
    gameAudio.coin();
    const who = scorer === 1 && mode.ai !== null ? "Computer" : PLAYER_NAMES[scorer];
    toast(root, `Goal! ${who}`, 700, PLAYER_COLORS[scorer]);
    if (score[scorer] >= WIN) {
      playing = false;
      confetti?.dispose();
      confetti = new Confetti(scene, toWorld(0, scorer === 0 ? 2.5 : -2.5), 6);
      const human = !(scorer === 1 && mode.ai !== null);
      window.setTimeout(() => {
        showGameOver(root, {
          title: human ? `${PLAYER_NAMES[scorer]} wins! 🎉` : "The computer wins",
          detail: `${score[0]} – ${score[1]}`,
          onAgain: () => startMatch(),
          onMenu: onExit,
        });
      }, 900);
      return;
    }
    resetPositions(scorer === 0 ? 1 : 0);
    serveIn = 0.9;
  };

  shell.onFrame((dt) => {
    // keyboard steering
    const kv = [keyVec(keys, 1), keyVec(keys, 0)]; // Red uses arrows, Blue uses WASD
    for (const p of [0, 1] as const) {
      if (p === 1 && mode.ai !== null) continue;
      const v = kv[p];
      if (v.x || v.y) targets[p] = clampPaddle(p, targets[p].x + v.y * 7 * dt, targets[p].y + v.x * 7 * dt);
    }

    for (const [i, k] of paddles.entries()) {
      k.px = k.x;
      k.py = k.y;
      if (i === 1 && mode.ai !== null) {
        if (playing && serveIn <= 0) {
          const m = aiMove(puck, k, mode.ai, dt);
          k.x = m.x;
          k.y = m.y;
        }
        continue;
      }
      // Follow the finger quickly but not instantly, so a jump across the table does not teleport through the puck.
      const t = targets[i];
      const dx = t.x - k.x;
      const dy = t.y - k.y;
      const d = Math.hypot(dx, dy);
      const max = 22 * dt;
      if (d > max) {
        k.x += (dx / d) * max;
        k.y += (dy / d) * max;
      } else {
        k.x = t.x;
        k.y = t.y;
      }
    }

    if (playing) {
      if (serveIn > 0) serveIn -= dt;
      else {
        const r = stepPuck(puck, paddles, dt);
        if (r.hit) gameAudio.hit();
        else if (r.wall && Math.hypot(puck.vx, puck.vy) > 3) gameAudio.jump();
        if (r.goal !== null) goal(r.goal);
      }
    }

    // draw
    puckMesh.position.copy(toWorld(puck.x, puck.y)).setY(0.06);
    puckMesh.rotation.y += Math.hypot(puck.vx, puck.vy) * dt * 0.8;
    trailPos.unshift(puckMesh.position.clone());
    if (trailPos.length > trail.length) trailPos.pop();
    const speed = Math.hypot(puck.vx, puck.vy);
    trail.forEach((t, i) => {
      const p = trailPos[i];
      if (!p) {
        (t.material as THREE.MeshBasicMaterial).opacity = 0;
        return;
      }
      t.position.set(p.x, 0.01, p.z);
      (t.material as THREE.MeshBasicMaterial).opacity = Math.min(0.5, speed / 25) * (1 - i / trail.length);
    });
    paddles.forEach((k, i) => paddleMeshes[i].position.copy(toWorld(k.x, k.y)));
    confetti?.update(dt);
    renderer.render(scene, camera);
  });

  addExitButton(root, onExit);
  renderScore();
  void choose();

  return () => {
    confetti?.dispose();
    disposeScene(scene);
    shell.dispose();
  };
}
