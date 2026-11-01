import { CelestialEntity } from "./types";

export const blendHexColors = (c1: string, c2: string, weight: number): string => {
  if (!c1 || !c2 || typeof c1 !== "string" || typeof c2 !== "string" || !c1.startsWith("#") || !c2.startsWith("#")) {
    return c1 || c2 || "#ffffff";
  }
  const r1 = parseInt(c1.slice(1, 3), 16);
  const g1 = parseInt(c1.slice(3, 5), 16);
  const b1 = parseInt(c1.slice(5, 7), 16);

  const r2 = parseInt(c2.slice(1, 3), 16);
  const g2 = parseInt(c2.slice(3, 5), 16);
  const b2 = parseInt(c2.slice(5, 7), 16);

  const r = Math.round(r1 * (1 - weight) + r2 * weight);
  const g = Math.round(g1 * (1 - weight) + g2 * weight);
  const b = Math.round(b1 * (1 - weight) + b2 * weight);

  const rs = r.toString(16).padStart(2, "0");
  const gs = g.toString(16).padStart(2, "0");
  const bs = b.toString(16).padStart(2, "0");

  return `#${rs}${gs}${bs}`;
};

// Procedural 2D Value Noise function
export const valueNoise2D = (x: number, y: number): number => {
  const X = Math.floor(x);
  const Y = Math.floor(y);
  const fx = x - X;
  const fy = y - Y;

  // Smoothstep interpolation curves
  const u = fx * fx * (3.0 - 2.0 * fx);
  const v = fy * fy * (3.0 - 2.0 * fy);

  // Custom deterministic pseudo-random hash
  const hash = (i: number, j: number) => {
    const s = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453123;
    return s - Math.floor(s);
  };

  const n00 = hash(X, Y);
  const n10 = hash(X + 1, Y);
  const n01 = hash(X, Y + 1);
  const n11 = hash(X + 1, Y + 1);

  return n00 * (1.0 - u) * (1.0 - v) +
         n10 * u * (1.0 - v) +
         n01 * (1.0 - u) * v +
         n11 * u * v;
};

