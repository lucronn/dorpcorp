import React from "react";
import { Particle, CelestialEntity } from "./types";
import { generateTargetsForStage } from "./ParticleUtils";

export function syncParticleColors(particlesList: Particle[]): void {
  particlesList.forEach((p) => {
    if (p.color && p.color.startsWith("#") && p.color.length >= 7) {
      p.r = parseInt(p.color.slice(1, 3), 16);
      p.g = parseInt(p.color.slice(3, 5), 16);
      p.b = parseInt(p.color.slice(5, 7), 16);
    } else if (p.color && p.color.startsWith("rgb")) {
      const matches = p.color.match(/\d+/g);
      if (matches) {
        p.r = parseInt(matches[0] || "255", 10);
        p.g = parseInt(matches[1] || "255", 10);
        p.b = parseInt(matches[2] || "255", 10);
      }
    } else {
      p.r = 255;
      p.g = 255;
      p.b = 255;
    }
  });
}

/**
 * Maps particles to stage typography targets.
 */
export function mapParticlesToStage(
  targetStage: number,
  triggerBurst: boolean,
  stageTargetsRef: React.MutableRefObject<{ x: number; y: number; color: string }[][]>,
  particlesRef: React.MutableRefObject<Particle[]>,
  tailStartIndexRef: React.MutableRefObject<number>
): void {
  const currentTargets = stageTargetsRef.current[targetStage] || [];
  const targetCount = currentTargets.length;
  const nonAmbientParticles = particlesRef.current.filter((p) => !p.isCosmicAmbient);
  const tailStart = tailStartIndexRef.current;

  nonAmbientParticles.forEach((p, i) => {
    if (i >= tailStart) return;

    if (targetCount > 0) {
      const target = currentTargets[i % targetCount]!;
      p.targetX = target.x;
      p.targetY = target.y;
      p.targetZ = 0;
      p.baseColor = target.color;
      p.color = target.color;
      p.isProjectText = true;
      p.interstellarType = undefined;
      p.clusterRole = undefined;

      if (triggerBurst) {
        const burstAngle = Math.random() * Math.PI * 2;
        const burstDist = 30 + Math.random() * 80;
        p.vx += Math.cos(burstAngle) * burstDist * 0.08;
        p.vy += Math.sin(burstAngle) * burstDist * 0.08;
      }
    }
  });
  syncParticleColors(particlesRef.current);
}

/**
 * Maps a particle into a rich, dense 3D Planet Particle Cluster:
 * - 65% Surface Body: 3D Fibonacci sphere shell with continents, oceans, polar ice caps, and night lights.
 * - 15% Atmospheric Glow: Glowing spherical shell with Rayleigh/Mie translucent scattering.
 * - 20% Planetary Ring: Dense Keplerian concentric ring discs orbiting the equator.
 */
