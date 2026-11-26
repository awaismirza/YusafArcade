import { EASY_MORE, QA } from "../data/quizEasyBank";
import { FONT } from "../ui/theme";
import { ChoiceGameScene, GameCfg, Round, shuffle, withAnswer } from "./ChoiceGameScene";

const EASY_BASE: QA[] = [
  ["🪐", "Which planet do we live on?", "Earth", ["Mars", "Venus", "Jupiter"], "Earth is the third planet from the Sun."],
  ["🕷️", "How many legs does a spider have?", "8", ["6", "10", "4"], "Spiders are arachnids, not insects. Insects have 6 legs."],
  ["🌱", "What do plants need to grow?", "Sunlight and water", ["Only candy", "Only sand", "Nothing at all"], "Plants make their own food using sunlight. This is called photosynthesis."],
  ["🐋", "Which animal is the biggest in the world?", "Blue whale", ["Elephant", "Giraffe", "Shark"], "A blue whale's heart is about as big as a small car!"],
  ["🎨", "What colour do you get when you mix blue and yellow?", "Green", ["Purple", "Orange", "Pink"], "Blue and yellow are primary colours. Mixing them makes green."],
  ["📅", "How many days are in one week?", "7", ["5", "6", "8"], "Monday to Sunday makes 7 days."],
  ["🐬", "Which of these is a mammal?", "Dolphin", ["Shark", "Trout", "Octopus"], "Dolphins breathe air and feed their babies milk."],
  ["☀️", "What is the Sun?", "A star", ["A planet", "A moon", "A comet"], "The Sun is a star. It is so big that a million Earths could fit inside it."],
  ["❄️", "Which season is the coldest?", "Winter", ["Summer", "Spring", "Autumn"], "In winter, our part of Earth is tilted away from the Sun."],
  ["🌍", "How many continents are there?", "7", ["5", "6", "8"], "Asia, Africa, North America, South America, Antarctica, Europe and Australia."],
  ["🧊", "What is frozen water called?", "Ice", ["Steam", "Fog", "Mud"], "Water freezes at 0 degrees Celsius."],
  ["🐝", "What do bees make?", "Honey", ["Milk", "Butter", "Jam"], "One bee makes only a tiny spoonful of honey in its whole life."],
  ["🦴", "What gives our body its shape and protects our organs?", "Skeleton", ["Skin", "Hair", "Blood"], "Your skeleton has more than 200 bones."],
  ["🌈", "How many colours are in a rainbow?", "7", ["3", "5", "9"], "Red, orange, yellow, green, blue, indigo and violet."],
];

/** Age 7: 100+ questions, 10 random ones per quiz. */
const EASY: QA[] = [...EASY_BASE, ...EASY_MORE];

const HARD: QA[] = [
  ["🗼", "What is the capital of Japan?", "Tokyo", ["Kyoto", "Osaka", "Seoul"], "Tokyo is one of the biggest cities in the world."],
  ["🌿", "Which gas do plants take in from the air?", "Carbon dioxide", ["Oxygen", "Helium", "Nitrogen"], "Plants use carbon dioxide and sunlight to make food and release oxygen."],
  ["🪐", "Which is the largest planet in our Solar System?", "Jupiter", ["Saturn", "Earth", "Neptune"], "Jupiter is so big that all the other planets could fit inside it."],
  ["💎", "What is the hardest natural substance?", "Diamond", ["Gold", "Iron", "Quartz"], "Diamonds are made of carbon squeezed under huge pressure."],
  ["❤️", "Which organ pumps blood around the body?", "Heart", ["Lungs", "Stomach", "Brain"], "Your heart beats about 100,000 times every day."],
  ["🍎", "What force pulls things towards the Earth?", "Gravity", ["Magnetism", "Friction", "Wind"], "Gravity keeps us on the ground and the Moon around Earth."],
  ["🌊", "Which is the largest ocean?", "Pacific Ocean", ["Atlantic Ocean", "Indian Ocean", "Arctic Ocean"], "The Pacific covers about a third of the whole planet."],
  ["💧", "What is the chemical formula for water?", "H2O", ["CO2", "O2", "NaCl"], "Two hydrogen atoms and one oxygen atom make a water molecule."],
  ["🦴", "How many bones does an adult human have?", "206", ["106", "306", "412"], "Babies are born with about 300 bones that join together as they grow."],
  ["🔴", "Which planet is called the Red Planet?", "Mars", ["Venus", "Mercury", "Saturn"], "Mars looks red because its soil contains rusty iron."],
  ["⭐", "What is the closest star to Earth?", "The Sun", ["Sirius", "Polaris", "Alpha Centauri"], "The Sun is about 150 million kilometres away."],
  ["♨️", "What is it called when liquid water turns into vapour?", "Evaporation", ["Condensation", "Freezing", "Erosion"], "Evaporation is part of the water cycle."],
  ["🦘", "What is the capital of Australia?", "Canberra", ["Sydney", "Melbourne", "Perth"], "Many people guess Sydney, but Canberra is the capital."],
  ["🎨", "Who painted the Mona Lisa?", "Leonardo da Vinci", ["Pablo Picasso", "Vincent van Gogh", "Claude Monet"], "Leonardo was also an inventor and scientist."],
  ["⚡", "Which travels faster, light or sound?", "Light", ["Sound", "Wind", "Rain"], "That is why you see lightning before you hear thunder."],
  ["🌋", "Which layer of the Earth do we live on?", "Crust", ["Mantle", "Outer core", "Inner core"], "The crust is the thin, rocky outer skin of our planet."],
];

export class QuizScene extends ChoiceGameScene {
  protected readonly cfg: GameCfg = {
    title: "Brain Quiz 🧠",
    subtitle: "Science, space, nature and the world.\nLearn a fun fact after every answer!",
    bg: 0x064e3b,
    palette: "quiz",
    end: "Quiz Champion!",
    best: "quiz",
  };

  /** The shuffled questions for this session, so none repeats. */
  private order: QA[] = [];
  private next = 0;

  constructor() {
    super("Quiz");
  }

  init(): void {
    super.init();
    this.order = [];
    this.next = 0;
  }

  protected makeRound(tier: 0 | 1): Round {
    if (this.order.length === 0) this.order = shuffle(tier === 0 ? EASY : HARD);
    const [emoji, question, right, wrong, fact] = this.order[this.next++ % this.order.length];
    const { options, correct } = withAnswer(right, wrong);
    return {
      prompt: question,
      visual: () => [this.add.text(480, 178, emoji, { fontFamily: FONT, fontSize: "44px" }).setOrigin(0.5)],
      options,
      correct,
      explain: `💡 ${fact}`,
      w: 400,
      fontSize: 24,
    };
  }
}
