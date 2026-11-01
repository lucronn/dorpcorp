import * as BABYLON from "@babylonjs/core";
import { CelestialEntity } from "../types";
import {
  generateAccretionDiskTexture,
  generatePhotonRingTexture,
  generateRelativisticJetTexture,
  createCircularGlowTexture,
} from "../TextureUtils";

export function createBlackholeMesh(
  entity: CelestialEntity,
  wx: number,
  wy: number,
  initScale: number,
  scene: BABYLON.Scene
): BABYLON.TransformNode {
  const bhContainer = new BABYLON.TransformNode("bh_group", scene);
  bhContainer.position.set(wx, wy, 0);

  const primaryColor = entity.color || "#ff6600";
  const secondaryColor = entity.secondaryColor || "#ffd778";

  // 1. Pitch Black Event Horizon Shadow Material (Absolute Void - Schwarzschild r_s)
  const ehMat = new BABYLON.StandardMaterial("ehMat", scene);
  ehMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
  ehMat.emissiveColor = new BABYLON.Color3(0, 0, 0);
  ehMat.specularColor = new BABYLON.Color3(0, 0, 0);
  ehMat.ambientColor = new BABYLON.Color3(0, 0, 0);
  ehMat.disableLighting = true;
  ehMat.backFaceCulling = false;
  ehMat.alpha = 1.0;
  ehMat.alphaMode = BABYLON.Engine.ALPHA_DISABLE;
  ehMat.needDepthPrePass = true;
  ehMat.disableDepthWrite = false;
  ehMat.forceDepthWrite = true;

  // 3D Volumetric Event Horizon Sphere Core (Exact 1:1 Schwarzschild Radius r_s)
  const ehMesh = BABYLON.MeshBuilder.CreateSphere(
    "event_horizon_core_3d",
    { diameter: entity.radius * 2.0, segments: 64 },
    scene
  );
  ehMesh.material = ehMat;
  ehMesh.renderingGroupId = 2; // Renders on top of back accretion disk, occluding it
  ehMesh.parent = bhContainer;

  // Ensure GlowLayer never leaks light into the pitch-black singularity
  const glow = scene.getGlowLayerByName("glowLayer");
  if (glow) {
    glow.addExcludedMesh(ehMesh);
  }

  // 2. Swirling Equatorial Accretion Disk Texture & Material with Doppler Beaming
  const accretionTex = generateAccretionDiskTexture(primaryColor, secondaryColor, scene);
  const diskMat = new BABYLON.StandardMaterial("diskMat1", scene);
  diskMat.diffuseTexture = accretionTex;
  diskMat.emissiveTexture = accretionTex;
  diskMat.opacityTexture = accretionTex;
  diskMat.disableLighting = true;
  diskMat.backFaceCulling = false;
  diskMat.alphaMode = BABYLON.Engine.ALPHA_ADD;

  // Primary Equatorial Accretion Disk (Tilted at 68 degrees inclination)
  const diskMesh1 = BABYLON.MeshBuilder.CreateDisc(
    "accretion_layer_1",
    { radius: entity.radius * 5.6, tessellation: 128 },
    scene
  );
  diskMesh1.material = diskMat;
  diskMesh1.rotation.x = Math.PI / 2.65;
  diskMesh1.renderingGroupId = 1;
  diskMesh1.parent = bhContainer;

  // Secondary Wispy Outer Plasma Arm Layer (Co-planar with subtle phase offset)
  const diskMesh2 = BABYLON.MeshBuilder.CreateDisc(
    "accretion_layer_2",
    { radius: entity.radius * 6.4, tessellation: 128 },
    scene
  );
  diskMesh2.material = diskMat;
  diskMesh2.rotation.x = Math.PI / 2.65;
  diskMesh2.rotation.z = Math.PI * 0.35;
  diskMesh2.scaling.set(0.96, 0.96, 0.96);
  diskMesh2.renderingGroupId = 1;
  diskMesh2.parent = bhContainer;

  // 3. Gravitational Lensing Arch - UPPER (The Interstellar Gargantua Crown Halo)
  // Light from the rear of the accretion disk bent by general relativity over the top of the event horizon
  const lensedArchTop = BABYLON.MeshBuilder.CreateDisc(
    "gravitational_lensing_arch",
    { radius: entity.radius * 3.6, tessellation: 128 },
    scene
  );
  lensedArchTop.material = diskMat;
  lensedArchTop.rotation.x = Math.PI / 16; // Facing forward with slight 11-degree back tilt
  lensedArchTop.position.z = -entity.radius * 0.12; // Recessed slightly behind the sphere front
  lensedArchTop.renderingGroupId = 1;
  lensedArchTop.parent = bhContainer;

  // 4. Gravitational Lensing Arch - LOWER (Light bent underneath the event horizon)
  const lensedArchBottom = BABYLON.MeshBuilder.CreateDisc(
    "gravitational_lensing_arch_lower",
    { radius: entity.radius * 3.4, tessellation: 128 },
    scene
  );
  lensedArchBottom.material = diskMat;
  lensedArchBottom.rotation.x = -Math.PI / 16; // Inverted tilt under the sphere
  lensedArchBottom.rotation.z = Math.PI; // Inverted so Doppler asymmetry matches
  lensedArchBottom.position.z = -entity.radius * 0.12;
  lensedArchBottom.renderingGroupId = 1;
  lensedArchBottom.parent = bhContainer;

  // 5. Relativistic Photon Ring (n >= 2 critical curve at b_c = 2.598 r_s) + Lensing Ring (n = 1 at ~1.05 b_c)
  // (Gralla, Holz & Wald 2019, arXiv:1906.00873; EHT Collaboration 2019, arXiv:1906.11238)
  const photonRingTex = generatePhotonRingTexture(primaryColor, secondaryColor, scene);
  const photonRingMat = new BABYLON.StandardMaterial("photonRingMat", scene);
  photonRingMat.diffuseTexture = photonRingTex;
  photonRingMat.emissiveTexture = photonRingTex;
  photonRingMat.opacityTexture = photonRingTex;
  photonRingMat.disableLighting = true;
  photonRingMat.backFaceCulling = false;
  photonRingMat.alphaMode = BABYLON.Engine.ALPHA_ADD;

  // Inner Prograde Kerr ISCO / Photon-Orbit Torus
  const photonRingMesh = BABYLON.MeshBuilder.CreateTorus(
    "bh_photon_ring",
    {
      diameter: entity.radius * 2.85,
      thickness: entity.radius * 0.08,
      tessellation: 96,
    },
    scene
  );
  photonRingMesh.material = photonRingMat;
  photonRingMesh.rotation.x = Math.PI / 2.65;
  photonRingMesh.renderingGroupId = 2;
  photonRingMesh.parent = bhContainer;

  // Screen-plane critical curve (n >= 2 photon ring + n = 1 lensing ring at ~1.05 * b_c)
  const photonHaloDisc = BABYLON.MeshBuilder.CreateDisc(
    "bh_photon_halo",
    { radius: entity.radius * 1.56, tessellation: 128 },
    scene
  );
  photonHaloDisc.material = photonRingMat;
  photonHaloDisc.billboardMode = BABYLON.TransformNode.BILLBOARDMODE_ALL;
  photonHaloDisc.position.z = -entity.radius * 0.05;
  photonHaloDisc.renderingGroupId = 2;
  photonHaloDisc.parent = bhContainer;

  // 6. Dual Relativistic Astrophysical Polar Jets (North & South)
  const jetTex = generateRelativisticJetTexture(primaryColor, secondaryColor, scene);
  const jetMat = new BABYLON.StandardMaterial("bhJetMat", scene);
  jetMat.diffuseTexture = jetTex;
  jetMat.emissiveTexture = jetTex;
  jetMat.opacityTexture = jetTex;
  jetMat.disableLighting = true;
  jetMat.backFaceCulling = false;
  jetMat.alphaMode = BABYLON.Engine.ALPHA_ADD;

  const jetLength = entity.radius * 8.5;
  const jetDiameterTop = entity.radius * 0.95;
  const jetDiameterBottom = entity.radius * 0.12;

  // North Jet (+Y along accretion disk rotational normal)
  const jetNorth = BABYLON.MeshBuilder.CreateCylinder(
    "bh_jet_north",
    {
      height: jetLength,
      diameterTop: jetDiameterTop,
      diameterBottom: jetDiameterBottom,
      tessellation: 32,
    },
    scene
  );
  jetNorth.material = jetMat;
  jetNorth.position.y = jetLength * 0.5 + entity.radius * 0.4;
  jetNorth.rotation.x = -Math.PI / 2 + Math.PI / 2.65; // Perpendicular to disk normal
  jetNorth.renderingGroupId = 1;
  jetNorth.parent = bhContainer;

  // South Jet (-Y along accretion disk rotational normal)
  const jetSouth = BABYLON.MeshBuilder.CreateCylinder(
    "bh_jet_south",
    {
      height: jetLength,
      diameterTop: jetDiameterBottom,
      diameterBottom: jetDiameterTop,
      tessellation: 32,
    },
    scene
  );
  jetSouth.material = jetMat;
  jetSouth.position.y = -(jetLength * 0.5 + entity.radius * 0.4);
  jetSouth.rotation.x = -Math.PI / 2 + Math.PI / 2.65;
  jetSouth.renderingGroupId = 1;
  jetSouth.parent = bhContainer;

  // 7. Gravitational Corona / Stardust Atmospheric Haze
  const coronaMat = new BABYLON.StandardMaterial("coronaMat", scene);
  const coronaTex = createCircularGlowTexture(primaryColor, scene);
  coronaMat.diffuseTexture = coronaTex;
  coronaMat.emissiveTexture = coronaTex;
  coronaMat.opacityTexture = coronaTex;
  coronaMat.disableLighting = true;
  coronaMat.backFaceCulling = false;
  coronaMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
  coronaMat.alpha = 0.45;

  const coronaMesh = BABYLON.MeshBuilder.CreateDisc(
    "bh_corona_haze",
    { radius: entity.radius * 5.2, tessellation: 64 },
    scene
  );
  coronaMesh.material = coronaMat;
  coronaMesh.billboardMode = BABYLON.TransformNode.BILLBOARDMODE_ALL;
  coronaMesh.position.z = -entity.radius * 0.2;
  coronaMesh.renderingGroupId = 1;
  coronaMesh.parent = bhContainer;

  bhContainer.scaling.set(initScale, initScale, initScale);
  return bhContainer;
}
