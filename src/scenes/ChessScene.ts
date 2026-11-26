import Phaser from "phaser";
import { winBurst } from "../ui/fx";
import * as THREE from "three";
import { gameAudio } from "../audio/sfx";
import { setTouchChrome } from "../input/touchChrome";
import { addMenuButton, pollEndTaps, resetTaps, showGameOver, showModePicker } from "../ui/arcadeKit";
import { AnimQueue, easeInOut } from "../ui/animQueue";
import { Hud } from "../ui/hud";
import { findUserData, ThreeStage } from "../ui/threeStage";
import { addBoardControls } from "../ui/boardControls";
import { BoardCamera, buildBoard8, cellX, cellZ, Markers8, TOP_Y } from "../games/shared/board8";
import { chooseMove, Level } from "../games/chess/ai";
import { applyMove, Color, inCheck, legalMoves, Move, outcome, Position, positionKey, squareName, startPosition } from "../games/chess/rules";
import { buildChessPiece, CHESS_PALETTE, ChessMaterials, makeChessMaterials } from "../games/chess/pieces3d";

/** "easy" and "hard" play against the computer; "two" is pass-and-play on one iPad. */
type Mode = "easy" | "hard" | "two";

const TEX_KEY = "chess3d";
const HOP_MS = 480;
const CAPTURE_MS = 380;

