import React from "react";
import * as BABYLON from "@babylonjs/core";
import { CelestialEntity, Particle } from "./types";
import { startWormholeTransit as _startWormholeTransit } from "./WormholeTransit";
import {
  mapParticlesToInterstellar as _mapParticlesToInterstellar,
  mapParticlesToStage as _mapParticlesToStage,
  updateTypographyStage,
  disperseTypographyParticles,
} from "./ParticleMapper";

export { _startWormholeTransit as startWormholeTransit, updateTypographyStage, disperseTypographyParticles };

/**
 * Smoothly transitions current active celestial entities into target entities
 * using natural 3D deep-space float-away and discovery kinematics.
 */
export function transitionToNewEntities(
  currentEntities: CelestialEntity[],
  newEntities: CelestialEntity[],
  spawnX: number,
  spawnY: number,
  entityTransitionActiveRef: React.MutableRefObject<boolean>,
  entityTransitionStartTimeRef: React.MutableRefObject<number>,
  driftVector?: { x: number; y: number; z: number }
): void {
  const isInitialMount = currentEntities.length === 0;

  if (isInitialMount) {
    newEntities.forEach((target, i) => {
      const targetZ = target.z ?? 0;
      currentEntities.push({
        ...target,
        x: target.x,
        y: target.y,
        z: targetZ,
        startX: target.x,
        startY: target.y,
        startZ: targetZ,
        scale: target.scale ?? 1.0,
        startScale: target.scale ?? 1.0,
        targetScale: 1.0,
        isOutgoing: false,
        isDestroyed: false,
        baseOrbitRadius: target.orbitRadius,
        id: target.id || `${target.type}-${i}-${Math.random().toString(36).substring(2, 9)}`,
        startRadius: target.radius,
        targetX: target.x,
        targetY: target.y,
        targetZ,
        targetRadius: target.radius,
      });
    });
    entityTransitionActiveRef.current = false;
    return;
  }

  const drift =
    driftVector ||
    (typeof window !== "undefined" ? (window as any).__voyageDriftDir : null) ||
    (() => {
      const angle = Math.random() * Math.PI * 2;
      const pitch = 0.2 + Math.random() * 0.35;
      return {
        x: Math.cos(angle) * Math.cos(pitch),
        y: Math.sin(pitch),
        z: Math.sin(angle) * Math.cos(pitch),
      };
    })();

  // Prune finished entities and retire already-outgoing entities from prior overlapping transitions
  for (let i = currentEntities.length - 1; i >= 0; i--) {
    const ent = currentEntities[i]!;
    if ((ent.isDestroyed || ent.isOutgoing) && (ent.scale ?? 1) <= 0.03) {
      ent.isDestroyed = true;
      currentEntities.splice(i, 1);
    } else if (ent.isOutgoing) {
      // Already outgoing from an earlier transition: mark destroyed so it shrinks out rapidly
      ent.isDestroyed = true;
    }
  }

  currentEntities.forEach((cur) => {
    if (cur.isDestroyed) return;

    cur.startX = cur.x;
    cur.startY = cur.y;
    cur.startZ = cur.z ?? 0;
    cur.startRadius = cur.radius;
    cur.startScale = cur.scale ?? 1.0;

    // Outgoing entities recede smoothly backwards into deep space without instant destruction
    cur.targetX = cur.x - drift.x * 2200;
    cur.targetY = cur.y - drift.y * 1100;
    cur.targetZ = (cur.z ?? 0) + 3200;
    cur.targetRadius = Math.max(4, cur.radius * 0.25);
    cur.targetScale = 0.0;
    cur.isOutgoing = true;
  });

  newEntities.forEach((target, i) => {
    // Incoming entities emerge from deep space along the forward flight trajectory
    const startX = target.x + drift.x * 2400;
    const startY = target.y + drift.y * 1200;
    const startZ = -3400;

    const curNew: CelestialEntity = {
      ...target,
      x: startX,
      y: startY,
      z: startZ,
      startX: startX,
      startY: startY,
      startZ: startZ,
      scale: 0.02,
      startScale: 0.02,
      targetScale: 1.0,
      isOutgoing: false,
      isDestroyed: false,
      baseOrbitRadius: target.orbitRadius,
      id: target.id || `${target.type}-${i}-${Math.random().toString(36).substring(2, 9)}`,
      startRadius: Math.max(2, target.radius * 0.15),
      targetX: target.x,
      targetY: target.y,
      targetZ: target.z ?? 0,
      targetRadius: target.radius,
    };
    currentEntities.push(curNew);
  });

  entityTransitionActiveRef.current = true;
  entityTransitionStartTimeRef.current = Date.now();
}

