import type React from "react";
import { Particle, CelestialEntity } from "./types";
import {
  generateTargetsForStage,
  encodeMorton3D,
  createSeededRng,
  seededFisherYatesShuffle,
} from "./ParticleUtils";

export function parseParticleRgb(color: string | undefined): { r: number; g: number; b: number } {
  if (color && typeof color === "string") {
    if (color.startsWith("#")) {
      const hex = color.length === 4
        ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
        : color;
      if (hex.length >= 7) {
        return {
          r: parseInt(hex.slice(1, 3), 16) || 255,
          g: parseInt(hex.slice(3, 5), 16) || 255,
          b: parseInt(hex.slice(5, 7), 16) || 255,
        };
      }
    } else if (color.startsWith("rgb")) {
      const matches = color.match(/\d+/g);
      if (matches) {
        return {
          r: parseInt(matches[0] || "255", 10),
          g: parseInt(matches[1] || "255", 10),
          b: parseInt(matches[2] || "255", 10),
        };
      }
    }
  }
  return { r: 255, g: 255, b: 255 };
}

export function syncParticleColors(particlesList: Particle[]): void {
  particlesList.forEach((p) => {
    const rgb = parseParticleRgb(p.color);
    p.r = rgb.r;
    p.g = rgb.g;
    p.b = rgb.b;
    if (p.targetR === undefined) p.targetR = rgb.r;
    if (p.targetG === undefined) p.targetG = rgb.g;
    if (p.targetB === undefined) p.targetB = rgb.b;
    if (p.sourceR === undefined) p.sourceR = rgb.r;
    if (p.sourceG === undefined) p.sourceG = rgb.g;
    if (p.sourceB === undefined) p.sourceB = rgb.b;
  });
}

/**
 * Ensures deterministic per-particle attributes `seed` (vec4 in [0,1]) and
 * `phaseOffset` (float in [0,1]) are populated on every particle, and snapshots
 * the particle's current position and color as transition source state.
 */
export function snapshotParticleTransitionStart(
  particlesList: Particle[],
  focalX: number,
  focalY: number,
  focalZ: number = 0,
  maxRadius: number = 900,
  outerToInner: boolean = true
): void {
  const safeMaxR = isFinite(maxRadius) && maxRadius > 10 ? maxRadius : 900;
  for (let i = 0; i < particlesList.length; i++) {
    const p = particlesList[i];
    if (!p) continue;
    if (!p.seed) {
      const h = (salt: number) => {
        const s = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453123;
        return s - Math.floor(s);
      };
      p.seed = [h(1.1), h(2.3), h(3.7), h(5.9)];
    }
    if (p.phaseOffset === undefined) {
      p.phaseOffset = p.seed[0];
    }

    if (p.isCosmicAmbient || p.isTail) continue;

    p.sourceX = isFinite(p.x) ? p.x : focalX;
    p.sourceY = isFinite(p.y) ? p.y : focalY;
    p.sourceZ = isFinite(p.z) ? p.z : focalZ;
    p.sourceR = p.r ?? 255;
    p.sourceG = p.g ?? 255;
    p.sourceB = p.b ?? 255;

    const dx = p.sourceX - focalX;
    const dy = p.sourceY - focalY;
    const dz = p.sourceZ - focalZ;
    const dist = Math.hypot(dx, dy, dz);
    const rawNorm = Math.max(0.0, Math.min(1.0, dist / safeMaxR));
    // Outer edges peel away first when outerToInner is true (erosion from outer rim toward singularity/centroid)
    p.normDistFromOrigin = outerToInner ? 1.0 - rawNorm : rawNorm;
    p.localProgress = 0.0;
    p.easedProgress = 0.0;
  }
}

/**
 * Nearest-Neighbor / Optimal Transport Approximation with Coarse 3D Spatial Grid Bucketing
 * & Randomized Local Offset:
 * Buckets target coordinates into a coarse 3D spatial grid (GX x GY x GZ) and assigns
 * particles from nearby / dispersed buckets with a randomized local offset and Morton
 * stratification, preventing contiguous regions (such as the left half of a text block)
 * from marching in lockstep across the viewport.
 */
