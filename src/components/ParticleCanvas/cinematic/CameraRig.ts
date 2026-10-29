/**
 * CameraRig
 * ---------
 * Pure math for a gravity-reactive "operator" layered on top of the base
 * camera pose. Nothing here touches Babylon; it consumes plain vectors and
 * returns small offsets that RenderEngine applies after `setTarget()`.
 *
 *  - Drift / lean: a damped pull toward the dominant mass (softened inverse
 *    square, saturating so it can never run away).
 *  - Sway: a slow lateral buffet perpendicular to the pull.
 *  - Tidal shake: smooth (sum-of-sines, no Math.random) shake that grows as the
 *    camera nears a black hole's horizon.
 *  - Kicks: an underdamped spring that collision impulses are fed into.
 *
 * All outputs are clamped, NaN-guarded and scale with `responsiveness` so
 * typography stages stay readable.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface GravityBody {
  x: number;
  y: number;
  z: number;
  mass: number;
  radius: number;
  isBlackHole?: boolean;
}

export interface GravityField {
  /** Unit direction of net pull (zero vector if negligible). */
  dir: Vec3;
  /** Saturated pull strength 0..1. */
  strength: number;
  /** 0..1 proximity to the nearest black-hole horizon. */
  horizonProximity: number;
  /** Nearest black hole, if any. */
  nearestBlackHole: GravityBody | null;
}

const ZERO: Vec3 = Object.freeze({ x: 0, y: 0, z: 0 }) as Vec3;
const fin = (v: number, d = 0) => (Number.isFinite(v) ? v : d);
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Reference mass: a typical scene's central black hole (radius 60 → mass 54000). */
export const REFERENCE_MASS = 54000;

/**
 * Net softened gravitational pull at `point` from `bodies`, normalised so a
 * reference black hole at `refDistance` produces strength ≈ 0.6.
 */
export function computeGravityField(
  point: Vec3,
  bodies: GravityBody[],
  refDistance: number
): GravityField {
  const ref = Math.max(1, fin(refDistance, 1000));
  let ax = 0;
  let ay = 0;
  let az = 0;
  let horizonProximity = 0;
  let nearestBlackHole: GravityBody | null = null;
  let nearestBhDist = Infinity;
  const soft2 = (ref * 0.08) * (ref * 0.08);

  if (Array.isArray(bodies)) {
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (!b) continue;
      const m = fin(b.mass);
      if (m <= 0) continue;
      const dx = fin(b.x) - fin(point.x);
      const dy = fin(b.y) - fin(point.y);
      const dz = fin(b.z) - fin(point.z);
      const d2 = dx * dx + dy * dy + dz * dz;
      const d = Math.sqrt(d2);
      if (d < 1e-6) continue;
      const a = m / (d2 + soft2);
      ax += (dx / d) * a;
      ay += (dy / d) * a;
      az += (dz / d) * a;

      if (b.isBlackHole) {
        const r = Math.max(1, fin(b.radius, 1));
        // Influence sphere ~ 14 horizon radii; proximity 1 at the horizon.
        const prox = clamp(1 - (d - r) / (r * 14), 0, 1);
        if (prox > horizonProximity) horizonProximity = prox;
        if (d < nearestBhDist) {
          nearestBhDist = d;
          nearestBlackHole = b;
        }
      }
    }
  }

  const mag = Math.sqrt(ax * ax + ay * ay + az * az);
  const aRef = REFERENCE_MASS / (ref * ref + soft2);
  const n = mag / aRef;
  // 1 - exp(-0.92 n) ≈ 0.6 at n = 1, saturates smoothly toward 1.
  const strength = Number.isFinite(n) ? 1 - Math.exp(-0.92 * n) : 0;
  const dir = mag > 1e-12 ? { x: ax / mag, y: ay / mag, z: az / mag } : { ...ZERO };
  return { dir, strength: clamp(strength, 0, 1), horizonProximity, nearestBlackHole };
}

/** Critically damped spring step (semi-implicit, stable for any dt ≤ 0.1 s). */
export function springStep(
  pos: number,
  vel: number,
  target: number,
  omega: number,
  zeta: number,
  dt: number
): [number, number] {
  const p = fin(pos);
  const v = fin(vel);
  const tg = fin(target);
  const h = clamp(fin(dt), 0, 0.1);
  const acc = -2 * zeta * omega * v - omega * omega * (p - tg);
  const nv = v + acc * h;
  const np = p + nv * h;
  return [fin(np), fin(nv)];
}

