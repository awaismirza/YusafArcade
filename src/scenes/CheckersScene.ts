import Phaser from "phaser";
import { gameAudio } from "../audio/sfx";
import { setTouchChrome } from "../input/touchChrome";
import { addMenuButton, FONT, pollEndTaps, resetTaps, showGameOver, showLevelPicker } from "../ui/arcadeKit";

type Side = "w" | "b";
type Piece = { c: Side; k: boolean };
type Board = (Piece | null)[][];
type Sq = [number, number];
/** One complete turn: a simple step (path of 1, no caps) or a jump chain. */
type Move = { from: Sq; path: Sq[]; caps: Sq[] };

const N = 8;
const CS = 56;
const LEFT = 140;
const TOP = 62;
const LIGHT = 0xf5deb3;
const DARK = 0x8b5a2b;
const HUMAN: Side = "w";
const AI: Side = "b";
/** Moves without a capture or a crown before the game is a draw (60 plies). */
const QUIET_LIMIT = 60;

const inside = (r: number, c: number): boolean => r >= 0 && r < N && c >= 0 && c < N;
const cloneBoard = (b: Board): Board => b.map((row) => row.map((p) => (p ? { ...p } : null)));
const promoRow = (side: Side): number => (side === "w" ? 0 : N - 1);

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
function legalMoves(board: Board, side: Side): Move[] {
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

function applyMove(board: Board, m: Move): Board {
  const nb = cloneBoard(board);
  const [fr, fc] = m.from;
  const piece = nb[fr][fc]!;
  nb[fr][fc] = null;
  for (const [r, c] of m.caps) nb[r][c] = null;
  const [lr, lc] = m.path[m.path.length - 1];
  nb[lr][lc] = { c: piece.c, k: piece.k || lr === promoRow(piece.c) };
  return nb;
}

/** Score from the computer's side: material, a crown bonus, and a small push forward. */
function evaluateForAI(board: Board): number {
  let score = 0;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const p = board[r][c];
      if (!p) continue;
      const progress = p.c === "b" ? r : N - 1 - r;
      const value = (p.k ? 2.5 : 1) + progress * 0.05;
      score += p.c === AI ? value : -value;
    }
  }
  return score;
}

