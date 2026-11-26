import Phaser from "phaser";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { gameAudio } from "../audio/sfx";
import { setTouchChrome } from "../input/touchChrome";
import { addMenuButton, FONT, pollEndTaps, resetTaps, showGameOver, showModePicker } from "../ui/arcadeKit";
import { chooseMove, Level } from "../games/chess/ai";
import { applyMove, Color, inCheck, legalMoves, Move, outcome, Piece, PieceType, Position, positionKey, squareName, startPosition } from "../games/chess/rules";

/** "easy" and "hard" play against the computer; "two" is pass-and-play on one iPad. */
type Mode = "easy" | "hard" | "two";

// Internal 3D render size. Phaser scales it to the 960 × 540 game canvas. Kept modest for iPad GPUs.
const RENDER_W = 1024;
const RENDER_H = 576;
const TEX_KEY = "chess3d";
const HOP_MS = 480;
const FLIP_EASE = 0.09;
/** Camera height and distance from the board centre (the view is 16:9). */
const CAM_HEIGHT = 12.5;
const CAM_DIST = 10.5;
const CAPTURE_MS = 380;

type Anim = { t0: number; dur: number; update: (p: number) => void; done?: () => void };

/** Three.js state, created once per scene visit and disposed on shutdown. */
type View = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  squares: THREE.Mesh[];
  pieces: Map<number, THREE.Group>;
  markers: THREE.Group;
  pieceGroup: THREE.Group;
  matWhite: THREE.MeshPhysicalMaterial;
  matBlack: THREE.MeshPhysicalMaterial;
  /** The WebGL canvas three.js draws into. */
  canvas: HTMLCanvasElement;
  /** A 2D copy of each frame, which Phaser can use as a texture. */
  copy: CanvasRenderingContext2D;
  texture: Phaser.Textures.CanvasTexture;
  image: Phaser.GameObjects.Image;
  pmrem: THREE.PMREMGenerator;
};

/** World position of a square. Row 0 (rank 8) is far from the White player, file a is on the left. */
const worldX = (i: number): number => (i & 7) - 3.5;
const worldZ = (i: number): number => (i >> 3) - 3.5;
const TOP_Y = 0.1;

/** Lathe profiles (radius, height) for the turned pieces. */
const PROFILES: Partial<Record<PieceType, [number, number][]>> = {
  p: [[0, 0], [0.32, 0], [0.36, 0.08], [0.22, 0.16], [0.15, 0.32], [0.2, 0.5], [0.12, 0.62], [0.26, 0.74], [0.26, 0.8], [0.14, 0.86], [0, 0.88]],
  r: [[0, 0], [0.34, 0], [0.36, 0.1], [0.24, 0.2], [0.22, 0.8], [0.3, 0.92], [0.3, 1.02], [0, 1.02]],
  b: [[0, 0], [0.34, 0], [0.36, 0.1], [0.2, 0.25], [0.16, 0.5], [0.28, 0.85], [0.22, 1.0], [0.1, 1.12], [0, 1.18]],
  q: [[0, 0], [0.34, 0], [0.36, 0.1], [0.2, 0.3], [0.18, 0.6], [0.3, 0.9], [0.34, 1.1], [0.2, 1.25], [0.1, 1.35], [0, 1.35]],
  k: [[0, 0], [0.34, 0], [0.36, 0.1], [0.2, 0.3], [0.18, 0.6], [0.3, 0.9], [0.34, 1.1], [0.2, 1.28], [0, 1.3]],
};

