import { CelestialEntity } from "./types";

export const blendHexColors = (c1: string, c2: string, weight: number): string => {
  if (!c1.startsWith("#") || !c2.startsWith("#")) return c1;
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
 * Calculates the Roche limit between a massive primary body and a secondary body.
 * If the distance is less than this limit, tidal forces will tear the secondary body apart.
 */
export const calculateRocheLimit = (radiusPrimary: number, massPrimary: number, massSecondary: number): number => {
  // Physical Roche Limit heuristic for celestial fluid satellites:
  // d ≈ (1.5 to 2.2) * R_primary, scaling softly with mass ratio
  if (massSecondary <= 0 || radiusPrimary <= 0) return 0;
  const ratio = Math.max(1, massPrimary / Math.max(1, massSecondary));
  const massFactor = 1.35 + Math.min(0.85, Math.log10(ratio) * 0.22);
  return radiusPrimary * massFactor;
};

/**
 * Calculates the resulting angular velocity (spin) after an off-center impact.
 */
export const calculateAngularVelocity = (
  mass: number,
  radius: number,
  impactVelocityX: number,
  impactVelocityY: number,
  impactVelocityZ: number,
  contactNormalX: number,
  contactNormalY: number,
  contactNormalZ: number
): { wx: number; wy: number; wz: number } => {
  // Tangential velocity component (perpendicular to normal)
  const dot = impactVelocityX * contactNormalX + impactVelocityY * contactNormalY + impactVelocityZ * contactNormalZ;
  const tanX = impactVelocityX - dot * contactNormalX;
  const tanY = impactVelocityY - dot * contactNormalY;
  const tanZ = impactVelocityZ - dot * contactNormalZ;

  // Moment of inertia for a solid sphere: I = 2/5 * m * r^2
  const inertia = (2 / 5) * mass * radius * radius;
  if (inertia === 0) return { wx: 0, wy: 0, wz: 0 };

  // Torque approximation from tangential impulse (r x F)
  // Angular velocity omega = L / I
  // Where L = r x (m * v_tan)
  // Cross product (r * N) x (m * v_tan)
  const rx = contactNormalX * radius;
  const ry = contactNormalY * radius;
  const rz = contactNormalZ * radius;
  
  const mx = mass * tanX;
  const my = mass * tanY;
  const mz = mass * tanZ;

  const lx = ry * mz - rz * my;
  const ly = rz * mx - rx * mz;
  const lz = rx * my - ry * mx;

  return {
    wx: lx / inertia,
    wy: ly / inertia,
    wz: lz / inertia
  };
};


