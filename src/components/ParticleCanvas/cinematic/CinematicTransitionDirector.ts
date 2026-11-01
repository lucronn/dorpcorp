/**
 * CinematicTransitionDirector & TransitionDirector
 * ------------------------------------------------
 * Multi-stage state machine that coordinates choreographed camera splines
 * with physics-driven particle transition phases:
 *
 *   - PHASE_DESTABILIZE (0% to 25%): Gravitational tremor or energy surge begins.
 *     Outer particles peel away into the 3D curl noise field while the camera
 *     slowly pulls back or narrows FOV (dolly zoom buildup).
 *   - PHASE_TRANSIT_CUTSCENE (25% to 75%): High-energy camera maneuver that
 *     naturally masks the bulk reorganization of particles.
 *   - PHASE_SETTLE (75% to 100%): Camera decelerates along an ease-out spline
 *     into the new framing as the final particle waves lock into the target
 *     formation via critically damped spring arrival.
 *
 * Also preserves the DEPART -> HIDDEN -> REVEAL lifecycle contract for
 * backwards compatibility with existing camera-layer tests.
 */

export type DirectorPhase = "IDLE" | "DEPART" | "HIDDEN" | "REVEAL";

export type TransitionStagePhase =
  | "IDLE"
  | "PHASE_DESTABILIZE"
  | "PHASE_TRANSIT_CUTSCENE"
  | "PHASE_SETTLE";

export type CameraManeuver =
  | "singularity_flythrough"
  | "orbital_whip_pan"
  | "relativistic_jet"
  | "kilonova_flash"
  | "establish"
  | "reduced";

/** Camera language used to hide/choreograph a transition. */
export type ShotStyle =
  /** Pan / tilt the camera along an orbital whip-pan spline, rack focus, then settle. */
  | "pan"
  /** Recoil: pull back, trigger kilonova/TDE flash spike & shockwave shell. */
  | "recoil"
  /** Emerge: dolly out of singularity fly-through / relativistic jet warp tunnel. */
  | "emerge"
  | "entry";

export interface ShotPreset {
  style: ShotStyle;
  maneuver: CameraManeuver;
  departMs: number;
  holdMs: number;
  revealMs: number;
  /** Max yaw away from the subject (radians). */
  yaw: number;
  /** Max pitch away from the subject (radians). */
  pitch: number;
  /** Dolly as a fraction of the camera rest distance (+ = pull back). */
  dolly: number;
  /** Max camera bank (radians). */
  roll: number;
  /** Peak rack-focus amount (0..1) fed into the DoF pass. */
  rackFocus: number;
  /** Additional FOV at peak (radians). */
  fov: number;
}

export const SHOT_PRESETS = {
  /** A readable wide composition, then a measured push onto the subject. */
  entry: {
    style: "entry", maneuver: "establish", departMs: 0, holdMs: 180,
    revealMs: 1600, yaw: 0.045, pitch: -0.025, dolly: 0.18,
    roll: 0.008, rackFocus: 0.18, fov: 0,
  },
  /** Portfolio stage -> stage (typography alignment): fast orbital whip-pan with angular velocity blur. */
  stage: {
    style: "pan",
    maneuver: "orbital_whip_pan",
    departMs: 560,
    holdMs: 48,
    revealMs: 1200,
    yaw: 1.15,
    pitch: 0.1,
    dolly: 0.08,
    roll: 0.035,
    rackFocus: 1.0,
    fov: 0.0,
  },
  /** Interstellar scene -> scene: grazing singularity fly-through / accretion eclipse arc. */
  scene: {
    style: "pan",
    maneuver: "singularity_flythrough",
    departMs: 720,
    holdMs: 64,
    revealMs: 1350,
    yaw: 0.82,
    pitch: 0.16,
    dolly: 0.14,
    roll: 0.05,
    rackFocus: 1.0,
    fov: 0.04,
  },
  /** Supernova / Kilonova / TDE: volumetric bloom flash masking + expanding radial shockwave shell. */
  supernova: {
    style: "recoil",
    maneuver: "kilonova_flash",
    departMs: 1250,
    holdMs: 100,
    revealMs: 2100,
    yaw: 0.42,
    pitch: 0.2,
    dolly: 0.32,
    roll: 0.06,
    rackFocus: 1.0,
    fov: 0.1,
  },
  /** Relativistic Jet / Warp Tunnel Pass (or emergence from horizon capture): FOV widens 45 deg -> 85 deg -> 45 deg. */
  emerge: {
    style: "emerge",
    maneuver: "relativistic_jet",
    departMs: 0,
    holdMs: 40,
    revealMs: 1500,
    yaw: 0.0,
    pitch: -0.06,
    dolly: -0.22,
    roll: 0.22,
    rackFocus: 0.9,
    fov: 0.12,
  },
  /** Explicit Warp / Surge jet alignment preset. */
  warp: {
    style: "pan",
    maneuver: "relativistic_jet",
    departMs: 750,
    holdMs: 48,
    revealMs: 1650,
    yaw: 0.35,
    pitch: -0.18,
    dolly: -0.28,
    roll: 0.18,
    rackFocus: 0.95,
    fov: 0, // fovDegrees owns the warp; never add the widening twice.
  },
  /** Reduced-motion: no camera travel, focus/veil only. */
  reduced: {
    style: "pan",
    maneuver: "reduced",
    departMs: 520,
    holdMs: 200,
    revealMs: 820,
    yaw: 0.0,
    pitch: 0.0,
    dolly: 0.0,
    roll: 0.0,
    rackFocus: 1.0,
    fov: 0.0,
  },
} satisfies Record<string, ShotPreset>;