/** Minimax with alpha-beta pruning. A side with no legal moves has lost. */
function search(board: Board, side: Side, depth: number, alpha: number, beta: number): number {
  const moves = legalMoves(board, side);
  if (moves.length === 0) return side === AI ? -1000 : 1000;
  if (depth === 0) return evaluateForAI(board);
  if (side === AI) {
    let best = -Infinity;
    for (const m of moves) {
      best = Math.max(best, search(applyMove(board, m), HUMAN, depth - 1, alpha, beta));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }
  let best = Infinity;
  for (const m of moves) {
    best = Math.min(best, search(applyMove(board, m), AI, depth - 1, alpha, beta));
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

export class CheckersScene extends Phaser.Scene {
  private board: Board = [];
  private turn: Side = HUMAN;
  private legal: Move[] = [];
  private sel: Sq | null = null;
  private lastMove: Move | null = null;
  private tier: 0 | 1 = 0;
  private quiet = 0;
  private busy = false;
  private dead = false;
  private lockUntil = 0;
  private myCaptures = 0;
  private overlays: Phaser.GameObjects.GameObject[] = [];
  private status!: Phaser.GameObjects.Text;
  private detail!: Phaser.GameObjects.Text;
  private counts!: Phaser.GameObjects.Text;
  private hideMenu!: () => void;

  constructor() {
    super({ key: "Checkers" });
  }

  init(): void {
    this.board = [];
    this.turn = HUMAN;
    this.legal = [];
    this.sel = null;
    this.lastMove = null;
    this.quiet = 0;
    this.busy = false;
    this.dead = false;
    this.lockUntil = 0;
    this.myCaptures = 0;
    this.overlays = [];
    resetTaps();
  }

  create(): void {
    setTouchChrome("hidden");
    this.cameras.main.setBackgroundColor(0x172554);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setTouchChrome("hidden"));

    this.hideMenu = addMenuButton(this, () => {
      if (!this.dead) this.scene.start("Menu");
    });

    // Side panel text
    const px = 650;
    this.status = this.add.text(px, 170, "", { fontFamily: FONT, fontSize: "26px", color: "#ffffff", fontStyle: "700" }).setOrigin(0, 0.5);
    this.counts = this.add.text(px, 226, "", { fontFamily: FONT, fontSize: "20px", color: "#bfdbfe" }).setOrigin(0, 0.5);
    this.detail = this.add.text(px, 290, "", {
      fontFamily: FONT,
      fontSize: "19px",
      color: "#e0f2fe",
      wordWrap: { width: 260 },
    }).setOrigin(0, 0);

    this.buildBoard();

    showLevelPicker(
      this,
      "Checkers ⚫",
      "Move diagonally · jump over a piece to capture it\nReach the far side to crown a King 👑\nEasy: the computer plays gently · Challenge: it thinks ahead",
      (tier) => {
        this.tier = tier;
        gameAudio.unlock();
        gameAudio.startMusic();
        this.board = startBoard();
        this.refresh();
      }
    );
  }

  /** Draws the static squares and makes the dark ones clickable. */
  private buildBoard(): void {
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const dark = (r + c) % 2 === 1;
        const x = LEFT + c * CS + CS / 2;
        const y = TOP + r * CS + CS / 2;
        const sq = this.add.rectangle(x, y, CS, CS, dark ? DARK : LIGHT);
        if (dark) {
          sq.setInteractive({ useHandCursor: true });
          sq.on("pointerdown", () => this.onSquare(r, c));
        }
      }
    }
    const frame = this.add.graphics().setDepth(5);
    frame.lineStyle(4, 0x0f172a, 1);
    frame.strokeRect(LEFT, TOP, N * CS, N * CS);
  }

  private onSquare(r: number, c: number): void {
    if (this.busy || this.dead || this.turn !== HUMAN) return;
    const p = this.board[r][c];

    if (p && p.c === HUMAN) {
      const canMove = this.legal.some((m) => m.from[0] === r && m.from[1] === c);
      this.sel = canMove ? [r, c] : null;
      this.refresh();
      return;
    }

    if (this.sel) {
      const [sr, sc] = this.sel;
      const options = this.legal.filter((m) => m.from[0] === sr && m.from[1] === sc && m.path[m.path.length - 1][0] === r && m.path[m.path.length - 1][1] === c);
      if (options.length > 0) {
        // Several routes can end on the same square: take the one that captures most.
        const best = options.reduce((a, b) => (b.caps.length > a.caps.length ? b : a));
        this.playerMove(best);
        return;
      }
      this.sel = null;
      this.refresh();
    }
  }

  private playerMove(m: Move): void {
    this.sel = null;
    this.myCaptures += m.caps.length;
    this.makeMove(m, HUMAN);
  }

  private makeMove(m: Move, by: Side): void {
    const mover = this.board[m.from[0]][m.from[1]];
    const lastRow = m.path[m.path.length - 1][0];
    const crowns = !!mover && !mover.k && lastRow === promoRow(by);
    this.board = applyMove(this.board, m);
    this.lastMove = m;
    this.quiet = m.caps.length === 0 && !crowns ? this.quiet + 1 : 0;
    gameAudio.jump();
    this.afterMove(by);
  }

  private afterMove(by: Side): void {
    const next: Side = by === HUMAN ? AI : HUMAN;
    const nextMoves = legalMoves(this.board, next);

    if (nextMoves.length === 0) {
      this.finish(by === HUMAN ? "win" : "lose");
      return;
    }
    if (this.quiet >= QUIET_LIMIT) {
      this.finish("draw");
      return;
    }

    this.turn = next;
    if (next === HUMAN) {
      this.legal = nextMoves;
      this.refresh();
    } else {
      this.legal = [];
      this.busy = true;
      this.refresh();
      this.time.delayedCall(550, () => this.aiTurn());
    }
  }

  private aiTurn(): void {
    if (this.dead) return;
    const moves = legalMoves(this.board, AI);
    const chosen =
      this.tier === 0 && Math.random() < 0.5
        ? Phaser.Utils.Array.GetRandom(moves)
        : this.bestMove(moves, 4);
    this.busy = false;
    this.makeMove(chosen, AI);
  }

  /** Picks the best reply. Easy uses a single ply, Challenge looks four plies ahead. */
  private bestMove(moves: Move[], depth: number): Move {
    const shuffled = Phaser.Utils.Array.Shuffle([...moves]);
    const lookAhead = this.tier === 0 ? 1 : depth;
    let best = shuffled[0];
    let bestScore = -Infinity;
    for (const m of shuffled) {
      const score = search(applyMove(this.board, m), HUMAN, lookAhead - 1, -Infinity, Infinity);
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }
    return best;
  }

  private finish(result: "win" | "lose" | "draw"): void {
    this.dead = true;
    this.busy = true;
    this.legal = [];
    this.sel = null;
    this.hideMenu();
    this.refresh();
    this.lockUntil = this.time.now + 900;

    let title = "It's a draw";
    let detail = "Too many moves without a jump or a crown.";
    if (result === "win") {
      title = "You won! 🎉";
      detail = `You captured ${this.myCaptures} piece${this.myCaptures === 1 ? "" : "s"}`;
      gameAudio.coin();
    } else if (result === "lose") {
      title = "Computer wins";
      detail = "So close! Try again and look for jumps first.";
    }
    gameAudio.stopMusic();
    this.time.delayedCall(450, () =>
      showGameOver(this, detail, () => this.scene.restart(), () => this.scene.start("Menu"), title)
    );
  }

  /** Redraws pieces, highlights and the side panel. */
  private refresh(): void {
    this.overlays.forEach((o) => o.destroy());
    this.overlays = [];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.overlays.push(o);
      return o;
    };
    const cx = (c: number): number => LEFT + c * CS + CS / 2;
    const cy = (r: number): number => TOP + r * CS + CS / 2;

    // Last move, so a child can see what the computer just did.
    if (this.lastMove) {
      for (const [r, c] of [this.lastMove.from, this.lastMove.path[this.lastMove.path.length - 1]]) {
        add(this.add.rectangle(cx(c), cy(r), CS, CS, 0x60a5fa, 0.35).setDepth(6));
      }
    }

    // Mandatory capture: mark the pieces that must jump.
    const mustJump = this.turn === HUMAN && this.legal.length > 0 && this.legal[0].caps.length > 0;
    if (mustJump && !this.dead) {
      const seen = new Set<string>();
      for (const m of this.legal) {
        const key = m.from.join(",");
        if (seen.has(key)) continue;
        seen.add(key);
        add(this.add.circle(cx(m.from[1]), cy(m.from[0]), CS * 0.44).setStrokeStyle(3, 0xef4444, 1).setFillStyle(0, 0).setDepth(7));
      }
    }

    if (this.sel) {
      const [sr, sc] = this.sel;
      add(this.add.rectangle(cx(sc), cy(sr), CS, CS, 0xfde047, 0.45).setDepth(6));
      for (const m of this.legal) {
        if (m.from[0] !== sr || m.from[1] !== sc) continue;
        const [er, ec] = m.path[m.path.length - 1];
        add(this.add.circle(cx(ec), cy(er), 9, 0x22c55e, 0.95).setDepth(8));
      }
    }

    // Pieces
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const p = this.board[r]?.[c];
        if (!p) continue;
        const fill = p.c === "w" ? 0xf8fafc : 0x111827;
        const rim = p.c === "w" ? 0x94a3b8 : 0x6b7280;
        add(this.add.circle(cx(c), cy(r), CS * 0.38, fill).setStrokeStyle(4, rim, 1).setDepth(10));
        if (p.k) add(this.add.circle(cx(c), cy(r), CS * 0.2).setStrokeStyle(3, 0xfacc15, 1).setFillStyle(0, 0).setDepth(11));
      }
    }

    // Side panel
    const mine = this.countPieces(HUMAN);
    const theirs = this.countPieces(AI);
    this.counts.setText(`You ⚪ ${mine}     Computer ⚫ ${theirs}`);
    if (this.dead) {
      this.status.setText("Game over");
    } else if (this.turn === HUMAN) {
      this.status.setText("Your turn ⚪");
      if (!this.busy && this.sel === null && this.legal.length > 0) {
        this.detail.setText(
          mustJump
            ? "Jump over a black piece to capture it!\nTap a red-ringed piece to start."
            : "Tap a white piece, then a green dot.\nKings 👑 can move backwards too."
        );
      }
    } else {
      this.status.setText("Computer is thinking… ⚫");
      this.detail.setText("Watch the blue squares for its last move.");
    }
    if (this.sel) this.detail.setText("Now tap a green dot to move there.");
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
