import type { Particle } from "./types";

export type CoverPhase = "idle" | "panning" | "remapping" | "settling" | "returning";
export type CoverMode = "pan" | "veil";

/** Render-driven handoff: no target writes until an occluded frame has been presented. */
export class RemeshCover {
  phase: CoverPhase = "idle";
  mode: CoverMode = "pan";
  opacity = 0;
  panProgress = 0;
  reducedMotion = false;
  revision = 0;
  private lastFrame: number | null = null;
  private formedFrames = 0;
  private renderedCovered = false;
  private jobs = new Map<string, () => void>();

  constructor(private paint: (opacity: number, phase: CoverPhase) => void = () => {}) {}

  request(key: string, mutate: () => void, startup = false) {
    this.jobs.set(key, mutate);
    if (this.phase === "idle") {
      this.mode = this.reducedMotion || startup ? "veil" : "pan";
      this.panProgress = 0;
      this.lastFrame = null;
    }
    this.phase = "panning";
    this.formedFrames = 0;
    this.renderedCovered = false;
    this.opacity = this.mode === "veil" ? 1 : 0;
    this.paint(this.opacity, this.phase);
  }

  /** A newer navigation supersedes queued work, including delayed FX rebirths. */
  cancelPending() { this.jobs.clear(); }
  get pendingJobs() { return this.jobs.size; }
  get covered() { return this.phase === "remapping" || this.phase === "settling"; }

  advance(now: number, canPan = true) {
    // Cap motion after a suspended tab; a wall-clock timeout cannot skip the pan.
    const dt = this.lastFrame === null ? 0 : Math.min(64, Math.max(0, now - this.lastFrame));
    this.lastFrame = now;
    if (this.phase === "idle" || !canPan) return;
    // Honor a live preference change without finishing a large camera movement.
    if (this.reducedMotion && this.mode === "pan") {
      this.mode = "veil";
      this.opacity = 1;
      this.renderedCovered = false;
    }
    if (this.phase === "panning") this.panProgress = Math.min(1, this.panProgress + dt / 420);
    if (this.phase === "returning") {
      if (this.mode === "veil") this.opacity = Math.max(0, this.opacity - dt / 60);
      else this.panProgress = Math.max(0, this.panProgress - dt / 520);
      if (this.mode === "veil" ? this.opacity === 0 : this.panProgress === 0) this.phase = "idle";
    }
    this.paint(this.opacity, this.phase);
  }

  isCovered(occluded: boolean) { return this.opacity === 1 || occluded; }

  /** Called before drawing, after the camera/occluder pose is installed. */
  flush(occluded: boolean) {
    if (this.phase !== "panning" || !this.renderedCovered || !this.isCovered(occluded)) return;
    this.phase = "remapping";
    // A resize may have queued particle work before a scene selection arrived.
    // Always install entities before mapping particles onto those entities.
    const jobs = [...this.jobs.entries()].sort(([a], [b]) =>
      (a === "entities" ? -1 : a === "typography" ? 1 : 0) -
      (b === "entities" ? -1 : b === "typography" ? 1 : 0)).map(([, job]) => job);
    this.jobs.clear();
    for (const job of jobs) job();
    this.revision++;
    this.phase = "settling";
    this.formedFrames = 0;
    this.paint(this.opacity, this.phase);
  }

  /** Fail closed if a resize/context change invalidates the occluder mid-remap. */
  protect(occluded: boolean) {
    if (this.covered && !this.isCovered(occluded)) {
      this.mode = "veil";
      this.opacity = 1;
      this.paint(this.opacity, this.phase);
    }
  }

  remapped(particles: Particle[]) {
    for (const p of particles) {
      if (p.isTail) p.life = 0;
      else if (!p.isCosmicAmbient) p.needsRemesh = true;
    }
  }

  /** Call AFTER scene.render(), including its camera observers and mesh uploads. */
  afterRender(formed: boolean, occluded: boolean) {
    this.renderedCovered = this.isCovered(occluded);
    if (this.phase === "settling") {
      this.formedFrames = formed && this.renderedCovered ? this.formedFrames + 1 : 0;
      if (this.formedFrames >= 2 && this.jobs.size === 0) this.phase = "returning";
    }
    this.paint(this.opacity, this.phase);
  }
}

/** Discard old-layout momentum only while the remap is occluded. */
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
