import { ChoiceGameScene, GameCfg, Round, pick, shuffle } from "./ChoiceGameScene";

type Pool = { name: string; items: string[] };

const EMOJI_POOLS: Pool[] = [
  { name: "fruits", items: ["🍎", "🍌", "🍇", "🍓", "🍊", "🍉", "🍒"] },
  { name: "animals", items: ["🐶", "🐱", "🐭", "🐰", "🦊", "🐻", "🐼"] },
  { name: "vehicles", items: ["🚗", "🚌", "🚲", "✈️", "🚂", "🚢", "🚁"] },
  { name: "sea animals", items: ["🐟", "🐙", "🐬", "🦀", "🐳", "🦈"] },
  { name: "weather", items: ["☀️", "🌧️", "❄️", "🌈", "⛈️", "💨"] },
  { name: "balls", items: ["⚽", "🏀", "🏈", "🎾", "🏐"] },
  { name: "food", items: ["🍕", "🍔", "🍟", "🌭", "🍩", "🍪"] },
  { name: "clothes", items: ["👕", "👖", "👗", "🧦", "🧢", "🧥"] },
  { name: "musical things", items: ["🎸", "🥁", "🎹", "🎺", "🎻"] },
];

const WORD_POOLS: Pool[] = [
  { name: "planets", items: ["Mars", "Venus", "Saturn", "Jupiter", "Neptune", "Mercury"] },
  { name: "mammals", items: ["Dolphin", "Bat", "Whale", "Bear", "Rabbit", "Tiger"] },
  { name: "birds", items: ["Eagle", "Owl", "Penguin", "Parrot", "Duck", "Robin"] },
  { name: "insects", items: ["Bee", "Ant", "Beetle", "Butterfly", "Ladybird", "Fly"] },
  { name: "reptiles", items: ["Snake", "Lizard", "Crocodile", "Turtle", "Gecko"] },
  { name: "musical instruments", items: ["Piano", "Guitar", "Drum", "Violin", "Flute", "Trumpet"] },
  { name: "continents", items: ["Asia", "Africa", "Europe", "Antarctica", "Oceania"] },
  { name: "colours", items: ["Red", "Blue", "Green", "Purple", "Orange", "Yellow"] },
  { name: "metals", items: ["Iron", "Gold", "Copper", "Silver", "Tin"] },
  { name: "gases", items: ["Oxygen", "Helium", "Nitrogen", "Hydrogen"] },
];

const NUMBER_POOLS: Pool[] = [
  { name: "even numbers", items: ["2", "4", "6", "8", "10", "12", "14", "16", "18", "20", "22", "24"] },
  { name: "odd numbers", items: ["3", "5", "7", "9", "11", "13", "15", "17", "19", "21", "23"] },
  { name: "prime numbers", items: ["2", "3", "5", "7", "11", "13", "17", "19", "23"] },
  { name: "numbers that are not prime", items: ["4", "6", "8", "9", "10", "12", "14", "15", "16", "18", "20", "21", "22", "24"] },
  { name: "multiples of 5", items: ["5", "10", "15", "20", "25", "30", "35", "40"] },
];

/** Pairs that are mutually exclusive, so there is only one right answer. */
const NUMBER_PAIRS: [number, number][] = [
  [0, 1], [1, 0], [2, 3], [3, 2],
];

export class OddScene extends ChoiceGameScene {
  protected readonly cfg: GameCfg = {
    title: "Odd One Out 🧐",
    subtitle: "Find the one that does not belong!",
    bg: 0x831843,
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
