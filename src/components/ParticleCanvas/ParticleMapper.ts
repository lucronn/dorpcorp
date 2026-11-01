import React from "react";
import { initializeParticleVolume, updateParticleVolumeTarget } from "./ParticleVolume";
import { Particle, CelestialEntity } from "./types";
import { generateTargetsForStage } from "./ParticleUtils";

export function syncParticleColors(particlesList: Particle[], immediate: boolean = false): void {
  particlesList.forEach((p) => {
    let tr = 255;
    let tg = 255;
    let tb = 255;
    if (p.color && typeof p.color === "string" && p.color.startsWith("#") && p.color.length >= 7) {
      tr = parseInt(p.color.slice(1, 3), 16);
      tg = parseInt(p.color.slice(3, 5), 16);
      tb = parseInt(p.color.slice(5, 7), 16);
    } else if (p.color && typeof p.color === "string" && p.color.startsWith("rgb")) {
      const matches = p.color.match(/\d+/g);
      if (matches) {
        tr = parseInt(matches[0] || "255", 10);
        tg = parseInt(matches[1] || "255", 10);
        tb = parseInt(matches[2] || "255", 10);
      }
    }
    p.targetR = isNaN(tr) ? 255 : tr;
    p.targetG = isNaN(tg) ? 255 : tg;
    p.targetB = isNaN(tb) ? 255 : tb;

    if (
      immediate ||
      p.isTail ||
      p.isCosmicAmbient ||
      p.r === undefined ||
      p.g === undefined ||
      p.b === undefined
    ) {
      p.r = p.targetR;
      p.g = p.targetG;
      p.b = p.targetB;
    }
  });
}

