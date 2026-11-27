import * as THREE from "three";
import { gameAudio } from "../../audio/sfx";
import { addJoystick, addPadButton, Joystick, Keys, PadButton } from "../kit/controls";
import { angleDiff, mulberry32 } from "../kit/math";
import { startShell } from "../kit/shell";
import { addLights, Confetti, disposeScene, gradientTexture } from "../kit/three";
import { addExitButton, el, hud, showPicker, toast } from "../kit/ui";
import { AiMem, aiThink, newAiMem } from "./ai";
import { MISSIONS, VERSUS_MAPS } from "./levels";
import { TankView } from "./render";
import { aimTurret, aliveTeams, createWorld, driveTank, fire, Kind, KINDS, layMine, parseMap, step, TankEvent, traceShot, World } from "./sim";

const LIVES = 5;
const VERSUS_POINTS = 5;
const COLORS = [0x3b82f6, 0xef4444, 0x22c55e];
const BOT_COLOR = 0xf59e0b;
/** Names match this game's tank colours (player 1 is blue). */
const PLAYER_NAMES = ["Blue", "Red", "Green"];
const SAVE_KEY = "yusaf-tanks-mission";
type Mode = { kind: "campaign"; humans: number } | { kind: "versus"; humans: number; bots: number };
type Pad = { move: Joystick | null; aim: Joystick | null; mine: PadButton | null; fireBtn: PadButton | null; prevMag: number; aimAngle: number; aimActive: number; pendingFire: number };

const hex = (c: number): string => `#${c.toString(16).padStart(6, "0")}`;
const loadProgress = (): number => {
  try {
    return Math.max(0, Math.min(MISSIONS.length - 1, Number(localStorage.getItem(SAVE_KEY) ?? 0) || 0));
  } catch {
    return 0;
  }
};
const saveProgress = (i: number): void => {
  try {
    if (i > loadProgress()) localStorage.setItem(SAVE_KEY, String(i));
  } catch {
    /* private mode: progress just is not remembered */
  }
};

