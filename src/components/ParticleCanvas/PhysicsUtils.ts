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

export interface CollisionResult {
  kineticEnergyDissipated: number;
  contactPointX: number;
  contactPointY: number;
  contactPointZ: number;
}

// Enforces Conservation of Momentum & Energy during rigid inelastic mesh collisions
export const resolveCelestialCollision = (
  e1: CelestialEntity,
  e2: CelestialEntity,
  restitution: number = 0.45
): CollisionResult | null => {
  const dx = e2.x - e1.x;
  const dy = e2.y - e1.y;
  const dz = (e2.z || 0) - (e1.z || 0);
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const colDist = e1.radius + e2.radius;

  if (dist >= colDist || dist === 0) return null;

  // Normalize contact axis
  const nx = dx / dist;
  const ny = dy / dist;
  const nz = dz / dist;

  // Approximate relative masses via radius cubics (representing astrophysical volume/mass density)
  const m1 = e1.mass || e1.radius * e1.radius * 2;
  const m2 = e2.mass || e2.radius * e2.radius * 2;

  // Retrieve velocities
  const v1x = e1.vx || 0;
  const v1y = e1.vy || 0;
  const v1z = e1.vz || 0;
  const v2x = e2.vx || 0;
  const v2y = e2.vy || 0;
  const v2z = e2.vz || 0;

  const rvx = v2x - v1x;
  const rvy = v2y - v1y;
  const rvz = v2z - v1z;

  const vn = rvx * nx + rvy * ny + rvz * nz;

  // If already moving away, do not resolve collision
  if (vn >= 0) return null;

  // Calculate kinetic energy before collision: E_k = 0.5 * m * v^2
  const keBefore = 0.5 * m1 * (v1x * v1x + v1y * v1y + v1z * v1z) +
                   0.5 * m2 * (v2x * v2x + v2y * v2y + v2z * v2z);

  // Coefficient of restitution collision impulse scalar
  const impulse = -(1 + restitution) * vn / (1 / m1 + 1 / m2);

  // Apply impulse vector to conserve momentum
  e1.vx = v1x - (impulse / m1) * nx;
  e1.vy = v1y - (impulse / m1) * ny;
  e1.vz = v1z - (impulse / m1) * nz;

  e2.vx = v2x + (impulse / m2) * nx;
  e2.vy = v2y + (impulse / m2) * ny;
  e2.vz = v2z + (impulse / m2) * nz;

  // Apply tangential rolling friction to convert slide component to orbital rolling traction
  const tangentX = rvx - vn * nx;
  const tangentY = rvy - vn * ny;
  const tangentZ = rvz - vn * nz;
  const friction = 0.25; // friction coefficient

  e1.vx += friction * tangentX * (m2 / (m1 + m2));
  e1.vy += friction * tangentY * (m2 / (m1 + m2));
  e1.vz = (e1.vz || 0) + friction * tangentZ * (m2 / (m1 + m2));

  e2.vx -= friction * tangentX * (m1 / (m1 + m2));
  e2.vy -= friction * tangentY * (m1 / (m1 + m2));
  e2.vz = (e2.vz || 0) - friction * tangentZ * (m1 / (m1 + m2));

  // Correct position overlaps to completely eliminate visual sticking/snapping
  const overlap = colDist - dist;
  const correctionScale = (overlap / (1 / m1 + 1 / m2)) * 0.55;
  e1.x -= (correctionScale / m1) * nx;
  e1.y -= (correctionScale / m1) * ny;
  e1.z = (e1.z || 0) - (correctionScale / m1) * nz;

  e2.x += (correctionScale / m2) * nx;
  e2.y += (correctionScale / m2) * ny;
  e2.z = (e2.z || 0) + (correctionScale / m2) * nz;

  // Calculate kinetic energy after collision
  const keAfter = 0.5 * m1 * ((e1.vx || 0) * (e1.vx || 0) + (e1.vy || 0) * (e1.vy || 0) + (e1.vz || 0) * (e1.vz || 0)) +
                  0.5 * m2 * ((e2.vx || 0) * (e2.vx || 0) + (e2.vy || 0) * (e2.vy || 0) + (e2.vz || 0) * (e2.vz || 0));

  // Heat and ejecta energy dissipation
  const kineticEnergyDissipated = Math.max(0, keBefore - keAfter);

  return {
    kineticEnergyDissipated,
    contactPointX: e1.x + nx * e1.radius,
    contactPointY: e1.y + ny * e1.radius,
    contactPointZ: (e1.z || 0) + nz * e1.radius,
  };
};

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
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.0 + Math.random() * 8.5;
    const vx = Math.cos(angle) * speed * 0.5;
    const vy = Math.sin(angle) * speed * 0.5;
    spawnP(x, y, (Math.random() - 0.5) * 40, vx, vy, color);
  }
};