export function mapParticlesToInterstellar(
  width: number,
  height: number,
  celestialEntitiesRef: React.MutableRefObject<CelestialEntity[]>,
  archetypeRef: React.MutableRefObject<string>,
  particlesRef: React.MutableRefObject<Particle[]>,
  tailStartIndexRef: React.MutableRefObject<number>,
  stage: number = 0,
  triggerBurst: boolean = false,
  skipTextUpdate: boolean = false
): void {
  const incomingEntities = celestialEntitiesRef.current.filter((e) => !e.isDestroyed && !e.isOutgoing);
  const entities = incomingEntities.length > 0
    ? incomingEntities
    : celestialEntitiesRef.current.filter((e) => !e.isDestroyed);
  if (entities.length === 0) return;
  const bh = entities.find((e) => e.type === "blackhole");
  const planets = entities.filter((e) => e.type === "planet");
  const nebulas = entities.filter((e) => e.type === "nebula");
  const arch = archetypeRef.current || "BLACKHOLE_CENTRIC";

  const nonAmbientParticles = particlesRef.current.filter((p) => !p.isCosmicAmbient && !p.isTail);
  const isMobile = width < 768;

  // 1. Preserve or initialize the dedicated 30% 3D Particle Typography pool
  const existingText = nonAmbientParticles.filter((p) => p.isProjectText);
  const textCoords =
    !skipTextUpdate || existingText.length === 0
      ? generateTargetsForStage(stage, width, height)
      : [];
  let textSlice: Particle[];
  let celestialSlice: Particle[];

  if (existingText.length > 0) {
    textSlice = existingText;
    celestialSlice = nonAmbientParticles.filter((p) => !p.isProjectText);
  } else {
    const textCount = textCoords.length > 0
      ? Math.min(nonAmbientParticles.length, Math.max(textCoords.length, Math.floor(nonAmbientParticles.length * 0.30)))
      : 0;
    textSlice = nonAmbientParticles.slice(0, textCount);
    celestialSlice = nonAmbientParticles.slice(textCount);
  }

  const cx = width / 2;
  const cy = height / 2;

  if (!skipTextUpdate && textCoords.length > 0) {
    textSlice.forEach((p, idx) => {
      const t = textCoords[idx % textCoords.length] || textCoords[0]!;
      p.targetX = t.x;
      p.targetY = t.y;
      p.targetZ = -40 + (Math.random() - 0.5) * 16;
      p.baseColor = t.color;
      p.color = t.color;
      p.isProjectText = true;
      p.interstellarType = undefined;

      if (triggerBurst) {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const swirl = 12.0;
        p.vx += (-dy / dist) * swirl + (Math.random() - 0.5) * 8.0;
        p.vy += (dx / dist) * swirl + (Math.random() - 0.5) * 8.0;
        p.vz += (Math.random() - 0.5) * 18.0;
      }
    });
  } else {
    textSlice.forEach((p) => {
      p.isProjectText = true;
      p.interstellarType = undefined;
    });
  }

  const numBackgroundGalaxies = 120;
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
    "#ffffff",
    "#ffd778",
    "#00e5ff",
    "#80d8ff",
    "#e0f7fa",
    "#b0bec5",
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

  const screenCx = width / 2;
  const screenCy = height / 2;

  celestialSlice.forEach((p, idx) => {
    // Preserve & amplify angular momentum when releasing from a previous scene into a new cosmic state
    if (skipTextUpdate || p.interstellarType !== undefined) {
      const prevHost = p.interstellarEntity;
      const refX = prevHost ? prevHost.x : screenCx;
      const refY = prevHost ? prevHost.y : screenCy;
      const dx = p.x - refX;
      const dy = p.y - refY;
      const dist = Math.hypot(dx, dy) || 1;
      const tangentX = -dy / dist;
      const tangentY = dx / dist;
      const radialX = dx / dist;
      const radialY = dy / dist;
      const orbitalRelease = 6.5 + (idx % 11) * 0.65;
      const radialDrift = 2.8 + ((idx * 7) % 9) * 0.45;
      p.vx = p.vx * 0.85 + tangentX * orbitalRelease + radialX * radialDrift;
      p.vy = p.vy * 0.85 + tangentY * orbitalRelease + radialY * radialDrift;
      p.vz = p.vz * 0.85 + Math.sin(idx * 0.37) * 14.0;
    }

    p.isProjectText = false;
    p.interstellarEntity = undefined;
    p.interstellarEntityIndex = undefined;
    p.isPlanetRing = false;
    p.isDustDisk = false;
    p.orbitRadius = undefined;
    p.orbitAngle = undefined;
    const rand = Math.random();

    if (arch === "BLACKHOLE_CENTRIC" && bh) {
      if (planets.length > 0 && rand < 0.22) {
        p.interstellarType = "planet";
        const planet = planets[idx % planets.length]!;
        p.interstellarEntityIndex = entities.indexOf(planet);
        p.interstellarEntity = planet;
        p.orbitRadius = planet.radius * (1.2 + Math.random() * 0.8);
        p.orbitAngle = Math.random() * Math.PI * 2;

        const r = p.orbitRadius || 30;
        const baseSpeed = 0.012 + Math.random() * 0.008;
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
        const isInnerAccretion = Math.random() < 0.72;
        if (isInnerAccretion) {
          p.orbitRadius = bh.radius * (1.15 + Math.pow(Math.random(), 1.5) * 4.35);
        } else {
          p.orbitRadius = bh.radius * (5.5 + Math.random() * 15.0);
        }
        p.orbitAngle = Math.random() * Math.PI * 2;

        const r = p.orbitRadius || 50;
        const baseSpeed = 0.016 + Math.random() * 0.008;
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

        const colorRand = Math.random();
        if (p.orbitRadius < bh.radius * 1.8) {
          // Ultra-hot relativistic core
          p.baseColor = colorRand > 0.4 ? "#ffffff" : (colorRand > 0.2 ? "#e0f7fa" : "#fff59d");
        } else if (p.orbitRadius < bh.radius * 3.6) {
          // Molten gold and amber plasma
          p.baseColor = colorRand > 0.4 ? "#ffb300" : (colorRand > 0.2 ? "#ff7043" : "#f4511e");
        } else if (p.orbitRadius < bh.radius * 6.0) {
          // Fiery crimson and ruby stardust
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

          const ringRand = Math.random();
          if (ringRand > 0.3) {
            const minR = planet.radius * 1.2;
            const maxR = planet.radius * 2.8;
            p.orbitRadius = minR + Math.random() * (maxR - minR);
            p.orbitAngle = Math.random() * Math.PI * 2;

            const r = p.orbitRadius || 30;
            const baseSpeed = 0.015 + Math.random() * 0.015;
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
            p.orbitRadius = planet.radius * (1.1 + Math.random() * 0.5);
            p.orbitAngle = Math.random() * Math.PI * 2;

            const r = p.orbitRadius || 30;
            const baseSpeed = 0.012 + Math.random() * 0.012;
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
          // High-energy particle bridge between twin planets
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
        } else if (nebulas.length > 0 && rand < 0.95) {
          p.interstellarType = "nebula";
          const nebula = nebulas[idx % nebulas.length] || nebulas[0]!;
          p.interstellarEntityIndex = entities.indexOf(nebula);
          p.interstellarEntity = nebula;

          const angle = Math.random() * Math.PI * 2;
          const rad = Math.pow(Math.random(), 1.5) * nebula.radius;
          p.orbitRadius = rad;
          p.orbitAngle = angle;
          p.orbitSpeed = 0.005 + Math.random() * 0.005;
          p.targetX = nebula.x + Math.cos(angle) * rad;
          p.targetY = nebula.y + Math.sin(angle) * rad;
          p.targetZ = (Math.random() - 0.5) * 50;

          p.baseColor = "rgba(120, 80, 220, 0.65)";
          p.color = p.baseColor;
          p.isPlanetRing = false;
        } else {
          p.interstellarType = "planet";
          const planetIdx = idx % 2;
          const planet = planets[planetIdx]!;
          p.interstellarEntityIndex = entities.indexOf(planet);
          p.interstellarEntity = planet;
          p.orbitRadius = planet.radius * (1.1 + Math.random() * 0.9);
          p.orbitAngle = Math.random() * Math.PI * 2;
          p.orbitSpeed = 0.012;
          p.targetX = planet.x + Math.cos(p.orbitAngle) * p.orbitRadius;
          p.targetY = planet.y + Math.sin(p.orbitAngle) * p.orbitRadius;
          p.targetZ = (Math.random() - 0.5) * 30;
          p.baseColor = planet.color;
          p.color = p.baseColor;
          p.isPlanetRing = false;
        }
      } else if (arch === "EXOPLANET_CLUSTER") {
        const star = entities.find((e) => e.type === "star");
        if (rand < 0.35 && star) {
          // Circumstellar zodiacal dust disk orbiting central host star
          p.interstellarType = "star";
          p.interstellarEntityIndex = entities.indexOf(star);
          p.interstellarEntity = star;
          const diskRadius = star.radius * (1.8 + Math.random() * 8.5);
          p.orbitRadius = diskRadius;
          p.orbitAngle = Math.random() * Math.PI * 2;
          // Keplerian orbital speed: Omega \propto r^(-3/2)
          p.orbitSpeed = 0.018 * Math.pow(star.radius * 2.5 / diskRadius, 1.5);
          p.targetX = star.x + Math.cos(p.orbitAngle) * diskRadius;
          p.targetY = star.y + Math.sin(p.orbitAngle) * (diskRadius * 0.55);
          p.targetZ = Math.sin(p.orbitAngle) * diskRadius * 0.25;
          p.baseColor = Math.random() > 0.4 ? "#ffddaa" : "#ffd778";
          p.color = p.baseColor;
          p.isPlanetRing = false;
        } else if (planets.length > 0) {
          // Circumplanetary envelopes & rings orbiting resonant exoplanets
          p.interstellarType = "planet";
          const planet = planets[idx % planets.length]!;
          p.interstellarEntityIndex = entities.indexOf(planet);
          p.interstellarEntity = planet;
          p.orbitRadius = planet.radius * (1.15 + Math.random() * 0.95);
          p.orbitAngle = Math.random() * Math.PI * 2;
          p.orbitSpeed = (0.012 + Math.random() * 0.008) * Math.pow(planet.radius * 1.5 / p.orbitRadius, 1.5);

          p.isPlanetRing = planet.hasRings && Math.random() > 0.4;
          const rx = p.orbitRadius;
          const ry = rx * (p.isPlanetRing ? 0.28 : 0.65);
          const ox = Math.cos(p.orbitAngle) * rx;
          const oy = Math.sin(p.orbitAngle) * ry;
          p.targetX = planet.x + ox;
          p.targetY = planet.y + oy;
          p.targetZ = Math.sin(p.orbitAngle) * rx * 0.35;
          p.baseColor = p.isPlanetRing ? (planet.ringColor || planet.color) : planet.color;
          p.color = p.baseColor;
        }
      } else if (arch === "NEBULA_CRADLE" && (nebulas.length > 0 || planets.length > 0)) {
        if (nebulas.length > 0 && rand < 0.65) {
          p.interstellarType = "nebula";
          const nebula = nebulas[idx % nebulas.length]!;
          p.interstellarEntityIndex = entities.indexOf(nebula);
          p.interstellarEntity = nebula;

          const angle = Math.random() * Math.PI * 2;
          const rad = Math.pow(Math.random(), 1.4) * nebula.radius;
          p.orbitRadius = rad;
          p.orbitAngle = angle;
          p.orbitSpeed = 0.004 + Math.random() * 0.004;
          p.targetX = nebula.x + Math.cos(angle) * rad;
          p.targetY = nebula.y + Math.sin(angle) * rad;
          p.targetZ = (Math.random() - 0.5) * 60;
          p.baseColor = nebula.color || "rgba(242, 95, 53, 0.7)";
          p.color = p.baseColor;
          p.isPlanetRing = false;
        } else if (planets.length > 0 && rand < 0.88) {
          p.interstellarType = "planet";
          const planet = planets[idx % planets.length]!;
          p.interstellarEntityIndex = entities.indexOf(planet);
          p.interstellarEntity = planet;
          p.orbitRadius = planet.radius * (1.1 + Math.random() * 0.8);
          p.orbitAngle = Math.random() * Math.PI * 2;
          p.orbitSpeed = 0.01 + Math.random() * 0.01;
          p.targetX = planet.x + Math.cos(p.orbitAngle) * p.orbitRadius;
          p.targetY = planet.y + Math.sin(p.orbitAngle) * p.orbitRadius;
          p.targetZ = (Math.random() - 0.5) * 30;
          p.baseColor = planet.color;
          p.color = p.baseColor;
          p.isPlanetRing = false;
        } else {
          p.interstellarType = "nebula";
          const nebula = nebulas[idx % nebulas.length] || (nebulas[0] as any);
          p.interstellarEntityIndex = entities.indexOf(nebula);
          p.interstellarEntity = nebula;
          const angle = Math.random() * Math.PI * 2;
          const rad = Math.pow(Math.random(), 1.2) * (nebula ? nebula.radius : 100);
          p.orbitRadius = rad;
          p.orbitAngle = angle;
          p.orbitSpeed = 0.005;
          p.targetX = (nebula ? nebula.x : width / 2) + Math.cos(angle) * rad;
          p.targetY = (nebula ? nebula.y : height / 2) + Math.sin(angle) * rad;
          p.targetZ = (Math.random() - 0.5) * 50;
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

        // 2 grand-design logarithmic spiral arms + 2 secondary spurs
        const arm = idx % 4;
        const baseAngle = (arm * Math.PI) / 2;

        const maxRadius = Math.min(width, height) * 0.46;
        const minRadius = 18;
        // Central core concentration + long tapering spiral arms
        const radFactor = Math.pow(Math.random(), 1.7);
        const r = minRadius + radFactor * (maxRadius - minRadius);

        // Density wave pitch tightness
        const tightness = 0.014;
        const spiralAngle = baseAngle + r * tightness;
        const dispersion = (Math.random() - 0.5) * (0.32 + radFactor * 0.25);
        const finalAngle = spiralAngle + dispersion;

        p.orbitRadius = r;
        p.orbitAngle = finalAngle;
        // NFW dark matter halo + Freeman exponential disk flat rotation curve:
        // v_c(r) = v0 * r / sqrt(r^2 + rc^2) => Omega(r) = v0 / sqrt(r^2 + rc^2)
        const coreRadius = 55.0;
        const v0 = 1.15;
        p.orbitSpeed = (v0 / Math.sqrt(r * r + coreRadius * coreRadius)) * (0.85 + Math.random() * 0.3);

        // 3D disk thickness (thicker in bulge, razor-thin in outer disk)
        const diskThickness = (1.0 - radFactor * 0.75) * 45;
        p.galaxyZOffset = (Math.random() - 0.5) * diskThickness;

        // Tilted inclination for 3D cinematic majesty
        const inc = Math.PI / 4.2;
        const cosInc = Math.cos(inc);
        const sinInc = Math.sin(inc);
        const ox = Math.cos(finalAngle) * r;
        const oy = Math.sin(finalAngle) * r * cosInc;
        const oz = Math.sin(finalAngle) * r * sinInc + p.galaxyZOffset;

        p.targetX = cx + ox;
        p.targetY = cy + oy;
        p.targetZ = oz;

        // Astrophysics colors:
        // Bulge: old golden K/M giants & incandescent white
        // Arms: young O/B blue-cyan starburst clusters & pink/magenta HII emission regions
        const colorRand = Math.random();
        if (radFactor < 0.2) {
          p.baseColor = colorRand > 0.5 ? "#ffffff" : (colorRand > 0.25 ? "#ffe082" : "#ffb74d");
        } else if (colorRand < 0.12) {
          p.baseColor = "#ff4081"; // HII emission nebula
        } else if (colorRand < 0.35) {
          p.baseColor = "#ffffff"; // Bright OB star clusters
        } else if (arm % 2 === 0) {
          p.baseColor = "#80d8ff"; // Electric cyan arm
        } else {
          p.baseColor = "#4deeea"; // Neon blue arm
        }
        p.color = p.baseColor;
        p.isPlanetRing = false;
      } else if (arch === "STELLAR_PULSAR") {
        const cx = width / 2;
        const cy = height / 2;
        const entity = entities[0]!;
        p.interstellarEntityIndex = 0;
        p.interstellarEntity = entity;

        const pulsarTypeRand = Math.random();
        if (pulsarTypeRand < 0.45) {
          // Relativistic equatorial synchrotron radiation torus
          p.interstellarType = "pulsar_ring";
          const ringIndex = idx % 5;
          const rBase = entity.radius * (1.6 + ringIndex * 1.8 + Math.random() * 0.8);
          p.orbitRadius = rBase;
          p.orbitAngle = Math.random() * Math.PI * 2;
          p.orbitSpeed = (0.022 + Math.random() * 0.015) * Math.pow((entity.radius * 2) / rBase, 0.8);

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
          // High-energy collimated relativistic polar jet particle beam
          p.interstellarType = "pulsar_jet";
          const isNorth = Math.random() > 0.5;
          p.galaxyZOffset = isNorth ? 1 : -1;
          const jetDist = entity.radius * (1.2 + Math.pow(Math.random(), 1.5) * 8.5);
          p.orbitRadius = jetDist;
          p.orbitAngle = Math.random() * Math.PI * 2;
          p.orbitSpeed = 0.035 + Math.random() * 0.025;

          const helixR = 8 + (jetDist / (entity.radius * 9)) * 18;
          const hx = Math.cos(p.orbitAngle * 4) * helixR;
          const hz = Math.sin(p.orbitAngle * 4) * helixR;

          p.targetX = cx + hx;
          p.targetY = cy + (isNorth ? -jetDist : jetDist);
          p.targetZ = hz;

          p.baseColor = Math.random() > 0.4 ? "#ffffff" : (isNorth ? "#c084fc" : "#00ffd2");
          p.color = p.baseColor;
        } else {
          // Magnetic dipole field loop filaments
          p.interstellarType = "pulsar_ring";
          const loopRadius = entity.radius * (1.5 + Math.random() * 4.5);
          p.orbitRadius = loopRadius;
          p.orbitAngle = Math.random() * Math.PI * 2;
          p.orbitSpeed = 0.012 + Math.random() * 0.008;

          const ox = Math.cos(p.orbitAngle) * loopRadius * 0.7;
          const oy = Math.sin(p.orbitAngle) * loopRadius * 1.4;
          const oz = (Math.random() - 0.5) * 40;

          p.targetX = cx + ox;
          p.targetY = cy + oy;
          p.targetZ = oz;

          p.baseColor = Math.random() > 0.5 ? "#c084fc" : "#80d8ff";
          p.color = p.baseColor;
        }
        p.isPlanetRing = false;
      } else if (arch === "KILONOVA_MERGER") {
        const cx = width / 2;
        const cy = height / 2;
        const stars = entities.filter((e) => e.type === "star");
        const ejectaNebula = entities.find((e) => e.type === "nebula");

        const kilonovaRand = Math.random();
        if (kilonovaRand < 0.42 && stars.length >= 2) {
          // Relativistic binary inspiral tidal arms & gravitational-wave chirp stream
          const starIdx = idx % 2;
          const hostStar = stars[starIdx]!;
          p.interstellarType = "star";
          p.interstellarEntityIndex = entities.indexOf(hostStar);
          p.interstellarEntity = hostStar;

          const r = hostStar.radius * (1.2 + Math.pow(Math.random(), 1.5) * 4.5);
          p.orbitRadius = r;
          p.orbitAngle = Math.random() * Math.PI * 2;
          p.orbitSpeed = 0.025 * Math.pow(hostStar.radius * 2.0 / r, 1.5);

          const ox = Math.cos(p.orbitAngle) * r;
          const oy = Math.sin(p.orbitAngle) * r * 0.75;
          const oz = Math.sin(p.orbitAngle * 2) * r * 0.45;

          p.targetX = hostStar.x + ox;
          p.targetY = hostStar.y + oy;
          p.targetZ = oz;

          // Nuclear surface temperature & relativistic Doppler colors
          p.baseColor = starIdx === 0
            ? (Math.random() > 0.5 ? "#ffffff" : "#38bdf8")
            : (Math.random() > 0.5 ? "#fdf4ff" : "#c084fc");
          p.color = p.baseColor;
          p.isPlanetRing = false;
        } else if (kilonovaRand < 0.78) {
          // Radioactive r-process nucleosynthesis ejecta cloud (gold, platinum, neodymium synthesis)
          p.interstellarType = "nebula";
          p.interstellarEntityIndex = ejectaNebula ? entities.indexOf(ejectaNebula) : 0;
          p.interstellarEntity = ejectaNebula || entities[0]!;

          const maxR = ejectaNebula ? ejectaNebula.radius : 300;
          const r = Math.pow(Math.random(), 1.3) * maxR;
          const angle = Math.random() * Math.PI * 2;
          p.orbitRadius = r;
          p.orbitAngle = angle;
          p.orbitSpeed = 0.006 * Math.pow(150 / (r + 50), 0.5);

          p.targetX = cx + Math.cos(angle) * r;
          p.targetY = cy + Math.sin(angle) * (r * 0.85);
          p.targetZ = (Math.random() - 0.5) * (r * 0.5);

          // Dual-component kilonova spectrum: early hot blue + lanthanide radioactive gold
          const isLanthanideRich = Math.random() > 0.35;
          p.baseColor = isLanthanideRich
            ? (Math.random() > 0.5 ? "#fbbf24" : "#f59e0b") // Golden-amber r-process optical/IR plateau
            : (Math.random() > 0.5 ? "#38bdf8" : "#e0e7ff"); // High-temperature lanthanide-poor blue ejecta
          p.color = p.baseColor;
          p.isPlanetRing = false;
        } else {
          // Collimated relativistic polar jet & cocoon breakout (Gamma-Ray Burst prompt emission)
          p.interstellarType = "pulsar_jet";
          const isNorth = Math.random() > 0.5;
          p.galaxyZOffset = isNorth ? 1 : -1;
          const jetDist = 30 + Math.pow(Math.random(), 1.8) * 350;
          p.orbitRadius = jetDist;
          p.orbitAngle = Math.random() * Math.PI * 2;
          p.orbitSpeed = 0.045;

          const beamRadius = 6 + (jetDist / 350) * 22;
          const hx = Math.cos(p.orbitAngle * 3) * beamRadius;
          const hz = Math.sin(p.orbitAngle * 3) * beamRadius;

          p.targetX = cx + hx;
          p.targetY = cy + (isNorth ? -jetDist : jetDist);
          p.targetZ = hz;

          p.baseColor = Math.random() > 0.3 ? "#ffffff" : "#67e8f9";
          p.color = p.baseColor;
          p.isPlanetRing = false;
        }
      } else if (arch === "RELATIVISTIC_BLAZAR") {
        const cx = width / 2;
        const cy = height / 2;
        const bh = entities.find((e) => e.type === "blackhole") || entities[0]!;
        const knots = entities.filter((e) => e.type === "star");

        const blazarRand = Math.random();
        if (blazarRand < 0.45) {
          // Supermassive Kerr accretion disk with extreme relativistic Doppler beaming
          p.interstellarType = "blackhole";
          p.interstellarEntityIndex = entities.indexOf(bh);
          p.interstellarEntity = bh;

          const isInnerDisk = Math.random() < 0.65;
          p.orbitRadius = isInnerDisk
            ? bh.radius * (1.15 + Math.pow(Math.random(), 1.5) * 3.8)
            : bh.radius * (5.0 + Math.random() * 12.0);

          p.orbitAngle = Math.random() * Math.PI * 2;
          p.orbitSpeed = (0.018 + Math.random() * 0.01) * Math.pow((bh.radius * 2.2) / p.orbitRadius, 1.25);

          const rx = p.orbitRadius;
          const ry = rx * 0.38; // Inclined accretion disk
          p.targetX = bh.x + Math.cos(p.orbitAngle) * rx;
          p.targetY = bh.y + Math.sin(p.orbitAngle) * ry;
          p.targetZ = Math.sin(p.orbitAngle) * rx * 0.55;

          const colRand = Math.random();
          if (p.orbitRadius < bh.radius * 2.2) {
            p.baseColor = colRand > 0.4 ? "#ffffff" : "#fef08a";
          } else if (p.orbitRadius < bh.radius * 4.5) {
            p.baseColor = colRand > 0.4 ? "#f97316" : "#ea580c";
          } else {
            p.baseColor = "#9a3412";
          }
          p.color = p.baseColor;
          p.isPlanetRing = false;
        } else if (blazarRand < 0.82) {
          // Superluminal helical polar jet pointing near line of sight (theta ~ 14 deg, beta_app ~ 6c)
          p.interstellarType = "pulsar_jet";
          const knot = knots.length > 0 ? knots[idx % knots.length] : null;
          p.interstellarEntityIndex = knot ? entities.indexOf(knot) : entities.indexOf(bh);
          p.interstellarEntity = knot || bh;

          const jetProgress = Math.pow(Math.random(), 1.2);
          const jetLength = isMobile ? 320 : 540;
          const distAlongJet = jetProgress * jetLength;

          // 14-degree inclination projection: dx/dy = tan(14 deg) ~ 0.25
          const jetAngleRad = -Math.PI / 2 + 0.25; // Pointing upwards toward top-right
          const jetDirX = Math.cos(jetAngleRad);
          const jetDirY = Math.sin(jetAngleRad);

          // Helical magnetic field wrapping around the jet spine
          p.orbitAngle = (p.orbitAngle || Math.random() * Math.PI * 2) + 0.04;
          const helixRadius = 8 + jetProgress * 32;
          const perpX = -jetDirY * Math.cos(p.orbitAngle) * helixRadius;
          const perpY = jetDirX * Math.cos(p.orbitAngle) * helixRadius;
          const perpZ = Math.sin(p.orbitAngle) * helixRadius;

          p.targetX = cx + jetDirX * distAlongJet + perpX;
          p.targetY = cy + jetDirY * distAlongJet + perpY;
          p.targetZ = distAlongJet * 0.4 + perpZ; // Approaching observer along line of sight

          p.orbitSpeed = 0.045;
          p.baseColor = jetProgress < 0.35
            ? (Math.random() > 0.5 ? "#ffffff" : "#38bdf8") // Ultra-relativistic core & HST-1 knot
            : (Math.random() > 0.5 ? "#0284c7" : "#0369a1"); // Synchrotron cooling downstream
          p.color = p.baseColor;
          p.isPlanetRing = false;
        } else {
          // Radio lobe cocoon & polarized diffuse synchrotron plasma
          p.interstellarType = "nebula";
          p.interstellarEntityIndex = 0;
          p.interstellarEntity = bh;

          const cocoonRad = bh.radius * (3.5 + Math.random() * 6.5);
          const ang = Math.random() * Math.PI * 2;
          p.orbitRadius = cocoonRad;
          p.orbitAngle = ang;
          p.orbitSpeed = 0.005;

          p.targetX = cx + Math.cos(ang) * cocoonRad;
          p.targetY = cy + Math.sin(ang) * (cocoonRad * 0.65);
          p.targetZ = (Math.random() - 0.5) * 70;

          p.baseColor = Math.random() > 0.5 ? "rgba(56, 189, 248, 0.45)" : "rgba(249, 115, 22, 0.4)";
          p.color = p.baseColor;
          p.isPlanetRing = false;
        }
      } else if (entities.length > 0) {
        // Generalized dynamic entity mapping for Gemini AI custom generated systems
        const entity = entities[idx % entities.length]!;
        p.interstellarEntityIndex = entities.indexOf(entity);
        p.interstellarEntity = entity;

        if (entity.type === "blackhole") {
          p.interstellarType = "blackhole";
          const isInnerAccretion = Math.random() < 0.72;
          if (isInnerAccretion) {
            p.orbitRadius = entity.radius * (1.15 + Math.pow(Math.random(), 1.5) * 4.35);
          } else {
            p.orbitRadius = entity.radius * (5.5 + Math.random() * 14.0);
          }
          p.orbitAngle = Math.random() * Math.PI * 2;
          p.orbitSpeed = (0.014 + Math.random() * 0.008) * Math.pow((entity.radius * 2.5) / p.orbitRadius, 1.25);
          p.targetX = entity.x + Math.cos(p.orbitAngle) * p.orbitRadius;
          p.targetY = entity.y + Math.sin(p.orbitAngle) * p.orbitRadius * 0.36;
          p.targetZ = Math.sin(p.orbitAngle) * p.orbitRadius * 0.65;
          const colorRand = Math.random();
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
          p.isPlanetRing = entity.hasRings && Math.random() > 0.4;
          const rMult = p.isPlanetRing ? (1.3 + Math.random() * 1.5) : (1.1 + Math.random() * 0.5);
          p.orbitRadius = entity.radius * rMult;
          p.orbitAngle = Math.random() * Math.PI * 2;
          p.orbitSpeed = 0.01 + Math.random() * 0.01;
          const rx = p.orbitRadius;
          const ry = rx * (p.isPlanetRing ? 0.25 : 0.65);
          p.targetX = entity.x + Math.cos(p.orbitAngle) * rx;
          p.targetY = entity.y + Math.sin(p.orbitAngle) * ry;
          p.targetZ = Math.sin(p.orbitAngle) * rx * 0.35;
          p.baseColor = p.isPlanetRing ? (entity.ringColor || entity.color) : entity.color;
          p.color = p.baseColor;
        } else if (entity.type === "nebula") {
          p.interstellarType = "nebula";
          const angle = Math.random() * Math.PI * 2;
          const rad = Math.pow(Math.random(), 1.4) * entity.radius;
          p.orbitRadius = rad;
          p.orbitAngle = angle;
          p.orbitSpeed = 0.005 + Math.random() * 0.005;
          p.targetX = entity.x + Math.cos(angle) * rad;
          p.targetY = entity.y + Math.sin(angle) * rad;
          p.targetZ = (Math.random() - 0.5) * 50;
          p.baseColor = entity.color || "#4deeea";
          p.color = p.baseColor;
          p.isPlanetRing = false;
        } else {
          p.interstellarType = entity.type === "galaxy" ? "galaxy" : "star";
          const rRadius = entity.radius * (1.2 + Math.random() * 2.5);
          const rAngle = Math.random() * Math.PI * 2;
          p.orbitRadius = rRadius;
          p.orbitAngle = rAngle;
          p.targetX = entity.x + Math.cos(rAngle) * rRadius;
          p.targetY = entity.y + Math.sin(rAngle) * rRadius;
          p.targetZ = (Math.random() - 0.5) * 40;
          p.baseColor = entity.color || "#ffffff";
          p.color = p.baseColor;
          p.isPlanetRing = false;
        }
      } else {
        p.interstellarType = "planet";
        const rRadius = 80 + Math.random() * 150;
        const rAngle = Math.random() * Math.PI * 2;
        p.targetX = width / 2 + Math.cos(rAngle) * rRadius;
        p.targetY = height / 2 + Math.sin(rAngle) * rRadius;
        p.targetZ = (Math.random() - 0.5) * 30;
        p.baseColor = "#4deeea";
        p.color = p.baseColor;
        p.isPlanetRing = false;
      }
    p.isDustDisk = arch === "EXOPLANET_CLUSTER" && p.interstellarType === "star";
    initializeParticleVolume(p, idx);
    updateParticleVolumeTarget(p, p.interstellarEntity);
  });

  particlesRef.current.sort((a, b) => {
    if (a.isTail && !b.isTail) return 1;
    if (!a.isTail && b.isTail) return -1;
    if (a.isCosmicAmbient && !b.isCosmicAmbient) return -1;
    if (!a.isCosmicAmbient && b.isCosmicAmbient) return 1;
    return 0;
  });
  syncParticleColors(particlesRef.current);
  tailStartIndexRef.current = particlesRef.current.findIndex((p) => p.isTail);
}

export function updateTypographyStage(
  targetStage: number,
  triggerBurst: boolean,
  particlesRef: React.MutableRefObject<Particle[]>,
  width: number,
  height: number
): void {
  const coords = generateTargetsForStage(targetStage, width, height);
  if (!coords || coords.length === 0) return;

  const nonAmbient = particlesRef.current.filter((p) => !p.isCosmicAmbient && !p.isTail);
  const textParticles = nonAmbient.filter((p) => p.isProjectText);

  // If no text particles were marked yet, reserve the first 30%
  const activeTextParticles = textParticles.length > 0
    ? textParticles
    : (() => {
        const count = Math.min(nonAmbient.length, Math.max(coords.length, Math.floor(nonAmbient.length * 0.30)));
        const slice: Particle[] = [];
        for (let i = 0; i < count; i++) {
          nonAmbient[i]!.isProjectText = true;
          nonAmbient[i]!.interstellarType = undefined;
          slice.push(nonAmbient[i]!);
        }
        return slice;
      })();

  const cx = width / 2;
  const cy = height / 2;

  activeTextParticles.forEach((p, idx) => {
    const t = coords[idx % coords.length] || coords[0]!;
    p.targetX = t.x;
    p.targetY = t.y;
    p.targetZ = -40 + (Math.random() - 0.5) * 16;
    p.baseColor = t.color;
    p.color = t.color;
    p.isProjectText = true;
    p.interstellarType = undefined;

    if (triggerBurst) {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const swirl = 12.0 + (idx % 9) * 0.85;
      p.vx = p.vx * 0.72 + (-dy / dist) * swirl + (Math.random() - 0.5) * 6.0;
      p.vy = p.vy * 0.72 + (dx / dist) * swirl + (Math.random() - 0.5) * 6.0;
      p.vz = p.vz * 0.65 + (Math.random() - 0.5) * 14.0;
    }
  });

  syncParticleColors(activeTextParticles);
}

export function mapParticlesToStage(
  targetStage: number,
  triggerBurst: boolean,
  stageTargetsRef: React.MutableRefObject<{ [key: number]: { x: number; y: number; color: string }[] }>,
  particlesRef: React.MutableRefObject<Particle[]>,
  tailStartIndexRef: React.MutableRefObject<number>
): void {
  const ww = window.innerWidth;
  const wh = window.innerHeight;

  const coords = generateTargetsForStage(targetStage, ww, wh);
  if (!coords || coords.length === 0) return;

  stageTargetsRef.current[targetStage] = coords;

  if (particlesRef.current.length > 0) {
    const ambientCount = particlesRef.current.filter((p) => p.isCosmicAmbient).length;
    const totalTargetable = particlesRef.current.length - ambientCount;
    let targetIndex = 0;

    particlesRef.current.forEach((p) => {
      if (p.isCosmicAmbient) {
        return;
      }

      const mappedIndex =
        coords.length > totalTargetable
          ? Math.floor((targetIndex / totalTargetable) * coords.length)
          : targetIndex % coords.length;

      const safeIndex = Math.min(Math.max(0, Math.floor(mappedIndex)), coords.length - 1);
      const t = coords[safeIndex] || coords[0]!;
      targetIndex++;

      p.targetX = t.x;
      p.targetY = t.y;
      p.targetZ = 0;
      p.baseColor = t.color;
      p.color = t.color;
      p.interstellarType = undefined;

      if (triggerBurst) {
        const cx = ww / 2;
        const cy = wh / 2;
        const dx = p.x - cx;
        const dy = p.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        const swirlMagnitude = 18.0;
        const tx = (-dy / dist) * swirlMagnitude;
        const ty = (dx / dist) * swirlMagnitude;

        const radialMagnitude = (Math.random() - 0.25) * 24.0;
        const rx = (dx / dist) * radialMagnitude;
        const ry = (dy / dist) * radialMagnitude;

        p.vx = p.vx * 0.5 + tx + rx + (Math.random() - 0.5) * 8;
        p.vy = p.vy * 0.5 + ty + ry + (Math.random() - 0.5) * 8;
        p.vz = p.vz * 0.5 + (Math.random() - 0.5) * 32;
      }
    });

    particlesRef.current.sort((a, b) => {
      if (a.isTail && !b.isTail) return 1;
      if (!a.isTail && b.isTail) return -1;
      if (a.isCosmicAmbient && !b.isCosmicAmbient) return -1;
      if (!a.isCosmicAmbient && b.isCosmicAmbient) return 1;
      return 0;
    });
    syncParticleColors(particlesRef.current);
    tailStartIndexRef.current = particlesRef.current.findIndex((p) => p.isTail);
  }
}

/**
 * Disperses current typography particles into the cosmic slipstream along a drift vector
 * when the observer floats away into deep space, preserving their dedicated typography pool
 * membership so they cleanly coalesce into the next milestone text upon arrival.
 */
export function disperseTypographyParticles(
  particlesRef: React.MutableRefObject<Particle[]>,
  driftDir: { x: number; y: number; z: number }
): void {
  const particles = particlesRef.current;
  particles.forEach((p, idx) => {
    if (p.isProjectText) {
      // Staggered wave dispersion along the drift slipstream vector with gentle vorticity
      const phase = (idx % 37) / 37;
      const waveBoost = 0.65 + phase * 0.7;
      const swirlAngle = idx * 0.23;
      p.vx += (-driftDir.x * 11.5 + Math.cos(swirlAngle) * 4.5) * waveBoost;
      p.vy += (-driftDir.y * 11.5 + Math.sin(swirlAngle) * 4.5) * waveBoost;
      p.vz += (18.0 + phase * 16.0) * waveBoost;

      // Drift target coordinates into deep space along a broad organic stream
      p.targetX += -driftDir.x * (520 + phase * 380) + Math.cos(swirlAngle) * 420;
      p.targetY += -driftDir.y * (440 + phase * 320) + Math.sin(swirlAngle) * 360;
      p.targetZ = 680 + phase * 640;

      // Keep p.isProjectText = true so the dedicated 30% typography pool is never orphaned
      p.isProjectText = true;
      p.interstellarType = undefined;
    }
  });
}
