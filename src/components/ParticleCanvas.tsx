import React, { useEffect, useRef } from "react";
import * as BABYLON from "@babylonjs/core";
import { audio } from "../utils/audio";
import { Particle, projects } from "../types";
import { drawStageLayoutTemplate, generateTargetsForStage } from "./ParticleCanvas/ParticleUtils";
import { CelestialEntity, ParticleCanvasProps, ParticleFilters } from "./ParticleCanvas/types";
import { DebugObjectOverlay } from "./DebugObjectOverlay";
import {
  blendHexColors as _blendHexColors,
  createDustSplash as _createDustSplash,
  createShatterDebris as _createShatterDebris,
  createSpaghettificationDebris as _createSpaghettificationDebris,
  swallowEntity as _swallowEntity,
  resolveCelestialCollision,
  computeCurlNoise,
  fBmNoise2D,
} from "./ParticleCanvas/PhysicsUtils";
import { ParticleSystemManager } from "./ParticleCanvas/ParticleSystemManager";
import { spawnSupernovaFX, SupernovaFXInstance } from "./ParticleCanvas/SupernovaFX";

import { initializeScene } from "./ParticleCanvas/SceneSetup";
import {
  createCircleTexture,
  generateAccretionDiskTexture,
  generatePhotonRingTexture,
  generateAdvancedPlanetTexture,
  generatePlanetNightLightsTexture,
  generatePlanetBumpNormalTexture,
  generateProceduralCloudTexture,
  generateAuroraTexture,
  generateStarTexture,
  generateConcentricRingTexture,
  generateDistortedLightwaveTexture,
  createCircularGlowTexture,
  parseColorToRgb,
  parseColorToBabylonColor3,
  parseColorToBabylonColor4,
  generateGalaxyTexture,
  generateNebulaTexture,
} from "./ParticleCanvas/TextureUtils";

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

  const particleFiltersRef = useRef<ParticleFilters>(particleFilters || {
    ambient: false,
    celestial: true,
    bridges: true,
    tails: true,
    typography: true,
  });

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
  const fovRef = useRef(60);
  const cameraZRef = useRef(600);
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
  const stageTargetsRef = useRef<{ x: number; y: number; color: string }[][]>(
    [],
  );
  const particlesRef = useRef<Particle[]>([]);
  const stageRef = useRef(stage);
  const isInterstellarRef = useRef(isInterstellar);
  const isTransitActiveRef = useRef<boolean>(false);
  const transitTargetPosRef = useRef<BABYLON.Vector3 | null>(null);
  const transitDirRef = useRef<BABYLON.Vector3 | null>(null);
  const transitStartTimeRef = useRef<number>(0);
  const lastStageChangeRef = useRef<number>(Date.now());
  const smoothedAmpRef = useRef<number>(0);
  const smoothedBassRef = useRef<number>(0);
  const smoothedMidRef = useRef<number>(0);
  const smoothedTrebleRef = useRef<number>(0);
  const mouseRef = useRef({ x: -1000, y: -1000, lastMoved: Date.now() });
  const lastAutonomousEventTimeRef = useRef<number>(Date.now());
  const activeWormholeRef = useRef<{ startEntityIdx: number; endEntityIdx: number; life: number; duration: number } | null>(null);
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
  const collisionFlaresRef = useRef<Array<{ mesh: BABYLON.Mesh; life: number; maxLife: number; initialRadius: number }>>([]);
  const mappingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scrollVelocityRef = useRef(0);
  const lastScrollYRef = useRef(
    window.scrollY || document.documentElement.scrollTop,
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

  const blendHexColors = _blendHexColors;
  const createDustSplash = (x: number, y: number, color: string, count: number) => {
    if (spawnTailParticleRef.current) {
      _createDustSplash(x, y, color, count, spawnTailParticleRef.current);
    }
  };
  const createShatterDebris = (x: number, y: number, color: string, count: number) => {
    if (spawnTailParticleRef.current) {
      _createShatterDebris(x, y, color, count, spawnTailParticleRef.current);
    }
  };
  const createSpaghettificationDebris = (bh: CelestialEntity, victim: CelestialEntity) => {
    if (spawnTailParticleRef.current) {
      _createSpaghettificationDebris(bh, victim, spawnTailParticleRef.current);
    }
  };
  const swallowEntity = _swallowEntity;
  const interstellarSceneGeneratedTimeRef = useRef<number>(Date.now());

  const hexToRgba = (hex: string, alpha: number) => {
    if (!hex || !hex.startsWith("#")) return hex;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const fetchNextGeminiScene = async () => {
    if (isFetchingGeminiRef.current) return;
    isFetchingGeminiRef.current = true;
    try {
      const res = await fetch("/api/generate-cosmic-scene", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data && data.systemName) {
          nextGeminiSceneRef.current = data;
        }
      }
    } catch (e) {
      console.warn("Failed to fetch custom Gemini scene:", e);
    } finally {
      isFetchingGeminiRef.current = false;
    }
  };

  const transitionToNewEntities = (newEntities: CelestialEntity[]) => {
    const currentEntities = celestialEntitiesRef.current;
    console.log(`[DEBUG] transitionToNewEntities: Incoming new entities count = ${newEntities.length}. Current entities count before transition = ${currentEntities.length}`);
    
    currentEntities.forEach(cur => {
      cur.startX = cur.x;
      cur.startY = cur.y;
      cur.startZ = cur.z ?? 0;
      cur.startRadius = cur.radius;
      cur.startScale = cur.scale ?? 1.0;
      
      cur.targetX = cur.x;
      cur.targetY = cur.y;
      cur.targetZ = cur.z ?? 0;
      cur.targetRadius = 0;
      cur.targetScale = 0.0;
      cur.isDestroyed = true;
    });

    const spawnX = supernovaRef.current ? supernovaRef.current.x : window.innerWidth / 2;
    const spawnY = supernovaRef.current ? supernovaRef.current.y : window.innerHeight / 2;
    console.log(`[DEBUG] transitionToNewEntities: Spawn center determined as (${spawnX}, ${spawnY})`);

    newEntities.forEach((target, i) => {
      const curNew: CelestialEntity = {
        ...target,
        x: spawnX,
        y: spawnY,
        z: -200,
        startX: spawnX,
        startY: spawnY,
        startZ: -200,
        scale: 0.0,
        startScale: 0.0,
        targetScale: 1.0,
        isDestroyed: false,
        id: target.id || `${target.type}-${i}-${Math.random().toString(36).substring(2, 9)}`,
        startRadius: 1,
        targetX: target.x,
        targetY: target.y,
        targetZ: target.z ?? 0,
        targetRadius: target.radius,
      };
      currentEntities.push(curNew);
      console.log(`[DEBUG] Added entity ${curNew.id} (${curNew.type}) at spawn center. Target coordinate: (${curNew.targetX}, ${curNew.targetY})`);
    });
    
    entityTransitionActiveRef.current = true;
    entityTransitionStartTimeRef.current = Date.now();
  };

  const registerAndSaveSequence = (
    systemName: string,
    systemDesc: string,
    systemTags: string[],
    entitiesList: CelestialEntity[]
  ) => {
    const seqId = "seq-" + systemName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    try {
      const saved = localStorage.getItem("cosmic_debug_sequences");
      const list = saved ? JSON.parse(saved) : {};
      list[seqId] = {
        id: seqId,
        systemName,
        systemDesc,
        systemTags,
        archetype: archetypeRef.current,
        entities: entitiesList.map(e => ({
          type: e.type,
          radius: e.radius,
          color: e.color,
          secondaryColor: e.secondaryColor || e.color,
          hasRings: e.hasRings || false,
          ringColor: e.ringColor || "",
          x: e.x,
          y: e.y,
          z: e.z || 0,
          vx: e.vx || 0,
          vy: e.vy || 0,
          vz: e.vz || 0,
          mass: e.mass,
          scale: e.scale,
          currentRadius: e.currentRadius,
          originalRadius: e.originalRadius,
          targetRadius: e.targetRadius,
          isPhysicsEnabled: e.isPhysicsEnabled || false,
          isDestroyed: e.isDestroyed || false,
          isSwallowing: e.isSwallowing || false,
          destroyedBy: e.destroyedBy || "",
        }))
      };
      localStorage.setItem("cosmic_debug_sequences", JSON.stringify(list));
      localStorage.setItem("cosmic_last_sequence_id", seqId);
      
      console.log(`%c[COSMIC DEBUG] Active Sequence ID: ${seqId}`, "color: #4deeea; font-weight: bold; font-size: 11px;");
      console.log(`%cTo recall this sequence, run: %cactivateSequence("${seqId}")`, "color: #9ca3af;", "color: #ffd778; font-family: monospace; font-weight: bold;");
    } catch (e) {
      // Ignore gracefully
    }
    if (onSequenceGenerated) {
      onSequenceGenerated({
        id: seqId,
        name: systemName,
        description: systemDesc,
        tags: systemTags,
      });
    }
  };

  const generateInterstellarScene = (width: number, height: number, forceInterstellar = false) => {
    console.log(`[DEBUG] generateInterstellarScene: width = ${width}, height = ${height}, forceInterstellar = ${forceInterstellar}, stage = ${stageRef.current}, isInterstellar = ${isInterstellarRef.current}`);
    const entities: CelestialEntity[] = [];
    const isMobile = width < 768;

    if (!isInterstellarRef.current && !forceInterstellar) {
      // Non-interstellar typography mode: clear celestial entities so they do not obscure or consume text on load
      celestialEntitiesRef.current = [];
      return;
    }

    // Try to consume pre-fetched Gemini scene first
    const geminiData = nextGeminiSceneRef.current;
    if (geminiData && Array.isArray(geminiData.entities) && geminiData.entities.length > 0) {
      console.log(`[DEBUG] generateInterstellarScene: Found buffered Gemini scene "${geminiData.systemName}" (Archetype: ${geminiData.archetype}) with ${geminiData.entities.length} entities.`);
      // Clear it from buffer so we don't repeat
      nextGeminiSceneRef.current = null;
      // Pre-fetch the *next* one immediately for the subsequent collapse
      fetchNextGeminiScene();

      archetypeRef.current = geminiData.archetype;
      const systemName = geminiData.systemName;
      const systemDesc = geminiData.systemDesc;
      const systemTags = geminiData.systemTags;

      const cx = width / 2;
      const cy = height / 2;

      // If the saved scene contains exact coordinates, restore them directly!
      const hasStoredCoordinates = Array.isArray(geminiData.entities) && geminiData.entities.some((e: any) => e.x !== undefined && e.y !== undefined);

      if (hasStoredCoordinates) {
        geminiData.entities.forEach((entity: any) => {
          entities.push({
            type: entity.type,
            x: entity.x,
            y: entity.y,
            z: entity.z !== undefined ? entity.z : 0,
            radius: Math.min(entity.radius || 20, 120),
            color: entity.color,
            secondaryColor: entity.secondaryColor || entity.color,
            hasRings: entity.hasRings || false,
            ringColor: entity.ringColor || "",
            orbitRadius: entity.orbitRadius || 0,
            orbitAngle: entity.orbitAngle || 0,
            orbitSpeed: entity.orbitSpeed || 0,
            centerX: entity.centerX !== undefined ? entity.centerX : cx,
            centerY: entity.centerY !== undefined ? entity.centerY : cy,
            vx: entity.vx !== undefined ? entity.vx : 0,
            vy: entity.vy !== undefined ? entity.vy : 0,
            vz: entity.vz !== undefined ? entity.vz : 0,
            mass: entity.mass !== undefined ? entity.mass : (entity.radius * entity.radius),
            initialMass: entity.initialMass !== undefined ? entity.initialMass : (entity.radius * entity.radius),
            scale: entity.scale !== undefined ? entity.scale : 0.05,
            currentRadius: Math.min(entity.currentRadius !== undefined ? entity.currentRadius : (entity.radius || 20), 120),
            originalRadius: Math.min(entity.originalRadius !== undefined ? entity.originalRadius : (entity.radius || 20), 120),
            targetRadius: Math.min(entity.targetRadius !== undefined ? entity.targetRadius : (entity.radius || 20), 120),
            isPhysicsEnabled: entity.isPhysicsEnabled !== undefined ? entity.isPhysicsEnabled : false,
            isDestroyed: entity.isDestroyed !== undefined ? entity.isDestroyed : false,
            isSwallowing: entity.isSwallowing !== undefined ? entity.isSwallowing : false,
            destroyedBy: entity.destroyedBy || "",
          });
        });
      } else if (Array.isArray(geminiData.entities) && geminiData.entities.length > 0) {
        // Position entities Procedurally & Gracefully
        // If there is a blackhole, find and place it first at (cx, cy)
        const bhEntity = geminiData.entities.find((e: any) => e.type === "blackhole");
        if (bhEntity) {
          entities.push({
            type: "blackhole",
            x: cx,
            y: cy,
            radius: Math.min(bhEntity.radius || 30, 120),
            color: bhEntity.color,
            secondaryColor: bhEntity.secondaryColor || bhEntity.color,
            vx: 0,
            vy: 0,
            mass: Math.min(bhEntity.radius || 30, 120) * Math.min(bhEntity.radius || 30, 120) * 15,
            initialMass: Math.min(bhEntity.radius || 30, 120) * Math.min(bhEntity.radius || 30, 120) * 15,
            scale: 0,
            currentRadius: Math.min(bhEntity.radius || 30, 120),
            originalRadius: Math.min(bhEntity.radius || 30, 120),
            targetRadius: Math.min(bhEntity.radius || 30, 120),
            isPhysicsEnabled: false,
            isDestroyed: false,
          });
        }

        // Filter and place non-blackhole entities
        const otherEntities = geminiData.entities.filter((e: any) => e.type !== "blackhole");
        otherEntities.forEach((entity: any, idx: number) => {
          const orbitRad = (isMobile ? 350 : 600) + idx * (isMobile ? 180 : 320);
          const angle = Math.random() * Math.PI * 2;
          // Slow down orbit speed by half to meet "slow it down" request
          const orbitSpeed = (0.0012 + Math.random() * 0.0012);

          entities.push({
            type: entity.type,
            x: cx + Math.cos(angle) * orbitRad,
            y: cy + Math.sin(angle) * orbitRad,
            radius: Math.min(entity.radius || 20, 120),
            color: entity.color,
            secondaryColor: entity.secondaryColor || entity.color,
            hasRings: entity.hasRings,
            ringColor: entity.ringColor,
            orbitRadius: orbitRad,
            orbitAngle: angle,
            orbitSpeed: orbitSpeed,
            centerX: cx,
            centerY: cy,
            vx: -Math.sin(angle) * orbitRad * orbitSpeed * 1.5,
            vy: Math.cos(angle) * orbitRad * orbitSpeed * 1.5,
            mass: Math.min(entity.radius || 20, 120) * Math.min(entity.radius || 20, 120),
            initialMass: Math.min(entity.radius || 20, 120) * Math.min(entity.radius || 20, 120),
            scale: 0,
            currentRadius: Math.min(entity.radius || 20, 120),
            originalRadius: Math.min(entity.radius || 20, 120),
            targetRadius: Math.min(entity.radius || 20, 120),
            isPhysicsEnabled: false,
            isDestroyed: false,
          });
        });
      }

      transitionToNewEntities(entities);
      interstellarSceneGeneratedTimeRef.current = Date.now();

      registerAndSaveSequence(systemName, systemDesc, systemTags, entities);
      return;
    }

    const archetypes = [
      "BLACKHOLE_CENTRIC",
      "BINARY_PLANETS",
      "NEBULA_CRADLE",
      "EXOPLANET_CLUSTER",
      "SPIRAL_GALAXY",
    ];
    const chosenArchetype =
      archetypes[Math.floor(Math.random() * archetypes.length)] ||
      "BLACKHOLE_CENTRIC";
    archetypeRef.current = chosenArchetype;
    console.log(`[DEBUG] generateInterstellarScene: No buffered Gemini scene. Selected procedural fallback archetype: "${chosenArchetype}".`);

    let systemName = "The Void";
    let systemDesc =
      "An unformed region of space-time, awaiting seed dynamics.";
    let systemTags: string[] = ["★ AMBIENT"];

    const cx = width / 2;
    const cy = height / 2;

    if (chosenArchetype === "BLACKHOLE_CENTRIC") {
      systemName = "Singularity Core";
      systemDesc =
        "A supermassive rotating black hole locking dozens of systems in an aggressive, tightly wrapped accretion orbit. Spacetime bends visibly near the horizon.";
      systemTags = ["🕳 BLACK HOLE", "☄ ACCRETION DISK", "★ GRAVITY SHEAR"];

      const bhRad = isMobile ? 45 : 75;
      entities.push({
        type: "blackhole",
        x: cx,
        y: cy,
        radius: bhRad,
        color: "#ff6600",
        secondaryColor: "#f25f35",
        vx: 0,
        vy: 0,
        mass: bhRad * bhRad * 15,
        initialMass: bhRad * bhRad * 15,
        scale: 0,
        currentRadius: bhRad,
        originalRadius: bhRad,
        targetRadius: bhRad,
        isPhysicsEnabled: false,
        isDestroyed: false,
      });

      const pCount = isMobile ? 1 : 2;
      for (let p = 0; p < pCount; p++) {
        const orbitRad = (isMobile ? 500 : 850) + p * (isMobile ? 250 : 400);
        const angle = Math.random() * Math.PI * 2;
        const pRadius = (isMobile ? 12 : 22) + Math.random() * 12;
        const orbitSpeed = 0.003 + Math.random() * 0.003;

        entities.push({
          type: "planet",
          x: cx + Math.cos(angle) * orbitRad,
          y: cy + Math.sin(angle) * orbitRad,
          radius: pRadius,
          color: p === 0 ? "#4deeea" : "#ffd778",
          secondaryColor: "#00ffd2",
          hasRings: Math.random() > 0.4,
          ringColor:
            p === 0 ? "rgba(77, 238, 234, 0.45)" : "rgba(255, 215, 120, 0.4)",
          orbitRadius: orbitRad,
          orbitAngle: angle,
          orbitSpeed: orbitSpeed,
          centerX: cx,
          centerY: cy,
          vx: -Math.sin(angle) * orbitRad * orbitSpeed * 1.5,
          vy: Math.cos(angle) * orbitRad * orbitSpeed * 1.5,
          mass: pRadius * pRadius,
          initialMass: pRadius * pRadius,
          scale: 0,
          currentRadius: pRadius,
          originalRadius: pRadius,
          targetRadius: pRadius,
          isPhysicsEnabled: false,
          isDestroyed: false,
        });
      }
    } else if (chosenArchetype === "BINARY_PLANETS") {
      systemName = "Gemini Synapse";
      systemDesc =
        "A dance of twin sister planets locked in mutual orbit, connected by a high-energy particle bridge and cloaked in a dense orbital nebula.";
      systemTags = [
        "🪐 TWIN PLANETS",
        "🌈 ENERGETIC BRIDGE",
        "☁ NEBULA SHIELD",
      ];

      const separation = isMobile ? 350 : 650;
      const p1Radius = isMobile ? 25 : 45;
      const p2Radius = isMobile ? 22 : 38;

      entities.push({
        type: "planet",
        x: cx - separation,
        y: cy,
        radius: p1Radius,
        color: "#00ffd2",
        secondaryColor: "#20c997",
        hasRings: true,
        ringColor: "rgba(0,255,210,0.35)",
        orbitRadius: separation,
        orbitAngle: Math.PI,
        orbitSpeed: 0.004,
        centerX: cx,
        centerY: cy,
        vx: -Math.sin(Math.PI) * separation * 0.004 * 1.5,
        vy: Math.cos(Math.PI) * separation * 0.004 * 1.5,
        mass: p1Radius * p1Radius,
        initialMass: p1Radius * p1Radius,
        scale: 0,
        currentRadius: p1Radius,
        originalRadius: p1Radius,
        targetRadius: p1Radius,
        isPhysicsEnabled: false,
        isDestroyed: false,
      });

      entities.push({
        type: "planet",
        x: cx + separation,
        y: cy,
        radius: p2Radius,
        color: "#da70d6",
        secondaryColor: "#8a2be2",
        hasRings: false,
        orbitRadius: separation,
        orbitAngle: 0,
        orbitSpeed: 0.004,
        centerX: cx,
        centerY: cy,
        vx: -Math.sin(0) * separation * 0.004 * 1.5,
        vy: Math.cos(0) * separation * 0.004 * 1.5,
        mass: p2Radius * p2Radius,
        initialMass: p2Radius * p2Radius,
        scale: 0,
        currentRadius: p2Radius,
        originalRadius: p2Radius,
        targetRadius: p2Radius,
        isPhysicsEnabled: false,
        isDestroyed: false,
      });

      const nebRad = isMobile ? 250 : 450;
      entities.push({
        type: "nebula",
        x: cx,
        y: cy,
        radius: nebRad,
        color: "rgba(120, 80, 220, 0.14)",
        vx: 0,
        vy: 0,
        mass: nebRad * nebRad * 0.02,
        scale: 0,
        currentRadius: nebRad,
        originalRadius: nebRad,
        targetRadius: nebRad,
        isPhysicsEnabled: false,
        isDestroyed: false,
      });
    } else if (chosenArchetype === "NEBULA_CRADLE") {
      systemName = "Vela Breeding Ground";
      systemDesc =
        "A majestic, multi-colored stellar nursery where new stars coalesce within beautiful gas envelopes of stellar dust.";
      systemTags = ["★ STELLAR NURSERY", "🔮 VELA NEBULA", "🪐 PROTOPLANETS"];

      const angle1 = Math.atan2(-(isMobile ? 50 : 90), -(isMobile ? 80 : 160));
      const angle2 = Math.atan2(isMobile ? 50 : 90, isMobile ? 80 : 160);
      const radius1 = Math.sqrt(
        (isMobile ? 80 : 160) ** 2 + (isMobile ? 50 : 90) ** 2,
      );
      const neb1Rad = isMobile ? 220 : 360;
      const neb2Rad = isMobile ? 200 : 340;
      const pRadius = isMobile ? 16 : 28;

      entities.push({
        type: "nebula",
        x: cx + Math.cos(angle1) * radius1,
        y: cy + Math.sin(angle1) * radius1,
        radius: neb1Rad,
        color: "rgba(242, 95, 53, 0.16)",
        orbitRadius: radius1,
        orbitAngle: angle1,
        orbitSpeed: 0.001,
        centerX: cx,
        centerY: cy,
        vx: -Math.sin(angle1) * radius1 * 0.001 * 1.5,
        vy: Math.cos(angle1) * radius1 * 0.001 * 1.5,
        mass: neb1Rad * neb1Rad * 0.02,
        scale: 0,
        currentRadius: neb1Rad,
        originalRadius: neb1Rad,
        targetRadius: neb1Rad,
        isPhysicsEnabled: false,
        isDestroyed: false,
      });

      entities.push({
        type: "nebula",
        x: cx + Math.cos(angle2) * radius1,
        y: cy + Math.sin(angle2) * radius1,
        radius: neb2Rad,
        color: "rgba(77, 238, 234, 0.15)",
        orbitRadius: radius1,
        orbitAngle: angle2,
        orbitSpeed: 0.001,
        centerX: cx,
        centerY: cy,
        vx: -Math.sin(angle2) * radius1 * 0.001 * 1.5,
        vy: Math.cos(angle2) * radius1 * 0.001 * 1.5,
        mass: neb2Rad * neb2Rad * 0.02,
        scale: 0,
        currentRadius: neb2Rad,
        originalRadius: neb2Rad,
        targetRadius: neb2Rad,
        isPhysicsEnabled: false,
        isDestroyed: false,
      });

      entities.push({
        type: "planet",
        x: cx,
        y: cy,
        radius: pRadius,
        color: "#ffd778",
        secondaryColor: "#f25f35",
        vx: 0,
        vy: 0,
        mass: pRadius * pRadius,
        scale: 0,
        currentRadius: pRadius,
        originalRadius: pRadius,
        targetRadius: pRadius,
        isPhysicsEnabled: false,
        isDestroyed: false,
      });
    } else if (chosenArchetype === "EXOPLANET_CLUSTER") {
      systemName = "Solana Triad";
      systemDesc =
        "Three pristine crystal exoplanets clustered in a highly dynamic, co-orbital gravitational field, woven together by a network of glowing particle highways.";
      systemTags = ["🪐 ORBITAL TRIAD", "⚡ CONNECTOR HIGHS", "★ DEEP VOID"];

      const r = isMobile ? 350 : 600;

      for (let i = 0; i < 3; i++) {
        const angle = (i * Math.PI * 2) / 3;
        const pRadius = (isMobile ? 14 : 24) + Math.random() * 8;
        const orbitSpeed = 0.0035;

        entities.push({
          type: "planet",
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
          radius: pRadius,
          color: i === 0 ? "#4deeea" : i === 1 ? "#ffd778" : "#ff5e62",
          secondaryColor: "#ffffff",
          hasRings: i === 0,
          ringColor: "rgba(77, 238, 234, 0.35)",
          orbitRadius: r,
          orbitAngle: angle,
          orbitSpeed: orbitSpeed,
          centerX: cx,
          centerY: cy,
          vx: -Math.sin(angle) * r * orbitSpeed * 1.5,
          vy: Math.cos(angle) * r * orbitSpeed * 1.5,
          mass: pRadius * pRadius,
          scale: 0,
          currentRadius: pRadius,
          originalRadius: pRadius,
          targetRadius: pRadius,
          isPhysicsEnabled: false,
          isDestroyed: false,
        });
      }
    } else if (chosenArchetype === "SPIRAL_GALAXY") {
      systemName = "Andromeda Shard";
      systemDesc =
        "A magnificent grand-design spiral galaxy spinning in silent majesty. Millions of newborn stars cluster in dense spiral arms fueled by rich interstellar dust lanes.";
      systemTags = ["🌌 SPIRAL GALAXY", "☄ GALACTIC CORE", "★ STELLAR DISPERSION"];

      // 1. Central Galactic Nucleus
      const nucleusRad = isMobile ? 32 : 55;
      entities.push({
        type: "star",
        x: cx,
        y: cy,
        radius: nucleusRad,
        color: "#ffffff",
        secondaryColor: "#ffeaad",
        vx: 0,
        vy: 0,
        mass: nucleusRad * nucleusRad * 12,
        scale: 0,
        currentRadius: nucleusRad,
        originalRadius: nucleusRad,
        targetRadius: nucleusRad,
        isPhysicsEnabled: false,
        isDestroyed: false,
      });

      // 2. Add two nebulas along the spiral arm paths to act as the glowing galactic core glow and arm dust
      const armDist = isMobile ? 120 : 200;

      entities.push({
        type: "nebula",
        x: cx,
        y: cy,
        radius: isMobile ? 180 : 300,
        color: "rgba(218, 112, 214, 0.12)", // Orchid purple
        vx: 0,
        vy: 0,
        mass: 1000,
        scale: 0,
        currentRadius: isMobile ? 180 : 300,
        originalRadius: isMobile ? 180 : 300,
        targetRadius: isMobile ? 180 : 300,
        isPhysicsEnabled: false,
        isDestroyed: false,
      });

      entities.push({
        type: "nebula",
        x: cx,
        y: cy,
        radius: isMobile ? 220 : 350,
        color: "rgba(77, 238, 234, 0.12)", // Electric cyan
        vx: 0,
        vy: 0,
        mass: 1200,
        scale: 0,
        currentRadius: isMobile ? 220 : 350,
        originalRadius: isMobile ? 220 : 350,
        targetRadius: isMobile ? 220 : 350,
        isPhysicsEnabled: false,
        isDestroyed: false,
      });
    }

    console.log(`[DEBUG] generateInterstellarScene: Procedural fallback entities generated: ${entities.length}. Transitioning...`);
    transitionToNewEntities(entities);
    interstellarSceneGeneratedTimeRef.current = Date.now();

    registerAndSaveSequence(systemName, systemDesc, systemTags, entities);
  };

  const syncParticleColors = (particles: Particle[]) => {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (!p) continue;

      const col = p.color || "#ffffff";
      if (col.startsWith("#")) {
        p.r = parseInt(col.slice(1, 3), 16);
        p.g = parseInt(col.slice(3, 5), 16);
        p.b = parseInt(col.slice(5, 7), 16);
      } else if (col.startsWith("rgb")) {
        const matches = col.match(/\d+/g);
        if (matches) {
          p.r = parseInt(matches[0] || "255", 10);
          p.g = parseInt(matches[1] || "255", 10);
          p.b = parseInt(matches[2] || "255", 10);
        } else {
          p.r = 255;
          p.g = 255;
          p.b = 255;
        }
      } else {
        p.r = 255;
        p.g = 255;
        p.b = 255;
      }
    }
  };

  const mapParticlesToInterstellar = (width: number, height: number) => {
    const entities = celestialEntitiesRef.current.filter(e => !e.isDestroyed);
    if (entities.length === 0) return;
    const bh = entities.find((e) => e.type === "blackhole");
    const planets = entities.filter((e) => e.type === "planet");
    const nebulas = entities.filter((e) => e.type === "nebula");
    const arch = archetypeRef.current || "BLACKHOLE_CENTRIC";

    const nonAmbientParticles = particlesRef.current.filter(
      (p) => !p.isCosmicAmbient,
    );

    // Pre-generate 120 background galaxy centers distributed at deep depths
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
      "#4deeea", // Electric Cyan
      "#ff007f", // Neon Pink
      "#aa00ff", // Cosmic Purple
      "#ffd778", // Glowing Gold
      "#00e5ff", // Bright Blue
      "#ff5e62", // Soft Coral
      "#ffffff", // Core White
      "#da70d6"  // Orchid
    ];

    for (let g = 0; g < numBackgroundGalaxies; g++) {
      const angle = Math.random() * Math.PI * 2;
      const rRadius = 4000 + Math.random() * 7000;
      const rPhi = Math.acos((Math.random() * 2) - 1);
      const rTheta = Math.random() * Math.PI * 2;
      const gx = rRadius * Math.sin(rPhi) * Math.cos(rTheta);
      const gy = rRadius * Math.sin(rPhi) * Math.sin(rTheta);
      const gz = rRadius * Math.cos(rPhi); // Far off in the distance
      
      galaxyCenters.push({
        x: gx,
        y: gy,
        z: gz,
        pitch: Math.random() * Math.PI,
        yaw: Math.random() * Math.PI * 2,
        type: Math.random() > 0.4 ? "spiral" : "elliptical",
        color: galaxyColors[g % galaxyColors.length]
      });
    }

    nonAmbientParticles.forEach((p, idx) => {
      const rand = Math.random();

      // Map 5% of the active particles to the background galaxies
      if (idx % 100 < 5) {
        const gal = galaxyCenters[idx % numBackgroundGalaxies];
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
        if (rand < 0.72) {
          p.interstellarType = "blackhole";
          p.interstellarEntityIndex = entities.indexOf(bh);
          p.interstellarEntity = bh;
          const minR = bh.radius * 1.5;
          const maxR = bh.radius * 24.0;
          p.orbitRadius = minR + Math.random() * (maxR - minR);
          p.orbitAngle = Math.random() * Math.PI * 2;
          
          const r = p.orbitRadius || 50;
          const baseSpeed = 0.012 + Math.random() * 0.008;
          // Kepler's Third Law (orbital angular speed omega decreases as r^-1.5)
          p.orbitSpeed = baseSpeed * Math.pow((bh.radius * 2.5) / r, 1.5);

          const rx = p.orbitRadius;
          const ry = rx * 0.25;
          const theta = 0.05;
          const cosT = Math.cos(theta);
          const sinT = Math.sin(theta);
          const ox = Math.cos(p.orbitAngle) * rx;
          const oy = Math.sin(p.orbitAngle) * ry;
          p.targetX = bh.x + (ox * cosT - oy * sinT);
          p.targetY = bh.y + (ox * sinT + oy * cosT);
          p.targetZ = Math.sin(p.orbitAngle) * rx * 0.55;

          const colorRand = Math.random();
          if (p.orbitRadius < bh.radius * 2.5) {
            p.baseColor = colorRand > 0.5 ? "#ffffff" : "#ffd778";
          } else {
            p.baseColor = colorRand > 0.4 ? "#f25f35" : "#c14b2a";
          }
          p.color = p.baseColor;
          p.isPlanetRing = false;
        } else if (planets.length > 0 && rand < 0.88) {
          p.interstellarType = "planet";
          const planet = planets[idx % planets.length];
          p.interstellarEntityIndex = entities.indexOf(planet);
          p.interstellarEntity = planet;
          p.orbitRadius = planet.radius * (1.1 + Math.random() * 0.6);
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
          p.interstellarType = "star";
          const rRadius = Math.random() * (width * 6);
          const rTheta = Math.random() * Math.PI * 2;
          const rPhi = Math.acos((Math.random() * 2) - 1);
          p.targetX = width / 2 + rRadius * Math.sin(rPhi) * Math.cos(rTheta);
          p.targetY = height / 2 + rRadius * Math.sin(rPhi) * Math.sin(rTheta);
          p.targetZ = rRadius * Math.cos(rPhi);
          p.baseColor = Math.random() > 0.8 ? "#88ffff" : "#ffffff";
          p.color = p.baseColor;
          p.isPlanetRing = false;
        }
      } else if (arch === "BINARY_PLANETS" && planets.length >= 2) {
        if (rand < 0.8) {
          p.interstellarType = "planet";
          const planetIdx = idx % 2;
          const planet = planets[planetIdx];
          p.interstellarEntityIndex = entities.indexOf(planet || planets[0]);
          p.interstellarEntity = planet || planets[0];

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
        } else if (nebulas.length > 0 && rand < 0.92) {
          p.interstellarType = "nebula";
          const nebula = nebulas[idx % nebulas.length];
          p.interstellarEntityIndex = entities.indexOf(nebula || nebulas[0]);
          p.interstellarEntity = nebula || nebulas[0];

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
          p.interstellarType = "star";
          const rRadius = Math.random() * (width * 6);
          const rTheta = Math.random() * Math.PI * 2;
          const rPhi = Math.acos((Math.random() * 2) - 1);
          p.targetX = width / 2 + rRadius * Math.sin(rPhi) * Math.cos(rTheta);
          p.targetY = height / 2 + rRadius * Math.sin(rPhi) * Math.sin(rTheta);
          p.targetZ = rRadius * Math.cos(rPhi);
          p.baseColor = "#ffffff";
          p.color = p.baseColor;
          p.isPlanetRing = false;
        }
      } else if (arch === "NEBULA_CRADLE" && nebulas.length > 0) {
        if (rand < 0.75) {
          p.interstellarType = "nebula";
          const nebula = nebulas[idx % nebulas.length];
          p.interstellarEntityIndex = entities.indexOf(nebula || nebulas[0]);
          p.interstellarEntity = nebula || nebulas[0];

          const angle = Math.random() * Math.PI * 2;
          const rad = Math.pow(Math.random(), 1.2) * nebula.radius;
          p.orbitRadius = rad;
          p.orbitAngle = angle;
          p.orbitSpeed = 0.006 + Math.random() * 0.008;
          p.targetX = nebula.x + Math.cos(angle) * rad;
          p.targetY = nebula.y + Math.sin(angle) * rad;
          p.targetZ = (Math.random() - 0.5) * 60;

          const nebColors = [
            "#f25f35",
            "#4deeea",
            "#ffd778",
            "#da70d6",
            "#8a2be2",
            "#ff5e62",
          ];
          p.baseColor = nebColors[idx % nebColors.length];
          p.color = p.baseColor;
          p.isPlanetRing = false;
        } else if (planets.length > 0 && rand < 0.9) {
          p.interstellarType = "planet";
          const planet = planets[idx % planets.length];
          p.interstellarEntityIndex = entities.indexOf(planet || planets[0]);
          p.interstellarEntity = planet || planets[0];
          p.orbitRadius = planet.radius * (1.1 + Math.random() * 0.6);
          p.orbitAngle = Math.random() * Math.PI * 2;
          
          const r = p.orbitRadius || 30;
          const baseSpeed = 0.012 + Math.random() * 0.008;
          p.orbitSpeed = baseSpeed * Math.pow((planet.radius * 1.4) / r, 1.5);

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
          p.interstellarType = "star";
          const rRadius = Math.random() * (width * 6);
          const rTheta = Math.random() * Math.PI * 2;
          const rPhi = Math.acos((Math.random() * 2) - 1);
          p.targetX = width / 2 + rRadius * Math.sin(rPhi) * Math.cos(rTheta);
          p.targetY = height / 2 + rRadius * Math.sin(rPhi) * Math.sin(rTheta);
          p.targetZ = rRadius * Math.cos(rPhi);
          p.baseColor = "#ffffff";
          p.color = p.baseColor;
          p.isPlanetRing = false;
        }
      } else if (arch === "EXOPLANET_CLUSTER" && planets.length > 0) {
        if (planets.length >= 2 && rand < 0.4) {
          p.interstellarType = "bridge";
          const startIdx = idx % planets.length;
          let endIdx = (startIdx + 1) % planets.length;
          p.bridgeStartEntityIndex = entities.indexOf(
            planets[startIdx] || planets[0],
          );
          p.bridgeStartEntity = planets[startIdx] || planets[0];
          p.bridgeEndEntityIndex = entities.indexOf(
            planets[endIdx] || planets[1],
          );
          p.bridgeEndEntity = planets[endIdx] || planets[1];
          p.bridgeProgress = Math.random();
          p.bridgeSpeed = 0.012 + Math.random() * 0.012;

          const start = planets[startIdx] || planets[0];
          const end = planets[endIdx] || planets[1];

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
          p.targetZ = 0;

          const bridgeColors = ["#4deeea", "#ffd778", "#ff9f43", "#00ffd2"];
          p.baseColor = bridgeColors[idx % bridgeColors.length];
          p.color = p.baseColor;
          p.isPlanetRing = false;
        } else if (rand < 0.85 && planets.length > 0) {
          p.interstellarType = "planet";
          const planet = planets[idx % planets.length];
          p.interstellarEntityIndex = entities.indexOf(planet || planets[0]);
          p.interstellarEntity = planet || planets[0];

          const ringRand = Math.random();
          if (planet.hasRings && ringRand > 0.4) {
            const minR = planet.radius * 1.3;
            const maxR = planet.radius * 2.5;
            p.orbitRadius = minR + Math.random() * (maxR - minR);
            p.orbitAngle = Math.random() * Math.PI * 2;
            
            const r = p.orbitRadius || 30;
            const baseSpeed = 0.014 + Math.random() * 0.012;
            p.orbitSpeed = baseSpeed * Math.pow((planet.radius * 1.6) / r, 1.5);

            p.isPlanetRing = true;

            const rx = p.orbitRadius;
            const ry = rx * 0.22;
            const theta = 0.3;
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
            const baseSpeed = 0.012 + Math.random() * 0.008;
            p.orbitSpeed = baseSpeed * Math.pow((planet.radius * 1.3) / r, 1.5);
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
          }
          p.color = p.baseColor;
        } else {
          p.interstellarType = "star";
          const rRadius = Math.random() * (width * 6);
          const rTheta = Math.random() * Math.PI * 2;
          const rPhi = Math.acos((Math.random() * 2) - 1);
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
        if (rand < 0.88) {
          p.interstellarType = "nebula"; // Revolve beautifully like a nebula gas cloud
          
          const arm = idx % 2; // Two main spiral arms
          const baseAngle = arm * Math.PI; // Arms start on opposite sides
          
          // Density concentration towards the galactic center
          const maxRadius = Math.min(width, height) * 0.42;
          const minRadius = 15;
          const radFactor = Math.pow(Math.random(), 1.6);
          const r = minRadius + radFactor * (maxRadius - minRadius);
          
          // Logarithmic/spiral angle formula: angle = baseAngle + radius * tightness
          const tightness = 0.016; 
          const spiralAngle = baseAngle + r * tightness;
          
          // Dispersion/fuzziness to make spiral arms look natural and dusty
          const dispersion = (Math.random() - 0.5) * 0.45;
          const finalAngle = spiralAngle + dispersion;
          
          p.orbitRadius = r;
          p.orbitAngle = finalAngle;
          // Inner regions rotate faster (Keplerian velocity curve model)
          p.orbitSpeed = (0.009 + Math.random() * 0.006) * (180 / (r + 40));
          
          p.targetX = cx + Math.cos(finalAngle) * r;
          p.targetY = cy + Math.sin(finalAngle) * r;
          
          // Thick/dense core, flattening out at the edges
          p.targetZ = (Math.random() - 0.5) * (45 * (1.0 - radFactor));
          
          // Color grading: bright hot white/yellow in the core, transitioning to cosmic orchid purple/indigo and electric cyan arms
          const colorRand = Math.random();
          if (radFactor < 0.22) {
            p.baseColor = colorRand > 0.6 ? "#ffffff" : "#ffd778";
          } else {
            p.baseColor = arm === 0 ? "#da70d6" : "#4deeea"; // Orchid magenta vs electric cyan
          }
          p.color = p.baseColor;
          p.isPlanetRing = false;
        } else {
          // Background galactic stars
          p.interstellarType = "star";
          const rRadius = Math.random() * (width * 6);
          const rTheta = Math.random() * Math.PI * 2;
          const rPhi = Math.acos((Math.random() * 2) - 1);
          p.targetX = width / 2 + rRadius * Math.sin(rPhi) * Math.cos(rTheta);
          p.targetY = height / 2 + rRadius * Math.sin(rPhi) * Math.sin(rTheta);
          p.targetZ = rRadius * Math.cos(rPhi);
          p.baseColor = Math.random() > 0.82 ? "#88ffff" : "#ffffff";
          p.color = p.baseColor;
          p.isPlanetRing = false;
        }
      } else {
        p.interstellarType = "star";
          const rRadius = Math.random() * (width * 6);
          const rTheta = Math.random() * Math.PI * 2;
          const rPhi = Math.acos((Math.random() * 2) - 1);
          p.targetX = width / 2 + rRadius * Math.sin(rPhi) * Math.cos(rTheta);
          p.targetY = height / 2 + rRadius * Math.sin(rPhi) * Math.sin(rTheta);
          p.targetZ = rRadius * Math.cos(rPhi);
        p.baseColor = "#ffffff";
        p.color = p.baseColor;
        p.isPlanetRing = false;
      }
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
  };

  const mapParticlesToStage = (targetStage: number, triggerBurst: boolean) => {
    const ww = window.innerWidth;
    const wh = window.innerHeight;

    const coords = generateTargetsForStage(targetStage, ww, wh);
    if (!coords || coords.length === 0) return;

    stageTargetsRef.current[targetStage] = coords;

    if (particlesRef.current.length > 0) {
      const ambientCount = particlesRef.current.filter(
        (p) => p.isCosmicAmbient,
      ).length;
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

        const safeIndex = Math.min(
          Math.max(0, Math.floor(mappedIndex)),
          coords.length - 1,
        );
        const t = coords[safeIndex] || coords[0];
        targetIndex++;

        p.targetX = t.x;
        p.targetY = t.y;
        p.targetZ = 0;
        p.baseColor = t.color;
        p.color = t.color;
        p.interstellarType = undefined; // reset interstellar mode orbit locks

        if (triggerBurst) {
          // Instead of pure random noise, we create a coherent gravitational vortex stream.
          // Particles will swirl outwards or inwards in a spiral trajectory based on their distance from the center,
          // mimicking gravitational accretion streams.
          const cx = ww / 2;
          const cy = wh / 2;
          const dx = p.x - cx;
          const dy = p.y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          
          // Tangential swirling vector
          const swirlMagnitude = 32.0;
          const tx = -dy / dist * swirlMagnitude;
          const ty = dx / dist * swirlMagnitude;
          
          // Radial push/pull vector
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
  };

  const updateHudTexture = (targetStage: number) => {
    if (!hudPlaneRef.current || !hudTextureRef.current) return;
    const ww = window.innerWidth;
    const wh = window.innerHeight;
    const hudDpr = window.devicePixelRatio || 1;

    const texture = hudTextureRef.current;
    const context = texture.getContext() as CanvasRenderingContext2D | null;
    if (!context) return;
    context.clearRect(0, 0, ww * hudDpr, wh * hudDpr);
    // context.scale is already applied once, wait, if we clear we don't need to re-scale, but let's make sure
    context.save();
    context.resetTransform();
    context.clearRect(0, 0, ww * hudDpr, wh * hudDpr);
    context.scale(hudDpr, hudDpr);
    drawStageLayoutTemplate(context, targetStage, ww, wh, "full");
    context.restore();
    texture.update();
  };

  const triggerCalmCosmicShift = () => {
    if (supernovaRef.current) return;

    // Smoothly fade out all current entities by setting them as destroyed
    celestialEntitiesRef.current.forEach((entity) => {
      entity.isDestroyed = true;
    });

    supernovaRef.current = {
      time: Date.now(),
      exploded: false,
      isCalmShift: true,
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    
    fetchNextGeminiScene();
  };

  // Synchronize dynamic 3D celestial meshes in Babylon.js
  const updateCelestial3DMeshes = () => {
    try {
    const scene = sceneRef.current;
    const group = celestialGroupRef.current;
    if (!scene || !group) return;

    const ww = window.innerWidth;
    const wh = window.innerHeight;

    const entities = celestialEntitiesRef.current;

    // Smooth entity morphing / transition interpolation in the render loop!
    let meshTransitionT = 0;
    let isMeshTransitioning = false;
    if (entityTransitionActiveRef.current) {
      const duration = 2400; // 2.4 seconds duration matching camera
      const elapsed = Date.now() - entityTransitionStartTimeRef.current;
      if (elapsed >= duration) {
        entityTransitionActiveRef.current = false;
        console.log(`[DEBUG] updateCelestial3DMeshes: Entity transition duration reached. Transition is now complete. Processing current states...`);
        entities.forEach((cur) => {
          if (cur.targetX !== undefined) cur.x = cur.targetX;
          if (cur.targetY !== undefined) cur.y = cur.targetY;
          if (cur.targetZ !== undefined) cur.z = cur.targetZ;
          if (cur.targetRadius !== undefined) cur.radius = cur.targetRadius;
          if (cur.targetScale !== undefined) cur.scale = cur.targetScale;
        });
        const beforeFilter = entities.length;
        celestialEntitiesRef.current = entities.filter(e => (e.scale ?? 0) > 0.01);
        console.log(`[DEBUG] updateCelestial3DMeshes: Filtered out old entities. Before: ${beforeFilter}, After: ${celestialEntitiesRef.current.length} alive entities remaining.`);
      } else {
        isMeshTransitioning = true;
        const rawT = elapsed / duration;
        meshTransitionT = rawT < 0.5 ? 4 * rawT * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 3) / 2;
      }
    }

    if (isMeshTransitioning) {
      entities.forEach((cur) => {
        if (cur.startX !== undefined && cur.targetX !== undefined) {
          cur.x = (1 - meshTransitionT) * cur.startX + meshTransitionT * cur.targetX;
        }
        if (cur.startY !== undefined && cur.targetY !== undefined) {
          cur.y = (1 - meshTransitionT) * cur.startY + meshTransitionT * cur.targetY;
        }
        if (cur.startZ !== undefined && cur.targetZ !== undefined) {
          cur.z = (1 - meshTransitionT) * cur.startZ + meshTransitionT * cur.targetZ;
        }
        if (cur.startRadius !== undefined && cur.targetRadius !== undefined) {
          cur.radius = (1 - meshTransitionT) * cur.startRadius + meshTransitionT * cur.targetRadius;
        }
        if (cur.startScale !== undefined && cur.targetScale !== undefined) {
          cur.scale = (1 - meshTransitionT) * cur.startScale + meshTransitionT * cur.targetScale;
        }
      });
    }

    const sceneAge = (Date.now() - interstellarSceneGeneratedTimeRef.current) / 1000;
    const musicAmp = (audio as any).getMusicAmplitude();
    const musicBands = (audio as any).getFrequencyBands ? (audio as any).getFrequencyBands() : { bass: 0, mid: 0, treble: 0 };

    // Automatic Calming Cosmic Shift transition after 240 seconds for a slower, serene screensaver experience
    if (isInterstellarRef.current && sceneAge > 240.0 && !supernovaRef.current) {
      triggerCalmCosmicShift();
    }

    // --- AUTONOMOUS COSMIC EVOLUTION ENGINE ---

    // 1. Cosmic Spawn Protection: Prevent empty space by seeding young planets
    const aliveEntities = entities.filter(e => !e.isDestroyed);
    if (aliveEntities.length < 5 && Math.random() < 0.008) {
      const angle = Math.random() * Math.PI * 2;
      const r = (ww < 768 ? 160 : 320) + Math.random() * 220;
      const pRadius = 14 + Math.random() * 14;
      const orbitSpeed = 0.0025 + Math.random() * 0.0025;
      const newPlanet: CelestialEntity = {
        type: "planet",
        x: ww / 2 + Math.cos(angle) * r,
        y: wh / 2 + Math.sin(angle) * r,
        radius: pRadius,
        color: ["#4deeea", "#ffd778", "#ff5e62", "#a124f5", "#00ffbe"][Math.floor(Math.random() * 5)] || "#4deeea",
        secondaryColor: "#ffffff",
        hasRings: Math.random() > 0.4,
        ringColor: "rgba(255, 255, 255, 0.45)",
        orbitRadius: r,
        orbitAngle: angle,
        orbitSpeed: orbitSpeed,
        centerX: ww / 2,
        centerY: wh / 2,
        vx: -Math.sin(angle) * r * orbitSpeed * 1.3,
        vy: Math.cos(angle) * r * orbitSpeed * 1.3,
        mass: pRadius * pRadius,
        scale: 0.05,
        currentRadius: pRadius,
        originalRadius: pRadius,
        targetRadius: pRadius,
        isPhysicsEnabled: true,
        isDestroyed: false,
      };
      entities.push(newPlanet);
      createDustSplash(newPlanet.x, newPlanet.y, newPlanet.color, 120);
      audio.playStageSwell(1); // Play deep swelling tone

      registerAndSaveSequence(
        "Stellar Nucleus Birth",
        "Stardust accretion has crossed a critical mass point. A young planet is birthed into decaying orbit, pulled by the master gravitational field.",
        ["★ STAR NURSERY", "☄ CORE CONCRETION", "★ INWARD SPIRAL"],
        entities
      );
    }

    // 2. Continuous Gravity Drift: Apply gentle inward spiral drag
    entities.forEach((entity) => {
      if (entity.isDestroyed || entity.type === "blackhole") return;
      
      const bh = entities.find(e => e && !e.isDestroyed && e.type === "blackhole");
      if (!bh) return;

      const dx = bh.x - entity.x;
      const dy = bh.y - entity.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      if (entity.isSwallowing) {
        // Strong spiral pull
        const spiralPull = 0.15;
        entity.vx = (entity.vx || 0) + (dx / dist) * spiralPull;
        entity.vy = (entity.vy || 0) + (dy / dist) * spiralPull;
        // Keep scale constant until close to black hole
        if (dist < bh.radius * 1.5) {
            entity.isDestroyed = true;
        }
      } else {
        // Decay orbit slightly with subtle drag
        const dragPull = 0.0008;
        entity.vx = (entity.vx || 0) + (dx / dist) * dragPull;
        entity.vy = (entity.vy || 0) + (dy / dist) * dragPull;
      }
    });

    // 3. Autonomous Cosmic Event Loop (Triggers on rare, extremely calm 45s intervals)
    const now = Date.now();
    if (now - lastAutonomousEventTimeRef.current > 45000) {
      lastAutonomousEventTimeRef.current = now;
      const nonBhEntities = entities.filter(e => !e.isDestroyed && e.type !== "blackhole");
      const eventChoice = Math.floor(Math.random() * 4);

      if (eventChoice === 0 && nonBhEntities.length >= 2) {
        // Event A: EINSTEIN-ROSEN QUANTUM WORMHOLE
        const e1 = nonBhEntities[Math.floor(Math.random() * nonBhEntities.length)]!;
        const e2 = nonBhEntities[Math.floor(Math.random() * nonBhEntities.length)]!;
        if (e1 !== e2) {
          const idx1 = entities.indexOf(e1);
          const idx2 = entities.indexOf(e2);
          activeWormholeRef.current = {
            startEntityIdx: idx1,
            endEntityIdx: idx2,
            life: 1.0,
            duration: 8000,
          };

          // Funnel background particles through the wormhole bridge
          const particles = particlesRef.current;
          let bridgeCount = 0;
          particles.forEach((p) => {
            if (!p.isTail && !p.isCosmicAmbient && bridgeCount < 200) {
              p.interstellarType = "bridge";
              p.bridgeStartEntityIndex = idx1;
              p.bridgeStartEntity = entities[idx1];
              p.bridgeEndEntityIndex = idx2;
              p.bridgeEndEntity = entities[idx2];
              p.bridgeProgress = Math.random();
              p.bridgeSpeed = 0.007 + Math.random() * 0.015;
              bridgeCount++;
            }
          });

          audio.playStageSwell(1); // deep zimmer-like chord shift

          registerAndSaveSequence(
            "Wormhole Bridge Activated",
            "A localized quantum bridge has bent spacetime between two orbits. Hot stellar plasma particles funnel instantly through the dimensional throat.",
            ["🕳 ER BRIDGE", "☄ SPATIAL WARP", "★ BENT METRIC"],
            entities
          );
        }
      } else if (eventChoice === 1 && nonBhEntities.length >= 1) {
        // Event B: LOCALIZED COMPACT COLLAPSE (Stellar core collapse, remains inside the same scene)
        const star = nonBhEntities[Math.floor(Math.random() * nonBhEntities.length)]!;
        star.isDestroyed = true;
        
        const isNeutronStar = Math.random() > 0.5;
        const remnant: CelestialEntity = {
          type: isNeutronStar ? "star" : "blackhole",
          x: star.x,
          y: star.y,
          radius: isNeutronStar ? 6 : 10,
          color: isNeutronStar ? "#4deeea" : "#110b14",
          secondaryColor: isNeutronStar ? "#ffffff" : "#000000",
          vx: (star.vx || 0) * 0.5,
          vy: (star.vy || 0) * 0.5,
          mass: isNeutronStar ? star.mass * 0.6 : star.mass * 1.5,
          scale: 0.05,
          currentRadius: isNeutronStar ? 6 : 10,
          originalRadius: isNeutronStar ? 6 : 10,
          targetRadius: isNeutronStar ? 6 : 10,
          isPhysicsEnabled: true,
          isDestroyed: false,
        };

        entities.push(remnant);

        createDustSplash(star.x, star.y, star.color, 180);
        createDustSplash(star.x, star.y, "#ffffff", 120);
        audio.playSupernova(); // Deep vibrational sub-bass explosion!

        registerAndSaveSequence(
          isNeutronStar ? "Neutron Star Synthesis" : "Micro Singularity Formation",
          isNeutronStar 
            ? "A massive star has collapsed under gravity, fusing its protons and electrons into a super-dense, spinning neutron core."
            : "A dying star core collapsed past its Schwarzschild radius, punching a miniature hole in the fabric of space.",
          [isNeutronStar ? "★ COMPACT STAR" : "🕳 SINGULARITY", "☄ CORE COLLAPSE", "★ LOCAL NEBULA"],
          entities
        );
      } else if (eventChoice === 2) {
        // Event C: EXOPLANETARY SEED NURSERY (Spawns twin planets that will peacefully merge later)
        const angle = Math.random() * Math.PI * 2;
        const r1 = (ww < 768 ? 120 : 220);
        const child1: CelestialEntity = {
          type: "planet",
          x: ww / 2 + Math.cos(angle) * r1,
          y: wh / 2 + Math.sin(angle) * r1,
          radius: 17,
          color: "#4deeea",
          vx: -Math.cos(angle) * 0.6, // majestic, cinematic, ultra-slow speed
          vy: -Math.sin(angle) * 0.6,
          mass: 289,
          scale: 0.05,
          currentRadius: 17,
          originalRadius: 17,
          targetRadius: 17,
          isPhysicsEnabled: true,
          isDestroyed: false,
        };
        const child2: CelestialEntity = {
          type: "planet",
          x: ww / 2 - Math.cos(angle) * r1,
          y: wh / 2 - Math.sin(angle) * r1,
          radius: 15,
          color: "#ff5e62",
          vx: Math.cos(angle) * 0.6, // majestic, cinematic, ultra-slow speed
          vy: Math.sin(angle) * 0.6,
          mass: 225,
          scale: 0.05,
          currentRadius: 15,
          originalRadius: 15,
          targetRadius: 15,
          isPhysicsEnabled: true,
          isDestroyed: false,
        };
        entities.push(child1, child2);
        createDustSplash(child1.x, child1.y, child1.color, 90);
        createDustSplash(child2.x, child2.y, child2.color, 90);
        audio.playStageSwell(2);

        registerAndSaveSequence(
          "Gravitational Coalescence",
          "Twin protoplanetary bodies are pulled onto a head-on collision course. High electromagnetic resistance compresses spacetime before contact.",
          ["☄ TWIN CORES", "☄ VECTOR COLLISION", "★ REPULSION"],
          entities
        );
      } else if (eventChoice === 3) {
        // Event D: STELLIFEROUS NURSERY CONDENSATION
        const angle = Math.random() * Math.PI * 2;
        const r1 = (ww < 768 ? 160 : 280) + Math.random() * 100;
        const newNebula: CelestialEntity = {
          type: "nebula",
          x: ww / 2 + Math.cos(angle) * r1,
          y: wh / 2 + Math.sin(angle) * r1,
          radius: 60 + Math.random() * 40,
          color: ["#ff007f", "#a124f5", "#00f0ff"][Math.floor(Math.random() * 3)] || "#ff007f",
          secondaryColor: "#1a0033",
          vx: -Math.sin(angle) * 0.4, // ultra slow drift
          vy: Math.cos(angle) * 0.4,
          mass: 400,
          scale: 0.05,
          currentRadius: 80,
          originalRadius: 80,
          targetRadius: 80,
          isPhysicsEnabled: true,
          isDestroyed: false,
        };
        entities.push(newNebula);
        createDustSplash(newNebula.x, newNebula.y, newNebula.color, 150);
        audio.playStageSwell(2);

        registerAndSaveSequence(
          "Stelliferous Condensation",
          "An interstellar gas cloud is cooling and condensing, creating a vibrant nebula of ionized cosmic plasma.",
          ["★ IONIZED GAS", "☄ NEBULA DRIVEN", "★ STAR NURSERY"],
          entities
        );
      }
    }

    // 4. Update wormhole lifetime decay
    if (activeWormholeRef.current) {
      activeWormholeRef.current.duration -= 16;
      if (activeWormholeRef.current.duration <= 0) {
        activeWormholeRef.current = null;
      }
    }
    const swallowEntity = (bh: CelestialEntity, victim: CelestialEntity) => {
      victim.isSwallowing = true;
      victim.destroyedBy = "blackhole";
      const newMass = (bh.mass || 100) + (victim.mass || 50);
      bh.mass = newMass;
      
      // Blackhole target radius swells from ingested mass!
      const targetRadius = Math.min(bh.radius * 1.5, Math.sqrt(newMass / 15));
      bh.targetRadius = targetRadius;
      
      // Grow the blackhole and let the simulation run.
      // Cosmic spawn protection will seed new young planets automatically for infinite variety.
      // We only transition if the blackhole undergoes extreme mass swelling (4x initial mass).
      const initialBhMass = bh.initialMass || (bh.radius * bh.radius * 15);
      if (newMass > initialBhMass * 4.0 && !supernovaRef.current) {
        supernovaRef.current = {
            time: Date.now(),
            exploded: false,
            x: bh.x,
            y: bh.y,
            isCalmShift: true
        };
        audio.playStageSwell(2);
        fetchNextGeminiScene();
      }
      
      createSpaghettificationDebris(bh, victim);
      createShatterDebris(victim.x, victim.y, victim.color || "#ffffff", 100);
      audio.playRippleShockwave(); // trigger cosmic merger impact audio!
    };

    const mergeEntities = (survivor: CelestialEntity, victim: CelestialEntity) => {
      victim.isDestroyed = true;
      victim.destroyedBy = "collision";

      const m1 = survivor.mass || 10;
      const m2 = victim.mass || 10;
      const newMass = m1 + m2;
      survivor.mass = newMass;
      
      // Grow survivor's radius based on new mass
      const targetRadius = Math.min(survivor.radius * 1.5, Math.sqrt(newMass));
      survivor.targetRadius = targetRadius;

      // Physically accurate center-of-mass positioning & momentum conservation
      const midX = (survivor.x * m1 + victim.x * m2) / newMass;
      const midY = (survivor.y * m1 + victim.y * m2) / newMass;
      const midZ = (((survivor.z || 0) * m1) + ((victim.z || 0) * m2)) / newMass;

      survivor.x = midX;
      survivor.y = midY;
      survivor.z = midZ;

      if (survivor.isPhysicsEnabled || victim.isPhysicsEnabled) {
        survivor.vx = ((survivor.vx || 0) * m1 + (victim.vx || 0) * m2) / newMass;
        survivor.vy = ((survivor.vy || 0) * m1 + (victim.vy || 0) * m2) / newMass;
        survivor.vz = ((survivor.vz || 0) * m1 + (victim.vz || 0) * m2) / newMass;
        survivor.isPhysicsEnabled = true;
      }

      // Play collision sound
      audio.playRippleShockwave();
      
      // Inject high-intensity space-time ripple
      ripplesRef.current.push({
        x: midX,
        y: midY,
        life: 1.0,
      });

      // Spawn shatter and dust debris
      createShatterDebris(midX, midY, victim.color || "#ffffff", 80);
      createDustSplash(midX, midY, survivor.color || "#ffffff", 40);

      registerAndSaveSequence(
        "Planetary Coalescence",
        "Two cosmic bodies collide, merging into a larger planet and seeding a fresh stardust ring in their orbital plane.",
        ["🪐 COALESCENCE", "☄ KINETIC MERGER", "★ MASS ACCRETION"],
        entities
      );
    };

    // --- Interactive Mouse Gravitational Warp & Supernova Trigger ---
    const activeSupernova = supernovaRef.current;
    if (activeSupernova) {
      entities.forEach((entity) => {
        if (entity.isDestroyed) return;
        entity.isPhysicsEnabled = true;
        
        // Push/pull force on trigger click
        const dx = entity.x - activeSupernova.x;
        const dy = entity.y - activeSupernova.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < 500) {
          const force = 2.2 * (1.0 - dist / 500);
          entity.vx = (entity.vx || 0) + (dx / dist) * force;
          entity.vy = (entity.vy || 0) + (dy / dist) * force;
        }
      });
    }

    // Proximity mouse physical poke impulse
    const mouseX = mouseRef.current.x;
    const mouseY = mouseRef.current.y;
    if (mouseX > 0 && mouseY > 0) {
      entities.forEach((entity) => {
        if (entity.isDestroyed || entity.type === "blackhole") return;
        const dx = entity.x - mouseX;
        const dy = entity.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 180 && dist > 1) {
          entity.isPhysicsEnabled = true;
          const force = 0.75 * (1.0 - dist / 180);
          entity.vx = (entity.vx || 0) + (dx / dist) * force;
          entity.vy = (entity.vy || 0) + (dy / dist) * force;
        }
      });
    }

    // Natural system age orbital instability decay
    if (sceneAge > 45.0) {
      entities.forEach((entity) => {
        entity.isPhysicsEnabled = true;
      });
    }

    // --- Gravitational Orbital Physics Engine ---
    if (entities.length > 0) {
      const G = 0.12; // Gravitational constant
      
      // Calculate mutual attraction forces
      for (let i = 0; i < entities.length; i++) {
        const e1 = entities[i];
        if (!e1 || e1.isDestroyed) continue;
        
        for (let j = i + 1; j < entities.length; j++) {
          const e2 = entities[j];
          if (!e2 || e2.isDestroyed) continue;
          
          const dx = e2.x - e1.x;
          const dy = e2.y - e1.y;
          const dz = (e2.z || 0) - (e1.z || 0);
          const distSq = dx * dx + dy * dy + dz * dz;
          const dist = Math.sqrt(distSq);
          
          if (dist < 10) continue; // prevent singularities
          
          const forceE1 = (G * (e2.mass || 10)) / (distSq + 250);
          const forceE2 = (G * (e1.mass || 10)) / (distSq + 250);

          if (e1.type === "blackhole") {
            const tx = -dy / dist;
            const ty = dx / dist;
            const orbitInfluence = forceE2 * 1.8;
            e2.vx = (e2.vx || 0) - (dx / dist) * forceE2 * 0.45 + tx * orbitInfluence;
            e2.vy = (e2.vy || 0) - (dy / dist) * forceE2 * 0.45 + ty * orbitInfluence;
            e2.vz = (e2.vz || 0) - (dz / dist) * forceE2;
          } else if (e2.type === "blackhole") {
            const tx = -dy / dist;
            const ty = dx / dist;
            const orbitInfluence = forceE1 * 1.8;
            e1.vx = (e1.vx || 0) + (dx / dist) * forceE1 * 0.45 + tx * orbitInfluence;
            e1.vy = (e1.vy || 0) + (dy / dist) * forceE1 * 0.45 + ty * orbitInfluence;
            e1.vz = (e1.vz || 0) + (dz / dist) * forceE1;
          } else {
            if (e1.type !== "blackhole") {
              e1.vx = (e1.vx || 0) + (dx / dist) * forceE1;
              e1.vy = (e1.vy || 0) + (dy / dist) * forceE1;
              e1.vz = (e1.vz || 0) + (dz / dist) * forceE1;
            }
            if (e2.type !== "blackhole") {
              e2.vx = (e2.vx || 0) - (dx / dist) * forceE2;
              e2.vy = (e2.vy || 0) - (dy / dist) * forceE2;
              e2.vz = (e2.vz || 0) - (dz / dist) * forceE2;
            }
          }
        }
      }

      // Smooth coordinate velocity interpolation & Viewport Boundary Bouncing
      entities.forEach((entity) => {
        if (entity.isDestroyed) return;

        // Ensure Z variables are initialized
        entity.z = entity.z ?? 0;
        entity.vz = entity.vz ?? 0;
        if (entity.orbitInclination === undefined) {
          entity.orbitInclination = entity.type === "blackhole" ? 0 : (Math.random() - 0.5) * 0.38;
        }

        if (entity.isPhysicsEnabled) {
          // Space dust drag
          const drag = 0.992;
          entity.vx = (entity.vx || 0) * drag;
          entity.vy = (entity.vy || 0) * drag;
          entity.vz = (entity.vz || 0) * drag;

          entity.x += entity.vx;
          entity.y += entity.vy;
          entity.z += entity.vz;

          // Viewport boundary elastic bounces
          const padding = entity.radius;
          if (entity.x < padding) {
            entity.x = padding;
            entity.vx = Math.abs(entity.vx || 0) * 0.8;
          } else if (entity.x > ww - padding) {
            entity.x = ww - padding;
            entity.vx = -Math.abs(entity.vx || 0) * 0.8;
          }

          if (entity.y < padding) {
            entity.y = padding;
            entity.vy = Math.abs(entity.vy || 0) * 0.8;
          } else if (entity.y > wh - padding) {
            entity.y = wh - padding;
            entity.vy = -Math.abs(entity.vy || 0) * 0.8;
          }

          if (entity.z < -250) {
            entity.z = -250;
            entity.vz = Math.abs(entity.vz || 0) * 0.8;
          } else if (entity.z > 250) {
            entity.z = 250;
            entity.vz = -Math.abs(entity.vz || 0) * 0.8;
          }
        } else {
          // Smooth stable orbits on initial state
          if (
            entity.orbitRadius !== undefined &&
            entity.orbitAngle !== undefined &&
            entity.orbitSpeed !== undefined &&
            entity.centerX !== undefined &&
            entity.centerY !== undefined
          ) {
            entity.orbitAngle += entity.orbitSpeed * 0.45;
            
            // Compute 3D Keplerian inclined position
            const rawX = Math.cos(entity.orbitAngle) * entity.orbitRadius;
            const rawY = Math.sin(entity.orbitAngle) * entity.orbitRadius;
            
            const cosInc = Math.cos(entity.orbitInclination || 0);
            const sinInc = Math.sin(entity.orbitInclination || 0);
            
            const orbitX = entity.centerX + rawX;
            const orbitY = entity.centerY + rawY * cosInc;
            const orbitZ = rawY * sinInc;
            
            // Big Bang smooth float outward on birth transition
            entity.x += (orbitX - entity.x) * 0.05;
            entity.y += (orbitY - entity.y) * 0.05;
            entity.z += (orbitZ - entity.z) * 0.05;
          }
        }

        // --- Continuous Comet-Like Motion Trail Generation for Moving Objects ---
        const vx = entity.vx || 0;
        const vy = entity.vy || 0;
        const vz = entity.vz || 0;
        const speedSq = vx * vx + vy * vy + vz * vz;

        if (speedSq > 0.008 || entity.isPhysicsEnabled) {
          const speed = Math.sqrt(speedSq) || 0.1;
          const backX = -vx / speed;
          const backY = -vy / speed;
          const backZ = -vz / speed;

          const emitCount = entity.isPhysicsEnabled ? 3 : 1;
          const particles = particlesRef.current;
          if (particles && particles.length > 0) {
            let tailIdx = tailStartIndexRef.current >= 0 ? tailStartIndexRef.current : 0;
            for (let c = 0; c < emitCount; c++) {
              const p = particles[tailIdx];
              if (p && p.isTail && (!p.life || p.life <= 0 || Math.random() < 0.25)) {
                const spawnDist = entity.radius * (0.6 + Math.random() * 0.5);
                const spreadR = entity.radius * 0.4 * (Math.random() - 0.5);

                p.x = entity.x + backX * spawnDist + backY * spreadR;
                p.y = entity.y + backY * spawnDist - backX * spreadR;
                p.z = (entity.z || 0) + backZ * spawnDist + (Math.random() - 0.5) * spreadR;

                const turbulence = 0.3;
                p.vx = backX * (speed * 0.3) + (Math.random() - 0.5) * turbulence;
                p.vy = backY * (speed * 0.3) + (Math.random() - 0.5) * turbulence;
                p.vz = backZ * (speed * 0.3) + (Math.random() - 0.5) * turbulence;

                p.color = entity.color || "#ffffff";
                p.baseColor = entity.secondaryColor || entity.color || "#ffffff";
                p.life = 1.0;
                p.decay = 0.01 + Math.random() * 0.014; // slow decay so comet tails linger
                p.size = Math.max(0.18, (entity.radius / 14) * (0.25 + Math.random() * 0.35));
              }
              tailIdx = (tailIdx + 1) % particles.length;
            }
          }
        }
      });

      // Handle collisions & swallowing
      for (let i = 0; i < entities.length; i++) {
        const e1 = entities[i];
        if (!e1 || e1.isDestroyed) continue;

        for (let j = i + 1; j < entities.length; j++) {
          const e2 = entities[j];
          if (!e2 || e2.isDestroyed) continue;

          // Skip collisions for entities currently scaling up / spawning
          if ((e1.scale ?? 0) < 0.9 || (e2.scale ?? 0) < 0.9) continue;

          const dx = e2.x - e1.x;
          const dy = e2.y - e1.y;
          const dz = (e2.z || 0) - (e1.z || 0);
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const colDist = e1.radius + e2.radius;

          if (dist < colDist) {
            if (e1.type === "blackhole") {
              swallowEntity(e1, e2);
            } else if (e2.type === "blackhole") {
              swallowEntity(e2, e1);
            } else {
              // Calculate relative velocity
              const rvx = (e2.vx || 0) - (e1.vx || 0);
              const rvy = (e2.vy || 0) - (e1.vy || 0);
              const rvz = (e2.vz || 0) - (e1.vz || 0);
              const relVel = Math.sqrt(rvx * rvx + rvy * rvy + rvz * rvz);

              // Merging occurs at extremely high velocities or massive radius disparity
              const radiusRatio = Math.max(e1.radius, e2.radius) / Math.min(e1.radius, e2.radius);
              if (relVel > 15.0 || radiusRatio > 3.0) {
                if (e1.radius >= e2.radius) {
                  mergeEntities(e1, e2);
                } else {
                  mergeEntities(e2, e1);
                }
              } else {
                // Elastic physical 3D bounce with momentum conservation
                const colResult = resolveCelestialCollision(e1, e2, 0.78);
                if (colResult) {
                  audio.playRippleShockwave();

                  const dissipatedEnergy = Math.max(10, colResult.kineticEnergyDissipated);
                  const count = Math.min(100, Math.max(15, Math.floor(dissipatedEnergy * 0.12)));

                  // Screen Shake Impulse disabled for collisions per user directive
                  cameraShakeRef.current = 0;

                  // Localized Light Flare Overlay Mesh
                  if (sceneRef.current) {
                    const flareRadius = (e1.radius + e2.radius) * 1.6;
                    const flareMesh = BABYLON.MeshBuilder.CreateDisc("collision_flare", {
                      radius: flareRadius,
                      tessellation: 32,
                      sideOrientation: BABYLON.Mesh.DOUBLESIDE
                    }, sceneRef.current);

                    const fx = colResult.contactPointX - ww / 2;
                    const fy = -(colResult.contactPointY - wh / 2);
                    const fz = colResult.contactPointZ || 0;
                    flareMesh.position.set(fx, fy, fz + 5);

                    if (cameraRef.current) {
                      flareMesh.rotation.copyFrom(cameraRef.current.rotation);
                    }

                    const flareMat = new BABYLON.StandardMaterial("flareMat", sceneRef.current);
                    flareMat.emissiveColor = parseColorToBabylonColor3(e1.color || "#ffffff");
                    flareMat.disableLighting = true;
                    flareMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
                    flareMat.backFaceCulling = false;
                    flareMesh.material = flareMat;

                    collisionFlaresRef.current.push({
                      mesh: flareMesh,
                      life: 1.0,
                      maxLife: 1.0,
                      initialRadius: flareRadius
                    });
                  }

                  // Spawn comet-like lingering tail spray at impact
                  if (particlesRef.current && particlesRef.current.length > 0) {
                    const particles = particlesRef.current;
                    const flareCount = Math.min(90, Math.max(35, Math.floor(count * 1.3)));
                    let tailIdx = tailStartIndexRef.current >= 0 ? tailStartIndexRef.current : 0;
                    
                    for (let k = 0; k < flareCount; k++) {
                      const p = particles[tailIdx];
                      if (p && p.isTail) {
                        const angle = Math.random() * Math.PI * 2;
                        const speed = 2.5 + Math.random() * 8.5;
                        const spreadZ = (Math.random() - 0.5) * 6.0;

                        p.x = colResult.contactPointX;
                        p.y = colResult.contactPointY;
                        p.z = (colResult.contactPointZ || 0);
                        p.vx = Math.cos(angle) * speed;
                        p.vy = Math.sin(angle) * speed;
                        p.vz = spreadZ;
                        p.color = k % 2 === 0 ? (e1.color || "#ffffff") : (e2.color || "#ffffff");
                        p.baseColor = p.color;
                        p.life = 1.0;
                        p.decay = 0.007 + Math.random() * 0.013; // long lingering plasma comet tail
                        p.size = 0.2 + Math.random() * 0.38;
                      }
                      tailIdx = (tailIdx + 1) % particles.length;
                    }
                  }

                  createShatterDebris(
                    colResult.contactPointX,
                    colResult.contactPointY,
                    e1.color || "#ffffff",
                    Math.floor(count * 0.5)
                  );
                  createDustSplash(
                    colResult.contactPointX,
                    colResult.contactPointY,
                    e2.color || "#ffffff",
                    Math.floor(count * 0.5)
                  );

                  ripplesRef.current.push({
                    x: colResult.contactPointX,
                    y: colResult.contactPointY,
                    life: 0.85,
                  });
                }
              }
            }
          }
        }
      }
    }

    // Ensure all active entities have stable unique IDs
    entities.forEach((entity, idx) => {
      if (!entity.id) {
        entity.id = `${entity.type}-${idx}-${Math.random().toString(36).substring(2, 9)}`;
      }
    });
    const activeEntityIds = new Set(entities.map(e => e.id));

    // Safely dispose of removed meshes or fully faded-out destroyed/swallowed entities
    const nextMeshInstances: typeof celestialMeshInstancesRef.current = [];
    celestialMeshInstancesRef.current.forEach((inst) => {
      const entity = inst.entityRef;
      const isStillPresent = activeEntityIds.has(entity.id);
      const shouldDispose = !isStillPresent || (entity.isDestroyed && (entity.scale ?? 0) <= 0.02);

      if (shouldDispose) {
        inst.mesh.getChildMeshes(false).forEach((m) => {
          if (m.material) {
            const mats = (m.material as any).subMaterials || [m.material];
            mats.forEach((mat: any) => {
              if (mat) {
                const textures = mat.getActiveTextures ? mat.getActiveTextures() : [];
                textures.forEach((tex: any) => {
                  if (tex && typeof tex.dispose === "function") {
                    tex.dispose();
                  }
                });
                if (typeof mat.dispose === "function") {
                  mat.dispose();
                }
              }
            });
          }
          m.dispose();
        });
        inst.mesh.dispose();
      } else {
        nextMeshInstances.push(inst);
      }
    });
    celestialMeshInstancesRef.current = nextMeshInstances;

    // Create meshes incrementally for new entities that do not have a mesh yet
    entities.forEach((entity, idx) => {
      const hasMesh = celestialMeshInstancesRef.current.some(inst => inst.entityRef.id === entity.id);
      if (hasMesh) return;
      if (entity.isDestroyed) return;

      const entityId = entity.id!;
      const wx = entity.x - ww / 2;
      const wy = -(entity.y - wh / 2);

      entity.scale = entity.scale ?? 0;
      entity.currentRadius = entity.currentRadius ?? entity.radius;
      entity.originalRadius = entity.originalRadius ?? entity.radius;
      const initScale = entity.scale * (entity.currentRadius / entity.originalRadius);

        if (entity.type === "blackhole") {
          const bhContainer = new BABYLON.TransformNode("bh_group", scene);
          bhContainer.position.set(wx, wy, 0);

          // 1. Central Event Horizon Shadow - Pure Pitch Black Sphere (Blocks all light behind it)
          const ehMat = new BABYLON.StandardMaterial("ehMat", scene);
          ehMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
          ehMat.emissiveColor = new BABYLON.Color3(0, 0, 0);
          ehMat.specularColor = new BABYLON.Color3(0, 0, 0);
          ehMat.disableLighting = true;
          ehMat.backFaceCulling = false;

          const ehMesh = BABYLON.MeshBuilder.CreateSphere("event_horizon_core", {
            diameter: entity.radius * 2.1,
            segments: 32
          }, scene);
          ehMesh.material = ehMat;
          ehMesh.parent = bhContainer;

          // 2. Swirling Equatorial Accretion Disk with soft inner and outer falloff
          const accretionTex = generateAccretionDiskTexture(entity.color, entity.secondaryColor || entity.color, scene);
          const diskMat = new BABYLON.StandardMaterial("diskMat1", scene);
          diskMat.diffuseTexture = accretionTex;
          diskMat.emissiveTexture = accretionTex;
          diskMat.opacityTexture = accretionTex;
          diskMat.disableLighting = true;
          diskMat.backFaceCulling = false;
          diskMat.alphaMode = BABYLON.Engine.ALPHA_ADD;

          // Main horizontal accretion disk
          const diskMesh1 = BABYLON.MeshBuilder.CreateDisc("accretion_layer_1", {
            radius: entity.radius * 3.8,
            tessellation: 64
          }, scene);
          diskMesh1.material = diskMat;
          diskMesh1.rotation.x = Math.PI / 2.35;
          diskMesh1.parent = bhContainer;

          // Gravitational Lensing Warped Accretion Ring (Light bent around top and bottom of event horizon)
          const diskMeshWarped = BABYLON.MeshBuilder.CreateDisc("accretion_layer_warped", {
            radius: entity.radius * 3.1,
            tessellation: 64
          }, scene);
          diskMeshWarped.material = diskMat;
          diskMeshWarped.rotation.x = Math.PI / 10; // Arced vertically to show relativistic lensing distortion
          diskMeshWarped.parent = bhContainer;

          // 3. Crisp Photon Ring Corona Halo (With transparent center void so center stays pitch black)
          const photonRingTex = generatePhotonRingTexture(entity.color, entity.secondaryColor || entity.color, scene);
          const photonRingMat = new BABYLON.StandardMaterial("photonRingMat", scene);
          photonRingMat.diffuseTexture = photonRingTex;
          photonRingMat.emissiveTexture = photonRingTex;
          photonRingMat.opacityTexture = photonRingTex;
          photonRingMat.disableLighting = true;
          photonRingMat.backFaceCulling = false;
          photonRingMat.alphaMode = BABYLON.Engine.ALPHA_ADD;

          const photonRingMesh = BABYLON.MeshBuilder.CreatePlane("event_horizon_photon_ring", {
            size: entity.radius * 4.4
          }, scene);
          photonRingMesh.material = photonRingMat;
          photonRingMesh.billboardMode = BABYLON.TransformNode.BILLBOARDMODE_ALL;
          photonRingMesh.parent = bhContainer;

          bhContainer.scaling.set(initScale, initScale, initScale);
          if (celestialGroupRef.current) {
            bhContainer.parent = celestialGroupRef.current;
          }
          celestialMeshInstancesRef.current.push({
            id: entityId,
            mesh: bhContainer,
            entityRef: entity,
          });
        } else if (entity.type === "planet") {
          const planetContainer = new BABYLON.TransformNode("planet_group", scene);
          planetContainer.position.set(wx, wy, 0);

          const rgb = parseColorToRgb(entity.color);

          // 1. Core Planet Sphere with procedural surface texture
          const planetTex = generateAdvancedPlanetTexture(entity.color, entity.secondaryColor || entity.color, scene);
          const sphereMat = new BABYLON.StandardMaterial("sphereMat", scene);
          sphereMat.diffuseTexture = planetTex;
          sphereMat.emissiveTexture = planetTex;
          sphereMat.emissiveColor = new BABYLON.Color3(0.3, 0.3, 0.3);

          const sphereMesh = BABYLON.MeshBuilder.CreateSphere("planet_sphere", {
            diameter: entity.radius * 2,
            segments: 64
          }, scene);
          sphereMesh.material = sphereMat;
          sphereMesh.parent = planetContainer;

          // 2. Procedural Soft Cloud Layer
          const cloudTex = generateProceduralCloudTexture(entity.color, scene);
          const cloudMat = new BABYLON.StandardMaterial("cloudMat", scene);
          cloudMat.diffuseTexture = cloudTex;
          cloudMat.emissiveTexture = cloudTex;
          cloudMat.opacityTexture = cloudTex;
          cloudMat.alphaMode = BABYLON.Engine.ALPHA_COMBINE;
          cloudMat.disableLighting = true;
          cloudMat.backFaceCulling = false;

          const cloudMesh = BABYLON.MeshBuilder.CreateSphere("planet_clouds_inner", {
            diameter: entity.radius * 2.06,
            segments: 32
          }, scene);
          cloudMesh.material = cloudMat;
          cloudMesh.parent = planetContainer;

          // 3. Translucent Striated Rings for ringed planets
          if (entity.hasRings) {
            const ringTex = generateConcentricRingTexture(entity.ringColor || entity.color, scene);
            const ringMat = new BABYLON.StandardMaterial("ringMat", scene);
            ringMat.diffuseTexture = ringTex;
            ringMat.emissiveTexture = ringTex;
            ringMat.opacityTexture = ringTex;
            ringMat.disableLighting = true;
            ringMat.backFaceCulling = false;
            ringMat.alphaMode = BABYLON.Engine.ALPHA_COMBINE;

            const ringMesh = BABYLON.MeshBuilder.CreateDisc("ring_mesh", {
              radius: entity.radius * 2.2,
              tessellation: 64
            }, scene);
            ringMesh.material = ringMat;
            ringMesh.rotation.x = Math.PI / 2.3;
            ringMesh.parent = planetContainer;
          }

          // 4. Atmosphere Glow Sphere using soft Fresnel rim lighting
          const atmosphereGlowMesh = BABYLON.MeshBuilder.CreateSphere("atmosphere_glow", {
            diameter: entity.radius * 2.18,
            segments: 32
          }, scene);

          const atmosColor = new BABYLON.Color3(rgb.r / 255, rgb.g / 255, rgb.b / 255);
          const atmosphereGlowMat = new BABYLON.StandardMaterial("atmosphereGlowMat", scene);
          atmosphereGlowMat.emissiveColor = atmosColor;
          atmosphereGlowMat.disableLighting = true;
          atmosphereGlowMat.backFaceCulling = true;
          atmosphereGlowMat.alphaMode = BABYLON.Engine.ALPHA_ADD;

          const atmosFresnel = new BABYLON.FresnelParameters();
          atmosFresnel.isEnabled = true;
          atmosFresnel.bias = 0.0;
          atmosFresnel.power = 4.0;
          atmosFresnel.leftColor = atmosColor;
          atmosFresnel.rightColor = BABYLON.Color3.Black();
          atmosphereGlowMat.emissiveFresnelParameters = atmosFresnel;
          atmosphereGlowMat.opacityFresnelParameters = atmosFresnel;

          atmosphereGlowMesh.material = atmosphereGlowMat;
          atmosphereGlowMesh.parent = planetContainer;

          planetContainer.scaling.set(initScale, initScale, initScale);
          if (celestialGroupRef.current) {
            planetContainer.parent = celestialGroupRef.current;
          }
          celestialMeshInstancesRef.current.push({
            id: entityId,
            mesh: planetContainer,
            entityRef: entity,
          });
        } else if (entity.type === "nebula") {
          const nebContainer = new BABYLON.TransformNode("nebula_group", scene);
          nebContainer.position.set(wx, wy, -100);

          const nebTex = generateNebulaTexture(entity.color, entity.secondaryColor || entity.color, scene);
          const nebMat = new BABYLON.StandardMaterial("nebMat", scene);
          nebMat.diffuseTexture = nebTex;
          nebMat.emissiveTexture = nebTex;
          nebMat.opacityTexture = nebTex;
          nebMat.disableLighting = true;
          nebMat.backFaceCulling = false;
          nebMat.alphaMode = BABYLON.Engine.ALPHA_ADD;

          for (let s = 0; s < 3; s++) {
            const size = entity.radius * (2.8 + s * 0.5);
            const plane = BABYLON.MeshBuilder.CreatePlane(`nebula_sphere_${s}`, { size }, scene);
            plane.material = nebMat;
            plane.rotation.z = s * 1.2;
            plane.billboardMode = BABYLON.TransformNode.BILLBOARDMODE_ALL;
            plane.parent = nebContainer;
          }

          nebContainer.scaling.set(initScale, initScale, initScale);
          if (celestialGroupRef.current) {
            nebContainer.parent = celestialGroupRef.current;
          }
          celestialMeshInstancesRef.current.push({
            id: entityId,
            mesh: nebContainer,
            entityRef: entity,
          });
        } else if (entity.type === "galaxy") {
          const galaxyContainer = new BABYLON.TransformNode("galaxy_group", scene);
          galaxyContainer.position.set(wx, wy, -50);

          const galTex = generateGalaxyTexture(entity.color, entity.secondaryColor || entity.color, scene);
          const galMat = new BABYLON.StandardMaterial("galMat", scene);
          galMat.diffuseTexture = galTex;
          galMat.emissiveTexture = galTex;
          galMat.opacityTexture = galTex;
          galMat.disableLighting = true;
          galMat.backFaceCulling = false;
          galMat.alphaMode = BABYLON.Engine.ALPHA_ADD;

          const galMesh = BABYLON.MeshBuilder.CreateDisc("galaxy_ellipsoid", {
            radius: entity.radius * 2.8,
            tessellation: 64
          }, scene);
          galMesh.material = galMat;
          galMesh.rotation.x = Math.PI / 3.8;
          galMesh.parent = galaxyContainer;

          const coreTex = createCircularGlowTexture(entity.color, scene);
          const coreMat = new BABYLON.StandardMaterial("galaxyCoreMat", scene);
          coreMat.diffuseTexture = coreTex;
          coreMat.emissiveTexture = coreTex;
          coreMat.opacityTexture = coreTex;
          coreMat.disableLighting = true;
          coreMat.backFaceCulling = false;
          coreMat.alphaMode = BABYLON.Engine.ALPHA_ADD;

          const coreMesh = BABYLON.MeshBuilder.CreatePlane("galaxy_core", {
            size: entity.radius * 1.2
          }, scene);
          coreMesh.material = coreMat;
          coreMesh.billboardMode = BABYLON.TransformNode.BILLBOARDMODE_ALL;
          coreMesh.parent = galaxyContainer;

          galaxyContainer.scaling.set(initScale, initScale, initScale);
          if (celestialGroupRef.current) {
            galaxyContainer.parent = celestialGroupRef.current;
          }
          celestialMeshInstancesRef.current.push({
            id: entityId,
            mesh: galaxyContainer,
            entityRef: entity,
          });
        } else if (entity.type === "star") {
          const starContainer = new BABYLON.TransformNode("star_group", scene);
          starContainer.position.set(wx, wy, 0);

          // 1. Radiant Star Core Sphere with surface texture
          const starTex = generateStarTexture(entity.color, entity.secondaryColor || entity.color, scene);
          const coreMat = new BABYLON.StandardMaterial("starCoreMat", scene);
          coreMat.diffuseTexture = starTex;
          coreMat.emissiveTexture = starTex;
          coreMat.emissiveColor = new BABYLON.Color3(1.2, 1.2, 1.2);

          const coreMesh = BABYLON.MeshBuilder.CreateSphere("star_core", {
            diameter: entity.radius * 2.0,
            segments: 32
          }, scene);
          coreMesh.material = coreMat;
          coreMesh.parent = starContainer;

          // 2. Solar Corona Plasma Aura Plane
          const coronaTex = createCircularGlowTexture(entity.color, scene);
          const auraMat = new BABYLON.StandardMaterial("starAuraMat", scene);
          auraMat.diffuseTexture = coronaTex;
          auraMat.emissiveTexture = coronaTex;
          auraMat.opacityTexture = coronaTex;
          auraMat.disableLighting = true;
          auraMat.backFaceCulling = false;
          auraMat.alphaMode = BABYLON.Engine.ALPHA_ADD;

          const auraMesh = BABYLON.MeshBuilder.CreatePlane("star_aura", {
            size: entity.radius * 4.5
          }, scene);
          auraMesh.material = auraMat;
          auraMesh.billboardMode = BABYLON.TransformNode.BILLBOARDMODE_ALL;
          auraMesh.parent = starContainer;

          starContainer.scaling.set(initScale, initScale, initScale);
          if (celestialGroupRef.current) {
            starContainer.parent = celestialGroupRef.current;
          }
          celestialMeshInstancesRef.current.push({
            id: entityId,
            mesh: starContainer,
            entityRef: entity,
          });
        }
      });

      // Just update existing instances coordinates & scale & gentle rotation animation
      celestialMeshInstancesRef.current.forEach((inst) => {
        const entity = inst.entityRef;
        const wx = entity.x - ww / 2;
        const wy = -(entity.y - wh / 2);

        // Smooth flowing size transition
        entity.scale = entity.scale ?? 0;
        
        if (entity.isDestroyed && entity.destroyedBy === "collision") {
          // Instant vanish for shattering collisions
          entity.scale = 0;
        } else {
          const targetScale = entity.isDestroyed ? 0 : 1;
          entity.scale += (targetScale - entity.scale) * 0.08;
        }

        entity.currentRadius = entity.currentRadius ?? entity.radius;
        entity.targetRadius = entity.targetRadius ?? entity.radius;
        entity.currentRadius += (entity.targetRadius - entity.currentRadius) * 0.08;

        entity.originalRadius = entity.originalRadius ?? entity.radius;
        const radiusScale = entity.currentRadius / entity.originalRadius;

        // Dynamic pulse scaling (calm, gentle, photosensitive safe)
        let dynamicPulse = 1.0;
        if (entity.type === "star" || entity.type === "blackhole") {
          dynamicPulse = 1.0 + musicBands.bass * 0.02 + musicBands.mid * 0.01;
        } else if (entity.type === "planet") {
          dynamicPulse = 1.0 + musicBands.mid * 0.015;
        } else if (entity.type === "nebula" || entity.type === "galaxy") {
          dynamicPulse = 1.0 + musicBands.bass * 0.01;
        }

        const finalScale = entity.scale * radiusScale * dynamicPulse;

        // Apply Relativistic Tidal Stretching (Spaghettification) as it nears the black hole!
        let finalScaleX = finalScale;
        let finalScaleY = finalScale;
        let finalScaleZ = finalScale;

        let blackholeDist = 100000;
        let nearestBh: CelestialEntity | null = null;
        celestialEntitiesRef.current.forEach((other) => {
          if (other.type === "blackhole" && !other.isDestroyed && other !== entity) {
            const odx = other.x - entity.x;
            const ody = other.y - entity.y;
            const odist = Math.sqrt(odx * odx + ody * ody);
            if (odist < blackholeDist) {
              blackholeDist = odist;
              nearestBh = other;
            }
          }
        });

        if (nearestBh && entity.type !== "blackhole" && entity.type !== "nebula" && !entity.isDestroyed) {
          const bh = nearestBh as CelestialEntity;
          const horizonZone = bh.radius * 4.2;
          if (blackholeDist < horizonZone) {
            // 1. Relativistic gravitational suction pull & orbital swirl into black hole
            const intensity = (horizonZone - blackholeDist) / horizonZone; // 0 to 1
            const pullStrength = intensity * intensity * 3.2;

            const bdx = bh.x - entity.x;
            const bdy = bh.y - entity.y;
            const normDx = bdx / (blackholeDist || 1);
            const normDy = bdy / (blackholeDist || 1);
            const tx = -normDy;
            const ty = normDx;

            // Spiral accretion trajectory for celestial body
            entity.vx = (entity.vx || 0) + normDx * pullStrength * 0.75 + tx * pullStrength * 0.55;
            entity.vy = (entity.vy || 0) + normDy * pullStrength * 0.75 + ty * pullStrength * 0.55;

            entity.x += entity.vx * 0.12;
            entity.y += entity.vy * 0.12;
            entity.vx *= 0.92;
            entity.vy *= 0.92;

            // 2. Strong gravitational tidal deformation (Spaghettification!)
            const stretchFactor = 1.0 + intensity * 1.35;
            const compressFactor = Math.max(0.12, 1.0 - intensity * 0.48);
            
            finalScaleX = finalScale * stretchFactor;
            finalScaleY = finalScale * compressFactor;
            finalScaleZ = finalScale * compressFactor;

            // Rotate the mesh to align with the black hole center so the stretch points towards the singularity!
            const angleToBh = Math.atan2(bh.y - entity.y, bh.x - entity.x);
            inst.mesh.rotation.z = -angleToBh; // align rotation to face the black hole!

            // 3. Event Horizon Devouring - Sucked past the point of no return!
            if (blackholeDist < bh.radius * 1.12) {
              entity.isDestroyed = true;
              entity.destroyedBy = "blackhole";

              // Spawn accretion explosion flare at horizon boundary
              if (sceneRef.current) {
                const flareMesh = BABYLON.MeshBuilder.CreatePlane("bh_devour_flare", { size: bh.radius * 3.2 }, sceneRef.current);
                flareMesh.position.set(bh.x - ww / 2, -(bh.y - wh / 2), 5);
                const flareMat = new BABYLON.StandardMaterial("devourMat", sceneRef.current);
                const flareTex = createCircularGlowTexture(bh.color, sceneRef.current);
                flareMat.diffuseTexture = flareTex;
                flareMat.emissiveTexture = flareTex;
                flareMat.opacityTexture = flareTex;
                flareMat.disableLighting = true;
                flareMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
                flareMesh.material = flareMat;

                collisionFlaresRef.current.push({
                  mesh: flareMesh,
                  life: 1.0,
                });
              }

              // Play deep cosmic absorption audio
              audio.playInteractiveMallet(0.95, bh.x / ww);

              // Spawn accretion debris tail particles
              if (spawnTailParticleRef.current) {
                for (let k = 0; k < 25; k++) {
                  const ang = Math.random() * Math.PI * 2;
                  const spd = 3 + Math.random() * 8;
                  spawnTailParticleRef.current(
                    bh.x + Math.cos(ang) * bh.radius * 0.9,
                    bh.y + Math.sin(ang) * bh.radius * 0.9,
                    0,
                    Math.cos(ang) * spd,
                    Math.sin(ang) * spd,
                    entity.color || "#ffaa00",
                    0.05
                  );
                }
              }
            }
          } else {
            inst.mesh.rotation.z = 0; // reset
          }
        } else {
          inst.mesh.rotation.z = 0; // reset
        }

        inst.mesh.scaling.set(finalScaleX, finalScaleY, finalScaleZ);

        if (entity.type !== "nebula") {
          // Calculate gravitational Z-bend potential-well depth
          let meshZ = entity.z || 0;
          let meshGravityZ = 0;
          celestialEntitiesRef.current.forEach((other) => {
            if (other.isDestroyed || other === entity) return;
            const odx = other.x - entity.x;
            const ody = other.y - entity.y;
            const odist = Math.sqrt(odx * odx + ody * ody) || 1;
            const range = other.radius * (other.type === "blackhole" ? 3.5 : 2.0);
            if (odist < range) {
              const intensity = (range - odist) / range;
              const pullDepth = other.type === "blackhole" ? 180 : 45;
              meshGravityZ += Math.pow(intensity, 1.8) * pullDepth;
            }
          });
          meshZ += meshGravityZ;

          const mouseNormX = (mouseRef.current.x - ww / 2) / (ww / 2 || 1);
          const mouseNormY = (mouseRef.current.y - wh / 2) / (wh / 2 || 1);
          const parallaxFactor = 0.15;
          const parallaxX = mouseNormX * meshZ * parallaxFactor;
          const parallaxY = mouseNormY * meshZ * parallaxFactor;

          inst.mesh.position.set(wx + parallaxX, wy + parallaxY, meshZ);
        } else {
          inst.mesh.position.set(wx, wy, -30);
          if (cameraRef.current) {
            inst.mesh.rotation.copyFrom(cameraRef.current.rotation);
          }
        }

        // Spin spheres/disks using Babylon getChildMeshes for ALL celestial bodies
        const isPulse = isShockwaveActiveRef.current;
        const objSpeedMult = (objectParticleSpeedRef.current ?? 0.15) / 0.15;
        inst.mesh.getChildMeshes().forEach((child) => {
          if (child.name === "planet_sphere" || child.name === "star_core" || child.name === "galaxy_core") {
            const spinBase = (child.name === "star_core" ? 0.008 : 0.0042) * objSpeedMult;
            child.rotation.y += spinBase + (musicBands.mid * 0.02 + musicBands.treble * 0.01) * objSpeedMult;
          } else if (child.name === "planet_clouds_inner") {
            child.rotation.y += (0.0055 + musicBands.mid * 0.01) * objSpeedMult;
            child.rotation.x += 0.0002 * objSpeedMult;
          } else if (child.name === "planet_clouds_outer") {
            child.rotation.y -= (0.0035 + musicBands.treble * 0.01) * objSpeedMult;
            child.rotation.z += 0.0003 * objSpeedMult;
          } else if (child.name === "planet_aurora_north" || child.name === "planet_aurora_south") {
            child.rotation.z += 0.008 * objSpeedMult;
          } else if (child.name === "planet_shield") {
            child.rotation.y += 0.002 * objSpeedMult;
            child.rotation.x += 0.001 * objSpeedMult;
            const shieldPulse = 1.0 + Math.sin(now * 0.003) * 0.025 + musicAmp * 0.04;
            child.scaling.set(shieldPulse, shieldPulse, shieldPulse);
          } else if (child.name.indexOf("galaxy_ellipsoid_bg") !== -1) {
            child.rotation.z -= (0.0016 + (isPulse ? 0.012 : 0) + musicBands.bass * 0.006) * objSpeedMult;
          } else if (child.name.indexOf("galaxy_ellipsoid") !== -1) {
            child.rotation.z += (0.0024 + (isPulse ? 0.016 : 0) + musicBands.mid * 0.008) * objSpeedMult;
          } else if (child.name.indexOf("accretion_layer_1") !== -1) {
            child.rotation.z += (0.007 + musicBands.bass * 0.005) * objSpeedMult;
            const pulse = 1.0 + Math.sin(Date.now() * 0.001) * 0.012 + musicAmp * 0.02;
            child.scaling.set(pulse, pulse, pulse);
          } else if (child.name.indexOf("accretion_layer_2") !== -1) {
            child.rotation.z -= (0.011 + musicBands.mid * 0.005) * objSpeedMult;
            const pulse = 1.0 + Math.cos(Date.now() * 0.0008) * 0.01 + musicAmp * 0.015;
            child.scaling.set(pulse, pulse, pulse);
          } else if (child.name.indexOf("gravitational_lensing") !== -1) {
            child.rotation.z += (0.003 + musicBands.bass * 0.003) * objSpeedMult;
            const pulse = 1.0 + Math.sin(Date.now() * 0.0006) * 0.015 + musicAmp * 0.02;
            child.scaling.set(pulse, pulse, pulse);
          } else if (child.name.indexOf("nebula_sphere_1") !== -1) {
            child.rotation.y += (0.0008 + musicBands.mid * 0.003) * objSpeedMult;
            child.rotation.x += (0.0004 + musicBands.mid * 0.002) * objSpeedMult;
          } else if (child.name.indexOf("nebula_sphere_2") !== -1) {
            child.rotation.y -= (0.0006 + musicBands.mid * 0.002) * objSpeedMult;
            child.rotation.z += (0.0005 + musicBands.mid * 0.001) * objSpeedMult;
          } else {
            child.rotation.z += (0.003 + musicBands.mid * 0.005) * objSpeedMult;
          }

          if (child) {
            if (child.name === "planet_sphere") {
              child.rotation.y += 0.005;
            } else if (child.name.indexOf("accretion_layer") !== -1) {
              child.rotation.z += 0.01;
            } else if (child.name.indexOf("galaxy_ellipsoid") !== -1) {
              child.rotation.z += 0.002;
            }
          }
        });
      });

    // 5. Dynamic Group Opacity Transition: Elegant background fade based on isInterstellar stage
    let targetGroupOpacity = isInterstellarRef.current ? 1.0 : 0.32;
    if (stageRef.current === 0 && !isInterstellarRef.current) {
      targetGroupOpacity = 0.45 + (screensaverOpacityRef.current * 0.55);
    } else {
      const stageChangeElapsed = Date.now() - lastStageChangeRef.current;
      if (!isInterstellarRef.current) {
        if (stageChangeElapsed < 4000) {
          if (stageChangeElapsed < 3000) {
            targetGroupOpacity = 0.0;
          } else {
            const fadeProgress = (stageChangeElapsed - 3000) / 1000; // 0 to 1
            targetGroupOpacity = 0.32 * fadeProgress;
          }
        }
      }
    }

    if (celestialGroupRef.current) {
      celestialGroupRef.current.getChildMeshes(false).forEach((child) => {
        if (child.material && child.material instanceof BABYLON.StandardMaterial) {
          const mat = child.material;
          if (child.name === "event_horizon_core") {
            mat.needDepthBufferWrite = true;
            mat.alpha = isInterstellarRef.current ? 1.0 : targetGroupOpacity;
            return;
          }

          if (!mat.metadata) {
            mat.metadata = { baseOpacity: mat.alpha ?? 1.0, fadeIn: 0.01 };
          }
          if (mat.metadata.fadeIn < 1.0) {
            mat.metadata.fadeIn += 0.06; // smoothly fade in over ~16 frames
            if (mat.metadata.fadeIn > 1.0) mat.metadata.fadeIn = 1.0;
          }
          const baseOpacity = mat.metadata.baseOpacity * mat.metadata.fadeIn;
          const musicPulseOpacity = 0.38 * musicAmp;
          mat.alpha = baseOpacity * (targetGroupOpacity + musicPulseOpacity * (1 - targetGroupOpacity));
        }
      });
    }
    } catch (err) {
      console.error("[DEBUG] Error in updateCelestial3DMeshes:", err instanceof Error ? err.message : String(err));
    }
  };

  // Dynamically calculate the spacetime fabric distortion based on gravity wells of active celestial bodies
  const getSpacetimeFabricDistortion = (
    wx: number, 
    wy: number, 
    ww: number, 
    wh: number, 
    activeRipples: { x: number; y: number; life: number; maxDist: number; bandWidth: number; minDistSq: number; maxDistBoundSq: number }[],
    time: number,
    disturbance: number
  ) => {
      let gravityZ = 0;
      
      celestialEntitiesRef.current.forEach((entity) => {
        if (entity.isDestroyed) return;
        const ex = entity.x - ww / 2;
        const ey = -(entity.y - wh / 2);
        
        const dx = ex - wx;
        const dy = ey - wy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        
        const range = entity.radius * (entity.type === "blackhole" ? 3.5 : 1.8);
        if (dist < range) {
          const intensity = (range - dist) / range;
          // Sag deeper near massive objects, dynamically influenced by the disturbance level
          const pullDepth = entity.type === "blackhole" ? 180 : 45;
          gravityZ += Math.pow(intensity, 1.8) * pullDepth * (0.2 + disturbance * 0.8);
        }
      });

      // Ripple effects warping the fabric dynamically
      activeRipples.forEach((ripple) => {
        const rx = ripple.x - ww / 2;
        const ry = -(ripple.y - wh / 2);
        const dx = rx - wx;
        const dy = ry - wy;
        const distSq = dx * dx + dy * dy;
        
        if (distSq > ripple.minDistSq && distSq < ripple.maxDistBoundSq) {
          const dist = Math.sqrt(distSq);
          const rForce = (1.0 - Math.abs(dist - ripple.maxDist) / ripple.bandWidth) * ripple.life;
          gravityZ += rForce * 25; 
        }
      });

      // Peaceful traveling electric waves of energy flowing smoothly across the spacetime fabric
      if (disturbance > 0.01) {
        const pulseWave = Math.sin((wx + wy) * 0.012 - time * 0.06) * 6 * Math.min(1.0, disturbance);
        gravityZ += pulseWave;
      }
      
      return gravityZ;
  };

  useEffect(() => {
    isInterstellarRef.current = isInterstellar;
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

    mapParticlesToStage(stage, !isProjectToProject);
    updateHudTexture(stage);

    return () => {};
  }, [stage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ww = window.innerWidth;
    const wh = window.innerHeight;

    // 1. Initialize Babylon.js Engine & Scene
    fovRef.current = 60;
    cameraZRef.current = Math.max(10.0, wh / (2 * Math.tan((fovRef.current * Math.PI) / 360))) * 2.5; // Multiply base cameraZ for vastness

    const { scene, camera } = initializeScene(
      canvas,
      sceneRef,
      cameraRef,
      rendererRef,
      fovRef.current,
      cameraZRef.current
    );
    const engine = rendererRef.current!;

    // Postprocessing Composer setup for cinematic Bloom effect using Babylon's DefaultRenderingPipeline
    const pipeline = new BABYLON.DefaultRenderingPipeline("pipeline", true, scene, [camera]);
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.85; // High threshold so individual particles do not bloom or produce outer glow halos
    pipeline.bloomWeight = 0.08;    // Subtle starting weight
    pipeline.bloomKernel = 64;      // Wide soft cinematic dispersion
    pipeline.bloomScale = 0.5;
    composerRef.current = pipeline;

    // Dedicated GlowLayer to make emissive 3D celestial objects bloom softly
    const glowLayer = new BABYLON.GlowLayer("glowLayer", scene, {
      mainTextureRatio: 0.25,
      blurKernelSize: 16,
    });
    glowLayer.intensity = 0.05;
    glowLayerRef.current = glowLayer;

    // Direct lighting & ambient light setup
    const ambientLight = new BABYLON.HemisphericLight("ambientLight", new BABYLON.Vector3(0, 1, 0), scene);
    ambientLight.intensity = 0.28;

    const dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(1.5, -1.0, 1.2), scene);
    dirLight.intensity = 1.05;

    // Group/Node to hold interstellar celestial bodies
    const celestialGroup = new BABYLON.TransformNode("celestialGroup", scene);
    celestialGroupRef.current = celestialGroup;

    // 2. Layered Typography Tracer Texture
    const hudDpr = window.devicePixelRatio || 1;
    const hudTexture = new BABYLON.DynamicTexture("hudTex", { width: ww * hudDpr, height: wh * hudDpr }, scene, false);
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
    hudPlane.isVisible = false; // Completely hide background outline vectors so only particles are seen
    hudPlaneRef.current = hudPlane;

    const isMobileDevice =
      /iPad|iPhone|iPod|Android/i.test(navigator.userAgent) || ww < 768;

    // 3. Particle System Instantiation
    const numStars = 0;
    const tempParticles: Particle[] = [];
    const fallbackColor = "#ffffff";

    // Tail/trail particles variables
    const tailCount: number = isMobileDevice ? 3000 : 10000;
    let tailStartIndex = -1;
    let tailIndex = 0;

    for (let s = 0; s < numStars; s++) {
      const starColor = Math.random() > 0.65 ? "#ffcc99" : "#ffffff";
      tempParticles.push({
        x: ww / 2 + (Math.random() - 0.5) * (ww * 8),
        y: wh / 2 + (Math.random() - 0.5) * (wh * 8),
        z: (Math.random() - 0.5) * (ww * 8),
        targetX: 0,
        targetY: 0,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        vz: 0,
        color: starColor,
        baseColor: starColor,
        size: Math.max(0.1, 0.1 + Math.random() * 0.2),
        isCosmicAmbient: true,
        driftSpeed: 0.12 + Math.random() * 0.35,
      });
    }

    const initialCoords = generateTargetsForStage(0, ww, wh);
    const maxCap = isMobileDevice ? 25000 : 75000;
    const minCap = isMobileDevice ? 12000 : 45000;
    const particleCount = Math.min(
      maxCap,
      Math.max(minCap, initialCoords.length),
    );

    for (let i = 0; i < particleCount; i++) {
      const t = initialCoords[i % initialCoords.length] || {
        x: ww / 2,
        y: wh / 2,
        color: fallbackColor,
      };
      const col = t.color || fallbackColor;
      tempParticles.push({
        x: ww / 2 + (Math.random() - 0.5) * (ww * 6),
        y: wh / 2 + (Math.random() - 0.5) * (wh * 6),
        z: (Math.random() - 0.5) * (ww * 6),
        targetX: t.x,
        targetY: t.y,
        vx: 0,
        vy: 0,
        vz: 0,
        color: col,
        baseColor: col,
        size: Math.max(0.1, 0.1 + Math.random() * 0.2),
      });
    }

    // Allocate tail/trail particles at the end
    for (let i = 0; i < tailCount; i++) {
      tempParticles.push({
        x: -99999,
        y: -99999,
        z: 0,
        targetX: -99999,
        targetY: -99999,
        vx: 0,
        vy: 0,
        vz: 0,
        color: "#000000",
        baseColor: "#000000",
        size: Math.max(0.1, 0.1 + Math.random() * 0.2),
        isTail: true,
        life: 0,
        decay: 0.05 + Math.random() * 0.05,
      });
    }

    tempParticles.sort((a, b) => {
      if (a.isTail && !b.isTail) return 1;
      if (!a.isTail && b.isTail) return -1;
      if (a.isCosmicAmbient && !b.isCosmicAmbient) return -1;
      if (!a.isCosmicAmbient && b.isCosmicAmbient) return 1;
      return a.color.localeCompare(b.color);
    });
    syncParticleColors(tempParticles);

    particlesRef.current = tempParticles;
    tailStartIndex = tempParticles.findIndex((p) => p.isTail);
    tailStartIndexRef.current = tailStartIndex;

    const totalCount = tempParticles.length;
    const positions = new Float32Array(totalCount * 3);
    const colors = new Float32Array(totalCount * 4);
    const extras = new Float32Array(totalCount);

    const pointsMesh = new BABYLON.Mesh("pointsMesh", scene);
    pointsMesh.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions, true, 3);
    pointsMesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors, true, 4);
    pointsMesh.setVerticesData("extraData", extras, true, 1);
    
    const indices = new Int32Array(totalCount);
    for (let i = 0; i < totalCount; i++) {
      indices[i] = i;
    }
    pointsMesh.setIndices(indices);

    pointsMeshRef.current = pointsMesh;
    if (glowLayerRef.current) {
      glowLayerRef.current.addExcludedMesh(pointsMesh);
    }

    const circTex = createCircleTexture(scene);
    const dpr = window.devicePixelRatio || 1;
    
    // Add shader for particles
    BABYLON.Effect.ShadersStore["customParticleVertexShader"] = `
      precision highp float;
      attribute vec3 position;
      attribute vec4 color;
      attribute float extraData;
      uniform mat4 worldViewProjection;
      uniform float pointSize;
      varying vec4 vColor;
      varying float vExtra;
      varying vec3 vPos;
      void main(void) {
        gl_Position = worldViewProjection * vec4(position, 1.0);
        if (extraData > 2.5) {
          gl_PointSize = pointSize * 0.85;
        } else if (extraData > 1.5) {
          gl_PointSize = pointSize * 0.8;
        } else if (extraData > 0.5) {
          gl_PointSize = pointSize * 0.65;
        } else {
          gl_PointSize = pointSize * 0.5;
        }
        vColor = color;
        vExtra = extraData;
        vPos = position;
      }
    `;

    BABYLON.Effect.ShadersStore["customParticlePixelShader"] = `
      precision highp float;
      varying vec4 vColor;
      varying float vExtra;
      varying vec3 vPos;
      uniform sampler2D textureSampler;
      void main(void) {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord);
        if (dist > 0.5) discard;
        
        vec4 texColor = texture2D(textureSampler, gl_PointCoord);
        
        // Soft Gaussian radial falloff for silky smooth particle edges
        float radialGlow = exp(-dist * dist * 10.0);
        
        float alpha = 1.0;
        if (vExtra > 2.5) {
          alpha = 0.25;
        } else if (vExtra > 1.5) {
          alpha = 0.45;
        } else if (vExtra > 0.5) {
          alpha = vColor.a > 0.0 ? vColor.a : 0.92;
        } else {
          alpha = 0.55;
        }
        
        float finalAlpha = texColor.a * radialGlow * alpha;
        gl_FragColor = vec4(vColor.rgb * texColor.rgb * finalAlpha, finalAlpha);
      }
    `;

    const pointsMaterial = new BABYLON.ShaderMaterial("pointsMat", scene, {
      vertex: "customParticle",
      fragment: "customParticle"
    }, {
      attributes: ["position", "color", "extraData"],
      uniforms: ["worldViewProjection", "pointSize"],
      samplers: ["textureSampler"],
      needAlphaBlending: true,
      needAlphaTesting: false
    });
    
    pointsMaterial.setTexture("textureSampler", circTex);
    pointsMaterial.setFloat("pointSize", (isMobileDevice ? 3.0 : 4.0) * dpr);
    pointsMaterial.alphaMode = BABYLON.Engine.ALPHA_ONEONE;
    pointsMaterial.fillMode = 2;

    pointsMesh.material = pointsMaterial;
    pointsMaterialRef.current = pointsMaterial;
    pointsMesh.hasVertexAlpha = true;
    pointsMesh.alwaysSelectAsActiveMesh = true;

    // Check if there's an active auto-restore sequence ID saved in localStorage
    const autoRestoreId = localStorage.getItem("cosmic_debug_auto_restore");
    if (autoRestoreId) {
      try {
        const saved = localStorage.getItem("cosmic_debug_sequences");
        const list = saved ? JSON.parse(saved) : {};
        const seq = list[autoRestoreId];
        if (seq) {
          console.log(`%c[COSMIC DEBUG] Auto-restoring sequence: ${autoRestoreId}`, "color: #10b981; font-weight: bold;");
          nextGeminiSceneRef.current = {
            archetype: seq.archetype,
            systemName: seq.systemName,
            systemDesc: seq.systemDesc,
            systemTags: seq.systemTags,
            entities: seq.entities,
          };
          if (animationComplete) {
            animationComplete();
          }
        }
      } catch (err) {
        console.warn("[COSMIC DEBUG] Auto-restore failed:", err);
      }
    }

    // Register global console command for direct sequence recall / activation
    (window as any).activateSequence = (id: string | null) => {
      if (!id) {
        localStorage.removeItem("cosmic_debug_auto_restore");
        console.log("%c[COSMIC DEBUG] Auto-restore cleared. Default screensaver and normal transitions resumed.", "color: #ff4b2b; font-weight: bold;");
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

        // Keep auto-restore updated
        localStorage.setItem("cosmic_debug_auto_restore", id);
        console.log(`%c[COSMIC DEBUG] Activating sequence: ${id}`, "color: #10b981; font-weight: bold;");

        nextGeminiSceneRef.current = {
          archetype: seq.archetype,
          systemName: seq.systemName,
          systemDesc: seq.systemDesc,
          systemTags: seq.systemTags,
          entities: seq.entities,
        };

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

    // Seed scene if starting in interstellar mode, otherwise clear celestial entities so typography is unhindered
    if (isInterstellarRef.current) {
      generateInterstellarScene(ww, wh, true);
    } else {
      celestialEntitiesRef.current = [];
      fetchNextGeminiScene();
    }

    mapParticlesToStage(stageRef.current, false);

    let time = 0;

    const spawnTailParticle = (
      x: number,
      y: number,
      z: number,
      vx: number,
      vy: number,
      color: string,
      decayRate?: number
    ) => {
      const activeTailStartIndex = tailStartIndexRef.current !== -1 ? tailStartIndexRef.current : tailStartIndex;
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
        tailP.decay = decayRate || (0.04 + Math.random() * 0.05);
      }
    };

    spawnTailParticleRef.current = spawnTailParticle;

    // Main Hardware-Accelerated 3D Simulation and Render Loop
    const render = () => {
      const currentW = window.innerWidth;
      const currentH = window.innerHeight;
      const isMobileDevice =
        /iPad|iPhone|iPod|Android/i.test(navigator.userAgent) || currentW < 768;

      const now = Date.now();
      const dt = rendererRef.current ? rendererRef.current.getDeltaTime() : 16.666;
      const globalTimeMultiplier = Math.min(dt / 16.666, 3.0);
      
      // Dynamic Web Audio API metrics with temporal smoothing for photosensitive safety
      const rawMusicAmp = (audio as any).getMusicAmplitude();
      const rawMusicBands = (audio as any).getFrequencyBands ? (audio as any).getFrequencyBands() : { bass: 0, mid: 0, treble: 0 };
      
      smoothedAmpRef.current += (rawMusicAmp - smoothedAmpRef.current) * 0.03;
      smoothedBassRef.current += (rawMusicBands.bass - smoothedBassRef.current) * 0.03;
      smoothedMidRef.current += (rawMusicBands.mid - smoothedMidRef.current) * 0.03;
      smoothedTrebleRef.current += (rawMusicBands.treble - smoothedTrebleRef.current) * 0.03;

      const musicAmpVal = Math.min(0.12, smoothedAmpRef.current);
      const musicBands = {
        bass: Math.min(0.12, smoothedBassRef.current),
        mid: Math.min(0.12, smoothedMidRef.current),
        treble: Math.min(0.12, smoothedTrebleRef.current),
      };
      const musicSpeedFactor = 1.0 + musicBands.mid * 0.4 + musicBands.bass * 0.2;

      const idleTime = now - lastUserActivityRef.current;
      const isIdle = idleTime > 10000; // 10 seconds idle timeout
      isScreensaverActiveRef.current = (stageRef.current === 0) && isIdle;

      if (isScreensaverActiveRef.current) {
        screensaverOpacityRef.current += (1.0 - screensaverOpacityRef.current) * 0.02;
      } else {
        screensaverOpacityRef.current += (0.0 - screensaverOpacityRef.current) * 0.08;
      }

      // Trigger a gentle, subtle Shockwave wave every 60 seconds on stage 0
      const shockwaveInterval = 60000;
      if (stageRef.current === 0) {
        if (now - lastShockwaveTimeRef.current > shockwaveInterval) {
          isShockwaveActiveRef.current = true;
          shockwaveStartTimeRef.current = now;
          lastShockwaveTimeRef.current = now;
        }
      } else {
        isShockwaveActiveRef.current = false;
      }

      let shockwaveIntensity = 0;

      // Wormhole Transit State
      const isTransitActive = isTransitActiveRef.current;
      let transitProgress = 0;
      let transitCx = currentW / 2;
      let transitCy = currentH / 2;
      if (isTransitActive && transitStartTimeRef.current > 0) {
        const elapsed = now - transitStartTimeRef.current;
        transitProgress = Math.min(elapsed / 3000, 1.0);
        transitCx = mouseRef.current.x > 0 ? mouseRef.current.x : currentW / 2;
        transitCy = mouseRef.current.y > 0 ? mouseRef.current.y : currentH / 2;
      }

      const activeSupernova = supernovaRef.current;
      let snElapsed = 0;
      if (activeSupernova) {
        snElapsed = Date.now() - activeSupernova.time;
      }

      time++;

      // Dynamic synchronization of 3D entities
      updateCelestial3DMeshes();

      const elapsed = Date.now() - lastStageChangeRef.current;

      const chromaticShift = 0;

      let tracerOpacity = 0.85;
      if (elapsed < 1200) {
        const pTransit = elapsed / 1200;
        tracerOpacity = 0.15 + pTransit * 0.7;
      }

      if (hudPlaneRef.current && hudPlaneRef.current.material && hudPlaneRef.current.material instanceof BABYLON.StandardMaterial) {
        hudPlaneRef.current.material.alpha =
          isInterstellarRef.current ? 0 : tracerOpacity * 0.8;
      }

      scrollVelocityRef.current *= 0.92;
      
      const particles = particlesRef.current;

      // Frame-start cached variables for particle calculations to eliminate redundant inner-loop computations
      const entitiesList = celestialEntitiesRef.current;
      const activeBlackholes = entitiesList.filter((e) => e && !e.isDestroyed && e.type === "blackhole");
      const activeCollidables = entitiesList.filter((e) => e && !e.isDestroyed && e.type !== "galaxy" && e.type !== "nebula" && e.type !== "blackhole");

      let attractionMultiplier = 1.0;
      if (elapsed > 1200) {
        attractionMultiplier = Math.max(0.65, 1 - (elapsed - 1200) / 800);
      }

      let globalAlpha = 1.0;
      if (elapsed > 1200) {
        const alphaFade = Math.min(1.0, (elapsed - 1200) / 1000);
        globalAlpha = 1.0 - alphaFade * 0.1;
      }

      const isTypographyMode = stageRef.current >= 2 && stageRef.current <= 5;
      const floatScaleX = isTypographyMode
        ? 0
        : (1 - attractionMultiplier) * 0.5;
      const floatScaleY = isTypographyMode
        ? 0
        : (1 - attractionMultiplier) * 0.5;
      const floatSpeed = 0.012;

      const mIdleTime = Date.now() - mouseRef.current.lastMoved;
      let vortexMultiplier = 1.0;
      if (mIdleTime > 2000) {
        vortexMultiplier = Math.max(0, 1.0 - (mIdleTime - 2000) / 1000);
      }

      // Drive active Supernova 3D Special Effects lifecycle
      if (activeSupernovaFxRef.current) {
        activeSupernovaFxRef.current.update(now);
      }

      // Camera Shake decay and application during explosion
      if (cameraShakeRef.current > 0.05) {
        const shake = cameraShakeRef.current;
        if (cameraRef.current) {
          cameraRef.current.position.x += (Math.random() - 0.5) * (shake * 0.12);
          cameraRef.current.position.y += (Math.random() - 0.5) * (shake * 0.12);
        }
        cameraShakeRef.current *= 0.91;
      }

      let snSuckForce = 0;
      let snExplode = false;
      if (activeSupernova) {
        snElapsed = Date.now() - activeSupernova.time;
        
        // Intense bloom spike during supernova explosion
        if (composerRef.current && snElapsed < 3000) {
          const spike = Math.max(0, 1.0 - snElapsed / 3000);
          composerRef.current.bloomWeight = 0.08 + spike * 0.75;
        }

        const transitionThreshold = 3500;
        
        if (snElapsed >= transitionThreshold && !activeSupernova.transitioned) {
          console.log("[DEBUG] Supernova transition threshold reached, generating new scene.");
          activeSupernova.transitioned = true;
          if (animationComplete) {
            animationComplete();
          }
          const ww = window.innerWidth;
          const wh = window.innerHeight;
          generateInterstellarScene(ww, wh, true);
          mapParticlesToInterstellar(ww, wh);
          
          if (camera) {
            transitionStartTimeRef.current = Date.now();
            transitionActiveRef.current = true;
            transitionStartPosRef.current = camera.position.clone();
          }

          if (activeSupernovaFxRef.current) {
            activeSupernovaFxRef.current.dispose();
            activeSupernovaFxRef.current = null;
          }
          supernovaRef.current = null; // Clear supernova so physics is not prematurely triggered in the new scene
        }
      }

      const activeRipples = ripplesRef.current.map((ripple) => {
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

      // Compute total disturbance level from ripples and active supernovae
      let disturbance = activeRipples.reduce((acc, r) => acc + r.life, 0);
      
      if (supernovaRef.current) {
        const elapsed = Date.now() - supernovaRef.current.time;
        if (elapsed < 3000) {
          // Intense gravitational disruption from supernova core collapse
          disturbance += (1 - elapsed / 3000) * 2.5;
        }
      }

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (!p) continue;

        if (p.isTail) {
          if (p.life && p.life > 0) {
            // Gravitational pull of stardust/debris near black holes for orbital decay
            activeBlackholes.forEach((entity) => {
              const bdx = entity.x - p.x;
              const bdy = entity.y - p.y;
              const bdist = Math.sqrt(bdx * bdx + bdy * bdy) || 1;
              const gravityRadiusMult = 4.5; // wider gravity field for fast debris particles
              if (bdist < entity.radius * gravityRadiusMult) {
                const pullFactor = 1.0 - bdist / (entity.radius * gravityRadiusMult);
                const pullStrength = 3.5 * pullFactor;
                p.vx += (bdx / bdist) * pullStrength;
                p.vy += (bdy / bdist) * pullStrength;
              }
            });

            const objSpeedMult = (objectParticleSpeedRef.current ?? 0.15) / 0.15;
            p.x += p.vx * objSpeedMult;
            p.y += p.vy * objSpeedMult;
            p.z += p.vz * objSpeedMult;

            p.vx *= 0.94;
            p.vy *= 0.94;
            p.vz *= 0.94;

            p.life -= (p.decay || 0.06) * objSpeedMult;
            if (p.life < 0) p.life = 0;

            positions[i * 3] = p.x - currentW / 2;
            positions[i * 3 + 1] = -(p.y - currentH / 2);
            positions[i * 3 + 2] = p.z;

            const r = p.r ?? 255;
            const g = p.g ?? 255;
            const b = p.b ?? 255;

            const tailPulse = 1.0 + musicAmpVal * 0.8;
            const tailOpacity = particleFiltersRef.current.tails ? p.life * 0.45 : 0;
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
          let dx = p.x - cx;
          let dy = p.y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;

          if (snElapsed < 250) {
            // Implosion phase: pull particles in toward supernova core
            if (dist < 500) {
              const suck = (1.0 - dist / 500) * 2.2;
              p.vx -= (dx / dist) * suck;
              p.vy -= (dy / dist) * suck;
            }
          } else if (snElapsed >= 250 && snElapsed < 2500) {
            // Explosion phase: violent expanding radial shockwave
            const waveRadius = (snElapsed - 250) * 0.85;
            if (Math.abs(dist - waveRadius) < 140) {
              const push = (1.0 - Math.abs(dist - waveRadius) / 140) * 9.0;
              p.vx += (dx / dist) * push;
              p.vy += (dy / dist) * push;
            }
          }
        }

        if (p.isCosmicAmbient) {
          const ambSpeedMult = (ambientParticleSpeedRef.current ?? 0.15) / 0.15;
          p.y -= scrollVelocityRef.current * (p.driftSpeed || 0.2) * ambSpeedMult;
          p.x += Math.sin(time * 0.005 + i) * 0.15 * ambSpeedMult;

          if (p.y < currentH / 2 - currentH * 4) p.y = currentH / 2 + currentH * 4;
          if (p.y > currentH / 2 + currentH * 4) p.y = currentH / 2 - currentH * 4;
          if (p.x < currentW / 2 - currentW * 4) p.x = currentW / 2 + currentW * 4;
          if (p.x > currentW / 2 + currentW * 4) p.x = currentW / 2 - currentW * 4;
          if (p.z < currentW / 2 - currentW * 4) p.z = currentW / 2 + currentW * 4;
          if (p.z > currentW / 2 + currentW * 4) p.z = currentW / 2 - currentW * 4;

          const mdx = mouseRef.current.x - p.x;
          const mdy = mouseRef.current.y - p.y;
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

          activeBlackholes.forEach((entity) => {
            const ldx = drawAmbX - entity.x;
            const ldy = drawAmbY - entity.y;
            const ldist = Math.sqrt(ldx * ldx + ldy * ldy) || 1;
            
            const horizon = entity.radius;
            const lenseRadius = horizon * 1.35;
            
            if (ldist > horizon * 0.95) {
              const shiftDist = Math.sqrt(ldist * ldist + lenseRadius * lenseRadius);
              const lensedX = entity.x + (ldx / ldist) * shiftDist;
              const lensedY = entity.y + (ldy / ldist) * shiftDist;
              
              const blendFactor = Math.pow(Math.max(0, 1.0 - ldist / (horizon * 5.0)), 1.5);
              drawAmbX = drawAmbX + (lensedX - drawAmbX) * blendFactor;
              drawAmbY = drawAmbY + (lensedY - drawAmbY) * blendFactor;
            }
          });

          // Map ambient particles to Babylon.js positions with gravitational lensing
          // Add mouse-responsive parallax effect to background particles relative to cursor
          const mouseNormX = (mouseRef.current.x - currentW / 2) / (currentW / 2 || 1);
          const mouseNormY = (mouseRef.current.y - currentH / 2) / (currentH / 2 || 1);
          // Deeper particles (p.z is negative) move more to emphasize vastness
          const parallaxFactor = 0.15;
          const parallaxX = mouseNormX * p.z * parallaxFactor;
          const parallaxY = mouseNormY * p.z * parallaxFactor;
          
          let finalX = drawAmbX - currentW / 2 + parallaxX;
          let finalY = -(drawAmbY - currentH / 2 + parallaxY);
          let finalZ = p.z;

          if (isTransitActive && transitProgress > 0) {
            // Tunnel effect: pull particles towards a cylinder around the transit center
            const cx = transitCx - currentW / 2;
            const cy = -(transitCy - currentH / 2);
            
            const dx = finalX - cx;
            const dy = finalY - cy;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            
            // The tunnel radius
            const tunnelRadius = 150 + Math.random() * 200;
            const pullFactor = Math.pow(transitProgress, 1.5);
            
            finalX += (dx / dist * tunnelRadius - dx) * pullFactor;
            finalY += (dy / dist * tunnelRadius - dy) * pullFactor;
            finalZ -= 2000 * pullFactor * (Math.random() * 0.5 + 0.5); // shoot past camera
          }

          positions[i * 3] = finalX;
          positions[i * 3 + 1] = finalY;
          positions[i * 3 + 2] = finalZ;

          // Simple white or dim ambient color
          let r = p.color === "#ffffff" ? 0.7 : 0.8;
          let g = p.color === "#ffffff" ? 0.7 : 0.8;
          let b = p.color === "#ffffff" ? 0.7 : 0.8;
          
          if (isTransitActive && transitProgress > 0) {
            const shift = Math.pow(transitProgress, 1.2);
            r = r * (1.0 - shift * 0.8) + shift * 0.4;
            g = g * (1.0 - shift * 0.5) + shift * 1.5;
            b = b * (1.0 + shift * 1.0) + shift * 3.0;
          }

          if (!particleFiltersRef.current.ambient) {
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
            // General Relativistic Schwarzschild Time Dilation approximation
            const ratio = Math.max(0.04, Math.min(1.0, (gdist - entity.radius * 0.4) / (horizonZone - entity.radius * 0.4)));
            const dilation = Math.sqrt(ratio);
            if ((dilation * globalTimeMultiplier) < localTimeDilation) {
              localTimeDilation = dilation * globalTimeMultiplier;
            }
          }
        });

        p.vy -= scrollVelocityRef.current * 0.16;
        p.vx +=
          Math.sin(i * 0.05 + time * 0.1) *
          Math.abs(scrollVelocityRef.current) *
          0.03;

        // Continuous Curl Noise vector field for fluid dynamics and spatiotemporal coherence
        const curl = computeCurlNoise(p.x, p.y, time * 0.12);
        const fluidTransitionFactor = isTypographyMode ? 0.12 : 0.75;
        const springDistSq = (p.targetX - p.x) * (p.targetX - p.x) + (p.targetY - p.y) * (p.targetY - p.y);
        const springFactorSq = Math.max(0.01, Math.min(1.0, springDistSq / 25000)); // 1 when far, 0 when close
        let fluidInfluence = Math.max(0.0, Math.min(0.85, (1.0 - (p.isProjectText ? 0.75 : 0.22)) * fluidTransitionFactor * springFactorSq));
        if (p.isProjectText) {
          fluidInfluence *= ((textParticleSpeedRef.current ?? 0.12) * 1.5);
        }
        
        p.vx += curl.x * fluidInfluence;
        p.vy += curl.y * fluidInfluence;

        p.x += p.vx * localTimeDilation;
        p.y += p.vy * localTimeDilation;
        p.z += p.vz * localTimeDilation;

        p.vx *= 0.86;
        p.vy *= 0.86;
        p.vz *= 0.86;

        if (isInterstellarRef.current && p.interstellarType) {
          const objSpeedMult = (objectParticleSpeedRef.current ?? 0.15) / 0.15;
          const ambSpeedMult = (ambientParticleSpeedRef.current ?? 0.15) / 0.15;

          if (
            p.interstellarType === "blackhole" ||
            p.interstellarType === "planet"
          ) {
            p.orbitAngle = (p.orbitAngle || 0) + (p.orbitSpeed || 0.005) * 0.45 * localTimeDilation * musicSpeedFactor * objSpeedMult;
            let entity = p.interstellarEntity ||
              celestialEntitiesRef.current[p.interstellarEntityIndex || 0];

            if (entity && entity.isDestroyed) {
              const activeEntityIdx = celestialEntitiesRef.current.findIndex(e => e && !e.isDestroyed && e.type === "blackhole");
              if (activeEntityIdx !== -1) {
                p.interstellarEntityIndex = activeEntityIdx;
                p.interstellarEntity = celestialEntitiesRef.current[activeEntityIdx];
                p.orbitRadius = (p.orbitRadius || 50) * 0.96;
                entity = p.interstellarEntity;
              }
            }

            if (entity) {
              if (entity.type === "blackhole") {
                const rx = p.orbitRadius || 50;
                const ry = rx * 0.25;
                const theta = 0.05;
                const cosT = Math.cos(theta);
                const sinT = Math.sin(theta);
                const ox = Math.cos(p.orbitAngle) * rx;
                const oy = Math.sin(p.orbitAngle) * ry;
                p.targetX = entity.x + (ox * cosT - oy * sinT);
                p.targetY = entity.y + (ox * sinT + oy * cosT);
                p.targetZ = Math.sin(p.orbitAngle) * rx * 0.55;
              } else {
                if (p.isPlanetRing) {
                  const rx = p.orbitRadius || 50;
                  const ry = rx * 0.22;
                  const theta = 0.3;
                  const cosT = Math.cos(theta);
                  const sinT = Math.sin(theta);
                  const ox = Math.cos(p.orbitAngle) * rx;
                  const oy = Math.sin(p.orbitAngle) * ry;
                  p.targetX = entity.x + (ox * cosT - oy * sinT);
                  p.targetY = entity.y + (ox * sinT + oy * cosT);
                  p.targetZ = Math.sin(p.orbitAngle) * rx * 0.4;
                } else {
                  const rx = p.orbitRadius || 50;
                  const ry = rx * 0.7;
                  const theta = -0.15;
                  const cosT = Math.cos(theta);
                  const sinT = Math.sin(theta);
                  const ox = Math.cos(p.orbitAngle) * rx;
                  const oy = Math.sin(p.orbitAngle) * ry;
                  p.targetX = entity.x + (ox * cosT - oy * sinT);
                  p.targetY = entity.y + (ox * sinT + oy * cosT);
                  p.targetZ = Math.sin(p.orbitAngle) * rx * 0.4;
                }
              }
            }
          } else if (p.interstellarType === "nebula") {
            p.orbitAngle = (p.orbitAngle || 0) + (p.orbitSpeed || 0.002) * 0.45 * localTimeDilation * musicSpeedFactor * objSpeedMult;
            const entity = p.interstellarEntity ||
              celestialEntitiesRef.current[p.interstellarEntityIndex || 0];
            if (entity) {
              const angle = p.orbitAngle + i;
              const rad =
                (p.orbitRadius || entity.radius * 0.5) +
                Math.sin(time * 0.01 + i) * 10;
              p.targetX = entity.x + Math.cos(angle) * rad;
              p.targetY = entity.y + Math.sin(angle) * rad;
            }
          } else if (p.interstellarType === "bridge") {
            p.bridgeProgress =
              (p.bridgeProgress ?? 0) + (p.bridgeSpeed ?? 0.012) * 0.45 * localTimeDilation * musicSpeedFactor * objSpeedMult;
            if (p.bridgeProgress > 1) {
              p.bridgeProgress = 0;
            }
            const start = p.bridgeStartEntity ||
              celestialEntitiesRef.current[p.bridgeStartEntityIndex ?? 0];
            const end = p.bridgeEndEntity ||
              celestialEntitiesRef.current[p.bridgeEndEntityIndex ?? 1];
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
              p.targetZ = Math.sin(t * Math.PI) * 15;
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
            p.targetX += Math.sin(time * 0.01 + i) * 0.05 * objSpeedMult;
            p.targetY += Math.cos(time * 0.01 + i) * 0.05 * objSpeedMult;
          }
        }

        let particleBrightness = 1.0;
        let suctionAlpha = 0;

        // Spacetime gravity bending is always active except for a brief time during stage change in typography mode
        const isInterferenceSuppressed = !isInterstellarRef.current && (elapsed < 4000);

        if (!isInterferenceSuppressed) {
          const gravityRadiusMult = isInterstellarRef.current ? 3.6 : 2.2;
          
          // 1. Black hole attraction & event horizon consumption
          activeBlackholes.forEach((entity) => {
            const bdx = entity.x - p.x;
            const bdy = entity.y - p.y;
            const bdist = Math.sqrt(bdx * bdx + bdy * bdy) || 1;
            if (bdist < entity.radius * gravityRadiusMult) {
              const pullFactor = 1.0 - bdist / (entity.radius * gravityRadiusMult);
              suctionAlpha = Math.max(suctionAlpha, pullFactor * (isInterstellarRef.current ? 1.0 : 0.4));

              const basePullStrength = isInterstellarRef.current ? 6.2 : 2.2;
              const tx = -bdy / bdist;
              const ty = bdx / bdist;

              // Relativistic spiral accretion trajectory (swirling faster as radial gravity accelerates inwards)
              const closeness = 1.0 - (bdist / (entity.radius * gravityRadiusMult)); // 0 at outskirts, 1 at singularity
              const orbitalStrength = basePullStrength * 2.1 * pullFactor;
              const radialStrength = basePullStrength * 0.75 * pullFactor * (0.2 + closeness * 1.8);

              p.vx += (bdx / bdist) * radialStrength + tx * orbitalStrength;
              p.vy += (bdy / bdist) * radialStrength + ty * orbitalStrength;

              // Spaghettification velocity acceleration near horizon
              if (bdist < entity.radius * 1.8) {
                p.vx *= 1.06;
                p.vy *= 1.06;
              }

              // Event Horizon Crossing: Fade emission brightness strictly to 0.0 inside the event horizon shadow
              if (bdist < entity.radius * 1.08) {
                const horizonFade = Math.max(0.0, (bdist - entity.radius * 0.95) / (entity.radius * 0.13));
                particleBrightness = Math.min(particleBrightness, horizonFade);
                
                if (bdist < entity.radius * 0.92) {
                  // Sucked into the singularity! Recycle the particle to keep cosmic density balanced
                  if (spawnTailParticleRef.current && Math.random() < 0.25) {
                    spawnTailParticleRef.current(
                      entity.x + (bdx / bdist) * entity.radius * 1.02,
                      entity.y + (bdy / bdist) * entity.radius * 1.02,
                      p.z,
                      tx * 2.5,
                      ty * 2.5,
                      entity.color,
                      0.10
                    );
                  }
                  p.x = (Math.random() > 0.5 ? -150 : currentW + 150);
                  p.y = (Math.random() > 0.5 ? -150 : currentH + 150);
                  p.vx = (Math.random() - 0.5) * 2;
                  p.vy = (Math.random() - 0.5) * 2;
                }
              }
            }
          });

          // 2. Rigid body collision with planets/stars
          const colOffset = isMobileDevice ? 2 : 3;
          activeCollidables.forEach((entity) => {
            const bdx = entity.x - p.x;
            const bdy = entity.y - p.y;
            const bdist = Math.sqrt(bdx * bdx + bdy * bdy) || 1;
            const colDist = entity.radius + colOffset;
            if (bdist < colDist && !p.isTail) {
              const nx = bdx / bdist;
              const ny = bdy / bdist;
              
              // Bounce velocity
              const dot = p.vx * nx + p.vy * ny;
              if (dot > 0) {
                  p.vx -= 2 * dot * nx;
                  p.vy -= 2 * dot * ny;
                  p.vx += (Math.random() - 0.5) * 4; // Add scatter
                  p.vy += (Math.random() - 0.5) * 4;
              }
              
              // Push out of the celestial body to prevent clipping
              p.x = entity.x - nx * (colDist + 1);
              p.y = entity.y - ny * (colDist + 1);
            }
          });
        }

        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const distSq = dx * dx + dy * dy;

        const textSpeedMult = textParticleSpeedRef.current ?? 0.12;

        const baseSpring = isTypographyMode
          ? Math.max(0.04, Math.min(0.25, 20.0 / Math.max(1, distSq)))
          : isInterstellarRef.current
            ? 0.24
            : 0.08;

        const effectiveSpring = (p.isProjectText
          ? baseSpring * textSpeedMult
          : baseSpring) * (1.0 - suctionAlpha);

        if (distSq > 0.1) {
          if (p.isProjectText) {
             const mdx = mouseRef.current.x - p.x;
             const mdy = mouseRef.current.y - p.y;
             const mDistSq = mdx * mdx + mdy * mdy;
             if (mDistSq < 10000) { // Hover radius 100
                const mDist = Math.sqrt(mDistSq);
                const mForce = (1 - mDist / 100) * 0.1 * textSpeedMult; // Soft magnetic hover
                p.x += mdx * mForce;
                p.y += mdy * mForce;
             }
          }
          p.x += dx * effectiveSpring * attractionMultiplier * localTimeDilation;
          p.y += dy * effectiveSpring * attractionMultiplier * localTimeDilation;
        } else {
          if (attractionMultiplier > 0.01) {
            if (p.isProjectText) {
              p.x += dx * 0.1 * textSpeedMult;
              p.y += dy * 0.1 * textSpeedMult;
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

        // Real-time music soundwaves bending spacetime!
        // Bass causes large slow waves, while Treble causes high-frequency jitters
        if (musicAmpVal > 0.01) {
          if (musicBands.bass > 0.02) {
            const bassWaveFreq = 0.045;
            const bassWaveSpeed = 0.12;
            const bassWaveAmp = musicBands.bass * 22.0; // deep sub-bass warping
            floatX += Math.sin(time * bassWaveSpeed + p.y * bassWaveFreq + i * 0.01) * bassWaveAmp;
            floatY += Math.cos(time * bassWaveSpeed * 0.9 + p.x * bassWaveFreq + i * 0.01) * bassWaveAmp;
          }
          if (musicBands.treble > 0.03) {
            const trebleJitter = musicBands.treble * 5.0;
            floatX += Math.sin(time * 0.45 + i * 0.2) * trebleJitter;
            floatY += Math.cos(time * 0.42 + i * 0.2) * trebleJitter;
          }
        }
        const floatZ = Math.sin(time * floatSpeed * 0.7 + i * 0.04) * 8;
        p.z += (floatZ - p.z) * 0.05;

        const selfMovementX = isTypographyMode
          ? 0
          : Math.sin(time * 0.045 + i * 0.17) * 0.95;
        const selfMovementY = isTypographyMode
          ? 0
          : Math.cos(time * 0.045 + i * 0.23) * 0.95;
        let drawX = p.x + floatX + selfMovementX;
        let drawY = p.y + floatY + selfMovementY;

        // Apply General Relativistic Gravitational Lensing (Einstein Deflection / Einstein Ring)
        activeBlackholes.forEach((entity) => {
          const ldx = drawX - entity.x;
          const ldy = drawY - entity.y;
          const ldist = Math.sqrt(ldx * ldx + ldy * ldy) || 1;
          
          const horizon = entity.radius;
          const lenseRadius = horizon * 1.35; // Einstein Ring radius
          
          if (ldist > horizon * 0.95) {
            // Relativistic light path bending deflects Apparent position outwards
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

        const mdx = mouseRef.current.x - drawX;
        const mdy = mouseRef.current.y - drawY;
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

          if (mForce > 0.6 && Math.random() > 0.993) {
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

        let supernovaColorOverride: string | null = null;
        if (activeSupernova) {
          const snX = activeSupernova.x;
          const snY = activeSupernova.y;
          const sidx = drawX - snX;
          const sidy = drawY - snY;
          const sidistSq = sidx * sidx + sidy * sidy;
          if (sidistSq < 160000) {
            const sidist = Math.sqrt(sidistSq);
            const snFactor = (400 - sidist) / 400;

            if (snElapsed >= 1200 && snElapsed < 2200) {
              const progress = (snElapsed - 1200) / 1000;
              if (snFactor > 0.4 && i % 3 === 0) {
                supernovaColorOverride = "rgba(255, 120, 50, 1)";
              }
            } else if (snElapsed >= 2200 && snElapsed < 3200) {
              const progress = (snElapsed - 2200) / 1000;
              const expFactor = Math.max(0, 1 - progress);
              if (snFactor > 0.2) {
                supernovaColorOverride = "rgba(255, 255, 255, 1)";
              }
            }
          }
        }

        // Calculate gravitational Z-bend potential-well depth for particle
        let particleGravityZ = 0;
        celestialEntitiesRef.current.forEach((entity) => {
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

        // Enhanced parallax offset based on depth (p.z) and mouse cursor
        const mouseNormX = (mouseRef.current.x - currentW / 2) / (currentW / 2 || 1);
        const mouseNormY = (mouseRef.current.y - currentH / 2) / (currentH / 2 || 1);
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

        // Map points to positions
        positions[i * 3] = finalX;
        positions[i * 3 + 1] = finalY;
        positions[i * 3 + 2] = finalZ;

        // Map colors
        let r = p.r ?? 255;
        let g = p.g ?? 255;
        let b = p.b ?? 255;

        if (supernovaColorOverride) {
          if (supernovaColorOverride === "rgba(255, 120, 50, 1)") {
            r = 255;
            g = 120;
            b = 50;
          } else {
            r = 255;
            g = 255;
            b = 255;
          }
        }

        // Apply global visual fading & chromatic aberrations on color arrays
        let rFactor = 1.0;
        let gFactor = 1.0;
        let bFactor = 1.0;

        if (activeSupernova && !activeSupernova.isCalmShift && snElapsed > 0) {
          const snX = activeSupernova.x;
          const snY = activeSupernova.y;
          const dist = Math.sqrt((drawX - snX) * (drawX - snX) + (drawY - snY) * (drawY - snY));
          
          // Entangle colors/light/wavelengths with shockwaves
          const shock = Math.sin((snElapsed / 100) - (dist / 80)) * Math.max(0, 1 - (snElapsed / 3000)) * 0.1;
          if (i % 3 === 0) {
            rFactor = 1.0 + shock * 2.5;
            bFactor = 1.0 - shock * 0.8;
          } else if (i % 3 === 1) {
            gFactor = 1.0 + shock * 2.5;
            rFactor = 1.0 - shock * 0.8;
          } else {
            bFactor = 1.0 + shock * 2.5;
            gFactor = 1.0 - shock * 0.8;
          }
        }

         let textAlphaDimmer = 1.0;
        if (p.isProjectText) {
          textAlphaDimmer = 1.0 - (screensaverOpacityRef.current * 0.72);
        }

        // Dynamic frequency-band specific color shifts (subtle and smooth)
        let audioColorR = 1.0;
        let audioColorG = 1.0;
        let audioColorB = 1.0;
        if (musicAmpVal > 0.01) {
          audioColorR += musicBands.bass * 0.05;
          audioColorG += musicBands.mid * 0.04;
          audioColorB += musicBands.treble * 0.05;
        }

        // Relativistic Doppler beaming and Gravitational redshift (astrophysical realism)
        let dopplerR = 1.0;
        let dopplerG = 1.0;
        let dopplerB = 1.0;
        let dopplerIntensity = 1.0;

        if (isInterstellarRef.current && p.interstellarType === "blackhole" && p.orbitAngle !== undefined) {
          // Relativistic Doppler Beaming:
          // Approximate the line-of-sight velocity using the orbital angle's tangent component.
          // Particles traveling towards the observer are blueshifted (hotter, bluer, brighter);
          // particles traveling away are redshifted (cooler, redder, dimmer).
          const velLineOfSight = -Math.sin(p.orbitAngle); // radial velocity projection

          if (velLineOfSight > 0) {
            // Blueshift (approaching): brighter, bluer
            const factor = velLineOfSight * 0.42;
            dopplerR = 1.0 - factor * 0.2;
            dopplerG = 1.0 + factor * 0.1;
            dopplerB = 1.0 + factor * 0.65;
            dopplerIntensity = 1.0 + factor * 0.8;
          } else {
            // Redshift (receding): dimmer, redder
            const factor = -velLineOfSight * 0.42;
            dopplerR = 1.0 + factor * 0.55;
            dopplerG = 1.0 - factor * 0.15;
            dopplerB = 1.0 - factor * 0.4;
            dopplerIntensity = Math.max(0.35, 1.0 - factor * 0.65);
          }

          // Gravitational Redshift (General Relativity Schwarzschild metric approximation):
          // As stardust particles approach the Event Horizon (radius ~35), wavelengths stretch relativistically,
          // causing them to shift towards deep red and fade out completely as they cross the photon sphere.
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

        const filters = particleFiltersRef.current;
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

        if (!visibleByFilter) {
          colors[i * 4] = 0;
          colors[i * 4 + 1] = 0;
          colors[i * 4 + 2] = 0;
          colors[i * 4 + 3] = 0;
        } else {
          colors[i * 4] = Math.min(1.0, Math.max(0.0, (r / 255) * globalAlpha * rFactor * audioColorR * particleBrightness * textAlphaDimmer * dopplerR * dopplerIntensity));
          colors[i * 4 + 1] = Math.min(1.0, Math.max(0.0, (g / 255) * globalAlpha * gFactor * audioColorG * particleBrightness * textAlphaDimmer * dopplerG * dopplerIntensity));
          colors[i * 4 + 2] = Math.min(1.0, Math.max(0.0, (b / 255) * globalAlpha * bFactor * audioColorB * particleBrightness * textAlphaDimmer * dopplerB * dopplerIntensity));
          colors[i * 4 + 3] = globalAlpha * textAlphaDimmer;
        }
        extras[i] = p.isTail ? 2.0 : (p.interstellarType === "background_galaxy" ? 3.0 : (!p.isCosmicAmbient ? 1.0 : 0.0));
      }

      if (pointsMeshRef.current) {
        pointsMeshRef.current.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
        pointsMeshRef.current.updateVerticesData(BABYLON.VertexBuffer.ColorKind, colors);
        pointsMeshRef.current.updateVerticesData("extraData", extras);
      }

      ripplesRef.current.forEach((r) => (r.life -= 0.02));
      ripplesRef.current = ripplesRef.current.filter((r) => r.life > 0);

      // Update collision flare overlays
      if (collisionFlaresRef.current.length > 0) {
        const remainingFlares: typeof collisionFlaresRef.current = [];
        const objSpeedMult = (objectParticleSpeedRef.current ?? 0.15) / 0.15;
        collisionFlaresRef.current.forEach((flare) => {
          flare.life -= 0.045 * objSpeedMult;
          if (flare.life > 0) {
            const progress = 1.0 - flare.life;
            const s = 1.0 + progress * 3.2;
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
        collisionFlaresRef.current = remainingFlares;
      }

      // Calculate dynamic camera shake based on collision impact shockwaves
      cameraShakeRef.current *= 0.88;
      if (cameraShakeRef.current < 0.01) cameraShakeRef.current = 0;

      const shakeVal = cameraShakeRef.current;
      const shakeX = shakeVal > 0 ? (Math.sin(now * 0.08) * 0.6 + (Math.random() - 0.5) * 0.4) * shakeVal : 0;
      const shakeY = shakeVal > 0 ? (Math.cos(now * 0.09) * 0.6 + (Math.random() - 0.5) * 0.4) * shakeVal : 0;
      const shakeZ = shakeVal > 0 ? (Math.sin(now * 0.07) * 0.5) * shakeVal : 0;

      // 1. Continuous mathematical interpolation of all unified input variables
      const inputs = inputControllerRef.current;
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

      // Gentle 3D camera mouse/gyro tilt or smooth cinematic 3D orbiting
      const cameraZ = Math.max(10.0, currentH / (2 * Math.tan((fovRef.current * Math.PI) / 360))) * 2.5; // Update multiplier here too
      
      // Calculate baseline target coordinates including parallax and scroll Z depth offset
      let finalTargetX = inputs.currentCameraParallaxX;
      let finalTargetY = inputs.currentCameraParallaxY;
      let finalTargetZ = -cameraZ + inputs.currentCameraZDepthOffset;

      if (isInterstellarRef.current) {
        // High-fidelity 3D orbital flyby path for cinematic 360-degree showcase
        const orbitAngle = time * 0.0022; // smooth 360 rotation speed
        const pitchAngle = Math.sin(time * 0.0006) * 0.28 + 0.18; // vertical slow-wave tilt
        
        // Intelligent Zooming: Calculate the maximum spread of active celestial entities
        let maxSpread = 50; // Minimum fallback
        if (celestialEntitiesRef.current && celestialEntitiesRef.current.length > 0) {
          let maxDistSq = 0;
          celestialEntitiesRef.current.forEach(entity => {
            if (!entity.isDestroyed) {
              const wx = entity.x - currentW / 2;
              const wy = -(entity.y - currentH / 2);
              const wz = entity.z || 0;
              // include radius in the distance
              const dist = Math.sqrt(wx*wx + wy*wy + wz*wz) + entity.radius * 2;
              if (dist * dist > maxDistSq) {
                maxDistSq = dist * dist;
              }
            }
          });
          if (maxDistSq > 0) {
             maxSpread = Math.sqrt(maxDistSq);
          }
        }
        
        // Dynamically adjust radius based on spread, ensuring we stay close enough to see events but far enough to see everything
        const dynamicRadius = Math.max(cameraZ * 0.5, maxSpread * 1.25) + cameraZ * Math.sin(time * 0.0012) * 0.15;
        const currentRadius = dynamicRadius;

        // 3D spherical coordinates relative to center (0,0,0)
        const ox = currentRadius * Math.sin(orbitAngle) * Math.cos(pitchAngle);
        const oy = currentRadius * Math.sin(pitchAngle);
        const oz = currentRadius * Math.cos(orbitAngle) * Math.cos(pitchAngle);

        finalTargetX = ox + inputs.currentCameraParallaxX;
        finalTargetY = oy + inputs.currentCameraParallaxY;
        finalTargetZ = oz + inputs.currentCameraZDepthOffset;
      }

      // Smooth cinematic orbital sweep in screensaver mode
      if (stageRef.current === 0 && screensaverOpacityRef.current > 0.01) {
        const ssTime = now * 0.00014;
        const orbitAngle = ssTime;
        const pitchAngle = Math.sin(ssTime * 0.6) * 0.14 + 0.06;
        
        let maxSpread = 50;
        if (celestialEntitiesRef.current && celestialEntitiesRef.current.length > 0) {
          let maxDistSq = 0;
          celestialEntitiesRef.current.forEach(entity => {
            if (!entity.isDestroyed) {
              const wx = entity.x - currentW / 2;
              const wy = -(entity.y - currentH / 2);
              const wz = entity.z || 0;
              const dist = Math.sqrt(wx*wx + wy*wy + wz*wz) + entity.radius * 2;
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

        finalTargetX = finalTargetX * (1 - screensaverOpacityRef.current) + ox * screensaverOpacityRef.current;
        finalTargetY = finalTargetY * (1 - screensaverOpacityRef.current) + oy * screensaverOpacityRef.current;
        finalTargetZ = finalTargetZ * (1 - screensaverOpacityRef.current) + oz * screensaverOpacityRef.current;
      }

      // Cinematic Fly-Through Transition and Smooth Camera Interpolation
      let isTransitioning = false;
      let transitionT = 0;
      const startPos = transitionStartPosRef.current;

      if (transitionActiveRef.current && startPos) {
        const duration = 2400; // 2.4 seconds of high-fidelity camera flyby
        const elapsed = now - transitionStartTimeRef.current;
        if (elapsed >= duration) {
          transitionActiveRef.current = false;
          transitionStartPosRef.current = null;
        } else {
          isTransitioning = true;
          const rawT = elapsed / duration;
          // Ease-in-out-quart for absolute continuity of start and end velocities
          transitionT = rawT < 0.5 ? 8 * rawT * rawT * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 4) / 2;
        }
      }

      if (!isTransitActiveRef.current) {
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

          camera.setTarget(new BABYLON.Vector3(lockX, lockY, lockZ));
          camera.rotation.z = 0;
        } else {
          camera.position.x += (finalTargetX - camera.position.x) * 0.04 + shakeX;
          camera.position.y += (finalTargetY - camera.position.y) * 0.04 + shakeY;
          camera.position.z += (finalTargetZ - camera.position.z) * 0.04 + shakeZ;

          const lockX = inputs.currentLock.x * inputs.currentLock.intensity;
          const lockY = inputs.currentLock.y * inputs.currentLock.intensity;
          const lockZ = inputs.currentLock.z * inputs.currentLock.intensity;

          camera.setTarget(new BABYLON.Vector3(lockX, lockY, lockZ));

          camera.rotation.x += inputs.currentCameraPitch;
          camera.rotation.y += inputs.currentCameraYaw;
          camera.rotation.z *= 0.95;
        }
      }

      if (pointsMaterialRef.current) {
        pointsMaterialRef.current.setFloat("electricPulse", 0.0);
      }

      if (composerRef.current) {
        composerRef.current.bloomWeight = Math.min(0.45, 0.03 + (shakeVal / 30.0) * 0.35);
      }
    };

    engine.runRenderLoop(() => {
      render();
      scene.render();
    });

    let resizeTimeout: ReturnType<typeof setTimeout>;
    let lastWidth = window.innerWidth;
    let lastHeight = window.innerHeight;

    const handleResize = () => {
      const ww = window.innerWidth;
      const wh = window.innerHeight;

      if (rendererRef.current) {
        rendererRef.current.resize();
      }

      if (hudPlaneRef.current && cameraRef.current) {
        const planeZ = -60;
        const cameraZ = Math.max(10.0, wh / (2 * Math.tan((fovRef.current * Math.PI) / 360))) * 2.5;
        // Camera is at -cameraZ. Distance to plane is cameraZ + planeZ
        const scaleFactor = (cameraZ + planeZ) / cameraZ;
        hudPlaneRef.current.scaling.set(scaleFactor, scaleFactor, 1);
        
        // Subtle parallax effect based on mouse position
        const parallaxIntensity = 0.03; 
        const offsetX = (mouseRef.current.x - ww / 2) * parallaxIntensity;
        const offsetY = -(mouseRef.current.y - wh / 2) * parallaxIntensity;
        hudPlaneRef.current.position.set(offsetX, offsetY, 0);
      }

      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (ww !== lastWidth || Math.abs(wh - lastHeight) > 120) {
          lastWidth = ww;
          lastHeight = wh;
          mapParticlesToStage(stageRef.current, false);
          updateHudTexture(stageRef.current);
        }
      }, 200);
    };

    const resetActivity = () => {
      lastUserActivityRef.current = Date.now();
      if (isScreensaverActiveRef.current) {
        isScreensaverActiveRef.current = false;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.lastMoved = Date.now();

      const currentW = window.innerWidth;
      const currentH = window.innerHeight;

      // Normalize cursor coords between -1.0 and 1.0
      const normX = (e.clientX - currentW / 2) / (currentW / 2 || 1);
      const normY = -(e.clientY - currentH / 2) / (currentH / 2 || 1);

      const inputs = inputControllerRef.current;
      if (!inputs.gyroActive) {
        inputs.targetCameraParallaxX = normX * 85.0;
        inputs.targetCameraParallaxY = normY * 85.0;
        inputs.targetCameraPitch = normY * 0.22; // max ~12 degrees pitch
        inputs.targetCameraYaw = normX * 0.22;   // max ~12 degrees yaw
      } else {
        inputs.targetCameraParallaxX = normX * 45.0;
        inputs.targetCameraParallaxY = normY * 45.0;
      }

      resetActivity();
    };

    const handleDeviceOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta !== null && e.gamma !== null) {
        const inputs = inputControllerRef.current;
        inputs.gyroActive = true;
        
        // Map tilt (beta front/back, gamma left/right) to exact same pitch/yaw variables
        // Center beta at 60 degrees (comfortable viewing angle)
        const targetPitch = Math.max(-0.45, Math.min(0.45, (e.beta - 60) * 0.012));
        const targetYaw = Math.max(-0.45, Math.min(0.45, e.gamma * 0.012));

        inputs.targetCameraPitch = targetPitch;
        inputs.targetCameraYaw = targetYaw;
      }
    };

    const requestGyroPermission = () => {
      const DOC = window.DeviceOrientationEvent as any;
      if (DOC && typeof DOC.requestPermission === "function") {
        DOC.requestPermission()
          .then((permissionState: string) => {
            if (permissionState === "granted") {
              window.addEventListener("deviceorientation", handleDeviceOrientation);
            }
          })
          .catch((err: any) => {
            console.warn("DeviceOrientation permission request failed:", err);
          });
      }
    };

    const handleClick = (e: MouseEvent) => {
      // Trigger permission on click for iOS deviceorientation support
      requestGyroPermission();

      ripplesRef.current.push({ x: e.clientX, y: e.clientY, life: 1.0 });

      // Compute Target Locks: Find closest celestial body near click coordinates
      const currentW = window.innerWidth;
      const currentH = window.innerHeight;
      const clickX = e.clientX;
      const clickY = e.clientY;

      let nearestEntity: CelestialEntity | null = null;
      let minDistance = 160; // target threshold in pixels
      
      celestialEntitiesRef.current.forEach((entity) => {
        if (entity.isDestroyed) return;
        const dist = Math.sqrt((entity.x - clickX) * (entity.x - clickX) + (entity.y - clickY) * (entity.y - clickY));
        if (dist < minDistance) {
          minDistance = dist;
          nearestEntity = entity;
        }
      });

      const inputs = inputControllerRef.current;
      if (nearestEntity) {
        const wx = (nearestEntity as CelestialEntity).x - currentW / 2;
        const wy = -((nearestEntity as CelestialEntity).y - currentH / 2);
        const wz = (nearestEntity as CelestialEntity).z || 0;
        
        inputs.targetLock = {
          x: wx,
          y: wy,
          z: wz,
          active: true,
          entityId: (nearestEntity as CelestialEntity).id || "unknown"
        };
      } else {
        inputs.targetLock = {
          x: 0,
          y: 0,
          z: 0,
          active: false,
          entityId: null
        };
      }

      // Trigger a click-activated supernova on click in interstellar mode!
      if (isInterstellarRef.current && !supernovaRef.current) {
        // Smoothly fade out all current entities by setting them as destroyed
        celestialEntitiesRef.current.forEach((entity) => {
          entity.isDestroyed = true;
        });

        const currentW = window.innerWidth;
        const currentH = window.innerHeight;

        let worldPos = new BABYLON.Vector3(e.clientX - currentW / 2, -(e.clientY - currentH / 2), 0);
        if (sceneRef.current && cameraRef.current) {
          const ray = sceneRef.current.createPickingRay(e.clientX, e.clientY, BABYLON.Matrix.Identity(), cameraRef.current);
          if (ray && Math.abs(ray.direction.z) > 0.0001) {
            const distance = -ray.origin.z / ray.direction.z;
            worldPos = ray.origin.add(ray.direction.scale(distance));
          }
        }

        if (sceneRef.current) {
          if (activeSupernovaFxRef.current) {
            activeSupernovaFxRef.current.dispose();
          }
          activeSupernovaFxRef.current = spawnSupernovaFX(sceneRef.current, worldPos);
        }

        cameraShakeRef.current = 35.0; // High-impact camera shake spike

        supernovaRef.current = {
          time: Date.now(),
          exploded: true,
          isCalmShift: false,
          x: e.clientX,
          y: e.clientY,
          worldPos: worldPos,
        };
        console.log("[DEBUG] Click triggered supernova special effects at x:", supernovaRef.current.x, "y:", supernovaRef.current.y);
        audio.playRippleShockwave();
        fetchNextGeminiScene();
      }
      resetActivity();
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches && e.touches[0]) {
        const touch = e.touches[0];
        const simulatedClick = {
          clientX: touch.clientX,
          clientY: touch.clientY,
        } as MouseEvent;
        handleClick(simulatedClick);
      }
    };

    const handleScrollPhysics = () => {
      const currentScrollY =
        window.scrollY || document.documentElement.scrollTop;
      const delta = currentScrollY - lastScrollYRef.current;
      scrollVelocityRef.current += delta * 0.08;
      lastScrollYRef.current = currentScrollY;

      // Progress overarching scene timeline and camera Z depth
      const maxScroll = (document.documentElement.scrollHeight - window.innerHeight) || 1200;
      const inputs = inputControllerRef.current;
      inputs.targetScrollTimeline = currentScrollY / maxScroll;
      inputs.targetCameraZDepthOffset = (currentScrollY / maxScroll) * -600.0; // zoom out rather than in

      resetActivity();
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("click", handleClick);
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("scroll", handleScrollPhysics, { passive: true });

    // Register gyroscope directly if no special permission API exists
    const DOC = window.DeviceOrientationEvent as any;
    if (!DOC || typeof DOC.requestPermission !== "function") {
      window.addEventListener("deviceorientation", handleDeviceOrientation);
    }

    // --- WORMHOLE TRANSIT LOGIC ---
    let tunnelMesh: BABYLON.Mesh | null = null;
    let tunnelMaterial: BABYLON.ShaderMaterial | null = null;
    let flyingObjects: BABYLON.Mesh[] = [];
    let pbrPlanets: BABYLON.Mesh[] = [];
    let transitStartTime = 0;
    let transitObserver: BABYLON.Observer<BABYLON.Scene> | null = null;

    const startWormholeTransit = async (targetPos?: BABYLON.Vector3, viewDir?: BABYLON.Vector3) => {
      console.log("[DEBUG] startWormholeTransit triggered!");
      if (isTransitActiveRef.current) return;

      const engine = rendererRef.current;
      const camera = cameraRef.current;
      const scene = sceneRef.current;
      if (!scene || scene.isDisposed || !camera || !engine) return;

      isTransitActiveRef.current = true;
      transitStartTime = Date.now();
      transitStartTimeRef.current = transitStartTime;
      transitTargetPosRef.current = targetPos || null;
      transitDirRef.current = viewDir || null;

      try {
        // Guarantee wormhole post-process exists
        if (!wormholePostProcessRef.current && camera) {
          BABYLON.Effect.ShadersStore["wormholePixelShader"] = `
            precision highp float;
            varying vec2 vUV;
            uniform sampler2D textureSampler;
            uniform float time;
            uniform float intensity;

            float hash(vec2 p) { return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); }

            void main(void) {
              if (intensity <= 0.0) {
                gl_FragColor = texture2D(textureSampler, vUV);
                return;
              }
              vec2 uv = vUV;
              vec2 center = vec2(0.5);
              vec2 dir = center - uv;
              float dist = length(dir);

              float pull = (1.0 - smoothstep(0.0, 0.5, dist)) * intensity * 1.5;
              float angle = pull * time * 2.0;
              float s = sin(angle);
              float c = cos(angle);
              mat2 rot = mat2(c, -s, s, c);

              vec2 swirledUV = center + rot * (uv - center) * (1.0 - pull * 0.3);

              if (dist > 0.0001) {
                dir = dir / dist;
              } else {
                dir = vec2(0.0);
              }

              float blurAmount = min(time * 0.015, 0.05) * intensity + pull * 0.04;
              vec4 sum = vec4(0.0);
              float samples = 8.0;
              for (float i = 0.0; i < 8.0; i++) {
                sum += texture2D(textureSampler, swirledUV + dir * (i / samples) * blurAmount);
              }
              sum /= samples;

              vec3 eventHorizonGlow = vec3(0.1, 0.5, 1.0) * pow(pull, 3.0) * 1.5;
              vec4 finalColor = mix(texture2D(textureSampler, uv), sum, intensity);
              finalColor.rgb += eventHorizonGlow;

              gl_FragColor = finalColor;
            }
          `;

          const wormholePP = new BABYLON.PostProcess("WormholePP", "wormhole", ["time", "intensity"], null, 1.0, camera);
          wormholePP.onApply = (effect) => {
            wormholeTimeRef.current += 0.016;
            effect.setFloat("time", wormholeTimeRef.current);
            effect.setFloat("intensity", wormholeIntensityRef.current);
          };
          wormholePostProcessRef.current = wormholePP;
        }

        wormholeTimeRef.current = 0.0;
        wormholeIntensityRef.current = 1.0;

        // Animate FOV gently
        BABYLON.Animation.CreateAndStartAnimation("fovAnim", camera, "fov", 60, 60, camera.fov, 1.6, 0, new BABYLON.QuadraticEase());

        const origCameraPos = camera.position.clone();
        const dir = viewDir ? viewDir.normalize() : new BABYLON.Vector3(0, 0, 1);
        const lookAtPoint = origCameraPos.add(dir.scale(2000));
        camera.setTarget(lookAtPoint);

        const flyDestination = targetPos || origCameraPos.add(dir.scale(1200));
        const easeInOut = new BABYLON.CubicEase();
        easeInOut.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);
        BABYLON.Animation.CreateAndStartAnimation("camTransitAnim", camera, "position", 60, 180, origCameraPos, flyDestination, 0, easeInOut);

        // Generate Transit Tunnel
        const path = [];
        const dirForPath = viewDir ? viewDir.normalize() : new BABYLON.Vector3(0, 0, 1);
        for (let i = 0; i < 60; i++) {
          path.push(origCameraPos.add(dirForPath.scale(400 + i * 45)));
        }
        tunnelMesh = BABYLON.MeshBuilder.CreateTube("wormhole_tunnel", { path: path, radius: 35, sideOrientation: BABYLON.Mesh.BACKSIDE }, scene);
        tunnelMesh.metadata = { dir: dirForPath };

        // Entrance mouth portal mesh
        const tunnelStartPos = origCameraPos.add(dirForPath.scale(400));
        const mouthMesh = BABYLON.MeshBuilder.CreateTorus("wormhole_mouth", { diameter: 72, thickness: 3.5, tessellation: 64 }, scene);
        mouthMesh.position = tunnelStartPos;
        mouthMesh.lookAt(origCameraPos);
        const mouthMat = new BABYLON.PBRMaterial("mouthMat", scene);
        mouthMat.emissiveColor = new BABYLON.Color3(0.0, 0.9, 1.0);
        mouthMat.albedoColor = new BABYLON.Color3(0.05, 0.0, 0.2);
        mouthMat.metallic = 0.9;
        mouthMat.roughness = 0.1;
        mouthMesh.material = mouthMat;
        flyingObjects.push(mouthMesh);

        // Vortex disc mesh
        const vortexDisc = BABYLON.MeshBuilder.CreateDisc("vortex_disc", { radius: 35, tessellation: 64 }, scene);
        vortexDisc.position = tunnelStartPos.add(dirForPath.scale(0.5));
        vortexDisc.lookAt(origCameraPos);

        const vortexMaterial = new BABYLON.StandardMaterial("vortexMat", scene);
        const vTex = generateAccretionDiskTexture("#00ccff", "#9900ff", scene);
        vortexMaterial.diffuseTexture = vTex;
        vortexMaterial.emissiveTexture = vTex;
        vortexMaterial.opacityTexture = vTex;
        vortexMaterial.disableLighting = true;
        vortexMaterial.backFaceCulling = false;
        vortexMaterial.alphaMode = BABYLON.Engine.ALPHA_ADD;
        vortexDisc.material = vortexMaterial;
        flyingObjects.push(vortexDisc);

        const tunnelMat = new BABYLON.StandardMaterial("tunnelMat", scene);
        const tTex = generateDistortedLightwaveTexture("#0088ff", scene);
        tunnelMat.diffuseTexture = tTex;
        tunnelMat.emissiveTexture = tTex;
        tunnelMat.opacityTexture = tTex;
        tunnelMat.disableLighting = true;
        tunnelMat.backFaceCulling = false;
        tunnelMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
        tunnelMat.alpha = 0.55;
        tunnelMesh.material = tunnelMat;

        // Abstract geometries
        const dirForObjs = viewDir ? viewDir.normalize() : new BABYLON.Vector3(0, 0, 1);
        for (let i = 0; i < 20; i++) {
          let mesh = i % 2 === 0 ? BABYLON.MeshBuilder.CreateTorusKnot("tk" + i, {radius: 2, tube: 0.5}, scene) : BABYLON.MeshBuilder.CreatePolyhedron("ph" + i, {type: 2, size: 3}, scene);
          const forwardOffset = Math.random() * 1000 + 100;
          const radialOffset = new BABYLON.Vector3((Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, 0);
          mesh.position = origCameraPos.add(dirForObjs.scale(forwardOffset)).add(radialOffset);

          let mat = new BABYLON.StandardMaterial("std" + i, scene);
          mat.emissiveColor = new BABYLON.Color3(Math.random(), Math.random(), Math.random());
          mat.wireframe = true;
          mesh.material = mat;
          flyingObjects.push(mesh);
        }

        // Attach transit animation observer for the duration of transit
        if (transitObserver) {
          scene.onBeforeRenderObservable.remove(transitObserver);
          transitObserver = null;
        }

        transitObserver = scene.onBeforeRenderObservable.add(() => {
          if (isTransitActiveRef.current) {
            const elapsedSeconds = (Date.now() - transitStartTime) * 0.001;
            if (tunnelMaterial && typeof (tunnelMaterial as any).setFloat === "function") {
              (tunnelMaterial as any).setFloat("time", elapsedSeconds * 5.0);
            }

            const vortex = scene.getMeshByName("vortex_disc");
            if (vortex && vortex.material && typeof (vortex.material as any).setFloat === "function") {
              (vortex.material as any).setFloat("time", elapsedSeconds);
            }

            const moveDir = tunnelMesh && tunnelMesh.metadata && tunnelMesh.metadata.dir ? tunnelMesh.metadata.dir : new BABYLON.Vector3(0, 0, 1);
            flyingObjects.forEach(m => {
              if (m && !m.isDisposed) {
                m.position.subtractInPlace(moveDir.scale(5));
                m.rotation.x += 0.05;
                m.rotation.y += 0.05;
                if (camera && BABYLON.Vector3.Distance(m.position, camera.position) < 50) {
                  m.position.addInPlace(moveDir.scale(1000));
                }
              }
            });
          }
        });

        // Completion timeout after 3 seconds
        setTimeout(() => {
          try {
            if (!scene || scene.isDisposed) return;

            if (transitObserver) {
              scene.onBeforeRenderObservable.remove(transitObserver);
              transitObserver = null;
            }

            scene.stopAnimation(camera);
            camera.animations = [];

            // Restore camera FOV and reset camera directly to standard framing position facing target Zero
            const cameraZ = cameraZRef.current;
            camera.fov = (fovRef.current * Math.PI) / 180 || 1.0;
            camera.position.set(0, 0, -cameraZ);
            camera.setTarget(BABYLON.Vector3.Zero());

            wormholeIntensityRef.current = 0.0;

            if (tunnelMesh) {
              tunnelMesh.dispose();
              tunnelMesh = null;
            }
            if (tunnelMaterial) {
              tunnelMaterial.dispose();
              tunnelMaterial = null;
            }
            flyingObjects.forEach(m => {
              if (m) {
                if (m.material) m.material.dispose();
                m.dispose();
              }
            });
            flyingObjects = [];

            const ww = window.innerWidth;
            const wh = window.innerHeight;

            isInterstellarRef.current = true;

            const geminiData = nextGeminiSceneRef.current;
            if (geminiData) {
              nextGeminiSceneRef.current = geminiData;
            }
            generateInterstellarScene(ww, wh, true);
            mapParticlesToInterstellar(ww, wh);

            isTransitActiveRef.current = false;

            if (animationComplete) {
              animationComplete();
            }
          } catch (e) {
            console.error("[DEBUG] Error inside transit setTimeout:", e);
            wormholeIntensityRef.current = 0.0;
            isTransitActiveRef.current = false;
          }
        }, 3000);

      } catch (err) {
        console.error("[DEBUG] Error starting wormhole transit:", err);
        wormholeIntensityRef.current = 0.0;
        isTransitActiveRef.current = false;
      }
    };

    const triggerPlanetaryFlyby = (targetNode: any) => {
        if (!camera || isTransitActiveRef.current) return;
        isTransitActiveRef.current = true;
        const targetPos = targetNode.getAbsolutePosition().clone();
        const offset = new BABYLON.Vector3(250, 150, 350);
        const flyToPos = targetPos.add(offset);

        BABYLON.Animation.CreateAndStartAnimation("camFly", camera, "position", 60, 120, camera.position, flyToPos, 0, new BABYLON.CubicEase(), () => {
            isTransitActiveRef.current = false;
        });
        BABYLON.Animation.CreateAndStartAnimation("camTarget", camera, "target", 60, 120, camera.getTarget(), targetPos, 0, new BABYLON.CubicEase());
    };

    scene.onPointerObservable.add((pointerInfo) => {
        if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
            console.log("[DEBUG] scene.onPointerObservable POINTERDOWN triggered type:", pointerInfo.type);
        }
        if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
            const pickResult = pointerInfo.pickInfo;
            if (pickResult && pickResult.hit && pickResult.pickedMesh) {
                const meshName = pickResult.pickedMesh.name;
                const parentNode = pickResult.pickedMesh.parent;
                if (meshName !== "hudPlane") {
                    if (parentNode && (parentNode.name === "planet_group" || parentNode.name === "bh_group" || parentNode.name === "nebula_group" || parentNode.name === "galaxy_group" || parentNode.name === "star_group")) {
                        triggerPlanetaryFlyby(parentNode);
                        return;
                    }
                    if (meshName.startsWith("planet_") || meshName === "ring_mesh" || meshName === "atmosphere_glow" || meshName.startsWith("event_horizon_") || meshName.startsWith("star_")) {
                        triggerPlanetaryFlyby(pickResult.pickedMesh);
                        return;
                    }
                }
            }
            if (!isInterstellarRef.current) {
                if (camera) {
                    const ray = scene.createPickingRay(scene.pointerX, scene.pointerY, BABYLON.Matrix.Identity(), camera);
                    const targetPoint = ray.origin.add(ray.direction.scale(1500));
                    startWormholeTransit(targetPoint, ray.direction);
                } else {
                    startWormholeTransit();
                }
            }
        }
    });

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleClick);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("scroll", handleScrollPhysics);
      window.removeEventListener("deviceorientation", handleDeviceOrientation);
      delete (window as any).activateSequence;

      if (lensingPostProcessRef.current) {
        lensingPostProcessRef.current.dispose();
      }

      if (wormholePostProcessRef.current) {
        wormholePostProcessRef.current.dispose();
      }

      if (activeSupernovaFxRef.current) {
        activeSupernovaFxRef.current.dispose();
        activeSupernovaFxRef.current = null;
      }

      if (rendererRef.current) {
        rendererRef.current.stopRenderLoop();
        rendererRef.current.dispose();
      }
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
