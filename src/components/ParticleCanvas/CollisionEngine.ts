import * as BABYLON from "@babylonjs/core";
import { CelestialEntity, Particle } from "./types";
import { audio } from "../../utils/audio";

export interface CollisionResult {
  kineticEnergyDissipated: number;
  contactPointX: number;
  contactPointY: number;
  contactPointZ: number;
}

export type SpawnParticleFn = (
  x: number,
  y: number,
  z: number,
  vx: number,
  vy: number,
  color: string,
  decayRate?: number
) => void;

/**
 * Resolves deeply inelastic 3D hydrodynamic giant-impact collisions between two celestial bodies.
 * Planetary and stellar collisions at $v_{\text{imp}} \ge v_{\text{esc}}$ dissipate ~80%+ of normal kinetic energy
 * into shock heating, mantle vaporization, and ejecta debris ($e_{\text{rest}} \approx 0.18$) rather than
 * elastic billiard-ball bouncing, with 3D volumetric mass scaling ($M = \frac{4}{3}\pi\rho R^3 \propto R^3$).
 */
export function resolveCelestialCollision(
  e1: CelestialEntity,
  e2: CelestialEntity,
  restitution: number = 0.18
): CollisionResult | null {
  const dx = e2.x - e1.x;
  const dy = e2.y - e1.y;
  const dz = (e2.z || 0) - (e1.z || 0);
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const colDist = e1.radius + e2.radius;

  if (dist >= colDist || dist === 0) return null;

  // Unshackle both entities into full active 3D physics body simulation
  e1.isPhysicsEnabled = true;
  e2.isPhysicsEnabled = true;

  // Normalize contact axis
  const nx = dx / dist;
  const ny = dy / dist;
  const nz = dz / dist;

  // 3D volumetric mass scaling: M = (4/3) * pi * rho * R^3
  const m1 = e1.mass || Math.max(10, Math.pow(e1.radius, 3) * 0.04);
  const m2 = e2.mass || Math.max(10, Math.pow(e2.radius, 3) * 0.04);

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

  // Resolve position overlaps to eliminate visual sticking
  const overlap = colDist - dist;
  const correctionScale = (overlap / (1 / m1 + 1 / m2)) * 0.7;
  e1.x -= (correctionScale / m1) * nx;
  e1.y -= (correctionScale / m1) * ny;
  e1.z = (e1.z || 0) - (correctionScale / m1) * nz;

  e2.x += (correctionScale / m2) * nx;
  e2.y += (correctionScale / m2) * ny;
  e2.z = (e2.z || 0) + (correctionScale / m2) * nz;

  // If already moving away along contact normal, position separation is sufficient
  if (vn >= 0) {
    return {
      kineticEnergyDissipated: 0,
      contactPointX: e1.x + nx * e1.radius,
      contactPointY: e1.y + ny * e1.radius,
      contactPointZ: (e1.z || 0) + nz * e1.radius,
    };
  }

  // Calculate kinetic energy before collision
  const keBefore =
    0.5 * m1 * (v1x * v1x + v1y * v1y + v1z * v1z) +
    0.5 * m2 * (v2x * v2x + v2y * v2y + v2z * v2z);

  // Impulse scalar
  const impulse = (-(1 + restitution) * vn) / (1 / m1 + 1 / m2);

  // Apply impulse vector
  e1.vx = v1x - (impulse / m1) * nx;
  e1.vy = v1y - (impulse / m1) * ny;
  e1.vz = v1z - (impulse / m1) * nz;

  e2.vx = v2x + (impulse / m2) * nx;
  e2.vy = v2y + (impulse / m2) * ny;
  e2.vz = v2z + (impulse / m2) * nz;

  // Apply tangential friction
  const tangentX = rvx - vn * nx;
  const tangentY = rvy - vn * ny;
  const tangentZ = rvz - vn * nz;
  const friction = 0.18;

  e1.vx += friction * tangentX * (m2 / (m1 + m2));
  e1.vy += friction * tangentY * (m2 / (m1 + m2));
  e1.vz = (e1.vz || 0) + friction * tangentZ * (m2 / (m1 + m2));

  e2.vx -= friction * tangentX * (m1 / (m1 + m2));
  e2.vy -= friction * tangentY * (m1 / (m1 + m2));
  e2.vz = (e2.vz || 0) - friction * tangentZ * (m1 / (m1 + m2));

  // Calculate kinetic energy after collision
  const keAfter =
    0.5 *
      m1 *
      ((e1.vx || 0) * (e1.vx || 0) +
        (e1.vy || 0) * (e1.vy || 0) +
        (e1.vz || 0) * (e1.vz || 0)) +
    0.5 *
      m2 *
      ((e2.vx || 0) * (e2.vx || 0) +
        (e2.vy || 0) * (e2.vy || 0) +
        (e2.vz || 0) * (e2.vz || 0));

  const kineticEnergyDissipated = Math.max(0, keBefore - keAfter);

  // Play deep lightning strike collision sound
  try {
    if (audio && typeof audio.playDeepLightningStrikeCollision === "function") {
      const relVelocity = Math.abs(vn);
      const intensity = Math.min(2.0, 0.65 + relVelocity * 0.15 + (kineticEnergyDissipated > 40 ? 0.4 : 0));
      audio.playDeepLightningStrikeCollision(intensity, nx * 0.5);
    }
  } catch (_) {}

  return {
    kineticEnergyDissipated,
    contactPointX: e1.x + nx * e1.radius,
    contactPointY: e1.y + ny * e1.radius,
    contactPointZ: (e1.z || 0) + nz * e1.radius,
  };
}