/** Smooth band-limited pseudo-noise in [-1, 1] (sum of incommensurate sines). */
export function smoothNoise(t: number, seed: number): number {
  const s = fin(seed);
  const x = fin(t);
  return (
    Math.sin(x * 2.31 + s * 1.7) * 0.5 +
    Math.sin(x * 3.73 + s * 4.1) * 0.3 +
    Math.sin(x * 5.97 + s * 9.3) * 0.2
  );
}

export interface RigInput {
  /** Base camera position (before rig offsets). */
  cameraPos: Vec3;
  /** Camera basis (unit vectors) used to project the pull into screen space. */
  right: Vec3;
  up: Vec3;
  forward: Vec3;
  bodies: GravityBody[];
  /** Camera rest distance (used to scale every offset). */
  cameraZ: number;
  /** 0..1 – multiplies every effect (typography stages use ~0.3). */
  responsiveness: number;
  /** Extra tidal shake from scripted events (black-hole capture), 0..1. */
  tidalBoost?: number;
  /** Seconds. */
  time: number;
  /** Seconds since last frame. */
  dt: number;
}

export interface RigOutput {
  /** World-space position offset to add to the camera. */
  offset: Vec3;
  /** Extra yaw (radians, + = turn right). */
  yaw: number;
  /** Extra pitch (radians, + = look down in Babylon's convention). */
  pitch: number;
  /** Roll (radians). */
  roll: number;
  /** Current pull strength 0..1 (for audio / FX). */
  pull: number;
  /** Current horizon proximity 0..1 (for audio / FX). */
  horizonProximity: number;
}

export const RIG_LIMITS = {
  /** Max drift as a fraction of cameraZ. */
  drift: 0.035,
  /** Max lean toward the mass (radians). */
  lean: 0.045,
  /** Max roll (radians) ≈ 1.2°. */
  roll: 0.021,
  /** Max tidal positional shake as a fraction of cameraZ. */
  shake: 0.006,
  /** Max tidal rotational shake (radians). */
  shakeRot: 0.012,
  /** Max kick displacement as a fraction of cameraZ. */
  kick: 0.03,
};

const dot = (a: Vec3, b: Vec3) => fin(a.x) * fin(b.x) + fin(a.y) * fin(b.y) + fin(a.z) * fin(b.z);

export class CameraRig {
  // drift spring (screen-space right/up/forward components, units = cameraZ fractions)
  private dr = [0, 0, 0];
  private dv = [0, 0, 0];
  private leanP = [0, 0];
  private leanV = [0, 0];
  private rollP = 0;
  private rollV = 0;
  private kickP = [0, 0, 0];
  private kickV = [0, 0, 0];
  private shakeEnv = 0;
  private lastPull = 0;
  private lastProx = 0;

  /**
   * Add a collision impulse. `dir` is the world-space direction the camera is
   * shoved; strength is 0..1 (≈ sqrt of normalised energy).
   */
  addImpulse(dir: Vec3, strength: number, basis?: { right: Vec3; up: Vec3; forward: Vec3 }) {
    const s = clamp(fin(strength), 0, 1);
    if (s <= 0) return;
    let r = fin(dir.x);
    let u = fin(dir.y);
    let f = fin(dir.z);
    if (basis) {
      r = dot(dir, basis.right);
      u = dot(dir, basis.up);
      f = dot(dir, basis.forward);
    }
    const len = Math.sqrt(r * r + u * u + f * f) || 1;
    const k = s * 0.55; // velocity in cameraZ-fractions / s
    this.kickV[0] += (r / len) * k;
    this.kickV[1] += (u / len) * k;
    this.kickV[2] += (f / len) * k * 0.6;
    this.shakeEnv = Math.min(1, this.shakeEnv + s * 0.6);
  }

  reset() {
    this.dr = [0, 0, 0];
    this.dv = [0, 0, 0];
    this.leanP = [0, 0];
    this.leanV = [0, 0];
    this.rollP = 0;
    this.rollV = 0;
    this.kickP = [0, 0, 0];
    this.kickV = [0, 0, 0];
    this.shakeEnv = 0;
  }

  get kickEnergy(): number {
    return Math.hypot(this.kickP[0]!, this.kickP[1]!, this.kickP[2]!) + Math.hypot(this.kickV[0]!, this.kickV[1]!, this.kickV[2]!) * 0.1;
  }