export function start(onExit: () => void): () => void {
  const shell = startShell("#2a1d12");
  const { root, renderer } = shell;
  const keys = new Keys();
  shell.addCleanup(() => keys.dispose());

  const scene = new THREE.Scene();
  scene.background = gradientTexture("#3b2a1c", "#1b120b");
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  const sun = addLights(scene, { shadowSize: 13, hemiSky: 0xfff4e0, hemiGround: 0x5b4632, sun: 0xfff1dc });
  sun.position.set(-6, 18, 9);
  sun.shadow.mapSize.set(2048, 2048);

  let mode: Mode = { kind: "campaign", humans: 1 };
  let world: World = createWorld(parseMap(MISSIONS[0].map), { humans: 1, versus: false, colors: COLORS });
  let view = new TankView(scene, world);
  let mems: AiMem[] = [];
  let phase: "menu" | "intro" | "play" | "ending" | "card" = "menu";
  let mission = 0;
  let lives = LIVES;
  let round = 0;
  const points = [0, 0, 0, 0];
  let endTimer = 0;
  let confetti: Confetti | null = null;
  const rng = mulberry32((Date.now() & 0xffff) + 17);
  let pads: Pad[] = [];
  let mouseAim: { x: number; y: number } | null = null;
  const board = hud(root, { left: "50%", top: "max(10px, env(safe-area-inset-top))" }, true);

  // ---------------------------------------------------------------- camera
  const fitCamera = (): void => {
    const { w, h } = shell.size();
    camera.aspect = w / h;
    const sideRoom = shell.desktop ? 1.5 : mode.humans >= 2 ? 9 : 7;
    const needW = world.cols + sideRoom;
    const needH = world.rows + 3.2;
    const vFov = (camera.fov * Math.PI) / 180;
    const d = Math.max(needH / 2 / Math.tan(vFov / 2), needW / 2 / (Math.tan(vFov / 2) * camera.aspect)) * 1.02;
    const elev = (60 * Math.PI) / 180;
    camera.position.set(0, Math.sin(elev) * d, Math.cos(elev) * d + 0.5);
    camera.lookAt(0, 0, 0.5);
    camera.updateProjectionMatrix();
    camera.userData.base = camera.position.clone();
  };
  shell.onResize(fitCamera);

  // ---------------------------------------------------------------- screen to board
  const raycaster = new THREE.Raycaster();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.4);
  const toBoard = (cx: number, cy: number): { x: number; y: number } | null => {
    const r = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera);
    const v = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(ground, v)) return null;
    return { x: v.x + world.cols / 2, y: v.z + world.rows / 2 };
  };
  const humanTank = (h: number) => world.tanks.find((t) => t.human === h);

  /** Gentle aim assist for small hands: if an opponent is close to the aimed line with a clear shot, aim at it. */
  const assist = (h: number, angle: number): number => {
    const t = humanTank(h);
    if (!t) return angle;
    let best = angle;
    let bestD = 0.2;
    for (const o of world.tanks) {
      if (!o.alive || o.team === t.team) continue;
      const a = Math.atan2(o.y - t.y, o.x - t.x);
      const d = Math.abs(angleDiff(angle, a));
      if (d < bestD && traceShot(world, t.x, t.y, a, 0, t.id).hit === o.id) {
        best = a;
        bestD = d;
      }
    }
    return best;
  };

  // ---------------------------------------------------------------- input
  const canvas = renderer.domElement;
  const onPointerDown = (e: PointerEvent): void => {
    gameAudio.unlock();
    if (phase !== "play") return;
    const p = toBoard(e.clientX, e.clientY);
    if (!p) return;
    if (e.pointerType === "mouse") {
      const t = humanTank(0);
      if (!t) return;
      if (e.button === 2) {
        if (layMine(world, t.id, pending)) gameAudio.jump();
        return;
      }
      pads[0].aimAngle = Math.atan2(p.y - t.y, p.x - t.x);
      pads[0].pendingFire = 0.35;
      return;
    }
    // Touch: tap the board to aim there and fire. With two players, each side of the screen is one player.
    const r = canvas.getBoundingClientRect();
    const h = mode.humans >= 2 && e.clientX > r.left + r.width / 2 ? 1 : 0;
    const t = humanTank(h);
    if (!t || !pads[h]) return;
    pads[h].aimAngle = assist(h, Math.atan2(p.y - t.y, p.x - t.x));
    pads[h].pendingFire = 0.35;
    pads[h].aimActive = 0.6;
  };
  const onPointerMove = (e: PointerEvent): void => {
    if (e.pointerType === "mouse") mouseAim = toBoard(e.clientX, e.clientY);
  };
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  shell.addCleanup(() => {
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
  });

  const DESK_KEYS = [
    { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", tl: "", tr: "", fire: "", mine: "Space" },
    { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", tl: "Comma", tr: "Period", fire: "Enter", mine: "ShiftRight" },
    { up: "KeyI", down: "KeyK", left: "KeyJ", right: "KeyL", tl: "KeyU", tr: "KeyO", fire: "KeyP", mine: "KeyY" },
  ];

  const buildPads = (): void => {
    for (const p of pads) [p.move, p.aim, p.mine, p.fireBtn].forEach((c) => c?.dispose());
    pads = Array.from({ length: mode.humans }, () => ({ move: null, aim: null, mine: null, fireBtn: null, prevMag: 0, aimAngle: 0, aimActive: 0, pendingFire: 0 }));
    if (shell.desktop) return;
    const edge = "max(14px, env(safe-area-inset-left))";
    const col = (h: number) => hex(COLORS[h]);
    if (mode.humans === 1) {
      pads[0].move = addJoystick(root, { left: edge, bottom: "16px" }, col(0), 1.3);
      pads[0].aim = addJoystick(root, { right: edge, bottom: "16px" }, "#f59e0b", 1.3);
      pads[0].mine = addPadButton(root, { right: `calc(${edge} + 25vmin)`, bottom: "22px" }, "💣", "#ca8a04", 0.8);
      return;
    }
    for (const h of [0, 1]) {
      const side = h === 0 ? "left" : "right";
      pads[h].move = addJoystick(root, { [side]: edge, bottom: "14px" }, col(h), 1.1);
      pads[h].aim = addJoystick(root, { [side]: `calc(${edge} + 22vmin)`, bottom: "14px" }, col(h), 1.1);
      pads[h].mine = addPadButton(root, { [side]: edge, bottom: "calc(20px + 20vmin)" }, "💣", "#ca8a04", 0.75);
    }
    if (mode.humans >= 3) {
      pads[2].move = addJoystick(root, { left: "calc(50% - 26vmin)", top: "64px" }, col(2), 1);
      pads[2].fireBtn = addPadButton(root, { left: "calc(50% + 8vmin)", top: "70px" }, "💥", col(2), 0.9);
    }
  };

  /** Reads one human's controls: drive vector, where to aim, and whether to fire or drop a mine this frame. */
  const readHuman = (h: number, dt: number): { mx: number; my: number; aim: number; fire: boolean; mine: boolean } => {
    const t = humanTank(h)!;
    const pad = pads[h];
    const k = DESK_KEYS[h];
    let mx = (keys.down(k.right) ? 1 : 0) - (keys.down(k.left) ? 1 : 0);
    let my = (keys.down(k.down) ? 1 : 0) - (keys.down(k.up) ? 1 : 0);
    const mv = pad.move?.vec();
    if (mv && (mv.x || mv.y)) {
      mx = mv.x;
      my = mv.y;
    }
    let mine = keys.pressed(k.mine) || (pad.mine?.pressed() ?? false);
    let wantFire = k.fire ? keys.pressed(k.fire) : false;
    // turret
    if (h === 0 && shell.desktop && mouseAim) pad.aimAngle = Math.atan2(mouseAim.y - t.y, mouseAim.x - t.x);
    if (k.tl && keys.down(k.tl)) pad.aimAngle = t.turret - 3 * dt;
    if (k.tr && keys.down(k.tr)) pad.aimAngle = t.turret + 3 * dt;
    const av = pad.aim?.vec();
    const mag = av ? Math.hypot(av.x, av.y) : 0;
    if (av && mag > 0.3) {
      pad.aimAngle = Math.atan2(av.y, av.x);
      pad.aimActive = 0.4;
    }
    if (pad.prevMag > 0.45 && mag === 0) {
      // let go of the aim stick: fire where it pointed
      pad.aimAngle = assist(h, pad.aimAngle);
      pad.pendingFire = 0.35;
    }
    pad.prevMag = mag;
    if (pad.fireBtn?.pressed()) {
      // the third player's button: aim at the nearest opponent automatically
      const foes = world.tanks.filter((o) => o.alive && o.team !== t.team);
      if (foes.length) {
        const f = foes.reduce((a, b) => (Math.hypot(a.x - t.x, a.y - t.y) < Math.hypot(b.x - t.x, b.y - t.y) ? a : b));
        pad.aimAngle = Math.atan2(f.y - t.y, f.x - t.x);
        pad.pendingFire = 0.35;
      }
    }
    if (wantFire) pad.pendingFire = 0.01;
    if (pad.pendingFire > 0) {
      pad.pendingFire -= dt;
      if (Math.abs(angleDiff(t.turret, pad.aimAngle)) < 0.12 || pad.pendingFire <= 0) {
        wantFire = true;
        pad.pendingFire = 0;
      }
    }
    pad.aimActive = Math.max(0, pad.aimActive - dt);
    return { mx, my, aim: pad.aimAngle, fire: wantFire, mine };
  };

  // ---------------------------------------------------------------- HTML cards
  const card = (html: string, buttons: { label: string; color: string }[], autoMs = 0): Promise<number> =>
    new Promise((resolve) => {
      const scrim = el("div", "ar-scrim", "", root);
      const c = el("div", "ar-card", html, scrim);
      const grid = el("div", "ar-grid", "", c);
      let done = false;
      const finish = (i: number): void => {
        if (done) return;
        done = true;
        scrim.remove();
        resolve(i);
      };
      buttons.forEach((b, i) => {
        const btn = el("button", "ar-btn", b.label, grid);
        btn.style.background = b.color;
        btn.addEventListener("click", () => finish(i));
      });
      if (autoMs) window.setTimeout(() => finish(0), autoMs);
    });

  const renderHud = (): void => {
    const set = (id: string, html: string, color?: string): void => board.set(id, html, color);
    if (mode.kind === "campaign") {
      const left = world.tanks.filter((t) => t.alive && t.team === 1).length;
      set("a", `🎖️ Mission ${mission + 1}/${MISSIONS.length}`);
      set("b", `🎯 Enemies ${left}`);
      set("c", `❤️ ${lives}`);
    } else {
      world.tanks.forEach((t, i) => set(`p${i}`, `<span style="color:${hex(t.color)}">■</span> ${t.human >= 0 ? PLAYER_NAMES[t.human] : "Computer"} ${points[i]}`, hex(t.color)));
      set("c", `First to ${VERSUS_POINTS}`);
    }
  };

  // ---------------------------------------------------------------- game flow
  const setWorld = (w: World): void => {
    view.dispose();
    world = w;
    view = new TankView(scene, world);
    mems = world.tanks.map(() => newAiMem());
    for (const c of [...board.el.children]) c.remove();
    fitCamera();
    renderHud();
  };

  const enemyList = (): string => {
    const counts = new Map<Kind, number>();
    for (const t of world.tanks) if (t.team === 1) counts.set(t.kind, (counts.get(t.kind) ?? 0) + 1);
    return [...counts]
      .map(([k, n]) => `<div style="display:flex;align-items:center;gap:10px;justify-content:center;margin:4px 0;font-weight:800">
        <span style="display:inline-block;width:22px;height:22px;border-radius:6px;background:${hex(KINDS[k].color)};border:2px solid #fff"></span>
        ${n} × ${KINDS[k].name} <span style="opacity:.75;font-weight:700">— ${KINDS[k].blurb}</span></div>`)
      .join("");
  };

  const loadMission = async (i: number): Promise<void> => {
    mission = i;
    setWorld(createWorld(parseMap(MISSIONS[i].map), { humans: mode.humans, versus: false, colors: COLORS, seed: i + 1 }));
    phase = "intro";
    await card(`<h2>Mission ${i + 1}: ${MISSIONS[i].name}</h2><p>Destroy every enemy tank!</p>${enemyList()}<p style="margin-top:10px">❤️ Lives left: ${lives}</p>`, [{ label: "Start ▶", color: "#16a34a" }], 4500);
    toast(root, "GO!", 600, "#facc15");
    phase = "play";
  };

  const startVersusRound = async (): Promise<void> => {
    if (mode.kind !== "versus") return;
    const vm = VERSUS_MAPS[round % VERSUS_MAPS.length];
    const colors = [...COLORS.slice(0, mode.humans), ...Array(mode.bots).fill(BOT_COLOR)];
    setWorld(createWorld(parseMap(vm.map), { humans: mode.humans, versus: true, bots: mode.bots, colors, seed: round + 3 }));
    phase = "intro";
    toast(root, `Round ${round + 1} · ${vm.name}`, 900);
    window.setTimeout(() => {
      if (phase !== "intro") return;
      toast(root, "GO!", 500, "#facc15");
      phase = "play";
    }, 1200);
  };

  const finishMission = async (won: boolean): Promise<void> => {
    phase = "card";
    if (won) {
      gameAudio.coin();
      saveProgress(Math.min(MISSIONS.length - 1, mission + 1));
      if (mission === MISSIONS.length - 1) {
        confetti = new Confetti(scene, new THREE.Vector3(0, 0, 0), 12, 140);
        const c = await card(`<h2>You beat all ${MISSIONS.length} missions! 🏆</h2><p>Tank Commander, you are a hero!</p>`, [
          { label: "↻ Play again", color: "#16a34a" },
          { label: "Menu", color: "#6d5dfc" },
        ]);
        if (c === 0) await choose();
        else onExit();
        return;
      }
      confetti = new Confetti(scene, new THREE.Vector3(0, 0, 0), 8, 60);
      await card(`<h2>Mission ${mission + 1} clear! ⭐</h2><p>Next: ${MISSIONS[mission + 1].name}</p>`, [{ label: "Next mission ▶", color: "#16a34a" }]);
      await loadMission(mission + 1);
      return;
    }
    lives -= 1;
    if (lives > 0) {
      const c = await card(`<h2>Tank destroyed!</h2><p>❤️ Lives left: ${lives}</p>`, [
        { label: "↻ Try again", color: "#16a34a" },
        { label: "Menu", color: "#6d5dfc" },
      ]);
      if (c === 0) await loadMission(mission);
      else onExit();
      return;
    }
    const c = await card(`<h2>Out of lives</h2><p>You reached mission ${mission + 1}. Keep going from here!</p>`, [
      { label: `↻ Mission ${mission + 1} again`, color: "#16a34a" },
      { label: "Menu", color: "#6d5dfc" },
    ]);
    lives = LIVES;
    if (c === 0) await loadMission(mission);
    else onExit();
  };

  const finishRound = async (): Promise<void> => {
    if (mode.kind !== "versus") return;
    phase = "card";
    const teams = [...aliveTeams(world)];
    const winner = teams.length === 1 ? world.tanks.find((t) => t.team === teams[0])! : null;
    if (winner) points[winner.id] += 1;
    renderHud();
    const name = winner ? (winner.human >= 0 ? PLAYER_NAMES[winner.human] : "Computer") : "";
    if (winner && points[winner.id] >= VERSUS_POINTS) {
      gameAudio.coin();
      confetti = new Confetti(scene, new THREE.Vector3(0, 0, 0), 10, 120);
      const c = await card(`<h2>${name} wins the match! 🏆</h2><p>${world.tanks.map((t, i) => `${t.human >= 0 ? PLAYER_NAMES[t.human] : "Computer"} ${points[i]}`).join("  ·  ")}</p>`, [
        { label: "↻ Play again", color: "#16a34a" },
        { label: "Menu", color: "#6d5dfc" },
      ]);
      if (c === 0) {
        points.fill(0);
        round = 0;
        await startVersusRound();
      } else onExit();
      return;
    }
    toast(root, winner ? `${name} +1` : "Draw!", 1000, winner ? hex(winner.color) : "#ffffff");
    round += 1;
    window.setTimeout(() => void startVersusRound(), 1400);
  };

  const choose = async (): Promise<void> => {
    phase = "menu";
    confetti?.dispose();
    confetti = null;
    mode = await showPicker<Mode>(root, {
      title: "Tank Commander 🛡️",
      subtitle: shell.desktop
        ? "Drive with W A S D, aim with the mouse, click to fire, Space drops a mine.\nShells bounce off walls once — careful, they can come back at you!"
        : "Left stick drives. Drag the orange stick to aim and let go to fire — or just tap where to shoot. 💣 drops a mine.\nShells bounce off walls once — careful, they can come back at you!",
      options: [
        { label: "🎖️ Campaign", sub: "1 player · 20 missions", color: "#16a34a", value: { kind: "campaign", humans: 1 } },
        { label: "👫 Campaign", sub: "2 players together", color: "#0369a1", value: { kind: "campaign", humans: 2 } },
        { label: "🤖 Versus computer", sub: "1 player", color: "#7c3aed", value: { kind: "versus", humans: 1, bots: 1 } },
        { label: "⚔️ Versus", sub: "2 players", color: "#dc2626", value: { kind: "versus", humans: 2, bots: 0 } },
        { label: "⚔️ Versus + 🤖", sub: "2 players + computer", color: "#ea580c", value: { kind: "versus", humans: 2, bots: 1 } },
        { label: "⚔️ Versus", sub: "3 players", color: "#db2777", value: { kind: "versus", humans: 3, bots: 0 } },
      ],
    });
    gameAudio.unlock();
    gameAudio.startMusic();
    buildPads();
    if (mode.kind === "campaign") {
      lives = LIVES;
      const saved = loadProgress();
      let from = 0;
      if (saved > 0) {
        from = await showPicker<number>(root, {
          title: "Campaign",
          options: [
            { label: `▶ Continue`, sub: `Mission ${saved + 1}: ${MISSIONS[saved].name}`, color: "#16a34a", value: saved },
            { label: "↺ From the start", sub: "Mission 1", color: "#6d5dfc", value: 0 },
          ],
        });
      }
      await loadMission(from);
    } else {
      points.fill(0);
      round = 0;
      await startVersusRound();
    }
  };

  // ---------------------------------------------------------------- frame loop
  const pending: TankEvent[] = [];
  shell.onFrame((dt, time) => {
    if (phase === "play" || phase === "ending") {
      pending.length = 0;
      for (const t of world.tanks) {
        if (!t.alive) continue;
        if (t.human >= 0) {
          const c = readHuman(t.human, dt);
          if (c.fire && fire(world, t.id, pending)) gameAudio.shoot();
          if (c.mine && layMine(world, t.id, pending)) gameAudio.jump();
          driveTank(world, t.id, c.mx, c.my, dt);
          aimTurret(world, t.id, c.aim, dt);
        } else {
          const c = aiThink(world, t.id, mems[t.id], dt, rng);
          if (c.fire && fire(world, t.id, pending)) gameAudio.shoot();
          if (c.mine) layMine(world, t.id, pending);
          driveTank(world, t.id, c.mx, c.my, dt);
          aimTurret(world, t.id, c.aim, dt);
        }
      }
      const ev = [...pending, ...step(world, dt)];
      view.handle(ev, world);
      for (const e of ev) {
        if (e.type === "explode" || e.type === "tankDead") gameAudio.hit();
        else if (e.type === "pickup") gameAudio.coin();
      }
      if (ev.some((e) => e.type === "tankDead" || e.type === "pickup")) renderHud();
      // end of mission / round, after the last explosions settle
      if (phase === "play") {
        const over =
          mode.kind === "campaign"
            ? !world.tanks.some((t) => t.alive && t.team === 1) || !world.tanks.some((t) => t.alive && t.human >= 0)
            : aliveTeams(world).size <= 1;
        if (over) {
          phase = "ending";
          endTimer = 1.4;
        }
      } else {
        endTimer -= dt;
        if (endTimer <= 0) {
          if (mode.kind === "campaign") void finishMission(!world.tanks.some((t) => t.alive && t.team === 1) && world.tanks.some((t) => t.alive && t.human >= 0));
          else void finishRound();
          phase = "card";
        }
      }
    }
    // aim lines for humans who are aiming (always for the mouse player on a desktop)
    for (let h = 0; h < 3; h++) {
      const t = humanTank(h);
      const show = !!t && t.alive && (phase === "play" || phase === "ending") && !!pads[h] && (pads[h].aimActive > 0 || (h === 0 && shell.desktop));
      view.aimLine(h, show && t ? traceShot(world, t.x, t.y, t.turret, KINDS[t.kind].bounces, t.id, 16).points : null, t ? t.color : 0xffffff);
    }
    view.sync(world, dt, time);
    confetti?.update(dt);
    const base = camera.userData.base as THREE.Vector3 | undefined;
    if (base) {
      const s = view.shake;
      camera.position.set(base.x + (Math.random() - 0.5) * s, base.y + (Math.random() - 0.5) * s * 0.5, base.z + (Math.random() - 0.5) * s);
    }
    renderer.render(scene, camera);
  });

  addExitButton(root, onExit);
  fitCamera();
  void choose();

  return () => {
    gameAudio.stopMusic();
    for (const p of pads) [p.move, p.aim, p.mine, p.fireBtn].forEach((c) => c?.dispose());
    confetti?.dispose();
    view.dispose();
    disposeScene(scene);
    shell.dispose();
  };
}
