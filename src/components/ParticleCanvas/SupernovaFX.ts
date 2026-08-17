import * as BABYLON from "@babylonjs/core";
import {
  createCircleTexture,
  createCircularGlowTexture,
  generateSupernovaCoreFlareTexture,
  generateAnamorphicSpikeTexture,
  generateSupernovaPhotonicRingTexture,
  generateNebulaTexture,
} from "./TextureUtils";

export interface SupernovaFXInstance {
  worldPos: BABYLON.Vector3;
  startTime: number;
  durationMs: number;
  light: BABYLON.PointLight;
  // Billboard & Optical Flare Meshes
  coreGlowDisc: BABYLON.Mesh;
  coreGlowMat: BABYLON.StandardMaterial;
  anamorphicFlare: BABYLON.Mesh;
  anamorphicFlareMat: BABYLON.StandardMaterial;
  primaryShockwaveDisc: BABYLON.Mesh;
  primaryShockwaveMat: BABYLON.Material;
  secondaryShockwaveDisc: BABYLON.Mesh;
  secondaryShockwaveMat: BABYLON.Material;
  nebulaRemnantDisc: BABYLON.Mesh;
  nebulaRemnantMat: BABYLON.Material;
  // 3D Volumetric Shockwave Toruses
  torusEquatorial: BABYLON.Mesh;
  torusEquatorialMat: BABYLON.Material;
  torusPolar: BABYLON.Mesh;
  torusPolarMat: BABYLON.Material;
  // 3D Relativistic Bipolar Jet Meshes
  jetNorthMesh: BABYLON.Mesh;
  jetSouthMesh: BABYLON.Mesh;
  jetMat: BABYLON.StandardMaterial;
  // Particle Systems
  psBurst: BABYLON.ParticleSystem;
  psJets: BABYLON.ParticleSystem;
  psRing: BABYLON.ParticleSystem;
  psSparks: BABYLON.ParticleSystem;
  isDisposed: boolean;
  dispose: () => void;
  update: (now: number) => void;
}

function registerSupernovaShaders() {
  if (BABYLON.Effect.ShadersStore["snNebulaVertexShader"]) return;

  BABYLON.Effect.ShadersStore["snNebulaVertexShader"] = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 worldViewProjection;
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = worldViewProjection * vec4(position, 1.0);
}
`;

  BABYLON.Effect.ShadersStore["snNebulaFragmentShader"] = `
precision highp float;
varying vec2 vUv;
uniform float time;
uniform vec3 color1;
uniform vec3 color2;
uniform float alpha;

vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1; i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ; m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5); vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g; g.x  = a0.x  * x0.x  + h.x  * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
float fbm(vec2 uv) {
    float f = 0.0; float amp = 0.5; float freq = 1.0;
    for(int i = 0; i < 5; i++) {
        f += amp * snoise(uv * freq);
        freq *= 2.0; amp *= 0.5;
    }
    return f;
}
void main() {
    vec2 cUv = vUv - 0.5;
    float dist = length(cUv) * 2.0;
    if (dist > 1.0) { gl_FragColor = vec4(0.0); return; }

    float angle = atan(cUv.y, cUv.x);
    vec2 polarUv = vec2(angle * 2.0 + time * 0.2, dist * 3.0 - time * 1.5);
    float n1 = snoise(polarUv);
    
    vec2 fbmUv = cUv * 3.0 + vec2(time * 0.1, -time * 0.15);
    float n2 = fbm(fbmUv);
    
    float noiseVal = (n1 * 0.4 + n2 * 0.6 + 1.0) * 0.5;
    float mask = pow(1.0 - dist, 2.5);
    float centerHole = smoothstep(0.0, 0.3, dist); 
    mask *= centerHole;
    
    float density = smoothstep(0.3, 0.7, noiseVal);
    vec3 finalColor = mix(color2, color1, density);
    finalColor += vec3(density * 0.8);
    float finalAlpha = density * mask * alpha * 1.5;
    gl_FragColor = vec4(finalColor * finalAlpha, finalAlpha);
}
`;

  BABYLON.Effect.ShadersStore["snShockwaveFragmentShader"] = `
