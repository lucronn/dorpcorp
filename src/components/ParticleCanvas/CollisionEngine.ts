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
 * Resolves elastic/inelastic 3D physics collisions between two celestial bodies.
 * Enforces Conservation of Momentum & Energy and resolves positional overlaps.
 */
export function resolveCelestialCollision(
  e1: CelestialEntity,
  e2: CelestialEntity,
  restitution: number = 0.75
): CollisionResult | null {
  if (!e1 || !e2) return null;
  const dx = e2.x - e1.x;
  const dy = e2.y - e1.y;
  const dz = (e2.z || 0) - (e1.z || 0);
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const colDist = e1.radius + e2.radius;

  if (
    isNaN(dist) ||
    !isFinite(dist) ||
    dist >= colDist ||
    dist <= 0.0001 ||
    !isFinite(e1.radius) ||
    !isFinite(e2.radius) ||
    e1.radius <= 0 ||
    e2.radius <= 0
  ) {
    return null;
  }

  // Unshackle both entities into full active 3D physics body simulation
  e1.isPhysicsEnabled = true;
  e2.isPhysicsEnabled = true;

  // Normalize contact axis
  const nx = dx / dist;
  const ny = dy / dist;
  const nz = dz / dist;

  // Approximate relative masses via radius cubics
  const m1 = (e1.mass && isFinite(e1.mass) && e1.mass > 0) ? e1.mass : (e1.radius > 0 ? e1.radius * e1.radius * 2 : 100);
  const m2 = (e2.mass && isFinite(e2.mass) && e2.mass > 0) ? e2.mass : (e2.radius > 0 ? e2.radius * e2.radius * 2 : 100);

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

  // Impulse scalar with sanitized restitution
  const safeRestitution = isFinite(restitution) && restitution >= 0 ? Math.min(1.0, restitution) : 0.75;
  const impulse = (-(1 + safeRestitution) * vn) / (1 / m1 + 1 / m2);

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
  if (!bh || !victim) return;
  victim.isSwallowing = true;
  victim.destroyedBy = "blackhole";
  const bhMass = (bh.mass && isFinite(bh.mass) && bh.mass > 0) ? bh.mass : 100;
  const victimMass = (victim.mass && isFinite(victim.mass) && victim.mass > 0) ? victim.mass : 50;
  const newMass = bhMass + victimMass;
  bh.mass = newMass;

  // Black hole target radius swells from ingested mass
  const baseRad = (bh.radius && isFinite(bh.radius) && bh.radius > 0) ? bh.radius : 50;
  const targetRadius = Math.min(baseRad * 1.5, Math.sqrt(newMass / 15));
  bh.targetRadius = targetRadius;
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
  if (typeof spawnP !== "function") return;
  const safeCount = isFinite(count) && count > 0 ? Math.min(30, Math.floor(count)) : 0;
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
  if (typeof spawnP !== "function") return;
  const safeCount = isFinite(count) && count > 0 ? Math.min(40, Math.floor(count)) : 0;
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
  if (!bh || !victim || typeof spawnP !== "function") return;
  const safeRad = isFinite(victim.radius) && victim.radius > 0 ? victim.radius : 20;
  const count = Math.min(80, Math.floor(safeRad * 2));
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * safeRad;
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
      (Math.random() - 0.5) * safeRad,
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
  if (!scene || scene.isDisposed) return;
  if (!Array.isArray(flaresList)) return;

  // Bound active flares to prevent unbounded WebGL sphere allocation during intense collisions
  const MAX_ACTIVE_FLARES = 50;
  while (flaresList.length >= MAX_ACTIVE_FLARES) {
    const oldest = flaresList.shift();
    if (oldest?.mesh && !oldest.mesh.isDisposed()) {
      if (oldest.mesh.material) {
        oldest.mesh.material.dispose(false, true);
      }
      oldest.mesh.dispose();
    }
  }

  const safeRadius = isFinite(radius) && radius > 0 ? radius : 10;
  const safeX = isFinite(x) ? x : 0;
  const safeY = isFinite(y) ? y : 0;
  const safeZ = isFinite(z) ? z : 0;

  const flareMesh = BABYLON.MeshBuilder.CreateSphere(
    "colFlare",
    { segments: 32, diameter: safeRadius * 2 },
    scene
  );
  flareMesh.position.set(safeX, safeY, safeZ);

  const mat = new BABYLON.StandardMaterial("flareMat", scene);
  let safeHex = (typeof colorHex === "string" && colorHex.startsWith("#")) ? colorHex.trim() : "#ffaa44";
  if (safeHex.length === 4 || safeHex.length === 5) {
    safeHex = `#${safeHex[1]}${safeHex[1]}${safeHex[2]}${safeHex[2]}${safeHex[3]}${safeHex[3]}`;
  } else if (safeHex.length > 7) {
    safeHex = safeHex.slice(0, 7);
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(safeHex)) {
    safeHex = "#ffaa44";
  }
  mat.emissiveColor = BABYLON.Color3.FromHexString(safeHex);
  mat.disableLighting = true;
  mat.alpha = 0.95;
  mat.alphaMode = BABYLON.Engine.ALPHA_ADD;
  flareMesh.material = mat;

  flaresList.push({
    mesh: flareMesh,
    life: 1.0,
    maxLife: 1.0,
    initialRadius: safeRadius,
  });
}

/**
 * Updates active collision flares, animating decay and cleanly disposing meshes and materials upon expiration.
 */
export function updateCollisionFlares(
  flaresList: Array<{ mesh: BABYLON.Mesh; life: number; maxLife: number; initialRadius: number }>,
  dt: number = 0.016
): Array<{ mesh: BABYLON.Mesh; life: number; maxLife: number; initialRadius: number }> {
  if (!Array.isArray(flaresList)) return [];
  const safeDt = isFinite(dt) && dt >= 0 ? dt : 0.016;
  const activeFlares: typeof flaresList = [];
  for (let i = 0; i < flaresList.length; i++) {
    const flare = flaresList[i]!;
    if (!flare) continue;
    flare.life -= safeDt * 1.5;
    if (!isFinite(flare.life) || flare.life <= 0) {
      if (flare.mesh && !flare.mesh.isDisposed()) {
        if (flare.mesh.material) {
          flare.mesh.material.dispose(false, true);
        }
        flare.mesh.dispose();
      }
    } else {
      if (flare.mesh && !flare.mesh.isDisposed()) {
        const progress = Math.max(0, flare.life / flare.maxLife);
        const currentScale = 1.0 + (1.0 - progress) * 0.8;
        flare.mesh.scaling.setAll(currentScale);
        if (flare.mesh.material && "alpha" in flare.mesh.material) {
          (flare.mesh.material as any).alpha = 0.95 * progress;
        }
      }
      activeFlares.push(flare);
    }
  }
  return activeFlares;
}

/**
 * Cleanly disposes all collision flare meshes and their allocated WebGL materials.
 */
export function disposeCollisionFlares(
  flaresList: Array<{ mesh: BABYLON.Mesh; life: number; maxLife: number; initialRadius: number }>
): void {
  if (!Array.isArray(flaresList)) return;
  for (let i = 0; i < flaresList.length; i++) {
    const flare = flaresList[i];
    if (flare?.mesh && !flare.mesh.isDisposed()) {
      if (flare.mesh.material) {
        flare.mesh.material.dispose(false, true);
      }
      flare.mesh.dispose();
    }
  }
  flaresList.length = 0;
}
