import * as BABYLON from "@babylonjs/core";
import { REMESH_FLIGHT_TIMING, type RemeshCover } from "./RemeshCover";
import type { CelestialEntity, Particle } from "./types";
import { DeepSpaceField } from "./DeepSpaceField";

const ease = (t: number) => t * t * (3 - 2 * t);
type Pose = { position: BABYLON.Vector3; rotation: BABYLON.Quaternion; fov: number };
type Key = Pose & { at: number };

/** Piecewise Hermite position spline, with shared velocities at each waypoint.
 * Quaternion interpolation keeps yaw wraparound out of the flight path. */
function ride(keys: Key[], t: number, entry: BABYLON.Vector3, exit: BABYLON.Vector3): Pose {
  const i = Math.min(keys.length - 2, Math.max(0, keys.findIndex(k => k.at >= t) - 1));
  const a = keys[i], b = keys[i + 1], span = b.at - a.at;
  const velocity = (index: number) => index === 0 ? entry : index === keys.length - 1 ? exit
    : keys[index + 1].position.subtract(keys[index - 1].position).scale(1 / (keys[index + 1].at - keys[index - 1].at));
  const u = Math.max(0, Math.min(1, (t - a.at) / span));
  return {
    position: BABYLON.Vector3.Hermite(a.position, velocity(i).scale(span), b.position, velocity(i + 1).scale(span), u),
    rotation: BABYLON.Quaternion.Slerp(a.rotation, b.rotation, ease(u)),
    fov: a.fov + (b.fov - a.fov) * ease(u),
  };
}

/** A body-side dive, bank into a moving off-frustum corridor, then a separate
 * approach over the formed destination. Only this owner installs the flight pose. */
export class RemeshPanAway {
  readonly stars: DeepSpaceField;
  private base: Pose | null = null;
  private source: Pose | null = null;
  private presented: Pose | null = null;
  private arrival: Pose | null = null;
  private departure = -1;
  private side = 1;
  private scale = 600;
  private hidden = false;
  private keys: Key[] = [];
  private corners: BABYLON.Vector3[] = [];
  private velocity = BABYLON.Vector3.Zero();
  private entryVelocity = BABYLON.Vector3.Zero();
  private arrivalVelocity = BABYLON.Vector3.Zero();
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

  /** Restore the director's independent pose before simulation, never feed the
   * previous flight offset into orbit/parallax damping. */
  restore() { if (this.base) this.install(this.base); }

  /** Bound the actual uploaded particles and meshes, including trails and glows.
   * Ambient stars are independent of remapping and deliberately stay in view. */
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

  private offset(pose: Pose, x: number, y: number, z: number) {
    return new BABYLON.Vector3(x, y, z).scale(this.scale).applyRotationQuaternion(pose.rotation);
  }

  /** Project onto a safe half-space on EVERY hidden frame, including changed
   * geometry/FOV/viewport. All mutable bounds end up behind the near plane. */
  private excludeVolume(pose: Pose, clearance = 192) {
    const direction = BABYLON.Vector3.Forward().applyRotationQuaternion(pose.rotation);
    const depth = Math.max(...this.corners.map(c => BABYLON.Vector3.Dot(c.subtract(pose.position), direction)));
    if (depth > -clearance) pose.position.addInPlace(direction.scale(depth + clearance));
    return pose;
  }

  private cruise(time: number): Pose {
    const source = this.source!, end = this.keys[this.keys.length - 1];
    const s = time / 1000;
    return {
      position: end.position.add(this.offset(source, this.side * 0.48 * s,
        0.24 * s + 0.08 * (1 - Math.cos(s * 2)), 0.38 * s)),
      rotation: end.rotation.multiply(BABYLON.Quaternion.FromEulerAngles(
        0.055 * Math.sin(s * 1.8), this.side * 0.11 * Math.sin(s * 1.4), 0.035 * Math.sin(s * 2))),
      fov: end.fov,
    };
  }

