import type React from "react";
import type { MutableRefObject } from "react";
export type { Particle } from "../../types";
import * as BABYLON from "@babylonjs/core";

export interface CelestialMeshInstance {
  id: string;
  mesh: BABYLON.TransformNode;
  entityRef: CelestialEntity;
}

export interface CelestialEntity {
  id?: string;
  type: "blackhole" | "planet" | "nebula" | "star" | "galaxy";
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
  wx?: number; // angular velocity X
  wy?: number; // angular velocity Y
  wz?: number; // angular velocity Z
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
  lastCollisionTime?: number;

  // 500ms Swift Merger & High-Energy Glow State
  isMerging?: boolean;
  isMergerSurvivor?: boolean;
  mergerTargetId?: string;
  mergerStartTime?: number;
  mergerStartX?: number;
  mergerStartY?: number;
  mergerStartZ?: number;
  mergerTargetX?: number;
  mergerTargetY?: number;
  mergerTargetZ?: number;
  mergerSurvivorMass?: number;
  mergerVictimMass?: number;
  mergerSurvivorRadius?: number;
  mergerVictimRadius?: number;
  mergerVictimColor?: string;
  glowIntensity?: number;
  mergePulse?: number;

  // Smooth Morphing Transitions
  startX?: number;
  startY?: number;
  startZ?: number;
  startRadius?: number;
  startScale?: number;
  targetX?: number;
  targetY?: number;
  targetZ?: number;
}

export interface ParticleFilters {
  ambient: boolean;      // Cosmic Ambient & Background Galaxies
  celestial: boolean;    // Black Holes, Planets, Stars & Nebulas
  bridges: boolean;      // Wormhole & Gravitational Bridges
  tails: boolean;        // Jet Trails & Spaghettification Debris
  typography: boolean;   // Project Text & Typography
}

import { CosmicTransitionStateMachine, TransitionStateInfo } from "./TransitionManager";

export interface ParticleCanvasProps {
  stage: number;
  isInterstellar?: boolean;
  animationComplete?: () => void;
  onSequenceGenerated?: (info: {
    id?: string;
    name: string;
    description: string;
    tags: string[];
  }) => void;
  showDebug?: boolean;
  particleFilters?: ParticleFilters;
  textParticleSpeed?: number;
  ambientParticleSpeed?: number;
  objectParticleSpeed?: number;
  onTransitionStateChange?: (info: TransitionStateInfo) => void;
  transitionStateMachineRef?: MutableRefObject<CosmicTransitionStateMachine | null>;
}
