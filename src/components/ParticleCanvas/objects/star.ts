import * as BABYLON from "@babylonjs/core";
import { CelestialEntity } from "../types";
import { generateStarTexture, parseColorToRgb } from "../TextureUtils";

export function createStarMesh(
  entity: CelestialEntity,
  wx: number,
  wy: number,
  initScale: number,
  scene: BABYLON.Scene
): BABYLON.TransformNode {
  const starContainer = new BABYLON.TransformNode("star_group", scene);
  starContainer.position.set(wx, wy, 0);

  const starTex = generateStarTexture(
    entity.color,
    entity.secondaryColor || entity.color,
    scene
  );
  const coreMat = new BABYLON.StandardMaterial("starCoreMat", scene);
  coreMat.diffuseTexture = starTex;
  coreMat.emissiveTexture = starTex;
  coreMat.emissiveColor = new BABYLON.Color3(1.2, 1.2, 1.2);

  const coreMesh = BABYLON.MeshBuilder.CreateSphere(
    "star_core",
    { diameter: entity.radius * 2.0, segments: 64 },
    scene
  );
  coreMesh.material = coreMat;
  coreMesh.parent = starContainer;

  const starAtmosMesh = BABYLON.MeshBuilder.CreateSphere(
    "star_atmos",
    { diameter: entity.radius * 2.16, segments: 64 },
    scene
  );

  const starRgb = parseColorToRgb(entity.color);
  const starColor = new BABYLON.Color3(starRgb.r / 255, starRgb.g / 255, starRgb.b / 255);
  const starAtmosMat = new BABYLON.StandardMaterial("starAtmosMat", scene);
  starAtmosMat.emissiveColor = starColor;
  starAtmosMat.disableLighting = true;
  starAtmosMat.backFaceCulling = false;
  starAtmosMat.alphaMode = BABYLON.Engine.ALPHA_ADD;

  const starFresnel = new BABYLON.FresnelParameters();
  starFresnel.isEnabled = true;
  starFresnel.bias = 0.0;
  starFresnel.power = 3.5;
  starFresnel.leftColor = starColor;
  starFresnel.rightColor = BABYLON.Color3.Black();
  starAtmosMat.emissiveFresnelParameters = starFresnel;
  starAtmosMat.opacityFresnelParameters = starFresnel;

  starAtmosMesh.material = starAtmosMat;
  starAtmosMesh.parent = starContainer;

  starContainer.scaling.set(initScale, initScale, initScale);
  return starContainer;
}