export type ShotPresetName = keyof typeof SHOT_PRESETS;

export interface DirectorRequest {
  /** Idempotency key: queued requests with the same key replace each other. */
  key: string;
  /** Rebuild / target remap to run at transition handoff. */
  apply: () => void;
  preset?: ShotPresetName;
}

export interface ShotSnapshot {
  phase: DirectorPhase;
  /** Multi-stage transition phase (PHASE_DESTABILIZE, PHASE_TRANSIT_CUTSCENE, PHASE_SETTLE). */
  transitionPhase: TransitionStagePhase;
  /** Normalized overall transition progress in [0, 1]. */
  transitionProgress: number;
  /** Incoming particle clock starts at the actual remap and ends with the shot. */
  particleProgress: number;
  /** Lensing follows the same optical beat as the camera. */
  lensing: number;
  /** Active camera maneuver choreography. */
  maneuver: CameraManeuver;
  /** 0 = subject fully in shot, 1 = peak transition cutscene. Continuous. */
  veil: number;
  yaw: number;
  pitch: number;
  roll: number;
  /** Dolly (fraction of rest distance, + = backwards). */
  dolly: number;
  rackFocus: number;
  fov: number;
  /** Dynamic FOV in degrees (e.g. 45 -> 85 -> 45 during relativistic jet pass). */
  fovDegrees: number;
  /** Opacity multiplier for legacy hidden-veil callers (0 at peak HIDDEN). */
  foregroundAlpha: number;
  /** 3D camera spline position offset (in fractions of cameraZ). */
  splineOffset: { x: number; y: number; z: number };
  /** 3D camera look-target offset (in fractions of cameraZ). */
  lookOffset: { x: number; y: number; z: number };
  /** Instantaneous angular velocity magnitude (rad/s) for velocity-stretched motion blur. */
  angularVelocity: number;
  /** Racked focal distance multiplier (1.0 = normal subject plane, <1 = close bokeh rack). */
  focusDistanceFactor: number;
  /** Depth-of-field aperture depth multiplier (smaller = shallower DoF / softer bokeh discs). */
  apertureDepthFactor: number;
  /** Volumetric optical flash intensity spike (0..1) for Kilonova / TDE flash masking. */
  bloomSpike: number;
  /** Normalized radial shockwave shell radius (0..1) expanding from the core. */
  shockwaveRadius: number;
  style: ShotStyle;
}

export const NEUTRAL_SHOT: ShotSnapshot = Object.freeze({
  phase: "IDLE",
  transitionPhase: "IDLE",
  transitionProgress: 1,
  particleProgress: 1,
  lensing: 0,
  maneuver: "orbital_whip_pan",
  veil: 0,
  yaw: 0,
  pitch: 0,
  roll: 0,
  dolly: 0,
  rackFocus: 0,
  fov: 0,
  fovDegrees: 45,
  foregroundAlpha: 1,
  splineOffset: Object.freeze({ x: 0, y: 0, z: 0 }),
  lookOffset: Object.freeze({ x: 0, y: 0, z: 0 }),
  angularVelocity: 0,
  focusDistanceFactor: 1.0,
  apertureDepthFactor: 1.0,
  bloomSpike: 0,
  shockwaveRadius: 0,
  style: "pan",
}) as ShotSnapshot;