function mapPlanetParticleCluster(
  p: Particle,
  planet: CelestialEntity,
  entityIndex: number,
  idx: number,
  totalParticles: number,
  ringTilt: number = 0.35
): void {
  p.interstellarType = "planet";
  p.interstellarEntityIndex = entityIndex;
  p.interstellarEntity = planet;

  const rolePick = (idx % 100) / 100;
  const radius = planet.radius || 30;

  if (rolePick < 0.65) {
    // 1. 3D Spherical Fibonacci Surface Lattice
    p.clusterRole = "surface";
    const u = ((idx % 650) + 0.5) / 650;
    const phi = Math.acos(1 - 2 * u); // 0 to PI
    const theta = Math.PI * (3 - Math.sqrt(5)) * idx; // Golden ratio angle

    const lx = radius * Math.sin(phi) * Math.cos(theta);
    const ly = radius * Math.sin(phi) * Math.sin(theta);
    const lz = radius * Math.cos(phi);

    p.clusterRelX = lx;
    p.clusterRelY = ly;
    p.clusterRelZ = lz;
    p.clusterPhi = phi;
    p.clusterTheta = theta;
    p.clusterSpinSpeed = 1.2 + (planet.orbitSpeed || 0.01) * 15.0;

    p.targetX = planet.x + lx;
    p.targetY = planet.y + ly;
    p.targetZ = (planet.z || 0) + lz;

    // Procedural multi-spectral planetary surface coloring
    const isPolarCap = Math.abs(lz) > radius * 0.82;
    const continentNoise = Math.sin(lx * 0.12) * Math.cos(ly * 0.12) + Math.sin(lz * 0.15);

    if (isPolarCap) {
      p.baseColor = "#f0fdff"; // Glacial polar ice
    } else if (continentNoise > 0.3) {
      p.baseColor = planet.color || "#43a047"; // Continental landmass
    } else if (continentNoise > -0.2) {
      p.baseColor = planet.secondaryColor || "#1e88e5"; // Oceanic water / secondary terrain
    } else {
      p.baseColor = planet.color || "#0d47a1"; // Deep ocean / basalt
    }
    p.color = p.baseColor;
    p.isPlanetRing = false;
  } else if (rolePick < 0.80) {
    // 2. Translucent Glowing Atmosphere Rim
    p.clusterRole = "atmosphere";
    const u = Math.random();
    const phi = Math.acos(1 - 2 * u);
    const theta = Math.random() * Math.PI * 2;
    const atmosRadius = radius * (1.06 + Math.random() * 0.12);

    const lx = atmosRadius * Math.sin(phi) * Math.cos(theta);
    const ly = atmosRadius * Math.sin(phi) * Math.sin(theta);
    const lz = atmosRadius * Math.cos(phi);

    p.clusterRelX = lx;
    p.clusterRelY = ly;
    p.clusterRelZ = lz;
    p.clusterSpinSpeed = 1.5;

    p.targetX = planet.x + lx;
    p.targetY = planet.y + ly;
    p.targetZ = (planet.z || 0) + lz;

    p.baseColor = planet.secondaryColor || "#80d8ff"; // Rayleigh atmospheric glow
    p.color = p.baseColor;
    p.isPlanetRing = false;
  } else {
    // 3. Concentric Keplerian Ring Disc
    p.clusterRole = "ring";
    const minRing = radius * 1.35;
    const maxRing = radius * (planet.hasRings ? 2.6 : 2.0);
    const radFactor = Math.pow(Math.random(), 1.2);
    p.orbitRadius = minRing + radFactor * (maxRing - minRing);
    p.orbitAngle = Math.random() * Math.PI * 2;

    const r = p.orbitRadius;
    p.orbitSpeed = 0.018 * Math.pow((radius * 1.5) / r, 1.5);

    const rx = p.orbitRadius;
    const ry = rx * 0.32;
    const theta = ringTilt;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const ox = Math.cos(p.orbitAngle) * rx;
    const oy = Math.sin(p.orbitAngle) * ry;

    p.targetX = planet.x + (ox * cosT - oy * sinT);
    p.targetY = planet.y + (ox * sinT + oy * cosT);
    p.targetZ = (planet.z || 0) + Math.sin(p.orbitAngle) * rx * 0.4;

    p.baseColor = planet.ringColor || planet.secondaryColor || planet.color || "#ffd778";
    p.color = p.baseColor;
    p.isPlanetRing = true;
  }
}

/**
 * Maps a particle into a rich, dense 3D Star Particle Cluster:
 * - 60% Incandescent Fusion Core: Dense 3D volumetric thermal particle sphere.
 * - 25% Convective Corona / Granulation: Boiling solar flares & prominence loops.
 * - 15% Polar Relativistic Jets: High-energy particle beams along rotation axis.
 */
