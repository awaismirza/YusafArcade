/** Multi-touch and keyboard controls for the 3D Arena games. Each control follows only its own finger. */
import { el } from "./ui";

/** Keyboard state shared by all players. Uses KeyboardEvent.code (e.g. "KeyW", "ArrowLeft", "Space"). */
export class Keys {
  private held = new Set<string>();
  private edges = new Set<string>();
  private readonly onDown = (e: KeyboardEvent): void => {
    if (!this.held.has(e.code)) this.edges.add(e.code);
    this.held.add(e.code);
    if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
  };
  private readonly onUp = (e: KeyboardEvent): void => {
    this.held.delete(e.code);
  };
  private readonly onBlur = (): void => this.held.clear();

  constructor() {
    window.addEventListener("keydown", this.onDown);
    window.addEventListener("keyup", this.onUp);
    window.addEventListener("blur", this.onBlur);
  }
  down(code: string): boolean {
    return this.held.has(code);
  }
  /** True once per key press. */
  pressed(code: string): boolean {
    const p = this.edges.has(code);
    this.edges.delete(code);
    return p;
  }
  any(): boolean {
    return this.held.size > 0;
  }
  dispose(): void {
    window.removeEventListener("keydown", this.onDown);
    window.removeEventListener("keyup", this.onUp);
    window.removeEventListener("blur", this.onBlur);
  }
}

/** Keyboard layouts per player: up, down, left, right, action. */
export const KEYMAPS = [
  { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", act: "Space", alt: "KeyF" },
  { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", act: "Enter", alt: "ShiftRight" },
  { up: "KeyI", down: "KeyK", left: "KeyJ", right: "KeyL", act: "KeyO", alt: "KeyU" },
  { up: "Numpad8", down: "Numpad5", left: "Numpad4", right: "Numpad6", act: "Numpad0", alt: "NumpadAdd" },
];

export function keyVec(keys: Keys, p: number): { x: number; y: number } {
  const m = KEYMAPS[p];
  return { x: (keys.down(m.right) ? 1 : 0) - (keys.down(m.left) ? 1 : 0), y: (keys.down(m.down) ? 1 : 0) - (keys.down(m.up) ? 1 : 0) };
}

type Pos = Partial<Record<"left" | "right" | "top" | "bottom", string>>;

/** Size for touch controls: big enough for a child's thumb, smaller on phones. */
export const padSize = (scale = 1): string => `clamp(${Math.round(64 * scale)}px, ${(17 * scale).toFixed(1)}vmin, ${Math.round(128 * scale)}px)`;

function trackPointer(
  node: HTMLElement,
  onMove: (e: PointerEvent) => void,
  onEnd: () => void
): () => void {
  let id: number | null = null;
  const down = (e: PointerEvent): void => {
    if (id !== null) return;
    id = e.pointerId;
    try {
      node.setPointerCapture(e.pointerId);
    } catch {
      /* older Safari */
    }
    e.preventDefault();
    onMove(e);
  };
  const move = (e: PointerEvent): void => {
    if (e.pointerId !== id) return;
    e.preventDefault();
    onMove(e);
  };
  const up = (e: PointerEvent): void => {
    if (e.pointerId !== id) return;
    id = null;
    onEnd();
  };
  node.addEventListener("pointerdown", down);
  node.addEventListener("pointermove", move);
  node.addEventListener("pointerup", up);
  node.addEventListener("pointercancel", up);
  node.addEventListener("lostpointercapture", up);
  return () => {
    node.removeEventListener("pointerdown", down);
    node.removeEventListener("pointermove", move);
    node.removeEventListener("pointerup", up);
    node.removeEventListener("pointercancel", up);
    node.removeEventListener("lostpointercapture", up);
  };
}

export type Joystick = { vec(): { x: number; y: number }; el: HTMLElement; dispose(): void };

/** A thumb joystick. vec() is in -1..1 with y pointing down the screen. */
export function addJoystick(parent: HTMLElement, pos: Pos, color: string, scale = 1.25): Joystick {
  const base = el("div", "ar-stick", "", parent);
  Object.assign(base.style, pos, { width: padSize(scale), height: padSize(scale) });
  const knob = el("div", "knob", "", base);
  knob.style.background = color;
  let vx = 0;
  let vy = 0;
  const off = trackPointer(
    base,
    (e) => {
      const r = base.getBoundingClientRect();
      const rad = r.width / 2;
      let x = (e.clientX - (r.left + rad)) / rad;
      let y = (e.clientY - (r.top + rad)) / rad;
      const m = Math.hypot(x, y);
      if (m > 1) {
        x /= m;
        y /= m;
      }
      vx = Math.abs(x) < 0.12 ? 0 : x;
      vy = Math.abs(y) < 0.12 ? 0 : y;
      knob.style.transform = `translate(${x * 60}%, ${y * 60}%)`;
    },
    () => {
      vx = 0;
      vy = 0;
      knob.style.transform = "";
    }
  );
  return {
    el: base,
    vec: () => ({ x: vx, y: vy }),
    dispose: () => {
      off();
      base.remove();
    },
  };
}

export type PadButton = { held(): boolean; pressed(): boolean; el: HTMLElement; dispose(): void };

/** A round hold-able button. pressed() is true once per press. */
export function addPadButton(parent: HTMLElement, pos: Pos, label: string, color: string, scale = 1): PadButton {
  const b = el("div", "ar-pad", label, parent);
  Object.assign(b.style, pos, { width: padSize(scale), height: padSize(scale), background: color, fontSize: `calc(${padSize(scale)} * 0.34)` });
  let held = false;
  let edge = false;
  const off = trackPointer(
    b,
    () => {
      if (!held) edge = true;
      held = true;
      b.classList.add("on");
    },
    () => {
      held = false;
      b.classList.remove("on");
    }
  );
  return {
    el: b,
    held: () => held,
    pressed: () => {
      const p = edge;
      edge = false;
      return p;
    },
    dispose: () => {
      off();
      b.remove();
    },
  };
}

/** Rotates a control group so a player sitting at the far side of an iPad reads it the right way up. */
export function flip(node: HTMLElement): void {
  node.style.transform = `${node.style.transform} rotate(180deg)`.trim();
}
