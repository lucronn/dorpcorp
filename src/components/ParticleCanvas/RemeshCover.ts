import type { Particle } from "./types";

export type CoverPhase = "idle" | "panning" | "remapping" | "settling" | "returning";
export type CoverMode = "pan" | "cut";
export const REMESH_FLIGHT_TIMING = { depart: 720, cruise: 160, arrive: 640, cut: 100 } as const;

/** Render-driven handoff. "Covered" means outside the camera frustum, never opacity. */
export class RemeshCover {
  phase: CoverPhase = "idle";
  mode: CoverMode = "pan";
  readonly opacity = 0; // Kept for the existing debug API; there is no cover surface.
  panProgress = 0;
  reducedMotion = false;
  revision = 0;
  departure = 0;
  flightTime = 0;
  hiddenTime = 0;
  private lastFrame: number | null = null;
  private formedFrames = 0;
  private renderedCovered = false;
  private jobs = new Map<string, () => void>();

  request(key: string, mutate: () => void, startup = false) {
    this.jobs.set(key, mutate);
    if (this.phase === "idle" || this.phase === "returning") {
      this.mode = this.reducedMotion || startup ? "cut" : "pan";
      this.panProgress = 0;
      this.flightTime = this.hiddenTime = 0;
      this.lastFrame = null;
      this.departure++;
    }
    this.phase = "panning";
    this.formedFrames = 0;
    this.renderedCovered = false;
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
    this.flightTime += dt;
    // Honor a live preference change without finishing a large camera movement.
    if (this.reducedMotion && this.mode === "pan") {
      this.mode = "cut";
      this.renderedCovered = false;
    }
    if (this.panProgress === 1 && this.phase !== "returning") this.hiddenTime += dt;
    if (this.phase === "panning") this.panProgress = this.mode === "cut" ? 1 : Math.min(1, this.panProgress + dt / REMESH_FLIGHT_TIMING.depart);
    if (this.phase === "returning") {
      this.panProgress = Math.max(0, this.panProgress - dt / (this.mode === "cut" ? REMESH_FLIGHT_TIMING.cut : REMESH_FLIGHT_TIMING.arrive));
      if (this.panProgress === 0) this.phase = "idle";
    }
  }

  isCovered(outOfFrustum: boolean) { return outOfFrustum; }

  /** Called before drawing, after the off-frustum camera pose is installed. */
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
      if (this.formedFrames >= 2 && this.jobs.size === 0 &&
          (this.mode === "cut" || this.hiddenTime >= REMESH_FLIGHT_TIMING.cruise)) this.phase = "returning";
    }
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
