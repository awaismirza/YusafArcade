import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { setTouchChrome } from "../input/touchChrome";

/** Phaser hands the whole screen over to the Three.js Solar System Explorer. */
export class SolarScene extends Phaser.Scene {
  private dispose: (() => void) | null = null;
  private closed = false;

  constructor() {
    super({ key: "Solar" });
  }

  create(): void {
    this.closed = false;
    setTouchChrome("hidden");
    this.cameras.main.setBackgroundColor(0x02030a);
    const loading = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "Launching the solar system… 🚀", { fontFamily: "system-ui, sans-serif", fontSize: "26px", color: "#ffffff" })
      .setOrigin(0.5);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.closed = true;
      this.dispose?.();
      this.dispose = null;
    });

    import("../solar/solarApp")
      .then(({ startSolar }) => {
        if (this.closed) return;
        this.dispose = startSolar(() => this.scene.start("Menu"));
        loading.destroy();
      })
      .catch(() => loading.setText("Sorry, the 3D view could not start on this device."));
  }
}
