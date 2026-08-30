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

  const galMesh = BABYLON.MeshBuilder.CreateDisc(
    "galaxy_ellipsoid",
    { radius: entity.radius * 2.8, tessellation: 64 },
    scene
  );
  galMesh.material = galMat;
  galMesh.rotation.x = Math.PI / 3.8;
  galMesh.renderingGroupId = 2;
  galMesh.parent = galaxyContainer;

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
  coreMesh.renderingGroupId = 2;
  coreMesh.parent = galaxyContainer;

  // 3D Outer Galactic Bulge Coronal Halo
  const haloMesh = BABYLON.MeshBuilder.CreateSphere(
    "galaxy_halo_3d",
    { diameter: entity.radius * 2.2, segments: 24 },
    scene
  );
  haloMesh.material = coreMat;
  haloMesh.renderingGroupId = 2;
  haloMesh.parent = galaxyContainer;

  galaxyContainer.scaling.set(initScale, initScale, initScale);
  return galaxyContainer;
}
