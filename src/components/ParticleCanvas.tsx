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
} from "./ParticleCanvas/TextureUtils";

export const ParticleCanvas: React.FC<ParticleCanvasProps> = ({
  stage,
  isInterstellar = false,
  onTransitionToInterstellar,
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
  const hudPlaneRef = useRef<BABYLON.Mesh | null>(null);
  const hudTextureRef = useRef<BABYLON.DynamicTexture | null>(null);
  const celestialGroupRef = useRef<BABYLON.TransformNode | null>(null);
  const celestialMeshInstancesRef = useRef<
    { id: string; mesh: BABYLON.TransformNode | BABYLON.Mesh; entityRef: CelestialEntity }[]
  >([]);

  // Simulation State Refs
  const nextGeminiSceneRef = useRef<any>(null);
  const isFetchingGeminiRef = useRef<boolean>(false);
  const stageTargetsRef = useRef<{ x: number; y: number; color: string }[][]>(
    [],
  );
  const particlesRef = useRef<Particle[]>([]);
  const stageRef = useRef(stage);
  const isInterstellarRef = useRef(isInterstellar);
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

  const generateInterstellarScene = (width: number, height: number) => {
    const entities: CelestialEntity[] = [];
    const isMobile = width < 768;

    // Try to consume pre-fetched Gemini scene first
    const geminiData = nextGeminiSceneRef.current;
    if (geminiData) {
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

      // Position entities Procedurally & Gracefully
      // If there is a blackhole, find and place it first at (cx, cy)
      const bhEntity = geminiData.entities.find((e: any) => e.type === "blackhole");
      if (bhEntity) {
        entities.push({
          type: "blackhole",
          x: cx,
          y: cy,
          radius: bhEntity.radius,
          color: bhEntity.color,
          secondaryColor: bhEntity.secondaryColor || bhEntity.color,
          vx: 0,
          vy: 0,
          mass: bhEntity.radius * bhEntity.radius * 15,
          initialMass: bhEntity.radius * bhEntity.radius * 15,
          scale: 0,
          currentRadius: bhEntity.radius,
          originalRadius: bhEntity.radius,
          targetRadius: bhEntity.radius,
          isPhysicsEnabled: false,
          isDestroyed: false,
        });
      }

      // Filter and place non-blackhole entities
      const otherEntities = geminiData.entities.filter((e: any) => e.type !== "blackhole");
      otherEntities.forEach((entity: any, idx: number) => {
        const orbitRad = (isMobile ? 140 : 220) + idx * (isMobile ? 70 : 110);
        const angle = Math.random() * Math.PI * 2;
        // Slow down orbit speed by half to meet "slow it down" request
        const orbitSpeed = (0.0012 + Math.random() * 0.0012);

        entities.push({
          type: entity.type,
          x: cx + Math.cos(angle) * orbitRad,
          y: cy + Math.sin(angle) * orbitRad,
          radius: entity.radius,
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
          mass: entity.radius * entity.radius,
          initialMass: entity.radius * entity.radius,
          scale: 0,
          currentRadius: entity.radius,
          originalRadius: entity.radius,
          targetRadius: entity.radius,
          isPhysicsEnabled: false,
          isDestroyed: false,
        });
      });

      celestialEntitiesRef.current = entities;
      interstellarSceneGeneratedTimeRef.current = Date.now();

      if (onSequenceGenerated) {
        onSequenceGenerated({
          name: systemName,
          description: systemDesc,
          tags: systemTags,
        });
      }
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
        const orbitRad = (isMobile ? 180 : 280) + p * (isMobile ? 80 : 130);
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

      const separation = isMobile ? 120 : 220;
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

      const r = isMobile ? 120 : 200;

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

    celestialEntitiesRef.current = entities;
    interstellarSceneGeneratedTimeRef.current = Date.now();

    if (onSequenceGenerated) {
      onSequenceGenerated({
        name: systemName,
        description: systemDesc,
        tags: systemTags,
      });
    }
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
    const entities = celestialEntitiesRef.current;
    if (entities.length === 0) return;
    const bh = entities.find((e) => e.type === "blackhole");
    const planets = entities.filter((e) => e.type === "planet");
    const nebulas = entities.filter((e) => e.type === "nebula");
    const arch = archetypeRef.current || "BLACKHOLE_CENTRIC";

    const nonAmbientParticles = particlesRef.current.filter(
      (p) => !p.isCosmicAmbient,
    );

    nonAmbientParticles.forEach((p, idx) => {
      const rand = Math.random();

      if (arch === "BLACKHOLE_CENTRIC" && bh) {
        if (rand < 0.72) {
          p.interstellarType = "blackhole";
          p.interstellarEntityIndex = entities.indexOf(bh);
          const minR = bh.radius * 1.3;
          const maxR = bh.radius * 5.0;
          p.orbitRadius = minR + Math.random() * (maxR - minR);
          p.orbitAngle = Math.random() * Math.PI * 2;
          p.orbitSpeed = 0.015 + Math.random() * 0.015;

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
          p.orbitRadius = planet.radius * (1.1 + Math.random() * 0.6);
          p.orbitAngle = Math.random() * Math.PI * 2;
          p.orbitSpeed = 0.015 + Math.random() * 0.015;
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

          const ringRand = Math.random();
          if (ringRand > 0.3) {
            const minR = planet.radius * 1.2;
            const maxR = planet.radius * 2.8;
            p.orbitRadius = minR + Math.random() * (maxR - minR);
            p.orbitAngle = Math.random() * Math.PI * 2;
            p.orbitSpeed =
              (0.018 + Math.random() * 0.018) * (planet.radius / p.orbitRadius);
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
            p.orbitSpeed = 0.014 + Math.random() * 0.014;
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
          p.orbitRadius = planet.radius * (1.1 + Math.random() * 0.6);
          p.orbitAngle = Math.random() * Math.PI * 2;
          p.orbitSpeed = 0.015 + Math.random() * 0.01;
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
          p.bridgeEndEntityIndex = entities.indexOf(
            planets[endIdx] || planets[1],
          );
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
        } else if (rand < 0.85) {
          p.interstellarType = "planet";
          const planet = planets[idx % planets.length];
          p.interstellarEntityIndex = entities.indexOf(planet || planets[0]);

          const ringRand = Math.random();
          if (planet.hasRings && ringRand > 0.4) {
            const minR = planet.radius * 1.3;
            const maxR = planet.radius * 2.5;
            p.orbitRadius = minR + Math.random() * (maxR - minR);
            p.orbitAngle = Math.random() * Math.PI * 2;
            p.orbitSpeed =
              (0.015 + Math.random() * 0.015) * (planet.radius / p.orbitRadius);
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
            p.orbitSpeed = 0.015 + Math.random() * 0.015;
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
          p.vx = (Math.random() - 0.5) * 65;
          p.vy = (Math.random() - 0.5) * 65;
          p.vz = (Math.random() - 0.5) * 110;
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

    const texture = hudTextureRef.current;
    const context = texture.getContext() as CanvasRenderingContext2D | null;
    if (!context) return;
    context.clearRect(0, 0, ww, wh);
    drawStageLayoutTemplate(context, targetStage, ww, wh, "full");
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
    const scene = sceneRef.current;
    const group = celestialGroupRef.current;
    if (!scene || !group) return;

    const ww = window.innerWidth;
    const wh = window.innerHeight;

    const entities = celestialEntitiesRef.current;
    const sceneAge = (Date.now() - interstellarSceneGeneratedTimeRef.current) / 1000;
    const musicAmp = (audio as any).getMusicAmplitude();

    // Automatic Calming Cosmic Shift transition after 120 seconds
    if (isInterstellarRef.current && sceneAge > 120.0 && !supernovaRef.current) {
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

      if (onSequenceGenerated) {
        onSequenceGenerated({
          name: "Stellar Nucleus Birth",
          description: "Stardust accretion has crossed a critical mass point. A young planet is birthed into decaying orbit, pulled by the master gravitational field.",
          tags: ["★ STAR NURSERY", "☄ CORE CONCRETION", "★ INWARD SPIRAL"]
        });
      }
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
              p.bridgeEndEntityIndex = idx2;
              p.bridgeProgress = Math.random();
              p.bridgeSpeed = 0.007 + Math.random() * 0.015;
              bridgeCount++;
            }
          });

          audio.playStageSwell(1); // deep zimmer-like chord shift

          if (onSequenceGenerated) {
            onSequenceGenerated({
              name: "Wormhole Bridge Activated",
              description: "A localized quantum bridge has bent spacetime between two orbits. Hot stellar plasma particles funnel instantly through the dimensional throat.",
              tags: ["🕳 ER BRIDGE", "☄ SPATIAL WARP", "★ BENT METRIC"]
            });
          }
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

        if (onSequenceGenerated) {
          onSequenceGenerated({
            name: isNeutronStar ? "Neutron Star Synthesis" : "Micro Singularity Formation",
            description: isNeutronStar 
              ? "A massive star has collapsed under gravity, fusing its protons and electrons into a super-dense, spinning neutron core."
              : "A dying star core collapsed past its Schwarzschild radius, punching a miniature hole in the fabric of space.",
            tags: [isNeutronStar ? "★ COMPACT STAR" : "🕳 SINGULARITY", "☄ CORE COLLAPSE", "★ LOCAL NEBULA"]
          });
        }
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

        if (onSequenceGenerated) {
          onSequenceGenerated({
            name: "Gravitational Coalescence",
            description: "Twin protoplanetary bodies are pulled onto a head-on collision course. High electromagnetic resistance compresses spacetime before contact.",
            tags: ["☄ TWIN CORES", "☄ VECTOR COLLISION", "★ REPULSION"]
          });
        }
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

        if (onSequenceGenerated) {
          onSequenceGenerated({
            name: "Stelliferous Condensation",
            description: "An interstellar gas cloud is cooling and condensing, creating a vibrant nebula of ionized cosmic plasma.",
            tags: ["★ IONIZED GAS", "☄ NEBULA DRIVEN", "★ STAR NURSERY"]
          });
        }
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
      
      // Trigger a "wow" factor scene if it gets large enough, or if it's the last planet
      const initialBhMass = bh.initialMass || (bh.radius * bh.radius * 15);
      const activeCount = entities.filter(e => !e.isDestroyed).length;
      if ((newMass > initialBhMass * 1.5 || activeCount <= 1) && !supernovaRef.current) {
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

      const newMass = (survivor.mass || 10) + (victim.mass || 10);
      survivor.mass = newMass;
      
      // Grow survivor's radius based on new mass
      const targetRadius = Math.min(survivor.radius * 1.5, Math.sqrt(newMass));
      survivor.targetRadius = targetRadius;

      const midX = (survivor.x + victim.x) / 2;
      const midY = (survivor.y + victim.y) / 2;

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

      if (onSequenceGenerated) {
        onSequenceGenerated({
          name: "Planetary Coalescence",
          description: "Two cosmic bodies collide, merging into a larger planet and seeding a fresh stardust ring in their orbital plane.",
          tags: ["🪐 COALESCENCE", "☄ KINETIC MERGER", "★ MASS ACCRETION"]
        });
      }
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
          const dist = Math.sqrt(dx * dx + dy * dy);
          const colDist = e1.radius + e2.radius;

          if (dist < colDist) {
            if (e1.type === "blackhole") {
              swallowEntity(e1, e2);
            } else if (e2.type === "blackhole") {
              swallowEntity(e2, e1);
            } else {
              if (e1.radius >= e2.radius) {
                mergeEntities(e1, e2);
              } else {
                mergeEntities(e2, e1);
              }
            }
          }
        }
      }
    }

    // Detect if we need to rebuild meshes
    const activeIds = entities.map((e, idx) => `${e.type}-${idx}-${e.rebuildKey || 0}`);
    const existingIds = celestialMeshInstancesRef.current.map(
      (inst) => inst.id,
    );
    const needsRebuild = activeIds.join(",") !== existingIds.join(",");

    if (needsRebuild) {
      // Rebuild all meshes in Babylon.js
      if (celestialGroupRef.current) {
        celestialGroupRef.current.getChildMeshes(false).forEach((m) => m.dispose());
        celestialGroupRef.current.getChildren().forEach((c) => c.dispose());
      }
      celestialMeshInstancesRef.current = [];

      entities.forEach((entity, idx) => {
        const entityId = `${entity.type}-${idx}-${entity.rebuildKey || 0}`;
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
          const diskMat1 = new BABYLON.StandardMaterial("diskMat1", scene);
          diskMat1.diffuseTexture = diskTex1;
          diskMat1.emissiveTexture = diskTex1;
          diskMat1.disableLighting = true;
          diskMat1.backFaceCulling = false;
          diskMat1.alphaMode = BABYLON.Engine.ALPHA_ONEONE;
          diskMat1.useAlphaFromDiffuseTexture = true;
          diskMat1.disableDepthWrite = true;
          diskMat1.alpha = 0.95;

          const diskMesh1 = BABYLON.MeshBuilder.CreatePlane("accretion_layer_1", {
            width: diskRadius * 2,
            height: diskRadius * 2,
            sideOrientation: BABYLON.Mesh.DOUBLESIDE
          }, scene);
          diskMesh1.material = diskMat1;
          diskMesh1.rotation.x = Math.PI / 2.3;
          diskMesh1.parent = bhContainer;

          // Accretion disk - Layer 2: Opposing-spin golden wave warp (slightly tilted)
          const diskTex2 = generateDistortedLightwaveTexture("#ffdf00", scene);
          const diskMat2 = new BABYLON.StandardMaterial("diskMat2", scene);
          diskMat2.diffuseTexture = diskTex2;
          diskMat2.emissiveTexture = diskTex2;
          diskMat2.disableLighting = true;
          diskMat2.backFaceCulling = false;
          diskMat2.alphaMode = BABYLON.Engine.ALPHA_ONEONE;
          diskMat2.useAlphaFromDiffuseTexture = true;
          diskMat2.disableDepthWrite = true;
          diskMat2.alpha = 0.75;

          const diskMesh2 = BABYLON.MeshBuilder.CreatePlane("accretion_layer_2", {
            width: diskRadius * 2,
            height: diskRadius * 2,
            sideOrientation: BABYLON.Mesh.DOUBLESIDE
          }, scene);
          diskMesh2.material = diskMat2;
          diskMesh2.rotation.x = Math.PI / 2.45;
          diskMesh2.rotation.y = 0.12;
          diskMesh2.parent = bhContainer;

          // Accretion disk - Layer 3: Gravitational lensing ring (outer halo, near perpendicular view)
          const lensRadius = entity.radius * 4.6;
          const diskTex3 = generateDistortedLightwaveTexture("#ffffff", scene);
          const diskMat3 = new BABYLON.StandardMaterial("diskMat3", scene);
          diskMat3.diffuseTexture = diskTex3;
          diskMat3.emissiveTexture = diskTex3;
          diskMat3.disableLighting = true;
          diskMat3.backFaceCulling = false;
          diskMat3.alphaMode = BABYLON.Engine.ALPHA_ONEONE;
          diskMat3.useAlphaFromDiffuseTexture = true;
          diskMat3.disableDepthWrite = true;
          diskMat3.alpha = 0.45;

          const diskMesh3 = BABYLON.MeshBuilder.CreatePlane("gravitational_lensing", {
            width: lensRadius * 2,
            height: lensRadius * 2,
            sideOrientation: BABYLON.Mesh.DOUBLESIDE
          }, scene);
          diskMesh3.material = diskMat3;
          diskMesh3.rotation.x = Math.PI / 2.1;
          diskMesh3.rotation.y = -0.08;
          diskMesh3.parent = bhContainer;

          // 2. Event Horizon Shadow
          const ehMat = new BABYLON.StandardMaterial("ehMat", scene);
          ehMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
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
          const coronaMat = new BABYLON.StandardMaterial("coronaMat", scene);
          coronaMat.diffuseTexture = coronaTex;
          coronaMat.emissiveTexture = coronaTex;
          coronaMat.disableLighting = true;
          coronaMat.backFaceCulling = false;
          coronaMat.alphaMode = BABYLON.Engine.ALPHA_ONEONE;
          coronaMat.useAlphaFromDiffuseTexture = true;
          coronaMat.disableDepthWrite = true;
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

          // 1. Planet sphere
          const planetTexture = generateAdvancedPlanetTexture(
            entity.color,
            entity.secondaryColor || entity.color,
            scene
          );

          const sphereMat = new BABYLON.StandardMaterial("sphereMat", scene);
          sphereMat.diffuseTexture = planetTexture;
          sphereMat.bumpTexture = planetTexture;
          sphereMat.specularColor = new BABYLON.Color3(0.08, 0.08, 0.08);
          if (sphereMat.bumpTexture) {
            sphereMat.bumpTexture.level = 0.5;
          }

          const sphereMesh = BABYLON.MeshBuilder.CreateSphere("planet_sphere", {
            diameter: entity.radius * 2,
            segments: 64
          }, scene);
          sphereMesh.material = sphereMat;
          sphereMesh.parent = planetContainer;

          // 2. Striated rings
          if (entity.hasRings) {
            const ringTexture = generateConcentricRingTexture(entity.ringColor || entity.color, scene);
            if (ringTexture) {
              const ringMat = new BABYLON.StandardMaterial("ringMat", scene);
              ringMat.diffuseTexture = ringTexture;
              ringMat.emissiveTexture = ringTexture;
              ringMat.disableLighting = true;
              ringMat.backFaceCulling = false;
              ringMat.disableDepthWrite = true;
              ringMat.alpha = 0.85;
              ringMat.alphaMode = BABYLON.Engine.ALPHA_ONEONE;
              ringMat.useAlphaFromDiffuseTexture = true;

              const ringMesh = BABYLON.MeshBuilder.CreatePlane("ring_mesh", {
                width: entity.radius * 4.8,
                height: entity.radius * 4.8,
                sideOrientation: BABYLON.Mesh.DOUBLESIDE
              }, scene);
              ringMesh.material = ringMat;
              ringMesh.rotation.x = Math.PI / 2.3;
              ringMesh.rotation.y = 0.15;
              ringMesh.parent = planetContainer;
            } else {
              const ringMat = new BABYLON.StandardMaterial("ringMatFallback", scene);
              const rCol = parseColorToRgb(entity.ringColor || entity.color);
              ringMat.emissiveColor = new BABYLON.Color3(rCol.r / 255, rCol.g / 255, rCol.b / 255);
              ringMat.disableLighting = true;
              ringMat.backFaceCulling = false;
              ringMat.disableDepthWrite = true;
              ringMat.alpha = 0.65;

              const ringMesh = BABYLON.MeshBuilder.CreateDisc("ring_fallback", {
                radius: entity.radius * 2.3,
                tessellation: 64,
                sideOrientation: BABYLON.Mesh.DOUBLESIDE
              }, scene);
              ringMesh.material = ringMat;
              ringMesh.rotation.x = Math.PI / 2.8;
              ringMesh.rotation.y = 0.15;
              ringMesh.parent = planetContainer;
            }
          }

          // Atmosphere Glow
          const atmosphereGlowTex = createCircularGlowTexture(
            hexToRgba(entity.color, 0.45),
            scene
          );
          const atmosphereGlowMat = new BABYLON.StandardMaterial("atmosphereGlowMat", scene);
          atmosphereGlowMat.diffuseTexture = atmosphereGlowTex;
          atmosphereGlowMat.emissiveTexture = atmosphereGlowTex;
          atmosphereGlowMat.disableLighting = true;
          atmosphereGlowMat.backFaceCulling = false;
          atmosphereGlowMat.alphaMode = BABYLON.Engine.ALPHA_ONEONE;
          atmosphereGlowMat.useAlphaFromDiffuseTexture = true;
          atmosphereGlowMat.disableDepthWrite = true;
          atmosphereGlowMat.alpha = 0.65;

          const atmosphereGlowMesh = BABYLON.MeshBuilder.CreatePlane("atmosphere_glow", {
            width: entity.radius * 2.8,
            height: entity.radius * 2.8,
            sideOrientation: BABYLON.Mesh.DOUBLESIDE
          }, scene);
          atmosphereGlowMesh.material = atmosphereGlowMat;
          atmosphereGlowMesh.position.z = -1;
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
          const nebTex = createCircularGlowTexture(entity.color, scene);
          const nebMat = new BABYLON.StandardMaterial("nebMat", scene);
          nebMat.diffuseTexture = nebTex;
          nebMat.emissiveTexture = nebTex;
          nebMat.disableLighting = true;
          nebMat.backFaceCulling = false;
          nebMat.alphaMode = BABYLON.Engine.ALPHA_ONEONE;
          nebMat.useAlphaFromDiffuseTexture = true;
          nebMat.disableDepthWrite = true;
          nebMat.alpha = 0.45;

          const nebMesh = BABYLON.MeshBuilder.CreatePlane("nebula_plane", {
            width: entity.radius * 2.4,
            height: entity.radius * 2.4,
            sideOrientation: BABYLON.Mesh.DOUBLESIDE
          }, scene);
          nebMesh.material = nebMat;
          nebMesh.position.set(wx, wy, -100);

          nebMesh.scaling.set(initScale, initScale, initScale);
          if (celestialGroupRef.current) {
            nebMesh.parent = celestialGroupRef.current;
          }
          celestialMeshInstancesRef.current.push({
            id: entityId,
            mesh: nebMesh,
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

          // 2. High-energy pulsing outer plasma aura
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
          auraMat.disableDepthWrite = true;
          auraMat.alpha = 0.9;

          const auraMesh = BABYLON.MeshBuilder.CreatePlane("star_aura", {
            width: entity.radius * 3.5,
            height: entity.radius * 3.5,
            sideOrientation: BABYLON.Mesh.DOUBLESIDE
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
    } else {
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

        const finalScale = entity.scale * radiusScale;

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

          inst.mesh.position.set(wx, wy, meshZ);
          
          // Spin spheres/disks using Babylon getChildMeshes
          inst.mesh.getChildMeshes().forEach((child) => {
            if (child.name === "planet_sphere" || child.name === "star_core") {
              child.rotation.y += 0.005;
            } else if (child.name.indexOf("accretion_layer_1") !== -1) {
              child.rotation.z += 0.007;
              const pulse = 1.0 + Math.sin(Date.now() * 0.0035) * 0.05 + musicAmp * 0.25;
              child.scaling.set(pulse, pulse, pulse);
            } else if (child.name.indexOf("accretion_layer_2") !== -1) {
              child.rotation.z -= 0.011;
              const pulse = 1.0 + Math.cos(Date.now() * 0.0025) * 0.04 + musicAmp * 0.2;
              child.scaling.set(pulse, pulse, pulse);
            } else if (child.name.indexOf("gravitational_lensing") !== -1) {
              child.rotation.z += 0.003;
              const pulse = 1.0 + Math.sin(Date.now() * 0.0015) * 0.06 + musicAmp * 0.3;
              child.scaling.set(pulse, pulse, pulse);
            } else {
              child.rotation.z += 0.003;
            }
          });
        } else {
          inst.mesh.position.set(wx, wy, -30);
          if (cameraRef.current) {
            inst.mesh.rotation.copyFrom(cameraRef.current.rotation);
          }
        }
      });
    }

    // 5. Dynamic Group Opacity Transition: Elegant background fade based on isInterstellar stage
    let targetGroupOpacity = isInterstellarRef.current ? 1.0 : 0.32;
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
            mat.metadata = { baseOpacity: mat.alpha ?? 1.0 };
          }
          const baseOpacity = mat.metadata.baseOpacity;
          const musicPulseOpacity = 0.38 * musicAmp;
          mat.alpha = baseOpacity * (targetGroupOpacity + musicPulseOpacity * (1 - targetGroupOpacity));
        }
      });
    }
  };

  useEffect(() => {
    isInterstellarRef.current = isInterstellar;
  }, [isInterstellar]);

  useEffect(() => {
    const prevStage = stageRef.current;
    stageRef.current = stage;
    lastStageChangeRef.current = Date.now();

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
    cameraZRef.current = wh / (2 * Math.tan((fovRef.current * Math.PI) / 360));
    
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
    pipeline.bloomEnabled = false;
    composerRef.current = pipeline;

    // Direct lighting & ambient light setup
    const ambientLight = new BABYLON.HemisphericLight("ambientLight", new BABYLON.Vector3(0, 1, 0), scene);
    ambientLight.intensity = 0.4;

    const dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(-150, -250, -400), scene);
    dirLight.intensity = 0.95;

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
    const hudTexture = new BABYLON.DynamicTexture("hudTex", { width: ww, height: wh }, scene, false);
    const hudCtx = hudTexture.getContext() as CanvasRenderingContext2D | null;
    if (hudCtx) {
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
    hudMaterial.disableDepthWrite = true;
    hudMaterial.alpha = 0.82;

    const hudPlane = BABYLON.MeshBuilder.CreatePlane("hudPlane", { width: ww, height: wh }, scene);
    hudPlane.material = hudMaterial;

    const planeZ = -60;
    const scaleFactor = (cameraZRef.current + planeZ) / cameraZRef.current;
    hudPlane.scaling.set(scaleFactor, scaleFactor, 1);
    hudPlane.position.set(0, 0, planeZ);
    hudPlane.isVisible = false; // Completely hide background outline vectors so only particles are seen
    hudPlaneRef.current = hudPlane;

    // 3. Particle System Instantiation
    const isMobileDevice =
      /iPad|iPhone|iPod|Android/i.test(navigator.userAgent) || ww < 768;
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
        if (extraData > 1.5) {
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
      void main(void) {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord);
        if (dist > 0.5) discard;
        
        float alpha = 0.0;
        
        // Soft gaussian-like falloff for anti-aliasing
        float gaussian = exp(-dist * dist * 12.0);
        
        if (vExtra > 1.5) {
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
        gl_FragColor = vec4(finalColor, 1.0);
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
    pointsMaterial.disableDepthWrite = true;
    pointsMesh.material = pointsMaterial;
    pointsMesh.hasVertexAlpha = true;
    pointsMesh.alwaysSelectAsActiveMesh = true;

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
          activeSupernova.transitioned = true;
          if (onTransitionToInterstellar) {
            onTransitionToInterstellar();
          }
          const ww = window.innerWidth;
          const wh = window.innerHeight;
          generateInterstellarScene(ww, wh);
          mapParticlesToInterstellar(ww, wh);
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

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (!p) continue;

        if (p.isTail) {
          if (p.life && p.life > 0) {
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

            const tailOpacity = p.life * 0.45;
            colors[i * 4] = (r / 255) * globalAlpha * tailOpacity;
            colors[i * 4 + 1] = (g / 255) * globalAlpha * tailOpacity;
            colors[i * 4 + 2] = (b / 255) * globalAlpha * tailOpacity;
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

          // Map ambient particles to Babylon.js positions
          positions[i * 3] = p.x - currentW / 2;
          positions[i * 3 + 1] = -(p.y - currentH / 2);
          positions[i * 3 + 2] = p.z;

          // Simple white or dim ambient color
          colors[i * 4] = p.color === "#ffffff" ? 0.8 : 0.9;
          colors[i * 4 + 1] = p.color === "#ffffff" ? 0.8 : 0.8;
          colors[i * 4 + 2] = p.color === "#ffffff" ? 0.8 : 0.7;
          colors[i * 4 + 3] = 1.0;
          extras[i] = 0.0;
          continue;
        }

        p.vy -= scrollVelocityRef.current * 0.16;
        p.vx +=
          Math.sin(i * 0.05 + time * 0.1) *
          Math.abs(scrollVelocityRef.current) *
          0.03;

        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;

        p.vx *= 0.86;
        p.vy *= 0.86;
        p.vz *= 0.86;

        if (isInterstellarRef.current && p.interstellarType) {
          if (
            p.interstellarType === "blackhole" ||
            p.interstellarType === "planet"
          ) {
            p.orbitAngle = (p.orbitAngle || 0) + (p.orbitSpeed || 0.005) * 0.45;
            let entity =
              celestialEntitiesRef.current[p.interstellarEntityIndex || 0];

            if (entity && entity.isDestroyed) {
              const activeEntityIdx = celestialEntitiesRef.current.findIndex(e => e && !e.isDestroyed && e.type === "blackhole");
              if (activeEntityIdx !== -1) {
                p.interstellarEntityIndex = activeEntityIdx;
                p.orbitRadius = (p.orbitRadius || 50) * 0.96;
                entity = celestialEntitiesRef.current[activeEntityIdx];
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
            p.orbitAngle = (p.orbitAngle || 0) + (p.orbitSpeed || 0.002) * 0.45;
            const entity =
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
              (p.bridgeProgress ?? 0) + (p.bridgeSpeed ?? 0.012) * 0.45;
            if (p.bridgeProgress > 1) {
              p.bridgeProgress = 0;
            }
            const start =
              celestialEntitiesRef.current[p.bridgeStartEntityIndex ?? 0];
            const end =
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
          celestialEntitiesRef.current.forEach((entity) => {
            if (entity.isDestroyed) return;
            const bdx = entity.x - p.x;
            const bdy = entity.y - p.y;
            const bdist = Math.sqrt(bdx * bdx + bdy * bdy) || 1;

            if (entity.type === "blackhole") {
              if (bdist < entity.radius * gravityRadiusMult) {
                const pullFactor = 1.0 - bdist / (entity.radius * gravityRadiusMult);
                suctionAlpha = Math.max(suctionAlpha, pullFactor * (isInterstellarRef.current ? 1.0 : 0.3));

                const basePullStrength = isInterstellarRef.current ? 4.8 : 1.4;
                p.vx += (bdx / bdist) * pullFactor * basePullStrength;
                p.vy += (bdy / bdist) * pullFactor * basePullStrength;

                if (bdist < entity.radius * 1.25) {
                  // Smoothly fade out particle emission brightness to exactly 0 as it crosses the event horizon
                  const transitionProgress = (bdist - entity.radius * 1.02) / (entity.radius * 0.23);
                  particleBrightness = Math.max(0.0, Math.min(1.0, transitionProgress));
                  
                  if (bdist < entity.radius * 0.5 && Math.random() < 0.15) {
                    // Sucked into the singularity! Recycle the particle to keep the cosmic density balanced
                    // Instead of teleporting to screen, move it way off screen so it drifts back slowly
                    p.x = (Math.random() > 0.5 ? -100 : currentW + 100);
                    p.y = (Math.random() > 0.5 ? -100 : currentH + 100);
                    p.vx = 0;
                    p.vy = 0;
                  }
                }
              }
            } else {
              // Collide with planets/stars
              const colDist = entity.radius + (isMobileDevice ? 2 : 3);
              if (bdist < colDist && !p.isTail) { // let tail particles (shatter debris) pass or maybe not? Let's say all particles
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
          p.x += dx * springTension * attractionMultiplier;
          p.y += dy * springTension * attractionMultiplier;
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
        const musicAmpVal = (audio as any).getMusicAmplitude();
        if (musicAmpVal > 0.02) {
          const waveFreq = 0.075;
          const waveSpeed = 0.28;
          const waveAmp = musicAmpVal * 15.0; // up to 15px ripple amplitude
          floatX += Math.sin(time * waveSpeed + p.y * waveFreq + i * 0.03) * waveAmp;
          floatY += Math.cos(time * waveSpeed * 0.85 + p.x * waveFreq + i * 0.03) * waveAmp;
        }
        const floatZ = Math.sin(time * floatSpeed * 0.7 + i * 0.04) * 8;
        p.z += (floatZ - p.z) * 0.05;

        const selfMovementX = isTypographyMode
          ? 0
          : Math.sin(time * 0.045 + i * 0.17) * 0.95;
        const selfMovementY = isTypographyMode
          ? 0
          : Math.cos(time * 0.045 + i * 0.23) * 0.95;
        const drawX = p.x + floatX + selfMovementX;
        const drawY = p.y + floatY + selfMovementY;

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

        colors[i * 4] = Math.min(1.0, Math.max(0.0, (r / 255) * globalAlpha * rFactor * particleBrightness));
        colors[i * 4 + 1] = Math.min(1.0, Math.max(0.0, (g / 255) * globalAlpha * gFactor * particleBrightness));
        colors[i * 4 + 2] = Math.min(1.0, Math.max(0.0, (b / 255) * globalAlpha * bFactor * particleBrightness));
        colors[i * 4 + 3] = globalAlpha;
        extras[i] = p.isTail ? 2.0 : (!p.isCosmicAmbient ? 1.0 : 0.0);
      }

      if (pointsMeshRef.current) {
        pointsMeshRef.current.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
        pointsMeshRef.current.updateVerticesData(BABYLON.VertexBuffer.ColorKind, colors);
        pointsMeshRef.current.updateVerticesData("extraData", extras);
      }

      ripplesRef.current.forEach((r) => (r.life -= 0.02));
      ripplesRef.current = ripplesRef.current.filter((r) => r.life > 0);

      // Gentle 3D camera mouse tilt or smooth cinematic 3D orbiting
      const cameraZ = currentH / (2 * Math.tan((fovRef.current * Math.PI) / 360));
      let finalTargetX = (mouseRef.current.x - currentW / 2) * 0.16;
      let finalTargetY = -(mouseRef.current.y - currentH / 2) * 0.16;
      let finalTargetZ = -cameraZ;

      if (isInterstellarRef.current) {
        // High-fidelity 3D orbital flyby path for cinematic 360-degree showcase
        const orbitAngle = time * 0.0022; // smooth 360 rotation speed
        const pitchAngle = Math.sin(time * 0.0006) * 0.28 + 0.18; // vertical slow-wave tilt
        const currentRadius = cameraZ * (0.95 + Math.sin(time * 0.0012) * 0.07); // subtle breathing zoom

        // 3D spherical coordinates relative to center (0,0,0)
        const ox = currentRadius * Math.sin(orbitAngle) * Math.cos(pitchAngle);
        const oy = currentRadius * Math.sin(pitchAngle);
        const oz = currentRadius * Math.cos(orbitAngle) * Math.cos(pitchAngle);

        // Incorporate subtle interactive mouse offset
        const mouseOffsetX = (mouseRef.current.x - currentW / 2) * 0.22;
        const mouseOffsetY = -(mouseRef.current.y - currentH / 2) * 0.22;

        finalTargetX = ox + mouseOffsetX;
        finalTargetY = oy + mouseOffsetY;
        finalTargetZ = oz;
      }

      // Smooth camera interpolation for fluid transitions between states
      camera.position.x += (finalTargetX - camera.position.x) * 0.04;
      camera.position.y += (finalTargetY - camera.position.y) * 0.04;
      camera.position.z += (finalTargetZ - camera.position.z) * 0.04;
      camera.setTarget(BABYLON.Vector3.Zero());

      // Dynamically adjust bloom parameters for a truly high-end cinematic experience
      if (composerRef.current) {
        const pipeline = composerRef.current;
        if (activeSupernova) {
          if (snElapsed >= 1200 && snElapsed < 2200) {
            // Gravitational collapse phase: build intensity
            const progress = (snElapsed - 1200) / 1000;
            pipeline.bloomWeight = 0.05 + progress * 0.5; // up to 0.55
          } else if (snElapsed >= 2200 && snElapsed < 3200) {
            // Supernova detonation phase: cinematic blinding flash!
            const progress = (snElapsed - 2200) / 1000;
            const fadeOut = Math.max(0, 1 - progress);
            pipeline.bloomWeight = 0.05 + fadeOut * 1.5; // peaks at 1.55
          } else {
            pipeline.bloomWeight = 0.05;
          }
        } else {
          // Standard cosmic breathing pulse for the event horizon and star glow
          const pulse = Math.sin(time * 0.01) * 0.02;
          pipeline.bloomWeight = 0.05 + pulse;
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
        const cameraZ = wh / (2 * Math.tan((fovRef.current * Math.PI) / 360));
        // Camera is at -cameraZ. Distance to plane is cameraZ + planeZ
        const scaleFactor = (cameraZ + planeZ) / cameraZ;
        hudPlaneRef.current.scaling.set(scaleFactor, scaleFactor, 1);
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

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.lastMoved = Date.now();
    };

    const handleClick = (e: MouseEvent) => {
      ripplesRef.current.push({ x: e.clientX, y: e.clientY, life: 1.0 });
      supernovaRef.current = {
        time: Date.now(),
        exploded: false,
        x: e.clientX,
        y: e.clientY,
      };
      fetchNextGeminiScene();
    };

    const handleScrollPhysics = () => {
      const currentScrollY =
        window.scrollY || document.documentElement.scrollTop;
      const delta = currentScrollY - lastScrollYRef.current;
      scrollVelocityRef.current += delta * 0.08;
      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("click", handleClick);
    window.addEventListener("scroll", handleScrollPhysics, { passive: true });

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleClick);
      window.removeEventListener("scroll", handleScrollPhysics);

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