// Fractional Brownian Motion (fBm) with multiple noise octaves
export const fBmNoise2D = (x: number, y: number, octaves: number = 4): number => {
  let value = 0.0;
  let amplitude = 0.5;
  let frequency = 1.0;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * valueNoise2D(x * frequency, y * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
};

// Compute Curl Noise (2D vector field with zero divergence) for continuous fluid flow
export const computeCurlNoise = (x: number, y: number, time: number): { x: number; y: number } => {
  const eps = 0.1;
  const scale = 0.0035;

  const p_y1 = fBmNoise2D(x * scale, (y + eps) * scale + time * 0.02, 3);
  const p_y0 = fBmNoise2D(x * scale, (y - eps) * scale + time * 0.02, 3);

  const p_x1 = fBmNoise2D((x + eps) * scale, y * scale + time * 0.02, 3);
  const p_x0 = fBmNoise2D((x - eps) * scale, y * scale + time * 0.02, 3);

  // Curl mathematical formulation: (dPotential / dy, -dPotential / dx)
  const vx = (p_y1 - p_y0) / (2 * eps);
  const vy = -(p_x1 - p_x0) / (2 * eps);

  return { x: vx * 12.0, y: vy * 12.0 };
};

/**
 * C2-continuous Quintic Hermite interpolation (6t^5 - 15t^4 + 10t^3).
 * Guarantees zero velocity and zero acceleration discontinuities at t = 0 and t = 1.
 */
export const quinticEaseInOut = (t: number): number => {
  if (!Number.isFinite(t)) {
    return t === Infinity ? 1.0 : 0.0;
  }
  const c = Math.max(0.0, Math.min(1.0, t));
  return c * c * c * (c * (c * 6.0 - 15.0) + 10.0);
};

export type SceneChoreographyAct = "CALM_GENESIS" | "RISING_TENSION" | "CLIMAX" | "AFTERGLOW";

export interface SceneChoreographyMetrics {
  act: SceneChoreographyAct;    // Current 4-act choreography stage
  tension: number;              // 0.0 (ambient genesis) -> 1.0 (climactic peak)
  velocityMultiplier: number;   // 0.58 -> 1.85 orbital & stream velocity ramp
  gravityMultiplier: number;    // 0.42 -> 1.75 gravitational pull & spacetime well depth ramp
  densityCompression: number;   // 0.0 -> 0.24 radial accretion compaction
  turbulenceMultiplier: number; // 0.40 -> 1.35 curl-noise fluid vorticity scale
  emissionMultiplier: number;   // 0.25 -> 1.65 synchrotron spark & tail emission density
  shaderIntensity: number;      // 0.0 -> 1.0 post-process & GPU shader intensification
  climaxPulse: number;          // 0.0 -> 1.0 sustained climax eruption & afterglow envelope
  transitionSpringScale: number;// 0.04 -> 1.0 momentum-preserving spring capture ramp
  transitionDrag: number;       // 0.952 (inertial coast) -> 0.86 (orbital capture)
}

/**
 * Computes continuous visual choreography and rising tension metrics across a scene's lifecycle:
 * - Act I   (0s - 10s):  Calm, subtle ambient genesis & gentle typography coalescence
 * - Act II  (10s - 42s): Gradual ramp of orbital velocity, density, gravity, and shader glow
 * - Act III (Climax):    Extravagant high-impact cosmic peak with a long luminous afterglow
 * - Act IV  (Transition): Momentum-carrying inertial release followed by smooth gravitational capture
 */
export const computeSceneChoreography = (
  sceneAgeSec: number,
  climaxElapsedSec?: number | null,
  transitionElapsedSec?: number | null
): SceneChoreographyMetrics => {
  const safeAge = Number.isFinite(sceneAgeSec) ? Math.max(0.0, sceneAgeSec) : 0.0;
  const safeClimax = typeof climaxElapsedSec === "number" && Number.isFinite(climaxElapsedSec) ? climaxElapsedSec : -1.0;
  const safeTrans = typeof transitionElapsedSec === "number" && Number.isFinite(transitionElapsedSec) ? transitionElapsedSec : -1.0;

  // 1. Climax envelope: 12.5-second arc (fast 1.8s rise -> 3.4s high-energy plateau -> 7.3s luminous afterglow)
  let climaxPulse = 0.0;
  if (safeClimax >= 0 && safeClimax < 12.5) {
    if (safeClimax < 1.8) {
      climaxPulse = quinticEaseInOut(safeClimax / 1.8);
    } else if (safeClimax < 5.2) {
      climaxPulse = 1.0 - 0.08 * Math.sin(((safeClimax - 1.8) / 3.4) * Math.PI);
    } else {
      const decayT = (safeClimax - 5.2) / 7.3;
      climaxPulse = Math.max(0.0, 1.0 - quinticEaseInOut(decayT));
    }
  }

  let act: SceneChoreographyAct = "CALM_GENESIS";
  if (safeClimax >= 0 && safeClimax < 5.2) {
    act = "CLIMAX";
  } else if ((safeClimax >= 5.2 && safeClimax < 13.0) || (safeTrans >= 0 && safeTrans < 7.8)) {
    act = "AFTERGLOW";
  } else if (safeAge >= 10.0) {
    act = "RISING_TENSION";
  }

  // 2. Progressive Scene Tension Curve (0s -> 42s)
  let baseTension = 0.14;
  if (safeAge < 10.0) {
    // Act I: Ambient Genesis — serene, meditative opening
    baseTension = 0.14 + quinticEaseInOut(safeAge / 10.0) * 0.14;
  } else if (safeAge < 42.0) {
    // Act II: Rising Tension — organic non-linear build-up
    const buildT = (safeAge - 10.0) / 32.0;
    baseTension = 0.28 + quinticEaseInOut(buildT) * 0.60;
  } else {
    // Sustained high tension with gentle harmonic breathing
    baseTension = 0.88 + Math.sin((safeAge - 42.0) * 0.25) * 0.04;
  }

  // Smooth C2-continuous decompression from departing scene tension (0.88) into Act I genesis (0.14) during 7.8s voyage
  if (safeTrans >= 0 && safeTrans < 7.8) {
    const departureCarryover = (1.0 - quinticEaseInOut(safeTrans / 7.8)) * 0.74;
    baseTension = Math.min(0.88, baseTension + departureCarryover);
  }

  const tension = Math.min(1.0, baseTension + climaxPulse * 0.35);

  // 3. Physics & Shader Multipliers driven by tension & climax
  const velocityMultiplier = 0.56 + tension * 0.84 + climaxPulse * 0.45;
  const gravityMultiplier = 0.42 + Math.pow(tension, 1.35) * 0.92 + climaxPulse * 0.42;
  const densityCompression = Math.pow(tension, 1.4) * 0.18 + climaxPulse * 0.06;
  const turbulenceMultiplier = 0.40 + tension * 0.65 + climaxPulse * 0.35;
  const emissionMultiplier = 0.24 + Math.pow(tension, 1.5) * 0.86 + climaxPulse * 0.65;
  const shaderIntensity = Math.min(1.0, Math.pow(tension, 1.25) * 0.72 + climaxPulse * 0.55);

  // 4. Momentum-Preserving Transition Envelope (7.8s deep-space voyage)
  let transitionSpringScale = 1.0;
  let transitionDrag = 0.86;
  if (safeTrans >= 0 && safeTrans < 7.8) {
    if (safeTrans < 1.8) {
      // Inertial release & cosmic slipstream coasting: particles carry existing momentum
      const releaseT = quinticEaseInOut(safeTrans / 1.8);
      transitionSpringScale = 0.18 * (1.0 - releaseT) + 0.035 * releaseT;
      transitionDrag = 0.86 + releaseT * 0.092; // up to 0.952 for long sweeping inertial arcs
    } else {
      // Gradual gravitational capture into the newly discovered celestial system
      const captureT = quinticEaseInOut((safeTrans - 1.8) / 6.0);
      transitionSpringScale = 0.035 + captureT * 0.965;
      transitionDrag = 0.952 - captureT * 0.092;
    }
  }

  return {
    act,
    tension,
    velocityMultiplier,
    gravityMultiplier,
    densityCompression,
    turbulenceMultiplier,
    emissionMultiplier,
    shaderIntensity,
    climaxPulse,
    transitionSpringScale,
    transitionDrag,
  };
};

export interface CollisionResult {
  kineticEnergyDissipated: number;
  contactPointX: number;
  contactPointY: number;
  contactPointZ: number;
}

// Re-export unified General Relativity & hydrodynamic collision solver
export { resolveCelestialCollision } from "./CollisionEngine";

type SpawnParticleFn = (
  x: number,
  y: number,
  z: number,
  vx: number,
  vy: number,
  color: string,
  decayRate?: number
) => void;

export const createDustSplash = (
  x: number,
  y: number,
  color: string,
  count: number,
  spawnP: SpawnParticleFn
) => {
  const safeCount = Math.min(30, count);
  for (let i = 0; i < safeCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.1 + Math.random() * 0.3;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    spawnP(x, y, (Math.random() - 0.5) * 10, vx, vy, color, 0.02);
  }
};

export const createShatterDebris = (
  x: number,
  y: number,
  color: string,
  count: number,
  spawnP: SpawnParticleFn
) => {
  const safeCount = Math.min(40, count);
  for (let i = 0; i < safeCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.15 + Math.random() * 0.35;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    spawnP(x, y, (Math.random() - 0.5) * 20, vx, vy, color, 0.025);
  }
};

export const createSpaghettificationDebris = (
  bh: CelestialEntity,
  victim: CelestialEntity,
  spawnP: SpawnParticleFn
) => {
  const count = Math.min(80, Math.floor(victim.radius * 2));
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * victim.radius;
    const px = victim.x + Math.cos(angle) * r;
    const py = victim.y + Math.sin(angle) * r;

    const dx = px - bh.x;
    const dy = py - bh.y;
    const orbitAngle = Math.atan2(dy, dx) + Math.PI / 2;
    const speed = 0.2 + Math.random() * 0.3;
    const vx = Math.cos(orbitAngle) * speed + (bh.x - px) * 0.005;
    const vy = Math.sin(orbitAngle) * speed + (bh.y - py) * 0.005;

    spawnP(
      px,
      py,
      (Math.random() - 0.5) * victim.radius,
      vx,
      vy,
      victim.color || "#88aaff",
      0.015
    );
  }
};

export const swallowEntity = (
  bh: CelestialEntity,
  victim: CelestialEntity
) => {
  victim.isSwallowing = true;
  victim.destroyedBy = "blackhole";
  const newMass = (bh.mass || 100) + (victim.mass || 50);
  bh.mass = newMass;

  // Blackhole target radius swells from ingested mass!
  const targetRadius = Math.min(bh.radius * 1.5, Math.sqrt(newMass / 15));
  bh.targetRadius = targetRadius;
};
