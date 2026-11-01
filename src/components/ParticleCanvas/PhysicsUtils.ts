import { CelestialEntity } from "./types";

export const normalizeHexColor = (hex: string): string => {
  if (typeof hex !== "string") return "#ffffff";
  const cleaned = hex.trim().toLowerCase();
  if (!cleaned.startsWith("#")) return hex;
  if (cleaned.length === 4 || cleaned.length === 5) {
    return `#${cleaned[1]}${cleaned[1]}${cleaned[2]}${cleaned[2]}${cleaned[3]}${cleaned[3]}`;
  }
  if (cleaned.length === 9) {
    return cleaned.slice(0, 7);
  }
  return cleaned;
};

export const blendHexColors = (c1: string, c2: string, weight: number): string => {
  if (!c1 || !c2 || typeof c1 !== "string" || typeof c2 !== "string" || !c1.startsWith("#") || !c2.startsWith("#")) {
    return c1 || c2 || "#ffffff";
  }
  const norm1 = normalizeHexColor(c1);
  const norm2 = normalizeHexColor(c2);
  if (norm1.length < 7 || norm2.length < 7) {
    return c1 || c2 || "#ffffff";
  }

  const r1 = parseInt(norm1.slice(1, 3), 16) || 0;
  const g1 = parseInt(norm1.slice(3, 5), 16) || 0;
  const b1 = parseInt(norm1.slice(5, 7), 16) || 0;

  const r2 = parseInt(norm2.slice(1, 3), 16) || 0;
  const g2 = parseInt(norm2.slice(3, 5), 16) || 0;
  const b2 = parseInt(norm2.slice(5, 7), 16) || 0;

  const w = isNaN(weight) ? 0.5 : Math.max(0, Math.min(1, weight));
  const r = Math.round(r1 * (1 - w) + r2 * w);
  const g = Math.round(g1 * (1 - w) + g2 * w);
  const b = Math.round(b1 * (1 - w) + b2 * w);

  const rs = r.toString(16).padStart(2, "0");
  const gs = g.toString(16).padStart(2, "0");
  const bs = b.toString(16).padStart(2, "0");

  return `#${rs}${gs}${bs}`;
};

