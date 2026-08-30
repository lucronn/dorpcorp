import * as BABYLON from "@babylonjs/core";
import { Particle } from "../../types";
import { CelestialEntity, ParticleFilters } from "./types";
import { computeCurlNoise } from "./PhysicsUtils";

export interface SimulationContext {
  currentW: number;
  currentH: number;
  time: number;
  globalTimeMultiplier: number;
  musicAmpVal: number;
  musicBands: { bass: number; mid: number; treble: number };
  musicSpeedFactor: number;
  activeBlackholes: CelestialEntity[];
  activeCollidables: CelestialEntity[];
  activeSupernova: { x: number; y: number; time: number; exploded?: boolean; isCalmShift?: boolean } | null;
  snElapsed: number;
  scrollVelocity: number;
  ambientParticleSpeed: number;
  objectParticleSpeed: number;
  textParticleSpeed: number;
  particleFilters: ParticleFilters;
  globalAlpha: number;
  isTypographyMode: boolean;
  isInterstellar: boolean;
  vortexMultiplier: number;
  attractionMultiplier: number;
  mousePos: { x: number; y: number };
  celestialEntities: CelestialEntity[];
  spawnTailParticle: (x: number, y: number, z: number, vx: number, vy: number, color: string, decayRate?: number) => void;
  screensaverOpacity: number;
  isTransitActive: boolean;
  transitProgress: number;
  transitCx: number;
  transitCy: number;
  activeRipples: Array<{ x: number; y: number; life: number; maxDist: number; bandWidth: number; minDistSq: number; maxDistBoundSq: number }>;
  audio: any;
}

