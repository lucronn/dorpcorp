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

  // Cinematic scale frequencies (Eb Major / C Pentatonic scale for rich ethereal sounds of space)
  private scale = [130.81, 146.83, 164.81, 196.00, 220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00];

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

    // We build 3 subtle warm waves for minor-7th / major-9th drone elements
    const freqs = [65.41, 98.00, 130.81, 196.00]; // Low C, G, C, G harmonics
    
    freqs.forEach((freq, idx) => {
      if (!this.ctx || !this.droneFilter) return;
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      // Mix sine and triangle for smooth analog texture
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      
      // Gain is kept very low and slowly moves to simulate drifting atmosphere
      const vol = 0.04 - (idx * 0.005);
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

  // Play a soft mallet note matching the current cursor position/speed
  playInteractiveMallet(intensity: number, relativeX: number) {
    if (!this.ctx || this.isMuted || !this.masterGain) return;
    
    const now = this.ctx.currentTime;
    // Throttle mallets to stay pleasant and not crowded
    if (now - this.lastMalletPlay < 0.08) return;
    this.lastMalletPlay = now;

    // Pick scale note based on horizontal cursor placement
    const noteIdx = Math.floor(relativeX * (this.scale.length - 1));
    const freq = this.scale[Math.max(0, Math.min(noteIdx, this.scale.length - 1))];

    // Create custom bell/mallet synth voice
    const osc = this.ctx.createOscillator();
    const subOsc = this.ctx.createOscillator();
    const volumeNode = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    // Give it a subtle glass harmonic
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(freq * 1.501, now); // Sweet perfect fifth or fifth octave overtones

    // Smooth LP bandpass to make it warm
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq * 2.5, now);
    filter.Q.setValueAtTime(1.0, now);

    volumeNode.gain.setValueAtTime(0, now);
    // Exponential spike then decay
    volumeNode.gain.linearRampToValueAtTime(0.06 * intensity, now + 0.01);
    volumeNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.8 + intensity * 0.4);

    osc.connect(filter);
    subOsc.connect(filter);
    filter.connect(volumeNode);
    volumeNode.connect(this.masterGain);

    osc.start(now);
    subOsc.start(now);
    
    osc.stop(now + 1.5);
    subOsc.stop(now + 1.5);
  }

  // Cinematic swell on project card stage transition
  playStageSwell(stageIndex: number) {
    if (!this.ctx || this.isMuted || !this.masterGain) return;
    
    const now = this.ctx.currentTime;
    
    // Low sweeping synthesizer
    const synthOsc = this.ctx.createOscillator();
    const synthGain = this.ctx.createGain();
    const synthFilter = this.ctx.createBiquadFilter();

    synthOsc.type = 'sawtooth';
    // Deep luxurious base pitch that rises/falls based on stage index
    const baseFreq = 55 + (stageIndex * 11); // Frequencies: 55Hz, 66Hz, 77Hz, 88Hz, 99Hz, 110Hz
    synthOsc.frequency.setValueAtTime(baseFreq, now);
    synthOsc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.5);

    synthFilter.type = 'lowpass';
    synthFilter.frequency.setValueAtTime(120, now);
    synthFilter.frequency.exponentialRampToValueAtTime(550, now + 0.25);
    synthFilter.frequency.exponentialRampToValueAtTime(80, now + 1.2);

    synthGain.gain.setValueAtTime(0, now);
    synthGain.gain.linearRampToValueAtTime(0.12, now + 0.15);
    synthGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

    synthOsc.connect(synthFilter);
    synthFilter.connect(synthGain);
    synthGain.connect(this.masterGain);

    // Ethereal chime chord alongside deep sweeping synthesizer
    const highFrequencies = [261.63, 311.13, 392.00, 466.16].map(f => f * (1 + (stageIndex % 3) * 0.2));
    
    highFrequencies.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      
      const bellOsc = this.ctx.createOscillator();
      const bellGain = this.ctx.createGain();
      
      bellOsc.type = 'triangle';
      bellOsc.frequency.setValueAtTime(freq, now + i * 0.05); // staggered arpeggio
      
      bellGain.gain.setValueAtTime(0, now);
      bellGain.gain.linearRampToValueAtTime(0.02, now + i * 0.05 + 0.01);
      bellGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
      
      bellOsc.connect(bellGain);
      bellGain.connect(this.masterGain);
      
      bellOsc.start(now);
      bellOsc.stop(now + 2.0);
    });

    synthOsc.start(now);
    synthOsc.stop(now + 2.0);
  }

  // Energy ripple pop click
  playRippleShockwave() {
    if (!this.ctx || this.isMuted || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const noiseGain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);

    noiseGain.gain.setValueAtTime(0.12, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

    osc.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.3);
  }
}

export const audio = new AudioEngine();
