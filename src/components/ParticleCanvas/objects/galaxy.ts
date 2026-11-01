import * as BABYLON from "@babylonjs/core";
import { CelestialEntity } from "../types";
import { generateGalaxyTexture, createCircularGlowTexture } from "../TextureUtils";

export function createGalaxyMesh(
  entity: CelestialEntity,
  wx: number,
  wy: number,
  initScale: number,
  scene: BABYLON.Scene
): BABYLON.TransformNode {
  const galaxyContainer = new BABYLON.TransformNode("galaxy_group", scene);
  galaxyContainer.position.set(wx, wy, -50);

  const galTex = generateGalaxyTexture(
    entity.color,
    entity.secondaryColor || entity.color,
    scene
  );
  const galMat = new BABYLON.StandardMaterial("galMat", scene);
  galMat.diffuseTexture = galTex;
  galMat.emissiveTexture = galTex;
  galMat.opacityTexture = galTex;
  galMat.disableLighting = true;
  galMat.backFaceCulling = false;
  galMat.alphaMode = BABYLON.Engine.ALPHA_ADD;

  // Three faint strata support the particle volume without one opaque-looking card.
  // All share one texture/material; the solid bulge remains spherical.
  galMat.alpha = 0.22;
  for (let layer = -1; layer <= 1; layer++) {
    const galMesh = BABYLON.MeshBuilder.CreateDisc(
      `galaxy_ellipsoid_${layer}`,
      { radius: entity.radius * (layer === 0 ? 2.8 : 2.45), tessellation: 48 },
      scene
    );
    galMesh.material = galMat;
    galMesh.rotation.x = Math.PI / 2 - 0.72;
    const height = layer * entity.radius * 0.22;
    galMesh.position.y = height * Math.cos(0.72);
    galMesh.position.z = height * Math.sin(0.72);
    galMesh.parent = galaxyContainer;
  }

  const coreTex = createCircularGlowTexture(entity.color, scene);
  const coreMat = new BABYLON.StandardMaterial("galaxyCoreMat", scene);
  coreMat.diffuseTexture = coreTex;
  coreMat.emissiveTexture = coreTex;
  coreMat.opacityTexture = coreTex;
  coreMat.disableLighting = true;
  coreMat.backFaceCulling = false;
  coreMat.alphaMode = BABYLON.Engine.ALPHA_ADD;

  const coreMesh = BABYLON.MeshBuilder.CreateSphere(
    "galaxy_core_3d",
    { diameter: entity.radius * 1.5, segments: 32 },
    scene
  );
  coreMesh.material = coreMat;
  coreMesh.parent = galaxyContainer;

  // 3D Outer Galactic Bulge Coronal Halo
  const haloMesh = BABYLON.MeshBuilder.CreateSphere(
    "galaxy_halo_3d",
    { diameter: entity.radius * 2.2, segments: 24 },
    scene
  );
  haloMesh.material = coreMat;
  haloMesh.parent = galaxyContainer;

  galaxyContainer.scaling.set(initScale, initScale, initScale);
  return galaxyContainer;
}
