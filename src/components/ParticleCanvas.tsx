import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { Layers, Database, Zap, Globe } from "lucide-react";
import { audio } from "../utils/audio";

export const projects = [
  {
    title: "AI Engineering",
    category: "WHO I AM",
    description:
      "Ten years of engineering experience. Full-stack systems, agentic pipelines, and the evaluations that keep AI models honest.",
    tags: ["AI Engineering", "Production AI", "LLM Optimization"],
    icon: Database,
  },
  {
    title: "Architecting Autonomy",
    category: "WHAT I BUILD",
    description:
      "Autonomous agentic systems and large-scale RAG pipelines. Built to reason, plan, and execute reliably.",
    tags: ["Agentic Workflows", "LangChain", "VectorDBs"],
    icon: Zap,
  },
  {
    title: "Frontier Model Alignment",
    category: "HOW I TEST",
    description:
      "RLHF evaluation, red-teaming, and hallucination analysis on frontier models, including Claude Code and Fable.",
    tags: ["RLHF", "Red-Teaming", "Evaluations"],
    icon: Layers,
  },
  {
    title: "Technical Depth & Synthesis",
    category: "MY EXPERTISE",
    description:
      "Not only code. Domain expertise in CAD, civil and structural engineering, and fluid dynamics. Messy real-world data, turned into high-fidelity training corpuses.",
    tags: ["OpenFOAM", "OpenSEES", "SMEs"],
    icon: Globe,
  },
];

interface Particle {
  x: number;
  y: number;
  z: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  vz: number;
  color: string;
  baseColor: string;
  size: number;
  isCosmicAmbient?: boolean;
  driftSpeed?: number;
  interstellarType?: "blackhole" | "planet" | "nebula" | "star" | "bridge";
  interstellarEntityIndex?: number;
  orbitRadius?: number;
  orbitAngle?: number;
  orbitSpeed?: number;
  isPlanetRing?: boolean;
  bridgeStartEntityIndex?: number;
  bridgeEndEntityIndex?: number;
  bridgeProgress?: number;
  bridgeSpeed?: number;
  isTail?: boolean;
  life?: number;
  decay?: number;
  prevDrawX?: number;
  prevDrawY?: number;
  r?: number;
  g?: number;
  b?: number;
}

const drawStageLayoutTemplate = (
  ctx: CanvasRenderingContext2D,
  index: number,
  width: number,
  height: number,
  mode: "full" | "tracer",
  opacity: number = 1.0,
) => {
  if (width <= 0 || height <= 0) return;

  const isTracer = mode === "tracer";
  if (isTracer) return; // Hide all faint background vectors/text so only particles are seen

  // Theme Palette Colors
  const colorRust = isTracer
    ? `rgba(242, 95, 53, ${opacity * 0.2})`
    : "#f25f35";
  const colorLight = isTracer
    ? `rgba(255, 255, 255, ${opacity * 0.15})`
    : "#ffffff";
  const colorGold = isTracer
    ? `rgba(255, 215, 120, ${opacity * 0.18})`
    : "#ffd778";

  ctx.fillStyle = colorLight;
  ctx.strokeStyle = colorLight;

  if (index === 0) {
    let fontSize = Math.min(width * 0.12, 140);
    ctx.textAlign = "center";

    ctx.fillStyle = colorLight;
    ctx.strokeStyle = colorRust;
    ctx.lineWidth = isTracer ? 1.0 : width < 768 ? 2 : 4;
    ctx.font = `800 ${fontSize}px "Inter", sans-serif`;
    (ctx as any).letterSpacing = width < 768 ? "6px" : "16px";

    ctx.strokeText("CURTIS CLICK", width / 2, height / 2);
    ctx.fillText("CURTIS CLICK", width / 2, height / 2);
    (ctx as any).letterSpacing = "0px";
  } else if (index === 1) {
    const maxW = 1200;
    const mx = Math.max(0, (width - maxW) / 2);
    const pxLayout = width < 768 ? 24 : width < 1024 ? 48 : 64;
    const headerX = mx + pxLayout;
    const headerY = height / 2 - 40;

    ctx.font = `800 ${Math.max(16, width * 0.018)}px "JetBrains Mono", monospace`;
    ctx.fillStyle = colorRust;
    ctx.textAlign = "left";
    (ctx as any).letterSpacing = "4px";
    ctx.fillText("01 // SELECTED WORKS", headerX, headerY - 60);

    ctx.fillStyle = colorLight;
    ctx.strokeStyle = colorRust;
    ctx.lineWidth = isTracer ? 1.0 : width < 768 ? 2 : 3;
    ctx.font = `900 ${Math.min(width * 0.07, 72)}px "Inter", sans-serif`;
    (ctx as any).letterSpacing = "2px";

    ctx.strokeText("ENGINEERED EXPERIENCES", headerX, headerY);
    ctx.strokeText(
      "FOR THE MODERN WEB.",
      headerX,
      headerY + Math.min(width * 0.08, 84),
    );

    ctx.fillText("ENGINEERED EXPERIENCES", headerX, headerY);
    ctx.fillText(
      "FOR THE MODERN WEB.",
      headerX,
      headerY + Math.min(width * 0.08, 84),
    );
    (ctx as any).letterSpacing = "0px";
  } else if (index >= 2 && index <= 5) {
    const pIndex = index - 2;
    const p = projects[pIndex];
    const isMobile = width < 640;

    const containerPad = isMobile ? 24 : 48;
    const hudMaxW = Math.min(1100, width - containerPad * 2);
    const hudX = width / 2;
    const descMaxW = hudMaxW;

    const titleFontSize = isMobile
      ? Math.min(54, height * 0.08)
      : width < 1024
        ? 90
        : 130;

    let appliedTitleFontSize = titleFontSize;
    ctx.font = `bold ${appliedTitleFontSize}px "Playfair Display", Georgia, serif`;
    (ctx as any).letterSpacing = "-0.02em";
    while (
      ctx.measureText(p.title).width > descMaxW &&
      appliedTitleFontSize > 30
    ) {
      appliedTitleFontSize -= 2;
      ctx.font = `bold ${appliedTitleFontSize}px "Playfair Display", Georgia, serif`;
    }
    (ctx as any).letterSpacing = "0px";

    ctx.textAlign = "center";
    ctx.strokeStyle = colorRust;
    ctx.lineWidth = isTracer ? 1.0 : width < 768 ? 2 : 4;
    ctx.fillStyle = colorLight;
    ctx.strokeText(p.title, hudX, height / 2 - 30);
    ctx.fillText(p.title, hudX, height / 2 - 30);

    const catFontSize = Math.min(20, Math.max(11, width * 0.015));
    ctx.font = `bold ${catFontSize}px "JetBrains Mono", monospace`;
    ctx.fillStyle = colorGold;
    (ctx as any).letterSpacing = "8px";
    ctx.fillText(p.category, hudX, height / 2 - 130);
    (ctx as any).letterSpacing = "0px";

    ctx.strokeStyle = `rgba(242, 95, 53, ${isTracer ? 0.15 : 0.4})`;
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(hudX - hudMaxW / 2, height / 2 - 95);
    ctx.lineTo(hudX + hudMaxW / 2, height / 2 - 95);
    ctx.stroke();

    ctx.font = `600 ${Math.min(14, Math.max(10, width * 0.012))}px "JetBrains Mono", monospace`;
    ctx.fillStyle = `rgba(245, 242, 235, ${isTracer ? 0.2 : 0.55})`;
    ctx.fillText(
      "CURTIS CLICK // MULTI-MODAL PORTFOLIO",
      hudX,
      height / 2 + 150,
    );
  }
};

