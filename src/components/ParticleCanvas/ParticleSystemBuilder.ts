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
  seeds: Float32Array;
  phaseOffsets: Float32Array;
  velocities: Float32Array;
}

/** Deterministic per-index hash in [0, 1) */
const detHash01 = (idx: number, salt: number): number => {
  const s = Math.sin((idx + 1) * 12.9898 + salt * 78.233) * 43758.5453123;
  return s - Math.floor(s);
};

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

    const seed: [number, number, number, number] = [
      detHash01(s, 1.1),
      detHash01(s, 2.3),
      detHash01(s, 3.7),
      detHash01(s, 5.9),
    ];

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
      seed,
      phaseOffset: seed[0],
    });
  }

  for (let s = 0; s < g2Stars; s++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.pow(Math.random(), 2.2) * 170;
    const speed = 0.008 + Math.random() * 0.006;
    const col = Math.random() > 0.4 ? "#ffcc80" : (Math.random() > 0.5 ? "#ffffff" : "#ffab91");

    const idx = g1Stars + s;
    const seed: [number, number, number, number] = [
      detHash01(idx, 1.1),
      detHash01(idx, 2.3),
      detHash01(idx, 3.7),
      detHash01(idx, 5.9),
    ];

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
      seed,
      phaseOffset: seed[0],
    });
  }

  // Deep-space ambient field stardust
  const starColors = ["#ffffff", "#e0f7fa", "#b3e5fc", "#fffde7", "#ffe082", "#ffab91", "#f48fb1"];
  for (let s = 0; s < ambientStarCount; s++) {
    const starColor = starColors[Math.floor(Math.random() * starColors.length)]!;
    const fieldZ = 750 + Math.random() * 2600;
    const distScale = (fieldZ + 600) / 600;
    const spreadX = (Math.random() - 0.5) * (ww * 1.5 * distScale);
    const spreadY = (Math.random() - 0.5) * (wh * 1.5 * distScale);
    const idx = galaxyStarCount + s;
    const seed: [number, number, number, number] = [
      detHash01(idx, 1.1),
      detHash01(idx, 2.3),
      detHash01(idx, 3.7),
      detHash01(idx, 5.9),
    ];

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
      seed,
      phaseOffset: seed[0],
    });
  }

  const initialCoords = generateTargetsForStage(stage, ww, wh);
  const maxCap = isMobileDevice ? 25000 : 75000;
  const minCap = isMobileDevice ? 12000 : 45000;
  const particleCount = Math.min(
    maxCap,
    Math.max(minCap, initialCoords.length)
  );

  const maxR = Math.hypot(ww, wh) * 0.5;

  for (let i = 0; i < particleCount; i++) {
    const t = initialCoords[i % initialCoords.length] || {
      x: ww / 2,
      y: wh / 2,
      color: fallbackColor,
    };
    const col = t.color || fallbackColor;
    const idx = numStars + i;
    const seed: [number, number, number, number] = [
      detHash01(idx, 1.1),
      detHash01(idx, 2.3),
      detHash01(idx, 3.7),
      detHash01(idx, 5.9),
    ];
    const startX = ww / 2 + (seed[0] - 0.5) * (ww * 4.5);
    const startY = wh / 2 + (seed[1] - 0.5) * (wh * 4.5);
    const startZ = (seed[2] - 0.5) * (ww * 3.5);
    const dNorm = Math.min(1.0, Math.hypot(t.x - ww / 2, t.y - wh / 2) / maxR);

    tempParticles.push({
      x: startX,
      y: startY,
      z: startZ,
      sourceX: startX,
      sourceY: startY,
      sourceZ: startZ,
      targetX: t.x,
      targetY: t.y,
      targetZ: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      color: col,
      baseColor: col,
      size: Math.max(0.1, 0.1 + seed[3] * 0.2),
      isProjectText: true,
      seed,
      phaseOffset: seed[0],
      normDistFromOrigin: 1.0 - dNorm,
      localProgress: 1.0,
      easedProgress: 1.0,
    });
  }

  // Allocate tail/trail particles at the end
  for (let i = 0; i < tailCount; i++) {
    const idx = numStars + particleCount + i;
    const seed: [number, number, number, number] = [
      detHash01(idx, 1.1),
      detHash01(idx, 2.3),
      detHash01(idx, 3.7),
      detHash01(idx, 5.9),
    ];
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
      size: Math.max(0.1, 0.1 + seed[3] * 0.2),
      isTail: true,
      life: 0,
      decay: 0.05 + seed[1] * 0.05,
      seed,
      phaseOffset: seed[0],
    });
  }

  // Partition ambient first, foreground morphing particles in the middle (preserving spatial permutation!), and tails last
  syncParticleColors(tempParticles);

  const tailStartIndex = tempParticles.findIndex((p) => p.isTail);

  const totalCount = tempParticles.length;
  const positions = new Float32Array(totalCount * 3);
  const colors = new Float32Array(totalCount * 4);
  const extras = new Float32Array(totalCount);
  const seeds = new Float32Array(totalCount * 4);
  const phaseOffsets = new Float32Array(totalCount);
  const velocities = new Float32Array(totalCount * 3);

  for (let i = 0; i < totalCount; i++) {
    const p = tempParticles[i]!;
    const s = p.seed || [detHash01(i, 1.1), detHash01(i, 2.3), detHash01(i, 3.7), detHash01(i, 5.9)];
    seeds[i * 4] = s[0];
    seeds[i * 4 + 1] = s[1];
    seeds[i * 4 + 2] = s[2];
    seeds[i * 4 + 3] = s[3];
    phaseOffsets[i] = p.phaseOffset ?? s[0];
  }

  const pointsMesh = new BABYLON.Mesh("pointsMesh", scene);
  pointsMesh.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions, true, 3);
  pointsMesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors, true, 4);
  pointsMesh.setVerticesData("extraData", extras, true, 1);
  pointsMesh.setVerticesData("aSeed", seeds, false, 4);
  pointsMesh.setVerticesData("aPhaseOffset", phaseOffsets, false, 1);
  pointsMesh.setVerticesData("aVelocity", velocities, true, 3);

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
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  // Add shader for particles with per-particle staggered wavefronts, 3D curl noise micro-dispersion,
  // dynamic bokeh rack focus, and velocity-stretched motion blur light streaks
  BABYLON.Effect.ShadersStore["customParticleVertexShader"] = `
    precision highp float;
    attribute vec3 position;
    attribute vec4 color;
    attribute float extraData;
    attribute vec4 aSeed;
    attribute float aPhaseOffset;
    attribute vec3 aVelocity;

    uniform mat4 worldViewProjection;
    uniform float pointSize;
    uniform float uCinematicMode;
    uniform float uDofActive;
    uniform float uCameraZ;
    uniform vec3 uCameraPos;
    uniform float uTransitionProgress;
    uniform vec3 uFocalOrigin;
    uniform float uFocusDistance;
    uniform float uApertureDepth;
    uniform vec3 uCameraVelocity;
    uniform float uCameraAngularVelocity;
    uniform float uTime;

    varying vec4 vColor;
    varying float vExtra;
    varying vec3 vPos;
    varying float vDefocus;
    varying vec2 vScreenVel;
    varying float vSpeedNorm;
    varying float vLocalT;

    // Lightweight 3D hash noise for shader-side curl micro-turbulence
    float hash31(vec3 p) {
      p = fract(p * vec3(443.897, 441.423, 437.195));
      p += dot(p, p.yzx + 19.19);
      return fract((p.x + p.y) * p.z);
    }

    vec3 shaderCurl3D(vec3 p) {
      float e = 0.25;
      float n1 = hash31(p + vec3(0.0, e, 0.0)) - hash31(p - vec3(0.0, e, 0.0));
      float n2 = hash31(p + vec3(0.0, 0.0, e)) - hash31(p - vec3(0.0, 0.0, e));
      float n3 = hash31(p + vec3(e, 0.0, 0.0)) - hash31(p - vec3(e, 0.0, 0.0));
      return vec3(n1 - n2, n2 - n3, n3 - n1);
    }

    void main(void) {
      bool isForeground = (extraData > 0.5 && extraData < 2.5);

      // Compute per-particle staggered wavefront activation t_local
      float dNorm = clamp(length(position - uFocalOrigin) / max(400.0, uCameraZ * 0.65), 0.0, 1.0);
      float wSpread = 0.45;
      float wJitter = 0.20;
      float denom = max(0.05, 1.0 - wSpread - wJitter);
      float tLocal = clamp((uTransitionProgress - (1.0 - dNorm) * wSpread - aSeed.x * wJitter) / denom, 0.0, 1.0);
      // Quintic smoothstep C2 easing
      float tEased = tLocal * tLocal * tLocal * (tLocal * (tLocal * 6.0 - 15.0) + 10.0);
      vLocalT = isForeground ? tEased : 1.0;

      // Bell-curve weighted 3D curl micro-dispersion peaking at t_local = 0.5 via sin(pi * t_local)^2
      float curlWeight = isForeground ? pow(sin(3.14159265 * tLocal), 2.0) : 0.0;
      vec3 displacedPos = position;
      if (curlWeight > 0.001) {
        vec3 curlVec = shaderCurl3D(position * 0.006 + aSeed.xyz * 6.28 + vec3(uTime * 0.15));
        displacedPos += curlVec * (curlWeight * 14.0);
      }

      vec4 clipPos = worldViewProjection * vec4(displacedPos, 1.0);
      gl_Position = clipPos;

      // Project 3D particle + camera velocity into screen space for velocity-stretched motion blur
      vec3 totalVel = aVelocity - uCameraVelocity * 0.35;
      float speed3D = length(totalVel) + uCameraAngularVelocity * 18.0 * (isForeground ? 1.0 : 0.45);
      vSpeedNorm = clamp(speed3D / 42.0, 0.0, 1.0);

      vec2 screenDir = vec2(1.0, 0.0);
      if (length(totalVel) > 0.05 && abs(clipPos.w) > 0.001) {
        vec4 clipVel = worldViewProjection * vec4(displacedPos + totalVel * 2.0, 1.0);
        vec2 ndc0 = clipPos.xy / clipPos.w;
        vec2 ndc1 = clipVel.xy / max(0.001, clipVel.w);
        vec2 deltaNdc = ndc1 - ndc0;
        float dLen = length(deltaNdc);
        if (dLen > 0.0001) {
          screenDir = deltaNdc / dLen;
        }
      }
      vScreenVel = screenDir * vSpeedNorm;

      // Dynamic Depth of Field (Bokeh Rack Focus) using uFocusDistance and uApertureDepth
      float defocus = 0.0;
      if (uDofActive > 0.01) {
        float distToCam = length(displacedPos - uCameraPos);
        float focalPlane = max(350.0, uFocusDistance > 10.0 ? uFocusDistance : uCameraZ);
        float focalDepth = max(80.0, uApertureDepth > 10.0 ? uApertureDepth : 480.0);

        if (distToCam > focalPlane + focalDepth) {
          defocus = clamp((distToCam - (focalPlane + focalDepth)) / (focalDepth * 2.5), 0.0, 1.0) * uDofActive;
        } else if (distToCam < focalPlane - focalDepth * 1.35) {
          defocus = clamp(((focalPlane - focalDepth * 1.35) - distToCam) / (focalDepth * 1.5), 0.0, 0.85) * uDofActive;
        }
        // Mid-transit particles slightly rack into creamy bokeh discs
        if (isForeground && curlWeight > 0.05) {
          defocus = max(defocus, curlWeight * 0.55 * uDofActive);
        }
      }
      vDefocus = defocus;

      float sizeMult = 0.36;
      if (extraData > 2.5) {
        sizeMult = 0.52;
      } else if (extraData > 1.5) {
        sizeMult = 0.78;
      } else if (extraData > 0.5) {
        sizeMult = 0.65 * (1.0 + curlWeight * 0.28);
      }

      // Expand point sprite footprint to accommodate bokeh circle-of-confusion + velocity streak elongation
      float streakExpand = 1.0 + vSpeedNorm * 1.85;
      gl_PointSize = pointSize * sizeMult * (1.0 + defocus * 2.6) * streakExpand;
      vColor = color;
      vExtra = extraData;
      vPos = displacedPos;
    }
  `;

  BABYLON.Effect.ShadersStore["customParticlePixelShader"] = `
    precision highp float;
    varying vec4 vColor;
    varying float vExtra;
    varying vec3 vPos;
    varying float vDefocus;
    varying vec2 vScreenVel;
    varying float vSpeedNorm;
    varying float vLocalT;
    uniform sampler2D textureSampler;

    void main(void) {
      if (vColor.a <= 0.01 || length(vColor.rgb) <= 0.001) {
        discard;
      }
      vec2 coord = gl_PointCoord - vec2(0.5);

      // Anisotropic coordinate compression along velocity vector for motion-blurred light streaks
      float streakMag = clamp(length(vScreenVel), 0.0, 1.0);
      vec2 evalCoord = coord;
      if (streakMag > 0.04) {
        vec2 dir = normalize(vScreenVel);
        vec2 perp = vec2(-dir.y, dir.x);
        float along = dot(coord, dir);
        float across = dot(coord, perp);
        // Stretch along velocity axis and narrow perpendicular axis
        float stretchFactor = 1.0 + streakMag * 2.4;
        evalCoord = dir * (along / stretchFactor) + perp * (across * (1.0 + streakMag * 0.55));
      }

      float dist = length(evalCoord);
      if (dist > 0.5) discard;

      vec4 texColor = texture2D(textureSampler, evalCoord + vec2(0.5));

      // When in focus (vDefocus = 0): sharp intense Gaussian core
      // Background particles (vExtra < 0.5 or > 2.5) use a tighter pinpoint falloff to prevent excess bloom
      bool isBackgroundParticle = (vExtra < 0.5 || vExtra > 2.5);
      float sharpFocus = isBackgroundParticle ? 16.5 : 10.0;
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
        alpha *= 0.65;
      } else if (vExtra > 0.5) {
        alpha *= 0.92;
      } else {
        alpha *= 0.52; // Ambient field stars: subtle, pinpoint deep-space stardust without bloom wash
      }

      // Energy conservation across circle of confusion + slight alpha attenuation at high velocity
      alpha *= (1.0 / (1.0 + vDefocus * 2.2)) * (1.0 - streakMag * 0.28);

      float finalAlpha = texColor.a * radialGlow * alpha;
      if (finalAlpha <= 0.003) {
        discard;
      }

      // Blackbody thermal blue-white shift on fast-moving transition streaks
      vec3 thermalTint = mix(vColor.rgb, vec3(0.84, 0.95, 1.0), streakMag * 0.38);
      vec3 outRgb = thermalTint * texColor.rgb * finalAlpha;
      if (isBackgroundParticle) {
        // Clamp background particle radiance below the HDR bloom threshold so they stay crisp
        outRgb = min(outRgb, vec3(0.62));
      }
      gl_FragColor = vec4(outRgb, finalAlpha);
    }
  `;

  const pointsMaterial = new BABYLON.ShaderMaterial("pointsMat", scene, {
    vertex: "customParticle",
    fragment: "customParticle"
  }, {
    attributes: ["position", "color", "extraData", "aSeed", "aPhaseOffset", "aVelocity"],
    uniforms: [
      "worldViewProjection",
      "pointSize",
      "uCinematicMode",
      "uDofActive",
      "uCameraZ",
      "uCameraPos",
      "uTransitionProgress",
      "uFocalOrigin",
      "uFocusDistance",
      "uApertureDepth",
      "uCameraVelocity",
      "uCameraAngularVelocity",
      "uTime"
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
  pointsMaterial.setFloat("uTransitionProgress", 1.0);
  pointsMaterial.setVector3("uFocalOrigin", new BABYLON.Vector3(0, 0, 0));
  pointsMaterial.setFloat("uFocusDistance", 2000.0);
  pointsMaterial.setFloat("uApertureDepth", 480.0);
  pointsMaterial.setVector3("uCameraVelocity", new BABYLON.Vector3(0, 0, 0));
  pointsMaterial.setFloat("uCameraAngularVelocity", 0.0);
  pointsMaterial.setFloat("uTime", 0.0);
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
    seeds,
    phaseOffsets,
    velocities,
  };
}
