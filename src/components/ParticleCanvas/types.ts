import * as BABYLON from "@babylonjs/core";

export interface CelestialEntity {
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
  vz?: number;
  z?: number;
  orbitInclination?: number;
  mass?: number;
  scale?: number;
  targetScale?: number;
  isPhysicsEnabled?: boolean;
  isDestroyed?: boolean;
  isSwallowing?: boolean;
  destroyedBy?: string;
  originalRadius?: number;
  currentRadius?: number;
  targetRadius?: number;
  initialMass?: number;
}

export interface ParticleCanvasProps {
  stage: number;
  isInterstellar?: boolean;
  onTransitionToInterstellar?: () => void;
  onSequenceGenerated?: (info: {
    name: string;
    description: string;
    tags: string[];
  }) => void;
}
