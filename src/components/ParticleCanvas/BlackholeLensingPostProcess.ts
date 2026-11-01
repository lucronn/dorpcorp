import React from "react";
import * as BABYLON from "@babylonjs/core";
import { CelestialEntity } from "./types";
import { parseColorToRgb } from "./TextureUtils";
import { cinematicFx } from "./cinematic/CinematicFxBus";

export function setupBlackholeLensingPostProcess(
  camera: BABYLON.Camera,
  scene: BABYLON.Scene,
  engine: BABYLON.Engine,
  lensingPostProcessRef: React.MutableRefObject<BABYLON.PostProcess | null>,
  celestialEntitiesRef: React.MutableRefObject<CelestialEntity[]>
): void {
  if (!camera || !scene || scene.isDisposed || !engine || lensingPostProcessRef.current) return;

  BABYLON.Effect.ShadersStore["blackholeLensingFragmentShader"] = `
    precision highp float;
    varying vec2 vUV;
    uniform sampler2D textureSampler;
    uniform vec2 uScreenResolution;
    uniform vec3 uBlackHoles[4];
    uniform vec3 uBlackHoleColors[4];
    uniform float uBlackHoleCount;
    uniform float uTime;
    uniform float uCinematicMode;
    uniform float uAnamorphicFlare;
    uniform float uHawkingIntensity;
    // Cinematic capture layer (all achromatic except the physically-motivated redshift)
    uniform float uCapture;
    uniform vec2 uCaptureCenter;
    uniform float uRedshift;
    uniform float uBlackout;
    uniform float uLensPulse;

    vec2 captureWarp(vec2 uv) {
        if (uCapture < 0.001) return uv;
        float aspect = uScreenResolution.x / uScreenResolution.y;
        vec2 d = (uv - uCaptureCenter) * vec2(aspect, 1.0);
        float r = length(d);
        // Frame-dragging swirl, strongest near the hole, grows with capture.
        float swirl = uCapture * uCapture * 2.4 * exp(-r / 0.32);
        float cs = cos(swirl);
        float sn = sin(swirl);
        d = vec2(d.x * cs - d.y * sn, d.x * sn + d.y * cs);
        // Radial spaghettification of the view: the centre is stretched outward.
        float stretch = 1.0 - uCapture * 0.42 * exp(-r / 0.55);
        d *= stretch;
        return uCaptureCenter + d / vec2(aspect, 1.0);
    }

    vec3 cinematicGrade(vec3 c, vec2 uv) {
        if (uRedshift > 0.001) {
            float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
            vec3 warm = vec3(l) * vec3(1.0, 0.6, 0.4);
            c = mix(c, warm, uRedshift * 0.8) * (1.0 - uRedshift * 0.4);
        }
        if (uBlackout > 0.001) {
            float aspect = uScreenResolution.x / uScreenResolution.y;
            float r = length((uv - uCaptureCenter) * vec2(aspect, 1.0));
            float aperture = mix(1.9, -0.05, uBlackout);
            float iris = 1.0 - smoothstep(aperture - 0.45, aperture + 0.05, r);
            c *= iris * (1.0 - uBlackout * 0.35);
            c *= 1.0 - smoothstep(0.82, 1.0, uBlackout);
        }
        return c;
    }

    void main(void) {
        vec2 uv = captureWarp(vUV);
        if (uBlackHoleCount < 0.5) {
            gl_FragColor = vec4(cinematicGrade(texture2D(textureSampler, uv).rgb, vUV), 1.0);
            return;
        }

        float aspect = uScreenResolution.x / uScreenResolution.y;
        vec2 uv_aspect = vec2(uv.x * aspect, uv.y);

        vec2 total_displacement = vec2(0.0);
        float total_chromatic = 0.0;
        float photon_glow = 0.0;
        vec3 glow_color = vec3(0.0);
        float max_core_void = 0.0;

        for (int i = 0; i < 4; i++) {
            if (float(i) >= uBlackHoleCount) break;
            vec3 bh = uBlackHoles[i];
            vec2 bh_center_aspect = vec2(bh.x * aspect, bh.y);
            vec2 delta = uv_aspect - bh_center_aspect;
            float dist_screen = length(delta);
            float r_norm = dist_screen / max(bh.z, 0.0001); // Distance relative to black hole radius

            // General relativistic deflection profile (Einstein ring warp)
            if (r_norm < 12.0) {
                vec2 dir = dist_screen > 0.0001 ? normalize(delta) : vec2(0.0, 1.0);
                
                // Deflection bending curve: light rays passing close to the mass are deflected inward,
                // causing the background to appear displaced radially outward / warped into Einstein rings.
                float warp_scale = bh.z * 0.38 * (1.0 + uCapture * 1.4 + uLensPulse * 0.9);
                float falloff = smoothstep(10.0, 1.05, r_norm);
                float warp = (warp_scale / max(r_norm * 0.85 + 0.18, 0.2)) * falloff;
                
                vec2 disp = (dir / vec2(aspect, 1.0)) * warp;
                total_displacement += disp;

                // Gravitational chromatic dispersion near the photon sphere
                float chrom = smoothstep(3.5, 1.05, r_norm) * 0.016;
                total_chromatic = max(total_chromatic, chrom);

                // Relativistic photon ring amplification at 1.05 < r < 2.2
                if (r_norm > 1.0 && r_norm < 2.2) {
                    float ring = smoothstep(2.2, 1.35, r_norm) * smoothstep(1.0, 1.35, r_norm);
                    photon_glow += ring * 0.45;
                    glow_color = mix(glow_color, uBlackHoleColors[i], ring);
                }

                // Smooth absolute void mask inside true Schwarzschild radius
                if (r_norm < 1.0) {
                    float core = 1.0 - smoothstep(0.85, 1.0, r_norm);
                    max_core_void = max(max_core_void, clamp(core, 0.0, 0.98));
                }
            }
        }

        // Apply distorted coordinates with gravitational chromatic fringe
        vec2 warped_uv = clamp(uv - total_displacement, 0.001, 0.999);
        vec3 final_color;

        // The capture amplifies the warp; keep it achromatic so the stronger
        // lensing never turns into a rainbow fringe.
        total_chromatic *= 1.0 - clamp(uCapture + uLensPulse * 0.5, 0.0, 1.0);
        if (total_chromatic > 0.0001) {
            vec2 offset_r = total_displacement * total_chromatic * 45.0;
            vec2 offset_b = -total_displacement * total_chromatic * 45.0;
            float r = texture2D(textureSampler, clamp(warped_uv + offset_r, 0.001, 0.999)).r;
            float g = texture2D(textureSampler, warped_uv).g;
            float b = texture2D(textureSampler, clamp(warped_uv + offset_b, 0.001, 0.999)).b;
            final_color = vec3(r, g, b);
        } else {
            final_color = texture2D(textureSampler, warped_uv).rgb;
        }

        // Add photon ring luminescence
        if (photon_glow > 0.01) {
            vec3 lum = mix(vec3(1.0, 0.96, 0.88), glow_color, 0.4) * photon_glow;
            final_color += lum;
        }

        // Subtle shimmering quantum Hawking Radiation halo emanating from horizon
        for (int i = 0; i < 4; i++) {
            if (float(i) >= uBlackHoleCount) break;
            vec3 bh = uBlackHoles[i];
            vec2 bh_center_aspect = vec2(bh.x * aspect, bh.y);
            vec2 delta = uv_aspect - bh_center_aspect;
            float dist_screen = length(delta);
            float r_norm = dist_screen / max(bh.z, 0.0001);
            if (r_norm >= 0.96 && r_norm < 1.75) {
                float h_dist = smoothstep(0.96, 1.12, r_norm) * smoothstep(1.75, 1.12, r_norm);
                float angle = atan(delta.y, delta.x);
                float h_shimmer = 0.75 + 0.25 * sin(uTime * 9.0 + angle * 14.0 + r_norm * 18.0);
                float h_intensity = (0.2 + uHawkingIntensity * 0.75 + uCinematicMode * 0.45) * h_dist * h_shimmer;
                vec3 h_color = mix(vec3(0.42, 0.92, 1.0), vec3(0.78, 0.48, 1.0), sin(uTime * 4.0 + angle * 4.0) * 0.5 + 0.5);
                final_color += h_color * h_intensity * (1.0 - uCapture);
            }

            // CinemaScope 2x Anamorphic Horizontal Lens Flare Streaks across the Photon Sphere
            if (uAnamorphicFlare > 0.5 && r_norm > 0.82 && abs(delta.y) < bh.z * 0.65) {
                float coreMask = smoothstep(0.82, 1.08, r_norm);
                float vertSoft = exp(-abs(delta.y) / max(bh.z * 0.12, 0.002));
                float horizSoft = exp(-abs(delta.x) / max(bh.z * 4.8, 0.07));
                float vertNeedle = exp(-abs(delta.y) / max(bh.z * 0.032, 0.0008));
                float horizNeedle = exp(-abs(delta.x) / max(bh.z * 7.8, 0.11));

                float flareShimmer = 0.88 + 0.12 * sin(uTime * 3.2 + delta.x * 24.0);
                float flareBoost = 0.22 + uCinematicMode * 0.28;
                float streak = (vertSoft * horizSoft * 0.55 + vertNeedle * horizNeedle * 0.85) * coreMask * flareShimmer * flareBoost;

                vec3 panavisionBlue = vec3(0.32, 0.78, 1.0);
                vec3 flareTint = mix(panavisionBlue, uBlackHoleColors[i], 0.35);
                final_color += flareTint * streak;
            }
        }

        // Ensure central singularity is deep velvety black without fully muting the scene
        if (max_core_void > 0.01) {
            final_color = mix(final_color, vec3(0.0), clamp(max_core_void, 0.0, 0.98));
        }

        gl_FragColor = vec4(cinematicGrade(final_color, vUV), 1.0);
    }
  `;

  const lensingPP = new BABYLON.PostProcess(
    "blackholeLensingPP",
    "blackholeLensing",
    [
      "uScreenResolution",
      "uBlackHoles",
      "uBlackHoleColors",
      "uBlackHoleCount",
      "uTime",
      "uCinematicMode",
      "uAnamorphicFlare",
      "uHawkingIntensity",
      "uCapture",
      "uCaptureCenter",
      "uRedshift",
      "uBlackout",
      "uLensPulse"
    ],
    null,
    1.0,
    camera
  );

  lensingPP.onApply = (effect) => {
    const ww = engine.getRenderWidth() || (typeof window !== "undefined" ? window.innerWidth : 1920) || 1920;
    const wh = engine.getRenderHeight() || (typeof window !== "undefined" ? window.innerHeight : 1080) || 1080;
    effect.setFloat2("uScreenResolution", ww, wh);
    effect.setFloat("uTime", (typeof performance !== "undefined" ? performance.now() : Date.now()) * 0.001);
    effect.setFloat("uCinematicMode", typeof window !== "undefined" && (window as any).__cinematicMode ? 1.0 : 0.0);
    effect.setFloat("uAnamorphicFlare", typeof window !== "undefined" && (window as any).__anamorphicFlare !== false ? 1.0 : 0.0);
    effect.setFloat("uHawkingIntensity", typeof window !== "undefined" && (window as any).__hawkingIntensity ? (window as any).__hawkingIntensity : 0.0);

    const fx = cinematicFx;
    const finite01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);
    effect.setFloat("uCapture", finite01(fx.capture));
    effect.setFloat2(
      "uCaptureCenter",
      Number.isFinite(fx.captureUvX) ? fx.captureUvX : 0.5,
      Number.isFinite(fx.captureUvY) ? fx.captureUvY : 0.5
    );
    effect.setFloat("uRedshift", finite01(fx.redshift));
    effect.setFloat("uBlackout", finite01(fx.blackout));
    effect.setFloat("uLensPulse", finite01(fx.lensPulse + fx.transitionLens));

    const bhData: number[] = [];
    const bhColors: number[] = [];
    let count = 0;

    const entities = Array.isArray(celestialEntitiesRef?.current) ? celestialEntitiesRef.current : [];
    const activeBhs = entities.filter(
      (e) => e && e.type === "blackhole" && !e.isDestroyed
    );

    const cssW = (typeof window !== "undefined" ? window.innerWidth : ww) || ww;
    const cssH = (typeof window !== "undefined" ? window.innerHeight : wh) || wh;
    const globalViewport = camera.viewport.toGlobal(ww, wh);
    const transformMatrix = scene.getTransformMatrix();

    activeBhs.forEach((bh) => {
      if (count >= 4) return;
      const scale = bh.scale !== undefined && bh.scale > 0 ? bh.scale : 1.0;
      if (scale <= 0.01) return;

      const wx = bh.worldX !== undefined ? bh.worldX : bh.x - cssW / 2;
      const wy = bh.worldY !== undefined ? bh.worldY : -(bh.y - cssH / 2);
      const wz = bh.worldZ !== undefined ? bh.worldZ : (bh.z || 0);
      const worldVec = new BABYLON.Vector3(wx, wy, wz);

      const projCenter = BABYLON.Vector3.Project(
        worldVec,
        BABYLON.Matrix.Identity(),
        transformMatrix,
        globalViewport
      );

      if (isNaN(projCenter.x) || isNaN(projCenter.y) || isNaN(projCenter.z)) return;
      if (projCenter.z < 0.0 || projCenter.z > 1.0) return;

      const uvX = projCenter.x / ww;
      const uvY = 1.0 - projCenter.y / wh;
      if (isNaN(uvX) || isNaN(uvY)) return;

      const actualRadius = bh.radius * scale;
      const edgeVecX = new BABYLON.Vector3(wx + actualRadius, wy, wz);
      const edgeVecY = new BABYLON.Vector3(wx, wy + actualRadius, wz);
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

      const rawDistX = Math.hypot(projEdgeX.x - projCenter.x, projEdgeX.y - projCenter.y);
      const rawDistY = Math.hypot(projEdgeY.x - projCenter.x, projEdgeY.y - projCenter.y);
      const rawDist = Math.max(isNaN(rawDistX) ? 1.0 : rawDistX, isNaN(rawDistY) ? 1.0 : rawDistY);
      const screenPixelRadius = Math.max(1.0, rawDist);
      // Safe clamp: black hole lensing core cannot consume more than 22% of viewport height
      // (relaxed while the camera is being captured so the horizon can fill the frame)
      const radiusCap = 0.22 + finite01(fx.capture) * 0.33;
      const normRadius = Math.min(radiusCap, Math.max(0.012, screenPixelRadius / wh));
      if (count === 0 && fx.capture > 0.001) {
        fx.captureUvX = uvX;
        fx.captureUvY = uvY;
      }

      bhData.push(uvX, uvY, normRadius);

      const rgb = parseColorToRgb(bh.color || "#ffffff");
      bhColors.push(rgb.r / 255.0, rgb.g / 255.0, rgb.b / 255.0);

      count++;
    });

    effect.setFloat("uBlackHoleCount", count);
    while (bhData.length < 12) {
      bhData.push(0, 0, 0);
    }
    while (bhColors.length < 12) {
      bhColors.push(0, 0, 0);
    }
    effect.setArray3("uBlackHoles", bhData);
    effect.setArray3("uBlackHoleColors", bhColors);
  };

  lensingPostProcessRef.current = lensingPP;
}
