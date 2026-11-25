import Phaser from "phaser";

export function generateFlappyTextures(scene: Phaser.Scene): void {
  const bird = scene.make.graphics({ x: 0, y: 0 }, false);
  bird.fillStyle(0xfacc15, 1);
  bird.fillCircle(18, 18, 16);
  bird.fillStyle(0xffffff, 1);
  bird.fillCircle(22, 14, 6);
  bird.fillStyle(0x000000, 1);
  bird.fillCircle(24, 13, 2);
  bird.fillStyle(0xf97316, 1);
  bird.fillTriangle(30, 18, 38, 20, 30, 22);
  bird.generateTexture("flappy-bird", 40, 36);
  bird.destroy();

  const pipe = scene.make.graphics({ x: 0, y: 0 }, false);
  pipe.fillStyle(0x22c55e, 1);
  pipe.fillRect(0, 0, 72, 400);
  pipe.fillStyle(0x16a34a, 1);
  pipe.fillRect(0, 0, 72, 10);
  pipe.lineStyle(3, 0x14532d, 1);
  pipe.strokeRect(1, 1, 70, 398);
  pipe.generateTexture("flappy-pipe", 72, 400);
  pipe.destroy();

  const ring = scene.make.graphics({ x: 0, y: 0 }, false);
  ring.lineStyle(14, 0xfbbf24, 1);
  ring.strokeCircle(48, 48, 40);
  ring.lineStyle(6, 0xfde68a, 1);
  ring.strokeCircle(48, 48, 40);
  ring.fillStyle(0xf59e0b, 0.35);
  ring.fillCircle(48, 48, 40);
  ring.generateTexture("flappy-ring", 96, 96);
  ring.destroy();

  const bubbleRing = scene.make.graphics({ x: 0, y: 0 }, false);
  bubbleRing.lineStyle(14, 0x38bdf8, 1);
  bubbleRing.strokeCircle(48, 48, 40);
  bubbleRing.lineStyle(6, 0xe0f2fe, 1);
  bubbleRing.strokeCircle(48, 48, 40);
  bubbleRing.fillStyle(0x0ea5e9, 0.28);
  bubbleRing.fillCircle(48, 48, 40);
  bubbleRing.fillStyle(0xffffff, 0.85);
  bubbleRing.fillCircle(36, 34, 10);
  bubbleRing.fillCircle(58, 42, 6);
  bubbleRing.generateTexture("flappy-bubble-ring", 96, 96);
  bubbleRing.destroy();

  const cloudBar = scene.make.graphics({ x: 0, y: 0 }, false);
  cloudBar.fillStyle(0xe2e8f0, 1);
  cloudBar.fillCircle(22, 20, 16);
  cloudBar.fillCircle(48, 16, 20);
  cloudBar.fillCircle(78, 20, 18);
  cloudBar.fillCircle(104, 18, 14);
  cloudBar.fillStyle(0xf8fafc, 1);
  cloudBar.fillRoundedRect(8, 14, 108, 20, 10);
  cloudBar.generateTexture("flappy-cloud-bar", 120, 40);
  cloudBar.destroy();

  const boulder = scene.make.graphics({ x: 0, y: 0 }, false);
  boulder.fillStyle(0x78716c, 1);
  boulder.fillCircle(36, 36, 34);
  boulder.fillStyle(0xa8a29e, 1);
  boulder.fillCircle(28, 28, 10);
  boulder.fillStyle(0x57534e, 1);
  boulder.fillTriangle(50, 50, 62, 58, 44, 60);
  boulder.generateTexture("flappy-boulder", 72, 72);
  boulder.destroy();

  const ground = scene.make.graphics({ x: 0, y: 0 }, false);
  ground.fillStyle(0xca8a04, 1);
  ground.fillRect(0, 0, 64, 56);
  ground.fillStyle(0x84cc16, 1);
  ground.fillRect(0, 0, 64, 14);
  ground.generateTexture("flappy-ground", 64, 56);
  ground.destroy();
}