export function assignTargetsOptimalTransport<T extends { x: number; y: number; z?: number; color: string }>(
  particles: Particle[],
  targets: T[],
  width: number,
  height: number,
  seed: number = 101
): T[] {
  if (targets.length === 0 || particles.length === 0) return [];
  const safeW = isFinite(width) && width > 0 ? width : 1920;
  const safeH = isFinite(height) && height > 0 ? height : 1080;

  const GX = 8;
  const GY = 6;
  const GZ = 4;
  const numBuckets = GX * GY * GZ;
  const buckets: T[][] = Array.from({ length: numBuckets }, () => []);

  const bucketIndexFor = (x: number, y: number, z: number) => {
    const bx = Math.max(0, Math.min(GX - 1, Math.floor((x / safeW) * GX)));
    const by = Math.max(0, Math.min(GY - 1, Math.floor((y / safeH) * GY)));
    const bz = Math.max(0, Math.min(GZ - 1, Math.floor((((z || 0) + 400) / 800) * GZ)));
    return (bz * GY + by) * GX + bx;
  };

  // Permute targets first with seeded Fisher-Yates so every bucket's internal order is spatially dispersed
  const shuffledTargets = seededFisherYatesShuffle([...targets], seed);
  for (let i = 0; i < shuffledTargets.length; i++) {
    const t = shuffledTargets[i]!;
    const bIdx = bucketIndexFor(t.x, t.y, t.z ?? 0);
    buckets[bIdx]!.push(t);
  }

  const bucketCursors = new Int32Array(numBuckets);
  const rng = createSeededRng(seed ^ 0x27d4eb2d);
  const assigned: T[] = new Array(particles.length);

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]!;
    // Combine particle's current position with a deterministic local offset so
    // adjacent particles in a cluster draw from neighboring buckets rather than marching together
    const jitterX = ((p.seed?.[1] ?? rng()) - 0.5) * safeW * 0.35;
    const jitterY = ((p.seed?.[2] ?? rng()) - 0.5) * safeH * 0.35;
    const jitterZ = ((p.seed?.[3] ?? rng()) - 0.5) * 240;
    const prefBucket = bucketIndexFor(
      (isFinite(p.x) ? p.x : safeW * 0.5) + jitterX,
      (isFinite(p.y) ? p.y : safeH * 0.5) + jitterY,
      (isFinite(p.z) ? p.z : 0) + jitterZ
    );

    let chosen: T | undefined;
    // Search preferred bucket and nearby Morton-offset buckets
    for (let probe = 0; probe < 6; probe++) {
      const candidateBucket = (prefBucket + probe * 7 + (i % 5)) % numBuckets;
      const bList = buckets[candidateBucket]!;
      if (bList.length > 0) {
        const cursor = bucketCursors[candidateBucket]!;
        chosen = bList[cursor % bList.length];
        bucketCursors[candidateBucket] = cursor + 1;
        break;
      }
    }

    if (!chosen) {
      // Fallback to Morton-stratified global target list
      const mortonIdx = encodeMorton3D(
        ((p.seed?.[0] ?? 0.5) + (i * 0.61803398875)) % 1.0,
        ((p.seed?.[1] ?? 0.5) + (i * 0.38196601125)) % 1.0,
        (p.seed?.[2] ?? 0.5)
      );
      chosen = shuffledTargets[(mortonIdx + i) % shuffledTargets.length] || shuffledTargets[0]!;
    }

    assigned[i] = chosen;
  }

  return assigned;
}

/**
 * Partition particles so ambient stars are first, foreground morphing particles are in the middle
 * (preserving their permuted index order without grouping by color!), and tail particles are at the end.
 */
function partitionParticlesWithoutColorClustering(particlesList: Particle[]): void {
  const ambient: Particle[] = [];
  const foreground: Particle[] = [];
  const tails: Particle[] = [];
  for (let i = 0; i < particlesList.length; i++) {
    const p = particlesList[i];
    if (!p) continue;
    if (p.isTail) tails.push(p);
    else if (p.isCosmicAmbient) ambient.push(p);
    else foreground.push(p);
  }
  let writeIdx = 0;
  for (let i = 0; i < ambient.length; i++) particlesList[writeIdx++] = ambient[i]!;
  for (let i = 0; i < foreground.length; i++) particlesList[writeIdx++] = foreground[i]!;
  for (let i = 0; i < tails.length; i++) particlesList[writeIdx++] = tails[i]!;
}

