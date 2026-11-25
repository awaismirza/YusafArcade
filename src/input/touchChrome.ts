import { deviceUsesTouch } from "./touchPad";

export type TouchChromeMode = "hidden" | "runner" | "flappy" | "gameover";

export function setTouchChrome(mode: TouchChromeMode): void {
  const touch = deviceUsesTouch();
  document.body.classList.remove("runner-touch", "flappy-touch", "gameover-touch");
  if (mode === "runner" && touch) document.body.classList.add("runner-touch");
  if (mode === "flappy" && touch) document.body.classList.add("flappy-touch");
  if (mode === "gameover" && touch) document.body.classList.add("gameover-touch");
}