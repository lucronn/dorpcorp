import { Database, Zap, Layers, Globe } from "lucide-react";

export interface Particle {
  x: number;
  y: number;
  z: number;
  targetX: number;
  targetY: number;
  targetZ?: number;
  vx: number;
  vy: number;
  vz: number;
  color: string;
  baseColor: string;
  size: number;
  isCosmicAmbient?: boolean;
  driftSpeed?: number;
  interstellarType?: "blackhole" | "planet" | "nebula" | "star" | "bridge" | "background_galaxy";
  interstellarEntityIndex?: number;
  interstellarEntity?: any;
  orbitRadius?: number;
  orbitAngle?: number;
  orbitSpeed?: number;
  isPlanetRing?: boolean;
  bridgeStartEntityIndex?: number;
  bridgeStartEntity?: any;
  bridgeEndEntityIndex?: number;
  bridgeEndEntity?: any;
  bridgeProgress?: number;
  bridgeSpeed?: number;
  galaxyX?: number;
  galaxyY?: number;
  galaxyZ?: number;
  galaxyPitch?: number;
  galaxyYaw?: number;
  galaxyType?: "spiral" | "elliptical";
  isTail?: boolean;
  isProjectText?: boolean;
  life?: number;
  decay?: number;
  prevDrawX?: number;
  prevDrawY?: number;
  r?: number;
  g?: number;
  b?: number;
}

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
