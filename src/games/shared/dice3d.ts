import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { AnimQueue, easeInOut, easeOut } from "../../ui/animQueue";

/** Face values in three.js box order: +x, -x, +y, -y, +z, -z. Opposite faces add to 7, like a real die. */
const FACE_VALUES = [3, 4, 1, 6, 2, 5];
const FACE_NORMAL: Record<number, THREE.Vector3> = {
  3: new THREE.Vector3(1, 0, 0),
  4: new THREE.Vector3(-1, 0, 0),
  1: new THREE.Vector3(0, 1, 0),
  6: new THREE.Vector3(0, -1, 0),
  2: new THREE.Vector3(0, 0, 1),
  5: new THREE.Vector3(0, 0, -1),
};
const UP = new THREE.Vector3(0, 1, 0);

const SHAKE_MS = 700;
const THROW_MS = 1100;

let faceMaterials: THREE.MeshStandardMaterial[] | null = null;

/** One shared set of six materials (pips drawn on a canvas), reused by every die. */
function getFaceMaterials(): THREE.MeshStandardMaterial[] {
  if (faceMaterials) return faceMaterials;
  faceMaterials = FACE_VALUES.map((value) => {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fbf7ee";
    ctx.fillRect(0, 0, 128, 128);
    // faint edge so faces read as separate even on a rounded cube
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 122, 122);
    const spots: Record<number, [number, number][]> = {
      1: [[0.5, 0.5]],
      2: [[0.27, 0.27], [0.73, 0.73]],
      3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
      4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
      5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
      6: [[0.27, 0.25], [0.73, 0.25], [0.27, 0.5], [0.73, 0.5], [0.27, 0.75], [0.73, 0.75]],
    };
    for (const [x, y] of spots[value]) {
      ctx.beginPath();
      ctx.arc(x * 128, y * 128, value === 1 ? 17 : 11, 0, Math.PI * 2);
      ctx.fillStyle = value === 1 ? "#dc2626" : "#1f2937";
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3, metalness: 0.02 });
  });
  return faceMaterials;
}

export type RollOptions = {
  /** Centre of the resting area on the board (world coordinates). */
  center: THREE.Vector3;
  /** Called when the dice have settled. */
  onLand?: () => void;
  /** Called at the start of the throw, for a sound. */
  onThrow?: () => void;
};

/**
 * One or more 3D dice. `roll()` plays a shake (the dice rattle in the air as if in a hand), then tosses them
 * onto the board so they bounce, tumble and settle with the chosen value facing up.
 */
export class DiceSet {
  readonly group = new THREE.Group();
  readonly meshes: THREE.Mesh[] = [];
  values: number[];
  private rest: THREE.Vector3[] = [];
  private selected: number | null = null;
  private resting = true;
  private readonly size: number;

