import Phaser from "phaser";

const HERO_W = 80;
const HERO_H = 96;
const SOLE = 94;

interface Foot {
  x: number;
  y: number;
}

/** Side-view stride. Planted soles sit on SOLE so they meet the runner bar. */
const RUN_POSES: { bob: number; back: Foot; front: Foot; arm: number }[] = [
  { bob: 0, back: { x: 22, y: SOLE }, front: { x: 58, y: SOLE }, arm: 0.95 },
  { bob: -3, back: { x: 26, y: SOLE - 10 }, front: { x: 52, y: SOLE }, arm: 0.4 },
  { bob: -6, back: { x: 24, y: SOLE - 20 }, front: { x: 62, y: SOLE - 12 }, arm: -0.2 },
  { bob: 0, back: { x: 58, y: SOLE }, front: { x: 24, y: SOLE }, arm: -0.95 },
  { bob: -3, back: { x: 52, y: SOLE }, front: { x: 28, y: SOLE - 12 }, arm: -0.4 },
  { bob: -6, back: { x: 62, y: SOLE - 14 }, front: { x: 22, y: SOLE - 20 }, arm: 0.2 },
];

function bone(
  gfx: Phaser.GameObjects.Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness: number,
  fill: number,
  edge: number
): void {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.hypot(x2 - x1, y2 - y1);
  gfx.save();
  gfx.translateCanvas(x1, y1);
  gfx.rotateCanvas(angle);
  gfx.fillStyle(edge, 1);
  gfx.fillRoundedRect(-1, -thickness / 2 - 1, len + 2, thickness + 2, thickness / 2);
  gfx.fillStyle(fill, 1);
  gfx.fillRoundedRect(0, -thickness / 2, Math.max(len, 1), thickness, thickness / 2);
  gfx.restore();
}

function drawLeg(gfx: Phaser.GameObjects.Graphics, hipX: number, hipY: number, foot: Foot): void {
  const kneeX = (hipX + foot.x) / 2 + (foot.x < hipX ? -6 : 5);
  const kneeY = (hipY + foot.y) / 2 - 6;
  bone(gfx, hipX, hipY, kneeX, kneeY, 9, 0x1d4ed8, 0x1e3a8a);
  bone(gfx, kneeX, kneeY, foot.x, foot.y - 5, 8, 0xf4c7a1, 0xc4a484);
  gfx.fillStyle(0x111827, 1);
  gfx.fillRoundedRect(foot.x - 4, foot.y - 8, 16, 8, 3);
  gfx.fillStyle(0xf8fafc, 1);
  gfx.fillRoundedRect(foot.x - 2, foot.y - 7, 12, 5, 2);
  gfx.fillStyle(0xef4444, 1);
  gfx.fillRect(foot.x + 4, foot.y - 6, 4, 3);
}

function drawArm(gfx: Phaser.GameObjects.Graphics, sx: number, sy: number, angle: number): void {
  const hx = sx + Math.sin(angle) * 18;
  const hy = sy + Math.cos(angle) * 16;
  bone(gfx, sx, sy, hx, hy, 6, 0xf4c7a1, 0xc4a484);
  gfx.fillStyle(0xef4444, 1);
  gfx.fillCircle(hx, hy, 4);
}

function drawGun(gfx: Phaser.GameObjects.Graphics, x: number, y: number): void {
  gfx.fillStyle(0x111827, 1);
  gfx.fillRoundedRect(x, y, 22, 6, 2);
  gfx.fillRoundedRect(x + 2, y + 4, 7, 9, 2);
  gfx.fillStyle(0x4b5563, 1);
  gfx.fillRect(x + 16, y + 1, 6, 4);
  gfx.fillStyle(0xf59e0b, 1);
  gfx.fillRect(x + 8, y + 2, 4, 2);
}

function drawHead(gfx: Phaser.GameObjects.Graphics, x: number, y: number): void {
  gfx.fillStyle(0x7c2d12, 1);
  gfx.fillCircle(x, y, 15);
  gfx.fillStyle(0xf4c7a1, 1);
  gfx.fillCircle(x, y + 2, 13);
  gfx.fillStyle(0xf8fafc, 1);
  gfx.fillCircle(x + 5, y + 1, 4.5);
  gfx.fillStyle(0x0f172a, 1);
  gfx.fillCircle(x + 6.5, y + 1, 2.2);
  gfx.fillStyle(0xffffff, 1);
  gfx.fillCircle(x + 7.2, y + 0.3, 0.8);
  gfx.fillStyle(0xfb7185, 1);
  gfx.fillCircle(x + 1, y + 6, 2.2);
  gfx.fillStyle(0x7c2d12, 1);
  gfx.fillEllipse(x - 2, y - 8, 22, 10);
  gfx.fillCircle(x + 8, y - 4, 5);
}

