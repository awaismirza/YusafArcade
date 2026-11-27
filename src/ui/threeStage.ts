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
  /** Tone-mapping exposure. Lower it when bright pieces wash out. Default 0.95. */
  exposure?: number;
  /**
   * Puts the board on a table: the board's width (its base sits at y = -0.5) and the tabletop look.
   * Adds the tabletop, a soft contact shadow under the board and fog so the table fades into the room.
   */
  table?: { size: number; look?: "walnut" | "oak" | "felt" };
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
    const backdrop = opts.backdrop ?? ["#1e3a8a", "#0f172a"];
    this.scene.background = makeBackdrop(backdrop);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;

    this.camera = new THREE.PerspectiveCamera(opts.fov ?? 38, STAGE_W / STAGE_H, 0.1, 200);

    // Warm key light with soft shadows, a cool fill from the other side and a rim light from behind.
    this.scene.add(new THREE.HemisphereLight(0xfff4e6, 0x3b2a1a, 0.55));
    this.keyLight = new THREE.DirectionalLight(0xfff0dd, 2.6);
    this.keyLight.position.set(6, 16, 9);
    const fill = new THREE.DirectionalLight(0xa9c8ff, 0.55);
    fill.position.set(-9, 7, -4);
    const rim = new THREE.DirectionalLight(0xffffff, 0.45);
    rim.position.set(0, 9, -14);
    this.scene.add(fill, rim);
    if (opts.shadows !== false) {
      this.keyLight.castShadow = true;
      this.keyLight.shadow.mapSize.set(2048, 2048);
      this.keyLight.shadow.normalBias = 0.02;
      const s = 10;
      this.keyLight.shadow.camera.left = -s;
      this.keyLight.shadow.camera.right = s;
      this.keyLight.shadow.camera.top = s;
      this.keyLight.shadow.camera.bottom = -s;
      this.keyLight.shadow.bias = -0.0005;
    }
    this.scene.add(this.keyLight);
    if (opts.table) this.addTable(opts.table.size, opts.table.look ?? "walnut", backdrop[1]);

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
    renderer.toneMappingExposure = opts.exposure ?? 0.95;

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

  /** A tabletop under the board, a soft contact shadow, and fog so the far edge melts into the room. */
  private addTable(size: number, look: "walnut" | "oak" | "felt", far: string): void {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const g = c.getContext("2d")!;
    if (look === "felt") {
      g.fillStyle = "#17573a";
      g.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 9000; i++) {
        g.fillStyle = `rgba(${Math.random() < 0.5 ? "0,0,0" : "255,255,255"},${Math.random() * 0.05})`;
        g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
      }
    } else {
      const tones = look === "walnut" ? ["#6b4226", "#5c3820", "#744a2b"] : ["#c8925a", "#bb8550", "#d29d64"];
      for (let i = 0; i < 8; i++) {
        g.fillStyle = tones[i % 3];
        g.fillRect(0, i * 64, 512, 64);
        g.fillStyle = "rgba(20,10,4,0.35)";
        g.fillRect(0, i * 64, 512, 3);
        for (let k = 0; k < 14; k++) {
          g.strokeStyle = `rgba(30,15,5,${0.08 + Math.random() * 0.12})`;
          g.lineWidth = 1 + Math.random() * 2;
          g.beginPath();
          const y = i * 64 + 6 + Math.random() * 52;
          g.moveTo(0, y);
          g.bezierCurveTo(150, y + 8 * Math.random(), 350, y - 8 * Math.random(), 512, y + 3);
          g.stroke();
        }
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(5, 5);
    tex.anisotropy = 4;
    const table = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ map: tex, roughness: look === "felt" ? 0.95 : 0.6, metalness: 0 })
    );
    table.rotation.x = -Math.PI / 2;
    table.position.y = -0.505;
    table.receiveShadow = true;
    this.scene.add(table);
    // A soft dark halo right under the board, so it sits on the table instead of floating.
    const sc = document.createElement("canvas");
    sc.width = sc.height = 128;
    const sg = sc.getContext("2d")!;
    const grad = sg.createRadialGradient(64, 64, 20, 64, 64, 64);
    grad.addColorStop(0, "rgba(0,0,0,0.55)");
    grad.addColorStop(0.6, "rgba(0,0,0,0.3)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    sg.fillStyle = grad;
    sg.fillRect(0, 0, 128, 128);
    const shadowTex = new THREE.CanvasTexture(sc);
    const contact = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.45, size * 1.45), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = -0.5;
    this.scene.add(contact);
    this.scene.fog = new THREE.Fog(new THREE.Color(far), size * 1.6, size * 4.5);
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
  // A soft vignette: lighter in the upper middle, darker towards the edges.
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 144;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 144);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 144);
  const v = ctx.createRadialGradient(128, 50, 20, 128, 72, 170);
  v.addColorStop(0, "rgba(255,255,255,0.10)");
  v.addColorStop(0.6, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, 256, 144);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
