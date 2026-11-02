import * as BABYLON from "@babylonjs/core";
import type { RemeshCover } from "./RemeshCover";
import type { CelestialEntity, Particle } from "./types";
import { DeepSpaceField } from "./DeepSpaceField";

const ease = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
type Pose = { position: BABYLON.Vector3; rotation: BABYLON.Quaternion; fov: number };

/** Pan/dolly off the composition, hold on space, then return to a formed scene.
 * No occluder is drawn. The entire mutable volume must be behind the near plane. */
export class RemeshPanAway {
  readonly stars: DeepSpaceField;
  private base: Pose | null = null;
  private source: Pose | null = null;
  private away: Pose | null = null;
  private presented: Pose | null = null;
  private departure = -1;
  private side = 1;
  private holding = false;
  private corners: BABYLON.Vector3[] = [];

  constructor(private scene: BABYLON.Scene, private camera: BABYLON.TargetCamera) {
    this.stars = new DeepSpaceField(scene);
  }

  private snapshot(): Pose {
    return { position: this.camera.position.clone(),
      rotation: BABYLON.Quaternion.FromEulerVector(this.camera.rotation), fov: this.camera.fov };
  }

  private install(pose: Pose) {
    this.camera.position.copyFrom(pose.position);
    this.camera.rotation.copyFrom(pose.rotation.toEulerAngles());
    this.camera.fov = pose.fov;
    this.camera.getViewMatrix(true);
  }

  /** Give the scene director its unpanned pose before simulation. */
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

  apply(cover: RemeshCover, entities: CelestialEntity[], width: number, height: number,
    particles: Particle[], positions: Float32Array, colors: Float32Array) {
    if (cover.phase === "idle") {
      this.base = this.source = this.away = null;
      this.holding = false;
      this.stars.follow(this.camera);
      return;
    }
    this.measure(particles, positions, colors);
    this.holding = cover.panProgress === 1;
    const desired = this.snapshot();
    if (!this.source || this.departure !== cover.departure) {
      // Reversing a return starts at the last presented pose, without a camera jump.
      this.source = this.base && this.presented ? this.presented : desired;
      const neighbor = entities.find(e => !e.isDestroyed && !e.isOutgoing &&
        ["planet", "star", "blackhole", "neutron_star"].includes(e.type));
      if (neighbor) {
        const world = new BABYLON.Vector3(neighbor.worldX ?? neighbor.x - width / 2,
          neighbor.worldY ?? height / 2 - neighbor.y, neighbor.worldZ ?? neighbor.z ?? 0);
        const right = BABYLON.Vector3.Right().applyRotationQuaternion(this.source.rotation);
        this.side = BABYLON.Vector3.Dot(world.subtract(this.source.position), right) < 0 ? -1 : 1;
      }
      this.away = { position: this.source.position.clone(), fov: this.source.fov,
        rotation: this.source.rotation.multiply(BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, this.side * 1.48)) };
      this.departure = cover.departure;
    }
    this.base = desired;
    const away = this.away!;
    const direction = BABYLON.Vector3.Forward().applyRotationQuaternion(away.rotation);
    // Moving only along the sight line preserves the starfield composition during
    // the source/destination handoff. Recheck every frame, including after resize.
    const furthest = Math.max(...this.corners.map(c => BABYLON.Vector3.Dot(c.subtract(away.position), direction)));
    if (furthest > -96) away.position.addInPlace(direction.scale(furthest + 96));

    if (cover.mode === "cut" && cover.phase === "returning") {
      // Reduced motion: direct match cut plus a sub-degree settle, no whip or FOV punch.
      this.install({ ...desired, rotation: desired.rotation.multiply(
        BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, this.side * 0.012 * cover.panProgress)) });
    } else {
      const home = cover.phase === "returning" ? desired : this.source;
      const t = cover.mode === "cut" ? 1 : ease(cover.panProgress);
      this.install({ position: BABYLON.Vector3.Lerp(home.position, away.position, t),
        rotation: BABYLON.Quaternion.Slerp(home.rotation, away.rotation, t),
        fov: home.fov + (away.fov - home.fov) * t });
    }
    this.stars.follow(this.camera);
    this.presented = this.snapshot();
  }

  /** Conservative camera-space separation, independent of aspect ratio and FOV.
   * Near-plane exclusion also prevents large point sprites leaking at the edges. */
  coverage() {
    const view = this.camera.getViewMatrix(true);
    const maxDepth = Math.max(...this.corners.map(c => BABYLON.Vector3.TransformCoordinates(c, view).z));
    const margin = this.camera.minZ - maxDepth - 16;
    const ready = this.stars.ready;
    return { occluded: !!this.base && this.holding && ready && margin > 0, margin, ready };
  }

  diagnostics() {
    return { ...this.coverage(), panSource: "open starfield", cameraYaw: this.camera.rotation.y,
      starfieldEnabled: this.stars.mesh.isEnabled(), occluderEnabled: false };
  }

  dispose() { this.stars.dispose(); }
}
