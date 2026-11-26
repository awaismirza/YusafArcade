import Phaser from "phaser";
import { gameAudio } from "../audio/sfx";
import { setTouchChrome } from "../input/touchChrome";
import { addMenuButton, FONT, pollEndTaps, resetTaps, showGameOver, showModePicker } from "../ui/arcadeKit";

type Side = "w" | "b";
type Piece = { c: Side; k: boolean };
type Board = (Piece | null)[][];
type Sq = [number, number];
/** One complete turn: a simple step (path of 1, no caps) or a jump chain. */
type Move = { from: Sq; path: Sq[]; caps: Sq[] };
/** "easy" and "hard" play against the computer; "two" is pass-and-play on one iPad. */
type Mode = "easy" | "hard" | "two";

const N = 8;
const CS = 56;
const LEFT = 160;
const TOP = 62;
const LIGHT = 0xf1d9a8;
const DARK = 0x8a5a2c;
const WOOD_FRAME = 0x6b4423;
const WOOD_INNER = 0x3b2412;
const WHITE: Side = "w";
const BLACK: Side = "b";
/** Moves without a capture or a crown before the game is a draw (60 plies). */
const QUIET_LIMIT = 60;
const STEP_MS = 190;

const inside = (r: number, c: number): boolean => r >= 0 && r < N && c >= 0 && c < N;
const cloneBoard = (b: Board): Board => b.map((row) => row.map((p) => (p ? { ...p } : null)));
const promoRow = (side: Side): number => (side === "w" ? 0 : N - 1);
const keyOf = (sq: Sq): string => `${sq[0]},${sq[1]}`;
const sideName = (s: Side): string => (s === "w" ? "White" : "Black");

function dirsFor(p: Piece): [number, number][] {
  if (p.k) return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const f = p.c === "w" ? -1 : 1; // men only move forward
  return [[f, -1], [f, 1]];
}

function startBoard(): Board {
  const b: Board = Array.from({ length: N }, () => Array(N).fill(null));
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if ((r + c) % 2 !== 1) continue; // pieces only sit on dark squares
      if (r < 3) b[r][c] = { c: "b", k: false };
      else if (r > 4) b[r][c] = { c: "w", k: false };
    }
  }
  return b;
}

/** Depth-first search for jump chains. `b` has the moving piece already lifted off its square. */
function collectJumps(b: Board, r: number, c: number, piece: Piece, side: Side, path: Sq[], caps: Sq[], out: Move[], from: Sq): void {
  for (const [dr, dc] of dirsFor(piece)) {
    const mr = r + dr;
    const mc = c + dc;
    const lr = r + 2 * dr;
    const lc = c + 2 * dc;
    if (!inside(lr, lc)) continue;
    const mid = b[mr][mc];
    if (!mid || mid.c === side || b[lr][lc]) continue;

    const nb = cloneBoard(b);
    nb[mr][mc] = null; // a jumped piece is removed straight away, so it can't be jumped twice
    const nPath: Sq[] = [...path, [lr, lc]];
    const nCaps: Sq[] = [...caps, [mr, mc]];
    // Reaching the far row crowns the man and ends the turn (official rule).
    if (!piece.k && lr === promoRow(side)) {
      out.push({ from, path: nPath, caps: nCaps });
      continue;
    }
    const before = out.length;
    collectJumps(nb, lr, lc, piece, side, nPath, nCaps, out, from);
    if (out.length === before) out.push({ from, path: nPath, caps: nCaps });
  }
}

/** All legal moves. If any jump exists, jumping is compulsory. */
export function legalMoves(board: Board, side: Side): Move[] {
  const jumps: Move[] = [];
  const steps: Move[] = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const p = board[r][c];
      if (!p || p.c !== side) continue;
      const from: Sq = [r, c];
      const lifted = cloneBoard(board);
      lifted[r][c] = null;
      collectJumps(lifted, r, c, p, side, [], [], jumps, from);
      for (const [dr, dc] of dirsFor(p)) {
        const nr = r + dr;
        const nc = c + dc;
        if (inside(nr, nc) && !board[nr][nc]) steps.push({ from, path: [[nr, nc]], caps: [] });
      }
    }
  }
  return jumps.length > 0 ? jumps : steps;
}

