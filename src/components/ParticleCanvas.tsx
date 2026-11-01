import React, { useEffect, useRef } from "react";
import * as BABYLON from "@babylonjs/core";
import { audio } from "../utils/audio";
import { Particle } from "../types";
import { drawStageLayoutTemplate } from "./ParticleCanvas/ParticleUtils";
import { CelestialEntity, ParticleCanvasProps, ParticleFilters } from "./ParticleCanvas/types";
import {
  resolveCelestialCollision,
  swallowEntity as _swallowEntity,
  createDustSplash as _createDustSplash,
  createShatterDebris as _createShatterDebris,
  createSpaghettificationDebris as _createSpaghettificationDebris,
} from "./ParticleCanvas/CollisionEngine";
import {
  fetchNextGeminiScene as _fetchNextGeminiScene,
  registerAndSaveSequence as _registerAndSaveSequence,
  generateInterstellarScene as _generateInterstellarScene,
} from "./ParticleCanvas/SceneManager";
import {
  transitionToNewEntities as _transitionToNewEntities,
  mapParticlesToInterstellar as _mapParticlesToInterstellar,
  mapParticlesToStage as _mapParticlesToStage,
  updateTypographyStage as _updateTypographyStage,
  startWormholeTransit as _startWormholeTransit,
  triggerCalmCosmicShift as _triggerCalmCosmicShift,
  CosmicTransitionStateMachine,
} from "./ParticleCanvas/TransitionManager";
import {
  spawnSupernovaFX,
  SupernovaFXInstance,
  setupBlackholeLensingPostProcess,
  getSpacetimeFabricDistortion as _getSpacetimeFabricDistortion,
} from "./ParticleCanvas/EffectsManager";
import { updateHudTexture } from "./ParticleCanvas/HUDManager";
import { simulateParticles } from "./ParticleCanvas/ParticleSimulationEngine";
import { RemeshCover } from "./ParticleCanvas/RemeshCover";
import { executeRenderFrame } from "./ParticleCanvas/RenderEngine";
import { buildParticleSystem } from "./ParticleCanvas/ParticleSystemBuilder";
import { setupParticleCanvasEvents } from "./ParticleCanvas/ParticleCanvasEvents";
import { updateCelestial3DMeshes as _updateCelestial3DMeshes } from "./ParticleCanvas/CelestialMeshSynchronizer";
import { initializeScene } from "./ParticleCanvas/SceneSetup";
import { SlingshotAimState, SlingshotProbe } from "./ParticleCanvas/SlingshotEngine";
import { TdeState, createInitialTdeState, triggerTidalDisruptionEvent } from "./ParticleCanvas/TidalDisruptionEngine";
import { TidalDisruptionFXInstance } from "./ParticleCanvas/TidalDisruptionFX";

