import Phaser from "phaser";
import { isTap, pinchScale, tiltDelta, twistDelta } from "./gestureMath";

export type GestureHandlers = {
  /** Fingers moved apart (above 1) or together (below 1) since the last frame. */
  onPinch(scale: number): void;
  /** The two fingers turned by this many radians since the last frame (clockwise positive). */
  onTwist(rad: number): void;
  /** The two fingers moved up (positive) or down (negative) together; already converted to a camera tilt in radians. */
  onTilt(rad: number): void;
  /** A quick, still, single-finger tap at game coordinates. Never fires if a second finger joined. */
  onTap(x: number, y: number): void;
};

type Touch = { x: number; y: number; sx: number; sy: number; t: number; moved: number };

/**
 * Two-finger board gestures (pinch, twist, tilt) plus a reliable tap. One finger is only ever a tap, so playing is
 * unchanged; putting a second finger down cancels any tap in progress, so a gesture can never move a piece.
 * Taps that land on an interactive Phaser object (a button) are ignored so buttons don't also poke the board.
 */
export class BoardGestures {
  private readonly touches = new Map<number, Touch>();
  private multi = false;
  private prev: { d: number; a: number; my: number } | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly h: GestureHandlers
  ) {
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
  }

  private onDown(p: Phaser.Input.Pointer): void {
    this.touches.set(p.id, { x: p.x, y: p.y, sx: p.x, sy: p.y, t: this.scene.time.now, moved: 0 });
    if (this.touches.size >= 2) {
      this.multi = true;
      this.prev = this.measure();
    }
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const t = this.touches.get(p.id);
    if (!t) return;
    t.x = p.x;
    t.y = p.y;
    t.moved = Math.max(t.moved, Math.hypot(p.x - t.sx, p.y - t.sy));
    if (this.touches.size < 2) return;
    const now = this.measure();
    if (this.prev && now) {
      this.h.onPinch(pinchScale(this.prev.d, now.d));
      this.h.onTwist(twistDelta(this.prev.a, now.a));
      this.h.onTilt(tiltDelta(now.my - this.prev.my));
    }
    this.prev = now;
  }

  private onUp(p: Phaser.Input.Pointer): void {
    const t = this.touches.get(p.id);
    this.touches.delete(p.id);
    if (!t) return;
    if (this.touches.size === 0) {
      const tap = isTap({ downMs: t.t, upMs: this.scene.time.now, moved: t.moved, multi: this.multi });
      this.multi = false;
      this.prev = null;
      if (tap && this.scene.input.hitTestPointer(p).length === 0) this.h.onTap(t.sx, t.sy);
    } else if (this.touches.size === 1) {
      this.prev = null;
    }
  }

  /** Distance, angle and vertical midpoint of the first two fingers. */
  private measure(): { d: number; a: number; my: number } | null {
    const pts = [...this.touches.values()];
    if (pts.length < 2) return null;
    const [a, b] = pts;
    return { d: Math.hypot(b.x - a.x, b.y - a.y), a: Math.atan2(b.y - a.y, b.x - a.x), my: (a.y + b.y) / 2 };
  }
}