export function mapParticlesToInterstellar(
  width: number,
  height: number,
  celestialEntitiesRef: React.MutableRefObject<CelestialEntity[]>,
  archetypeRef: React.MutableRefObject<string>,
  particlesRef: React.MutableRefObject<Particle[]>,
  tailStartIndexRef: React.MutableRefObject<number>
): void {
  const entities = celestialEntitiesRef.current.filter((e) => !e.isDestroyed);
  if (entities.length === 0) return;
  const bh = entities.find((e) => e.type === "blackhole");
  const planets = entities.filter((e) => e.type === "planet");
  const nebulas = entities.filter((e) => e.type === "nebula");
  const arch = archetypeRef.current || "BLACKHOLE_CENTRIC";

  const focalEntity = bh || entities[0];
  const focalX = focalEntity ? focalEntity.x : width / 2;
  const focalY = focalEntity ? focalEntity.y : height / 2;
  const focalZ = focalEntity ? (focalEntity.z || 0) : 0;

  snapshotParticleTransitionStart(
    particlesRef.current,
    focalX,
    focalY,
    focalZ,
    Math.hypot(width, height) * 0.55,
    true
  );

  const nonAmbientParticles = particlesRef.current.filter((p) => !p.isCosmicAmbient && !p.isTail);

  // Create a deterministic spatial permutation of particle indices so adjacent buffer slices
  // are never assigned to contiguous rings, spiral arms, or planets.
  const permutedIndices = nonAmbientParticles.map((_, i) => i);
  seededFisherYatesShuffle(permutedIndices, arch.length * 9973 + entities.length * 313);

  nonAmbientParticles.forEach((p, rawIdx) => {
    const idx = permutedIndices[rawIdx] ?? rawIdx;
    const s0 = p.seed?.[0] ?? Math.random();
    const s1 = p.seed?.[1] ?? Math.random();
    const s2 = p.seed?.[2] ?? Math.random();
    const s3 = p.seed?.[3] ?? Math.random();
    // Mix deterministic seed with permuted index using golden-ratio quasirandom sequence
    const rand = (s0 + ((idx * 0.61803398875) % 1.0)) % 1.0;
    const randRad = (s1 + ((idx * 0.7548776662) % 1.0)) % 1.0;
    const randAng = (s2 + ((idx * 0.5698402909) % 1.0)) % 1.0;

    if (arch === "BLACKHOLE_CENTRIC" && bh) {
      if (planets.length > 0 && rand < 0.22) {
        p.interstellarType = "planet";
        const planet = planets[idx % planets.length]!;
        p.interstellarEntityIndex = entities.indexOf(planet);
        p.interstellarEntity = planet;
        p.orbitRadius = planet.radius * (1.2 + randRad * 0.8);
        p.orbitAngle = randAng * Math.PI * 2;

        const r = p.orbitRadius || 30;
        const baseSpeed = 0.012 + s3 * 0.008;
        p.orbitSpeed = baseSpeed * Math.pow((planet.radius * 1.5) / r, 1.5);

        p.isPlanetRing = false;

        const rx = p.orbitRadius;
        const ry = rx * 0.7;
        const theta = -0.15;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const ox = Math.cos(p.orbitAngle) * rx;
        const oy = Math.sin(p.orbitAngle) * ry;
        p.targetX = planet.x + (ox * cosT - oy * sinT);
        p.targetY = planet.y + (ox * sinT + oy * cosT);
        p.targetZ = Math.sin(p.orbitAngle) * rx * 0.4;
        p.baseColor = planet.color;
        p.color = p.baseColor;
      } else {
        p.interstellarType = "blackhole";
        p.interstellarEntityIndex = entities.indexOf(bh);
        p.interstellarEntity = bh;
        // Seamless accretion disk spawning right from innermost stable circular orbit
        const isInnerAccretion = randRad < 0.72;
        if (isInnerAccretion) {
          p.orbitRadius = bh.radius * (1.15 + Math.pow(randRad / 0.72, 1.5) * 4.35);
        } else {
          p.orbitRadius = bh.radius * (5.5 + ((randRad - 0.72) / 0.28) * 15.0);
        }
        p.orbitAngle = randAng * Math.PI * 2;

        const r = p.orbitRadius || 50;
        const baseSpeed = 0.016 + s3 * 0.008;
        p.orbitSpeed = baseSpeed * Math.pow((bh.radius * 2.5) / r, 1.25);

        const rx = p.orbitRadius;
        const ry = rx * 0.36; // 68 degrees inclination matching 3D accretion mesh
        const theta = 0.04;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const ox = Math.cos(p.orbitAngle) * rx;
        const oy = Math.sin(p.orbitAngle) * ry;
        p.targetX = bh.x + (ox * cosT - oy * sinT);
        p.targetY = bh.y + (ox * sinT + oy * cosT);
        p.targetZ = Math.sin(p.orbitAngle) * rx * 0.65;

        const colorRand = s3;
        if (p.orbitRadius < bh.radius * 1.8) {
          p.baseColor = colorRand > 0.4 ? "#ffffff" : (colorRand > 0.2 ? "#e0f7fa" : "#fff59d");
        } else if (p.orbitRadius < bh.radius * 3.6) {
          p.baseColor = colorRand > 0.4 ? "#ffb300" : (colorRand > 0.2 ? "#ff7043" : "#f4511e");
        } else if (p.orbitRadius < bh.radius * 6.0) {
          p.baseColor = colorRand > 0.4 ? "#f25f35" : (colorRand > 0.2 ? "#e53935" : "#d81b60");
        } else {
          p.baseColor = colorRand > 0.4 ? "#c14b2a" : "#8e24aa";
        }
        p.color = p.baseColor;
        p.isPlanetRing = false;
      }
    } else if (arch === "BINARY_PLANETS" && planets.length >= 2) {
      if (rand < 0.65) {
        p.interstellarType = "planet";
        const planetIdx = idx % 2;
        const planet = planets[planetIdx] || planets[0]!;
        p.interstellarEntityIndex = entities.indexOf(planet);
        p.interstellarEntity = planet;

        const ringRand = randRad;
        if (ringRand > 0.3) {
          const minR = planet.radius * 1.2;
          const maxR = planet.radius * 2.8;
          p.orbitRadius = minR + ((ringRand - 0.3) / 0.7) * (maxR - minR);
          p.orbitAngle = randAng * Math.PI * 2;

          const r = p.orbitRadius || 30;
          const baseSpeed = 0.015 + s3 * 0.015;
          p.orbitSpeed = baseSpeed * Math.pow((planet.radius * 1.8) / r, 1.5);

          p.isPlanetRing = true;

          const rx = p.orbitRadius;
          const ry = rx * 0.22;
          const theta = planetIdx === 0 ? 0.3 : -0.3;
          const cosT = Math.cos(theta);
          const sinT = Math.sin(theta);
          const ox = Math.cos(p.orbitAngle) * rx;
          const oy = Math.sin(p.orbitAngle) * ry;
          p.targetX = planet.x + (ox * cosT - oy * sinT);
          p.targetY = planet.y + (ox * sinT + oy * cosT);
          p.targetZ = Math.sin(p.orbitAngle) * rx * 0.4;
          p.baseColor = planet.ringColor || planet.color;
        } else {
          p.orbitRadius = planet.radius * (1.1 + (ringRand / 0.3) * 0.5);
          p.orbitAngle = randAng * Math.PI * 2;

          const r = p.orbitRadius || 30;
          const baseSpeed = 0.012 + s3 * 0.012;
          p.orbitSpeed = baseSpeed * Math.pow((planet.radius * 1.4) / r, 1.5);

          p.isPlanetRing = false;

          const rx = p.orbitRadius;
          const ry = rx * 0.7;
          const theta = planetIdx === 0 ? -0.15 : 0.15;
          const cosT = Math.cos(theta);
          const sinT = Math.sin(theta);
          const ox = Math.cos(p.orbitAngle) * rx;
          const oy = Math.sin(p.orbitAngle) * ry;
          p.targetX = planet.x + (ox * cosT - oy * sinT);
          p.targetY = planet.y + (ox * sinT + oy * cosT);
          p.targetZ = Math.sin(p.orbitAngle) * rx * 0.4;
          p.baseColor = planet.color;
        }
        p.color = p.baseColor;
      } else if (rand < 0.85) {
        p.interstellarType = "bridge";
        p.bridgeStartEntityIndex = entities.indexOf(planets[0]!);
        p.bridgeEndEntityIndex = entities.indexOf(planets[1]!);
        p.bridgeStartEntity = planets[0]!;
        p.bridgeEndEntity = planets[1]!;
        p.bridgeProgress = (idx % 100) / 100;
        p.bridgeSpeed = 0.008 + s3 * 0.012;
        p.baseColor = s3 > 0.5 ? "#00ffd2" : "#da70d6";
        p.color = p.baseColor;
        p.isPlanetRing = false;
      } else if (nebulas.length > 0 && rand < 0.95) {
        p.interstellarType = "nebula";
        const nebula = nebulas[idx % nebulas.length] || nebulas[0]!;
        p.interstellarEntityIndex = entities.indexOf(nebula);
        p.interstellarEntity = nebula;

        const angle = randAng * Math.PI * 2;
        const rad = Math.pow(randRad, 1.5) * nebula.radius;
        p.orbitRadius = rad;
        p.orbitAngle = angle;
        p.orbitSpeed = 0.005 + s3 * 0.005;
        p.targetX = nebula.x + Math.cos(angle) * rad;
        p.targetY = nebula.y + Math.sin(angle) * rad;
        p.targetZ = (s3 - 0.5) * 50;

        p.baseColor = "rgba(120, 80, 220, 0.65)";
        p.color = p.baseColor;
        p.isPlanetRing = false;
      } else {
        p.interstellarType = "planet";
        const planetIdx = idx % 2;
        const planet = planets[planetIdx]!;
        p.interstellarEntityIndex = entities.indexOf(planet);
        p.interstellarEntity = planet;
        p.orbitRadius = planet.radius * (1.1 + randRad * 0.9);
        p.orbitAngle = randAng * Math.PI * 2;
        p.orbitSpeed = 0.012;
        p.targetX = planet.x + Math.cos(p.orbitAngle) * p.orbitRadius;
        p.targetY = planet.y + Math.sin(p.orbitAngle) * p.orbitRadius;
        p.targetZ = (s3 - 0.5) * 30;
        p.baseColor = planet.color;
        p.color = p.baseColor;
        p.isPlanetRing = false;
      }
    } else if (arch === "EXOPLANET_CLUSTER" && planets.length >= 2) {
      if (rand < 0.65) {
        p.interstellarType = "planet";
        const planet = planets[idx % planets.length]!;
        p.interstellarEntityIndex = entities.indexOf(planet);
        p.interstellarEntity = planet;
        p.orbitRadius = planet.radius * (1.1 + randRad * 0.8);
        p.orbitAngle = randAng * Math.PI * 2;
        p.orbitSpeed = 0.01 + s3 * 0.01;

        p.isPlanetRing = s3 > 0.5;
        const rx = p.orbitRadius;
        const ry = rx * (p.isPlanetRing ? 0.25 : 0.7);
        const ox = Math.cos(p.orbitAngle) * rx;
        const oy = Math.sin(p.orbitAngle) * ry;
        p.targetX = planet.x + ox;
        p.targetY = planet.y + oy;
        p.targetZ = Math.sin(p.orbitAngle) * rx * 0.4;
        p.baseColor = planet.color;
        p.color = p.baseColor;
      } else if (rand < 0.88) {
        p.interstellarType = "bridge";
        const startIdx = idx % planets.length;
        const endIdx = (startIdx + 1) % planets.length;
        p.bridgeStartEntityIndex = entities.indexOf(planets[startIdx]!);
        p.bridgeEndEntityIndex = entities.indexOf(planets[endIdx]!);
        p.bridgeStartEntity = planets[startIdx]!;
        p.bridgeEndEntity = planets[endIdx]!;
        p.bridgeProgress = (idx % 100) / 100;
        p.bridgeSpeed = 0.009 + s3 * 0.01;
        p.baseColor = planets[startIdx]!.color || "#4deeea";
        p.color = p.baseColor;
        p.isPlanetRing = false;
      } else {
        p.interstellarType = "planet";
        const planet = planets[idx % planets.length]!;
        p.interstellarEntityIndex = entities.indexOf(planet);
        p.interstellarEntity = planet;
        p.orbitRadius = planet.radius * (1.1 + randRad * 0.9);
        p.orbitAngle = randAng * Math.PI * 2;
        p.orbitSpeed = 0.01;
        p.targetX = planet.x + Math.cos(p.orbitAngle) * p.orbitRadius;
        p.targetY = planet.y + Math.sin(p.orbitAngle) * p.orbitRadius;
        p.targetZ = (s3 - 0.5) * 30;
        p.baseColor = planet.color;
        p.color = p.baseColor;
        p.isPlanetRing = false;
      }
    } else if (arch === "NEBULA_CRADLE" && (nebulas.length > 0 || planets.length > 0)) {
      if (nebulas.length > 0 && rand < 0.65) {
        p.interstellarType = "nebula";
        const nebula = nebulas[idx % nebulas.length]!;
        p.interstellarEntityIndex = entities.indexOf(nebula);
        p.interstellarEntity = nebula;

        const angle = randAng * Math.PI * 2;
        const rad = Math.pow(randRad, 1.4) * nebula.radius;
        p.orbitRadius = rad;
        p.orbitAngle = angle;
        p.orbitSpeed = 0.004 + s3 * 0.004;
        p.targetX = nebula.x + Math.cos(angle) * rad;
        p.targetY = nebula.y + Math.sin(angle) * rad;
        p.targetZ = (s3 - 0.5) * 60;
        p.baseColor = nebula.color || "rgba(242, 95, 53, 0.7)";
        p.color = p.baseColor;
        p.isPlanetRing = false;
      } else if (planets.length > 0 && rand < 0.88) {
        p.interstellarType = "planet";
        const planet = planets[idx % planets.length]!;
        p.interstellarEntityIndex = entities.indexOf(planet);
        p.interstellarEntity = planet;
        p.orbitRadius = planet.radius * (1.1 + randRad * 0.8);
        p.orbitAngle = randAng * Math.PI * 2;
        p.orbitSpeed = 0.01 + s3 * 0.01;
        p.targetX = planet.x + Math.cos(p.orbitAngle) * p.orbitRadius;
        p.targetY = planet.y + Math.sin(p.orbitAngle) * p.orbitRadius;
        p.targetZ = (s3 - 0.5) * 30;
        p.baseColor = planet.color;
        p.color = p.baseColor;
        p.isPlanetRing = false;
      } else {
        p.interstellarType = "nebula";
        const nebula = nebulas[idx % nebulas.length] || (nebulas[0] as any);
        p.interstellarEntityIndex = entities.indexOf(nebula);
        p.interstellarEntity = nebula;
        const angle = randAng * Math.PI * 2;
        const rad = Math.pow(randRad, 1.2) * (nebula ? nebula.radius : 100);
        p.orbitRadius = rad;
        p.orbitAngle = angle;
        p.orbitSpeed = 0.005;
        p.targetX = (nebula ? nebula.x : width / 2) + Math.cos(angle) * rad;
        p.targetY = (nebula ? nebula.y : height / 2) + Math.sin(angle) * rad;
        p.targetZ = (s3 - 0.5) * 50;
        p.baseColor = nebula?.color || "rgba(242, 95, 53, 0.7)";
        p.color = p.baseColor;
        p.isPlanetRing = false;
      }
    } else if (arch === "SPIRAL_GALAXY") {
      const cx = width / 2;
      const cy = height / 2;
      p.interstellarType = "galaxy";
      p.interstellarEntityIndex = 0;
      p.interstellarEntity = entities[0]!;

      const arm = idx % 4;
      const baseAngle = (arm * Math.PI) / 2;

      const maxRadius = Math.min(width, height) * 0.46;
      const minRadius = 18;
      const radFactor = Math.pow(randRad, 1.7);
      const r = minRadius + radFactor * (maxRadius - minRadius);

      const tightness = 0.014;
      const spiralAngle = baseAngle + r * tightness;
      const dispersion = (randAng - 0.5) * (0.32 + radFactor * 0.25);
      const finalAngle = spiralAngle + dispersion;

      p.orbitRadius = r;
      p.orbitAngle = finalAngle;
      p.orbitSpeed = (0.010 + s3 * 0.005) * Math.pow(100 / (r + 40), 0.45);

      const diskThickness = (1.0 - radFactor * 0.75) * 45;
      p.galaxyZOffset = (s3 - 0.5) * diskThickness;

      const inc = Math.PI / 4.2;
      const cosInc = Math.cos(inc);
      const sinInc = Math.sin(inc);
      const ox = Math.cos(finalAngle) * r;
      const oy = Math.sin(finalAngle) * r * cosInc;
      const oz = Math.sin(finalAngle) * r * sinInc + p.galaxyZOffset;

      p.targetX = cx + ox;
      p.targetY = cy + oy;
      p.targetZ = oz;

      const colorRand = s3;
      if (radFactor < 0.2) {
        p.baseColor = colorRand > 0.5 ? "#ffffff" : (colorRand > 0.25 ? "#ffe082" : "#ffb74d");
      } else if (colorRand < 0.12) {
        p.baseColor = "#ff4081";
      } else if (colorRand < 0.35) {
        p.baseColor = "#ffffff";
      } else if (arm % 2 === 0) {
        p.baseColor = "#80d8ff";
      } else {
        p.baseColor = "#4deeea";
      }
      p.color = p.baseColor;
      p.isPlanetRing = false;
    } else if (arch === "STELLAR_PULSAR") {
      const cx = width / 2;
      const cy = height / 2;
      const entity = entities[0]!;
      p.interstellarEntityIndex = 0;
      p.interstellarEntity = entity;

      const pulsarTypeRand = rand;
      if (pulsarTypeRand < 0.45) {
        p.interstellarType = "pulsar_ring";
        const ringIndex = idx % 5;
        const rBase = entity.radius * (1.6 + ringIndex * 1.8 + randRad * 0.8);
        p.orbitRadius = rBase;
        p.orbitAngle = randAng * Math.PI * 2;
        p.orbitSpeed = (0.022 + s3 * 0.015) * Math.pow((entity.radius * 2) / rBase, 0.8);

        const ox = Math.cos(p.orbitAngle) * rBase;
        const oy = Math.sin(p.orbitAngle) * rBase * 0.35;
        const oz = Math.sin(p.orbitAngle) * rBase * 0.65;

        p.targetX = cx + ox;
        p.targetY = cy + oy;
        p.targetZ = oz;

        p.baseColor = ringIndex === 0
          ? "#ffffff"
          : (ringIndex % 2 === 0 ? "#00ffd2" : "#80d8ff");
        p.color = p.baseColor;
      } else if (pulsarTypeRand < 0.80) {
        p.interstellarType = "pulsar_jet";
        const isNorth = idx % 2 === 0;
        p.galaxyZOffset = isNorth ? 1 : -1;
        const jetDist = entity.radius * (1.2 + Math.pow(randRad, 1.5) * 8.5);
        p.orbitRadius = jetDist;
        p.orbitAngle = randAng * Math.PI * 2;
        p.orbitSpeed = 0.035 + s3 * 0.025;

        const helixR = 8 + (jetDist / (entity.radius * 9)) * 18;
        const hx = Math.cos(p.orbitAngle * 4) * helixR;
        const hz = Math.sin(p.orbitAngle * 4) * helixR;

        p.targetX = cx + hx;
        p.targetY = cy + (isNorth ? -jetDist : jetDist);
        p.targetZ = hz;

        p.baseColor = s3 > 0.4 ? "#ffffff" : (isNorth ? "#c084fc" : "#00ffd2");
        p.color = p.baseColor;
      } else {
        p.interstellarType = "pulsar_ring";
        const loopRadius = entity.radius * (1.5 + randRad * 4.5);
        p.orbitRadius = loopRadius;
        p.orbitAngle = randAng * Math.PI * 2;
        p.orbitSpeed = 0.012 + s3 * 0.008;

        const ox = Math.cos(p.orbitAngle) * loopRadius * 0.7;
        const oy = Math.sin(p.orbitAngle) * loopRadius * 1.4;
        const oz = (s3 - 0.5) * 40;

        p.targetX = cx + ox;
        p.targetY = cy + oy;
        p.targetZ = oz;

        p.baseColor = s3 > 0.5 ? "#c084fc" : "#80d8ff";
        p.color = p.baseColor;
      }
      p.isPlanetRing = false;
    } else if (entities.length > 0) {
      const entity = entities[idx % entities.length]!;
      p.interstellarEntityIndex = entities.indexOf(entity);
      p.interstellarEntity = entity;

      if (entity.type === "blackhole") {
        p.interstellarType = "blackhole";
        const isInnerAccretion = randRad < 0.72;
        if (isInnerAccretion) {
          p.orbitRadius = entity.radius * (1.15 + Math.pow(randRad / 0.72, 1.5) * 4.35);
        } else {
          p.orbitRadius = entity.radius * (5.5 + ((randRad - 0.72) / 0.28) * 14.0);
        }
        p.orbitAngle = randAng * Math.PI * 2;
        p.orbitSpeed = (0.014 + s3 * 0.008) * Math.pow((entity.radius * 2.5) / p.orbitRadius, 1.25);
        p.targetX = entity.x + Math.cos(p.orbitAngle) * p.orbitRadius;
        p.targetY = entity.y + Math.sin(p.orbitAngle) * p.orbitRadius * 0.36;
        p.targetZ = Math.sin(p.orbitAngle) * p.orbitRadius * 0.65;
        const colorRand = s3;
        if (p.orbitRadius < entity.radius * 1.8) {
          p.baseColor = colorRand > 0.4 ? "#ffffff" : "#e0f7fa";
        } else if (p.orbitRadius < entity.radius * 3.6) {
          p.baseColor = colorRand > 0.4 ? "#ffb300" : "#ff7043";
        } else {
          p.baseColor = entity.color || "#ff6600";
        }
        p.color = p.baseColor;
        p.isPlanetRing = false;
      } else if (entity.type === "planet") {
        p.interstellarType = "planet";
        p.isPlanetRing = entity.hasRings && s3 > 0.4;
        const rMult = p.isPlanetRing ? (1.3 + randRad * 1.5) : (1.1 + randRad * 0.5);
        p.orbitRadius = entity.radius * rMult;
        p.orbitAngle = randAng * Math.PI * 2;
        p.orbitSpeed = 0.01 + s3 * 0.01;
        const rx = p.orbitRadius;
        const ry = rx * (p.isPlanetRing ? 0.25 : 0.65);
        p.targetX = entity.x + Math.cos(p.orbitAngle) * rx;
        p.targetY = entity.y + Math.sin(p.orbitAngle) * ry;
        p.targetZ = Math.sin(p.orbitAngle) * rx * 0.35;
        p.baseColor = p.isPlanetRing ? (entity.ringColor || entity.color) : entity.color;
        p.color = p.baseColor;
      } else if (entity.type === "nebula") {
        p.interstellarType = "nebula";
        const angle = randAng * Math.PI * 2;
        const rad = Math.pow(randRad, 1.4) * entity.radius;
        p.orbitRadius = rad;
        p.orbitAngle = angle;
        p.orbitSpeed = 0.005 + s3 * 0.005;
        p.targetX = entity.x + Math.cos(angle) * rad;
        p.targetY = entity.y + Math.sin(angle) * rad;
        p.targetZ = (s3 - 0.5) * 50;
        p.baseColor = entity.color || "#4deeea";
        p.color = p.baseColor;
        p.isPlanetRing = false;
      } else {
        p.interstellarType = "planet";
        const rRadius = entity.radius * (1.2 + randRad * 2.5);
        const rAngle = randAng * Math.PI * 2;
        p.targetX = entity.x + Math.cos(rAngle) * rRadius;
        p.targetY = entity.y + Math.sin(rAngle) * rRadius;
        p.targetZ = (s3 - 0.5) * 40;
        p.baseColor = entity.color || "#ffffff";
        p.color = p.baseColor;
        p.isPlanetRing = false;
      }
    } else {
      p.interstellarType = "planet";
      const rRadius = 80 + randRad * 150;
      const rAngle = randAng * Math.PI * 2;
      p.targetX = width / 2 + Math.cos(rAngle) * rRadius;
      p.targetY = height / 2 + Math.sin(rAngle) * rRadius;
      p.targetZ = (s3 - 0.5) * 30;
      p.baseColor = "#4deeea";
      p.color = p.baseColor;
      p.isPlanetRing = false;
    }

    const targetRgb = parseParticleRgb(p.color);
    p.targetR = targetRgb.r;
    p.targetG = targetRgb.g;
    p.targetB = targetRgb.b;
  });

  partitionParticlesWithoutColorClustering(particlesRef.current);
  syncParticleColors(particlesRef.current);
  tailStartIndexRef.current = particlesRef.current.findIndex((p) => p.isTail);
}

