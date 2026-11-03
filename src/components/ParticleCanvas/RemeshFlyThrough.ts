import * as BABYLON from "@babylonjs/core";
import { REMESH_FLIGHT_TIMING, type RemeshCover } from "./RemeshCover";
import type { CelestialEntity, Particle } from "./types";
import { DeepSpaceField } from "./DeepSpaceField";

const clamp = (t: number) => Math.max(0, Math.min(1, t));
const ease = (t: number) => { const u = clamp(t); return u * u * (3 - 2 * u); };
type Pose = { position: BABYLON.Vector3; rotation: BABYLON.Quaternion; fov: number };
type Knot = { position: BABYLON.Vector3; velocity: BABYLON.Vector3 };
const forward = (rotation: BABYLON.Quaternion) => BABYLON.Vector3.Forward().applyRotationQuaternion(rotation);

/** Cubic position spline with explicit flight velocities, independent of view attitude. */
function spline(knots: Knot[], t: number) {
  const scaled = clamp(t) * (knots.length - 1);
  const i = Math.min(knots.length - 2, Math.floor(scaled)), u = scaled - i;
  const a = knots[i], b = knots[i + 1], span = 1 / (knots.length - 1);
  return BABYLON.Vector3.Hermite(a.position, a.velocity.scale(span), b.position, b.velocity.scale(span), u);
}

/** The camera is the craft: accelerate along its nose, dive, bank and pull up.
 * No position orbit or scene-centre look-at is used by this camera owner. */
export class RemeshFlyThrough {
  readonly stars: DeepSpaceField;
  private base: Pose | null = null;
  private source: Pose | null = null;
  private presented: Pose | null = null;
  private arrival: Pose | null = null;
  private destination: Pose | null = null;
  private departure = -1;
  private side = 1;
  private scale = 600;
  private hidden = false;
  private knots: Knot[] = [];
  private approach: Knot[] = [];
  private approachLengths: number[] = [];
  private approachEntrySpeed = 0;
  private corners: BABYLON.Vector3[] = [];
  private velocity = BABYLON.Vector3.Zero();
  private entrySpeed = 0;
  private escapeSpeed = 0;
  private cruisePose: Pose | null = null;
  private presentedTime = 0;

  constructor(private scene: BABYLON.Scene, private camera: BABYLON.TargetCamera) {
    this.stars = new DeepSpaceField(scene);
  }

  private snapshot(): Pose {
    return { position: this.camera.position.clone(),
      rotation: this.camera.rotationQuaternion?.clone() ?? BABYLON.Quaternion.FromEulerVector(this.camera.rotation), fov: this.camera.fov };
  }

  private install(pose: Pose) {
    this.camera.position.copyFrom(pose.position);
    this.camera.rotation.copyFrom(pose.rotation.toEulerAngles());
    this.camera.rotationQuaternion?.copyFrom(pose.rotation);
    this.camera.fov = pose.fov;
    this.camera.getViewMatrix(true);
  }

  /** The scene director computes a destination independently; never feed the
   * previous flight pose back into its orbit/parallax damping. */
  restore() { if (this.base) this.install(this.base); }

