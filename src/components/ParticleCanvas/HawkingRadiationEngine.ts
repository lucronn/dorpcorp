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
 * Creates and manages the 3D Ergospheric Blandford-Znajek (BZ) Magnetospheric Pair-Production &
 * Magnetically Arrested Disk (MAD) Synchrotron Corona particle system around a Kerr black hole.
 *
 * Astrophysics Note (EHT Collaboration 2019 V, arXiv:1906.11242; 2021 VIII, arXiv:2105.01173):
 * For an astrophysical black hole (e.g. M = 21.2 M_sun), quantum Hawking radiation has
 * T_H = hbar*c^3 / (8*pi*G*M*k_B) = 2.91 nK (<< 2.725 K CMB) and is completely invisible optically.
 * What actually radiates in the near-horizon ergosphere (r_H < r < 2M) is relativistic e+/e-
 * pair-production and synchrotron emission from a Magnetically Arrested Disk (MAD) corona
 * with electron temperatures T_e ~ (1-12) x 10^10 K and poloidal magnetic fields B ~ 1-30 G.
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

  // Spherical ergosphere / inner magnetosphere shell around the photon orbit (1.05 r_s to 1.45 r_s)
  const rs = entity.radius * 0.98;
  const emitter = ps.createSphereEmitter(rs * 1.25, 0.92);
  ps.particleEmitterType = emitter;

  // Pure optical additive blending for synchrotron corona plasma
  ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;

  // Relativistic Synchrotron & Inverse-Compton Corona Spectrum (T_e ~ 6 x 10^10 K, arXiv:2105.01173):
  // High-energy e+/e- pair-production spark -> Relativistic Doppler-boosted gold/amber synchrotron -> Redshifted coronal cooling
  ps.addColorGradient(0.0, new BABYLON.Color4(1.0, 0.98, 0.92, 0.92));
  ps.addColorGradient(0.20, new BABYLON.Color4(1.0, 0.84, 0.52, 0.82)); // Relativistic synchrotron gold
  ps.addColorGradient(0.50, new BABYLON.Color4(0.96, 0.45, 0.22, 0.58)); // Magnetospheric plasma orange-amber
  ps.addColorGradient(0.80, new BABYLON.Color4(0.68, 0.18, 0.12, 0.26)); // Redshifted outer corona
  ps.addColorGradient(1.0, new BABYLON.Color4(0.18, 0.04, 0.02, 0.0));

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
      // Dynamic intensification target:
      // Proximity to singularity scales 0.0 to 1.0
      // Entering cinematic mode adds an instant dramatic boost
      const targetIntensity = Math.min(
        1.0,
        Math.max(0.0, proximity * 0.75 + (isCinematic ? 0.65 : 0.0))
      );

      // Smooth temporal interpolation to eliminate jarring jumps
      const lerpSpeed = Math.min(1.0, (dt / 16.666) * 0.06);
      currentIntensity += (targetIntensity - currentIntensity) * lerpSpeed;

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
      (window as any).__hawkingIntensity = currentIntensity;
      (window as any).__hawkingActive = true;
    },
    dispose() {
      try {
        ps.stop();
        ps.dispose();
        sparkTex.dispose();
      } catch (_) {}
    },
  };

  return instance;
}