function drawHero(gfx: Phaser.GameObjects.Graphics, pose: "idle" | "run" | "jump", step: number): void {
  const poseData = pose === "run" ? RUN_POSES[step % RUN_POSES.length] : null;
  const bob = poseData?.bob ?? 0;
  const hipX = 40;
  const hipY = 58 + bob;
  const shoulderX = 38;
  const shoulderY = 40 + bob;

  gfx.fillStyle(0x0f172a, 0.15);
  gfx.fillEllipse(40, SOLE - 1, pose === "jump" ? 18 : 28, 6);

  const drawBody = (): void => {
    gfx.fillStyle(0xb91c1c, 1);
    gfx.fillRoundedRect(28, 34 + bob, 24, 26, 8);
    gfx.fillStyle(0xef4444, 1);
    gfx.fillRoundedRect(30, 36 + bob, 20, 16, 6);
    gfx.fillStyle(0xf8fafc, 1);
    gfx.fillCircle(40, 44 + bob, 3);
  };

  if (pose === "idle") {
    drawArm(gfx, shoulderX + 2, shoulderY, 0.15);
    drawLeg(gfx, hipX, hipY, { x: 32, y: SOLE });
    drawBody();
    drawLeg(gfx, hipX, hipY, { x: 48, y: SOLE });
    drawArm(gfx, shoulderX, shoulderY, -0.05);
  } else if (pose === "jump") {
    drawArm(gfx, shoulderX, shoulderY, -1.1);
    drawLeg(gfx, hipX, hipY, { x: 28, y: SOLE - 22 });
    drawBody();
    drawLeg(gfx, hipX, hipY, { x: 52, y: SOLE - 26 });
    drawArm(gfx, shoulderX, shoulderY, -0.2);
  } else if (poseData) {
    const rearFirst = poseData.back.x <= poseData.front.x;
    const rear = rearFirst ? poseData.back : poseData.front;
    const fore = rearFirst ? poseData.front : poseData.back;
    drawArm(gfx, shoulderX + 2, shoulderY, poseData.arm);
    drawLeg(gfx, hipX, hipY, rear);
    drawBody();
    drawLeg(gfx, hipX, hipY, fore);
    drawArm(gfx, shoulderX, shoulderY, -poseData.arm);
  }

  drawHead(gfx, 48, 22 + bob);
  drawGun(gfx, shoulderX + 6, shoulderY + 6);
}

export function generateHeroTextures(scene: Phaser.Scene): void {
  for (let i = 0; i < RUN_POSES.length; i++) {
    const gfx = scene.make.graphics({ x: 0, y: 0 }, false);
    drawHero(gfx, "run", i);
    gfx.generateTexture(`hero-run-${i}`, HERO_W, HERO_H);
    gfx.destroy();
  }

  const idle = scene.make.graphics({ x: 0, y: 0 }, false);
  drawHero(idle, "idle", 0);
  idle.generateTexture("hero-idle", HERO_W, HERO_H);
  idle.destroy();

  const jump = scene.make.graphics({ x: 0, y: 0 }, false);
  drawHero(jump, "jump", 0);
  jump.generateTexture("hero-jump", HERO_W, HERO_H);
  jump.destroy();
}

export function generateWorldTextures(scene: Phaser.Scene): void {
  const gfx = scene.make.graphics({ x: 0, y: 0 }, false);

  gfx.fillStyle(0x92400e, 1);
  gfx.fillRoundedRect(0, 10, 64, 46, 4);
  gfx.fillStyle(0x78350f, 1);
  gfx.fillRect(0, 28, 64, 28);
  gfx.fillStyle(0x22c55e, 1);
  gfx.fillRoundedRect(0, 0, 64, 16, 6);
  gfx.fillStyle(0x4ade80, 1);
  for (let i = 0; i < 8; i++) {
    gfx.fillTriangle(i * 8, 14, i * 8 + 4, 2, i * 8 + 8, 14);
  }
  gfx.lineStyle(2, 0x14532d, 0.35);
  gfx.lineBetween(0, 16, 64, 16);
  gfx.generateTexture("ground", 64, 56);
  gfx.clear();

  gfx.fillStyle(0x86efac, 1);
  gfx.fillRoundedRect(0, 0, 96, 16, 8);
  gfx.fillStyle(0x22c55e, 1);
  gfx.fillRoundedRect(4, 4, 88, 8, 4);
  gfx.generateTexture("float-pad", 96, 16);
  gfx.clear();

  gfx.fillStyle(0xffffff, 0.95);
  gfx.fillEllipse(40, 18, 50, 22);
  gfx.fillEllipse(62, 22, 36, 18);
  gfx.fillEllipse(22, 22, 30, 16);
  gfx.generateTexture("cloud", 84, 36);
  gfx.clear();

  gfx.fillStyle(0x166534, 0.55);
  gfx.fillTriangle(20, 80, 0, 80, 20, 20);
  gfx.fillTriangle(20, 80, 48, 80, 28, 8);
  gfx.generateTexture("bg-tree", 48, 80);
  gfx.destroy();
}