function mapStarParticleCluster(
  p: Particle,
  star: CelestialEntity,
  entityIndex: number,
  idx: number,
  totalParticles: number
): void {
  p.interstellarType = "star";
  p.interstellarEntityIndex = entityIndex;
  p.interstellarEntity = star;

  const rolePick = (idx % 100) / 100;
  const radius = star.radius || 40;

  if (rolePick < 0.60) {
    // 1. Incandescent Fusion Core
    p.clusterRole = "core";
    const u = Math.random();
    const phi = Math.acos(1 - 2 * Math.random());
    const theta = Math.random() * Math.PI * 2;
    const coreRad = radius * Math.pow(Math.random(), 0.6); // Volumetric density concentrated in core

    const lx = coreRad * Math.sin(phi) * Math.cos(theta);
    const ly = coreRad * Math.sin(phi) * Math.sin(theta);
    const lz = coreRad * Math.cos(phi);

    p.clusterRelX = lx;
    p.clusterRelY = ly;
    p.clusterRelZ = lz;
    p.clusterSpinSpeed = 1.5;

    p.targetX = star.x + lx;
    p.targetY = star.y + ly;
    p.targetZ = (star.z || 0) + lz;

    const coreColorRand = Math.random();
    if (coreColorRand < 0.5) {
      p.baseColor = "#ffffff"; // 10,000K Core
    } else if (coreColorRand < 0.8) {
      p.baseColor = star.color || "#fff5cc";
    } else {
      p.baseColor = star.secondaryColor || "#ffd778";
    }
    p.color = p.baseColor;
    p.isPlanetRing = false;
  } else if (rolePick < 0.85) {
    // 2. Convective Boiling Corona & Prominence Flares
    p.clusterRole = "corona";
    const phi = Math.acos(1 - 2 * Math.random());
    const theta = Math.random() * Math.PI * 2;
    const flareHeight = radius * (1.02 + Math.random() * 0.35);

    const lx = flareHeight * Math.sin(phi) * Math.cos(theta);
    const ly = flareHeight * Math.sin(phi) * Math.sin(theta);
    const lz = flareHeight * Math.cos(phi);

    p.clusterRelX = lx;
    p.clusterRelY = ly;
    p.clusterRelZ = lz;
    p.clusterNoiseOffset = Math.random() * 100;
    p.clusterSpinSpeed = 1.8;

    p.targetX = star.x + lx;
    p.targetY = star.y + ly;
    p.targetZ = (star.z || 0) + lz;

    p.baseColor = star.secondaryColor || "#ff7733";
    p.color = p.baseColor;
    p.isPlanetRing = false;
  } else {
    // 3. Collimated Polar Relativistic Jet Streams
    p.clusterRole = "jet";
    const isNorth = Math.random() > 0.5;
    const jetHeight = radius * (1.0 + Math.pow(Math.random(), 0.7) * 5.0);
    const jetSpread = (jetHeight / (radius * 5.0)) * (radius * 0.35);
    const jetAngle = Math.random() * Math.PI * 2;

    const lx = Math.cos(jetAngle) * jetSpread * Math.random();
    const lz = Math.sin(jetAngle) * jetSpread * Math.random();
    const ly = (isNorth ? 1 : -1) * jetHeight;

    p.clusterRelX = lx;
    p.clusterRelY = ly;
    p.clusterRelZ = lz;

    p.targetX = star.x + lx;
    p.targetY = star.y + ly;
    p.targetZ = (star.z || 0) + lz;

    p.baseColor = "#99e5ff"; // High-energy synchrotron radiation
    p.color = p.baseColor;
    p.isPlanetRing = false;
  }
}

/**
 * Maps a particle into a rich, dense 3D Black Hole Particle Cluster:
 * - Void Center: 0 particles inside Event Horizon r < r_s.
 * - 20% Photon Ring: Razor-sharp ultrafast circular ring at r = 1.5 r_s.
 * - 60% Relativistic Accretion Disk: Swirling Keplerian disk from 2.8 r_s to 9.0 r_s with Doppler beaming.
 * - 20% Warped Gravitationally Lensed Arcs: Vertical upper & lower Gargantua arches.
 */
