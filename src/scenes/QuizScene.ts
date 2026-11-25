import Phaser from "phaser";
import { GAME_WIDTH } from "../config";
import { gameAudio } from "../audio/sfx";
import { setTouchChrome } from "../input/touchChrome";
import { addMenuButton, Btn, FONT, makeButton, pollEndTaps, resetTaps, showGameOver, showLevelPicker } from "../ui/arcadeKit";
import { ChoiceBoard } from "../ui/choiceBoard";
import { EASY_MORE, QA } from "../data/quizEasyBank";

const ROUNDS = 10;

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

export class QuizScene extends Phaser.Scene {
  private questions: QA[] = [];
  private round = 0;
  private correct = 0;
  private streak = 0;
  private score = 0;
  private dead = false;
  private lockUntil = 0;
  private board: ChoiceBoard | null = null;
  private nextBtn: Btn | null = null;
  private cat!: Phaser.GameObjects.Text;
  private qText!: Phaser.GameObjects.Text;
  private title!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private fact!: Phaser.GameObjects.Text;
  private hideMenu!: () => void;

  constructor() {
    super({ key: "Quiz" });
  }

  init(): void {
    this.questions = [];
    this.round = 0;
    this.correct = 0;
    this.streak = 0;
    this.score = 0;
    this.dead = false;
    this.lockUntil = 0;
    this.board = null;
    this.nextBtn = null;
    resetTaps();
  }

  create(): void {
    setTouchChrome("hidden");
    this.cameras.main.setBackgroundColor(0x064e3b);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setTouchChrome("hidden"));

    this.title = this.add.text(GAME_WIDTH / 2, 36, "", { fontFamily: FONT, fontSize: "26px", color: "#ffffff", fontStyle: "700" }).setOrigin(0.5);
    this.scoreText = this.add.text(GAME_WIDTH - 20, 36, "Score 0", { fontFamily: FONT, fontSize: "22px", color: "#fde047", fontStyle: "700" }).setOrigin(1, 0.5);
    this.cat = this.add.text(GAME_WIDTH / 2, 100, "", { fontFamily: FONT, fontSize: "46px" }).setOrigin(0.5);
    this.qText = this.add
      .text(GAME_WIDTH / 2, 170, "", { fontFamily: FONT, fontSize: "30px", color: "#ffffff", fontStyle: "700", align: "center", wordWrap: { width: 820 } })
      .setOrigin(0.5);
    this.fact = this.add
      .text(GAME_WIDTH / 2, 436, "", { fontFamily: FONT, fontSize: "20px", color: "#fde047", align: "center", wordWrap: { width: 860 } })
      .setOrigin(0.5);

    this.hideMenu = addMenuButton(this, () => {
      if (!this.dead) this.scene.start("Menu");
    });

    showLevelPicker(this, "Brain Quiz 🧠", "Science, space, nature and the world.\nLearn a fun fact after every answer!", (tier) => {
      const bank = tier === 0 ? EASY : HARD;
      this.questions = Phaser.Utils.Array.Shuffle([...bank]).slice(0, ROUNDS);
      gameAudio.unlock();
      gameAudio.startMusic();
      this.nextRound();
    });
  }

  private nextRound(): void {
    this.board?.clear();
    this.nextBtn?.container.destroy();
    this.nextBtn = null;
    this.fact.setText("");

    if (this.round >= this.questions.length) {
      this.finish();
      return;
    }
    const [emoji, question, right, wrong, fact] = this.questions[this.round];
    this.round += 1;
    this.title.setText(`Question ${this.round} of ${this.questions.length}`);
    this.cat.setText(emoji);
    this.qText.setText(question);

    const all = Phaser.Utils.Array.Shuffle([right, ...wrong]);
    this.board = new ChoiceBoard(this, GAME_WIDTH / 2, 262, 2, 400, 70);
    this.board.show(
      all,
      all.indexOf(right),
      (ok) => {
        if (ok) {
          this.correct += 1;
          this.streak += 1;
          this.score += 10 + Math.min(this.streak - 1, 5) * 2;
          gameAudio.coin();
        } else {
          this.streak = 0;
          gameAudio.hit();
        }
        this.scoreText.setText(`Score ${this.score}`);
        this.fact.setText(`${ok ? "Correct! " : `The answer is ${right}. `}💡 ${fact}`);
        this.nextBtn = makeButton(this, GAME_WIDTH / 2, 494, 240, 50, this.round >= this.questions.length ? "Finish ▶" : "Next ▶", 0x16a34a, () => this.nextRound(), 24);
      },
      24
    );
  }

  private finish(): void {
    this.dead = true;
    gameAudio.stopMusic();
    this.lockUntil = this.time.now + 500;
    this.hideMenu();
    showGameOver(this, `${this.correct}/${this.questions.length} correct · Score ${this.score}`, () => this.scene.restart(), () => this.scene.start("Menu"), "Quiz Champion!");
  }

  update(time: number): void {
    if (!this.dead || time < this.lockUntil) return;
    const tap = pollEndTaps();
    if (tap === "restart") this.scene.restart();
    else if (tap === "menu") this.scene.start("Menu");
  }
}
