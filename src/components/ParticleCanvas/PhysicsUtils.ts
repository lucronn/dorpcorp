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
