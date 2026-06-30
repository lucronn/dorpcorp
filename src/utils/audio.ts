// Fine-crafted Space Luxury Web Audio Engine for immersive interaction soundscapes
// No dependencies, utilizes standard Web Audio API oscillators, routing, and filters

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;
  private isMuted: boolean = true;
  private isInitialized: boolean = false;
  private lastMalletPlay: number = 0;

  // Interstellar-esque arpeggiator state
  private interactionLevel: number = 0; // 0.0 to 1.0
  private nextNoteTime: number = 0;
  private currentStep: number = 0;
  private arpInterval: ReturnType<typeof setInterval> | null = null;

  // Interstellar main motif chord progression: Am, F, C, G/Em
  // Tuned perfectly to Hans Zimmer's signature cinematic organ and piano melodies
  private arpSequence = [
    440.00, // A4 (Am root melody)
    493.88, // B4
    523.25, // C5
    659.25, // E5
    587.33, // D5
    523.25, // C5
    493.88, // B4
    440.00, // A4
    523.25, // C5 (F major chord melody)
    659.25, // E5
    783.99, // G5
    880.00, // A5
    783.99, // G5
    659.25, // E5
    523.25, // C5
    493.88, // B4
  ];

  // Deep majestic pedal roots played matching the progression
  private chordSequence = [
    110.00, 110.00, 110.00, 110.00, // Am (A2)
    87.31,  87.31,  87.31,  87.31,  // F (F2)
    130.81, 130.81, 130.81, 130.81, // C (C3)
    98.00,  98.00,  82.41,  82.41,  // G / Em (G2 / E2)
  ];

  init() {
    if (this.isInitialized) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
      
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      this.droneFilter = this.ctx.createBiquadFilter();
      this.droneFilter.type = 'lowpass';
      this.droneFilter.frequency.setValueAtTime(800, this.ctx.currentTime);
      this.droneFilter.Q.setValueAtTime(1.0, this.ctx.currentTime);
      this.droneFilter.connect(this.masterGain);

      this.isInitialized = true;
      this.startAmbientDrones();
      this.startArpeggiator();
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  }

  private lastInteractionPing: number = 0;

  pingInteraction() {
    const now = Date.now();
    if (now - this.lastInteractionPing > 100) {
      this.interactionLevel = Math.min(1.0, this.interactionLevel + 0.12);
      this.lastInteractionPing = now;
    }
  }

  setMute(muted: boolean) {
    this.isMuted = muted;
    if (!this.isInitialized && !muted) {
      this.init();
    }
    
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    if (this.masterGain && this.ctx) {
      const targetVolume = muted ? 0 : 0.35;
      this.masterGain.gain.setTargetAtTime(targetVolume, this.ctx.currentTime, 0.25);
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
    return avg / 255.0; // returns 0.0 to 1.0 amplitude
  }

  private startAmbientDrones() {
    if (!this.ctx || !this.droneFilter) return;

    // A huge continuous organ-like pedal note
    const freqs = [55.00, 110.00, 164.81]; // A1, A2, E3
    
    freqs.forEach((freq, idx) => {
      if (!this.ctx || !this.droneFilter) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = idx === 0 ? 'sine' : 'triangle'; // Pure & warm low base
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.detune.setValueAtTime(idx * 2, this.ctx.currentTime);
      
      const vol = (idx === 0) ? 0.07 : 0.02;
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      
      osc.connect(gain);
      gain.connect(this.droneFilter);
      osc.start();
    });
  }

  private startArpeggiator() {
    if (!this.ctx) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.arpInterval = setInterval(() => this.scheduleArpeggio(), 30);
    
    // Decay interaction level over time to naturally return to calm state
    setInterval(() => {
      this.interactionLevel = Math.max(0, this.interactionLevel - 0.015);
    }, 120);
  }

  private scheduleArpeggio() {
    if (!this.ctx || this.isMuted) return;
    const scheduleAheadTime = 0.15;
    // SLOWED DOWN: 1.45 seconds per beat for a massive, spacious, Interstellar cinematic cathedral atmosphere
    const secondsPerBeat = 1.45; 
    
    // CRITICAL: Avoid scheduler accumulation click/bursts if context is suspended or falls behind
    if (this.nextNoteTime < this.ctx.currentTime) {
      this.nextNoteTime = this.ctx.currentTime + 0.02;
    }
    
    while (this.nextNoteTime < this.ctx.currentTime + scheduleAheadTime) {
      this.playArpNote(this.nextNoteTime);
      this.nextNoteTime += secondsPerBeat;
      this.currentStep = (this.currentStep + 1) % this.arpSequence.length;
    }
  }

  private playArpNote(time: number) {
    if (!this.ctx || !this.masterGain) return;

    // 1. PRIMARY CINEMATIC ORGAN/PIANO TUNE
    const freq = this.arpSequence[this.currentStep];
    const oscSine = this.ctx.createOscillator();
    const oscTri = this.ctx.createOscillator();
    const voiceGain = this.ctx.createGain();
    
    oscSine.type = 'sine'; // pure glassy texture
    oscSine.frequency.setValueAtTime(freq, time);

    oscTri.type = 'triangle'; // woodwind flute warmth
    oscTri.frequency.setValueAtTime(freq, time);
    oscTri.detune.setValueAtTime(4, time); // warm chorus
    
    const voiceFilter = this.ctx.createBiquadFilter();
    voiceFilter.type = 'lowpass';
    voiceFilter.frequency.setValueAtTime(1000 + this.interactionLevel * 600, time);
    voiceFilter.Q.setValueAtTime(1.0, time);

    // 100% Click-free Envelope using pure linear ramps to absolute 0.0
    const baseVolume = 0.06 * (1 - this.interactionLevel * 0.25);
    voiceGain.gain.setValueAtTime(0.0, time);
    voiceGain.gain.linearRampToValueAtTime(baseVolume, time + 0.15);
    voiceGain.gain.linearRampToValueAtTime(baseVolume * 0.4, time + 0.6);
    voiceGain.gain.linearRampToValueAtTime(0.005, time + 1.25);
    voiceGain.gain.linearRampToValueAtTime(0.0, time + 1.35); // perfect zero-cross release

    oscSine.connect(voiceGain);
    oscTri.connect(voiceGain);
    voiceGain.connect(voiceFilter);
    voiceFilter.connect(this.masterGain);

    oscSine.start(time);
    oscTri.start(time);
    oscSine.stop(time + 1.4);
    oscTri.stop(time + 1.4);

    // 2. MAJESTIC CINEMATIC CHORD PEDALS (Triggers on primary beats to build incredible depth)
    if (this.currentStep % 4 === 0) {
      const chordRoot = this.chordSequence[Math.floor(this.currentStep / 4) % this.chordSequence.length];
      
      const pedalOsc1 = this.ctx.createOscillator();
      const pedalOsc2 = this.ctx.createOscillator();
      const pedalGain = this.ctx.createGain();
      const pedalFilter = this.ctx.createBiquadFilter();
      
      pedalOsc1.type = 'sine'; // Sub-harmonic anchor
      pedalOsc1.frequency.setValueAtTime(chordRoot / 2, time); 
      
      pedalOsc2.type = 'triangle'; // Resonant body
      pedalOsc2.frequency.setValueAtTime(chordRoot, time);
      pedalOsc2.detune.setValueAtTime(-6, time);
      
      pedalFilter.type = 'lowpass';
      pedalFilter.frequency.setValueAtTime(140, time);
      pedalFilter.Q.setValueAtTime(1.2, time);
      
      // Lush, extremely slow linear swell and release decay curve
      pedalGain.gain.setValueAtTime(0.0, time);
      pedalGain.gain.linearRampToValueAtTime(0.08, time + 1.2); 
      pedalGain.gain.linearRampToValueAtTime(0.01, time + 4.2);
      pedalGain.gain.linearRampToValueAtTime(0.0, time + 4.5); // safe release
      
      pedalOsc1.connect(pedalFilter);
      pedalOsc2.connect(pedalFilter);
      pedalFilter.connect(pedalGain);
      pedalGain.connect(this.masterGain);
      
      pedalOsc1.start(time);
      pedalOsc2.start(time);
      pedalOsc1.stop(time + 4.6);
      pedalOsc2.stop(time + 4.6);
    }
  }

  // Cinematic deep vibrational explosion - NO SIRENS, NO SLIDES, NO CARTOON BOINGS!
  // Uses Brown Noise rumble + dual sub-harmonics for extreme bass density.
  playSupernova() {
    if (!this.ctx || this.isMuted || !this.masterGain) return;
    
    const now = this.ctx.currentTime;
    
    // 1. SUB-BASS RESONATING IMPULSE (Deep physical beating)
    const subOsc1 = this.ctx.createOscillator();
    const subOsc2 = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    
    subOsc1.type = 'sine';
    subOsc1.frequency.setValueAtTime(75, now);
    subOsc1.frequency.exponentialRampToValueAtTime(24, now + 1.8);
    
    subOsc2.type = 'triangle'; // adds low harmonics
    subOsc2.frequency.setValueAtTime(77, now); // 2Hz detune for massive rumble beating
    subOsc2.frequency.exponentialRampToValueAtTime(23, now + 1.8);
    
    subGain.gain.setValueAtTime(0.0, now);
    subGain.gain.linearRampToValueAtTime(0.65, now + 0.05);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 2.6);
    subGain.gain.linearRampToValueAtTime(0.0, now + 2.7); // clean stop
    
    subOsc1.connect(subGain);
    subOsc2.connect(subGain);
    subGain.connect(this.masterGain);
    
    subOsc1.start(now);
    subOsc2.start(now);
    subOsc1.stop(now + 2.75);
    subOsc2.stop(now + 2.75);

    // 2. BROWN NOISE RUMBLE (Volcanic, planetary disintegration texture)
    const bufferSize = this.ctx.sampleRate * 3.0; // 3 seconds
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2.0 - 1.0;
        // Integrate white noise to produce rich Brown noise (deep low spectral density)
        output[i] = (lastOut + (0.022 * white)) / 1.022;
        lastOut = output[i];
        output[i] *= 3.8; // Gain compensation
    }
    
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(240, now); // very dark
    noiseFilter.frequency.exponentialRampToValueAtTime(35, now + 2.4);
    noiseFilter.Q.setValueAtTime(2.2, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0, now);
    noiseGain.gain.linearRampToValueAtTime(0.48, now + 0.08);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 2.8);
    noiseGain.gain.linearRampToValueAtTime(0.0, now + 2.9);
    
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    
    noiseSource.start(now);
    noiseSource.stop(now + 2.95);

    // 3. LOW-FREQUENCY EARTH-SHAKING AFTERSHOCK
    const shockOsc = this.ctx.createOscillator();
    const shockFilter = this.ctx.createBiquadFilter();
    const shockGain = this.ctx.createGain();
    
    shockOsc.type = 'sawtooth';
    shockOsc.frequency.setValueAtTime(105, now);
    shockOsc.frequency.linearRampToValueAtTime(32, now + 0.9);
    
    shockFilter.type = 'bandpass';
    shockFilter.frequency.setValueAtTime(280, now);
    shockFilter.frequency.exponentialRampToValueAtTime(65, now + 1.4);
    shockFilter.Q.setValueAtTime(0.8, now);
    
    shockGain.gain.setValueAtTime(0.0, now);
    shockGain.gain.linearRampToValueAtTime(0.24, now + 0.04);
    shockGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    shockGain.gain.linearRampToValueAtTime(0.0, now + 1.6);
    
    shockOsc.connect(shockFilter);
    shockFilter.connect(shockGain);
    shockGain.connect(this.masterGain);
    
    shockOsc.start(now);
    shockOsc.stop(now + 1.65);
  }

  playInteractiveMallet(intensity: number, relativeX: number) {
    this.pingInteraction();
  }

  playStageSwell(stageIndex: number) {
    this.pingInteraction();
    
    if (!this.ctx || this.isMuted || !this.masterGain) return;
    const now = this.ctx.currentTime;
    
    const filter = this.ctx.createBiquadFilter();
    const synthGain = this.ctx.createGain();
    
    // Huge cinematic swell matching Interstellar organ chord shifts
    const chordFrequencies = [55.00, 110.00, 164.81, 220.00, 329.63];
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(150, now);
    filter.frequency.exponentialRampToValueAtTime(1600, now + 2.0);
    filter.frequency.exponentialRampToValueAtTime(75, now + 5.0);
    filter.Q.setValueAtTime(1.4, now);

    synthGain.gain.setValueAtTime(0.0, now);
    synthGain.gain.linearRampToValueAtTime(0.12, now + 1.8);
    synthGain.gain.exponentialRampToValueAtTime(0.0001, now + 5.8);
    synthGain.gain.linearRampToValueAtTime(0.0, now + 5.95); // safe release to prevent pop

    filter.connect(synthGain);
    synthGain.connect(this.masterGain);

    chordFrequencies.forEach((freq, idx) => {
      if (!this.ctx) return;
      for (let detune = -1; detune <= 1; detune++) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);
        osc.detune.setValueAtTime(detune * 5, now);
        
        osc.connect(filter);
        osc.start(now);
        osc.stop(now + 6.0);
      }
    });
  }

  playRippleShockwave() {
    this.playSupernova();
  }
}

export const audio = new AudioEngine();

