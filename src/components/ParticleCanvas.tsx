import React, { useEffect, useRef } from "react";
import * as BABYLON from "@babylonjs/core";
import { audio } from "../utils/audio";
import { Particle } from "../types";
import { drawStageLayoutTemplate } from "./ParticleCanvas/ParticleUtils";
import { CelestialEntity, ParticleCanvasProps, ParticleFilters } from "./ParticleCanvas/types";
import { DebugObjectOverlay } from "./DebugObjectOverlay";
import {
  resolveCelestialCollision,
  swallowEntity as _swallowEntity,
  createDustSplash as _createDustSplash,
  createShatterDebris as _createShatterDebris,
  createSpaghettificationDebris as _createSpaghettificationDebris,
  disposeCollisionFlares,
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
import { executeRenderFrame } from "./ParticleCanvas/RenderEngine";
import { buildParticleSystem } from "./ParticleCanvas/ParticleSystemBuilder";
import { setupParticleCanvasEvents } from "./ParticleCanvas/ParticleCanvasEvents";
import { updateCelestial3DMeshes as _updateCelestial3DMeshes } from "./ParticleCanvas/CelestialMeshSynchronizer";
import { initializeScene } from "./ParticleCanvas/SceneSetup";
import { GravitationalInteractionsOverlay } from "./ParticleCanvas/GravitationalInteractionsOverlay";
import { SlingshotAimState, SlingshotProbe } from "./ParticleCanvas/SlingshotEngine";
import { TdeState, createInitialTdeState, triggerTidalDisruptionEvent } from "./ParticleCanvas/TidalDisruptionEngine";
import { TidalDisruptionFXInstance } from "./ParticleCanvas/TidalDisruptionFX";
import { settleParticlesToTargets, triggerOrganicParticleDisperse } from "./ParticleCanvas/ParticleMapper";
import { CinematicRuntime, createCinematicRuntime } from "./ParticleCanvas/cinematic/CinematicRuntime";
import { createCaptureState, CAPTURE_DEFAULT_DURATION_MS } from "./ParticleCanvas/cinematic/BlackHoleCapture";
import { cinematicFx, resetCinematicFx } from "./ParticleCanvas/cinematic/CinematicFxBus";

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
    const ww = typeof window !== "undefined" && window.innerWidth > 0 ? window.innerWidth : 1920;
    const wh = typeof window !== "undefined" && window.innerHeight > 0 ? window.innerHeight : 1080;
    const success = triggerTidalDisruptionEvent(
      tdeStateRef.current,
      celestialEntitiesRef.current,
      ww,
      wh
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

  const isSlingshotModeRef = useRef<boolean>(isSlingshotMode);
  useEffect(() => {
    isSlingshotModeRef.current = isSlingshotMode;
  }, [isSlingshotMode]);

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

  // Cinematic director (hides every rebuild behind camera work), gravity rig and
  // black-hole capture. Created lazily so SSR / tests never touch matchMedia.
  const cinematicRef = useRef<CinematicRuntime | null>(null);
  if (cinematicRef.current === null) {
    const reduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    cinematicRef.current = createCinematicRuntime(reduced);
  }
  const hasInitializedRef = useRef<boolean>(false);
  const prevStagePropRef = useRef<number>(stage);
  const prevInterstellarPropRef = useRef<boolean>(isInterstellar);

  // Simulation State Refs
  const nextGeminiSceneRef = useRef<any>(null);
  const isFetchingGeminiRef = useRef<boolean>(false);
  const stageTargetsRef = useRef<{ x: number; y: number; color: string }[][]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const stageRef = useRef<number>(stage);
  const isInterstellarRef = useRef<boolean>(isInterstellar);
  const isTransitActiveRef = useRef<boolean>(false);
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
  const scrollVelocityRef = useRef<number>(0);
  const lastScrollYRef = useRef<number>(
    typeof window !== "undefined"
      ? (window.scrollY || document.documentElement?.scrollTop || 0)
      : 0
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
  const fetchNextGeminiScene = (requestedArchetype?: string, prompt?: string) =>
    _fetchNextGeminiScene(isFetchingGeminiRef, nextGeminiSceneRef, requestedArchetype, prompt);

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
  ) =>
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

  /** Same as generateInterstellarScene but settles bodies at their targets (no morph). */
  const generateInterstellarSceneInstant = (
    width: number,
    height: number,
    forceInterstellar = false,
    supernovaX?: number,
    supernovaY?: number
  ) =>
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
      onSequenceGenerated,
      { instant: true }
    );

  /**
   * Rebuilds the interstellar system fully formed: bodies at rest positions,
   * particles at their targets. Only ever called while the director (or the
   * wormhole / capture) has the subject hidden.
   */
  const rebuildInterstellarInstant = (
    width: number,
    height: number,
    forceInterstellar = true,
    supernovaX?: number,
    supernovaY?: number
  ) => {
    lastStageChangeRef.current = Date.now();
    generateInterstellarSceneInstant(width, height, forceInterstellar, supernovaX, supernovaY);
    mapParticlesToInterstellar(width, height);
    if (cinematicRef.current?.director.reducedMotion) {
      settleParticlesToTargets(particlesRef.current);
    } else {
      triggerOrganicParticleDisperse(particlesRef.current, supernovaX ?? width / 2, supernovaY ?? height / 2, 0, 1.15);
    }
  };

  /** Lays the typography for `targetStage` out via organic physics-driven morphing. */
  const rebuildStageInstant = (targetStage: number) => {
    stageRef.current = targetStage;
    lastStageChangeRef.current = Date.now();
    mapParticlesToStage(targetStage, false);
    if (cinematicRef.current?.director.reducedMotion) {
      settleParticlesToTargets(particlesRef.current);
    } else {
      triggerOrganicParticleDisperse(particlesRef.current, window.innerWidth / 2, window.innerHeight / 2, 0, 0.95);
    }
    updateHudTexture(targetStage, hudPlaneRef.current, hudTextureRef.current);
  };

  /** Mapping helper for the wormhole: maps and triggers organic dispersion out of the throat. */
  const mapParticlesToInterstellarSettled = (width: number, height: number) => {
    lastStageChangeRef.current = Date.now();
    mapParticlesToInterstellar(width, height);
    if (cinematicRef.current?.director.reducedMotion) {
      settleParticlesToTargets(particlesRef.current);
    } else {
      triggerOrganicParticleDisperse(particlesRef.current, width / 2, height / 2, 0, 1.25);
    }
  };

  const directorRequest = (
    key: string,
    preset: "stage" | "scene" | "supernova" | "emerge" | "warp",
    apply: () => void
  ) => {
    const cine = cinematicRef.current;
    if (!cine || !hasInitializedRef.current) {
      apply();
      return;
    }
    cine.director.request({ key, preset, apply }, Date.now());
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

  const mapParticlesToInterstellar = (width: number, height: number) => {
    _mapParticlesToInterstellar(
      width,
      height,
      celestialEntitiesRef,
      archetypeRef,
      particlesRef,
      tailStartIndexRef
    );
  };

  const mapParticlesToStage = (targetStage: number, triggerBurst: boolean) => {
    _mapParticlesToStage(
      targetStage,
      triggerBurst,
      stageTargetsRef,
      particlesRef,
      tailStartIndexRef
    );
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

  const triggerSupernovaTransition = (x?: number, y?: number) => {
    const posX = x ?? window.innerWidth / 2;
    const posY = y ?? window.innerHeight / 2;

    sm.executeBlackHoleToSupernovaTransition({
      x: posX,
      y: posY,
      onImplode: () => {
        cameraShakeRef.current = 14.0;
        audio.playSupernova();
      },
      onDetonate: () => {
        isInterstellarRef.current = true;
        // Recoil away from the blast; the new system assembles while the frame
        // is filled by the remnant and is revealed already formed.
        directorRequest("scene", "supernova", () =>
          rebuildInterstellarInstant(window.innerWidth, window.innerHeight, true, posX, posY)
        );
        celestialEntitiesRef.current.forEach((entity) => {
          entity.isDestroyed = true;
        });

        supernovaRef.current = {
          time: Date.now(),
          exploded: true,
          isCalmShift: true,
          x: posX,
          y: posY,
        };

        if (sceneRef.current) {
          const worldPos = new BABYLON.Vector3(
            posX - window.innerWidth / 2,
            -(posY - window.innerHeight / 2),
            0
          );
          if (activeSupernovaFxRef.current) {
            activeSupernovaFxRef.current.dispose();
          }
          activeSupernovaFxRef.current = spawnSupernovaFX(sceneRef.current, worldPos);
        }

        audio.playRippleShockwave();
        fetchNextGeminiScene();
      },
      onRebirth: () => {
        // The rebuild already happened behind the director's recoil shot
        // (onDetonate). Only a soft settling tremor remains here.
        cameraShakeRef.current = Math.max(cameraShakeRef.current, 3.0);
      },
      onComplete: () => {
        if (animationComplete) animationComplete();
      },
    });
  };

  const triggerCalmCosmicShift = () => {
    triggerSupernovaTransition(window.innerWidth / 2, window.innerHeight / 2);
  };

  const startWormholeTransit = async (
    targetPos?: BABYLON.Vector3,
    viewDir?: BABYLON.Vector3
  ) => {
    const cine = cinematicRef.current;
    if (cine?.capture || isTransitActiveRef.current) return;
    if (cine?.director.reducedMotion) {
      directorRequest("scene", "scene", () => {
        isInterstellarRef.current = true;
        rebuildInterstellarInstant(window.innerWidth, window.innerHeight, true);
        animationComplete?.();
      });
      return;
    }
    cine?.director.reset(true);
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
        fovRef,
        cameraZRef,
        isInterstellarRef,
        nextGeminiSceneRef,
        generateInterstellarScene: (ww: number, wh: number, forceNew?: boolean) =>
          generateInterstellarSceneInstant(ww, wh, forceNew ?? true),
        mapParticlesToInterstellar: mapParticlesToInterstellarSettled,
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

  const worldOf = (e: CelestialEntity) => ({
    x: e.worldX !== undefined ? e.worldX : e.x - window.innerWidth / 2,
    y: e.worldY !== undefined ? e.worldY : -(e.y - window.innerHeight / 2),
    z: e.worldZ !== undefined ? e.worldZ : e.z || 0,
  });

  /**
   * Spawns a small body just outside the frame, already moving, so it enters
   * the shot naturally (used when a showcase needs a body the scene lacks).
   */
  const spawnRogueBody = (
    type: "planet" | "star",
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    radius: number,
    color: string
  ): CelestialEntity => {
    const body = {
      id: `rogue-${type}-${Math.random().toString(36).substring(2, 8)}`,
      type,
      x,
      y,
      z,
      radius,
      color,
      mass: radius * radius,
      initialMass: radius * radius,
      scale: 1,
      startScale: 1,
      targetScale: 1,
      startX: x,
      startY: y,
      targetX: x,
      targetY: y,
      startRadius: radius,
      targetRadius: radius,
      vx,
      vy,
      vz: 0,
      isPhysicsEnabled: true,
      isDestroyed: false,
      isSwallowing: false,
    } as CelestialEntity;
    celestialEntitiesRef.current.push(body);
    return body;
  };

  /** Sends the two closest free bodies into each other (collision showcase). */
  const collideBodies = (): boolean => {
    const bodies = celestialEntitiesRef.current.filter(
      (e) =>
        e &&
        !e.isDestroyed &&
        !e.isSwallowing &&
        e.type !== "blackhole" &&
        e.type !== "nebula" &&
        e.type !== "galaxy"
    );
    if (bodies.length < 2) {
      // Not enough free bodies: two planetesimals enter from opposite edges on a collision course.
      const W = window.innerWidth;
      const H = window.innerHeight;
      const y = H * 0.42;
      const z = bodies[0]?.z || 0;
      spawnRogueBody("planet", -70, y - 40, z, 16, 1.1, 26, "#b8a58c");
      spawnRogueBody("planet", W + 70, y + 40, z, -16, -1.1, 20, "#8c9bb0");
      return true;
    }
    let best: [CelestialEntity, CelestialEntity] | null = null;
    let bestD = Infinity;
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const d = Math.hypot(
          bodies[i]!.x - bodies[j]!.x,
          bodies[i]!.y - bodies[j]!.y,
          (bodies[i]!.z || 0) - (bodies[j]!.z || 0)
        );
        if (d > 1 && d < bestD) {
          bestD = d;
          best = [bodies[i]!, bodies[j]!];
        }
      }
    }
    if (!best) return false;
    const [a, b] = best;
    // Aim along the full 3D separation: the collision test is 3D, and bodies
    // often sit at different depths.
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = (b.z || 0) - (a.z || 0);
    const d = Math.hypot(dx, dy, dz) || 1;
    const speed = Math.min(16, Math.max(7, d / 45));
    [a, b].forEach((e, idx) => {
      const sgn = idx === 0 ? 1 : -1;
      e.centerX = undefined;
      e.centerY = undefined;
      e.isPhysicsEnabled = true;
      e.vx = (dx / d) * speed * sgn;
      e.vy = (dy / d) * speed * sgn;
      e.vz = (dz / d) * speed * sgn;
    });
    return true;
  };

  /** Drops the nearest free body into the black hole (tidal capture showcase). */
  const feedBlackHole = (): boolean => {
    const bh = celestialEntitiesRef.current.find((e) => e && !e.isDestroyed && e.type === "blackhole");
    if (!bh) return false;
    const victims = celestialEntitiesRef.current
      .filter(
        (e) =>
          e &&
          !e.isDestroyed &&
          !e.isSwallowing &&
          e !== bh &&
          e.type !== "blackhole" &&
          e.type !== "nebula" &&
          e.type !== "galaxy"
      )
      .sort((p, q) => Math.hypot(p.x - bh.x, p.y - bh.y) - Math.hypot(q.x - bh.x, q.y - bh.y));
    let v = victims[0];
    if (!v) {
      // Lone black hole: a wandering star drifts in from off-screen on a decaying orbit.
      const fromLeft = bh.x > window.innerWidth / 2;
      v = spawnRogueBody(
        "star",
        fromLeft ? -60 : window.innerWidth + 60,
        Math.max(60, bh.y - window.innerHeight * 0.28),
        bh.z || 0,
        0,
        0,
        14,
        "#ffd9a8"
      );
    }
    const dx = bh.x - v.x;
    const dy = bh.y - v.y;
    const d = Math.hypot(dx, dy) || 1;
    v.centerX = undefined;
    v.centerY = undefined;
    v.isPhysicsEnabled = true;
    const speed = Math.min(14, Math.max(6, d / 50));
    v.vx = (dx / d) * speed + (-dy / d) * speed * 0.35;
    v.vy = (dy / d) * speed + (dx / d) * speed * 0.35;
    return true;
  };

  /**
   * Black-hole capture: the camera is taken over from its current pose (no
   * snap), spirals in with tidal shake, lensing stretch and redshift, fades
   * to black at the horizon, and the next scene is revealed via the
   * director's "emerge" shot.
   */
  const plungeIntoBlackHole = (): boolean => {
    const cine = cinematicRef.current;
    const cam = cameraRef.current;
    if (!cine || !cam || cine.capture || isTransitActiveRef.current) return false;
    const bh = celestialEntitiesRef.current.find((e) => e && !e.isDestroyed && e.type === "blackhole");
    if (!bh) return false;
    const now = Date.now();
    const base = {
      x: cam.position.x - cine.appliedOffset.x,
      y: cam.position.y - cine.appliedOffset.y,
      z: cam.position.z - cine.appliedOffset.z,
    };
    const fwd = cine.smoothedForward ?? { x: -base.x, y: -base.y, z: -base.z };
    const fl = Math.hypot(fwd.x, fwd.y, fwd.z) || 1;
    const lookDist = Math.max(200, Math.hypot(base.x, base.y, base.z));
    const look = {
      x: base.x + (fwd.x / fl) * lookDist,
      y: base.y + (fwd.y / fl) * lookDist,
      z: base.z + (fwd.z / fl) * lookDist,
    };
    const bhRadius = bh.radius * (bh.scale && bh.scale > 0 ? bh.scale : 1);
    transitionActiveRef.current = false;
    transitionStartPosRef.current = null;
    // Lensing intensifies through cinematicFx.capture, which ramps from 0, so
    // the first capture frame matches the last free-flight frame exactly.
    cine.capture = createCaptureState(now, base, look, worldOf(bh), bhRadius, CAPTURE_DEFAULT_DURATION_MS);

    audio.playTidalDisruption?.("approach");
    const timers = mappingTimersRef.current;
    timers.push(setTimeout(() => audio.playTidalDisruption?.("spaghettify"), CAPTURE_DEFAULT_DURATION_MS * 0.42));
    // Sub-bass horizon crossing.
    timers.push(setTimeout(() => audio.playSupernova?.(), CAPTURE_DEFAULT_DURATION_MS * 0.8));

    cine.onCaptureComplete = () => {
      cine.onCaptureComplete = undefined;
      // Screen is black: release the horizon zoom and park the camera where
      // the base camera wants to be so the emerge shot pulls out cleanly.
      targetZoomToHorizonRef.current = 0;
      zoomToHorizonRef.current = 0;
      (window as any).__targetHorizonZoom = 0;
      cine.rig.reset();
      const camNow = cameraRef.current;
      if (camNow) {
        camNow.position.set(0, 0, -cameraZRef.current);
        cine.appliedOffset = { x: 0, y: 0, z: 0 };
        cine.smoothedForward = { x: 0, y: 0, z: 1 };
      }
      cine.director.cutToHidden(
        {
          key: "scene",
          preset: "emerge",
          apply: () => {
            if (isInterstellarRef.current) {
              rebuildInterstellarInstant(window.innerWidth, window.innerHeight, true);
            } else {
              // Portfolio mode: recover to the same page with a fresh singularity backdrop.
              generateInterstellarSceneInstant(window.innerWidth, window.innerHeight, false);
              rebuildStageInstant(stageRef.current);
            }
            if (animationComplete) animationComplete();
          },
        },
        Date.now()
      );
    };
    return true;
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

  // The director masks body rebuilds at the handoff, then reveals the incoming
  // particle wavefront while the camera and lens settle on the same clock.
  useEffect(() => {
    if (!hasInitializedRef.current) return;
    if (prevInterstellarPropRef.current === isInterstellar) return;
    prevInterstellarPropRef.current = isInterstellar;
    // A running wormhole / capture rebuilds the scene itself.
    if (isTransitActiveRef.current || cinematicRef.current?.capture) return;
    if (isInterstellar) {
      directorRequest("scene", "scene", () =>
        rebuildInterstellarInstant(window.innerWidth, window.innerHeight, true)
      );
    } else {
      directorRequest("scene", "scene", () => rebuildStageInstant(stageRef.current));
    }
  }, [isInterstellar]);

  useEffect(() => {
    if (!hasInitializedRef.current) {
      stageRef.current = stage;
      prevStagePropRef.current = stage;
      return;
    }
    if (prevStagePropRef.current === stage) return;
    prevStagePropRef.current = stage;

    mappingTimersRef.current.forEach(clearTimeout);
    mappingTimersRef.current = [];

    const targetStage = stage;
    if (!isInterstellarRef.current) {
      directorRequest("stage", "stage", () => {
        if (isInterstellarRef.current) {
          stageRef.current = targetStage;
          return;
        }
        rebuildStageInstant(targetStage);
      });
    } else {
      // Interstellar layout is unaffected by the stage; just track it.
      stageRef.current = targetStage;
      updateHudTexture(targetStage, hudPlaneRef.current, hudTextureRef.current);
    }
  }, [stage, isInterstellar]);

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
      velocities,
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

        // Catalog jump: hidden rebuild behind a pan-away / rack-focus shot.
        directorRequest("scene", "scene", () =>
          rebuildInterstellarInstant(window.innerWidth, window.innerHeight, true)
        );
      } catch (err) {
        console.error("[COSMIC DEBUG] Failed to activate sequence:", err);
      }
    };

    generateInterstellarSceneInstant(ww, wh, isInterstellarRef.current);
    if (isInterstellarRef.current) {
      mapParticlesToInterstellar(ww, wh);
    } else {
      fetchNextGeminiScene();
      mapParticlesToStage(stageRef.current, false);
    }
    prevInterstellarPropRef.current = isInterstellarRef.current;
    prevStagePropRef.current = stageRef.current;
    hasInitializedRef.current = true;
    if (cinematicRef.current) cinematicRef.current.openingPending = true;

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
        velocities,
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
        cinematicRef,
      });
    };

    engine.runRenderLoop(() => {
      if (scene.isDisposed || !rendererRef.current) return;
      render();
      if (!scene.isDisposed) {
        scene.render();
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
      isSlingshotModeRef,
      targetZoomToHorizonRef,
      zoomToHorizonRef,
      shatterIntensityRef,
    });

    (window as any).__cosmicCanvas = {
      triggerTDE,
      triggerSupernovaTransition: () => triggerSupernovaTransition(window.innerWidth / 2, window.innerHeight / 2),
      startWormholeTransit: () => startWormholeTransit(),
      generateInterstellarScene: (force?: boolean) => {
        directorRequest("scene", "scene", () =>
          rebuildInterstellarInstant(window.innerWidth, window.innerHeight, force ?? true)
        );
      },
      collideBodies: () => collideBodies(),
      feedBlackHole: () => feedBlackHole(),
      plungeIntoBlackHole: () => plungeIntoBlackHole(),
      getCinematicState: () => ({
        phase: cinematicRef.current?.director.currentPhase ?? "IDLE",
        capturing: Boolean(cinematicRef.current?.capture),
        transitActive: Boolean(isTransitActiveRef.current),
        idleBlend: cinematicRef.current?.idleBlend ?? 0,
        camera: cameraRef.current ? {
          x: cameraRef.current.position.x, y: cameraRef.current.position.y,
          z: cameraRef.current.position.z, fov: cameraRef.current.fov,
        } : null,
        fx: { ...cinematicFx },
      }),
      nextScene: () => {
        if (Math.random() > 0.5) {
          triggerSupernovaTransition(window.innerWidth / 2, window.innerHeight / 2);
        } else {
          startWormholeTransit();
        }
      },
      getCurrentArchetype: () => archetypeRef.current,
      getEntities: () => celestialEntitiesRef.current,
      launchProbe: () => {
        const ww = window.innerWidth;
        const wh = window.innerHeight;
        const spawnX = ww * 0.2 + Math.random() * (ww * 0.6);
        const spawnY = wh * 0.2 + Math.random() * (wh * 0.6);
        const bh = celestialEntitiesRef.current.find((ent) => !ent.isDestroyed && ent.type === "blackhole");
        const targetX = bh ? bh.x : ww / 2;
        const targetY = bh ? bh.y : wh / 2;
        const dx = targetX - spawnX;
        const dy = targetY - spawnY;
        const dist = Math.hypot(dx, dy) || 1;
        const speed = 20.0;

        probesRef.current.push({
          id: `probe-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          x: spawnX,
          y: spawnY,
          z: 0,
          vx: (dx / dist) * speed + (-dy / dist) * 7.0,
          vy: (dy / dist) * speed + (dx / dist) * 7.0,
          vz: (Math.random() - 0.5) * 2.0,
          color: "#4deeea",
          trail: [{ x: spawnX, y: spawnY, z: 0, alpha: 1.0 }],
          life: 1.0,
          maxLife: 1.0,
          isSwallowed: false,
          maxSpeedReached: speed,
          lastWhipTime: 0,
        });
        if (audio.playProbeLaunch) audio.playProbeLaunch();
        ripplesRef.current.push({ x: spawnX, y: spawnY, life: 0.6 });
      },
      triggerPulsarShockwave: () => {
        cameraShakeRef.current = 14.0;
        if (audio.playRippleShockwave) audio.playRippleShockwave();
        ripplesRef.current.push({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
          life: 1.0,
        });
      },
      cycleTargetLock: () => {
        const activeEntities = celestialEntitiesRef.current.filter(
          (e) => !e.isDestroyed && e.type !== "nebula"
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

    // Holding the horizon zoom at its limit hands the camera to the hole.
    if (cinematicRef.current) {
      cinematicRef.current.onHorizonHold = () => {
        plungeIntoBlackHole();
      };
    }

    const onCinematicKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable)) return;
      if (e.key === "b" || e.key === "B") plungeIntoBlackHole();
      else if (e.key === "k" || e.key === "K") collideBodies();
      else if (e.key === "f" || e.key === "F") feedBlackHole();
    };
    window.addEventListener("keydown", onCinematicKey);

    return () => {
      window.removeEventListener("keydown", onCinematicKey);
      if (cinematicRef.current) {
        cinematicRef.current.director.reset(false);
        cinematicRef.current.rig.reset();
        cinematicRef.current.capture = null;
        cinematicRef.current.onCaptureComplete = undefined;
        cinematicRef.current.onHorizonHold = undefined;
      }
      resetCinematicFx();
      hasInitializedRef.current = false;
      mappingTimersRef.current.forEach(clearTimeout);
      mappingTimersRef.current = [];

      disposeCollisionFlares(collisionFlaresRef.current);

      // 1. Remove event listeners and pointer observers
      cleanupEvents();

      // 2. Dispose all active celestial mesh subsystems (e.g., Hawking radiation systems)
      celestialMeshInstancesRef.current.forEach((inst) => {
        if (inst.hawkingSystem && typeof inst.hawkingSystem.dispose === "function") {
          inst.hawkingSystem.dispose();
        }
      });
      celestialMeshInstancesRef.current = [];

      // 3. Dispose all post-processes, custom FX instances, and rendering pipelines while scene and engine are still active
      lensingPostProcessRef.current?.dispose();
      wormholePostProcessRef.current?.dispose();
      dofPostProcessRef.current?.dispose();
      shatterPostProcessRef.current?.dispose();
      activeTdeFxRef.current?.dispose();
      activeSupernovaFxRef.current?.dispose();
      activeSupernovaFxRef.current = null;
      glowLayerRef.current?.dispose();
      glowLayerRef.current = null;
      hudTextureRef.current?.dispose();
      hudTextureRef.current = null;
      hudPlaneRef.current?.dispose();
      hudPlaneRef.current = null;
      composerRef.current?.dispose();

      // 4. Dispose the scene (frees meshes, materials, and textures)
      if (sceneRef.current) {
        sceneRef.current.dispose();
      }

      // 5. Terminate render loop and dispose the engine last
      if (rendererRef.current) {
        rendererRef.current.stopRenderLoop();
        rendererRef.current.dispose();
      }

      // 6. Clean up window globals
      delete (window as any).triggerTDE;
      delete (window as any).activateSequence;
      delete (window as any).__cosmicCanvas;
      delete (window as any).__onSelectedEntityChange;
      delete (window as any).__cinematicMode;
      delete (window as any).__cinematicCameraMode;
      delete (window as any).__cinematicSpeedMultiplier;
      delete (window as any).__anamorphicFlare;
      delete (window as any).__dofEnabled;
      delete (window as any).__targetHorizonZoom;
      delete (window as any).__horizonPushAt;
      delete (window as any).__horizonZoom;
      delete (window as any).__shatterIntensity;
      delete (window as any).__hasShatteredSound;
      delete (window as any).__hawkingActive;
      delete (window as any).__hawkingIntensity;
      delete (window as any).__forcedNextArchetype;
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="block w-full h-full" id="canvas-babylon" />
      <GravitationalInteractionsOverlay
        slingshotAimRef={slingshotAimRef}
        probesRef={probesRef}
        tdeStateRef={tdeStateRef}
        celestialEntitiesRef={celestialEntitiesRef}
        mouseRef={mouseRef}
        isSlingshotMode={isSlingshotMode}
        sceneRef={sceneRef}
        cameraRef={cameraRef}
        rendererRef={rendererRef}
      />
      <DebugObjectOverlay
        celestialEntitiesRef={celestialEntitiesRef}
        sceneRef={sceneRef}
        cameraRef={cameraRef}
        rendererRef={rendererRef}
        showDebug={!!showDebug}
        stage={stage}
        supernovaRef={supernovaRef}
        activeWormholeRef={activeWormholeRef}
      />
    </div>
  );
};