  constructor(count: number, size = 0.95) {
    this.size = size;
    this.values = Array(count).fill(1);
    const geo = new RoundedBoxGeometry(size, size, size, 4, size * 0.14);
    const mats = getFaceMaterials();
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geo, mats);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.die = i;
      this.meshes.push(mesh);
      this.group.add(mesh);
    }
    this.group.visible = false;
  }

  get count(): number {
    return this.meshes.length;
  }

  /** Resting spots in a row around `center`, a little apart so neither die hides the other. */
  private layout(center: THREE.Vector3): THREE.Vector3[] {
    const gap = this.size * 1.45;
    return this.meshes.map((_, i) => {
      const x = center.x + (i - (this.count - 1) / 2) * gap;
      return new THREE.Vector3(x, center.y + this.size / 2, center.z);
    });
  }

  /** Highlights one die (it lifts and bobs), or none. */
  setSelected(index: number | null): void {
    this.selected = index;
  }

  /** Greys out dice that have been used, by shrinking them slightly. */
  setUsed(used: boolean[]): void {
    this.meshes.forEach((m, i) => {
      const s = used[i] ? 0.72 : 1;
      m.scale.setScalar(s);
    });
  }

  /** Shake in the air, then toss to rest on the board showing `values`. */
  roll(anims: AnimQueue, now: number, values: number[], opts: RollOptions): void {
    this.values = values.slice();
    this.resting = false;
    this.selected = null;
    this.group.visible = true;
    this.meshes.forEach((m) => m.scale.setScalar(1));
    this.rest = this.layout(opts.center);
    const hoverY = opts.center.y + 2.6;
    const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

    // Per-die random settings, chosen once so the motion is smooth.
    const info = this.meshes.map((_, i) => ({
      phase: rnd(0, 6.28),
      hover: new THREE.Vector3(this.rest[i].x + rnd(-0.3, 0.3), hoverY, this.rest[i].z + rnd(-0.3, 0.3)),
      land: new THREE.Vector3(this.rest[i].x + rnd(-0.35, 0.35), this.rest[i].y, this.rest[i].z + rnd(-0.35, 0.35)),
      axis: new THREE.Vector3(rnd(-1, 1), rnd(-0.4, 0.4), rnd(-1, 1)).normalize(),
      spin: rnd(3.2, 5.2) * Math.PI,
      target: new THREE.Quaternion(),
      shakeEnd: new THREE.Quaternion(),
    }));
    info.forEach((inf, i) => {
      const qUp = new THREE.Quaternion().setFromUnitVectors(FACE_NORMAL[values[i]], UP);
      const qYaw = new THREE.Quaternion().setFromAxisAngle(UP, rnd(0, Math.PI * 2));
      inf.target = qYaw.multiply(qUp);
    });

    const tmpEuler = new THREE.Euler();
    // Dice start by dropping into the "hand" from just above the board.
    this.meshes.forEach((m, i) => m.position.set(info[i].hover.x, hoverY - 1.2, info[i].hover.z));

    anims.chain(
      now,
      [
        // 1) Shake: rapid jitter and tilt, rising to hand height.
        () => ({
          dur: SHAKE_MS,
          update: (p: number) => {
            const t = p * SHAKE_MS;
            this.meshes.forEach((m, i) => {
              const inf = info[i];
              const rise = easeOut(Math.min(1, p * 3));
              const jitter = 0.14 * Math.sin(t / 22 + inf.phase);
              m.position.set(
                inf.hover.x + jitter,
                hoverY - 1.2 + rise * 1.2 + Math.abs(Math.sin(t / 55 + inf.phase)) * 0.22,
                inf.hover.z + 0.12 * Math.cos(t / 27 + inf.phase)
              );
              tmpEuler.set(0.7 * Math.sin(t / 41 + inf.phase), t / 90 + inf.phase, 0.7 * Math.cos(t / 33 + inf.phase));
              m.quaternion.setFromEuler(tmpEuler);
              if (p > 0.97) inf.shakeEnd.copy(m.quaternion);
            });
          },
        }),
        // 2) Throw: arc down, bounce, tumble and settle on the chosen face.
        (start: number) => {
          opts.onThrow?.();
          void start;
          return {
            dur: THROW_MS,
            update: (p: number) => {
              const e = easeOut(p);
              this.meshes.forEach((m, i) => {
                const inf = info[i];
                const bounce = Math.abs(Math.sin(p * Math.PI * 3)) * 0.55 * Math.pow(1 - p, 1.4);
                m.position.set(
                  inf.hover.x + (inf.land.x - inf.hover.x) * e,
                  inf.land.y + (hoverY - inf.land.y) * Math.pow(1 - p, 2) + bounce,
                  inf.hover.z + (inf.land.z - inf.hover.z) * e
                );
                const base = inf.shakeEnd.clone().slerp(inf.target, easeInOut(Math.min(1, p * 1.15)));
                const extra = new THREE.Quaternion().setFromAxisAngle(inf.axis, inf.spin * Math.sin(p * Math.PI) * (1 - p * 0.3));
                m.quaternion.copy(extra.multiply(base));
                if (p >= 1) {
                  m.position.copy(inf.land);
                  m.quaternion.copy(inf.target);
                }
              });
            },
          };
        },
      ],
      () => {
        this.rest = info.map((inf) => inf.land.clone());
        this.resting = true;
        opts.onLand?.();
      }
    );
  }

  /** Bobbing for the selected die. Call every frame. */
  update(now: number): void {
    if (!this.resting) return;
    this.meshes.forEach((m, i) => {
      const base = this.rest[i];
      if (!base) return;
      const lift = this.selected === i ? 0.28 + Math.sin(now / 180) * 0.06 : 0;
      m.position.y = base.y + lift;
    });
  }
}
