import * as BABYLON from "@babylonjs/core";
import { CelestialEntity } from "../types";
import { generateNebulaTexture } from "../TextureUtils";

export function createNebulaMesh(
  entity: CelestialEntity,
  wx: number,
  wy: number,
  initScale: number,
  scene: BABYLON.Scene
): BABYLON.TransformNode {
  const nebContainer = new BABYLON.TransformNode("nebula_group", scene);
  nebContainer.position.set(wx, wy, -100);

  const nebTex = generateNebulaTexture(
    entity.color,
    entity.secondaryColor || entity.color,
    scene
  );
  const nebMat = new BABYLON.StandardMaterial("nebMat", scene);
  nebMat.diffuseTexture = nebTex;
  nebMat.emissiveTexture = nebTex;
  nebMat.opacityTexture = nebTex;
  nebMat.disableLighting = true;
  nebMat.backFaceCulling = false;
  nebMat.alphaMode = BABYLON.Engine.ALPHA_ADD;

  // 3D Volumetric Cosmic Gas Cloud Layers
  for (let s = 0; s < 3; s++) {
    const diameter = entity.radius * (2.8 + s * 0.7);
    const sphere = BABYLON.MeshBuilder.CreateSphere(`nebula_3d_sphere_${s}`, {
      diameter,
      segments: 24,
    }, scene);
    sphere.material = nebMat;
    sphere.rotation.x = s * 0.8;
    sphere.rotation.y = s * 1.5;
    sphere.rotation.z = s * 1.2;
    sphere.position.z = (s - 1) * 15;
    sphere.parent = nebContainer;
  }

  // 3D Inner Core Gas Shell
  const innerCore = BABYLON.MeshBuilder.CreateIcoSphere("nebula_3d_core", {
    radius: entity.radius * 1.2,
    subdivisions: 2,
  }, scene);
  innerCore.material = nebMat;
  innerCore.parent = nebContainer;

  nebContainer.scaling.set(initScale, initScale, initScale);
  return nebContainer;
}

