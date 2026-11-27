import * as THREE from "three";

/** Hemisphere fill plus one shadow-casting sun. */
export function addLights(scene: THREE.Scene, opts: { sun?: number; hemiSky?: number; hemiGround?: number; shadowSize?: number; at?: THREE.Vector3 } = {}): THREE.DirectionalLight {
  scene.add(new THREE.HemisphereLight(opts.hemiSky ?? 0xdbeafe, opts.hemiGround ?? 0x3b2f5c, 1.1));
  const sun = new THREE.DirectionalLight(opts.sun ?? 0xffffff, 2.2);
  const at = opts.at ?? new THREE.Vector3(0, 0, 0);
  sun.position.set(at.x + 8, 18, at.z + 10);
  sun.target.position.copy(at);
  sun.castShadow = true;
  const s = opts.shadowSize ?? 14;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -s;
  sun.shadow.camera.right = s;
  sun.shadow.camera.top = s;
  sun.shadow.camera.bottom = -s;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  scene.add(sun.target);
  return sun;
}

/** A vertical gradient texture for scene.background. */
export function gradientTexture(top: string, bottom: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Frees every geometry, material and texture under a scene. */
export function disposeScene(scene: THREE.Object3D): void {
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose?.();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
      mat.dispose();
    }
  });
  if (scene instanceof THREE.Scene && scene.background instanceof THREE.Texture) scene.background.dispose();
}

export const mat = (color: number, opts: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...opts });

export function shadowed<T extends THREE.Object3D>(o: T, cast = true, receive = true): T {
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = cast;
      c.receiveShadow = receive;
    }
  });
  return o;
}

/** Bright confetti that falls over an area and cleans itself up. Call update(dt) each frame. */
export class Confetti {
  private group = new THREE.Group();
  private bits: { m: THREE.Mesh; v: THREE.Vector3; s: THREE.Vector3 }[] = [];
  private geo = new THREE.PlaneGeometry(0.22, 0.12);
  private life = 0;
  done = false;

  constructor(private scene: THREE.Scene, center: THREE.Vector3, spread = 8, count = 90) {
    const colors = [0xfacc15, 0xff7ab8, 0x60a5fa, 0x34d399, 0xffffff, 0xf97316];
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide, transparent: true }));
      m.position.set(center.x + (Math.random() - 0.5) * spread, center.y + 4 + Math.random() * 5, center.z + (Math.random() - 0.5) * spread);
      this.group.add(m);
      this.bits.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 1.2, -1.5 - Math.random() * 2, (Math.random() - 0.5) * 1.2), s: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6) });
    }
    scene.add(this.group);
  }

  update(dt: number): void {
    if (this.done) return;
    this.life += dt;
    for (const b of this.bits) {
      b.m.position.addScaledVector(b.v, dt);
      b.m.rotation.x += b.s.x * dt;
      b.m.rotation.y += b.s.y * dt;
      (b.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - Math.max(0, this.life - 2.2) / 0.8);
    }
    if (this.life > 3) this.dispose();
  }

  dispose(): void {
    if (this.done) return;
    this.done = true;
    this.scene.remove(this.group);
    for (const b of this.bits) (b.m.material as THREE.Material).dispose();
    this.geo.dispose();
  }
}

/** A text label drawn on a canvas, as a sprite that always faces the camera. */
export function labelSprite(text: string, color = "#ffffff", bg = "rgba(20,16,60,0.7)"): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = bg;
  g.beginPath();
  g.roundRect(4, 6, 248, 52, 26);
  g.fill();
  g.fillStyle = color;
  g.font = "800 30px Nunito, system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 128, 33);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(2, 0.5, 1);
  s.renderOrder = 10;
  return s;
}
