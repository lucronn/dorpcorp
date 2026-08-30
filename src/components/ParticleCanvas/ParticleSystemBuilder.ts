import * as BABYLON from "@babylonjs/core";
import { Particle } from "../../types";
import { generateTargetsForStage } from "./ParticleUtils";
import { syncParticleColors } from "./ParticleMapper";
import { createCircleTexture } from "./TextureUtils";

export interface ParticleSystemBuildResult {
  tempParticles: Particle[];
  tailStartIndex: number;
  tailCount: number;
  pointsMesh: BABYLON.Mesh;
  pointsMaterial: BABYLON.ShaderMaterial;
  positions: Float32Array;
  colors: Float32Array;
  extras: Float32Array;
}

export function buildParticleSystem(
  scene: BABYLON.Scene,
  ww: number,
  wh: number,
  stage: number,
  isMobileDevice: boolean,
  glowLayer: BABYLON.GlowLayer | null
): ParticleSystemBuildResult {
  const numStars = 0;
  const tempParticles: Particle[] = [];
  const fallbackColor = "#ffffff";

  // Tail/trail particles variables
  const tailCount: number = isMobileDevice ? 3000 : 10000;

  for (let s = 0; s < numStars; s++) {
    const starColor = Math.random() > 0.65 ? "#ffcc99" : "#ffffff";
    tempParticles.push({
      x: ww / 2 + (Math.random() - 0.5) * (ww * 8),
      y: wh / 2 + (Math.random() - 0.5) * (wh * 8),
      z: (Math.random() - 0.5) * (ww * 8),
      targetX: 0,
      targetY: 0,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      vz: 0,
      color: starColor,
      baseColor: starColor,
      size: Math.max(0.1, 0.1 + Math.random() * 0.2),
      isCosmicAmbient: true,
      driftSpeed: 0.12 + Math.random() * 0.35,
    });
  }

  const initialCoords = generateTargetsForStage(stage, ww, wh);
  const maxCap = isMobileDevice ? 25000 : 75000;
  const minCap = isMobileDevice ? 12000 : 45000;
  const particleCount = Math.min(
    maxCap,
    Math.max(minCap, initialCoords.length)
  );

  for (let i = 0; i < particleCount; i++) {
    const t = initialCoords[i % initialCoords.length] || {
      x: ww / 2,
      y: wh / 2,
      color: fallbackColor,
    };
    const col = t.color || fallbackColor;
    tempParticles.push({
      x: ww / 2 + (Math.random() - 0.5) * (ww * 6),
      y: wh / 2 + (Math.random() - 0.5) * (wh * 6),
      z: (Math.random() - 0.5) * (ww * 6),
      targetX: t.x,
      targetY: t.y,
      vx: 0,
      vy: 0,
      vz: 0,
      color: col,
      baseColor: col,
      size: Math.max(0.1, 0.1 + Math.random() * 0.2),
    });
  }

  // Allocate tail/trail particles at the end
  for (let i = 0; i < tailCount; i++) {
    tempParticles.push({
      x: -99999,
      y: -99999,
      z: 0,
      targetX: -99999,
      targetY: -99999,
      vx: 0,
      vy: 0,
      vz: 0,
      color: "#000000",
      baseColor: "#000000",
      size: Math.max(0.1, 0.1 + Math.random() * 0.2),
      isTail: true,
      life: 0,
      decay: 0.05 + Math.random() * 0.05,
    });
  }

  tempParticles.sort((a, b) => {
    if (a.isTail && !b.isTail) return 1;
    if (!a.isTail && b.isTail) return -1;
    if (a.isCosmicAmbient && !b.isCosmicAmbient) return -1;
    if (!a.isCosmicAmbient && b.isCosmicAmbient) return 1;
    return a.color.localeCompare(b.color);
  });
  syncParticleColors(tempParticles);

  const tailStartIndex = tempParticles.findIndex((p) => p.isTail);

  const totalCount = tempParticles.length;
  const positions = new Float32Array(totalCount * 3);
  const colors = new Float32Array(totalCount * 4);
  const extras = new Float32Array(totalCount);

  const pointsMesh = new BABYLON.Mesh("pointsMesh", scene);
  pointsMesh.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions, true, 3);
  pointsMesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors, true, 4);
  pointsMesh.setVerticesData("extraData", extras, true, 1);

  const indices = new Uint32Array(totalCount);
  for (let i = 0; i < totalCount; i++) {
    indices[i] = i;
  }
  pointsMesh.setIndices(indices);
  pointsMesh.renderingGroupId = 1;

  if (glowLayer) {
    glowLayer.addExcludedMesh(pointsMesh);
  }

  const circTex = createCircleTexture(scene);
  const dpr = window.devicePixelRatio || 1;

  // Add shader for particles
  BABYLON.Effect.ShadersStore["customParticleVertexShader"] = `
    precision highp float;
    attribute vec3 position;
    attribute vec4 color;
    attribute float extraData;
    uniform mat4 worldViewProjection;
    uniform float pointSize;
    varying vec4 vColor;
    varying float vExtra;
    varying vec3 vPos;
    void main(void) {
      gl_Position = worldViewProjection * vec4(position, 1.0);
      if (extraData > 3.2) {
        // Volumetric nebula gas cloud particles: large billowing puffs
        gl_PointSize = pointSize * 3.2;
      } else if (extraData > 2.5) {
        gl_PointSize = pointSize * 0.65;
      } else if (extraData > 1.5) {
        gl_PointSize = pointSize * 0.95;
      } else if (extraData > 0.5) {
        gl_PointSize = pointSize * 1.15;
      } else {
        // Ambient background stars: tiny subtle pinpricks
        gl_PointSize = pointSize * 0.45;
      }
      vColor = color;
      vExtra = extraData;
      vPos = position;
    }
  `;

  BABYLON.Effect.ShadersStore["customParticlePixelShader"] = `
    precision highp float;
    varying vec4 vColor;
    varying float vExtra;
    varying vec3 vPos;
    uniform sampler2D textureSampler;
    void main(void) {
      if (vColor.a <= 0.005 || length(vColor.rgb) <= 0.001) {
        discard;
      }
      vec2 coord = gl_PointCoord - vec2(0.5);
      float dist = length(coord);
      if (dist > 0.5) discard;
      
      vec4 texColor = texture2D(textureSampler, gl_PointCoord);
      
      // Soft Gaussian radial falloff (ultra-soft for voluminous clouds)
      float radialGlow = vExtra > 3.2 ? exp(-dist * dist * 3.6) : exp(-dist * dist * 7.5);
      
      float alpha = vColor.a;
      if (vExtra > 3.2) {
        // Volumetric gas cloud: misty overlapping transparency
        alpha *= 0.38;
      } else if (vExtra > 2.5) {
        alpha *= 0.35;
      } else if (vExtra > 1.5) {
        alpha *= 0.60;
      } else if (vExtra > 0.5) {
        alpha *= 0.95;
      } else {
        // Ambient background stars: subtle transparency
        alpha *= 0.30;
      }
      
      float finalAlpha = texColor.a * radialGlow * alpha;
      if (finalAlpha <= 0.002) {
        discard;
      }
      gl_FragColor = vec4(vColor.rgb * finalAlpha, finalAlpha);
    }
  `;

  const pointsMaterial = new BABYLON.ShaderMaterial(
    "custom_particle_mat",
    scene,
    {
      vertex: "customParticle",
      fragment: "customParticle",
    },
    {
      attributes: ["position", "color", "extraData"],
      uniforms: ["worldViewProjection", "pointSize"],
      samplers: ["textureSampler"],
      needAlphaBlending: true,
      needAlphaTesting: true,
    }
  );

  const circleTex = createCircleTexture(scene);
  pointsMaterial.setTexture("textureSampler", circleTex);
  pointsMaterial.setFloat("pointSize", (isMobileDevice ? 2.6 : 3.4) * dpr);
  pointsMaterial.alphaMode = BABYLON.Engine.ALPHA_ONEONE;
  pointsMaterial.fillMode = 2;

  pointsMesh.material = pointsMaterial;
  pointsMesh.hasVertexAlpha = true;
  pointsMesh.alwaysSelectAsActiveMesh = true;

  return {
    tempParticles,
    tailStartIndex,
    tailCount,
    pointsMesh,
    pointsMaterial,
    positions,
    colors,
    extras,
  };
}
