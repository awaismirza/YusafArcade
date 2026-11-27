/**
 * On screens with room around the 16:9 game, the 3D board games move their Menu and View buttons, the turn label,
 * the counter, the hint and the Roll button off the board: into a bar above and a bar below it on iPads, and into a
 * sidebar on the right on phones in landscape. On 16:9 screens nothing changes and the labels stay on the game.
 */
import Phaser from "phaser";
import { chromeLayout } from "./boardChromeFit";

let active = false;
let onMenu: (() => void) | null = null;
let onView: ((id: string) => void) | null = null;
let onRoll: (() => void) | null = null;
const $ = (id: string): HTMLElement | null => document.getElementById(id);

function refit(): void {
  // The game canvas sits between the bars; let Phaser fit it again.
  window.dispatchEvent(new Event("resize"));
}

function wire(): void {
  const menu = $("bc-menu");
  const view = $("bc-view");
  if (!menu || !view || menu.dataset.wired) return;
  menu.dataset.wired = "1";
  menu.addEventListener("click", () => onMenu?.());
  $("bc-roll")?.addEventListener("click", () => onRoll?.());
  view.addEventListener("click", () => {
    const list = $("bc-views");
    if (!list) return;
    const r = view.getBoundingClientRect();
    if (document.body.classList.contains("board-side")) {
      // beside the sidebar, from the top, so the list fits on a short phone screen
      list.style.left = "";
      list.style.right = `${window.innerWidth - r.left + 8}px`;
      list.style.top = "8px";
    } else {
      list.style.right = "";
      list.style.left = `${r.left}px`;
      list.style.top = `${r.bottom + 8}px`;
    }
    list.classList.toggle("open");
  });
}

export const boardChrome = {
  isActive: (): boolean => active,

  /** Shows the bars if they fit. Returns a function that hides the Menu button (for the end of a game). */
  start(scene: Phaser.Scene, menu: () => void): (() => void) | null {
    const fit = chromeLayout(window.innerWidth, window.innerHeight);
    if (!fit) return null;
    wire();
    active = true;
    onMenu = menu;
    if (fit.kind === "side") {
      document.body.style.setProperty("--side-w", `${fit.width}px`);
      document.body.classList.add("board-side");
    } else document.body.classList.add("board-chrome");
    const m = $("bc-menu");
    if (m) m.style.visibility = "visible";
    const v = $("bc-view");
    if (v) v.style.display = "none";
    for (const id of ["bc-status", "bc-counts", "bc-detail"]) {
      const e = $(id);
      if (e) e.textContent = "";
    }
    boardChrome.setVisible(true);
    refit();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => boardChrome.stop());
    return () => {
      if (m) m.style.visibility = "hidden";
    };
  },

  stop(): void {
    if (!active) return;
    active = false;
    onMenu = null;
    onView = null;
    onRoll = null;
    const roll = $("bc-roll");
    if (roll) roll.style.display = "none";
    document.body.classList.remove("board-chrome", "board-side");
    $("bc-views")?.classList.remove("open");
    refit();
  },

  /** Puts the camera presets behind the bar's View button. */
  setViews(presets: { id: string; label: string }[], pick: (id: string) => void): void {
    const list = $("bc-views");
    const v = $("bc-view");
    if (!list || !v) return;
    onView = pick;
    v.style.display = "";
    list.innerHTML = "";
    for (const p of presets) {
      const b = document.createElement("button");
      b.className = "bc-btn";
      b.type = "button";
      b.textContent = p.label;
      b.addEventListener("click", () => {
        onView?.(p.id);
        for (const o of list.querySelectorAll("button")) o.classList.toggle("current", o === b);
        list.classList.remove("open");
      });
      list.appendChild(b);
    }
  },

  /** The Roll button for dice games: at the right of the bottom bar, or at the foot of the sidebar. Null when neither is shown. */
  rollButton(roll: () => void): { container: { setVisible(v: boolean): void } } | null {
    const b = $("bc-roll");
    if (!active || !b) return null;
    onRoll = roll;
    b.style.display = "none";
    return { container: { setVisible: (v: boolean) => void (b.style.display = v ? "block" : "none") } };
  },

  setText(which: "status" | "counts" | "detail", text: string): void {
    const e = $(`bc-${which}`);
    if (e) e.innerHTML = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>");
  },

  setVisible(visible: boolean): void {
    for (const id of ["bc-status", "bc-counts", "bc-detail"]) {
      const e = $(id);
      if (e) e.style.visibility = visible ? "visible" : "hidden";
    }
  },
};
