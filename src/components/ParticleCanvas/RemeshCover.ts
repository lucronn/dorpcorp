import type { Particle } from "./types";

export type CoverPhase = "idle" | "remapping" | "settling" | "revealing";

/** A render-driven cut: elapsed time alone can never uncover unfinished work. */
export class RemeshCover {
  phase: CoverPhase = "idle";
  opacity = 0;
  reducedMotion = false;
  private startedAt = 0;
  private revealAt = 0;
  private formedFrames = 0;

  constructor(private paint: (opacity: number, phase: CoverPhase) => void = () => {}) {}

  begin(now = performance.now()) {
    this.startedAt = now;
    this.formedFrames = 0;
    this.phase = "remapping";
    this.opacity = 1;
    // Synchronous DOM write; no React batching or CSS fade on the covering edge.
    this.paint(this.opacity, this.phase);
  }

  remapped(particles: Particle[]) {
    for (const p of particles) {
      if (p.isTail) p.life = 0;
      else if (!p.isCosmicAmbient) p.needsRemesh = true;
    }
    this.phase = "settling";
    this.paint(1, this.phase);
  }

  get covered() { return this.phase === "remapping" || this.phase === "settling"; }

  /** Call only AFTER scene.render(), including any onBeforeRender remaps. */
  afterRender(formed: boolean, now = performance.now()) {
    if (this.phase === "settling") {
      this.formedFrames = formed ? this.formedFrames + 1 : 0;
      if (this.formedFrames >= 2 && now - this.startedAt >= 120) {
        this.phase = "revealing";
        this.revealAt = now;
      }
    }
    if (this.phase === "revealing") {
      this.opacity = Math.max(0, 1 - (now - this.revealAt) / (this.reducedMotion ? 60 : 180));
      if (this.opacity === 0) this.phase = "idle";
    }
    this.paint(this.opacity, this.phase);
  }
}

/** Discard old-layout momentum only while the canvas is fully covered. */
export function settleRemappedParticle(p: Particle) {
  p.x = p.targetX;
  p.y = p.targetY;
  p.z = p.targetZ ?? 0;
  p.vx = p.vy = p.vz = 0;
  p.r = p.targetR ?? p.r;
  p.g = p.targetG ?? p.g;
  p.b = p.targetB ?? p.b;
  p.needsRemesh = false;
}
