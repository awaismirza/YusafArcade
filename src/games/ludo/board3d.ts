import * as THREE from "three";
import { COLOR_HEX, HOME_COLUMN, SAFE_INDEX, START_INDEX, TRACK } from "./rules";

/** World position of a grid cell centre. The 15 × 15 board is centred on the origin. */
export const wx = (col: number): number => col - 7;
export const wz = (row: number): number => row - 7;
/** Height of the playing surface. Tokens stand here. */
export const SURFACE_Y = 0.13;

const PALE = [0xf8a5a5, 0x9be2b0, 0xfbe18a, 0xa8c6f8];

function tile(w: number, d: number, h: number, color: number, x: number, y: number, z: number, rough = 0.5): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshPhysicalMaterial({ color, roughness: rough, clearcoat: 0.25 }));
  m.position.set(x, y, z);
  m.receiveShadow = true;
  return m;
}

function starGeometry(outer: number, inner: number): THREE.ShapeGeometry {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  const g = new THREE.ShapeGeometry(s);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** Builds the whole Ludo board: wooden base, cream surface, track, home columns, yards, safe stars and the centre. */
export function buildLudoBoard(): THREE.Group {
  const board = new THREE.Group();

  // Base and surface.
  const base = tile(15.9, 15.9, 0.5, 0x5a3a1e, 0, -0.25, 0, 0.45);
  base.castShadow = true;
  board.add(base);
  board.add(tile(15.3, 15.3, 0.1, 0xf4ecd8, 0, 0.05, 0));

  // Yards: a coloured slab, a pale inner square and four rings where the tokens wait.
  const yardOrigins: [number, number][] = [[2.5, 2.5], [11.5, 2.5], [11.5, 11.5], [2.5, 11.5]];
  yardOrigins.forEach(([cc, rr], c) => {
    const x = wx(cc);
    const z = wz(rr);
    board.add(tile(6, 6, 0.06, COLOR_HEX[c], x, 0.13, z, 0.4));
    board.add(tile(4.4, 4.4, 0.05, 0xfffaf0, x, 0.165, z, 0.6));
    const slots = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (const [sx, sz] of slots) {
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 0.03, 36),
        new THREE.MeshPhysicalMaterial({ color: PALE[c], roughness: 0.4 })
      );
      ring.position.set(x + sx, 0.205, z + sz);
      ring.receiveShadow = true;
      board.add(ring);
    }
  });

  // Track squares (white), with each colour's start square tinted.
  const startOf = new Map<number, number>();
  START_INDEX.forEach((idx, c) => startOf.set(idx, c));
  TRACK.forEach(([col, row], i) => {
    const c = startOf.get(i);
    board.add(tile(1, 1, 0.04, 0xb8ae98, wx(col), 0.12, wz(row)));
    board.add(tile(0.9, 0.9, 0.05, c !== undefined ? COLOR_HEX[c] : 0xfffaf0, wx(col), 0.125, wz(row)));
  });

  // Home columns, tinted in each colour.
  HOME_COLUMN.forEach((cells, c) => {
    for (const [col, row] of cells) {
      board.add(tile(1, 1, 0.04, 0xb8ae98, wx(col), 0.12, wz(row)));
      board.add(tile(0.9, 0.9, 0.05, COLOR_HEX[c], wx(col), 0.125, wz(row)));
    }
  });

  // Stars on the safe squares that are not start squares.
  const starGeo = starGeometry(0.34, 0.15);
  const starMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
  SAFE_INDEX.forEach((idx) => {
    if (startOf.has(idx)) return;
    const [col, row] = TRACK[idx];
    const star = new THREE.Mesh(starGeo, starMat);
    star.position.set(wx(col), 0.155, wz(row));
    board.add(star);
  });

  // Centre: four coloured triangles meeting in the middle.
  const tri = (a: [number, number], b: [number, number], c: [number, number], color: number): void => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([a[0], 0.135, a[1], b[0], 0.135, b[1], c[0], 0.135, c[1]], 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, clearcoat: 0.3, side: THREE.DoubleSide }));
    m.receiveShadow = true;
    board.add(m);
  };
  tri([-1.5, -1.5], [-1.5, 1.5], [0, 0], COLOR_HEX[0]); // red, left
  tri([-1.5, -1.5], [1.5, -1.5], [0, 0], COLOR_HEX[1]); // green, top
  tri([1.5, -1.5], [1.5, 1.5], [0, 0], COLOR_HEX[2]); // yellow, right
  tri([-1.5, 1.5], [1.5, 1.5], [0, 0], COLOR_HEX[3]); // blue, bottom

  return board;
}