  private begin(source: Pose, entities: CelestialEntity[], width: number, height: number) {
    this.source = source;
    this.arrival = null;
    const forward = BABYLON.Vector3.Forward().applyRotationQuaternion(source.rotation);
    const right = BABYLON.Vector3.Right().applyRotationQuaternion(source.rotation);
    const neighbors = entities.filter(e => !e.isDestroyed && !e.isOutgoing &&
      ["planet", "star", "blackhole", "neutron_star", "galaxy"].includes(e.type))
      .map(e => ({ entity: e, world: new BABYLON.Vector3(e.worldX ?? e.x - width / 2,
        e.worldY ?? height / 2 - e.y, e.worldZ ?? e.z ?? 0) }))
      .filter(({ world }) => BABYLON.Vector3.Dot(world.subtract(source.position), forward) > 0)
      .sort((a, b) => BABYLON.Vector3.DistanceSquared(a.world, source.position) - BABYLON.Vector3.DistanceSquared(b.world, source.position));
    const neighbor = neighbors[0];
    const distance = neighbor ? BABYLON.Vector3.Distance(neighbor.world, source.position) : source.position.length();
    this.scale = Math.max(320, Math.min(1100, distance * 0.55));
    if (neighbor) this.side = BABYLON.Vector3.Dot(neighbor.world.subtract(source.position), right) < 0 ? -1 : 1;

    // Keep the nearby body in sight during the initial dive; pass beneath its
    // plane, then climb and bank out. The return takes a different, higher route.
    const pass = { position: source.position.add(this.offset(source, this.side * 0.34, -0.3, 0.72)),
      rotation: source.rotation.multiply(BABYLON.Quaternion.FromEulerAngles(-0.1, this.side * 0.24, -this.side * 0.055)),
      fov: source.fov };
    const end = this.excludeVolume({ position: source.position.add(this.offset(source, this.side * 1.25, 0.36, 1.05)),
      rotation: source.rotation.multiply(BABYLON.Quaternion.FromEulerAngles(0.18, this.side * 1.42, this.side * 0.045)),
      fov: source.fov }, this.scale * 0.65 + 192);
    this.keys = [{ ...source, at: 0 }, { ...pass, at: 0.46 }, { ...end, at: 1 }];
  }

  apply(cover: RemeshCover, entities: CelestialEntity[], width: number, height: number,
    particles: Particle[], positions: Float32Array, colors: Float32Array) {
    if (cover.phase === "idle") {
      this.base = this.source = this.arrival = null;
      this.hidden = false;
      this.velocity.setAll(0);
      this.stars.follow(this.camera);
      return;
    }
    this.measure(particles, positions, colors);
    this.hidden = cover.panProgress === 1 && cover.phase !== "returning";
    const desired = this.snapshot();
    if (!this.source || this.departure !== cover.departure) {
      // Interrupted arrivals inherit both the presented position and velocity.
      this.entryVelocity = this.base ? this.velocity.clone() : BABYLON.Vector3.Zero();
      this.begin(this.base && this.presented ? this.presented : desired, entities, width, height);
      this.departure = cover.departure;
      this.presentedTime = cover.flightTime;
    }
    this.base = desired;
    let pose: Pose;
    if (cover.phase === "returning") {
      if (!this.arrival) {
        this.arrival = this.presented!;
        this.arrivalVelocity = this.velocity.clone();
      }
      const t = 1 - cover.panProgress;
      if (cover.mode === "cut") {
        // Direct formed-scene cut with a tiny XYZ settle, no high-speed flight.
        const nudge = 1 - ease(t);
        pose = { position: desired.position.add(new BABYLON.Vector3(this.side * 3, 2, -4).scale(nudge)),
          rotation: desired.rotation.multiply(BABYLON.Quaternion.FromEulerAngles(0.003 * nudge, this.side * 0.004 * nudge, 0)), fov: desired.fov };
      } else {
        const approach = { position: desired.position.add(this.offset(desired, -this.side * 0.3, 0.26, 0.28)),
          rotation: desired.rotation.multiply(BABYLON.Quaternion.FromEulerAngles(0.055, -this.side * 0.12, -this.side * 0.035)), fov: desired.fov };
        pose = ride([{ ...this.arrival, at: 0 }, { ...approach, at: 0.64 }, { ...desired, at: 1 }], t,
          this.arrivalVelocity.scale(REMESH_FLIGHT_TIMING.arrive), BABYLON.Vector3.Zero());
      }
    } else if (this.hidden || cover.mode === "cut") {
      pose = this.excludeVolume(this.cruise(cover.mode === "cut" ? 0 : cover.hiddenTime));
    } else {
      const exitVelocity = this.offset(this.source!, this.side * 0.48, 0.24, 0.38).scale(REMESH_FLIGHT_TIMING.depart / 1000);
      pose = ride(this.keys, cover.panProgress, this.entryVelocity.scale(REMESH_FLIGHT_TIMING.depart), exitVelocity);
    }
    this.install(pose);
    this.stars.follow(this.camera);
    const dt = cover.flightTime - this.presentedTime;
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
    return { ...this.coverage(), panSource: "spline through open starfield",
      cameraX: this.camera.position.x, cameraY: this.camera.position.y, cameraZ: this.camera.position.z,
      cameraPitch: this.camera.rotation.x, cameraYaw: this.camera.rotation.y, cameraRoll: this.camera.rotation.z,
      starfieldEnabled: this.stars.mesh.isEnabled(), occluderEnabled: false };
  }

  dispose() { this.stars.dispose(); }
}
