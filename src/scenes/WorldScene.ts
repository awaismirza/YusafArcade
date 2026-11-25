import Phaser from "phaser";
import { FONT } from "../ui/arcadeKit";
import { ChoiceGameScene, GameCfg, Round, pick, shuffle, withAnswer } from "./ChoiceGameScene";

type Country = { name: string; flag: string; capital: string; continent: string };

const COUNTRIES: Country[] = [
  { name: "Japan", flag: "🇯🇵", capital: "Tokyo", continent: "Asia" },
  { name: "France", flag: "🇫🇷", capital: "Paris", continent: "Europe" },
  { name: "Italy", flag: "🇮🇹", capital: "Rome", continent: "Europe" },
  { name: "Germany", flag: "🇩🇪", capital: "Berlin", continent: "Europe" },
  { name: "Spain", flag: "🇪🇸", capital: "Madrid", continent: "Europe" },
  { name: "United Kingdom", flag: "🇬🇧", capital: "London", continent: "Europe" },
  { name: "Greece", flag: "🇬🇷", capital: "Athens", continent: "Europe" },
  { name: "Sweden", flag: "🇸🇪", capital: "Stockholm", continent: "Europe" },
  { name: "Norway", flag: "🇳🇴", capital: "Oslo", continent: "Europe" },
  { name: "Ireland", flag: "🇮🇪", capital: "Dublin", continent: "Europe" },
  { name: "Portugal", flag: "🇵🇹", capital: "Lisbon", continent: "Europe" },
  { name: "Netherlands", flag: "🇳🇱", capital: "Amsterdam", continent: "Europe" },
  { name: "Brazil", flag: "🇧🇷", capital: "Brasília", continent: "South America" },
  { name: "Argentina", flag: "🇦🇷", capital: "Buenos Aires", continent: "South America" },
  { name: "Peru", flag: "🇵🇪", capital: "Lima", continent: "South America" },
  { name: "Chile", flag: "🇨🇱", capital: "Santiago", continent: "South America" },
  { name: "Colombia", flag: "🇨🇴", capital: "Bogotá", continent: "South America" },
  { name: "Canada", flag: "🇨🇦", capital: "Ottawa", continent: "North America" },
  { name: "United States", flag: "🇺🇸", capital: "Washington, D.C.", continent: "North America" },
  { name: "Mexico", flag: "🇲🇽", capital: "Mexico City", continent: "North America" },
  { name: "Cuba", flag: "🇨🇺", capital: "Havana", continent: "North America" },
  { name: "Australia", flag: "🇦🇺", capital: "Canberra", continent: "Oceania" },
  { name: "New Zealand", flag: "🇳🇿", capital: "Wellington", continent: "Oceania" },
  { name: "India", flag: "🇮🇳", capital: "New Delhi", continent: "Asia" },
  { name: "China", flag: "🇨🇳", capital: "Beijing", continent: "Asia" },
  { name: "South Korea", flag: "🇰🇷", capital: "Seoul", continent: "Asia" },
  { name: "Thailand", flag: "🇹🇭", capital: "Bangkok", continent: "Asia" },
  { name: "Indonesia", flag: "🇮🇩", capital: "Jakarta", continent: "Asia" },
  { name: "Saudi Arabia", flag: "🇸🇦", capital: "Riyadh", continent: "Asia" },
  { name: "Pakistan", flag: "🇵🇰", capital: "Islamabad", continent: "Asia" },
  { name: "Egypt", flag: "🇪🇬", capital: "Cairo", continent: "Africa" },
  { name: "South Africa", flag: "🇿🇦", capital: "Pretoria", continent: "Africa" },
  { name: "Kenya", flag: "🇰🇪", capital: "Nairobi", continent: "Africa" },
  { name: "Nigeria", flag: "🇳🇬", capital: "Abuja", continent: "Africa" },
  { name: "Morocco", flag: "🇲🇦", capital: "Rabat", continent: "Africa" },
];

const CONTINENTS = ["Asia", "Europe", "Africa", "North America", "South America", "Oceania"];

export class WorldScene extends ChoiceGameScene {
  protected readonly cfg: GameCfg = {
    title: "World Explorer 🌍",
    subtitle: "Flags, countries and capital cities!",
    bg: 0x1e3a8a,
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
