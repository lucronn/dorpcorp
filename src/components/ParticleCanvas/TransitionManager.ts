import React from "react";
import * as BABYLON from "@babylonjs/core";
import { CelestialEntity, Particle } from "./types";
import { startWormholeTransit as _startWormholeTransit } from "./WormholeTransit";
import {
  mapParticlesToInterstellar as _mapParticlesToInterstellar,
  mapParticlesToStage as _mapParticlesToStage,
} from "./ParticleMapper";

export { _startWormholeTransit as startWormholeTransit };

/**
 * Smoothly morphs current active celestial entities into target entities.
 */
export function transitionToNewEntities(
  currentEntities: CelestialEntity[],
  newEntities: CelestialEntity[],
  spawnX: number,
  spawnY: number,
  entityTransitionActiveRef: React.MutableRefObject<boolean>,
  entityTransitionStartTimeRef: React.MutableRefObject<number>
): void {
  currentEntities.forEach((cur) => {
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

  newEntities.forEach((target, i) => {
    const curNew: CelestialEntity = {
      ...target,
      x: spawnX,
      y: spawnY,
      z: 0,
      startX: spawnX,
      startY: spawnY,
      startZ: 0,
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
  tailStartIndexRef: React.MutableRefObject<number>
): void {
  _mapParticlesToInterstellar(
    width,
    height,
    celestialEntitiesRef,
    archetypeRef,
    particlesRef,
    tailStartIndexRef
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
   * Runs non-blockingly using asynchronous stages.
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
        // Stage 1: SUPERNOVA_IMPLODE (0.0 - 0.25)
        this.notify("SUPERNOVA_IMPLODE", 0.15, "Micro-Singularity Gravitational Collapse");
        if (options.onImplode) options.onImplode();
        await this.delay(250, signal);

        // Stage 2: SUPERNOVA_DETONATE (0.25 - 0.65)
        this.notify("SUPERNOVA_DETONATE", 0.45, "Relativistic Plasma Explosion & Photon Wavefront");
        if (options.onDetonate) options.onDetonate();
        await this.delay(2000, signal);

        // Stage 3: SUPERNOVA_REBIRTH (0.65 - 0.95)
        this.notify("SUPERNOVA_REBIRTH", 0.80, "Stardust Particle Condensation & Orbital Seeding");
        if (options.onRebirth) options.onRebirth();
        await this.delay(2500, signal);

        // Stage 4: TRANSITION_COMPLETE (1.0)
        this.notify("TRANSITION_COMPLETE", 1.0, "System Transition Complete");
        if (options.onComplete) options.onComplete();
        await this.delay(200, signal);

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