/**
 * Relativistic horizon capture of a victim entity by a black hole.
 * Enforces linear Schwarzschild radius growth ($r_s = \frac{2GM}{c^2} \propto M$)
 * and Hawking's Area Theorem ($\Delta A = \frac{16\pi G^2}{c^4}\Delta(M^2) \ge 0$),
 * accounting for radiative and gravitational-wave efficiency ($\eta_{\text{rad}} \approx 0.08$).
 */
export function swallowEntity(bh: CelestialEntity, victim: CelestialEntity): void {
  victim.isSwallowing = true;
  victim.destroyedBy = "blackhole";
  const oldMass = Math.max(100, bh.mass || Math.pow(bh.radius, 3) * 0.08);
  const victimMass = victim.mass || Math.max(25, Math.pow(victim.radius, 3) * 0.03);
  const radiativeEfficiency = 0.08; // ~8% radiated via ISCO accretion & ringdown GWs
  const newMass = oldMass + victimMass * (1.0 - radiativeEfficiency);
  bh.mass = newMass;

  // Linear Schwarzschild scaling: r_s = 2GM/c^2 \propto M (damped within visual viewport bounds)
  const linearMassRatio = newMass / oldMass;
  const targetRadius = Math.min(bh.radius * 1.65, bh.radius * Math.min(1.32, linearMassRatio));
  bh.targetRadius = targetRadius;

  // Deep thunder roll of event horizon mass-energy absorption
  try {
    if (audio && typeof audio.playDeepThunderRoll === "function") {
      audio.playDeepThunderRoll(3.2, 1.35, 0.0);
    }
  } catch (_) {}
}

/**
 * Generates dust splash particle spray upon impact.
 */
export function createDustSplash(
  x: number,
  y: number,
  color: string,
  count: number,
  spawnP: SpawnParticleFn
): void {
  const safeCount = Math.min(30, count);
  for (let i = 0; i < safeCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.1 + Math.random() * 0.3;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    spawnP(x, y, (Math.random() - 0.5) * 10, vx, vy, color, 0.02);
  }
}

/**
 * Generates shatter debris particles when celestial objects collide violently.
 */
export function createShatterDebris(
  x: number,
  y: number,
  color: string,
  count: number,
  spawnP: SpawnParticleFn
): void {
  const safeCount = Math.min(40, count);
  for (let i = 0; i < safeCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.15 + Math.random() * 0.35;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    spawnP(x, y, (Math.random() - 0.5) * 20, vx, vy, color, 0.025);
  }
}

/**
 * Spaghettification debris trail drawn towards black hole center.
 */
export function createSpaghettificationDebris(
  bh: CelestialEntity,
  victim: CelestialEntity,
  spawnP: SpawnParticleFn
): void {
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
}

/**
 * Spawns a glowing collision flare spark mesh in the 3D scene.
 */
export function spawnCollisionFlare(
  scene: BABYLON.Scene,
  x: number,
  y: number,
  z: number,
  radius: number,
  colorHex: string,
  flaresList: Array<{ mesh: BABYLON.Mesh; life: number; maxLife: number; initialRadius: number }>
): void {
  const flareMesh = BABYLON.MeshBuilder.CreateSphere(
    "colFlare",
    { segments: 32, diameter: radius * 2 },
    scene
  );
  flareMesh.position.set(x, y, z);

  const mat = new BABYLON.StandardMaterial("flareMat", scene);
  const safeHex = (typeof colorHex === "string" && colorHex.startsWith("#")) ? colorHex : "#ffaa44";
  mat.emissiveColor = BABYLON.Color3.FromHexString(safeHex);
  mat.disableLighting = true;
  mat.alpha = 0.95;
  mat.alphaMode = BABYLON.Engine.ALPHA_ADD;
  flareMesh.material = mat;

  flaresList.push({
    mesh: flareMesh,
    life: 1.0,
    maxLife: 1.0,
    initialRadius: radius,
  });
}