const generateTargetsForStage = (
  index: number,
  width: number,
  height: number,
): { x: number; y: number; color: string }[] => {
  if (width <= 0 || height <= 0) return [];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const coords: { x: number; y: number; color: string }[] = [];
  if (!ctx) return coords;

  drawStageLayoutTemplate(ctx, index, width, height, "full");

  const tData = ctx.getImageData(0, 0, width, height).data;

  const totalPixels = width * height;
  const isMobileDevice =
    /iPad|iPhone|iPod|Android/i.test(navigator.userAgent) || width < 768;
  let density = isMobileDevice ? 2 : 1;
  if (totalPixels > 2500000) density = isMobileDevice ? 3 : 2;
  if (totalPixels > 5000000) density = isMobileDevice ? 4 : 3;

  for (let y = 0; y < height; y += density) {
    for (let x = 0; x < width; x += density) {
      const idx = (y * width + x) * 4;
      const alpha = tData[idx + 3];
      if (alpha > 80) {
        const r = tData[idx];
        const g = tData[idx + 1];
        const b = tData[idx + 2];
        coords.push({
          x,
          y,
          color: `rgb(${r},${g},${b})`,
        });
      }
    }
  }

  for (let i = coords.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [coords[i], coords[j]] = [coords[j], coords[i]];
  }

  return coords;
};

interface CelestialEntity {
  type: "blackhole" | "planet" | "nebula" | "star";
  x: number;
  y: number;
  radius: number;
  color: string;
  secondaryColor?: string;
  hasRings?: boolean;
  ringColor?: string;
  orbitSpeed?: number;
  rotation?: number;
  orbitRadius?: number;
  orbitAngle?: number;
  centerX?: number;
  centerY?: number;
  
  // Gravitational Dynamics & Flow Transitions
  vx?: number;
  vy?: number;
  mass?: number;
  scale?: number;
  targetScale?: number;
  isPhysicsEnabled?: boolean;
  isDestroyed?: boolean;
  originalRadius?: number;
  currentRadius?: number;
  targetRadius?: number;
}

interface Props {
  stage: number;
  isInterstellar?: boolean;
  onTransitionToInterstellar?: () => void;
  onSequenceGenerated?: (info: {
    name: string;
    description: string;
    tags: string[];
  }) => void;
}