// Procedural 2D Value Noise function
export const valueNoise2D = (x: number, y: number): number => {
  if (!isFinite(x) || !isFinite(y)) return 0.5;
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

// Procedural 3D Value / Lattice Noise function
export const valueNoise3D = (x: number, y: number, z: number): number => {
  if (!isFinite(x) || !isFinite(y) || !isFinite(z)) return 0.5;
  const X = Math.floor(x);
  const Y = Math.floor(y);
  const Z = Math.floor(z);
  const fx = x - X;
  const fy = y - Y;
  const fz = z - Z;

  // Quintic smoothstep interpolation for C2 continuity in curl derivatives
  const u = fx * fx * fx * (fx * (fx * 6.0 - 15.0) + 10.0);
  const v = fy * fy * fy * (fy * (fy * 6.0 - 15.0) + 10.0);
  const w = fz * fz * fz * (fz * (fz * 6.0 - 15.0) + 10.0);

  const hash3 = (i: number, j: number, k: number) => {
    const s = Math.sin(i * 12.9898 + j * 78.233 + k * 37.719) * 43758.5453123;
    return s - Math.floor(s);
  };

  const n000 = hash3(X, Y, Z);
  const n100 = hash3(X + 1, Y, Z);
  const n010 = hash3(X, Y + 1, Z);
  const n110 = hash3(X + 1, Y + 1, Z);
  const n001 = hash3(X, Y, Z + 1);
  const n101 = hash3(X + 1, Y, Z + 1);
  const n011 = hash3(X, Y + 1, Z + 1);
  const n111 = hash3(X + 1, Y + 1, Z + 1);

  const nx00 = n000 * (1.0 - u) + n100 * u;
  const nx10 = n010 * (1.0 - u) + n110 * u;
  const nx01 = n001 * (1.0 - u) + n101 * u;
  const nx11 = n011 * (1.0 - u) + n111 * u;

  const nxy0 = nx00 * (1.0 - v) + nx10 * v;
  const nxy1 = nx01 * (1.0 - v) + nx11 * v;

  return nxy0 * (1.0 - w) + nxy1 * w;
};

// Fractional Brownian Motion (fBm) with multiple noise octaves
export const fBmNoise2D = (x: number, y: number, octaves: number = 4): number => {
  if (!isFinite(x) || !isFinite(y)) return 0.5;
  const safeOctaves = isFinite(octaves) && octaves > 0 ? Math.min(8, Math.floor(octaves)) : 4;
  let value = 0.0;
  let amplitude = 0.5;
  let frequency = 1.0;
  for (let i = 0; i < safeOctaves; i++) {
    value += amplitude * valueNoise2D(x * frequency, y * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
};

export const fBmNoise3D = (x: number, y: number, z: number, octaves: number = 3): number => {
  if (!isFinite(x) || !isFinite(y) || !isFinite(z)) return 0.5;
  const safeOctaves = isFinite(octaves) && octaves > 0 ? Math.min(6, Math.floor(octaves)) : 3;
  let value = 0.0;
  let amplitude = 0.5;
  let frequency = 1.0;
  for (let i = 0; i < safeOctaves; i++) {
    value += amplitude * valueNoise3D(x * frequency, y * frequency, z * frequency);
    frequency *= 2.02;
    amplitude *= 0.5;
  }
  return value;
};

// Compute Curl Noise (2D vector field with zero divergence) for continuous fluid flow
export const computeCurlNoise = (x: number, y: number, time: number): { x: number; y: number } => {
  if (!isFinite(x) || !isFinite(y) || !isFinite(time)) {
    return { x: 0, y: 0 };
  }
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
 * Divergence-free 3D Curl Noise Field (\nabla \times \vec{\Psi})
 * Computes the curl of a 3D vector potential \vec{\Psi} = (\Psi_x, \Psi_y, \Psi_z)
 * using central finite differences.
 */
export const computeCurlNoise3D = (
  x: number,
  y: number,
  z: number,
  time: number,
  scale: number = 0.0028,
  amplitude: number = 18.0
): { x: number; y: number; z: number } => {
  if (!isFinite(x) || !isFinite(y) || !isFinite(z) || !isFinite(time)) {
    return { x: 0, y: 0, z: 0 };
  }
  const s = isFinite(scale) && scale > 0 ? scale : 0.0028;
  const amp = isFinite(amplitude) ? amplitude : 18.0;
  const eps = 0.08;
  const sx = x * s + time * 0.018;
  const sy = y * s - time * 0.015;
  const sz = z * s + time * 0.012;

  // Offset coordinates for the 3 components of vector potential \Psi
  const psiX = (px: number, py: number, pz: number) => valueNoise3D(px, py, pz) * 0.65 + valueNoise3D(px * 2.1, py * 2.1, pz * 2.1) * 0.35;
  const psiY = (px: number, py: number, pz: number) => valueNoise3D(px + 31.416, py + 47.853, pz + 19.19) * 0.65 + valueNoise3D((px + 13.7) * 2.1, (py + 29.3) * 2.1, (pz + 7.1) * 2.1) * 0.35;
  const psiZ = (px: number, py: number, pz: number) => valueNoise3D(px + 73.156, py + 12.679, pz + 91.42) * 0.65 + valueNoise3D((px + 53.2) * 2.1, (py + 11.8) * 2.1, (pz + 37.9) * 2.1) * 0.35;

  const inv2Eps = 1.0 / (2.0 * eps);

  const dPsiZ_dy = (psiZ(sx, sy + eps, sz) - psiZ(sx, sy - eps, sz)) * inv2Eps;
  const dPsiY_dz = (psiY(sx, sy, sz + eps) - psiY(sx, sy, sz - eps)) * inv2Eps;

  const dPsiX_dz = (psiX(sx, sy, sz + eps) - psiX(sx, sy, sz - eps)) * inv2Eps;
  const dPsiZ_dx = (psiZ(sx + eps, sy, sz) - psiZ(sx - eps, sy, sz)) * inv2Eps;

  const dPsiY_dx = (psiY(sx + eps, sy, sz) - psiY(sx - eps, sy, sz)) * inv2Eps;
  const dPsiX_dy = (psiX(sx, sy + eps, sz) - psiX(sx, sy - eps, sz)) * inv2Eps;

  return {
    x: (dPsiZ_dy - dPsiY_dz) * amp,
    y: (dPsiX_dz - dPsiZ_dx) * amp,
    z: (dPsiY_dx - dPsiX_dy) * amp,
  };
};

/**
 * Spatial Wavefront Triggering:
 * Computes local transition progress t_local \in [0, 1] per particle based on a propagating 3D wavefront:
 *   t_local = clamp((u_progress - d_norm * w_spread - a_seed.x * w_jitter) / (1.0 - w_spread - w_jitter), 0.0, 1.0)
 */
export const computeLocalWavefrontProgress = (
  uProgress: number,
  dNorm: number,
  seedX: number,
  wSpread: number = 0.45,
  wJitter: number = 0.20
): number => {
  if (!isFinite(uProgress)) return 1.0;
  if (uProgress <= 0.0) return 0.0;
  if (uProgress >= 1.0) return 1.0;
  const safeD = isFinite(dNorm) ? Math.max(0.0, Math.min(1.0, dNorm)) : 0.5;
  const safeSeed = isFinite(seedX) ? Math.max(0.0, Math.min(1.0, seedX)) : 0.5;
  const spread = isFinite(wSpread) ? Math.max(0.0, Math.min(0.65, wSpread)) : 0.45;
  const jitter = isFinite(wJitter) ? Math.max(0.0, Math.min(0.30, wJitter)) : 0.20;
  const denom = Math.max(0.05, 1.0 - spread - jitter);
  const raw = (uProgress - safeD * spread - safeSeed * jitter) / denom;
  return Math.max(0.0, Math.min(1.0, raw));
};

/**
 * Quintic smoothstep C2 easing: 6t^5 - 15t^4 + 10t^3
 */
export const quinticSmoothstep = (t: number): number => {
  if (!isFinite(t)) return 0.0;
  const x = Math.max(0.0, Math.min(1.0, t));
  return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
};

/** Exact critically damped step, stable even when the render loop drops frames.
 * Units are the simulation's 60 Hz ticks. Mutates in place to avoid per-particle allocations. */
export function advanceCriticalSpring(
  p: { x: number; y: number; z: number; vx: number; vy: number; vz?: number },
  targetX: number, targetY: number, targetZ: number, stiffness: number, dt: number
) {
  const omega = Math.sqrt(Math.max(0.001, Math.min(1, Number.isFinite(stiffness) ? stiffness : 0.08)));
  const h = Math.max(0, Math.min(60, Number.isFinite(dt) ? dt : 0));
  const decay = Math.exp(-omega * h);
  const dx = p.x - targetX, dy = p.y - targetY, dz = p.z - targetZ;
  const cx = p.vx + omega * dx, cy = p.vy + omega * dy, cz = (p.vz ?? 0) + omega * dz;
  p.x = targetX + (dx + cx * h) * decay;
  p.y = targetY + (dy + cy * h) * decay;
  p.z = targetZ + (dz + cz * h) * decay;
  p.vx = (p.vx - omega * cx * h) * decay;
  p.vy = (p.vy - omega * cy * h) * decay;
  p.vz = ((p.vz ?? 0) - omega * cz * h) * decay;
}

/** Incremental, C2 landing correction guarantees arrival on the shot deadline,
 * including when a slow frame skips the last part of the spring simulation. */
export function computeArrivalCorrection(previous: number, current: number): number {
  if (current <= previous) return 0;
  if (current >= 1) return 1;
  const before = quinticSmoothstep((previous - 0.6) / 0.4);
  const after = quinticSmoothstep((current - 0.6) / 0.4);
  return Math.max(0, Math.min(1, (after - before) / Math.max(1e-9, 1 - before)));
}

/**
 * Critically Damped Harmonic Oscillator Spring Force:
 *   \vec{F}_{spring} = -k * (\vec{x} - \vec{x}_{target}) - 2 * \sqrt{k} * \vec{v}
 */
export const computeCriticallyDampedSpringForce = (
  x: number,
  y: number,
  z: number,
  targetX: number,
  targetY: number,
  targetZ: number,
  vx: number,
  vy: number,
  vz: number,
  k: number
): { fx: number; fy: number; fz: number } => {
  const safeK = isFinite(k) && k > 0 ? Math.min(1.0, k) : 0.08;
  const damping = 2.0 * Math.sqrt(safeK);
  const dx = (isFinite(x) ? x : 0) - (isFinite(targetX) ? targetX : 0);
  const dy = (isFinite(y) ? y : 0) - (isFinite(targetY) ? targetY : 0);
  const dz = (isFinite(z) ? z : 0) - (isFinite(targetZ) ? targetZ : 0);
  const svx = isFinite(vx) ? vx : 0;
  const svy = isFinite(vy) ? vy : 0;
  const svz = isFinite(vz) ? vz : 0;

  return {
    fx: -safeK * dx - damping * svx,
    fy: -safeK * dy - damping * svy,
    fz: -safeK * dz - damping * svz,
  };
};

/**
 * Blackbody Temperature & Color Continuity:
 * Interpolates source -> target color over eased local progress and applies a
 * relativistic blackbody thermal boost (shifting high-velocity particles toward
 * white/blue-violet 15,000K plasma and cooling into the target palette as velocity drops).
 */
export const computeBlackbodyColorContinuity = (
  sourceR: number,
  sourceG: number,
  sourceB: number,
  targetR: number,
  targetG: number,
  targetB: number,
  tLocalEased: number,
  speed: number,
  isTransitioning: boolean
): { r: number; g: number; b: number; heatBoost: number } => {
  const t = isFinite(tLocalEased) ? Math.max(0.0, Math.min(1.0, tLocalEased)) : 1.0;
  const sr = isFinite(sourceR) ? sourceR : targetR;
  const sg = isFinite(sourceG) ? sourceG : targetG;
  const sb = isFinite(sourceB) ? sourceB : targetB;
  const tr = isFinite(targetR) ? targetR : 255;
  const tg = isFinite(targetG) ? targetG : 255;
  const tb = isFinite(targetB) ? targetB : 255;

  let baseR = sr + (tr - sr) * t;
  let baseG = sg + (tg - sg) * t;
  let baseB = sb + (tb - sb) * t;

  const safeSpeed = isFinite(speed) && speed > 0 ? speed : 0;
  // Bell-curve transit boost + velocity thermal excitation
  const transitBell = isTransitioning ? Math.sin(t * Math.PI) : 0.0;
  const velNorm = Math.min(1.0, safeSpeed / 28.0);
  const heat = Math.min(1.0, velNorm * (0.45 + transitBell * 0.55));

  if (heat > 0.02) {
    // Hot O/B blackbody plasma spectrum (luminous blue-white: R=210, G=242, B=255)
    baseR = baseR * (1.0 - heat * 0.45) + 215 * (heat * 0.45);
    baseG = baseG * (1.0 - heat * 0.52) + 245 * (heat * 0.52);
    baseB = baseB * (1.0 - heat * 0.65) + 255 * (heat * 0.65);
  }

  return {
    r: Math.max(0, Math.min(255, baseR)),
    g: Math.max(0, Math.min(255, baseG)),
    b: Math.max(0, Math.min(255, baseB)),
    heatBoost: 1.0 + heat * 0.85,
  };
};

// Re-export collision & debris functions from CollisionEngine to avoid duplicate implementations
export {
  resolveCelestialCollision,
  createDustSplash,
  createShatterDebris,
  createSpaghettificationDebris,
  swallowEntity,
  spawnCollisionFlare,
  updateCollisionFlares,
  disposeCollisionFlares,
  type CollisionResult,
  type SpawnParticleFn,
} from "./CollisionEngine";
