import * as BABYLON from "@babylonjs/core";
import { CelestialEntity } from "../types";
import {
  generateAccretionDiskTexture,
  generatePhotonRingTexture,
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

  // Pitch Black Event Horizon Shadow Material (Solid Opaque, Non-Additive)
  const ehMat = new BABYLON.StandardMaterial("ehMat", scene);
  ehMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
  ehMat.emissiveColor = new BABYLON.Color3(0, 0, 0);
  ehMat.specularColor = new BABYLON.Color3(0, 0, 0);
  ehMat.ambientColor = new BABYLON.Color3(0, 0, 0);
  ehMat.disableLighting = true;
  ehMat.backFaceCulling = false;
  ehMat.alpha = 1.0;
  ehMat.alphaMode = BABYLON.Engine.ALPHA_COMBINE;

  // 1. 3D Volumetric Event Horizon Sphere Core (Schwarzschild Shadow Diameter = 2 * b_crit)
  const ehMesh = BABYLON.MeshBuilder.CreateSphere(
    "event_horizon_core_3d",
    { diameter: entity.radius * 5.196, segments: 32 },
    scene
  );
  ehMesh.material = ehMat;
  ehMesh.renderingGroupId = 2;
  ehMesh.parent = bhContainer;

  // 2. Camera-Facing Pitch-Black Event Horizon Billboard Occluder Disc
  const ehDisc = BABYLON.MeshBuilder.CreateDisc(
    "event_horizon_occluder_disc",
    { radius: entity.radius * 2.598, tessellation: 64 },
    scene
  );
  ehDisc.material = ehMat;
  ehDisc.billboardMode = BABYLON.TransformNode.BILLBOARDMODE_ALL;
  ehDisc.renderingGroupId = 2;
  ehDisc.parent = bhContainer;

  // Ensure GlowLayer does not cause light bleed into the event horizon void
  const glow = scene.getGlowLayerByName("glowLayer");
  if (glow) {
    glow.addExcludedMesh(ehMesh);
    glow.addExcludedMesh(ehDisc);
  }

  // Swirling Equatorial Accretion Disk
  const accretionTex = generateAccretionDiskTexture(
    entity.color,
    entity.secondaryColor || entity.color,
    scene
  );
  const diskMat = new BABYLON.StandardMaterial("diskMat1", scene);
  diskMat.diffuseTexture = accretionTex;
  diskMat.emissiveTexture = accretionTex;
  diskMat.opacityTexture = accretionTex;
  diskMat.disableLighting = true;
  diskMat.backFaceCulling = false;
  diskMat.alphaMode = BABYLON.Engine.ALPHA_ADD;

  const diskMesh1 = BABYLON.MeshBuilder.CreateDisc(
    "accretion_layer_1",
    { radius: entity.radius * 3.8, tessellation: 64 },
    scene
  );
  diskMesh1.material = diskMat;
  diskMesh1.rotation.x = Math.PI / 2.35;
  diskMesh1.renderingGroupId = 1;
  diskMesh1.parent = bhContainer;

  // Gravitational Lensing Warped Accretion Ring
  const diskMeshWarped = BABYLON.MeshBuilder.CreateDisc(
    "accretion_layer_warped",
    { radius: entity.radius * 3.1, tessellation: 64 },
    scene
  );
  diskMeshWarped.material = diskMat;
  diskMeshWarped.rotation.x = Math.PI / 10;
  diskMeshWarped.renderingGroupId = 1;
  diskMeshWarped.parent = bhContainer;

  // 3D Photon Ring Torus Corona (Hollow Central Void)
  const photonRingTex = generatePhotonRingTexture(
    entity.color,
    entity.secondaryColor || entity.color,
    scene
  );
  const photonRingMat = new BABYLON.StandardMaterial("photonRingMat", scene);
  photonRingMat.diffuseTexture = photonRingTex;
  photonRingMat.emissiveTexture = photonRingTex;
  photonRingMat.opacityTexture = photonRingTex;
  photonRingMat.disableLighting = true;
  photonRingMat.backFaceCulling = false;
  photonRingMat.alphaMode = BABYLON.Engine.ALPHA_ADD;

  const photonRingMesh = BABYLON.MeshBuilder.CreateTorus(
    "event_horizon_photon_ring_3d_torus",
    {
      diameter: entity.radius * 2.8,
      thickness: entity.radius * 0.35,
      tessellation: 64,
    },
    scene
  );
  photonRingMesh.material = photonRingMat;
  photonRingMesh.rotation.x = Math.PI / 3;
  photonRingMesh.renderingGroupId = 1;
  photonRingMesh.parent = bhContainer;

  bhContainer.scaling.set(initScale, initScale, initScale);
  return bhContainer;
}
