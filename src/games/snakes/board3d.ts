import * as THREE from "three";
import { cellPos, LADDERS, SNAKES } from "./rules";

/** World centre of a square (1..100) on the board surface. Row 0 is nearest the camera. */
export function squareWorld(n: number): THREE.Vector3 {
  const [col, row] = cellPos(n);
  return new THREE.Vector3(col - 4.5, 0, 4.5 - row);
}

/** Where tokens wait before their first move: a strip in front of square 1. */
export function startSpot(seat: number): THREE.Vector3 {
  return new THREE.Vector3(-4.9 + seat * 0.62, 0, 5.2);
}

export type SnakesBoard = {
  group: THREE.Group;
  /** Points a token follows to slide down each snake, keyed by head square. */
  snakePath: Map<number, THREE.Vector3[]>;
  /** Points a token follows to climb each ladder, keyed by foot square. */
  ladderPath: Map<number, THREE.Vector3[]>;
};

const SNAKE_COLORS = [0x16a34a, 0xf97316, 0x7c3aed, 0x0ea5e9, 0xdb2777, 0x65a30d, 0xeab308, 0x14b8a6, 0xdc2626, 0x4f46e5];

/** The numbered board drawn once on a canvas: alternating pastel squares with the number in each corner. */
function boardTexture(): THREE.CanvasTexture {
  const S = 1280;
  const cell = S / 10;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d")!;
  for (let n = 1; n <= 100; n++) {
    const [col, row] = cellPos(n);
    const x = col * cell;
    const y = (9 - row) * cell; // canvas y runs downwards, board row 9 is at the top
    const even = (col + row) % 2 === 0;
    ctx.fillStyle = n === 100 ? "#fcd34d" : n === 1 ? "#a7f3d0" : even ? "#fde9a8" : "#c7f0d2";
    ctx.fillRect(x, y, cell, cell);
    ctx.strokeStyle = "rgba(120,70,20,0.35)";
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, cell - 3, cell - 3);
    ctx.fillStyle = "#7c2d12";
    ctx.font = "800 38px system-ui, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText(String(n), x + 10, y + 8);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Diagonal-stripe skin for a snake, repeated along its length. */
function snakeTexture(color: number, length: number): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  const base = new THREE.Color(color);
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = `#${base.clone().multiplyScalar(0.55).getHexString()}`;
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 64, 0);
    ctx.lineTo(i * 64 + 32, 0);
    ctx.lineTo(i * 64 + 48, 64);
    ctx.lineTo(i * 64 + 16, 64);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = `#${base.clone().lerp(new THREE.Color(0xffffff), 0.55).getHexString()}`;
  ctx.fillRect(0, 44, 128, 20); // pale belly stripe along one side
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(Math.max(2, Math.round(length * 1.1)), 1);
  return tex;
}

function buildSnake(head: number, tail: number, color: number): { mesh: THREE.Group; path: THREE.Vector3[] } {
  const H = squareWorld(head);
  const T = squareWorld(tail);
  const d = T.clone().sub(H);
  const L = d.length();
  const side = new THREE.Vector3(-d.z, 0, d.x).normalize();
  const waves = Math.max(1.5, L / 2.4);
  const amp = Math.min(0.95, 0.35 + L * 0.05);
  const pts: THREE.Vector3[] = [];
  const n = Math.max(6, Math.round(L * 1.6));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const sway = Math.sin(t * Math.PI * waves) * amp * Math.min(1, t * 5) * Math.min(1, (1 - t) * 4 + 0.25);
    pts.push(H.clone().addScaledVector(d, t).addScaledVector(side, sway).setY(0.2));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const segs = n * 7;
  const radial = 12;
  const geo = new THREE.TubeGeometry(curve, segs, 0.19, radial, false);

  // Taper the body towards the tail.
  const pos = geo.attributes.position;
  for (let i = 0; i <= segs; i++) {
    const center = curve.getPointAt(i / segs);
    const s = 1 - 0.72 * Math.pow(i / segs, 1.6);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      const v = new THREE.Vector3(pos.getX(k), pos.getY(k), pos.getZ(k));
      v.sub(center).multiplyScalar(s).add(center);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshPhysicalMaterial({ map: snakeTexture(color, L), roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  const body = new THREE.Mesh(geo, mat);
  body.castShadow = true;
  body.receiveShadow = true;
  const group = new THREE.Group();
  group.add(body);

  // Head: a flattened sphere facing away from the body, with eyes and a tongue.
  const tangent = curve.getTangentAt(0).negate();
  const headGroup = new THREE.Group();
  headGroup.position.copy(curve.getPointAt(0));
  headGroup.position.y = 0.22;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.27, 24, 16), mat);
  skull.scale.set(1, 0.8, 1.2);
  skull.castShadow = true;
  headGroup.add(skull);
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const black = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), white);
    eye.position.set(sx * 0.13, 0.11, 0.17);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), black);
    pupil.position.set(sx * 0.14, 0.12, 0.23);
    headGroup.add(eye, pupil);
  }
  const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.26), new THREE.MeshStandardMaterial({ color: 0xe11d48 }));
  tongue.position.set(0, -0.02, 0.42);
  headGroup.add(tongue);
  headGroup.lookAt(headGroup.position.clone().add(tangent));
  group.add(headGroup);

  // Path for a token sliding down: from the head along the body, riding on top of it.
  const path = curve.getPoints(48).map((p) => p.clone().setY(0.42));
  return { mesh: group, path };
}

