/** Short looping chiptune plus one-shot effects. Starts after a user gesture. */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private timer: number | null = null;
  private step = 0;
  private playing = false;
  private theme: "grass" | "lava" = "grass";

  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  setTheme(theme: "grass" | "lava"): void {
    this.theme = theme;
  }

  startMusic(): void {
    this.unlock();
    if (this.playing || !this.ctx) return;
    this.playing = true;
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.07;
    this.musicGain.connect(this.ctx.destination);
    this.step = 0;

    const lead =
      this.theme === "lava"
        ? [392, 440, 349, 330, 294, 330, 349, 392]
        : [659, 784, 880, 784, 698, 784, 988, 880, 784, 698, 659, 587];
    const bass =
      this.theme === "lava"
        ? [110, 98, 87, 98, 110, 87, 82, 98]
        : [196, 247, 220, 196, 175, 196, 220, 165];

    this.timer = window.setInterval(() => {
      if (!this.playing) return;
      this.tone(lead[this.step % lead.length], 0.16, "square", 0.045, this.musicGain!);
      if (this.step % 2 === 0) {
        this.tone(bass[(this.step / 2) % bass.length], 0.28, "triangle", 0.06, this.musicGain!);
      }
      this.step += 1;
    }, 210);
  }

  stopMusic(): void {
    this.playing = false;
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    this.musicGain?.disconnect();
    this.musicGain = null;
  }

  jump(): void {
    this.unlock();
    this.tone(520, 0.06, "square", 0.08);
    this.tone(780, 0.09, "square", 0.05);
  }

  coin(): void {
    this.unlock();
    this.tone(880, 0.05, "square", 0.06);
    window.setTimeout(() => this.tone(1175, 0.08, "square", 0.05), 60);
  }

  hit(): void {
    this.unlock();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.28);
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.32);
  }

  shoot(): void {
    this.unlock();
    this.tone(880, 0.04, "square", 0.05);
    this.tone(220, 0.06, "square", 0.04);
  }

  slash(): void {
    this.unlock();
    this.tone(180, 0.05, "sawtooth", 0.06);
    this.tone(90, 0.08, "triangle", 0.05);
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    destination?: AudioNode
  ): void {
    if (!this.ctx || this.ctx.state !== "running") return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(Math.max(volume, 0.0001), this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(destination ?? this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration + 0.02);
    } catch {
      // iPad Chrome interrupts the audio context. A throw here would stop the game loop.
    }
  }
}

export const gameAudio = new GameAudio();