export const ParticleCanvas: React.FC<Props> = ({
  stage,
  isInterstellar = false,
  onTransitionToInterstellar,
  onSequenceGenerated,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Three.js Refs
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const pointsGeometryRef = useRef<THREE.BufferGeometry | null>(null);
  const pointsMeshRef = useRef<THREE.Points | null>(null);
  const hudPlaneRef = useRef<THREE.Mesh | null>(null);
  const hudTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const celestialGroupRef = useRef<THREE.Group | null>(null);
  const celestialMeshInstancesRef = useRef<
    { id: string; mesh: THREE.Object3D; entityRef: CelestialEntity }[]
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
      ) => void)
    | null
  >(null);
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

  const createCircleTexture = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "rgba(255, 255, 255, 0.85)");
      grad.addColorStop(0.12, "rgba(255, 255, 255, 0.65)");
      grad.addColorStop(0.3, "rgba(255, 248, 240, 0.32)");
      grad.addColorStop(0.6, "rgba(255, 245, 235, 0.1)");
      grad.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
    }
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  };

  const parseColorToRgb = (color: string) => {
    let r = 255, g = 255, b = 255;
    if (!color) return { r, g, b };
    const cleaned = color.trim().toLowerCase();
    if (cleaned.startsWith("#")) {
      const hex = cleaned.replace("#", "");
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16) || 255;
        g = parseInt(hex[1] + hex[1], 16) || 255;
        b = parseInt(hex[2] + hex[2], 16) || 255;
      } else if (hex.length >= 6) {
        r = parseInt(hex.substring(0, 2), 16) || 255;
        g = parseInt(hex.substring(2, 4), 16) || 255;
        b = parseInt(hex.substring(4, 6), 16) || 255;
      }
    } else if (cleaned.startsWith("rgb") || cleaned.startsWith("rgba")) {
      const matches = cleaned.match(/\d+/g);
      if (matches) {
        r = parseInt(matches[0] || "255", 10);
        g = parseInt(matches[1] || "255", 10);
        b = parseInt(matches[2] || "255", 10);
      }
    }
    return { r, g, b };
  };

  const generateAdvancedPlanetTexture = (baseColor: string, secondaryColor: string) => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.CanvasTexture(canvas);

    const c1 = parseColorToRgb(baseColor);
    const c2 = parseColorToRgb(secondaryColor || baseColor);

    // 1. Base map using layered sine-based multi-frequency bands to look gaseous and detailed
    for (let y = 0; y < 256; y++) {
      const freq1 = Math.sin(y * 0.12) * 0.35;
      const freq2 = Math.sin(y * 0.035) * 0.45;
      const freq3 = Math.cos(y * 0.28) * 0.12;
      const freq4 = Math.sin(y * 0.01) * 0.08;
      
      const t = Math.max(0, Math.min(1, (freq1 + freq2 + freq3 + freq4 + 1.0) / 2));

      const r = Math.round(c1.r * (1 - t) + c2.r * t);
      const g = Math.round(c1.g * (1 - t) + c2.g * t);
      const b = Math.round(c1.b * (1 - t) + c2.b * t);

      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(0, y, 512, 1);
    }

    // 2. Add dynamic, detailed, wavy cloud micro-bands
    for (let i = 0; i < 28; i++) {
      const y = Math.floor(Math.random() * 256);
      const h = Math.floor(1 + Math.random() * 8);
      const alpha = 0.08 + Math.random() * 0.22;
      const useBaseColor = Math.random() > 0.55;
      const col = useBaseColor ? c1 : c2;
      
      ctx.fillStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${alpha})`;
      ctx.beginPath();
      
      const waveFreq = 2 + Math.floor(Math.random() * 4);
      const waveAmp = 2 + Math.random() * 8;
      const phase = Math.random() * Math.PI * 2;

      for (let x = 0; x <= 512; x += 4) {
        const angle = (x / 512) * Math.PI * 2 * waveFreq + phase;
        const dy = Math.sin(angle) * waveAmp;
        if (x === 0) {
          ctx.moveTo(x, y + dy);
        } else {
          ctx.lineTo(x, y + dy);
        }
      }
      ctx.lineTo(512, y + h);
      ctx.lineTo(0, y + h);
      ctx.closePath();
      ctx.fill();
    }

    // 3. Add planetary storms / eddies
    const numStorms = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numStorms; i++) {
      const stormX = Math.random() * 512;
      const stormY = 50 + Math.random() * 156;
      const stormR1 = 14 + Math.random() * 16;
      const stormR2 = 7 + Math.random() * 8;
      const rotation = (Math.random() - 0.5) * 0.4;

      const grad = ctx.createRadialGradient(stormX, stormY, 0, stormX, stormY, stormR1);
      const stormType = Math.random();
      let stormColor = "rgba(255, 255, 255, 0.75)";
      if (stormType < 0.35) {
        stormColor = `rgba(${Math.max(0, c1.r - 80)}, ${Math.max(0, c1.g - 80)}, ${Math.max(0, c1.b - 80)}, 0.8)`;
      } else if (stormType < 0.7) {
        stormColor = `rgba(${Math.min(255, c2.r + 50)}, ${Math.min(255, c2.g + 50)}, ${Math.min(255, c2.b + 50)}, 0.85)`;
      }

      grad.addColorStop(0, stormColor);
      grad.addColorStop(0.35, `rgba(${c1.r}, ${c1.g}, ${c1.b}, 0.35)`);
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(stormX, stormY, stormR1, stormR2, rotation, 0, Math.PI * 2);
      ctx.fill();

      if (stormX + stormR1 > 512) {
        const wrapX = stormX - 512;
        const gradWrap = ctx.createRadialGradient(wrapX, stormY, 0, wrapX, stormY, stormR1);
        gradWrap.addColorStop(0, stormColor);
        gradWrap.addColorStop(0.35, `rgba(${c1.r}, ${c1.g}, ${c1.b}, 0.35)`);
        gradWrap.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = gradWrap;
        ctx.beginPath();
        ctx.ellipse(wrapX, stormY, stormR1, stormR2, rotation, 0, Math.PI * 2);
        ctx.fill();
      } else if (stormX - stormR1 < 0) {
        const wrapX = stormX + 512;
        const gradWrap = ctx.createRadialGradient(wrapX, stormY, 0, wrapX, stormY, stormR1);
        gradWrap.addColorStop(0, stormColor);
        gradWrap.addColorStop(0.35, `rgba(${c1.r}, ${c1.g}, ${c1.b}, 0.35)`);
        gradWrap.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = gradWrap;
        ctx.beginPath();
        ctx.ellipse(wrapX, stormY, stormR1, stormR2, rotation, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 4. Fine-grain texture overlay
    const imgData = ctx.getImageData(0, 0, 512, 256);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i+3] === 0) continue;
      const noise = (Math.random() - 0.5) * 16;
      data[i] = Math.max(0, Math.min(255, data[i] + noise));
      data[i+1] = Math.max(0, Math.min(255, data[i+1] + noise));
      data[i+2] = Math.max(0, Math.min(255, data[i+2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  };

  const generateConcentricRingTexture = (ringColor: string) => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.clearRect(0, 0, 512, 512);

    const cx = 256;
    const cy = 256;
    const col = parseColorToRgb(ringColor);

    for (let r = 85; r <= 245; r++) {
      const norm = (r - 85) / 160;
      let alpha = Math.sin(norm * Math.PI);

      if (norm > 0.44 && norm < 0.52) {
        alpha *= 0.04;
      } else if (norm > 0.82 && norm < 0.86) {
        alpha *= 0.1;
      } else {
        const ringletDetail = Math.sin(norm * 160) * 0.25 + Math.sin(norm * 60) * 0.15;
        alpha += ringletDetail;
      }

      alpha = Math.max(0, Math.min(0.72, alpha));

      ctx.strokeStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${alpha})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  };

  const generateDistortedLightwaveTexture = (baseColor: string) => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.CanvasTexture(canvas);

    ctx.clearRect(0, 0, 512, 512);

    const cx = 256;
    const cy = 256;
    const col = parseColorToRgb(baseColor);

    // Generate dozens of overlapping, warped, wavy lightwave rings
    // with different frequencies and phases to simulate gravitational lensing
    for (let ring = 0; ring < 32; ring++) {
      const baseRadius = 65 + ring * 5.5;
      const progress = ring / 32;
      const alpha = Math.sin(progress * Math.PI) * 0.75 * Math.max(0.1, 1.0 - progress);

      ctx.beginPath();
      const steps = 180;
      for (let i = 0; i <= steps; i++) {
        const theta = (i / steps) * Math.PI * 2;
        
        // Complex frequency interference to make the light waves look highly distorted and organic
        const wave1 = Math.sin(theta * 3.0 + ring * 0.15) * 8.0;
        const wave2 = Math.cos(theta * 5.0 - ring * 0.25) * 5.0;
        const wave3 = Math.sin(theta * 8.0) * 3.0;
        
        const r = baseRadius + wave1 + wave2 + wave3;
        const x = cx + Math.cos(theta) * r;
        const y = cy + Math.sin(theta) * r;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();

      // Blend yellow/golden/orange tones to make it look like fiery, warped hot plasma/photons
      const ringColor = `rgba(${Math.min(255, col.r + ring * 2)}, ${Math.min(255, col.g + 20 + ring * 1.5)}, ${col.b}, ${alpha})`;
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 1.4 + Math.random() * 1.6;
      ctx.shadowColor = `rgba(255, 170, 0, ${alpha * 0.8})`;
      ctx.shadowBlur = 12;
      ctx.stroke();
    }

    // Add central core lightwave gradient with a physical event horizon shadow hole
    const grad = ctx.createRadialGradient(cx, cy, 48, cx, cy, 240);
    grad.addColorStop(0, "rgba(0,0,0,1.0)"); // Pitch black Event Horizon shadow core!
    grad.addColorStop(0.1, "rgba(0,0,0,1.0)"); // Keep core completely opaque
    grad.addColorStop(0.12, `rgba(${col.r}, ${col.g}, ${col.b}, 0.95)`); // Lensing boundary gas glow
    grad.addColorStop(0.35, `rgba(235, 100, 0, 0.45)`);
    grad.addColorStop(0.75, `rgba(180, 50, 0, 0.12)`);
    grad.addColorStop(1.0, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, 240, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  };

  const createCircularGlowTexture = (colorStr: string) => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, colorStr);
      grad.addColorStop(0.5, colorStr.replace(/[\d\.]+\)$/, "0.3)"));
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
    }
    return new THREE.CanvasTexture(canvas);
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

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = ww;
    tempCanvas.height = wh;
    const tempCtx = tempCanvas.getContext("2d");
    if (tempCtx) {
      drawStageLayoutTemplate(tempCtx, targetStage, ww, wh, "full");
      hudTextureRef.current.image = tempCanvas;
      hudTextureRef.current.needsUpdate = true;
    }
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

  // Synchronize dynamic 3D celestial meshes in Three.js
  const updateCelestial3DMeshes = () => {
    const scene = sceneRef.current;
    const group = celestialGroupRef.current;
    if (!scene || !group) return;

    const ww = window.innerWidth;
    const wh = window.innerHeight;

    const entities = celestialEntitiesRef.current;
    const sceneAge = (Date.now() - interstellarSceneGeneratedTimeRef.current) / 1000;
    const musicAmp = (audio as any).getMusicAmplitude();

    // Automatic Calming Cosmic Shift transition after 90 seconds (about 2 full camera orbits)
    if (isInterstellarRef.current && sceneAge > 90.0 && !supernovaRef.current) {
      triggerCalmCosmicShift();
    }

    // --- AUTONOMOUS COSMIC EVOLUTION ENGINE ---
    // Ensure all entities are set to physically interact after birth
    entities.forEach((entity) => {
      if (!entity.isDestroyed) {
        entity.isPhysicsEnabled = true;
      }
    });

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
      // Decay orbit slightly with subtle drag
      const bh = entities.find(e => e && !e.isDestroyed && e.type === "blackhole");
      if (bh) {
        const dx = bh.x - entity.x;
        const dy = bh.y - entity.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        // Inward pull vector
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
          vx: -Math.cos(angle) * 1.2, // majestic, cinematic, ultra-slow speed
          vy: -Math.sin(angle) * 1.2,
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
          vx: Math.cos(angle) * 1.2, // majestic, cinematic, ultra-slow speed
          vy: Math.sin(angle) * 1.2,
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

    // --- Color Blending Utility ---
    const blendHexColors = (c1: string, c2: string, weight: number): string => {
      if (!c1.startsWith("#") || !c2.startsWith("#")) return c1;
      const r1 = parseInt(c1.slice(1, 3), 16);
      const g1 = parseInt(c1.slice(3, 5), 16);
      const b1 = parseInt(c1.slice(5, 7), 16);

      const r2 = parseInt(c2.slice(1, 3), 16);
      const g2 = parseInt(c2.slice(3, 5), 16);
      const b2 = parseInt(c2.slice(5, 7), 16);

      const r = Math.round(r1 * (1 - weight) + r2 * weight);
      const g = Math.round(g1 * (1 - weight) + g2 * weight);
      const b = Math.round(b1 * (1 - weight) + b2 * weight);

      const rs = r.toString(16).padStart(2, "0");
      const gs = g.toString(16).padStart(2, "0");
      const bs = b.toString(16).padStart(2, "0");

      return `#${rs}${gs}${bs}`;
    };

    // --- Dust Splash Spark Emitter ---
    function createDustSplash(x: number, y: number, color: string, count: number) {
      const spawnP = spawnTailParticleRef.current;
      if (!spawnP) return;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.0 + Math.random() * 8.5;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        spawnP(
          x,
          y,
          (Math.random() - 0.5) * 40,
          vx,
          vy,
          color
        );
      }
    }

    // --- Swallow & Merger Physics Events ---
    const swallowEntity = (bh: CelestialEntity, victim: CelestialEntity) => {
      victim.isDestroyed = true;
      const newMass = (bh.mass || 100) + (victim.mass || 50);
      bh.mass = newMass;
      
      // Blackhole target radius swells from ingested mass!
      const targetRadius = Math.min(bh.radius * 1.5, Math.sqrt(newMass / 15));
      bh.targetRadius = targetRadius;
      
      createDustSplash(victim.x, victim.y, victim.color, 160);
      audio.playRippleShockwave(); // trigger cosmic merger impact audio!
    };

    const mergeEntities = (survivor: CelestialEntity, victim: CelestialEntity) => {
      victim.isDestroyed = true;
      const newMass = (survivor.mass || 100) + (victim.mass || 50);
      survivor.mass = newMass;

      // Accretion radius grows elegantly
      const targetRadius = Math.min(survivor.radius * 1.45, Math.sqrt(newMass) * 1.15);
      survivor.targetRadius = targetRadius;

      // Blending velocity vectors for continuous momentum conservation
      survivor.vx = ((survivor.vx || 0) * (survivor.mass || 100) + (victim.vx || 0) * (victim.mass || 50)) / newMass;
      survivor.vy = ((survivor.vy || 0) * (survivor.mass || 100) + (victim.vy || 0) * (victim.mass || 50)) / newMass;

      const midX = (survivor.x + victim.x) / 2;
      const midY = (survivor.y + victim.y) / 2;

      // Create a giant dust splash of both colors combined, plus bright white for the energy discharge
      createDustSplash(midX, midY, survivor.color, 120);
      createDustSplash(midX, midY, victim.color, 120);
      createDustSplash(midX, midY, "#ffffff", 80);

      // Play major shockwave sound
      audio.playRippleShockwave();
      
      // Inject multiple high-intensity space-time ripples
      for (let r = 0; r < 3; r++) {
        ripplesRef.current.push({
          x: midX + (Math.random() - 0.5) * 40,
          y: midY + (Math.random() - 0.5) * 40,
          life: 1.0,
        });
      }

      if (onSequenceGenerated) {
        onSequenceGenerated({
          name: "Planetary Accretion",
          description: "Two orbiting bodies have collided, merging their atmospheres and matter into a grander, more massive sphere.",
          tags: ["☄ ACCRETION", "★ MASS INGESTION", "☄ COALITION"]
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
    if (sceneAge > 12.0) {
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
          const distSq = dx * dx + dy * dy;
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
            e2.vx = (e2.vx || 0) + (dx / dist) * repulsionForce;
            e2.vy = (e2.vy || 0) + (dy / dist) * repulsionForce;

            // 2. VISCOUS KINETIC FRICTION on their mutual approach axis
            const relVx = e2.vx - e1.vx;
            const relVy = e2.vy - e1.vy;
            const approachSpeed = (relVx * dx + relVy * dy) / dist; // approaching if negative
            if (approachSpeed < 0) {
              const viscosity = intensity * 0.45; // heavy electromagnetic resistance
              e1.vx += (dx / dist) * (-approachSpeed * viscosity);
              e1.vy += (dy / dist) * (-approachSpeed * viscosity);
              e2.vx -= (dx / dist) * (-approachSpeed * viscosity);
              e2.vy -= (dy / dist) * (-approachSpeed * viscosity);
            }

            // 3. PHYSICAL RADIUS DEFORMATION / SQUISHING
            e1.targetRadius = e1.radius * (1.0 - intensity * 0.35);
            e2.targetRadius = e2.radius * (1.0 - intensity * 0.35);

            // 4. SPACETIME VIOLENT VIBRATION (extreme stress shaking)
            const shakeAmount = intensity * 4.5;
            e1.x += (Math.random() - 0.5) * shakeAmount;
            e1.y += (Math.random() - 0.5) * shakeAmount;
            e2.x += (Math.random() - 0.5) * shakeAmount;
            e2.y += (Math.random() - 0.5) * shakeAmount;

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
            }
            if (e2.type !== "blackhole") {
              e2.vx = (e2.vx || 0) - (dx / dist) * forceE2;
              e2.vy = (e2.vy || 0) - (dy / dist) * forceE2;
            }
          }
        }
      }

      // Smooth coordinate velocity interpolation
      entities.forEach((entity) => {
        if (entity.isDestroyed) return;

        if (entity.isPhysicsEnabled) {
          // Space dust drag decays orbits into beautiful spiral accretion paths
          const drag = 0.994;
          entity.vx = (entity.vx || 0) * drag;
          entity.vy = (entity.vy || 0) * drag;

          entity.x += entity.vx;
          entity.y += entity.vy;
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
            const orbitX = entity.centerX + Math.cos(entity.orbitAngle) * entity.orbitRadius;
            const orbitY = entity.centerY + Math.sin(entity.orbitAngle) * entity.orbitRadius;
            
            // Big Bang smooth float outward on birth transition
            entity.x += (orbitX - entity.x) * 0.05;
            entity.y += (orbitY - entity.y) * 0.05;
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
    const activeIds = entities.map((e, idx) => `${e.type}-${idx}`);
    const existingIds = celestialMeshInstancesRef.current.map(
      (inst) => inst.id,
    );
    const needsRebuild = activeIds.join(",") !== existingIds.join(",");

    if (needsRebuild) {
      // Rebuild all meshes
      while (group.children.length > 0) {
        group.remove(group.children[0]!);
      }
      celestialMeshInstancesRef.current = [];

      entities.forEach((entity, idx) => {
        const entityId = `${entity.type}-${idx}`;
        const wx = entity.x - ww / 2;
        const wy = -(entity.y - wh / 2);

        entity.scale = entity.scale ?? 0;
        entity.currentRadius = entity.currentRadius ?? entity.radius;
        entity.originalRadius = entity.originalRadius ?? entity.radius;
        const initScale = entity.scale * (entity.currentRadius / entity.originalRadius);

        if (entity.type === "blackhole") {
          const bhContainer = new THREE.Group();
          bhContainer.position.set(wx, wy, 0);

          // 1. Accretion disk - Layer 1: Core fiery orange-yellow distorted waves
          const diskRadius = entity.radius * 3.6;
          const diskTex1 = generateDistortedLightwaveTexture("#ffa600");
          const diskMat1 = new THREE.MeshBasicMaterial({
            map: diskTex1,
            transparent: true,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            opacity: 0.95,
          });
          const diskGeo1 = new THREE.PlaneGeometry(
            diskRadius * 2,
            diskRadius * 2,
          );
          const diskMesh1 = new THREE.Mesh(diskGeo1, diskMat1);
          diskMesh1.rotation.x = Math.PI / 2.3;
          diskMesh1.name = "accretion_layer_1";
          bhContainer.add(diskMesh1);

          // Accretion disk - Layer 2: Opposing-spin golden wave warp (slightly tilted)
          const diskTex2 = generateDistortedLightwaveTexture("#ffdf00");
          const diskMat2 = new THREE.MeshBasicMaterial({
            map: diskTex2,
            transparent: true,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            opacity: 0.75,
          });
          const diskMesh2 = new THREE.Mesh(diskGeo1, diskMat2);
          diskMesh2.rotation.x = Math.PI / 2.45;
          diskMesh2.rotation.y = 0.12;
          diskMesh2.name = "accretion_layer_2";
          bhContainer.add(diskMesh2);

          // Accretion disk - Layer 3: Gravitational lensing ring (outer halo, near perpendicular view)
          const lensRadius = entity.radius * 4.6;
          const diskTex3 = generateDistortedLightwaveTexture("#ffffff");
          const diskMat3 = new THREE.MeshBasicMaterial({
            map: diskTex3,
            transparent: true,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            opacity: 0.45,
          });
          const diskGeo2 = new THREE.PlaneGeometry(
            lensRadius * 2,
            lensRadius * 2,
          );
          const diskMesh3 = new THREE.Mesh(diskGeo2, diskMat3);
          diskMesh3.rotation.x = Math.PI / 2.1;
          diskMesh3.rotation.y = -0.08;
          diskMesh3.name = "gravitational_lensing";
          bhContainer.add(diskMesh3);

          // 2. Event Horizon Shadow
          const ehGeo = new THREE.SphereGeometry(entity.radius, 32, 32);
          const ehMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
          const ehMesh = new THREE.Mesh(ehGeo, ehMat);
          bhContainer.add(ehMesh);

          bhContainer.scale.set(initScale, initScale, initScale);
          group.add(bhContainer);
          celestialMeshInstancesRef.current.push({
            id: entityId,
            mesh: bhContainer,
            entityRef: entity,
          });
        } else if (entity.type === "planet") {
          const planetContainer = new THREE.Group();
          planetContainer.position.set(wx, wy, 0);

          // 1. Planet sphere
          const sphereGeo = new THREE.SphereGeometry(entity.radius, 64, 64);
          const planetTexture = generateAdvancedPlanetTexture(
            entity.color,
            entity.secondaryColor || entity.color,
          );

          const sphereMat = new THREE.MeshStandardMaterial({
            map: planetTexture,
            roughness: 0.75,
            metalness: 0.08,
            bumpMap: planetTexture,
            bumpScale: entity.radius * 0.003,
          });
          const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
          planetContainer.add(sphereMesh);

          // 2. Striated rings
          if (entity.hasRings) {
            const ringTexture = generateConcentricRingTexture(entity.ringColor || entity.color);
            if (ringTexture) {
              const ringGeo = new THREE.PlaneGeometry(
                entity.radius * 4.8,
                entity.radius * 4.8,
              );
              const ringMat = new THREE.MeshBasicMaterial({
                map: ringTexture,
                transparent: true,
                side: THREE.DoubleSide,
                depthWrite: false,
                opacity: 0.85,
              });
              const ringMesh = new THREE.Mesh(ringGeo, ringMat);
              ringMesh.rotation.x = Math.PI / 2.3;
              ringMesh.rotation.y = 0.15;
              planetContainer.add(ringMesh);
            } else {
              const ringGeo = new THREE.RingGeometry(
                entity.radius * 1.3,
                entity.radius * 2.3,
                64,
              );
              const ringMat = new THREE.MeshBasicMaterial({
                color: entity.ringColor
                  ? new THREE.Color(entity.ringColor)
                  : new THREE.Color(entity.color),
                transparent: true,
                opacity: 0.65,
                side: THREE.DoubleSide,
                depthWrite: false,
              });
              const ringMesh = new THREE.Mesh(ringGeo, ringMat);
              ringMesh.rotation.x = Math.PI / 2.8;
              ringMesh.rotation.y = 0.15;
              planetContainer.add(ringMesh);
            }
          }

          // Atmosphere Glow
          const atmosphereGlowTex = createCircularGlowTexture(
            hexToRgba(entity.color, 0.45),
          );
          const atmosphereGlowMat = new THREE.MeshBasicMaterial({
            map: atmosphereGlowTex,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            opacity: 0.65,
          });
          const atmosphereGlowGeo = new THREE.PlaneGeometry(
            entity.radius * 2.8,
            entity.radius * 2.8,
          );
          const atmosphereGlowMesh = new THREE.Mesh(
            atmosphereGlowGeo,
            atmosphereGlowMat,
          );
          atmosphereGlowMesh.position.z = -1;
          planetContainer.add(atmosphereGlowMesh);

          planetContainer.scale.set(initScale, initScale, initScale);
          group.add(planetContainer);
          celestialMeshInstancesRef.current.push({
            id: entityId,
            mesh: planetContainer,
            entityRef: entity,
          });
        } else if (entity.type === "nebula") {
          const nebTex = createCircularGlowTexture(entity.color);
          const nebMat = new THREE.MeshBasicMaterial({
            map: nebTex,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            opacity: 0.45,
          });
          const nebGeo = new THREE.PlaneGeometry(
            entity.radius * 2.4,
            entity.radius * 2.4,
          );
          const nebMesh = new THREE.Mesh(nebGeo, nebMat);
          nebMesh.position.set(wx, wy, -100);

          nebMesh.scale.set(initScale, initScale, initScale);
          group.add(nebMesh);
          celestialMeshInstancesRef.current.push({
            id: entityId,
            mesh: nebMesh,
            entityRef: entity,
          });
        } else if (entity.type === "star") {
          const starContainer = new THREE.Group();
          starContainer.position.set(wx, wy, 0);

          // 1. Neutron Star Core (extremely bright white/cyan core)
          const coreGeo = new THREE.SphereGeometry(entity.radius * 0.8, 32, 32);
          const coreMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(entity.secondaryColor || "#ffffff"),
          });
          const coreMesh = new THREE.Mesh(coreGeo, coreMat);
          starContainer.add(coreMesh);

          // 2. High-energy pulsing outer plasma aura
          const auraTex = createCircularGlowTexture(
            hexToRgba(entity.color, 0.95),
          );
          const auraMat = new THREE.MeshBasicMaterial({
            map: auraTex,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            opacity: 0.9,
          });
          const auraGeo = new THREE.PlaneGeometry(
            entity.radius * 3.5,
            entity.radius * 3.5,
          );
          const auraMesh = new THREE.Mesh(auraGeo, auraMat);
          auraMesh.name = "star_aura";
          starContainer.add(auraMesh);

          starContainer.scale.set(initScale, initScale, initScale);
          group.add(starContainer);
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
        const targetScale = entity.isDestroyed ? 0 : 1;
        entity.scale += (targetScale - entity.scale) * 0.08;

        entity.currentRadius = entity.currentRadius ?? entity.radius;
        entity.targetRadius = entity.targetRadius ?? entity.radius;
        entity.currentRadius += (entity.targetRadius - entity.currentRadius) * 0.08;

        entity.originalRadius = entity.originalRadius ?? entity.radius;
        const radiusScale = entity.currentRadius / entity.originalRadius;

        const finalScale = entity.scale * radiusScale;
        inst.mesh.scale.set(finalScale, finalScale, finalScale);

        if (entity.type !== "nebula") {
          inst.mesh.position.set(wx, wy, 0);
          // Spin spheres/disks
          inst.mesh.children.forEach((child) => {
            if (child instanceof THREE.Mesh) {
              if (child.geometry instanceof THREE.SphereGeometry) {
                child.rotation.y += 0.005;
              } else if (
                child.geometry instanceof THREE.PlaneGeometry &&
                child.rotation.x > 1.0
              ) {
                if (child.name === "accretion_layer_1") {
                  child.rotation.z += 0.007;
                  const pulse = 1.0 + Math.sin(Date.now() * 0.0035) * 0.05 + musicAmp * 0.25;
                  child.scale.set(pulse, pulse, pulse);
                } else if (child.name === "accretion_layer_2") {
                  child.rotation.z -= 0.011;
                  const pulse = 1.0 + Math.cos(Date.now() * 0.0025) * 0.04 + musicAmp * 0.2;
                  child.scale.set(pulse, pulse, pulse);
                } else if (child.name === "gravitational_lensing") {
                  child.rotation.z += 0.003;
                  const pulse = 1.0 + Math.sin(Date.now() * 0.0015) * 0.06 + musicAmp * 0.3;
                  child.scale.set(pulse, pulse, pulse);
                } else {
                  child.rotation.z += 0.003;
                }
              }
            }
          });
        } else {
          inst.mesh.position.set(wx, wy, -80);
        }
      });
    }

    // 5. Dynamic Group Opacity Transition: Elegant background fade based on isInterstellar stage
    const targetGroupOpacity = isInterstellarRef.current ? 1.0 : 0.32;
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mat = child.material as any;
        if (mat.transparent !== undefined) {
          mat.transparent = true;
          
          if (mat.userData.baseOpacity === undefined) {
            mat.userData.baseOpacity = mat.opacity !== undefined ? mat.opacity : 1.0;
          }
          
          // Sub-bass physical vibration flares materials slightly on beats
          const musicPulseOpacity = 0.38 * musicAmp;
          
          // Keep Event Horizon shadow completely dark
          if (child.geometry instanceof THREE.SphereGeometry && mat.color && mat.color.getHex() === 0x000000) {
            mat.opacity = targetGroupOpacity;
          } else {
            mat.opacity = mat.userData.baseOpacity * (targetGroupOpacity + musicPulseOpacity * (1 - targetGroupOpacity));
          }
        }
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

    // 1. Initialize Three.js Ecosystem
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const fov = 60;
    const aspect = ww / wh;
    const cameraZ = wh / (2 * Math.tan((fov * Math.PI) / 360));
    const camera = new THREE.PerspectiveCamera(fov, aspect, 1, 15000);
    camera.position.set(0, 0, cameraZ);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true,
    });
    const dpr = Math.min(window.devicePixelRatio || 1, 2.0);
    renderer.setPixelRatio(dpr);
    renderer.setSize(ww, wh);
    rendererRef.current = renderer;

    // Direct lighting & ambient light setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.95);
    dirLight.position.set(150, 250, 400);
    scene.add(dirLight);

    // Group to hold interstellar celestial bodies
    const celestialGroup = new THREE.Group();
    scene.add(celestialGroup);
    celestialGroupRef.current = celestialGroup;

    // 2. Layered Typography Tracer Texture
    const hudCanvas = document.createElement("canvas");
    hudCanvas.width = ww;
    hudCanvas.height = wh;
    const hudCtx = hudCanvas.getContext("2d");
    if (hudCtx) {
      drawStageLayoutTemplate(hudCtx, stageRef.current, ww, wh, "full");
    }
    const hudTexture = new THREE.CanvasTexture(hudCanvas);
    hudTexture.minFilter = THREE.LinearFilter;
    hudTextureRef.current = hudTexture;

    const hudMaterial = new THREE.MeshBasicMaterial({
      map: hudTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.82,
    });
    const hudPlaneGeo = new THREE.PlaneGeometry(ww, wh);
    const hudPlane = new THREE.Mesh(hudPlaneGeo, hudMaterial);

    const planeZ = -60;
    const scaleFactor = (cameraZ - planeZ) / cameraZ;
    hudPlane.scale.set(scaleFactor, scaleFactor, 1);
    hudPlane.position.set(0, 0, planeZ);
    hudPlane.visible = false; // Completely hide background outline vectors so only particles are seen
    scene.add(hudPlane);
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
        size: Math.max(0.6, 1.0 + Math.random() * 1.5),
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
        size: Math.max(0.8, 0.5 + Math.random() * 1.0),
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
        size: Math.max(0.8, 0.4 + Math.random() * 1.2),
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
    const colors = new Float32Array(totalCount * 3);

    const pointsGeometry = new THREE.BufferGeometry();
    const positionAttribute = new THREE.BufferAttribute(positions, 3);
    const colorAttribute = new THREE.BufferAttribute(colors, 3);
    pointsGeometry.setAttribute("position", positionAttribute);
    pointsGeometry.setAttribute("color", colorAttribute);
    pointsGeometryRef.current = pointsGeometry;

    const pointsMaterial = new THREE.PointsMaterial({
      size: isMobileDevice ? 3.5 : 5.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      map: createCircleTexture(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const pointsMesh = new THREE.Points(pointsGeometry, pointsMaterial);
    scene.add(pointsMesh);
    pointsMeshRef.current = pointsMesh;

    // Seed the initial planets and singularity immediately on load
    generateInterstellarScene(ww, wh);
    fetchNextGeminiScene();

    mapParticlesToStage(stageRef.current, false);

    let animationId: number;
    let time = 0;

    const spawnTailParticle = (
      x: number,
      y: number,
      z: number,
      vx: number,
      vy: number,
      color: string,
    ) => {
      if (tailCount === 0 || tailStartIndex === -1) return;
      const tIdx = tailStartIndex + (tailIndex % tailCount);
      tailIndex++;

      const tailP = tempParticles[tIdx];
      if (tailP) {
        tailP.x = x;
        tailP.y = y;
        tailP.z = z;
        tailP.vx = -vx * 0.15;
        tailP.vy = -vy * 0.15;
        tailP.vz = (Math.random() - 0.5) * 2;
        tailP.color = color;
        tailP.life = 1.0;
        tailP.decay = 0.04 + Math.random() * 0.05;
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

      if (hudPlaneRef.current && hudPlaneRef.current.material) {
        (hudPlaneRef.current.material as THREE.Material).opacity =
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
        
        // Let's make the transition time of the calm shift slightly longer (e.g., 5.2 seconds of beautiful, peaceful morphing drift)
        const transitionThreshold = activeSupernova.isCalmShift ? 5200 : 3200;
        
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
            colors[i * 3] = (r / 255) * globalAlpha * tailOpacity;
            colors[i * 3 + 1] = (g / 255) * globalAlpha * tailOpacity;
            colors[i * 3 + 2] = (b / 255) * globalAlpha * tailOpacity;
          } else {
            positions[i * 3] = -99999;
            positions[i * 3 + 1] = -99999;
            positions[i * 3 + 2] = 0;
            colors[i * 3] = 0;
            colors[i * 3 + 1] = 0;
            colors[i * 3 + 2] = 0;
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

          // Map ambient particles to Three.js positions
          positions[i * 3] = p.x - currentW / 2;
          positions[i * 3 + 1] = -(p.y - currentH / 2);
          positions[i * 3 + 2] = p.z;

          // Simple white or dim ambient color
          colors[i * 3] = p.color === "#ffffff" ? 0.8 : 0.9;
          colors[i * 3 + 1] = p.color === "#ffffff" ? 0.8 : 0.8;
          colors[i * 3 + 2] = p.color === "#ffffff" ? 0.8 : 0.7;
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

        // Spacetime gravity bending is always active!
        const gravityRadiusMult = isInterstellarRef.current ? 2.5 : 1.8;
        celestialEntitiesRef.current.forEach((entity) => {
          if (entity.isDestroyed || entity.type !== "blackhole") return;
          const bdx = entity.x - p.x;
          const bdy = entity.y - p.y;
          const bdist = Math.sqrt(bdx * bdx + bdy * bdy) || 1;

          if (bdist < entity.radius * gravityRadiusMult) {
            const pullFactor = 1.0 - bdist / (entity.radius * gravityRadiusMult);
            suctionAlpha = Math.max(suctionAlpha, pullFactor * (isInterstellarRef.current ? 1.0 : 0.3));

            const basePullStrength = isInterstellarRef.current ? 4.8 : 1.4;
            p.vx += (bdx / bdist) * pullFactor * basePullStrength;
            p.vy += (bdy / bdist) * pullFactor * basePullStrength;

            if (bdist < entity.radius) {
              particleBrightness = bdist / entity.radius;
              if (bdist < entity.radius * 0.45 && Math.random() < 0.12) {
                p.x = Math.random() * currentW;
                p.y = Math.random() * currentH;
                p.vx = 0;
                p.vy = 0;
              }
            }
          }
        });

        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const distSq = dx * dx + dy * dy;

        const springTension = (isTypographyMode
          ? Math.max(0.08, Math.min(0.75, 40.0 / Math.max(1, distSq)))
          : isInterstellarRef.current
            ? 0.24
            : 0.08) * (1.0 - suctionAlpha);

        if (distSq > 1.0) {
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
        const floatZ = Math.sin(time * floatSpeed * 0.7 + i * 0.04) * 45;
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

        // Map points to Three.js positions
        positions[i * 3] = drawX - currentW / 2;
        positions[i * 3 + 1] = -(drawY - currentH / 2);
        positions[i * 3 + 2] = p.z;

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

        if (chromaticShift > 1.0) {
          if (i % 3 === 0) {
            rFactor = 1.3;
            bFactor = 0.5;
          } else if (i % 3 === 1) {
            rFactor = 0.5;
            gFactor = 1.3;
          } else {
            bFactor = 1.3;
            gFactor = 0.5;
          }
        }

        colors[i * 3] = (r / 255) * globalAlpha * rFactor * particleBrightness;
        colors[i * 3 + 1] = (g / 255) * globalAlpha * gFactor * particleBrightness;
        colors[i * 3 + 2] = (b / 255) * globalAlpha * bFactor * particleBrightness;
      }

      positionAttribute.needsUpdate = true;
      colorAttribute.needsUpdate = true;

      ripplesRef.current.forEach((r) => (r.life -= 0.02));
      ripplesRef.current = ripplesRef.current.filter((r) => r.life > 0);

      // Gentle 3D camera mouse tilt or smooth cinematic 3D orbiting
      const cameraZ = currentH / (2 * Math.tan((fov * Math.PI) / 360));
      let finalTargetX = (mouseRef.current.x - currentW / 2) * 0.16;
      let finalTargetY = -(mouseRef.current.y - currentH / 2) * 0.16;
      let finalTargetZ = cameraZ;

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
      camera.lookAt(0, 0, 0);

      // Render the 3D scene
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(render);
    };

    render();

    let resizeTimeout: ReturnType<typeof setTimeout>;
    let lastWidth = window.innerWidth;
    let lastHeight = window.innerHeight;

    const handleResize = () => {
      const ww = window.innerWidth;
      const wh = window.innerHeight;

      if (rendererRef.current && cameraRef.current) {
        rendererRef.current.setSize(ww, wh);
        cameraRef.current.aspect = ww / wh;
        cameraRef.current.position.z =
          wh / (2 * Math.tan((fov * Math.PI) / 360));
        cameraRef.current.updateProjectionMatrix();
      }

      if (hudPlaneRef.current && cameraRef.current) {
        const planeZ = -60;
        const scaleFactor =
          (cameraRef.current.position.z - planeZ) /
          cameraRef.current.position.z;
        hudPlaneRef.current.scale.set(scaleFactor, scaleFactor, 1);
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
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleClick);
      window.removeEventListener("scroll", handleScrollPhysics);

      // Memory cleanup for Three.js
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      pointsGeometry.dispose();
      pointsMaterial.dispose();
      hudMaterial.dispose();
      hudTexture.dispose();
      hudPlaneGeo.dispose();
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="block w-full h-full" id="canvas-three" />
  );
};
