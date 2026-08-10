import * as BABYLON from "@babylonjs/core";

export interface SupernovaFXInstance {
  worldPos: BABYLON.Vector3;
  startTime: number;
  durationMs: number;
  light: BABYLON.PointLight;
  shockwaveTorus: BABYLON.Mesh;
  shockwaveTorusMat: BABYLON.StandardMaterial;
  coreOrbMesh: BABYLON.Mesh;
  coreOrbMat: BABYLON.StandardMaterial;
  psBurst: BABYLON.ParticleSystem;
  psJets: BABYLON.ParticleSystem;
  psRing: BABYLON.ParticleSystem;
  isDisposed: boolean;
  dispose: () => void;
  update: (now: number) => void;
}

export function spawnSupernovaFX(
  scene: BABYLON.Scene,
  worldPos: BABYLON.Vector3
): SupernovaFXInstance {
  const startTime = Date.now();
  const durationMs = 3400;

  // 1. PointLight Detonation Source
  const light = new BABYLON.PointLight("supernova_light", worldPos, scene);
  light.diffuse = new BABYLON.Color3(1.0, 0.95, 0.9);
  light.specular = new BABYLON.Color3(1.0, 1.0, 1.0);
  light.intensity = 0;
  light.range = 5000;

  // 2. Volumetric Core Plasma Energy Sphere
  const coreOrbMesh = BABYLON.MeshBuilder.CreateSphere("supernova_core_orb", {
    diameter: 1.0,
    segments: 32,
  }, scene);
  coreOrbMesh.position = worldPos.clone();

  const coreOrbMat = new BABYLON.StandardMaterial("supernova_core_mat", scene);
  coreOrbMat.emissiveColor = new BABYLON.Color3(3.0, 3.0, 3.0);
  coreOrbMat.disableLighting = true;
  coreOrbMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
  coreOrbMesh.material = coreOrbMat;
  coreOrbMesh.scaling.set(0, 0, 0);

  // 3. 3D Volumetric Expanding Torus Mesh Ring
  const shockwaveTorus = BABYLON.MeshBuilder.CreateTorus("supernova_torus", {
    diameter: 1.0,
    thickness: 0.12,
    tessellation: 48,
  }, scene);
  shockwaveTorus.position = worldPos.clone();
  shockwaveTorus.rotation.x = Math.PI / 2.5;

  const shockwaveTorusMat = new BABYLON.StandardMaterial("supernova_torus_mat", scene);
  shockwaveTorusMat.emissiveColor = new BABYLON.Color3(0.2, 1.5, 2.5);
  shockwaveTorusMat.disableLighting = true;
  shockwaveTorusMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
  shockwaveTorus.material = shockwaveTorusMat;
  shockwaveTorus.scaling.set(0, 0, 0);

  // 4. Particle System A: Omnidirectional Burst
  const psBurst = new BABYLON.ParticleSystem("supernova_ps_burst", 4500, scene);
  psBurst.emitter = worldPos.clone();
  const sphereEmitter = psBurst.createSphereEmitter(0.5, 1.0);
  psBurst.particleEmitterType = sphereEmitter;
  psBurst.minEmitPower = 60;
  psBurst.maxEmitPower = 210;
  psBurst.updateSpeed = 0.024;
  psBurst.minSize = 0.6;
  psBurst.maxSize = 3.8;
  psBurst.minLifeTime = 0.8;
  psBurst.maxLifeTime = 2.6;
  psBurst.addSizeGradient(0.0, 0.3);
  psBurst.addSizeGradient(0.2, 2.8);
  psBurst.addSizeGradient(0.7, 1.5);
  psBurst.addSizeGradient(1.0, 0.0);
  psBurst.color1 = new BABYLON.Color4(1.0, 0.98, 0.92, 1.0);
  psBurst.color2 = new BABYLON.Color4(0.2, 0.88, 1.0, 0.9);
  psBurst.colorDead = new BABYLON.Color4(0.2, 0.0, 0.35, 0.0);
  psBurst.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
  psBurst.manualEmitCount = 4000;

  // 5. Particle System B: Pulsar Jets
  const psJets = new BABYLON.ParticleSystem("supernova_ps_jets", 1800, scene);
  psJets.emitter = worldPos.clone();
  const jetEmitter = psJets.createConeEmitter(0.4, Math.PI / 10);
  psJets.particleEmitterType = jetEmitter;
  psJets.minEmitPower = 130;
  psJets.maxEmitPower = 280;
  psJets.updateSpeed = 0.028;
  psJets.minSize = 0.8;
  psJets.maxSize = 4.2;
  psJets.minLifeTime = 0.6;
  psJets.maxLifeTime = 2.0;
  psJets.addSizeGradient(0.0, 0.4);
  psJets.addSizeGradient(0.3, 3.2);
  psJets.addSizeGradient(1.0, 0.0);
  psJets.color1 = new BABYLON.Color4(0.4, 0.98, 1.0, 1.0);
  psJets.color2 = new BABYLON.Color4(0.95, 0.3, 1.0, 0.85);
  psJets.colorDead = new BABYLON.Color4(0.0, 0.0, 0.0, 0.0);
  psJets.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
  psJets.manualEmitCount = 1600;

  // 6. Particle System C: Debris Ring
  const psRing = new BABYLON.ParticleSystem("supernova_ps_ring", 2200, scene);
  psRing.emitter = worldPos.clone();
  const cylEmitter = psRing.createCylinderEmitter(1.5, 0.05, 0.0, 1.0);
  psRing.particleEmitterType = cylEmitter;
  psRing.minEmitPower = 80;
  psRing.maxEmitPower = 220;
  psRing.updateSpeed = 0.022;
  psRing.minSize = 0.5;
  psRing.maxSize = 2.8;
  psRing.minLifeTime = 1.0;
  psRing.maxLifeTime = 2.8;
  psRing.addSizeGradient(0.0, 0.2);
  psRing.addSizeGradient(0.4, 2.5);
  psRing.addSizeGradient(1.0, 0.0);
  psRing.color1 = new BABYLON.Color4(1.0, 0.82, 0.2, 1.0);
  psRing.color2 = new BABYLON.Color4(1.0, 0.18, 0.6, 0.85);
  psRing.colorDead = new BABYLON.Color4(0.0, 0.0, 0.0, 0.0);
  psRing.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
  psRing.manualEmitCount = 2000;

  let hasDetonated = false;
  let isDisposed = false;

  const instance: SupernovaFXInstance = {
    worldPos,
    startTime,
    durationMs,
    light,
    shockwaveTorus,
    shockwaveTorusMat,
    coreOrbMesh,
    coreOrbMat,
    psBurst,
    psJets,
    psRing,
    isDisposed: false,
    dispose: () => {
      if (isDisposed) return;
      isDisposed = true;
      instance.isDisposed = true;

      try {
        light.dispose();
        coreOrbMesh.dispose();
        coreOrbMat.dispose();
        shockwaveTorus.dispose();
        shockwaveTorusMat.dispose();
        psBurst.stop();
        psBurst.dispose();
        psJets.stop();
        psJets.dispose();
        psRing.stop();
        psRing.dispose();
      } catch (e) {
        console.warn("[SupernovaFX] Cleanup error:", e);
      }
    },
    update: (now: number) => {
      if (isDisposed) return;
      const elapsed = now - startTime;

      if (elapsed >= durationMs) {
        instance.dispose();
        return;
      }

      // Phase 1: Micro-Singularity Compression
      if (elapsed < 150) {
        const implodeProgress = elapsed / 150;
        const orbScale = 25.0 * (1.0 - implodeProgress);
        coreOrbMesh.scaling.set(orbScale, orbScale, orbScale);
        light.intensity = implodeProgress * 30.0;
        return;
      }

      // Phase 2: Cataclysmic Detonation Trigger
      if (!hasDetonated) {
        hasDetonated = true;
        psBurst.start();
        psJets.start();
        psRing.start();
      }

      // Phase 3: High-Energy Expansion
      const detElapsed = elapsed - 150;
      const detProgress = detElapsed / (durationMs - 150);

      const lightPeak = Math.max(0, 220.0 * Math.pow(1.0 - detProgress, 2.8));
      light.intensity = lightPeak;

      const orbScale = Math.pow(detProgress, 0.35) * 85.0;
      coreOrbMesh.scaling.set(orbScale, orbScale, orbScale);
      const orbAlpha = Math.max(0, Math.pow(1.0 - detProgress, 3.0) * 0.9);
      coreOrbMat.alpha = orbAlpha;

      const torusScale = Math.pow(detProgress, 0.52) * 190.0;
      shockwaveTorus.scaling.set(torusScale, torusScale, torusScale * 0.4);
      shockwaveTorus.rotation.z += 0.012;
      shockwaveTorus.rotation.y += 0.008;
      const torusAlpha = Math.max(0, Math.pow(1.0 - detProgress, 1.6) * 0.9);
      shockwaveTorusMat.alpha = torusAlpha;
    },
  };

  return instance;
}
