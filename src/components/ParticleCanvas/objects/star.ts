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
  if (!scene || (scene as any).isDisposed) {
    return null as any;
  }
  const starContainer = new BABYLON.TransformNode("star_group", scene);
  starContainer.position.set(wx, wy, 0);

  const starColorStr = entity?.color || "#ffaa44";
  const starSecondaryColorStr = entity?.secondaryColor || starColorStr;
  const safeRadius = isFinite(entity?.radius) && entity.radius > 0 ? entity.radius : 15;

  const starTex = generateStarTexture(
    starColorStr,
    starSecondaryColorStr,
    scene
  );
  const coreMat = new BABYLON.StandardMaterial("starCoreMat", scene);
  coreMat.diffuseTexture = starTex;
  coreMat.emissiveTexture = starTex;
  coreMat.emissiveColor = new BABYLON.Color3(1.2, 1.2, 1.2);

  const coreMesh = BABYLON.MeshBuilder.CreateSphere(
    "star_core",
    { diameter: safeRadius * 2.0, segments: 64 },
    scene
  );
  coreMesh.material = coreMat;
  coreMesh.parent = starContainer;

  const starAtmosMesh = BABYLON.MeshBuilder.CreateSphere(
    "star_atmos",
    { diameter: safeRadius * 2.16, segments: 64 },
    scene
  );

  const starRgb = parseColorToRgb(starColorStr);
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

  // If this star is a relativistic pulsar / magnetar: add collimated synchrotron beams & magnetic tori
  if (entity?.secondaryColor === "#00ffd2") {
    const beamMat = new BABYLON.StandardMaterial("pulsarBeamMat", scene);
    beamMat.emissiveColor = new BABYLON.Color3(0.0, 1.0, 0.85);
    beamMat.diffuseColor = new BABYLON.Color3(1.0, 1.0, 1.0);
    beamMat.disableLighting = true;
    beamMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
    beamMat.alpha = 0.85;

    const beamLength = safeRadius * 7.5;
    const beamNorth = BABYLON.MeshBuilder.CreateCylinder(
      "pulsar_beam_north",
      { height: beamLength, diameterTop: safeRadius * 0.9, diameterBottom: safeRadius * 0.1, tessellation: 24 },
      scene
    );
    beamNorth.material = beamMat;
    beamNorth.position.y = beamLength * 0.5 + safeRadius * 0.3;
    beamNorth.rotation.z = Math.PI * 0.12; // Precessing magnetic tilt
    beamNorth.parent = starContainer;

    const beamSouth = BABYLON.MeshBuilder.CreateCylinder(
      "pulsar_beam_south",
      { height: beamLength, diameterTop: safeRadius * 0.1, diameterBottom: safeRadius * 0.9, tessellation: 24 },
      scene
    );
    beamSouth.material = beamMat;
    beamSouth.position.y = -(beamLength * 0.5 + safeRadius * 0.3);
    beamSouth.rotation.z = Math.PI * 0.12;
    beamSouth.parent = starContainer;

    // Synchrotron equatorial magnetic radiation belt
    const beltMat = new BABYLON.StandardMaterial("pulsarBeltMat", scene);
    beltMat.emissiveColor = new BABYLON.Color3(0.5, 0.8, 1.0);
    beltMat.disableLighting = true;
    beltMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
    beltMat.alpha = 0.55;

    const beltMesh = BABYLON.MeshBuilder.CreateTorus(
      "pulsar_mag_belt",
      { diameter: safeRadius * 3.2, thickness: safeRadius * 0.1, tessellation: 48 },
      scene
    );
    beltMesh.material = beltMat;
    beltMesh.rotation.x = Math.PI / 2.8;
    beltMesh.parent = starContainer;
  }

  starContainer.scaling.set(initScale, initScale, initScale);
  return starContainer;
}
