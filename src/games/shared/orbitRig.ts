import * as THREE from "three";

const DEG = Math.PI / 180;
const MIN_ELEVATION = 20 * DEG;
const MAX_ELEVATION = 85 * DEG;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 1.5;
const EASE = 0.12;

export type ViewPreset = "reset" | "top" | "side" | "left" | "right";

export type RigConfig = {
  /** The point the camera looks at. */
  target: THREE.Vector3;
  /** Default distance from the target. */
  distance: number;
  /** Default angle above the ground, in degrees. */
  elevationDeg: number;
};

/**
 * A camera that orbits a target. Gestures change its goals; `update()` eases the real camera towards them each frame.
 * Yaw 0 puts the camera on the +z side (white's seat); the seat's own yaw (`setBaseYaw`) and the player's chosen angle
 * (`yawOffset`) are kept separate, so pass-and-play can turn the board round without losing the player's view.
 * Pure three.js, no Phaser, so it runs in Node tests.
 */
export class OrbitRig {
  private baseYaw = 0;
  private offset = 0;
  private elev: number;
  private dist: number;
  private curYaw = 0;
  private curElev: number;
  private curDist: number;
  private readonly defElev: number;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly cfg: RigConfig
  ) {
    this.defElev = cfg.elevationDeg * DEG;
    this.elev = this.curElev = this.defElev;
    this.dist = this.curDist = cfg.distance;
    this.place();
  }

  /** The player's chosen angle, relative to their seat, in radians. */
  get yawOffset(): number {
    return this.offset;
  }
  get elevation(): number {
    return this.elev;
  }
  get distance(): number {
    return this.dist;
  }

  /** Turns the seat (0 for white's side, PI for black's). The player's own angle is kept. */
  setBaseYaw(rad: number): void {
    this.baseYaw = rad;
  }

  applyPreset(p: ViewPreset): void {
    this.offset = 0;
    this.elev = this.defElev;
    this.dist = this.cfg.distance;
    if (p === "top") this.elev = 80 * DEG;
    else if (p === "side") {
      this.elev = 30 * DEG;
      this.dist = this.cfg.distance * 0.85;
    } else if (p === "left") this.offset = -40 * DEG;
    else if (p === "right") this.offset = 40 * DEG;
  }

  /** Fingers moved apart (scale above 1) to zoom in, together to zoom out. */
  pinch(scale: number): void {
    if (!(scale > 0) || !Number.isFinite(scale)) return;
    this.dist = clamp(this.dist / scale, this.cfg.distance * MIN_ZOOM, this.cfg.distance * MAX_ZOOM);
  }

  /** Fingers turned by `rad` (clockwise positive): the board turns the same way. */
  twist(rad: number): void {
    if (!Number.isFinite(rad)) return;
    this.offset = clamp(this.offset + rad, -Math.PI, Math.PI);
  }

  /** Raises (positive) or lowers the camera. */
  tilt(rad: number): void {
    if (!Number.isFinite(rad)) return;
    this.elev = clamp(this.elev + rad, MIN_ELEVATION, MAX_ELEVATION);
  }

  /** Call once per frame. */
  update(): void {
    this.curYaw += (this.baseYaw + this.offset - this.curYaw) * EASE;
    this.curElev += (this.elev - this.curElev) * EASE;
    this.curDist += (this.dist - this.curDist) * EASE;
    this.place();
  }

  private place(): void {
    const { target } = this.cfg;
    const flat = Math.cos(this.curElev) * this.curDist;
    this.camera.position.set(
      target.x + Math.sin(this.curYaw) * flat,
      target.y + Math.sin(this.curElev) * this.curDist,
      target.z + Math.cos(this.curYaw) * flat
    );
    this.camera.lookAt(target);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
