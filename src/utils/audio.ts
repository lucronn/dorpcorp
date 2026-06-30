// Fine-crafted Space Luxury Web Audio Engine for immersive interaction soundscapes
// No dependencies, utilizes standard Web Audio API oscillators, routing, and filters

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;
  private isMuted: boolean = true;
  private isInitialized: boolean = false;
  private lastMalletPlay: number = 0;

  // Interstellar-esque arpeggiator state
  private interactionLevel: number = 0; // 0.0 to 1.0
  private nextNoteTime: number = 0;
  private currentStep: number = 0;
  private arpInterval: ReturnType<typeof setInterval> | null = null;

  // Primary light theme loop (Interstellar "Cornfield Chase" inspired)
  // A3 (220), C4 (261.63), E4 (329.63), A4 (440)
  private arpSequence = [
    220.00, 261.63, 329.63, 440.00, 329.63, 261.63
  ];

  // Secondary dark track (introduced on interaction)
  // Lower, darker, slight dissonance F2 (87.31), A2 (110), C3 (130.81), E3 (164.81)
  private darkArpSequence = [
    87.31, 110.00, 130.81, 164.81, 130.81, 110.00
  ];

  init() {
    if (this.isInitialized) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.droneFilter = this.ctx.createBiquadFilter();
      this.droneFilter.type = 'lowpass';
      this.droneFilter.frequency.setValueAtTime(1000, this.ctx.currentTime);
      this.droneFilter.Q.setValueAtTime(1.2, this.ctx.currentTime);
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
      this.interactionLevel = Math.min(1.0, this.interactionLevel + 0.15);
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
      this.masterGain.gain.setTargetAtTime(targetVolume, this.ctx.currentTime, 0.2);
    }
  }

  getMuteState(): boolean {
    return this.isMuted;
  }

  private startAmbientDrones() {
    if (!this.ctx || !this.droneFilter) return;

    // A huge continuous organ-like pedal note
    const freqs = [55.00, 110.00, 164.81]; // A1, A2, E3
    
    freqs.forEach((freq, idx) => {
      if (!this.ctx || !this.droneFilter) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = idx % 2 === 0 ? 'sawtooth' : 'square';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.detune.setValueAtTime(idx * 3, this.ctx.currentTime);
      
      const vol = (idx === 0) ? 0.08 : 0.03;
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      
      osc.connect(gain);
      gain.connect(this.droneFilter);
      osc.start();
    });
  }

  private startArpeggiator() {
    if (!this.ctx) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.arpInterval = setInterval(() => this.scheduleArpeggio(), 25);
    
    // Decay interaction level over time to naturally return to calm state
    setInterval(() => {
      this.interactionLevel = Math.max(0, this.interactionLevel - 0.02);
    }, 100);
  }

  private scheduleArpeggio() {
    if (!this.ctx || this.isMuted) return;
    const scheduleAheadTime = 0.1;
    const secondsPerBeat = 0.18; // Speed of the arpeggio (adjust for Interstellar tempo)
    
    while (this.nextNoteTime < this.ctx.currentTime + scheduleAheadTime) {
      this.playArpNote(this.nextNoteTime);
      this.nextNoteTime += secondsPerBeat;
      this.currentStep = (this.currentStep + 1) % this.arpSequence.length;
    }
  }

  private playArpNote(time: number) {
    if (!this.ctx || !this.masterGain) return;

    // Primary Track (Light/Hopeful)
    const freq1 = this.arpSequence[this.currentStep];
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    
    osc1.type = 'sine'; // Soft, pure organ tone
    osc1.frequency.setValueAtTime(freq1, time);
    
    // Smooth envelope
    gain1.gain.setValueAtTime(0, time);
    gain1.gain.linearRampToValueAtTime(0.12 * (1 - this.interactionLevel * 0.5), time + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
    
    osc1.connect(gain1);
    gain1.connect(this.masterGain);
    osc1.start(time);
    osc1.stop(time + 0.4);

    // Secondary Track (Dark/Dramatic) - fades in based on interactionLevel
    if (this.interactionLevel > 0.05) {
      const freq2 = this.darkArpSequence[this.currentStep];
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      
      osc2.type = 'sawtooth'; // More aggressive, brassy synth
      osc2.frequency.setValueAtTime(freq2, time);
      
      // Filter for the dark track
      const filter2 = this.ctx.createBiquadFilter();
      filter2.type = 'lowpass';
      // Opens up based on interaction
      filter2.frequency.setValueAtTime(200 + this.interactionLevel * 2000, time);
      filter2.Q.setValueAtTime(1.5, time);
      
      gain2.gain.setValueAtTime(0, time);
      // Volume scales with interaction level
      gain2.gain.linearRampToValueAtTime(0.08 * this.interactionLevel, time + 0.02);
      gain2.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
      
      osc2.connect(filter2);
      filter2.connect(gain2);
      gain2.connect(this.masterGain);
      osc2.start(time);
      osc2.stop(time + 0.3);
    }
  }

  // Supernova explosion for clicks
  playSupernova() {
    if (!this.ctx || this.isMuted || !this.masterGain) return;
    
    const now = this.ctx.currentTime;
    
    // Sub drop for the explosion impact
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(150, now);
    subOsc.frequency.exponentialRampToValueAtTime(20, now + 1.0);
    
    subGain.gain.setValueAtTime(0, now);
    subGain.gain.linearRampToValueAtTime(0.4, now + 0.02);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
    
    subOsc.connect(subGain);
    subGain.connect(this.masterGain);
    subOsc.start(now);
    subOsc.stop(now + 2.1);

    // Noise burst for the fiery supernova expand
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds of noise
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(3000, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(100, now + 1.5);
    noiseFilter.Q.setValueAtTime(1.0, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.2, now + 0.05);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
    
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    
    noiseSource.start(now);
    noiseSource.stop(now + 2.1);

    // Low frequency "rumble" or "aftershock" of the supernova
    const rumbleOsc = this.ctx.createOscillator();
    const rumbleGain = this.ctx.createGain();
    rumbleOsc.type = 'triangle';
    rumbleOsc.frequency.setValueAtTime(60, now);
    rumbleOsc.frequency.exponentialRampToValueAtTime(10, now + 1.5);
    
    rumbleGain.gain.setValueAtTime(0, now);
    rumbleGain.gain.linearRampToValueAtTime(0.2, now + 0.05);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    
    rumbleOsc.connect(rumbleGain);
    rumbleGain.connect(this.masterGain);
    rumbleOsc.start(now);
    rumbleOsc.stop(now + 1.6);

    // Suck sound (starts at 1.2s, ends at 2.2s)
    const suckOsc = this.ctx.createOscillator();
    const suckGain = this.ctx.createGain();
    suckOsc.type = 'sine';
    suckOsc.frequency.setValueAtTime(20, now + 1.2);
    suckOsc.frequency.exponentialRampToValueAtTime(800, now + 2.2); 
    
    suckGain.gain.setValueAtTime(0, now + 1.2);
    suckGain.gain.exponentialRampToValueAtTime(0.4, now + 2.2);
    suckGain.gain.linearRampToValueAtTime(0.001, now + 2.25);
    
    suckOsc.connect(suckGain);
    suckGain.connect(this.masterGain);
    suckOsc.start(now + 1.2);
    suckOsc.stop(now + 2.3);

    // Second explosion (pop back) at 2.2s
    const popOsc = this.ctx.createOscillator();
    const popGain = this.ctx.createGain();
    popOsc.type = 'square';
    popOsc.frequency.setValueAtTime(150, now + 2.2);
    popOsc.frequency.exponentialRampToValueAtTime(10, now + 3.0);
    
    popGain.gain.setValueAtTime(0, now + 2.2);
    popGain.gain.linearRampToValueAtTime(0.3, now + 2.22);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + 3.5);
    
    const popFilter = this.ctx.createBiquadFilter();
    popFilter.type = 'lowpass';
    popFilter.frequency.setValueAtTime(2000, now + 2.2);
    popFilter.frequency.exponentialRampToValueAtTime(100, now + 3.0);

    popOsc.connect(popFilter);
    popFilter.connect(popGain);
    popGain.connect(this.masterGain);
    popOsc.start(now + 2.2);
    popOsc.stop(now + 3.5);
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
    
    // Huge cinematic swell
    const chordFrequencies = [55.00, 110.00, 164.81, 220.00, 329.63];
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(150, now);
    filter.frequency.exponentialRampToValueAtTime(1800, now + 2.0);
    filter.frequency.exponentialRampToValueAtTime(80, now + 5.0);
    filter.Q.setValueAtTime(1.5, now);

    synthGain.gain.setValueAtTime(0, now);
    synthGain.gain.linearRampToValueAtTime(0.1, now + 1.8);
    synthGain.gain.exponentialRampToValueAtTime(0.0001, now + 6.0);

    filter.connect(synthGain);
    synthGain.connect(this.masterGain);

    chordFrequencies.forEach((freq, idx) => {
      if (!this.ctx) return;
      for (let detune = -1; detune <= 1; detune++) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);
        osc.detune.setValueAtTime(detune * 6, now);
        
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