function mapBlackholeParticleCluster(
  p: Particle,
  bh: CelestialEntity,
  entityIndex: number,
  idx: number,
  totalParticles: number
): void {
  p.interstellarType = "blackhole";
  p.interstellarEntityIndex = entityIndex;
  p.interstellarEntity = bh;

  const rolePick = (idx % 100) / 100;
  const rs = bh.radius || 35;

  if (rolePick < 0.20) {
    // 1. Relativistic Photon Ring (r = 1.48 to 1.62 r_s)
    p.clusterRole = "photon_ring";
    p.orbitRadius = rs * (1.48 + Math.random() * 0.14);
    p.orbitAngle = Math.random() * Math.PI * 2;
    p.orbitSpeed = 0.045 + Math.random() * 0.015; // Near-luminal velocity

    const rx = p.orbitRadius;
    const ry = rx * 0.38;
    const theta = 0.18;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const ox = Math.cos(p.orbitAngle) * rx;
    const oy = Math.sin(p.orbitAngle) * ry;

    p.targetX = bh.x + (ox * cosT - oy * sinT);
    p.targetY = bh.y + (ox * sinT + oy * cosT);
    p.targetZ = (bh.z || 0) + Math.sin(p.orbitAngle) * rx * 0.48;

    p.baseColor = "#ffffff"; // Pure optical photon sphere
    p.color = p.baseColor;
    p.isPlanetRing = false;
  } else if (rolePick < 0.80) {
    // 2. Primary Relativistic Accretion Disk (r = 2.6 r_s to 9.5 r_s)
    p.clusterRole = "accretion";
    const minR = rs * 2.6;
    const maxR = rs * 9.5;
    const radFactor = Math.pow(Math.random(), 1.5);
    p.orbitRadius = minR + radFactor * (maxR - minR);
    p.orbitAngle = Math.random() * Math.PI * 2;

    const r = p.orbitRadius;
    const baseSpeed = 0.026 + Math.random() * 0.014;
    p.orbitSpeed = baseSpeed * Math.pow((rs * 3.0) / r, 1.5); // Keplerian differential rotation

    const rx = p.orbitRadius;
    const ry = rx * 0.32;
    const theta = 0.12;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const ox = Math.cos(p.orbitAngle) * rx;
    const oy = Math.sin(p.orbitAngle) * ry;

    p.targetX = bh.x + (ox * cosT - oy * sinT);
    p.targetY = bh.y + (ox * sinT + oy * cosT);
    p.targetZ = (bh.z || 0) + Math.sin(p.orbitAngle) * rx * 0.45;

    // Relativistic Doppler temperature gradient
    if (p.orbitRadius < rs * 4.2) {
      p.baseColor = Math.random() > 0.4 ? "#ffffff" : "#ffd778"; // High temperature inner disk
    } else if (p.orbitRadius < rs * 6.5) {
      p.baseColor = Math.random() > 0.4 ? "#ff7733" : "#f25f35";
    } else {
      p.baseColor = Math.random() > 0.4 ? "#dd3322" : "#991133"; // Cool outer boundary
    }
    p.color = p.baseColor;
    p.isPlanetRing = false;
  } else {
    // 3. Gravitationally Lensed Vertical Gargantua Arches
    p.clusterRole = "warped_arch";
    const isTopArch = Math.random() > 0.5;
    const archRadius = rs * (3.5 + Math.random() * 3.8);
    const archAngle = (Math.random() - 0.5) * Math.PI * 0.85 + (isTopArch ? -Math.PI / 2 : Math.PI / 2);

    p.orbitRadius = archRadius;
    p.orbitAngle = archAngle;
    p.orbitSpeed = 0.018;

    const rx = archRadius;
    const ry = archRadius * (isTopArch ? 0.75 : -0.75);

    p.targetX = bh.x + Math.cos(archAngle) * rx;
    p.targetY = bh.y + Math.sin(archAngle) * ry;
    p.targetZ = (bh.z || 0) + (isTopArch ? -rs * 0.4 : rs * 0.4);

    p.baseColor = Math.random() > 0.5 ? "#ffd778" : "#ff8844";
    p.color = p.baseColor;
    p.isPlanetRing = false;
  }
}

