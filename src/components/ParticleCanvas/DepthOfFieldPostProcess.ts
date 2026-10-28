import React from "react";
import * as BABYLON from "@babylonjs/core";
import { CelestialEntity } from "./types";

export function setupDepthOfFieldPostProcess(
  camera: BABYLON.Camera,
  scene: BABYLON.Scene,
  engine: BABYLON.Engine,
  dofPostProcessRef: React.MutableRefObject<BABYLON.PostProcess | null>,
  isCinematicRef: React.MutableRefObject<boolean> | undefined,
  celestialEntitiesRef: React.MutableRefObject<CelestialEntity[]>,
  cameraZRef?: React.MutableRefObject<number>,
  dofEnabledRef?: React.MutableRefObject<boolean>
): void {
  if (!camera || !scene || scene.isDisposed || !engine || dofPostProcessRef.current) return;

  BABYLON.Effect.ShadersStore["cinematicDofFragmentShader"] = `
    precision highp float;
    varying vec2 vUV;
    uniform sampler2D textureSampler;
    uniform vec2 uScreenResolution;
    uniform float uTime;
    uniform float uCinematicMode;
    uniform float uDofActive;
    uniform vec2 uFocusPoint;
    uniform float uFocusRadius;
    uniform float uMaxBlurRadius;
    uniform float uAnamorphicAspect;
    uniform float uChromaticFringe;

    // 16-sample Poisson disc kernel for creamy, artifact-free optical bokeh
    vec2 getPoissonSample(int i) {
      if (i == 0) return vec2(-0.326, -0.406);
      if (i == 1) return vec2(-0.840, -0.074);
      if (i == 2) return vec2(-0.696,  0.457);
      if (i == 3) return vec2(-0.203,  0.621);
      if (i == 4) return vec2( 0.962, -0.195);
      if (i == 5) return vec2( 0.473, -0.480);
      if (i == 6) return vec2( 0.519,  0.767);
      if (i == 7) return vec2( 0.185, -0.893);
      if (i == 8) return vec2( 0.507,  0.064);
      if (i == 9) return vec2( 0.896,  0.412);
      if (i == 10) return vec2(-0.322, -0.933);
      if (i == 11) return vec2(-0.792, -0.598);
      if (i == 12) return vec2(-0.023, -0.219);
      if (i == 13) return vec2( 0.287,  0.428);
      if (i == 14) return vec2(-0.485,  0.137);
      return vec2( 0.142,  0.941);
    }

    void main(void) {
      vec2 uv = vUV;
      vec4 baseColor = texture2D(textureSampler, uv);

      // Fast path: if DoF is inactive, pass through instantly with zero blur overhead
      if (uDofActive <= 0.005) {
        gl_FragColor = baseColor;
        return;
      }

      float aspect = uScreenResolution.x / uScreenResolution.y;
      
      // Calculate distance from the focal center (subject tracking)
      vec2 delta = (uv - uFocusPoint);
      delta.x *= aspect;
      float distToFocus = length(delta);

      // Circle of Confusion (CoC) optical curve:
      // Inner zone (< uFocusRadius): pin-sharp focal plane for main subject
      // Distant zone (> uFocusRadius): smooth cinematic anamorphic blur
      float innerR = max(0.04, uFocusRadius * 0.85);
      float outerR = max(innerR + 0.08, uFocusRadius * 2.6);
      float coc = smoothstep(innerR, outerR, distToFocus);

      // Soft vignette depth falloff for outer boundary
      float cornerDist = length(uv - vec2(0.5));
      coc = clamp(coc + cornerDist * 0.25, 0.0, 1.0);

      float blurRadius = coc * uMaxBlurRadius * uDofActive;

      // Pin-sharp center optimization
      if (blurRadius < 0.25) {
        gl_FragColor = baseColor;
        return;
      }

      vec2 texelSize = 1.0 / uScreenResolution;
      vec3 accumColor = vec3(0.0);
      float totalWeight = 0.0;

      // Center sample with base weight
      float centerLuma = dot(baseColor.rgb, vec3(0.299, 0.587, 0.114));
      float centerWeight = 1.0 + pow(centerLuma, 2.0) * 4.0;
      accumColor += baseColor.rgb * centerWeight;
      totalWeight += centerWeight;

      // Multi-tap anamorphic bokeh blur
      for (int i = 0; i < 16; i++) {
        vec2 sampleOffset = getPoissonSample(i);
        // Anamorphic horizontal oval stretch for authentic cinema prime lens look
        sampleOffset.x *= uAnamorphicAspect;
        vec2 offsetUV = sampleOffset * (blurRadius * texelSize);

        // Longitudinal chromatic aberration on out-of-focus highlights
        float r = texture2D(textureSampler, clamp(uv + offsetUV * (1.0 + uChromaticFringe), 0.001, 0.999)).r;
        float g = texture2D(textureSampler, clamp(uv + offsetUV, 0.001, 0.999)).g;
        float b = texture2D(textureSampler, clamp(uv + offsetUV * (1.0 - uChromaticFringe), 0.001, 0.999)).b;
        vec3 col = vec3(r, g, b);

        // High-dynamic-range luminance weighting: bright particles bloom into glowing bokeh discs
        float luma = dot(col, vec3(0.299, 0.587, 0.114));
        float weight = 1.0 + pow(luma, 1.8) * 5.0;

        accumColor += col * weight;
        totalWeight += weight;
      }

      vec3 bokehColor = accumColor / max(totalWeight, 0.0001);
      
      // Smoothly blend in-focus crispness with creamy out-of-focus background bokeh
      vec3 finalColor = mix(baseColor.rgb, bokehColor, smoothstep(0.05, 0.95, coc) * uDofActive);
      
      gl_FragColor = vec4(finalColor, baseColor.a);
    }
  `;

  const dofPP = new BABYLON.PostProcess(
    "cinematicDofPP",
    "cinematicDof",
    [
      "uScreenResolution",
      "uTime",
      "uCinematicMode",
      "uDofActive",
      "uFocusPoint",
      "uFocusRadius",
      "uMaxBlurRadius",
      "uAnamorphicAspect",
      "uChromaticFringe"
    ],
    null,
    1.0,
    camera
  );

  let currentDofAmount = 0.0;
  let lastTime = typeof performance !== "undefined" ? performance.now() : Date.now();

  dofPP.onApply = (effect) => {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const dt = Math.min(0.1, (now - lastTime) * 0.001);
    lastTime = now;

    const ww = engine.getRenderWidth() || (typeof window !== "undefined" ? window.innerWidth : 1920) || 1920;
    const wh = engine.getRenderHeight() || (typeof window !== "undefined" ? window.innerHeight : 1080) || 1080;

    const isCinematic = (isCinematicRef?.current) || (typeof window !== "undefined" && (window as any).__cinematicMode);
    const isDofExplicitlyEnabled = dofEnabledRef ? dofEnabledRef.current : (typeof window !== "undefined" ? (window as any).__dofEnabled !== false : true);
    const targetDof = (isCinematic && isDofExplicitlyEnabled) ? 1.0 : 0.0;

    // Smooth optical focal transition
    const lerpSpeed = targetDof > currentDofAmount ? 3.5 : 4.5;
    currentDofAmount += (targetDof - currentDofAmount) * Math.min(1.0, dt * lerpSpeed);

    effect.setFloat2("uScreenResolution", ww, wh);
    effect.setFloat("uTime", now * 0.001);
    effect.setFloat("uCinematicMode", isCinematic ? 1.0 : 0.0);
    effect.setFloat("uDofActive", currentDofAmount);

    // Track active focal subject in screen coordinates (black hole or active target)
    let focusUvX = 0.5;
    let focusUvY = 0.5;
    let focusRadiusNorm = 0.22;

    const entities = Array.isArray(celestialEntitiesRef?.current) ? celestialEntitiesRef.current : [];
    const activeBh = entities.find((e) => e && e.type === "blackhole" && !e.isDestroyed);
    const targetEntity = activeBh || entities.find((e) => e && !e.isDestroyed);

    if (targetEntity) {
      const cssW = (typeof window !== "undefined" ? window.innerWidth : ww) || ww;
      const cssH = (typeof window !== "undefined" ? window.innerHeight : wh) || wh;
      const scale = targetEntity.scale !== undefined && targetEntity.scale > 0 ? targetEntity.scale : 1.0;
      const wx = targetEntity.worldX !== undefined ? targetEntity.worldX : targetEntity.x - cssW / 2;
      const wy = targetEntity.worldY !== undefined ? targetEntity.worldY : -(targetEntity.y - cssH / 2);
      const wz = targetEntity.worldZ !== undefined ? targetEntity.worldZ : (targetEntity.z || 0);
      const worldVec = new BABYLON.Vector3(wx, wy, wz);
      const globalViewport = camera.viewport.toGlobal(ww, wh);
      const transformMatrix = scene.getTransformMatrix();

      const projCenter = BABYLON.Vector3.Project(
        worldVec,
        BABYLON.Matrix.Identity(),
        transformMatrix,
        globalViewport
      );

      if (projCenter.z >= 0.0 && projCenter.z <= 1.0) {
        focusUvX = projCenter.x / ww;
        focusUvY = 1.0 - projCenter.y / wh;

        const actualRad = targetEntity.radius * scale;
        const edgeVecX = new BABYLON.Vector3(wx + actualRad * 2.8, wy, wz);
        const edgeVecY = new BABYLON.Vector3(wx, wy + actualRad * 2.8, wz);
        const projEdgeX = BABYLON.Vector3.Project(
          edgeVecX,
          BABYLON.Matrix.Identity(),
          transformMatrix,
          globalViewport
        );
        const projEdgeY = BABYLON.Vector3.Project(
          edgeVecY,
          BABYLON.Matrix.Identity(),
          transformMatrix,
          globalViewport
        );
        const screenPx = Math.max(
          Math.hypot(projEdgeX.x - projCenter.x, projEdgeX.y - projCenter.y),
          Math.hypot(projEdgeY.x - projCenter.x, projEdgeY.y - projCenter.y)
        );
        focusRadiusNorm = Math.max(0.12, Math.min(0.48, screenPx / wh));
      }
    }

    effect.setFloat2("uFocusPoint", focusUvX, focusUvY);
    effect.setFloat("uFocusRadius", focusRadiusNorm);
    effect.setFloat("uMaxBlurRadius", 14.0); // 14px maximum bokeh disc radius
    effect.setFloat("uAnamorphicAspect", 1.33); // 1.33x anamorphic horizontal oval squeeze
    effect.setFloat("uChromaticFringe", 0.0035); // Subtle chromatic dispersion on bokeh fringe
  };

  dofPostProcessRef.current = dofPP;
}
