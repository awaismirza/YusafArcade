/**
 * Procedural 3D chess pieces in a Staunton style. Pure three.js geometry, no textures and no DOM, so it runs in Node tests.
 *
 * Every piece stands on y = 0 with its footprint centred on x = z = 0. Scale is baked into the geometry (group.scale stays 1)
 * so scene animations may scale the group freely. Geometry is cached and shared between pieces (white and black share all
 * turned shapes; knights keep one geometry per colour because they face opposite ways).
 */
import * as THREE from "three";
import type { Piece } from "./rules";

/** Pieces are drawn this much bigger than the 1-unit square-based design sizes below. */
export const PIECE_SCALE = 1.12;

export const CHESS_PALETTE = {
  /** Warm off-white that still shades. */
  ivory: 0xf1e6cf,
  /** Deep brown-black with a warm sheen. */
  ebony: 0x221d1a,
  lightSquare: 0xd2ab78,
  darkSquare: 0x7a4a2b,
  plinth: 0x4a2c14,
  outline: 0x4a3626,
};

export type ChessMaterials = {
  white: THREE.Material;
  black: THREE.Material;
  outline: THREE.Material;
  shadow: THREE.Material;
};

export function makeChessMaterials(): ChessMaterials {
  return {
    white: new THREE.MeshPhysicalMaterial({ color: CHESS_PALETTE.ivory, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.28 }),
    black: new THREE.MeshPhysicalMaterial({
      color: CHESS_PALETTE.ebony,
      roughness: 0.32,
      clearcoat: 0.8,
      clearcoatRoughness: 0.2,
      sheen: 0.7,
      sheenColor: new THREE.Color(0x7a5a42),
      sheenRoughness: 0.5,
    }),
    outline: new THREE.MeshBasicMaterial({ color: CHESS_PALETTE.outline, side: THREE.BackSide }),
    shadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.12, depthWrite: false }),
  };
}

const DETAIL_DARK = new THREE.MeshStandardMaterial({ color: 0x1b120a, roughness: 0.4 });
const DETAIL_LIGHT = new THREE.MeshStandardMaterial({ color: 0xeadfc6, roughness: 0.4 });

type Part = {
  geo: THREE.BufferGeometry;
  pos?: [number, number, number];
  rot?: [number, number, number];
  /** Eyes and slits: drawn in a contrasting colour, not outlined, no shadow. */
  detail?: boolean;
};

const S = PIECE_SCALE;
const cache = new Map<string, Part[]>();

/** A turned (lathe) shape from (radius, height) points, scaled. */
function lathe(pts: [number, number][], segments = 40): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segments);
  g.scale(S, S, S);
  return g;
}