/**
 * Maps particle cloud coordinates to target interstellar celestial body positions.
 */
export function mapParticlesToInterstellar(
  width: number,
  height: number,
  celestialEntitiesRef: React.MutableRefObject<CelestialEntity[]>,
  archetypeRef: React.MutableRefObject<string>,
  particlesRef: React.MutableRefObject<Particle[]>,
  tailStartIndexRef: React.MutableRefObject<number>,
  stage: number = 0,
  triggerBurst: boolean = false,
  skipTextUpdate: boolean = false
): void {
  _mapParticlesToInterstellar(
    width,
    height,
    celestialEntitiesRef,
    archetypeRef,
    particlesRef,
    tailStartIndexRef,
    stage,
    triggerBurst,
    skipTextUpdate
  );
}

/**
 * Maps particle cloud coordinates to stage typography targets.
 */
export function mapParticlesToStage(
  targetStage: number,
  triggerBurst: boolean,
  stageTargetsRef: React.MutableRefObject<{ x: number; y: number; color: string }[][]>,
  particlesRef: React.MutableRefObject<Particle[]>,
  tailStartIndexRef: React.MutableRefObject<number>
): void {
  _mapParticlesToStage(
    targetStage,
    triggerBurst,
    stageTargetsRef,
    particlesRef,
    tailStartIndexRef
  );
}

/**
 * Promise-based transition state machine types for Black Hole <-> Supernova sequencing.
 */
export type TransitionStage =
  | "IDLE_BLACKHOLE"
  | "SUPERNOVA_IMPLODE"
  | "SUPERNOVA_DETONATE"
  | "SUPERNOVA_REBIRTH"
  | "TRANSITION_COMPLETE";

export interface TransitionStateInfo {
  stage: TransitionStage;
  progress: number; // 0.0 to 1.0
  description: string;
  isTransitioning: boolean;
}

export type TransitionStateListener = (info: TransitionStateInfo) => void;

/**
 * Promise-based State Machine that governs non-blocking transition sequencing
 * between the Black Hole stage and Supernova stages.
 */
export class CosmicTransitionStateMachine {
  private currentStage: TransitionStage = "IDLE_BLACKHOLE";
  private progress: number = 0;
  private description: string = "Singularity Core Stable";
  private listeners: Set<TransitionStateListener> = new Set();
  private activePromise: Promise<void> | null = null;
  private abortController: AbortController | null = null;

  public getInfo(): TransitionStateInfo {
    return {
      stage: this.currentStage,
      progress: this.progress,
      description: this.description,
      isTransitioning: this.currentStage !== "IDLE_BLACKHOLE" && this.currentStage !== "TRANSITION_COMPLETE",
    };
  }

  public getStateInfo(): TransitionStateInfo {
    return this.getInfo();
  }

  public subscribe(listener: TransitionStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getInfo());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(stage: TransitionStage, progress: number, description: string) {
    this.currentStage = stage;
    this.progress = progress;
    this.description = description;
    const info = this.getInfo();
    this.listeners.forEach((fn) => {
      try {
        fn(info);
      } catch (e) {
        console.error("[TransitionStateMachine] Listener error:", e);
      }
    });
  }

