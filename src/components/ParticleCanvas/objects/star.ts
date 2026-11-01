import * as BABYLON from "@babylonjs/core";
import { CelestialEntity } from "../types";
import { generateStarTexture, generateRelativisticJetTexture, parseColorToRgb } from "../TextureUtils";

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

  // If this star is a relativistic pulsar / magnetar: add soft collimated synchrotron beams
  if (entity.secondaryColor === "#00ffd2") {
    const beamTex = generateRelativisticJetTexture(entity.color, entity.secondaryColor, scene);
    const beamMat = new BABYLON.StandardMaterial("pulsarBeamMat", scene);
    beamMat.diffuseTexture = beamTex;
    beamMat.emissiveTexture = beamTex;
    beamMat.opacityTexture = beamTex;
    beamMat.disableLighting = true;
    beamMat.backFaceCulling = false;
    beamMat.alphaMode = BABYLON.Engine.ALPHA_ADD;

    const beamLength = entity.radius * 7.5;
    const beamNorth = BABYLON.MeshBuilder.CreateCylinder(
      "pulsar_beam_north",
      { height: beamLength, diameterTop: entity.radius * 0.9, diameterBottom: entity.radius * 0.1, tessellation: 24 },
      scene
    );
    beamNorth.material = beamMat;
    beamNorth.position.y = beamLength * 0.5 + entity.radius * 0.3;
    beamNorth.rotation.z = Math.PI * 0.12; // Precessing magnetic tilt
    beamNorth.parent = starContainer;

    const beamSouth = BABYLON.MeshBuilder.CreateCylinder(
      "pulsar_beam_south",
      { height: beamLength, diameterTop: entity.radius * 0.1, diameterBottom: entity.radius * 0.9, tessellation: 24 },
      scene
    );
    beamSouth.material = beamMat;
    beamSouth.position.y = -(beamLength * 0.5 + entity.radius * 0.3);
    beamSouth.rotation.z = Math.PI * 0.12;
    beamSouth.parent = starContainer;
  }

  starContainer.scaling.set(initScale, initScale, initScale);
  return starContainer;
}
