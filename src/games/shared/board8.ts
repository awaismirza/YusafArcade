import * as THREE from "three";

/** World coordinates for an 8×8 board centred on the origin. Row 0 is far from the near player, column 0 is on the left. */
export const cellX = (col: number): number => col - 3.5;
export const cellZ = (row: number): number => row - 3.5;
/** Height of the playing surface. Pieces stand here. */
export const TOP_Y = 0.1;

export type BoardColors = { light: number; dark: number; plinth: number };

/** A wooden plinth and 64 square tiles. The tiles carry `userData.square` (row * 8 + column) so they can be tapped. */
export function buildBoard8(colors: BoardColors): { group: THREE.Group; squares: THREE.Mesh[] } {
  const group = new THREE.Group();
  const wood = new THREE.MeshPhysicalMaterial({ color: colors.plinth, roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.3 });
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(9.3, 0.5, 9.3), wood);
  plinth.position.y = -0.25;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  const lightMat = new THREE.MeshPhysicalMaterial({ color: colors.light, roughness: 0.42, clearcoat: 0.3 });
  const darkMat = new THREE.MeshPhysicalMaterial({ color: colors.dark, roughness: 0.42, clearcoat: 0.3 });
  const geo = new THREE.BoxGeometry(1, 0.1, 1);
  const squares: THREE.Mesh[] = [];
  for (let i = 0; i < 64; i++) {
    const row = i >> 3;
    const col = i & 7;
    const dark = (row + col) % 2 === 1;
    const sq = new THREE.Mesh(geo, dark ? darkMat : lightMat);
    sq.position.set(cellX(col), 0.05, cellZ(row));
    sq.receiveShadow = true;
    sq.userData.square = i;
    group.add(sq);
    squares.push(sq);
  }
  return { group, squares };
}

/** Flat highlights drawn just above the squares: tiles, move dots and capture rings. */
export class Markers8 {
  readonly group = new THREE.Group();
  private readonly box = new THREE.BoxGeometry(0.96, 0.02, 0.96);
  private readonly dotGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.04, 28);
  private readonly ringGeo = new THREE.TorusGeometry(0.4, 0.07, 12, 32);

  clear(): void {
    this.group.clear();
  }

  tile(row: number, col: number, color: number, opacity: number): void {
    const m = new THREE.Mesh(this.box, new THREE.MeshBasicMaterial({ color, transparent: true, opacity }));
    m.position.set(cellX(col), TOP_Y + 0.02, cellZ(row));
    this.group.add(m);
  }

  dot(row: number, col: number): void {
    const m = new THREE.Mesh(this.dotGeo, new THREE.MeshBasicMaterial({ color: 0x22c55e }));
    m.position.set(cellX(col), TOP_Y + 0.03, cellZ(row));
    this.group.add(m);
  }

  ring(row: number, col: number, color = 0xef4444): void {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color }));
    m.rotation.x = Math.PI / 2;
    m.position.set(cellX(col), TOP_Y + 0.06, cellZ(row));
    this.group.add(m);
  }

  /** Gentle pulse so markers read as "live". */
  pulse(time: number): void {
    this.group.children.forEach((m, idx) => {
      const s = 1 + Math.sin(time / 180 + idx) * 0.03;
      m.scale.set(s, 1, s);
    });
  }
}

/**
 * Camera that fills the screen with the board and, in pass-and-play, glides round to the other side so the
 * player about to move sees their own pieces at the bottom.
 */
export class BoardCamera {
  flipped = false;
  private readonly goal = new THREE.Vector3();

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly height = 11.4,
    private readonly dist = 9.4
  ) {
    this.camera.position.set(0, height, dist);
    this.camera.lookAt(0, 0, 0.35);
  }

  update(): void {
    this.goal.set(0, this.height, this.flipped ? -this.dist : this.dist);
    this.camera.position.lerp(this.goal, 0.09);
    this.camera.lookAt(0, 0, this.flipped ? -0.35 : 0.35);
  }
}
