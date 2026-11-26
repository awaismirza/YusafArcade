import Phaser from "phaser";
import { FONT } from "../ui/arcadeKit";
import { COUNTRIES } from "../data/countries";
import { ChoiceGameScene, GameCfg, Round, pick, shuffle, withAnswer } from "./ChoiceGameScene";



const CONTINENTS = ["Asia", "Europe", "Africa", "North America", "South America", "Oceania"];

export class WorldScene extends ChoiceGameScene {
  protected readonly cfg: GameCfg = {
    title: "World Explorer 🌍",
    subtitle: "Flags, countries and capital cities!",
    bg: 0x1e3a8a,
    palette: "world",
    end: "World Explorer!",
    best: "world",
  };

  constructor() {
    super("World");
  }

  private big(text: string, size: number): Phaser.GameObjects.GameObject[] {
    return [this.add.text(480, 175, text, { fontFamily: FONT, fontSize: `${size}px`, color: "#ffffff", fontStyle: "700", align: "center" }).setOrigin(0.5)];
  }

  protected makeRound(tier: 0 | 1): Round {
    const c = pick(COUNTRIES);
    const others = shuffle(COUNTRIES.filter((x) => x !== c));
    const roll = Math.random();

    if (tier === 0) {
      if (roll < 0.55) {
        const o = withAnswer(c.name, others.map((x) => x.name));
        return {
          prompt: "Which country has this flag?",
          visual: () => this.big(c.flag, 100),
          options: o.options,
          correct: o.correct,
          explain: `That is the flag of ${c.name}. Its capital is ${c.capital}.`,
          fontSize: 28,
        };
      }
      const o = withAnswer(c.continent, shuffle(CONTINENTS));
      return {
        prompt: "Which continent is this country in?",
        visual: () => this.big(`${c.flag}  ${c.name}`, 44),
        options: o.options,
        correct: o.correct,
        explain: `${c.name} is in ${c.continent}.`,
        fontSize: 28,
      };
    }

    if (roll < 0.6) {
      const o = withAnswer(c.capital, others.map((x) => x.capital));
      return {
        prompt: "What is the capital city?",
        visual: () => this.big(`${c.flag}  ${c.name}`, 44),
        options: o.options,
        correct: o.correct,
        explain: `${c.capital} is the capital of ${c.name}.`,
        fontSize: 26,
      };
    }
    const o = withAnswer(c.capital, others.map((x) => x.capital));
    return {
      prompt: "What is the capital of the country with this flag?",
      visual: () => this.big(c.flag, 100),
      options: o.options,
      correct: o.correct,
      explain: `This is the flag of ${c.name}. Its capital is ${c.capital}.`,
      fontSize: 26,
    };
  }
}