function buildPiece(p: Piece, mats: { matWhite: THREE.Material; matBlack: THREE.Material }): THREE.Group {
  const group = new THREE.Group();
  const mat = p.c === "w" ? mats.matWhite : mats.matBlack;
  const add = (geo: THREE.BufferGeometry, x = 0, y = 0, z = 0): THREE.Mesh => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  if (p.t === "n") {
    // Turned base, then a flat extruded horse head.
    const base = new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.32, 0), new THREE.Vector2(0.34, 0.1), new THREE.Vector2(0.26, 0.18), new THREE.Vector2(0, 0.2)], 40);
    add(base);
    const s = new THREE.Shape();
    s.moveTo(-0.3, 0.1);
    s.lineTo(0.3, 0.1);
    s.lineTo(0.3, 0.55);
    s.lineTo(0.22, 0.85);
    s.lineTo(0.46, 1.05);
    s.lineTo(0.36, 1.3);
    s.lineTo(-0.12, 1.32);
    s.lineTo(-0.32, 0.95);
    s.lineTo(-0.2, 0.62);
    s.lineTo(-0.34, 0.42);
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 6 });
    geo.translate(0, 0, -0.15);
    add(geo);
    return group;
  }

  const profile = PROFILES[p.t]!;
  add(new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 48));
  const top = profile[profile.length - 1][1];

  if (p.t === "r") {
    // Four merlons on the rim.
    for (const [x, z] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) {
      add(new THREE.BoxGeometry(0.16, 0.26, 0.16), x, top + 0.13, z);
    }
  } else if (p.t === "b") {
    add(new THREE.SphereGeometry(0.1, 20, 14), 0, top + 0.04, 0);
  } else if (p.t === "q") {
    add(new THREE.SphereGeometry(0.13, 20, 14), 0, top + 0.1, 0);
  } else if (p.t === "k") {
    add(new THREE.BoxGeometry(0.08, 0.34, 0.08), 0, top + 0.16, 0);
    add(new THREE.BoxGeometry(0.22, 0.08, 0.08), 0, top + 0.18, 0);
  } else if (p.t === "p") {
    add(new THREE.SphereGeometry(0.1, 16, 12), 0, top + 0.02, 0);
  }
  return group;
}

export class ChessScene extends Phaser.Scene {
  private mode: Mode = "easy";
  private pos: Position = startPosition();
  private history: string[] = [];
  private legal: Move[] = [];
  private selected: number | null = null;
  private lastMove: Move | null = null;
  private busy = false;
  private dead = false;
  private lockUntil = 0;
  private flipped = false;
  private moveAnims: Anim[] = [];
  private captured: Record<Color, number> = { w: 0, b: 0 };
  private view: View | null = null;
  private raycaster = new THREE.Raycaster();
  private status!: Phaser.GameObjects.Text;
  private detail!: Phaser.GameObjects.Text;
  private counts!: Phaser.GameObjects.Text;
  private hideMenu!: () => void;

  constructor() {
    super({ key: "Chess" });
  }

  init(): void {
    this.mode = "easy";
    this.pos = startPosition();
    this.history = [];
    this.legal = [];
    this.selected = null;
    this.lastMove = null;
    this.busy = false;
    this.dead = false;
    this.lockUntil = 0;
    this.flipped = false;
    this.moveAnims = [];
    this.captured = { w: 0, b: 0 };
    this.view = null;
    resetTaps();
  }

  create(): void {
    setTouchChrome("hidden");
    this.cameras.main.setBackgroundColor(0x0f172a);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.disposeView());

    this.hideMenu = addMenuButton(this, () => {
      if (!this.dead) this.scene.start("Menu");
    });

    const px = 700;
    this.status = this.add.text(px, 150, "", { fontFamily: FONT, fontSize: "24px", color: "#ffffff", fontStyle: "700" }).setOrigin(0, 0.5).setDepth(5);
    this.counts = this.add.text(px, 196, "", { fontFamily: FONT, fontSize: "17px", color: "#bfdbfe", wordWrap: { width: 240 } }).setOrigin(0, 0.5).setDepth(5);
    this.detail = this.add
      .text(px, 250, "", { fontFamily: FONT, fontSize: "17px", color: "#e0f2fe", lineSpacing: 6, wordWrap: { width: 240 } })
      .setOrigin(0, 0).setDepth(5);

