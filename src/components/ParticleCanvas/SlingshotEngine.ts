import { CelestialEntity } from "./types";
import { audio } from "../../utils/audio";

export interface SlingshotProbe {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: string;
  trail: { x: number; y: number; z: number; alpha: number }[];
  life: number;
  maxLife: number;
  isSwallowed: boolean;
  maxSpeedReached: number;
  lastWhipTime: number;
}

export interface SlingshotTrajectoryPoint {
  x: number;
  y: number;
  z: number;
  isHorizonBound: boolean;
  speed: number;
}

export interface SlingshotAimState {
  isAiming: boolean;
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
  trajectoryPoints: SlingshotTrajectoryPoint[];
}

/**
 * Computes forward Keplerian / General Relativistic trajectory prediction
 */
export function calculateForwardTrajectory(
  originX: number,
  originY: number,
  pullX: number,
  pullY: number,
  celestialEntities: CelestialEntity[],
  steps: number = 75,
  initialVz: number = 0.0
): SlingshotTrajectoryPoint[] {
  if (!isFinite(originX) || !isFinite(originY) || !isFinite(pullX) || !isFinite(pullY)) {
    return [];
  }

  const points: SlingshotTrajectoryPoint[] = [];
  
  // Launch velocity vector is opposite to pull vector
  const launchSpeedMultiplier = 0.095;
  let vx = (originX - pullX) * launchSpeedMultiplier;
  let vy = (originY - pullY) * launchSpeedMultiplier;
  let vz = initialVz;

  // Cap maximum launch speed
  const maxLaunchSpeed = 38.0;
  const launchMag = Math.hypot(vx, vy);
  if (launchMag > maxLaunchSpeed) {
    vx = (vx / launchMag) * maxLaunchSpeed;
    vy = (vy / launchMag) * maxLaunchSpeed;
  }

  let px = originX;
  let py = originY;
  let pz = 0;
  const dt = 0.65;
  let isHorizonBound = false;

  points.push({ x: px, y: py, z: pz, isHorizonBound: false, speed: launchMag });

  for (let s = 0; s < steps; s++) {
    if (isHorizonBound) break;

    let ax = 0;
    let ay = 0;
    let az = 0;

    for (let i = 0; i < celestialEntities.length; i++) {
      const entity = celestialEntities[i];
      if (
        !entity ||
        entity.isDestroyed ||
        !isFinite(entity.x) ||
        !isFinite(entity.y) ||
        (entity.scale !== undefined && entity.scale <= 0.01) ||
        entity.radius <= 0
      ) continue;

      const scale = entity.scale !== undefined && entity.scale > 0 ? entity.scale : 1.0;
      const effectiveRadius = entity.radius * scale;

      const dx = entity.x - px;
      const dy = entity.y - py;
      const dz = (entity.z || 0) - pz;
      const distSq = dx * dx + dy * dy + dz * dz;
      const dist = Math.sqrt(distSq) || 1;

      if (entity.type === "blackhole") {
        const rs = effectiveRadius;
        // Event Horizon capture detection
        if (dist <= rs * 1.15) {
          isHorizonBound = true;
          points.push({ x: entity.x, y: entity.y, z: pz, isHorizonBound: true, speed: 0 });
          break;
        }

        // Paczyński-Wiita General Relativistic Pseudo-Potential
        // Accurately reproduces ISCO (Innermost Stable Circular Orbit) and event horizon plunge
        const effDist = Math.max(rs * 0.15, dist - rs);
        const gForce = ((entity.mass || entity.radius * 6500) * scale) / (dist * effDist * effDist);
        ax += (dx / dist) * gForce;
        ay += (dy / dist) * gForce;
        az += (dz / dist) * gForce * 0.4;
      } else {
        const softDist = Math.max(effectiveRadius * 0.8, dist);
        const gForce = ((entity.mass || entity.radius * 120) * scale) / (softDist * softDist);
        ax += (dx / dist) * gForce;
        ay += (dy / dist) * gForce;
        az += (dz / dist) * gForce * 0.3;
      }
    }

    vx += ax * dt;
    vy += ay * dt;
    vz += az * dt;

    // Relativistic velocity ceiling (sub-lightspeed cap)
    const currentSpeed = Math.hypot(vx, vy, vz);
    const speedOfLightSim = 55.0;
    if (currentSpeed > speedOfLightSim) {
      const factor = speedOfLightSim / currentSpeed;
      vx *= factor;
      vy *= factor;
      vz *= factor;
    }

    px += vx * dt;
    py += vy * dt;
    pz += vz * dt;

    points.push({
      x: px,
      y: py,
      z: pz,
      isHorizonBound,
      speed: currentSpeed,
    });
  }

  return points;
}

