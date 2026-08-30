import * as BABYLON from "@babylonjs/core";
import { CelestialEntity, Particle } from "./types";
import { audio } from "../../utils/audio";
import { calculateAngularVelocity } from "./PhysicsUtils";

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
 * Resolves elastic/inelastic 3D physics collisions between two celestial bodies.
 * Enforces Conservation of Momentum & Energy and resolves positional overlaps.
 */
export function resolveCelestialCollision(
  e1: CelestialEntity,
  e2: CelestialEntity,
  restitution: number = 0.75
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

  // Approximate relative masses via radius cubics (spherical volume)
  const m1 = e1.mass || Math.pow(e1.radius, 3);
  const m2 = e2.mass || Math.pow(e2.radius, 3);

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

  // Calculate and apply resulting angular velocities (spin)
  
  // Calculate spin for e1
  const spin1 = calculateAngularVelocity(m1, e1.radius, v2x - v1x, v2y - v1y, v2z - v1z, nx, ny, nz);
  e1.wx = (e1.wx || 0) + spin1.wx;
  e1.wy = (e1.wy || 0) + spin1.wy;
  e1.wz = (e1.wz || 0) + spin1.wz;

  // Calculate spin for e2
  const spin2 = calculateAngularVelocity(m2, e2.radius, v1x - v2x, v1y - v2y, v1z - v2z, -nx, -ny, -nz);
  e2.wx = (e2.wx || 0) + spin2.wx;
  e2.wy = (e2.wy || 0) + spin2.wy;
  e2.wz = (e2.wz || 0) + spin2.wz;

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

  return {
    kineticEnergyDissipated,
    contactPointX: e1.x + nx * e1.radius,
    contactPointY: e1.y + ny * e1.radius,
    contactPointZ: (e1.z || 0) + nz * e1.radius,
  };
}

/**
 * Accretion and swallowing of a victim entity by a black hole.
 */
export function swallowEntity(bh: CelestialEntity, victim: CelestialEntity): void {
  victim.isSwallowing = true;
  victim.destroyedBy = "blackhole";
  const newMass = (bh.mass || 100) + (victim.mass || 50);
  bh.mass = newMass;

  // Black hole target radius swells from ingested mass
  const targetRadius = Math.min(bh.radius * 1.5, Math.sqrt(newMass / 15));
  bh.targetRadius = targetRadius;
}

/**
 * Merges two colliding celestial entities into one by conserving mass and momentum.
 * e2 is absorbed by e1.
 */
export function mergeEntities(e1: CelestialEntity, e2: CelestialEntity): { contactPointX: number; contactPointY: number; contactPointZ: number } {
  e2.isSwallowing = true;
  e2.destroyedBy = "collision";
  
  const m1 = e1.mass || Math.pow(e1.radius, 3);
  const m2 = e2.mass || Math.pow(e2.radius, 3);
  const newMass = m1 + m2;
  e1.mass = newMass;

  const contactPointX = (e1.x + e2.x) / 2;
  const contactPointY = (e1.y + e2.y) / 2;
  const contactPointZ = ((e1.z || 0) + (e2.z || 0)) / 2;

  // Conservation of momentum
  const v1x = e1.vx || 0;
  const v1y = e1.vy || 0;
  const v2x = e2.vx || 0;
  const v2y = e2.vy || 0;
  e1.vx = (m1 * v1x + m2 * v2x) / newMass;
  e1.vy = (m1 * v1y + m2 * v2y) / newMass;
  
  // Combine volumes to get the new target radius
  const volume1 = Math.pow(e1.radius, 3);
  const volume2 = Math.pow(e2.radius, 3);
  e1.targetRadius = Math.cbrt(volume1 + volume2);

  return { contactPointX, contactPointY, contactPointZ };
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
  mat.emissiveColor = BABYLON.Color3.FromHexString(colorHex.startsWith("#") ? colorHex : "#ffaa44");
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
