class SoundFxEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  public muted = false;

  private ensureGraph(): { ctx: AudioContext; out: AudioNode } | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 18;
      comp.ratio.value = 6;
      const master = this.ctx.createGain();
      master.gain.value = 0.72;
      comp.connect(master);
      master.connect(this.ctx.destination);
      this.masterGain = comp as unknown as GainNode;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (!this.noiseBuf && this.ctx) {
      const len = Math.floor(this.ctx.sampleRate * 1.5);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        ch[i] = Math.random() * 2 - 1;
      }
      this.noiseBuf = buf;
    }
    return this.masterGain ? { ctx: this.ctx, out: this.masterGain } : null;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainVal = 0.08,
    delay = 0,
    endFreq?: number,
    filterHz?: number
  ) {
    const g = this.ensureGraph();
    if (!g) return;
    const { ctx, out } = g;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq && endFreq > 0) {
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
    }

    gain.gain.setValueAtTime(0.0008, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.002, gainVal), now + Math.min(0.03, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    if (filterHz) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(filterHz, now);
      osc.connect(lp);
      lp.connect(gain);
    } else {
      osc.connect(gain);
    }
    gain.connect(out);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  private playNoiseBurst(
    duration: number,
    filterType: BiquadFilterType,
    freqStart: number,
    freqEnd: number,
    q: number,
    gainVal: number,
    delay = 0
  ) {
    const g = this.ensureGraph();
    if (!g || !this.noiseBuf) return;
    const { ctx, out } = g;
    const now = ctx.currentTime + delay;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(freqStart, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(gainVal, now + Math.min(0.025, duration * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    src.start(now);
    src.stop(now + duration + 0.03);
  }

  private playBrassVoice(freq: number, duration: number, gainVal: number, delay = 0) {
    this.playTone(freq, duration, 'sawtooth', gainVal * 0.55, delay, undefined, freq * 3.2);
    this.playTone(freq * 1.004, duration, 'triangle', gainVal * 0.6, delay);
    this.playTone(freq * 0.5, duration * 0.9, 'triangle', gainVal * 0.38, delay);
  }

  playClick() {
    this.playTone(620, 0.055, 'triangle', 0.045, 0, 440);
  }

  playMove(isNaval = false) {
    if (isNaval) {
      this.playNoiseBurst(0.24, 'bandpass', 650, 260, 1.4, 0.09, 0);
      this.playTone(180, 0.14, 'sine', 0.05, 0.02, 130);
    } else {
      this.playTone(150, 0.08, 'triangle', 0.065, 0, 82);
      this.playNoiseBurst(0.07, 'lowpass', 900, 350, 1.0, 0.05, 0.01);
      this.playTone(165, 0.07, 'triangle', 0.05, 0.06, 95);
    }
  }

  playMeleeCombat() {
    // War drum impact + steel blade ring + secondary clash
    this.playTone(118, 0.26, 'sine', 0.16, 0, 38);
    this.playNoiseBurst(0.14, 'bandpass', 2400, 950, 2.5, 0.13, 0.01);
    this.playTone(1380, 0.19, 'triangle', 0.07, 0.02, 880);
    this.playTone(1940, 0.22, 'sine', 0.05, 0.02, 1460);
    // Counter-clash
    this.playNoiseBurst(0.16, 'highpass', 1800, 1100, 1.8, 0.10, 0.13);
    this.playTone(98, 0.22, 'triangle', 0.11, 0.12, 42);
  }

  playRangedCombat() {
    // Bowstring snap / rifle crack + whistling arrow + thud impact
    this.playNoiseBurst(0.06, 'bandpass', 3200, 1400, 3.0, 0.12, 0);
    this.playTone(680, 0.12, 'triangle', 0.06, 0, 310);
    this.playNoiseBurst(0.18, 'bandpass', 2100, 900, 6.0, 0.06, 0.04);
    this.playTone(125, 0.18, 'sine', 0.13, 0.18, 48);
    this.playNoiseBurst(0.11, 'lowpass', 950, 280, 1.2, 0.11, 0.18);
  }

  playSiegeCombat() {
    // Deep cannon / catapult launch + thunderous explosion
    this.playTone(86, 0.42, 'sawtooth', 0.16, 0, 26, 420);
    this.playNoiseBurst(0.32, 'lowpass', 1400, 140, 1.1, 0.20, 0);
    this.playTone(72, 0.55, 'sine', 0.19, 0.22, 24);
    this.playNoiseBurst(0.55, 'lowpass', 1800, 110, 0.9, 0.22, 0.22);
  }

  playCityCapture() {
    // Timpani strike + triumphant brass chord + victory bell
    this.playTone(92, 0.5, 'sine', 0.2, 0, 34);
    this.playNoiseBurst(0.35, 'lowpass', 1600, 220, 1.0, 0.18, 0);
    this.playBrassVoice(261.63, 0.48, 0.11, 0.08);
    this.playBrassVoice(329.63, 0.48, 0.10, 0.18);
    this.playBrassVoice(392.0, 0.65, 0.12, 0.28);
    this.playBrassVoice(523.25, 0.85, 0.13, 0.40);
    this.playTone(1046.5, 0.9, 'sine', 0.06, 0.42);
  }

  playCombat(kind: 'melee' | 'ranged' | 'siege' | 'naval' | 'capture' = 'melee') {
    if (kind === 'capture') {
      this.playCityCapture();
    } else if (kind === 'siege' || kind === 'naval') {
      this.playSiegeCombat();
    } else if (kind === 'ranged') {
      this.playRangedCombat();
    } else {
      this.playMeleeCombat();
    }
  }

  playCoreSpark() {
    this.playTone(587.33, 0.28, 'sine', 0.08, 0);
    this.playTone(880.0, 0.34, 'triangle', 0.07, 0.07);
    this.playTone(1174.66, 0.45, 'sine', 0.06, 0.14);
  }

  playDiscovery() {
    // Golden astrolabe harp shimmer + warm orchestral chord
    this.playTone(392.0, 0.35, 'triangle', 0.08, 0);
    this.playTone(493.88, 0.38, 'triangle', 0.08, 0.07);
    this.playTone(587.33, 0.44, 'triangle', 0.09, 0.14);
    this.playBrassVoice(783.99, 0.72, 0.09, 0.22);
    this.playTone(1174.66, 0.65, 'sine', 0.06, 0.26);
    this.playTone(1567.98, 0.75, 'sine', 0.045, 0.32);
  }

  playAgeAdvance() {
    // Grand Era Transition Fanfare + Timpani Roll
    this.playTone(84, 0.45, 'sine', 0.18, 0, 36);
    this.playNoiseBurst(0.32, 'lowpass', 950, 180, 1.2, 0.15, 0);
    this.playBrassVoice(261.63, 0.35, 0.10, 0.05);
    this.playBrassVoice(329.63, 0.35, 0.10, 0.16);
    this.playBrassVoice(392.0, 0.40, 0.11, 0.27);
    this.playBrassVoice(523.25, 0.95, 0.14, 0.40);
    this.playBrassVoice(392.0, 0.95, 0.09, 0.40);
    this.playBrassVoice(659.25, 0.95, 0.09, 0.42);
    this.playTone(1046.5, 1.1, 'sine', 0.07, 0.44);
  }

  playEventPopup() {
    this.playTone(220, 0.5, 'triangle', 0.09, 0);
    this.playTone(329.63, 0.5, 'sine', 0.07, 0.08);
    this.playTone(440, 0.6, 'triangle', 0.07, 0.16);
    this.playTone(659.25, 0.7, 'sine', 0.05, 0.24);
  }

  playNaturalDisaster(
    kind: 'shore_anomaly' | 'meteor_strike' | 'volcano_eruption' | 'river_flood' = 'meteor_strike'
  ) {
    if (kind === 'meteor_strike') {
      // Descending cosmic fireball whistle + earth-shattering crater boom + crystalline shimmer
      this.playTone(1760, 0.44, 'sawtooth', 0.09, 0, 130, 2600);
      this.playNoiseBurst(0.42, 'bandpass', 2800, 320, 2.2, 0.14, 0);
      this.playTone(68, 0.75, 'sine', 0.24, 0.36, 22);
      this.playNoiseBurst(0.75, 'lowpass', 1600, 90, 0.9, 0.24, 0.36);
      this.playTone(1174.66, 0.65, 'sine', 0.06, 0.68);
      this.playTone(1567.98, 0.75, 'triangle', 0.05, 0.78);
    } else if (kind === 'volcano_eruption') {
      // Subterranean tectonic rumble + explosive pyroclastic blast + lightning crackle
      this.playTone(54, 0.9, 'sawtooth', 0.18, 0, 26, 240);
      this.playNoiseBurst(0.85, 'lowpass', 850, 95, 0.8, 0.22, 0);
      this.playTone(82, 0.68, 'sine', 0.22, 0.24, 24);
      this.playNoiseBurst(0.55, 'bandpass', 2200, 420, 1.4, 0.16, 0.28);
      this.playBrassVoice(146.83, 0.75, 0.11, 0.35);
    } else if (kind === 'river_flood') {
      // Thunderclap + surging whitewater deluge + resonant discovery chord
      this.playNoiseBurst(0.28, 'lowpass', 1800, 180, 1.1, 0.18, 0);
      this.playTone(76, 0.55, 'sine', 0.18, 0, 32);
      this.playNoiseBurst(0.85, 'bandpass', 420, 960, 1.3, 0.16, 0.15);
      this.playTone(293.66, 0.55, 'triangle', 0.08, 0.42);
      this.playTone(440.0, 0.65, 'sine', 0.07, 0.52);
    } else {
      // Storm-tossed shore anomaly: crashing gale surf + mysterious harmonic resonance
      this.playNoiseBurst(0.72, 'bandpass', 920, 240, 1.5, 0.17, 0);
      this.playTone(92, 0.55, 'sine', 0.15, 0.05, 44);
      this.playTone(392.0, 0.65, 'triangle', 0.08, 0.28);
      this.playTone(587.33, 0.72, 'sine', 0.08, 0.38);
      this.playTone(880.0, 0.85, 'sine', 0.065, 0.48);
    }
  }

  playTurnEnd() {
    this.playTone(196, 0.26, 'triangle', 0.08, 0);
    this.playTone(293.66, 0.32, 'sine', 0.065, 0.09);
    this.playNoiseBurst(0.14, 'bandpass', 1100, 600, 1.8, 0.04, 0.02);
  }
}

export const soundFx = new SoundFxEngine();
