/** Shared with the HTML controls so a phone or iPad can play without a keyboard. */
export const touchPad = {
  jumpHeld: false,
  duckHeld: false,
  runTap: false,
  shootTap: false,
  swordTap: false,
  retryTap: false,
  flapTap: false,
  restartTap: false,
  menuTap: false,
};

export function deviceUsesTouch(): boolean {
  return window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
}
