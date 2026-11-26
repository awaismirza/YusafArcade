import Phaser from "phaser";
import * as THREE from "three";
import { gameAudio } from "../audio/sfx";
import { setTouchChrome } from "../input/touchChrome";
import { addMenuButton, Btn, makeButton, pollEndTaps, resetTaps, showGameOver, showModePicker } from "../ui/arcadeKit";
import { AnimQueue, easeInOut } from "../ui/animQueue";
import { Hud } from "../ui/hud";
import { ThreeStage } from "../ui/threeStage";
import { DiceSet } from "../games/shared/dice3d";
import { buildPawn } from "../games/shared/pawn3d";
import { buildSnakesBoard, SnakesBoard, squareWorld, startSpot } from "../games/snakes/board3d";
import { earnsBonus, FINISH, MAX_ROLLS_PER_TURN, moveToken, seatColors, sum } from "../games/snakes/rules";
import { COLOR_HEX, COLOR_NAMES } from "../games/ludo/rules";

const TEX_KEY = "snakes3d";
const EMOJI = ["🔴", "🟢", "🟡", "🔵"];
const PAWN_SCALE = 0.8;
const SURFACE_Y = 0.01;

type Phase = "setup" | "roll" | "rolling" | "moving" | "over";

export class SnakesScene extends Phaser.Scene {
  private seats: number[] = [];
  private humans: boolean[] = [];
  private positions: number[] = [];
  private diceCount = 1;
  private turnIdx = 0;
  private phase: Phase = "setup";
  private values: number[] = [];
  private rollsThisTurn = 0;
  private readyAt = 0;
  private lockUntil = 0;

  private stage: ThreeStage | null = null;
  private board: SnakesBoard | null = null;
  private dice: DiceSet | null = null;
  private queue = new AnimQueue();
  private pawns: THREE.Group[] = [];
  private targets: THREE.Vector3[] = [];
  private locked = new Set<number>();
  private hud!: Hud;
  private rollBtn: Btn | null = null;
  private hideMenu!: () => void;

  constructor() {
    super({ key: "Snakes" });
  }

