// Majestic Interstellar Space Web Audio Engine
// Inspired by Hans Zimmer's iconic "First Step" / "Day One" / "Stay" pipe organ & piano score
// Features: Sacred church organ & celestial piano synthesis, cathedral space reverb network,
// rhythmic cosmic clock ticks (Miller's planet time dilation), and smooth relativistic gravitational redshift.

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private reverbBus: GainNode | null = null;
  private dryBus: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;
  private isMuted: boolean = true;
  private isInitialized: boolean = false;

  // Interstellar score state
  private timeDilation: number = 1.0;
  private currentProximity: number = 0; // 0.0 to 1.0 (Schwarzschild proximity)
  private isCinematicMode: boolean = false;
  private interactionWarmth: number = 0.0; // smooth 0.0 to 1.0

  // Scheduler state
  private schedulerTimer: ReturnType<typeof setInterval> | null = null;
  private warmthTimer: ReturnType<typeof setInterval> | null = null;
  private nextBeatTime: number = 0;
  private currentBeatIndex: number = 0;
  private currentChordIndex: number = 0;

  // Active continuous drone oscillators for dynamic pitch and filter bending
  private droneOscs: { osc: OscillatorNode; baseFreq: number; gain: GainNode }[] = [];

  // Authentic Interstellar 4-Chord Progression (Am -> F -> C -> G/Em)
  // Each chord has warm organ pad pedal frequencies (Roots, 5ths, Octaves, 3rds)
  private readonly chords = [
    {
      name: "Am",
      bass: 55.00, // A1 (deep pedal)
      pad: [110.00, 164.81, 220.00, 261.63], // A2, E3, A3, C4
      melody: [
        220.00, // A3 (warm, deep felt melody)
        246.94, // B3
        261.63, // C4
        329.63, // E4 (soaring, warm, non-piercing)
        293.66, // D4
        261.63, // C4
        246.94, // B3
        220.00, // A3
      ],
    },
    {
      name: "F",
      bass: 43.65, // F1
      pad: [87.31, 130.81, 174.61, 220.00], // F2, C3, F3, A3
      melody: [
        174.61, // F3
        220.00, // A3
        261.63, // C4
        329.63, // E4
        349.23, // F4
        329.63, // E4
        293.66, // D4
        261.63, // C4
      ],
    },
    {
      name: "C",
      bass: 65.41, // C2
      pad: [130.81, 196.00, 261.63, 329.63], // C3, G3, C4, E4
      melody: [
        164.81, // E3
        196.00, // G3
        261.63, // C4
        329.63, // E4
        392.00, // G4
        329.63, // E4
        293.66, // D4
        261.63, // C4
      ],
    },
    {
      name: "G/Em",
      bass: 49.00, // G1 / E1 pedal
      pad: [98.00, 146.83, 196.00, 246.94], // G2, D3, G3, B3
      melody: [
        196.00, // G3
        246.94, // B3
        293.66, // D4
        329.63, // E4
        293.66, // D4
        246.94, // B3
        196.00, // G3
        164.81, // E3
      ],
    },
  ];

  init() {
    if (this.isInitialized) return;
    try {
      if (typeof window === "undefined") {
        return;
      }
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        return;
      }
      this.ctx = new AudioCtx();

      // Master output gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;

      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      // Lowpass filter for the entire space acoustic field (warm analog space roll-off)
      this.droneFilter = this.ctx.createBiquadFilter();
      this.droneFilter.type = "lowpass";
      this.droneFilter.frequency.setValueAtTime(520, this.ctx.currentTime);
      this.droneFilter.Q.setValueAtTime(0.7, this.ctx.currentTime);

      // Dry & Reverb buses
      this.dryBus = this.ctx.createGain();
      this.dryBus.gain.setValueAtTime(0.75, this.ctx.currentTime);
      this.dryBus.connect(this.droneFilter);

      this.reverbBus = this.ctx.createGain();
      this.reverbBus.gain.setValueAtTime(0.48, this.ctx.currentTime);

      // Algorithmic Space Reverb Network (diffuse multi-tap stereo delay)
      this.buildSpaceReverbNetwork();

      this.droneFilter.connect(this.masterGain);

      this.isInitialized = true;
      this.startAmbientOrganDrones();
      this.startMusicScheduler();
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  }

  /**
   * Multi-tap celestial reverb network giving the sacred, cavernous acoustic space
   * of Temple Church organ acoustics in London.
   */
  private buildSpaceReverbNetwork() {
    if (!this.ctx || !this.reverbBus || !this.droneFilter) return;

    const delayTimes = [0.28, 0.46, 0.72, 1.15];
    const feedbacks = [0.38, 0.32, 0.28, 0.22];

    delayTimes.forEach((dt, idx) => {
      if (!this.ctx || !this.reverbBus || !this.droneFilter) return;
      const delay = this.ctx.createDelay(2.5);
      delay.delayTime.setValueAtTime(dt, this.ctx.currentTime);

      const fbGain = this.ctx.createGain();
      fbGain.gain.setValueAtTime(feedbacks[idx] || 0.25, this.ctx.currentTime);

      const dampFilter = this.ctx.createBiquadFilter();
      dampFilter.type = "lowpass";
      dampFilter.frequency.setValueAtTime(480 - idx * 60, this.ctx.currentTime);

      // Connect loop
      this.reverbBus.connect(delay);
      delay.connect(dampFilter);
      dampFilter.connect(fbGain);
      fbGain.connect(delay); // feedback loop
      dampFilter.connect(this.droneFilter);
    });
  }

  private startAmbientOrganDrones() {
    if (!this.ctx || !this.droneFilter) return;

    // Sub-harmonic anchor pedals: Deep C1, A1, E2
    const droneFrequencies = [27.5, 55.0, 110.0, 164.81];

    this.droneOscs = [];
    droneFrequencies.forEach((freq, idx) => {
      if (!this.ctx || !this.droneFilter) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // Deep foundation sine for sub, warm triangle for low organ pipes
      osc.type = idx === 0 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.detune.setValueAtTime((idx - 1.5) * 3, this.ctx.currentTime);

      const vol = idx === 0 ? 0.08 : 0.035 / (idx * 0.8 + 1);
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);

      osc.connect(gain);
      gain.connect(this.droneFilter);
      osc.start();

      this.droneOscs.push({ osc, baseFreq: freq, gain });
    });
  }

  private startMusicScheduler() {
    if (!this.ctx) return;
    this.nextBeatTime = this.ctx.currentTime + 0.15;
    this.currentBeatIndex = 0;
    this.currentChordIndex = 0;

    // 25ms scheduling loop
    this.schedulerTimer = setInterval(() => this.scheduleNextBeats(), 25);

    // Warmth decay back to serene calm
    this.warmthTimer = setInterval(() => {
      this.interactionWarmth = Math.max(0, this.interactionWarmth - 0.02);
    }, 150);
  }

  private scheduleNextBeats() {
    if (!this.ctx || this.isMuted) return;
    const scheduleAheadTime = 0.18;

    // Driving Interstellar ostinato tempo (0.50s per beat / 120 BPM - matching the 2.5x speed as new normal)
    // Slower around black hole via gravitational proximity time dilation
    const baseSecondsPerBeat = 0.50;
    const dilationFactor = Math.max(0.2, this.timeDilation);
    const gravityFactor = 1.0 + this.currentProximity * 2.2;
    const secondsPerBeat = (baseSecondsPerBeat / dilationFactor) * gravityFactor;

    if (this.nextBeatTime < this.ctx.currentTime) {
      this.nextBeatTime = this.ctx.currentTime + 0.05;
    }

    while (this.nextBeatTime < this.ctx.currentTime + scheduleAheadTime) {
      this.playInterstellarBeat(this.nextBeatTime, secondsPerBeat);
      this.nextBeatTime += secondsPerBeat;
      this.currentBeatIndex++;

      // Each chord lasts 8 beats (4 seconds in normal time)
      if (this.currentBeatIndex % 8 === 0) {
        this.currentChordIndex = (this.currentChordIndex + 1) % this.chords.length;
      }
    }
  }

  /**
   * Synthesizes the celestial felt piano / pipe organ note and the iconic gravitational clock tick.
   */
  private playInterstellarBeat(time: number, beatDuration: number) {
    if (!this.ctx || !this.dryBus || !this.reverbBus) return;

    const chord = this.chords[this.currentChordIndex] || this.chords[0]!;
    const melodyStep = this.currentBeatIndex % chord.melody.length;
    const baseMelodyFreq = chord.melody[melodyStep] || 220;

    // Gravitational redshift drops acoustic pitch gracefully
    const redshiftFactor = Math.max(0.35, 1.0 - this.currentProximity * 0.65);
    const freq = baseMelodyFreq * redshiftFactor;

    // 1. CELESTIAL PIPE ORGAN / FELT PIANO NOTE (Warm, deep, grounded)
    const osc1 = this.ctx.createOscillator(); // 8' Principal tone
    const osc2 = this.ctx.createOscillator(); // Sub/Unison warmth
    const noteGain = this.ctx.createGain();
    const noteFilter = this.ctx.createBiquadFilter();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(freq, time);

    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(freq, time); // Unison with subtle organic analog detune
    osc2.detune.setValueAtTime(-5, time); // warm, thick acoustic chorus

    noteFilter.type = "lowpass";
    const filterCutoff = Math.max(160, (380 + this.interactionWarmth * 80) * redshiftFactor);
    noteFilter.frequency.setValueAtTime(filterCutoff, time);
    noteFilter.Q.setValueAtTime(0.85, time);

    // Warm, singing acoustic attack and expansive bell-like sustain
    const baseVol = 0.046 * (1.0 + this.interactionWarmth * 0.25);
    const noteLength = beatDuration * 1.8; // notes overlap and ring into each other
    const attack = Math.min(0.035, beatDuration * 0.1);
    const decay = Math.min(0.2, beatDuration * 0.45);

    noteGain.gain.setValueAtTime(0.0, time);
    noteGain.gain.linearRampToValueAtTime(baseVol, time + attack);
    noteGain.gain.linearRampToValueAtTime(baseVol * 0.6, time + decay);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, time + noteLength);
    noteGain.gain.linearRampToValueAtTime(0.0, time + noteLength + 0.04);

    osc1.connect(noteGain);
    osc2.connect(noteGain);
    noteGain.connect(noteFilter);

    // Send to both dry and space reverb buses
    noteFilter.connect(this.dryBus);
    noteFilter.connect(this.reverbBus);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + noteLength + 0.08);
    osc2.stop(time + noteLength + 0.08);

    // 2. SACRED ORGAN PAD CHORD SWELL (Triggers smoothly every 8 beats)
    if (this.currentBeatIndex % 8 === 0) {
      this.playOrganPadSwell(time, chord, beatDuration * 8.5, redshiftFactor);
    }

    // 3. THE ICONIC "INTERSTELLAR" CLOCK TICK (Miller's Planet Time Dilation Tick)
    this.playClockTick(time, redshiftFactor);
  }

  /**
   * The soft rhythmic clock pulse of Interstellar (each tick signifies time passing on Earth).
   * Muted, deep acoustic wood block tap (no high pitched clicks).
   */
  private playClockTick(time: number, redshiftFactor: number) {
    if (!this.ctx || !this.dryBus) return;

    const tickOsc = this.ctx.createOscillator();
    const tickFilter = this.ctx.createBiquadFilter();
    const tickGain = this.ctx.createGain();

    tickOsc.type = "sine";
    const tickFreq = (160 + Math.random() * 20) * redshiftFactor;
    tickOsc.frequency.setValueAtTime(tickFreq, time);
    tickOsc.frequency.exponentialRampToValueAtTime(45 * redshiftFactor, time + 0.04);

    tickFilter.type = "lowpass";
    tickFilter.frequency.setValueAtTime(220 * redshiftFactor, time);
    tickFilter.Q.setValueAtTime(1.2, time);

    // Extremely gentle, quiet ticking pulse (deep woodblock tap, zero shrillness)
    const tickVol = 0.02 * (1.0 - this.currentProximity * 0.4);
    tickGain.gain.setValueAtTime(0.0, time);
    tickGain.gain.linearRampToValueAtTime(tickVol, time + 0.005);
    tickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);
    tickGain.gain.linearRampToValueAtTime(0.0, time + 0.05);

    tickOsc.connect(tickFilter);
    tickFilter.connect(tickGain);
    tickGain.connect(this.dryBus);

    tickOsc.start(time);
    tickOsc.stop(time + 0.055);
  }

  /**
   * Synthesizes breathing, majestic church organ choir pads with sub-harmonic pedals.
   */
  private playOrganPadSwell(time: number, chord: (typeof this.chords)[0], duration: number, redshiftFactor: number) {
    if (!this.ctx || !this.reverbBus) return;

    // Sub-bass pedal note
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(chord.bass * redshiftFactor, time);

    const subVol = 0.06;
    subGain.gain.setValueAtTime(0.0, time);
    subGain.gain.linearRampToValueAtTime(subVol, time + 1.2);
    subGain.gain.linearRampToValueAtTime(subVol * 0.8, time + duration * 0.7);
    subGain.gain.linearRampToValueAtTime(0.0, time + duration);

    subOsc.connect(subGain);
    if (this.droneFilter) subGain.connect(this.droneFilter);
    subOsc.start(time);
    subOsc.stop(time + duration + 0.1);

    // Lush organ 4-voice chord
    chord.pad.forEach((noteFreq, pIdx) => {
      if (!this.ctx || !this.reverbBus) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = pIdx % 2 === 0 ? "triangle" : "sine";
      osc.frequency.setValueAtTime(noteFreq * redshiftFactor, time);
      osc.detune.setValueAtTime((pIdx - 1.5) * 4, time);

      const chordVol = 0.024 / (pIdx + 1);
      gain.gain.setValueAtTime(0.0, time);
      gain.gain.linearRampToValueAtTime(chordVol, time + 1.8);
      gain.gain.linearRampToValueAtTime(chordVol * 0.75, time + duration * 0.65);
      gain.gain.linearRampToValueAtTime(0.0, time + duration);

      osc.connect(gain);
      gain.connect(this.reverbBus);
      osc.start(time);
      osc.stop(time + duration + 0.15);
    });
  }

  // --- API METHODS & CONTROLS ---

  pingInteraction() {
    this.interactionWarmth = Math.min(1.0, this.interactionWarmth + 0.08);
  }

  setMute(muted: boolean) {
    this.isMuted = muted;
    if (!this.isInitialized && !muted) {
      this.init();
    }

    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }

    if (this.masterGain && this.ctx) {
      const targetVolume = muted ? 0 : 0.38;
      this.masterGain.gain.setTargetAtTime(targetVolume, this.ctx.currentTime, 0.4);
    }
  }

  getMuteState(): boolean {
    return this.isMuted;
  }

  getMusicAmplitude(): number {
    if (!this.isInitialized || !this.analyser || this.isMuted) return 0;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i]!;
    }
    const avg = sum / dataArray.length;
    return avg / 255.0;
  }

  getFrequencyBands(): { bass: number; mid: number; treble: number } {
    if (!this.isInitialized || !this.analyser || this.isMuted) {
      return { bass: 0, mid: 0, treble: 0 };
    }
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    let bassSum = 0;
    let midSum = 0;
    let trebleSum = 0;

    for (let i = 0; i < 6; i++) {
      bassSum += dataArray[i] || 0;
    }
    for (let i = 6; i < 16; i++) {
      midSum += dataArray[i] || 0;
    }
    for (let i = 16; i < 32; i++) {
      trebleSum += dataArray[i] || 0;
    }

    return {
      bass: (bassSum / 6) / 255.0,
      mid: (midSum / 10) / 255.0,
      treble: (trebleSum / 16) / 255.0,
    };
  }

  setTimeDilation(dilation: number) {
    this.timeDilation = Math.max(0.15, Math.min(3.0, dilation));
    if (this.ctx && this.droneFilter) {
      const targetFreq = 260 + 260 * this.timeDilation;
      this.droneFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.5);
    }
  }

  setCinematicMode(enabled: boolean) {
    this.isCinematicMode = enabled;
    if (!this.ctx || !this.masterGain || !this.droneFilter) return;

    if (enabled) {
      this.droneFilter.frequency.setTargetAtTime(420, this.ctx.currentTime, 0.8);
      this.droneFilter.Q.setTargetAtTime(1.1, this.ctx.currentTime, 0.8);
    } else {
      this.droneFilter.frequency.setTargetAtTime(520, this.ctx.currentTime, 0.8);
      this.droneFilter.Q.setTargetAtTime(0.7, this.ctx.currentTime, 0.8);
    }
  }

  /**
   * Smooth relativistic gravitational proximity (Schwarzschild Event Horizon).
   * Dynamically and gracefully slows down time, redshifts pitch into a warm cosmic rumble,
   * and stretches out clock ticks without any jarring jumps.
   */
  setGravitationalProximity(proximity: number) {
    if (!this.ctx || !this.droneFilter) return;
    this.currentProximity = Math.max(0, Math.min(1.0, proximity));
    const now = this.ctx.currentTime;

    // Filter frequency drops smoothly from 520Hz down to 110Hz (deep sub-bass space-time redshift)
    const targetCutoff = Math.max(110, 520 * (1.0 - this.currentProximity * 0.78));
    this.droneFilter.frequency.setTargetAtTime(targetCutoff, now, 0.4);
    this.droneFilter.Q.setTargetAtTime(0.7 + this.currentProximity * 1.8, now, 0.4);

    // Ambient organ drones gently pitch shift down (gravitational time dilation)
    const pitchFactor = Math.max(0.35, 1.0 - this.currentProximity * 0.65);
    this.droneOscs.forEach(({ osc, baseFreq }) => {
      osc.frequency.setTargetAtTime(baseFreq * pitchFactor, now, 0.4);
    });
  }

  updateSchwarzschildProximity(proximity: number) {
    this.setGravitationalProximity(proximity);
  }

  playCameraShutter() {
    if (!this.ctx || this.isMuted || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.setValueAtTime(1600, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.08);

    filter.type = "highpass";
    filter.frequency.setValueAtTime(450, now);

    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    gain.gain.linearRampToValueAtTime(0.0, now + 0.13);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.14);
  }

  playInteractiveMallet(intensity: number, relativeX: number) {
    this.pingInteraction();
    if (!this.ctx || this.isMuted || !this.reverbBus) return;
    const now = this.ctx.currentTime;

    // Harmonic warm marimba / singing bowl bar (low pitched, rounded, zero piercing highs)
    const chord = this.chords[this.currentChordIndex] || this.chords[0]!;
    const note = chord.melody[Math.floor(relativeX * chord.melody.length) % chord.melody.length] || 220;

    const chime = this.ctx.createOscillator();
    const chimeFilter = this.ctx.createBiquadFilter();
    const chimeGain = this.ctx.createGain();

    chime.type = "sine";
    chime.frequency.setValueAtTime(note, now); // Natural deep register

    chimeFilter.type = "lowpass";
    chimeFilter.frequency.setValueAtTime(380, now);

    const vol = Math.min(0.035, Math.max(0.005, intensity * 0.025));
    chimeGain.gain.setValueAtTime(0.0, now);
    chimeGain.gain.linearRampToValueAtTime(vol, now + 0.02);
    chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
    chimeGain.gain.linearRampToValueAtTime(0.0, now + 1.85);

    chime.connect(chimeFilter);
    chimeFilter.connect(chimeGain);
    chimeGain.connect(this.reverbBus);

    chime.start(now);
    chime.stop(now + 1.9);
  }

  playStageSwell(stageIndex: number) {
    this.pingInteraction();
    if (!this.ctx || this.isMuted || !this.reverbBus) return;
    const now = this.ctx.currentTime;

    // Full cathedral organ swell matching the iconic Interstellar crescendo
    const chord = this.chords[stageIndex % this.chords.length] || this.chords[0]!;
    const freqs = [chord.bass, ...chord.pad];

    freqs.forEach((freq, idx) => {
      if (!this.ctx || !this.reverbBus) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = idx === 0 ? "sawtooth" : "triangle";
      osc.frequency.setValueAtTime(freq, now);

      const vol = 0.038 / (idx * 0.7 + 1);
      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(vol, now + 1.6);
      gain.gain.linearRampToValueAtTime(vol * 0.5, now + 3.8);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 5.2);
      gain.gain.linearRampToValueAtTime(0.0, now + 5.3);

      osc.connect(gain);
      gain.connect(this.reverbBus);

      osc.start(now);
      osc.stop(now + 5.4);
    });
  }

  playSupernova() {
    if (!this.ctx || this.isMuted || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Sub-bass resonating impulse (deep physical rumble)
    const subOsc1 = this.ctx.createOscillator();
    const subOsc2 = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();

    subOsc1.type = "sine";
    subOsc1.frequency.setValueAtTime(75, now);
    subOsc1.frequency.exponentialRampToValueAtTime(24, now + 1.8);

    subOsc2.type = "triangle";
    subOsc2.frequency.setValueAtTime(77, now);
    subOsc2.frequency.exponentialRampToValueAtTime(23, now + 1.8);

    subGain.gain.setValueAtTime(0.0, now);
    subGain.gain.linearRampToValueAtTime(0.55, now + 0.05);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 2.6);
    subGain.gain.linearRampToValueAtTime(0.0, now + 2.7);

    subOsc1.connect(subGain);
    subOsc2.connect(subGain);
    subGain.connect(this.masterGain);

    subOsc1.start(now);
    subOsc2.start(now);
    subOsc1.stop(now + 2.75);
    subOsc2.stop(now + 2.75);

    // Brown noise rumble
    const bufferSize = this.ctx.sampleRate * 2.5;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2.0 - 1.0;
      output[i] = (lastOut + (0.022 * white)) / 1.022;
      lastOut = output[i];
      output[i] *= 3.5;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.setValueAtTime(220, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(32, now + 2.2);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0, now);
    noiseGain.gain.linearRampToValueAtTime(0.42, now + 0.08);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
    noiseGain.gain.linearRampToValueAtTime(0.0, now + 2.6);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noiseSource.start(now);
    noiseSource.stop(now + 2.65);
  }

  playFrameShatter() {
    if (!this.ctx || this.isMuted || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // 1. Crystalline Spacetime Fracture Clatter (High-energy glass harmonic fissures)
    const crackFrequencies = [2400, 3200, 4100, 1850];
    crackFrequencies.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, now + idx * 0.012);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.22 + idx * 0.02);

      filter.type = "bandpass";
      filter.frequency.setValueAtTime(freq * 0.85, now + idx * 0.012);
      filter.Q.setValueAtTime(4.2, now);

      gain.gain.setValueAtTime(0.0, now + idx * 0.012);
      gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.012 + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25 + idx * 0.02);
      gain.gain.linearRampToValueAtTime(0.0, now + 0.28 + idx * 0.02);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now + idx * 0.012);
      osc.stop(now + 0.3 + idx * 0.02);
    });

    // 2. Deep Sub-bass Singularity Metric Implosion
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();

    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(95, now);
    subOsc.frequency.exponentialRampToValueAtTime(26, now + 1.2);

    subGain.gain.setValueAtTime(0.0, now);
    subGain.gain.linearRampToValueAtTime(0.5, now + 0.04);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
    subGain.gain.linearRampToValueAtTime(0.0, now + 1.85);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);

    subOsc.start(now);
    subOsc.stop(now + 1.9);
  }

  playRippleShockwave() {
    if (!this.ctx || this.isMuted || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Subtle tactile resonant click & soft cosmic sub-pulse
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.28);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(260, now);
    filter.frequency.exponentialRampToValueAtTime(40, now + 0.28);

    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    gain.gain.linearRampToValueAtTime(0.0, now + 0.29);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  playTidalDisruption(stage: "approach" | "spaghettify" | "grb" = "spaghettify") {
    if (!this.ctx || this.isMuted || !this.masterGain) return;
    const now = this.ctx.currentTime;

    if (stage === "approach") {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(65, now);
      osc.frequency.exponentialRampToValueAtTime(130, now + 1.8);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(200, now);
      filter.frequency.exponentialRampToValueAtTime(800, now + 1.8);
      filter.Q.setValueAtTime(2.5, now);

      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.6);
      gain.gain.linearRampToValueAtTime(0.0, now + 2.0);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 2.1);
    } else if (stage === "spaghettify") {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(48, now + 1.4);

      filter.type = "bandpass";
      filter.frequency.setValueAtTime(550, now);
      filter.frequency.exponentialRampToValueAtTime(130, now + 1.4);
      filter.Q.setValueAtTime(3.5, now);

      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(0.24, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      gain.gain.linearRampToValueAtTime(0.0, now + 1.6);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 1.65);
    } else if (stage === "grb") {
      const oscHigh = this.ctx.createOscillator();
      const gainHigh = this.ctx.createGain();
      oscHigh.type = "sawtooth";
      oscHigh.frequency.setValueAtTime(1200, now);
      oscHigh.frequency.exponentialRampToValueAtTime(160, now + 1.2);

      gainHigh.gain.setValueAtTime(0.0, now);
      gainHigh.gain.linearRampToValueAtTime(0.3, now + 0.04);
      gainHigh.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
      gainHigh.gain.linearRampToValueAtTime(0.0, now + 1.5);

      const filterHigh = this.ctx.createBiquadFilter();
      filterHigh.type = "bandpass";
      filterHigh.frequency.setValueAtTime(1000, now);
      filterHigh.Q.setValueAtTime(2.2, now);

      oscHigh.connect(filterHigh);
      filterHigh.connect(gainHigh);
      gainHigh.connect(this.masterGain);
      oscHigh.start(now);
      oscHigh.stop(now + 1.55);

      this.playSupernova();
    }
  }

  playProbeLaunch() {
    if (!this.ctx || this.isMuted || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.18);

    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    gain.gain.linearRampToValueAtTime(0.0, now + 0.32);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.33);
  }

  playProbeSlingshot(speedFactor: number = 1.0) {
    if (!this.ctx || this.isMuted || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = "triangle";
    const baseFreq = 340 + Math.min(500, speedFactor * 100);
    osc.frequency.setValueAtTime(baseFreq * 0.7, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.6, now + 0.14);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.8, now + 0.36);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(baseFreq, now);
    filter.Q.setValueAtTime(2.8, now);

    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    gain.gain.linearRampToValueAtTime(0.0, now + 0.42);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.44);
  }

  playProbeSwallowed() {
    if (!this.ctx || this.isMuted || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.35);

    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    gain.gain.linearRampToValueAtTime(0.0, now + 0.4);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.42);
  }

  dispose() {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    if (this.warmthTimer) {
      clearInterval(this.warmthTimer);
      this.warmthTimer = null;
    }
    this.droneOscs.forEach(({ osc, gain }) => {
      try {
        osc.stop();
        osc.disconnect();
        gain.disconnect();
      } catch (_) {}
    });
    this.droneOscs = [];
    if (this.ctx && this.ctx.state !== "closed") {
      this.ctx.close().catch(() => {});
    }
    this.ctx = null;
    this.masterGain = null;
    this.reverbBus = null;
    this.dryBus = null;
    this.analyser = null;
    this.droneFilter = null;
    this.isInitialized = false;
    this.isMuted = true;
  }
}

export const audio = new AudioEngine();