/** Points along the upper part of a ball of radius r centred at height cy, from `fromDeg` up to the pole. */
function ball(cy: number, r: number, fromDeg: number): [number, number][] {
  const out: [number, number][] = [];
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const a = ((fromDeg + ((90 - fromDeg) * i) / n) * Math.PI) / 180;
    out.push([i === n ? 0 : r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

const BASE: [number, number][] = [[0, 0], [0.36, 0], [0.385, 0.03], [0.385, 0.075], [0.34, 0.115], [0.3, 0.15]];

function box(w: number, h: number, d: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.scale(S, S, S);
  return g;
}

function at(x: number, y: number, z: number): [number, number, number] {
  return [x * S, y * S, z * S];
}

function pawn(): Part[] {
  return [
    {
      geo: lathe([
        ...BASE, [0.24, 0.2], [0.17, 0.3], [0.135, 0.42], [0.14, 0.5], [0.23, 0.53], [0.235, 0.57], [0.17, 0.6], [0.13, 0.64],
        ...ball(0.78, 0.17, -50),
      ]),
    },
  ];
}

function rook(): Part[] {
  const parts: Part[] = [
    { geo: lathe([...BASE, [0.26, 0.2], [0.24, 0.28], [0.225, 0.9], [0.3, 0.95], [0.32, 1.0], [0.32, 1.04], [0.26, 1.04], [0, 1.04]]) },
  ];
  const merlon = box(0.14, 0.12, 0.13);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    parts.push({ geo: merlon, pos: at(Math.cos(a) * 0.265, 1.1, Math.sin(a) * 0.265), rot: [0, -a, 0] });
  }
  return parts;
}

function bishop(): Part[] {
  return [
    {
      geo: lathe([
        ...BASE, [0.22, 0.2], [0.16, 0.3], [0.125, 0.55], [0.13, 0.64], [0.25, 0.68], [0.26, 0.72], [0.2, 0.76], [0.14, 0.8],
        [0.19, 0.86], [0.25, 1.0], [0.24, 1.12], [0.19, 1.24], [0.11, 1.34], [0.07, 1.36], [0.075, 1.4], [0.04, 1.45], [0, 1.46],
      ]),
    },
    // the mitre slit: a thin tilted notch across the front
    { geo: box(0.035, 0.3, 0.12), pos: at(0, 1.1, 0.2), rot: [0, 0, 0.55], detail: true },
  ];
}

/** Shared lower body of the queen and king: stem, collar and the flare into the crown. */
const ROYAL_LOWER: [number, number][] = [
  ...BASE, [0.24, 0.2], [0.17, 0.32], [0.14, 0.6], [0.15, 0.7], [0.28, 0.74], [0.29, 0.79], [0.2, 0.84], [0.16, 0.9], [0.22, 1.05], [0.3, 1.25],
];

function queen(): Part[] {
  const parts: Part[] = [
    { geo: lathe([...ROYAL_LOWER, [0.33, 1.4], [0.34, 1.45], [0.28, 1.47], [0.1, 1.44], [0, 1.44]]) },
    { geo: new THREE.SphereGeometry(0.11 * S, 20, 14), pos: at(0, 1.52, 0) },
  ];
  const point = new THREE.ConeGeometry(0.055 * S, 0.2 * S, 10);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    parts.push({ geo: point, pos: at(Math.cos(a) * 0.3, 1.57, Math.sin(a) * 0.3) });
  }
  return parts;
}

function king(): Part[] {
  return [
    { geo: lathe([...ROYAL_LOWER, [0.33, 1.42], [0.31, 1.52], [0.2, 1.6], [0.1, 1.64], [0, 1.65]]) },
    { geo: box(0.09, 0.34, 0.09), pos: at(0, 1.8, 0) },
    { geo: box(0.26, 0.09, 0.09), pos: at(0, 1.82, 0) },
  ];
}

/** Rounds the corners of a closed outline by cutting each corner at a quarter of each edge. */
function chaikin(points: THREE.Vector2[]): THREE.Vector2[] {
  const out: THREE.Vector2[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    out.push(a.clone().lerp(b, 0.25), a.clone().lerp(b, 0.75));
  }
  return out;
}

/** Side outline of the knight's head and neck, facing +x. */
const KNIGHT_HEAD: [number, number][] = [
  [-0.3, 0.22], [0.3, 0.22], [0.32, 0.42], [0.3, 0.62], [0.16, 0.8], [0.2, 0.96], [0.4, 0.98], [0.43, 1.08], [0.4, 1.16], [0.26, 1.3],
  [0.26, 1.5], [0.12, 1.34], [0.02, 1.4], [-0.04, 1.26], [-0.08, 1.3], [-0.12, 1.14], [-0.16, 1.18], [-0.2, 1.0], [-0.24, 1.04],
  [-0.3, 0.84], [-0.34, 0.86], [-0.34, 0.5],
];
const KNIGHT_SCALE = 0.82;

function knight(color: "w" | "b"): Part[] {
  const shape = new THREE.Shape(chaikin(KNIGHT_HEAD.map(([x, y]) => new THREE.Vector2(x, y))));
  const head = new THREE.ExtrudeGeometry(shape, { depth: 0.36, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 2, curveSegments: 4 });
  head.translate(0, 0, -0.18);
  head.scale(KNIGHT_SCALE, KNIGHT_SCALE, 1);
  // Knights look towards the opponent (white towards -z, black towards +z) and a quarter-turn to the side, so the
  // horse's profile shows from the player's seat. rotateY(+45deg) turns +x into (+x, -z).
  const turn = color === "w" ? Math.PI / 4 : -Math.PI / 4;
  head.rotateY(turn);
  head.scale(S, S, S);

  const base = lathe([...BASE, [0.27, 0.2], [0.27, 0.27], [0, 0.27]]);
  const parts: Part[] = [{ geo: base }, { geo: head }];

  // Eyes, one each side of the head.
  const eye = new THREE.SphereGeometry(0.035 * S, 12, 10);
  for (const side of [-1, 1]) {
    const v = new THREE.Vector3(0.27 * KNIGHT_SCALE, 1.12 * KNIGHT_SCALE, side * 0.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), turn);
    parts.push({ geo: eye, pos: [v.x * S, v.y * S, v.z * S], detail: true });
  }
  return parts;
}

function partsFor(p: Piece): Part[] {
  const key = p.t === "n" ? `n-${p.c}` : p.t;
  let parts = cache.get(key);
  if (!parts) {
    parts = p.t === "p" ? pawn() : p.t === "r" ? rook() : p.t === "b" ? bishop() : p.t === "q" ? queen() : p.t === "k" ? king() : knight(p.c);
    cache.set(key, parts);
  }
  return parts;
}

const OUTLINE_SCALE = new THREE.Vector3(1.032, 1.012, 1.032);
const SHADOW_GEO = [0.62, 0.5, 0.4].map((r) => new THREE.CircleGeometry(r, 28));

/** A piece standing on the square's top surface. Set `userData.pieceSquare` on the returned group when placing it. */
export function buildChessPiece(p: Piece, mats: ChessMaterials): THREE.Group {
  const group = new THREE.Group();
  const bodyMat = p.c === "w" ? mats.white : mats.black;
  const detailMat = p.c === "w" ? DETAIL_DARK : DETAIL_LIGHT;

  for (const part of partsFor(p)) {
    const mesh = new THREE.Mesh(part.geo, part.detail ? detailMat : bodyMat);
    if (part.pos) mesh.position.set(...part.pos);
    if (part.rot) mesh.rotation.set(...part.rot);
    mesh.castShadow = !part.detail;
    mesh.receiveShadow = true;
    mesh.userData.role = "body";
    group.add(mesh);
    if (!part.detail) {
      const outline = new THREE.Mesh(part.geo, mats.outline);
      outline.position.copy(mesh.position);
      outline.rotation.copy(mesh.rotation);
      outline.scale.copy(OUTLINE_SCALE);
      outline.userData.role = "outline";
      outline.raycast = () => undefined;
      group.add(outline);
    }
  }

  // Soft contact shadow: three stacked discs with falling radius build up to a darker centre.
  SHADOW_GEO.forEach((geo, i) => {
    const disc = new THREE.Mesh(geo, mats.shadow);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.004 + i * 0.002;
    disc.renderOrder = 1;
    disc.userData.role = "shadow";
    disc.raycast = () => undefined;
    group.add(disc);
  });
  return group;
}
