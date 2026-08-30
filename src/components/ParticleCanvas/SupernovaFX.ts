import * as BABYLON from "@babylonjs/core";
import {
  createCircleTexture,
  createCircularGlowTexture
} from "./TextureUtils";

export interface SupernovaFXInstance {
  isDisposed: boolean;
  dispose: () => void;
  update: (now: number) => void;
}

export function spawnSupernovaFX(
  scene: BABYLON.Scene,
  worldPos: BABYLON.Vector3
): SupernovaFXInstance {
  const startTime = Date.now();
  const implosionDurationMs = 2800; 
  const explosionDurationMs = 6500; 
  const totalDurationMs = implosionDurationMs + explosionDurationMs;
  
  let isDisposed = false;
  let hasDetonated = false;

  const disposables: { dispose: () => void }[] = [];

  // 1. Dynamic PointLight for intense local illumination
  const light = new BABYLON.PointLight("sn_light", worldPos, scene);
  light.intensity = 0;
  disposables.push(light);

  // 2. Core Sphere (The Singularity that explodes)
  const coreMesh = BABYLON.MeshBuilder.CreateSphere("sn_core", { segments: 64, diameter: 2 }, scene);
  coreMesh.position = worldPos.clone();
  coreMesh.renderingGroupId = 2;
  const coreMat = new BABYLON.StandardMaterial("sn_core_mat", scene);
  coreMat.emissiveColor = new BABYLON.Color3(0, 0.8, 1.0);
  coreMat.disableLighting = true;
  coreMesh.material = coreMat;
  disposables.push(coreMesh, coreMat);

  // 4. 3D Spherical Shockwave Bubble (Custom Fresnel Shader with Chromatic Dispersion)
  const shockwave = BABYLON.MeshBuilder.CreateSphere("sn_shockwave", { segments: 128, diameter: 1 }, scene);
  shockwave.position = worldPos.clone();
  shockwave.renderingGroupId = 2;
  const swMat = new BABYLON.ShaderMaterial("sn_sw_mat", scene, {
    vertexSource: `
      precision highp float;
      attribute vec3 position;
      attribute vec3 normal;
      uniform mat4 worldViewProjection;
      uniform mat4 world;
      varying vec3 vPositionW;
      varying vec3 vNormalW;
      void main() {
        vec4 p = vec4(position, 1.0);
        vPositionW = vec3(world * p);
        vNormalW = normalize(vec3(world * vec4(normal, 0.0)));
        gl_Position = worldViewProjection * p;
      }
    `,
    fragmentSource: `
      precision highp float;
      varying vec3 vPositionW;
      varying vec3 vNormalW;
      uniform vec3 cameraPosition;
      uniform vec3 color;
      uniform float alphaMap;
      void main() {
        vec3 viewDirectionW = normalize(cameraPosition - vPositionW);
        float fresnelTerm = dot(viewDirectionW, vNormalW);
        fresnelTerm = clamp(1.0 - fresnelTerm, 0., 1.);
        fresnelTerm = pow(fresnelTerm, 3.2);
        
        // Chromatic split at wavefront
        vec3 edgeGlow = color * fresnelTerm * 3.0;
        edgeGlow.r += pow(fresnelTerm, 4.0) * 0.5;
        edgeGlow.b += pow(fresnelTerm, 2.5) * 0.8;
        
        gl_FragColor = vec4(edgeGlow, fresnelTerm * alphaMap);
      }
    `
  }, {
    attributes: ["position", "normal"],
    uniforms: ["worldViewProjection", "world", "cameraPosition", "color", "alphaMap"],
    needAlphaBlending: true
  });
  
  swMat.setColor3("color", new BABYLON.Color3(0.2, 0.85, 1.0));
  swMat.setFloat("alphaMap", 0.0);
  swMat.backFaceCulling = false;
  swMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
  shockwave.material = swMat;
  disposables.push(shockwave, swMat);

  // 5. High Density GPUParticleSystems
  const sparkTex = createCircleTexture(scene);
  const cloudTex = createCircularGlowTexture("#ff0088", scene);
  disposables.push(sparkTex, cloudTex);

  const createParticleSystem = (name: string, capacity: number, texture: BABYLON.Texture) => {
    const ps = BABYLON.GPUParticleSystem.IsSupported 
      ? new BABYLON.GPUParticleSystem(name, { capacity }, scene)
      : new BABYLON.ParticleSystem(name, Math.min(capacity, 15000), scene);
    ps.particleTexture = texture;
    ps.emitter = worldPos.clone();
    disposables.push(ps);
    return ps;
  };

  // 5a. Massive spherical burst
  const psBurst = createParticleSystem("sn_burst", 250000, sparkTex);
  const burstEmitter = psBurst.createSphereEmitter(0.1, 1.0);
  psBurst.particleEmitterType = burstEmitter;
  psBurst.minLifeTime = 1.0;
  psBurst.maxLifeTime = 4.0;
  psBurst.minSize = 0.2;
  psBurst.maxSize = 1.5;
  psBurst.minEmitPower = 80;
  psBurst.maxEmitPower = 350;
  psBurst.addColorGradient(0, new BABYLON.Color4(1, 1, 1, 1));
  psBurst.addColorGradient(0.2, new BABYLON.Color4(0, 1, 1, 0.8));
  psBurst.addColorGradient(1, new BABYLON.Color4(0.2, 0, 1, 0));
  psBurst.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
  psBurst.manualEmitCount = 250000;

  // 5b. Toroidal Gas Ring (Equatorial)
  const psRingEq = createParticleSystem("sn_ring_eq", 100000, cloudTex);
  const ringEqEmitter = psRingEq.createCylinderEmitter(2.0, 0.2, 0.0, 1.0);
  psRingEq.particleEmitterType = ringEqEmitter;
  psRingEq.minLifeTime = 2.5;
  psRingEq.maxLifeTime = 5.0;
  psRingEq.minSize = 2.0;
  psRingEq.maxSize = 8.0;
  psRingEq.minEmitPower = 30;
  psRingEq.maxEmitPower = 100;
  psRingEq.addColorGradient(0, new BABYLON.Color4(1, 1, 1, 0.8));
  psRingEq.addColorGradient(0.3, new BABYLON.Color4(1, 0.2, 0.6, 0.6));
  psRingEq.addColorGradient(1, new BABYLON.Color4(0.5, 0, 1, 0));
  psRingEq.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
  psRingEq.manualEmitCount = 100000;
  
  // 5c. Toroidal Gas Ring (Polar)
  const psRingPolar = createParticleSystem("sn_ring_polar", 80000, cloudTex);
  const ringPolarEmitter = psRingPolar.createCylinderEmitter(1.5, 0.2, 0.0, 1.0);
  psRingPolar.particleEmitterType = ringPolarEmitter;
  
  const polarDummy = BABYLON.MeshBuilder.CreateBox("sn_polar_dummy", {size: 0.1}, scene);
  polarDummy.position = worldPos.clone();
  polarDummy.rotation.x = -Math.PI / 3.8;
  polarDummy.rotation.z = Math.PI / 5;
  polarDummy.isVisible = false;
  psRingPolar.emitter = polarDummy;
  disposables.push(polarDummy);
  
  psRingPolar.minLifeTime = 2.0;
  psRingPolar.maxLifeTime = 4.5;
  psRingPolar.minSize = 1.5;
  psRingPolar.maxSize = 6.0;
  psRingPolar.minEmitPower = 25;
  psRingPolar.maxEmitPower = 85;
  psRingPolar.addColorGradient(0, new BABYLON.Color4(1, 0.8, 0.2, 0.8));
  psRingPolar.addColorGradient(0.4, new BABYLON.Color4(1, 0.1, 0.5, 0.5));
  psRingPolar.addColorGradient(1, new BABYLON.Color4(0.2, 0, 0.5, 0));
  psRingPolar.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
  psRingPolar.manualEmitCount = 80000;

  // 5d. Relativistic Jets (North and South)
  const psJetN = createParticleSystem("sn_jet_n", 40000, sparkTex);
  const jetNEmitter = psJetN.createConeEmitter(0.5, Math.PI / 12);
  psJetN.particleEmitterType = jetNEmitter;
  jetNEmitter.directionRandomizer = 0.1;
  psJetN.minEmitPower = 200;
  psJetN.maxEmitPower = 500;
  psJetN.minLifeTime = 1.0;
  psJetN.maxLifeTime = 2.5;
  psJetN.minSize = 0.3;
  psJetN.maxSize = 1.2;
  psJetN.addColorGradient(0, new BABYLON.Color4(1, 1, 1, 1));
  psJetN.addColorGradient(0.5, new BABYLON.Color4(0, 0.8, 1, 0.8));
  psJetN.addColorGradient(1, new BABYLON.Color4(0, 0, 1, 0));
  psJetN.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
  psJetN.manualEmitCount = 40000;

  const psJetS = createParticleSystem("sn_jet_s", 40000, sparkTex);
  const jetSEmitter = psJetS.createConeEmitter(0.5, Math.PI / 12);
  psJetS.particleEmitterType = jetSEmitter;
  jetSEmitter.directionRandomizer = 0.1;
  
  const jetSDummy = BABYLON.MeshBuilder.CreateBox("sn_jet_s_dummy", {size: 0.1}, scene);
  jetSDummy.position = worldPos.clone();
  jetSDummy.rotation.x = Math.PI; 
  jetSDummy.isVisible = false;
  psJetS.emitter = jetSDummy;
  disposables.push(jetSDummy);

  psJetS.minEmitPower = 200;
  psJetS.maxEmitPower = 500;
  psJetS.minLifeTime = 1.0;
  psJetS.maxLifeTime = 2.5;
  psJetS.minSize = 0.3;
  psJetS.maxSize = 1.2;
  psJetS.addColorGradient(0, new BABYLON.Color4(1, 1, 1, 1));
  psJetS.addColorGradient(0.5, new BABYLON.Color4(0, 0.8, 1, 0.8));
  psJetS.addColorGradient(1, new BABYLON.Color4(0, 0, 1, 0));
  psJetS.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
  psJetS.manualEmitCount = 40000;

  const instance: SupernovaFXInstance = {
    isDisposed: false,
    dispose: () => {
      if (instance.isDisposed) return;
      instance.isDisposed = true;
      disposables.forEach(d => {
        try { d.dispose(); } catch (e) {
          console.warn("[SupernovaFX] Cleanup error:", e);
        }
      });
    },
    update: (now: number) => {
      if (instance.isDisposed) return;
      const elapsed = now - startTime;
      
      if (elapsed >= totalDurationMs) {
        instance.dispose();
        return;
      }

      // 1. Implosion Phase
      if (elapsed < implosionDurationMs) {
        const p = Math.pow(elapsed / implosionDurationMs, 2.0); 
        
        const scale = 8.0 * (1.0 - p) + 0.1;
        coreMesh.scaling.setAll(scale);
        
        coreMat.emissiveColor = new BABYLON.Color3(p, 0.8 + p * 0.2, 1.0);
        light.intensity = p * 80.0;
        return;
      }

      // 2. Detonation Trigger
      if (!hasDetonated) {
        hasDetonated = true;
        psBurst.start();
        psRingEq.start();
        psRingPolar.start();
        psJetN.start();
        psJetS.start();
      }

      // 3. Explosion Phase
      const detElapsed = elapsed - implosionDurationMs;
      const detProgress = detElapsed / explosionDurationMs;

      const intensityCurve = Math.max(0, Math.pow(1.0 - detProgress, 3.5));
      light.intensity = intensityCurve * 2200.0;
      
      const coreScale = Math.max(0.01, 22.0 * intensityCurve);
      coreMesh.scaling.setAll(coreScale);

      if (detProgress < 0.2) {
        const c = new BABYLON.Color3(1.0, 1.0, 1.0);
        coreMat.emissiveColor = c;
        light.diffuse = new BABYLON.Color3(0.9, 0.96, 1.0);
        swMat.setColor3("color", new BABYLON.Color3(1.0, 1.0, 1.0));
      } else if (detProgress < 0.5) {
        const t = (detProgress - 0.2) / 0.3;
        coreMat.emissiveColor = new BABYLON.Color3(1.0, 1.0 - t * 0.4, 1.0 - t);
        light.diffuse = new BABYLON.Color3(1.0, 0.85 - t * 0.3, 0.6 - t * 0.4);
        swMat.setColor3("color", new BABYLON.Color3(1.0 - t * 0.4, 0.8 - t * 0.3, 1.0 - t * 0.5));
      } else {
        const t = (detProgress - 0.5) / 0.5;
        coreMat.emissiveColor = new BABYLON.Color3(1.0 - t * 0.8, 0.6 - t * 0.6, 0.0);
        light.diffuse = new BABYLON.Color3(0.8 - t * 0.6, 0.3 - t * 0.3, 0.1);
        swMat.setColor3("color", new BABYLON.Color3(0.6 - t * 0.4, 0.5 - t * 0.5, 0.5 - t * 0.5));
      }

      const swScale = Math.pow(detProgress, 0.45) * 450.0;
      shockwave.scaling.setAll(swScale);
      
      const swAlpha = Math.max(0, Math.pow(1.0 - detProgress, 1.8) * 0.85);
      swMat.setFloat("alphaMap", swAlpha);
      
      const camera = scene.activeCamera;
      if (camera) {
        swMat.setVector3("cameraPosition", camera.position);
      }
    }
  };

  return instance;
}
