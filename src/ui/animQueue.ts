/**
 * A tiny time-based animation runner for the 3D scenes. Driven from the Phaser `update(time)` call,
 * so it needs no extra timers and stops cleanly when a scene shuts down.
 */
export type Anim = {
  /** Start time in ms (same clock as Phaser's `time`). */
  t0: number;
  dur: number;
  /** Called every frame with progress 0..1. */
  update: (p: number) => void;
  done?: () => void;
};

export const easeInOut = (p: number): number => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
export const easeOut = (p: number): number => 1 - Math.pow(1 - p, 3);
export const easeOutBack = (p: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};

export class AnimQueue {
  private items: Anim[] = [];

  /** True while anything is still running or waiting to start. */
  get busy(): boolean {
    return this.items.length > 0;
  }

  /** Runs `update(p)` over `dur` ms, starting after `delay` ms. */
  add(now: number, a: { delay?: number; dur: number; update: (p: number) => void; done?: () => void }): void {
    this.items.push({ t0: now + (a.delay ?? 0), dur: Math.max(1, a.dur), update: a.update, done: a.done });
  }

  /** Runs animations one after another, then calls `done`. Each step receives the time it actually starts. */
  chain(now: number, steps: ((start: number) => { dur: number; update: (p: number) => void }[] | { dur: number; update: (p: number) => void })[], done?: () => void): void {
    const run = (i: number, at: number): void => {
      if (i >= steps.length) {
        done?.();
        return;
      }
      const made = steps[i](at);
      const parts = Array.isArray(made) ? made : [made];
      const dur = Math.max(...parts.map((p) => p.dur));
      parts.forEach((p) => this.add(at, { dur: p.dur, update: p.update }));
      // Continue once the longest part has finished.
      this.add(at, { delay: dur, dur: 1, update: () => undefined, done: () => run(i + 1, at + dur) });
    };
    run(0, now);
  }

  update(now: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const a = this.items[i];
      if (now < a.t0) continue;
      const p = Math.min(1, (now - a.t0) / a.dur);
      a.update(p);
      if (p >= 1) {
        this.items.splice(i, 1);
        a.done?.();
      }
    }
  }

  clear(): void {
    this.items = [];
  }
}
