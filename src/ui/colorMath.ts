/** Relative luminance of a 0xRRGGBB colour, as defined by WCAG (sRGB). */
function luminance(hex: number): number {
  const channel = (v: number): number => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const r = channel((hex >> 16) & 255);
  const g = channel((hex >> 8) & 255);
  const b = channel(hex & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two 0xRRGGBB colours: 1 (identical) to 21 (black on white). */
export function contrastRatio(a: number, b: number): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
