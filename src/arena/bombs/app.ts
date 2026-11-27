import * as THREE from "three";
import { gameAudio } from "../../audio/sfx";
import { addJoystick, addPadButton, Joystick, Keys, KEYMAPS, keyVec, PadButton } from "../kit/controls";
import { mulberry32 } from "../kit/math";
import { startShell } from "../kit/shell";
import { addLights, Confetti, disposeScene, gradientTexture, mat, shadowed } from "../kit/three";
import { addExitButton, hud, PLAYER_COLORS, PLAYER_HEX, PLAYER_NAMES, showGameOver, showPicker, toast } from "../kit/ui";
import { aiInput, alive, createGame, CRATE, cx, cy, Game, H, movePlayer, placeBomb, Power, tick, W } from "./rules";

const WINS_NEEDED = 3;
const ROUND_LIMIT = 150;
type Mode = { humans: number; total: number };

const wx = (x: number): number => x - (W - 1) / 2;
const wz = (y: number): number => y - (H - 1) / 2;

function canvasTexture(draw: (g: CanvasRenderingContext2D, s: number) => void, size = 128): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d")!, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const POWER_ICON: Record<Power, string> = { bomb: "💣", fire: "🔥", speed: "👟" };

export function start(onExit: () => void): () => void {
  const shell = startShell("#123018");
  const { root, renderer } = shell;
  const keys = new Keys();
  shell.addCleanup(() => keys.dispose());

  const scene = new THREE.Scene();
  scene.background = gradientTexture("#7dd3fc", "#14532d");
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  addLights(scene, { shadowSize: 10, hemiGround: 0x2f4f2f });

  // ---------------------------------------------------------------- static arena
  const grassTex = canvasTexture((g, s) => {
    const n = 2;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      g.fillStyle = (x + y) % 2 ? "#5dbb4f" : "#4fae43";
      g.fillRect((x * s) / n, (y * s) / n, s / n, s / n);
    }
  });
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.repeat.set(W / 2, H / 2);
  grassTex.magFilter = THREE.NearestFilter;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const base = new THREE.Mesh(new THREE.BoxGeometry(W + 2.4, 0.6, H + 2.4), mat(0x3f6212));
  base.position.y = -0.31;
  base.receiveShadow = true;
  scene.add(base);
  const stone = mat(0x94a3b8, { roughness: 0.75 });
  const wallGeo = new THREE.BoxGeometry(1, 0.9, 1);
  const addWall = (x: number, y: number): void => {
    const m = new THREE.Mesh(wallGeo, stone);
    m.position.set(wx(x), 0.45, wz(y));
    scene.add(shadowed(m));
  };
  for (let x = -1; x <= W; x++) for (const y of [-1, H]) addWall(x, y);
  for (let y = 0; y < H; y++) for (const x of [-1, W]) addWall(x, y);
  const pillarGeo = new THREE.BoxGeometry(0.92, 0.9, 0.92);
  const pillarMat = mat(0x64748b, { roughness: 0.6 });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (x % 2 === 1 && y % 2 === 1) {
      const p = new THREE.Mesh(pillarGeo, pillarMat);
      p.position.set(wx(x), 0.45, wz(y));
      scene.add(shadowed(p));
    }
  }

  // ---------------------------------------------------------------- shared assets for the round
  const crateTex = canvasTexture((g, s) => {
    g.fillStyle = "#c98a3d";
    g.fillRect(0, 0, s, s);
    g.strokeStyle = "#7c4a1a";
    g.lineWidth = s * 0.09;
    g.strokeRect(s * 0.05, s * 0.05, s * 0.9, s * 0.9);
    g.beginPath();
    g.moveTo(s * 0.1, s * 0.1);
    g.lineTo(s * 0.9, s * 0.9);
    g.moveTo(s * 0.9, s * 0.1);
    g.lineTo(s * 0.1, s * 0.9);
    g.stroke();
  });
  const crateGeo = new THREE.BoxGeometry(0.86, 0.8, 0.86);
  const crateMat = new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.8 });
  const bombGeo = new THREE.SphereGeometry(0.32, 24, 16);
  const bombMat = mat(0x111827, { roughness: 0.25, metalness: 0.3 });
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
  const flameGeo = new THREE.BoxGeometry(0.9, 0.5, 0.9);
  const flameMat = mat(0xf97316, { emissive: 0xf97316, emissiveIntensity: 2, transparent: true, opacity: 0.9 });
  const flameCore = mat(0xfde047, { emissive: 0xfde047, emissiveIntensity: 2.2 });
  const powerTex: Record<Power, THREE.CanvasTexture> = {
    bomb: canvasTexture((g, s) => drawIcon(g, s, POWER_ICON.bomb, "#7c3aed")),
    fire: canvasTexture((g, s) => drawIcon(g, s, POWER_ICON.fire, "#dc2626")),
    speed: canvasTexture((g, s) => drawIcon(g, s, POWER_ICON.speed, "#0284c7")),
  };
  function drawIcon(g: CanvasRenderingContext2D, s: number, icon: string, bg: string): void {
    g.fillStyle = bg;
    g.beginPath();
    g.arc(s / 2, s / 2, s * 0.46, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#ffffff";
    g.lineWidth = s * 0.06;
    g.stroke();
    g.font = `${Math.round(s * 0.56)}px system-ui, 'Apple Color Emoji', sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(icon, s / 2, s / 2 + s * 0.03);
  }

  const makeBomber = (color: number): THREE.Group => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.24, 6, 16), mat(color, { roughness: 0.4 }));
    body.position.y = 0.38;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 16), mat(0xfff1e6, { roughness: 0.5 }));
    head.position.y = 0.78;
    const hat = new THREE.Mesh(new THREE.SphereGeometry(0.25, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(color, { roughness: 0.35 }));
    hat.position.y = 0.8;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), mat(0xfacc15, { emissive: 0xfacc15, emissiveIntensity: 0.6 }));
    ball.position.y = 1.1;
    const eyeM = mat(0x111111);
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), eyeM);
      e.position.set(s * 0.09, 0.78, 0.21);
      g.add(e);
    }
    g.add(body, head, hat, ball);
    return shadowed(g, true, false);
  };

  // ---------------------------------------------------------------- per-round objects
  const roundGroup = new THREE.Group();
  scene.add(roundGroup);
  let crates = new Map<number, THREE.Mesh>();
  let bombMeshes = new Map<number, THREE.Group>();
  let powerMeshes = new Map<number, THREE.Mesh>();
  let flameMeshes: THREE.Group[] = [];
  let bombers: THREE.Group[] = [];
  const dying: { m: THREE.Object3D; t: number; kind: "crate" | "player" }[] = [];

  const clearRound = (): void => {
    for (const c of [...roundGroup.children]) roundGroup.remove(c);
    crates = new Map();
    bombMeshes = new Map();
    powerMeshes = new Map();
    flameMeshes = [];
    dying.length = 0;
  };

  // ---------------------------------------------------------------- camera
  shell.onResize(() => {
    const { w, h } = shell.size();
    camera.aspect = w / h;
    // Leave room at the sides for touch controls and at the top for the score chips.
    const needW = W + 2.6 + (shell.desktop ? 0 : 7);
    const needH = H + 2.6 + 2.2;
    const vFov = (camera.fov * Math.PI) / 180;
    const d = Math.max(needH / 2 / Math.tan(vFov / 2), needW / 2 / (Math.tan(vFov / 2) * camera.aspect));
    const elev = (70 * Math.PI) / 180;
    camera.position.set(0, Math.sin(elev) * d, Math.cos(elev) * d - 0.9);
    camera.lookAt(0, 0, -0.9);
    camera.updateProjectionMatrix();
  });

  // ---------------------------------------------------------------- state and controls
  let mode: Mode = { humans: 1, total: 4 };
  let game: Game = createGame(4, 1);
  const wins = [0, 0, 0, 0];
  let phase: "pick" | "countdown" | "play" | "roundover" | "over" = "pick";
  let countdown = 0;
  let roundTime = 0;
  let rng = mulberry32(Date.now() & 0xffff);
  let confetti: Confetti | null = null;
  let sticks: Joystick[] = [];
  let bombBtns: PadButton[] = [];
  const board = hud(root, { left: "50%", top: "max(10px, env(safe-area-inset-top))" }, true);

  const name = (p: number): string => (p < mode.humans ? PLAYER_NAMES[p] : `${PLAYER_NAMES[p]} 🤖`);
  const renderBoard = (): void => {
    for (let p = 0; p < 4; p++) {
      if (p >= mode.total) {
        board.set(`p${p}`, "");
        continue;
      }
      const dead = phase !== "pick" && !game.players[p]?.alive;
      board.set(`p${p}`, `<span style="color:${PLAYER_COLORS[p]}">●</span> ${name(p)} ${"⭐".repeat(wins[p]) || "·"}${dead ? " 💥" : ""}`, PLAYER_COLORS[p]);
    }
    for (const c of board.el.children) (c as HTMLElement).style.display = (c as HTMLElement).innerHTML ? "" : "none";
  };

  const buildControls = (): void => {
    sticks.forEach((s) => s.dispose());
    bombBtns.forEach((b) => b.dispose());
    sticks = [];
    bombBtns = [];
    if (shell.desktop) return;
    const edge = "max(14px, env(safe-area-inset-left))";
    const layouts: { stick: Record<string, string>; bomb: Record<string, string> }[] =
      mode.humans === 1
        ? [{ stick: { left: edge, bottom: "16px" }, bomb: { right: edge, bottom: "22px" } }]
        : [
            { stick: { left: edge, bottom: "14px" }, bomb: { left: edge, bottom: "calc(14px + 26vmin)" } },
            { stick: { right: edge, bottom: "14px" }, bomb: { right: edge, bottom: "calc(14px + 26vmin)" } },
            { stick: { left: edge, top: "64px" }, bomb: { left: "calc(14px + 22vmin)", top: "64px" } },
            { stick: { right: edge, top: "64px" }, bomb: { right: "calc(14px + 22vmin)", top: "64px" } },
          ];
    for (let p = 0; p < mode.humans; p++) {
      const l = layouts[p];
      sticks.push(addJoystick(root, l.stick, PLAYER_COLORS[p], mode.humans > 2 ? 1.05 : 1.25));
      bombBtns.push(addPadButton(root, l.bomb, "💣", PLAYER_COLORS[p], mode.humans > 2 ? 0.9 : 1.05));
    }
  };

  const newRound = (): void => {
    clearRound();
    game = createGame(mode.total, Math.floor(rng() * 1e9));
    for (let i = 0; i < W * H; i++) {
      if (game.cells[i] === CRATE) {
        const m = new THREE.Mesh(crateGeo, crateMat);
        m.position.set(wx(cx(i)), 0.4, wz(cy(i)));
        roundGroup.add(shadowed(m));
        crates.set(i, m);
      }
    }
    bombers = game.players.map((p) => {
      const m = makeBomber(PLAYER_HEX[p.id]);
      m.position.set(wx(p.x), 0, wz(p.y));
      roundGroup.add(m);
      return m;
    });
    roundTime = 0;
    phase = "countdown";
    countdown = 2.4;
    renderBoard();
    toast(root, "3", 500);
    window.setTimeout(() => phase === "countdown" && toast(root, "2", 500), 800);
    window.setTimeout(() => phase === "countdown" && toast(root, "1", 500), 1600);
  };

  const startMatch = (): void => {
    wins.fill(0);
    confetti?.dispose();
    confetti = null;
    buildControls();
    newRound();
  };

  const choose = async (): Promise<void> => {
    phase = "pick";
    mode = await showPicker<Mode>(root, {
      title: "Bomb Blast 💣",
      subtitle: shell.desktop
        ? "Drop bombs to break crates and catch the others in the blast!\nRed: W A S D + Space · Blue: arrows + Enter · Green: I J K L + O · Yellow: numpad 8 4 5 6 + 0"
        : "Drop bombs to break crates and catch the others in the blast!\nLast one standing wins the round. First to 3 rounds wins.",
      options: [
        { label: "🤖 vs 1 Computer", sub: "1 player", color: "#16a34a", value: { humans: 1, total: 2 } },
        { label: "🤖 vs 3 Computers", sub: "1 player", color: "#7c3aed", value: { humans: 1, total: 4 } },
        { label: "👫 2 Players", sub: "same device", color: "#0369a1", value: { humans: 2, total: 2 } },
        { label: "👫 2 Players + 2 🤖", sub: "same device", color: "#ea580c", value: { humans: 2, total: 4 } },
        { label: "👨‍👩‍👧‍👦 4 Players", sub: "same device", color: "#db2777", value: { humans: 4, total: 4 } },
      ],
    });
    gameAudio.unlock();
    gameAudio.startMusic();
    startMatch();
  };

  const endRound = (): void => {
    phase = "roundover";
    const left = alive(game);
    const winner = left.length === 1 ? left[0] : -1;
    if (winner >= 0) wins[winner] += 1;
    renderBoard();
    if (winner >= 0) toast(root, `${name(winner)} wins the round!`, 1200, PLAYER_COLORS[winner]);
    else toast(root, "Draw!", 1000);
    window.setTimeout(() => {
      if (phase !== "roundover") return;
      if (winner >= 0 && wins[winner] >= WINS_NEEDED) {
        phase = "over";
        gameAudio.stopMusic();
        confetti = new Confetti(scene, new THREE.Vector3(wx(game.players[winner].x), 0, wz(game.players[winner].y)), 7);
        const human = winner < mode.humans;
        showGameOver(root, {
          title: human ? `${PLAYER_NAMES[winner]} wins! 🎉` : `${PLAYER_NAMES[winner]} (computer) wins`,
          detail: game.players
            .map((p) => `${name(p.id)} ${wins[p.id]}`)
            .join("  ·  "),
          onAgain: () => {
            gameAudio.startMusic();
            startMatch();
          },
          onMenu: onExit,
        });
      } else newRound();
    }, 1700);
  };

  // ---------------------------------------------------------------- frame loop
  shell.onFrame((dt, t) => {
    if (phase === "countdown") {
      countdown -= dt;
      if (countdown <= 0) {
        phase = "play";
        toast(root, "GO!", 500, "#facc15");
      }
    }
    if (phase === "play" || phase === "roundover") {
      roundTime += dt;
      // humans
      for (let p = 0; p < mode.humans; p++) {
        let v = keyVec(keys, p);
        const s = sticks[p]?.vec();
        if (s && (s.x || s.y)) v = { x: Math.abs(s.x) > 0.35 ? Math.sign(s.x) : 0, y: Math.abs(s.y) > 0.35 ? Math.sign(s.y) : 0 };
        const wantBomb = keys.pressed(KEYMAPS[p].act) || (bombBtns[p]?.pressed() ?? false);
        if (wantBomb && phase === "play" && placeBomb(game, p)) gameAudio.jump();
        handle(movePlayer(game, p, v.x, v.y, dt));
      }
      // computers
      for (let p = mode.humans; p < mode.total; p++) {
        const a = aiInput(game, p, rng);
        if (a.bomb && phase === "play" && placeBomb(game, p)) gameAudio.jump();
        handle(movePlayer(game, p, a.dx, a.dy, dt));
      }
      handle(tick(game, dt));
      if (phase === "play" && (alive(game).length <= 1 || roundTime > ROUND_LIMIT)) {
        if (roundTime > ROUND_LIMIT) game.players.forEach((p) => (p.alive = false));
        phase = "roundover";
        // Let the last blast finish before announcing the round.
        window.setTimeout(endRound, 900);
      }
    }
    syncMeshes(dt, t);
    confetti?.update(dt);
    renderer.render(scene, camera);
  });

  function handle(events: ReturnType<typeof tick>): void {
    for (const e of events) {
      if (e.type === "explode") {
        gameAudio.hit();
        for (const c of e.cells) {
          const f = new THREE.Group();
          const outer = new THREE.Mesh(flameGeo, flameMat);
          const inner = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.5), flameCore);
          f.add(outer, inner);
          f.position.set(wx(cx(c)), 0.3, wz(cy(c)));
          f.userData.life = 0.55;
          roundGroup.add(f);
          flameMeshes.push(f);
        }
      } else if (e.type === "crate") {
        const m = crates.get(e.cell);
        if (m) {
          crates.delete(e.cell);
          dying.push({ m, t: 0, kind: "crate" });
        }
      } else if (e.type === "dead") {
        gameAudio.slash();
        renderBoard();
        const m = bombers[e.player];
        if (m) dying.push({ m, t: 0, kind: "player" });
      } else if (e.type === "pickup") {
        gameAudio.coin();
        renderBoard();
      }
    }
  }

  function syncMeshes(dt: number, t: number): void {
    // bombs
    const live = new Set(game.bombs.map((b) => b.cell));
    for (const [cell, m] of bombMeshes) {
      if (!live.has(cell)) {
        roundGroup.remove(m);
        bombMeshes.delete(cell);
      }
    }
    for (const b of game.bombs) {
      let m = bombMeshes.get(b.cell);
      if (!m) {
        m = new THREE.Group();
        const body = new THREE.Mesh(bombGeo, bombMat);
        body.position.y = 0.32;
        const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.16, 8), mat(0x92400e));
        fuse.position.y = 0.68;
        const spark = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), sparkMat);
        spark.position.y = 0.78;
        spark.name = "spark";
        m.add(shadowed(body), fuse, spark);
        m.position.set(wx(cx(b.cell)), 0, wz(cy(b.cell)));
        roundGroup.add(m);
        bombMeshes.set(b.cell, m);
      }
      const pulse = 1 + Math.sin(t * (8 + (2.5 - b.timer) * 8)) * 0.07 * (1 + (2.5 - b.timer));
      m.scale.setScalar(pulse);
      const spark = m.getObjectByName("spark");
      if (spark) spark.scale.setScalar(0.7 + Math.random() * 0.8);
    }
    // power-ups
    for (const [cell, m] of powerMeshes) {
      if (!game.powers.has(cell)) {
        roundGroup.remove(m);
        powerMeshes.delete(cell);
      }
    }
    for (const [cell, pw] of game.powers) {
      let m = powerMeshes.get(cell);
      if (!m) {
        m = new THREE.Mesh(new THREE.CircleGeometry(0.36, 28), new THREE.MeshBasicMaterial({ map: powerTex[pw], transparent: true, side: THREE.DoubleSide }));
        m.position.set(wx(cx(cell)), 0.45, wz(cy(cell)));
        roundGroup.add(m);
        powerMeshes.set(cell, m);
      }
      m.position.y = 0.45 + Math.sin(t * 3 + cell) * 0.08;
      m.lookAt(camera.position);
    }
    // flames
    flameMeshes = flameMeshes.filter((f) => {
      f.userData.life -= dt;
      const life = f.userData.life as number;
      if (life <= 0) {
        roundGroup.remove(f);
        (f.children[1] as THREE.Mesh).geometry.dispose();
        return false;
      }
      const s = 0.6 + 0.4 * Math.sin((life / 0.55) * Math.PI);
      f.scale.set(s, 0.5 + s, s);
      return true;
    });
    // players
    for (const p of game.players) {
      const m = bombers[p.id];
      if (!m || !p.alive) continue;
      const x = p.x + (p.tx - p.x) * p.t;
      const y = p.y + (p.ty - p.y) * p.t;
      m.position.set(wx(x), Math.abs(Math.sin(p.t * Math.PI)) * 0.12, wz(y));
      const target = Math.atan2(p.dir[0], p.dir[1]);
      m.rotation.y += (((target - m.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 14);
    }
    // crates breaking, players falling
    for (let i = dying.length - 1; i >= 0; i--) {
      const d = dying[i];
      d.t += dt;
      if (d.kind === "crate") {
        d.m.scale.setScalar(Math.max(0.01, 1 - d.t * 3));
        d.m.rotation.y += dt * 8;
        if (d.t > 0.33) {
          roundGroup.remove(d.m);
          dying.splice(i, 1);
        }
      } else {
        d.m.rotation.z = Math.min(Math.PI / 2, d.t * 5);
        d.m.position.y = Math.max(-0.2, d.m.position.y - dt);
        if (d.t > 1.4) {
          roundGroup.remove(d.m);
          dying.splice(i, 1);
        }
      }
    }
  }

  addExitButton(root, onExit);
  void choose();

  return () => {
    gameAudio.stopMusic();
    sticks.forEach((s) => s.dispose());
    bombBtns.forEach((b) => b.dispose());
    confetti?.dispose();
    disposeScene(scene);
    for (const t of Object.values(powerTex)) t.dispose();
    crateTex.dispose();
    shell.dispose();
  };
}