export function generateObstacleTextures(scene: Phaser.Scene): void {
  const gfx = scene.make.graphics({ x: 0, y: 0 }, false);

  // Low spikes — short enough to jump
  gfx.fillStyle(0x334155, 1);
  gfx.fillRoundedRect(0, 16, 44, 10, 3);
  gfx.fillStyle(0xe2e8f0, 1);
  gfx.fillTriangle(4, 18, 12, 2, 20, 18);
  gfx.fillTriangle(16, 18, 24, 0, 32, 18);
  gfx.fillTriangle(28, 18, 36, 3, 42, 18);
  gfx.lineStyle(2, 0x0f172a, 1);
  gfx.strokeTriangle(4, 18, 12, 2, 20, 18);
  gfx.strokeTriangle(16, 18, 24, 0, 32, 18);
  gfx.generateTexture("spike", 44, 26);
  gfx.clear();

  // Small crate
  gfx.fillStyle(0xd97706, 1);
  gfx.fillRoundedRect(0, 0, 32, 32, 4);
  gfx.lineStyle(2, 0x92400e, 1);
  gfx.strokeRoundedRect(1, 1, 30, 30, 4);
  gfx.lineBetween(0, 16, 32, 16);
  gfx.lineBetween(16, 0, 16, 32);
  gfx.generateTexture("crate", 32, 32);
  gfx.clear();

  // Low campfire
  for (let f = 0; f < 4; f++) {
    const flame = scene.make.graphics({ x: 0, y: 0 }, false);
    const w = f % 2 === 0 ? 0 : 3;
    flame.fillStyle(0x44403c, 1);
    flame.fillEllipse(16, 28, 22, 6);
    flame.fillStyle(0xf97316, 1);
    flame.fillTriangle(16 + w, 4, 4, 26, 28, 26);
    flame.fillStyle(0xfde68a, 1);
    flame.fillTriangle(16 + w, 10, 9, 26, 23, 26);
    flame.generateTexture(`ember-${f}`, 32, 32);
    flame.destroy();
  }

  // Walking critter (small, jumpable)
  for (let f = 0; f < 2; f++) {
    const c = scene.make.graphics({ x: 0, y: 0 }, false);
    c.fillStyle(0xf43f5e, 1);
    c.fillEllipse(20, 16, 28, 20);
    c.fillStyle(0xfb7185, 1);
    c.fillEllipse(20, 14, 16, 10);
    c.fillStyle(0xffffff, 1);
    c.fillCircle(14, 14, 4);
    c.fillCircle(26, 14, 4);
    c.fillStyle(0x111827, 1);
    c.fillCircle(15, 14, 2);
    c.fillCircle(27, 14, 2);
    c.fillStyle(0xf59e0b, 1);
    c.fillRoundedRect(f === 0 ? 8 : 12, 24, 8, 6, 2);
    c.fillRoundedRect(f === 0 ? 22 : 18, 24, 8, 6, 2);
    c.generateTexture(`critter-${f}`, 40, 32);
    c.destroy();
  }

  // Background villager
  const v = scene.make.graphics({ x: 0, y: 0 }, false);
  v.fillStyle(0x38bdf8, 1);
  v.fillRoundedRect(6, 14, 12, 14, 3);
  v.fillStyle(0xf4c7a1, 1);
  v.fillCircle(12, 8, 6);
  v.fillStyle(0xf97316, 1);
  v.fillRect(4, 26, 6, 4);
  v.fillRect(14, 26, 6, 4);
  v.generateTexture("villager", 24, 32);
  v.destroy();

  const bird = scene.make.graphics({ x: 0, y: 0 }, false);
  bird.fillStyle(0x0ea5e9, 1);
  bird.fillEllipse(12, 8, 16, 8);
  bird.fillTriangle(4, 8, 12, 2, 12, 10);
  bird.fillTriangle(12, 8, 22, 4, 12, 12);
  bird.fillStyle(0xfbbf24, 1);
  bird.fillTriangle(20, 7, 26, 8, 20, 10);
  bird.generateTexture("bird", 28, 16);
  bird.destroy();

  gfx.fillStyle(0xfacc15, 1);
  gfx.fillCircle(12, 12, 10);
  gfx.fillStyle(0xfde047, 1);
  gfx.fillCircle(12, 12, 6);
  gfx.lineStyle(2, 0xa16207, 1);
  gfx.strokeCircle(12, 12, 10);
  gfx.generateTexture("coin", 24, 24);
  gfx.destroy();
}

