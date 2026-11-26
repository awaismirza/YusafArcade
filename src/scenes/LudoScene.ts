import Phaser from "phaser";
import * as THREE from "three";
import { gameAudio } from "../audio/sfx";
import { setTouchChrome } from "../input/touchChrome";
import { addMenuButton, Btn, makeButton, pollEndTaps, resetTaps, showGameOver, showModePicker } from "../ui/arcadeKit";
import { AnimQueue, easeInOut } from "../ui/animQueue";
import { Hud } from "../ui/hud";
import { findUserData, ThreeStage } from "../ui/threeStage";
import { addBoardControls } from "../ui/boardControls";
import { OrbitRig } from "../games/shared/orbitRig";
import { DiceSet } from "../games/shared/dice3d";
import { buildPawn } from "../games/shared/pawn3d";
import { buildLudoBoard, SURFACE_Y, wx, wz } from "../games/ludo/board3d";
import {
  allChoices, applyMove, cellOf, Choice, chooseMove, COLOR_HEX, COLOR_NAMES, earnsBonus, FINAL, hasWon, homeCount, MAX_ROLLS_PER_TURN,
  newTokens, seatColors, Tokens, YARD, YARD_SLOTS,
} from "../games/ludo/rules";

const TEX_KEY = "ludo3d";
const EMOJI = ["🔴", "🟢", "🟡", "🔵"];
const PAWN_SCALE = 0.95;

type Phase = "setup" | "roll" | "rolling" | "choose" | "moving" | "over";
type TokenId = { color: number; i: number };
const keyOf = (t: TokenId): string => `${t.color}:${t.i}`;

export class LudoScene extends Phaser.Scene {
  private seats: number[] = [];
  private humans: boolean[] = [];
  private diceCount = 1;
  private tokens: Tokens = newTokens();
  private turnIdx = 0;
  private phase: Phase = "setup";
  private values: number[] = [];
  private used: boolean[] = [];
  private selDie = 0;
  private rollsThisTurn = 0;
  private readyAt = 0;
  private lockUntil = 0;

  private stage: ThreeStage | null = null;
  private dice: DiceSet | null = null;
  private queue = new AnimQueue();
  private pawns = new Map<string, THREE.Group>();
  private targets = new Map<string, THREE.Vector3>();
  private locked = new Set<string>();
  private markers = new THREE.Group();
  private movableKeys = new Set<string>();
  private rig: OrbitRig | null = null;
  private hud!: Hud;
  private rollBtn: Btn | null = null;
  private hideMenu!: () => void;

  constructor() {
    super({ key: "Ludo" });
  }

