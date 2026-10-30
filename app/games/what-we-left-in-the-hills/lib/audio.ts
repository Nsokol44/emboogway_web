/* Synthesized audio for What We Left in The Hills — no audio assets.
   Every monster carries a looping growl/breath voice (oscillators + filtered
   noise through a waveshaper). Loudness and stereo pan are computed per frame
   from the monster's real distance and bearing relative to the camera, so
   your ears are a true radar. The fog can also make the radar lie: a false
   growl is the same synth fired once from an empty direction. */

interface MonsterVoice {
  gain: GainNode;
  pan: StereoPannerNode;
  growlOsc: OscillatorNode;
  subOsc: OscillatorNode;
  noiseGain: GainNode;
  filter: BiquadFilterNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
  chaseMix: GainNode;
}

export class HillsAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices: MonsterVoice[] = [];
  private windGain: GainNode | null = null;
  private started = false;

  /** Create/resume the context. Must be called from a user gesture. */
  ensure() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AC: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(this.ctx.destination);
      this.startWind();
      this.started = true;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  get running() {
    return this.started && !!this.ctx;
  }

  private noiseBuffer(seconds = 2): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private startWind() {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(3);
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 320;
    const g = ctx.createGain();
    g.gain.value = 0.035;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.015;
    lfo.connect(lfoG).connect(g.gain);
    src.connect(lp).connect(g).connect(this.master!);
    src.start();
    lfo.start();
    this.windGain = g;
  }

  private shaperCurve(): Float32Array<ArrayBuffer> {
    const n = 256;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(2.4 * x);
    }
    return curve;
  }

  /** One looping growl voice for a monster. Call once per monster at start. */
  makeVoice(): number {
    if (!this.ctx || !this.master) return -1;
    const ctx = this.ctx;
    const idx = this.voices.length;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    const pan = ctx.createStereoPanner();
    gain.connect(pan).connect(this.master);

    const shaper = ctx.createWaveShaper();
    shaper.curve = this.shaperCurve();
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 300;
    filter.Q.value = 1.6;
    shaper.connect(filter).connect(gain);

    const growlOsc = ctx.createOscillator();
    growlOsc.type = "sawtooth";
    growlOsc.frequency.value = 52 + idx * 7;
    const subOsc = ctx.createOscillator();
    subOsc.type = "square";
    subOsc.frequency.value = 34 + idx * 4;
    const oscGain = ctx.createGain();
    oscGain.gain.value = 0.5;
    growlOsc.connect(oscGain);
    subOsc.connect(oscGain);
    oscGain.connect(shaper);

    // breath: banded noise swelling against the growl
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(2.7);
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 900;
    noiseFilter.Q.value = 0.8;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.12;
    noise.connect(noiseFilter).connect(noiseGain).connect(shaper);

    // growl undulation
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.8 + idx * 0.17;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 130;
    lfo.connect(lfoGain).connect(filter.frequency);

    const chaseMix = ctx.createGain();
    chaseMix.gain.value = 0;

    growlOsc.start();
    subOsc.start();
    noise.start();
    lfo.start();

    this.voices.push({ gain, pan, growlOsc, subOsc, noiseGain, filter, lfo, lfoGain, chaseMix });
    return idx;
  }

  /** Per-frame: place a voice in the world. The four monster states have
      four audible shapes: unaware is low and slow; curious lifts and
      quickens; hunting is purposeful; chasing is high, fast and ragged. */
  setVoice(idx: number, level: number, pan: number, state: "unaware" | "curious" | "hunting" | "chasing" | boolean) {
    const v = this.voices[idx];
    if (!v || !this.ctx) return;
    const s = state === true ? "chasing" : state === false ? "unaware" : state;
    const t = this.ctx.currentTime;
    const target = Math.max(0, Math.min(1, level)) * 0.5;
    v.gain.gain.setTargetAtTime(target, t, 0.09);
    v.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, 0.06);
    const shape = {
      unaware: { lfo: 0.55, filter: 235, growl: 46, noise: 0.07 },
      curious: { lfo: 0.95, filter: 325, growl: 52, noise: 0.11 },
      hunting: { lfo: 1.6, filter: 415, growl: 59, noise: 0.16 },
      chasing: { lfo: 2.6, filter: 505, growl: 68, noise: 0.22 },
    }[s];
    v.lfo.frequency.setTargetAtTime(shape.lfo, t, 0.4);
    v.filter.frequency.setTargetAtTime(shape.filter, t, 0.4);
    v.growlOsc.frequency.setTargetAtTime(shape.growl + idx * 7, t, 0.4);
    v.noiseGain.gain.setTargetAtTime(shape.noise, t, 0.4);
  }

  silenceVoices() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const v of this.voices) v.gain.gain.setTargetAtTime(0, t, 0.15);
  }

  /** A one-shot growl from an empty direction — the fog lying to you. */
  falseGrowl(pan: number, level: number) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(58, t);
    osc.frequency.exponentialRampToValueAtTime(41, t + 1.1);
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.shaperCurve();
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 340;
    filter.Q.value = 1.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(Math.min(1, level) * 0.42, t + 0.28);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.35);
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    osc.connect(shaper).connect(filter).connect(g).connect(p).connect(this.master);
    osc.start(t);
    osc.stop(t + 1.45);
  }

  /** A burst of old coins — bright metallic strikes that carry. */
  coinClang() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    [2093, 2637, 3136, 1760].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = f * (0.94 + Math.random() * 0.1);
      const g = ctx.createGain();
      const at = t + i * 0.055;
      g.gain.setValueAtTime(0.16, at);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.55);
      osc.connect(g).connect(this.master!);
      osc.start(at);
      osc.stop(at + 0.6);
    });
  }

  /** A lonesome fiddle phrase, repeated while the lure sounds. */
  fiddleLure() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const start = ctx.currentTime;
    const phrase = [440, 523.25, 659.25, 523.25, 392, 440];
    for (let rep = 0; rep < 3; rep++) {
      phrase.forEach((f, i) => {
        const at = start + rep * 2.6 + i * 0.38;
        if (at > start + 8) return;
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = f;
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 1500;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(0.055, at + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, at + 0.36);
        osc.connect(filter).connect(g).connect(this.master!);
        osc.start(at);
        osc.stop(at + 0.4);
      });
    }
  }

  /** Short wooden thunk for dropping loot. */
  thunk() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(52, t + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  /** Soft tick for picking loot back up. */
  tick() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(660, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  /** Low dissonant sting — the run ends badly. */
  sting() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    for (const f of [55, 58.3, 110]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 500;
      osc.connect(lp).connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + 1.7);
    }
    this.silenceVoices();
  }

  /** Quiet two-note figure — you made it out. */
  escapeChime() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    this.silenceVoices();
    [392, 587.3].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      const g = ctx.createGain();
      const at = t + i * 0.22;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.12, at + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.9);
      osc.connect(g).connect(this.master!);
      osc.start(at);
      osc.stop(at + 1);
    });
  }

  /** Raise the wind as the fog thickens. level 0..1 */
  setWind(level: number) {
    if (!this.ctx || !this.windGain) return;
    this.windGain.gain.setTargetAtTime(0.03 + level * 0.05, this.ctx.currentTime, 0.8);
  }
}
