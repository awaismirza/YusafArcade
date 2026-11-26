import { ODD_EMOJI_POOLS as EMOJI_POOLS, ODD_NUMBER_POOLS as NUMBER_POOLS, ODD_WORD_POOLS as WORD_POOLS, Pool } from "../data/oddPools";
import { ChoiceGameScene, GameCfg, Round, pick, shuffle } from "./ChoiceGameScene";


/** Pairs that are mutually exclusive, so there is only one right answer. */
const NUMBER_PAIRS: [number, number][] = [
  [0, 1], [1, 0], [2, 3], [3, 2],
];

export class OddScene extends ChoiceGameScene {
  protected readonly cfg: GameCfg = {
    title: "Odd One Out 🧐",
    subtitle: "Find the one that does not belong!",
    bg: 0x831843,
    palette: "odd",
    end: "Sharp Thinker!",
    best: "odd",
  };

  constructor() {
    super("Odd");
  }

  protected makeRound(tier: 0 | 1): Round {
    let main: Pool;
    let odd: Pool;
    let emoji = false;

    if (tier === 0) {
      emoji = true;
      const [a, b] = shuffle(EMOJI_POOLS);
      main = a;
      odd = b;
    } else if (Math.random() < 0.35) {
      const [i, j] = pick(NUMBER_PAIRS);
      main = NUMBER_POOLS[i];
      odd = NUMBER_POOLS[j];
    } else {
      const [a, b] = shuffle(WORD_POOLS);
      main = a;
      odd = b;
    }

    const three = shuffle(main.items).slice(0, 3);
    const out = pick(odd.items.filter((x) => !main.items.includes(x)));
    const options = shuffle([...three, out]);
    return {
      prompt: "Which one does NOT belong with the others?",
      options,
      correct: options.indexOf(out),
      explain: `${out} belongs with the ${odd.name}. The others are all ${main.name}.`,
      cols: emoji ? 4 : 2,
      w: emoji ? 190 : 380,
      fontSize: emoji ? 54 : 30,
    };
  }
}
