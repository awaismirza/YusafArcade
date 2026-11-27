/**
 * Tank Commander 3D view: a toy-army diorama on a wooden desk, toy tanks with turrets and rolling treads, and the
 * effects (muzzle flash, smoke, shell trails, ricochet sparks, explosions, scorch marks, track marks, wreck crosses).
 */
import * as THREE from "three";
import { mat, shadowed } from "../kit/three";
import { BLOCK, CRATE, HOLE, KINDS, Pt, Tank, TankEvent, World } from "./sim";

function tex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = false): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
const noise = (g: CanvasRenderingContext2D, w: number, h: number, n: number, rgba: () => string): void => {
  for (let i = 0; i < n; i++) {
    g.fillStyle = rgba();
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
};

type Particle = { m: THREE.Mesh; mat: THREE.MeshBasicMaterial; v: THREE.Vector3; life: number; max: number; s0: number; s1: number; grav: number; fade: boolean; active: boolean };
type TankMesh = { root: THREE.Group; hull: THREE.Group; turret: THREE.Group; treads: THREE.CanvasTexture[]; ring: THREE.Mesh; shield: THREE.Mesh; lastMark: number; lastPuff: number; dead: boolean };

export class TankView {
  readonly group = new THREE.Group();
  shake = 0;
  private cols: number;
  private rows: number;
  private crates = new Map<number, THREE.Mesh>();
  private tanks: TankMesh[] = [];
  private shells = new Map<number, THREE.Mesh>();
  private mines: THREE.Group[] = [];
  private pickups: THREE.Group[] = [];
  private particles: Particle[] = [];
  private decals: THREE.Mesh[] = [];
  private marks: THREE.InstancedMesh;
  private markAge: Float32Array;
  private markNext = 0;
  private aimDots: THREE.InstancedMesh[] = [];
  private disposables: { dispose(): void }[] = [];
  private geo = {
    puff: new THREE.SphereGeometry(0.12, 8, 6),
    spark: new THREE.BoxGeometry(0.05, 0.05, 0.05),
    debris: new THREE.BoxGeometry(0.12, 0.08, 0.12),
    shell: new THREE.CapsuleGeometry(0.07, 0.14, 4, 8),
    disc: new THREE.CircleGeometry(0.5, 24),
    dot: new THREE.SphereGeometry(0.05, 6, 4),
  };
  private texs: Record<string, THREE.Texture>;
  private shellMat = mat(0x111827, { roughness: 0.25, metalness: 0.4 });
  private laserMat = mat(0xf43f5e, { emissive: 0xf43f5e, emissiveIntensity: 2 });

  constructor(private scene: THREE.Scene, w: World) {
    this.cols = w.cols;
    this.rows = w.rows;
    scene.add(this.group);
    this.texs = this.makeTextures();
    this.buildBoard(w);
    // track marks: one instanced mesh, each mark shrinks away over a few seconds
    const markGeo = new THREE.PlaneGeometry(0.14, 0.1);
    markGeo.rotateX(-Math.PI / 2);
    this.marks = new THREE.InstancedMesh(markGeo, new THREE.MeshBasicMaterial({ color: 0x6b4f2a, transparent: true, opacity: 0.35, depthWrite: false }), 500);
    this.marks.count = 500;
    this.markAge = new Float32Array(500).fill(99);
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < 500; i++) this.marks.setMatrixAt(i, zero);
    this.group.add(this.marks);
    // pools
    for (let i = 0; i < 260; i++) {
      const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false });
      const mesh = new THREE.Mesh(this.geo.puff, m);
      mesh.visible = false;
      this.group.add(mesh);
      this.particles.push({ m: mesh, mat: m, v: new THREE.Vector3(), life: 0, max: 1, s0: 1, s1: 1, grav: 0, fade: true, active: false });
    }
    for (let p = 0; p < 3; p++) {
      const dots = new THREE.InstancedMesh(this.geo.dot, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }), 80);
      dots.count = 0;
      this.group.add(dots);
      this.aimDots.push(dots);
    }
    w.tanks.forEach((t) => this.tanks.push(this.buildTank(t)));
  }

  /** World (tile) coordinates to scene coordinates. */
  pos(x: number, y: number, h = 0): THREE.Vector3 {
    return new THREE.Vector3(x - this.cols / 2, h, y - this.rows / 2);
  }

  private makeTextures(): Record<string, THREE.Texture> {
    const t = {
      desk: tex(256, 256, (g) => {
        for (let i = 0; i < 8; i++) {
          g.fillStyle = i % 2 ? "#a46a3c" : "#ad7345";
          g.fillRect(0, i * 32, 256, 32);
          g.fillStyle = "rgba(60,30,10,0.35)";
          g.fillRect(0, i * 32, 256, 2);
          for (let k = 0; k < 6; k++) {
            g.strokeStyle = "rgba(80,40,15,0.18)";
            g.beginPath();
            const y = i * 32 + 6 + Math.random() * 20;
            g.moveTo(0, y);
            g.bezierCurveTo(80, y + 4, 160, y - 4, 256, y + 2);
            g.stroke();
          }
        }
      }, true),
      felt: tex(128, 128, (g) => {
        g.fillStyle = "#e9d9b4";
        g.fillRect(0, 0, 128, 128);
        noise(g, 128, 128, 900, () => `rgba(120,90,50,${Math.random() * 0.08})`);
        g.strokeStyle = "rgba(140,110,70,0.25)";
        g.lineWidth = 2;
        g.strokeRect(1, 1, 126, 126);
      }, true),
      block: tex(128, 128, (g) => {
        const grad = g.createLinearGradient(0, 0, 128, 128);
        grad.addColorStop(0, "#f2c98d");
        grad.addColorStop(1, "#d9a865");
        g.fillStyle = grad;
        g.fillRect(0, 0, 128, 128);
        for (let k = 0; k < 10; k++) {
          g.strokeStyle = "rgba(150,95,40,0.25)";
          g.beginPath();
          const y = Math.random() * 128;
          g.moveTo(0, y);
          g.bezierCurveTo(40, y + 6, 90, y - 6, 128, y + 3);
          g.stroke();
        }
        g.strokeStyle = "rgba(110,70,30,0.55)";
        g.lineWidth = 6;
        g.strokeRect(3, 3, 122, 122);
      }),
      cork: tex(128, 128, (g) => {
        g.fillStyle = "#c08a52";
        g.fillRect(0, 0, 128, 128);
        noise(g, 128, 128, 1400, () => (Math.random() < 0.5 ? `rgba(90,55,25,${0.2 + Math.random() * 0.3})` : `rgba(230,190,140,${Math.random() * 0.4})`));
        g.strokeStyle = "rgba(90,55,25,0.6)";
        g.lineWidth = 5;
        g.strokeRect(3, 3, 122, 122);
      }),
      hole: tex(128, 128, (g) => {
        const r = g.createRadialGradient(64, 64, 8, 64, 64, 70);
        r.addColorStop(0, "#050505");
        r.addColorStop(0.75, "#1a120a");
        r.addColorStop(1, "#4a3420");
        g.fillStyle = r;
        g.fillRect(0, 0, 128, 128);
      }),
      tread: tex(16, 64, (g) => {
        g.fillStyle = "#1f2937";
        g.fillRect(0, 0, 16, 64);
        g.fillStyle = "#4b5563";
        for (let y = 0; y < 64; y += 8) g.fillRect(0, y, 16, 3);
      }, true),
      scorch: tex(64, 64, (g) => {
        const r = g.createRadialGradient(32, 32, 2, 32, 32, 30);
        r.addColorStop(0, "rgba(20,12,6,0.85)");
        r.addColorStop(0.6, "rgba(40,24,10,0.45)");
        r.addColorStop(1, "rgba(40,24,10,0)");
        g.fillStyle = r;
        g.fillRect(0, 0, 64, 64);
      }),
      cross: tex(64, 64, (g) => {
        g.strokeStyle = "rgba(30,20,10,0.75)";
        g.lineWidth = 10;
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(12, 12);
        g.lineTo(52, 52);
        g.moveTo(52, 12);
        g.lineTo(12, 52);
        g.stroke();
      }),
    };
    Object.values(t).forEach((x) => this.disposables.push(x));
    return t;
  }

  private buildBoard(w: World): void {
    const desk = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), new THREE.MeshStandardMaterial({ map: this.texs.desk, roughness: 0.7 }));
    (this.texs.desk as THREE.Texture).repeat.set(8, 6);
    desk.rotation.x = -Math.PI / 2;
    desk.position.y = -0.21;
    desk.receiveShadow = true;
    this.group.add(desk);
    this.addDeskProps();
    // the play mat
    const felt = new THREE.Mesh(new THREE.BoxGeometry(this.cols, 0.2, this.rows), new THREE.MeshStandardMaterial({ map: this.texs.felt, roughness: 0.95 }));
    (this.texs.felt as THREE.Texture).repeat.set(this.cols, this.rows);
    felt.position.y = -0.1;
    felt.receiveShadow = true;
    this.group.add(felt);
    // a wooden frame around the mat
    const frameM = new THREE.MeshStandardMaterial({ map: this.texs.block, roughness: 0.6 });
    const edge = (x: number, z: number, sx: number, sz: number): void => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.7, sz), frameM);
      m.position.set(x, 0.15, z);
      this.group.add(shadowed(m));
    };
    edge(0, -this.rows / 2 - 0.3, this.cols + 1.2, 0.6);
    edge(0, this.rows / 2 + 0.3, this.cols + 1.2, 0.6);
    edge(-this.cols / 2 - 0.3, 0, 0.6, this.rows);
    edge(this.cols / 2 + 0.3, 0, 0.6, this.rows);
    // blocks (one instanced mesh), crates, holes
    const blocks: number[] = [];
    for (let i = 0; i < w.grid.length; i++) if (w.grid[i] === BLOCK) blocks.push(i);
    if (blocks.length) {
      const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.98, 0.8, 0.98), new THREE.MeshStandardMaterial({ map: this.texs.block, roughness: 0.55 }), blocks.length);
      const m4 = new THREE.Matrix4();
      blocks.forEach((i, k) => {
        const p = this.pos((i % this.cols) + 0.5, Math.floor(i / this.cols) + 0.5, 0.4);
        inst.setMatrixAt(k, m4.makeTranslation(p.x, p.y, p.z));
      });
      this.group.add(shadowed(inst));
    }
    const crateGeo = new THREE.BoxGeometry(0.9, 0.62, 0.9);
    const crateMat = new THREE.MeshStandardMaterial({ map: this.texs.cork, roughness: 0.9 });
    const holeMat = new THREE.MeshBasicMaterial({ map: this.texs.hole });
    for (let i = 0; i < w.grid.length; i++) {
      const tx = i % this.cols;
      const ty = Math.floor(i / this.cols);
      if (w.grid[i] === CRATE) {
        const m = new THREE.Mesh(crateGeo, crateMat);
        m.position.copy(this.pos(tx + 0.5, ty + 0.5, 0.31));
        m.rotation.y = (Math.random() - 0.5) * 0.1;
        this.group.add(shadowed(m));
        this.crates.set(i, m);
      } else if (w.grid[i] === HOLE) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), holeMat);
        m.rotation.x = -Math.PI / 2;
        m.position.copy(this.pos(tx + 0.5, ty + 0.5, 0.004));
        this.group.add(m);
      }
    }
  }

  /** Pencils, a ruler, a mug and toy blocks on the desk around the battlefield. */
  private addDeskProps(): void {
    const W = this.cols / 2;
    const H = this.rows / 2;
    const pencil = (x: number, z: number, rot: number, color: number): void => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 5, 6), mat(color, { roughness: 0.5 }));
      body.rotation.z = Math.PI / 2;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 6), mat(0xf5deb3));
      tip.rotation.z = -Math.PI / 2;
      tip.position.x = 2.8;
      const lead = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 6), mat(0x1f2937));
      lead.rotation.z = -Math.PI / 2;
      lead.position.x = 3.15;
      const eraser = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.4, 12), mat(0xf9a8d4));
      eraser.rotation.z = Math.PI / 2;
      eraser.position.x = -2.7;
      g.add(body, tip, lead, eraser);
      g.position.set(x, -0.05, z);
      g.rotation.y = rot;
      this.group.add(shadowed(g));
    };
    pencil(-W - 3.2, -H + 1, 1.2, 0xfacc15);
    pencil(W + 3.4, H - 2, -0.5, 0x3b82f6);
    const ruler = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 1.1), mat(0xfde68a, { roughness: 0.4 }));
    ruler.position.set(-3, -0.17, H + 2.6);
    ruler.rotation.y = 0.05;
    this.group.add(shadowed(ruler));
    const mug = new THREE.Group();
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.9, 2.2, 24, 1, true), mat(0xef4444, { side: THREE.DoubleSide }));
    const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.95, 24), mat(0x3f2a1a));
    coffee.rotation.x = -Math.PI / 2;
    coffee.position.y = 0.85;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.13, 8, 16, Math.PI), mat(0xef4444));
    handle.rotation.z = -Math.PI / 2;
    handle.position.x = 1;
    mug.add(cup, coffee, handle);
    mug.position.set(W + 3.5, 0.9, -H - 1.5);
    this.group.add(shadowed(mug));
    const colors = [0xef4444, 0x22c55e, 0x3b82f6, 0xf59e0b];
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), mat(colors[i % 4], { roughness: 0.4 }));
      b.position.set(-W - 3.6 + (i % 2) * 1.0, -0.2 + 0.45 + Math.floor(i / 2) * 0.9, H - 1 - (i % 3) * 0.2);
      b.rotation.y = i * 0.3;
      this.group.add(shadowed(b));
    }
  }

  private buildTank(t: Tank): TankMesh {
    const k = KINDS[t.kind];
    const s = k.radius / 0.4;
    const root = new THREE.Group();
    const hull = new THREE.Group();
    const turret = new THREE.Group();
    const body = mat(t.color, { roughness: 0.45, metalness: 0.1 });
    const dark = mat(new THREE.Color(t.color).multiplyScalar(0.6).getHex(), { roughness: 0.5 });
    // hull: a chunky base with sloped front and back
    const shape = new THREE.Shape();
    shape.moveTo(-0.42, -0.26);
    shape.lineTo(0.36, -0.26);
    shape.lineTo(0.46, -0.12);
    shape.lineTo(0.46, 0.12);
    shape.lineTo(0.36, 0.26);
    shape.lineTo(-0.42, 0.26);
    shape.lineTo(-0.46, 0.18);
    shape.lineTo(-0.46, -0.18);
    shape.closePath();
    const hullGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 2 });
    hullGeo.rotateX(Math.PI / 2);
    const hullMesh = new THREE.Mesh(hullGeo, body);
    hullMesh.position.y = 0.36;
    hull.add(hullMesh);
    // treads with a scrolling texture
    const treads: THREE.CanvasTexture[] = [];
    for (const side of [-1, 1]) {
      const tt = (this.texs.tread as THREE.CanvasTexture).clone();
      tt.needsUpdate = true;
      tt.repeat.set(1, 3);
      treads.push(tt);
      this.disposables.push(tt);
      const tread = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.22, 0.17), [mat(0x1f2937), mat(0x1f2937), new THREE.MeshStandardMaterial({ map: tt, roughness: 0.9 }), mat(0x1f2937), mat(0x1f2937), mat(0x1f2937)]);
      tread.position.set(0, 0.12, side * 0.31);
      hull.add(tread);
      for (const wx of [-0.34, 0, 0.34]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 12), mat(0x6b7280));
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(wx, 0.12, side * 0.4);
        hull.add(wheel);
      }
    }
    // turret: dome, mantlet, barrel with a muzzle ring
    const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.16, 20), body);
    dome.position.y = 0.6;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), body);
    cap.position.y = 0.68;
    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 12), dark);
    hatch.position.set(-0.06, 0.88, 0);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.52, 12), dark);
    barrel.rotation.z = -Math.PI / 2;
    barrel.position.set(0.38, 0.64, 0);
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.08, 12), dark);
    muzzle.rotation.z = -Math.PI / 2;
    muzzle.position.set(0.64, 0.64, 0);
    turret.add(dome, cap, hatch, barrel, muzzle);
    if (t.kind === "boss") {
      const crown = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 16), mat(0xfacc15, { metalness: 0.7, roughness: 0.25 }));
      crown.rotation.x = Math.PI / 2;
      crown.position.y = 0.86;
      turret.add(crown);
    }
    root.add(hull, turret);
    root.scale.setScalar(s * 1.12);
    // a coloured ring under players so each child can find their tank
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.6, 32), new THREE.MeshBasicMaterial({ color: t.color, transparent: true, opacity: t.human >= 0 || (t.kind === "player" && t.human < 0) ? 0.85 : 0 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    root.add(ring);
    const shield = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 16), new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.28, depthWrite: false }));
    shield.position.y = 0.4;
    shield.visible = false;
    root.add(shield);
    this.group.add(shadowed(root, true, false));
    return { root, hull, turret, treads, ring, shield, lastMark: 0, lastPuff: 0, dead: false };
  }

  // ------------------------------------------------------------------ particles
  private emit(at: THREE.Vector3, o: { color: number; v?: THREE.Vector3; life: number; s0: number; s1: number; grav?: number; geo?: THREE.BufferGeometry; opacity?: number }): void {
    const p = this.particles.find((q) => !q.active);
    if (!p) return;
    p.active = true;
    p.m.visible = true;
    p.m.geometry = o.geo ?? this.geo.puff;
    p.m.position.copy(at);
    p.m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    p.mat.color.setHex(o.color);
    p.mat.opacity = o.opacity ?? 0.9;
    p.v.copy(o.v ?? new THREE.Vector3());
    p.life = 0;
    p.max = o.life;
    p.s0 = o.s0;
    p.s1 = o.s1;
    p.grav = o.grav ?? 0;
    p.m.scale.setScalar(o.s0);
  }

  private decal(x: number, y: number, map: THREE.Texture, size: number): void {
    const m = new THREE.Mesh(this.geo.disc, new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = Math.random() * Math.PI;
    m.position.copy(this.pos(x, y, 0.006 + this.decals.length * 0.0004));
    m.scale.setScalar(size);
    this.group.add(m);
    this.decals.push(m);
    if (this.decals.length > 40) {
      const old = this.decals.shift()!;
      this.group.remove(old);
      (old.material as THREE.Material).dispose();
    }
  }

  private explosion(x: number, y: number, big: number): void {
    const at = this.pos(x, y, 0.4);
    this.emit(at, { color: 0xfff1a8, life: 0.18, s0: 1.5 * big, s1: 4 * big, opacity: 1 });
    this.emit(at, { color: 0xf97316, life: 0.45, s0: 2 * big, s1: 6 * big, opacity: 0.95 });
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      this.emit(at, { color: i % 2 ? 0x44403c : 0x78350f, geo: this.geo.debris, v: new THREE.Vector3(Math.cos(a) * (2 + Math.random() * 2), 3 + Math.random() * 3, Math.sin(a) * (2 + Math.random() * 2)), life: 0.9, s0: 1, s1: 0.6, grav: 12, opacity: 1 });
    }
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      this.emit(at, { color: 0x57534e, v: new THREE.Vector3(Math.cos(a) * 0.8, 1 + Math.random(), Math.sin(a) * 0.8), life: 1.3, s0: 1.5, s1: 4, opacity: 0.55 });
    }
    this.decal(x, y, this.texs.scorch, 1.3 * big);
    this.shake = Math.min(0.5, this.shake + 0.22 * big);
  }

  /** Turns simulation events into effects. */
  handle(ev: TankEvent[], w: World): void {
    for (const e of ev) {
      switch (e.type) {
        case "fire": {
          const at = this.pos(e.x, e.y, 0.64);
          this.emit(at, { color: 0xfde68a, life: 0.09, s0: 1.4, s1: 2.6, opacity: 1 });
          for (let i = 0; i < 3; i++) this.emit(at, { color: 0xd6d3d1, v: new THREE.Vector3(Math.cos(e.angle) * 0.8 + (Math.random() - 0.5), 0.6, Math.sin(e.angle) * 0.8 + (Math.random() - 0.5)), life: 0.6, s0: 0.8, s1: 2.2, opacity: 0.6 });
          const tm = this.tanks[e.tank];
          if (tm) tm.turret.position.x = -0.06; // recoil, springs back in sync()
          break;
        }
        case "bounce":
          for (let i = 0; i < 6; i++) this.emit(this.pos(e.x, e.y, 0.3), { color: 0xfde047, geo: this.geo.spark, v: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 2, (Math.random() - 0.5) * 4), life: 0.25, s0: 1, s1: 0.3, opacity: 1 });
          break;
        case "pop":
        case "shellsCollide":
          this.emit(this.pos(e.x, e.y, 0.3), { color: 0xe7e5e4, life: 0.35, s0: 1, s1: 2.5, opacity: 0.8 });
          for (let i = 0; i < 4; i++) this.emit(this.pos(e.x, e.y, 0.3), { color: 0xfbbf24, geo: this.geo.spark, v: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3), life: 0.3, s0: 1, s1: 0.3, opacity: 1 });
          break;
        case "explode":
          this.explosion(e.x, e.y, 1.3);
          break;
        case "crateBreak": {
          const i = e.ty * this.cols + e.tx;
          const m = this.crates.get(i);
          if (m) {
            this.group.remove(m);
            this.crates.delete(i);
          }
          for (let k = 0; k < 8; k++) this.emit(this.pos(e.tx + 0.5, e.ty + 0.5, 0.3), { color: 0xc08a52, geo: this.geo.debris, v: new THREE.Vector3((Math.random() - 0.5) * 5, 2 + Math.random() * 3, (Math.random() - 0.5) * 5), life: 0.8, s0: 1.3, s1: 0.7, grav: 12, opacity: 1 });
          break;
        }
        case "hit":
          this.emit(this.pos(e.x, e.y, 0.5), { color: 0xfde68a, life: 0.15, s0: 2, s1: 3.5, opacity: 1 });
          break;
        case "shieldPop":
          this.emit(this.pos(e.x, e.y, 0.4), { color: 0x67e8f9, life: 0.4, s0: 4, s1: 7, opacity: 0.6 });
          break;
        case "tankDead": {
          this.explosion(e.x, e.y, 1);
          this.decal(e.x, e.y, this.texs.cross, 0.9);
          const tm = this.tanks[e.tank];
          if (tm && !tm.dead) {
            tm.dead = true;
            // turret flies off, the hull is left as a dark wreck
            this.emit(this.pos(e.x, e.y, 0.7), { color: w.tanks[e.tank].color, geo: this.geo.debris, v: new THREE.Vector3(0, 6, 0), life: 0.9, s0: 3, s1: 2, grav: 14, opacity: 1 });
            tm.turret.visible = false;
            tm.ring.visible = false;
            tm.hull.traverse((o) => {
              const mm = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[] | undefined;
              for (const q of Array.isArray(mm) ? mm : mm ? [mm] : []) if ("color" in q) q.color.multiplyScalar(0.25);
            });
          }
          break;
        }
        case "pickup":
          this.emit(this.pos(w.tanks[e.tank].x, w.tanks[e.tank].y, 0.5), { color: 0xfacc15, life: 0.4, s0: 3, s1: 6, opacity: 0.6 });
          break;
        default:
          break;
      }
    }
  }

  /** Shows a dotted aim line for one human (or hides it with null). */
  aimLine(slot: number, points: Pt[] | null, color: number): void {
    const dots = this.aimDots[slot];
    if (!dots) return;
    if (!points || points.length < 2) {
      dots.count = 0;
      return;
    }
    (dots.material as THREE.MeshBasicMaterial).color.setHex(color);
    const m4 = new THREE.Matrix4();
    let n = 0;
    let carry = 0.5;
    for (let i = 1; i < points.length && n < 80; i++) {
      const a = points[i - 1];
      const b = points[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      for (let d = carry; d < len && n < 80; d += 0.32) {
        const f = d / len;
        const p = this.pos(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, 0.35);
        dots.setMatrixAt(n++, m4.makeTranslation(p.x, p.y, p.z));
      }
      carry = Math.max(0, 0.32 - (len % 0.32));
    }
    dots.count = n;
    dots.instanceMatrix.needsUpdate = true;
  }

  /** Moves everything to match the simulation and runs the effects. */
  sync(w: World, dt: number, time: number): void {
    w.tanks.forEach((t, i) => {
      let tm = this.tanks[i];
      if (!tm) tm = this.tanks[i] = this.buildTank(t);
      tm.root.position.copy(this.pos(t.x, t.y));
      tm.root.rotation.y = -t.body;
      tm.turret.rotation.y = -(t.turret - t.body);
      tm.turret.position.x += (0 - tm.turret.position.x) * Math.min(1, dt * 12);
      if (!t.alive) return;
      tm.shield.visible = t.shield > 0;
      if (tm.shield.visible) (tm.shield.material as THREE.MeshBasicMaterial).opacity = 0.2 + Math.sin(time * 8) * 0.08;
      const ringMat = tm.ring.material as THREE.MeshBasicMaterial;
      if (ringMat.opacity > 0) ringMat.opacity = 0.65 + Math.sin(time * 4) * 0.2;
      tm.treads.forEach((tt) => (tt.offset.y = -t.odo * 1.5));
      tm.root.position.y = t.moving ? Math.abs(Math.sin(t.odo * 9)) * 0.025 : 0;
      if (t.moving && t.odo - tm.lastMark > 0.22) {
        tm.lastMark = t.odo;
        for (const side of [-0.31, 0.31]) {
          const r = KINDS[t.kind].radius / 0.4;
          const px = t.x - Math.sin(t.body) * side * r;
          const py = t.y + Math.cos(t.body) * side * r;
          const p = this.pos(px, py, 0.008);
          const m4 = new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -t.body), new THREE.Vector3(1, 1, 1));
          this.marks.setMatrixAt(this.markNext, m4);
          this.markAge[this.markNext] = 0;
          this.markNext = (this.markNext + 1) % 500;
        }
        this.marks.instanceMatrix.needsUpdate = true;
      }
      if (t.moving && time - tm.lastPuff > 0.14) {
        tm.lastPuff = time;
        const back = this.pos(t.x - Math.cos(t.body) * 0.45, t.y - Math.sin(t.body) * 0.45, 0.35);
        this.emit(back, { color: 0xa8a29e, v: new THREE.Vector3(0, 0.5, 0), life: 0.7, s0: 0.5, s1: 1.6, opacity: 0.35 });
      }
    });
    // fade track marks by shrinking them
    let dirty = false;
    const m4 = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    for (let i = 0; i < 500; i++) {
      if (this.markAge[i] > 6) continue;
      this.markAge[i] += dt;
      if (Math.floor(this.markAge[i] * 4) !== Math.floor((this.markAge[i] - dt) * 4)) {
        this.marks.getMatrixAt(i, m4);
        m4.decompose(p, q, s);
        const k = Math.max(0, 1 - this.markAge[i] / 6);
        m4.compose(p, q, s.set(k, 1, k));
        this.marks.setMatrixAt(i, m4);
        dirty = true;
      }
    }
    if (dirty) this.marks.instanceMatrix.needsUpdate = true;
    // shells (+ a little smoke trail)
    const live = new Set(w.shells.map((x) => x.id));
    for (const [id, m] of this.shells) if (!live.has(id)) {
      this.group.remove(m);
      this.shells.delete(id);
    }
    for (const sh of w.shells) {
      let m = this.shells.get(sh.id);
      if (!m) {
        m = new THREE.Mesh(this.geo.shell, sh.laser ? this.laserMat : this.shellMat);
        m.castShadow = true;
        this.group.add(m);
        this.shells.set(sh.id, m);
      }
      m.position.copy(this.pos(sh.x, sh.y, 0.42));
      m.rotation.set(0, -Math.atan2(sh.vy, sh.vx), Math.PI / 2);
      if (Math.random() < 0.6) this.emit(m.position.clone(), { color: sh.laser ? 0xfda4af : 0xe7e5e4, life: 0.35, s0: 0.45, s1: 0.15, opacity: 0.6 });
    }
    // mines: blink faster as they get ready to go off
    while (this.mines.length < w.mines.length) {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.1, 18), mat(0xfacc15, { roughness: 0.5 }));
      base.position.y = 0.05;
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
      light.position.y = 0.13;
      light.name = "light";
      g.add(base, light);
      this.group.add(shadowed(g));
      this.mines.push(g);
    }
    this.mines.forEach((g, i) => {
      const m = w.mines[i];
      g.visible = !!m;
      if (!m) return;
      g.position.copy(this.pos(m.x, m.y));
      const rate = m.age > m.fuse - 2.5 ? 12 : 4;
      const light = g.getObjectByName("light") as THREE.Mesh;
      ((light.material as THREE.MeshBasicMaterial).color as THREE.Color).setHex(Math.sin(time * rate) > 0 ? 0xef4444 : 0x450a0a);
    });
    // power-up crates
    while (this.pickups.length < w.pickups.length) {
      const g = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), mat(0xffffff, { roughness: 0.3, emissive: 0xffffff, emissiveIntensity: 0.15 }));
      box.name = "box";
      const halo = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 24), new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.02;
      g.add(box, halo);
      this.group.add(g);
      this.pickups.push(g);
    }
    const colors = { laser: 0xf43f5e, triple: 0xf59e0b, shield: 0x22d3ee, speed: 0x22c55e };
    this.pickups.forEach((g, i) => {
      const pk = w.pickups[i];
      g.visible = !!pk;
      if (!pk) return;
      g.position.copy(this.pos(pk.x, pk.y, 0));
      const box = g.getObjectByName("box") as THREE.Mesh;
      box.position.y = 0.4 + Math.sin(time * 3 + i) * 0.08;
      box.rotation.y = time * 1.5;
      box.rotation.x = time * 0.7;
      const bm = box.material as THREE.MeshStandardMaterial;
      bm.color.setHex(colors[pk.kind]);
      bm.emissive.setHex(colors[pk.kind]);
    });
    // particles
    for (const pt of this.particles) {
      if (!pt.active) continue;
      pt.life += dt;
      const f = pt.life / pt.max;
      if (f >= 1) {
        pt.active = false;
        pt.m.visible = false;
        continue;
      }
      pt.v.y -= pt.grav * dt;
      pt.m.position.addScaledVector(pt.v, dt);
      if (pt.m.position.y < 0.02) {
        pt.m.position.y = 0.02;
        pt.v.set(pt.v.x * 0.5, 0, pt.v.z * 0.5);
      }
      pt.m.scale.setScalar(pt.s0 + (pt.s1 - pt.s0) * f);
      if (pt.fade) pt.mat.opacity = Math.min(pt.mat.opacity, 1 - f);
    }
    this.shake = Math.max(0, this.shake - dt * 1.6);
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      mats.forEach((x) => x.dispose());
    });
    Object.values(this.geo).forEach((g) => g.dispose());
    this.disposables.forEach((d) => d.dispose());
  }
}
