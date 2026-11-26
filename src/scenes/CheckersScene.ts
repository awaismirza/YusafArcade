import Phaser from "phaser";
import * as THREE from "three";
import { gameAudio } from "../audio/sfx";
import { setTouchChrome } from "../input/touchChrome";
import { addMenuButton, pollEndTaps, resetTaps, showGameOver, showModePicker } from "../ui/arcadeKit";
import { AnimQueue, easeInOut, easeOutBack } from "../ui/animQueue";
import { Hud } from "../ui/hud";
import { findUserData, ThreeStage } from "../ui/threeStage";
import { BoardCamera, buildBoard8, cellX, cellZ, Markers8, TOP_Y } from "../games/shared/board8";
import { applyMove, Board, chooseMove, countPieces, crowns, legalMoves, Level, Move, other, Piece, QUIET_LIMIT, Side, startBoard, BLACK, WHITE } from "../games/checkers/rules";

/** "easy" and "hard" play against the computer; "two" is pass-and-play on one iPad. */
type Mode = "easy" | "hard" | "two";

const TEX_KEY = "checkers3d";
const STEP_MS = 340;
const sideName = (s: Side): string => (s === "w" ? "White" : "Black");

/** Disc profile (radius, height): rounded rim with a shallow groove on top. */
const DISC: [number, number][] = [[0, 0], [0.4, 0], [0.43, 0.03], [0.43, 0.16], [0.39, 0.2], [0.31, 0.2], [0.29, 0.17], [0.22, 0.17], [0.2, 0.2], [0, 0.2]];
const DISC_H = 0.2;

export class CheckersScene extends Phaser.Scene {
  private board: Board = [];
  private mode: Mode = "easy";
  private turn: Side = WHITE;
  private flipped = false;
  private legal: Move[] = [];
  /** Selected piece as board index (row * 8 + col). */
  private sel: number | null = null;
  private lastMove: Move | null = null;
  private justCrowned: number | null = null;
  private quiet = 0;
  private busy = false;
  private dead = false;
  private lockUntil = 0;
  private readyAt = 0;
  private captures: Record<Side, number> = { w: 0, b: 0 };

  private stage: ThreeStage | null = null;
  private squares: THREE.Mesh[] = [];
  private pieces = new Map<number, THREE.Group>();
  private pieceGroup = new THREE.Group();
  private markers = new Markers8();
  private camCtl: BoardCamera | null = null;
  private mats: { white: THREE.Material; black: THREE.Material; gold: THREE.Material } | null = null;
  private discGeo: THREE.BufferGeometry | null = null;
  private queue = new AnimQueue();
  private hud!: Hud;
  private hideMenu!: () => void;

  constructor() {
    super({ key: "Checkers" });
  }

  init(): void {
    this.board = [];
    this.mode = "easy";
    this.turn = WHITE;
    this.flipped = false;
    this.legal = [];
    this.sel = null;
    this.lastMove = null;
    this.justCrowned = null;
    this.quiet = 0;
    this.busy = false;
    this.dead = false;
    this.lockUntil = 0;
    this.readyAt = Number.POSITIVE_INFINITY;
    this.captures = { w: 0, b: 0 };
    this.stage = null;
    this.squares = [];
    this.pieces = new Map();
    this.pieceGroup = new THREE.Group();
    this.markers = new Markers8();
    this.camCtl = null;
    this.discGeo = null;
    this.queue = new AnimQueue();
    resetTaps();
  }