precision highp float;
varying vec2 vUv;
uniform float time;
uniform vec3 color1;
uniform vec3 color2;
uniform float alpha;

vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1; i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ; m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5); vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g; g.x  = a0.x  * x0.x  + h.x  * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
    vec2 cUv = vUv - 0.5;
    float dist = length(cUv) * 2.0;
    if (dist > 1.0) { gl_FragColor = vec4(0.0); return; }

    float angle = atan(cUv.y, cUv.x);
    float arcNoise = snoise(vec2(angle * 5.0 - time * 3.0, dist * 8.0 - time * 4.0));
    
    float ringCore = smoothstep(0.08, 0.0, abs(dist - 0.8));
    float ringGlow = smoothstep(0.3, 0.0, abs(dist - 0.8));
    
    float distortedDist = dist + arcNoise * 0.03;
    float distortedRingCore = smoothstep(0.04, 0.0, abs(distortedDist - 0.8));
    
    float intensity = ringCore * 0.4 + ringGlow * 0.3 + distortedRingCore * 0.9 * (arcNoise * 0.5 + 0.5);
    vec3 finalColor = mix(color2, color1, intensity + arcNoise * 0.2);
    finalColor += vec3(distortedRingCore * 0.8);
    
    float finalAlpha = intensity * alpha * 2.0;
    gl_FragColor = vec4(finalColor * finalAlpha, finalAlpha);
}
`;
  BABYLON.Effect.ShadersStore["snTorusFragmentShader"] = `
precision highp float;
varying vec2 vUv;
uniform float time;
uniform vec3 color1;
uniform vec3 color2;
uniform float alpha;

vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1; i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ; m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5); vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g; g.x  = a0.x  * x0.x  + h.x  * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
    // vUv.x is around the major ring, vUv.y is around the minor tube
    float plasmaNoise = snoise(vec2(vUv.x * 12.0 - time * 3.0, vUv.y * 6.0));
    
    // Core of the plasma tube
    float core = smoothstep(0.3, 0.0, abs(vUv.y - 0.5));
    float distortedCore = smoothstep(0.1, 0.0, abs(vUv.y - 0.5 + plasmaNoise * 0.15));
    
    float intensity = core * 0.4 + distortedCore * 0.8 * (plasmaNoise * 0.5 + 0.5);
    vec3 finalColor = mix(color2, color1, intensity + plasmaNoise * 0.2);
    finalColor += vec3(distortedCore * 0.6);
    
    float finalAlpha = intensity * alpha * 1.5;
    gl_FragColor = vec4(finalColor * finalAlpha, finalAlpha);
}
`;
}

export function spawnSupernovaFX(
  scene: BABYLON.Scene,
  worldPos: BABYLON.Vector3
): SupernovaFXInstance {
  registerSupernovaShaders();

  const startTime = Date.now();
  const durationMs = 4800;

  // 1. Dynamic PointLight Detonation Source
  const light = new BABYLON.PointLight("supernova_light_3d", worldPos, scene);
  light.diffuse = new BABYLON.Color3(1.0, 0.96, 0.92);
  light.specular = new BABYLON.Color3(1.0, 1.0, 1.0);
  light.intensity = 0;
  light.range = 8000;

  // 2. Camera-Aligned Billboard Optical Core Flare Disc
  const coreGlowDisc = BABYLON.MeshBuilder.CreateDisc("sn_core_glow_disc", {
    radius: 4.0,
    tessellation: 64,
  }, scene);
  coreGlowDisc.position = worldPos.clone();
  coreGlowDisc.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

  const coreFlareTex = generateSupernovaCoreFlareTexture(scene);
  const coreGlowMat = new BABYLON.StandardMaterial("sn_core_glow_mat", scene);
  coreGlowMat.diffuseTexture = coreFlareTex;
  coreGlowMat.emissiveTexture = coreFlareTex;
  coreGlowMat.opacityTexture = coreFlareTex;
  coreGlowMat.emissiveColor = new BABYLON.Color3(1.0, 1.0, 1.0);
  coreGlowMat.disableLighting = true;
  coreGlowMat.backFaceCulling = false;
  coreGlowMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
  coreGlowDisc.material = coreGlowMat;
  coreGlowDisc.scaling.set(0.01, 0.01, 0.01);

  // 3. Anamorphic Lens Flare & 4-Point Diffraction Starburst Billboard
  const anamorphicFlare = BABYLON.MeshBuilder.CreatePlane("sn_anamorphic_flare", {
    size: 20.0,
  }, scene);
  anamorphicFlare.position = worldPos.clone();
  anamorphicFlare.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

  const anamorphicTex = generateAnamorphicSpikeTexture(scene);
  const anamorphicFlareMat = new BABYLON.StandardMaterial("sn_anamorphic_mat", scene);
  anamorphicFlareMat.diffuseTexture = anamorphicTex;
  anamorphicFlareMat.emissiveTexture = anamorphicTex;
  anamorphicFlareMat.opacityTexture = anamorphicTex;
  anamorphicFlareMat.emissiveColor = new BABYLON.Color3(1.0, 1.0, 1.0);
  anamorphicFlareMat.disableLighting = true;
  anamorphicFlareMat.backFaceCulling = false;
  anamorphicFlareMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
  anamorphicFlare.material = anamorphicFlareMat;
  anamorphicFlare.scaling.set(0.01, 0.01, 0.01);

  // 4. Primary Relativistic Photonic Wavefront Disc (Cyan/Magenta Doppler Wave)
  const primaryShockwaveDisc = BABYLON.MeshBuilder.CreateDisc("sn_primary_wavefront", {
    radius: 4.0,
    tessellation: 64,
  }, scene);
  primaryShockwaveDisc.position = worldPos.clone();
  primaryShockwaveDisc.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

  const primaryShockwaveMat = new BABYLON.ShaderMaterial("sn_primary_wave_mat", scene, {
    vertex: "snNebula",
    fragment: "snShockwave",
  }, {
    attributes: ["position", "uv"],
    uniforms: ["worldViewProjection", "time", "color1", "color2", "alpha"],
  });
  primaryShockwaveMat.setColor3("color1", BABYLON.Color3.FromHexString("#00f0ff"));
  primaryShockwaveMat.setColor3("color2", BABYLON.Color3.FromHexString("#ff00a0"));
  primaryShockwaveMat.setFloat("time", 0);
  primaryShockwaveMat.setFloat("alpha", 1.0);
  primaryShockwaveMat.backFaceCulling = false;
  primaryShockwaveMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
  primaryShockwaveDisc.material = primaryShockwaveMat;
  primaryShockwaveDisc.scaling.set(0.01, 0.01, 0.01);

  // 5. Secondary Warm Amber Photonic Wavefront Disc
  const secondaryShockwaveDisc = BABYLON.MeshBuilder.CreateDisc("sn_secondary_wavefront", {
    radius: 3.5,
    tessellation: 64,
  }, scene);
  secondaryShockwaveDisc.position = worldPos.clone();
  secondaryShockwaveDisc.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

  const secondaryShockwaveMat = new BABYLON.ShaderMaterial("sn_secondary_wave_mat", scene, {
    vertex: "snNebula",
    fragment: "snShockwave",
  }, {
    attributes: ["position", "uv"],
    uniforms: ["worldViewProjection", "time", "color1", "color2", "alpha"],
  });
  secondaryShockwaveMat.setColor3("color1", BABYLON.Color3.FromHexString("#ffaa00"));
  secondaryShockwaveMat.setColor3("color2", BABYLON.Color3.FromHexString("#ff1493"));
  secondaryShockwaveMat.setFloat("time", 0);
  secondaryShockwaveMat.setFloat("alpha", 1.0);
  secondaryShockwaveMat.backFaceCulling = false;
  secondaryShockwaveMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
  secondaryShockwaveDisc.material = secondaryShockwaveMat;
  secondaryShockwaveDisc.scaling.set(0.01, 0.01, 0.01);

  // 6. Expanding Nebular Remnant Cradle Disc
  const nebulaRemnantDisc = BABYLON.MeshBuilder.CreateDisc("sn_nebula_remnant", {
    radius: 8.0,
    tessellation: 64,
  }, scene);
  nebulaRemnantDisc.position = worldPos.clone();
  nebulaRemnantDisc.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

  const nebulaRemnantMat = new BABYLON.ShaderMaterial("sn_nebula_remnant_mat", scene, {
    vertex: "snNebula",
    fragment: "snNebula",
  }, {
    attributes: ["position", "uv"],
    uniforms: ["worldViewProjection", "time", "color1", "color2", "alpha"],
  });
  nebulaRemnantMat.setColor3("color1", BABYLON.Color3.FromHexString("#4deeea"));
  nebulaRemnantMat.setColor3("color2", BABYLON.Color3.FromHexString("#ff00a0"));
  nebulaRemnantMat.setFloat("time", 0);
  nebulaRemnantMat.setFloat("alpha", 1.0);
  nebulaRemnantMat.backFaceCulling = false;
  nebulaRemnantMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
  nebulaRemnantDisc.material = nebulaRemnantMat;
  nebulaRemnantDisc.scaling.set(0.01, 0.01, 0.01);

  // 7. High-Tessellation 3D Equatorial Shockwave Torus
  const torusEquatorial = BABYLON.MeshBuilder.CreateTorus("sn_torus_equatorial", {
    diameter: 4.0,
    thickness: 0.16,
    tessellation: 128,
  }, scene);
  torusEquatorial.position = worldPos.clone();
  torusEquatorial.rotation.x = Math.PI / 3.2;

  const torusEquatorialMat = new BABYLON.ShaderMaterial("sn_torus_eq_mat", scene, {
    vertex: "snNebula",
    fragment: "snTorus",
  }, {
    attributes: ["position", "uv"],
    uniforms: ["worldViewProjection", "time", "color1", "color2", "alpha"],
  });
  torusEquatorialMat.setColor3("color1", BABYLON.Color3.FromHexString("#00f0ff"));
  torusEquatorialMat.setColor3("color2", BABYLON.Color3.FromHexString("#ff00a0"));
  torusEquatorialMat.setFloat("time", 0);
  torusEquatorialMat.setFloat("alpha", 1.0);
  torusEquatorialMat.backFaceCulling = false;
  torusEquatorialMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
  torusEquatorial.material = torusEquatorialMat;
  torusEquatorial.scaling.set(0.01, 0.01, 0.01);

  // 8. High-Tessellation 3D Polar Shockwave Torus
  const torusPolar = BABYLON.MeshBuilder.CreateTorus("sn_torus_polar", {
    diameter: 3.2,
    thickness: 0.12,
    tessellation: 128,
  }, scene);
  torusPolar.position = worldPos.clone();
  torusPolar.rotation.x = -Math.PI / 3.8;
  torusPolar.rotation.z = Math.PI / 5;

  const torusPolarMat = new BABYLON.ShaderMaterial("sn_torus_polar_mat", scene, {
    vertex: "snNebula",
    fragment: "snTorus",
  }, {
    attributes: ["position", "uv"],
    uniforms: ["worldViewProjection", "time", "color1", "color2", "alpha"],
  });
  torusPolarMat.setColor3("color1", BABYLON.Color3.FromHexString("#ffaa00"));
  torusPolarMat.setColor3("color2", BABYLON.Color3.FromHexString("#ff1493"));
  torusPolarMat.setFloat("time", 0);
  torusPolarMat.setFloat("alpha", 1.0);
  torusPolarMat.backFaceCulling = false;
  torusPolarMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
  torusPolar.material = torusPolarMat;
  torusPolar.scaling.set(0.01, 0.01, 0.01);

  // 9. Relativistic Bipolar Jet Beams
  const jetNorthMesh = BABYLON.MeshBuilder.CreateCylinder("sn_jet_north", {
    height: 12.0,
    diameterTop: 3.5,
    diameterBottom: 0.1,
    tessellation: 64,
  }, scene);
  jetNorthMesh.position = worldPos.clone();

  const jetSouthMesh = BABYLON.MeshBuilder.CreateCylinder("sn_jet_south", {
    height: 12.0,
    diameterTop: 0.1,
    diameterBottom: 3.5,
    tessellation: 64,
  }, scene);
  jetSouthMesh.position = worldPos.clone();

  const jetMat = new BABYLON.StandardMaterial("sn_jet_mat", scene);
  jetMat.diffuseTexture = coreFlareTex;
  jetMat.emissiveTexture = coreFlareTex;
  jetMat.opacityTexture = coreFlareTex;
  jetMat.emissiveColor = new BABYLON.Color3(0.5, 0.95, 1.0);
  jetMat.disableLighting = true;
  jetMat.backFaceCulling = false;
  jetMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
  jetNorthMesh.material = jetMat;
  jetSouthMesh.material = jetMat;
  jetNorthMesh.scaling.set(0, 0, 0);
  jetSouthMesh.scaling.set(0, 0, 0);

  // Particle textures
  const softParticleTex = createCircleTexture(scene);
  const cyanGlowParticleTex = createCircularGlowTexture("#4deeea", scene);
  const amberGlowParticleTex = createCircularGlowTexture("#ffaa33", scene);
  const whiteSparkTex = createCircularGlowTexture("#ffffff", scene);

  // 10. Particle System A: Omnidirectional Stardust Burst (5,000 particles)
  const psBurst = new BABYLON.ParticleSystem("sn_ps_burst", 5000, scene);
  psBurst.particleTexture = softParticleTex;
  psBurst.emitter = worldPos.clone();
  const sphereEmitter = psBurst.createSphereEmitter(0.5, 1.0);
  psBurst.particleEmitterType = sphereEmitter;
  psBurst.minEmitPower = 80;
  psBurst.maxEmitPower = 280;
  psBurst.updateSpeed = 0.024;
  psBurst.minSize = 0.8;
  psBurst.maxSize = 4.5;
  psBurst.minLifeTime = 0.8;
  psBurst.maxLifeTime = 2.6;
  psBurst.addSizeGradient(0.0, 0.2);
  psBurst.addSizeGradient(0.18, 4.0);
  psBurst.addSizeGradient(0.65, 1.8);
  psBurst.addSizeGradient(1.0, 0.0);
  psBurst.color1 = new BABYLON.Color4(1.0, 0.98, 0.95, 1.0);
  psBurst.color2 = new BABYLON.Color4(0.2, 0.88, 1.0, 0.85);
  psBurst.colorDead = new BABYLON.Color4(0.9, 0.1, 0.5, 0.0);
  psBurst.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
  psBurst.manualEmitCount = 4000;

  // 11. Particle System B: Bipolar Relativistic Plasma Jets (3,000 particles)
  const psJets = new BABYLON.ParticleSystem("sn_ps_jets", 3000, scene);
  psJets.particleTexture = cyanGlowParticleTex;
  psJets.emitter = worldPos.clone();
  const jetEmitter = psJets.createConeEmitter(0.4, Math.PI / 12);
  psJets.particleEmitterType = jetEmitter;
  psJets.minEmitPower = 120;
  psJets.maxEmitPower = 300;
  psJets.updateSpeed = 0.028;
  psJets.minSize = 1.0;
  psJets.maxSize = 5.0;
  psJets.minLifeTime = 0.6;
  psJets.maxLifeTime = 2.2;
  psJets.addSizeGradient(0.0, 0.3);
  psJets.addSizeGradient(0.25, 4.0);
  psJets.addSizeGradient(1.0, 0.0);
  psJets.color1 = new BABYLON.Color4(0.4, 0.98, 1.0, 0.95);
  psJets.color2 = new BABYLON.Color4(0.95, 0.25, 0.9, 0.80);
  psJets.colorDead = new BABYLON.Color4(0.0, 0.0, 0.0, 0.0);
  psJets.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
  psJets.manualEmitCount = 2500;

  // 12. Particle System C: Equatorial Stardust Debris Ring (4,000 particles)
  const psRing = new BABYLON.ParticleSystem("sn_ps_ring", 4000, scene);
  psRing.particleTexture = amberGlowParticleTex;
  psRing.emitter = worldPos.clone();
  const cylEmitter = psRing.createCylinderEmitter(1.8, 0.08, 0.0, 1.0);
  psRing.particleEmitterType = cylEmitter;
  psRing.minEmitPower = 80;
  psRing.maxEmitPower = 240;
  psRing.updateSpeed = 0.022;
  psRing.minSize = 0.6;
  psRing.maxSize = 3.6;
  psRing.minLifeTime = 1.0;
  psRing.maxLifeTime = 3.0;
  psRing.addSizeGradient(0.0, 0.2);
  psRing.addSizeGradient(0.35, 3.0);
  psRing.addSizeGradient(1.0, 0.0);
  psRing.color1 = new BABYLON.Color4(1.0, 0.85, 0.2, 0.92);
  psRing.color2 = new BABYLON.Color4(1.0, 0.2, 0.55, 0.78);
  psRing.colorDead = new BABYLON.Color4(0.0, 0.0, 0.0, 0.0);
  psRing.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
  psRing.manualEmitCount = 3500;

  // 13. Particle System D: Hyper-Velocity Micro Sparks (2,500 particles)
  const psSparks = new BABYLON.ParticleSystem("sn_ps_sparks", 2500, scene);
  psSparks.particleTexture = whiteSparkTex;
  psSparks.emitter = worldPos.clone();
  const sparkEmitter = psSparks.createSphereEmitter(0.2, 1.0);
  psSparks.particleEmitterType = sparkEmitter;
  psSparks.minEmitPower = 150;
  psSparks.maxEmitPower = 400;
  psSparks.updateSpeed = 0.032;
  psSparks.minSize = 0.4;
  psSparks.maxSize = 2.0;
  psSparks.minLifeTime = 0.4;
  psSparks.maxLifeTime = 1.4;
  psSparks.addSizeGradient(0.0, 1.0);
  psSparks.addSizeGradient(0.5, 2.0);
  psSparks.addSizeGradient(1.0, 0.0);
  psSparks.color1 = new BABYLON.Color4(1.0, 1.0, 1.0, 1.0);
  psSparks.color2 = new BABYLON.Color4(0.8, 0.95, 1.0, 0.9);
  psSparks.colorDead = new BABYLON.Color4(0.0, 0.0, 0.0, 0.0);
  psSparks.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
  psSparks.manualEmitCount = 2000;

  let hasDetonated = false;
  let isDisposed = false;

  const instance: SupernovaFXInstance = {
    worldPos,
    startTime,
    durationMs,
    light,
    coreGlowDisc,
    coreGlowMat,
    anamorphicFlare,
    anamorphicFlareMat,
    primaryShockwaveDisc,
    primaryShockwaveMat,
    secondaryShockwaveDisc,
    secondaryShockwaveMat,
    nebulaRemnantDisc,
    nebulaRemnantMat,
    torusEquatorial,
    torusEquatorialMat,
    torusPolar,
    torusPolarMat,
    jetNorthMesh,
    jetSouthMesh,
    jetMat,
    psBurst,
    psJets,
    psRing,
    psSparks,
    isDisposed: false,
    dispose: () => {
      if (isDisposed) return;
      isDisposed = true;
      instance.isDisposed = true;

      try {
        light.dispose();
        coreGlowDisc.dispose();
        coreGlowMat.dispose();
        anamorphicFlare.dispose();
        anamorphicFlareMat.dispose();
        primaryShockwaveDisc.dispose();
        primaryShockwaveMat.dispose();
        secondaryShockwaveDisc.dispose();
        secondaryShockwaveMat.dispose();
        nebulaRemnantDisc.dispose();
        nebulaRemnantMat.dispose();
        torusEquatorial.dispose();
        torusEquatorialMat.dispose();
        torusPolar.dispose();
        torusPolarMat.dispose();
        jetNorthMesh.dispose();
        jetSouthMesh.dispose();
        jetMat.dispose();

        psBurst.stop();
        psBurst.dispose();
        psJets.stop();
        psJets.dispose();
        psRing.stop();
        psRing.dispose();
        psSparks.stop();
        psSparks.dispose();
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

      // Phase 1: Micro-Singularity Implosion & Gravitational Energy Concentration (0ms - 180ms)
      if (elapsed < 180) {
        const implodeProgress = elapsed / 180;
        const coreScale = 6.0 * (1.0 - implodeProgress) + 0.2;
        coreGlowDisc.scaling.set(coreScale, coreScale, 1);
        coreGlowMat.alpha = 0.8 + implodeProgress * 0.2;

        const flareScale = 3.0 * (1.0 - implodeProgress) + 0.1;
        anamorphicFlare.scaling.set(flareScale, flareScale, 1);
        anamorphicFlareMat.alpha = implodeProgress * 0.6;

        light.intensity = implodeProgress * 60.0;
        return;
      }

      // Phase 2: Cataclysmic Detonation Trigger (180ms)
      if (!hasDetonated) {
        hasDetonated = true;
        psBurst.start();
        psJets.start();
        psRing.start();
        psSparks.start();
      }

      // Phase 3: Relativistic Optical Flash, Photonic Wavefront & Remnant Expansion (180ms - 3400ms)
      const detElapsed = elapsed - 180;
      const detProgress = detElapsed / (durationMs - 180);

      // 1. Dynamic PointLight Detonation Spike & Decay
      const lightPeak = Math.max(0, 320.0 * Math.pow(1.0 - detProgress, 2.6));
      light.intensity = lightPeak;

      // 2. Optical Core Bloom Scaling & Dynamic Chromatic Evolution
      const coreScale = Math.pow(detProgress, 0.4) * 85.0;
      coreGlowDisc.scaling.set(coreScale, coreScale, 1);
      const coreAlpha = Math.max(0, Math.pow(1.0 - detProgress, 2.0) * 0.98);
      coreGlowMat.alpha = coreAlpha;

      // Dynamic color shift: Blinding White -> Electric Cyan -> Golden Amber -> Ruby Magenta
      if (detProgress < 0.2) {
        coreGlowMat.emissiveColor = new BABYLON.Color3(1.0, 1.0, 1.0);
      } else if (detProgress < 0.5) {
        const t = (detProgress - 0.2) / 0.3;
        coreGlowMat.emissiveColor = new BABYLON.Color3(1.0 - t * 0.6, 1.0 - t * 0.1, 1.0);
      } else {
        const t = (detProgress - 0.5) / 0.5;
        coreGlowMat.emissiveColor = new BABYLON.Color3(0.4 + t * 0.6, 0.9 - t * 0.7, 1.0 - t * 0.3);
      }

      // 3. Anamorphic Lens Flare & Optical Glint (Horizontal Beam + Starburst)
      const anamorphicScaleX = Math.pow(detProgress, 0.3) * 110.0;
      const anamorphicScaleY = Math.pow(detProgress, 0.45) * 45.0;
      anamorphicFlare.scaling.set(anamorphicScaleX, anamorphicScaleY, 1);
      anamorphicFlare.rotation.z = detProgress * 0.25;
      const anamorphicAlpha = Math.max(0, Math.pow(1.0 - detProgress, 2.4) * 0.95);
      anamorphicFlareMat.alpha = anamorphicAlpha;

      // 4. Primary Relativistic Photonic Wavefront Ring (Rapid Expansion)
      const wave1Scale = Math.pow(detProgress, 0.55) * 140.0;
      primaryShockwaveDisc.scaling.set(wave1Scale, wave1Scale, 1);
      const wave1Alpha = Math.max(0, Math.pow(1.0 - detProgress, 1.5) * 0.92);
      (primaryShockwaveMat as BABYLON.ShaderMaterial).setFloat("alpha", wave1Alpha);
      (primaryShockwaveMat as BABYLON.ShaderMaterial).setFloat("time", elapsed * 0.001);

      // 5. Secondary Warm Amber Photonic Wavefront Ring (Slightly Delayed)
      if (detProgress > 0.08) {
        const secProgress = (detProgress - 0.08) / 0.92;
        const wave2Scale = Math.pow(secProgress, 0.60) * 175.0;
        secondaryShockwaveDisc.scaling.set(wave2Scale, wave2Scale, 1);
        const wave2Alpha = Math.max(0, Math.pow(1.0 - secProgress, 1.6) * 0.85);
        (secondaryShockwaveMat as BABYLON.ShaderMaterial).setFloat("alpha", wave2Alpha);
      }
      (secondaryShockwaveMat as BABYLON.ShaderMaterial).setFloat("time", elapsed * 0.001);

      // 6. Expanding Nebular Remnant Cloud
      if (detProgress > 0.15) {
        const nebProgress = (detProgress - 0.15) / 0.85;
        const nebScale = Math.pow(nebProgress, 0.5) * 90.0;
        nebulaRemnantDisc.scaling.set(nebScale, nebScale, 1);
        nebulaRemnantDisc.rotation.z += 0.003;
        const nebAlpha = Math.max(0, Math.sin(nebProgress * Math.PI) * 0.45);
        (nebulaRemnantMat as BABYLON.ShaderMaterial).setFloat("alpha", nebAlpha);
      }
      (nebulaRemnantMat as BABYLON.ShaderMaterial).setFloat("time", elapsed * 0.001);

      // 7. High-Tessellation 3D Equatorial Shockwave Torus
      const ringScale1 = Math.pow(detProgress, 0.52) * 125.0;
      torusEquatorial.scaling.set(ringScale1, ringScale1, ringScale1);
      torusEquatorial.rotation.z += 0.012;
      torusEquatorial.rotation.x += 0.005;
      const torus1Alpha = Math.max(0, Math.pow(1.0 - detProgress, 1.4) * 0.88);
      (torusEquatorialMat as BABYLON.ShaderMaterial).setFloat("alpha", torus1Alpha);
      (torusEquatorialMat as BABYLON.ShaderMaterial).setFloat("time", elapsed * 0.001);

      // 8. High-Tessellation 3D Polar Shockwave Torus
      const ringScale2 = Math.pow(detProgress, 0.58) * 145.0;
      torusPolar.scaling.set(ringScale2, ringScale2, ringScale2);
      torusPolar.rotation.y += 0.015;
      torusPolar.rotation.z -= 0.008;
      const torus2Alpha = Math.max(0, Math.pow(1.0 - detProgress, 1.6) * 0.78);
      (torusPolarMat as BABYLON.ShaderMaterial).setFloat("alpha", torus2Alpha);
      (torusPolarMat as BABYLON.ShaderMaterial).setFloat("time", elapsed * 0.001);

      // 9. Relativistic Bipolar Jets
      const jetLength = Math.pow(detProgress, 0.32) * 32.0;
      const jetWidth = Math.pow(detProgress, 0.42) * 14.0;
      jetNorthMesh.scaling.set(jetWidth, jetLength, jetWidth);
      jetSouthMesh.scaling.set(jetWidth, jetLength, jetWidth);
      jetNorthMesh.position.y = worldPos.y + jetLength * 6.0;
      jetSouthMesh.position.y = worldPos.y - jetLength * 6.0;
      jetMat.alpha = Math.max(0, Math.pow(1.0 - detProgress, 1.8) * 0.85);
    },
  };

  return instance;
}
