import React from "react";
import * as BABYLON from "@babylonjs/core";
import { Particle } from "../../types";
import { CelestialEntity, ParticleFilters } from "./types";
import { simulateParticles } from "./ParticleSimulationEngine";
import { setupBlackholeLensingPostProcess } from "./BlackholeLensingPostProcess";
import { setupDepthOfFieldPostProcess } from "./DepthOfFieldPostProcess";
import { setupFrameShatterPostProcess } from "./FrameShatterPostProcess";
import { SupernovaFXInstance } from "./SupernovaFX";
import { SlingshotAimState, SlingshotProbe, updateActiveProbes } from "./SlingshotEngine";
import { TdeState, updateTidalDisruption } from "./TidalDisruptionEngine";
import { spawnTidalDisruptionFX, TidalDisruptionFXInstance } from "./TidalDisruptionFX";
import { updateCollisionFlares } from "./CollisionEngine";

export interface RenderEngineContext {
  particlesRef: React.MutableRefObject<Particle[]>;
  pointsMeshRef: React.MutableRefObject<BABYLON.Mesh | null>;
  hudPlaneRef: React.MutableRefObject<BABYLON.Mesh | null>;
  sceneRef: React.MutableRefObject<BABYLON.Scene | null>;
  cameraRef: React.MutableRefObject<BABYLON.TargetCamera | null>;
  rendererRef: React.MutableRefObject<BABYLON.Engine | null>;
  composerRef: React.MutableRefObject<BABYLON.DefaultRenderingPipeline | null>;
  pointsMaterialRef: React.MutableRefObject<BABYLON.ShaderMaterial | null>;
  lensingPostProcessRef: React.MutableRefObject<BABYLON.PostProcess | null>;
  dofPostProcessRef?: React.MutableRefObject<BABYLON.PostProcess | null>;
  shatterPostProcessRef?: React.MutableRefObject<BABYLON.PostProcess | null>;
  zoomToHorizonRef?: React.MutableRefObject<number>;
  targetZoomToHorizonRef?: React.MutableRefObject<number>;
  shatterIntensityRef?: React.MutableRefObject<number>;
  cameraZRef?: React.MutableRefObject<number>;
  dofEnabledRef?: React.MutableRefObject<boolean>;
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
  transitionStartTimeRef: React.MutableRefObject<number>;
  transitionActiveRef: React.MutableRefObject<boolean>;
  transitionStartPosRef: React.MutableRefObject<BABYLON.Vector3 | null>;
  fovRef: React.MutableRefObject<number>;
  animationComplete?: () => void;
  audio: any;
  isCinematicModeRef?: React.MutableRefObject<boolean>;
  cinematicCameraModeRef?: React.MutableRefObject<'orbit' | 'horizon' | 'deep' | 'chase' | 'free'>;
  cinematicSpeedMultiplierRef?: React.MutableRefObject<number>;
  slingshotAimRef?: React.MutableRefObject<SlingshotAimState>;
  probesRef?: React.MutableRefObject<SlingshotProbe[]>;
  tdeStateRef?: React.MutableRefObject<TdeState>;
  activeTdeFxRef?: React.MutableRefObject<TidalDisruptionFXInstance | null>;
  onTdeStateChange?: (info: { isActive: boolean; stage: string; status: string }) => void;
}