  update(input: RigInput): RigOutput {
    const dt = clamp(fin(input.dt, 1 / 60), 0, 0.05);
    const camZ = Math.max(10, fin(input.cameraZ, 1000));
    const resp = clamp(fin(input.responsiveness, 1), 0, 1);
    const time = fin(input.time);

    const field = computeGravityField(input.cameraPos, input.bodies, camZ);
    const pull = field.strength;
    const prox = clamp(Math.max(field.horizonProximity, fin(input.tidalBoost ?? 0)), 0, 1);
    this.lastPull = pull;
    this.lastProx = prox;

    // Project the pull into the camera basis.
    const pr = dot(field.dir, input.right);
    const pu = dot(field.dir, input.up);
    const pf = dot(field.dir, input.forward);

    // 1. Drift toward the mass (critically damped, ω = 1.6 rad/s → ~2 s settle).
    const driftAmt = pull * RIG_LIMITS.drift * resp;
    const targets = [pr * driftAmt, pu * driftAmt, pf * driftAmt * 0.6];
    for (let i = 0; i < 3; i++) {
      [this.dr[i], this.dv[i]] = springStep(this.dr[i]!, this.dv[i]!, targets[i]!, 1.6, 1.0, dt);
    }

    // 2. Lean the view slightly toward the mass.
    const leanAmt = pull * RIG_LIMITS.lean * resp;
    [this.leanP[0], this.leanV[0]] = springStep(this.leanP[0]!, this.leanV[0]!, pr * leanAmt, 1.3, 1.0, dt);
    [this.leanP[1], this.leanV[1]] = springStep(this.leanP[1]!, this.leanV[1]!, pu * leanAmt, 1.3, 1.0, dt);

    // 3. Bank into the pull (roll ≤ 1.2°).
    const rollTarget = -pr * pull * RIG_LIMITS.roll * resp;
    [this.rollP, this.rollV] = springStep(this.rollP, this.rollV, rollTarget, 1.2, 1.0, dt);

    // 4. Kick spring (underdamped: ζ 0.42, ω 8.5) – collisions.
    for (let i = 0; i < 3; i++) {
      [this.kickP[i], this.kickV[i]] = springStep(this.kickP[i]!, this.kickV[i]!, 0, 8.5, 0.42, dt);
      this.kickP[i] = clamp(this.kickP[i]!, -RIG_LIMITS.kick, RIG_LIMITS.kick);
    }
    this.shakeEnv *= Math.exp(-dt * 3.2);

    // 5. Sway perpendicular to the pull (0.11–0.17 Hz) – orbital buffeting.
    const swayAmp = pull * RIG_LIMITS.drift * 0.28 * resp;
    const swayR = Math.sin(time * 0.71) * swayAmp * -pu;
    const swayU = Math.sin(time * 1.07 + 1.3) * swayAmp * pr;

    // 6. Tidal shake (quadratic in proximity) + collision rattle.
    const tidal = prox * prox * (0.35 + 0.65 * resp);
    const rattle = this.shakeEnv * resp;
    const shakePos = (tidal + rattle * 0.5) * RIG_LIMITS.shake;
    const tt = time * (1 + prox * 1.8);
    const sr = smoothNoise(tt * 3.1, 1) * shakePos;
    const su = smoothNoise(tt * 3.4, 2) * shakePos;
    const shakeRot = (tidal + rattle * 0.4) * RIG_LIMITS.shakeRot;

    const offR = (this.dr[0]! + this.kickP[0]! + swayR + sr) * camZ;
    const offU = (this.dr[1]! + this.kickP[1]! + swayU + su) * camZ;
    const offF = (this.dr[2]! + this.kickP[2]!) * camZ;

    const offset = {
      x: fin(input.right.x * offR + input.up.x * offU + input.forward.x * offF),
      y: fin(input.right.y * offR + input.up.y * offU + input.forward.y * offF),
      z: fin(input.right.z * offR + input.up.z * offU + input.forward.z * offF),
    };

    return {
      offset,
      yaw: clamp(fin(this.leanP[0]! + smoothNoise(tt * 2.6, 3) * shakeRot * 0.6), -0.2, 0.2),
      // Babylon: +rotation.x pitches the view down; lean "up" toward a mass above → negative.
      pitch: clamp(fin(-this.leanP[1]! + smoothNoise(tt * 2.9, 4) * shakeRot * 0.6), -0.2, 0.2),
      roll: clamp(fin(this.rollP + smoothNoise(tt * 2.2, 5) * shakeRot), -0.06, 0.06),
      pull: this.lastPull,
      horizonProximity: this.lastProx,
    };
  }
}
