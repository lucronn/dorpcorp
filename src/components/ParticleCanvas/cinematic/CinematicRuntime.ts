/**
 * CinematicRuntime
 * ----------------
 * Mutable per-canvas bundle handed to RenderEngine: the transition director,
 * the gravity-reactive camera rig, an optional black-hole capture and the
 * small amount of frame-to-frame camera state the cinematic layer needs.
 */
import { CinematicTransitionDirector } from "./CinematicTransitionDirector";
import { CameraRig, GravityBody, Vec3 } from "./CameraRig";
import { CaptureState } from "./BlackHoleCapture";

export interface CinematicRuntime {
  director: CinematicTransitionDirector;
  rig: CameraRig;
  capture: CaptureState | null;
  /** Called once when a capture reaches the horizon (screen is black). */
  onCaptureComplete?: () => void;
  /** Called when the user holds the horizon zoom at its limit (plunge request). */
  onHorizonHold?: () => void;
  /** World offset added to the camera last frame (removed before the base lerp). */
  appliedOffset: Vec3;
  /** Smoothed view direction; filters out look-target discontinuities. */
  smoothedForward: Vec3 | null;
  /** Time the horizon zoom first reached its limit (0 = not holding). */
  horizonHoldSince: number;
  idleBlend: number;
  /** Seconds of idle camera travel; pauses while the user navigates. */
  idleTime: number;
  openingPending: boolean;
}

export function createCinematicRuntime(reducedMotion = false): CinematicRuntime {
  const director = new CinematicTransitionDirector();
  director.reducedMotion = reducedMotion;
  return {
    director,
    rig: new CameraRig(),
    capture: null,
    appliedOffset: { x: 0, y: 0, z: 0 },
    smoothedForward: null,
    horizonHoldSince: 0,
    idleBlend: 0,
    idleTime: 0,
    openingPending: false,
  };
}

interface BodyLike {
  x: number;
  y: number;
  z?: number;
  worldX?: number;
  worldY?: number;
  worldZ?: number;
  radius: number;
  scale?: number;
  mass?: number;
  type?: string;
  isDestroyed?: boolean;
}

/** Converts celestial entities (screen-space x/y) into rig gravity bodies. */
export function entitiesToGravityBodies(entities: BodyLike[], width: number, height: number): GravityBody[] {
  const out: GravityBody[] = [];
  for (const e of entities) {
    if (!e || e.isDestroyed || e.type === "nebula") continue;
    const scale = e.scale !== undefined && e.scale > 0 ? e.scale : 1;
    const radius = Math.max(1, (Number.isFinite(e.radius) ? e.radius : 1) * scale);
    const isBlackHole = e.type === "blackhole";
    const typeFactor = isBlackHole ? 15 : e.type === "galaxy" ? 3 : 4;
    const mass = Number.isFinite(e.mass) && (e.mass as number) > 0 ? (e.mass as number) : radius * radius * typeFactor;
    const x = e.worldX !== undefined ? e.worldX : e.x - width / 2;
    const y = e.worldY !== undefined ? e.worldY : -(e.y - height / 2);
    const z = e.worldZ !== undefined ? e.worldZ : e.z || 0;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    out.push({ x, y, z, mass, radius, isBlackHole });
  }
  return out;
}