export function executeRenderFrame(ctx: RenderEngineContext) {
  const currentW = window.innerWidth;
  const currentH = window.innerHeight;

  const now = Date.now();
  const speedMult = ctx.cinematicSpeedMultiplierRef?.current ?? (window as any).__cinematicSpeedMultiplier ?? 1.0;
  const dt = ctx.rendererRef.current ? ctx.rendererRef.current.getDeltaTime() : 16.666;
  const globalTimeMultiplier = Math.min((dt / 16.666) * speedMult, 3.0);

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
  ctx.isScreensaverActiveRef.current = false;
  ctx.screensaverOpacityRef.current = 0.0;

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

  // Relativistic Proximity, Time Dilation & Gravitational Redshift Calculation
  let gravitationalProximity = 0;
  let timeDilation = 1.0;
  const activeBhs = ctx.celestialEntitiesRef.current.filter((e) => e && !e.isDestroyed && e.type === "blackhole");
  const primaryBh = activeBhs[0];

  if (primaryBh) {
    const cursorDist = Math.hypot(ctx.mouseRef.current.x - primaryBh.x, ctx.mouseRef.current.y - primaryBh.y);
    const scale = primaryBh.scale !== undefined && primaryBh.scale > 0 ? primaryBh.scale : 1.0;
    const bhRadius = primaryBh.radius * scale;
    const influenceZone = bhRadius * 3.8;

    let camDist = 99999;
    if (ctx.cameraRef.current) {
      const bhWorldX = primaryBh.x - currentW / 2;
      const bhWorldY = -(primaryBh.y - currentH / 2);
      const bhWorldZ = primaryBh.z || 0;
      camDist = BABYLON.Vector3.Distance(ctx.cameraRef.current.position, new BABYLON.Vector3(bhWorldX, bhWorldY, bhWorldZ));
    }

    const effectiveDist = Math.min(cursorDist, camDist);
    if (effectiveDist < influenceZone) {
      gravitationalProximity = Math.max(0, 1.0 - (effectiveDist - bhRadius) / (influenceZone - bhRadius));
      const rsRatio = Math.min(0.96, bhRadius / Math.max(bhRadius * 1.02, effectiveDist));
      const g00 = Math.sqrt(Math.max(0.04, 1.0 - rsRatio));
      timeDilation = 1.0 / g00; // General relativistic time dilation factor
    }
  }

  // Update audio pitch drop and muffled acoustic redshift
  if (ctx.audio?.setGravitationalProximity) {
    ctx.audio.setGravitationalProximity(gravitationalProximity);
  }

  // Gravitational time dilation slows down particle clock ticks (Δτ = Δt / timeDilation)
  const clockTimeDilationFactor = Math.max(0.12, 1.0 / timeDilation);
  ctx.timeRef.current += clockTimeDilationFactor;
  const time = ctx.timeRef.current;

  // Active Gravitational Slingshot Probes & Comet Tails Physics
  if (ctx.probesRef && ctx.probesRef.current.length > 0) {
    ctx.probesRef.current = updateActiveProbes(
      ctx.probesRef.current,
      ctx.celestialEntitiesRef.current,
      ctx.ripplesRef,
      ctx.spawnTailParticleRef
    );
  }

  // Tidal Disruption Event (TDE) Accretion & Relativistic GRB Simulation
  if (ctx.tdeStateRef && ctx.tdeStateRef.current.isActive) {
    const prevTdeStage = ctx.tdeStateRef.current.stage;
    const prevTdeActive = ctx.tdeStateRef.current.isActive;

    updateTidalDisruption(
      ctx.tdeStateRef.current,
      ctx.celestialEntitiesRef.current,
      currentW,
      currentH,
      ctx.cameraShakeRef,
      ctx.ripplesRef
    );

    if (
      ctx.onTdeStateChange &&
      (ctx.tdeStateRef.current.stage !== prevTdeStage ||
        ctx.tdeStateRef.current.isActive !== prevTdeActive)
    ) {
      ctx.onTdeStateChange({
        isActive: ctx.tdeStateRef.current.isActive,
        stage: ctx.tdeStateRef.current.stage,
        status: ctx.tdeStateRef.current.statusMessage,
      });
    }

    // Update 3D Multi-Layered Particle Spray & Shredding Shader System
    if (ctx.activeTdeFxRef) {
      if (!ctx.activeTdeFxRef.current && ctx.sceneRef.current) {
        ctx.activeTdeFxRef.current = spawnTidalDisruptionFX(ctx.sceneRef.current);
      }
      if (ctx.activeTdeFxRef.current) {
        ctx.activeTdeFxRef.current.update(
          now,
          ctx.tdeStateRef.current,
          primaryBh || null,
          currentW,
          currentH
        );
      }
    }
  } else if (ctx.activeTdeFxRef?.current) {
    ctx.activeTdeFxRef.current.dispose();
    ctx.activeTdeFxRef.current = null;
  }

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
  if (ctx.ripplesRef.current.length > 25) {
    ctx.ripplesRef.current = ctx.ripplesRef.current.slice(-25);
  }

  if (ctx.collisionFlaresRef.current.length > 0) {
    const dtSeconds = Math.min(0.05, (dt || 16.666) / 1000);
    ctx.collisionFlaresRef.current = updateCollisionFlares(
      ctx.collisionFlaresRef.current,
      dtSeconds
    );
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

  if (inputs.targetLock.active && inputs.targetLock.entityId) {
    const lockedEntity = ctx.celestialEntitiesRef.current.find(
      (e) => !e.isDestroyed && e.id === inputs.targetLock.entityId
    );
    if (lockedEntity) {
      inputs.targetLock.x =
        lockedEntity.worldX !== undefined ? lockedEntity.worldX : lockedEntity.x - currentW / 2;
      inputs.targetLock.y =
        lockedEntity.worldY !== undefined ? lockedEntity.worldY : -(lockedEntity.y - currentH / 2);
      inputs.targetLock.z =
        lockedEntity.worldZ !== undefined ? lockedEntity.worldZ : (lockedEntity.z || 0);
    } else {
      inputs.targetLock.active = false;
      inputs.targetLock.entityId = null;
      if ((window as any).__onSelectedEntityChange) {
        (window as any).__onSelectedEntityChange(null);
      }
    }
  }

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

  const cameraZ = Math.max(10.0, currentH / (2 * Math.tan((ctx.fovRef.current * Math.PI) / 360))) * 2.5;

  let finalTargetX = inputs.currentCameraParallaxX;
  let finalTargetY = inputs.currentCameraParallaxY;
  let finalTargetZ = -cameraZ + inputs.currentCameraZDepthOffset;

  const isCinematic = (ctx.isCinematicModeRef?.current) || (window as any).__cinematicMode;
  const camMode = ctx.cinematicCameraModeRef?.current || (window as any).__cinematicCameraMode || 'orbit';

  if (isCinematic || ctx.isInterstellarRef.current) {
    if (camMode === 'horizon') {
      // EVENT HORIZON CLOSE-UP: Low-angle dramatic pass skimming photon sphere of the black hole
      const bh = ctx.celestialEntitiesRef.current.find((e) => e && !e.isDestroyed && e.type === "blackhole");
      if (bh) {
        const bx = bh.x - currentW / 2;
        const by = -(bh.y - currentH / 2);
        const bz = bh.z || 0;
        const r = bh.radius * 2.598 * 1.85;
        const a = time * 0.0018;
        finalTargetX = bx + Math.cos(a) * r + inputs.currentCameraParallaxX * 0.3;
        finalTargetY = by + Math.sin(time * 0.0009) * (bh.radius * 0.6) + bh.radius * 0.4 + inputs.currentCameraParallaxY * 0.3;
        finalTargetZ = bz + Math.sin(a) * r + inputs.currentCameraZDepthOffset * 0.3;
        inputs.currentLock = { x: bx, y: by, z: bz, intensity: 1.0 };
      } else {
        const orbitAngle = time * 0.0016;
        const ox = (cameraZ * 0.75) * Math.sin(orbitAngle);
        const oz = (cameraZ * 0.75) * Math.cos(orbitAngle);
        finalTargetX = ox + inputs.currentCameraParallaxX;
        finalTargetY = cameraZ * 0.2 + inputs.currentCameraParallaxY;
        finalTargetZ = oz + inputs.currentCameraZDepthOffset;
      }
    } else if (camMode === 'deep') {
      // DEEP SPACE PERCH: Elevated majestic wide view looking down at orbital plane
      const deepZ = -cameraZ * 1.5;
      finalTargetX = Math.sin(time * 0.0006) * 220 + inputs.currentCameraParallaxX;
      finalTargetY = cameraZ * 0.55 + inputs.currentCameraParallaxY;
      finalTargetZ = deepZ + inputs.currentCameraZDepthOffset;
      inputs.currentLock = { x: 0, y: -cameraZ * 0.1, z: 0, intensity: 1.0 };
    } else if (camMode === 'chase') {
      // CELESTIAL CHASE: Dynamic camera tracking closest planet or companion body
      const companions = ctx.celestialEntitiesRef.current.filter(
        (e) => !e.isDestroyed && e.type !== "galaxy" && e.type !== "nebula"
      );
      if (companions.length > 0) {
        const tracked = companions[0];
        const tx = tracked.x - currentW / 2;
        const ty = -(tracked.y - currentH / 2);
        const tz = tracked.z || 0;
        finalTargetX = tx - (tracked.vx || 0) * 80 + 120 + inputs.currentCameraParallaxX * 0.4;
        finalTargetY = ty - (tracked.vy || 0) * 80 + 80 + inputs.currentCameraParallaxY * 0.4;
        finalTargetZ = tz + 220 + inputs.currentCameraZDepthOffset * 0.4;
        inputs.currentLock = { x: tx, y: ty, z: tz, intensity: 1.0 };
      } else {
        const orbitAngle = time * 0.0016;
        const ox = (cameraZ * 0.75) * Math.sin(orbitAngle);
        const oz = (cameraZ * 0.75) * Math.cos(orbitAngle);
        finalTargetX = ox;
        finalTargetY = cameraZ * 0.2;
        finalTargetZ = oz;
      }
    } else if (camMode === 'free') {
      // FREE INERTIA: User-guided with silky inertia damping
      finalTargetX = inputs.currentCameraParallaxX * 2.2;
      finalTargetY = inputs.currentCameraParallaxY * 2.2;
      finalTargetZ = -cameraZ + inputs.currentCameraZDepthOffset;
    } else {
      // 'orbit' DEFAULT: Majestic, stable 360 sweeping orbit without oscillating pitch loops
      const orbitAngle = time * 0.0012;
      const pitchAngle = 0.16;

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

      const stableRadius = Math.max(cameraZ * 0.55, maxSpread * 1.25);
      const ox = stableRadius * Math.sin(orbitAngle) * Math.cos(pitchAngle);
      const oy = stableRadius * Math.sin(pitchAngle);
      const oz = stableRadius * Math.cos(orbitAngle) * Math.cos(pitchAngle);

      finalTargetX = ox + inputs.currentCameraParallaxX;
      finalTargetY = oy + inputs.currentCameraParallaxY;
      finalTargetZ = oz + inputs.currentCameraZDepthOffset;
    }
  }

  if (ctx.stageRef.current === 0 && !ctx.isInterstellarRef.current && !isCinematic) {
    if (inputs.targetLock && inputs.targetLock.active) {
      // User clicked or locked onto celestial object: smooth cinematic focus
      finalTargetX = inputs.targetLock.x * 0.45 + inputs.currentCameraParallaxX * 0.6;
      finalTargetY = inputs.targetLock.y * 0.45 + inputs.currentCameraParallaxY * 0.6;
      finalTargetZ = -cameraZ * 0.85 + inputs.currentCameraZDepthOffset;
    } else {
      // Stage 0 is the hero "CURTIS CLICK" typography: lock camera front-facing with pristine parallax
      finalTargetX = inputs.currentCameraParallaxX;
      finalTargetY = inputs.currentCameraParallaxY;
      finalTargetZ = -cameraZ + inputs.currentCameraZDepthOffset;
    }
  }

  // Scroll-to-Zoom towards Black Hole Event Horizon & Singularity Core
  const targetZoom = ctx.targetZoomToHorizonRef?.current ?? (window as any).__targetHorizonZoom ?? 0.0;
  if (ctx.zoomToHorizonRef) {
    ctx.zoomToHorizonRef.current += (targetZoom - ctx.zoomToHorizonRef.current) * 0.08;
  }
  const currentZoom = Math.min(0.92, Math.max(0.0, ctx.zoomToHorizonRef?.current ?? (window as any).__targetHorizonZoom ?? 0.0));
  (window as any).__horizonZoom = currentZoom;

  const bh = ctx.celestialEntitiesRef.current.find((e) => !e.isDestroyed && e.type === "blackhole");
  if (bh && currentZoom > 0.001) {
    const bx = bh.x - currentW / 2;
    const by = -(bh.y - currentH / 2);
    const bz = bh.z || 0;
    const bhRadius = bh.radius * (bh.scale || 1.0);

    // Camera dollies smoothly towards the black hole center without penetrating inside near-plane clipping
    const minApproachDist = Math.max(bhRadius * 0.8, 55.0);
    const approachDist = minApproachDist + (1.0 - Math.min(0.9, currentZoom)) * (cameraZ * 0.55);
    const approachAngle = time * 0.0006;
    const zoomTargetX = bx + Math.sin(approachAngle) * approachDist * 0.25;
    const zoomTargetY = by + Math.cos(approachAngle) * approachDist * 0.2;
    const zoomTargetZ = bz - approachDist * 0.85;

    const blendFactor = Math.min(1.0, Math.pow(currentZoom, 1.15));
    finalTargetX = (1 - blendFactor) * finalTargetX + blendFactor * zoomTargetX;
    finalTargetY = (1 - blendFactor) * finalTargetY + blendFactor * zoomTargetY;
    finalTargetZ = (1 - blendFactor) * finalTargetZ + blendFactor * zoomTargetZ;

    inputs.currentLock.x = (1 - blendFactor) * inputs.currentLock.x + blendFactor * bx;
    inputs.currentLock.y = (1 - blendFactor) * inputs.currentLock.y + blendFactor * by;
    inputs.currentLock.z = (1 - blendFactor) * inputs.currentLock.z + blendFactor * bz;
    inputs.currentLock.intensity = Math.max(inputs.currentLock.intensity, blendFactor);

    // Frame-Shattering activation as camera approaches the center (currentZoom >= 0.82)
    let shatterIntensity = 0.0;
    if (currentZoom >= 0.82) {
      shatterIntensity = Math.min(1.0, (currentZoom - 0.82) / 0.16);

      // Camera shake violently surges as spacetime ruptures
      const shatterShake = Math.pow(shatterIntensity, 1.8) * 45.0;
      ctx.cameraShakeRef.current = Math.max(ctx.cameraShakeRef.current, shatterShake);

      // Trigger auditory spacetime rupture if crossing shatter threshold
      if (shatterIntensity > 0.45 && !(window as any).__hasShatteredSound) {
        (window as any).__hasShatteredSound = true;
        if (ctx.audio?.playFrameShatter) {
          ctx.audio.playFrameShatter();
        } else if (ctx.audio?.playSupernova) {
          ctx.audio.playSupernova();
        }
      }
    } else {
      (window as any).__hasShatteredSound = false;
    }

    if (ctx.shatterIntensityRef) {
      ctx.shatterIntensityRef.current = shatterIntensity;
    }
    (window as any).__shatterIntensity = shatterIntensity;
  } else {
    if (ctx.shatterIntensityRef) {
      ctx.shatterIntensityRef.current = 0.0;
    }
    (window as any).__shatterIntensity = 0.0;
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
  if (camera) {
    if (ctx.isTransitActiveRef.current) {
      const transitElapsed =
        ctx.transitStartTimeRef.current > 0
          ? now - ctx.transitStartTimeRef.current
          : 99999;
      if (transitElapsed > 3500) {
        ctx.isTransitActiveRef.current = false;
      }
    }

    if (!ctx.isTransitActiveRef.current) {
      if (
        isNaN(camera.position.x) ||
        isNaN(camera.position.y) ||
        isNaN(camera.position.z)
      ) {
        camera.position.set(0, 0, -cameraZ);
      }

      if (isTransitioning && startPos) {
        const basePosX = (1 - transitionT) * startPos.x + transitionT * finalTargetX;
        const basePosY = (1 - transitionT) * startPos.y + transitionT * finalTargetY;
        const basePosZ = (1 - transitionT) * startPos.z + transitionT * finalTargetZ;

        camera.position.x = (isNaN(basePosX) ? 0 : basePosX) + shakeX;
        camera.position.y = (isNaN(basePosY) ? 0 : basePosY) + shakeY;
        camera.position.z = (isNaN(basePosZ) ? -cameraZ : basePosZ) + shakeZ;

        const rawLockX = inputs.currentLock.x * inputs.currentLock.intensity;
        const rawLockY = inputs.currentLock.y * inputs.currentLock.intensity;
        const rawLockZ = inputs.currentLock.z * inputs.currentLock.intensity;
        const lockX = isNaN(rawLockX) ? 0 : rawLockX;
        const lockY = isNaN(rawLockY) ? 0 : rawLockY;
        const lockZ = isNaN(rawLockZ) ? 0 : rawLockZ;

        camera.setTarget(new BABYLON.Vector3(lockX, lockY, lockZ));
        camera.rotation.z = 0;
      } else {
        const sTargetX = isNaN(finalTargetX) ? 0 : finalTargetX;
        const sTargetY = isNaN(finalTargetY) ? 0 : finalTargetY;
        const sTargetZ = isNaN(finalTargetZ) ? -cameraZ : finalTargetZ;

        camera.position.x += (sTargetX - camera.position.x) * 0.04 + shakeX;
        camera.position.y += (sTargetY - camera.position.y) * 0.04 + shakeY;
        camera.position.z += (sTargetZ - camera.position.z) * 0.04 + shakeZ;

        if (camera.minZ > 0.5) {
          camera.minZ = 0.5;
        }

        const rawLockX = inputs.currentLock.x * inputs.currentLock.intensity;
        const rawLockY = inputs.currentLock.y * inputs.currentLock.intensity;
        const rawLockZ = inputs.currentLock.z * inputs.currentLock.intensity;
        const lockX = isNaN(rawLockX) ? 0 : rawLockX;
        const lockY = isNaN(rawLockY) ? 0 : rawLockY;
        const lockZ = isNaN(rawLockZ) ? 0 : rawLockZ;

        const pitchOffset = isNaN(inputs.currentCameraPitch) ? 0 : inputs.currentCameraPitch;
        const yawOffset = isNaN(inputs.currentCameraYaw) ? 0 : inputs.currentCameraYaw;

        camera.setTarget(
          new BABYLON.Vector3(
            lockX - yawOffset * 100,
            lockY + pitchOffset * 100,
            lockZ
          )
        );
        camera.rotation.z = 0;
      }

      // Subtle cinematic optical focal breathing
      const baseFov = (ctx.fovRef.current * Math.PI) / 180;
      if (isCinematic) {
        const fovPulse = Math.sin(time * 0.001) * 0.025;
        camera.fov = baseFov + fovPulse;
      } else {
        camera.fov = baseFov;
      }
    }
  }

  if (ctx.pointsMaterialRef.current) {
    ctx.pointsMaterialRef.current.setFloat("electricPulse", 0.0);
    const isCinematic = (ctx.isCinematicModeRef?.current) || (window as any).__cinematicMode;
    const isDofExplicitlyEnabled = ctx.dofEnabledRef ? ctx.dofEnabledRef.current : ((window as any).__dofEnabled !== false);
    const dofActive = (isCinematic && isDofExplicitlyEnabled) ? 1.0 : 0.0;
    ctx.pointsMaterialRef.current.setFloat("uCinematicMode", isCinematic ? 1.0 : 0.0);
    ctx.pointsMaterialRef.current.setFloat("uDofActive", dofActive);
    ctx.pointsMaterialRef.current.setFloat("uCameraZ", ctx.cameraZRef?.current ?? 2000);
    if (camera) {
      ctx.pointsMaterialRef.current.setVector3("uCameraPos", camera.position);
    }
  }

  if (ctx.composerRef.current) {
    const pipeline = ctx.composerRef.current;
    const isCinematic = (ctx.isCinematicModeRef?.current) || (window as any).__cinematicMode;
    const baseBloom = (isCinematic ? 0.10 : 0.06) + musicAmpVal * (isCinematic ? 0.28 : 0.20);
    const shakeBloom = (shakeVal / 30.0) * 0.30;
    pipeline.bloomWeight = Math.min(0.55, baseBloom + shakeBloom);

    if (pipeline.chromaticAberrationEnabled && pipeline.chromaticAberration) {
      const baseAberration = (isCinematic ? 2.5 : 1.5) + musicBands.bass * 14.0;
      const shakeAberration = shakeVal * 0.75;
      pipeline.chromaticAberration.aberrationAmount = Math.min(24.0, baseAberration + shakeAberration);
    }

    if (pipeline.imageProcessing && pipeline.imageProcessing.vignetteEnabled) {
      pipeline.imageProcessing.vignetteWeight = (isCinematic ? 1.35 : 1.25) + musicAmpVal * 0.75;
      if (isCinematic) {
        pipeline.imageProcessing.contrast = 1.22;
        pipeline.imageProcessing.exposure = 1.08;
      }
    }
  }

  if (camera && ctx.sceneRef.current && ctx.rendererRef.current) {
    setupBlackholeLensingPostProcess(
      camera,
      ctx.sceneRef.current,
      ctx.rendererRef.current,
      ctx.lensingPostProcessRef,
      ctx.celestialEntitiesRef
    );

    if (ctx.dofPostProcessRef) {
      setupDepthOfFieldPostProcess(
        camera,
        ctx.sceneRef.current,
        ctx.rendererRef.current,
        ctx.dofPostProcessRef,
        ctx.isCinematicModeRef,
        ctx.celestialEntitiesRef,
        ctx.cameraZRef,
        ctx.dofEnabledRef
      );
    }

    if (ctx.shatterPostProcessRef && ctx.shatterIntensityRef) {
      setupFrameShatterPostProcess(
        camera,
        ctx.sceneRef.current,
        ctx.rendererRef.current,
        ctx.shatterPostProcessRef,
        ctx.celestialEntitiesRef,
        ctx.shatterIntensityRef
      );
    }
  }
}
