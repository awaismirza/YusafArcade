/** Short 3D effects for the board games: bursts, pulsing rings and falling confetti. Each removes itself when done. */
import * as THREE from "three";

/** What these effects need from the scene's animation queue (matches AnimQueue.add). */
export type Fx = { add(now: number, a: { delay?: number; dur: number; update: (p: number) => void; done?: () => void }): void };

/** A burst of little coloured spheres that fly up, fall and fade. */
export function burst3d(scene: THREE.Scene, fx: Fx, now: number, at: THREE.Vector3, opts: { count?: number; colors?: number[]; speed?: number; up?: number; dur?: number } = {}): void {
  const count = opts.count ?? 22;
  const palette = opts.colors ?? [0xffffff, 0xfacc15, 0xff7ab8, 0x60a5fa];
  const speed = opts.speed ?? 1;
  const up = opts.up ?? 1;
  const dur = opts.dur ?? 1100;
  const geo = new THREE.SphereGeometry(0.07, 8, 6);
  const bits = Array.from({ length: count }, (_, i) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: palette[i % palette.length], transparent: true }));
    const a = Math.random() * Math.PI * 2;
    const sp = (1.2 + Math.random() * 1.8) * speed;
    m.position.copy(at);
    m.visible = false; // shown when the burst starts, which may be a moment later
    scene.add(m);
    return { m, v: new THREE.Vector3(Math.cos(a) * sp, (2.6 + Math.random() * 2) * up, Math.sin(a) * sp) };
  });
  let cleaned = false;
  fx.add(now, {
    dur,
    update: (p) => {
      const t = p * (dur / 1000);
      for (const { m, v } of bits) {
        m.visible = true;
        m.position.set(at.x + v.x * t, Math.max(at.y, at.y + v.y * t - 4.9 * t * t), at.z + v.z * t);
        (m.material as THREE.MeshBasicMaterial).opacity = 1 - p;
        m.scale.setScalar(1 - 0.5 * p);
      }
    },
    done: () => {
      if (cleaned) return;
      cleaned = true;
      for (const { m } of bits) {
        scene.remove(m);
        (m.material as THREE.Material).dispose();
      }
      geo.dispose();
    },
  });
}

/** A ring that spreads out and fades. With `repeat`, several pulses run one after another. */
export function ringPulse3d(scene: THREE.Scene, fx: Fx, now: number, at: THREE.Vector3, color: number, opts: { radius?: number; dur?: number; repeat?: number } = {}): void {
  const dur = opts.dur ?? 520;
  const radius = opts.radius ?? 0.5;
  for (let k = 0; k < (opts.repeat ?? 1); k++) {
    let ring: THREE.Mesh | null = null;
    let cleaned = false;
    const make = (): THREE.Mesh => {
      const r = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.06, 10, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
      r.rotation.x = Math.PI / 2;
      r.position.set(at.x, at.y + 0.08, at.z);
      scene.add(r);
      return r;
    };
    // The first ring appears straight away; later ones when their turn starts.
    if (k === 0) ring = make();
    fx.add(now, {
      delay: k * dur,
      dur,
      update: (p) => {
        if (cleaned) return;
        if (!ring) ring = make();
        ring.scale.setScalar(0.5 + 1.9 * p);
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - p);
      },
      done: () => {
        if (cleaned) return;
        cleaned = true;
        if (!ring) return;
        scene.remove(ring);
        ring.geometry.dispose();
        (ring.material as THREE.Material).dispose();
      },
    });
  }
}

/** 80 confetti pieces drifting down over the board for a win. */
export function confettiRain3d(scene: THREE.Scene, fx: Fx, now: number, center: THREE.Vector3, colors: number[]): void {
  const geo = new THREE.PlaneGeometry(0.22, 0.12);
  const dur = 2200;
  const bits = Array.from({ length: 80 }, (_, i) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide, transparent: true }));
    const start = new THREE.Vector3(center.x + (Math.random() - 0.5) * 8, center.y + 6 + Math.random() * 3, center.z + (Math.random() - 0.5) * 8);
    m.position.copy(start);
    scene.add(m);
    return { m, start, fall: 4 + Math.random() * 3, drift: (Math.random() - 0.5) * 1.5, spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8) };
  });
  let cleaned = false;
  fx.add(now, {
    dur,
    update: (p) => {
      const t = p * (dur / 1000);
      for (const b of bits) {
        b.m.position.set(b.start.x + Math.sin(t * 3 + b.drift) * 0.4 + b.drift * t, Math.max(center.y + 0.05, b.start.y - b.fall * t), b.start.z);
        b.m.rotation.set(b.spin.x * t, b.spin.y * t, b.spin.z * t);
        (b.m.material as THREE.MeshBasicMaterial).opacity = p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25;
      }
    },
    done: () => {
      if (cleaned) return;
      cleaned = true;
      for (const b of bits) {
        scene.remove(b.m);
        (b.m.material as THREE.Material).dispose();
      }
      geo.dispose();
    },
  });
}