  init(): void {
    this.seats = [];
    this.humans = [];
    this.diceCount = 1;
    this.tokens = newTokens();
    this.turnIdx = 0;
    this.phase = "setup";
    this.values = [];
    this.used = [];
    this.selDie = 0;
    this.rollsThisTurn = 0;
    this.readyAt = Number.POSITIVE_INFINITY;
    this.lockUntil = 0;
    this.stage = null;
    this.dice = null;
    this.queue = new AnimQueue();
    this.pawns = new Map();
    this.targets = new Map();
    this.locked = new Set();
    this.markers = new THREE.Group();
    this.movableKeys = new Set();
    this.rollBtn = null;
    this.rig = null;
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

    this.stage = ThreeStage.create(this, { key: TEX_KEY, backdrop: ["#7c2d12", "#431407"] });
    this.hud = new Hud(this);

    if (!this.stage) {
      this.hud.setStatus("3D needs WebGL");
      this.hud.setDetail("Your browser can't show the 3D board.\nTry Safari or Chrome on iPad.");
      return;
    }
    this.buildWorld(this.stage);

    showModePicker(
      this,
      "Ludo 🎲",
      "Roll a 6 to bring a token out · race all 4 tokens home\nLand on an opponent to send them back to the start",
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
          "With more than one die, each die is its own move.\nTap a die to choose which one to play, then tap a token.",
          [
            { label: "🎲 1 die", sub: "classic", color: 0x16a34a, mode: "1" },
            { label: "🎲🎲 2 dice", sub: "faster game", color: 0x0369a1, mode: "2" },
            { label: "🎲🎲🎲 3 dice", sub: "super fast", color: 0x7c3aed, mode: "3" },
          ],
          (dc) => this.startGame(Number(dc))
        );
      }
    );
  }

  // ---------------------------------------------------------------- world

  private buildWorld(stage: ThreeStage): void {
    stage.scene.add(buildLudoBoard(), this.markers);
    this.rig = new OrbitRig(stage.camera, { target: new THREE.Vector3(0, 0, 0.9), distance: 24.4, elevationDeg: 61.6 });
    addBoardControls(this, this.rig, (x, y) => this.onTap(x, y));
    stage.keyLight.position.set(5, 18, 8);
    stage.keyLight.shadow.camera.left = -12;
    stage.keyLight.shadow.camera.right = 12;
    stage.keyLight.shadow.camera.top = 12;
    stage.keyLight.shadow.camera.bottom = -12;
  }

  private startGame(diceCount: number): void {
    const stage = this.stage;
    if (!stage) return;
    this.diceCount = diceCount;
    this.dice = new DiceSet(diceCount);
    stage.scene.add(this.dice.group);
    gameAudio.unlock();
    gameAudio.startMusic();

    // One pawn per token for every colour that is playing.
    for (const color of this.seats) {
      for (let i = 0; i < 4; i++) {
        const g = buildPawn(COLOR_HEX[color], PAWN_SCALE);
        g.userData.token = { color, i } as TokenId;
        stage.scene.add(g);
        this.pawns.set(keyOf({ color, i }), g);
      }
    }
    this.layout(true);
    this.readyAt = this.time.now + 300;

    this.rollBtn = makeButton(this, 868, 290, 168, 110, "🎲\nRoll!", 0xdc2626, () => this.onRollButton(), 30, 30);
    this.rollBtn.container.setVisible(false);
    this.beginTurn();
  }

  /** Where a token stands, including a small offset when several share a square. */
  private layout(snap: boolean): void {
    const groups = new Map<string, TokenId[]>();
    for (const color of this.seats) {
      for (let i = 0; i < 4; i++) {
        const r = this.tokens[color][i];
        const id = { color, i };
        const k = r === YARD ? `yard:${color}:${i}` : cellOf(color, r).join(",");
        const list = groups.get(k) ?? [];
        list.push(id);
        groups.set(k, list);
      }
    }
    groups.forEach((list) => {
      list.forEach((id, n) => {
        const r = this.tokens[id.color][id.i];
        const p = new THREE.Vector3();
        if (r === YARD) {
          const [c, rr] = YARD_SLOTS[id.color][id.i];
          p.set(wx(c), SURFACE_Y + 0.1, wz(rr));
        } else {
          const [c, rr] = cellOf(id.color, r);
          p.set(wx(c), SURFACE_Y + 0.02, wz(rr));
          if (list.length > 1) {
            const a = (n / list.length) * Math.PI * 2;
            p.x += Math.cos(a) * 0.24;
            p.z += Math.sin(a) * 0.24;
          }
        }
        this.targets.set(keyOf(id), p);
        if (snap) this.pawns.get(keyOf(id))?.position.copy(p);
      });
    });
  }

  // ---------------------------------------------------------------- turn flow

  private get color(): number {
    return this.seats[this.turnIdx];
  }

  private get isHuman(): boolean {
    return this.humans[this.turnIdx];
  }

  private beginTurn(): void {
    this.phase = "roll";
    this.rollsThisTurn = 0;
    this.prepareRoll();
  }

  /** Waits for the player to roll (or rolls for the computer). */
  private prepareRoll(): void {
    this.phase = "roll";
    this.clearMarkers();
    this.dice?.setSelected(null);
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

  /** Shake, toss and settle the dice, then work out the moves. */
  private doRoll(): void {
    if (this.phase !== "roll" || !this.dice) return;
    this.phase = "rolling";
    this.rollBtn?.container.setVisible(false);
    this.rollsThisTurn += 1;
    this.values = Array.from({ length: this.diceCount }, () => 1 + Math.floor(Math.random() * 6));
    this.used = this.values.map(() => false);
    this.hud.setStatus(`${EMOJI[this.color]} ${COLOR_NAMES[this.color]} is rolling…`);
    this.hud.setDetail("");
    gameAudio.jump();
    this.dice.roll(this.queue, this.time.now, this.values, {
      center: new THREE.Vector3(0, SURFACE_Y + 0.02, 0),
      onThrow: () => gameAudio.hit(),
      onLand: () => this.afterRoll(),
    });
  }

  private afterRoll(): void {
    gameAudio.coin();
    this.nextChoice();
  }

  private diceForRules(): (number | null)[] {
    return this.values.map((v, i) => (this.used[i] ? null : v));
  }

  /** Works out what can be played with the dice that are left, and asks (or decides). */
  private nextChoice(): void {
    const choices = allChoices(this.tokens, this.color, this.diceForRules());
    this.dice?.setUsed(this.used);

    if (choices.length === 0) {
      const none = this.used.every((u) => !u);
      this.hud.setDetail(none ? "No moves with that roll." : "No more moves with the dice left.");
      this.time.delayedCall(none ? 1100 : 700, () => this.endRoll());
      this.phase = "moving";
      this.clearMarkers();
      return;
    }

    if (!this.isHuman) {
      this.phase = "moving";
      this.time.delayedCall(650, () => {
        const pick = chooseMove(this.tokens, this.color, this.diceForRules());
        if (pick) this.play(pick);
        else this.endRoll();
      });
      return;
    }

    // Exactly one possible move: play it without asking.
    if (choices.length === 1) {
      this.phase = "moving";
      this.clearMarkers();
      this.hud.setDetail("Only one move is possible, so here it goes!");
      this.time.delayedCall(700, () => this.play(choices[0]));
      return;
    }

    this.phase = "choose";
    // Keep the chosen die if it can still play, otherwise take the biggest die that can.
    if (!choices.some((c) => c.die === this.selDie)) {
      this.selDie = choices.reduce((best, c) => (this.values[c.die] > this.values[best.die] ? c : best), choices[0]).die;
    }
    this.showChoices(choices);
  }

  /** Highlights the tokens the selected die can move and updates the prompt. */
  private showChoices(choices: Choice[]): void {
    this.dice?.setSelected(this.values.length > 1 ? this.selDie : null);
    this.clearMarkers();
    const mine = choices.filter((c) => c.die === this.selDie);
    this.movableKeys = new Set(mine.map((c) => keyOf({ color: this.color, i: c.move.token })));
    for (const c of mine) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.56, 0.1, 12, 36),
        new THREE.MeshBasicMaterial({ color: 0xfacc15 })
      );
      ring.rotation.x = Math.PI / 2;
      const t = this.targets.get(keyOf({ color: this.color, i: c.move.token }))!;
      ring.position.set(t.x, SURFACE_Y + 0.12, t.z);
      ring.userData.ringFor = keyOf({ color: this.color, i: c.move.token });
      this.markers.add(ring);
    }
    const dieText = this.values.map((v, i) => (this.used[i] ? "–" : String(v))).join("  ·  ");
    const multi = this.values.length > 1;
    this.updateHud(
      multi
        ? `Dice: ${dieText}\nTap a die to pick it, then tap a glowing token.`
        : `You rolled a ${this.values[0]}. Tap a glowing token to move it.`
    );
  }

  private clearMarkers(): void {
    this.markers.clear();
    this.movableKeys.clear();
  }

  private onTap(x: number, y: number): void {
    const stage = this.stage;
    if (!stage || this.phase !== "choose" || this.time.now < this.readyAt) return;
    const targets: THREE.Object3D[] = [...this.pawns.values()];
    if (this.dice) targets.push(...this.dice.meshes);
    const hit = stage.pick(x, y, targets);
    if (!hit) return;

    const die = findUserData<number>(hit.object, "die");
    if (die !== undefined) {
      if (this.used[die]) return;
      const choices = allChoices(this.tokens, this.color, this.diceForRules());
      if (choices.some((c) => c.die === die)) {
        this.selDie = die;
        this.showChoices(choices);
        gameAudio.jump();
      }
      return;
    }
    const tok = findUserData<TokenId>(hit.object, "token");
    if (!tok || tok.color !== this.color || !this.movableKeys.has(keyOf(tok))) return;
    const choice = allChoices(this.tokens, this.color, this.diceForRules()).find((c) => c.die === this.selDie && c.move.token === tok.i);
    if (choice) this.play(choice);
  }

  /** Hops the token along its path, then sends any captured tokens back to their yards. */
  private play(choice: Choice): void {
    const color = this.color;
    const { move, die } = choice;
    this.phase = "moving";
    this.clearMarkers();
    this.used[die] = true;
    this.dice?.setUsed(this.used);
    this.dice?.setSelected(null);

    const id: TokenId = { color, i: move.token };
    const pawn = this.pawns.get(keyOf(id));
    const next = applyMove(this.tokens, color, move);
    const finishMove = (): void => {
      this.locked.delete(keyOf(id));
      this.tokens = next;
      this.layout(false);
      if (move.captures.length > 0) {
        this.sendHome(move.captures, () => this.afterMove(color));
      } else {
        this.afterMove(color);
      }
    };
    if (!pawn) {
      finishMove();
      return;
    }

    // Positions to visit: one square at a time along the track, or straight out of the yard.
    const stops: THREE.Vector3[] = [];
    if (move.from === YARD) {
      const [c, r] = cellOf(color, 0);
      stops.push(new THREE.Vector3(wx(c), SURFACE_Y + 0.02, wz(r)));
    } else {
      for (let r = move.from + 1; r <= move.to; r++) {
        const [c, rr] = cellOf(color, r);
        stops.push(new THREE.Vector3(wx(c), SURFACE_Y + 0.02, wz(rr)));
      }
    }
    this.locked.add(keyOf(id));
    const stepMs = Math.max(110, Math.min(240, 1100 / stops.length));
    const from = pawn.position.clone();
    let prev = from;
    this.queue.chain(
      this.time.now,
      stops.map((to) => () => {
        const a = prev.clone();
        prev = to;
        return {
          dur: stepMs,
          update: (p: number) => {
            const e = easeInOut(p);
            pawn.position.set(a.x + (to.x - a.x) * e, a.y + (to.y - a.y) * e + Math.sin(p * Math.PI) * 0.42, a.z + (to.z - a.z) * e);
          },
        };
      }),
      () => {
        if (move.to === FINAL) gameAudio.coin();
        finishMove();
      }
    );
  }

  /** Captured tokens fly back to their yards. */
  private sendHome(captures: { color: number; token: number }[], done: () => void): void {
    gameAudio.hit();
    let remaining = captures.length;
    for (const c of captures) {
      const id: TokenId = { color: c.color, i: c.token };
      const pawn = this.pawns.get(keyOf(id));
      const slot = this.targets.get(keyOf(id));
      if (!pawn || !slot) {
        remaining--;
        continue;
      }
      this.locked.add(keyOf(id));
      const start = pawn.position.clone();
      this.queue.add(this.time.now, {
        dur: 650,
        update: (p) => {
          const e = easeInOut(p);
          pawn.position.set(start.x + (slot.x - start.x) * e, start.y + (slot.y - start.y) * e + Math.sin(p * Math.PI) * 1.8, start.z + (slot.z - start.z) * e);
          pawn.rotation.y = p * Math.PI * 4;
        },
        done: () => {
          pawn.rotation.y = 0;
          this.locked.delete(keyOf(id));
          if (--remaining <= 0) done();
        },
      });
    }
    if (remaining <= 0) done();
  }

  private afterMove(color: number): void {
    if (hasWon(this.tokens, color)) {
      this.finish(color);
      return;
    }
    this.nextChoice();
  }

  /** All dice are used (or none can play): give a bonus roll for a 6, or pass the turn. */
  private endRoll(): void {
    if (this.phase === "over") return;
    if (earnsBonus(this.values) && this.rollsThisTurn < MAX_ROLLS_PER_TURN) {
      this.hud.setDetail("A six! Roll again.");
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
    this.time.delayedCall(700, () =>
      showGameOver(this, "All four tokens made it home.", () => this.scene.restart(), () => this.scene.start("Menu"), title)
    );
  }

  private updateHud(extra?: string): void {
    if (this.phase === "over") return;
    const counts = this.seats.map((c) => `${EMOJI[c]} ${homeCount(this.tokens, c)}`).join("   ");
    this.hud.setCounts(`Home: ${counts}`);
    const name = `${EMOJI[this.color]} ${COLOR_NAMES[this.color]}`;
    if (this.humans.some((h) => !h)) {
      this.hud.setStatus(this.isHuman ? `${name}: your turn` : `${name} (computer)`);
    } else {
      this.hud.setStatus(`${name}'s turn`);
    }
    if (extra !== undefined) {
      this.hud.setDetail(extra);
    } else if (this.phase === "roll") {
      const again = this.rollsThisTurn > 0 ? "  (bonus roll!)" : "";
      this.hud.setDetail(this.isHuman ? `Tap the Roll button.${again}${this.humans.length > 1 && this.humans.filter(Boolean).length > 1 ? "  Pass the iPad if it's not your turn." : ""}` : "The computer is thinking…");
    }
  }

  update(time: number): void {
    const stage = this.stage;
    if (stage) {
      this.queue.update(time);
      this.rig?.update();
      this.dice?.update(time);

      // Tokens glide to where they belong, and movable ones bob.
      this.pawns.forEach((g, k) => {
        if (this.locked.has(k)) return;
        const t = this.targets.get(k);
        if (!t) return;
        const bob = this.movableKeys.has(k) ? 0.12 + Math.abs(Math.sin(time / 220)) * 0.22 : 0;
        g.position.x += (t.x - g.position.x) * 0.25;
        g.position.z += (t.z - g.position.z) * 0.25;
        g.position.y += (t.y + bob - g.position.y) * 0.3;
      });
      this.markers.children.forEach((ring) => {
        const k = ring.userData.ringFor as string | undefined;
        const g = k ? this.pawns.get(k) : undefined;
        if (g) {
          ring.position.x = g.position.x;
          ring.position.z = g.position.z;
          const s = 1 + Math.sin(time / 160) * 0.08;
          ring.scale.set(s, s, 1);
        }
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