export function generateCombatTextures(scene: Phaser.Scene): void {
  const gfx = scene.make.graphics({ x: 0, y: 0 }, false);

  gfx.fillStyle(0x292524, 1);
  gfx.fillRect(0, 10, 64, 46);
  gfx.fillStyle(0xea580c, 1);
  gfx.fillRect(0, 0, 64, 14);
  gfx.fillStyle(0xfde68a, 1);
  gfx.fillRect(6, 4, 12, 4);
  gfx.fillRect(34, 5, 16, 3);
  gfx.fillStyle(0x7c2d12, 1);
  gfx.fillRect(0, 14, 64, 4);
  gfx.generateTexture("lava-ground", 64, 56);
  gfx.clear();

  gfx.fillStyle(0x7f1d1d, 1);
  gfx.fillRoundedRect(4, 10, 32, 24, 8);
  gfx.fillStyle(0xf97316, 1);
  gfx.fillCircle(14, 20, 4);
  gfx.fillCircle(26, 20, 4);
  gfx.fillStyle(0xfef3c7, 1);
  gfx.fillCircle(14, 20, 2);
  gfx.fillCircle(26, 20, 2);
  gfx.fillStyle(0xef4444, 1);
  gfx.fillTriangle(10, 12, 16, 0, 22, 12);
  gfx.fillTriangle(22, 12, 30, 2, 34, 14);
  gfx.fillStyle(0x44403c, 1);
  gfx.fillRect(30, 22, 8, 4);
  gfx.generateTexture("lava-monster", 42, 36);
  gfx.clear();

  gfx.fillStyle(0xf97316, 1);
  gfx.fillCircle(8, 8, 7);
  gfx.fillStyle(0xfde68a, 1);
  gfx.fillCircle(8, 8, 3);
  gfx.generateTexture("fireball", 16, 16);
  gfx.clear();

  gfx.fillStyle(0xfef08a, 1);
  gfx.fillRoundedRect(0, 2, 16, 5, 2);
  gfx.generateTexture("bullet", 16, 8);
  gfx.clear();

  gfx.fillStyle(0xf8fafc, 0.95);
  gfx.fillRoundedRect(0, 6, 46, 10, 5);
  gfx.fillStyle(0xe2e8f0, 1);
  gfx.fillRect(4, 9, 36, 3);
  gfx.generateTexture("slash", 48, 22);
  gfx.clear();

  gfx.fillStyle(0x1e293b, 1);
  gfx.fillRoundedRect(12, 22, 16, 22, 4);
  gfx.fillStyle(0xf4c7a1, 1);
  gfx.fillCircle(20, 14, 9);
  gfx.fillStyle(0x0f172a, 1);
  gfx.fillCircle(16, 14, 2);
  gfx.fillStyle(0x334155, 1);
  gfx.fillRoundedRect(10, 42, 8, 12, 2);
  gfx.fillRoundedRect(22, 42, 8, 12, 2);
  gfx.fillStyle(0xf87171, 1);
  gfx.fillCircle(8, 28, 4);
  gfx.generateTexture("rival", 40, 56);
  gfx.clear();

  gfx.fillStyle(0x57534e, 1);
  gfx.fillEllipse(26, 16, 40, 18);
  gfx.fillStyle(0x78716c, 1);
  gfx.fillEllipse(24, 14, 22, 10);
  gfx.fillStyle(0xf97316, 1);
  gfx.fillCircle(14, 14, 3);
  gfx.fillStyle(0x292524, 1);
  gfx.fillRect(0, 12, 16, 5);
  gfx.generateTexture("tank-crab", 52, 28);
  gfx.clear();

  gfx.fillStyle(0x111827, 1);
  gfx.fillRoundedRect(14, 18, 14, 44, 6);
  gfx.fillStyle(0xf97316, 1);
  gfx.fillRoundedRect(16, 28, 10, 22, 4);
  gfx.fillStyle(0xf4c7a1, 1);
  gfx.fillCircle(21, 12, 8);
  gfx.fillStyle(0xef4444, 1);
  gfx.fillCircle(18, 12, 2);
  gfx.fillRoundedRect(4, 20, 8, 6, 2);
  gfx.fillRoundedRect(28, 16, 8, 6, 2);
  gfx.generateTexture("lava-imp", 40, 68);
  gfx.destroy();
}

export function registerAnimations(scene: Phaser.Scene): void {
  scene.anims.create({
    key: "ember-burn",
    frames: [0, 1, 2, 3].map((i) => ({ key: `ember-${i}` })),
    frameRate: 10,
    repeat: -1,
  });
  scene.anims.create({
    key: "critter-walk",
    frames: [{ key: "critter-0" }, { key: "critter-1" }],
    frameRate: 6,
    repeat: -1,
  });
}
