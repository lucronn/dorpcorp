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
  coreMesh.renderingGroupId = 2;
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
  starAtmosMesh.renderingGroupId = 2;
  starAtmosMesh.parent = starContainer;

  // For compact high-energy stars / neutron stars: add collimated 3D polar jet beams
  if (entity.radius <= 25) {
    const jetMat = new BABYLON.StandardMaterial("polarJetMat", scene);
    jetMat.emissiveColor = new BABYLON.Color3(0.6, 0.9, 1.2);
    jetMat.disableLighting = true;
    jetMat.backFaceCulling = false;
    jetMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
    jetMat.alpha = 0.65;

    const northJet = BABYLON.MeshBuilder.CreateCylinder(
      "polar_jet_north",
      { height: entity.radius * 9.0, diameterTop: entity.radius * 1.6, diameterBottom: entity.radius * 0.2 },
      scene
    );
    northJet.position.y = entity.radius * 4.5;
    northJet.material = jetMat;
    northJet.renderingGroupId = 2;
    northJet.parent = starContainer;

    const southJet = BABYLON.MeshBuilder.CreateCylinder(
      "polar_jet_south",
      { height: entity.radius * 9.0, diameterTop: entity.radius * 0.2, diameterBottom: entity.radius * 1.6 },
      scene
    );
    southJet.position.y = -entity.radius * 4.5;
    southJet.material = jetMat;
    southJet.renderingGroupId = 2;
    southJet.parent = starContainer;
  }

  starContainer.scaling.set(initScale, initScale, initScale);
  return starContainer;
}