export function applyMove(board: Board, m: Move): Board {
  const nb = cloneBoard(board);
  const [fr, fc] = m.from;
  const piece = nb[fr][fc]!;
  nb[fr][fc] = null;
  for (const [r, c] of m.caps) nb[r][c] = null;
  const [lr, lc] = m.path[m.path.length - 1];
  nb[lr][lc] = { c: piece.c, k: piece.k || lr === promoRow(piece.c) };
  return nb;
}

/** Score from the computer's side (black): material, a crown bonus, and a small push forward. */
function evaluateForBlack(board: Board): number {
  let score = 0;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const p = board[r][c];
      if (!p) continue;
      const progress = p.c === "b" ? r : N - 1 - r;
      const value = (p.k ? 2.5 : 1) + progress * 0.05;
      score += p.c === BLACK ? value : -value;
    }
  }
  return score;
}

/** Minimax with alpha-beta pruning. A side with no legal moves has lost. */
export function search(board: Board, side: Side, depth: number, alpha: number, beta: number): number {
  const moves = legalMoves(board, side);
  if (moves.length === 0) return side === BLACK ? -1000 : 1000;
  if (depth === 0) return evaluateForBlack(board);
  if (side === BLACK) {
    let best = -Infinity;
    for (const m of moves) {
      best = Math.max(best, search(applyMove(board, m), WHITE, depth - 1, alpha, beta));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }
  let best = Infinity;
  for (const m of moves) {
    best = Math.min(best, search(applyMove(board, m), BLACK, depth - 1, alpha, beta));
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

export class CheckersScene extends Phaser.Scene {
  private board: Board = [];
  private mode: Mode = "easy";
  private turn: Side = WHITE;
  /** True when the board is turned to face black (pass-and-play only). */
  private flipped = false;
  private legal: Move[] = [];
  private sel: Sq | null = null;
  private lastMove: Move | null = null;
  private justCrowned: string | null = null;
  private quiet = 0;
  private busy = false;
  private animating = false;
  private dead = false;
  private lockUntil = 0;
  private captures: Record<Side, number> = { w: 0, b: 0 };
  private pieces = new Map<string, Phaser.GameObjects.Container>();
  private overlays: Phaser.GameObjects.GameObject[] = [];
  private hover!: Phaser.GameObjects.Rectangle;
  private status!: Phaser.GameObjects.Text;
  private detail!: Phaser.GameObjects.Text;
  private counts!: Phaser.GameObjects.Text;
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
    this.animating = false;
    this.dead = false;
    this.lockUntil = 0;
    this.captures = { w: 0, b: 0 };
    this.pieces = new Map();
    this.overlays = [];
    resetTaps();
  }

  create(): void {
    setTouchChrome("hidden");
    this.cameras.main.setBackgroundColor(0x0f172a);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setTouchChrome("hidden"));

    this.hideMenu = addMenuButton(this, () => {
      if (!this.dead) this.scene.start("Menu");
    });

    // Side panel
    const px = 668;
    this.add.rectangle(px - 16, 300, 4, 360, 0x334155, 0.6);
    this.status = this.add.text(px, 170, "", { fontFamily: FONT, fontSize: "26px", color: "#ffffff", fontStyle: "700" }).setOrigin(0, 0.5);
    this.counts = this.add.text(px, 214, "", { fontFamily: FONT, fontSize: "19px", color: "#bfdbfe" }).setOrigin(0, 0.5);
    this.detail = this.add
      .text(px, 262, "", { fontFamily: FONT, fontSize: "18px", color: "#e0f2fe", lineSpacing: 6, wordWrap: { width: 262 } })
      .setOrigin(0, 0);

    this.buildBoard();

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
        this.refresh();
      }
    );
  }

  /** Screen position of a logical board square (accounts for the board being turned). */
  private px(c: number): number {
    return LEFT + (this.flipped ? N - 1 - c : c) * CS + CS / 2;
  }
  private py(r: number): number {
    return TOP + (this.flipped ? N - 1 - r : r) * CS + CS / 2;
  }

  /** Wooden frame, shadow and the 64 squares. Dark squares are clickable. */
  private buildBoard(): void {
    const size = N * CS;
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(0x000000, 0.4).fillRoundedRect(LEFT - 14, TOP - 10, size + 36, size + 36, 18);
    g.fillStyle(WOOD_FRAME, 1).fillRoundedRect(LEFT - 18, TOP - 18, size + 36, size + 36, 18);
    g.fillStyle(0x8f6234, 1).fillRoundedRect(LEFT - 14, TOP - 14, size + 28, size + 28, 14);
    g.fillStyle(WOOD_INNER, 1).fillRect(LEFT - 6, TOP - 6, size + 12, size + 12);

    // Squares are drawn in screen order. Flipping only changes which logical square each one maps to.
    for (let dr = 0; dr < N; dr++) {
      for (let dc = 0; dc < N; dc++) {
        const dark = (dr + dc) % 2 === 1;
        const x = LEFT + dc * CS + CS / 2;
        const y = TOP + dr * CS + CS / 2;
        this.add.rectangle(x, y, CS, CS, dark ? DARK : LIGHT).setDepth(2);
        this.add.rectangle(x, y, CS - 6, CS - 6, dark ? 0xa76f3d : 0xfff7e6, dark ? 0.35 : 0.5).setDepth(2);
        if (dark) {
          const hit = this.add.rectangle(x, y, CS, CS, 0x000000, 0).setDepth(3).setInteractive({ useHandCursor: true });
          hit.on("pointerdown", () => {
            // Convert the tapped screen square back to the logical board square.
            const r = this.flipped ? N - 1 - dr : dr;
            const c = this.flipped ? N - 1 - dc : dc;
            this.onSquare(r, c);
          });
          hit.on("pointerover", () => this.moveHover(x, y));
          hit.on("pointerout", () => this.hover.setVisible(false));
        }
      }
    }

    this.hover = this.add.rectangle(0, 0, CS - 4, CS - 4, 0xffffff, 0.16).setDepth(4).setVisible(false);
  }

  private moveHover(x: number, y: number): void {
    if (this.busy || this.dead) return;
    this.hover.setPosition(x, y).setVisible(true);
  }

  /** Whoever is moving can act. In two-player mode both sides are human. */
  private humanTurn(): boolean {
    return this.mode === "two" || this.turn === WHITE;
  }

  private onSquare(r: number, c: number): void {
    if (this.busy || this.animating || this.dead || !this.humanTurn()) return;
    const p = this.board[r][c];

    if (p && p.c === this.turn) {
      const canMove = this.legal.some((m) => m.from[0] === r && m.from[1] === c);
      this.sel = canMove ? [r, c] : null;
      this.refresh();
      return;
    }

    if (this.sel) {
      const [sr, sc] = this.sel;
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
      this.refresh();
    }
  }

  private makeMove(m: Move, by: Side): void {
    const mover = this.board[m.from[0]][m.from[1]];
    const lastRow = m.path[m.path.length - 1][0];
    const crowns = !!mover && !mover.k && lastRow === promoRow(by);
    this.captures[by] += m.caps.length;
    this.board = applyMove(this.board, m);
    this.lastMove = m;
    this.justCrowned = crowns ? keyOf(m.path[m.path.length - 1]) : null;
    this.quiet = m.caps.length === 0 && !crowns ? this.quiet + 1 : 0;
    gameAudio.jump();
    this.animateMove(m, () => this.afterMove(by));
  }

  /** Slides the moving piece along its route, and fades out anything it jumps. */
  private animateMove(m: Move, done: () => void): void {
    this.animating = true;
    this.overlays.forEach((o) => o.destroy());
    this.overlays = [];

    for (const cap of m.caps) {
      const k = keyOf(cap);
      const o = this.pieces.get(k);
      if (!o) continue;
      this.pieces.delete(k);
      this.burst(o.x, o.y);
      this.tweens.add({ targets: o, alpha: 0, scale: 0.3, duration: 260, ease: "Quad.easeIn", onComplete: () => o.destroy() });
    }

    const mover = this.pieces.get(keyOf(m.from));
    this.pieces.delete(keyOf(m.from));
    if (!mover) {
      this.animating = false;
      done();
      return;
    }
    // Chain one tween per square of the route (this Phaser build has no timeline helper).
    const route = m.path.map(([r, c]) => ({ x: this.px(c), y: this.py(r) }));
    const step = (i: number): void => {
      if (i >= route.length) {
        mover.destroy();
        this.animating = false;
        done();
        return;
      }
      this.tweens.add({
        targets: mover,
        x: route[i].x,
        y: route[i].y,
        duration: STEP_MS,
        ease: "Sine.easeInOut",
        onComplete: () => step(i + 1),
      });
    };
    step(0);
  }

  /** Little puff of sparkle where a piece is taken. */
  private burst(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8;
      const dot = this.add.circle(x, y, 4, 0xfde047, 1).setDepth(20);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(a) * 34,
        y: y + Math.sin(a) * 34,
        alpha: 0,
        scale: 0.4,
        duration: 420,
        ease: "Quad.easeOut",
        onComplete: () => dot.destroy(),
      });
    }
  }

  private afterMove(by: Side): void {
    const next: Side = by === WHITE ? BLACK : WHITE;
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
    if (this.mode === "two") this.flipped = next === BLACK;

    if (this.mode !== "two" && next === BLACK) {
      this.legal = [];
      this.busy = true;
      this.refresh();
      this.time.delayedCall(450, () => this.aiTurn());
    } else {
      this.refresh();
    }
  }

  private aiTurn(): void {
    if (this.dead) return;
    const moves = legalMoves(this.board, BLACK);
    const chosen = this.mode === "easy" && Math.random() < 0.5 ? Phaser.Utils.Array.GetRandom(moves) : this.bestMove(moves, 4);
    this.busy = false;
    this.makeMove(chosen, BLACK);
  }

  /** Picks the best reply. Easy uses a single ply, Challenge looks four plies ahead. */
  private bestMove(moves: Move[], depth: number): Move {
    const shuffled = Phaser.Utils.Array.Shuffle([...moves]);
    const lookAhead = this.mode === "easy" ? 1 : depth;
    let best = shuffled[0];
    let bestScore = -Infinity;
    for (const m of shuffled) {
      const score = search(applyMove(this.board, m), WHITE, lookAhead - 1, -Infinity, Infinity);
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }
    return best;
  }

  /** winner is the side that just won; null means a draw. */
  private finish(winner: Side | null): void {
    this.dead = true;
    this.busy = true;
    this.legal = [];
    this.sel = null;
    this.hideMenu();
    this.refresh();
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
    this.time.delayedCall(450, () =>
      showGameOver(this, detail, () => this.scene.restart(), () => this.scene.start("Menu"), title)
    );
  }

  /** Rebuilds the highlights, pieces and side panel from the board. Not called mid-animation. */
  private refresh(): void {
    this.overlays.forEach((o) => {
      this.tweens.killTweensOf(o);
      o.destroy();
    });
    this.overlays = [];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.overlays.push(o);
      return o;
    };

    this.pieces.forEach((o) => o.destroy());
    this.pieces.clear();

    // Last move: a soft blue glow on the start and end squares.
    if (this.lastMove) {
      for (const sq of [this.lastMove.from, this.lastMove.path[this.lastMove.path.length - 1]]) {
        add(this.add.rectangle(this.px(sq[1]), this.py(sq[0]), CS - 2, CS - 2, 0x60a5fa, 0.32).setDepth(6));
      }
    }

    const mustJump = this.humanTurn() && !this.dead && this.legal.length > 0 && this.legal[0].caps.length > 0;
    if (mustJump) {
      const seen = new Set<string>();
      for (const m of this.legal) {
        const k = keyOf(m.from);
        if (seen.has(k)) continue;
        seen.add(k);
        const ring = add(
          this.add.circle(this.px(m.from[1]), this.py(m.from[0]), CS * 0.46).setStrokeStyle(3, 0xef4444, 1).setFillStyle(0, 0).setDepth(7)
        );
        this.tweens.add({ targets: ring, alpha: 0.35, duration: 520, yoyo: true, repeat: -1 });
      }
    }

    if (this.sel) {
      const [sr, sc] = this.sel;
      add(this.add.rectangle(this.px(sc), this.py(sr), CS - 2, CS - 2, 0xfde047, 0.4).setDepth(6));
      add(this.add.rectangle(this.px(sc), this.py(sr), CS - 6, CS - 6, 0, 0).setStrokeStyle(3, 0xfde047, 1).setDepth(6));
      for (const m of this.legal) {
        if (m.from[0] !== sr || m.from[1] !== sc) continue;
        const [er, ec] = m.path[m.path.length - 1];
        const dot = add(this.add.circle(this.px(ec), this.py(er), 10, 0x22c55e, 0.95).setStrokeStyle(3, 0xdcfce7, 0.9).setDepth(8));
        this.tweens.add({ targets: dot, scale: 1.25, duration: 500, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      }
    }

    // Pieces
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const p = this.board[r]?.[c];
        if (!p) continue;
        const k = keyOf([r, c]);
        const piece = this.makePiece(this.px(c), this.py(r), p).setDepth(10);
        this.pieces.set(k, piece);
        if (this.justCrowned === k) {
          piece.setScale(0.4);
          this.tweens.add({ targets: piece, scale: 1, duration: 480, ease: "Back.easeOut" });
        }
      }
    }
    this.justCrowned = null;

    this.updatePanel(mustJump);
  }

  private updatePanel(mustJump: boolean): void {
    if (this.mode === "two") {
      this.counts.setText(`White ⚪ ${this.countPieces(WHITE)}     Black ⚫ ${this.countPieces(BLACK)}`);
    } else {
      this.counts.setText(`You ⚪ ${this.countPieces(WHITE)}     Computer ⚫ ${this.countPieces(BLACK)}`);
    }

    if (this.dead) {
      this.status.setText("Game over");
      this.detail.setText("");
      return;
    }

    if (this.mode === "two") {
      this.status.setText(`${sideName(this.turn)}'s turn ${this.turn === WHITE ? "⚪" : "⚫"}`);
      const pass = this.turn === BLACK ? "Pass the iPad to Black." : "White's turn.";
      this.detail.setText(
        this.sel
          ? "Tap a green dot to move there."
          : mustJump
            ? `${pass}\nJump over a piece to capture it! Tap a red-ringed piece.`
            : `${pass}\nTap one of your pieces, then a green dot.`
      );
      return;
    }

    if (this.turn === WHITE) {
      this.status.setText("Your turn ⚪");
      this.detail.setText(
        this.sel
          ? "Tap a green dot to move there."
          : mustJump
            ? "Jump over a black piece to capture it!\nTap a red-ringed piece to start."
            : "Tap a white piece, then a green dot.\nKings 👑 can move backwards too."
      );
    } else {
      this.status.setText("Computer is thinking… ⚫");
      this.detail.setText("Blue squares show its last move.");
    }
  }

  /** Layered piece: soft shadow, rim, body with a top-left sheen, and a crown for kings. */
  private makePiece(x: number, y: number, p: Piece): Phaser.GameObjects.Container {
    const R = CS * 0.38;
    const rim = p.c === "w" ? 0xa8a29e : 0x020617;
    const body = p.c === "w" ? 0xfafaf9 : 0x262626;
    const parts: Phaser.GameObjects.GameObject[] = [
      this.add.circle(3, 5, R, 0x000000, 0.4),
      this.add.circle(0, 0, R, rim),
      this.add.circle(0, 0, R - 3, body),
      this.add.circle(-R * 0.25, -R * 0.28, R * 0.52, 0xffffff, p.c === "w" ? 0.6 : 0.14),
      this.add.circle(0, 0, R * 0.64).setStrokeStyle(2, rim, 0.7).setFillStyle(0, 0),
    ];
    if (p.k) parts.push(this.makeCrown());
    return this.add.container(x, y, parts);
  }

  private makeCrown(): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    g.fillStyle(0xfacc15, 1).lineStyle(2, 0xa16207, 1);
    g.beginPath();
    g.moveTo(-11, 6);
    g.lineTo(-13, -7);
    g.lineTo(-6, -1);
    g.lineTo(0, -10);
    g.lineTo(6, -1);
    g.lineTo(13, -7);
    g.lineTo(11, 6);
    g.closePath();
    g.fillPath();
    g.strokePath();
    return g;
  }

  private countPieces(side: Side): number {
    let n = 0;
    for (const row of this.board) for (const p of row) if (p && p.c === side) n++;
    return n;
  }

  update(time: number): void {
    if (this.dead) {
      if (time < this.lockUntil) return;
      const tap = pollEndTaps();
      if (tap === "restart") this.scene.restart();
      else if (tap === "menu") this.scene.start("Menu");
    }
  }
}