export const createShatterDebris = (
  x: number,
  y: number,
  color: string,
  count: number,
  spawnP: SpawnParticleFn
) => {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * 2.0;
    const vx = Math.cos(angle) * speed * 0.5;
    const vy = Math.sin(angle) * speed * 0.5;
    spawnP(x, y, (Math.random() - 0.5) * 120, vx, vy, color);
  }
};

export const createSpaghettificationDebris = (
  bh: CelestialEntity,
  victim: CelestialEntity,
  spawnP: SpawnParticleFn
) => {
  const count = Math.min(2000, Math.floor(victim.radius * 20));
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * victim.radius;
    const px = victim.x + Math.cos(angle) * r;
    const py = victim.y + Math.sin(angle) * r;

    const dx = px - bh.x;
    const dy = py - bh.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const orbitAngle = Math.atan2(dy, dx) + Math.PI / 2;
    const speed = 10.0 + Math.random() * 15.0;
    const vx = Math.cos(orbitAngle) * speed + (bh.x - px) * 0.05;
    const vy = Math.sin(orbitAngle) * speed + (bh.y - py) * 0.05;

    spawnP(
      px,
      py,
      (Math.random() - 0.5) * victim.radius * 2,
      vx,
      vy,
      Math.random() > 0.5 ? victim.color : (victim.ringColor || "#ffffff"),
      0.002 + Math.random() * 0.008
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

export const getSpacetimeFabricDistortion = (
  wx: number, 
  wy: number, 
  ww: number, 
  wh: number, 
  celestialEntities: CelestialEntity[],
  activeRipples: { x: number; y: number; life: number; maxDist: number; bandWidth: number; minDistSq: number; maxDistBoundSq: number }[],
  time: number,
  disturbance: number
): number => {
  let gravityZ = 0;
  
  celestialEntities.forEach((entity) => {
    if (entity.isDestroyed) return;
    const ex = entity.x - ww / 2;
    const ey = -(entity.y - wh / 2);
    
    const dx = ex - wx;
    const dy = ey - wy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    
    const range = entity.radius * (entity.type === "blackhole" ? 3.5 : 1.8);
    if (dist < range) {
      const intensity = (range - dist) / range;
      const pullDepth = entity.type === "blackhole" ? 180 : 45;
      gravityZ += Math.pow(intensity, 1.8) * pullDepth * (0.2 + disturbance * 0.8);
    }
  });

  activeRipples.forEach((ripple) => {
    const rx = ripple.x - ww / 2;
    const ry = -(ripple.y - wh / 2);
    const dx = rx - wx;
    const dy = ry - wy;
    const distSq = dx * dx + dy * dy;
    
    if (distSq > ripple.minDistSq && distSq < ripple.maxDistBoundSq) {
      const dist = Math.sqrt(distSq);
      const rForce = (1.0 - Math.abs(dist - ripple.maxDist) / ripple.bandWidth) * ripple.life;
      gravityZ += rForce * 25; 
    }
  });

  if (disturbance > 0.01) {
    const pulseWave = Math.sin((wx + wy) * 0.012 - time * 0.06) * 6 * Math.min(1.0, disturbance);
    gravityZ += pulseWave;
  }
  
  return gravityZ;
};

export const hexToRgba = (hex: string, alpha: number): string => {
  if (!hex || !hex.startsWith('#')) return 'rgba(255, 255, 255, ' + alpha + ')';
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) || 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 255;
  return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
};
