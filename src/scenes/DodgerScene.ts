import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { gameAudio } from "../audio/sfx";
import { deviceUsesTouch } from "../input/touchPad";
import { setTouchChrome } from "../input/touchChrome";
import { addMenuButton, addMovePads, overMenuButton, pollEndTaps, resetTaps, showGameOver } from "../ui/arcadeKit";

type Rock = { sprite: Phaser.GameObjects.Image; r: number; hp: number; vy: number; spin: number };
type Bullet = { sprite: Phaser.GameObjects.Image; vx: number; vy: number };
type Pickup = { sprite: Phaser.GameObjects.Image; kind: "shield" | "spread"; vy: number };

const SHIP_Y = GAME_HEIGHT - 125;

export class DodgerScene extends Phaser.Scene {
  private ship!: Phaser.GameObjects.Image;
  private shield!: Phaser.GameObjects.Arc;
  private rocks: Rock[] = [];
  private bullets: Bullet[] = [];
  private pickups: Pickup[] = [];
  private stars: Phaser.GameObjects.Arc[] = [];
  private score = 0;
  private lives = 3;
  private dead = false;
  private started = false;
  private shieldOn = false;
  private spreadUntil = 0;
  private invulnUntil = 0;
  private nextRock = 0;
  private nextShot = 0;
  private lockUntil = 0;
  private survived = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private powerText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private hideMenu!: () => void;
  private keys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private pads!: { dir: () => number };
  private vel = 0;
  private wasd!: { a: Phaser.Input.Keyboard.Key; d: Phaser.Input.Keyboard.Key };

  constructor() {
    super({ key: "Dodger" });
  }

  init(): void {
    this.rocks = [];
    this.bullets = [];
    this.pickups = [];
    this.stars = [];
    this.score = 0;
    this.lives = 3;
    this.dead = false;
    this.started = false;
    this.shieldOn = false;
    this.spreadUntil = 0;
    this.invulnUntil = 0;
    this.nextRock = 0;
    this.nextShot = 0;
    this.lockUntil = 0;
    this.survived = 0;
    this.vel = 0;
    resetTaps();
  }

  private makeTextures(): void {
    if (this.textures.exists("dodger-ship")) return;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x38bdf8, 1);
    g.fillTriangle(20, 0, 0, 44, 40, 44);
    g.fillStyle(0xe0f2fe, 1);
    g.fillTriangle(20, 10, 12, 34, 28, 34);
    g.fillStyle(0xf97316, 1);
    g.fillTriangle(14, 44, 26, 44, 20, 54);
    g.generateTexture("dodger-ship", 40, 56);
    g.clear();

    g.fillStyle(0x78716c, 1);
    g.fillCircle(32, 32, 30);
    g.fillStyle(0x57534e, 1);
    g.fillCircle(22, 24, 8);
    g.fillCircle(42, 40, 10);
    g.fillCircle(38, 18, 5);
    g.generateTexture("dodger-rock", 64, 64);
    g.clear();

    g.fillStyle(0xfde047, 1);
    g.fillRoundedRect(0, 0, 6, 18, 3);
    g.generateTexture("dodger-bullet", 6, 18);
    g.clear();

    g.fillStyle(0x38bdf8, 1);
    g.fillCircle(16, 16, 15);
    g.lineStyle(3, 0xffffff, 1);
    g.strokeCircle(16, 16, 15);
    g.generateTexture("dodger-pick-shield", 32, 32);
    g.clear();