const sqX = (i: number): number => cellX(i & 7);
const sqZ = (i: number): number => cellZ(i >> 3);

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
  private readyAt = 0;
  private flipped = false;

  private stage: ThreeStage | null = null;
  private squares: THREE.Mesh[] = [];
  private pieces = new Map<number, THREE.Group>();
  private pieceGroup = new THREE.Group();
  private markers = new Markers8();
  private camCtl: BoardCamera | null = null;
  private mats: ChessMaterials | null = null;
  private queue = new AnimQueue();
  private hud!: Hud;
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
    this.readyAt = Number.POSITIVE_INFINITY;
    this.flipped = false;
    this.stage = null;
    this.squares = [];
    this.pieces = new Map();
    this.pieceGroup = new THREE.Group();
    this.markers = new Markers8();
    this.camCtl = null;
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

    this.stage = ThreeStage.create(this, { key: TEX_KEY, exposure: 0.85, backdrop: ["#33407a", "#0b0f24"] });
    this.hud = new Hud(this);

    if (!this.stage) {
      this.hud.setStatus("3D needs WebGL");
      this.hud.setDetail("Your browser can't show the 3D board.\nTry Safari or Chrome on iPad, or play Checkers instead.");
      return;
    }
    this.buildWorld(this.stage);

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
        this.readyAt = this.time.now + 300;
        this.rebuildPieces();
        this.refreshMarkers();
        this.updateHud();
      }
    );
  }

  /** Builds the board, lights and camera. */
  private buildWorld(stage: ThreeStage): void {
    const { group, squares } = buildBoard8({ light: CHESS_PALETTE.lightSquare, dark: CHESS_PALETTE.darkSquare, plinth: CHESS_PALETTE.plinth });
    this.squares = squares;
    stage.scene.add(group, this.markers.group, this.pieceGroup);
    this.mats = makeChessMaterials();
    this.camCtl = new BoardCamera(stage.camera, 9.8, 11.2, 0.5);
    addBoardControls(this, this.camCtl.rig, (x, y) => this.onTap(x, y));
  }

  /** Converts a tap in game coordinates to a board square, if any. */
  private onTap(x: number, y: number): void {
    const stage = this.stage;
    if (!stage || this.dead || this.time.now < this.readyAt) return;
    const hit = stage.pick(x, y, [...this.squares, ...this.pieces.values()]);
    if (!hit) return;
    const sq = findUserData<number>(hit.object, "square") ?? findUserData<number>(hit.object, "pieceSquare");
    if (sq !== undefined) this.onSquare(sq);
  }

  /** Rebuilds all piece meshes from the current position. */
  private rebuildPieces(): void {
    if (!this.mats) return;
    this.pieceGroup.clear();
    this.pieces.clear();
    for (let i = 0; i < 64; i++) {
      const p = this.pos.board[i];
      if (!p) continue;
      const g = buildChessPiece(p, this.mats);
      g.position.set(sqX(i), TOP_Y, sqZ(i));
      g.userData.pieceSquare = i;
      this.pieceGroup.add(g);
      this.pieces.set(i, g);
    }
  }

  /** Highlights: the selected square, its legal targets, the last move and a check warning. */
  private refreshMarkers(): void {
    const m = this.markers;
    m.clear();
    if (this.lastMove) {
      for (const sq of [this.lastMove.from, this.lastMove.to]) m.tile(sq >> 3, sq & 7, 0x60a5fa, 0.45);
    }
    if (this.selected !== null) {
      const sq = this.selected;
      m.tile(sq >> 3, sq & 7, 0xfde047, 0.6);
      for (const mv of this.legal) {
        if (mv.from !== sq) continue;
        if (mv.cap || mv.ep) m.ring(mv.to >> 3, mv.to & 7);
        else m.dot(mv.to >> 3, mv.to & 7);
      }
    }
    if (!this.dead && inCheck(this.pos, this.pos.turn)) {
      const k = this.pos.board.findIndex((p) => p && p.t === "k" && p.c === this.pos.turn);
      if (k >= 0) m.tile(k >> 3, k & 7, 0xdc2626, 0.7);
    }
  }

  // ---------------------------------------------------------------- game flow

  private humanTurn(): boolean {
    return this.mode === "two" || this.pos.turn === "w";
  }

  private onSquare(i: number): void {
    if (this.busy || this.queue.busy || this.dead || !this.humanTurn()) return;
    const p = this.pos.board[i];
    if (p && p.c === this.pos.turn) {
      const canMove = this.legal.some((m) => m.from === i);
      this.selected = canMove ? i : null;
      this.refreshMarkers();
      this.updateHud();
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
      this.updateHud();
    }
  }

  /** Animates a move, then updates the position and checks for the end of the game. */
  private play(m: Move): void {
    const stage = this.stage;
    const capIndex = m.ep ? (m.from & ~7) + (m.to & 7) : m.cap ? m.to : -1;
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

    if (!stage) {
      finish();
      return;
    }
    const now = this.time.now;

    // A captured piece shrinks away while the mover hops across.
    if (capIndex >= 0) {
      const captured = this.pieces.get(capIndex);
      if (captured) {
        const start = captured.position.clone();
        this.queue.add(now, {
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
      moves.push(m.to > m.from ? [m.from + 3, m.from + 1] : [m.from - 4, m.from - 1]);
    }
    const hop = m.castle || m.cap || m.ep ? 0.7 : 0.45;
    for (const [from, to] of moves) {
      const g = this.pieces.get(from);
      if (!g) continue;
      this.pieces.delete(from);
      const x0 = sqX(from);
      const z0 = sqZ(from);
      const x1 = sqX(to);
      const z1 = sqZ(to);
      this.queue.add(now, {
        dur: HOP_MS,
        update: (p) => {
          const e = easeInOut(p);
          g.position.set(x0 + (x1 - x0) * e, TOP_Y + Math.sin(p * Math.PI) * hop, z0 + (z1 - z0) * e);
        },
      });
    }
    // Finish once every animation in this move has ended.
    this.queue.add(now, { delay: HOP_MS, dur: 1, update: () => undefined, done: finish });
  }

  private afterMove(result: ReturnType<typeof outcome>): void {
    if (result !== "ongoing") {
      this.finish(result);
      return;
    }
    if (this.mode === "two" && this.camCtl) {
      this.flipped = this.pos.turn === "b";
      this.camCtl.flipped = this.flipped;
    }
    this.updateHud();
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
    this.hud.setVisible(false);
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
    if (result === "checkmate" && (this.mode === "two" || this.pos.turn === "b")) this.time.delayedCall(600, () => winBurst(this));
    this.time.delayedCall(600, () => showGameOver(this, detail, () => this.scene.restart(), () => this.scene.start("Menu"), title));
  }

  private updateHud(): void {
    const w = this.pos.turn === "w";
    this.hud.setCounts(`⚪ ${this.countPieces("w")}   ⚫ ${this.countPieces("b")}`);
    if (this.dead) return;

    const check = inCheck(this.pos, this.pos.turn) ? "  ⚠️ Check!" : "";
    const last = this.lastMove ? `Last move: ${squareName(this.lastMove.from)} → ${squareName(this.lastMove.to)}` : "White starts.";
    if (this.mode === "two") {
      this.hud.setStatus(`${w ? "White" : "Black"}'s turn${check}`);
      this.hud.setDetail(`${w ? "" : "Pass the iPad to Black.  "}${last}\nTap a piece, then a green square.`);
    } else if (w) {
      this.hud.setStatus(`Your turn ⚪${check}`);
      this.hud.setDetail(`${last}\nTap a white piece, then a green square.`);
    } else {
      this.hud.setStatus("Computer is thinking… ⚫");
      this.hud.setDetail(last);
    }
  }

  private countPieces(c: Color): number {
    return this.pos.board.reduce((n, p) => n + (p && p.c === c ? 1 : 0), 0);
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
