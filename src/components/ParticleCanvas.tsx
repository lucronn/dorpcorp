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
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
      ambient: false,
      celestial: true,
      bridges: true,
      tails: true,
      typography: true,
    }
  );

  useEffect(() => {
    if (particleFilters) {
      particleFiltersRef.current = particleFilters;
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
    if (isInterstellar) {
      const ww = window.innerWidth;
      const wh = window.innerHeight;
      generateInterstellarScene(ww, wh, true);
      mapParticlesToInterstellar(ww, wh);
    } else {
      celestialMeshInstancesRef.current.forEach((inst) => {
        inst.mesh.getChildMeshes(false).forEach((m) => {
          if (m.material) m.material.dispose();
          m.dispose();
        });
        inst.mesh.dispose();
      });
      celestialMeshInstancesRef.current = [];
      celestialEntitiesRef.current = [];
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
    pipeline.bloomThreshold = 0.82;
    pipeline.bloomWeight = 0.12;
    pipeline.bloomKernel = 64;
    pipeline.bloomScale = 0.5;

    // Cinematic Chromatic Aberration
    pipeline.chromaticAberrationEnabled = true;
    if (pipeline.chromaticAberration) {
      pipeline.chromaticAberration.aberrationAmount = 2.0;
      pipeline.chromaticAberration.radialIntensity = 0.5;
    }

    // Subtle cosmic film grain
    pipeline.grainEnabled = true;
    if (pipeline.grain) {
      pipeline.grain.intensity = 4.5;
      pipeline.grain.animated = true;
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

    if (isInterstellarRef.current) {
      generateInterstellarScene(ww, wh, true);
      mapParticlesToInterstellar(ww, wh);
    } else {
      celestialEntitiesRef.current = [];
      fetchNextGeminiScene();
      mapParticlesToStage(stageRef.current, false);
    }

    const spawnTailParticle = (
      x: number,
      y: number,
      z: number,
      vx: number,
      vy: number,
      color: string,
      decayRate?: number
    ) => {
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
        tailP.color = color;
        tailP.baseColor = color;
        if (color.startsWith("#") && color.length >= 7) {
          tailP.r = parseInt(color.slice(1, 3), 16);
          tailP.g = parseInt(color.slice(3, 5), 16);
          tailP.b = parseInt(color.slice(5, 7), 16);
        } else if (color.startsWith("rgb")) {
          const matches = color.match(/\d+/g);
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
    });

    return () => {
      cleanupEvents();
      delete (window as any).activateSequence;
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="block w-full h-full" id="canvas-babylon" />
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