  /** Actual uploaded mutable particles and meshes, including trails and glows.
   * Persistent stars are independent of remapping and deliberately stay visible. */
  private measure(particles: Particle[], positions: Float32Array, colors: Float32Array) {
    const min = new BABYLON.Vector3(Infinity, Infinity, Infinity);
    const max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);
    const include = (x: number, y: number, z: number) => {
      if (!Number.isFinite(x + y + z)) return;
      min.x = Math.min(min.x, x); min.y = Math.min(min.y, y); min.z = Math.min(min.z, z);
      max.x = Math.max(max.x, x); max.y = Math.max(max.y, y); max.z = Math.max(max.z, z);
    };
    particles.forEach((p, i) => {
      if (!p.isCosmicAmbient && colors[i * 4 + 3] > 0 && (!p.isTail || p.life > 0)) {
        include(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      }
    });
    for (const mesh of this.scene.meshes) {
      if (mesh === this.stars.mesh || mesh.name === "pointsMesh" || !mesh.isEnabled() ||
          !mesh.isVisible || mesh.visibility === 0 || !mesh.getTotalVertices()) continue;
      mesh.computeWorldMatrix(true);
      const box = mesh.getBoundingInfo().boundingBox;
      include(box.minimumWorld.x, box.minimumWorld.y, box.minimumWorld.z);
      include(box.maximumWorld.x, box.maximumWorld.y, box.maximumWorld.z);
    }
    if (!Number.isFinite(min.x)) { min.setAll(-1); max.setAll(1); }
    this.corners = [];
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
      this.corners.push(new BABYLON.Vector3(x, y, z));
    }
  }

  /** Independent yaw/pitch controls steer the craft; roll banks the view without
   * steering the velocity sideways. Ease angular rates in/out, not a look-at. */
  private attitude(t: number) {
    const flight = clamp(t / 0.72);
    const turn = ease((flight - 0.08) / 0.92);
    const pitch = 0.22 * Math.sin(Math.PI * ease(flight)) - 0.4 * ease((flight - 0.32) / 0.68);
    return this.source!.rotation.multiply(BABYLON.Quaternion.FromEulerAngles(
      pitch, this.side * 2.55 * turn, -this.side * 0.24 * Math.sin(Math.PI * turn)));
  }

  private speed(t: number) {
    // Units per normalized departure; continuity into the hidden cruise.
    return this.entrySpeed + (this.scale * 2.2 - this.entrySpeed) * ease(t / 0.38) +
      this.escapeSpeed * ease((t - 0.72) / 0.28);
  }

  private begin(source: Pose, entities: CelestialEntity[], width: number, height: number) {
    this.source = source;
    this.arrival = this.destination = this.cruisePose = null;
    const nose = forward(source.rotation), right = BABYLON.Vector3.Right().applyRotationQuaternion(source.rotation);
    const neighbors = entities.filter(e => !e.isDestroyed && !e.isOutgoing &&
      ["planet", "star", "blackhole", "neutron_star", "galaxy"].includes(e.type))
      .map(e => new BABYLON.Vector3(e.worldX ?? e.x - width / 2,
        e.worldY ?? height / 2 - e.y, e.worldZ ?? e.z ?? 0))
      .filter(world => BABYLON.Vector3.Dot(world.subtract(source.position), nose) > 0)
      .sort((a, b) => BABYLON.Vector3.DistanceSquared(a, source.position) - BABYLON.Vector3.DistanceSquared(b, source.position));
    const neighbor = neighbors[0];
    const distance = neighbor ? BABYLON.Vector3.Distance(neighbor, source.position) : source.position.length();
    this.scale = Math.max(100, Math.min(900, distance * 0.32));
    this.escapeSpeed = 0;
    // Bend away from the nearby body's centre to make a forward fly-by.
    this.side = neighbor && BABYLON.Vector3.Dot(neighbor.subtract(source.position), right) < 0 ? 1 : -1;
    this.entrySpeed = Math.min(this.scale * 2.2, this.velocity.length() * REMESH_FLIGHT_TIMING.depart);
    const build = () => {
      const steps = 96;
      let position = source.position.clone();
      this.knots = [{ position, velocity: nose.scale(this.speed(0)) }];
      for (let i = 1; i <= steps; i++) {
        const mid = (i - 0.5) / steps;
        position = position.add(forward(this.attitude(mid)).scale(this.speed(mid) / steps));
        this.knots.push({ position, velocity: forward(this.attitude(i / steps)).scale(this.speed(i / steps)) });
      }
    };
    build();
    // Plan clearance after the bank, when the nose points into open space.
    // Scaling the initial push to the whole particle volume would drive through
    // a nearby body. The final 28% integrates a smooth extra throttle ramp.
    const exit = forward(this.attitude(1));
    const depth = Math.max(...this.corners.map(c => BABYLON.Vector3.Dot(c.subtract(source.position), exit))) + 700;
    const travel = BABYLON.Vector3.Dot(this.knots.at(-1)!.position.subtract(source.position), exit);
    if (depth > travel) { this.escapeSpeed = (depth - travel) / 0.14; build(); }
  }

  /** Revalidate every hidden frame, including resized/new geometry. Any extra
   * clearance is forward thrust and persists; shrinking bounds cannot pull back. */
  private excludeVolume(pose: Pose) {
    const nose = forward(pose.rotation);
    const depth = Math.max(...this.corners.map(c => BABYLON.Vector3.Dot(c.subtract(pose.position), nose)));
    if (depth > -192) pose.position.addInPlace(nose.scale(depth + 192));
    return pose;
  }

  private cruise(cover: RemeshCover, dt: number): Pose {
    if (!this.cruisePose) this.cruisePose = { position: this.knots.at(-1)!.position.clone(), rotation: this.attitude(1), fov: this.source!.fov };
    const s = cover.mode === "cut" ? 0 : cover.hiddenTime / 1000;
    const rotation = this.attitude(1).multiply(BABYLON.Quaternion.FromEulerAngles(
      0.08 * Math.sin(s * 1.7), this.side * 0.12 * Math.sin(s * 1.5), this.side * 0.07 * Math.sin(s * 1.9)));
    const mid = BABYLON.Quaternion.Slerp(this.cruisePose.rotation, rotation, 0.5);
    if (cover.mode !== "cut") this.cruisePose.position.addInPlace(forward(mid).scale(
      this.speed(1) * Math.min(dt, cover.hiddenTime) / REMESH_FLIGHT_TIMING.depart));
    this.cruisePose.rotation = rotation;
    return this.excludeVolume(this.cruisePose);
  }

  private beginApproach(desired: Pose) {
    this.arrival = this.presented!;
    this.destination = desired;
    const start = this.arrival.position, end = desired.position;
    const distance = Math.max(300, BABYLON.Vector3.Distance(start, end));
    const nose = forward(desired.rotation);
    const right = BABYLON.Vector3.Right().applyRotationQuaternion(desired.rotation);
    const up = BABYLON.Vector3.Up().applyRotationQuaternion(desired.rotation);
    const side = BABYLON.Vector3.Dot(start.subtract(end), right) < 0 ? -1 : 1;
    // Swing behind the destination's viewing position, then thrust into it.
    // The final tangent points *forward*, so arrival cannot become a backwards dolly.
    const gate = end.subtract(nose.scale(distance * 0.55)).add(right.scale(side * distance * 0.65)).add(up.scale(distance * 0.18));
    this.approach = [
      { position: start, velocity: forward(this.arrival.rotation).scale(distance * 2) },
      { position: gate, velocity: right.scale(-side * distance * 2) },
      { position: end, velocity: nose.scale(distance * 1.5) },
    ];
    this.approachLengths = [0];
    let last = start;
    for (let i = 1; i <= 160; i++) {
      const next = spline(this.approach, i / 160);
      this.approachLengths.push(this.approachLengths[i - 1] + BABYLON.Vector3.Distance(last, next));
      last = next;
    }
    this.approachEntrySpeed = Math.min(this.approachLengths.at(-1)! * 1.8,
      this.velocity.length() * REMESH_FLIGHT_TIMING.arrive);
  }

  private approachPose(t: number): Pose {
    const length = this.approachLengths.at(-1)!;
    // Arc-length timing maintains the incoming thrust and brakes to a stop.
    const distance = (-2 * t ** 3 + 3 * t * t) * length + (t ** 3 - 2 * t * t + t) * this.approachEntrySpeed;
    let i = this.approachLengths.findIndex(n => n >= distance);
    i = Math.max(1, i < 0 ? this.approachLengths.length - 1 : i);
    const u = (i - 1 + (distance - this.approachLengths[i - 1]) /
      (this.approachLengths[i] - this.approachLengths[i - 1])) / 160;
    const position = spline(this.approach, u);
    // The observer looks a little into the upcoming turn, independently of the
    // rail position. This is a flight heading, never a locked world-space target.
    const headingAt = clamp(u + 0.008 * Math.sin(Math.PI * t));
    const direction = spline(this.approach, Math.min(1, headingAt + 0.0001))
      .subtract(spline(this.approach, Math.max(0, headingAt - 0.0001))).normalize();
    const startRoll = this.arrival!.rotation.toEulerAngles().z;
    const endRoll = this.destination!.rotation.toEulerAngles().z;
    const roll = startRoll * (1 - ease(t)) + endRoll * ease(t) + this.side * 0.2 * Math.sin(Math.PI * t);
    const rotation = BABYLON.Quaternion.FromEulerAngles(-Math.asin(direction.y), Math.atan2(direction.x, direction.z), roll);
    return { position, rotation, fov: this.arrival!.fov + (this.destination!.fov - this.arrival!.fov) * ease(t) };
  }

  apply(cover: RemeshCover, entities: CelestialEntity[], width: number, height: number,
    particles: Particle[], positions: Float32Array, colors: Float32Array) {
    if (cover.phase === "idle") {
      // Present the exact endpoint before releasing ownership to director damping.
      if (this.destination) this.install(this.destination);
      this.base = this.source = this.arrival = this.destination = null;
      this.hidden = false;
      this.velocity.setAll(0);
      this.stars.follow(this.camera);
      return;
    }
    this.measure(particles, positions, colors);
    this.hidden = cover.flightProgress === 1 && cover.phase !== "returning";
    const desired = this.snapshot();
    if (!this.source || this.departure !== cover.departure) {
      this.begin(this.base && this.presented ? this.presented : desired, entities, width, height);
      this.departure = cover.departure;
      this.presentedTime = cover.flightTime;
    }
    this.base = desired;
    const dt = Math.max(0, cover.flightTime - this.presentedTime);
    let pose: Pose;
    if (cover.phase === "returning") {
      if (!this.arrival) this.beginApproach(desired);
      const t = 1 - cover.flightProgress;
      if (cover.mode === "cut") {
        const nudge = 1 - ease(t), destination = this.destination!;
        pose = { position: destination.position.subtract(forward(destination.rotation).scale(4 * nudge)),
          rotation: destination.rotation.multiply(BABYLON.Quaternion.FromEulerAngles(0.002 * nudge, this.side * 0.003 * nudge, 0)), fov: destination.fov };
      } else pose = this.approachPose(t);
    } else if (this.hidden || cover.mode === "cut") pose = this.cruise(cover, dt);
    else pose = { position: spline(this.knots, cover.flightProgress), rotation: this.attitude(cover.flightProgress), fov: this.source!.fov };
    this.install(pose);
    this.stars.follow(this.camera);
    if (dt > 0 && this.presented) this.velocity = pose.position.subtract(this.presented.position).scale(1 / dt);
    this.presented = this.snapshot();
    this.presentedTime = cover.flightTime;
  }

  /** Near-plane exclusion also prevents large point sprites leaking at edges. */
  coverage() {
    const view = this.camera.getViewMatrix(true);
    const maxDepth = Math.max(...this.corners.map(c => BABYLON.Vector3.TransformCoordinates(c, view).z));
    const margin = this.camera.minZ - maxDepth - 16;
    const ready = this.stars.ready;
    return { occluded: !!this.base && this.hidden && ready && margin > 0, margin, ready };
  }

  diagnostics() {
    const direction = this.camera.getForwardRay().direction;
    return { ...this.coverage(), cameraOwner: this.base ? "first-person-flight" : "scene-director",
      cameraX: this.camera.position.x, cameraY: this.camera.position.y, cameraZ: this.camera.position.z,
      cameraPitch: this.camera.rotation.x, cameraYaw: this.camera.rotation.y, cameraRoll: this.camera.rotation.z,
      forwardX: direction.x, forwardY: direction.y, forwardZ: direction.z,
      starfieldEnabled: this.stars.mesh.isEnabled(), occluderEnabled: false };
  }

  dispose() { this.stars.dispose(); }
}
