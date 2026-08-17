import * as BABYLON from "@babylonjs/core";
import { CelestialEntity } from "../types";
import {
  generateAdvancedPlanetTexture,
  generateProceduralCloudTexture,
  generateConcentricRingTexture,
  parseColorToRgb,
} from "../TextureUtils";

export function createPlanetMesh(
  entity: CelestialEntity,
  wx: number,
  wy: number,
  initScale: number,
  scene: BABYLON.Scene
): BABYLON.TransformNode {
  const planetContainer = new BABYLON.TransformNode("planet_group", scene);
  planetContainer.position.set(wx, wy, 0);

  const rgb = parseColorToRgb(entity.color);

  // Core Planet Sphere
  const planetTex = generateAdvancedPlanetTexture(
    entity.color,
    entity.secondaryColor || entity.color,
    scene
  );
  const sphereMat = new BABYLON.StandardMaterial("sphereMat", scene);
  sphereMat.diffuseTexture = planetTex;
  sphereMat.emissiveTexture = planetTex;
  sphereMat.emissiveColor = new BABYLON.Color3(0.3, 0.3, 0.3);

  const sphereMesh = BABYLON.MeshBuilder.CreateSphere(
    "planet_sphere",
    { diameter: entity.radius * 2, segments: 64 },
    scene
  );
  sphereMesh.material = sphereMat;
  sphereMesh.parent = planetContainer;

  // Cloud Layer
  const cloudTex = generateProceduralCloudTexture(entity.color, scene);
  const cloudMat = new BABYLON.StandardMaterial("cloudMat", scene);
  cloudMat.diffuseTexture = cloudTex;
  cloudMat.emissiveTexture = cloudTex;
  cloudMat.opacityTexture = cloudTex;
  cloudMat.alphaMode = BABYLON.Engine.ALPHA_COMBINE;
  cloudMat.disableLighting = true;
  cloudMat.backFaceCulling = false;

  const cloudMesh = BABYLON.MeshBuilder.CreateSphere(
    "planet_clouds_inner",
    { diameter: entity.radius * 2.06, segments: 32 },
    scene
  );
  cloudMesh.material = cloudMat;
  cloudMesh.parent = planetContainer;

  // Rings
  if (entity.hasRings) {
    const ringTex = generateConcentricRingTexture(
      entity.ringColor || entity.color,
      scene
    );
    const ringMat = new BABYLON.StandardMaterial("ringMat", scene);
    ringMat.diffuseTexture = ringTex;
    ringMat.emissiveTexture = ringTex;
    ringMat.opacityTexture = ringTex;
    ringMat.disableLighting = true;
    ringMat.backFaceCulling = false;
    ringMat.alphaMode = BABYLON.Engine.ALPHA_COMBINE;

    const ringMesh = BABYLON.MeshBuilder.CreateDisc(
      "ring_mesh",
      { radius: entity.radius * 2.2, tessellation: 64 },
      scene
    );
    ringMesh.material = ringMat;
    ringMesh.rotation.x = Math.PI / 2.3;
    ringMesh.parent = planetContainer;
  }

  // Atmosphere Glow
  const atmosphereGlowMesh = BABYLON.MeshBuilder.CreateSphere(
    "atmosphere_glow",
    { diameter: entity.radius * 2.18, segments: 32 },
    scene
  );

  const atmosColor = new BABYLON.Color3(rgb.r / 255, rgb.g / 255, rgb.b / 255);
  const atmosphereGlowMat = new BABYLON.StandardMaterial("atmosphereGlowMat", scene);
  atmosphereGlowMat.emissiveColor = atmosColor;
  atmosphereGlowMat.disableLighting = true;
  atmosphereGlowMat.backFaceCulling = true;
  atmosphereGlowMat.alphaMode = BABYLON.Engine.ALPHA_ADD;

  const atmosFresnel = new BABYLON.FresnelParameters();
  atmosFresnel.isEnabled = true;
  atmosFresnel.bias = 0.0;
  atmosFresnel.power = 4.0;
  atmosFresnel.leftColor = atmosColor;
  atmosFresnel.rightColor = BABYLON.Color3.Black();
  atmosphereGlowMat.emissiveFresnelParameters = atmosFresnel;
  atmosphereGlowMat.opacityFresnelParameters = atmosFresnel;

  atmosphereGlowMesh.material = atmosphereGlowMat;
  atmosphereGlowMesh.parent = planetContainer;

  planetContainer.scaling.set(initScale, initScale, initScale);
  return planetContainer;
}
