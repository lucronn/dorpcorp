import React from "react";
import * as BABYLON from "@babylonjs/core";
import { Particle } from "../../types";
import { CelestialEntity, ParticleFilters } from "./types";
import { simulateParticles } from "./ParticleSimulationEngine";
import { SupernovaFXInstance } from "./SupernovaFX";

export interface RenderEngineContext {
  particlesRef: React.MutableRefObject<Particle[]>;
  pointsMeshRef: React.MutableRefObject<BABYLON.Mesh | null>;
  hudPlaneRef: React.MutableRefObject<BABYLON.Mesh | null>;
  sceneRef: React.MutableRefObject<BABYLON.Scene | null>;
  cameraRef: React.MutableRefObject<BABYLON.TargetCamera | null>;
  rendererRef: React.MutableRefObject<BABYLON.Engine | null>;
  composerRef: React.MutableRefObject<BABYLON.DefaultRenderingPipeline | null>;
  pointsMaterialRef: React.MutableRefObject<BABYLON.ShaderMaterial | null>;
  lensingPostProcessRef?: React.MutableRefObject<BABYLON.PostProcess | null>;
  celestialEntitiesRef: React.MutableRefObject<CelestialEntity[]>;
  supernovaRef: React.MutableRefObject<{
    time: number;
    exploded: boolean;
    transitioned?: boolean;
    isCalmShift?: boolean;
    x: number;
    y: number;
    worldPos?: BABYLON.Vector3;
  } | null>;
  activeSupernovaFxRef: React.MutableRefObject<SupernovaFXInstance | null>;
  ripplesRef: React.MutableRefObject<{ x: number; y: number; life: number }[]>;
  collisionFlaresRef: React.MutableRefObject<
    Array<{ mesh: BABYLON.Mesh; life: number; maxLife: number; initialRadius: number }>
  >;
  cameraShakeRef: React.MutableRefObject<number>;
  inputControllerRef: React.MutableRefObject<any>;
  stageRef: React.MutableRefObject<number>;
  isInterstellarRef: React.MutableRefObject<boolean>;
  isTransitActiveRef: React.MutableRefObject<boolean>;
  transitStartTimeRef: React.MutableRefObject<number>;
  lastStageChangeRef: React.MutableRefObject<number>;
  lastUserActivityRef: React.MutableRefObject<number>;
  isScreensaverActiveRef: React.MutableRefObject<boolean>;
  screensaverOpacityRef: React.MutableRefObject<number>;
  lastShockwaveTimeRef: React.MutableRefObject<number>;
  isShockwaveActiveRef: React.MutableRefObject<boolean>;
  shockwaveStartTimeRef: React.MutableRefObject<number>;
  smoothedAmpRef: React.MutableRefObject<number>;
  smoothedBassRef: React.MutableRefObject<number>;
  smoothedMidRef: React.MutableRefObject<number>;
  smoothedTrebleRef: React.MutableRefObject<number>;
  mouseRef: React.MutableRefObject<{ x: number; y: number; lastMoved: number }>;
  scrollVelocityRef: React.MutableRefObject<number>;
  ambientParticleSpeedRef: React.MutableRefObject<number>;
  objectParticleSpeedRef: React.MutableRefObject<number>;
  textParticleSpeedRef: React.MutableRefObject<number>;
  particleFiltersRef: React.MutableRefObject<ParticleFilters>;
  spawnTailParticleRef: React.MutableRefObject<any>;
  timeRef: React.MutableRefObject<number>;
  positions: Float32Array;
  colors: Float32Array;
  extras: Float32Array;
  updateCelestial3DMeshes: () => void;
  generateInterstellarScene: (width: number, height: number, forceInterstellar?: boolean) => void;
  mapParticlesToInterstellar: (width: number, height: number) => void;
  startWormholeTransit: (targetPos?: BABYLON.Vector3, viewDir?: BABYLON.Vector3, bhRadius?: number) => Promise<void>;
  transitionStartTimeRef: React.MutableRefObject<number>;
  transitionActiveRef: React.MutableRefObject<boolean>;
  transitionStartPosRef: React.MutableRefObject<BABYLON.Vector3 | null>;
  fovRef: React.MutableRefObject<number>;
  animationComplete?: () => void;
  audio: any;
}

