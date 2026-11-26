import { QA, QUIZ_EASY as EASY, QUIZ_HARD as HARD } from "../data/quizBank";
import { FONT } from "../ui/theme";
import { ChoiceGameScene, GameCfg, Round, shuffle, withAnswer } from "./ChoiceGameScene";




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