function buildLadder(foot: number, top: number): { mesh: THREE.Group; path: THREE.Vector3[] } {
  const A = squareWorld(foot).setY(0.12);
  const B = squareWorld(top).setY(0.62);
  const dir = B.clone().sub(A);
  const len = dir.length();
  const flat = new THREE.Vector3(dir.x, 0, dir.z).normalize();
  const across = new THREE.Vector3(-flat.z, 0, flat.x).multiplyScalar(0.2);
  const group = new THREE.Group();
  const rail = new THREE.MeshPhysicalMaterial({ color: 0xb7793a, roughness: 0.5, clearcoat: 0.3 });
  const rung = new THREE.MeshPhysicalMaterial({ color: 0xe6b36d, roughness: 0.5 });

  for (const sign of [-1, 1]) {
    const a = A.clone().addScaledVector(across, sign);
    const b = B.clone().addScaledVector(across, sign);
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, len), rail);
    r.position.copy(a.clone().add(b).multiplyScalar(0.5));
    r.lookAt(b);
    r.castShadow = true;
    group.add(r);
  }
  const steps = Math.max(3, Math.round(len / 0.55));
  for (let i = 1; i < steps; i++) {
    const p = A.clone().addScaledVector(dir, i / steps);
    // Long axis along z, then turned to point across the ladder (from one rail to the other).
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.46), rung);
    r.position.copy(p);
    r.lookAt(p.clone().add(across));
    r.castShadow = true;
    group.add(r);
  }
  // Path for a token climbing: along the centre line, a little above the rungs.
  const path: THREE.Vector3[] = [];
  for (let i = 0; i <= 16; i++) path.push(A.clone().addScaledVector(dir, i / 16).setY(A.y + (B.y - A.y) * (i / 16) + 0.08));
  return { mesh: group, path };
}

/** Builds the board with its snakes and ladders. */
export function buildSnakesBoard(): SnakesBoard {
  const group = new THREE.Group();
  const wood = new THREE.MeshPhysicalMaterial({ color: 0x6b3f1d, roughness: 0.45, clearcoat: 0.4 });
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.5, 11.4), wood);
  plinth.position.y = -0.25;
  plinth.receiveShadow = true;
  plinth.castShadow = true;
  group.add(plinth);
  const top = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshPhysicalMaterial({ map: boardTexture(), roughness: 0.55, clearcoat: 0.2 })
  );
  top.rotation.x = -Math.PI / 2;
  top.position.set(0, 0.004, 0);
  top.receiveShadow = true;
  group.add(top);

  // A little START pad in front of square 1.
  const pad = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.03, 0.8), new THREE.MeshPhysicalMaterial({ color: 0xa7f3d0, roughness: 0.5 }));
  pad.position.set(-3.5, 0.015, 5.2);
  pad.receiveShadow = true;
  group.add(pad);

  const snakePath = new Map<number, THREE.Vector3[]>();
  const ladderPath = new Map<number, THREE.Vector3[]>();
  Object.entries(LADDERS).forEach(([foot, topSq]) => {
    const l = buildLadder(Number(foot), topSq);
    group.add(l.mesh);
    ladderPath.set(Number(foot), l.path);
  });
  Object.entries(SNAKES).forEach(([head, tail], i) => {
    const s = buildSnake(Number(head), tail, SNAKE_COLORS[i % SNAKE_COLORS.length]);
    group.add(s.mesh);
    snakePath.set(Number(head), s.path);
  });

  return { group, snakePath, ladderPath };
}