  private delay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        return reject(new DOMException("Aborted", "AbortError"));
      }
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, ms);
      const onAbort = () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }

  /**
   * Promise-based state machine transition: Black Hole -> Supernova Implosion -> Detonation -> System Rebirth.
   * Runs non-blockingly using asynchronous stages synchronized with SupernovaFX.
   */
  public async executeBlackHoleToSupernovaTransition(options: {
    x?: number;
    y?: number;
    onImplode?: () => void;
    onDetonate?: () => void;
    onRebirth?: () => void;
    onComplete?: () => void;
  }): Promise<void> {
    if (this.activePromise) {
      await this.activePromise;
    }

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const sequencePromise = (async () => {
      try {
        // Stage 1: SUPERNOVA_IMPLODE (0.0 - 0.28) — Janka (2012), arXiv:1206.2503
        this.notify("SUPERNOVA_IMPLODE", 0.15, "Fe-Core Chandrasekhar Collapse & Nuclear Bounce");
        if (options.onImplode) options.onImplode();
        await this.delay(2600, signal);

        // Stage 2: SUPERNOVA_DETONATE (0.28 - 0.68)
        this.notify("SUPERNOVA_DETONATE", 0.50, "Neutrino-Driven Shock Revival (SASI) & Shock Breakout");
        if (options.onDetonate) options.onDetonate();
        await this.delay(3800, signal);

        // Stage 3: SUPERNOVA_REBIRTH (0.68 - 0.96)
        this.notify("SUPERNOVA_REBIRTH", 0.85, "r-Process Nucleosynthesis Ejecta & Remnant Seeding");
        if (options.onRebirth) options.onRebirth();
        await this.delay(3400, signal);

        // Stage 4: TRANSITION_COMPLETE (1.0)
        this.notify("TRANSITION_COMPLETE", 1.0, "System Transition Complete");
        if (options.onComplete) options.onComplete();
        await this.delay(400, signal);

        // Reset state to IDLE
        this.notify("IDLE_BLACKHOLE", 0.0, "Singularity Orbit Stable");
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("[TransitionStateMachine] Transition error:", err);
        }
        this.notify("IDLE_BLACKHOLE", 0.0, "Transition Reset");
      } finally {
        this.activePromise = null;
      }
    })();

    this.activePromise = sequencePromise;
    return sequencePromise;
  }

  /**
   * Promise-based state machine transition returning to the Black Hole stage.
   */
  public async executeTransitionToBlackHole(options: {
    onRebirthBlackHole?: () => void;
    onComplete?: () => void;
  }): Promise<void> {
    if (this.activePromise) {
      await this.activePromise;
    }

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const sequencePromise = (async () => {
      try {
        this.notify("SUPERNOVA_REBIRTH", 0.5, "Re-establishing Singularity Accretion Orbit");
        if (options.onRebirthBlackHole) options.onRebirthBlackHole();
        await this.delay(800, signal);

        this.notify("TRANSITION_COMPLETE", 1.0, "Singularity Restored");
        if (options.onComplete) options.onComplete();
        await this.delay(200, signal);

        this.notify("IDLE_BLACKHOLE", 0.0, "Singularity Orbit Stable");
      } catch (e) {
        this.notify("IDLE_BLACKHOLE", 0.0, "Singularity Reset");
      } finally {
        this.activePromise = null;
      }
    })();

    this.activePromise = sequencePromise;
    return sequencePromise;
  }

  public cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.activePromise = null;
    this.notify("IDLE_BLACKHOLE", 0.0, "Transition Aborted");
  }
}

/**
 * Triggers a calm cosmic shift by soft-destroying existing entities and fading in a new system.
 */
export function triggerCalmCosmicShift(
  celestialEntitiesRef: React.MutableRefObject<CelestialEntity[]>,
  supernovaRef: React.MutableRefObject<any>,
  fetchNextGeminiScene: () => void
): void {
  if (supernovaRef.current) return;
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
}
