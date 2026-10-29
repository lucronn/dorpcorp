/**
 * CinematicTransitionDirector
 * ---------------------------
 * Pure, framework-free state machine that choreographs every scene / stage
 * rebuild as a camera move instead of a visible particle morph.
 *
 *   IDLE ──request──▶ DEPART ──(camera has looked away / racked focus)──▶ HIDDEN
 *     ▲                                                                      │
 *     │                                   queued rebuilds are applied HERE   │
 *     └──────────── REVEAL ◀──────────────(minimum hold elapsed)─────────────┘
 *
 * While HIDDEN the scene is rebuilt *instantly* (particles and bodies are
 * settled on their final targets), so when the camera pans/pushes back the
 * next composition is already fully formed. Nothing is ever teleported in
 * view.
 *
 * Requests coalesce:
 *  - during DEPART a request with the same `key` replaces the queued one,
 *    a different key is appended (applied in order);
 *  - during HIDDEN the request is applied immediately and the hold extended;
 *  - during REVEAL the shot smoothly reverses from the current veil value.
 */

export type DirectorPhase = "IDLE" | "DEPART" | "HIDDEN" | "REVEAL";

/** Camera language used to hide a rebuild. */
export type ShotStyle =
  /** Pan / tilt the camera off the subject, rack focus, then pan back. */
  | "pan"
  /** Recoil: pull back and defocus (used for explosions). */
  | "recoil"
  /** Emerge: the screen is already black (wormhole / horizon); dolly out of darkness. */
  | "emerge";

export interface ShotPreset {
  style: ShotStyle;
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
  /** Portfolio stage → stage (typography). Short, gentle, readable. */
  stage: {
    style: "pan", departMs: 760, holdMs: 160, revealMs: 1200,
    yaw: 1.15, pitch: 0.1, dolly: 0.08, roll: 0.035, rackFocus: 1.0, fov: 0.0,
  },
  /** Interstellar scene → scene (catalog / sandbox / autopilot). */
  scene: {
    style: "pan", departMs: 1050, holdMs: 260, revealMs: 1750,
    yaw: 1.05, pitch: 0.16, dolly: 0.14, roll: 0.05, rackFocus: 1.0, fov: 0.04,
  },
  /** Supernova: recoil from the blast, rebuild behind the glare. */
  supernova: {
    style: "recoil", departMs: 1250, holdMs: 650, revealMs: 2100,
    yaw: 0.42, pitch: 0.2, dolly: 0.32, roll: 0.06, rackFocus: 1.0, fov: 0.1,
  },
  /** Re-emergence after the screen went dark (black-hole capture, wormhole exit). */
  emerge: {
    style: "emerge", departMs: 0, holdMs: 320, revealMs: 2300,
    yaw: 0.0, pitch: -0.06, dolly: -0.22, roll: 0.22, rackFocus: 0.9, fov: 0.12,
  },
  /** Reduced-motion: no camera travel, focus/veil only. */
  reduced: {
    style: "pan", departMs: 520, holdMs: 200, revealMs: 820,
    yaw: 0.0, pitch: 0.0, dolly: 0.0, roll: 0.0, rackFocus: 1.0, fov: 0.0,
  },
} satisfies Record<string, ShotPreset>;

export type ShotPresetName = keyof typeof SHOT_PRESETS;

export interface DirectorRequest {
  /** Idempotency key: queued requests with the same key replace each other. */
  key: string;
  /** Rebuild to run while the view is hidden. Should be instant (no morph). */
  apply: () => void;
  preset?: ShotPresetName;
}

export interface ShotSnapshot {
  phase: DirectorPhase;
  /** 0 = subject fully in shot, 1 = fully hidden. Continuous. */
  veil: number;
  yaw: number;
  pitch: number;
  roll: number;
  /** Dolly (fraction of rest distance, + = backwards). */
  dolly: number;
  rackFocus: number;
  fov: number;
  /** Opacity multiplier for foreground subject (typography / bodies). */
  foregroundAlpha: number;
  style: ShotStyle;
}

export const NEUTRAL_SHOT: ShotSnapshot = Object.freeze({
  phase: "IDLE",
  veil: 0,
  yaw: 0,
  pitch: 0,
  roll: 0,
  dolly: 0,
  rackFocus: 0,
  fov: 0,
  foregroundAlpha: 1,
  style: "pan",
}) as ShotSnapshot;

export const clamp01 = (v: number) => (Number.isFinite(v) ? (v < 0 ? 0 : v > 1 ? 1 : v) : 0);

export const easeInOutCubic = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

/** Smoothstep with C1 continuity, safe for edge0 === edge1. */
export const smoothstep = (edge0: number, edge1: number, x: number) => {
  if (edge1 === edge0) return x < edge0 ? 0 : 1;
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

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
  private applyErrors = 0;

  /** Optional global override, e.g. prefers-reduced-motion. */
  reducedMotion = false;

  get currentPhase(): DirectorPhase {
    return this.phase;
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

  /**
   * Request a rebuild hidden behind a camera move.
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
        if (preset.departMs > this.preset.departMs) this.preset = preset;
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
        const v = this.lastVeil;
        this.preset = { ...preset, yaw: this.preset.yaw, pitch: this.preset.pitch, style: this.preset.style };
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
    this.queue = [];
    this.enqueue(req);
    this.enterHidden(t);
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
  }

  /** Advance the shot. Call once per frame, before simulation. */
  update(now: number): ShotSnapshot {
    const t = Number.isFinite(now) ? now : this.phaseStart;
    let veil = 0;

    if (this.phase === "DEPART") {
      const dur = Math.max(1, this.preset.departMs * (1 - this.departFrom));
      const u = clamp01((t - this.phaseStart) / dur);
      veil = this.departFrom + (1 - this.departFrom) * easeInOutCubic(u);
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
      veil = 1 - easeInOutCubic(u);
      if (u >= 1) {
        this.phase = "IDLE";
        veil = 0;
      }
    }

    this.lastVeil = veil;
    return this.snapshot(veil);
  }

  private snapshot(veil: number): ShotSnapshot {
    if (this.phase === "IDLE" && veil <= 0) return NEUTRAL_SHOT;
    const p = this.preset;
    const s = this.side;
    // Yaw/pitch follow the veil; the arc gets a slight S-curve so the pan reads
    // like a hand-operated move rather than a linear tween.
    const arc = Math.sin(veil * Math.PI * 0.5);
    let fgAlpha: number;
    if (p.style === "emerge") {
      fgAlpha = 1 - smoothstep(0.15, 0.85, veil);
    } else if (p.yaw <= 0.01) {
      fgAlpha = 1 - smoothstep(0.1, 0.9, veil);
    } else {
      // The camera does most of the hiding; the fade only finishes the job
      // once the subject is already out of frame.
      fgAlpha = 1 - smoothstep(0.55, 0.97, veil);
    }
    return {
      phase: this.phase,
      veil,
      yaw: s * p.yaw * arc,
      pitch: p.pitch * arc,
      roll: s * p.roll * Math.sin(veil * Math.PI) + (p.style === "emerge" ? p.roll * veil * veil : 0),
      dolly: p.dolly * veil,
      rackFocus: p.rackFocus * smoothstep(0.0, 0.75, veil),
      fov: p.fov * veil,
      foregroundAlpha: fgAlpha,
      style: p.style,
    };
  }
}
