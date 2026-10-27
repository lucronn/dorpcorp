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
        if (cameraRef.current) {
          transitionStartTimeRef.current = Date.now();
          transitionActiveRef.current = true;
          transitionStartPosRef.current = cameraRef.current.position.clone();
        }
        generateInterstellarScene(window.innerWidth, window.innerHeight, true, posX, posY);
        mapParticlesToInterstellar(window.innerWidth, window.innerHeight);
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
    const ww = window.innerWidth;
    const wh = window.innerHeight;
    if (isInterstellar) {
      generateInterstellarScene(ww, wh, true);
      mapParticlesToInterstellar(ww, wh);
    } else {
      mapParticlesToStage(stageRef.current, true);
    }
  }, [isInterstellar]);

  useEffect(() => {
    const prevStage = stageRef.current;
    stageRef.current = stage;
    lastStageChangeRef.current = Date.now();

    if (prevStage !== stage && cameraRef.current) {
      transitionStartTimeRef.current = Date.now();
      transitionActiveRef.current = true;
      transitionStartPosRef.current = cameraRef.current.position.clone();
    }

    mappingTimersRef.current.forEach(clearTimeout);
    mappingTimersRef.current = [];

    const isProjectToProject =
      stage >= 2 && stage <= 5 && prevStage >= 2 && prevStage <= 5;

    if (!isInterstellar) {
      mapParticlesToStage(stage, !isProjectToProject);
    } else {
      mapParticlesToInterstellar(window.innerWidth, window.innerHeight);
    }
    updateHudTexture(stage, hudPlaneRef.current, hudTextureRef.current);
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

    generateInterstellarScene(ww, wh, isInterstellarRef.current);
    if (isInterstellarRef.current) {
      mapParticlesToInterstellar(ww, wh);
    } else {
      fetchNextGeminiScene();
      mapParticlesToStage(stageRef.current, false);
    }

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
      targetZoomToHorizonRef,
      zoomToHorizonRef,
      shatterIntensityRef,
    });

    (window as any).__cosmicCanvas = {
      triggerTDE,
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

    return () => {
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