/**
 * Maps a particle into a rich, dense 3D Nebula Gas Cloud Cluster:
 * - Multi-lobe fractal billowing gas clouds with 3D fluid vortex turbulence.
 * - Multi-spectral astrophysics ionization color gradients (H-alpha, O-III, N-II, stardust).
 */
function mapNebulaParticleCluster(
  p: Particle,
  nebula: CelestialEntity,
  entityIndex: number,
  idx: number,
  totalParticles: number
): void {
  p.interstellarType = "nebula";
  p.interstellarEntityIndex = entityIndex;
  p.interstellarEntity = nebula;
  p.clusterRole = "gas_lobe";

  const subCluster = idx % 5;
  const subOffsets = [
    { x: 0, y: 0, z: 0, spread: 0.65 },
    { x: 0.35, y: 0.25, z: 20, spread: 0.45 },
    { x: -0.30, y: -0.20, z: -15, spread: 0.50 },
    { x: 0.20, y: -0.38, z: 12, spread: 0.40 },
    { x: -0.40, y: 0.30, z: -18, spread: 0.48 },
  ];
  const cluster = subOffsets[subCluster]!;
  const u = Math.random() + Math.random() + Math.random() - 1.5; // Gaussian distribution
  const v = Math.random() + Math.random() + Math.random() - 1.5;
  const w = Math.random() + Math.random() + Math.random() - 1.5;
  const lobeRad = nebula.radius * cluster.spread;

  p.targetX = nebula.x + cluster.x * nebula.radius + u * lobeRad;
  p.targetY = nebula.y + cluster.y * nebula.radius + v * lobeRad;
  p.targetZ = (nebula.z || 0) + cluster.z + w * (lobeRad * 0.7);

  p.orbitRadius = Math.hypot(p.targetX - nebula.x, p.targetY - nebula.y);
  p.orbitAngle = Math.atan2(p.targetY - nebula.y, p.targetX - nebula.x);
  p.orbitSpeed = 0.003 + Math.random() * 0.004;

  const colorPick = Math.random();
  if (colorPick < 0.35) {
    p.baseColor = nebula.color || "#ff3366"; // H-alpha ionized hydrogen
  } else if (colorPick < 0.65) {
    p.baseColor = nebula.secondaryColor || "#00ffd2"; // [O III] doubly ionized oxygen
  } else if (colorPick < 0.85) {
    p.baseColor = "#da70d6"; // Ionized helium / nitrogen
  } else {
    p.baseColor = "#ffd778"; // Stellar nursery stardust
  }
  p.color = p.baseColor;
  p.isPlanetRing = false;
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
  const stars = entities.filter((e) => e.type === "star");
  const nebulas = entities.filter((e) => e.type === "nebula");
  const arch = archetypeRef.current || "BLACKHOLE_CENTRIC";

  const nonAmbientParticles = particlesRef.current.filter((p) => !p.isCosmicAmbient);
  const totalCount = nonAmbientParticles.length;

  // Background deep space galaxies
  const numBackgroundGalaxies = 100;
  const galaxyCenters: {
    x: number;
    y: number;
    z: number;
    pitch: number;
    yaw: number;
    type: "spiral" | "elliptical";
    color: string;
  }[] = [];

  const galaxyColors = [
    "#4deeea",
    "#ff007f",
    "#aa00ff",
    "#ffd778",
    "#00e5ff",
    "#ff5e62",
    "#ffffff",
    "#da70d6",
  ];

  for (let g = 0; g < numBackgroundGalaxies; g++) {
    const rRadius = 4000 + Math.random() * 7000;
    const rPhi = Math.acos(Math.random() * 2 - 1);
    const rTheta = Math.random() * Math.PI * 2;
    const gx = rRadius * Math.sin(rPhi) * Math.cos(rTheta);
    const gy = rRadius * Math.sin(rPhi) * Math.sin(rTheta);
    const gz = rRadius * Math.cos(rPhi);

    galaxyCenters.push({
      x: gx,
      y: gy,
      z: gz,
      pitch: Math.random() * Math.PI,
      yaw: Math.random() * Math.PI * 2,
      type: Math.random() > 0.4 ? "spiral" : "elliptical",
      color: galaxyColors[g % galaxyColors.length]!,
    });
  }

  nonAmbientParticles.forEach((p, idx) => {
    const rand = Math.random();

    // 5% allocated to deep background galaxies
    if (idx % 100 < 5) {
      const gal = galaxyCenters[idx % numBackgroundGalaxies]!;
      p.interstellarType = "background_galaxy";
      p.galaxyX = gal.x + width / 2;
      p.galaxyY = gal.y + height / 2;
      p.galaxyZ = gal.z;
      p.galaxyPitch = gal.pitch;
      p.galaxyYaw = gal.yaw;
      p.galaxyType = gal.type;

      const radFactor = Math.pow(Math.random(), 1.8);
      const maxGalRadius = 35 + Math.random() * 55;
      p.orbitRadius = 2 + radFactor * maxGalRadius;
      p.orbitAngle = Math.random() * Math.PI * 2;
      p.orbitSpeed = (0.015 + Math.random() * 0.012) * (25 / (p.orbitRadius + 8));

      p.baseColor = gal.color;
      if (radFactor < 0.14) {
        p.baseColor = "#ffffff";
      }
      p.color = p.baseColor;
      p.isPlanetRing = false;

      const rx = p.orbitRadius;
      const ry = p.galaxyType === "spiral" ? rx * 0.35 : rx * 0.8;
      const ox = Math.cos(p.orbitAngle) * rx;
      const oy = Math.sin(p.orbitAngle) * ry;

      const cosP = Math.cos(p.galaxyPitch);
      const sinP = Math.sin(p.galaxyPitch);
      const cosY = Math.cos(p.galaxyYaw);
      const sinY = Math.sin(p.galaxyYaw);

      const lx = ox * cosY - oy * sinY * cosP;
      const ly = ox * sinY + oy * cosY * cosP;
      const lz = oy * sinP;

      p.targetX = p.galaxyX + lx;
      p.targetY = p.galaxyY + ly;
      p.targetZ = p.galaxyZ + lz;
    } else {
      if (arch === "BLACKHOLE_CENTRIC" && bh) {
        if (rand < 0.82) {
          mapBlackholeParticleCluster(p, bh, entities.indexOf(bh), idx, totalCount);
        } else if (planets.length > 0 && rand < 0.95) {
          const planet = planets[idx % planets.length]!;
          mapPlanetParticleCluster(p, planet, entities.indexOf(planet), idx, totalCount, -0.22);
        } else {
          // Sparse ambient background stars (5%)
          p.interstellarType = "star";
          const rRadius = 400 + Math.random() * (width * 4);
          const rTheta = Math.random() * Math.PI * 2;
          const rPhi = Math.acos(Math.random() * 2 - 1);
          p.targetX = width / 2 + rRadius * Math.sin(rPhi) * Math.cos(rTheta);
          p.targetY = height / 2 + rRadius * Math.sin(rPhi) * Math.sin(rTheta);
          p.targetZ = rRadius * Math.cos(rPhi);
          p.baseColor = Math.random() > 0.8 ? "#99e5ff" : (Math.random() > 0.5 ? "#ffd778" : "#ffffff");
          p.color = p.baseColor;
          p.isPlanetRing = false;
        }
      } else if (arch === "BINARY_PLANETS" && planets.length >= 2) {
        if (rand < 0.72) {
          const planetIdx = idx % 2;
          const planet = planets[planetIdx] || planets[0]!;
          mapPlanetParticleCluster(p, planet, entities.indexOf(planet), idx, totalCount, planetIdx === 0 ? 0.3 : -0.3);
        } else if (rand < 0.95) {
          // High-energy particle bridge connecting binary planets
          p.interstellarType = "bridge";
          p.bridgeStartEntityIndex = entities.indexOf(planets[0]!);
          p.bridgeEndEntityIndex = entities.indexOf(planets[1]!);
          p.bridgeStartEntity = planets[0]!;
          p.bridgeEndEntity = planets[1]!;
          p.bridgeProgress = (idx % 100) / 100;
          p.bridgeSpeed = 0.008 + Math.random() * 0.012;
          p.baseColor = Math.random() > 0.5 ? "#00ffd2" : "#da70d6";
          p.color = p.baseColor;
          p.isPlanetRing = false;
        } else {
          p.interstellarType = "star";
          const rRadius = 400 + Math.random() * (width * 4);
          const rTheta = Math.random() * Math.PI * 2;
          const rPhi = Math.acos(Math.random() * 2 - 1);
          p.targetX = width / 2 + rRadius * Math.sin(rPhi) * Math.cos(rTheta);
          p.targetY = height / 2 + rRadius * Math.sin(rPhi) * Math.sin(rTheta);
          p.targetZ = rRadius * Math.cos(rPhi);
          p.baseColor = "#ffffff";
          p.color = p.baseColor;
          p.isPlanetRing = false;
        }
      } else if (arch === "EXOPLANET_CLUSTER" && planets.length >= 2) {
        if (rand < 0.70) {
          const planet = planets[idx % planets.length]!;
          mapPlanetParticleCluster(p, planet, entities.indexOf(planet), idx, totalCount);
        } else if (rand < 0.95) {
          // Interplanetary resonance stream bridges
          p.interstellarType = "bridge";
          const startIdx = idx % planets.length;
          const endIdx = (startIdx + 1) % planets.length;
          p.bridgeStartEntityIndex = entities.indexOf(planets[startIdx]!);
          p.bridgeEndEntityIndex = entities.indexOf(planets[endIdx]!);
          p.bridgeStartEntity = planets[startIdx]!;
          p.bridgeEndEntity = planets[endIdx]!;
          p.bridgeProgress = (idx % 100) / 100;
          p.bridgeSpeed = 0.009 + Math.random() * 0.01;
          p.baseColor = planets[startIdx]!.color || "#4deeea";
          p.color = p.baseColor;
          p.isPlanetRing = false;
        } else {
          p.interstellarType = "star";
          const rRadius = 400 + Math.random() * (width * 4);
          const rTheta = Math.random() * Math.PI * 2;
          const rPhi = Math.acos(Math.random() * 2 - 1);
          p.targetX = width / 2 + rRadius * Math.sin(rPhi) * Math.cos(rTheta);
          p.targetY = height / 2 + rRadius * Math.sin(rPhi) * Math.sin(rTheta);
          p.targetZ = rRadius * Math.cos(rPhi);
          p.baseColor = "#ffffff";
          p.color = p.baseColor;
          p.isPlanetRing = false;
        }
      } else if (arch === "NEBULA_CRADLE" && (nebulas.length > 0 || planets.length > 0)) {
        if (nebulas.length > 0 && rand < 0.78) {
          const nebula = nebulas[idx % nebulas.length]!;
          mapNebulaParticleCluster(p, nebula, entities.indexOf(nebula), idx, totalCount);
        } else if (planets.length > 0 && rand < 0.95) {
          const planet = planets[idx % planets.length]!;
          mapPlanetParticleCluster(p, planet, entities.indexOf(planet), idx, totalCount);
        } else {
          p.interstellarType = "star";
          const rRadius = 400 + Math.random() * (width * 4);
          const rTheta = Math.random() * Math.PI * 2;
          const rPhi = Math.acos(Math.random() * 2 - 1);
          p.targetX = width / 2 + rRadius * Math.sin(rPhi) * Math.cos(rTheta);
          p.targetY = height / 2 + rRadius * Math.sin(rPhi) * Math.sin(rTheta);
          p.targetZ = rRadius * Math.cos(rPhi);
          p.baseColor = "#ffffff";
          p.color = p.baseColor;
          p.isPlanetRing = false;
        }
      } else if (arch === "SPIRAL_GALAXY") {
        const cx = width / 2;
        const cy = height / 2;
        if (rand < 0.94) {
          p.interstellarType = "nebula";

          const arm = idx % 2;
          const baseAngle = arm * Math.PI;

          const maxRadius = Math.min(width, height) * 0.42;
          const minRadius = 15;
          const radFactor = Math.pow(Math.random(), 1.6);
          const r = minRadius + radFactor * (maxRadius - minRadius);

          const tightness = 0.016;
          const spiralAngle = baseAngle + r * tightness;

          const dispersion = (Math.random() - 0.5) * 0.45;
          const finalAngle = spiralAngle + dispersion;

          p.orbitRadius = r;
          p.orbitAngle = finalAngle;
          p.orbitSpeed = (0.009 + Math.random() * 0.006) * (180 / (r + 40));

          p.targetX = cx + Math.cos(finalAngle) * r;
          p.targetY = cy + Math.sin(finalAngle) * r;
          p.targetZ = (Math.random() - 0.5) * (45 * (1.0 - radFactor));

          const colorRand = Math.random();
          if (radFactor < 0.22) {
            p.baseColor = colorRand > 0.6 ? "#ffffff" : "#ffd778";
          } else {
            p.baseColor = colorRand > 0.65 ? "#00ffd2" : (colorRand > 0.35 ? "#ff3366" : "#da70d6");
          }
          p.color = p.baseColor;
          p.isPlanetRing = false;
        } else {
          p.interstellarType = "star";
          const rRadius = 400 + Math.random() * (width * 4);
          const rTheta = Math.random() * Math.PI * 2;
          const rPhi = Math.acos(Math.random() * 2 - 1);
          p.targetX = width / 2 + rRadius * Math.sin(rPhi) * Math.cos(rTheta);
          p.targetY = height / 2 + rRadius * Math.sin(rPhi) * Math.sin(rTheta);
          p.targetZ = rRadius * Math.cos(rPhi);
          p.baseColor = "#ffffff";
          p.color = p.baseColor;
          p.isPlanetRing = false;
        }
      } else {
        // Fallback for any other archetype or custom scene
        const primaryEntity = entities[0]!;
        if (primaryEntity.type === "blackhole" && rand < 0.85) {
          mapBlackholeParticleCluster(p, primaryEntity, 0, idx, totalCount);
        } else if (primaryEntity.type === "star" && rand < 0.85) {
          mapStarParticleCluster(p, primaryEntity, 0, idx, totalCount);
        } else if (primaryEntity.type === "planet" && rand < 0.85) {
          mapPlanetParticleCluster(p, primaryEntity, 0, idx, totalCount);
        } else if (primaryEntity.type === "nebula" && rand < 0.85) {
          mapNebulaParticleCluster(p, primaryEntity, 0, idx, totalCount);
        } else {
          p.interstellarType = "star";
          const rRadius = 400 + Math.random() * (width * 4);
          const rTheta = Math.random() * Math.PI * 2;
          const rPhi = Math.acos(Math.random() * 2 - 1);
          p.targetX = width / 2 + rRadius * Math.sin(rPhi) * Math.cos(rTheta);
          p.targetY = height / 2 + rRadius * Math.sin(rPhi) * Math.sin(rTheta);
          p.targetZ = rRadius * Math.cos(rPhi);
          p.baseColor = "#ffffff";
          p.color = p.baseColor;
          p.isPlanetRing = false;
        }
      }
    }
  });

  syncParticleColors(particlesRef.current);
}
