/** Soft Glass HTML overlays for the 3D Arena games: pickers, game over, HUD chips, exit button. */

export const PLAYER_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308"];
export const PLAYER_HEX = [0xef4444, 0x3b82f6, 0x22c55e, 0xeab308];
export const PLAYER_NAMES = ["Red", "Blue", "Green", "Yellow"];

const CSS = `
.arena-root{position:fixed;inset:0;z-index:200;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;
  font-family:Nunito,system-ui,-apple-system,'Apple Color Emoji',sans-serif;color:#fff;}
.arena-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;}
.ar-layer{position:absolute;inset:0;pointer-events:none;}
.ar-layer > *{pointer-events:auto;}
.ar-scrim{position:absolute;inset:0;background:rgba(10,8,35,.62);display:flex;align-items:center;justify-content:center;padding:12px;z-index:30;}
.ar-card{background:linear-gradient(160deg,rgba(60,52,130,.82),rgba(18,14,52,.9));border:1px solid rgba(255,255,255,.24);border-radius:28px;
  box-shadow:0 18px 50px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.25);padding:18px 20px;max-width:min(760px,96vw);max-height:94%;overflow:auto;text-align:center;
  backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);}
.ar-card h2{font-size:clamp(22px,4.4vmin,40px);font-weight:800;margin:2px 0 4px;}
.ar-card p{font-size:clamp(14px,2.6vmin,19px);opacity:.9;margin:0 0 12px;line-height:1.35;white-space:pre-line;}
.ar-grid{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;}
.ar-btn{border:0;border-radius:999px;color:#fff;font-family:inherit;font-weight:800;font-size:clamp(16px,3vmin,22px);line-height:1.1;padding:12px 20px;min-height:52px;min-width:140px;cursor:pointer;
  box-shadow:0 5px 0 rgba(0,0,0,.28),inset 0 2px 0 rgba(255,255,255,.35);touch-action:manipulation;}
.ar-btn small{display:block;font-size:.66em;font-weight:700;opacity:.9;margin-top:3px;}
.ar-btn:active{transform:translateY(3px);box-shadow:0 2px 0 rgba(0,0,0,.28),inset 0 2px 0 rgba(255,255,255,.35);}
.ar-exit{position:absolute;left:max(10px,env(safe-area-inset-left));top:max(10px,env(safe-area-inset-top));z-index:25;border:1px solid rgba(255,255,255,.3);
  background:rgba(20,16,60,.6);color:#fff;font-family:inherit;font-weight:800;font-size:17px;line-height:1;border-radius:18px;padding:0 16px;height:46px;min-width:96px;cursor:pointer;
  backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);}
.ar-hud{position:absolute;display:flex;gap:8px;align-items:center;z-index:20;pointer-events:none;}
.ar-chip{background:rgba(20,16,60,.58);border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:7px 14px;font-weight:800;font-size:clamp(13px,2.5vmin,19px);
  white-space:nowrap;box-shadow:inset 0 1px 0 rgba(255,255,255,.2);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);}
.ar-toast{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);font-weight:800;font-size:clamp(34px,9vmin,90px);z-index:22;pointer-events:none;
  text-shadow:0 4px 18px rgba(0,0,0,.5);transition:opacity .25s, transform .25s;}
.ar-stick{position:absolute;border-radius:50%;background:rgba(255,255,255,.14);border:2px solid rgba(255,255,255,.35);z-index:15;touch-action:none;}
.ar-stick .knob{position:absolute;left:50%;top:50%;width:46%;height:46%;margin:-23% 0 0 -23%;border-radius:50%;box-shadow:0 4px 10px rgba(0,0,0,.35),inset 0 2px 0 rgba(255,255,255,.45);}
.ar-pad{position:absolute;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;z-index:15;touch-action:none;
  box-shadow:0 5px 0 rgba(0,0,0,.3),inset 0 2px 0 rgba(255,255,255,.4);border:2px solid rgba(255,255,255,.35);}
.ar-pad.on{transform:translateY(3px);filter:brightness(1.2);box-shadow:0 2px 0 rgba(0,0,0,.3),inset 0 2px 0 rgba(255,255,255,.4);}
`;

export function injectArenaCss(): void {
  if (document.getElementById("arena-css")) return;
  const s = document.createElement("style");
  s.id = "arena-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, html = "", parent?: HTMLElement): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  parent?.appendChild(e);
  return e;
}

export type PickOption<T> = { label: string; sub?: string; color: string; value: T };

/** A glass card with big buttons. Resolves with the chosen option's value. */
export function showPicker<T>(root: HTMLElement, o: { title: string; subtitle?: string; options: PickOption<T>[] }): Promise<T> {
  return new Promise((resolve) => {
    const scrim = el("div", "ar-scrim", "", root);
    const card = el("div", "ar-card", `<h2>${o.title}</h2>${o.subtitle ? `<p>${o.subtitle}</p>` : ""}`, scrim);
    const grid = el("div", "ar-grid", "", card);
    for (const opt of o.options) {
      const b = el("button", "ar-btn", `${opt.label}${opt.sub ? `<small>${opt.sub}</small>` : ""}`, grid);
      b.style.background = opt.color;
      b.addEventListener("click", () => {
        scrim.remove();
        resolve(opt.value);
      });
    }
  });
}

export function showGameOver(root: HTMLElement, o: { title: string; detail: string; onAgain: () => void; onMenu: () => void }): () => void {
  const scrim = el("div", "ar-scrim", "", root);
  const card = el("div", "ar-card", `<h2>${o.title}</h2><p>${o.detail}</p>`, scrim);
  const grid = el("div", "ar-grid", "", card);
  const again = el("button", "ar-btn", "↻ Play again", grid);
  again.style.background = "#16a34a";
  const menu = el("button", "ar-btn", "Menu", grid);
  menu.style.background = "#6d5dfc";
  again.addEventListener("click", () => {
    scrim.remove();
    o.onAgain();
  });
  menu.addEventListener("click", () => o.onMenu());
  return () => scrim.remove();
}

export function addExitButton(root: HTMLElement, onExit: () => void): HTMLButtonElement {
  const b = el("button", "ar-exit", "‹ Menu", root);
  b.addEventListener("click", onExit);
  return b;
}

/** A row of glass chips at a screen position. set(id, html) adds or updates a chip. */
export function hud(root: HTMLElement, pos: Partial<Record<"left" | "right" | "top" | "bottom", string>>, center = false): { set(id: string, html: string, color?: string): void; el: HTMLDivElement } {
  const box = el("div", "ar-hud", "", root);
  Object.assign(box.style, pos);
  if (center) box.style.transform = "translateX(-50%)";
  const chips = new Map<string, HTMLDivElement>();
  return {
    el: box,
    set(id, html, color) {
      let c = chips.get(id);
      if (!c) {
        c = el("div", "ar-chip", "", box);
        chips.set(id, c);
      }
      if (c.innerHTML !== html) c.innerHTML = html;
      if (color) c.style.borderColor = color;
    },
  };
}

/** Big centred text that fades away (e.g. "3", "GO!", "Goal!"). */
export function toast(root: HTMLElement, text: string, ms = 800, color = "#ffffff"): void {
  const t = el("div", "ar-toast", text, root);
  t.style.color = color;
  window.setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translate(-50%,-60%)";
  }, ms);
  window.setTimeout(() => t.remove(), ms + 300);
}