export function mapParticlesToStage(
  targetStage: number,
  triggerBurst: boolean,
  stageTargetsRef: React.MutableRefObject<{ [key: number]: { x: number; y: number; color: string }[] }>,
  particlesRef: React.MutableRefObject<Particle[]>,
  tailStartIndexRef: React.MutableRefObject<number>
): void {
  const ww = typeof window !== "undefined" && window.innerWidth > 0 ? window.innerWidth : 1920;
  const wh = typeof window !== "undefined" && window.innerHeight > 0 ? window.innerHeight : 1080;

  const coords = generateTargetsForStage(targetStage, ww, wh);
  if (!coords || coords.length === 0) return;

  stageTargetsRef.current[targetStage] = coords;

  if (particlesRef.current.length > 0) {
    // Compute text centroid as focal origin for wavefront erosion
    let sumX = 0;
    let sumY = 0;
    for (let i = 0; i < coords.length; i++) {
      sumX += coords[i]!.x;
      sumY += coords[i]!.y;
    }
    const centroidX = coords.length > 0 ? sumX / coords.length : ww / 2;
    const centroidY = coords.length > 0 ? sumY / coords.length : wh / 2;

    snapshotParticleTransitionStart(
      particlesRef.current,
      centroidX,
      centroidY,
      0,
      Math.hypot(ww, wh) * 0.48,
      true
    );

    const foregroundParticles = particlesRef.current.filter((p) => !p.isCosmicAmbient && !p.isTail);
    const assignedTargets = assignTargetsOptimalTransport(
      foregroundParticles,
      coords,
      ww,
      wh,
      (targetStage + 1) * 6151
    );

    foregroundParticles.forEach((p, idx) => {
      const t = assignedTargets[idx] || coords[idx % coords.length] || coords[0]!;

      p.targetX = t.x;
      p.targetY = t.y;
      p.targetZ = 0;
      p.baseColor = t.color;
      p.color = t.color;
      p.isProjectText = true;
      p.interstellarType = undefined;

      const targetRgb = parseParticleRgb(t.color);
      p.targetR = targetRgb.r;
      p.targetG = targetRgb.g;
      p.targetB = targetRgb.b;

      if (triggerBurst) {
        const cx = centroidX;
        const cy = centroidY;
        const dx = p.x - cx;
        const dy = p.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        const swirlMagnitude = 28.0 + (p.seed?.[0] ?? 0.5) * 14.0;
        const tx = (-dy / dist) * swirlMagnitude;
        const ty = (dx / dist) * swirlMagnitude;

        const radialMagnitude = ((p.seed?.[1] ?? 0.5) - 0.25) * 36.0;
        const rx = (dx / dist) * radialMagnitude;
        const ry = (dy / dist) * radialMagnitude;

        p.vx = tx + rx + ((p.seed?.[2] ?? 0.5) - 0.5) * 14;
        p.vy = ty + ry + ((p.seed?.[3] ?? 0.5) - 0.5) * 14;
        p.vz = ((p.seed?.[0] ?? 0.5) - 0.5) * 55;
      }
    });

    partitionParticlesWithoutColorClustering(particlesRef.current);
    syncParticleColors(particlesRef.current);
    tailStartIndexRef.current = particlesRef.current.findIndex((p) => p.isTail);
  }
}

