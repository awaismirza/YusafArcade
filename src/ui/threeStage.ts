import Phaser from "phaser";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/** Internal 3D render size (16:9). Phaser scales it to the 960 × 540 game canvas. Kept modest for iPad GPUs. */
export const STAGE_W = 1152;
export const STAGE_H = 648;

export type StageOptions = {
  /** Unique Phaser texture key for this stage. */
  key: string;
  fov?: number;
  /** Backdrop gradient colours (top, bottom). */
  backdrop?: [string, string];
  /** Directional light, with soft shadows. Default true. */
  shadows?: boolean;
};

/**
 * A three.js scene drawn into an offscreen WebGL canvas, copied each frame into a Phaser texture.
 * That keeps one canvas on the page, so the existing Phaser menu, buttons and touch handling keep working.
 * (Phaser can only wrap a 2D canvas as a texture, so a 2D copy sits between the two.)
 */
export class ThreeStage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly image: Phaser.GameObjects.Image;
  readonly keyLight: THREE.DirectionalLight;

  private readonly canvas: HTMLCanvasElement;
  private readonly copy: CanvasRenderingContext2D;
  private readonly texture: Phaser.Textures.CanvasTexture;
  private readonly pmrem: THREE.PMREMGenerator;
  private readonly raycaster = new THREE.Raycaster();
  private readonly phaser: Phaser.Scene;
  private readonly key: string;
  private disposed = false;

  private constructor(
    phaser: Phaser.Scene,
    key: string,
    renderer: THREE.WebGLRenderer,
    canvas: HTMLCanvasElement,
    copy: CanvasRenderingContext2D,
    texture: Phaser.Textures.CanvasTexture,
    opts: StageOptions
  ) {
    this.phaser = phaser;
    this.key = key;
    this.renderer = renderer;
    this.canvas = canvas;
    this.copy = copy;
    this.texture = texture;

    this.scene = new THREE.Scene();
    this.scene.background = makeBackdrop(opts.backdrop ?? ["#1e3a8a", "#0f172a"]);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.7;

    this.camera = new THREE.PerspectiveCamera(opts.fov ?? 38, STAGE_W / STAGE_H, 0.1, 200);

    this.scene.add(new THREE.HemisphereLight(0xfff7ed, 0x1e293b, 0.6));
    this.keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    this.keyLight.position.set(4, 14, 7);
    if (opts.shadows !== false) {
      this.keyLight.castShadow = true;
      this.keyLight.shadow.mapSize.set(1024, 1024);
      const s = 10;
      this.keyLight.shadow.camera.left = -s;
      this.keyLight.shadow.camera.right = s;
      this.keyLight.shadow.camera.top = s;
      this.keyLight.shadow.camera.bottom = -s;
      this.keyLight.shadow.bias = -0.0005;
    }
    this.scene.add(this.keyLight);

    this.image = phaser.add.image(480, 270, key).setDisplaySize(960, 540).setDepth(1);
  }

  /** Returns null when WebGL is unavailable, so the caller can show a message instead of a blank screen. */
  static create(phaser: Phaser.Scene, opts: StageOptions): ThreeStage | null {
    const canvas = document.createElement("canvas");
    canvas.width = STAGE_W;
    canvas.height = STAGE_H;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    } catch {
      return null;
    }
    renderer.setPixelRatio(1);
    renderer.setSize(STAGE_W, STAGE_H, false);
    renderer.shadowMap.enabled = opts.shadows !== false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const flat = document.createElement("canvas");
    flat.width = STAGE_W;
    flat.height = STAGE_H;
    const copy = flat.getContext("2d");
    if (!copy) return null;
    if (phaser.textures.exists(opts.key)) phaser.textures.remove(opts.key);
    const texture = phaser.textures.addCanvas(opts.key, flat);
    if (!texture) return null;

    return new ThreeStage(phaser, opts.key, renderer, canvas, copy, texture, opts);
  }

  /** Draws the scene and hands the frame to Phaser. Call once per Phaser update. */
  render(): void {
    if (this.disposed) return;
    this.renderer.render(this.scene, this.camera);
    this.copy.drawImage(this.canvas, 0, 0);
    this.texture.refresh();
  }

  /** The nearest object hit by a tap at game coordinates (960 × 540), or null. */
  pick(x: number, y: number, targets: THREE.Object3D[]): THREE.Intersection | null {
    const ndc = new THREE.Vector2((x / 960) * 2 - 1, -(y / 540) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster.intersectObjects(targets, true)[0] ?? null;
  }

  /** Game coordinates (960 × 540) of a point in the 3D world. Used to place labels over the scene. */
  project(world: THREE.Vector3): { x: number; y: number } {
    const v = world.clone().project(this.camera);
    return { x: ((v.x + 1) / 2) * 960, y: ((1 - v.y) / 2) * 540 };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.pmrem.dispose();
    if (this.phaser.textures.exists(this.key)) this.phaser.textures.remove(this.key);
  }
}

/** Walks up from a hit object to the first ancestor that carries a given userData key. */
export function findUserData<T>(obj: THREE.Object3D | null, key: string): T | undefined {
  let node: THREE.Object3D | null = obj;
  while (node) {
    if (node.userData[key] !== undefined) return node.userData[key] as T;
    node = node.parent;
  }
  return undefined;
}

/** A soft vertical gradient for the 3D background, drawn once. */
function makeBackdrop([top, bottom]: [string, string]): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