  create(): void {
    setTouchChrome("hidden");
    this.cameras.main.setBackgroundColor(0x0f172a);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.queue.clear();
      this.stage?.dispose();
      this.stage = null;
    });

    this.hideMenu = addMenuButton(this, () => {
      if (!this.dead) this.scene.start("Menu");
    });

    this.stage = ThreeStage.create(this, { key: TEX_KEY, backdrop: ["#14532d", "#052e16"] });
    this.hud = new Hud(this);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => this.onPointer(pointer));

    if (!this.stage) {
      this.hud.setStatus("3D needs WebGL");
      this.hud.setDetail("Your browser can't show the 3D board.\nTry Safari or Chrome on iPad.");
      return;
    }
    this.buildWorld(this.stage);

    showModePicker(
      this,
      "Checkers ⚫",
      "Move diagonally · jump over a piece to capture it\nReach the far side to crown a King 👑",
      [
        { label: "🌱 Easy", sub: "vs computer", color: 0x16a34a, mode: "easy" },
        { label: "🚀 Challenge", sub: "vs computer", color: 0x7c3aed, mode: "hard" },
        { label: "👫 2 Players", sub: "same iPad", color: 0x0369a1, mode: "two" },
      ],
      (mode) => {
        this.mode = mode as Mode;
        gameAudio.unlock();
        gameAudio.startMusic();
        this.board = startBoard();
        this.turn = WHITE;
        this.legal = legalMoves(this.board, WHITE);
        this.readyAt = this.time.now + 300;
        this.rebuildPieces();
        this.refreshMarkers();
        this.updateHud();
      }
    );
  }

  private buildWorld(stage: ThreeStage): void {
    const { group, squares } = buildBoard8({ light: 0xeedcb0, dark: 0x6b4423, plinth: 0x4a2c14 });
    this.squares = squares;
    stage.scene.add(group, this.markers.group, this.pieceGroup);
    this.mats = {
      white: new THREE.MeshPhysicalMaterial({ color: 0xf3ecdc, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.18 }),
      black: new THREE.MeshPhysicalMaterial({ color: 0x232328, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.14 }),
      gold: new THREE.MeshPhysicalMaterial({ color: 0xfacc15, roughness: 0.25, metalness: 0.7, clearcoat: 0.5 }),
    };
    this.discGeo = new THREE.LatheGeometry(DISC.map(([x, y]) => new THREE.Vector2(x, y)), 48);
    this.camCtl = new BoardCamera(stage.camera);
  }

  /** Builds one piece: a disc, or two stacked discs with a gold ring for a king. */
  private makePiece(p: Piece): THREE.Group {
    const g = new THREE.Group();
    const mat = p.c === "w" ? this.mats!.white : this.mats!.black;
    const disc = (y: number): void => {
      const m = new THREE.Mesh(this.discGeo!, mat);
      m.position.y = y;
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    };
    disc(0);
    if (p.k) {
      disc(DISC_H + 0.005);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 12, 36), this.mats!.gold);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = DISC_H * 2 + 0.01;
      ring.castShadow = true;
      g.add(ring);
    }
    return g;
  }

  private onPointer(pointer: Phaser.Input.Pointer): void {
    const stage = this.stage;
    if (!stage || this.dead || this.time.now < this.readyAt) return;
    const hit = stage.pick(pointer.x, pointer.y, [...this.squares, ...this.pieces.values()]);
    if (!hit) return;
    const sq = findUserData<number>(hit.object, "square") ?? findUserData<number>(hit.object, "pieceSquare");
    if (sq !== undefined) this.onSquare(sq >> 3, sq & 7);
  }

  private rebuildPieces(): void {
    if (!this.mats) return;
    this.pieceGroup.clear();
    this.pieces.clear();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r]?.[c];
        if (!p) continue;
        const i = r * 8 + c;
        const g = this.makePiece(p);
        g.position.set(cellX(c), TOP_Y, cellZ(r));
        g.userData.pieceSquare = i;
        this.pieceGroup.add(g);
        this.pieces.set(i, g);
        if (this.justCrowned === i) {
          g.scale.setScalar(0.5);
          this.queue.add(this.time.now, { dur: 520, update: (t) => g.scale.setScalar(0.5 + 0.5 * easeOutBack(t)) });
        }
      }
    }
    this.justCrowned = null;
  }

  private refreshMarkers(): void {
    const m = this.markers;
    m.clear();
    if (this.lastMove) {
      const [fr, fc] = this.lastMove.from;
      const [tr, tc] = this.lastMove.path[this.lastMove.path.length - 1];
      m.tile(fr, fc, 0x60a5fa, 0.45);
      m.tile(tr, tc, 0x60a5fa, 0.45);
    }
    if (this.humanTurn() && !this.dead && this.legal.length > 0 && this.legal[0].caps.length > 0) {
      // Jumping is compulsory: ring the pieces that must jump.
      const seen = new Set<number>();
      for (const mv of this.legal) {
        const k = mv.from[0] * 8 + mv.from[1];
        if (seen.has(k)) continue;
        seen.add(k);
        m.ring(mv.from[0], mv.from[1]);
      }
    }
    if (this.sel !== null) {
      const sr = this.sel >> 3;
      const sc = this.sel & 7;
      m.tile(sr, sc, 0xfde047, 0.6);
      for (const mv of this.legal) {
        if (mv.from[0] !== sr || mv.from[1] !== sc) continue;
        const [er, ec] = mv.path[mv.path.length - 1];
        m.dot(er, ec);
      }
    }
  }

  // ---------------------------------------------------------------- game flow

  /** Whoever is moving can act. In two-player mode both sides are human. */
  private humanTurn(): boolean {
    return this.mode === "two" || this.turn === WHITE;
  }

  private onSquare(r: number, c: number): void {
    if (this.busy || this.queue.busy || this.dead || !this.humanTurn()) return;
    const p = this.board[r][c];

    if (p && p.c === this.turn) {
      const canMove = this.legal.some((m) => m.from[0] === r && m.from[1] === c);
      this.sel = canMove ? r * 8 + c : null;
      this.refreshMarkers();
      this.updateHud();
      return;
    }

    if (this.sel !== null) {
      const sr = this.sel >> 3;
      const sc = this.sel & 7;
      const options = this.legal.filter((m) => {
        const end = m.path[m.path.length - 1];
        return m.from[0] === sr && m.from[1] === sc && end[0] === r && end[1] === c;
      });
      if (options.length > 0) {
        // Several routes can end on the same square: take the one that captures most.
        const best = options.reduce((a, b) => (b.caps.length > a.caps.length ? b : a));
        this.sel = null;
        this.makeMove(best, this.turn);
        return;
      }
      this.sel = null;
      this.refreshMarkers();
      this.updateHud();
    }
  }

  private makeMove(m: Move, by: Side): void {
    const becomesKing = crowns(this.board, m);
    this.captures[by] += m.caps.length;
    const lastSq = m.path[m.path.length - 1];
    const next = applyMove(this.board, m);
    this.quiet = m.caps.length === 0 && !becomesKing ? this.quiet + 1 : 0;
    gameAudio.jump();

    const finish = (): void => {
      this.board = next;
      this.lastMove = m;
      this.justCrowned = becomesKing ? lastSq[0] * 8 + lastSq[1] : null;
      this.markers.clear();
      this.rebuildPieces();
      this.refreshMarkers();
      this.afterMove(by);
    };

    const stage = this.stage;
    const mover = this.pieces.get(m.from[0] * 8 + m.from[1]);
    if (!stage || !mover) {
      finish();
      return;
    }
    this.markers.clear();
    this.pieces.delete(m.from[0] * 8 + m.from[1]);

    // One hop per square of the route. Each jump removes the piece it passes over as the mover lands.
    const route: { x: number; z: number; cap?: THREE.Group }[] = m.path.map(([r, c], i) => {
      const cap = m.caps[i];
      return { x: cellX(c), z: cellZ(r), cap: cap ? this.pieces.get(cap[0] * 8 + cap[1]) : undefined };
    });
    let px = mover.position.x;
    let pz = mover.position.z;
    this.queue.chain(
      this.time.now,
      route.map((leg) => () => {
        const x0 = px;
        const z0 = pz;
        px = leg.x;
        pz = leg.z;
        const parts = [
          {
            dur: STEP_MS,
            update: (p: number) => {
              const e = easeInOut(p);
              mover.position.set(x0 + (leg.x - x0) * e, TOP_Y + Math.sin(p * Math.PI) * (leg.cap ? 0.7 : 0.4), z0 + (leg.z - z0) * e);
            },
          },
        ];
        if (leg.cap) {
          const cap = leg.cap;
          parts.push({
            dur: STEP_MS,
            update: (p: number) => {
              const s = Math.max(0.01, 1 - Math.max(0, p - 0.4) / 0.6);
              cap.scale.setScalar(s);
              cap.position.y = TOP_Y + (1 - s) * 0.3;
            },
          });
        }
        return parts;
      }),
      finish
    );
  }

  private afterMove(by: Side): void {
    const next = other(by);
    const nextMoves = legalMoves(this.board, next);

    if (nextMoves.length === 0) {
      this.finish(by);
      return;
    }
    if (this.quiet >= QUIET_LIMIT) {
      this.finish(null);
      return;
    }

    this.turn = next;
    this.legal = nextMoves;
    // Pass-and-play: turn the board to face the player who is about to move.
    if (this.mode === "two" && this.camCtl) {
      this.flipped = next === BLACK;
      this.camCtl.flipped = this.flipped;
    }

    if (this.mode !== "two" && next === BLACK) {
      this.legal = [];
      this.busy = true;
      this.refreshMarkers();
      this.updateHud();
      this.time.delayedCall(450, () => this.aiTurn());
    } else {
      this.refreshMarkers();
      this.updateHud();
    }
  }

  private aiTurn(): void {
    if (this.dead) return;
    const level: Level = this.mode === "easy" ? "easy" : "hard";
    const move = chooseMove(this.board, level);
    this.busy = false;
    this.makeMove(move, BLACK);
  }

  /** winner is the side that just won; null means a draw. */
  private finish(winner: Side | null): void {
    this.dead = true;
    this.busy = true;
    this.legal = [];
    this.sel = null;
    this.hideMenu();
    this.refreshMarkers();
    this.hud.setVisible(false);
    this.lockUntil = this.time.now + 900;

    let title = "It's a draw";
    let detail = "Too many moves without a jump or a crown.";
    if (winner === WHITE) {
      title = this.mode === "two" ? "White wins! 🎉" : "You won! 🎉";
      detail = `White captured ${this.captures.w} piece${this.captures.w === 1 ? "" : "s"}`;
      gameAudio.coin();
    } else if (winner === BLACK) {
      title = this.mode === "two" ? "Black wins! 🎉" : "Computer wins";
      detail = this.mode === "two" ? `Black captured ${this.captures.b} piece${this.captures.b === 1 ? "" : "s"}` : "So close! Try again and look for jumps first.";
      if (this.mode === "two") gameAudio.coin();
    }
    gameAudio.stopMusic();
    this.time.delayedCall(450, () => showGameOver(this, detail, () => this.scene.restart(), () => this.scene.start("Menu"), title));
  }

  private updateHud(): void {
    this.hud.setCounts(`⚪ ${countPieces(this.board, WHITE)}   ⚫ ${countPieces(this.board, BLACK)}`);
    if (this.dead) return;
    const mustJump = this.humanTurn() && this.legal.length > 0 && this.legal[0].caps.length > 0;

    if (this.mode === "two") {
      this.hud.setStatus(`${sideName(this.turn)}'s turn ${this.turn === WHITE ? "⚪" : "⚫"}`);
      const pass = this.turn === BLACK ? "Pass the iPad to Black.  " : "";
      this.hud.setDetail(
        this.sel !== null
          ? "Tap a green dot to move there."
          : mustJump
            ? `${pass}You must jump! Tap a red-ringed piece.`
            : `${pass}Tap one of your pieces, then a green dot.`
      );
      return;
    }
    if (this.turn === WHITE) {
      this.hud.setStatus("Your turn ⚪");
      this.hud.setDetail(
        this.sel !== null
          ? "Tap a green dot to move there."
          : mustJump
            ? "You must jump! Tap a red-ringed piece."
            : "Tap a white piece, then a green dot. Kings 👑 can move backwards too."
      );
    } else {
      this.hud.setStatus("Computer is thinking… ⚫");
      this.hud.setDetail("Blue squares show its last move.");
    }
  }

  update(time: number): void {
    const stage = this.stage;
    if (stage) {
      this.queue.update(time);
      this.camCtl?.update();
      this.markers.pulse(time);
      stage.render();
    }
    if (this.dead && time >= this.lockUntil) {
      const tap = pollEndTaps();
      if (tap === "restart") this.scene.restart();
      else if (tap === "menu") this.scene.start("Menu");
    }
  }
}
