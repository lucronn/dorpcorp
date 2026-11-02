import * as BABYLON from "@babylonjs/core";
import type { RemeshCover } from "./RemeshCover";
import type { CelestialEntity } from "./types";

const ease = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
type Pose = { position: BABYLON.Vector3; rotation: BABYLON.Vector3; fov: number };

/** A persistent foreground moon, independent of the field whose targets are replaced. */
export class RemeshPanAway {
  readonly moon: BABYLON.Mesh;
  private material: BABYLON.ShaderMaterial;
  private base: Pose | null = null;
  private revision = -1;
  private side = 1;
  private angle = 0;
  private radius = 0;
  private distance = 80;
  private source = "foreground moon";

  constructor(private scene: BABYLON.Scene, private camera: BABYLON.TargetCamera) {
    this.moon = BABYLON.MeshBuilder.CreateSphere("remesh-foreground-moon", { diameter: 2, segments: 64 }, scene);
    this.moon.isPickable = false;
    // This dedicated foreground group cannot be pierced by transparent particle draws.
    this.moon.renderingGroupId = 3;
    scene.setRenderingAutoClearDepthStencil(3, true, true, true);
    this.material = new BABYLON.ShaderMaterial("remesh-moon-surface", scene, {
      vertexSource: `precision highp float;
        attribute vec3 position; attribute vec3 normal;
        uniform mat4 worldViewProjection;
        varying vec3 vSurface; varying vec3 vNormal;
        void main() { vSurface = position; vNormal = normal;
          gl_Position = worldViewProjection * vec4(position, 1.0); }`,
      fragmentSource: `precision highp float;
        varying vec3 vSurface; varying vec3 vNormal; uniform vec3 tint;
        void main() {
          vec3 n = normalize(vNormal);
          float ridges = sin(vSurface.x * 37.0 + sin(vSurface.y * 19.0) * 3.0)
            * sin(vSurface.z * 31.0 + vSurface.y * 11.0);
          float fine = sin(vSurface.x * 163.0) * sin(vSurface.y * 117.0) * sin(vSurface.z * 139.0);
          float light = 0.30 + 0.55 * max(0.0, dot(n, normalize(vec3(-0.6, 0.7, -0.5))));
          vec3 rock = tint * (light + ridges * 0.045 + fine * 0.018);
          gl_FragColor = vec4(rock, 1.0);
        }`,
    }, { attributes: ["position", "normal"], uniforms: ["worldViewProjection", "tint"] });
    this.material.setColor3("tint", new BABYLON.Color3(0.22, 0.30, 0.40));
    this.moon.material = this.material;
    this.moon.setEnabled(false);
  }

  private snapshot(): Pose {
    return { position: this.camera.position.clone(), rotation: this.camera.rotation.clone(), fov: this.camera.fov };
  }

  /** Restore the director's unpanned pose before its next simulation/camera update. */
  restore() {
    if (!this.base) return;
    this.camera.position.copyFrom(this.base.position);
    this.camera.rotation.copyFrom(this.base.rotation);
    this.camera.fov = this.base.fov;
  }

  apply(cover: RemeshCover, entities: CelestialEntity[], width: number, height: number) {
    if (cover.phase === "idle" || cover.mode === "veil") {
      this.moon.setEnabled(false);
      this.base = null;
      return;
    }
    if (!this.base) {
      this.base = this.snapshot();
      // Favor the side of the nearest dense neighbor. The independent moon stays
      // intact when that neighbor and all of its particle targets are replaced.
      const neighbor = entities.filter(e => !e.isDestroyed && !e.isOutgoing &&
        ["planet", "star", "blackhole", "neutron_star"].includes(e.type))
        .sort((a, b) => this.distanceTo(a, width, height) - this.distanceTo(b, width, height))[0];
      if (neighbor) {
        const world = new BABYLON.Vector3(neighbor.worldX ?? neighbor.x - width / 2,
          neighbor.worldY ?? height / 2 - neighbor.y, neighbor.worldZ ?? neighbor.z ?? 0);
        this.side = BABYLON.Vector3.TransformCoordinates(world, this.camera.getViewMatrix(true)).x < 0 ? -1 : 1;
        this.source = `${neighbor.type} companion moon`;
      } else { this.side = 1; this.source = "foreground moon"; }
      this.revision = cover.revision;
    }
    if (cover.covered && this.revision !== cover.revision) {
      // The director installed the destination pose under full occlusion. Move
      // the moon with that hidden handoff, preserving its screen-space surface.
      this.base = this.snapshot();
      this.revision = cover.revision;
    }
    this.restore();
    const aspect = this.scene.getEngine().getAspectRatio(this.camera);
    const halfY = this.base.fov / 2;
    const halfX = Math.atan(Math.tan(halfY) * aspect);
    const halfDiagonal = Math.atan(Math.tan(halfY) * Math.hypot(1, aspect));
    const angularRadius = Math.min(1.52, halfDiagonal + 0.10);
    this.radius = this.distance * Math.sin(angularRadius);
    this.angle = halfX + angularRadius + 0.08;
    const orientation = BABYLON.Quaternion.FromEulerVector(this.base.rotation);
    const away = orientation.multiply(BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, this.side * this.angle));
    const direction = BABYLON.Vector3.Forward().applyRotationQuaternion(away);
    this.moon.position.copyFrom(this.base.position.add(direction.scale(this.distance)));
    this.moon.rotationQuaternion = away;
    this.moon.scaling.setAll(this.radius);
    this.moon.setEnabled(true);
    const rotation = orientation.multiply(BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, this.side * this.angle * ease(cover.panProgress)));
    this.camera.rotation.copyFrom(rotation.toEulerAngles());
    this.camera.minZ = 0.5;
    this.camera.getViewMatrix(true);
    this.moon.computeWorldMatrix(true);
  }

  private distanceTo(entity: CelestialEntity, width: number, height: number) {
    return BABYLON.Vector3.DistanceSquared(this.camera.position, new BABYLON.Vector3(
      entity.worldX ?? entity.x - width / 2, entity.worldY ?? height / 2 - entity.y, entity.worldZ ?? entity.z ?? 0));
  }

  /** Conservative angular containment of the entire frustum, including corners. */
  coverage() {
    if (!this.moon.isEnabled() || !this.base) return { occluded: false, margin: -Math.PI, ready: false };
    const toMoon = this.moon.position.subtract(this.camera.position);
    const distance = toMoon.length();
    const forward = this.camera.getForwardRay().direction;
    const offset = Math.acos(BABYLON.Scalar.Clamp(BABYLON.Vector3.Dot(forward, toMoon.scale(1 / distance)), -1, 1));
    const aspect = this.scene.getEngine().getAspectRatio(this.camera);
    const diagonal = Math.atan(Math.tan(this.camera.fov / 2) * Math.hypot(1, aspect));
    // Inset for sphere tessellation, postprocessing sampling, and floating point error.
    const margin = Math.asin(this.radius / distance) - offset - diagonal - 0.025;
    const ready = this.moon.isReady(true) && this.material.isReady(this.moon);
    return { occluded: ready && margin > 0 && distance - this.radius > this.camera.minZ, margin, ready };
  }

  diagnostics() {
    return { ...this.coverage(), panAngle: this.angle, panSource: this.source,
      occluderEnabled: this.moon.isEnabled(), cameraYaw: this.camera.rotation.y };
  }

  dispose() { this.moon.dispose(); this.material.dispose(); }
}