    // Tap anywhere on the 3D view: raycast into the board.
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => this.onPointer(pointer));

    const webgl = this.createView();
    if (!webgl) {
      this.status.setText("3D needs WebGL");
      this.detail.setText("Your browser can't show the 3D board.\nTry Safari or Chrome on iPad,\nor play Checkers instead.");
      return;
    }

    showModePicker(
      this,
      "Chess ♟️",
      "Checkmate the king to win · tap a piece, then a green square\nPawns are crowned as Queens when they reach the far side",
      [
        { label: "🌱 Easy", sub: "vs computer", color: 0x16a34a, mode: "easy" },
        { label: "🚀 Challenge", sub: "vs computer", color: 0x7c3aed, mode: "hard" },
        { label: "👫 2 Players", sub: "same iPad", color: 0x0369a1, mode: "two" },
      ],
      (mode) => {
        this.mode = mode as Mode;
        gameAudio.unlock();
        gameAudio.startMusic();
        this.pos = startPosition();
        this.history = [];
        this.legal = legalMoves(this.pos);
        this.rebuildPieces();
        this.refreshMarkers();
        this.updatePanel();
      }
    );
  }

  // ---------------------------------------------------------------- 3D view

  /** Builds the three.js scene into an offscreen canvas that Phaser draws as a texture. Returns false without WebGL. */
  private createView(): boolean {
    const canvas = document.createElement("canvas");
    canvas.width = RENDER_W;
    canvas.height = RENDER_H;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    } catch {
      return false;
    }
    renderer.setPixelRatio(1);
    renderer.setSize(RENDER_W, RENDER_H, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    scene.background = makeBackdrop();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.7;

    const camera = new THREE.PerspectiveCamera(38, RENDER_W / RENDER_H, 0.1, 100);
    // Shift the view so the board sits on the left and leaves room for the side panel.
    camera.setViewOffset(RENDER_W, RENDER_H, RENDER_W * 0.12, 0, RENDER_W, RENDER_H);
    camera.position.set(0, CAM_HEIGHT, CAM_DIST);
    camera.lookAt(0, 0, 0);

    const hemi = new THREE.HemisphereLight(0xfff7ed, 0x1e293b, 0.6);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(4, 12, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -7;
    key.shadow.camera.right = 7;
    key.shadow.camera.top = 7;
    key.shadow.camera.bottom = -7;
    key.shadow.bias = -0.0005;
    scene.add(key);

    // Board: a wooden plinth with a rim, and 64 squares as separate meshes so they can be tapped.
    const board = new THREE.Group();
    const wood = new THREE.MeshPhysicalMaterial({ color: 0x5b3a1e, roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.3 });
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(9.3, 0.5, 9.3), wood);
    plinth.position.y = -0.25;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    board.add(plinth);
    const lightMat = new THREE.MeshPhysicalMaterial({ color: 0xf1e4c8, roughness: 0.42, clearcoat: 0.3 });
    const darkMat = new THREE.MeshPhysicalMaterial({ color: 0x6b4226, roughness: 0.42, clearcoat: 0.3 });
    const squareGeo = new THREE.BoxGeometry(1, 0.1, 1);
    const squares: THREE.Mesh[] = [];
    for (let i = 0; i < 64; i++) {
      const dark = ((i >> 3) + (i & 7)) % 2 === 1;
      const sq = new THREE.Mesh(squareGeo, dark ? darkMat : lightMat);
      sq.position.set(worldX(i), 0.05, worldZ(i));
      sq.receiveShadow = true;
      sq.userData.square = i;
      board.add(sq);
      squares.push(sq);
    }
    scene.add(board);

    const markers = new THREE.Group();
    scene.add(markers);
    const pieceGroup = new THREE.Group();
    scene.add(pieceGroup);

    const matWhite = new THREE.MeshPhysicalMaterial({ color: 0xf5efe0, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2 });
    const matBlack = new THREE.MeshPhysicalMaterial({ color: 0x1e2937, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.15 });

    // Phaser needs a 2D canvas for textures, and this one already holds a WebGL context.
    const flat = document.createElement("canvas");
    flat.width = RENDER_W;
    flat.height = RENDER_H;
    const copy = flat.getContext("2d");
    if (!copy) return false;
    const texture = this.textures.addCanvas(TEX_KEY, flat);
    if (!texture) return false;
    const image = this.add.image(480, 270, TEX_KEY).setDisplaySize(960, 540).setDepth(1);

    this.view = { renderer, scene, camera, squares, pieces: new Map(), markers, pieceGroup, matWhite, matBlack, canvas, copy, texture, image, pmrem };
    return true;
  }

  private disposeView(): void {
    const v = this.view;
    if (!v) return;
    this.moveAnims = [];
    v.pieceGroup.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    v.renderer.dispose();
    v.renderer.forceContextLoss();
    v.pmrem.dispose();
    if (this.textures.exists(TEX_KEY)) this.textures.remove(TEX_KEY);
    this.view = null;
  }

  /** Converts a tap in game coordinates to a board square, if any. */
  private onPointer(pointer: Phaser.Input.Pointer): void {
    const v = this.view;
    if (!v || this.dead) return;
    if (pointer.x > 660) return; // the side panel
    const ndc = new THREE.Vector2((pointer.x / 960) * 2 - 1, -(pointer.y / 540) * 2 + 1);
    this.raycaster.setFromCamera(ndc, v.camera);
    const targets: THREE.Object3D[] = [...v.squares];
    for (const g of v.pieces.values()) targets.push(g);
    const hit = this.raycaster.intersectObjects(targets, true)[0];
    if (!hit) return;
    let node: THREE.Object3D | null = hit.object;
    while (node && node.userData.square === undefined) node = node.parent;
    if (node && node.userData.square !== undefined) this.onSquare(node.userData.square as number);
    else {
      // A piece: find which group it belongs to.
      let g: THREE.Object3D | null = hit.object;
      while (g && !(g.userData.pieceSquare !== undefined)) g = g.parent;
      if (g) this.onSquare(g.userData.pieceSquare as number);
    }
  }

  /** Rebuilds all piece meshes from the current position. */
  private rebuildPieces(): void {
    const v = this.view;
    if (!v) return;
    v.pieceGroup.clear();
    v.pieces.clear();
    for (let i = 0; i < 64; i++) {
      const p = this.pos.board[i];
      if (!p) continue;
      const g = buildPiece(p, { matWhite: v.matWhite, matBlack: v.matBlack });
      g.position.set(worldX(i), TOP_Y, worldZ(i));
      g.userData.pieceSquare = i;
      v.pieceGroup.add(g);
      v.pieces.set(i, g);
    }
  }

  /** Highlights: the selected square, its legal targets, the last move and a check warning. */
  private refreshMarkers(): void {
    const v = this.view;
    if (!v) return;
    v.markers.clear();
    const add = (mesh: THREE.Object3D): void => {
      v.markers.add(mesh);
    };
    const boxGeo = new THREE.BoxGeometry(0.96, 0.02, 0.96);
    const dotGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.04, 28);
    const ringGeo = new THREE.TorusGeometry(0.4, 0.07, 12, 32);

    if (this.lastMove) {
      for (const sq of [this.lastMove.from, this.lastMove.to]) {
        const m = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.45 }));
        m.position.set(worldX(sq), 0.12, worldZ(sq));
        add(m);
      }
    }
    if (this.selected !== null) {
      const sq = this.selected;
      const m = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.6 }));
      m.position.set(worldX(sq), 0.12, worldZ(sq));
      add(m);
      for (const mv of this.legal) {
        if (mv.from !== sq) continue;
        const isCapture = !!mv.cap || !!mv.ep;
        const mesh = isCapture
          ? new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xef4444 }))
          : new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0x22c55e }));
        if (isCapture) mesh.rotation.x = Math.PI / 2;
        mesh.position.set(worldX(mv.to), isCapture ? 0.16 : 0.13, worldZ(mv.to));
        add(mesh);
      }
    }
    if (inCheck(this.pos, this.pos.turn) && !this.dead) {
      const k = this.pos.board.findIndex((p) => p && p.t === "k" && p.c === this.pos.turn);
      if (k >= 0) {
        const warn = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xdc2626, transparent: true, opacity: 0.7 }));
        warn.position.set(worldX(k), 0.12, worldZ(k));
        add(warn);
      }
    }
  }

  // ---------------------------------------------------------------- game flow

  private humanTurn(): boolean {
    return this.mode === "two" || this.pos.turn === "w";
  }

  private onSquare(i: number): void {
    if (this.busy || this.moveAnims.length > 0 || this.dead || !this.humanTurn()) return;
    const p = this.pos.board[i];
    if (p && p.c === this.pos.turn) {
      const canMove = this.legal.some((m) => m.from === i);
      this.selected = canMove ? i : null;
      this.refreshMarkers();
      this.updatePanel();
      return;
    }
    if (this.selected !== null) {
      const options = this.legal.filter((m) => m.from === this.selected && m.to === i);
      if (options.length > 0) {
        // Pawns reaching the far side are crowned as Queens.
        const move = options.find((m) => m.promo === "q") ?? options[0];
        this.selected = null;
        this.play(move);
        return;
      }
      this.selected = null;
      this.refreshMarkers();
      this.updatePanel();
    }
  }

  /** Animates a move, then updates the position and checks for the end of the game. */
  private play(m: Move): void {
    const v = this.view;
    const mover = this.pos.turn;
    const capIndex = m.ep ? (m.from & ~7) + (m.to & 7) : m.cap ? m.to : -1;
    if (capIndex >= 0 && this.pos.board[capIndex]) this.captured[mover] += 1;
    gameAudio.jump();

    const next = applyMove(this.pos, m);
    const before = this.history.slice();
    const finish = (): void => {
      this.pos = next;
      this.history.push(positionKey(next));
      this.lastMove = m;
      this.legal = legalMoves(next);
      this.rebuildPieces();
      this.refreshMarkers();
      this.afterMove(outcome(next, before));
    };

    if (!v) {
      finish();
      return;
    }

    // Captured pieces shrink away while the mover slides across.
    if (capIndex >= 0) {
      const captured = v.pieces.get(capIndex);
      if (captured) {
        const start = captured.position.clone();
        this.moveAnims.push({
          t0: this.time.now,
          dur: CAPTURE_MS,
          update: (p) => {
            captured.scale.setScalar(Math.max(0.01, 1 - p));
            captured.position.set(start.x, start.y - p * 0.4, start.z);
          },
        });
      }
    }

    // Move the piece (and the rook, when castling) along a hop arc.
    const moves: [number, number][] = [[m.from, m.to]];
    if (m.castle) {
      const rookFrom = m.to > m.from ? m.from + 3 : m.from - 4;
      const rookTo = m.to > m.from ? m.from + 1 : m.from - 1;
      moves.push([rookFrom, rookTo]);
    }
    let lastDone = true;
    for (const [from, to] of moves) {
      const g = v.pieces.get(from);
      if (!g) continue;
      v.pieces.delete(from);
      const x0 = worldX(from);
      const z0 = worldZ(from);
      const x1 = worldX(to);
      const z1 = worldZ(to);
      const hop = m.castle || m.cap || m.ep ? 0.7 : 0.45;
      lastDone = false;
      this.moveAnims.push({
        t0: this.time.now,
        dur: HOP_MS,
        update: (p) => {
          const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
          g.position.set(x0 + (x1 - x0) * e, TOP_Y + Math.sin(p * Math.PI) * hop, z0 + (z1 - z0) * e);
        },
        done: () => {
          g.position.set(x1, TOP_Y, z1);
        },
      });
    }
    if (lastDone) {
      this.moveAnims.push({ t0: this.time.now, dur: 1, update: () => undefined, done: () => undefined });
    }
    // Run the finish step once every animation in this move has ended.
    this.moveAnims.push({ t0: this.time.now + HOP_MS, dur: 1, update: () => undefined, done: finish });
  }

  private afterMove(result: ReturnType<typeof outcome>): void {
    if (result !== "ongoing") {
      this.finish(result);
      return;
    }
    if (this.mode === "two") this.flipped = this.pos.turn === "b";
    this.updatePanel();
    if (this.mode !== "two" && this.pos.turn === "b") {
      this.busy = true;
      this.time.delayedCall(550, () => this.aiTurn());
    }
  }

  private aiTurn(): void {
    if (this.dead) return;
    const level: Level = this.mode === "easy" ? "easy" : "hard";
    const move = chooseMove(this.pos, level);
    this.busy = false;
    this.play(move);
  }

  private finish(result: ReturnType<typeof outcome>): void {
    this.dead = true;
    this.busy = true;
    this.legal = [];
    this.selected = null;
    this.hideMenu();
    this.refreshMarkers();
    this.lockUntil = this.time.now + 900;
    gameAudio.stopMusic();

    let title = "It's a draw";
    let detail = "No one can win from here.";
    if (result === "checkmate") {
      // The side to move is checkmated, so the other side won.
      const winner: Color = this.pos.turn === "w" ? "b" : "w";
      if (this.mode === "two") {
        title = winner === "w" ? "White wins! 🎉" : "Black wins! 🎉";
        detail = "Checkmate!";
      } else {
        title = winner === "w" ? "Checkmate! You won 🎉" : "Checkmate · computer wins";
        detail = winner === "w" ? "Brilliant. The king had nowhere to hide." : "So close! Look for threats before you move.";
      }
      gameAudio.coin();
    } else if (result === "stalemate") {
      title = "Stalemate";
      detail = "Nobody can move, so it's a draw.";
    } else if (result === "fifty-move") {
      detail = "50 moves without a capture or a pawn move.";
    } else if (result === "repetition") {
      detail = "The same position came up three times.";
    } else if (result === "insufficient") {
      detail = "Not enough pieces left to checkmate.";
    }
    this.time.delayedCall(600, () => showGameOver(this, detail, () => this.scene.restart(), () => this.scene.start("Menu"), title));
  }

  private updatePanel(): void {
    const w = this.pos.turn === "w";
    const mine = this.countPieces("w");
    const theirs = this.countPieces("b");
    this.counts.setText(this.mode === "two" ? `White ⚪ ${mine} pieces\nBlack ⚫ ${theirs} pieces` : `You ⚪ ${mine} pieces\nComputer ⚫ ${theirs} pieces`);

    if (this.dead) {
      this.status.setText("Game over");
      this.detail.setText("");
      return;
    }
    const check = inCheck(this.pos, this.pos.turn) ? "  ⚠️ Check!" : "";
    const last = this.lastMove ? `Last move: ${squareName(this.lastMove.from)} → ${squareName(this.lastMove.to)}` : "White starts.";
    if (this.mode === "two") {
      this.status.setText(`${w ? "White" : "Black"}'s turn${check}`);
      this.detail.setText(`${w ? "" : "Pass the iPad to Black.\n"}${last}\nTap a piece, then a green square.`);
    } else if (w) {
      this.status.setText(`Your turn ⚪${check}`);
      this.detail.setText(`${last}\nTap a white piece, then a green square.`);
    } else {
      this.status.setText("Computer is thinking… ⚫");
      this.detail.setText(last);
    }
  }

  private countPieces(c: Color): number {
    return this.pos.board.reduce((n, p) => n + (p && p.c === c ? 1 : 0), 0);
  }

  update(time: number): void {
    const v = this.view;
    if (v) {
      // Run animations.
      for (let i = this.moveAnims.length - 1; i >= 0; i--) {
        const a = this.moveAnims[i];
        const p = Math.min(1, (time - a.t0) / a.dur);
        if (time < a.t0) continue;
        a.update(p);
        if (p >= 1) {
          this.moveAnims.splice(i, 1);
          a.done?.();
        }
      }
      // Board turns to face the player who is about to move (pass-and-play).
      const goal = this.flipped ? new THREE.Vector3(0, CAM_HEIGHT, -CAM_DIST) : new THREE.Vector3(0, CAM_HEIGHT, CAM_DIST);
      v.camera.position.lerp(goal, FLIP_EASE);
      v.camera.lookAt(0, 0, 0);
      // The king in check pulses.
      v.markers.children.forEach((m, idx) => {
        const s = 1 + Math.sin(time / 180 + idx) * 0.03;
        m.scale.set(s, 1, s);
      });

      v.renderer.render(v.scene, v.camera);
      v.copy.drawImage(v.canvas, 0, 0);
      v.texture.refresh();
    }

    if (this.dead && time >= this.lockUntil) {
      const tap = pollEndTaps();
      if (tap === "restart") this.scene.restart();
      else if (tap === "menu") this.scene.start("Menu");
    }
  }
}

/** A soft vertical gradient for the 3D background, drawn once. */
function makeBackdrop(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#1e3a8a");
  g.addColorStop(1, "#0f172a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
