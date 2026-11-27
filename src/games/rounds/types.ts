/** Shared shapes for the pure question generators (no Phaser, no DOM, so `npm test` can run them). */
export type Rng = () => number;

export type Visual = { kind: "pizza"; k: number; n: number } | { kind: "text"; text: string };

export type RoundData = {
  prompt: string;
  options: string[];
  correct: number;
  explain: string;
  visual?: Visual;
  cols: number;
  w: number;
  fontSize: number;
};
