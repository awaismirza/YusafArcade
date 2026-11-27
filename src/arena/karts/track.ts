/**
 * Turbo Karts tracks: closed centre lines (smooth curves through control points). Pure: no three.js, no DOM.
 * Coordinates are on the ground plane: x to the right, z towards the viewer.
 */

export type TrackDef = {
  name: string;
  theme: "grass" | "desert" | "snow";
  width: number;
  /** Control points of the centre line, in driving order. */
  points: [number, number][];
  /** Boost pads and item-box rows, as fractions of a lap (0..1). */
  boosts: number[];
  items: number[];
};

export type Track = TrackDef & {
  /** Evenly spaced samples along the centre line. */
  xs: Float64Array;
  zs: Float64Array;
  /** Unit direction of travel at each sample. */
  dx: Float64Array;
  dz: Float64Array;
  /** Distance along the line at each sample, and the full lap length. */
  s: Float64Array;
  length: number;
  n: number;
};

export const TRACKS: TrackDef[] = [
  {
    name: "Sunny Circuit",
    theme: "grass",
    width: 9,
    points: [[0, 30], [-30, 28], [-48, 12], [-46, -14], [-26, -30], [-4, -22], [8, -6], [26, -18], [44, -24], [56, -6], [50, 20], [26, 32]],
    boosts: [0.08, 0.55],
    items: [0.2, 0.7],
  },
  {
    name: "Desert Dash",
    theme: "desert",
    width: 8.5,
    points: [[0, 34], [-36, 34], [-56, 18], [-52, -6], [-30, -8], [-18, -28], [6, -40], [30, -30], [36, -8], [22, 4], [44, 14], [52, 30], [30, 40]],
    boosts: [0.05, 0.45, 0.8],
    items: [0.25, 0.62],
  },
  {
    name: "Snowy Peaks",
    theme: "snow",
    width: 9,
    points: [[0, 26], [-34, 30], [-50, 8], [-38, -18], [-12, -14], [0, -34], [26, -40], [48, -22], [44, 0], [22, 2], [14, 14], [34, 22], [22, 36]],
    boosts: [0.15, 0.6],
    items: [0.33, 0.85],
  },
];

/** Point on a closed Catmull-Rom curve through pts, segment i, 0 <= t < 1. */
function catmull(pts: [number, number][], i: number, t: number): [number, number] {
  const n = pts.length;
  const p0 = pts[(i - 1 + n) % n];
  const p1 = pts[i % n];
  const p2 = pts[(i + 1) % n];
  const p3 = pts[(i + 2) % n];
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number): number => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
}

/** Samples a track every ~1 unit along its centre line. */
export const TRACK_SCALE = 1.6;

export function buildTrack(def: TrackDef): Track {
  const fine: [number, number][] = [];
  const per = 60;
  const pts = def.points.map(([x, z]) => [x * TRACK_SCALE, z * TRACK_SCALE] as [number, number]);
  for (let i = 0; i < pts.length; i++) for (let k = 0; k < per; k++) fine.push(catmull(pts, i, k / per));
  const cum = [0];
  for (let i = 1; i <= fine.length; i++) {
    const a = fine[i - 1];
    const b = fine[i % fine.length];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const length = cum[fine.length];
  const n = Math.round(length);
  const xs = new Float64Array(n);
  const zs = new Float64Array(n);
  const s = new Float64Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const target = (i / n) * length;
    while (cum[j + 1] < target) j++;
    const f = (target - cum[j]) / (cum[j + 1] - cum[j] || 1);
    const a = fine[j];
    const b = fine[(j + 1) % fine.length];
    xs[i] = a[0] + (b[0] - a[0]) * f;
    zs[i] = a[1] + (b[1] - a[1]) * f;
    s[i] = target;
  }
  const dx = new Float64Array(n);
  const dz = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const nx = xs[(i + 1) % n] - xs[(i - 1 + n) % n];
    const nz = zs[(i + 1) % n] - zs[(i - 1 + n) % n];
    const l = Math.hypot(nx, nz) || 1;
    dx[i] = nx / l;
    dz[i] = nz / l;
  }
  return { ...def, xs, zs, dx, dz, s, length, n };
}

/**
 * Where a point is relative to the track: the nearest sample, distance along the lap, and the signed sideways
 * offset (positive to the right of the driving direction). Pass the previous index as a hint to search nearby.
 */
export function locate(t: Track, x: number, z: number, hint = -1): { i: number; s: number; side: number } {
  let best = 0;
  let bd = Infinity;
  const scan = (from: number, to: number): void => {
    for (let k = from; k <= to; k++) {
      const i = ((k % t.n) + t.n) % t.n;
      const d = (t.xs[i] - x) ** 2 + (t.zs[i] - z) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
  };
  if (hint >= 0) {
    scan(hint - 25, hint + 25);
    if (bd > (t.width * 1.5) ** 2) scan(0, t.n - 1);
  } else scan(0, t.n - 1);
  // right-hand normal of (dx, dz) on the ground plane is (-dz, dx)
  const side = (x - t.xs[best]) * -t.dz[best] + (z - t.zs[best]) * t.dx[best];
  return { i: best, s: t.s[best], side };
}

/** Sample index at a distance along the lap. */
export const indexAt = (t: Track, dist: number): number => ((Math.round((dist / t.length) * t.n) % t.n) + t.n) % t.n;

/**
 * Lap counting from successive positions along the lap: crossing the line forwards adds a lap, backwards takes
 * one off. Returns the new lap number.
 */
export function updateLap(lap: number, prevS: number, s: number, length: number): number {
  const d = s - prevS;
  if (d < -length / 2) return lap + 1;
  if (d > length / 2) return lap - 1;
  return lap;
}