export function executeRenderFrame(ctx: RenderEngineContext) {
  const currentW = window.innerWidth;
  const currentH = window.innerHeight;

  const now = Date.now();
  const dt = ctx.rendererRef.current ? ctx.rendererRef.current.getDeltaTime() : 16.666;
  const globalTimeMultiplier = Math.min(dt / 16.666, 3.0);

  // Dynamic Web Audio API metrics with temporal smoothing
  const rawMusicAmp = (ctx.audio as any).getMusicAmplitude();
  const rawMusicBands = (ctx.audio as any).getFrequencyBands
    ? (ctx.audio as any).getFrequencyBands()
    : { bass: 0, mid: 0, treble: 0 };

  ctx.smoothedAmpRef.current += (rawMusicAmp - ctx.smoothedAmpRef.current) * 0.03;
  ctx.smoothedBassRef.current += (rawMusicBands.bass - ctx.smoothedBassRef.current) * 0.03;
  ctx.smoothedMidRef.current += (rawMusicBands.mid - ctx.smoothedMidRef.current) * 0.03;
  ctx.smoothedTrebleRef.current += (rawMusicBands.treble - ctx.smoothedTrebleRef.current) * 0.03;

  const musicAmpVal = Math.min(0.12, ctx.smoothedAmpRef.current);
  const musicBands = {
    bass: Math.min(0.12, ctx.smoothedBassRef.current),
    mid: Math.min(0.12, ctx.smoothedMidRef.current),
    treble: Math.min(0.12, ctx.smoothedTrebleRef.current),
  };
  const musicSpeedFactor = 1.0 + musicBands.mid * 0.4 + musicBands.bass * 0.2;

  const idleTime = now - ctx.lastUserActivityRef.current;
  const isIdle = idleTime > 10000;
  ctx.isScreensaverActiveRef.current = ctx.stageRef.current === 0 && isIdle;

  if (ctx.isScreensaverActiveRef.current) {
    ctx.screensaverOpacityRef.current += (1.0 - ctx.screensaverOpacityRef.current) * 0.02;
  } else {
    ctx.screensaverOpacityRef.current += (0.0 - ctx.screensaverOpacityRef.current) * 0.08;
  }

  const shockwaveInterval = 60000;
  if (ctx.stageRef.current === 0) {
    if (now - ctx.lastShockwaveTimeRef.current > shockwaveInterval) {
      ctx.isShockwaveActiveRef.current = true;
      ctx.shockwaveStartTimeRef.current = now;
      ctx.lastShockwaveTimeRef.current = now;
    }
  } else {
    ctx.isShockwaveActiveRef.current = false;
  }

  const isTransitActive = ctx.isTransitActiveRef.current;
  let transitProgress = 0;
  let transitCx = currentW / 2;
  let transitCy = currentH / 2;
  if (isTransitActive && ctx.transitStartTimeRef.current > 0) {
    const elapsed = now - ctx.transitStartTimeRef.current;
    transitProgress = Math.min(elapsed / 3000, 1.0);
    transitCx = ctx.mouseRef.current.x > 0 ? ctx.mouseRef.current.x : currentW / 2;
    transitCy = ctx.mouseRef.current.y > 0 ? ctx.mouseRef.current.y : currentH / 2;
  }

  const activeSupernova = ctx.supernovaRef.current;
  let snElapsed = 0;
  if (activeSupernova) {
    snElapsed = Date.now() - activeSupernova.time;
  }

  ctx.timeRef.current++;
  const time = ctx.timeRef.current;

  ctx.updateCelestial3DMeshes();

  const elapsed = Date.now() - ctx.lastStageChangeRef.current;

  let tracerOpacity = 0.85;
  if (elapsed < 1200) {
    const pTransit = elapsed / 1200;
    tracerOpacity = 0.15 + pTransit * 0.7;
  }

  if (
    ctx.hudPlaneRef.current &&
    ctx.hudPlaneRef.current.material &&
    ctx.hudPlaneRef.current.material instanceof BABYLON.StandardMaterial
  ) {
    ctx.hudPlaneRef.current.material.alpha = ctx.isInterstellarRef.current ? 0 : tracerOpacity * 0.8;
  }

  ctx.scrollVelocityRef.current *= 0.92;

  const particles = ctx.particlesRef.current;
  const entitiesList = ctx.celestialEntitiesRef.current;
  const activeBlackholes = entitiesList.filter((e) => e && !e.isDestroyed && e.type === "blackhole");
  const activeCollidables = entitiesList.filter(
    (e) => e && !e.isDestroyed && e.type !== "galaxy" && e.type !== "nebula" && e.type !== "blackhole"
  );

  let attractionMultiplier = 1.0;
  if (elapsed > 1200) {
    attractionMultiplier = Math.max(0.65, 1 - (elapsed - 1200) / 800);
  }

  let globalAlpha = 1.0;
  if (elapsed > 1200) {
    const alphaFade = Math.min(1.0, (elapsed - 1200) / 1000);
    globalAlpha = 1.0 - alphaFade * 0.1;
  }

  const isTypographyMode = ctx.stageRef.current >= 2 && ctx.stageRef.current <= 5;

  const mIdleTime = Date.now() - ctx.mouseRef.current.lastMoved;
  let vortexMultiplier = 1.0;
  if (mIdleTime > 2000) {
    vortexMultiplier = Math.max(0, 1.0 - (mIdleTime - 2000) / 1000);
  }

  if (ctx.activeSupernovaFxRef.current) {
    if (ctx.activeSupernovaFxRef.current.isDisposed) {
      ctx.activeSupernovaFxRef.current = null;
    } else {
      ctx.activeSupernovaFxRef.current.update(now);
    }
  }

  if (ctx.cameraRef.current) {
    if (ctx.cameraShakeRef.current > 0.05) {
      const shake = ctx.cameraShakeRef.current;
      ctx.cameraRef.current.position.x += (Math.random() - 0.5) * (shake * 0.12);
      ctx.cameraRef.current.position.y += (Math.random() - 0.5) * (shake * 0.12);
      ctx.cameraShakeRef.current *= 0.91;
    } else {
      ctx.cameraShakeRef.current = 0;
      ctx.cameraRef.current.position.x += (0 - ctx.cameraRef.current.position.x) * 0.1;
      ctx.cameraRef.current.position.y += (0 - ctx.cameraRef.current.position.y) * 0.1;
    }
  }

  if (activeSupernova) {
    snElapsed = Date.now() - activeSupernova.time;
    if (ctx.composerRef.current && snElapsed < 4500) {
      const spike = Math.max(0, 1.0 - snElapsed / 4500);
      ctx.composerRef.current.bloomWeight = 0.08 + spike * 0.75;
    }

    const transitionThreshold = 4950;
    if (snElapsed >= transitionThreshold && !activeSupernova.transitioned) {
      activeSupernova.transitioned = true;
      
      if (ctx.activeSupernovaFxRef.current) {
        ctx.activeSupernovaFxRef.current.dispose();
        ctx.activeSupernovaFxRef.current = null;
      }
      ctx.supernovaRef.current = null;
    }
  }

  const activeRipples = ctx.ripplesRef.current.map((ripple) => {
    const maxDist = (1 - ripple.life) * 400;
    const bandWidth = 40;
    const minDist = Math.max(0, maxDist - bandWidth);
    const maxDistBound = maxDist + bandWidth;
    return {
      ...ripple,
      maxDist,
      bandWidth,
      minDistSq: minDist * minDist,
      maxDistBoundSq: maxDistBound * maxDistBound,
    };
  });

  simulateParticles(particles, ctx.positions, ctx.colors, ctx.extras, {
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
    scrollVelocity: ctx.scrollVelocityRef.current,
    ambientParticleSpeed: ctx.ambientParticleSpeedRef.current,
    objectParticleSpeed: ctx.objectParticleSpeedRef.current,
    textParticleSpeed: ctx.textParticleSpeedRef.current,
    particleFilters: ctx.particleFiltersRef.current,
    globalAlpha,
    isTypographyMode,
    isInterstellar: ctx.isInterstellarRef.current,
    vortexMultiplier,
    attractionMultiplier,
    mousePos: ctx.mouseRef.current,
    celestialEntities: ctx.celestialEntitiesRef.current,
    spawnTailParticle: ctx.spawnTailParticleRef.current || (() => {}),
    screensaverOpacity: ctx.screensaverOpacityRef.current,
    isTransitActive,
    transitProgress,
    transitCx,
    transitCy,
    activeRipples,
    audio: ctx.audio,
  });

  if (ctx.pointsMeshRef.current) {
    ctx.pointsMeshRef.current.updateVerticesData(BABYLON.VertexBuffer.PositionKind, ctx.positions);
    ctx.pointsMeshRef.current.updateVerticesData(BABYLON.VertexBuffer.ColorKind, ctx.colors);
    ctx.pointsMeshRef.current.updateVerticesData("extraData", ctx.extras);
  }

  ctx.ripplesRef.current.forEach((r) => (r.life -= 0.02));
  ctx.ripplesRef.current = ctx.ripplesRef.current.filter((r) => r.life > 0);

  if (ctx.collisionFlaresRef.current.length > 0) {
    const remainingFlares: typeof ctx.collisionFlaresRef.current = [];
    const objSpeedMult = (ctx.objectParticleSpeedRef.current ?? 0.15) / 0.15;
    const flareDecay = Math.max(0.12, 0.12 * Math.max(0.3, objSpeedMult));
    ctx.collisionFlaresRef.current.forEach((flare) => {
      flare.life -= flareDecay;
      if (flare.life > 0) {
        const progress = 1.0 - flare.life;
        const s = 1.0 + progress * 0.6;
        flare.mesh.scaling.set(s, s, s);
        if (flare.mesh.material) {
          flare.mesh.material.alpha = flare.life * flare.life;
        }
        remainingFlares.push(flare);
      } else {
        if (flare.mesh.material) {
          flare.mesh.material.dispose();
        }
        flare.mesh.dispose();
      }
    });
    ctx.collisionFlaresRef.current = remainingFlares;
  }

  ctx.cameraShakeRef.current *= 0.88;
  if (ctx.cameraShakeRef.current < 0.01) ctx.cameraShakeRef.current = 0;

  const shakeVal = ctx.cameraShakeRef.current;
  const shakeX = shakeVal > 0 ? (Math.sin(now * 0.08) * 0.6 + (Math.random() - 0.5) * 0.4) * shakeVal : 0;
  const shakeY = shakeVal > 0 ? (Math.cos(now * 0.09) * 0.6 + (Math.random() - 0.5) * 0.4) * shakeVal : 0;
  const shakeZ = shakeVal > 0 ? (Math.sin(now * 0.07) * 0.5) * shakeVal : 0;

  const inputs = ctx.inputControllerRef.current;
  inputs.currentScrollTimeline += (inputs.targetScrollTimeline - inputs.currentScrollTimeline) * 0.05;
  inputs.currentCameraZDepthOffset += (inputs.targetCameraZDepthOffset - inputs.currentCameraZDepthOffset) * 0.05;
  inputs.currentCameraParallaxX += (inputs.targetCameraParallaxX - inputs.currentCameraParallaxX) * 0.05;
  inputs.currentCameraParallaxY += (inputs.targetCameraParallaxY - inputs.currentCameraParallaxY) * 0.05;
  inputs.currentCameraPitch += (inputs.targetCameraPitch - inputs.currentCameraPitch) * 0.05;
  inputs.currentCameraYaw += (inputs.targetCameraYaw - inputs.currentCameraYaw) * 0.05;

  const targetIntensity = inputs.targetLock.active ? 1.0 : 0.0;
  inputs.currentLock.intensity += (targetIntensity - inputs.currentLock.intensity) * 0.05;
  if (inputs.targetLock.active) {
    inputs.currentLock.x += (inputs.targetLock.x - inputs.currentLock.x) * 0.05;
    inputs.currentLock.y += (inputs.targetLock.y - inputs.currentLock.y) * 0.05;
    inputs.currentLock.z += (inputs.targetLock.z - inputs.currentLock.z) * 0.05;
  } else {
    inputs.currentLock.x += (0 - inputs.currentLock.x) * 0.05;
    inputs.currentLock.y += (0 - inputs.currentLock.y) * 0.05;
    inputs.currentLock.z += (0 - inputs.currentLock.z) * 0.05;
  }

  const cameraZ = Math.max(10.0, currentH / (2 * Math.tan((ctx.fovRef.current * Math.PI) / 360)));

  let finalTargetX = inputs.currentCameraParallaxX;
  let finalTargetY = inputs.currentCameraParallaxY;
  let finalTargetZ = -cameraZ + inputs.currentCameraZDepthOffset;

  if (ctx.isInterstellarRef.current) {
    const orbitAngle = time * 0.0018;
    const pitchAngle = Math.sin(time * 0.0006) * 0.22 + 0.12;

    let maxSpread = 50;
    if (ctx.celestialEntitiesRef.current && ctx.celestialEntitiesRef.current.length > 0) {
      let maxDistSq = 0;
      ctx.celestialEntitiesRef.current.forEach((entity) => {
        if (!entity.isDestroyed) {
          const wx = entity.x - currentW / 2;
          const wy = -(entity.y - currentH / 2);
          const wz = entity.z || 0;
          const dist = Math.sqrt(wx * wx + wy * wy + wz * wz) + entity.radius * 2;
          if (dist * dist > maxDistSq) {
            maxDistSq = dist * dist;
          }
        }
      });
      if (maxDistSq > 0) {
        maxSpread = Math.sqrt(maxDistSq);
      }
    }

    const dynamicRadius = Math.max(340, maxSpread * 1.15) + Math.sin(time * 0.0012) * 35;
    const currentRadius = dynamicRadius;

    const ox = currentRadius * Math.sin(orbitAngle) * Math.cos(pitchAngle);
    const oy = currentRadius * Math.sin(pitchAngle);
    const oz = -currentRadius * Math.cos(orbitAngle) * Math.cos(pitchAngle);

    finalTargetX = ox + inputs.currentCameraParallaxX;
    finalTargetY = oy + inputs.currentCameraParallaxY;
    finalTargetZ = oz + inputs.currentCameraZDepthOffset;
  }

  if (ctx.stageRef.current === 0 && ctx.screensaverOpacityRef.current > 0.01) {
    const ssTime = now * 0.00014;
    const orbitAngle = ssTime;
    const pitchAngle = Math.sin(ssTime * 0.6) * 0.14 + 0.06;

    let maxSpread = 50;
    if (ctx.celestialEntitiesRef.current && ctx.celestialEntitiesRef.current.length > 0) {
      let maxDistSq = 0;
      ctx.celestialEntitiesRef.current.forEach((entity) => {
        if (!entity.isDestroyed) {
          const wx = entity.x - currentW / 2;
          const wy = -(entity.y - currentH / 2);
          const wz = entity.z || 0;
          const dist = Math.sqrt(wx * wx + wy * wy + wz * wz) + entity.radius * 2;
          if (dist * dist > maxDistSq) maxDistSq = dist * dist;
        }
      });
      if (maxDistSq > 0) maxSpread = Math.sqrt(maxDistSq);
    }

    const dynamicRadius = Math.max(cameraZ * 0.5, maxSpread * 1.25) + cameraZ * Math.sin(ssTime * 1.2) * 0.15;
    const currentRadius = dynamicRadius;

    const ox = currentRadius * Math.sin(orbitAngle) * Math.cos(pitchAngle);
    const oy = currentRadius * Math.sin(pitchAngle);
    const oz = currentRadius * Math.cos(orbitAngle) * Math.cos(pitchAngle);

    finalTargetX = finalTargetX * (1 - ctx.screensaverOpacityRef.current) + ox * ctx.screensaverOpacityRef.current;
    finalTargetY = finalTargetY * (1 - ctx.screensaverOpacityRef.current) + oy * ctx.screensaverOpacityRef.current;
    finalTargetZ = finalTargetZ * (1 - ctx.screensaverOpacityRef.current) + oz * ctx.screensaverOpacityRef.current;
  }

  // Camera Gravity & Auto-Spaghettification
  if (ctx.cameraRef.current && ctx.celestialEntitiesRef.current && !ctx.isTransitActiveRef.current) {
    let maxPull = 0;
    let pullVec = new BABYLON.Vector3(0, 0, 0);

    ctx.celestialEntitiesRef.current.forEach((entity) => {
      if (entity.type === "blackhole" && !entity.isDestroyed) {
        const wx = entity.x - currentW / 2;
        const wy = -(entity.y - currentH / 2);
        const wz = entity.z || 0;
        const bhPos = new BABYLON.Vector3(wx, wy, wz);

        const dist = BABYLON.Vector3.Distance(ctx.cameraRef.current!.position, bhPos);
        const gravityRadius = entity.radius * 15.0; // Gravity well size

        if (dist < gravityRadius) {
          const pullFactor = 1.0 - (dist / gravityRadius);
          const strength = Math.pow(pullFactor, 2.5) * 40.0; // Exponential pull
          
          const dir = dist > 0.001 ? bhPos.subtract(ctx.cameraRef.current!.position).normalize() : new BABYLON.Vector3(0, 0, 0);
          pullVec.addInPlace(dir.scale(strength));
          
          if (pullFactor > maxPull) maxPull = pullFactor;

          // Auto-trigger spaghettification once mid-way through the event horizon
          if (dist < entity.radius * 0.95) {
            ctx.startWormholeTransit(bhPos, dir, entity.radius);
          }
        }
      }
    });

    if (maxPull > 0) {
      finalTargetX += pullVec.x;
      finalTargetY += pullVec.y;
      finalTargetZ += pullVec.z;
    }
  }

  let isTransitioning = false;
  let transitionT = 0;
  const startPos = ctx.transitionStartPosRef.current;

  if (ctx.transitionActiveRef.current && startPos) {
    const duration = 2400;
    const elapsed = now - ctx.transitionStartTimeRef.current;
    if (elapsed >= duration) {
      ctx.transitionActiveRef.current = false;
      ctx.transitionStartPosRef.current = null;
    } else {
      isTransitioning = true;
      const rawT = elapsed / duration;
      transitionT = rawT < 0.5 ? 8 * rawT * rawT * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 4) / 2;
    }
  }

  const camera = ctx.cameraRef.current;
  if (camera && !ctx.isTransitActiveRef.current) {
    if (isTransitioning && startPos) {
      const basePosX = (1 - transitionT) * startPos.x + transitionT * finalTargetX;
      const basePosY = (1 - transitionT) * startPos.y + transitionT * finalTargetY;
      const basePosZ = (1 - transitionT) * startPos.z + transitionT * finalTargetZ;

      camera.position.x = basePosX + shakeX;
      camera.position.y = basePosY + shakeY;
      camera.position.z = basePosZ + shakeZ;

      const lockX = inputs.currentLock.x * inputs.currentLock.intensity;
      const lockY = inputs.currentLock.y * inputs.currentLock.intensity;
      const lockZ = inputs.currentLock.z * inputs.currentLock.intensity;

      const lookTarget = new BABYLON.Vector3(
        lockX + Math.sin(inputs.currentCameraYaw) * 100,
        lockY + Math.sin(-inputs.currentCameraPitch) * 100,
        lockZ
      );

      camera.setTarget(lookTarget);
      camera.rotation.z = 0;
    } else {
      camera.position.x += (finalTargetX - camera.position.x) * 0.04 + shakeX;
      camera.position.y += (finalTargetY - camera.position.y) * 0.04 + shakeY;
      camera.position.z += (finalTargetZ - camera.position.z) * 0.04 + shakeZ;

      const lockX = inputs.currentLock.x * inputs.currentLock.intensity;
      const lockY = inputs.currentLock.y * inputs.currentLock.intensity;
      const lockZ = inputs.currentLock.z * inputs.currentLock.intensity;

      const lookTarget = new BABYLON.Vector3(
        lockX + Math.sin(inputs.currentCameraYaw) * 100,
        lockY + Math.sin(-inputs.currentCameraPitch) * 100,
        lockZ
      );

      camera.setTarget(lookTarget);
      camera.rotation.z = 0;
    }
  }

  if (ctx.pointsMaterialRef.current) {
    ctx.pointsMaterialRef.current.setFloat("electricPulse", 0.0);
  }

  if (ctx.composerRef.current) {
    const pipeline = ctx.composerRef.current;
    const baseBloom = 0.08 + musicAmpVal * 0.25;
    const shakeBloom = (shakeVal / 30.0) * 0.35;
    pipeline.bloomWeight = Math.min(0.55, baseBloom + shakeBloom);

    if (pipeline.chromaticAberrationEnabled && pipeline.chromaticAberration) {
      const baseAberration = 1.5 + musicBands.bass * 14.0;
      const shakeAberration = shakeVal * 0.75;
      pipeline.chromaticAberration.aberrationAmount = Math.min(22.0, baseAberration + shakeAberration);
    }

    if (pipeline.imageProcessing && pipeline.imageProcessing.vignetteEnabled) {
      pipeline.imageProcessing.vignetteWeight = 1.25 + musicAmpVal * 0.75;
    }
  }
}
