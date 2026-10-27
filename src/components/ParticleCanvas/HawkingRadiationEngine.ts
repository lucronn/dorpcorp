import * as BABYLON from "@babylonjs/core";
import { CelestialEntity } from "./types";
import { createCircleTexture } from "./TextureUtils";

export interface HawkingRadiationInstance {
  system: BABYLON.ParticleSystem | BABYLON.GPUParticleSystem;
  currentIntensity: number;
  update: (proximity: number, isCinematic: boolean, dt: number) => void;
  dispose: () => void;
}

/**
 * Creates and manages a subtle, shimmering 3D quantum Hawking Radiation particle system
 * that emanates outwards from the black hole's event horizon core / singularity.
 * Dynamically intensifies when approaching the singularity or entering cinematic mode.
 */
export function createHawkingRadiationSystem(
  bhContainer: BABYLON.TransformNode,
  entity: CelestialEntity,
  scene: BABYLON.Scene
): HawkingRadiationInstance {
  const capacity = 3500;
  const sparkTex = createCircleTexture(scene);

  const ps = BABYLON.GPUParticleSystem.IsSupported
    ? new BABYLON.GPUParticleSystem("bh_hawking_rad_gpu", { capacity }, scene)
    : new BABYLON.ParticleSystem("bh_hawking_rad_cpu", Math.min(capacity, 2500), scene);

  ps.particleTexture = sparkTex;
  ps.emitter = bhContainer as any;

  // Spherical shell emitter located precisely around the Schwarzschild radius (r_s to 1.15 * r_s)
  const baseRad = isFinite(entity?.radius) && entity.radius > 0 ? entity.radius : 60;
  const rs = baseRad * 0.95;
  const emitter = ps.createSphereEmitter(rs * 1.15, 0.95);
  ps.particleEmitterType = emitter;

  // Pure optical additive shimmer blending (no dark boxes, crystal-clear glow)
  ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;

  // Quantum iridescence & thermal Planck color curve:
  // White-hot virtual photon spark -> Cherenkov quantum cyan -> Quantum violet/indigo shimmer -> Vacuum dissipation
  ps.addColorGradient(0.0, new BABYLON.Color4(1.0, 1.0, 1.0, 0.92));
  ps.addColorGradient(0.18, new BABYLON.Color4(0.38, 0.92, 1.0, 0.82)); // Luminous Cherenkov cyan
  ps.addColorGradient(0.48, new BABYLON.Color4(0.76, 0.46, 1.0, 0.58)); // Quantum violet shimmer
  ps.addColorGradient(0.78, new BABYLON.Color4(0.32, 0.16, 0.68, 0.28));
  ps.addColorGradient(1.0, new BABYLON.Color4(0.08, 0.04, 0.22, 0.0));

  // Shimmering size pulsation
  ps.addSizeGradient(0.0, 0.3);
  ps.addSizeGradient(0.25, 1.0);
  ps.addSizeGradient(0.7, 0.85);
  ps.addSizeGradient(1.0, 0.0);

  // Subtle angular quantum spin / flutter
  ps.minAngularSpeed = -1.2;
  ps.maxAngularSpeed = 1.2;

  // Base state: subtle, delicate shimmering aura
  ps.minLifeTime = 1.2;
  ps.maxLifeTime = 2.6;
  ps.minSize = 0.6;
  ps.maxSize = 2.0;
  ps.minEmitPower = 12;
  ps.maxEmitPower = 28;
  ps.emitRate = 140;

  // Acceleration outwards (escaping the gravitational well)
  ps.gravity = new BABYLON.Vector3(0, 0, 0);

  ps.start();

  let currentIntensity = 0.0;

  const instance: HawkingRadiationInstance = {
    system: ps,
    get currentIntensity() {
      return currentIntensity;
    },
    update(proximity: number, isCinematic: boolean, dt: number) {
      if (!ps || (ps as any).isDisposed) return;
      const safeProximity = isFinite(proximity) ? Math.max(0, Math.min(1, proximity)) : 0;
      const safeDt = isFinite(dt) && dt > 0 ? dt : 16.666;
      // Dynamic intensification target:
      // Proximity to singularity scales 0.0 to 1.0
      // Entering cinematic mode adds an instant dramatic boost
      const targetIntensity = Math.min(
        1.0,
        Math.max(0.0, safeProximity * 0.75 + (isCinematic ? 0.65 : 0.0))
      );

      // Smooth temporal interpolation to eliminate jarring jumps
      const lerpSpeed = Math.min(1.0, (safeDt / 16.666) * 0.06);
      currentIntensity += (targetIntensity - currentIntensity) * lerpSpeed;
      if (!isFinite(currentIntensity)) currentIntensity = targetIntensity;

      // Dynamically scale emission rate (from 140 subtle sparks/s up to 1050 radiant photons/s)
      ps.emitRate = Math.round(140 + currentIntensity * 910);

      // Relativistic thermal velocity boost as Hawking temperature soars
      ps.minEmitPower = 12 + currentIntensity * 38;
      ps.maxEmitPower = 28 + currentIntensity * 85;

      // Particle size expands into a shimmering quantum veil
      ps.minSize = 0.6 + currentIntensity * 0.9;
      ps.maxSize = 2.0 + currentIntensity * 2.8;

      // Extended survival distance away from the horizon during intense radiation
      ps.minLifeTime = 1.2 + currentIntensity * 0.7;
      ps.maxLifeTime = 2.6 + currentIntensity * 1.4;

      // Share real-time telemetry with the HUD
      if (typeof window !== "undefined") {
        (window as any).__hawkingIntensity = currentIntensity;
        (window as any).__hawkingActive = true;
      }
    },
    dispose() {
      try {
        if (typeof window !== "undefined") {
          (window as any).__hawkingActive = false;
          (window as any).__hawkingIntensity = 0;
        }
        ps.stop();
        ps.dispose();
        sparkTex.dispose();
      } catch (_) {}
    },
  };

  return instance;
}
