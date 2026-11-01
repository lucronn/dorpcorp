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
  /** Racked focal distance multiplier (1.0 = normal subject plane, <1 = close bokeh rack). */
  focusDistanceFactor: number;
  /** Depth-of-field aperture depth multiplier (smaller = shallower DoF / softer bokeh discs). */
  apertureDepthFactor: number;
  /** 0..1 global transition progress for staggered particle wavefronts. */
  transitionProgress: number;
  /** Instantaneous camera angular velocity (rad/s) for velocity-stretched motion blur. */
  angularVelocity: number;
  /** Volumetric bloom flash spike (0..1) during Kilonova / TDE flash masking. */
  bloomSpike: number;
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
  transitionLens: number;
  collisionStress: number;
  dofAmount: number;
  exposure: number;
  bloom: number;
  typography: boolean;
}

export const cinematicFx: CinematicFxState = {
  foregroundAlpha: 1,
  rackFocus: 0,
  focusDistanceFactor: 1,
  apertureDepthFactor: 1,
  transitionProgress: 1,
  angularVelocity: 0,
  bloomSpike: 0,
  capture: 0,
  redshift: 0,
  blackout: 0,
  captureUvX: 0.5,
  captureUvY: 0.5,
  flash: 0,
  lensPulse: 0,
  transitionLens: 0,
  collisionStress: 0,
  dofAmount: 0,
  exposure: 1,
  bloom: 0.06,
  typography: false,
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

const finite = (n: number, fallback: number) => Number.isFinite(n) ? n : fallback;
const unit = (n: number) => Math.max(0, Math.min(1, finite(n, 0)));

/** Focus tracks actual shot distance. Exposure and bloom have independent headroom
 * limits so an impact retains the subject silhouette and in-canvas labels. */
export function updateCinematicOptics(fx: CinematicFxState, input: {
  dt: number;
  subjectDistance: number;
  restDistance: number;
  rackFocus: number;
  apertureDepthFactor: number;
  bloomSpike: number;
  music: number;
  typography: boolean;
  cinematic: boolean;
  reducedMotion: boolean;
}) {
  const dt = Math.max(0, Math.min(0.1, finite(input.dt, 0)));
  const follow = 1 - Math.exp(-dt * 7);
  const rest = Math.max(1, finite(input.restDistance, 1000));
  const distance = Math.max(0.08, Math.min(3, finite(input.subjectDistance, rest) / rest));
  const severity = unit(fx.collisionStress);
  const rack = unit(input.rackFocus) * (input.typography ? 0.3 : 1);
  const close = unit(1 - distance);
  const focus = distance * (1 - rack * 0.2 - severity * 0.025);
  const aperture = Math.max(input.typography ? 0.75 : 0.3,
    finite(input.apertureDepthFactor, 1) * (1 - close * 0.28 - severity * 0.12));
  const light = input.reducedMotion ? 0 : unit(input.bloomSpike) * 0.13 + severity * 0.1;
  const exposure = 1 + Math.min(input.typography ? 0.07 : 0.16, light + (input.cinematic ? 0.035 : 0) + close * 0.025);
  const bloom = Math.min(input.typography ? 0.13 : 0.28,
    0.06 + close * 0.035 + light + unit(input.music) * 0.1);
  fx.focusDistanceFactor += (focus - fx.focusDistanceFactor) * follow;
  fx.apertureDepthFactor += (aperture - fx.apertureDepthFactor) * follow;
  fx.exposure += (exposure - fx.exposure) * follow;
  fx.bloom += (bloom - fx.bloom) * follow;
  fx.rackFocus = rack;
  fx.typography = input.typography;
  fx.dofAmount = input.reducedMotion ? 0 : Math.min(input.typography ? 0.18 : 0.85,
    (input.cinematic ? 0.35 : 0.08) + close * 0.32 + rack * 0.55 + severity * 0.12);
  fx.collisionStress = severity * Math.exp(-dt * 3.8);
}

export function resetCinematicFx() {
  cinematicFx.foregroundAlpha = 1;
  cinematicFx.rackFocus = 0;
  cinematicFx.focusDistanceFactor = 1;
  cinematicFx.apertureDepthFactor = 1;
  cinematicFx.transitionProgress = 1;
  cinematicFx.angularVelocity = 0;
  cinematicFx.bloomSpike = 0;
  cinematicFx.capture = 0;
  cinematicFx.redshift = 0;
  cinematicFx.blackout = 0;
  cinematicFx.captureUvX = 0.5;
  cinematicFx.captureUvY = 0.5;
  cinematicFx.flash = 0;
  cinematicFx.lensPulse = 0;
  cinematicFx.transitionLens = 0;
  cinematicFx.collisionStress = 0;
  cinematicFx.dofAmount = 0;
  cinematicFx.exposure = 1;
  cinematicFx.bloom = 0.06;
  cinematicFx.typography = false;
  collisionQueue.length = 0;
}
