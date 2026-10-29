/**
 * BlackHoleCapture
 * ----------------
 * Pure camera choreography for getting "sucked into" a black hole:
 *
 *   PULL   – accelerating inspiral from the current camera pose. Radius shrinks
 *            ~ (1 - u^2.2), angular speed grows ~ u^2, so the fall visibly
 *            speeds up. Tidal shake, FOV widening, lensing/stretch ramp up.
 *   CROSS  – the last 25 %: gravitational redshift + fade to black.
 *   DONE   – caller rebuilds the scene while black and emerges via the director.
 *
 * The pose at u = 0 equals the starting pose exactly, so taking over the
 * camera never snaps.
 */
import { Vec3 } from "./CameraRig";

export interface CaptureState {
  startTime: number;
  durationMs: number;
  startPos: Vec3;
  /** Where the camera was looking at start (for a continuous hand-over). */
  startLook: Vec3;
  bh: Vec3;
  bhRadius: number;
  /** Orbit sense (+1 / -1). */
  spin: number;
}

export interface CapturePose {
  pos: Vec3;
  look: Vec3;
  /** 0..1 – drives lensing strength / spaghettification stretch. */
  capture: number;
  /** 0..1 – gravitational redshift tint. */
  redshift: number;
  /** 0..1 – fade to black. */
  blackout: number;
  /** Extra FOV (radians). */
  fov: number;
  /** Roll (radians). */
  roll: number;
  /** 0..1 – tidal shake boost fed into the CameraRig. */
  tidal: number;
  /** Normalised progress. */
  u: number;
  done: boolean;
}

export const CAPTURE_DEFAULT_DURATION_MS = 4200;

const fin = (v: number, d = 0) => (Number.isFinite(v) ? v : d);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : Number.isFinite(v) ? v : 0);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function createCaptureState(
  now: number,
  startPos: Vec3,
  startLook: Vec3,
  bh: Vec3,
  bhRadius: number,
  durationMs = CAPTURE_DEFAULT_DURATION_MS
): CaptureState {
  const rel = { x: fin(startPos.x) - fin(bh.x), z: fin(startPos.z) - fin(bh.z) };
  // Spin so the camera initially swings toward whichever side it is already on.
  const spin = rel.x >= 0 ? 1 : -1;
  return {
    startTime: fin(now),
    durationMs: Math.max(500, fin(durationMs, CAPTURE_DEFAULT_DURATION_MS)),
    startPos: { x: fin(startPos.x), y: fin(startPos.y), z: fin(startPos.z) },
    startLook: { x: fin(startLook.x), y: fin(startLook.y), z: fin(startLook.z) },
    bh: { x: fin(bh.x), y: fin(bh.y), z: fin(bh.z) },
    bhRadius: Math.max(1, fin(bhRadius, 40)),
    spin,
  };
}

export function computeCapturePose(state: CaptureState, now: number): CapturePose {
  const u = clamp01((fin(now) - state.startTime) / state.durationMs);
  const { bh, startPos } = state;

  const vx = startPos.x - bh.x;
  const vy = startPos.y - bh.y;
  const vz = startPos.z - bh.z;
  const r0 = Math.max(state.bhRadius * 1.5, Math.sqrt(vx * vx + vy * vy + vz * vz));
  const horiz = Math.sqrt(vx * vx + vz * vz) || 1e-6;
  const az0 = Math.atan2(vx, vz);
  const el0 = Math.atan2(vy, horiz);

  // Accelerating inspiral.
  const fall = Math.pow(u, 2.2);
  const rEnd = state.bhRadius * 1.08;
  const r = r0 + (rEnd - r0) * fall;
  const az = az0 + state.spin * Math.PI * 2.1 * u * u * u;
  // Settle toward the accretion plane (slightly above it).
  const el = el0 + (0.1 - el0) * smooth(0, 0.85, u);

  const pos = {
    x: bh.x + r * Math.cos(el) * Math.sin(az),
    y: bh.y + r * Math.sin(el),
    z: bh.z + r * Math.cos(el) * Math.cos(az),
  };

  // Look target: blend from the original look point to the singularity, with
  // a slight tangential lead (the camera "falls" around the hole).
  const lookBlend = smooth(0, 0.3, u);
  const tx = Math.cos(az);
  const tz = -Math.sin(az);
  const lead = r * 0.18 * u * state.spin;
  const look = {
    x: state.startLook.x + (bh.x + tx * lead - state.startLook.x) * lookBlend,
    y: state.startLook.y + (bh.y - state.startLook.y) * lookBlend,
    z: state.startLook.z + (bh.z + tz * lead - state.startLook.z) * lookBlend,
  };

  const capture = smooth(0.0, 0.9, u);
  const redshift = smooth(0.55, 0.95, u);
  const blackout = smooth(0.74, 1.0, u);
  return {
    pos,
    look,
    capture,
    redshift,
    blackout,
    fov: 0.55 * u * u,
    roll: state.spin * 0.35 * u * u * u,
    tidal: smooth(0.05, 0.8, u),
    u,
    done: u >= 1,
  };
}
