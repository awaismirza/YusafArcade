import Phaser from "phaser";
import { FONT } from "../ui/theme";
import { addChip, Chip } from "../ui/chips";
import { gameAudio } from "../audio/sfx";
import { deviceUsesTouch, touchPad } from "../input/touchPad";
import { setTouchChrome } from "../input/touchChrome";
import {
  COMBAT,
  FALL_DEATH_Y,
  GAME_HEIGHT,
  GAME_WIDTH,
  GROUND_SURFACE_Y,
  HERO,
  PHYSICS,
  PLAYER_RUN_X,
  STAGE_DISTANCE,
  WORLD,
} from "../config";

type HazardKind = "spike" | "crate" | "ember" | "critter";

interface Mover {
  sprite: Phaser.GameObjects.Sprite;
  speed: number;
}

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private jumpKey!: Phaser.Input.Keyboard.Key;
  private wKey!: Phaser.Input.Keyboard.Key;
  private ground!: Phaser.Physics.Arcade.StaticGroup;
  private hazards!: Phaser.Physics.Arcade.Group;
  private coins!: Phaser.Physics.Arcade.Group;
  private pads!: Phaser.Physics.Arcade.StaticGroup;
  private monsters!: Phaser.Physics.Arcade.Group;
  private enemyShots!: Phaser.Physics.Arcade.Group;
  private playerShots!: Phaser.Physics.Arcade.Group;
  private slashes!: Phaser.Physics.Arcade.Group;
  private stageSprites: Phaser.GameObjects.Sprite[] = [];
  private sky!: Phaser.GameObjects.Graphics;
  private lavaSky!: Phaser.GameObjects.Graphics;
  private clouds: Mover[] = [];
  private birds: Mover[] = [];
  private villagers: Mover[] = [];
  private decorTrees: Phaser.GameObjects.Sprite[] = [];
  private distanceText!: Chip;
  private coinText!: Chip;
  private stageText!: Chip;
  private shadow!: Phaser.GameObjects.Ellipse;
  private shootingUntil = 0;
  private jumpHint!: Phaser.GameObjects.Text;
  private startHint!: Phaser.GameObjects.Text;
  private lastGroundX = 0;
  private nextSpawnX = 0;
  private distance = 0;
  private coinsCollected = 0;
  private isDead = false;
  private gameStarted = false;
  private rising = false;
  private jumpHold = 0;
  private coyote = 0;
  private jumpBuffer = 0;
  private level = 1;
  private hp = COMBAT.hp;
  private invuln = 0;
  private swordCooldown = 0;
  private gunCooldown = 0;
  private swordKey!: Phaser.Input.Keyboard.Key;
  private rightCommandKey!: Phaser.Input.Keyboard.Key;
  private gunKey!: Phaser.Input.Keyboard.Key;
  private duckKey!: Phaser.Input.Keyboard.Key;
  private sKey!: Phaser.Input.Keyboard.Key;
  private ducking = false;
  private touchJumpWasHeld = false;
  private optionPressed = false;
  private commandPressed = false;
  private readonly onMetaDown = (event: KeyboardEvent): void => {
    if (event.key === "Alt") {
      event.preventDefault();
      this.optionPressed = true;
    }
    if (event.key === "Meta") {
      event.preventDefault();
      this.commandPressed = true;
    }
  };
  private readonly onMetaUp = (event: KeyboardEvent): void => {
    if (event.key === "Alt" || event.key === "Meta") event.preventDefault();
  };

  constructor() {
    super({ key: "Game" });
  }

  create(): void {
    setTouchChrome("runner");
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setTouchChrome("hidden"));
    gameAudio.stopMusic();
    this.physics.resume();
    this.isDead = false;
    this.gameStarted = false;
    this.rising = false;
    this.jumpHold = 0;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.level = 1;
    this.hp = COMBAT.hp;
    this.invuln = 0;
    this.swordCooldown = 0;
    this.gunCooldown = 0;
    this.distance = 0;
    this.coinsCollected = 0;
    this.clouds = [];
    this.birds = [];
    this.villagers = [];
    this.decorTrees = [];
    this.stageSprites = [];
    this.lastGroundX = 0;
    gameAudio.setTheme("grass");

    this.cameras.main.setBackgroundColor(0x7dd3fc);
    this.cameras.main.stopFollow();
    this.cameras.main.setScroll(0, 0);
    this.physics.world.setBounds(0, 0, Number.MAX_SAFE_INTEGER, GAME_HEIGHT + 80);
    this.physics.world.gravity.y = PHYSICS.gravityY;

    this.sky = this.add.graphics();
    this.sky.fillGradientStyle(0x38bdf8, 0x38bdf8, 0xbae6fd, 0xbae6fd, 1);
    this.sky.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.sky.setScrollFactor(0).setDepth(-20);

    this.lavaSky = this.add.graphics();
    this.lavaSky.fillGradientStyle(0x7f1d1d, 0x7f1d1d, 0xf97316, 0xfb923c, 1);
    this.lavaSky.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.lavaSky.setScrollFactor(0).setDepth(-20).setVisible(false);

    this.spawnScenery();

    this.ground = this.physics.add.staticGroup();
    this.hazards = this.physics.add.group();
    this.coins = this.physics.add.group();
    this.pads = this.physics.add.staticGroup();
    this.monsters = this.physics.add.group();
    this.enemyShots = this.physics.add.group();
    this.playerShots = this.physics.add.group();
    this.slashes = this.physics.add.group();

    const chunks = Math.ceil((GAME_WIDTH * 2) / WORLD.chunkWidth);
    for (let i = 0; i < chunks; i++) {
      this.spawnGround(i * WORLD.chunkWidth + WORLD.chunkWidth / 2);
    }
    this.lastGroundX = chunks * WORLD.chunkWidth;

    this.player = this.physics.add.sprite(PLAYER_RUN_X, GROUND_SURFACE_Y, "kit-idle", 0);
    this.player.setOrigin(0.5, 1).setDepth(20).setScale(HERO.scale);
    this.player.anims.stop();
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(HERO.bodyW, HERO.bodyH);
    body.setOffset((HERO.frameW - HERO.bodyW) / 2, HERO.frameH - HERO.bodyH);
    body.setAllowGravity(false);
    body.setVelocity(0, 0);
    body.setBounce(0);
    body.setDrag(0, 0);
    body.setMaxVelocity(PHYSICS.autoRunSpeed, 1600);

    this.physics.add.collider(this.player, this.ground);
    this.physics.add.collider(this.player, this.pads);
    this.physics.add.overlap(this.player, this.hazards, () => this.endRun(), undefined, this);
    this.physics.add.overlap(this.player, this.coins, (_player, coin) => {
      coin.destroy();
      this.coinsCollected += 1;
      this.coinText.setText(`Coins ${this.coinsCollected}`);
      gameAudio.coin();
    });
    this.physics.add.overlap(this.player, this.monsters, () => this.hurt(), undefined, this);
    this.physics.add.overlap(this.player, this.enemyShots, (_player, shot) => {
      shot.destroy();
      this.hurt();
    });
    this.physics.add.overlap(this.playerShots, this.monsters, (shot, monster) => {
      shot.destroy();
      monster.destroy();
      gameAudio.hit();
    });

    // iPad Chrome can deliver a huge frame. The default catch-up loop would freeze the game.
    this.physics.disableUpdate();
    this.physics.add.overlap(this.slashes, this.monsters, (_slash, monster) => {
      monster.destroy();
      gameAudio.slash();
    });

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.jumpKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.wKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.swordKey = this.input.keyboard!.addKey(91);
    this.rightCommandKey = this.input.keyboard!.addKey(93);
    this.gunKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ALT);
    this.duckKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.sKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.input.keyboard!.addCapture([
      Phaser.Input.Keyboard.KeyCodes.ALT,
      91,
      93,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
    ]);
    window.addEventListener("keydown", this.onMetaDown);
    window.addEventListener("keyup", this.onMetaUp);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener("keydown", this.onMetaDown);
      window.removeEventListener("keyup", this.onMetaUp);
    });
    this.nextSpawnX = PLAYER_RUN_X + 520;

    this.distanceText = addChip(this, GAME_WIDTH / 2, 34, { icon: "🏃", width: 130, depth: 50 });
    this.distanceText.setText("0 m");
    this.coinText = addChip(this, GAME_WIDTH - 100, 34, { icon: "🪙", width: 150, depth: 50 });
    this.coinText.setText("Coins 0");
    this.stageText = addChip(this, GAME_WIDTH / 2, 80, { width: 250, depth: 50 });
    this.stageText.setText("Level 1  ·  reach 500 m");

    this.startHint = this.add
      .text(GAME_WIDTH / 2, 150, deviceUsesTouch() ? "Tap Shoot to run" : "Press SPACE to run", {
        fontFamily: FONT,
        fontSize: "32px",
        color: "#0f172a",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(50);
    this.jumpHint = this.add
      .text(GAME_WIDTH / 2, 190, deviceUsesTouch() ? "Then use Jump, Duck, and Sword" : "Jump with W or ↑", {
        fontFamily: FONT,
        fontSize: "16px",
        color: "#334155",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(50);

    this.shadow = this.add.ellipse(PLAYER_RUN_X, GROUND_SURFACE_Y + 4, 34, 10, 0x000000, 0.4);
    this.shadow.setDepth(19);

    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT, GAME_WIDTH, GAME_HEIGHT - GROUND_SURFACE_Y, 0x1c1917)
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(6);
  }

  private spawnScenery(): void {
    for (let i = 0; i < 6; i++) {
      const cloud = this.add.sprite(120 + i * 180, 70 + (i % 3) * 36, "cloud");
      cloud.setScrollFactor(0).setDepth(-12).setAlpha(0.9);
      this.clouds.push({ sprite: cloud, speed: 12 + (i % 3) * 6 });
    }
    for (let i = 0; i < 5; i++) {
      const bird = this.add.sprite(80 + i * 200, 90 + (i % 2) * 40, "bird");
      bird.setScrollFactor(0).setDepth(-8);
      this.birds.push({ sprite: bird, speed: 40 + i * 8 });
      this.tweens.add({
        targets: bird,
        y: bird.y + 10,
        duration: 700 + i * 80,
        yoyo: true,
        repeat: -1,
      });
    }
    for (let i = 0; i < 4; i++) {
      const tree = this.add.sprite(40 + i * 260, GROUND_SURFACE_Y, "bg-tree");
      tree.setOrigin(0.5, 1).setScrollFactor(0).setDepth(-6).setAlpha(0.7);
      this.decorTrees.push(tree);
    }
    for (let i = 0; i < 3; i++) {
      const person = this.add.sprite(200 + i * 280, GROUND_SURFACE_Y - 8, "villager");
      person.setOrigin(0.5, 1).setScrollFactor(0).setDepth(-4).setAlpha(0.85);
      this.villagers.push({ sprite: person, speed: 18 + i * 6 });
    }
  }

  private beginRun(): void {
    this.gameStarted = true;
    this.startHint.setVisible(false);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true);
    this.cameras.main.startFollow(this.player, true, 1, 0);
    this.cameras.main.setFollowOffset(PLAYER_RUN_X - GAME_WIDTH / 2, 0);
    this.player.play("hero-run");
    gameAudio.startMusic();
  }

  private spawnGround(x: number): void {
    const key = this.level >= 2 ? "lava-ground" : "ground";
    const tile = this.ground.create(
      x,
      GROUND_SURFACE_Y + 56,
      key
    ) as Phaser.Physics.Arcade.Sprite;
    tile.setOrigin(0.5, 1).setDepth(2);
    tile.refreshBody();
    const platform = tile.body as Phaser.Physics.Arcade.StaticBody;
    platform.setSize(WORLD.chunkWidth, 20);
    platform.setOffset(0, 0);
    platform.updateFromGameObject();
  }

  private endRun(): void {
    if (this.isDead || !this.gameStarted) return;
    this.isDead = true;
    this.gameStarted = false;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setAllowGravity(false);
    this.player.setTint(0xfca5a5);
    this.player.anims.stop();
    this.player.setTexture("kit-idle", 0);
    this.physics.pause();
    gameAudio.hit();
    gameAudio.stopMusic();
    this.time.delayedCall(280, () => {
      this.scene.start("GameOver", {
        score: this.distance,
        coins: this.coinsCollected,
      });
    });
  }

  private enterLevel2(): void {
    this.openStage(2);
  }

  private enterLevel3(): void {
    this.openStage(3);
  }

  private openStage(stage: number): void {
    this.level = stage;
    this.gameStarted = false;
    this.rising = false;
    this.distance = 0;
    this.hp = COMBAT.hp;
    this.invuln = 0;
    gameAudio.stopMusic();
    gameAudio.setTheme("lava");

    this.hazards.clear(true, true);
    this.coins.clear(true, true);
    this.pads.clear(true, true);
    this.ground.clear(true, true);
    this.monsters.clear(true, true);
    this.enemyShots.clear(true, true);
    this.playerShots.clear(true, true);
    this.slashes.clear(true, true);
    this.stageSprites.forEach((sprite) => sprite.destroy());
    this.stageSprites = [];

    this.sky.setVisible(false);
    this.lavaSky.setVisible(true);
    if (stage === 3) {
      this.cameras.main.setBackgroundColor(0x1e1b4b);
      this.lavaSky.setVisible(true);
    } else {
      this.cameras.main.setBackgroundColor(0x7f1d1d);
      this.lavaSky.setVisible(true);
    }
    this.cameras.main.stopFollow();
    this.cameras.main.setScroll(0, 0);
    for (const tree of this.decorTrees) tree.setVisible(false);
    for (const bird of this.birds) bird.sprite.setVisible(false);
    for (const person of this.villagers) person.sprite.setVisible(false);
    for (const cloud of this.clouds) cloud.sprite.setTint(0xfed7aa);

    const chunks = Math.ceil((GAME_WIDTH * 2) / WORLD.chunkWidth);
    for (let i = 0; i < chunks; i++) {
      this.spawnGround(i * WORLD.chunkWidth + WORLD.chunkWidth / 2);
    }
    this.lastGroundX = chunks * WORLD.chunkWidth;
    this.nextSpawnX = PLAYER_RUN_X + 520;

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setAllowGravity(false);
    this.player.clearTint();
    this.player.setPosition(PLAYER_RUN_X, GROUND_SURFACE_Y);
    this.player.anims.stop();
    this.player.setTexture("kit-idle", 0);

    this.distanceText.setText("0 m");
    this.stageText.setText(`Level ${stage}  ·  HP 3`);
    this.startHint.setVisible(true).setText(deviceUsesTouch() ? "Tap Shoot" : "SPACE shoots").setColor("#fff7ed");
    this.jumpHint
      .setText(deviceUsesTouch() ? "Jump  ·  Duck  ·  Sword" : "W or ↑ jump   ·   ↓ duck   ·   ⌘ sword")
      .setColor("#ffedd5");
  }

  private hurt(): void {
    if (this.isDead || !this.gameStarted || this.invuln > 0) return;
    this.hp -= 1;
    if (this.hp <= 0) {
      this.endRun();
      return;
    }
    this.invuln = 900;
    this.player.setTint(0xfca5a5);
    this.stageText.setText(`Level 2  ·  HP ${this.hp}`);
    gameAudio.hit();
  }

  private stand(): void {
    this.ducking = false;
    this.player.setScale(HERO.scale, HERO.scale);
    const body = this.player.body as Phaser.Physics.Arcade.Body | null;
    if (!body) return;
    body.setSize(HERO.bodyW, HERO.bodyH);
    body.setOffset((HERO.frameW - HERO.bodyW) / 2, HERO.frameH - HERO.bodyH);
  }

  private swing(): void {
    if (this.swordCooldown > 0) return;
    this.swordCooldown = COMBAT.swordCooldownMs;
    const slashY = this.ducking ? this.player.y - 16 : this.player.y - 42;
    const slash = this.slashes.create(
      this.player.x + 36,
      slashY,
      "slash"
    ) as Phaser.Physics.Arcade.Sprite;
    slash.setDepth(22);
    const body = slash.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(44, 18);
    gameAudio.slash();
    this.time.delayedCall(COMBAT.swordMs, () => slash.destroy());
  }

  private shoot(): void {
    if (this.gunCooldown > 0) return;
    this.gunCooldown = COMBAT.gunCooldownMs;
    const bulletY = this.player.y - HERO.frameH * HERO.scale * (this.ducking ? 0.28 : 0.55);
    const bullet = this.playerShots.create(
      this.player.x + 24,
      bulletY,
      "bullet"
    ) as Phaser.Physics.Arcade.Sprite;
    bullet.setDepth(21);
    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setVelocityX(COMBAT.bulletSpeed);
    gameAudio.shoot();
    this.shootingUntil = this.time.now + 180;
  }

  private spawnMonster(x: number, floor: number): void {
    const monster = this.monsters.create(x, floor, "obs-slime", 0) as Phaser.Physics.Arcade.Sprite;
    monster.setOrigin(0.5, 1).setDepth(8).setScale(2).setTint(0xfb923c);
    monster.play("slime-walk");
    const body = monster.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setSize(16, 14);
    body.setOffset(4, 8);
    body.setVelocityX(-50);
    monster.setData("kind", "walker");
    monster.setData("bodyLift", 14);
    monster.setData("nextShot", this.time.now + Phaser.Math.Between(500, 1400));
  }

  private spawnRival(x: number, floor: number, kind: "punch" | "shoot"): void {
    const rival = this.monsters.create(x, floor, "kit-idle", 0) as Phaser.Physics.Arcade.Sprite;
    rival.setOrigin(0.5, 1).setDepth(8).setScale(0.7);
    rival.setTint(kind === "punch" ? 0xfca5a5 : 0xbfdbfe);
    const body = rival.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setSize(22, 40);
    body.setOffset(9, 12);
    body.setVelocityX(kind === "punch" ? -150 : -30);
    rival.setData("kind", kind);
    rival.setData("bodyLift", 28);
    rival.setData("nextShot", this.time.now + Phaser.Math.Between(400, 1100));
  }

  private spawnCrab(x: number, floor: number): void {
    const crab = this.monsters.create(x, floor, "tank-crab") as Phaser.Physics.Arcade.Sprite;
    crab.setOrigin(0.5, 1).setDepth(8).setScale(1.35);
    const body = crab.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setSize(40, 16);
    body.setOffset(6, 10);
    body.setVelocityX(0);
    crab.setData("kind", "crab");
    crab.setData("bodyLift", 12);
    crab.setData("nextShot", this.time.now + Phaser.Math.Between(500, 1200));
  }

  private spawnImp(x: number, floor: number): void {
    const imp = this.monsters.create(x, floor, "kit-idle", 0) as Phaser.Physics.Arcade.Sprite;
    imp.setOrigin(0.5, 1).setDepth(8).setScale(1.15).setTint(0xfb923c);
    const body = imp.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setSize(18, 52);
    body.setOffset(11, 12);
    body.setVelocityX(0);
    imp.setData("kind", "imp");
    imp.setData("bodyLift", 40);
    imp.setData("nextShot", this.time.now + Phaser.Math.Between(600, 1400));
  }

  private monsterShoot(monster: Phaser.Physics.Arcade.Sprite): void {
    const shot = this.enemyShots.create(monster.x - 8, monster.y - 18, "fireball") as Phaser.Physics.Arcade.Sprite;
    shot.setDepth(9);
    const body = shot.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setCircle(12);
    body.setOffset(2, 2);
    const dx = this.player.x - shot.x;
    const dy = this.player.y - 40 - shot.y;
    const len = Math.hypot(dx, dy) || 1;
    body.setVelocity((dx / len) * COMBAT.fireballSpeed, (dy / len) * COMBAT.fireballSpeed);
  }

  private crabShoot(crab: Phaser.Physics.Arcade.Sprite): void {
    const shot = this.enemyShots.create(crab.x - 18, crab.y - 10, "fireball") as Phaser.Physics.Arcade.Sprite;
    shot.setDepth(9);
    const body = shot.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setCircle(10);
    body.setVelocity(-320, 0);
  }

  private impLob(imp: Phaser.Physics.Arcade.Sprite): void {
    const shot = this.enemyShots.create(imp.x - 8, imp.y - 48, "fireball") as Phaser.Physics.Arcade.Sprite;
    shot.setDepth(9);
    const body = shot.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true);
    body.setCircle(10);
    body.setVelocity(-160, -700);
  }

  private spawnPattern(x: number): void {
    const floor = GROUND_SURFACE_Y;
    if (this.level >= 2) {
      const roll = Phaser.Math.Between(0, 5);
      if (roll === 0) this.spawnMonster(x, floor);
      else if (roll === 1) this.spawnRival(x, floor, "punch");
      else if (roll === 2) this.spawnRival(x, floor, "shoot");
      else if (roll === 3) this.spawnCrab(x, floor);
      else if (roll === 4) this.spawnImp(x, floor);
      else this.spawnHazard(x, floor, "ember");
      return;
    }

    const roll = Phaser.Math.Between(0, 5);

    if (roll === 0) this.spawnHazard(x, floor, "spike");
    else if (roll === 1) this.spawnHazard(x, floor, "crate");
    else if (roll === 2) this.spawnHazard(x, floor, "ember");
    else if (roll === 3) this.spawnHazard(x, floor, "critter");
    else if (roll === 4) {
      this.spawnHazard(x, floor, "spike");
      this.spawnCoin(x + 70, floor - 90);
    } else {
      this.spawnPad(x, floor - 88);
      this.spawnCoin(x, floor - 130);
    }
  }

  private spawnHazard(x: number, floor: number, kind: HazardKind): void {
    if (kind === "spike") {
      this.stageSprites.push(
        this.add.sprite(x, floor, "obs-spike").setOrigin(0.51, 0.5).setDepth(6).setScale(0.72)
      );
      const hazard = this.hazards.create(x, floor - 14, "obs-spike") as Phaser.Physics.Arcade.Sprite;
      hazard.setVisible(false);
      this.fitHazard(hazard, 36, 18, 46, 40);
      return;
    }
    if (kind === "crate") {
      const key = this.level >= 2 ? "obs-metal" : "obs-crate";
      const scale = key === "obs-metal" ? 0.34 : 0.42;
      this.stageSprites.push(
        this.add.sprite(x, floor, key).setOrigin(0.5, 1).setDepth(6).setScale(scale)
      );
      const hazard = this.hazards.create(x, floor - 16, key) as Phaser.Physics.Arcade.Sprite;
      hazard.setVisible(false);
      this.fitHazard(hazard, 28, 26, 2, 4);
      return;
    }
    if (kind === "ember") {
      const sprite = this.add
        .sprite(x, floor, "obs-flame", 0)
        .setOrigin(0.5, 1)
        .setDepth(6)
        .setScale(0.4);
      this.stageSprites.push(sprite);
      sprite.play("flame-burn");
      const hazard = this.hazards.create(x, floor - 10, "obs-flame") as Phaser.Physics.Arcade.Sprite;
      hazard.setVisible(false);
      this.fitHazard(hazard, 28, 22, 50, 90);
      return;
    }

    const critter = this.hazards.create(x, floor, "obs-slime", 0) as Phaser.Physics.Arcade.Sprite;
    critter.setOrigin(0.5, 1).setDepth(8).setScale(1.85);
    critter.setVisible(true);
    critter.play("slime-walk");
    const body = critter.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setSize(18, 16);
    body.setOffset(3, 8);
    body.setVelocityX(-70);
  }

  private fitHazard(
    hazard: Phaser.Physics.Arcade.Sprite,
    w: number,
    h: number,
    ox: number,
    oy: number
  ): void {
    const body = hazard.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setSize(w, h);
    body.setOffset(ox, oy);
  }

  private spawnCoin(x: number, y: number): void {
    const coin = this.coins.create(x, y, "obs-coin", 0) as Phaser.Physics.Arcade.Sprite;
    coin.setDepth(7).setScale(1.7);
    coin.play("coin-spin");
    const body = coin.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(16, 16);
    body.setOffset(4, 4);
    this.tweens.add({
      targets: coin,
      y: y - 8,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
  }

  private spawnPad(x: number, y: number): void {
    const pad = this.pads.create(x, y, "obs-pad") as Phaser.Physics.Arcade.Sprite;
    pad.setOrigin(0.5, 0.55).setDepth(5).setScale(0.22);
    const body = pad.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setSize(280, 70);
    body.setOffset(18, 20);
  }

  private extendWorld(): void {
    const need = this.player.x + GAME_WIDTH + 200;
    while (this.lastGroundX < need) {
      this.lastGroundX += WORLD.chunkWidth;
      this.spawnGround(this.lastGroundX);
    }
    while (this.nextSpawnX < this.player.x + WORLD.spawnAhead) {
      this.spawnPattern(this.nextSpawnX);
      this.nextSpawnX += Phaser.Math.Between(WORLD.minObstacleGap, WORLD.maxObstacleGap);
    }
  }

  update(time: number, delta: number): void {
    const world = this.physics.world as Phaser.Physics.Arcade.World & { _elapsed: number };
    if (world._elapsed > 34) world._elapsed = 34;
    world.update(time, Math.min(delta, 34));

    const dt = Math.min(delta, 34) / 1000;

    for (const cloud of this.clouds) {
      cloud.sprite.x -= cloud.speed * dt;
      if (cloud.sprite.x < -80) cloud.sprite.x = GAME_WIDTH + 40;
    }
    for (const bird of this.birds) {
      bird.sprite.x -= bird.speed * dt;
      if (bird.sprite.x < -40) bird.sprite.x = GAME_WIDTH + 30;
    }
    for (const person of this.villagers) {
      person.sprite.x -= person.speed * dt;
      if (person.sprite.x < -20) person.sprite.x = GAME_WIDTH + 20;
    }

    if (this.isDead) return;

    if (!this.gameStarted) {
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(0, 0);
      this.player.setPosition(PLAYER_RUN_X, GROUND_SURFACE_Y);
      this.player.setScale(HERO.scale, HERO.scale);
      this.ducking = false;
      if (this.player.anims.isPlaying) this.player.anims.stop();
      if (this.player.texture.key !== "kit-idle") this.player.setTexture("kit-idle", 0);
      if (Phaser.Input.Keyboard.JustDown(this.jumpKey) || touchPad.runTap) {
        touchPad.runTap = false;
        touchPad.shootTap = false;
        this.beginRun();
      }
      return;
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (
      !this.rising &&
      body.velocity.y >= 0 &&
      this.player.y > GROUND_SURFACE_Y &&
      this.player.y < FALL_DEATH_Y
    ) {
      this.player.setY(GROUND_SURFACE_Y);
      body.setVelocityY(0);
    }
    if (this.player.y > FALL_DEATH_Y) {
      this.endRun();
      return;
    }

    const jumpEdge = touchPad.jumpHeld && !this.touchJumpWasHeld;
    this.touchJumpWasHeld = touchPad.jumpHeld;
    const held = Boolean(this.cursors.up?.isDown || this.wKey.isDown || touchPad.jumpHeld);
    const pressed =
      Phaser.Input.Keyboard.JustDown(this.wKey) ||
      Phaser.Input.Keyboard.JustDown(this.cursors.up!) ||
      jumpEdge;

    if (pressed) this.jumpBuffer = PHYSICS.jumpBufferMs;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - delta);

    const touching = body.blocked.down || body.touching.down;
    if (touching) this.coyote = PHYSICS.coyoteMs;
    else this.coyote = Math.max(0, this.coyote - delta);

    const grounded =
      !this.rising &&
      (touching || (this.player.y >= GROUND_SURFACE_Y - 4 && body.velocity.y >= 0));

    const holdDuck = this.duckKey.isDown || this.sKey.isDown || touchPad.duckHeld;
    this.ducking = grounded && holdDuck && !this.rising;
    if (this.ducking) {
      this.player.setScale(HERO.scale, HERO.scale * 0.72);
      body.setSize(HERO.bodyW, 36);
      body.setOffset((HERO.frameW - HERO.bodyW) / 2, HERO.frameH - 36);
    } else {
      this.stand();
    }

    if (this.jumpBuffer > 0 && !this.ducking && (grounded || this.coyote > 0)) {
      this.rising = true;
      this.jumpHold = 0;
      this.jumpBuffer = 0;
      this.coyote = 0;
      body.setVelocityY(PHYSICS.jumpMin);
      gameAudio.jump();
    }

    if (this.rising && held && this.jumpHold < PHYSICS.jumpHoldMs && body.velocity.y < 0) {
      this.jumpHold += delta;
      const t = Phaser.Math.Clamp(this.jumpHold / PHYSICS.jumpHoldMs, 0, 1);
      const target = Phaser.Math.Linear(PHYSICS.jumpMin, PHYSICS.jumpMax, t);
      if (body.velocity.y > target) body.setVelocityY(target);
    } else if (this.rising && !held) {
      if (body.velocity.y < -180) body.setVelocityY(body.velocity.y * 0.7);
      this.rising = false;
    }

    if (body.velocity.y >= 0) this.rising = false;

    if (body.velocity.y > 0) {
      body.setGravityY(PHYSICS.fallGravityY - PHYSICS.gravityY);
    } else {
      body.setGravityY(0);
    }

    const speed = PHYSICS.autoRunSpeed;
    body.setVelocityX(speed);

    const lift = Math.max(0, GROUND_SURFACE_Y - this.player.y);
    this.shadow.setPosition(this.player.x, GROUND_SURFACE_Y + 6);
    this.shadow.setScale(Math.max(0.4, 1 - lift / 380));
    this.shadow.setAlpha(Math.max(0.12, 0.42 - lift / 700));

    const shooting = this.time.now < this.shootingUntil;
    const airborne = !this.ducking && (this.rising || body.velocity.y < -40 || this.player.y < GROUND_SURFACE_Y - 8);
    if (this.ducking) {
      this.player.anims.stop();
      if (this.player.texture.key !== "kit-idle") this.player.setTexture("kit-idle", 0);
    } else if (shooting && !airborne) {
      if (this.player.anims.currentAnim?.key !== "hero-shoot") this.player.play("hero-shoot");
    } else if (!airborne) {
      if (body.velocity.y > 0) body.setVelocityY(0);
      this.player.setScale(HERO.scale);
      if (this.player.anims.currentAnim?.key !== "hero-run") this.player.play("hero-run", true);
    } else {
      this.player.setScale(HERO.scale * (1 - Math.min(0.18, lift / 700)));
      this.player.anims.stop();
      if (this.player.texture.key !== "kit-jump") this.player.setTexture("kit-jump");
    }

    this.distance += (speed * dt) / 12;
    this.distanceText.setText(`${Math.floor(this.distance)} m`);
    if (this.level === 1 && this.distance >= STAGE_DISTANCE) {
      this.enterLevel2();
      return;
    }
    if (this.level === 2 && this.distance >= STAGE_DISTANCE) {
      this.enterLevel3();
      return;
    }

    this.swordCooldown = Math.max(0, this.swordCooldown - delta);
    this.gunCooldown = Math.max(0, this.gunCooldown - delta);
    if (this.invuln > 0) {
      this.invuln = Math.max(0, this.invuln - delta);
      if (this.invuln === 0) this.player.clearTint();
    }
    const shootPressed =
      Phaser.Input.Keyboard.JustDown(this.jumpKey) ||
      this.optionPressed ||
      Phaser.Input.Keyboard.JustDown(this.gunKey) ||
      touchPad.shootTap;
    const swordPressed =
      this.commandPressed ||
      Phaser.Input.Keyboard.JustDown(this.swordKey) ||
      Phaser.Input.Keyboard.JustDown(this.rightCommandKey) ||
      touchPad.swordTap;
    this.optionPressed = false;
    this.commandPressed = false;
    touchPad.shootTap = false;
    touchPad.swordTap = false;
    touchPad.runTap = false;
    touchPad.retryTap = false;
    if (shootPressed) this.shoot();
    if (this.level >= 2 && swordPressed) this.swing();

    const now = this.time.now;
    this.monsters.getChildren().forEach((child) => {
      const monster = child as Phaser.Physics.Arcade.Sprite;
      if (!monster.active) return;
      if (monster.x < this.player.x - WORLD.despawnBehind) {
        monster.destroy();
        return;
      }
      const nextShot = monster.getData("nextShot") as number;
      const kind = monster.getData("kind") as string;
      if (kind === "punch") return;
      if (monster.x > this.player.x + 40 && now >= nextShot) {
        if (kind === "crab") this.crabShoot(monster);
        else if (kind === "imp") this.impLob(monster);
        else this.monsterShoot(monster);
        monster.setData("nextShot", now + COMBAT.monsterShotMs);
      }
    });
    this.enemyShots.getChildren().forEach((child) => {
      const shot = child as Phaser.Physics.Arcade.Sprite;
      if (!shot.active) return;
      const dx = shot.x - this.player.x;
      const dy = shot.y - (this.player.y - 28);
      if (dx * dx + dy * dy < 34 * 34) {
        shot.destroy();
        this.hurt();
        return;
      }
      if (
        shot.x < this.player.x - 500 ||
        shot.x > this.player.x + 900 ||
        shot.y > GAME_HEIGHT + 20
      ) {
        shot.destroy();
      }
    });
    this.playerShots.getChildren().forEach((child) => {
      const shot = child as Phaser.Physics.Arcade.Sprite;
      if (!shot.active) return;
      if (shot.x > this.player.x + 700) {
        shot.destroy();
        return;
      }
      for (const monsterChild of this.monsters.getChildren()) {
        const monster = monsterChild as Phaser.Physics.Arcade.Sprite;
        if (!monster.active) continue;
        const dx = shot.x - monster.x;
        const lift = (monster.getData("bodyLift") as number) || 14;
        const dy = shot.y - (monster.y - lift);
        if (dx * dx + dy * dy < 26 * 26) {
          shot.destroy();
          monster.destroy();
          gameAudio.hit();
          break;
        }
      }
    });

    this.extendWorld();

    this.hazards.getChildren().forEach((child) => {
      const sprite = child as Phaser.Physics.Arcade.Sprite;
      if (!sprite.active) return;
      if (sprite.x < this.player.x - WORLD.despawnBehind) sprite.destroy();
    });
  }
}
