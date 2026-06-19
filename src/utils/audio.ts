// Fine-crafted Space Luxury Web Audio Engine for immersive interaction soundscapes
// No dependencies, utilizes standard Web Audio API oscillators, routing, and filters

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private droneOscs: { osc: OscillatorNode; gain: GainNode }[] = [];
  private droneFilter: BiquadFilterNode | null = null;
  private isMuted: boolean = true;
  private isInitialized: boolean = false;
  private lastMalletPlay: number = 0;

  // Cinematic scale frequencies (A minor / Space Pipe Organ scale for huge ethereal cinematic sounds)
  private scale = [55.00, 65.41, 82.41, 110.00, 130.81, 164.81, 220.00, 261.63, 329.63, 440.00, 523.25, 659.25, 880.00, 1046.50];

  init() {
    if (this.isInitialized) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      
      // Default state is muted until user interacts with the sound toggle
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Low Pass filter for a warm, subby analog feel
      this.droneFilter = this.ctx.createBiquadFilter();
      this.droneFilter.type = 'lowpass';
      this.droneFilter.frequency.setValueAtTime(320, this.ctx.currentTime);
      this.droneFilter.Q.setValueAtTime(1.5, this.ctx.currentTime);
      this.droneFilter.connect(this.masterGain);

      this.isInitialized = true;
      this.startAmbientDrones();
      this.startHeartbeat();
    } catch (e) {
      console.warn("Web Audio API not supported", e);
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
      const targetVolume = muted ? 0 : 0.22;
      this.masterGain.gain.setTargetAtTime(targetVolume, this.ctx.currentTime, 0.2);
    }
  }

  getMuteState(): boolean {
    return this.isMuted;
  }

  private startAmbientDrones() {
    if (!this.ctx || !this.droneFilter) return;

    // Deep resonant Hans Zimmer interstellar hum (A over pedal point)
    // Rich, vibrating organ drones
    const freqs = [55.00, 110.00, 164.81, 220.00, 329.63]; // A1, A2, E3, A3, E4
    
    freqs.forEach((freq, idx) => {
      if (!this.ctx || !this.droneFilter) return;
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      // Mix of sawtooth and square for that huge pipe organ weight
      osc.type = idx % 2 === 0 ? 'sawtooth' : 'square';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      
      // Detune very slightly for massive width
      osc.detune.setValueAtTime(idx * 2, this.ctx.currentTime);
      
      // Gain is kept very low and slowly moves to simulate a massive breathing cathedral
      const vol = (idx < 2) ? 0.04 : 0.015 - (idx * 0.002);
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      
      osc.connect(gain);
      gain.connect(this.droneFilter);
      
      osc.start();
      this.droneOscs.push({ osc, gain });

      // Slow continuous LFO modulation
      this.modulateDroneGain(gain, vol, idx);
    });
  }

  private modulateDroneGain(gain: GainNode, baseVol: number, index: number) {
    if (!this.ctx || this.isMuted) return;
    
    setInterval(() => {
      if (!this.ctx || this.isMuted) return;
      const t = this.ctx.currentTime;
      const variation = Math.sin(t * (0.1 + index * 0.05)) * 0.015;
      gain.gain.setTargetAtTime(Math.max(0.005, baseVol + variation), t, 1.5);
    }, 2000);
  }

  private startHeartbeat() {
    if (!this.ctx) return;
    setInterval(() => {
      if (!this.ctx || this.isMuted || !this.masterGain) return;
      
      const now = this.ctx.currentTime;
      
      // Lub
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(45, now);
      subOsc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
      
      subGain.gain.setValueAtTime(0, now);
      subGain.gain.linearRampToValueAtTime(0.06, now + 0.05);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
      
      subOsc.connect(subGain);
      subGain.connect(this.masterGain);
      subOsc.start(now);
      subOsc.stop(now + 0.35);

      // Dub
      const subOsc2 = this.ctx.createOscillator();
      const subGain2 = this.ctx.createGain();
      subOsc2.type = 'sine';
      subOsc2.frequency.setValueAtTime(50, now + 0.35);
      subOsc2.frequency.exponentialRampToValueAtTime(25, now + 0.9);
      
      subGain2.gain.setValueAtTime(0, now + 0.35);
      subGain2.gain.linearRampToValueAtTime(0.045, now + 0.4);
      subGain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

      subOsc2.connect(subGain2);
      subGain2.connect(this.masterGain);
      subOsc2.start(now + 0.35);
      subOsc2.stop(now + 1.0);
    }, 1300); // 46 BPM, slow calm heartbeat
  }

  // Deep space star-death 'scream' sound matching the current cursor position/speed
  playInteractiveMallet(intensity: number, relativeX: number) {
    if (!this.ctx || this.isMuted || !this.masterGain) return;
    
    const now = this.ctx.currentTime;
    // Throttle significantly more to keep it subtle
    if (now - this.lastMalletPlay < 0.8) return;
    this.lastMalletPlay = now;

    // Pick scale note based on horizontal cursor placement
    const noteIdx = Math.floor(relativeX * (this.scale.length - 1));
    const freq = this.scale[Math.max(0, Math.min(noteIdx, this.scale.length - 1))];

    const filter = this.ctx.createBiquadFilter();
    const screamGain = this.ctx.createGain();
    
    // Very deep dissonant drone that pitches down
    const screamOsc = this.ctx.createOscillator();
    const screamOsc2 = this.ctx.createOscillator();
    
    // Extremely deep pitch
    screamOsc.type = 'sawtooth';
    screamOsc.frequency.setValueAtTime(freq * 0.125, now);
    screamOsc.frequency.exponentialRampToValueAtTime(10, now + 3.0); // Dropping pitch

    // Detuned second oscillator for beating/wobble effect
    screamOsc2.type = 'triangle';
    screamOsc2.frequency.setValueAtTime((freq * 0.125) * 1.03, now);
    screamOsc2.frequency.exponentialRampToValueAtTime(9, now + 3.0);

    // Keep it VERY quiet/subtle
    screamGain.gain.setValueAtTime(0, now);
    screamGain.gain.linearRampToValueAtTime(0.008 * intensity, now + 0.4); 
    screamGain.gain.exponentialRampToValueAtTime(0.0001, now + 4.0);

    // Resonant lowpass to make it howl and scream in the distance
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(100, now);
    filter.frequency.exponentialRampToValueAtTime(30, now + 3.0);
    filter.Q.setValueAtTime(2.0, now);

    screamOsc.connect(screamGain);
    screamOsc2.connect(screamGain);
    screamGain.connect(filter);
    filter.connect(this.masterGain);

    screamOsc.start(now);
    screamOsc2.start(now);
    screamOsc.stop(now + 4.0);
    screamOsc2.stop(now + 4.0);
  }

  // Cinematic swell on project card stage transition
  playStageSwell(stageIndex: number) {
    if (!this.ctx || this.isMuted || !this.masterGain) return;
    
    const now = this.ctx.currentTime;
    
    // Huge Pipe Organ Swell
    const filter = this.ctx.createBiquadFilter();
    const synthGain = this.ctx.createGain();
    
    // Epic cinematic chord progression (Hans Zimmer style)
    // Am -> F -> G -> Em -> Am
    const progressions = [
      [55.00, 110.00, 164.81, 261.63], // Am (A1, A2, E3, C4)
      [43.65, 87.31, 130.81, 220.00],  // F  (F1, F2, C3, A3)
      [49.00, 98.00, 146.83, 196.00],  // G  (G1, G2, D3, G3)
      [41.20, 82.41, 123.47, 164.81],  // Em (E1, E2, B2, E3)
    ];
    
    const chordFrequencies = progressions[stageIndex % progressions.length];
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(150, now);
    filter.frequency.exponentialRampToValueAtTime(1200, now + 2.0);
    filter.frequency.exponentialRampToValueAtTime(80, now + 5.0);
    filter.Q.setValueAtTime(2.0, now);

    synthGain.gain.setValueAtTime(0, now);
    synthGain.gain.linearRampToValueAtTime(0.06, now + 1.8);
    synthGain.gain.exponentialRampToValueAtTime(0.0001, now + 6.0);

    filter.connect(synthGain);
    synthGain.connect(this.masterGain);

    chordFrequencies.forEach((freq, idx) => {
      if (!this.ctx) return;
      
      // We create multiple massive detuned oscillators per note for sheer scale
      for (let detune = -1; detune <= 1; detune++) {
        const osc = this.ctx.createOscillator();
        osc.type = (idx + detune) % 2 === 0 ? 'sawtooth' : 'square';
        
        // Massive width through detuning
        osc.frequency.setValueAtTime(freq, now);
        osc.detune.setValueAtTime(detune * 6, now);
        
        osc.connect(filter);
        osc.start(now);
        osc.stop(now + 6.0);
      }
    });
  }

  // Deep cinematic sub-drop impact
  playRippleShockwave() {
    if (!this.ctx || this.isMuted || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const noiseGain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.8);

    noiseGain.gain.setValueAtTime(0.15, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

    osc.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 1.5);
  }
}

export const audio = new AudioEngine();
