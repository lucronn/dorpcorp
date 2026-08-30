import * as BABYLON from "@babylonjs/core";
import { CelestialEntity } from "../types";
import { generateNebulaTexture, createCircularGlowTexture } from "../TextureUtils";

/**
 * Builds a realistic 3D volumetric interstellar gas cloud composed of
 * organic billowing cloud puff lobes, filamentary gas pillars, and ionized cores.
 */
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

  // 1. Soft Volumetric Body Material (Translucent gas body)
  const gasMat = new BABYLON.StandardMaterial("nebGasMat", scene);
  gasMat.diffuseTexture = nebTex;
  gasMat.emissiveTexture = nebTex;
  gasMat.opacityTexture = nebTex;
  gasMat.disableLighting = true;
  gasMat.backFaceCulling = false;
  gasMat.alphaMode = BABYLON.Engine.ALPHA_COMBINE;
  gasMat.alpha = 0.65;

  // 2. Ionized Plasma Glow Material (Additive highlights & filaments)
  const plasmaMat = new BABYLON.StandardMaterial("nebPlasmaMat", scene);
  plasmaMat.diffuseTexture = nebTex;
  plasmaMat.emissiveTexture = nebTex;
  plasmaMat.opacityTexture = nebTex;
  plasmaMat.disableLighting = true;
  plasmaMat.backFaceCulling = false;
  plasmaMat.alphaMode = BABYLON.Engine.ALPHA_ADD;

  // 3. Multi-Lobe Volumetric Cloud Cluster (9 organic billowing lobes)
  const lobeOffsets = [
    { x: 0, y: 0, z: 0, scaleX: 1.2, scaleY: 0.9, scaleZ: 1.1, rotX: 0.2, rotY: 0.5, rotZ: 0.1 },
    { x: 0.42, y: 0.28, z: 25, scaleX: 0.85, scaleY: 1.3, scaleZ: 0.75, rotX: -0.4, rotY: 1.2, rotZ: 0.6 },
    { x: -0.38, y: -0.22, z: -20, scaleX: 1.1, scaleY: 0.75, scaleZ: 1.2, rotX: 0.7, rotY: -0.8, rotZ: 0.3 },
    { x: 0.25, y: -0.45, z: 15, scaleX: 0.7, scaleY: 1.1, scaleZ: 0.9, rotX: 1.1, rotY: 0.3, rotZ: -0.5 },
    { x: -0.48, y: 0.35, z: -15, scaleX: 0.95, scaleY: 0.8, scaleZ: 1.05, rotX: -0.6, rotY: -0.4, rotZ: 0.9 },
    { x: 0.55, y: -0.15, z: -30, scaleX: 0.8, scaleY: 0.65, scaleZ: 0.7, rotX: 0.3, rotY: 1.8, rotZ: -0.2 },
    { x: -0.20, y: 0.58, z: 35, scaleX: 0.65, scaleY: 1.0, scaleZ: 0.85, rotX: -0.9, rotY: 0.6, rotZ: 0.4 },
    { x: 0.15, y: 0.35, z: -40, scaleX: 1.0, scaleY: 0.6, scaleZ: 1.15, rotX: 0.5, rotY: -1.2, rotZ: -0.7 },
    { x: -0.52, y: -0.42, z: 20, scaleX: 0.75, scaleY: 0.85, scaleZ: 0.65, rotX: 0.8, rotY: 0.9, rotZ: 0.2 },
  ];

  lobeOffsets.forEach((lobe, i) => {
    const baseDiameter = entity.radius * (1.2 + (i % 3) * 0.35);
    const cloudLobe = BABYLON.MeshBuilder.CreateSphere(
      `nebula_cloud_lobe_${i}`,
      { diameter: baseDiameter, segments: 16 },
      scene
    );
    cloudLobe.material = i % 2 === 0 ? gasMat : plasmaMat;
    cloudLobe.position.set(
      lobe.x * entity.radius,
      lobe.y * entity.radius,
      lobe.z
    );
    cloudLobe.scaling.set(lobe.scaleX, lobe.scaleY, lobe.scaleZ);
    cloudLobe.rotation.set(lobe.rotX, lobe.rotY, lobe.rotZ);
    cloudLobe.renderingGroupId = 2;
    cloudLobe.parent = nebContainer;
  });

  // 4. Central Ionized Stellar Nucleus Glow Disc
  const glowTex = createCircularGlowTexture(entity.secondaryColor || entity.color, scene);
  const glowMat = new BABYLON.StandardMaterial("nebGlowMat", scene);
  glowMat.diffuseTexture = glowTex;
  glowMat.emissiveTexture = glowTex;
  glowMat.opacityTexture = glowTex;
  glowMat.disableLighting = true;
  glowMat.backFaceCulling = false;
  glowMat.alphaMode = BABYLON.Engine.ALPHA_ADD;

  const coreDisc = BABYLON.MeshBuilder.CreateDisc(
    "nebula_core_glow_disc",
    { radius: entity.radius * 0.9, tessellation: 48 },
    scene
  );
  coreDisc.material = glowMat;
  coreDisc.renderingGroupId = 2;
  coreDisc.parent = nebContainer;

  nebContainer.scaling.set(initScale, initScale, initScale);
  return nebContainer;
}

