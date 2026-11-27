/** Pure maths for two-finger board gestures, plus small helpers shared with start-up code. No Phaser, no DOM. */

/** How much the distance between two fingers grew (above 1) or shrank (below 1). */
export function pinchScale(d0: number, d1: number): number {
  return d0 > 0 ? d1 / d0 : 1;
}

/** Shortest signed turn from angle a0 to angle a1, in radians, within (-PI, PI]. */
export function twistDelta(a0: number, a1: number): number {
  let d = a1 - a0;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** Camera tilt (radians) for a vertical finger movement in game pixels. Dragging up raises the camera. */
export function tiltDelta(dyGamePx: number): number {
  return -dyGamePx * 0.006;
}

/** A touch counts as a tap only if it was quick, stayed put, and no second finger ever joined it. */
export function isTap(t: { downMs: number; upMs: number; moved: number; multi: boolean }): boolean {
  return !t.multi && t.moved <= 14 && t.upMs - t.downMs <= 900;
}

/** Resolves with the promise's value, or with `fallback` if it takes longer than `ms`. */
export function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      }
    );
  });
}
