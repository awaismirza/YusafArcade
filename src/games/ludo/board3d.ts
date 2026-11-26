import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { COLOR_HEX, HOME_COLUMN, SAFE_INDEX, START_INDEX, TRACK } from "./rules";

/** World position of a grid cell centre. The 15 × 15 board is centred on the origin. */
export const wx = (col: number): number => col - 7;
export const wz = (row: number): number => row - 7;

/** Heights (world y) of the board's layers. Tokens and dice stand on these. */
export const FIELD_Y = 0.1;
/** Top of the track and home-column tiles; a token on the track stands just above it. */
export const SURFACE_Y = 0.3;
/** Top of the token nests in the yards. */
export const YARD_Y = 0.59;
/** Top of the raised centre wedges; tokens that finish stand here. */
export const HOME_Y = 0.34;
/** Height at which dice rest (on the centre wedges). */
export const DICE_Y = 0.33;

const PALE = [0xf8a5a5, 0x9be2b0, 0xfbe18a, 0xa8c6f8];
const materials = new Map<string, THREE.MeshPhysicalMaterial>();

function mat(color: number, roughness = 0.42, clearcoat = 0.35): THREE.MeshPhysicalMaterial {
  const key = `${color}-${roughness}-${clearcoat}`;
  let m = materials.get(key);
  if (!m) {
    m = new THREE.MeshPhysicalMaterial({ color, roughness, clearcoat, clearcoatRoughness: 0.3 });
    materials.set(key, m);
  }
  return m;
}

function rounded(w: number, h: number, d: number, radius: number, color: number, x: number, y: number, z: number, cast = false): THREE.Mesh {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, radius), mat(color));
  m.position.set(x, y, z);
  m.receiveShadow = true;
  m.castShadow = cast;
  return m;
}

function starGeometry(outer: number, inner: number): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.03, bevelSegments: 2 });
  g.rotateX(-Math.PI / 2);
  return g;
}

/**
 * Builds the whole Ludo board with real relief: a wooden base with a bevelled frame, raised rounded track tiles,
 * chunky yard trays with dished token nests, embossed gold stars on the safe squares, and raised bevelled wedges in
 * the centre.
 */
export function buildLudoBoard(): THREE.Group {
  const board = new THREE.Group();

  // Wooden base, frame and the cream playing field.
  const base = new THREE.Mesh(new RoundedBoxGeometry(15.9, 0.5, 15.9, 3, 0.12), mat(0x5a3a1e, 0.45));
  base.position.y = -0.25;
  base.castShadow = true;
  base.receiveShadow = true;
  board.add(base);
  for (const [w, d, x, z] of [[15.9, 0.45, 0, 7.725], [15.9, 0.45, 0, -7.725], [0.45, 15.0, 7.725, 0], [0.45, 15.0, -7.725, 0]] as const) {
    board.add(rounded(w, 0.56, d, 0.14, 0x8a5a2c, x, 0.28, z, true));
  }
  const field = new THREE.Mesh(new THREE.BoxGeometry(15.1, 0.1, 15.1), mat(0xf6efe0, 0.55));
  field.position.y = 0.05;
  field.receiveShadow = true;
  board.add(field);

  // Yards: a coloured tray, a pale plate, and four dished nests where tokens wait.
  const yardCentres: [number, number][] = [[2.5, 2.5], [11.5, 2.5], [11.5, 11.5], [2.5, 11.5]];
  yardCentres.forEach(([cc, rr], c) => {
    const x = wx(cc);
    const z = wz(rr);
    board.add(rounded(6, 0.42, 6, 0.3, COLOR_HEX[c], x, FIELD_Y + 0.21, z, true));
    board.add(rounded(4.4, 0.08, 4.4, 0.2, 0xfffaf0, x, 0.52, z));
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const nest = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.44, 0.05, 40), mat(PALE[c], 0.4));
      nest.position.set(x + sx, 0.56, z + sz);
      nest.receiveShadow = true;
      board.add(nest);
    }
  });

  // Track and home-column tiles share one rounded geometry.
  const tileGeo = new RoundedBoxGeometry(0.92, 0.2, 0.92, 3, 0.05);
  const startOf = new Map<number, number>();
  START_INDEX.forEach((idx, c) => startOf.set(idx, c));
  const addTile = (col: number, row: number, color: number): void => {
    const t = new THREE.Mesh(tileGeo, mat(color));
    t.position.set(wx(col), FIELD_Y + 0.1, wz(row));
    t.receiveShadow = true;
    t.castShadow = true;
    board.add(t);
  };
  TRACK.forEach(([col, row], i) => {
    const c = startOf.get(i);
    addTile(col, row, c !== undefined ? COLOR_HEX[c] : 0xfffaf0);
  });
  HOME_COLUMN.forEach((cells, c) => cells.forEach(([col, row]) => addTile(col, row, COLOR_HEX[c])));

  // Embossed gold stars on the safe squares that are not start squares.
  const starGeo = starGeometry(0.32, 0.14);
  const starMat = new THREE.MeshPhysicalMaterial({ color: 0xf5b301, roughness: 0.3, metalness: 0.6, clearcoat: 0.5 });
  SAFE_INDEX.forEach((idx) => {
    if (startOf.has(idx)) return;
    const [col, row] = TRACK[idx];
    const star = new THREE.Mesh(starGeo, starMat);
    star.position.set(wx(col), SURFACE_Y - 0.03, wz(row));
    star.castShadow = true;
    board.add(star);
  });

  // Centre: four raised, bevelled wedges meeting in the middle. Dice and finished tokens rest on top.
  const wedge = (a: [number, number], b: [number, number], c: [number, number], color: number): void => {
    // The shape lies in x-y and is turned flat, which maps shape y to -z.
    const s = new THREE.Shape([new THREE.Vector2(a[0], -a[1]), new THREE.Vector2(b[0], -b[1]), new THREE.Vector2(c[0], -c[1])]);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.03, bevelSegments: 2 });
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, mat(color, 0.4, 0.4));
    m.position.y = FIELD_Y;
    m.receiveShadow = true;
    m.castShadow = true;
    board.add(m);
  };
  wedge([-1.46, -1.46], [-1.46, 1.46], [-0.04, 0], COLOR_HEX[0]); // red, left
  wedge([-1.46, -1.46], [1.46, -1.46], [0, -0.04], COLOR_HEX[1]); // green, top
  wedge([1.46, -1.46], [1.46, 1.46], [0.04, 0], COLOR_HEX[2]); // yellow, right
  wedge([-1.46, 1.46], [1.46, 1.46], [0, 0.04], COLOR_HEX[3]); // blue, bottom

  return board;
}
