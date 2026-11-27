import * as THREE from "three";
import { gameAudio } from "../../audio/sfx";
import { addJoystick, addPadButton, Joystick, Keys, KEYMAPS, PadButton } from "../kit/controls";
import { mulberry32 } from "../kit/math";
import { startShell } from "../kit/shell";
import { addLights, Confetti, disposeScene, gradientTexture, mat, shadowed } from "../kit/three";
import { addExitButton, hud, PLAYER_COLORS, PLAYER_HEX, PLAYER_NAMES, showGameOver, showPicker, toast } from "../kit/ui";
import { AiMemory, aiControl, aliveTanks, CELL, createWorld, driveTank, fire, newAiMemory, SHELL_R, steerTank, stepWorld, World } from "./rules";

const POINTS = 5;
type Mode = { humans: number; total: number; level: number };

export function start(onExit: () => void): () => void {
  const shell = startShell("#1c1917");
  const { root, renderer } = shell;
  const keys = new Keys();
  shell.addCleanup(() => keys.dispose());

  const scene = new THREE.Scene();
  scene.background = gradientTexture("#fde68a", "#78350f");
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
  addLights(scene, { shadowSize: 13, hemiSky: 0xfff7ed, hemiGround: 0x57534e });

  const mazeGroup = new THREE.Group();
  const roundGroup = new THREE.Group();
  scene.add(mazeGroup, roundGroup);
  let world: World = createWorld(2, 1);
  const W = (): number => world.maze.C * CELL;
  const H = (): number => world.maze.R * CELL;
  const toX = (x: number): number => x - W() / 2;
  const toZ = (y: number): number => y - H() / 2;

  // ---------------------------------------------------------------- shared assets
  const floorTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = "#e7d7b8";
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = "rgba(120,90,50,0.18)";
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, 125, 125);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  })();
  const wallMat = mat(0x57534e, { roughness: 0.7 });
  const wallTopMat = mat(0xa8a29e, { roughness: 0.6 });
  const shellGeo = new THREE.SphereGeometry(SHELL_R * 1.4, 12, 8);
  const shellMat = mat(0x111827, { emissive: 0xfacc15, emissiveIntensity: 0.6, roughness: 0.3 });

  const makeTank = (color: number): THREE.Group => {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.26, 0.6), mat(color, { roughness: 0.45 }));
    hull.position.y = 0.24;
    const trackM = mat(0x292524, { roughness: 0.9 });
    for (const s of [-1, 1]) {
      const tr = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.22, 0.16), trackM);
      tr.position.set(0, 0.13, s * 0.33);
      g.add(tr);
    }
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.2, 20), mat(color, { roughness: 0.35 }));
    turret.position.y = 0.46;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.5, 12), mat(0x44403c, { roughness: 0.4 }));
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(0.35, 0.47, 0);
    const hatch = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), mat(0xffffff, { roughness: 0.3 }));
    hatch.position.y = 0.58;
    g.add(hull, turret, barrel, hatch);
    g.scale.setScalar(1.25);
    return shadowed(g);
  };

  const buildMaze = (): void => {
    for (const c of [...mazeGroup.children]) {
      mazeGroup.remove(c);
      (c as THREE.Mesh).geometry?.dispose?.();
    }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W(), H()), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9 }));
    floorTex.repeat.set(world.maze.C, world.maze.R);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    mazeGroup.add(floor);
    const base = new THREE.Mesh(new THREE.BoxGeometry(W() + 1.2, 0.5, H() + 1.2), mat(0x44403c));
    base.position.y = -0.26;
    mazeGroup.add(base);
    for (const r of world.maze.walls) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(r.w, 0.55, r.h), [wallMat, wallMat, wallTopMat, wallMat, wallMat, wallMat]);
      m.position.set(toX(r.x + r.w / 2), 0.275, toZ(r.y + r.h / 2));
      mazeGroup.add(shadowed(m));
    }
  };

  shell.onResize(() => {
    const { w, h } = shell.size();
    camera.aspect = w / h;
    const needW = W() + 1.6 + (shell.desktop ? 0 : 10);
    const needH = H() + 1.6 + 2.4;
    const vFov = (camera.fov * Math.PI) / 180;
    const d = Math.max(needH / 2 / Math.tan(vFov / 2), needW / 2 / (Math.tan(vFov / 2) * camera.aspect));
    const elev = (72 * Math.PI) / 180;
    camera.position.set(0, Math.sin(elev) * d, Math.cos(elev) * d - 0.9);
    camera.lookAt(0, 0, -0.9);
    camera.updateProjectionMatrix();
  });

  // ---------------------------------------------------------------- state
  let mode: Mode = { humans: 1, total: 2, level: 1 };
  let phase: "pick" | "countdown" | "play" | "roundover" | "over" = "pick";
  let countdown = 0;
  let rng = mulberry32((Date.now() & 0xffff) + 3);
  const points = [0, 0, 0, 0];
  let mems: AiMemory[] = [];
  let tankMeshes: THREE.Group[] = [];
  const shellMeshes = new Map<object, THREE.Mesh>();
  const blasts: { m: THREE.Mesh; t: number }[] = [];
  let confetti: Confetti | null = null;
  let sticks: Joystick[] = [];
  let fireBtns: PadButton[] = [];
  const board = hud(root, { left: "50%", top: "max(10px, env(safe-area-inset-top))" }, true);
  const name = (p: number): string => (p < mode.humans ? PLAYER_NAMES[p] : `${PLAYER_NAMES[p]} 🤖`);
  const renderBoard = (): void => {
    for (let p = 0; p < 4; p++) {
      if (p >= mode.total) {
        board.set(`p${p}`, "");
        continue;
      }
      const dead = phase !== "pick" && !world.tanks[p]?.alive;
      board.set(`p${p}`, `<span style="color:${PLAYER_COLORS[p]}">■</span> ${name(p)} ${points[p]}${dead ? " 💥" : ""}`, PLAYER_COLORS[p]);
    }
    for (const c of board.el.children) (c as HTMLElement).style.display = (c as HTMLElement).innerHTML ? "" : "none";
  };

  const buildControls = (): void => {
    sticks.forEach((s) => s.dispose());
    fireBtns.forEach((b) => b.dispose());
    sticks = [];
    fireBtns = [];
    if (shell.desktop) return;
    const edge = "max(14px, env(safe-area-inset-left))";
    const layouts =
      mode.humans === 1
        ? [{ stick: { left: edge, bottom: "16px" }, fire: { right: edge, bottom: "22px" } }]
        : [
            { stick: { left: edge, bottom: "14px" }, fire: { left: edge, bottom: "calc(14px + 26vmin)" } },
            { stick: { right: edge, bottom: "14px" }, fire: { right: edge, bottom: "calc(14px + 26vmin)" } },
            { stick: { left: edge, top: "64px" }, fire: { left: "calc(14px + 22vmin)", top: "64px" } },
          ];
    for (let p = 0; p < mode.humans; p++) {
      sticks.push(addJoystick(root, layouts[p].stick, PLAYER_COLORS[p], mode.humans > 2 ? 1.05 : 1.25));
      fireBtns.push(addPadButton(root, layouts[p].fire, "💥", PLAYER_COLORS[p], mode.humans > 2 ? 0.9 : 1.05));
    }
  };

  const newRound = (): void => {
    for (const c of [...roundGroup.children]) {
      roundGroup.remove(c);
      if (c !== undefined && tankMeshes.includes(c as THREE.Group)) disposeScene(c);
    }
    shellMeshes.clear();
    blasts.length = 0;
    world = createWorld(mode.total, Math.floor(rng() * 1e9));
    buildMaze();
    mems = world.tanks.map(() => newAiMemory());
    tankMeshes = world.tanks.map((t) => {
      const m = makeTank(PLAYER_HEX[t.id]);
      roundGroup.add(m);
      return m;
    });
    phase = "countdown";
    countdown = 1.6;
    renderBoard();
    toast(root, "Ready…", 800);
  };

  const startMatch = (): void => {
    points.fill(0);
    confetti?.dispose();
    confetti = null;
    buildControls();
    newRound();
  };

  const choose = async (): Promise<void> => {
    phase = "pick";
    mode = await showPicker<Mode>(root, {
      title: "Tank Trouble 🛡️",
      subtitle: shell.desktop
        ? "Shells bounce off the walls — careful, they can hit you too!\nRed: W A S D + Space · Blue: arrows + Enter · Green: I J K L + O"
        : "Push the stick to drive, tap 💥 to fire. Shells bounce off the walls — careful, they can hit you too!\nFirst to 5 points wins.",
      options: [
        { label: "🌱 vs Computer", sub: "Easy", color: "#16a34a", value: { humans: 1, total: 2, level: 0 } },
        { label: "🔥 vs Computer", sub: "Hard", color: "#dc2626", value: { humans: 1, total: 2, level: 1 } },
        { label: "👫 2 Players", sub: "same device", color: "#0369a1", value: { humans: 2, total: 2, level: 1 } },
        { label: "👫 2 Players + 🤖", sub: "same device", color: "#ea580c", value: { humans: 2, total: 3, level: 0 } },
        { label: "👨‍👩‍👦 3 Players", sub: "same device", color: "#7c3aed", value: { humans: 3, total: 3, level: 1 } },
      ],
    });
    gameAudio.unlock();
    gameAudio.startMusic();
    startMatch();
  };

  const endRound = (): void => {
    const left = aliveTanks(world);
    const winner = left.length === 1 ? left[0] : -1;
    if (winner >= 0) points[winner] += 1;
    renderBoard();
    toast(root, winner >= 0 ? `${name(winner)} +1` : "Draw!", 1000, winner >= 0 ? PLAYER_COLORS[winner] : "#ffffff");
    window.setTimeout(() => {
      if (phase !== "roundover") return;
      if (winner >= 0 && points[winner] >= POINTS) {
        phase = "over";
        gameAudio.stopMusic();
        const t = world.tanks[winner];
        confetti = new Confetti(scene, new THREE.Vector3(toX(t.x), 0, toZ(t.y)), 8);
        showGameOver(root, {
          title: winner < mode.humans ? `${PLAYER_NAMES[winner]} wins! 🎉` : `${PLAYER_NAMES[winner]} (computer) wins`,
          detail: world.tanks.map((x) => `${name(x.id)} ${points[x.id]}`).join("  ·  "),
          onAgain: () => {
            gameAudio.startMusic();
            startMatch();
          },
          onMenu: onExit,
        });
      } else newRound();
    }, 1500);
  };

  // ---------------------------------------------------------------- loop
  shell.onFrame((dt) => {
    if (phase === "countdown") {
      countdown -= dt;
      if (countdown <= 0) {
        phase = "play";
        toast(root, "GO!", 500, "#facc15");
      }
    }
    if (phase === "play" || phase === "roundover") {
      for (let p = 0; p < mode.humans; p++) {
        const m = KEYMAPS[p];
        const f = (keys.down(m.up) ? 1 : 0) - (keys.down(m.down) ? 1 : 0);
        const tr = (keys.down(m.right) ? 1 : 0) - (keys.down(m.left) ? 1 : 0);
        const s = sticks[p]?.vec();
        if (s && (s.x || s.y)) steerTank(world, p, s.x, s.y, dt);
        else driveTank(world, p, f, tr, dt);
        if (keys.pressed(m.act) || fireBtns[p]?.pressed()) {
          if (phase === "play" && fire(world, p)) gameAudio.shoot();
        }
      }
      for (let p = mode.humans; p < mode.total; p++) {
        const c = aiControl(world, p, mems[p], dt, rng, mode.level);
        driveTank(world, p, c.forward, c.turn, dt);
        if (c.fire && phase === "play" && fire(world, p)) gameAudio.shoot();
      }
      for (const e of stepWorld(world, dt)) {
        if (e.type === "hit") {
          gameAudio.hit();
          const b = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), mat(0xf97316, { emissive: 0xf97316, emissiveIntensity: 2, transparent: true }));
          b.position.set(toX(e.x), 0.4, toZ(e.y));
          roundGroup.add(b);
          blasts.push({ m: b, t: 0 });
          renderBoard();
        }
      }
      if (phase === "play" && aliveTanks(world).length <= 1) {
        phase = "roundover";
        // Shells still flying may yet hit the last tank: decide after a short wait.
        window.setTimeout(endRound, 1300);
      }
    }
    // sync meshes
    world.tanks.forEach((tk, i) => {
      const m = tankMeshes[i];
      if (!m) return;
      m.position.set(toX(tk.x), tk.alive ? 0 : -0.12, toZ(tk.y));
      m.rotation.y = -tk.a;
      if (!tk.alive && !m.userData.wreck) {
        m.userData.wreck = true;
        m.traverse((o) => {
          const mm = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
          if (mm && "color" in mm) {
            const c = mm.clone();
            c.color.multiplyScalar(0.3);
            (o as THREE.Mesh).material = c;
          }
        });
        m.rotation.z = 0.25;
      }
    });
    const live = new Set<object>(world.shells);
    for (const [s, m] of shellMeshes) if (!live.has(s)) {
      roundGroup.remove(m);
      shellMeshes.delete(s);
    }
    for (const s of world.shells) {
      let m = shellMeshes.get(s);
      if (!m) {
        m = new THREE.Mesh(shellGeo, shellMat);
        m.castShadow = true;
        roundGroup.add(m);
        shellMeshes.set(s, m);
      }
      m.position.set(toX(s.x), 0.4, toZ(s.y));
    }
    for (let i = blasts.length - 1; i >= 0; i--) {
      const b = blasts[i];
      b.t += dt;
      b.m.scale.setScalar(1 + b.t * 4);
      (b.m.material as THREE.MeshStandardMaterial).opacity = Math.max(0, 1 - b.t * 2);
      if (b.t > 0.5) {
        roundGroup.remove(b.m);
        b.m.geometry.dispose();
        (b.m.material as THREE.Material).dispose();
        blasts.splice(i, 1);
      }
    }
    confetti?.update(dt);
    renderer.render(scene, camera);
  });

  addExitButton(root, onExit);
  buildMaze();
  void choose();

  return () => {
    gameAudio.stopMusic();
    sticks.forEach((s) => s.dispose());
    fireBtns.forEach((b) => b.dispose());
    confetti?.dispose();
    disposeScene(scene);
    floorTex.dispose();
    shell.dispose();
  };
}