  init(): void {
    this.seats = [];
    this.humans = [];
    this.positions = [];
    this.diceCount = 1;
    this.turnIdx = 0;
    this.phase = "setup";
    this.values = [];
    this.rollsThisTurn = 0;
    this.readyAt = Number.POSITIVE_INFINITY;
    this.lockUntil = 0;
    this.stage = null;
    this.board = null;
    this.dice = null;
    this.queue = new AnimQueue();
    this.pawns = [];
    this.targets = [];
    this.locked = new Set();
    this.rollBtn = null;
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
      if (this.phase !== "over") this.scene.start("Menu");
    });

    this.stage = ThreeStage.create(this, { key: TEX_KEY, backdrop: ["#065f46", "#022c22"] });
    this.hud = new Hud(this);

    if (!this.stage) {
      this.hud.setStatus("3D needs WebGL");
      this.hud.setDetail("Your browser can't show the 3D board.\nTry Safari or Chrome on iPad.");
      return;
    }
    this.buildWorld(this.stage);

    showModePicker(
      this,
      "Snakes & Ladders 🐍",
      "Roll the dice and race to square 100\nClimb the ladders · watch out for the snakes!",
      [
        { label: "🤖 vs Computer", sub: "you + 1 computer", color: 0x16a34a, mode: "cpu" },
        { label: "👫 2 Players", sub: "same iPad", color: 0x0369a1, mode: "2" },
        { label: "👨‍👩‍👧 3 Players", sub: "same iPad", color: 0x7c3aed, mode: "3" },
        { label: "🎉 4 Players", sub: "same iPad", color: 0xb45309, mode: "4" },
      ],
      (mode) => {
        const players = mode === "cpu" ? 2 : Number(mode);
        this.seats = seatColors(players);
        this.humans = this.seats.map((_, i) => mode !== "cpu" || i === 0);
        showModePicker(
          this,
          "How many dice?",
          "With 2 or 3 dice you move the total.\nRoll doubles for a bonus turn!",
          [
            { label: "🎲 1 die", sub: "roll a 6 for a bonus", color: 0x16a34a, mode: "1" },
            { label: "🎲🎲 2 dice", sub: "move the total", color: 0x0369a1, mode: "2" },
            { label: "🎲🎲🎲 3 dice", sub: "big jumps", color: 0x7c3aed, mode: "3" },
          ],
          (dc) => this.startGame(Number(dc))
        );
      }
    );
  }

  private buildWorld(stage: ThreeStage): void {
    this.board = buildSnakesBoard();
    stage.scene.add(this.board.group);
    stage.camera.position.set(0, 15.2, 9.6);
    stage.camera.lookAt(0, 0, 0.5);
    stage.keyLight.position.set(5, 16, 7);
    stage.keyLight.shadow.camera.left = -9;
    stage.keyLight.shadow.camera.right = 9;
    stage.keyLight.shadow.camera.top = 9;
    stage.keyLight.shadow.camera.bottom = -9;
  }

  private startGame(diceCount: number): void {
    const stage = this.stage;
    if (!stage) return;
    this.diceCount = diceCount;
    this.dice = new DiceSet(diceCount);
    stage.scene.add(this.dice.group);
    gameAudio.unlock();
    gameAudio.startMusic();

    this.positions = this.seats.map(() => 0);
    this.seats.forEach((color) => {
      const g = buildPawn(COLOR_HEX[color], PAWN_SCALE);
      stage.scene.add(g);
      this.pawns.push(g);
    });
    this.layout(true);
    this.readyAt = this.time.now + 300;

    this.rollBtn = makeButton(this, 868, 290, 168, 110, "🎲\nRoll!", 0xdc2626, () => this.onRollButton(), 30, 30);
    this.rollBtn.container.setVisible(false);
    this.beginTurn();
  }

  /** Where each pawn stands, with a small offset when several share a square. */
  private layout(snap: boolean): void {
    const groups = new Map<number, number[]>();
    this.positions.forEach((pos, i) => {
      const list = groups.get(pos) ?? [];
      list.push(i);
      groups.set(pos, list);
    });
    groups.forEach((list, pos) => {
      list.forEach((seat, n) => {
        const p = pos === 0 ? startSpot(seat) : squareWorld(pos);
        if (pos !== 0 && list.length > 1) {
          const a = (n / list.length) * Math.PI * 2;
          p.x += Math.cos(a) * 0.24;
          p.z += Math.sin(a) * 0.24;
        }
        p.y = SURFACE_Y;
        this.targets[seat] = p;
        if (snap) this.pawns[seat].position.copy(p);
      });
    });
  }

  // ---------------------------------------------------------------- turn flow

  private get seat(): number {
    return this.turnIdx;
  }
  private get color(): number {
    return this.seats[this.turnIdx];
  }
  private get isHuman(): boolean {
    return this.humans[this.turnIdx];
  }

  private beginTurn(): void {
    this.rollsThisTurn = 0;
    this.prepareRoll();
  }

  private prepareRoll(): void {
    this.phase = "roll";
    this.updateHud();
    if (this.isHuman) {
      this.rollBtn?.container.setVisible(true);
    } else {
      this.rollBtn?.container.setVisible(false);
      this.time.delayedCall(800, () => this.doRoll());
    }
  }

  private onRollButton(): void {
    if (this.phase !== "roll" || !this.isHuman || this.time.now < this.readyAt) return;
    this.doRoll();
  }

  private doRoll(): void {
    if (this.phase !== "roll" || !this.dice) return;
    this.phase = "rolling";
    this.rollBtn?.container.setVisible(false);
    this.rollsThisTurn += 1;
    this.values = Array.from({ length: this.diceCount }, () => 1 + Math.floor(Math.random() * 6));
    this.hud.setStatus(`${EMOJI[this.color]} ${COLOR_NAMES[this.color]} is rolling…`);
    this.hud.setDetail("");
    gameAudio.jump();
    this.dice.roll(this.queue, this.time.now, this.values, {
      center: new THREE.Vector3(0, 0.02, 0.4),
      onThrow: () => gameAudio.hit(),
      onLand: () => this.afterRoll(),
    });
  }

  private afterRoll(): void {
    gameAudio.coin();
    const total = sum(this.values);
    const from = this.positions[this.seat];
    const result = moveToken(from, total);
    const rolled = this.values.length > 1 ? `${this.values.join(" + ")} = ${total}` : `a ${total}`;
    this.hud.setStatus(`${EMOJI[this.color]} ${COLOR_NAMES[this.color]} rolled ${rolled}`);
    this.hud.setDetail(result.bounced ? `Too many for 100! Bounce back to ${result.landing}…` : `Moving to square ${result.landing}…`);
    this.phase = "moving";
    this.time.delayedCall(950, () => {
      if (this.dice) this.dice.group.visible = false;
      this.movePawn(result);
    });
  }

  /** Hops square by square, then climbs a ladder or slides down a snake. */
  private movePawn(result: ReturnType<typeof moveToken>): void {
    const seat = this.seat;
    const pawn = this.pawns[seat];
    const board = this.board;
    if (!board) return;

    // Squares to hop through.
    const stops: THREE.Vector3[] = [];
    for (const n of result.route) stops.push(squareWorld(n).setY(SURFACE_Y));
    const stepMs = Math.max(95, Math.min(230, 1500 / stops.length));
    let prev = pawn.position.clone();
    this.locked.add(seat);
    this.positions[seat] = result.landing;

    const steps = stops.map((to) => () => {
      const a = prev.clone();
      prev = to;
      return {
        dur: stepMs,
        update: (p: number) => {
          const e = easeInOut(p);
          pawn.position.set(a.x + (to.x - a.x) * e, a.y + (to.y - a.y) * e + Math.sin(p * Math.PI) * 0.4, a.z + (to.z - a.z) * e);
        },
      };
    });

    this.queue.chain(this.time.now, steps, () => {
      gameAudio.jump();
      if (result.jump === "ladder") {
        const path = board.ladderPath.get(result.landing)!;
        this.hud.setDetail("A ladder! Climb up! 🪜");
        this.followPath(pawn, path, 1500, 0, () => this.arrive(result.to, result.jump));
      } else if (result.jump === "snake") {
        const path = board.snakePath.get(result.landing)!;
        this.hud.setDetail("Oh no, a snake! Sliding down… 🐍");
        gameAudio.hit();
        this.followPath(pawn, path, 1700, 0.3, () => this.arrive(result.to, result.jump));
      } else {
        this.arrive(result.to, null);
      }
    });
  }

  /** Moves a pawn along a list of points over `dur` ms, with an optional wobble. */
  private followPath(pawn: THREE.Group, path: THREE.Vector3[], dur: number, wobble: number, done: () => void): void {
    this.queue.add(this.time.now, {
      dur,
      update: (p) => {
        const e = easeInOut(p);
        const f = e * (path.length - 1);
        const i = Math.min(path.length - 2, Math.floor(f));
        const t = f - i;
        pawn.position.lerpVectors(path[i], path[i + 1], t);
        pawn.position.y += 0.02;
        if (wobble > 0) pawn.rotation.z = Math.sin(p * Math.PI * 8) * wobble;
      },
      done: () => {
        pawn.rotation.z = 0;
        done();
      },
    });
  }

  private arrive(square: number, jump: "ladder" | "snake" | null): void {
    const seat = this.seat;
    this.positions[seat] = square;
    this.locked.delete(seat);
    this.layout(false);
    this.updateHud(jump === "ladder" ? `Up to square ${square}!` : jump === "snake" ? `Down to square ${square}.` : `On square ${square}.`);
    if (square === FINISH) {
      this.finish(this.color);
      return;
    }
    this.time.delayedCall(450, () => this.endRoll());
  }

  /** Bonus roll for a six (or doubles), otherwise pass the turn. */
  private endRoll(): void {
    if (this.phase === "over") return;
    if (earnsBonus(this.values) && this.rollsThisTurn < MAX_ROLLS_PER_TURN) {
      this.updateHud(this.values.length === 1 ? "A six! Roll again." : "Doubles! Roll again.");
      this.prepareRoll();
      return;
    }
    this.turnIdx = (this.turnIdx + 1) % this.seats.length;
    this.beginTurn();
  }

  private finish(color: number): void {
    this.phase = "over";
    this.rollBtn?.container.setVisible(false);
    this.hideMenu();
    this.hud.setVisible(false);
    this.lockUntil = this.time.now + 900;
    gameAudio.stopMusic();
    gameAudio.coin();
    const human = this.humans[this.seats.indexOf(color)];
    const title = human ? `${COLOR_NAMES[color]} wins! 🎉` : `${COLOR_NAMES[color]} (computer) wins`;
    this.time.delayedCall(700, () => showGameOver(this, "Reached square 100!", () => this.scene.restart(), () => this.scene.start("Menu"), title));
  }

  private updateHud(extra?: string): void {
    if (this.phase === "over") return;
    this.hud.setCounts(this.seats.map((c, i) => `${EMOJI[c]} ${this.positions[i] || "start"}`).join("   "));
    if (this.phase === "roll" || extra !== undefined) {
      const name = `${EMOJI[this.color]} ${COLOR_NAMES[this.color]}`;
      if (this.humans.some((h) => !h)) this.hud.setStatus(this.isHuman ? `${name}: your turn` : `${name} (computer)`);
      else this.hud.setStatus(`${name}'s turn`);
    }
    if (extra !== undefined) {
      this.hud.setDetail(extra);
    } else if (this.phase === "roll") {
      const again = this.rollsThisTurn > 0 ? "  (bonus roll!)" : "";
      const pass = this.humans.filter(Boolean).length > 1 ? "  Pass the iPad if it's not your turn." : "";
      this.hud.setDetail(this.isHuman ? `Tap the Roll button.${again}${pass}` : "The computer is thinking…");
    }
  }

  update(time: number): void {
    const stage = this.stage;
    if (stage) {
      this.queue.update(time);
      this.dice?.update(time);
      this.pawns.forEach((g, seat) => {
        if (this.locked.has(seat)) return;
        const t = this.targets[seat];
        if (!t) return;
        g.position.x += (t.x - g.position.x) * 0.25;
        g.position.z += (t.z - g.position.z) * 0.25;
        g.position.y += (t.y - g.position.y) * 0.3;
      });
      stage.render();
    }
    if (this.phase === "over" && time >= this.lockUntil) {
      const tap = pollEndTaps();
      if (tap === "restart") this.scene.restart();
      else if (tap === "menu") this.scene.start("Menu");
    }
  }
}