/**
 * Updates all active probes with N-body celestial gravitation, slingshot boosts, and trail particle updates.
 */
export function updateActiveProbes(
  probes: SlingshotProbe[],
  celestialEntities: CelestialEntity[],
  ripplesRef: { current: { x: number; y: number; life: number }[] },
  spawnTailParticleRef?: { current?: (...args: any[]) => void }
): SlingshotProbe[] {
  const dt = 0.85;
  const now = Date.now();
  const nextProbes: SlingshotProbe[] = [];

  for (let pIdx = 0; pIdx < probes.length; pIdx++) {
    const probe = probes[pIdx];
    if (probe.isSwallowed || probe.life <= 0) continue;

    probe.life -= 0.0035;

    let ax = 0;
    let ay = 0;
    let az = 0;
    let closestDistToBh = 999999;
    let nearestBhRadius = 60;

    for (let i = 0; i < celestialEntities.length; i++) {
      const entity = celestialEntities[i];
      if (
        !entity ||
        entity.isDestroyed ||
        !isFinite(entity.x) ||
        !isFinite(entity.y) ||
        (entity.scale !== undefined && entity.scale <= 0.01) ||
        entity.radius <= 0
      ) continue;

      const scale = entity.scale !== undefined && entity.scale > 0 ? entity.scale : 1.0;
      const effectiveRadius = entity.radius * scale;

      const dx = entity.x - probe.x;
      const dy = entity.y - probe.y;
      const dz = (entity.z || 0) - probe.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      const dist = Math.sqrt(distSq) || 1;

      if (entity.type === "blackhole") {
        if (dist < closestDistToBh) {
          closestDistToBh = dist;
          nearestBhRadius = effectiveRadius;
        }

        // Event Horizon Relativistic Absorption
        if (dist <= effectiveRadius * 1.08) {
          probe.isSwallowed = true;
          audio.playProbeSwallowed();
          ripplesRef.current.push({ x: entity.x, y: entity.y, life: 1.0 });
          break;
        }

        const rs = effectiveRadius;
        const effDist = Math.max(rs * 0.15, dist - rs);
        const gForce = ((entity.mass || entity.radius * 6500) * scale) / (dist * effDist * effDist);
        ax += (dx / dist) * gForce;
        ay += (dy / dist) * gForce;
        az += (dz / dist) * gForce * 0.4;
      } else {
        const softDist = Math.max(effectiveRadius * 0.8, dist);
        const gForce = ((entity.mass || entity.radius * 120) * scale) / (softDist * softDist);
        ax += (dx / dist) * gForce;
        ay += (dy / dist) * gForce;
        az += (dz / dist) * gForce * 0.3;
      }
    }

    if (probe.isSwallowed) continue;

    probe.vx += ax * dt;
    probe.vy += ay * dt;
    probe.vz += az * dt;

    const currentSpeed = Math.hypot(probe.vx, probe.vy, probe.vz);

    // Detect Slingshot Velocity Whip through periapsis
    if (
      closestDistToBh < nearestBhRadius * 3.5 &&
      currentSpeed > probe.maxSpeedReached * 1.35 &&
      now - probe.lastWhipTime > 1200
    ) {
      probe.lastWhipTime = now;
      probe.maxSpeedReached = currentSpeed;
      audio.playProbeSlingshot(currentSpeed / 20.0);
      ripplesRef.current.push({ x: probe.x, y: probe.y, life: 0.7 });
    }

    if (currentSpeed > probe.maxSpeedReached) {
      probe.maxSpeedReached = currentSpeed;
    }

    // Velocity clamp to relativistic threshold
    const maxRelSpeed = 65.0;
    if (currentSpeed > maxRelSpeed) {
      const factor = maxRelSpeed / currentSpeed;
      probe.vx *= factor;
      probe.vy *= factor;
      probe.vz *= factor;
    }

    probe.x += probe.vx * dt;
    probe.y += probe.vy * dt;
    probe.z += probe.vz * dt;

    // Trail recording
    probe.trail.unshift({ x: probe.x, y: probe.y, z: probe.z, alpha: 1.0 });
    if (probe.trail.length > 28) {
      probe.trail.pop();
    }
    for (let t = 0; t < probe.trail.length; t++) {
      probe.trail[t].alpha *= 0.92;
    }

    // Spawn glittering tail ions
    if (spawnTailParticleRef?.current && Math.random() < 0.6) {
      spawnTailParticleRef.current(
        probe.x + (Math.random() - 0.5) * 4,
        probe.y + (Math.random() - 0.5) * 4,
        probe.z || 0,
        -probe.vx * 0.2,
        -probe.vy * 0.2,
        probe.color || "#4deeea",
        0.04
      );
    }

    nextProbes.push(probe);
  }

  return nextProbes;
}
