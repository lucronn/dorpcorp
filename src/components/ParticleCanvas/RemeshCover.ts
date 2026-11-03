import type { Particle } from "./types";

export type CoverPhase = "idle" | "departing" | "remapping" | "settling" | "returning";
export type CoverMode = "flight" | "cut";
export const REMESH_FLIGHT_TIMING = { depart: 1120, cruise: 240, arrive: 1280, cut: 100 } as const;

/** Render-driven handoff. "Covered" means outside the camera frustum, never opacity. */
export class RemeshCover {
  phase: CoverPhase = "idle";
  mode: CoverMode = "flight";
  readonly opacity = 0; // Kept for the existing debug API; there is no cover surface.
  flightProgress = 0;
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
      this.mode = this.reducedMotion || startup ? "cut" : "flight";
      this.flightProgress = 0;
      this.flightTime = this.hiddenTime = 0;
      this.lastFrame = null;
      this.departure++;
    }
    this.phase = "departing";
    this.formedFrames = 0;
    this.renderedCovered = false;
  }

  /** A newer navigation supersedes queued work, including delayed FX rebirths. */
  cancelPending() { this.jobs.clear(); }
  get pendingJobs() { return this.jobs.size; }
  get covered() { return this.phase === "remapping" || this.phase === "settling"; }

  advance(now: number, canFly = true) {
    // Cap motion after a suspended tab; a wall-clock timeout cannot skip the departure.
    const dt = this.lastFrame === null ? 0 : Math.min(64, Math.max(0, now - this.lastFrame));
    this.lastFrame = now;
    if (this.phase === "idle" || !canFly) return;
    this.flightTime += dt;
    // Honor a live preference change without finishing a large camera movement.
    if (this.reducedMotion && this.mode === "flight") {
      this.mode = "cut";
      this.renderedCovered = false;
    }
    if (this.flightProgress === 1 && this.phase !== "returning") this.hiddenTime += dt;
    if (this.phase === "departing") {
      this.flightProgress = this.mode === "cut" ? 1 : Math.min(1, this.flightProgress + dt / REMESH_FLIGHT_TIMING.depart);
      // Avoid a duplicate endpoint frame from accumulated floating-point error.
      if (this.flightProgress > 1 - 1e-9) this.flightProgress = 1;
    }
    if (this.phase === "returning") {
      this.flightProgress = Math.max(0, this.flightProgress - dt / (this.mode === "cut" ? REMESH_FLIGHT_TIMING.cut : REMESH_FLIGHT_TIMING.arrive));
      if (this.flightProgress < 1e-9) this.flightProgress = 0;
      if (this.flightProgress === 0) this.phase = "idle";
    }
  }

  isCovered(outOfFrustum: boolean) { return outOfFrustum; }

  /** Called before drawing, after the off-frustum camera pose is installed. */
  flush(occluded: boolean) {
    if (this.phase !== "departing" || !this.renderedCovered || !this.isCovered(occluded)) return;
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
