/**
 * CinematicFxBus
 * --------------
 * Tiny per-frame blackboard shared by RenderEngine, the mesh synchronizer and
 * the post-processes. Keeps the (already very long) positional function
 * signatures untouched while letting the cinematic layer reach every pass.
 */

export interface CollisionEvent {
  /** World-space contact point. */
  x: number;
  y: number;
  z: number;
  /** Kinetic energy dissipated (raw units from resolveCelestialCollision). */
  energy: number;
  time: number;
}

export interface CinematicFxState {
  /** 0..1 opacity multiplier for the foreground subject (typography / bodies / HUD). */
  foregroundAlpha: number;
  /** 0..1 rack-focus amount (DoF pass). */
  rackFocus: number;
  /** 0..1 black-hole capture intensity (lensing stretch / swirl). */
  capture: number;
  /** 0..1 gravitational redshift tint. */
  redshift: number;
  /** 0..1 fade to black. */
  blackout: number;
  /** Screen UV of the capturing black hole. */
  captureUvX: number;
  captureUvY: number;
  /** 0..1 achromatic exposure flash (collisions / swallow events). */
  flash: number;
  /** Lensing pulse from a body crossing the horizon, 0..1. */
  lensPulse: number;
}

export const cinematicFx: CinematicFxState = {
  foregroundAlpha: 1,
  rackFocus: 0,
  capture: 0,
  redshift: 0,
  blackout: 0,
  captureUvX: 0.5,
  captureUvY: 0.5,
  flash: 0,
  lensPulse: 0,
};

const collisionQueue: CollisionEvent[] = [];
const MAX_QUEUED = 16;

export function emitCollision(evt: CollisionEvent) {
  if (!evt || !Number.isFinite(evt.energy) || evt.energy <= 0) return;
  if (collisionQueue.length >= MAX_QUEUED) collisionQueue.shift();
  collisionQueue.push(evt);
}

export function drainCollisions(): CollisionEvent[] {
  if (collisionQueue.length === 0) return [];
  return collisionQueue.splice(0, collisionQueue.length);
}

/** Normalised 0..1 collision severity (sqrt of energy, saturating). */
export function collisionSeverity(energy: number): number {
  if (!Number.isFinite(energy) || energy <= 0) return 0;
  return 1 - Math.exp(-Math.sqrt(energy) / 22);
}

export function resetCinematicFx() {
  cinematicFx.foregroundAlpha = 1;
  cinematicFx.rackFocus = 0;
  cinematicFx.capture = 0;
  cinematicFx.redshift = 0;
  cinematicFx.blackout = 0;
  cinematicFx.captureUvX = 0.5;
  cinematicFx.captureUvY = 0.5;
  cinematicFx.flash = 0;
  cinematicFx.lensPulse = 0;
  collisionQueue.length = 0;
}