export function simulateParticles(
  particles: Particle[],
  positions: Float32Array,
  colors: Float32Array,
  extras: Float32Array,
  ctx: SimulationContext
) {
  const {
    currentW,
    currentH,
    time,
    globalTimeMultiplier,
    musicAmpVal,
    musicBands,
    musicSpeedFactor,
    activeBlackholes,
    activeCollidables,
    activeSupernova,
    snElapsed,
    scrollVelocity,
    ambientParticleSpeed,
    objectParticleSpeed,
    textParticleSpeed,
    particleFilters,
    globalAlpha,
    isTypographyMode,
    isInterstellar,
    vortexMultiplier,
    attractionMultiplier,
    mousePos,
    celestialEntities,
    spawnTailParticle,
    screensaverOpacity,
    isTransitActive,
    transitProgress,
    transitCx,
    transitCy,
    activeRipples,
    audio,
  } = ctx;

  const floatScaleX = isTypographyMode ? 0 : (1 - attractionMultiplier) * 0.5;
  const floatScaleY = isTypographyMode ? 0 : (1 - attractionMultiplier) * 0.5;
  const floatSpeed = 0.012;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (!p) continue;

    if (p.isTail) {
      if (p.life && p.life > 0) {
        let isTailSwallowed = false;
        // Gravitational pull of stardust/debris near black holes for orbital decay
        activeBlackholes.forEach((entity) => {
          const bdx = entity.x - p.x;
          const bdy = entity.y - p.y;
          const bdist = Math.sqrt(bdx * bdx + bdy * bdy) || 1;
          const shadowRadius = entity.radius * 2.598;
          if (bdist <= shadowRadius) {
            isTailSwallowed = true;
          } else {
            const gravityRadiusMult = 4.5;
            if (bdist < entity.radius * gravityRadiusMult) {
              const pullFactor = 1.0 - bdist / (entity.radius * gravityRadiusMult);
              const pullStrength = 3.5 * pullFactor;
              p.vx += (bdx / bdist) * pullStrength;
              p.vy += (bdy / bdist) * pullStrength;
            }
          }
        });

        if (isTailSwallowed) {
          p.life = 0;
          positions[i * 3] = -99999;
          positions[i * 3 + 1] = -99999;
          positions[i * 3 + 2] = 0;
          colors[i * 4] = 0;
          colors[i * 4 + 1] = 0;
          colors[i * 4 + 2] = 0;
          colors[i * 4 + 3] = 0;
          extras[i] = 2.0;
          continue;
        }

        const objSpeedMult = (objectParticleSpeed ?? 0.15) / 0.15;
        p.x += p.vx * objSpeedMult;
        p.y += p.vy * objSpeedMult;
        p.z += p.vz * objSpeedMult;

        p.vx *= 0.94;
        p.vy *= 0.94;
        p.vz *= 0.94;

        p.life -= Math.max(0.02, (p.decay || 0.06) * Math.max(0.3, objSpeedMult));
        if (p.life < 0) p.life = 0;

        positions[i * 3] = p.x - currentW / 2;
        positions[i * 3 + 1] = -(p.y - currentH / 2);
        positions[i * 3 + 2] = p.z;

        const r = p.r ?? 255;
        const g = p.g ?? 255;
        const b = p.b ?? 255;

        const tailPulse = 1.0 + musicAmpVal * 0.8;
        const tailOpacity = particleFilters.tails ? p.life * 0.45 : 0;
        colors[i * 4] = Math.min(1.0, Math.max(0.0, (r / 255) * globalAlpha * tailOpacity * tailPulse));
        colors[i * 4 + 1] = Math.min(1.0, Math.max(0.0, (g / 255) * globalAlpha * tailOpacity * tailPulse));
        colors[i * 4 + 2] = Math.min(1.0, Math.max(0.0, (b / 255) * globalAlpha * tailOpacity * tailPulse));
        colors[i * 4 + 3] = globalAlpha * tailOpacity;
      } else {
        positions[i * 3] = -99999;
        positions[i * 3 + 1] = -99999;
        positions[i * 3 + 2] = 0;
        colors[i * 4] = 0;
        colors[i * 4 + 1] = 0;
        colors[i * 4 + 2] = 0;
        colors[i * 4 + 3] = 0;
      }
      extras[i] = 2.0;
      continue;
    }

    if (activeSupernova) {
      const cx = activeSupernova.x;
      const cy = activeSupernova.y;
      const dx = p.x - cx;
      const dy = p.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      if (snElapsed < 200) {
        // Implosion phase: vortex gravitational pull into singularity
        if (dist < 600) {
          const suck = (1.0 - dist / 600) * 3.5;
          const vortexAngle = 0.5;
          const tx = -dy / dist;
          const ty = dx / dist;
          p.vx -= (dx / dist) * suck + tx * suck * vortexAngle;
          p.vy -= (dy / dist) * suck + ty * suck * vortexAngle;
        }
      } else if (snElapsed >= 200 && snElapsed < 2800) {
        // Relativistic expansion phase: high-velocity shockwave wavefront
        const waveRadius = (snElapsed - 200) * 1.1;
        const waveBand = 160;
        const distDiff = Math.abs(dist - waveRadius);
        if (distDiff < waveBand) {
          const push = (1.0 - distDiff / waveBand) * 12.0;
          p.vx += (dx / dist) * push;
          p.vy += (dy / dist) * push;
          // Add outward z-scatter for 3D depth
          p.vz += (Math.random() - 0.5) * push * 0.8;
        }
      }
    }

    if (p.isCosmicAmbient) {
      const ambSpeedMult = (ambientParticleSpeed ?? 0.15) / 0.15;
      p.y -= scrollVelocity * (p.driftSpeed || 0.2) * ambSpeedMult;
      p.x += Math.sin(time * 0.005 + i) * 0.15 * ambSpeedMult;

      if (p.y < currentH / 2 - currentH * 4) p.y = currentH / 2 + currentH * 4;
      if (p.y > currentH / 2 + currentH * 4) p.y = currentH / 2 - currentH * 4;
      if (p.x < currentW / 2 - currentW * 4) p.x = currentW / 2 + currentW * 4;
      if (p.x > currentW / 2 + currentW * 4) p.x = currentW / 2 - currentW * 4;
      if (p.z < currentW / 2 - currentW * 4) p.z = currentW / 2 + currentW * 4;
      if (p.z > currentW / 2 + currentW * 4) p.z = currentW / 2 - currentW * 4;

      const mdx = mousePos.x - p.x;
      const mdy = mousePos.y - p.y;
      const mDistSq = mdx * mdx + mdy * mdy;
      if (mDistSq < 19600) {
        const mDist = Math.sqrt(mDistSq);
        const mForce = ((140 - mDist) / 140) * vortexMultiplier;
        const tx = -mdy / (mDist || 1);
        const ty = mdx / (mDist || 1);
        p.vx += tx * mForce * 1.6;
        p.vy += ty * mForce * 1.6;
      }

      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.94;
      p.vy *= 0.94;

      let drawAmbX = p.x;
      let drawAmbY = p.y;
      let isBehindBhShadow = false;

      activeBlackholes.forEach((entity) => {
        const ldx = drawAmbX - entity.x;
        const ldy = drawAmbY - entity.y;
        const ldist = Math.sqrt(ldx * ldx + ldy * ldy) || 1;
        
        const horizon = entity.radius;
        const shadowRadius = horizon * 2.598;
        
        if (ldist <= shadowRadius) {
          isBehindBhShadow = true;
        } else {
          const lenseRadius = horizon * 1.35;
          const shiftDist = Math.sqrt(ldist * ldist + lenseRadius * lenseRadius);
          const lensedX = entity.x + (ldx / ldist) * shiftDist;
          const lensedY = entity.y + (ldy / ldist) * shiftDist;
          
          const blendFactor = Math.pow(Math.max(0, 1.0 - ldist / (horizon * 5.0)), 1.5);
          drawAmbX = drawAmbX + (lensedX - drawAmbX) * blendFactor;
          drawAmbY = drawAmbY + (lensedY - drawAmbY) * blendFactor;
        }
      });

      if (isBehindBhShadow) {
        positions[i * 3] = -99999;
        positions[i * 3 + 1] = -99999;
        positions[i * 3 + 2] = -99999;
        colors[i * 4] = 0;
        colors[i * 4 + 1] = 0;
        colors[i * 4 + 2] = 0;
        colors[i * 4 + 3] = 0;
        extras[i] = 0.0;
        continue;
      }

      const mouseNormX = (mousePos.x - currentW / 2) / (currentW / 2 || 1);
      const mouseNormY = (mousePos.y - currentH / 2) / (currentH / 2 || 1);
      const parallaxFactor = 0.15;
      const parallaxX = mouseNormX * p.z * parallaxFactor;
      const parallaxY = mouseNormY * p.z * parallaxFactor;
      
      let finalX = drawAmbX - currentW / 2 + parallaxX;
      let finalY = -(drawAmbY - currentH / 2 + parallaxY);
      let finalZ = p.z;

      if (isTransitActive && transitProgress > 0) {
        const cx = transitCx - currentW / 2;
        const cy = -(transitCy - currentH / 2);
        
        const dx = finalX - cx;
        const dy = finalY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        
        const tunnelRadius = 150 + Math.random() * 200;
        const pullFactor = Math.pow(transitProgress, 1.5);
        
        finalX += (dx / dist * tunnelRadius - dx) * pullFactor;
        finalY += (dy / dist * tunnelRadius - dy) * pullFactor;
        finalZ -= 2000 * pullFactor * (Math.random() * 0.5 + 0.5);
      }

      positions[i * 3] = finalX;
      positions[i * 3 + 1] = finalY;
      positions[i * 3 + 2] = finalZ;

      let r = p.color === "#ffffff" ? 0.7 : 0.8;
      let g = p.color === "#ffffff" ? 0.7 : 0.8;
      let b = p.color === "#ffffff" ? 0.7 : 0.8;
      
      if (isTransitActive && transitProgress > 0) {
        const shift = Math.pow(transitProgress, 1.2);
        r = r * (1.0 - shift * 0.8) + shift * 0.4;
        g = g * (1.0 - shift * 0.5) + shift * 1.5;
        b = b * (1.0 + shift * 1.0) + shift * 3.0;
      }

      if (!particleFilters.ambient) {
        colors[i * 4] = 0;
        colors[i * 4 + 1] = 0;
        colors[i * 4 + 2] = 0;
        colors[i * 4 + 3] = 0;
      } else {
        colors[i * 4] = Math.min(1.0, Math.max(0.0, r));
        colors[i * 4 + 1] = Math.min(1.0, Math.max(0.0, g));
        colors[i * 4 + 2] = Math.min(1.0, Math.max(0.0, b));
        colors[i * 4 + 3] = 1.0;
      }
      extras[i] = 0.0;
      continue;
    }

    // Calculate gravitational Time Dilation near black holes
    let localTimeDilation = globalTimeMultiplier;
    activeBlackholes.forEach((entity) => {
      const gdx = entity.x - p.x;
      const gdy = entity.y - p.y;
      const gdist = Math.sqrt(gdx * gdx + gdy * gdy) || 1;
      const horizonZone = entity.radius * 3.5;
      if (gdist < horizonZone) {
        const ratio = Math.max(0.04, Math.min(1.0, (gdist - entity.radius * 0.4) / (horizonZone - entity.radius * 0.4)));
        const dilation = Math.sqrt(ratio);
        if ((dilation * globalTimeMultiplier) < localTimeDilation) {
          localTimeDilation = dilation * globalTimeMultiplier;
        }
      }
    });

    p.vy -= scrollVelocity * 0.16;
    p.vx +=
      Math.sin(i * 0.05 + time * 0.1) *
      Math.abs(scrollVelocity) *
      0.03;

    // Continuous Curl Noise vector field for fluid dynamics and spatiotemporal coherence
    const curl = computeCurlNoise(p.x, p.y, time * 0.12);
    const fluidTransitionFactor = isTypographyMode ? 0.12 : 0.75;
    const springDistSq = (p.targetX - p.x) * (p.targetX - p.x) + (p.targetY - p.y) * (p.targetY - p.y);
    const springFactorSq = Math.max(0.01, Math.min(1.0, springDistSq / 25000));
    let fluidInfluence = Math.max(0.0, Math.min(0.85, (1.0 - (p.isProjectText ? 0.75 : 0.22)) * fluidTransitionFactor * springFactorSq));
    if (p.isProjectText) {
      fluidInfluence *= ((textParticleSpeed ?? 0.12) * 1.5);
    }
    
    p.vx += curl.x * fluidInfluence;
    p.vy += curl.y * fluidInfluence;

    p.x += p.vx * localTimeDilation;
    p.y += p.vy * localTimeDilation;
    p.z += p.vz * localTimeDilation;

    p.vx *= 0.86;
    p.vy *= 0.86;
    p.vz *= 0.86;

    if (isInterstellar && p.interstellarType) {
      const objSpeedMult = (objectParticleSpeed ?? 0.15) / 0.15;
      const ambSpeedMult = (ambientParticleSpeed ?? 0.15) / 0.15;

      let entity = p.interstellarEntity || celestialEntities[p.interstellarEntityIndex || 0];
      if (entity && entity.isDestroyed) {
        const activeEntityIdx = celestialEntities.findIndex(e => e && !e.isDestroyed);
        if (activeEntityIdx !== -1) {
          p.interstellarEntityIndex = activeEntityIdx;
          p.interstellarEntity = celestialEntities[activeEntityIdx];
          entity = p.interstellarEntity;
        }
      }

      if (entity) {
        if (p.clusterRole === "surface" || p.clusterRole === "atmosphere") {
          // 1. 3D Spherical Particle Shell rotating with polar spin axis
          const spin = ((time * 0.0015) * (p.clusterSpinSpeed || 1.2) + (p.clusterTheta || 0)) * localTimeDilation * musicSpeedFactor * objSpeedMult;
          const lx = p.clusterRelX || 0;
          const ly = p.clusterRelY || 0;
          const lz = p.clusterRelZ || 0;
          const cosS = Math.cos(spin);
          const sinS = Math.sin(spin);
          const rotX = lx * cosS - lz * sinS;
          const rotZ = lx * sinS + lz * cosS;

          const stretch = 1.0 + (entity.isMerging ? 0.25 * Math.sin(time * 0.01) : 0);
          p.targetX = entity.x + rotX * stretch;
          p.targetY = entity.y + ly * stretch;
          p.targetZ = (entity.z || 0) + rotZ * stretch;
        } else if (p.clusterRole === "core") {
          // 2. Incandescent Fusion Core Pulsation
          const pulse = 1.0 + Math.sin(time * 0.006 + i * 0.2) * 0.08 + (musicBands.bass || 0) * 0.15;
          p.targetX = entity.x + (p.clusterRelX || 0) * pulse;
          p.targetY = entity.y + (p.clusterRelY || 0) * pulse;
          p.targetZ = (entity.z || 0) + (p.clusterRelZ || 0) * pulse;
        } else if (p.clusterRole === "corona") {
          // 3. Convective Granulation & Boiling Flares
          const flareTime = time * 0.004 + (p.clusterNoiseOffset || 0);
          const flareWobble = 1.0 + Math.sin(flareTime * 2.5) * 0.22 + Math.cos(flareTime * 4.2) * 0.12 + (musicBands.mid || 0) * 0.25;
          p.targetX = entity.x + (p.clusterRelX || 0) * flareWobble;
          p.targetY = entity.y + (p.clusterRelY || 0) * flareWobble;
          p.targetZ = (entity.z || 0) + (p.clusterRelZ || 0) * flareWobble;
        } else if (p.clusterRole === "jet") {
          // 4. Collimated Relativistic Polar Jet Traversal
          const precess = time * 0.003;
          const jetOffset = ((time * 0.15 + (i * 4.5)) % 140);
          const isNorth = (p.clusterRelY || 0) >= 0;
          const dirY = isNorth ? 1 : -1;
          const jetHeight = (entity.radius || 30) + jetOffset;
          const jetSpread = (jetHeight / (entity.radius * 3.5)) * 16;
          const jx = Math.cos(precess + i) * jetSpread;
          const jz = Math.sin(precess + i) * jetSpread;
          p.targetX = entity.x + jx;
          p.targetY = entity.y + dirY * jetHeight;
          p.targetZ = (entity.z || 0) + jz;
        } else if (
          p.clusterRole === "photon_ring" ||
          p.clusterRole === "accretion" ||
          p.clusterRole === "warped_arch" ||
          p.clusterRole === "ring" ||
          p.isPlanetRing ||
          p.interstellarType === "blackhole"
        ) {
          // 5. Relativistic / Keplerian Orbital Rings & Accretion Disks
          p.orbitAngle = (p.orbitAngle || 0) + (p.orbitSpeed || 0.02) * localTimeDilation * musicSpeedFactor * objSpeedMult;
          const rx = p.orbitRadius || 50;
          const ry = rx * (p.clusterRole === "photon_ring" ? 0.38 : (p.isPlanetRing || p.clusterRole === "ring" ? 0.32 : 0.30));
          const theta = p.clusterRole === "warped_arch" ? 0.85 : 0.15;
          const cosT = Math.cos(theta);
          const sinT = Math.sin(theta);
          const ox = Math.cos(p.orbitAngle) * rx;
          const oy = Math.sin(p.orbitAngle) * ry;
          p.targetX = entity.x + (ox * cosT - oy * sinT);
          p.targetY = entity.y + (ox * sinT + oy * cosT);
          p.targetZ = (entity.z || 0) + Math.sin(p.orbitAngle) * rx * 0.45;
        } else if (p.interstellarType === "nebula" || p.clusterRole === "gas_lobe") {
          // 6. 3D Curl Fluid Vortex Turbulence Gas Clouds
          p.orbitAngle = (p.orbitAngle || 0) + (p.orbitSpeed || 0.005) * localTimeDilation * musicSpeedFactor * objSpeedMult;
          const seed = (i * 0.173) % 100.0;
          const tTurb = time * 0.002 + seed;
          const turbX = Math.sin(tTurb * 1.5 + (p.targetY || 0) * 0.008) * 25.0 + Math.cos(tTurb * 0.8) * 12.0;
          const turbY = Math.cos(tTurb * 1.3 + (p.targetX || 0) * 0.008) * 25.0 + Math.sin(tTurb * 0.6) * 12.0;
          const turbZ = Math.sin(tTurb * 1.1 + seed) * 18.0;

          const baseRad = p.orbitRadius || entity.radius * 0.5;
          const pulseExpansion = 1.0 + Math.sin(time * 0.0025 + seed) * 0.12 + (musicBands.bass || 0) * 0.2;
          const effRad = baseRad * pulseExpansion;

          const angle = p.orbitAngle + (seed * 0.05);
          p.targetX = entity.x + Math.cos(angle) * effRad + turbX;
          p.targetY = entity.y + Math.sin(angle) * effRad + turbY;
          p.targetZ = (entity.z || 0) + (p.targetZ !== undefined ? p.targetZ : (Math.sin(seed) * 30)) + turbZ * 0.3;
        } else if (p.interstellarType === "bridge") {
          p.bridgeProgress =
            (p.bridgeProgress ?? 0) + (p.bridgeSpeed ?? 0.018) * localTimeDilation * musicSpeedFactor * objSpeedMult;
          if (p.bridgeProgress > 1) {
            p.bridgeProgress = 0;
          }
          const start = p.bridgeStartEntity || celestialEntities[p.bridgeStartEntityIndex ?? 0];
          const end = p.bridgeEndEntity || celestialEntities[p.bridgeEndEntityIndex ?? 1];
          if (start && end) {
            const t = p.bridgeProgress;
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const midX = start.x + dx * 0.5 - dy * 0.25;
            const midY = start.y + dy * 0.5 + dx * 0.25;
            const x =
              (1 - t) * (1 - t) * start.x +
              2 * (1 - t) * t * midX +
              t * t * end.x;
            const y =
              (1 - t) * (1 - t) * start.y +
              2 * (1 - t) * t * midY +
              t * t * end.y;
            p.targetX = x;
            p.targetY = y;
            p.targetZ = (start.z || 0) + Math.sin(t * Math.PI) * 25;
          }
        } else if (p.interstellarType === "background_galaxy") {
          p.orbitAngle = (p.orbitAngle || 0) + (p.orbitSpeed || 0.012) * localTimeDilation * musicSpeedFactor * ambSpeedMult;
          
          const rx = p.orbitRadius || 20;
          const ry = p.galaxyType === "spiral" ? rx * 0.35 : rx * 0.8;
          const ox = Math.cos(p.orbitAngle) * rx;
          const oy = Math.sin(p.orbitAngle) * ry;
          
          const cosP = Math.cos(p.galaxyPitch || 0);
          const sinP = Math.sin(p.galaxyPitch || 0);
          const cosY = Math.cos(p.galaxyYaw || 0);
          const sinY = Math.sin(p.galaxyYaw || 0);
          
          const lx = ox * cosY - oy * sinY * cosP;
          const ly = ox * sinY + oy * cosY * cosP;
          const lz = oy * sinP;
          
          p.targetX = (p.galaxyX || 0) + lx;
          p.targetY = (p.galaxyY || 0) + ly;
          p.targetZ = (p.galaxyZ || -1400) + lz;
        } else if (p.interstellarType === "star") {
          p.targetX += Math.sin(time * 0.002 + i) * 0.25 * objSpeedMult;
          p.targetY += Math.cos(time * 0.002 + i) * 0.25 * objSpeedMult;
        }
      }
    }

    let particleBrightness = 1.0;
    let suctionAlpha = 0;

    const isInterferenceSuppressed = !isInterstellar && (snElapsed < 4000);

    if (!isInterferenceSuppressed) {
      const gravityRadiusMult = isInterstellar ? 3.6 : 2.2;
      
      // 1. Black hole attraction & event horizon consumption (Accretion Zone)
      activeBlackholes.forEach((entity) => {
        // Accretion disk and photon ring particles for THIS black hole follow relativistic orbits
        if (p.interstellarEntity === entity && (p.clusterRole === "accretion" || p.clusterRole === "photon_ring" || p.clusterRole === "warped_arch")) {
          return;
        }

        const bdx = entity.x - p.x;
        const bdy = entity.y - p.y;
        const bhGravityMult = isInterstellar ? 3.8 : 2.5;
        const bdist = Math.sqrt(bdx * bdx + bdy * bdy) || 1;
        if (bdist < entity.radius * bhGravityMult) {
          const pullFactor = 1.0 - bdist / (entity.radius * bhGravityMult);
          suctionAlpha = Math.max(suctionAlpha, pullFactor * (isInterstellar ? 0.8 : 0.3));

          const basePullStrength = (isInterstellar ? 3.5 : 2.0) * (entity.type === "blackhole" ? 1.5 : 1.0);
          const tx = -bdy / bdist;
          const ty = bdx / bdist;

          const closeness = 1.0 - (bdist / (entity.radius * bhGravityMult));
          const orbitalStrength = basePullStrength * 1.5 * pullFactor;
          const radialStrength = basePullStrength * 0.6 * pullFactor * (0.2 + closeness * 1.5);

          p.vx += (bdx / bdist) * radialStrength + tx * orbitalStrength;
          p.vy += (bdy / bdist) * radialStrength + ty * orbitalStrength;

          if (bdist < entity.radius * 1.5) {
            p.vx *= 1.04;
            p.vy *= 1.04;
          }

          // Relativistic Infall & Event Horizon Swallowing
          if (bdist <= entity.radius * 1.0) {
            const singularityPull = 8.0 + (1.0 - bdist / entity.radius) * 16.0;
            p.vx = (bdx / bdist) * singularityPull;
            p.vy = (bdy / bdist) * singularityPull;
            p.vz = (0 - (p.z || 0)) * 0.2;

            const horizonFade = Math.max(0.0, (bdist - entity.radius * 0.15) / (entity.radius * 0.85));
            particleBrightness = Math.min(particleBrightness, horizonFade);

            if (bdist < entity.radius * 0.2) {
              if (entity.mass) {
                entity.mass += 0.05;
              }
              const newOrbitRad = entity.radius * (3.5 + Math.random() * 4.5);
              const newAngle = Math.random() * Math.PI * 2;
              p.x = entity.x + Math.cos(newAngle) * newOrbitRad;
              p.y = entity.y + Math.sin(newAngle) * newOrbitRad;
              p.z = (Math.random() - 0.5) * 40;
              p.vx = -Math.sin(newAngle) * 3.5;
              p.vy = Math.cos(newAngle) * 3.5;
              p.vz = (Math.random() - 0.5) * 0.5;
              if (p.interstellarType === "blackhole") {
                p.orbitRadius = newOrbitRad;
                p.orbitAngle = newAngle;
              }
              p.targetX = p.x;
              p.targetY = p.y;
            }
          }
        }
      });

      // 2. Rigid body collision with planets/stars
      const colOffset = currentW < 768 ? 2 : 3;
      activeCollidables.forEach((entity) => {
        // Particles that belong to this celestial body's cluster do not collide with their parent entity
        if (p.interstellarEntity === entity) return;

        const bdx = entity.x - p.x;
        const bdy = entity.y - p.y;
        const bdist = Math.sqrt(bdx * bdx + bdy * bdy) || 1;
        const colDist = entity.radius + colOffset;
        if (bdist < colDist && !p.isTail) {
          const nx = bdx / bdist;
          const ny = bdy / bdist;
          
          const dot = p.vx * nx + p.vy * ny;
          if (dot > 0) {
            p.vx -= 2 * dot * nx;
            p.vy -= 2 * dot * ny;
            p.vx += (Math.random() - 0.5) * 4;
            p.vy += (Math.random() - 0.5) * 4;
          }
          
          p.x = entity.x - nx * (colDist + 1);
          p.y = entity.y - ny * (colDist + 1);
        }
      });
    }

    const dx = p.targetX - p.x;
    const dy = p.targetY - p.y;
    const distSq = dx * dx + dy * dy;

    const baseSpring = isTypographyMode
      ? Math.max(0.04, Math.min(0.25, 20.0 / Math.max(1, distSq)))
      : isInterstellar
        ? 0.24
        : 0.08;

    const effectiveSpring = (p.isProjectText
      ? baseSpring * textParticleSpeed
      : baseSpring) * (1.0 - suctionAlpha);

    if (distSq > 0.1) {
      if (p.isProjectText) {
        const mdx = mousePos.x - p.x;
        const mdy = mousePos.y - p.y;
        const mDistSq = mdx * mdx + mdy * mdy;
        if (mDistSq < 10000) {
          const mDist = Math.sqrt(mDistSq);
          const mForce = (1 - mDist / 100) * 0.1 * textParticleSpeed;
          p.x += mdx * mForce;
          p.y += mdy * mForce;
        }
      }
      p.x += dx * effectiveSpring * attractionMultiplier * localTimeDilation;
      p.y += dy * effectiveSpring * attractionMultiplier * localTimeDilation;
    } else {
      if (attractionMultiplier > 0.01) {
        if (p.isProjectText) {
          p.x += dx * 0.1 * textParticleSpeed;
          p.y += dy * 0.1 * textParticleSpeed;
        } else {
          p.x = p.targetX;
          p.y = p.targetY;
        }
      }
    }
    
    if (p.targetZ !== undefined) {
      const dz = p.targetZ - (p.z || 0);
      if (Math.abs(dz) > 0.1) {
        p.z = (p.z || 0) + dz * effectiveSpring * attractionMultiplier * localTimeDilation;
      } else {
        p.z = p.targetZ;
      }
    }

    let floatX = 0;
    let floatY = 0;
    if (floatScaleX > 0) {
      floatX =
        Math.sin(time * floatSpeed + p.targetY * 0.015 + i * 0.012) *
        floatScaleX;
      floatY =
        Math.cos(time * floatSpeed * 0.9 + p.targetX * 0.015 + i * 0.012) *
        floatScaleY;
    }

    if (musicAmpVal > 0.01) {
      if (musicBands.bass > 0.02) {
        const bassWaveFreq = 0.045;
        const bassWaveSpeed = 0.12;
        const bassWaveAmp = musicBands.bass * 22.0;
        floatX += Math.sin(time * bassWaveSpeed + p.y * bassWaveFreq + i * 0.01) * bassWaveAmp;
        floatY += Math.cos(time * bassWaveSpeed * 0.9 + p.x * bassWaveFreq + i * 0.01) * bassWaveAmp;
      }
      if (musicBands.treble > 0.03) {
        const trebleJitter = musicBands.treble * 5.0;
        floatX += Math.sin(time * 0.45 + i * 0.2) * trebleJitter;
        floatY += Math.cos(time * 0.42 + i * 0.2) * trebleJitter;
      }
    }
    if (!isInterstellar || p.isProjectText) {
      const floatZ = Math.sin(time * floatSpeed * 0.7 + i * 0.04) * 8;
      p.z += (floatZ - p.z) * 0.05;
    }

    const selfMovementX = isTypographyMode
      ? 0
      : Math.sin(time * 0.015 + i * 0.17) * 0.45;
    const selfMovementY = isTypographyMode
      ? 0
      : Math.cos(time * 0.015 + i * 0.23) * 0.45;
    let drawX = p.x + floatX + selfMovementX;
    let drawY = p.y + floatY + selfMovementY;

    activeBlackholes.forEach((entity) => {
      const ldx = drawX - entity.x;
      const ldy = drawY - entity.y;
      const ldist = Math.sqrt(ldx * ldx + ldy * ldy) || 1;
      
      const horizon = entity.radius;
      const lenseRadius = horizon * 1.35;
      
      if (ldist > horizon * 0.95) {
        const shiftDist = Math.sqrt(ldist * ldist + lenseRadius * lenseRadius);
        const lensedX = entity.x + (ldx / ldist) * shiftDist;
        const lensedY = entity.y + (ldy / ldist) * shiftDist;
        
        const blendFactor = Math.pow(Math.max(0, 1.0 - ldist / (horizon * 5.0)), 1.5);
        drawX = drawX + (lensedX - drawX) * blendFactor;
        drawY = drawY + (lensedY - drawY) * blendFactor;
      }
    });

    if (p.prevDrawX !== undefined && p.prevDrawY !== undefined) {
      const pdx = drawX - p.prevDrawX;
      const pdy = drawY - p.prevDrawY;
      const moveDistSq = pdx * pdx + pdy * pdy;

      if (moveDistSq > 3.0 && Math.random() < 0.22) {
        spawnTailParticle(p.prevDrawX, p.prevDrawY, p.z, pdx, pdy, p.color);
      }
    }
    p.prevDrawX = drawX;
    p.prevDrawY = drawY;

    const mdx = mousePos.x - drawX;
    const mdy = mousePos.y - drawY;
    const mDistSq = mdx * mdx + mdy * mdy;

    if (mDistSq < 40000) {
      const mDist = Math.sqrt(mDistSq);
      let mForce = Math.pow((200 - mDist) / 200, 1.5) * vortexMultiplier;

      if (isTypographyMode && distSq < 15) {
        mForce *= (distSq / 15) * 0.4;
      }

      const tx = -mdy / (mDist || 1);
      const ty = mdx / (mDist || 1);
      const orbitalSpeed = 4.5 * mForce;
      const pullSpeed = mDist > 30 ? 1.5 * mForce : -2.0;

      p.vx += (mdx / (mDist || 1)) * pullSpeed;
      p.vy += (mdy / (mDist || 1)) * pullSpeed;
      p.vx += tx * orbitalSpeed;
      p.vy += ty * orbitalSpeed;

      if (mForce > 0.6 && Math.random() > 0.993 && audio) {
        audio.playInteractiveMallet(mForce, drawX / currentW);
      }
    }

    activeRipples.forEach((ripple) => {
      const rdx = ripple.x - drawX;
      const rdy = ripple.y - drawY;
      const rDistSq = rdx * rdx + rdy * rdy;

      if (rDistSq > ripple.minDistSq && rDistSq < ripple.maxDistBoundSq) {
        const rDist = Math.sqrt(rDistSq);
        const rForce =
          (1 - Math.abs(rDist - ripple.maxDist) / ripple.bandWidth) *
          ripple.life;
        p.vx -= (rdx / (rDist || 1)) * rForce * 4.0;
        p.vy -= (rdy / (rDist || 1)) * rForce * 4.0;
        p.vz -= rForce * 10;
      }
    });

    let particleGravityZ = 0;
    celestialEntities.forEach((entity) => {
      if (entity.isDestroyed) return;
      const gdx = entity.x - drawX;
      const gdy = entity.y - drawY;
      const gdistSq = gdx * gdx + gdy * gdy;
      const gdist = Math.sqrt(gdistSq) || 1;
      
      const range = entity.radius * (entity.type === "blackhole" ? 3.5 : 1.8);
      if (gdist < range) {
        const intensity = (range - gdist) / range;
        const pullDepth = entity.type === "blackhole" ? 220 : 60;
        particleGravityZ += Math.pow(intensity, 1.8) * pullDepth;
      }
    });

    const mouseNormX = (mousePos.x - currentW / 2) / (currentW / 2 || 1);
    const mouseNormY = (mousePos.y - currentH / 2) / (currentH / 2 || 1);
    const parallaxFactor = 0.15;
    const parallaxX = mouseNormX * p.z * parallaxFactor;
    const parallaxY = mouseNormY * p.z * parallaxFactor;

    let finalX = drawX - currentW / 2 + parallaxX;
    let finalY = -(drawY - currentH / 2 + parallaxY);
    let finalZ = p.z + particleGravityZ;

    if (isTransitActive && transitProgress > 0) {
      const cx = transitCx - currentW / 2;
      const cy = -(transitCy - currentH / 2);
      const dx = finalX - cx;
      const dy = finalY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const tunnelRadius = 50 + Math.random() * 150;
      const pullFactor = Math.pow(transitProgress, 1.2);
      
      finalX += (dx / dist * tunnelRadius - dx) * pullFactor;
      finalY += (dy / dist * tunnelRadius - dy) * pullFactor;
      finalZ -= 3000 * pullFactor * (Math.random() * 0.8 + 0.2);
    }

    positions[i * 3] = finalX;
    positions[i * 3 + 1] = finalY;
    positions[i * 3 + 2] = finalZ;

    let r = p.r ?? 255;
    let g = p.g ?? 255;
    let b = p.b ?? 255;

    let rFactor = 1.0;
    let gFactor = 1.0;
    let bFactor = 1.0;

    if (activeSupernova && snElapsed > 0 && snElapsed < 3000) {
      const snX = activeSupernova.x;
      const snY = activeSupernova.y;
      const dist = Math.sqrt((drawX - snX) * (drawX - snX) + (drawY - snY) * (drawY - snY));
      
      const waveRadius = (snElapsed - 250) * 0.85;
      if (snElapsed >= 250 && Math.abs(dist - waveRadius) < 180) {
        const rippleGlow = (1.0 - Math.abs(dist - waveRadius) / 180) * 0.35;
        rFactor += rippleGlow;
        gFactor += rippleGlow * 0.8;
        bFactor += rippleGlow * 1.2;
      }
    }

    let textAlphaDimmer = 1.0;
    if (p.isProjectText) {
      textAlphaDimmer = 1.0 - (screensaverOpacity * 0.72);
    }

    let audioColorR = 1.0;
    let audioColorG = 1.0;
    let audioColorB = 1.0;
    if (musicAmpVal > 0.01) {
      audioColorR += musicBands.bass * 0.05;
      audioColorG += musicBands.mid * 0.04;
      audioColorB += musicBands.treble * 0.05;
    }

    let dopplerR = 1.0;
    let dopplerG = 1.0;
    let dopplerB = 1.0;
    let dopplerIntensity = 1.0;

    if (isInterstellar && p.interstellarType === "blackhole" && p.orbitAngle !== undefined) {
      const velLineOfSight = -Math.sin(p.orbitAngle);

      if (velLineOfSight > 0) {
        const factor = velLineOfSight * 0.42;
        dopplerR = 1.0 - factor * 0.2;
        dopplerG = 1.0 + factor * 0.1;
        dopplerB = 1.0 + factor * 0.65;
        dopplerIntensity = 1.0 + factor * 0.8;
      } else {
        const factor = -velLineOfSight * 0.42;
        dopplerR = 1.0 + factor * 0.55;
        dopplerG = 1.0 - factor * 0.15;
        dopplerB = 1.0 - factor * 0.4;
        dopplerIntensity = Math.max(0.35, 1.0 - factor * 0.65);
      }

      const horizonRadius = 35;
      if (p.orbitRadius && p.orbitRadius < horizonRadius * 2.2) {
        const grFactor = (horizonRadius * 2.2 - p.orbitRadius) / (horizonRadius * 1.2);
        const redshift = Math.max(0, Math.min(0.65, grFactor));
        dopplerR *= (1.0 + redshift * 0.35);
        dopplerG *= (1.0 - redshift * 0.25);
        dopplerB *= (1.0 - redshift * 0.55);
        dopplerIntensity *= (1.0 - redshift * 0.5);
      }
    }

    if (isTransitActive && transitProgress > 0) {
      const shift = Math.pow(transitProgress, 1.2);
      dopplerR = dopplerR * (1.0 - shift * 0.5) + shift * 0.2;
      dopplerG = dopplerG * (1.0 - shift * 0.2) + shift * 0.8;
      dopplerB = dopplerB * (1.0 + shift * 1.5) + shift * 2.5;
      dopplerIntensity = dopplerIntensity * (1.0 + shift * 3.0);
    }

    let bhAbsorbFactor = 1.0;
    for (let bIdx = 0; bIdx < celestialEntities.length; bIdx++) {
      const bh = celestialEntities[bIdx];
      if (bh && !bh.isDestroyed && bh.type === "blackhole") {
        const bhWorldX = bh.x - currentW / 2;
        const bhWorldY = -(bh.y - currentH / 2);
        const bhDx = finalX - bhWorldX;
        const bhDy = finalY - bhWorldY;
        const bhDist2D = Math.sqrt(bhDx * bhDx + bhDy * bhDy);
        const ehRadius = bh.radius * 2.598; // Schwarzschild shadow radius b_crit = (3*sqrt(3)/2) * r_s
        const ergosphereRadius = bh.radius * 4.5;

        if (bhDist2D < ergosphereRadius) {
          if (bhDist2D <= ehRadius) {
            bhAbsorbFactor = 0.0;
            positions[i * 3] = -99999;
            positions[i * 3 + 1] = -99999;
            positions[i * 3 + 2] = -99999;
            break;
          } else {
            const normDist = (bhDist2D - ehRadius) / (ergosphereRadius - ehRadius);
            const smoothAtt = Math.pow(normDist, 2.0);
            bhAbsorbFactor = Math.min(bhAbsorbFactor, smoothAtt);
          }
        }
      }
    }

    const filters = particleFilters;
    let visibleByFilter = true;
    if (p.isProjectText && !filters.typography) {
      visibleByFilter = false;
    } else if (p.interstellarType === "bridge" && !filters.bridges) {
      visibleByFilter = false;
    } else if (p.interstellarType === "background_galaxy" && !filters.ambient) {
      visibleByFilter = false;
    } else if (
      (p.interstellarType === "blackhole" ||
       p.interstellarType === "planet" ||
       p.interstellarType === "star" ||
       p.interstellarType === "nebula" ||
       p.isPlanetRing ||
       (!p.interstellarType && !p.isCosmicAmbient && !p.isProjectText && !p.isTail)) &&
      !filters.celestial
    ) {
      visibleByFilter = false;
    }

    if (!visibleByFilter || bhAbsorbFactor <= 0.001) {
      colors[i * 4] = 0;
      colors[i * 4 + 1] = 0;
      colors[i * 4 + 2] = 0;
      colors[i * 4 + 3] = 0;
    } else {
      const isAmbientStar = p.isCosmicAmbient || (p.interstellarType === "star" && !p.clusterRole);
      const starDimmer = isAmbientStar ? 0.38 : 1.0;
      colors[i * 4] = Math.min(1.0, Math.max(0.0, (r / 255) * globalAlpha * rFactor * audioColorR * particleBrightness * textAlphaDimmer * dopplerR * dopplerIntensity * bhAbsorbFactor * starDimmer));
      colors[i * 4 + 1] = Math.min(1.0, Math.max(0.0, (g / 255) * globalAlpha * gFactor * audioColorG * particleBrightness * textAlphaDimmer * dopplerG * dopplerIntensity * bhAbsorbFactor * starDimmer));
      colors[i * 4 + 2] = Math.min(1.0, Math.max(0.0, (b / 255) * globalAlpha * bFactor * audioColorB * particleBrightness * textAlphaDimmer * dopplerB * dopplerIntensity * bhAbsorbFactor * starDimmer));
      colors[i * 4 + 3] = globalAlpha * textAlphaDimmer * bhAbsorbFactor * starDimmer;
    }
    extras[i] = p.isTail
      ? 2.0
      : (p.interstellarType === "nebula" || p.clusterRole === "gas_lobe")
      ? 4.0
      : p.interstellarType === "background_galaxy"
      ? 3.0
      : (!p.isCosmicAmbient && (p.interstellarType !== "star" || !!p.clusterRole))
      ? 1.0
      : 0.0;
  }
}