/**
 * Initiates a physics-driven staggered morph transition across all foreground particles,
 * imparting a subtle initial tangential + curl impulse so outer particles peel away
 * organically instead of moving as a rigid block.
 */
export function triggerOrganicParticleDisperse(
  particlesList: Particle[],
  focalX: number,
  focalY: number,
  focalZ: number = 0,
  intensity: number = 1.0
): void {
  if (!Array.isArray(particlesList)) return;
  const safeIntensity = isFinite(intensity) ? Math.max(0.1, Math.min(3.0, intensity)) : 1.0;

  for (let i = 0; i < particlesList.length; i++) {
    const p = particlesList[i];
    if (!p || p.isCosmicAmbient || p.isTail) continue;
    const s0 = p.seed?.[0] ?? 0.5;
    const s1 = p.seed?.[1] ?? 0.5;
    const s2 = p.seed?.[2] ?? 0.5;

    const dx = (p.x || focalX) - focalX;
    const dy = (p.y || focalY) - focalY;
    const dz = (p.z || focalZ) - focalZ;
    const dist = Math.hypot(dx, dy, dz) || 1;

    // Tangential orbital swirl (\hat{n}_{axis} \times \vec{r}) + slight radial peel
    const tx = -dy / dist;
    const ty = dx / dist;
    const swirlSpeed = (4.5 + s0 * 7.5) * safeIntensity;
    const radialSpeed = ((s1 - 0.35) * 6.0) * safeIntensity;

    p.vx = (p.vx || 0) * 0.55 + tx * swirlSpeed + (dx / dist) * radialSpeed;
    p.vy = (p.vy || 0) * 0.55 + ty * swirlSpeed + (dy / dist) * radialSpeed;
    p.vz = (p.vz || 0) * 0.55 + (s2 - 0.5) * 14.0 * safeIntensity;
  }
}

/**
 * Place every foreground particle exactly on its (new) target with zero
 * velocity, and retire in-flight tail particles. Retained for headless unit tests
 * and reduced-motion accessibility fallback.
 */
export function settleParticlesToTargets(particlesList: Particle[]): number {
  if (!Array.isArray(particlesList)) return 0;
  let settled = 0;
  for (let i = 0; i < particlesList.length; i++) {
    const p = particlesList[i];
    if (!p || p.isCosmicAmbient) continue;
    if (p.isTail) {
      p.life = 0;
      p.vx = 0;
      p.vy = 0;
      p.vz = 0;
      p.prevDrawX = undefined;
      p.prevDrawY = undefined;
      continue;
    }
    if (Number.isFinite(p.targetX)) p.x = p.targetX;
    if (Number.isFinite(p.targetY)) p.y = p.targetY;
    p.z = Number.isFinite(p.targetZ as number) ? (p.targetZ as number) : 0;
    p.vx = 0;
    p.vy = 0;
    p.vz = 0;
    p.localProgress = 1.0;
    p.easedProgress = 1.0;
    p.tunnelLife = undefined;
    p.prevDrawX = undefined;
    p.prevDrawY = undefined;
    settled++;
  }
  return settled;
}