export const ParticleCanvas: React.FC<ParticleCanvasProps> = ({
  stage,
  isInterstellar = false,
  animationComplete,
  onSequenceGenerated,
  showDebug = false,
  particleFilters,
  textParticleSpeed = 0.12,
  ambientParticleSpeed = 0.15,
  objectParticleSpeed = 0.15,
  onTransitionStateChange,
  transitionStateMachineRef,
  isCinematicMode = false,
  cinematicCameraMode = 'orbit',
  cinematicSpeedMultiplier = 1.0,
  anamorphicFlaresEnabled = true,
  dofEnabled = true,
  onSelectedEntityChange,
  onTdeStateChange,
  isSlingshotMode = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const coverElementRef = useRef<HTMLDivElement>(null);
  const remeshCoverRef = useRef<RemeshCover | null>(null);
  if (!remeshCoverRef.current) {
    remeshCoverRef.current = new RemeshCover((opacity, phase) => {
      const el = coverElementRef.current;
      if (el) {
        el.style.opacity = String(opacity);
        el.dataset.phase = phase;
      }
    });
  }
  const remeshCover = remeshCoverRef.current;

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { remeshCover.reducedMotion = preference.matches; };
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, [remeshCover]);

  // Slingshot Probe and Tidal Disruption Event (TDE) Physics State
  const slingshotAimRef = useRef<SlingshotAimState>({
    isAiming: false,
    originX: 0,
    originY: 0,
    currentX: 0,
    currentY: 0,
    trajectoryPoints: [],
  });
  const probesRef = useRef<SlingshotProbe[]>([]);
  const tdeStateRef = useRef<TdeState>(createInitialTdeState());
  const activeTdeFxRef = useRef<TidalDisruptionFXInstance | null>(null);
  const onTdeStateChangeRef = useRef(onTdeStateChange);
  useEffect(() => {
    onTdeStateChangeRef.current = onTdeStateChange;
  }, [onTdeStateChange]);

  const triggerTDE = () => {
    const success = triggerTidalDisruptionEvent(
      tdeStateRef.current,
      celestialEntitiesRef.current,
      window.innerWidth,
      window.innerHeight
    );
    if (success && onTdeStateChangeRef.current) {
      onTdeStateChangeRef.current({
        isActive: true,
        stage: tdeStateRef.current.stage,
        status: tdeStateRef.current.statusMessage,
      });
    }
    return success;
  };

  useEffect(() => {
    (window as any).triggerTDE = triggerTDE;
  }, []);

  const isCinematicModeRef = useRef<boolean>(isCinematicMode);
  useEffect(() => {
    isCinematicModeRef.current = isCinematicMode;
    (window as any).__cinematicMode = isCinematicMode;
  }, [isCinematicMode]);

  const cinematicCameraModeRef = useRef<'orbit' | 'horizon' | 'deep' | 'chase' | 'free'>(cinematicCameraMode);
  useEffect(() => {
    cinematicCameraModeRef.current = cinematicCameraMode;
    (window as any).__cinematicCameraMode = cinematicCameraMode;
  }, [cinematicCameraMode]);

  const cinematicSpeedMultiplierRef = useRef<number>(cinematicSpeedMultiplier);
  useEffect(() => {
    cinematicSpeedMultiplierRef.current = cinematicSpeedMultiplier;
    (window as any).__cinematicSpeedMultiplier = cinematicSpeedMultiplier;
    audio.setTimeDilation(cinematicSpeedMultiplier);
  }, [cinematicSpeedMultiplier]);

  useEffect(() => {
    (window as any).__anamorphicFlare = anamorphicFlaresEnabled;
  }, [anamorphicFlaresEnabled]);

  const dofEnabledRef = useRef<boolean>(dofEnabled);
  useEffect(() => {
    dofEnabledRef.current = dofEnabled;
    (window as any).__dofEnabled = dofEnabled;
  }, [dofEnabled]);

  useEffect(() => {
    (window as any).__onSelectedEntityChange = onSelectedEntityChange;
  }, [onSelectedEntityChange]);

  const textParticleSpeedRef = useRef<number>(textParticleSpeed);
  useEffect(() => {
    textParticleSpeedRef.current = textParticleSpeed;
  }, [textParticleSpeed]);

  const ambientParticleSpeedRef = useRef<number>(ambientParticleSpeed);
  useEffect(() => {
    ambientParticleSpeedRef.current = ambientParticleSpeed;
  }, [ambientParticleSpeed]);

  const objectParticleSpeedRef = useRef<number>(objectParticleSpeed);
  useEffect(() => {
    objectParticleSpeedRef.current = objectParticleSpeed;
  }, [objectParticleSpeed]);

  const particleFiltersRef = useRef<ParticleFilters>(
    particleFilters || {
      ambient: true,
      celestial: true,
      bridges: true,
      tails: true,
      typography: true,
    }
  );

  useEffect(() => {
    if (particleFilters) {
      particleFiltersRef.current = {
        ambient: particleFilters.ambient !== false,
        celestial: particleFilters.celestial !== false,
        bridges: particleFilters.bridges !== false,
        tails: particleFilters.tails !== false,
        typography: particleFilters.typography !== false,
      };
    }
  }, [particleFilters]);

  // Babylon.js Refs
  const rendererRef = useRef<BABYLON.Engine | null>(null);
  const composerRef = useRef<BABYLON.DefaultRenderingPipeline | null>(null);
  const sceneRef = useRef<BABYLON.Scene | null>(null);
  const cameraRef = useRef<BABYLON.TargetCamera | null>(null);
  const fovRef = useRef<number>(60);
  const cameraZRef = useRef<number>(600);
  const pointsMeshRef = useRef<BABYLON.Mesh | null>(null);
  const pointsMaterialRef = useRef<BABYLON.ShaderMaterial | null>(null);
  const hudPlaneRef = useRef<BABYLON.Mesh | null>(null);
  const hudTextureRef = useRef<BABYLON.DynamicTexture | null>(null);
  const celestialGroupRef = useRef<BABYLON.TransformNode | null>(null);
  const celestialMeshInstancesRef = useRef<
    { id: string; mesh: BABYLON.TransformNode | BABYLON.Mesh; entityRef: CelestialEntity }[]
  >([]);
  const lensingPostProcessRef = useRef<BABYLON.PostProcess | null>(null);
  const dofPostProcessRef = useRef<BABYLON.PostProcess | null>(null);
  const shatterPostProcessRef = useRef<BABYLON.PostProcess | null>(null);
  const targetZoomToHorizonRef = useRef<number>(0.0);
  const zoomToHorizonRef = useRef<number>(0.0);
  const shatterIntensityRef = useRef<number>(0.0);
  const wormholePostProcessRef = useRef<BABYLON.PostProcess | null>(null);
  const wormholeIntensityRef = useRef<number>(0.0);
  const wormholeTimeRef = useRef<number>(0.0);

  // Unified Input Controller for continuous mathematical interpolation
  const inputControllerRef = useRef({
    targetScrollTimeline: 0,
    targetCameraZDepthOffset: 0,
    targetCameraParallaxX: 0,
    targetCameraParallaxY: 0,
    targetCameraPitch: 0,
    targetCameraYaw: 0,
    targetLock: { x: 0, y: 0, z: 0, active: false, entityId: null as string | null },

    currentScrollTimeline: 0,
    currentCameraZDepthOffset: 0,
    currentCameraParallaxX: 0,
    currentCameraParallaxY: 0,
    currentCameraPitch: 0,
    currentCameraYaw: 0,
    currentLock: { x: 0, y: 0, z: 0, intensity: 0.0 },

    gyroActive: false,
  });

  // Cinematic Camera Transition Refs
  const transitionStartTimeRef = useRef<number>(0);
  const transitionActiveRef = useRef<boolean>(false);
  const transitionStartPosRef = useRef<BABYLON.Vector3 | null>(null);

  // Smooth Morphing Transitions for Celestial Entities
  const entityTransitionActiveRef = useRef<boolean>(false);
  const entityTransitionStartTimeRef = useRef<number>(0);

  // Simulation State Refs
  const nextGeminiSceneRef = useRef<any>(null);
  const isFetchingGeminiRef = useRef<boolean>(false);
  const stageTargetsRef = useRef<{ x: number; y: number; color: string }[][]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const stageRef = useRef<number>(stage);
  const isInterstellarRef = useRef<boolean>(isInterstellar);
  const isTransitActiveRef = useRef<boolean>(false);
  const cancelTransitRef = useRef<(() => void) | null>(null);
  const transitTargetPosRef = useRef<BABYLON.Vector3 | null>(null);
  const transitDirRef = useRef<BABYLON.Vector3 | null>(null);
  const transitStartTimeRef = useRef<number>(0);
  const lastStageChangeRef = useRef<number>(Date.now());
  const smoothedAmpRef = useRef<number>(0);
  const smoothedBassRef = useRef<number>(0);
  const smoothedMidRef = useRef<number>(0);
  const smoothedTrebleRef = useRef<number>(0);
  const mouseRef = useRef<{ x: number; y: number; lastMoved: number }>({
    x: -1000,
    y: -1000,
    lastMoved: Date.now(),
  });
  const lastAutonomousEventTimeRef = useRef<number>(Date.now());
  const activeWormholeRef = useRef<{
    startEntityIdx: number;
    endEntityIdx: number;
    life: number;
    duration: number;
  } | null>(null);
  const activeSupernovaFxRef = useRef<SupernovaFXInstance | null>(null);
  const supernovaRef = useRef<{
    time: number;
    exploded: boolean;
    transitioned?: boolean;
    isCalmShift?: boolean;
    x: number;
    y: number;
    worldPos?: BABYLON.Vector3;
  } | null>(null);
  const ripplesRef = useRef<{ x: number; y: number; life: number }[]>([]);
  const cameraShakeRef = useRef<number>(0);
  const collisionFlaresRef = useRef<
    Array<{ mesh: BABYLON.Mesh; life: number; maxLife: number; initialRadius: number }>
  >([]);
  const mappingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const inspiralIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollVelocityRef = useRef<number>(0);
  const lastScrollYRef = useRef<number>(
    window.scrollY || document.documentElement.scrollTop
  );
  const celestialEntitiesRef = useRef<CelestialEntity[]>([]);
  const archetypeRef = useRef<string>("");

  // Screensaver Mode and Galactic Pulse State Refs
  const lastUserActivityRef = useRef<number>(Date.now());
  const isScreensaverActiveRef = useRef<boolean>(false);
  const screensaverOpacityRef = useRef<number>(0);
  const lastShockwaveTimeRef = useRef<number>(Date.now());
  const isShockwaveActiveRef = useRef<boolean>(false);
  const shockwaveStartTimeRef = useRef<number>(Date.now());

  const spawnTailParticleRef = useRef<
    | ((
        x: number,
        y: number,
        z: number,
        vx: number,
        vy: number,
        color: string,
        decayRate?: number
      ) => void)
    | null
  >(null);
  const glowLayerRef = useRef<BABYLON.GlowLayer | null>(null);
  const tailStartIndexRef = useRef<number>(-1);
  const timeRef = useRef<number>(0);
  const interstellarSceneGeneratedTimeRef = useRef<number>(Date.now());

  // Helper Wrappers using modularized managers
  const fetchNextGeminiScene = () =>
    _fetchNextGeminiScene(isFetchingGeminiRef, nextGeminiSceneRef);

  const registerAndSaveSequence = (
    systemName: string,
    systemDesc: string,
    systemTags: string[],
    entitiesList: CelestialEntity[]
  ) =>
    _registerAndSaveSequence(
      systemName,
      systemDesc,
      systemTags,
      entitiesList,
      archetypeRef.current,
      onSequenceGenerated
    );

  const generateInterstellarScene = (
    width: number,
    height: number,
    forceInterstellar = false,
    supernovaX?: number,
    supernovaY?: number
  ) => {
    remeshCover.begin();
    _generateInterstellarScene(
      width,
      height,
      isInterstellarRef.current,
      forceInterstellar,
      celestialEntitiesRef,
      nextGeminiSceneRef,
      isFetchingGeminiRef,
      archetypeRef,
      entityTransitionActiveRef,
      entityTransitionStartTimeRef,
      interstellarSceneGeneratedTimeRef,
      supernovaX,
      supernovaY,
      onSequenceGenerated
    );
  };

  const transitionToNewEntities = (
    newEntities: CelestialEntity[],
    spawnX?: number,
    spawnY?: number
  ) =>
    _transitionToNewEntities(
      celestialEntitiesRef.current,
      newEntities,
      spawnX ?? window.innerWidth / 2,
      spawnY ?? window.innerHeight / 2,
      entityTransitionActiveRef,
      entityTransitionStartTimeRef
    );

  const mapParticlesToInterstellar = (
    width: number,
    height: number,
    triggerBurst = false,
    skipTextUpdate = false
  ) => {
    remeshCover.begin();
    _mapParticlesToInterstellar(
      width,
      height,
      celestialEntitiesRef,
      archetypeRef,
      particlesRef,
      tailStartIndexRef,
      stageRef.current,
      triggerBurst,
      skipTextUpdate
    );
    remeshCover.remapped(particlesRef.current);
  };

  const mapParticlesToStage = (targetStage: number, triggerBurst: boolean) => {
    remeshCover.begin();
    _mapParticlesToStage(
      targetStage,
      triggerBurst,
      stageTargetsRef,
      particlesRef,
      tailStartIndexRef
    );
    remeshCover.remapped(particlesRef.current);
  };

  const internalTransitionSMRef = useRef<CosmicTransitionStateMachine>(new CosmicTransitionStateMachine());
  const sm = transitionStateMachineRef ? transitionStateMachineRef.current || internalTransitionSMRef.current : internalTransitionSMRef.current;

  useEffect(() => {
    if (transitionStateMachineRef && !transitionStateMachineRef.current) {
      transitionStateMachineRef.current = sm;
    }
    const unsubscribe = sm.subscribe((info) => {
      if (onTransitionStateChange) {
        onTransitionStateChange(info);
      }
    });
    return unsubscribe;
  }, [sm, onTransitionStateChange, transitionStateMachineRef]);

  const triggerSceneClimax = () => {
    const ww = window.innerWidth;
    const wh = window.innerHeight;
    (window as any).__lastClimaxTime = Date.now();

    const activeEntities = celestialEntitiesRef.current.filter(
      (e) => !e.isDestroyed && !e.isOutgoing
    );
    const primary =
      activeEntities.find(
        (e) =>
          e.type === "blackhole" ||
          e.type === "gargantua" ||
          e.type === "quasar" ||
          e.type === "neutron_star" ||
          e.type === "magnetar" ||
          e.type === "star"
      ) || activeEntities[0];

    const epicenterX = primary ? primary.x : ww / 2;
    const epicenterY = primary ? primary.y : wh / 2;
    const epicenterZ = primary ? primary.z || 0 : 0;
    const climaxColor = primary?.color || "#a5f3fc";

    cameraShakeRef.current = Math.max(cameraShakeRef.current, 11.0);
    if (audio.playRippleShockwave) audio.playRippleShockwave();
    if (audio.playDeepThunderRoll) audio.playDeepThunderRoll(3.4, 0.48);

    // Launch 3 staggered concentric shockwave ripples across the cosmos
    ripplesRef.current.push({ x: epicenterX, y: epicenterY, life: 1.0 });
    const rTimer1 = setTimeout(() => {
      ripplesRef.current.push({ x: epicenterX, y: epicenterY, life: 0.95 });
    }, 420);
    const rTimer2 = setTimeout(() => {
      ripplesRef.current.push({ x: epicenterX, y: epicenterY, life: 0.88 });
    }, 900);
    mappingTimersRef.current.push(rTimer1, rTimer2);

    // Inject rotational + radial momentum surge into foreground celestial particles
    const pool = particlesRef.current;
    const limit =
      tailStartIndexRef.current !== -1 ? tailStartIndexRef.current : pool.length;
    for (let i = 0; i < limit; i++) {
      const p = pool[i];
      if (!p || p.isProjectText || p.isCosmicAmbient || p.interstellarType === "background_galaxy") {
        continue;
      }
      const dx = p.x - epicenterX;
      const dy = p.y - epicenterY;
      const dist = Math.sqrt(dx * dx + dy * dy) + 12;
      const invDist = 1 / dist;
      const radialBoost = Math.min(9.5, 420 / (dist * 0.18 + 30));
      const tangBoost = radialBoost * 0.85;
      p.vx += (dx * invDist * radialBoost + -dy * invDist * tangBoost) * 0.65;
      p.vy += (dy * invDist * radialBoost + dx * invDist * tangBoost) * 0.65;
      p.vz += (Math.random() - 0.5) * 6.0;
    }

    // Emit relativistic coronal / polar spark burst from the climax epicenter (screen coordinates expected by spawnTailParticle)
    const spawnFn = spawnTailParticleRef.current;
    if (spawnFn) {
      for (let s = 0; s < 64; s++) {
        const angle = (s / 64) * Math.PI * 2 + (Math.random() - 0.5) * 0.15;
        const speed = 7 + Math.random() * 18;
        spawnFn(
          epicenterX + Math.cos(angle) * 14,
          epicenterY + Math.sin(angle) * 14,
          epicenterZ + (Math.random() - 0.5) * 24,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          s % 3 === 0 ? "#ffffff" : climaxColor,
          0.016 + Math.random() * 0.018
        );
      }
    }
  };

  const triggerSupernovaTransition = (x?: number, y?: number) => {
    if (inspiralIntervalRef.current) {
      clearInterval(inspiralIntervalRef.current);
      inspiralIntervalRef.current = null;
    }
    if (remeshCover.reducedMotion) {
      generateInterstellarScene(window.innerWidth, window.innerHeight, true);
      mapParticlesToInterstellar(window.innerWidth, window.innerHeight);
      animationComplete?.();
      return;
    }
    const posX = x ?? window.innerWidth / 2;
    const posY = y ?? window.innerHeight / 2;
    const worldPos = new BABYLON.Vector3(
      posX - window.innerWidth / 2,
      -(posY - window.innerHeight / 2),
      0
    );

    sm.executeBlackHoleToSupernovaTransition({
      x: posX,
      y: posY,
      onImplode: () => {
        (window as any).__lastClimaxTime = Date.now();
        cameraShakeRef.current = 12.0;
        audio.playSupernova();

        // Begin core-collapse implosion phase (0 - 2600ms)
        supernovaRef.current = {
          time: Date.now(),
          exploded: false,
          isCalmShift: false,
          x: posX,
          y: posY,
          worldPos,
        };

        if (sceneRef.current) {
          if (activeSupernovaFxRef.current) {
            activeSupernovaFxRef.current.dispose();
          }
          activeSupernovaFxRef.current = spawnSupernovaFX(sceneRef.current, worldPos);
        }
      },
      onDetonate: () => {
        isInterstellarRef.current = true;
        celestialEntitiesRef.current.forEach((entity) => {
          entity.isDestroyed = true;
        });

        if (supernovaRef.current) {
          supernovaRef.current.exploded = true;
          supernovaRef.current.isCalmShift = false;
        } else {
          supernovaRef.current = {
            time: Date.now() - 2600,
            exploded: true,
            isCalmShift: false,
            x: posX,
            y: posY,
            worldPos,
          };
        }

        cameraShakeRef.current = 24.0;
        ripplesRef.current.push({ x: posX, y: posY, life: 1.0 });
        const detRippleTimer = setTimeout(() => {
          ripplesRef.current.push({ x: posX, y: posY, life: 0.92 });
        }, 360);
        mappingTimersRef.current.push(detRippleTimer);

        audio.playRippleShockwave();
        fetchNextGeminiScene();
      },
      onRebirth: () => {
        // Stop the outgoing blast before forming the replacement composition.
        activeSupernovaFxRef.current?.dispose();
        activeSupernovaFxRef.current = null;
        supernovaRef.current = null;
        (window as any).__lastClimaxTime = 0;
        if (cameraRef.current) {
          transitionStartTimeRef.current = Date.now();
          transitionActiveRef.current = true;
          transitionStartPosRef.current = cameraRef.current.position.clone();
        }
        generateInterstellarScene(window.innerWidth, window.innerHeight, true, posX, posY);
        mapParticlesToInterstellar(window.innerWidth, window.innerHeight, true);
      },
      onComplete: () => {
        if (animationComplete) animationComplete();
      },
    });
  };

  const triggerCalmCosmicShift = () => {
    triggerSupernovaTransition(window.innerWidth / 2, window.innerHeight / 2);
  };

  const triggerKilonova = () => {
    isInterstellarRef.current = true;
    (window as any).__forcedNextArchetype = "KILONOVA_MERGER";
    (window as any).__lastClimaxTime = Date.now();
    if (remeshCover.reducedMotion) {
      triggerSupernovaTransition();
      return;
    }
    audio.playGravitationalWaveChirp();
    cameraShakeRef.current = 10.0;

    if (inspiralIntervalRef.current) {
      clearInterval(inspiralIntervalRef.current);
      inspiralIntervalRef.current = null;
    }

    // 3.2-second accelerating binary inspiral buildup before kilonova detonation
    let inspiralTicks = 0;
    inspiralIntervalRef.current = setInterval(() => {
      inspiralTicks++;
      cameraShakeRef.current = Math.min(22.0, 8.0 + inspiralTicks * 1.15);
      celestialEntitiesRef.current.forEach((ent) => {
        if (!ent.isDestroyed && !ent.isOutgoing && ent.orbitRadius && ent.orbitRadius > 14) {
          ent.orbitRadius *= 0.92;
          ent.orbitSpeed = (ent.orbitSpeed || 0.012) * 1.06;
        }
      });
      if (inspiralTicks >= 12 && inspiralIntervalRef.current) {
        clearInterval(inspiralIntervalRef.current);
        inspiralIntervalRef.current = null;
      }
    }, 250);

    const kilonovaTimer = setTimeout(() => {
      if (inspiralIntervalRef.current) {
        clearInterval(inspiralIntervalRef.current);
        inspiralIntervalRef.current = null;
      }
      triggerSupernovaTransition(window.innerWidth / 2, window.innerHeight / 2);
    }, 3200);
    mappingTimersRef.current.push(kilonovaTimer);
  };

  const floatAwayToScene = (targetArchetype: string, targetStage: number) => {
    const ww = window.innerWidth;
    const wh = window.innerHeight;
    cancelTransitRef.current?.();
    isTransitActiveRef.current = false;
    transitStartTimeRef.current = 0;
    wormholeIntensityRef.current = 0;

    // Clear any pending typography coalescence or kilonova timers from rapid scene switches
    mappingTimersRef.current.forEach(clearTimeout);
    mappingTimersRef.current = [];
    if (inspiralIntervalRef.current) {
      clearInterval(inspiralIntervalRef.current);
      inspiralIntervalRef.current = null;
    }

    // Cancel any active supernova/kilonova state machine or TDE so they do not detonate into the incoming scene
    if (sm.getInfo().isTransitioning) {
      sm.cancel();
    }
    if (activeSupernovaFxRef.current) {
      activeSupernovaFxRef.current.dispose();
      activeSupernovaFxRef.current = null;
    }
    supernovaRef.current = null;

    if (tdeStateRef.current.isActive) {
      tdeStateRef.current = createInitialTdeState();
      if (activeTdeFxRef.current) {
        activeTdeFxRef.current.dispose();
        activeTdeFxRef.current = null;
      }
      if (onTdeStateChangeRef.current) {
        onTdeStateChangeRef.current({
          isActive: false,
          stage: "IDLE",
          status: "Singularity Quiescent",
        });
      }
    }

    // Reset climax timestamp so the incoming scene begins in Act I (CALM_GENESIS)
    (window as any).__lastClimaxTime = 0;

    // Cut to a fully formed shot; typography and celestial targets share one remap.
    stageRef.current = targetStage;
    lastStageChangeRef.current = Date.now();
    audio.playDeepThunderRoll(0.8, 0.3);
    isInterstellarRef.current = true;
    nextGeminiSceneRef.current = null;
    (window as any).__forcedNextArchetype = targetArchetype;
    generateInterstellarScene(ww, wh, true);
    mapParticlesToInterstellar(ww, wh);
  };

  const switchToScene = (
    archetype: string,
    transitionType: "wormhole" | "supernova" | "morph" | "float" = "float",
    targetStage?: number
  ) => {
    const assignedStage = targetStage !== undefined ? targetStage : stageRef.current;
    cancelTransitRef.current?.();
    isTransitActiveRef.current = false;
    transitStartTimeRef.current = 0;
    wormholeIntensityRef.current = 0;
    mappingTimersRef.current.forEach(clearTimeout);
    mappingTimersRef.current = [];
    if (sm.getInfo().isTransitioning) sm.cancel();
    activeSupernovaFxRef.current?.dispose();
    activeSupernovaFxRef.current = null;
    supernovaRef.current = null;
    if (inspiralIntervalRef.current) {
      clearInterval(inspiralIntervalRef.current);
      inspiralIntervalRef.current = null;
    }
    if (transitionType === "float") {
      floatAwayToScene(archetype, assignedStage);
      return;
    }
    stageRef.current = assignedStage;
    isInterstellarRef.current = true;
    nextGeminiSceneRef.current = null;
    (window as any).__forcedNextArchetype = archetype;
    if (transitionType === "wormhole") {
      startWormholeTransit();
    } else if (transitionType === "supernova") {
      triggerSupernovaTransition(window.innerWidth / 2, window.innerHeight / 2);
    } else {
      const ww = window.innerWidth;
      const wh = window.innerHeight;
      generateInterstellarScene(ww, wh, true);
      mapParticlesToInterstellar(ww, wh, true);
      if (cameraRef.current) {
        transitionStartTimeRef.current = Date.now();
        transitionActiveRef.current = true;
        transitionStartPosRef.current = cameraRef.current.position.clone();
      }
    }
  };

  const startWormholeTransit = async (
    targetPos?: BABYLON.Vector3,
    viewDir?: BABYLON.Vector3
  ) => {
    if (remeshCover.reducedMotion) {
      generateInterstellarScene(window.innerWidth, window.innerHeight, true);
      mapParticlesToInterstellar(window.innerWidth, window.innerHeight);
      animationComplete?.();
      return;
    }
    await _startWormholeTransit(
      {
        cameraRef,
        sceneRef,
        rendererRef,
        isTransitActiveRef,
        transitStartTimeRef,
        transitTargetPosRef,
        transitDirRef,
        wormholePostProcessRef,
        wormholeTimeRef,
        wormholeIntensityRef,
        cancelTransitRef,
        fovRef,
        cameraZRef,
        isInterstellarRef,
        nextGeminiSceneRef,
        generateInterstellarScene,
        mapParticlesToInterstellar,
        animationComplete,
        transitionStartTimeRef,
        transitionActiveRef,
        transitionStartPosRef,
        audio,
      },
      targetPos,
      viewDir
    );
  };

  const updateCelestial3DMeshes = () => {
    _updateCelestial3DMeshes(
      sceneRef,
      celestialGroupRef,
      celestialEntitiesRef,
      entityTransitionActiveRef,
      entityTransitionStartTimeRef,
      interstellarSceneGeneratedTimeRef,
      audio,
      isInterstellarRef,
      supernovaRef,
      triggerCalmCosmicShift,
      (x, y, color, count) => {
        if (spawnTailParticleRef.current) {
          _createDustSplash(x, y, color, count, spawnTailParticleRef.current);
        }
      },
      (name, desc, tags, list) => registerAndSaveSequence(name, desc, tags, list),
      lastAutonomousEventTimeRef,
      activeWormholeRef,
      particlesRef,
      _swallowEntity,
      (e1, e2) => resolveCelestialCollision(e1, e2, 0.75),
      celestialMeshInstancesRef,
      mouseRef,
      cameraRef,
      isShockwaveActiveRef,
      objectParticleSpeedRef,
      stageRef,
      screensaverOpacityRef,
      lastStageChangeRef,
      collisionFlaresRef,
      spawnTailParticleRef
    );
  };

  // Synchronize ref synchronously on render to prevent stale reads
  isInterstellarRef.current = isInterstellar;

  useEffect(() => {
    if (!sceneRef.current) return;
    const ww = window.innerWidth;
    const wh = window.innerHeight;
    generateInterstellarScene(ww, wh, true);
    mapParticlesToInterstellar(ww, wh, true);
  }, [isInterstellar]);

  useEffect(() => {
    const prevStage = stageRef.current;
    stageRef.current = stage;
    lastStageChangeRef.current = Date.now();

    if (prevStage !== stage) {
      if (cameraRef.current) {
        transitionStartTimeRef.current = Date.now();
        transitionActiveRef.current = true;
        transitionStartPosRef.current = cameraRef.current.position.clone();
      }

      mappingTimersRef.current.forEach(clearTimeout);
      mappingTimersRef.current = [];

      remeshCover.begin();
      _updateTypographyStage(stage, false, particlesRef, window.innerWidth, window.innerHeight);
      remeshCover.remapped(particlesRef.current);
    }

    updateHudTexture(stage, hudPlaneRef.current, hudTextureRef.current);
  }, [stage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ww = window.innerWidth;
    const wh = window.innerHeight;

    // 1. Initialize Babylon.js Engine & Scene
    fovRef.current = 60;
    cameraZRef.current =
      Math.max(10.0, wh / (2 * Math.tan((fovRef.current * Math.PI) / 360))) * 2.5;

    const { scene, camera } = initializeScene(
      canvas,
      sceneRef,
      cameraRef,
      rendererRef,
      fovRef.current,
      cameraZRef.current
    );
    const engine = rendererRef.current!;

    // Postprocessing Composer setup for cinematic Bloom, ACES Tone Mapping, Chromatic Aberration, and Grain
    const pipeline = new BABYLON.DefaultRenderingPipeline("pipeline", true, scene, [camera]);
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.88;
    pipeline.bloomWeight = 0.08;
    pipeline.bloomKernel = 64;
    pipeline.bloomScale = 0.5;

    // Cinematic Chromatic Aberration
    pipeline.chromaticAberrationEnabled = true;
    if (pipeline.chromaticAberration) {
      pipeline.chromaticAberration.aberrationAmount = 2.0;
      pipeline.chromaticAberration.radialIntensity = 0.5;
    }

    // Film grain disabled to remove background noise
    pipeline.grainEnabled = false;
    if (pipeline.grain) {
      pipeline.grain.intensity = 0.0;
      pipeline.grain.animated = false;
    }

    // Deep space cinematic ACES tone mapping and vignette
    pipeline.imageProcessingEnabled = true;
    if (pipeline.imageProcessing) {
      pipeline.imageProcessing.toneMappingEnabled = true;
      pipeline.imageProcessing.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
      pipeline.imageProcessing.contrast = 1.15;
      pipeline.imageProcessing.exposure = 1.06;
      pipeline.imageProcessing.vignetteEnabled = true;
      pipeline.imageProcessing.vignetteWeight = 1.25;
      pipeline.imageProcessing.vignetteStretch = 0.9;
      pipeline.imageProcessing.vignetteColor = new BABYLON.Color4(0.0, 0.0, 0.03, 1.0);
    }

    // Anti-aliasing FXAA
    pipeline.fxaaEnabled = true;
    composerRef.current = pipeline;

    // Dedicated GlowLayer to make emissive 3D celestial objects bloom softly
    const glowLayer = new BABYLON.GlowLayer("glowLayer", scene, {
      mainTextureRatio: 0.25,
      blurKernelSize: 32,
    });
    glowLayer.intensity = 0.35;
    glowLayerRef.current = glowLayer;

    // Direct lighting & ambient light setup
    const ambientLight = new BABYLON.HemisphericLight(
      "ambientLight",
      new BABYLON.Vector3(0, 1, 0),
      scene
    );
    ambientLight.intensity = 0.28;

    const dirLight = new BABYLON.DirectionalLight(
      "dirLight",
      new BABYLON.Vector3(1.5, -1.0, 1.2),
      scene
    );
    dirLight.intensity = 1.05;

    // Group/Node to hold interstellar celestial bodies
    const celestialGroup = new BABYLON.TransformNode("celestialGroup", scene);
    celestialGroupRef.current = celestialGroup;

    // 2. Layered Typography Tracer Texture
    const hudDpr = window.devicePixelRatio || 1;
    const hudTexture = new BABYLON.DynamicTexture(
      "hudTex",
      { width: ww * hudDpr, height: wh * hudDpr },
      scene,
      false
    );
    const hudCtx = hudTexture.getContext() as CanvasRenderingContext2D | null;
    if (hudCtx) {
      hudCtx.scale(hudDpr, hudDpr);
      drawStageLayoutTemplate(hudCtx, stageRef.current, ww, wh, "full");
    }
    hudTexture.hasAlpha = true;
    hudTexture.update();
    hudTextureRef.current = hudTexture;

    const hudMaterial = new BABYLON.StandardMaterial("hudMat", scene);
    hudMaterial.diffuseTexture = hudTexture;
    hudMaterial.emissiveTexture = hudTexture;
    hudMaterial.disableLighting = true;
    hudMaterial.backFaceCulling = false;
    hudMaterial.alphaMode = BABYLON.Engine.ALPHA_ADD;
    hudMaterial.useAlphaFromDiffuseTexture = true;

    hudMaterial.alpha = 0.82;

    const hudPlane = BABYLON.MeshBuilder.CreatePlane("hudPlane", { width: ww, height: wh }, scene);
    hudPlane.material = hudMaterial;
    hudPlane.isPickable = false;

    const planeZ = -60;
    const scaleFactor = (cameraZRef.current + planeZ) / cameraZRef.current;
    hudPlane.scaling.set(scaleFactor, scaleFactor, 1);
    hudPlane.position.set(0, 0, planeZ);
    hudPlane.isVisible = false;
    hudPlaneRef.current = hudPlane;

    const isMobileDevice =
      /iPad|iPhone|iPod|Android/i.test(navigator.userAgent) || ww < 768;

    // 3. Particle System Instantiation
    const {
      tempParticles,
      tailStartIndex,
      tailCount,
      pointsMesh,
      pointsMaterial,
      positions,
      colors,
      extras,
    } = buildParticleSystem(scene, ww, wh, stageRef.current, isMobileDevice, glowLayerRef.current);

    let tailIndex = 0;
    particlesRef.current = tempParticles;
    tailStartIndexRef.current = tailStartIndex;
    pointsMeshRef.current = pointsMesh;
    pointsMaterialRef.current = pointsMaterial;

    // Auto-restore saved sequence
    const autoRestoreId = localStorage.getItem("cosmic_debug_auto_restore");
    if (autoRestoreId) {
      try {
        const saved = localStorage.getItem("cosmic_debug_sequences");
        const list = saved ? JSON.parse(saved) : {};
        const seq = list[autoRestoreId];
        if (seq) {
          console.log(
            `%c[COSMIC DEBUG] Auto-restoring sequence: ${autoRestoreId}`,
            "color: #10b981; font-weight: bold;"
          );
          nextGeminiSceneRef.current = {
            archetype: seq.archetype,
            systemName: seq.systemName,
            systemDesc: seq.systemDesc,
            systemTags: seq.systemTags,
            entities: seq.entities,
          };
          if (onSequenceGenerated) {
            onSequenceGenerated({
              id: autoRestoreId,
              name: seq.systemName,
              description: seq.systemDesc,
              tags: seq.systemTags,
            });
          }
          if (animationComplete) {
            animationComplete();
          }
        }
      } catch (err) {
        console.warn("[COSMIC DEBUG] Auto-restore failed:", err);
      }
    }

    // Register global sequence activator
    (window as any).activateSequence = (id: string | null) => {
      if (!id) {
        localStorage.removeItem("cosmic_debug_auto_restore");
        console.log(
          "%c[COSMIC DEBUG] Auto-restore cleared. Default screensaver and normal transitions resumed.",
          "color: #ff4b2b; font-weight: bold;"
        );
        return;
      }
      try {
        const saved = localStorage.getItem("cosmic_debug_sequences");
        const list = saved ? JSON.parse(saved) : {};
        const seq = list[id];
        if (!seq) {
          console.error(`[COSMIC DEBUG] Sequence with ID '${id}' not found in localStorage.`);
          return;
        }

        localStorage.setItem("cosmic_debug_auto_restore", id);
        console.log(`%c[COSMIC DEBUG] Activating sequence: ${id}`, "color: #10b981; font-weight: bold;");

        nextGeminiSceneRef.current = {
          archetype: seq.archetype,
          systemName: seq.systemName,
          systemDesc: seq.systemDesc,
          systemTags: seq.systemTags,
          entities: seq.entities,
        };

        if (onSequenceGenerated) {
          onSequenceGenerated({
            id,
            name: seq.systemName,
            description: seq.systemDesc,
            tags: seq.systemTags,
          });
        }

        if (animationComplete) {
          animationComplete();
        }

        const currentW = window.innerWidth;
        const currentH = window.innerHeight;
        generateInterstellarScene(currentW, currentH, true);
        mapParticlesToInterstellar(currentW, currentH);

        if (cameraRef.current && !isTransitActiveRef.current) {
          transitionStartTimeRef.current = Date.now();
          transitionActiveRef.current = true;
          transitionStartPosRef.current = cameraRef.current.position.clone();
        }
      } catch (err) {
        console.error("[COSMIC DEBUG] Failed to activate sequence:", err);
      }
    };

    generateInterstellarScene(ww, wh, true);
    mapParticlesToInterstellar(ww, wh, false);

    const spawnTailParticle = (
      x: number,
      y: number,
      zOrColor?: number | string,
      vxOrZ?: number,
      vyOrVx?: number,
      colorOrVy?: string | number,
      decayRateOrColor?: number | string
    ) => {
      let z = 0;
      let vx = 0;
      let vy = 0;
      let color = "#ffffff";
      let decayRate = 0.04 + Math.random() * 0.05;

      if (typeof zOrColor === "string") {
        color = zOrColor;
        vx = typeof vxOrZ === "number" ? vxOrZ : 0;
        vy = typeof vyOrVx === "number" ? vyOrVx : 0;
      } else {
        z = typeof zOrColor === "number" ? zOrColor : 0;
        vx = typeof vxOrZ === "number" ? vxOrZ : 0;
        vy = typeof vyOrVx === "number" ? vyOrVx : 0;
        if (typeof colorOrVy === "string") {
          color = colorOrVy;
          if (typeof decayRateOrColor === "number") decayRate = decayRateOrColor;
        } else if (typeof decayRateOrColor === "string") {
          color = decayRateOrColor;
        }
      }

      const activeTailStartIndex =
        tailStartIndexRef.current !== -1 ? tailStartIndexRef.current : tailStartIndex;
      if (tailCount === 0 || activeTailStartIndex === -1) return;
      const tIdx = activeTailStartIndex + (tailIndex % tailCount);
      tailIndex++;

      const pool = particlesRef.current.length > 0 ? particlesRef.current : tempParticles;
      const tailP = pool[tIdx];
      if (tailP) {
        tailP.x = x;
        tailP.y = y;
        tailP.z = z;
        tailP.vx = vx;
        tailP.vy = vy;
        tailP.vz = (Math.random() - 0.5) * 2;
        const safeColor = (typeof color === "string" && color) ? color : "#ffffff";
        tailP.color = safeColor;
        tailP.baseColor = safeColor;
        if (safeColor.startsWith("#") && safeColor.length >= 7) {
          tailP.r = parseInt(safeColor.slice(1, 3), 16) || 255;
          tailP.g = parseInt(safeColor.slice(3, 5), 16) || 255;
          tailP.b = parseInt(safeColor.slice(5, 7), 16) || 255;
        } else if (safeColor.startsWith("rgb")) {
          const matches = safeColor.match(/\d+/g);
          if (matches) {
            tailP.r = parseInt(matches[0] || "255", 10);
            tailP.g = parseInt(matches[1] || "255", 10);
            tailP.b = parseInt(matches[2] || "255", 10);
          }
        } else {
          tailP.r = 255;
          tailP.g = 255;
          tailP.b = 255;
        }
        tailP.life = 1.0;
        tailP.decay = decayRate || 0.04 + Math.random() * 0.05;
      }
    };

    spawnTailParticleRef.current = spawnTailParticle;

    // Main Hardware-Accelerated 3D Simulation and Render Loop
    const render = () => {
      executeRenderFrame({
        remeshCover,
        particlesRef,
        pointsMeshRef,
        hudPlaneRef,
        sceneRef,
        cameraRef,
        rendererRef,
        composerRef,
        pointsMaterialRef,
        lensingPostProcessRef,
        dofPostProcessRef,
        shatterPostProcessRef,
        zoomToHorizonRef,
        targetZoomToHorizonRef,
        shatterIntensityRef,
        cameraZRef,
        dofEnabledRef,
        celestialEntitiesRef,
        supernovaRef,
        activeSupernovaFxRef,
        ripplesRef,
        collisionFlaresRef,
        cameraShakeRef,
        inputControllerRef,
        stageRef,
        isInterstellarRef,
        isTransitActiveRef,
        transitStartTimeRef,
        lastStageChangeRef,
        lastUserActivityRef,
        isScreensaverActiveRef,
        screensaverOpacityRef,
        lastShockwaveTimeRef,
        isShockwaveActiveRef,
        shockwaveStartTimeRef,
        smoothedAmpRef,
        smoothedBassRef,
        smoothedMidRef,
        smoothedTrebleRef,
        mouseRef,
        scrollVelocityRef,
        ambientParticleSpeedRef,
        objectParticleSpeedRef,
        textParticleSpeedRef,
        particleFiltersRef,
        spawnTailParticleRef,
        timeRef,
        positions,
        colors,
        extras,
        updateCelestial3DMeshes,
        generateInterstellarScene,
        mapParticlesToInterstellar,
        transitionStartTimeRef,
        transitionActiveRef,
        transitionStartPosRef,
        fovRef,
        animationComplete,
        audio,
        isCinematicModeRef,
        cinematicCameraModeRef,
        cinematicSpeedMultiplierRef,
        slingshotAimRef,
        probesRef,
        tdeStateRef,
        activeTdeFxRef,
        onTdeStateChange: (info) => onTdeStateChangeRef.current?.(info),
      });
    };

    engine.runRenderLoop(() => {
      render();
      scene.render();
      if (remeshCover.phase !== "idle") {
        remeshCover.afterRender(
          !isTransitActiveRef.current && !particlesRef.current.some(p => p.needsRemesh) && scene.isReady()
        );
      }
    });

    const cleanupEvents = setupParticleCanvasEvents({
      rendererRef,
      hudPlaneRef,
      cameraRef,
      fovRef,
      mouseRef,
      stageRef,
      mapParticlesToStage,
      mapParticlesToInterstellar,
      updateHudTexture: (s: number) => updateHudTexture(s, hudPlaneRef.current, hudTextureRef.current),
      lastUserActivityRef,
      isScreensaverActiveRef,
      screensaverOpacityRef,
      inputControllerRef,
      ripplesRef,
      celestialEntitiesRef,
      isInterstellarRef,
      supernovaRef,
      cameraShakeRef,
      audio,
      fetchNextGeminiScene,
      lastScrollYRef,
      scrollVelocityRef,
      isTransitActiveRef,
      sceneRef,
      startWormholeTransit,
      lensingPostProcessRef,
      wormholePostProcessRef,
      activeSupernovaFxRef,
      triggerSupernovaTransition,
      slingshotAimRef,
      probesRef,
      tdeStateRef,
      triggerTdeFn: triggerTDE,
      targetZoomToHorizonRef,
      zoomToHorizonRef,
      shatterIntensityRef,
    });

    (window as any).triggerTDE = triggerTDE;
    (window as any).triggerKilonova = triggerKilonova;
    (window as any).switchToScene = switchToScene;
    (window as any).floatAwayToScene = floatAwayToScene;

    (window as any).__cosmicCanvas = {
      triggerTDE,
      triggerKilonova,
      triggerSceneClimax,
      switchToScene,
      floatAwayToScene,
      triggerSupernovaTransition: () => triggerSupernovaTransition(window.innerWidth / 2, window.innerHeight / 2),
      startWormholeTransit: () => startWormholeTransit(),
      generateInterstellarScene: (force?: boolean) => {
        const ww = window.innerWidth;
        const wh = window.innerHeight;
        generateInterstellarScene(ww, wh, force ?? true);
        mapParticlesToInterstellar(ww, wh);
      },
      nextScene: () => {
        if (Math.random() > 0.5) {
          triggerSupernovaTransition(window.innerWidth / 2, window.innerHeight / 2);
        } else {
          startWormholeTransit();
        }
      },
      getCurrentArchetype: () => archetypeRef.current,
      getEntities: () => celestialEntitiesRef.current,
      getTransitionCover: () => ({
        phase: remeshCover.phase,
        opacity: remeshCover.opacity,
        pendingParticles: particlesRef.current.filter(p => p.needsRemesh).length,
        reducedMotion: remeshCover.reducedMotion,
        transitActive: isTransitActiveRef.current,
        cameraZ: cameraRef.current?.position.z,
        cameraFov: cameraRef.current?.fov,
        cameraRoll: cameraRef.current?.rotation.z,
      }),
      launchProbe: () => {
        const ww = window.innerWidth;
        const wh = window.innerHeight;
        audio.playDeepThunderRoll(2.6, 0.45);
        ripplesRef.current.push({ x: ww / 2, y: wh / 2, life: 0.85 });
      },
      triggerPulsarShockwave: () => {
        triggerSceneClimax();
      },
      cycleTargetLock: () => {
        const activeEntities = celestialEntitiesRef.current.filter(
          (e) => !e.isDestroyed && !e.isOutgoing && e.type !== "nebula"
        );
        if (activeEntities.length === 0) return null;
        const inputs = inputControllerRef.current;
        const curId = inputs.targetLock?.active ? inputs.targetLock.entityId : null;
        const curIdx = curId ? activeEntities.findIndex((e) => e.id === curId) : -1;
        const nextIdx = curIdx + 1;
        if (nextIdx >= activeEntities.length) {
          inputs.targetLock = { x: 0, y: 0, z: 0, active: false, entityId: null };
          if ((window as any).__onSelectedEntityChange) {
            (window as any).__onSelectedEntityChange(null);
          }
          return null;
        }
        const nextEnt = activeEntities[nextIdx]!;
        const curW = window.innerWidth;
        const curH = window.innerHeight;
        inputs.targetLock = {
          x: nextEnt.worldX !== undefined ? nextEnt.worldX : nextEnt.x - curW / 2,
          y: nextEnt.worldY !== undefined ? nextEnt.worldY : -(nextEnt.y - curH / 2),
          z: nextEnt.worldZ !== undefined ? nextEnt.worldZ : (nextEnt.z || 0),
          active: true,
          entityId: nextEnt.id || "unknown",
        };
        if ((window as any).__onSelectedEntityChange) {
          (window as any).__onSelectedEntityChange(nextEnt);
        }
        if (audio.pingInteraction) audio.pingInteraction();
        return nextEnt;
      },
      clearTargetLock: () => {
        inputControllerRef.current.targetLock = { x: 0, y: 0, z: 0, active: false, entityId: null };
        if ((window as any).__onSelectedEntityChange) {
          (window as any).__onSelectedEntityChange(null);
        }
      }
    };

    return () => {
      cancelTransitRef.current?.();
      cleanupEvents();
      mappingTimersRef.current.forEach(clearTimeout);
      mappingTimersRef.current = [];
      if (inspiralIntervalRef.current) {
        clearInterval(inspiralIntervalRef.current);
        inspiralIntervalRef.current = null;
      }
      sm.cancel();
      activeTdeFxRef.current?.dispose();
      dofPostProcessRef.current?.dispose();
      shatterPostProcessRef.current?.dispose();
      delete (window as any).activateSequence;
      delete (window as any).__cosmicCanvas;
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="block w-full h-full" id="canvas-babylon" />
      <div ref={coverElementRef} data-transition-cover data-phase="idle" aria-hidden="true"
        style={{ position: "absolute", inset: 0, background: "#000", opacity: 0, pointerEvents: "none" }} />
    </div>
  );
};