    g.fillStyle(0xfacc15, 1);
    g.fillCircle(16, 16, 15);
    g.lineStyle(3, 0xffffff, 1);
    g.strokeCircle(16, 16, 15);
    g.fillStyle(0x0f172a, 1);
    g.fillRect(8, 14, 16, 4);
    g.fillRect(14, 8, 4, 16);
    g.generateTexture("dodger-pick-spread", 32, 32);
    g.destroy();
  }

  create(): void {
    setTouchChrome("hidden");
    this.makeTextures();
    this.cameras.main.setBackgroundColor(0x020617);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setTouchChrome("hidden"));

    for (let i = 0; i < 70; i++) {
      const s = this.add
        .circle(
          Phaser.Math.Between(0, GAME_WIDTH),
          Phaser.Math.Between(0, GAME_HEIGHT),
          Phaser.Math.FloatBetween(0.8, 2),
          0xffffff,
          Phaser.Math.FloatBetween(0.3, 0.9)
        )
        .setDepth(0);
      this.stars.push(s);
    }

    this.ship = this.add.image(GAME_WIDTH / 2, SHIP_Y, "dodger-ship").setDepth(10);
    this.shield = this.add.circle(this.ship.x, this.ship.y, 36, 0x38bdf8, 0.22).setStrokeStyle(3, 0x7dd3fc, 1).setDepth(11).setVisible(false);

    this.scoreText = this.add
      .text(GAME_WIDTH / 2, 30, "0", { fontFamily: "system-ui, sans-serif", fontSize: "40px", color: "#ffffff", fontStyle: "700" })
      .setOrigin(0.5)
      .setDepth(50);
    this.livesText = this.add
      .text(GAME_WIDTH - 20, 24, "", { fontFamily: "system-ui, sans-serif", fontSize: "26px", color: "#f87171" })
      .setOrigin(1, 0.5)
      .setDepth(50);
    this.powerText = this.add
      .text(GAME_WIDTH - 20, 52, "", { fontFamily: "system-ui, sans-serif", fontSize: "15px", color: "#fde047" })
      .setOrigin(1, 0.5)
      .setDepth(50);
    this.hint = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2,
        deviceUsesTouch() ? "Hold ◀ ▶ to steer · auto-fire\nDodge or shoot the rocks" : "Arrow keys / A D or drag to steer · auto-fire\nDodge or shoot the rocks",
        { fontFamily: "system-ui, sans-serif", fontSize: "22px", color: "#e2e8f0", align: "center" }
      )
      .setOrigin(0.5)
      .setDepth(50);
    this.syncHud();

    this.hideMenu = addMenuButton(this, () => {
      if (!this.dead) this.scene.start("Menu");
    });

    this.pads = addMovePads(this);
    this.keys = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      a: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      d: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.dead || overMenuButton(p)) return;
      this.begin();
    });
  }

  private begin(): void {
    if (this.started) return;
    this.started = true;
    this.hint.setVisible(false);
    gameAudio.unlock();
    gameAudio.startMusic();
  }

  private syncHud(): void {
    this.scoreText.setText(String(this.score));
    this.livesText.setText("♥".repeat(Math.max(0, this.lives)));
    const parts: string[] = [];
    if (this.shieldOn) parts.push("Shield");
    if (this.time.now < this.spreadUntil) parts.push("Spread shot");
    this.powerText.setText(parts.join(" · "));
  }

  private spawnRock(): void {
    const r = Phaser.Math.Between(16, 36);
    const speedBoost = Math.min(this.survived * 6, 220);
    const rock: Rock = {
      sprite: this.add
        .image(Phaser.Math.Between(r, GAME_WIDTH - r), -r, "dodger-rock")
        .setDisplaySize(r * 2, r * 2)
        .setDepth(8),
      r,
      hp: r > 27 ? 3 : r > 21 ? 2 : 1,
      vy: Phaser.Math.Between(110, 170) + speedBoost,
      spin: Phaser.Math.FloatBetween(-1.5, 1.5),
    };
    this.rocks.push(rock);
  }

  private fire(now: number): void {
    const spread = now < this.spreadUntil;
    const angles = spread ? [-0.28, 0, 0.28] : [0];
    for (const a of angles) {
      const sp = this.add.image(this.ship.x, this.ship.y - 30, "dodger-bullet").setDepth(9).setRotation(a);
      this.bullets.push({ sprite: sp, vx: Math.sin(a) * 620, vy: -Math.cos(a) * 620 });
    }
    gameAudio.shoot();
  }

  private killRock(i: number): void {
    const rock = this.rocks[i];
    if (Math.random() < 0.12) {
      const kind = Math.random() < 0.5 ? "shield" : "spread";
      this.pickups.push({
        sprite: this.add.image(rock.sprite.x, rock.sprite.y, `dodger-pick-${kind}`).setDepth(9),
        kind,
        vy: 120,
      });
    }
    this.burst(rock.sprite.x, rock.sprite.y, rock.r);
    rock.sprite.destroy();
    this.rocks.splice(i, 1);
    this.score += rock.r > 27 ? 30 : rock.r > 21 ? 20 : 10;
    gameAudio.coin();
  }

  private burst(x: number, y: number, size: number): void {
    for (let k = 0; k < 8; k++) {
      const dot = this.add.circle(x, y, Phaser.Math.Between(2, 4), 0xfbbf24, 1).setDepth(12);
      const a = (k / 8) * Math.PI * 2;
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(a) * size * 1.4,
        y: y + Math.sin(a) * size * 1.4,
        alpha: 0,
        duration: 320,
        onComplete: () => dot.destroy(),
      });
    }
  }

  private hitShip(i: number): void {
    const rock = this.rocks[i];
    this.burst(rock.sprite.x, rock.sprite.y, rock.r);
    rock.sprite.destroy();
    this.rocks.splice(i, 1);
    if (this.shieldOn) {
      this.shieldOn = false;
      this.shield.setVisible(false);
      gameAudio.hit();
      return;
    }
    this.lives -= 1;
    gameAudio.hit();
    this.invulnUntil = this.time.now + 1200;
    if (this.lives <= 0) this.die();
  }

  private die(): void {
    if (this.dead) return;
    this.dead = true;
    gameAudio.stopMusic();
    this.lockUntil = this.time.now + 450;
    this.hideMenu();
    this.ship.setTint(0xfca5a5);
    showGameOver(this, `Score ${this.score}`, () => this.scene.restart(), () => this.scene.start("Menu"));
  }

  update(time: number, delta: number): void {
    const dt = Math.min(delta, 34) / 1000;

    for (const s of this.stars) {
      s.y += (s.radius * 28 + 14) * dt;
      if (s.y > GAME_HEIGHT) {
        s.y = -2;
        s.x = Phaser.Math.Between(0, GAME_WIDTH);
      }
    }

    if (this.dead) {
      if (time < this.lockUntil) return;
      const tap = pollEndTaps();
      if (tap === "restart") this.scene.restart();
      else if (tap === "menu") this.scene.start("Menu");
      return;
    }

    // steering
    const pointer = this.input.activePointer;
    let dir = this.pads.dir();
    if (this.keys.left.isDown || this.wasd.a.isDown) dir -= 1;
    if (this.keys.right.isDown || this.wasd.d.isDown) dir += 1;
    dir = Phaser.Math.Clamp(dir, -1, 1);
    if (dir !== 0) {
      this.begin();
      // eased acceleration so the ship glides smoothly
      this.vel += (dir * 520 - this.vel) * Math.min(1, dt * 10);
    } else {
      this.vel += (0 - this.vel) * Math.min(1, dt * 14);
      if (Math.abs(this.vel) < 4) this.vel = 0;
      // desktop only: hold the mouse button to steer toward the pointer
      if (!deviceUsesTouch() && pointer.isDown && !overMenuButton(pointer)) {
        this.begin();
        this.ship.x += (pointer.x - this.ship.x) * Math.min(1, dt * 14);
      }
    }
    this.ship.x += this.vel * dt;
    this.ship.x = Phaser.Math.Clamp(this.ship.x, 24, GAME_WIDTH - 24);
    this.shield.setPosition(this.ship.x, this.ship.y);

    if (!this.started) return;

    this.survived += dt;
    const blink = time < this.invulnUntil && Math.floor(time / 90) % 2 === 0;
    this.ship.setAlpha(blink ? 0.35 : 1);

    // fire
    if (time >= this.nextShot) {
      this.nextShot = time + 240;
      this.fire(time);
    }

    // spawn rocks, faster over time
    if (time >= this.nextRock) {
      this.nextRock = time + Math.max(320, 950 - this.survived * 14);
      this.spawnRock();
    }

    // bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.sprite.x += b.vx * dt;
      b.sprite.y += b.vy * dt;
      let used = false;
      for (let j = this.rocks.length - 1; j >= 0; j--) {
        const rock = this.rocks[j];
        const d = Phaser.Math.Distance.Between(b.sprite.x, b.sprite.y, rock.sprite.x, rock.sprite.y);
        if (d < rock.r + 6) {
          rock.hp -= 1;
          used = true;
          if (rock.hp <= 0) this.killRock(j);
          else rock.sprite.setTint(0xfecaca);
          break;
        }
      }
      if (used || b.sprite.y < -30 || b.sprite.x < -30 || b.sprite.x > GAME_WIDTH + 30) {
        b.sprite.destroy();
        this.bullets.splice(i, 1);
      }
    }

    // rocks
    for (let i = this.rocks.length - 1; i >= 0; i--) {
      const rock = this.rocks[i];
      rock.sprite.y += rock.vy * dt;
      rock.sprite.rotation += rock.spin * dt;
      if (rock.sprite.y > GAME_HEIGHT + rock.r + 10) {
        rock.sprite.destroy();
        this.rocks.splice(i, 1);
        continue;
      }
      if (time >= this.invulnUntil || this.shieldOn) {
        const d = Phaser.Math.Distance.Between(this.ship.x, this.ship.y, rock.sprite.x, rock.sprite.y);
        if (d < rock.r + (this.shieldOn ? 30 : 16)) {
          this.hitShip(i);
          if (this.dead) return;
        }
      }
    }

    // pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.sprite.y += p.vy * dt;
      const d = Phaser.Math.Distance.Between(this.ship.x, this.ship.y, p.sprite.x, p.sprite.y);
      if (d < 34) {
        if (p.kind === "shield") {
          this.shieldOn = true;
          this.shield.setVisible(true);
        } else {
          this.spreadUntil = time + 9000;
        }
        gameAudio.coin();
        p.sprite.destroy();
        this.pickups.splice(i, 1);
      } else if (p.sprite.y > GAME_HEIGHT + 20) {
        p.sprite.destroy();
        this.pickups.splice(i, 1);
      }
    }

    this.syncHud();
  }
}
