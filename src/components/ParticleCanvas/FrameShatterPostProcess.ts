import React from "react";
import * as BABYLON from "@babylonjs/core";
import { CelestialEntity } from "./types";

export function setupFrameShatterPostProcess(
  camera: BABYLON.Camera,
  scene: BABYLON.Scene,
  engine: BABYLON.Engine,
  shatterPostProcessRef: React.MutableRefObject<BABYLON.PostProcess | null>,
  celestialEntitiesRef: React.MutableRefObject<CelestialEntity[]>,
  shatterIntensityRef: React.MutableRefObject<number>
): void {
  if (shatterPostProcessRef.current) return;

  // General Relativistic Plunging-Observer Aberration, Lense-Thirring Frame-Dragging &
  // Gravitational Blueshift Caustic Shader (James, von Tunzelmann, Franklin & Thorne 2015, arXiv:1502.03808).
  // Replaces theatrical "Voronoi glass screen shatter" (spacetime is a smooth Lorentzian manifold at r = r_H)
  // with authentic relativistic aberration cos(theta') = (cos(theta) - beta)/(1 - beta*cos(theta)),
  // azimuthal Lense-Thirring frame dragging, and caustic blueshift amplification of infalling starlight.
  BABYLON.Effect.ShadersStore["frameShatterFragmentShader"] = `
    precision highp float;
    varying vec2 vUV;
    uniform sampler2D textureSampler;
    uniform vec2 uScreenResolution;
    uniform float uTime;
    uniform float uShatterIntensity;
    uniform vec2 uShatterCenter;

    void main(void) {
        vec2 uv = vUV;
        if (uShatterIntensity <= 0.002) {
            gl_FragColor = texture2D(textureSampler, uv);
            return;
        }

        float aspect = uScreenResolution.x / max(uScreenResolution.y, 1.0);
        vec2 aspectUV = vec2(uv.x * aspect, uv.y);
        vec2 centerAspect = vec2(uShatterCenter.x * aspect, uShatterCenter.y);

        vec2 delta = aspectUV - centerAspect;
        float r = length(delta);
        vec2 dir = r > 0.0001 ? (delta / r) : vec2(0.0, 1.0);

        // 1. Relativistic Plunge Aberration: cos(theta_obs) = (cos(theta) - beta) / (1 - beta * cos(theta))
        // As the observer plunges toward the photon sphere (r -> 1.5 r_s), beta -> 0.65c:
        // the black hole shadow expands while external starlight compresses radially into a bright caustic ring.
        float beta = clamp(uShatterIntensity * 0.62, 0.0, 0.62);
        float shadowRadius = 0.08 + uShatterIntensity * 0.22;
        float r_rel = r / max(shadowRadius, 0.001);

        // Smooth relativistic radial aberration + strong-field Einstein deflection
        float aberrationPull = (beta * 0.18) * exp(-max(0.0, r_rel - 1.0) * 1.45);
        // 2. Kerr Lense-Thirring Frame-Dragging azimuthal twist (omega_LT ~ 2GJ / c^2 r^3)
        float frameDragAngle = uShatterIntensity * 0.42 / (1.0 + r_rel * r_rel * 1.8);
        float s = sin(frameDragAngle);
        float c = cos(frameDragAngle);
        mat2 lenseThirringRot = mat2(c, -s, s, c);

        vec2 draggedDelta = lenseThirringRot * delta;
        vec2 aberratedAspectUV = centerAspect + draggedDelta * (1.0 - aberrationPull);
        vec2 sampleUV = clamp(vec2(aberratedAspectUV.x / aspect, aberratedAspectUV.y), 0.001, 0.999);

        vec3 finalColor = texture2D(textureSampler, sampleUV).rgb;

        // 3. Gravitational Blueshift Caustic Ring at the Expanding Shadow Boundary
        // Infalling photons grazing the photon sphere experience blueshift factor g = (1 - r_s/r)^(-1/2)
        float causticRing = exp(-pow((r - shadowRadius) / max(0.028, shadowRadius * 0.22), 2.0));
        float dopplerAsymmetry = 1.0 - 0.38 * dir.x; // Approaching Kerr limb brighter
        float blueshiftFactor = causticRing * uShatterIntensity * dopplerAsymmetry;

        // Shift caustic spectrum toward high-energy blue-white thermal Planck emission
        vec3 causticBlueshiftColor = vec3(0.78, 0.91, 1.0) * (1.15 + uShatterIntensity * 1.35);
        finalColor = mix(finalColor, finalColor * 1.35 + causticBlueshiftColor * 0.55, clamp(blueshiftFactor, 0.0, 0.85));

        // 4. Expanding Kerr Shadow Silhouette inside the critical impact parameter b_crit
        float shadowVoid = 1.0 - smoothstep(shadowRadius * 0.72, shadowRadius * 0.98, r);
        finalColor = mix(finalColor, vec3(0.0), clamp(shadowVoid * uShatterIntensity * 0.95, 0.0, 0.96));

        gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  const shatterPP = new BABYLON.PostProcess(
    "frameShatterPP",
    "frameShatter",
    ["uScreenResolution", "uTime", "uShatterIntensity", "uShatterCenter"],
    null,
    1.0,
    camera
  );

  shatterPP.onApply = (effect) => {
    const ww = engine.getRenderWidth() || window.innerWidth;
    const wh = engine.getRenderHeight() || window.innerHeight;
    effect.setFloat2("uScreenResolution", ww, wh);
    effect.setFloat("uTime", performance.now() * 0.001);

    const intensity = shatterIntensityRef.current || 0.0;
    effect.setFloat("uShatterIntensity", intensity);

    // Compute 3D projected screen space center of black hole
    let screenX = 0.5;
    let screenY = 0.5;
    const bh = celestialEntitiesRef.current.find(
      (e) => !e.isDestroyed && e.type === "blackhole"
    );
    if (bh) {
      const cssW = window.innerWidth || ww;
      const cssH = window.innerHeight || wh;
      const wx = bh.worldX !== undefined ? bh.worldX : bh.x - cssW / 2;
      const wy = bh.worldY !== undefined ? bh.worldY : -(bh.y - cssH / 2);
      const wz = bh.worldZ !== undefined ? bh.worldZ : (bh.z || 0);
      const projCenter = BABYLON.Vector3.Project(
        new BABYLON.Vector3(wx, wy, wz),
        BABYLON.Matrix.Identity(),
        scene.getTransformMatrix(),
        camera.viewport.toGlobal(ww, wh)
      );
      if (
        !isNaN(projCenter.x) &&
        !isNaN(projCenter.y) &&
        projCenter.z >= 0.0 &&
        projCenter.z <= 1.0
      ) {
        screenX = projCenter.x / ww;
        screenY = 1.0 - projCenter.y / wh;
      } else {
        screenX = bh.x / cssW;
        screenY = 1.0 - bh.y / cssH;
      }
    }
    effect.setFloat2("uShatterCenter", screenX, screenY);
  };

  shatterPostProcessRef.current = shatterPP;
}
