import * as BABYLON from "@babylonjs/core";
import { initializeParticleVolume } from "./ParticleVolume";
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
  const numStars = isMobileDevice ? 4000 : 12000;
  const tempParticles: Particle[] = [];
  const fallbackColor = "#ffffff";

  // Tail/trail particles variables
  const tailCount: number = isMobileDevice ? 3000 : 10000;

  // 1. Background miniature galaxies & deep space field stars
  const galaxyStarCount = Math.floor(numStars * 0.25);
  const ambientStarCount = numStars - galaxyStarCount;

  // Background Galaxy 1: Distant grand-design spiral galaxy at top-right
  const g1CenterX = ww * 0.32;
  const g1CenterY = -wh * 0.28;
  const g1CenterZ = 1600;
  const g1Stars = Math.floor(galaxyStarCount * 0.55);

  // Background Galaxy 2: Distant warm elliptical galaxy at bottom-left
  const g2CenterX = -ww * 0.35;
  const g2CenterY = wh * 0.3;
  const g2CenterZ = 2000;
  const g2Stars = galaxyStarCount - g1Stars;

  for (let s = 0; s < g1Stars; s++) {
    const arm = s % 2;
    const baseAngle = arm * Math.PI;
    const radFactor = Math.pow(Math.random(), 1.8);
    const r = 16 + radFactor * 220;
    const spiralAngle = baseAngle + r * 0.042 + (Math.random() - 0.5) * 0.35;
    const speed = (0.012 + Math.random() * 0.008) * Math.pow(60 / (r + 30), 0.5);

    const isCore = radFactor < 0.2;
    const col = isCore
      ? (Math.random() > 0.5 ? "#ffffff" : "#ffe082")
      : (Math.random() > 0.3 ? "#80d8ff" : "#4deeea");

    tempParticles.push({
      x: ww / 2 + g1CenterX,
      y: wh / 2 + g1CenterY,
      z: g1CenterZ,
      targetX: 0,
      targetY: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      color: col,
      baseColor: col,
      size: Math.max(0.15, 0.15 + Math.random() * 0.25),
      isCosmicAmbient: true,
      interstellarType: "background_galaxy",
      galaxyType: "spiral",
      galaxyX: g1CenterX,
      galaxyY: g1CenterY,
      galaxyZ: g1CenterZ,
      galaxyPitch: 0.48,
      galaxyYaw: 0.38,
      orbitRadius: r,
      orbitAngle: spiralAngle,
      orbitSpeed: speed,
      driftSpeed: 0.04,
    });
  }

  for (let s = 0; s < g2Stars; s++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.pow(Math.random(), 2.2) * 170;
    const speed = 0.008 + Math.random() * 0.006;
    const col = Math.random() > 0.4 ? "#ffcc80" : (Math.random() > 0.5 ? "#ffffff" : "#ffab91");

    tempParticles.push({
      x: ww / 2 + g2CenterX,
      y: wh / 2 + g2CenterY,
      z: g2CenterZ,
      targetX: 0,
      targetY: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      color: col,
      baseColor: col,
      size: Math.max(0.15, 0.15 + Math.random() * 0.25),
      isCosmicAmbient: true,
      interstellarType: "background_galaxy",
      galaxyType: "elliptical",
      galaxyX: g2CenterX,
      galaxyY: g2CenterY,
      galaxyZ: g2CenterZ,
      galaxyPitch: -0.35,
      galaxyYaw: -0.55,
      orbitRadius: r,
      orbitAngle: angle,
      orbitSpeed: speed,
      driftSpeed: 0.03,
    });
  }

  tempParticles.forEach((p, i) => initializeParticleVolume(p, i));

  // Deep-space ambient field stardust
  const starColors = ["#ffffff", "#e0f7fa", "#b3e5fc", "#fffde7", "#ffe082", "#ffab91", "#f48fb1"];
  for (let s = 0; s < ambientStarCount; s++) {
    const starColor = starColors[Math.floor(Math.random() * starColors.length)]!;
    const fieldZ = 750 + Math.random() * 2600;
    const distScale = (fieldZ + 600) / 600;
    const spreadX = (Math.random() - 0.5) * (ww * 1.5 * distScale);
    const spreadY = (Math.random() - 0.5) * (wh * 1.5 * distScale);

    tempParticles.push({
      x: ww / 2 + spreadX,
      y: wh / 2 + spreadY,
      z: fieldZ,
      targetX: 0,
      targetY: 0,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      vz: 0,
      color: starColor,
      baseColor: starColor,
      size: Math.max(0.14, 0.14 + Math.random() * 0.26),
      isCosmicAmbient: true,
      driftSpeed: 0.08 + Math.random() * 0.28,
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

  const indices = new Int32Array(totalCount);
  for (let i = 0; i < totalCount; i++) {
    indices[i] = i;
  }
  pointsMesh.setIndices(indices);
  pointsMesh.isPickable = false;

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
    uniform float uCinematicMode;
    uniform float uDofActive;
    uniform float uCameraZ;
    uniform vec3 uCameraPos;
    uniform float uSceneTension;
    uniform float uClimaxPulse;
    varying vec4 vColor;
    varying float vExtra;
    varying vec3 vPos;
    varying float vDefocus;

    void main(void) {
      gl_Position = worldViewProjection * vec4(position, 1.0);
      
      float defocus = 0.0;
      if (uDofActive > 0.01) {
        float distToCam = length(position - uCameraPos);
        float focalPlane = max(500.0, uCameraZ);
        float focalDepth = 480.0;
        
        if (distToCam > focalPlane + focalDepth) {
          // Distant background particle: defocus grows smoothly with distance
          defocus = clamp((distToCam - (focalPlane + focalDepth)) / 1200.0, 0.0, 1.0) * uDofActive;
        } else if (distToCam < focalPlane - focalDepth * 1.6) {
          // Near foreground particle: subtle near-lens defocus
          defocus = clamp(((focalPlane - focalDepth * 1.6) - distToCam) / 600.0, 0.0, 0.75) * uDofActive;
        }
      }
      vDefocus = defocus;

      float sizeMult = 0.36;
      if (extraData > 2.5) {
        sizeMult = 0.52;
      } else if (extraData > 1.5) {
        sizeMult = 0.78 * (1.0 + uSceneTension * 0.14 + uClimaxPulse * 0.28);
      } else if (extraData > 0.5) {
        sizeMult = 0.65 * (1.0 + uSceneTension * 0.10 + uClimaxPulse * 0.22);
      }

      // Optical circle-of-confusion point size expansion for out-of-focus distant particles
      gl_PointSize = pointSize * sizeMult * (1.0 + defocus * 2.6);
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
    varying float vDefocus;
    uniform sampler2D textureSampler;
    uniform float uSceneTension;
    uniform float uClimaxPulse;

    void main(void) {
      if (vColor.a <= 0.01 || length(vColor.rgb) <= 0.001) {
        discard;
      }
      vec2 coord = gl_PointCoord - vec2(0.5);
      float dist = length(coord);
      if (dist > 0.5) discard;
      
      vec4 texColor = texture2D(textureSampler, gl_PointCoord);
      
      // When in focus (vDefocus = 0): sharp intense Gaussian core
      // Background particles (vExtra < 0.5 or > 2.5) use a tighter pinpoint falloff to prevent excess bloom
      bool isBackgroundParticle = (vExtra < 0.5 || vExtra > 2.5);
      float sharpFocus = isBackgroundParticle ? 16.5 : mix(10.0, 8.2, uClimaxPulse);
      float bokehSharpness = mix(sharpFocus, 2.4, vDefocus);
      float radialGlow = exp(-dist * dist * bokehSharpness);

      // Soft circular bokeh disc edge ring (aperture pupil ring)
      if (vDefocus > 0.12) {
        float bokehRing = smoothstep(0.30, 0.45, dist) * smoothstep(0.50, 0.45, dist) * vDefocus * (isBackgroundParticle ? 0.22 : 0.38);
        radialGlow += bokehRing;
      }
      
      float alpha = vColor.a;
      if (vExtra > 2.5) {
        alpha *= 0.46; // Background miniature galaxies: crisp pinpoint stars with reduced bloom
      } else if (vExtra > 1.5) {
        alpha *= 0.65 * (1.0 + uClimaxPulse * 0.25);
      } else if (vExtra > 0.5) {
        alpha *= 0.92 * (1.0 + uSceneTension * 0.08 + uClimaxPulse * 0.18);
      } else {
        alpha *= 0.52; // Ambient field stars: subtle, pinpoint deep-space stardust without bloom wash
      }

      // Energy conservation across circle of confusion
      alpha *= (1.0 / (1.0 + vDefocus * 2.2));
      
      float finalAlpha = texColor.a * radialGlow * alpha;
      if (finalAlpha <= 0.003) {
        discard;
      }
      vec3 outRgb = vColor.rgb * texColor.rgb * finalAlpha;
      if (isBackgroundParticle) {
        // Clamp background particle radiance below the HDR bloom threshold so they stay crisp
        outRgb = min(outRgb, vec3(0.62));
      } else if (uClimaxPulse > 0.01) {
        // Subtle hot-core brilliance boost on foreground celestial particles during climax
        float coreHotspot = exp(-dist * dist * 28.0) * uClimaxPulse * 0.32;
        outRgb += vec3(1.0, 0.96, 0.9) * coreHotspot * finalAlpha;
      }
      gl_FragColor = vec4(outRgb, finalAlpha);
    }
  `;

  const pointsMaterial = new BABYLON.ShaderMaterial("pointsMat", scene, {
    vertex: "customParticle",
    fragment: "customParticle"
  }, {
    attributes: ["position", "color", "extraData"],
    uniforms: [
      "worldViewProjection",
      "pointSize",
      "uCinematicMode",
      "uDofActive",
      "uCameraZ",
      "uCameraPos",
      "uSceneTension",
      "uClimaxPulse"
    ],
    samplers: ["textureSampler"],
    needAlphaBlending: true,
    needAlphaTesting: false
  });

  pointsMaterial.setTexture("textureSampler", circTex);
  pointsMaterial.setFloat("pointSize", (isMobileDevice ? 3.6 : 4.6) * dpr);
  pointsMaterial.setFloat("uCinematicMode", 0.0);
  pointsMaterial.setFloat("uDofActive", 0.0);
  pointsMaterial.setFloat("uCameraZ", 2000.0);
  pointsMaterial.setVector3("uCameraPos", new BABYLON.Vector3(0, 0, -2000));
  pointsMaterial.setFloat("uSceneTension", 0.0);
  pointsMaterial.setFloat("uClimaxPulse", 0.0);
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