export const clamp01 = (v: number) => (Number.isFinite(v) ? (v < 0 ? 0 : v > 1 ? 1 : v) : 0);

export const easeInOutCubic = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

export const quinticEase = (t: number) => {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

/** Smoothstep with C1 continuity, safe for edge0 === edge1. */
export const smoothstep = (edge0: number, edge1: number, x: number) => {
  if (edge1 === edge0) return x < edge0 ? 0 : 1;
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/**
 * Maps normalized transition progress u \in [0, 1] into the 3 explicit stages:
 *   - 0.00 .. 0.25: PHASE_DESTABILIZE
 *   - 0.25 .. 0.75: PHASE_TRANSIT_CUTSCENE
 *   - 0.75 .. 1.00: PHASE_SETTLE
 */
export function resolveTransitionStagePhase(u: number, isIdle: boolean): TransitionStagePhase {
  if (isIdle) return "IDLE";
  const p = clamp01(u);
  if (p < 0.25) return "PHASE_DESTABILIZE";
  if (p < 0.75) return "PHASE_TRANSIT_CUTSCENE";
  return "PHASE_SETTLE";
}

export class CinematicTransitionDirector {
  private phase: DirectorPhase = "IDLE";
  private phaseStart = 0;
  private departFrom = 0; // veil value DEPART started from (reversal support)
  private holdUntil = 0;
  private queue: DirectorRequest[] = [];
  private preset: ShotPreset = SHOT_PRESETS.stage;
  private side = 1;
  private shotCount = 0;
  private lastVeil = 0;
  private lastYaw = 0;
  private lastPitch = 0;
  private lastUpdateAt = 0;
  private transitionStartAt = 0;
  private applyErrors = 0;
  private lastShot: ShotSnapshot = NEUTRAL_SHOT;
  private reversal: { shot: ShotSnapshot; at: number } | null = null;

  /** Optional global override, e.g. prefers-reduced-motion. */
  reducedMotion = false;

  get currentPhase(): DirectorPhase {
    return this.phase;
  }

  get currentTransitionPhase(): TransitionStagePhase {
    if (this.phase === "IDLE") return "IDLE";
    return resolveTransitionStagePhase(this.computeOverallProgress(this.lastUpdateAt), false);
  }

  get isBusy(): boolean {
    return this.phase !== "IDLE";
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  get errorCount(): number {
    return this.applyErrors;
  }

  private resolvePreset(name?: ShotPresetName): ShotPreset {
    if (this.reducedMotion) return SHOT_PRESETS.reduced;
    return SHOT_PRESETS[name ?? "stage"] ?? SHOT_PRESETS.stage;
  }

  private runApply(req: DirectorRequest) {
    try {
      req.apply();
    } catch (err) {
      this.applyErrors++;
      if (typeof console !== "undefined") console.error("[Director] rebuild failed:", err);
    }
  }

  private flushQueue() {
    const q = this.queue;
    this.queue = [];
    q.forEach((r) => this.runApply(r));
  }

  private enqueue(req: DirectorRequest) {
    const idx = this.queue.findIndex((r) => r.key === req.key);
    if (idx >= 0) this.queue[idx] = req;
    else this.queue.push(req);
  }

  private computeOverallProgress(now: number): number {
    if (this.phase === "IDLE") return 1.0;
    const totalDur = Math.max(1, this.preset.departMs + this.preset.holdMs + this.preset.revealMs);
    const start = this.preset.departMs <= 0 ? 0.5 : 0;
    const timeline = (elapsed: number) => start + (1 - start) * clamp01(elapsed / totalDur);
    if (this.phase === "DEPART") {
      const dur = Math.max(1, this.preset.departMs * (1 - this.departFrom));
      const u = clamp01((now - this.phaseStart) / dur);
      return timeline(u * this.preset.departMs);
    }
    if (this.phase === "HIDDEN") {
      const holdDur = Math.max(1, this.preset.holdMs);
      const elapsedHold = Math.max(0, holdDur - Math.max(0, this.holdUntil - now));
      const u = clamp01(elapsedHold / holdDur);
      return timeline(this.preset.departMs + u * this.preset.holdMs);
    }
    if (this.phase === "REVEAL") {
      const u = clamp01((now - this.phaseStart) / Math.max(1, this.preset.revealMs));
      return timeline(this.preset.departMs + this.preset.holdMs + u * this.preset.revealMs);
    }
    return clamp01((now - this.transitionStartAt) / totalDur);
  }

  /**
   * Request a transition choreographed with a camera maneuver.
   * Returns the phase the request landed in (for diagnostics / tests).
   */
  request(req: DirectorRequest, now: number): DirectorPhase {
    if (!req || typeof req.apply !== "function") return this.phase;
    const t = Number.isFinite(now) ? now : 0;
    const preset = this.resolvePreset(req.preset);

    switch (this.phase) {
      case "IDLE": {
        this.preset = preset;
        this.shotCount++;
        this.side = this.shotCount % 2 === 0 ? -1 : 1;
        this.transitionStartAt = t;
        this.enqueue(req);
        if (preset.departMs <= 0) {
          this.enterHidden(t);
        } else {
          this.phase = "DEPART";
          this.phaseStart = t;
          this.departFrom = 0;
        }
        return "DEPART";
      }
      case "DEPART": {
        // Upgrade to the longer/stronger preset if a heavier transition joins.
        if (preset.departMs > this.preset.departMs) {
          this.reversal = { shot: this.lastShot, at: t };
          this.departFrom = this.lastVeil;
          this.phaseStart = t;
          this.preset = preset;
        }
        this.enqueue(req);
        return "DEPART";
      }
      case "HIDDEN": {
        this.runApply(req);
        this.holdUntil = Math.max(this.holdUntil, t + preset.holdMs);
        if (preset.revealMs > this.preset.revealMs) this.preset = { ...this.preset, revealMs: preset.revealMs };
        return "HIDDEN";
      }
      case "REVEAL": {
        // Reverse smoothly from the current veil.
        this.reversal = { shot: this.lastShot, at: t };
        const v = this.lastVeil;
        this.preset = {
          ...preset,
          yaw: this.preset.yaw,
          pitch: this.preset.pitch,
          style: this.preset.style,
          maneuver: this.preset.maneuver,
        };
        this.enqueue(req);
        this.phase = "DEPART";
        this.phaseStart = t;
        this.departFrom = v;
        return "DEPART";
      }
    }
  }

  /**
   * Jump straight into HIDDEN (the screen is already dark, e.g. after a
   * black-hole plunge). The rebuild runs immediately; the reveal follows.
   */
  cutToHidden(req: DirectorRequest, now: number) {
    const t = Number.isFinite(now) ? now : 0;
    this.preset = this.resolvePreset(req.preset ?? "emerge");
    this.reversal = null;
    this.transitionStartAt = t;
    this.queue = [];
    this.enqueue(req);
    this.enterHidden(t);
  }

  /** Opening shot: no outgoing scene to hide, keep the subject visible. */
  establish(now: number) {
    if (this.reducedMotion) return;
    this.cutToHidden({ key: "entry", preset: "entry", apply: () => {} }, now);
  }

  private enterHidden(now: number) {
    this.phase = "HIDDEN";
    this.phaseStart = now;
    this.holdUntil = now + this.preset.holdMs;
    this.lastVeil = 1;
    this.flushQueue();
  }

  /** Abort everything (unmount). Pending rebuilds are applied so state stays coherent. */
  reset(applyPending = true) {
    if (applyPending) this.flushQueue();
    else this.queue = [];
    this.phase = "IDLE";
    this.lastVeil = 0;
    this.lastYaw = 0;
    this.lastPitch = 0;
    this.lastShot = NEUTRAL_SHOT;
    this.reversal = null;
  }

  /** Advance the shot. Call once per frame, before simulation. */
  update(now: number): ShotSnapshot {
    const t = Number.isFinite(now) ? now : this.phaseStart;
    const dtSec = Math.max(1 / 120, Math.min(0.1, (t - (this.lastUpdateAt || t - 16.67)) / 1000));
    this.lastUpdateAt = t;
    let veil = 0;

    // Carry overshoot into the next phase, even after a slow/background frame.
    // The handoff is synchronous, so no extra empty render frame is required.
    if (this.phase === "DEPART") {
      const end = this.phaseStart + Math.max(1, this.preset.departMs * (1 - this.departFrom));
      if (t >= end) this.enterHidden(end);
    }
    if (this.phase === "HIDDEN" && t >= this.holdUntil) {
      this.phase = "REVEAL";
      this.phaseStart = this.holdUntil;
    }

    if (this.phase === "DEPART") {
      const dur = Math.max(1, this.preset.departMs * (1 - this.departFrom));
      const u = clamp01((t - this.phaseStart) / dur);
      veil = this.departFrom + (1 - this.departFrom) * quinticEase(u);
      if (u >= 1) {
        this.enterHidden(t);
        veil = 1;
      }
    } else if (this.phase === "HIDDEN") {
      veil = 1;
      if (t >= this.holdUntil) {
        this.phase = "REVEAL";
        this.phaseStart = t;
      }
    } else if (this.phase === "REVEAL") {
      const u = clamp01((t - this.phaseStart) / Math.max(1, this.preset.revealMs));
      // Reveal eases out slowly so the camera "settles" onto the new subject.
      // Return early enough to see the arrival; reserve the tail for settling.
      const reveal = this.preset.style === "entry" ? quinticEase(u) : 1 - Math.pow(1 - u * u, 3);
      veil = 1 - reveal;
      if (u >= 1) {
        this.phase = "IDLE";
        veil = 0;
      }
    }

    this.lastVeil = veil;
    const progress = this.computeOverallProgress(t);
    let shot = this.snapshot(veil, progress, dtSec);
    if (this.reversal && this.phase !== "IDLE") {
      const blend = quinticEase((t - this.reversal.at) / 240);
      const from = this.reversal.shot;
      const mix = (a: number, b: number) => a + (b - a) * blend;
      shot = { ...shot };
      for (const key of ["yaw", "pitch", "roll", "dolly", "fov", "fovDegrees", "rackFocus", "focusDistanceFactor", "apertureDepthFactor", "bloomSpike", "lensing", "foregroundAlpha"] as const) {
        shot[key] = mix(from[key], shot[key]);
      }
      for (const key of ["splineOffset", "lookOffset"] as const) {
        shot[key] = { x: mix(from[key].x, shot[key].x), y: mix(from[key].y, shot[key].y), z: mix(from[key].z, shot[key].z) };
      }
      if (blend >= 1) this.reversal = null;
    }
    if (shot.phase !== "IDLE") {
      shot.angularVelocity = this.reducedMotion ? 0 : Math.min(8,
        Math.hypot(shot.yaw - this.lastShot.yaw, shot.pitch - this.lastShot.pitch) / dtSec);
    }
    this.lastShot = shot;
    return shot;
  }

  private snapshot(veil: number, progress: number, dtSec: number): ShotSnapshot {
    if (this.phase === "IDLE" && veil <= 0) {
      this.lastYaw = 0;
      this.lastPitch = 0;
      return NEUTRAL_SHOT;
    }

    const p = this.preset;
    const s = this.side;
    const maneuver: CameraManeuver = this.reducedMotion ? "reduced" : p.maneuver;
    const transitionPhase = resolveTransitionStagePhase(progress, false);

    // Yaw/pitch follow the veil; the arc gets a slight S-curve so the pan reads
    // like a hand-operated move rather than a linear tween.
    const arc = Math.sin(veil * Math.PI * 0.5);
    const yaw = s * p.yaw * arc;
    const pitch = p.pitch * arc;
    const roll = s * p.roll * Math.sin(veil * Math.PI) + (p.style === "emerge" ? p.roll * veil * veil : 0);

    // Angular velocity (rad/s) for velocity-stretched particle motion blur
    const dYaw = yaw - this.lastYaw;
    const dPitch = pitch - this.lastPitch;
    this.lastYaw = yaw;
    this.lastPitch = pitch;
    const angularVelocity = this.reducedMotion
      ? 0
      : Math.min(8.0, Math.hypot(dYaw, dPitch) / Math.max(0.008, dtSec));

    let fgAlpha: number;
    if (p.style === "entry") {
      fgAlpha = 1;
    } else if (p.style === "emerge") {
      fgAlpha = 1 - smoothstep(0.15, 0.85, veil);
    } else if (p.yaw <= 0.01) {
      fgAlpha = 1 - smoothstep(0.1, 0.9, veil);
    } else {
      fgAlpha = 1 - smoothstep(0.55, 0.97, veil);
    }

    // Choreographed 3D camera spline offsets & optical effects per maneuver
    let splineX = 0;
    let splineY = 0;
    let splineZ = 0;
    let lookX = 0;
    let lookY = 0;
    let lookZ = 0;
    let fovDegrees = 45;
    let bloomSpike = 0;
    let shockwaveRadius = 0;

    const bell = Math.sin(clamp01(progress) * Math.PI);
    const bellSq = bell * bell;

    if (!this.reducedMotion) {
      if (maneuver === "singularity_flythrough") {
        // Grazing arc past the black hole photon ring / dense core
        // PHASE_DESTABILIZE (0..0.25): slight pullback + dolly-zoom FOV narrow
        // PHASE_TRANSIT_CUTSCENE (0.25..0.75): close grazing arc across the core
        // PHASE_SETTLE (0.75..1.0): ease-out into the new orbital framing
        const grazeArc = Math.sin(progress * Math.PI * 2.0);
        splineX = s * 0.28 * bellSq;
        splineY = 0.09 * grazeArc * bell;
        const anticipation = smoothstep(0, 0.16, progress) * (1 - smoothstep(0.16, 0.36, progress));
        splineZ = 0.34 * bellSq - anticipation * 0.08;
        lookX = -s * 0.12 * bell;
        lookY = -0.04 * bell;
        fovDegrees = 45 - anticipation * 6 + smoothstep(0.16, 0.4, progress) * bellSq * 18;
        bloomSpike = bellSq * 0.35;
      } else if (maneuver === "orbital_whip_pan") {
        // Fast 90-to-180-degree orbital spline swing around the origin
        const whipAngle = s * veil * 1.15;
        splineX = Math.sin(whipAngle) * 0.22;
        splineY = Math.sin(veil * Math.PI) * 0.06;
        splineZ = (1 - Math.cos(whipAngle)) * 0.14;
        lookX = s * 0.18 * arc;
        fovDegrees = 45 + bellSq * 12;
      } else if (maneuver === "relativistic_jet") {
        // Align down relativistic jet axis, dynamically widen FOV 45 -> 85 -> 45 deg
        splineX = s * 0.08 * bell;
        splineY = 0.24 * bellSq;
        splineZ = 0.42 * bellSq;
        lookY = -0.15 * bell;
        fovDegrees = 45 + bellSq * 40; // 45 deg -> 85 deg -> 45 deg
        bloomSpike = bellSq * 0.45;
      } else if (maneuver === "kilonova_flash") {
        // Kilonova / TDE Flash Masking: volumetric bloom spike + radial shockwave shell
        splineX = s * 0.14 * bell;
        splineY = 0.11 * bell;
        splineZ = -0.28 * veil; // Recoil pullback from core detonation
        fovDegrees = 45 + bellSq * 22;
        bloomSpike = Math.pow(bell, 1.4) * 0.92;
        shockwaveRadius = clamp01((progress - 0.15) / 0.75);
      } else if (maneuver === "establish") {
        splineX = s * 0.035 * veil;
        splineY = 0.018 * veil;
        fovDegrees = 45 + 4 * veil;
      }
    }

    const rackFocus = p.rackFocus * smoothstep(0.0, 0.75, veil);
    // Rack focal distance closer/further during transit and shrink aperture depth so mid-transit particles become soft bokeh discs
    const focusDistanceFactor = 1.0 - rackFocus * 0.42;
    const apertureDepthFactor = Math.max(0.22, 1.0 - rackFocus * 0.72);

    return {
      phase: this.phase,
      transitionPhase,
      transitionProgress: progress,
      particleProgress: this.phase === "DEPART" ? 1 : this.phase === "HIDDEN" ? 0 : clamp01((this.lastUpdateAt - this.phaseStart) / Math.max(1, p.revealMs)),
      lensing: this.reducedMotion ? 0 : bellSq * (maneuver === "singularity_flythrough" ? 0.42 : 0.16),
      maneuver,
      veil,
      yaw,
      pitch,
      roll,
      // Arrival opens wider for a beat, then lands on the final composition.
      dolly: p.dolly * veil + (this.phase === "REVEAL" && p.style === "pan" && !this.reducedMotion ? 0.055 * Math.sin(Math.PI * clamp01((this.lastUpdateAt - this.phaseStart) / p.revealMs)) ** 2 : 0),
      rackFocus,
      fov: p.fov * veil,
      fovDegrees,
      foregroundAlpha: fgAlpha,
      splineOffset: { x: splineX, y: splineY, z: splineZ },
      lookOffset: { x: lookX, y: lookY, z: lookZ },
      angularVelocity,
      focusDistanceFactor,
      apertureDepthFactor,
      bloomSpike,
      shockwaveRadius,
      style: p.style,
    };
  }
}

export { CinematicTransitionDirector as TransitionDirector };
