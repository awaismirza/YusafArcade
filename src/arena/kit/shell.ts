import * as THREE from "three";
import { injectArenaCss } from "./ui";

export type Shell = {
  /** Full-screen container for the canvas and all HTML controls. */
  root: HTMLDivElement;
  renderer: THREE.WebGLRenderer;
  /** True on a device without touch (desktop): keyboard hints are shown and touch controls hidden. */
  desktop: boolean;
  size(): { w: number; h: number };
  /** Called every frame with dt in seconds (never more than 1/20) and elapsed time. Not called while paused. */
  onFrame(fn: (dt: number, t: number) => void): void;
  onResize(fn: () => void): void;
  addCleanup(fn: () => void): void;
  paused(): boolean;
  setPaused(p: boolean): void;
  dispose(): void;
};

export const isTouchDevice = (): boolean => "ontouchstart" in window || navigator.maxTouchPoints > 0;

/** Hands the whole screen to a three.js game. Returns the shell; call dispose() to leave. */
export function startShell(bg = "#0b1026"): Shell {
  injectArenaCss();
  const desktop = !isTouchDevice();
  const root = document.createElement("div");
  root.className = "arena-root";
  root.style.background = bg;
  document.body.appendChild(root);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, desktop ? 2 : 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.domElement.className = "arena-canvas";
  root.appendChild(renderer.domElement);

  const frames: ((dt: number, t: number) => void)[] = [];
  const resizers: (() => void)[] = [];
  const cleanups: (() => void)[] = [];
  let raf = 0;
  let last = performance.now();
  let elapsed = 0;
  let isPaused = false;
  let disposed = false;

  const size = (): { w: number; h: number } => ({ w: Math.max(1, root.clientWidth), h: Math.max(1, root.clientHeight) });
  const resize = (): void => {
    const { w, h } = size();
    renderer.setSize(w, h, false);
    resizers.forEach((f) => f());
  };
  const onResize = (): void => {
    resize();
    // iOS reports the new size a little after rotating.
    window.setTimeout(resize, 120);
  };
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);

  const onVisibility = (): void => {
    if (document.hidden) isPaused = true;
    last = performance.now();
  };
  document.addEventListener("visibilitychange", onVisibility);

  const frame = (now: number): void => {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    if (isPaused) return;
    elapsed += dt;
    for (const f of frames) f(dt, elapsed);
  };
  raf = requestAnimationFrame(frame);
  resize();

  return {
    root,
    renderer,
    desktop,
    size,
    onFrame: (fn) => frames.push(fn),
    onResize: (fn) => {
      resizers.push(fn);
      fn();
    },
    addCleanup: (fn) => cleanups.push(fn),
    paused: () => isPaused,
    setPaused: (p) => {
      isPaused = p;
      last = performance.now();
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      for (const c of cleanups.splice(0)) {
        try {
          c();
        } catch {
          /* keep cleaning up */
        }
      }
      renderer.dispose();
      renderer.forceContextLoss();
      root.remove();
    },
  };
}
