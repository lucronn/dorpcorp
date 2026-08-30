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

  // 1. Pitch Black Event Horizon Shadow Material (Solid Opaque, Non-Additive)
  const ehMat = new BABYLON.StandardMaterial("ehMat", scene);
  ehMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
  ehMat.emissiveColor = new BABYLON.Color3(0, 0, 0);
  ehMat.specularColor = new BABYLON.Color3(0, 0, 0);
  ehMat.ambientColor = new BABYLON.Color3(0, 0, 0);
  ehMat.disableLighting = true;
  ehMat.backFaceCulling = false;
  ehMat.alpha = 1.0;
  ehMat.alphaMode = BABYLON.Engine.ALPHA_COMBINE;

  // 3D Physical Event Horizon Sphere Core (r = 1.0 * r_s, diameter = 2.0 * r_s)
  const ehMesh = BABYLON.MeshBuilder.CreateSphere(
    "event_horizon_core_3d",
    { diameter: entity.radius * 2.0, segments: 64 },
    scene
  );
  ehMesh.material = ehMat;
  ehMesh.renderingGroupId = 2;
  ehMesh.parent = bhContainer;

  // Inner non-reflective depth occluder sphere for complete visual absorption
  const innerOccluder = BABYLON.MeshBuilder.CreateSphere(
    "event_horizon_inner_occluder",
    { diameter: entity.radius * 1.95, segments: 32 },
    scene
  );
  innerOccluder.material = ehMat;
  innerOccluder.renderingGroupId = 2;
  innerOccluder.parent = bhContainer;

  // Ensure GlowLayer does not cause light bleed into the event horizon void
  const glow = scene.getGlowLayerByName("glowLayer");
  if (glow) {
    glow.addExcludedMesh(ehMesh);
    glow.addExcludedMesh(innerOccluder);
  }

  // 2. 3D Relativistic Photon Sphere Corona Torus (r_ph = 1.5 * r_s)
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
      diameter: entity.radius * 2.5,
      thickness: entity.radius * 0.24,
      tessellation: 64,
    },
    scene
  );
  photonRingMesh.material = photonRingMat;
  photonRingMesh.rotation.x = Math.PI / 2.3;
  photonRingMesh.renderingGroupId = 1;
  photonRingMesh.parent = bhContainer;

  // 3. Primary Equatorial Accretion Disk (Extends from ISCO r=3.0 to r=8.5)
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
    { radius: entity.radius * 7.5, tessellation: 96 },
    scene
  );
  diskMesh1.material = diskMat;
  diskMesh1.rotation.x = Math.PI / 2.35;
  diskMesh1.renderingGroupId = 1;
  diskMesh1.parent = bhContainer;

  // 4. Iconic Interstellar Gargantua Gravitationally-Lensed Vertical Top Arch
  const diskMeshTopArch = BABYLON.MeshBuilder.CreateDisc(
    "accretion_layer_warped_top",
    { radius: entity.radius * 6.5, tessellation: 96 },
    scene
  );
  diskMeshTopArch.material = diskMat;
  diskMeshTopArch.rotation.x = Math.PI / 8.5;
  diskMeshTopArch.position.z = -entity.radius * 0.15;
  diskMeshTopArch.renderingGroupId = 1;
  diskMeshTopArch.parent = bhContainer;

  // 5. Gravitationally-Lensed Bottom Arch
  const diskMeshBottomArch = BABYLON.MeshBuilder.CreateDisc(
    "accretion_layer_warped_bottom",
    { radius: entity.radius * 6.0, tessellation: 96 },
    scene
  );
  diskMeshBottomArch.material = diskMat;
  diskMeshBottomArch.rotation.x = -Math.PI / 8.5;
  diskMeshBottomArch.position.z = entity.radius * 0.15;
  diskMeshBottomArch.renderingGroupId = 1;
  diskMeshBottomArch.parent = bhContainer;

  // 6. Outer Diffuse Stardust Accretion Sheath
  const outerDisc = BABYLON.MeshBuilder.CreateDisc(
    "accretion_layer_outer",
    { radius: entity.radius * 10.5, tessellation: 64 },
    scene
  );
  outerDisc.material = diskMat;
  outerDisc.rotation.x = Math.PI / 2.2;
  outerDisc.rotation.y = Math.PI / 16;
  outerDisc.renderingGroupId = 1;
  outerDisc.parent = bhContainer;

  bhContainer.scaling.set(initScale, initScale, initScale);
  return bhContainer;
}
