import React from "react";
import { Particle, CelestialEntity } from "./types";
import { generateTargetsForStage } from "./ParticleUtils";

export function syncParticleColors(particlesList: Particle[]): void {
  particlesList.forEach((p) => {
    if (p.color && typeof p.color === "string" && p.color.startsWith("#") && p.color.length >= 7) {
      p.r = parseInt(p.color.slice(1, 3), 16);
      p.g = parseInt(p.color.slice(3, 5), 16);
      p.b = parseInt(p.color.slice(5, 7), 16);
    } else if (p.color && typeof p.color === "string" && p.color.startsWith("rgb")) {
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

  const nonAmbientParticles = particlesRef.current.filter((p) => !p.isCosmicAmbient);

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

  nonAmbientParticles.forEach((p, idx) => {
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
      } else if (arch === "EXOPLANET_CLUSTER" && planets.length >= 2) {
        if (rand < 0.65) {
          p.interstellarType = "planet";
          const planet = planets[idx % planets.length]!;
          p.interstellarEntityIndex = entities.indexOf(planet);
          p.interstellarEntity = planet;
          p.orbitRadius = planet.radius * (1.1 + Math.random() * 0.8);
          p.orbitAngle = Math.random() * Math.PI * 2;
          p.orbitSpeed = 0.01 + Math.random() * 0.01;

          p.isPlanetRing = Math.random() > 0.5;
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
          // Co-orbital gravitational connector bridges
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
          p.interstellarType = "planet";
          const planet = planets[idx % planets.length]!;
          p.interstellarEntityIndex = entities.indexOf(planet);
          p.interstellarEntity = planet;
          p.orbitRadius = planet.radius * (1.1 + Math.random() * 0.9);
          p.orbitAngle = Math.random() * Math.PI * 2;
          p.orbitSpeed = 0.01;
          p.targetX = planet.x + Math.cos(p.orbitAngle) * p.orbitRadius;
          p.targetY = planet.y + Math.sin(p.orbitAngle) * p.orbitRadius;
          p.targetZ = (Math.random() - 0.5) * 30;
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
        // Flat rotation curve: v(r) ~ const with soft core
        p.orbitSpeed = (0.010 + Math.random() * 0.005) * Math.pow(100 / (r + 40), 0.45);

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
          p.interstellarType = "planet";
          const rRadius = entity.radius * (1.2 + Math.random() * 2.5);
          const rAngle = Math.random() * Math.PI * 2;
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
  });

  particlesRef.current.sort((a, b) => {
    if (a.isTail && !b.isTail) return 1;
    if (!a.isTail && b.isTail) return -1;
    if (a.isCosmicAmbient && !b.isCosmicAmbient) return -1;
    if (!a.isCosmicAmbient && b.isCosmicAmbient) return 1;
    return (a.color || "").localeCompare(b.color || "");
  });
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

        const swirlMagnitude = 32.0;
        const tx = (-dy / dist) * swirlMagnitude;
        const ty = (dx / dist) * swirlMagnitude;

        const radialMagnitude = (Math.random() - 0.25) * 40.0;
        const rx = (dx / dist) * radialMagnitude;
        const ry = (dy / dist) * radialMagnitude;

        p.vx = tx + rx + (Math.random() - 0.5) * 12;
        p.vy = ty + ry + (Math.random() - 0.5) * 12;
        p.vz = (Math.random() - 0.5) * 55;
      }
    });

    particlesRef.current.sort((a, b) => {
      if (a.isTail && !b.isTail) return 1;
      if (!a.isTail && b.isTail) return -1;
      if (a.isCosmicAmbient && !b.isCosmicAmbient) return -1;
      if (!a.isCosmicAmbient && b.isCosmicAmbient) return 1;
      return (a.color || "").localeCompare(b.color || "");
    });
    syncParticleColors(particlesRef.current);
    tailStartIndexRef.current = particlesRef.current.findIndex((p) => p.isTail);
  }
}
