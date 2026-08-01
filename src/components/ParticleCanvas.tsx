import React, { useEffect, useRef } from "react";
import * as BABYLON from "@babylonjs/core";
import { audio } from "../utils/audio";
import { Particle, projects } from "../types";
import { drawStageLayoutTemplate, generateTargetsForStage } from "./ParticleCanvas/ParticleUtils";
import { CelestialEntity, ParticleCanvasProps } from "./ParticleCanvas/types";
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

import { initializeScene } from "./ParticleCanvas/SceneSetup";
import {
  createCircleTexture,
  generateAdvancedPlanetTexture,
  generateConcentricRingTexture,
  generateDistortedLightwaveTexture,
  createCircularGlowTexture,
  parseColorToRgb,
  generateGalaxyTexture,
  generateNebulaTexture,
} from "./ParticleCanvas/TextureUtils";

export const ParticleCanvas: React.FC<ParticleCanvasProps> = ({
  stage,
  isInterstellar = false,
  animationComplete,
  onSequenceGenerated,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
  const lastStageChangeRef = useRef<number>(Date.now());
  const mouseRef = useRef({ x: -1000, y: -1000, lastMoved: Date.now() });
  const lastAutonomousEventTimeRef = useRef<number>(Date.now());
  const activeWormholeRef = useRef<{ startEntityIdx: number; endEntityIdx: number; life: number; duration: number } | null>(null);
  const supernovaRef = useRef<{
    time: number;
    exploded: boolean;
    transitioned?: boolean;
    isCalmShift?: boolean;
    x: number;
    y: number;
  } | null>(null);
  const ripplesRef = useRef<{ x: number; y: number; life: number }[]>([]);
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

    if (stageRef.current === 0 && !isInterstellarRef.current && !forceInterstellar) {
      // Seed a stunning, high-fidelity field of galaxies and nebulae specifically designed for the "CURTIS CLICK" screensaver scene!
      archetypeRef.current = "GALAXY_FIELD";
      const systemName = "Andromeda Gateway";
      const systemDesc = "A peaceful screensaver view. Move your cursor to bend spacetime, or wait for the galactic singularity shockwave to trigger beautiful dynamic interference loops.";
      const systemTags = ["★ GALAXY FIELD", "🪐 SCREENSAVER", "⚡ SHOCKWAVE"];

      const cx = width / 2;
      const cy = height / 2;

      // 1. Core primary spiral galaxy
      entities.push({
        type: "galaxy",
        x: cx - (isMobile ? 30 : 120),
        y: cy + (isMobile ? 40 : 80),
        radius: isMobile ? 80 : 140,
        color: "#ffddbb", // Warm galactic core (stellar bulge)
        secondaryColor: "#88bbff", // Blue younger stars in spiral arms
        orbitSpeed: 0.0006,
        orbitRadius: 0,
        orbitAngle: 0,
        centerX: cx,
        centerY: cy,
        vx: 0,
        vy: 0,
        mass: 12000,
        initialMass: 12000,
        scale: 0.8,
        currentRadius: isMobile ? 80 : 140,
        originalRadius: isMobile ? 80 : 140,
        targetRadius: isMobile ? 80 : 140,
        isPhysicsEnabled: false,
        isDestroyed: false,
      });

      // 2. Companion spiral galaxy
      entities.push({
        type: "galaxy",
        x: cx + (isMobile ? 80 : 260),
        y: cy - (isMobile ? 120 : 160),
        radius: isMobile ? 55 : 90,
        color: "#ffeedd", // White-yellow older stars
        secondaryColor: "#aaccff", // Pale blue outer regions
        orbitSpeed: -0.0008,
        orbitRadius: 0,
        orbitAngle: 0,
        centerX: cx,
        centerY: cy,
        vx: 0,
        vy: 0,
        mass: 6000,
        initialMass: 6000,
        scale: 0.7,
        currentRadius: isMobile ? 55 : 90,
        originalRadius: isMobile ? 55 : 90,
        targetRadius: isMobile ? 55 : 90,
        isPhysicsEnabled: false,
        isDestroyed: false,
      });

      // 3. Small dwarf star cluster / galaxy
      entities.push({
        type: "galaxy",
        x: cx - (isMobile ? 100 : 320),
        y: cy - (isMobile ? 100 : 180),
        radius: isMobile ? 40 : 60,
        color: "#ffccaa", // Red dwarf cluster
        secondaryColor: "#ff9955", // Cool orange stars
        orbitSpeed: 0.0004,
        orbitRadius: 0,
        orbitAngle: 0,
        centerX: cx,
        centerY: cy,
        vx: 0,
        vy: 0,
        mass: 3000,
        initialMass: 3000,
        scale: 0.6,
        currentRadius: isMobile ? 40 : 60,
        originalRadius: isMobile ? 40 : 60,
        targetRadius: isMobile ? 40 : 60,
        isPhysicsEnabled: false,
        isDestroyed: false,
      });

      // 4. Colorful background backdrop nebulae (gives volumetric depth)
      entities.push({
        type: "nebula",
        x: cx + 100,
        y: cy + 50,
        radius: isMobile ? 160 : 280,
        color: "#ff4466", // Hydrogen-alpha emission pink/red
        secondaryColor: "#4488ff", // Oxygen-III emission blue
        orbitSpeed: 0.0001,
        orbitRadius: 0,
        orbitAngle: 0,
        centerX: cx,
        centerY: cy,
        vx: 0,
        vy: 0,
        mass: 1,
        initialMass: 1,
        scale: 0.5,
        currentRadius: isMobile ? 160 : 280,
        originalRadius: isMobile ? 160 : 280,
        targetRadius: isMobile ? 160 : 280,
        isPhysicsEnabled: false,
        isDestroyed: false,
      });

      transitionToNewEntities(entities);
      interstellarSceneGeneratedTimeRef.current = Date.now();

      registerAndSaveSequence(systemName, systemDesc, systemTags, entities);
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
      if (a.isCosmicAmbient && !b.isCosmicAmbient) return -1;
      if (!a.isCosmicAmbient && b.isCosmicAmbient) return 1;
      return a.color.localeCompare(b.color);
    });
    syncParticleColors(particlesRef.current);
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
        if (a.isCosmicAmbient && !b.isCosmicAmbient) return -1;
        if (!a.isCosmicAmbient && b.isCosmicAmbient) return 1;
        return a.color.localeCompare(b.color);
      });
      syncParticleColors(particlesRef.current);
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

    // Proximity mouse gravity pull
    const mouseX = mouseRef.current.x;
    const mouseY = mouseRef.current.y;
    if (mouseX > 0 && mouseY > 0) {
      entities.forEach((entity) => {
        if (entity.isDestroyed || entity.type === "blackhole") return;
        const dx = mouseX - entity.x;
        const dy = mouseY - entity.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 220) {
          entity.isPhysicsEnabled = true;
          const pullForce = 0.08 * (1.0 - dist / 220);
          entity.vx = (entity.vx || 0) + (dx / dist) * pullForce;
          entity.vy = (entity.vy || 0) + (dy / dist) * pullForce;
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
          
          const isBothPlanets = e1.type === "planet" && e2.type === "planet";
          const colDist = e1.radius + e2.radius;
          const compressionZone = colDist * 2.8;

          if (isBothPlanets && dist < compressionZone) {
            // Unshackle both planets into full orbital physics decay
            e1.isPhysicsEnabled = true;
            e2.isPhysicsEnabled = true;

            const compressionFactor = (dist - colDist) / (compressionZone - colDist);
            const intensity = 1.0 - Math.max(0, Math.min(1, compressionFactor)); // 0.0 at edge, 1.0 at contact

            // 1. OPPOSING MAGNETIC FIELDS RESISTANCE (repulsion force)
            // Pushback grows stronger as they compress together, like magnet like-poles
            const repulsionForce = Math.pow(intensity, 2) * 1.5;
            e1.vx = (e1.vx || 0) - (dx / dist) * repulsionForce;
            e1.vy = (e1.vy || 0) - (dy / dist) * repulsionForce;
            e1.vz = (e1.vz || 0) - (dz / dist) * repulsionForce;
            e2.vx = (e2.vx || 0) + (dx / dist) * repulsionForce;
            e2.vy = (e2.vy || 0) + (dy / dist) * repulsionForce;
            e2.vz = (e2.vz || 0) + (dz / dist) * repulsionForce;

            // 2. VISCOUS KINETIC FRICTION on their mutual approach axis
            const relVx = e2.vx - e1.vx;
            const relVy = e2.vy - e1.vy;
            const relVz = (e2.vz || 0) - (e1.vz || 0);
            const approachSpeed = (relVx * dx + relVy * dy + relVz * dz) / dist; // approaching if negative
            if (approachSpeed < 0) {
              const viscosity = intensity * 0.45; // heavy electromagnetic resistance
              e1.vx += (dx / dist) * (-approachSpeed * viscosity);
              e1.vy += (dy / dist) * (-approachSpeed * viscosity);
              e1.vz += (dz / dist) * (-approachSpeed * viscosity);
              e2.vx -= (dx / dist) * (-approachSpeed * viscosity);
              e2.vy -= (dy / dist) * (-approachSpeed * viscosity);
              e2.vz -= (dz / dist) * (-approachSpeed * viscosity);
            }

            // 3. PHYSICAL RADIUS DEFORMATION / SQUISHING
            e1.targetRadius = e1.radius * (1.0 - intensity * 0.35);
            e2.targetRadius = e2.radius * (1.0 - intensity * 0.35);

            // 4. SPACETIME VIOLENT VIBRATION (extreme stress shaking)
            const shakeAmount = intensity * 4.5;
            e1.x += (Math.random() - 0.5) * shakeAmount;
            e1.y += (Math.random() - 0.5) * shakeAmount;
            e1.z = (e1.z || 0) + (Math.random() - 0.5) * shakeAmount;
            e2.x += (Math.random() - 0.5) * shakeAmount;
            e2.y += (Math.random() - 0.5) * shakeAmount;
            e2.z = (e2.z || 0) + (Math.random() - 0.5) * shakeAmount;

            // 5. ENERGETIC ELECTRICAL FRICTION SPARKS / SHOCKWAVES
            if (Math.random() < 0.45) {
              const midX = (e1.x + e2.x) / 2;
              const midY = (e1.y + e2.y) / 2;
              createDustSplash(midX, midY, "#ffffff", 2); // Pure white space-time tear sparks
              createDustSplash(midX, midY, e1.color, 1);
              createDustSplash(midX, midY, e2.color, 1);
            }

            if (Math.random() < 0.15) {
              const midX = (e1.x + e2.x) / 2;
              const midY = (e1.y + e2.y) / 2;
              ripplesRef.current.push({ x: midX, y: midY, life: 1.0 });
            }
          } else {
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
      }

      // Smooth coordinate velocity interpolation
      entities.forEach((entity) => {
        if (entity.isDestroyed) return;

        // Ensure Z variables are initialized
        entity.z = entity.z ?? 0;
        entity.vz = entity.vz ?? 0;
        if (entity.orbitInclination === undefined) {
          entity.orbitInclination = entity.type === "blackhole" ? 0 : (Math.random() - 0.5) * 0.38;
        }

        if (entity.isPhysicsEnabled) {
          // Space dust drag decays orbits into beautiful spiral accretion paths
          const drag = 0.994;
          entity.vx = (entity.vx || 0) * drag;
          entity.vy = (entity.vy || 0) * drag;
          entity.vz = (entity.vz || 0) * drag;

          entity.x += entity.vx;
          entity.y += entity.vy;
          entity.z += entity.vz;
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
              if (relVel > 12.0 || radiusRatio > 2.5) {
                if (e1.radius >= e2.radius) {
                  mergeEntities(e1, e2);
                } else {
                  mergeEntities(e2, e1);
                }
              } else {
                // Inelastic bounce with momentum conservation and heat dissipation
                const colResult = resolveCelestialCollision(e1, e2, 0.45);
                if (colResult) {
                  audio.playRippleShockwave();

                  const dissipatedEnergy = colResult.kineticEnergyDissipated;
                  const count = Math.min(150, Math.max(20, Math.floor(dissipatedEnergy * 0.15)));

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
                    life: 0.65,
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

          // 1. Accretion disk - Layer 1: Core fiery orange-yellow distorted waves
          const diskRadius = entity.radius * 3.6;
          const diskTex1 = generateDistortedLightwaveTexture("#ffa600", scene);
          const diskMat1 = new BABYLON.PBRMaterial("diskMat1", scene);
          diskMat1.albedoTexture = diskTex1;
          diskMat1.emissiveTexture = diskTex1;
          diskMat1.emissiveColor = new BABYLON.Color3(1, 1, 1);
          diskMat1.disableLighting = true;
          diskMat1.backFaceCulling = false;
          diskMat1.alphaMode = BABYLON.Engine.ALPHA_ONEONE;

          diskMat1.alpha = 0.95;

          const diskMesh1 = BABYLON.MeshBuilder.CreateTorus("accretion_layer_1", {
            diameter: diskRadius * 1.8,
            thickness: entity.radius * 0.22,
            tessellation: 64
          }, scene);
          diskMesh1.material = diskMat1;
          diskMesh1.rotation.x = Math.PI / 2.3;
          diskMesh1.parent = bhContainer;

          // Accretion disk - Layer 2: Opposing-spin golden wave warp (slightly tilted)
          const diskTex2 = generateDistortedLightwaveTexture("#ffdf00", scene);
          const diskMat2 = new BABYLON.PBRMaterial("diskMat2", scene);
          diskMat2.albedoTexture = diskTex2;
          diskMat2.emissiveTexture = diskTex2;
          diskMat2.emissiveColor = new BABYLON.Color3(1, 1, 1);
          diskMat2.disableLighting = true;
          diskMat2.backFaceCulling = false;
          diskMat2.alphaMode = BABYLON.Engine.ALPHA_ONEONE;

          diskMat2.alpha = 0.75;

          const diskMesh2 = BABYLON.MeshBuilder.CreateTorus("accretion_layer_2", {
            diameter: diskRadius * 1.6,
            thickness: entity.radius * 0.16,
            tessellation: 64
          }, scene);
          diskMesh2.material = diskMat2;
          diskMesh2.rotation.x = Math.PI / 2.45;
          diskMesh2.rotation.y = 0.12;
          diskMesh2.parent = bhContainer;

          // Accretion disk - Layer 3: Gravitational lensing ring (outer halo, near perpendicular view)
          const lensRadius = entity.radius * 4.6;
          const diskTex3 = generateDistortedLightwaveTexture("#ffffff", scene);
          const diskMat3 = new BABYLON.PBRMaterial("diskMat3", scene);
          diskMat3.albedoTexture = diskTex3;
          diskMat3.emissiveTexture = diskTex3;
          diskMat3.emissiveColor = new BABYLON.Color3(1, 1, 1);
          diskMat3.disableLighting = true;
          diskMat3.backFaceCulling = false;
          diskMat3.alphaMode = BABYLON.Engine.ALPHA_ONEONE;

          diskMat3.alpha = 0.45;

          const diskMesh3 = BABYLON.MeshBuilder.CreateTorus("gravitational_lensing", {
            diameter: lensRadius * 1.8,
            thickness: entity.radius * 0.12,
            tessellation: 64
          }, scene);
          diskMesh3.material = diskMat3;
          diskMesh3.rotation.x = Math.PI / 2.1;
          diskMesh3.rotation.y = -0.08;
          diskMesh3.parent = bhContainer;

          // 2. Event Horizon Shadow
          const ehMat = new BABYLON.PBRMaterial("ehMat", scene);
          ehMat.albedoColor = new BABYLON.Color3(0, 0, 0);
          ehMat.emissiveColor = new BABYLON.Color3(0, 0, 0);
          ehMat.disableLighting = true;

          const ehMesh = BABYLON.MeshBuilder.CreateSphere("event_horizon_core", {
            diameter: entity.radius * 1.02 * 2,
            segments: 32
          }, scene);
          ehMesh.material = ehMat;
          ehMesh.parent = bhContainer;

          // 2b. Event Horizon Glowing Corona (Einstein Ring / Photon Sphere lens aura)
          const coronaTex = createCircularGlowTexture(hexToRgba(entity.color, 0.95), scene);
          const coronaMat = new BABYLON.PBRMaterial("coronaMat", scene);
          coronaMat.albedoTexture = coronaTex;
          coronaMat.emissiveTexture = coronaTex;
          coronaMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
          coronaMat.disableLighting = true;
          coronaMat.backFaceCulling = false;
          coronaMat.alphaMode = BABYLON.Engine.ALPHA_ONEONE;

          coronaMat.alpha = 0.9;

          const coronaMesh = BABYLON.MeshBuilder.CreateSphere("event_horizon_corona", {
            diameter: entity.radius * 1.15 * 2,
            segments: 32
          }, scene);
          coronaMesh.material = coronaMat;
          coronaMesh.parent = bhContainer;

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

          // 1. Planet core sphere with PBR shadow-side bioluminescence
          const planetTexture = generateAdvancedPlanetTexture(
            entity.color,
            entity.secondaryColor || entity.color,
            scene
          );

          const sphereMat = new BABYLON.PBRMaterial("sphereMat", scene);
          sphereMat.albedoTexture = planetTexture;
          sphereMat.bumpTexture = planetTexture;
          sphereMat.emissiveTexture = planetTexture;
          // Subtly light up the dark side of the planet with a soft bioluminescent gas glow
          sphereMat.emissiveColor = new BABYLON.Color3(0.04, 0.04, 0.08); // Less artificial glow
          
          sphereMat.roughness = 0.85; // More matte for realistic earth/gas-giant look
          sphereMat.metallic = 0.05; // Less metallic
          sphereMat.directIntensity = 1.1; // Softer directional lighting
          sphereMat.specularIntensity = 0.4; // Less shiny
          if (sphereMat.bumpTexture) {
            sphereMat.bumpTexture.level = 0.8; // Stronger normal map depth
          }

          const sphereMesh = BABYLON.MeshBuilder.CreateSphere("planet_sphere", {
            diameter: entity.radius * 2,
            segments: 64
          }, scene);
          sphereMesh.material = sphereMat;
          sphereMesh.parent = planetContainer;

          // 1.5. Dynamic semi-transparent cloud layer sphere spinning independently
          const cloudTexture = generateAdvancedPlanetTexture(
            entity.secondaryColor || entity.color,
            "#ffffff",
            scene
          );
          const cloudMat = new BABYLON.PBRMaterial("cloudMat", scene);
          cloudMat.albedoTexture = cloudTexture;
          cloudMat.alpha = 0.42; // semi-transparent
          cloudMat.alphaMode = BABYLON.Engine.ALPHA_ADD; // glowing additive vapor
          cloudMat.roughness = 0.45;
          cloudMat.metallic = 0.02;

          const cloudMesh = BABYLON.MeshBuilder.CreateSphere("planet_clouds", {
            diameter: entity.radius * 2.03, // floating slightly above the core
            segments: 32
          }, scene);
          cloudMesh.material = cloudMat;
          cloudMesh.parent = planetContainer;

          // 2. Paper-thin concentric flat striated rings (Double-Sided Disc instead of Torus!)
          if (entity.hasRings) {
            const ringTexture = generateConcentricRingTexture(entity.ringColor || entity.color, scene);
            
            const ringMesh = BABYLON.MeshBuilder.CreateDisc("ring_mesh", {
              radius: entity.radius * 2.1, // radius fits concentric texture nicely
              tessellation: 64,
              sideOrientation: BABYLON.Mesh.DOUBLESIDE
            }, scene);

            const ringMat = new BABYLON.StandardMaterial("ringMat", scene);
            if (ringTexture) {
              ringMat.diffuseTexture = ringTexture;
              ringMat.emissiveTexture = ringTexture;
              ringMat.useAlphaFromDiffuseTexture = true;
            } else {
              const rCol = parseColorToRgb(entity.ringColor || entity.color);
              ringMat.emissiveColor = new BABYLON.Color3(rCol.r / 255, rCol.g / 255, rCol.b / 255);
            }

            ringMat.disableLighting = true;
            ringMat.backFaceCulling = false;
            ringMat.alphaMode = BABYLON.Engine.ALPHA_ONEONE;
            ringMat.alpha = 0.85;

            ringMesh.material = ringMat;
            ringMesh.rotation.x = Math.PI / 2.3;
            ringMesh.rotation.y = 0.15;
            ringMesh.parent = planetContainer;
          }

          // 3. Real 3D Atmosphere Glow Sphere using volumetric Fresnel rim lighting
          const atmosphereGlowMesh = BABYLON.MeshBuilder.CreateSphere("atmosphere_glow", {
            diameter: entity.radius * 2.12,
            segments: 32
          }, scene);

          const rgb = parseColorToRgb(entity.color);
          const atmosColor = new BABYLON.Color3(rgb.r / 255, rgb.g / 255, rgb.b / 255);

          const atmosphereGlowMat = new BABYLON.StandardMaterial("atmosphereGlowMat", scene);
          atmosphereGlowMat.emissiveColor = atmosColor;
          atmosphereGlowMat.disableLighting = true;
          atmosphereGlowMat.backFaceCulling = false;
          atmosphereGlowMat.alphaMode = BABYLON.Engine.ALPHA_ADD;

          // Pure 3D Fresnel effect for atmospheric rim glow
          const atmosFresnel = new BABYLON.FresnelParameters();
          atmosFresnel.isEnabled = true;
          atmosFresnel.bias = 0.05;
          atmosFresnel.power = 3.5;
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
          
          const numShells = 4;
          for (let s = 0; s < numShells; s++) {
            const scaleFactor = 2.4 - s * 0.4;
            const shellMesh = BABYLON.MeshBuilder.CreateSphere(`neb_shell_${s}`, {
              diameter: entity.radius * scaleFactor,
              segments: 16
            }, scene);

            const shellMat = new BABYLON.PBRMaterial(`neb_shell_mat_${s}`, scene);
            shellMat.albedoTexture = nebTex;
            shellMat.emissiveTexture = nebTex;
            shellMat.emissiveColor = new BABYLON.Color3(0.12, 0.12, 0.12);
            shellMat.disableLighting = true; // gas emits/absorbs its own light
            shellMat.backFaceCulling = false;
            shellMat.alphaMode = BABYLON.Engine.ALPHA_ONEONE;

            shellMat.alpha = 0.45 - s * 0.08;


            shellMesh.material = shellMat;
            shellMesh.parent = nebContainer;
            
            // Apply unique offset angles for rotational volumetric parallax
            shellMesh.rotation.x = (s * 1.15) + 0.5;
            shellMesh.rotation.y = (s * 2.3) - 0.2;
            shellMesh.rotation.z = s * -0.75;
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

          const galTex = generateGalaxyTexture(
            entity.color,
            entity.secondaryColor || entity.color,
            scene
          );

          // Layer 1: Core swirling arms (3D flattened sphere/ellipsoid for depth)
          const galMat = new BABYLON.StandardMaterial("galMat", scene);
          galMat.diffuseTexture = galTex;
          galMat.emissiveTexture = galTex;
          galMat.disableLighting = true;
          galMat.backFaceCulling = false;
          galMat.alphaMode = BABYLON.Engine.ALPHA_ONEONE;

          galMat.useAlphaFromDiffuseTexture = true;

          galMat.alpha = 0.92;

          const galMesh = BABYLON.MeshBuilder.CreateSphere("galaxy_ellipsoid", {
            diameterX: entity.radius * 2.8,
            diameterY: entity.radius * 2.8,
            diameterZ: entity.radius * 0.28,
            segments: 32
          }, scene);
          galMesh.material = galMat;
          galMesh.rotation.x = Math.PI / 3.8; // beautiful cinematic inclination
          galMesh.rotation.y = 0.15;
          galMesh.parent = galaxyContainer;

          // Layer 2: Slow counter-rotation background dust and star fields for depth
          const galTex2 = generateGalaxyTexture(
            entity.secondaryColor || entity.color,
            entity.color,
            scene
          );
          const galMat2 = new BABYLON.StandardMaterial("galMat2", scene);
          galMat2.diffuseTexture = galTex2;
          galMat2.emissiveTexture = galTex2;
          galMat2.disableLighting = true;
          galMat2.backFaceCulling = false;
          galMat2.alphaMode = BABYLON.Engine.ALPHA_ONEONE;

          galMat2.useAlphaFromDiffuseTexture = true;

          galMat2.alpha = 0.52;

          const galMesh2 = BABYLON.MeshBuilder.CreateSphere("galaxy_ellipsoid_bg", {
            diameterX: entity.radius * 3.0,
            diameterY: entity.radius * 3.0,
            diameterZ: entity.radius * 0.18,
            segments: 32
          }, scene);
          galMesh2.material = galMat2;
          galMesh2.rotation.x = Math.PI / 3.8;
          galMesh2.rotation.y = 0.15;
          galMesh2.scaling.set(0.92, 0.92, 0.92);
          galMesh2.parent = galaxyContainer;

          // Layer 3: Central spherical high-brightness core bulb
          const coreMat = new BABYLON.StandardMaterial("galaxyCoreMat", scene);
          const gCol = parseColorToRgb(entity.color);
          coreMat.emissiveColor = new BABYLON.Color3(gCol.r / 255, gCol.g / 255, gCol.b / 255);
          coreMat.disableLighting = true;

          const coreMesh = BABYLON.MeshBuilder.CreateSphere("galaxy_core", {
            diameter: entity.radius * 0.65,
            segments: 16
          }, scene);
          coreMesh.material = coreMat;
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

          // 1. Neutron Star Core (extremely bright white/cyan core)
          const sCol = parseColorToRgb(entity.secondaryColor || "#ffffff");
          const coreMat = new BABYLON.StandardMaterial("starCoreMat", scene);
          coreMat.emissiveColor = new BABYLON.Color3(sCol.r / 255, sCol.g / 255, sCol.b / 255);
          coreMat.disableLighting = true;

          const coreMesh = BABYLON.MeshBuilder.CreateSphere("star_core", {
            diameter: entity.radius * 0.8 * 2,
            segments: 32
          }, scene);
          coreMesh.material = coreMat;
          coreMesh.parent = starContainer;

          // 2. High-energy pulsing outer plasma aura (3D Sphere with Fresnel glow!)
          const auraTex = createCircularGlowTexture(
            hexToRgba(entity.color, 0.95),
            scene
          );
          const auraMat = new BABYLON.StandardMaterial("starAuraMat", scene);
          auraMat.diffuseTexture = auraTex;
          auraMat.emissiveTexture = auraTex;
          auraMat.disableLighting = true;
          auraMat.backFaceCulling = false;
          auraMat.alphaMode = BABYLON.Engine.ALPHA_ONEONE;

          auraMat.useAlphaFromDiffuseTexture = true;

          auraMat.alpha = 0.9;

          const starFresnel = new BABYLON.FresnelParameters();
          starFresnel.isEnabled = true;
          starFresnel.bias = 0.1;
          starFresnel.power = 2.2;
          const auraCol = parseColorToRgb(entity.color);
          starFresnel.leftColor = new BABYLON.Color3(auraCol.r / 255, auraCol.g / 255, auraCol.b / 255);
          starFresnel.rightColor = BABYLON.Color3.Black();
          auraMat.emissiveFresnelParameters = starFresnel;
          auraMat.opacityFresnelParameters = starFresnel;

          const auraMesh = BABYLON.MeshBuilder.CreateSphere("star_aura", {
            diameter: entity.radius * 3.5,
            segments: 32
          }, scene);
          auraMesh.material = auraMat;
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

        // Dynamic pulse scaling based on audio frequency bands
        let dynamicPulse = 1.0;
        if (entity.type === "star" || entity.type === "blackhole") {
          dynamicPulse = 1.0 + musicBands.bass * 0.18 + musicBands.mid * 0.08;
        } else if (entity.type === "planet") {
          dynamicPulse = 1.0 + musicBands.mid * 0.14 + musicBands.treble * 0.05;
        } else if (entity.type === "nebula" || entity.type === "galaxy") {
          dynamicPulse = 1.0 + musicBands.bass * 0.08 + musicBands.mid * 0.06;
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

        if (nearestBh && entity.type !== "blackhole" && entity.type !== "nebula") {
          const bh = nearestBh as CelestialEntity;
          const horizonZone = bh.radius * 3.5;
          if (blackholeDist < horizonZone) {
            // Strong gravitational tidal deformation (spaghettification!)
            const intensity = (horizonZone - blackholeDist) / horizonZone; // 0 to 1
            const stretchFactor = 1.0 + intensity * 0.65;
            const compressFactor = 1.0 - intensity * 0.32;
            
            finalScaleX = finalScale * stretchFactor;
            finalScaleY = finalScale * compressFactor;
            finalScaleZ = finalScale * compressFactor;

            // Rotate the mesh to align with the black hole center so the stretch points towards the singularity!
            const angleToBh = Math.atan2(bh.y - entity.y, bh.x - entity.x);
            inst.mesh.rotation.z = -angleToBh; // align rotation to face the black hole!
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
        inst.mesh.getChildMeshes().forEach((child) => {
          if (child.name === "planet_sphere" || child.name === "star_core" || child.name === "galaxy_core" || child.name === "planet_clouds") {
            const spinBase = child.name === "star_core" ? 0.008 : (child.name === "planet_clouds" ? 0.0065 : 0.0042);
            child.rotation.y += spinBase + musicBands.mid * 0.02 + musicBands.treble * 0.01;
            if (child.name === "planet_clouds") {
              child.rotation.x += 0.0003; // elegant independent cloud tilt drift
            }
          } else if (child.name.indexOf("galaxy_ellipsoid_bg") !== -1) {
            child.rotation.z -= 0.0016 + (isPulse ? 0.012 : 0) + musicBands.bass * 0.006;
          } else if (child.name.indexOf("galaxy_ellipsoid") !== -1) {
            child.rotation.z += 0.0024 + (isPulse ? 0.016 : 0) + musicBands.mid * 0.008;
          } else if (child.name.indexOf("accretion_layer_1") !== -1) {
            child.rotation.z += 0.007 + musicBands.bass * 0.02;
            const pulse = 1.0 + Math.sin(Date.now() * 0.0035) * 0.05 + musicAmp * 0.25;
            child.scaling.set(pulse, pulse, pulse);
          } else if (child.name.indexOf("accretion_layer_2") !== -1) {
            child.rotation.z -= 0.011 + musicBands.mid * 0.02;
            const pulse = 1.0 + Math.cos(Date.now() * 0.0025) * 0.04 + musicAmp * 0.2;
            child.scaling.set(pulse, pulse, pulse);
          } else if (child.name.indexOf("gravitational_lensing") !== -1) {
            child.rotation.z += 0.003 + musicBands.bass * 0.01;
            const pulse = 1.0 + Math.sin(Date.now() * 0.0015) * 0.06 + musicAmp * 0.3;
            child.scaling.set(pulse, pulse, pulse);
          } else if (child.name.indexOf("nebula_sphere_1") !== -1) {
            child.rotation.y += 0.0008 + musicBands.mid * 0.003;
            child.rotation.x += 0.0004 + musicBands.mid * 0.002;
          } else if (child.name.indexOf("nebula_sphere_2") !== -1) {
            child.rotation.y -= 0.0006 + musicBands.mid * 0.002;
            child.rotation.z += 0.0005 + musicBands.mid * 0.001;
          } else {
            child.rotation.z += 0.003 + musicBands.mid * 0.005;
          }

          // Animate texture offsets dynamically for a living, flowing space look!
          if (child.material) {
            const mat = child.material;
            let tex: BABYLON.Texture | null = null;
            if (mat instanceof BABYLON.StandardMaterial && mat.diffuseTexture instanceof BABYLON.Texture) {
              tex = mat.diffuseTexture;
            } else if (mat instanceof BABYLON.PBRMaterial && mat.albedoTexture instanceof BABYLON.Texture) {
              tex = mat.albedoTexture as BABYLON.Texture;
            }

            if (tex) {
              if (child.name === "planet_sphere" || child.name === "planet_clouds") {
                const shift = child.name === "planet_clouds" ? 0.0013 : 0.00075;
                tex.uOffset += shift + musicBands.mid * 0.0015;
                if (mat instanceof BABYLON.PBRMaterial && mat.bumpTexture instanceof BABYLON.Texture) {
                  mat.bumpTexture.uOffset = tex.uOffset;
                }
              } else if (child.name.indexOf("nebula_sphere") !== -1) {
                tex.uOffset += 0.0004 + musicBands.mid * 0.001;
                tex.vOffset += 0.0002 + musicBands.mid * 0.0005;
              } else if (child.name === "star_aura") {
                tex.uOffset += 0.002 + musicBands.bass * 0.008;
                tex.vOffset -= 0.001 + musicBands.mid * 0.004;
              } else if (child.name.indexOf("accretion_layer") !== -1 || child.name.indexOf("gravitational_lensing") !== -1) {
                tex.uOffset += 0.004 + musicBands.bass * 0.01;
              } else if (child.name.indexOf("galaxy_ellipsoid") !== -1) {
                tex.wAng += 0.0015 + musicBands.mid * 0.005;
              }

              // Sync emissive/bump/cloud textures if applicable
              if (mat.emissiveTexture && mat.emissiveTexture instanceof BABYLON.Texture) {
                mat.emissiveTexture.uOffset = tex.uOffset;
                mat.emissiveTexture.vOffset = tex.vOffset;
                if (child.name.indexOf("galaxy_ellipsoid") !== -1) {
                  mat.emissiveTexture.wAng = (tex as any).wAng || 0;
                }
              }
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
      console.error("[DEBUG] Error in updateCelestial3DMeshes:", err);
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
    pipeline.bloomThreshold = 0.05; // Make dimmer glowing elements bloom beautifully
    pipeline.bloomWeight = 0.08;    // Subtle starting weight
    pipeline.bloomKernel = 64;      // Wide soft cinematic dispersion
    pipeline.bloomScale = 0.5;
    composerRef.current = pipeline;

    // Dedicated GlowLayer to make emissive 3D celestial objects (like galaxy cores and accretion disks) bloom softly and majestically
    const glowLayer = new BABYLON.GlowLayer("glowLayer", scene, {
      mainTextureRatio: 0.25, // lower resolution ratio yields a softer, wider bloom dispersion
      blurKernelSize: 32,
    });
    glowLayer.intensity = 1.3;

    // Register the custom gravitational lensing fragment shader
    BABYLON.Effect.ShadersStore["gravitationalLensingPixelShader"] = `
      precision highp float;
      varying vec2 vUV;
      uniform sampler2D textureSampler;

      uniform float u_lensCenters[24];
      uniform float u_numLenses;
      uniform float u_aspectRatio;
      uniform float u_time;

      void main(void) {
        if (u_numLenses <= 0.0) {
          gl_FragColor = texture2D(textureSampler, vUV);
          return;
        }

        vec2 aspect = vec2(u_aspectRatio, 1.0);
        vec2 totalDeflection = vec2(0.0);
        float shadowAlpha = 0.0;

        // Unroll the loop manually to guarantee WebGL 1.0 compatibility
        // (WebGL 1.0 / GLSL ES 1.0 explicitly forbids dynamic indexing of uniform arrays with loop variables)
        if (u_numLenses > 0.0) {
          vec3 lens = vec3(u_lensCenters[0], u_lensCenters[1], u_lensCenters[2]);
          vec2 r = (vUV - lens.xy) * aspect;
          float d = length(r);
          if (d > 0.001) {
            float r_e = lens.z;
            totalDeflection += (r / aspect) * (((r_e * r_e) / d) / d);
            float r_s = r_e * 0.42;
            if (d < r_s) {
              shadowAlpha = max(shadowAlpha, smoothstep(r_s, r_s * 0.82, d));
            }
          }
        }
        if (u_numLenses > 1.0) {
          vec3 lens = vec3(u_lensCenters[3], u_lensCenters[4], u_lensCenters[5]);
          vec2 r = (vUV - lens.xy) * aspect;
          float d = length(r);
          if (d > 0.001) {
            float r_e = lens.z;
            totalDeflection += (r / aspect) * (((r_e * r_e) / d) / d);
            float r_s = r_e * 0.42;
            if (d < r_s) {
              shadowAlpha = max(shadowAlpha, smoothstep(r_s, r_s * 0.82, d));
            }
          }
        }
        if (u_numLenses > 2.0) {
          vec3 lens = vec3(u_lensCenters[6], u_lensCenters[7], u_lensCenters[8]);
          vec2 r = (vUV - lens.xy) * aspect;
          float d = length(r);
          if (d > 0.001) {
            float r_e = lens.z;
            totalDeflection += (r / aspect) * (((r_e * r_e) / d) / d);
            float r_s = r_e * 0.42;
            if (d < r_s) {
              shadowAlpha = max(shadowAlpha, smoothstep(r_s, r_s * 0.82, d));
            }
          }
        }
        if (u_numLenses > 3.0) {
          vec3 lens = vec3(u_lensCenters[9], u_lensCenters[10], u_lensCenters[11]);
          vec2 r = (vUV - lens.xy) * aspect;
          float d = length(r);
          if (d > 0.001) {
            float r_e = lens.z;
            totalDeflection += (r / aspect) * (((r_e * r_e) / d) / d);
            float r_s = r_e * 0.42;
            if (d < r_s) {
              shadowAlpha = max(shadowAlpha, smoothstep(r_s, r_s * 0.82, d));
            }
          }
        }
        if (u_numLenses > 4.0) {
          vec3 lens = vec3(u_lensCenters[12], u_lensCenters[13], u_lensCenters[14]);
          vec2 r = (vUV - lens.xy) * aspect;
          float d = length(r);
          if (d > 0.001) {
            float r_e = lens.z;
            totalDeflection += (r / aspect) * (((r_e * r_e) / d) / d);
            float r_s = r_e * 0.42;
            if (d < r_s) {
              shadowAlpha = max(shadowAlpha, smoothstep(r_s, r_s * 0.82, d));
            }
          }
        }
        if (u_numLenses > 5.0) {
          vec3 lens = vec3(u_lensCenters[15], u_lensCenters[16], u_lensCenters[17]);
          vec2 r = (vUV - lens.xy) * aspect;
          float d = length(r);
          if (d > 0.001) {
            float r_e = lens.z;
            totalDeflection += (r / aspect) * (((r_e * r_e) / d) / d);
            float r_s = r_e * 0.42;
            if (d < r_s) {
              shadowAlpha = max(shadowAlpha, smoothstep(r_s, r_s * 0.82, d));
            }
          }
        }
        if (u_numLenses > 6.0) {
          vec3 lens = vec3(u_lensCenters[18], u_lensCenters[19], u_lensCenters[20]);
          vec2 r = (vUV - lens.xy) * aspect;
          float d = length(r);
          if (d > 0.001) {
            float r_e = lens.z;
            totalDeflection += (r / aspect) * (((r_e * r_e) / d) / d);
            float r_s = r_e * 0.42;
            if (d < r_s) {
              shadowAlpha = max(shadowAlpha, smoothstep(r_s, r_s * 0.82, d));
            }
          }
        }
        if (u_numLenses > 7.0) {
          vec3 lens = vec3(u_lensCenters[21], u_lensCenters[22], u_lensCenters[23]);
          vec2 r = (vUV - lens.xy) * aspect;
          float d = length(r);
          if (d > 0.001) {
            float r_e = lens.z;
            totalDeflection += (r / aspect) * (((r_e * r_e) / d) / d);
            float r_s = r_e * 0.42;
            if (d < r_s) {
              shadowAlpha = max(shadowAlpha, smoothstep(r_s, r_s * 0.82, d));
            }
          }
        }

        // Apply accumulated gravitational deflection to obtain the warped UV coordinates
        vec2 warpedUV = vUV - totalDeflection;

        // Astrophotographic Chromatic Aberration & Gravitational Dispersion
        // Shift red and blue channels slightly outward along the deflection axis & screen edges for cinematic spectrum splitting
        vec2 screenCenterDist = vUV - vec2(0.5);
        float edgeDistSq = dot(screenCenterDist, screenCenterDist);
        
        // Dispersion vector depends on gravitational warp magnitude AND lens-edge aberration
        vec2 dispersionVec = totalDeflection + screenCenterDist * 0.01;
        float dispLen = length(dispersionVec);
        vec2 dispersionDir = dispLen > 0.0001 ? dispersionVec / dispLen : vec2(0.0);
        float dispersionMagnitude = 0.0035 * edgeDistSq + length(totalDeflection) * 0.22;
        vec2 splitShift = dispersionDir * dispersionMagnitude;

        // Sample channels individually with boundaries clamped to prevent wrap artifacts
        vec2 uvR = clamp(warpedUV - splitShift, vec2(0.0001), vec2(0.9999));
        vec2 uvG = clamp(warpedUV, vec2(0.0001), vec2(0.9999));
        vec2 uvB = clamp(warpedUV + splitShift, vec2(0.0001), vec2(0.9999));

        float rChannel = texture2D(textureSampler, uvR).r;
        float gChannel = texture2D(textureSampler, uvG).g;
        float bChannel = texture2D(textureSampler, uvB).b;
        float aChannel = texture2D(textureSampler, uvG).a;

        vec4 color = vec4(rChannel, gChannel, bChannel, aChannel);

        // Render the deep cosmic shadow of event horizons where light is swallowed
        color.rgb = mix(color.rgb, vec3(0.0, 0.0, 0.0), shadowAlpha);

        // 1. Astro-photographic Sensor Noise / Cosmic Film Grain (dynamic, time-varying pixel noise)
        float noiseSeed = dot(vUV * (u_time + 1.0), vec2(12.9898, 78.233));
        float grain = fract(sin(noiseSeed) * 43758.5453) * 0.022;
        color.rgb += vec3(grain);

        // 2. Deep Cosmic Vignette (vignetting at screen edges to frame the core cosmos)
        float vignette = smoothstep(1.3, 0.48, length(screenCenterDist));
        color.rgb *= mix(1.0, vignette, 0.38);

        gl_FragColor = color;
      }
    `;

    // Instantiate custom post process for screen-space warp
    const lensingPostProcess = new BABYLON.PostProcess(
      "GravitationalLensing",
      "gravitationalLensing",
      ["u_lensCenters", "u_numLenses", "u_aspectRatio", "u_time"],
      [],
      1.0,
      camera,
      BABYLON.Texture.BILINEAR_SAMPLINGMODE,
      engine
    );

    lensingPostProcess.onApply = (effect) => {
      const width = engine.getRenderWidth();
      const height = engine.getRenderHeight();
      const aspectRatio = width / (height || 1);
      effect.setFloat("u_aspectRatio", aspectRatio);
      effect.setFloat("u_time", (Date.now() % 1000000) / 1000.0);

      const viewport = new BABYLON.Viewport(0, 0, width, height);
      const transformMatrix = scene.getTransformMatrix();

      const activeEntities = celestialEntitiesRef.current || [];
      const candidates = activeEntities
        .filter(e => !e.isDestroyed || (e.scale ?? 0) > 0.05)
        .map(entity => {
          // World position coordinates matching coordinate calculations in the update loop
          const wx = entity.x - window.innerWidth / 2;
          const wy = -(entity.y - window.innerHeight / 2);
          const wz = entity.z || 0;

          const position3D = new BABYLON.Vector3(wx, wy, wz);
          const projected = BABYLON.Vector3.Project(
            position3D,
            BABYLON.Matrix.IdentityReadOnly,
            transformMatrix,
            viewport
          );

          // Normalized Device Coordinates to screen space UV
          const u = projected.x / width;
          const v = 1.0 - (projected.y / height); // Flip Y for WebGL texture sampler UV coords

          // Map entity type to lensing base strength based on gravity size/importance
          let baseStrength = 0.0;
          if (entity.type === "blackhole") {
            baseStrength = 0.075 * (entity.scale ?? 1.0);
          } else if (entity.type === "star") {
            baseStrength = 0.04 * (entity.scale ?? 1.0);
          } else if (entity.type === "galaxy") {
            baseStrength = 0.025 * (entity.scale ?? 1.0);
          } else if (entity.type === "planet") {
            baseStrength = 0.012 * (entity.scale ?? 1.0);
          }

          // Dynamic pulse scaling based on real-time audio amplitude for gravitational waves
          const musicBands = (audio as any).getFrequencyBands ? (audio as any).getFrequencyBands() : { bass: 0, mid: 0, treble: 0 };
          const strength = baseStrength * (1.0 + musicBands.bass * 0.4 + musicBands.mid * 0.15);

          return { u, v, strength, zDepth: projected.z };
        })
        .filter(item => item.strength > 0.001 && item.zDepth >= 0.0 && item.zDepth <= 1.0)
        .sort((a, b) => b.strength - a.strength)
        .slice(0, 8);

      const lensData: number[] = new Array(24).fill(0);
      candidates.forEach((c, idx) => {
        lensData[idx * 3] = c.u;
        lensData[idx * 3 + 1] = c.v;
        lensData[idx * 3 + 2] = c.strength;
      });

      effect.setFloatArray("u_lensCenters", lensData);
      effect.setFloat("u_numLenses", candidates.length);
    };

    lensingPostProcessRef.current = lensingPostProcess;

    // Register the custom wormhole shader and post-process permanently to avoid rebuilding the pipeline on the fly
    BABYLON.Effect.ShadersStore["wormholePixelShader"] = `
      precision highp float;
      varying vec2 vUV;
      uniform sampler2D textureSampler;
      uniform float time;
      uniform float intensity;
      
      // Noise function for relativistic distortion
      float hash(float n) { return fract(sin(n) * 1e4); }
      float hash(vec2 p) { return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); }
      float noise(vec2 x) {
          vec2 i = floor(x);
          vec2 f = fract(x);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }
      
      void main(void) {
          vec2 uv = vUV;
          vec2 center = vec2(0.5);
          vec2 dir = center - uv;
          float dist = length(dir);
          
          if (intensity <= 0.0) {
              gl_FragColor = texture2D(textureSampler, uv);
              return;
          }
          
          // Wormhole tunnel effect: space bends inward drastically
          // dist = max(dist, 0.001); // prevent division by zero
          
          // The tunnel gets deeper as intensity increases
          float pull = (1.0 - smoothstep(0.0, 0.5, dist)) * intensity * 2.0;
          
          // Rotate UVs around center (swirling effect)
          float angle = pull * time * 2.0;
          float s = sin(angle);
          float c = cos(angle);
          mat2 rot = mat2(c, -s, s, c);
          
          vec2 swirledUV = center + rot * (uv - center) * (1.0 - pull * 0.4);
          
          // Add some relativistic quantum noise
          float n = noise(swirledUV * 20.0 - time * 5.0) * pull * 0.05;
          swirledUV += vec2(n);
          
          if (dist > 0.0001) {
              dir = dir / dist;
          } else {
              dir = vec2(0.0);
          }
          
          // Smoothly building radial blur (motion blur falling into the singularity)
          float blurAmount = min(time * 0.015, 0.06) * intensity + pull * 0.05;
          
          vec4 sum = vec4(0.0);
          float samples = 12.0;
          for(float i=0.0; i<12.0; i++) {
              sum += texture2D(textureSampler, swirledUV + dir * (i / samples) * blurAmount);
          }
          sum /= samples;
          
          // Relativistic Chromatic Aberration & Blueshift
          // Light getting pulled into the wormhole blueshifts (gets brighter and bluer/whiter)
          float ca = blurAmount * 0.6;
          sum.r = texture2D(textureSampler, swirledUV + dir * ca * 1.5).r;
          sum.g = texture2D(textureSampler, swirledUV + dir * ca * 0.5).g;
          sum.b = texture2D(textureSampler, swirledUV - dir * ca * 0.5).b;
          
          // Extreme brightness at the singularity edge
          vec3 eventHorizonGlow = vec3(0.1, 0.5, 1.0) * pow(pull, 3.0) * 2.0;
          
          vec4 finalColor = mix(texture2D(textureSampler, uv), sum, intensity);
          finalColor.rgb += eventHorizonGlow;
          
          gl_FragColor = finalColor;
      }
    `;

    const wormholePostProcess = new BABYLON.PostProcess("WormholePP", "wormhole", ["time", "intensity"], null, 1.0, camera);
    wormholePostProcess.onApply = (effect) => {
        wormholeTimeRef.current += 0.016;
        effect.setFloat("time", wormholeTimeRef.current);
        effect.setFloat("intensity", wormholeIntensityRef.current);
    };
    wormholePostProcessRef.current = wormholePostProcess;

    // Direct lighting & ambient light setup
    const ambientLight = new BABYLON.HemisphericLight("ambientLight", new BABYLON.Vector3(0, 1, 0), scene);
    ambientLight.intensity = 0.28;

    const dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(1.5, -1.0, 1.2), scene);
    dirLight.intensity = 1.05;

    // Create the requested BabylonJS particle system
    const psm = new ParticleSystemManager(scene, 200000);
    const particleSystem = psm.system;
    
    particleSystem.color1 = new BABYLON.Color4(0.7, 0.8, 1.0, 1.0);
    particleSystem.color2 = new BABYLON.Color4(0.2, 0.5, 1.0, 1.0);
    particleSystem.colorDead = new BABYLON.Color4(0, 0, 0.2, 0.0); // Keep subtle color at death
    particleSystem.minSize = 0.015;
    particleSystem.maxSize = 0.02; // Slightly reduced and constrained size
    particleSystem.minLifeTime = 2.0; // Longer life for relaxed movement
    particleSystem.maxLifeTime = 8.0; 
    particleSystem.emitRate = 5000; // Reduced emission rate for less chaos
    particleSystem.createPointEmitter(new BABYLON.Vector3(-7, 8, 3), new BABYLON.Vector3(7, 8, -3));
    particleSystem.minEmitPower = 0.2; // Slower speed
    particleSystem.maxEmitPower = 0.8;
    particleSystem.updateSpeed = 0.005; // Slower update for relaxing feel

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
    const numStars = isMobileDevice ? 400 : 1200;
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
          gl_PointSize = pointSize * (1.6 + fract(position.x * 456.789) * 1.8); // Larger, soft galaxy light sources
        } else if (extraData > 1.5) {
          gl_PointSize = pointSize * 0.9; // Tail particles
        } else if (extraData > 0.5) {
          gl_PointSize = pointSize * 0.65; // Lettering (extremely crisp and readable)
        } else {
          gl_PointSize = pointSize * (0.4 + fract(position.x * 123.456) * 0.6); // Ambient stars
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
      uniform float electricPulse;
      void main(void) {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord);
        if (dist > 0.5) discard;
        
        float alpha = 0.0;
        
        // Soft gaussian-like falloff for anti-aliasing
        float gaussian = exp(-dist * dist * 12.0);
        
        if (vExtra > 2.5) {
          // Galaxy particles - very soft, highly diffuse falloff to represent a soft distant light source (bloom feel)
          alpha = exp(-dist * dist * 3.8) * 0.85;
        } else if (vExtra > 1.5) {
          // Tail particles - soft, slightly elongated
          alpha = gaussian * 0.4;
        } else if (vExtra > 0.5) {
          // Lettering - very clean, crisp core with soft edge to prevent pixelation
          alpha = smoothstep(0.45, 0.1, dist) * 0.9;
        } else {
          // Ambient stars - organic bokeh-like core with subtle cross
          float crossX = smoothstep(0.5, 0.0, abs(coord.x)) * exp(-abs(coord.y) * 20.0);
          float crossY = smoothstep(0.5, 0.0, abs(coord.y)) * exp(-abs(coord.x) * 20.0);
          float starCore = gaussian * 0.7;
          
          float twinkle = 0.9 + 0.1 * sin(vPos.x * 2.0 + vPos.y * 2.0);
          
          alpha = (starCore + crossX * 0.5 + crossY * 0.5) * twinkle;
        }
        
        // Final color mix
        vec3 finalColor = vColor.rgb * alpha;

        // Dynamic soft neon-blue aura/glow on the particles themselves during electrical pulses
        if (electricPulse > 0.01) {
          // Soft neon-blue hue (electric cyan-blue)
          vec3 neonBlue = vec3(0.02, 0.45, 1.0);
          float aura = exp(-dist * dist * 4.5) * electricPulse * 0.65;
          finalColor += neonBlue * aura;
        }

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const pointsMaterial = new BABYLON.ShaderMaterial("pointsMat", scene, {
      vertex: "customParticle",
      fragment: "customParticle"
    }, {
      attributes: ["position", "color", "extraData"],
      uniforms: ["worldViewProjection", "pointSize", "electricPulse"],
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

    // Seed the initial planets and singularity immediately on load
    generateInterstellarScene(ww, wh);
    fetchNextGeminiScene();

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
      if (tailCount === 0 || tailStartIndex === -1) return;
      const tIdx = tailStartIndex + (tailIndex % tailCount);
      tailIndex++;

      const tailP = tempParticles[tIdx];
      if (tailP) {
        tailP.x = x;
        tailP.y = y;
        tailP.z = z;
        tailP.vx = vx;
        tailP.vy = vy;
        tailP.vz = (Math.random() - 0.5) * 2;
        tailP.color = color;
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
      
      // Dynamic Web Audio API metrics for real-time visual synchronization
      const musicAmpVal = (audio as any).getMusicAmplitude();
      const musicBands = (audio as any).getFrequencyBands ? (audio as any).getFrequencyBands() : { bass: 0, mid: 0, treble: 0 };
      const musicSpeedFactor = 1.0 + musicBands.mid * 2.2 + musicBands.bass * 0.8;

      const idleTime = now - lastUserActivityRef.current;
      const isIdle = idleTime > 10000; // 10 seconds idle timeout
      isScreensaverActiveRef.current = (stageRef.current === 0) && isIdle;

      if (isScreensaverActiveRef.current) {
        screensaverOpacityRef.current += (1.0 - screensaverOpacityRef.current) * 0.02;
      } else {
        screensaverOpacityRef.current += (0.0 - screensaverOpacityRef.current) * 0.08;
      }

      // Trigger a majestic Shockwave pulse every 60 seconds on stage 0
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
      if (isShockwaveActiveRef.current) {
        const elapsedSw = now - shockwaveStartTimeRef.current;
        const durationSw = 5000; // 5 seconds duration
        if (elapsedSw >= durationSw) {
          isShockwaveActiveRef.current = false;
        } else {
          const tSw = elapsedSw / durationSw;
          if (tSw < 0.12) {
            shockwaveIntensity = tSw / 0.12;
          } else {
            shockwaveIntensity = Math.pow(1.0 - (tSw - 0.12) / 0.88, 1.8);
          }
        }
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

      let chromaticShift = 0;
      if (elapsed < 900) {
        const pTransit = elapsed / 900;
        chromaticShift = Math.sin(pTransit * Math.PI) * 15.0;
      }

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

      let snSuckForce = 0;
      let snExplode = false;
      if (activeSupernova) {
        snElapsed = Date.now() - activeSupernova.time;
        
        if (!activeSupernova.isCalmShift) {
          // Standard violent supernova has intense gravitational collapse/explosion
          if (snElapsed > 1200 && snElapsed < 2200) {
            const progress = (snElapsed - 1200) / 1000;
            snSuckForce = Math.pow(progress, 5) * 3.5;
          } else if (snElapsed >= 2200 && !activeSupernova.exploded) {
            snExplode = true;
            activeSupernova.exploded = true;
          }
        }
        
        // Let's make the transition time of the calm shift slightly longer (e.g., 8 seconds of beautiful, peaceful morphing drift)
        const transitionThreshold = activeSupernova.isCalmShift ? 8000 : 6000;
        
        if (snElapsed >= transitionThreshold && !activeSupernova.transitioned) {
          console.log("[DEBUG] Calm shift transition threshold reached, generating new scene.");
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

          supernovaRef.current = null; // Clear supernova so physics is not prematurely triggered in the new scene
        }
        if (snElapsed >= (transitionThreshold + 1300)) {
          supernovaRef.current = null;
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

            p.x += p.vx;
            p.y += p.vy;
            p.z += p.vz;

            p.vx *= 0.94;
            p.vy *= 0.94;
            p.vz *= 0.94;

            p.life -= p.decay || 0.06;
            if (p.life < 0) p.life = 0;

            positions[i * 3] = p.x - currentW / 2;
            positions[i * 3 + 1] = -(p.y - currentH / 2);
            positions[i * 3 + 2] = p.z;

            const r = p.r ?? 255;
            const g = p.g ?? 255;
            const b = p.b ?? 255;

            const tailPulse = 1.0 + musicAmpVal * 0.8;
            const tailOpacity = p.life * 0.45;
            colors[i * 4] = (r / 255) * globalAlpha * tailOpacity * tailPulse;
            colors[i * 4 + 1] = (g / 255) * globalAlpha * tailOpacity * tailPulse;
            colors[i * 4 + 2] = (b / 255) * globalAlpha * tailOpacity * tailPulse;
            colors[i * 4 + 3] = tailOpacity;
          } else {
            positions[i * 3] = -99999;
            positions[i * 3 + 1] = -99999;
            positions[i * 3 + 2] = 0;
            colors[i * 4] = 0;
            colors[i * 4 + 1] = 0;
            colors[i * 4 + 2] = 0;
            colors[i * 4 + 3] = 0;
          }
          continue;
        }

        if (activeSupernova && !activeSupernova.isCalmShift) {
          const cx = activeSupernova.x;
          const cy = activeSupernova.y;
          if (snElapsed < 1200) {
            const progress = snElapsed / 1200;
            const destabIntensity = Math.pow(progress, 1.5);
            const dx = p.x - cx;
            const dy = p.y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;

            const angle = Math.random() * Math.PI * 2;
            const jitterSpeed = destabIntensity * 5.5;
            p.vx += Math.cos(angle) * jitterSpeed;
            p.vy += Math.sin(angle) * jitterSpeed;

            const tangentX = -dy / dist;
            const tangentY = dx / dist;
            const orbitSpeed = destabIntensity * 3.5;
            p.vx += tangentX * orbitSpeed;
            p.vy += tangentY * orbitSpeed;

            const outwardForce = Math.sin(progress * Math.PI) * 1.8;
            p.vx += (dx / dist) * outwardForce;
            p.vy += (dy / dist) * outwardForce;
          } else if (snSuckForce > 0) {
            const cx = activeSupernova.x;
            const cy = activeSupernova.y;
            p.vx += (cx - p.x) * snSuckForce * 0.1;
            p.vy += (cy - p.y) * snSuckForce * 0.1;
          }
        }
        if (snExplode && activeSupernova && !activeSupernova.isCalmShift) {
          const cx = activeSupernova.x;
          const cy = activeSupernova.y;
          let dx = p.x - cx;
          let dy = p.y - cy;
          if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
            dx = (Math.random() - 0.5) * 10;
            dy = (Math.random() - 0.5) * 10;
          }
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 18 + Math.random() * 22; // Cinematic slow expansion ring!
          p.vx = (dx / dist) * force;
          p.vy = (dy / dist) * force;
        }

        if (p.isCosmicAmbient) {
          p.y -= scrollVelocityRef.current * (p.driftSpeed || 0.2);
          p.x += Math.sin(time * 0.005 + i) * 0.15;

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

          positions[i * 3] = drawAmbX - currentW / 2 + parallaxX;
          positions[i * 3 + 1] = -(drawAmbY - currentH / 2 + parallaxY);
          positions[i * 3 + 2] = p.z;

          // Simple white or dim ambient color pulsing with music
          const ambientPulse = 1.0 + musicAmpVal * 0.45;
          colors[i * 4] = (p.color === "#ffffff" ? 0.8 : 0.9) * ambientPulse;
          colors[i * 4 + 1] = (p.color === "#ffffff" ? 0.8 : 0.8) * ambientPulse;
          colors[i * 4 + 2] = (p.color === "#ffffff" ? 0.8 : 0.7) * ambientPulse;
          colors[i * 4 + 3] = 1.0;
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
        const fluidInfluence = Math.max(0.0, Math.min(0.85, (1.0 - (p.isProjectText ? 0.75 : 0.22)) * fluidTransitionFactor * springFactorSq));
        
        p.vx += curl.x * fluidInfluence;
        p.vy += curl.y * fluidInfluence;

        p.x += p.vx * localTimeDilation;
        p.y += p.vy * localTimeDilation;
        p.z += p.vz * localTimeDilation;

        p.vx *= 0.86;
        p.vy *= 0.86;
        p.vz *= 0.86;

        if (isInterstellarRef.current && p.interstellarType) {
          if (
            p.interstellarType === "blackhole" ||
            p.interstellarType === "planet"
          ) {
            p.orbitAngle = (p.orbitAngle || 0) + (p.orbitSpeed || 0.005) * 0.45 * localTimeDilation * musicSpeedFactor;
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
            p.orbitAngle = (p.orbitAngle || 0) + (p.orbitSpeed || 0.002) * 0.45 * localTimeDilation * musicSpeedFactor;
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
              (p.bridgeProgress ?? 0) + (p.bridgeSpeed ?? 0.012) * 0.45 * localTimeDilation * musicSpeedFactor;
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
            p.orbitAngle = (p.orbitAngle || 0) + (p.orbitSpeed || 0.012) * localTimeDilation * musicSpeedFactor;
            
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
            p.targetX += Math.sin(time * 0.01 + i) * 0.05;
            p.targetY += Math.cos(time * 0.01 + i) * 0.05;
          }
        }

        let particleBrightness = 1.0;
        let suctionAlpha = 0;

        // Spacetime gravity bending is always active except for a brief time during stage change in typography mode
        const isInterferenceSuppressed = !isInterstellarRef.current && (elapsed < 4000);

        if (!isInterferenceSuppressed) {
          const gravityRadiusMult = isInterstellarRef.current ? 2.5 : 1.8;
          
          // 1. Black hole attraction
          activeBlackholes.forEach((entity) => {
            const bdx = entity.x - p.x;
            const bdy = entity.y - p.y;
            const bdist = Math.sqrt(bdx * bdx + bdy * bdy) || 1;
            if (bdist < entity.radius * gravityRadiusMult) {
              const pullFactor = 1.0 - bdist / (entity.radius * gravityRadiusMult);
              suctionAlpha = Math.max(suctionAlpha, pullFactor * (isInterstellarRef.current ? 1.0 : 0.3));

              const basePullStrength = isInterstellarRef.current ? 4.8 : 1.4;
              const tx = -bdy / bdist;
              const ty = bdx / bdist;

              // Strong orbital velocity at first, slowly easing into high radial pull as it closes in
              const closeness = 1.0 - (bdist / (entity.radius * gravityRadiusMult)); // 0 at outskirts, 1 at singularity
              const orbitalStrength = basePullStrength * 1.85 * pullFactor;
              const radialStrength = basePullStrength * 0.45 * pullFactor * (0.3 + closeness * 0.7);

              p.vx += (bdx / bdist) * radialStrength + tx * orbitalStrength;
              p.vy += (bdy / bdist) * radialStrength + ty * orbitalStrength;

              if (bdist < entity.radius * 1.25) {
                // Smoothly fade out particle emission brightness to exactly 0 as it crosses the event horizon
                const transitionProgress = (bdist - entity.radius * 1.02) / (entity.radius * 0.23);
                particleBrightness = Math.max(0.0, Math.min(1.0, transitionProgress));
                
                if (bdist < entity.radius * 0.5 && Math.random() < 0.15) {
                  // Sucked into the singularity! Recycle the particle to keep the cosmic density balanced
                  p.x = (Math.random() > 0.5 ? -100 : currentW + 100);
                  p.y = (Math.random() > 0.5 ? -100 : currentH + 100);
                  p.vx = 0;
                  p.vy = 0;
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

        const springTension = (isTypographyMode
          ? Math.max(0.08, Math.min(0.75, 40.0 / Math.max(1, distSq)))
          : isInterstellarRef.current
            ? 0.24
            : 0.08) * (1.0 - suctionAlpha);

        if (distSq > 1.0) {
          if (p.isProjectText) {
             const mdx = mouseRef.current.x - p.x;
             const mdy = mouseRef.current.y - p.y;
             const mDistSq = mdx * mdx + mdy * mdy;
             if (mDistSq < 10000) { // Hover radius 100
                const mDist = Math.sqrt(mDistSq);
                const mForce = (1 - mDist / 100) * 0.5; // Magnetic intensity
                p.x += mdx * mForce * 0.2; // Reduced factor for smoother effect
                p.y += mdy * mForce * 0.2;
             }
          }
          p.x += dx * springTension * attractionMultiplier * localTimeDilation;
          p.y += dy * springTension * attractionMultiplier * localTimeDilation;
        } else {
          if (attractionMultiplier > 0.01) {
            p.x = p.targetX;
            p.y = p.targetY;
          }
        }
        
        if (p.targetZ !== undefined) {
          const dz = p.targetZ - (p.z || 0);
          if (Math.abs(dz) > 0.5) {
            p.z = (p.z || 0) + dz * springTension * attractionMultiplier * localTimeDilation;
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

        // Map points to positions
        positions[i * 3] = drawX - currentW / 2 + parallaxX;
        positions[i * 3 + 1] = -(drawY - currentH / 2 + parallaxY);
        positions[i * 3 + 2] = p.z + particleGravityZ;

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

        // Dynamic frequency-band specific color shifts (e.g. Bass -> Red, Mids -> Green, Treble -> Blue/Cyan boost)
        let audioColorR = 1.0;
        let audioColorG = 1.0;
        let audioColorB = 1.0;
        if (musicAmpVal > 0.01) {
          audioColorR += musicBands.bass * 0.4;
          audioColorG += musicBands.mid * 0.35;
          audioColorB += musicBands.treble * 0.45;
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

        colors[i * 4] = Math.min(1.0, Math.max(0.0, (r / 255) * globalAlpha * rFactor * audioColorR * particleBrightness * textAlphaDimmer * dopplerR * dopplerIntensity));
        colors[i * 4 + 1] = Math.min(1.0, Math.max(0.0, (g / 255) * globalAlpha * gFactor * audioColorG * particleBrightness * textAlphaDimmer * dopplerG * dopplerIntensity));
        colors[i * 4 + 2] = Math.min(1.0, Math.max(0.0, (b / 255) * globalAlpha * bFactor * audioColorB * particleBrightness * textAlphaDimmer * dopplerB * dopplerIntensity));
        colors[i * 4 + 3] = globalAlpha * textAlphaDimmer;
        extras[i] = p.isTail ? 2.0 : (p.interstellarType === "background_galaxy" ? 3.0 : (!p.isCosmicAmbient ? 1.0 : 0.0));
      }

      if (pointsMeshRef.current) {
        pointsMeshRef.current.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
        pointsMeshRef.current.updateVerticesData(BABYLON.VertexBuffer.ColorKind, colors);
        pointsMeshRef.current.updateVerticesData("extraData", extras);
      }

      ripplesRef.current.forEach((r) => (r.life -= 0.02));
      ripplesRef.current = ripplesRef.current.filter((r) => r.life > 0);

      // Calculate dynamic camera shake based on active ripples and supernovae
      let shakeX = 0;
      let shakeY = 0;
      let shakeZ = 0;
      let shakeIntensity = 0;

      if (activeSupernova) {
        if (snElapsed >= 2200 && snElapsed < 4200) {
          // Blinding detonation shockwave: intense shake
          const factor = Math.max(0, 1.0 - (snElapsed - 2200) / 2000);
          shakeIntensity += factor * 6.0; // Toned down from 16.0
        } else if (snElapsed >= 1200 && snElapsed < 2200) {
          // Pre-explosion gravitational collapse: subtle low-frequency rumbling
          const factor = (snElapsed - 1200) / 1000;
          shakeIntensity += factor * 1.5; // Toned down from 2.5
        }
      }

      // Shaking from high-intensity ripples and galactic shockwaves
      ripplesRef.current.forEach((r) => {
        shakeIntensity += r.life * 2.0; // Toned down from 4.5
      });

      if (shockwaveIntensity > 0.01) {
        shakeIntensity += shockwaveIntensity * 6.0; // Toned down from 14.5
      }

      if (shakeIntensity > 0.05) {
        shakeX = (Math.random() - 0.5) * shakeIntensity;
        shakeY = (Math.random() - 0.5) * shakeIntensity;
        shakeZ = (Math.random() - 0.5) * shakeIntensity;
      }

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
          // Ease-in-out-quart for absolute continuity of start and end velocities (perfectly zero first derivatives)
          transitionT = rawT < 0.5 ? 8 * rawT * rawT * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 4) / 2;
        }
      }

      if (!isTransitActiveRef.current) {
        if (isTransitioning && startPos) {
          // Linearly interpolate the base coordinate path
          const basePosX = (1 - transitionT) * startPos.x + transitionT * finalTargetX;
          const basePosY = (1 - transitionT) * startPos.y + transitionT * finalTargetY;
          const basePosZ = (1 - transitionT) * startPos.z + transitionT * finalTargetZ;

          // Cinematic Fly-Through: Z Surge pushes directly THROUGH the central geometry plane (Z=0)
          // Peak surge reaches +1400.0 at t=0.5, ensuring the lens goes far past Z=0.
          const zSurge = Math.sin(transitionT * Math.PI) * 1400.0;

          // Interactive/Organic weaving offsets simulating a complex pilot maneuver
          const weaveX = Math.sin(transitionT * Math.PI) * 140.0 * Math.sin(transitionT * Math.PI * 2.5);
          const weaveY = Math.sin(transitionT * Math.PI) * 90.0 * Math.cos(transitionT * Math.PI * 2.0);

          // Apply position update directly, integrating camera shake
          camera.position.x = basePosX + weaveX + shakeX;
          camera.position.y = basePosY + weaveY + shakeY;
          camera.position.z = basePosZ + zSurge + shakeZ;

          // Target locks blending
          const lockX = inputs.currentLock.x * inputs.currentLock.intensity;
          const lockY = inputs.currentLock.y * inputs.currentLock.intensity;
          const lockZ = inputs.currentLock.z * inputs.currentLock.intensity;

          // Dynamic target offset to add parallax sweep while maneuvering
          const targetOffsetX = weaveX * 0.42 + lockX;
          const targetOffsetY = weaveY * 0.42 + lockY;
          camera.setTarget(new BABYLON.Vector3(targetOffsetX, targetOffsetY, lockZ));

          // Incorporate camera tilt (pitch and yaw)
          camera.rotation.x += inputs.currentCameraPitch;
          camera.rotation.y += inputs.currentCameraYaw;

          // Dynamic rotational banking (roll):
          // Simulate physical centripetal banking forces as the camera snakes through space.
          const rollAngle = Math.sin(transitionT * Math.PI) * 0.52 * Math.cos(transitionT * Math.PI * 1.5);
          camera.rotation.z = rollAngle;
        } else {
          // Standard smooth camera interpolation for normal states
          camera.position.x += (finalTargetX + shakeX - camera.position.x) * 0.04;
          camera.position.y += (finalTargetY + shakeY - camera.position.y) * 0.04;
          camera.position.z += (finalTargetZ + shakeZ - camera.position.z) * 0.04;

          // Target locks blending
          const lockX = inputs.currentLock.x * inputs.currentLock.intensity;
          const lockY = inputs.currentLock.y * inputs.currentLock.intensity;
          const lockZ = inputs.currentLock.z * inputs.currentLock.intensity;

          camera.setTarget(new BABYLON.Vector3(lockX, lockY, lockZ));

          // Incorporate camera tilt (pitch and yaw)
          camera.rotation.x += inputs.currentCameraPitch;
          camera.rotation.y += inputs.currentCameraYaw;

          // Reset camera roll gradually to 0 for vertical alignment when stable
          camera.rotation.z *= 0.95;
        }
      }

      // Update particle shader uniforms for electrical pulse glowing waves
      if (pointsMaterialRef.current) {
        const pulseVal = Math.max(Math.min(1.0, disturbance), shockwaveIntensity * 1.0);
        pointsMaterialRef.current.setFloat("electricPulse", pulseVal);
      }

      // Dynamically adjust bloom parameters for a truly high-end cinematic experience
      if (composerRef.current) {
        const pipeline = composerRef.current;
        const baseBloom = isInterstellarRef.current ? 0.24 : 0.08;
        if (activeSupernova) {
          if (snElapsed >= 1200 && snElapsed < 2200) {
            // Gravitational collapse phase: build intensity
            const progress = (snElapsed - 1200) / 1000;
            pipeline.bloomWeight = baseBloom + progress * 0.2; // build up (toned down)
          } else if (snElapsed >= 2200 && snElapsed < 3200) {
            // Supernova detonation phase: cinematic blinding flash!
            const progress = (snElapsed - 2200) / 1000;
            const fadeOut = Math.max(0, 1 - progress);
            pipeline.bloomWeight = baseBloom + fadeOut * 0.4; // intense bloom flare peaks (toned down)
          } else {
            pipeline.bloomWeight = baseBloom;
          }
        } else {
          // Standard cosmic breathing pulse with an added dynamic neon-blue bloom surge when electrical disturbances occur
          const pulse = Math.sin(time * 0.01) * 0.02;
          const electricSurge = Math.min(1.0, disturbance) * 0.2; // boost bloom weight momentarily on click/interaction (toned down)
          const shockwaveSurge = shockwaveIntensity * 0.3; // gorgeous screen-wide neon bloom flare during periodic shocks! (toned down)
          pipeline.bloomWeight = baseBloom + pulse + electricSurge + shockwaveSurge;
        }
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

      // Trigger a cinematic cosmic shift on click so sequences can progress manually, but ONLY when in interstellar mode!
      if (isInterstellarRef.current && !supernovaRef.current) {
        // Smoothly fade out all current entities by setting them as destroyed
        celestialEntitiesRef.current.forEach((entity) => {
          entity.isDestroyed = true;
        });

        supernovaRef.current = {
          time: Date.now(),
          exploded: false,
          isCalmShift: true,
          x: e.clientX,
          y: e.clientY,
        };
        console.log("[DEBUG] Click triggered supernova/shift", supernovaRef.current);
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

      try {
        // Guarantee wormhole post-process exists
        if (!wormholePostProcessRef.current && camera) {
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

        BABYLON.Effect.ShadersStore["vortexVertexShader"] = `
          precision highp float;
          attribute vec3 position;
          attribute vec2 uv;
          uniform mat4 worldViewProjection;
          varying vec2 vUV;
          void main(void) {
              vUV = uv;
              gl_Position = worldViewProjection * vec4(position, 1.0);
          }
        `;
        BABYLON.Effect.ShadersStore["vortexPixelShader"] = `
          precision highp float;
          varying vec2 vUV;
          uniform float time;

          // Simple 2D noise for star streaks
          float hash(vec2 p) { return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); }
          
          void main(void) {
              vec2 uv = vUV - vec2(0.5);
              float dist = length(uv);
              float angle = atan(uv.y, uv.x);
              
              // Gravitational lensing warp effect
              float warp = 1.0 / (dist * 10.0 + 0.1);
              float spiral = sin(angle * 2.0 - dist * 10.0 + time * 3.0) * 0.5 + 0.5;
              
              float fade = smoothstep(0.5, 0.0, dist);
              
              // Event horizon is black, accretion glow near the edge
              vec3 core = vec3(0.0);
              vec3 accretionGlow = vec3(1.0, 0.8, 0.5) * spiral * warp * 0.2;
              
              // Background blueshifted starlight
              vec3 starColor = vec3(0.6, 0.8, 1.0);
              
              vec3 finalColor = mix(core, accretionGlow + starColor * warp * 0.1, smoothstep(0.02, 0.15, dist));
              gl_FragColor = vec4(finalColor, fade * smoothstep(0.0, 0.1, dist));
          }
        `;

        const vortexMaterial = new BABYLON.ShaderMaterial("vortexMat", scene, {
          vertex: "vortex",
          fragment: "vortex",
        }, {
          attributes: ["position", "uv"],
          uniforms: ["worldViewProjection", "time"]
        });
        vortexMaterial.backFaceCulling = false;
        vortexMaterial.needAlphaBlending = () => true;
        vortexDisc.material = vortexMaterial;
        flyingObjects.push(vortexDisc);

        BABYLON.Effect.ShadersStore["tunnelVertexShader"] = `
          precision highp float;
          attribute vec3 position;
          attribute vec2 uv;
          uniform mat4 worldViewProjection;
          varying vec2 vUV;
          void main(void) {
              vUV = uv;
              gl_Position = worldViewProjection * vec4(position, 1.0);
          }
        `;
        BABYLON.Effect.ShadersStore["tunnelPixelShader"] = `
          precision highp float;
          varying vec2 vUV;
          uniform float time;
          
          // Noise function for relativistic streaks
          float hash(vec2 p) {
              p = fract(p * vec2(123.34, 456.21));
              p += dot(p, p + 45.32);
              return fract(p.x * p.y);
          }

          void main(void) {
              vec2 uv = vUV;
              // Simulate extreme speed and blueshift/redshift
              float speed = time * 8.0;
              
              // Create elongated streaks (starlight smeared by relativistic speeds)
              float streak = hash(vec2(floor(uv.x * 100.0), floor(uv.y * 10.0 + speed)));
              float intensity = smoothstep(0.95, 1.0, streak) * 2.0;
              
              // Base spacetime distortion (subtle gravitational waves)
              float warp = sin(uv.x * 20.0 + time * 2.0) * cos(uv.y * 15.0 - time) * 0.5 + 0.5;
              
              // Doppler shift colors: blue/white ahead
              vec3 blueShift = vec3(0.8, 0.9, 1.0);
              vec3 distortionDark = vec3(0.01, 0.01, 0.02);
              
              vec3 baseColor = mix(distortionDark, blueShift * 0.2, warp);
              vec3 finalColor = baseColor + blueShift * intensity;
              
              float alpha = 0.8 + warp * 0.2;
              gl_FragColor = vec4(finalColor, alpha);
          }
        `;

        tunnelMaterial = new BABYLON.ShaderMaterial("tunnelMat", scene, {
          vertex: "tunnel",
          fragment: "tunnel",
        }, {
          attributes: ["position", "uv"],
          uniforms: ["worldViewProjection", "time"]
        });
        tunnelMesh.material = tunnelMaterial;

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
          if (isTransitActiveRef.current && tunnelMaterial) {
            const elapsedSeconds = (Date.now() - transitStartTime) * 0.001;
            tunnelMaterial.setFloat("time", elapsedSeconds * 5.0);

            const vortex = scene.getMeshByName("vortex_disc");
            if (vortex && vortex.material) {
              (vortex.material as BABYLON.ShaderMaterial).setFloat("time", elapsedSeconds);
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
            console.log("[DEBUG] scene.onPointerObservable POINTERDOWN triggered", pointerInfo);
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

      if (rendererRef.current) {
        rendererRef.current.stopRenderLoop();
        rendererRef.current.dispose();
      }
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="block w-full h-full" id="canvas-babylon" />
  );
};
