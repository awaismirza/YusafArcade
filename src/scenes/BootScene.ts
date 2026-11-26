import Phaser from "phaser";
import {
  generateCombatTextures,
  generateObstacleTextures,
  generateWorldTextures,
  registerAnimations,
} from "../boot/generateAssets";
import { generateFlappyTextures } from "../boot/generateFlappyAssets";

/** Prefixes a public-folder path with the site's base URL, so it also works under /YusafArcade/ on GitHub Pages. */
const asset = (path: string): string => `${import.meta.env.BASE_URL}${path}`;

/**
 * Character sheets: "Platformer Shooter 2D Shotgun" by ashuuya, CC0.
 * https://opengameart.org/content/platformer-shooter-2d-shotgun-7-actions
 * High-res beat-em-up sheet (CC0, Puffolotti) is kept beside them and not loaded whole.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "Boot" });
  }

  preload(): void {
    const sheet = { frameHeight: 138 };
    this.load.spritesheet("kit-run", asset("sprites/kit/run.png"), { ...sheet, frameWidth: 88 });
    this.load.spritesheet("kit-idle", asset("sprites/kit/idle.png"), { ...sheet, frameWidth: 88 });
    this.load.spritesheet("kit-fire", asset("sprites/kit/idle_fire.png"), { ...sheet, frameWidth: 96 });
    this.load.image("kit-jump", asset("sprites/kit/jump.png"));

    // Obstacles, CC0 unless noted: crate/metal crate (mrochefort),
    // ground spike (pixel items, CC-BY), flame frames, 24x24 slime, 16x16 coin.
    this.load.image("obs-crate", asset("sprites/obstacles/crate.png"));
    this.load.image("obs-metal", asset("sprites/obstacles/metalcrate.png"));
    this.load.image("obs-spike", asset("sprites/obstacles/ground-spike.png"));
    this.load.image("obs-pad", asset("sprites/obstacles/pad.png"));
    this.load.spritesheet("obs-flame", asset("sprites/obstacles/flame.png"), {
      frameWidth: 128,
      frameHeight: 128,
    });
    this.load.spritesheet("obs-slime", asset("sprites/obstacles/slime.png"), {
      frameWidth: 24,
      frameHeight: 24,
    });
    this.load.spritesheet("obs-coin", asset("sprites/obstacles/coin.png"), {
      frameWidth: 16,
      frameHeight: 16,
    });
  }

  create(): void {
    generateWorldTextures(this);
    generateObstacleTextures(this);
    generateCombatTextures(this);
    generateFlappyTextures(this);
    registerAnimations(this);

    this.anims.create({
      key: "hero-walk",
      frames: this.anims.generateFrameNumbers("kit-run", { start: 0, end: 3 }),
      frameRate: 6,
      repeat: -1,
    });
    this.anims.create({
      key: "hero-run",
      frames: this.anims.generateFrameNumbers("kit-run", { start: 0, end: 3 }),
      frameRate: 12,
      repeat: -1,
    });
    this.anims.create({
      key: "hero-shoot",
      frames: this.anims.generateFrameNumbers("kit-fire", { start: 0, end: 1 }),
      frameRate: 12,
      repeat: 0,
    });
    this.anims.create({
      key: "flame-burn",
      frames: this.anims.generateFrameNumbers("obs-flame", { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: "slime-walk",
      frames: this.anims.generateFrameNumbers("obs-slime", { start: 0, end: 2 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: "coin-spin",
      frames: this.anims.generateFrameNumbers("obs-coin", { start: 0, end: 15 }),
      frameRate: 12,
      repeat: -1,
    });

    this.scene.start("Menu");
  }
}
