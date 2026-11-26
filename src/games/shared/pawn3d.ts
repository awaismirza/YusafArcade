import * as THREE from "three";

/** Turned pawn profile (radius, height), about 1 unit tall at scale 1. */
const PAWN_PROFILE: [number, number][] = [
  [0, 0], [0.3, 0], [0.34, 0.07], [0.22, 0.15], [0.15, 0.3], [0.19, 0.46], [0.11, 0.56], [0.24, 0.66], [0.24, 0.72], [0.13, 0.78], [0, 0.8],
];

const geometryCache = new Map<string, THREE.BufferGeometry>();

function pawnGeometry(): THREE.BufferGeometry {
  let g = geometryCache.get("pawn");
  if (!g) {
    g = new THREE.LatheGeometry(PAWN_PROFILE.map(([x, y]) => new THREE.Vector2(x, y)), 36);
    geometryCache.set("pawn", g);
  }
  return g;
}

/** A glossy coloured pawn: turned base and body with a round head. Origin sits on the ground. */
export function buildPawn(color: number, scale = 1): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, clearcoat: 0.85, clearcoatRoughness: 0.15 });
  const body = new THREE.Mesh(pawnGeometry(), mat);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 16), mat);
  head.position.y = 0.88;
  head.castShadow = true;
  group.add(head);
  group.scale.setScalar(scale);
  return group;
}
