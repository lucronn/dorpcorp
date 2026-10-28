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
  if (!camera || !scene || scene.isDisposed || !engine || shatterPostProcessRef.current) return;

  BABYLON.Effect.ShadersStore["frameShatterFragmentShader"] = `
    precision highp float;
    varying vec2 vUV;
    uniform sampler2D textureSampler;
    uniform vec2 uScreenResolution;
    uniform float uTime;
    uniform float uShatterIntensity;
    uniform vec2 uShatterCenter;

    vec2 hash2(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return fract(sin(p) * 43758.5453);
    }

    void main(void) {
        vec2 uv = vUV;
        if (uShatterIntensity <= 0.002) {
            gl_FragColor = texture2D(textureSampler, uv);
            return;
        }

        float aspect = uScreenResolution.x / max(uScreenResolution.y, 1.0);
        vec2 aspectUV = vec2(uv.x * aspect, uv.y);
        vec2 centerAspect = vec2(uShatterCenter.x * aspect, uShatterCenter.y);

        // 13x13 Voronoi crystalline fracture grid
        float gridSize = 13.0;
        vec2 gridUV = aspectUV * gridSize;
        vec2 i_st = floor(gridUV);
        vec2 f_st = fract(gridUV);

        float minDist = 999.0;
        float secondMinDist = 999.0;
        vec2 bestCell = vec2(0.0);
        vec2 bestPoint = vec2(0.0);

        for (int y = -1; y <= 1; y++) {
            for (int x = -1; x <= 1; x++) {
                vec2 neighbor = vec2(float(x), float(y));
                vec2 point = hash2(i_st + neighbor);
                vec2 diff = neighbor + point - f_st;
                float d = length(diff);
                if (d < minDist) {
                    secondMinDist = minDist;
                    minDist = d;
                    bestCell = i_st + neighbor;
                    bestPoint = point;
                } else if (d < secondMinDist) {
                    secondMinDist = d;
                }
            }
        }

        // Cell random seeds
        vec2 cellRand = hash2(bestCell);
        vec2 cellCenterAspect = (bestCell + bestPoint) / gridSize;
        vec2 fromCenter = cellCenterAspect - centerAspect;
        float distToSingularity = length(fromCenter);
        vec2 burstDir = distToSingularity > 0.001 ? normalize(fromCenter) : vec2(0.0, 1.0);

        // Radial explosive displacement + angular rotation
        float intensitySq = pow(uShatterIntensity, 1.5);
        float shardMove = intensitySq * (0.035 + 0.08 * cellRand.x);
        
        // Angular spin of shattered shard
        float rotAngle = (cellRand.y - 0.5) * 0.6 * uShatterIntensity;
        mat2 rotMat = mat2(cos(rotAngle), -sin(rotAngle), sin(rotAngle), cos(rotAngle));

        // Shift coordinates of shard
        vec2 shardShift = (rotMat * (burstDir * shardMove)) / vec2(aspect, 1.0);
        vec2 displacedUV = uv - shardShift;

        // Boundary distance (crystal edge detection)
        float edgeDist = secondMinDist - minDist;
        float edgeFactor = smoothstep(0.0, 0.09, edgeDist);
        float crackGlow = (1.0 - edgeFactor) * smoothstep(0.05, 0.35, uShatterIntensity);

        // Prismatic chromatic aberration through shattered facet
        float chromaticShift = (0.008 + 0.024 * uShatterIntensity) * (1.0 - edgeFactor * 0.5);
        vec2 rUV = clamp(displacedUV + burstDir * chromaticShift, 0.001, 0.999);
        vec2 gUV = clamp(displacedUV, 0.001, 0.999);
        vec2 bUV = clamp(displacedUV - burstDir * chromaticShift, 0.001, 0.999);

        float r = texture2D(textureSampler, rUV).r;
        float g = texture2D(textureSampler, gUV).g;
        float b = texture2D(textureSampler, bUV).b;
        vec3 finalColor = vec3(r, g, b);

        // Glowing fracture cracks: incandescent Cherenkov cyan & violet
        if (crackGlow > 0.01) {
            vec3 crackColor = mix(vec3(0.4, 0.9, 1.0), vec3(0.9, 0.45, 1.0), cellRand.x);
            finalColor += crackColor * crackGlow * (2.0 + uShatterIntensity * 3.5);
        }

        // Impact flash near full shatter
        if (uShatterIntensity > 0.82) {
            float flash = (uShatterIntensity - 0.82) / 0.18;
            finalColor = mix(finalColor, vec3(1.0, 0.98, 0.95), flash * 0.85);
        }

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
    const ww = engine.getRenderWidth() || (typeof window !== "undefined" ? window.innerWidth : 1920) || 1920;
    const wh = engine.getRenderHeight() || (typeof window !== "undefined" ? window.innerHeight : 1080) || 1080;
    effect.setFloat2("uScreenResolution", ww, wh);
    effect.setFloat("uTime", (typeof performance !== "undefined" ? performance.now() : Date.now()) * 0.001);

    const intensity =
      shatterIntensityRef && typeof shatterIntensityRef.current === "number" && isFinite(shatterIntensityRef.current)
        ? shatterIntensityRef.current
        : 0.0;
    effect.setFloat("uShatterIntensity", intensity);

    // Compute 3D projected screen space center of black hole
    let screenX = 0.5;
    let screenY = 0.5;
    const entities = Array.isArray(celestialEntitiesRef?.current) ? celestialEntitiesRef.current : [];
    const bh = entities.find(
      (e) => e && !e.isDestroyed && e.type === "blackhole"
    );
    if (bh) {
      const cssW = (typeof window !== "undefined" ? window.innerWidth : ww) || ww;
      const cssH = (typeof window !== "undefined" ? window.innerHeight : wh) || wh;
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
