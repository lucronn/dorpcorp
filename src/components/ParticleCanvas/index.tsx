import React, { useEffect, useRef } from "react";
import * as BABYLON from "@babylonjs/core";
import { audio } from "../../utils/audio";
import { Particle, projects } from "../../types";
import { drawStageLayoutTemplate, generateTargetsForStage } from "./ParticleUtils";
import { CelestialEntity, ParticleCanvasProps } from "./types";
import {
  blendHexColors as _blendHexColors,
  createDustSplash as _createDustSplash,
  createShatterDebris as _createShatterDebris,
  createSpaghettificationDebris as _createSpaghettificationDebris,
  swallowEntity as _swallowEntity,
  resolveCelestialCollision,
  computeCurlNoise,
  fBmNoise2D,
} from "./PhysicsUtils";
import { ParticleSystemManager } from "./ParticleSystemManager";

import { initializeScene } from "./SceneSetup";
import {
  createCircleTexture,
  generateAdvancedPlanetTexture,
  generateConcentricRingTexture,
  generateDistortedLightwaveTexture,
  createCircularGlowTexture,
  parseColorToRgb,
  generateGalaxyTexture,
  generateNebulaTexture,
} from "./TextureUtils";

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

  const generateInterstellarScene = (width: number, height: number, forceInterstellar: boolean = false) => {
    interstellarSceneGeneratedTimeRef.current = Date.now();
    const entities: CelestialEntity[] = [];
    const isMobile = width < 768;

    // Core Black Hole entity
    const bh: CelestialEntity = {
      id: "blackhole_core",
      type: "blackhole",
      x: width / 2,
      y: height / 2,
      radius: isMobile ? 35 : 65,
      color: "#000000",
      secondaryColor: "#3b82f6",
      mass: 500,
      orbitSpeed: 0,
    };
    entities.push(bh);

    // Orbiting planets and celestial bodies
    const planetColors = ["#60a5fa", "#a855f7", "#ec4899", "#34d399", "#f59e0b"];
    const count = isMobile ? 3 : 5;
    for (let i = 0; i < count; i++) {
      const angle = (i * Math.PI * 2) / count + Math.random() * 0.5;
      const orbitRad = (isMobile ? 140 : 220) + i * (isMobile ? 70 : 110);
      entities.push({
        id: "planet_" + i,
        type: "planet",
        x: width / 2 + Math.cos(angle) * orbitRad,
        y: height / 2 + Math.sin(angle) * orbitRad,
        radius: (isMobile ? 12 : 22) + Math.random() * 12,
        color: planetColors[i % planetColors.length],
        secondaryColor: planetColors[(i + 1) % planetColors.length],
        hasRings: i % 2 === 0,
        ringColor: "#93c5fd",
        orbitRadius: orbitRad,
        orbitAngle: angle,
        orbitSpeed: 0.0012 + Math.random() * 0.0012,
        centerX: width / 2,
        centerY: height / 2,
        mass: 30 + Math.random() * 40,
      });
    }

    celestialEntitiesRef.current = entities;
    return entities;
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
      const dist = 700 + Math.random() * 2000;
      const gx = Math.cos(angle) * dist;
      const gy = Math.sin(angle) * dist;
      const gz = 1400 + Math.random() * 3200; // Far off in the distance
      
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

      // Map 40% of the active particles to the background galaxies
      if (idx % 10 < 4) {
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
        p.z = p.galaxyZ + lz;
      } else {
        if (arch === "BLACKHOLE_CENTRIC" && bh) {
        if (rand < 0.72) {
          p.interstellarType = "blackhole";
          p.interstellarEntityIndex = entities.indexOf(bh);
          p.interstellarEntity = bh;
          const minR = bh.radius * 1.3;
          const maxR = bh.radius * 5.0;
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
          p.z = Math.sin(p.orbitAngle) * rx * 0.55;

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
          p.z = Math.sin(p.orbitAngle) * rx * 0.4;
          p.baseColor = planet.color;
          p.color = p.baseColor;
        } else {
          p.interstellarType = "star";
          p.targetX = Math.random() * width;
          p.targetY = Math.random() * height;
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
            p.z = Math.sin(p.orbitAngle) * rx * 0.4;
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
            p.z = Math.sin(p.orbitAngle) * rx * 0.4;
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
          p.z = (Math.random() - 0.5) * 50;

          p.baseColor = "rgba(120, 80, 220, 0.65)";
          p.color = p.baseColor;
          p.isPlanetRing = false;
        } else {
          p.interstellarType = "star";
          p.targetX = Math.random() * width;
          p.targetY = Math.random() * height;
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
          p.z = (Math.random() - 0.5) * 60;

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
          p.z = Math.sin(p.orbitAngle) * rx * 0.4;
          p.baseColor = planet.color;
          p.color = p.baseColor;
        } else {
          p.interstellarType = "star";
          p.targetX = Math.random() * width;
          p.targetY = Math.random() * height;
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
          p.z = 0;

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
            p.z = Math.sin(p.orbitAngle) * rx * 0.4;
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
            p.z = Math.sin(p.orbitAngle) * rx * 0.4;
            p.baseColor = planet.color;
          }
          p.color = p.baseColor;
        } else {
          p.interstellarType = "star";
          p.targetX = Math.random() * width;
          p.targetY = Math.random() * height;
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
          p.z = (Math.random() - 0.5) * (45 * (1.0 - radFactor));
          
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
          p.targetX = Math.random() * width;
          p.targetY = Math.random() * height;
          p.baseColor = Math.random() > 0.82 ? "#88ffff" : "#ffffff";
          p.color = p.baseColor;
          p.isPlanetRing = false;
        }
      } else {
        p.interstellarType = "star";
        p.targetX = Math.random() * width;
        p.targetY = Math.random() * height;
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
    if (!sceneRef.current || !celestialGroupRef.current) return;
    const scene = sceneRef.current;
    
    celestialEntitiesRef.current.forEach((entity) => {
      if (!entity.id || entity.isDestroyed) return;
      let mesh = celestialMeshInstancesRef.current.get(entity.id);
      if (!mesh) {
        mesh = BABYLON.MeshBuilder.CreateSphere("celestial_" + entity.id, { diameter: entity.radius * 2, segments: 32 }, scene);
        const mat = new BABYLON.StandardMaterial("mat_" + entity.id, scene);
        const rgb = parseColorToRgb(entity.color || "#ffffff");
        mat.diffuseColor = new BABYLON.Color3(rgb.r / 255, rgb.g / 255, rgb.b / 255);
        mat.emissiveColor = new BABYLON.Color3((rgb.r / 255) * 0.4, (rgb.g / 255) * 0.4, (rgb.b / 255) * 0.4);
        mesh.material = mat;
        mesh.parent = celestialGroupRef.current;
        celestialMeshInstancesRef.current.set(entity.id, mesh);
      }
      mesh.position.x = entity.x - window.innerWidth / 2;
      mesh.position.y = -(entity.y - window.innerHeight / 2);
      mesh.position.z = entity.z || 0;
      if (entity.rotation !== undefined) {
        mesh.rotation.y += entity.rotation;
      }
    });
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
    cameraZRef.current = Math.max(10.0, wh / (2 * Math.tan((fovRef.current * Math.PI) / 360)));
    
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
      void main(void) {
          vec2 uv = vUV;
          vec4 baseColor = texture2D(textureSampler, uv);
          if (intensity <= 0.0) {
              gl_FragColor = baseColor;
              return;
          }
          
          vec2 dir = vec2(0.5) - uv;
          float dist = length(dir);
          if (dist > 0.0001) {
              dir = dir / dist;
          } else {
              dir = vec2(0.0);
          }
          
          // Smoothly building radial blur
          float blurAmount = min(time * 0.015, 0.04) * intensity;
          
          vec4 sum = vec4(0.0);
          sum += texture2D(textureSampler, uv + dir * 0.0 * blurAmount);
          sum += texture2D(textureSampler, uv + dir * 0.1 * blurAmount);
          sum += texture2D(textureSampler, uv + dir * 0.2 * blurAmount);
          sum += texture2D(textureSampler, uv + dir * 0.3 * blurAmount);
          sum += texture2D(textureSampler, uv + dir * 0.4 * blurAmount);
          sum += texture2D(textureSampler, uv + dir * 0.5 * blurAmount);
          sum += texture2D(textureSampler, uv + dir * 0.6 * blurAmount);
          sum += texture2D(textureSampler, uv + dir * 0.7 * blurAmount);
          sum += texture2D(textureSampler, uv + dir * 0.8 * blurAmount);
          sum += texture2D(textureSampler, uv + dir * 0.9 * blurAmount);
          sum /= 10.0;
          
          // Subtle, elegant chromatic aberration
          float ca = blurAmount * 0.35;
          sum.r = texture2D(textureSampler, uv + dir * ca).r;
          sum.b = texture2D(textureSampler, uv - dir * ca).b;
          gl_FragColor = mix(baseColor, sum, intensity);
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
        x: Math.random() * ww,
        y: Math.random() * wh,
        z: (Math.random() - 0.5) * 800 - 300,
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
        x: ww / 2 + (Math.random() - 0.5) * ww,
        y: wh / 2 + (Math.random() - 0.5) * wh,
        z: (Math.random() - 0.5) * 500,
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
          
          float twinkle = 0.7 + 0.3 * sin(vPos.x * 12.0 + vPos.y * 12.0);
          
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

          if (p.y < 0) p.y = currentH;
          if (p.y > currentH) p.y = 0;
          if (p.x < 0) p.x = currentW;
          if (p.x > currentW) p.x = 0;

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
          positions[i * 3] = drawAmbX - currentW / 2;
          positions[i * 3 + 1] = -(drawAmbY - currentH / 2);
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
                p.z = Math.sin(p.orbitAngle) * rx * 0.55;
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
                  p.z = Math.sin(p.orbitAngle) * rx * 0.4;
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
                  p.z = Math.sin(p.orbitAngle) * rx * 0.4;
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
              p.z = Math.sin(t * Math.PI) * 15;
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
            p.z = (p.galaxyZ || -1400) + lz;
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

        // Map points to positions
        positions[i * 3] = drawX - currentW / 2;
        positions[i * 3 + 1] = -(drawY - currentH / 2);
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
          shakeIntensity += factor * 16.0;
        } else if (snElapsed >= 1200 && snElapsed < 2200) {
          // Pre-explosion gravitational collapse: subtle low-frequency rumbling
          const factor = (snElapsed - 1200) / 1000;
          shakeIntensity += factor * 2.5;
        }
      }

      // Shaking from high-intensity ripples and galactic shockwaves
      ripplesRef.current.forEach((r) => {
        shakeIntensity += r.life * 4.5;
      });

      if (shockwaveIntensity > 0.01) {
        shakeIntensity += shockwaveIntensity * 14.5;
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
      const cameraZ = Math.max(10.0, currentH / (2 * Math.tan((fovRef.current * Math.PI) / 360)));
      
      // Calculate baseline target coordinates including parallax and scroll Z depth offset
      let finalTargetX = inputs.currentCameraParallaxX;
      let finalTargetY = inputs.currentCameraParallaxY;
      let finalTargetZ = -cameraZ + inputs.currentCameraZDepthOffset;

      if (isInterstellarRef.current) {
        // High-fidelity 3D orbital flyby path for cinematic 360-degree showcase
        const orbitAngle = time * 0.0022; // smooth 360 rotation speed
        const pitchAngle = Math.sin(time * 0.0006) * 0.28 + 0.18; // vertical slow-wave tilt
        const currentRadius = cameraZ * (1.6 + Math.sin(time * 0.0012) * 0.15); // increased distance so objects are not too close

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
        const currentRadius = cameraZ * (1.3 + Math.sin(ssTime * 1.2) * 0.05);

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
            pipeline.bloomWeight = baseBloom + progress * 0.6; // build up
          } else if (snElapsed >= 2200 && snElapsed < 3200) {
            // Supernova detonation phase: cinematic blinding flash!
            const progress = (snElapsed - 2200) / 1000;
            const fadeOut = Math.max(0, 1 - progress);
            pipeline.bloomWeight = baseBloom + fadeOut * 1.8; // intense bloom flare peaks
          } else {
            pipeline.bloomWeight = baseBloom;
          }
        } else {
          // Standard cosmic breathing pulse with an added dynamic neon-blue bloom surge when electrical disturbances occur
          const pulse = Math.sin(time * 0.01) * 0.02;
          const electricSurge = Math.min(1.0, disturbance) * 0.72; // boost bloom weight momentarily on click/interaction
          const shockwaveSurge = shockwaveIntensity * 1.48; // gorgeous screen-wide neon bloom flare during periodic shocks!
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
        const cameraZ = Math.max(10.0, wh / (2 * Math.tan((fovRef.current * Math.PI) / 360)));
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
    let pbrStarLight: BABYLON.PointLight | null = null;
    let transitStartTime = 0;
    let transitCameraZ = 0;

    const startWormholeTransit = async (targetPos?: BABYLON.Vector3, viewDir?: BABYLON.Vector3) => {
      console.log("[DEBUG] startWormholeTransit triggered!");
      console.log("[DEBUG] startWormholeTransit called", { targetPos, viewDir });
      if (isTransitActiveRef.current) return;
      isTransitActiveRef.current = true;
      transitStartTime = Date.now();

      const engine = rendererRef.current;
      if (!scene || !camera || !engine) return;

      // 1. Custom PostProcess: Radial blur & Chromatic Aberration
      wormholeTimeRef.current = 0.0;
      wormholeIntensityRef.current = 1.0;

      // Animate FOV to widen gently
      BABYLON.Animation.CreateAndStartAnimation("fovAnim", camera, "fov", 60, 60, camera.fov, 1.6, 0 /* loop */, new BABYLON.QuadraticEase());

      const origCameraPos = camera.position.clone();
      const dir = viewDir ? viewDir.normalize() : new BABYLON.Vector3(0, 0, 1);
      
      // Look straight ahead in the travel direction to avoid disorienting target-rotation snaps!
      const lookAtPoint = origCameraPos.add(dir.scale(2000));
      camera.setTarget(lookAtPoint);

      const flyDestination = targetPos || origCameraPos.add(dir.scale(1200));
      
      // EASE-IN-OUT: Camera gracefully accelerates and decelerates into and out of the wormhole
      const easeInOut = new BABYLON.CubicEase();
      easeInOut.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);
      BABYLON.Animation.CreateAndStartAnimation("camTransitAnim", camera, "position", 60, 180, origCameraPos, flyDestination, 0, easeInOut);

      // Generate Tube (Transit Tunnel) starting 400 units in front of camera
      const path = [];
      const dirForPath = viewDir ? viewDir.normalize() : new BABYLON.Vector3(0, 0, 1);
      for (let i = 0; i < 60; i++) {
          path.push(origCameraPos.add(dirForPath.scale(400 + i * 45)));
      }
      tunnelMesh = BABYLON.MeshBuilder.CreateTube("wormhole_tunnel", { path: path, radius: 35, sideOrientation: BABYLON.Mesh.BACKSIDE }, scene);
      tunnelMesh.metadata = { dir: dirForPath };

      // Build wormhole entrance portal meshes at tunnel start
      const tunnelStartPos = origCameraPos.add(dirForPath.scale(400));

      const mouthMesh = BABYLON.MeshBuilder.CreateTorus("wormhole_mouth", { diameter: 72, thickness: 3.5, tessellation: 64 }, scene);
      mouthMesh.position = tunnelStartPos;
      mouthMesh.lookAt(origCameraPos);
      
      const mouthMat = new BABYLON.PBRMaterial("mouthMat", scene);
      mouthMat.emissiveColor = new BABYLON.Color3(0.0, 0.9, 1.0); // Neon blue glow
      mouthMat.albedoColor = new BABYLON.Color3(0.05, 0.0, 0.2);
      mouthMat.metallic = 0.9;
      mouthMat.roughness = 0.1;
      mouthMesh.material = mouthMat;
      flyingObjects.push(mouthMesh);

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
        void main(void) {
            vec2 uv = vUV - vec2(0.5);
            float dist = length(uv);
            float angle = atan(uv.y, uv.x);
            
            // Slow, majestic spinning cosmic vortex with low frequency spiral arms
            float spiral = sin(angle * 3.0 - dist * 6.5 + time * 1.8) * 0.5 + 0.5;
            float fade = smoothstep(0.5, 0.0, dist);
            
            // Blend beautiful nebulous colors: violet-magenta and electric azure
            vec3 deepViolet = vec3(0.42, 0.0, 0.85);
            vec3 cosmicAzure = vec3(0.0, 0.72, 1.0);
            vec3 color = mix(deepViolet, cosmicAzure, spiral);
            
            // Soft ethereal glow rather than harsh overexposure
            gl_FragColor = vec4(color * 1.3, fade * 0.85);
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
        void main(void) {
            vec2 uv = vUV;
            
            // Gentle, slow-moving plasma wave flow
            float slowWave1 = sin(uv.y * 8.0 - time * 1.5 + sin(uv.x * 3.0)) * 0.5 + 0.5;
            float slowWave2 = cos(uv.y * 14.0 - time * 1.0 + cos(uv.x * 5.0)) * 0.5 + 0.5;
            
            // Soft neon fibers / glowing threads that glide rather than strobe
            float fiberPattern = sin(uv.x * 12.0 + time * 0.5) * cos(uv.y * 22.0 - time * 1.2) * 0.5 + 0.5;
            float softFiber = pow(fiberPattern, 3.0);
            
            vec3 spaceBlue = vec3(0.01, 0.04, 0.18);
            vec3 purpleNeon = vec3(0.38, 0.0, 0.72);
            vec3 electricCyan = vec3(0.0, 0.75, 0.95);
            
            vec3 baseColor = mix(spaceBlue, purpleNeon, slowWave1 * 0.6);
            baseColor = mix(baseColor, electricCyan, slowWave2 * 0.35);
            
            vec3 finalColor = baseColor + electricCyan * softFiber * 1.4;
            float alpha = 0.55 + slowWave1 * 0.2 + softFiber * 0.25;
            
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

      // Populate with abstract geometries
      
      const dirForObjs = viewDir ? viewDir.normalize() : new BABYLON.Vector3(0, 0, 1);
      for (let i = 0; i < 20; i++) {
          let mesh = i % 2 === 0 ? BABYLON.MeshBuilder.CreateTorusKnot("tk" + i, {radius: 2, tube: 0.5}, scene) : BABYLON.MeshBuilder.CreatePolyhedron("ph" + i, {type: 2, size: 3}, scene);
          // Distribute along the tunnel direction
          const forwardOffset = Math.random() * 1000 + 100;
          const radialOffset = new BABYLON.Vector3((Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, 0);
          mesh.position = origCameraPos.add(dirForObjs.scale(forwardOffset)).add(radialOffset);
          
          let mat = new BABYLON.StandardMaterial("std" + i, scene);
          mat.emissiveColor = new BABYLON.Color3(Math.random(), Math.random(), Math.random());
          mat.wireframe = true;
          mesh.material = mat;
          flyingObjects.push(mesh);
      }

      // 3. New Solar System (After 3 seconds)
      setTimeout(() => {
          try {
          if (!scene || scene.isDisposed) return;
          const geminiData = nextGeminiSceneRef.current;
          
          scene.stopAnimation(camera);
          camera.animations = [];

          // Decelerate camera & restore FOV
          BABYLON.Animation.CreateAndStartAnimation("fovAnimRest", camera, "fov", 60, 60, camera.fov, fovRef.current * Math.PI / 180 || 1.0, 0, new BABYLON.QuadraticEase());

          // Warp camera to give the illusion of exiting the wormhole, then glide to rest position
          camera.position = new BABYLON.Vector3(0, 0, -cameraZRef.current - 1500);
          camera.setTarget(BABYLON.Vector3.Zero());
          
          const restStartPos = camera.position.clone();
          BABYLON.Animation.CreateAndStartAnimation(
              "camRestAnim", 
              camera, 
              "position", 
              60, 
              90, 
              restStartPos, 
              new BABYLON.Vector3(0, 0, -cameraZRef.current), 
              0, 
              new BABYLON.CubicEase(),
              () => {
                  isTransitActiveRef.current = false;
                  if (cameraRef.current) {
                      transitionStartTimeRef.current = Date.now();
                      transitionActiveRef.current = true;
                      transitionStartPosRef.current = cameraRef.current.position.clone();
                  }
                  if (animationComplete) {
                      animationComplete();
                  }
              }
          );
          
          console.log("[DEBUG] Turning off wormholePostProcess intensity");
          wormholeIntensityRef.current = 0.0;
          if (wormholePostProcessRef.current) {
              wormholePostProcessRef.current.dispose();
              wormholePostProcessRef.current = null;
          }
                    
          if (tunnelMesh) {
              tunnelMesh.dispose();
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
          tunnelMesh = null;

          const ww = window.innerWidth;
          const wh = window.innerHeight;


          isInterstellarRef.current = true;

          // Generate Pristine Solar System using high-fidelity engine and our fetched Gemini scene data
          if (geminiData) {
              nextGeminiSceneRef.current = geminiData; 
          }
          generateInterstellarScene(ww, wh, true);
          mapParticlesToInterstellar(ww, wh);
          } catch (e) {
              console.error("[DEBUG] Error inside transit setTimeout:", e);
              isTransitActiveRef.current = false;
          }
      }, 3000);
    };

    const triggerPlanetaryFlyby = (targetNode: any) => {
        if (!camera || isTransitActiveRef.current) return;
        isTransitActiveRef.current = true;
        const targetPos = targetNode.getAbsolutePosition().clone();
        // Cinematic flyby: animate camera to a point near the planet
        const offset = new BABYLON.Vector3(250, 150, 350);
        const flyToPos = targetPos.add(offset);
        
        BABYLON.Animation.CreateAndStartAnimation("camFly", camera, "position", 60, 120, camera.position, flyToPos, 0, new BABYLON.CubicEase(), () => {
            isTransitActiveRef.current = false;
        });
        BABYLON.Animation.CreateAndStartAnimation("camTarget", camera, "target", 60, 120, camera.getTarget(), targetPos, 0, new BABYLON.CubicEase());
    };

    let transitObserver: BABYLON.Observer<BABYLON.Scene> | null = null;
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
                m.position.subtractInPlace(moveDir.scale(5));
                m.rotation.x += 0.05;
                m.rotation.y += 0.05;
                // If it goes behind the camera, wrap it to the front
                if (camera && BABYLON.Vector3.Distance(m.position, camera.position) < 50) {
                     m.position.addInPlace(moveDir.scale(1000));
                }
            });
        } else if (!isTransitActiveRef.current) { if (transitObserver) { scene.onBeforeRenderObservable.remove(transitObserver); transitObserver = null; } }
        // Very basic rotation for PBR planets
        if (!isTransitActiveRef.current && pbrPlanets.length > 1) {
            for (let i = 1; i < pbrPlanets.length; i++) {
                const p = pbrPlanets[i];
                p.position.x = p.position.x * Math.cos(0.001) - p.position.z * Math.sin(0.001);
                p.position.z = p.position.x * Math.sin(0.001) + p.position.z * Math.cos(0.001);
                p.rotation.y += 0.01;
            }
        }
    });

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