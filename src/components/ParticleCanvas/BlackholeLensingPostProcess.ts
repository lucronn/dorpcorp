import React from "react";
import * as BABYLON from "@babylonjs/core";
import { CelestialEntity } from "./types";
import { parseColorToRgb } from "./TextureUtils";

export function setupBlackholeLensingPostProcess(
  camera: BABYLON.Camera,
  scene: BABYLON.Scene,
  engine: BABYLON.Engine,
  lensingPostProcessRef: React.MutableRefObject<BABYLON.PostProcess | null>,
  celestialEntitiesRef: React.MutableRefObject<CelestialEntity[]>
): void {
  if (lensingPostProcessRef.current) return;

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

    void main(void) {
        vec2 uv = vUV;
        if (uBlackHoleCount < 0.5) {
            gl_FragColor = texture2D(textureSampler, uv);
            return;
        }

        float aspect = uScreenResolution.x / uScreenResolution.y;
        vec2 uv_aspect = vec2(uv.x * aspect, uv.y);

        vec2 total_displacement = vec2(0.0);
        float photon_glow = 0.0;
        vec3 glow_color = vec3(0.0);
        float max_core_void = 0.0;

        for (int i = 0; i < 4; i++) {
            if (float(i) >= uBlackHoleCount) break;
            vec3 bh = uBlackHoles[i];
            vec2 bh_center_aspect = vec2(bh.x * aspect, bh.y);
            vec2 delta = uv_aspect - bh_center_aspect;
            float dist_screen = length(delta);
            // r_norm is impact parameter b normalized to the apparent black hole shadow radius b_crit
            float r_norm = dist_screen / max(bh.z, 0.0001);

            // Achromatic General Relativistic Null-Geodesic Deflection (Einstein Equivalence Principle):
            // Light rays passing at impact parameter b outside the critical curve experience
            // 1PN + 2PN deflection: alpha(b) ~ 2*r_s/b + (15*pi/16)*(r_s/b)^2 (Gralla, Holz & Wald 2019, arXiv:1906.00873)
            if (r_norm < 12.0) {
                vec2 dir = dist_screen > 0.0001 ? normalize(delta) : vec2(0.0, 1.0);
                
                float b_eff = max(r_norm, 0.92);
                float inv_b = 1.0 / b_eff;
                float einstein_deflection = 0.36 * inv_b + 0.22 * inv_b * inv_b;
                float falloff = smoothstep(11.5, 1.02, r_norm);
                float warp = bh.z * einstein_deflection * falloff;
                
                vec2 disp = (dir / vec2(aspect, 1.0)) * warp;
                total_displacement += disp;

                // Relativistic Doppler Beaming & Gravitational Redshift across the Kerr Ring
                // (EHT Collaboration 2019 V, arXiv:1906.11242; James et al. 2015 DNGR, arXiv:1502.03808):
                // Approaching plasma limb (delta.x < 0) has beta_los > 0 -> boosted by delta^(3 - alpha)
                float cos_phi = -delta.x / max(dist_screen, 0.0001);
                float beta_orb = 0.48 * clamp(1.25 / sqrt(max(r_norm, 0.85)), 0.25, 0.62);
                float sin_inc = 0.927; // sin(68 deg) disk inclination
                float gamma_rel = inversesqrt(max(1.0 - beta_orb * beta_orb, 0.1));
                float doppler_delta = 1.0 / (gamma_rel * (1.0 - beta_orb * sin_inc * cos_phi));
                float grav_redshift = sqrt(clamp(1.0 - 0.385 / max(r_norm, 0.55), 0.15, 1.0));
                float beaming_flux = clamp(pow(doppler_delta * grav_redshift, 3.0), 0.14, 2.45);

                // Two-Component Relativistic Ring Profile (Gralla, Holz & Wald 2019, arXiv:1906.00873):
                // 1) n >= 2 Critical-Curve Photon Ring (narrow logarithmic peak at r_norm ~ 1.03)
                // 2) n = 1 Lensing Ring (demagnified rear-disk image centered ~5% outside photon ring at r_norm ~ 1.08-1.35)
                if (r_norm > 0.96 && r_norm < 2.25) {
                    float photon_ring_n2 = exp(-pow((r_norm - 1.03) / 0.045, 2.0)) * 0.68;
                    float lensing_ring_n1 = exp(-pow((r_norm - 1.12) / 0.18, 2.0)) * 0.42;
                    float ring_profile = (photon_ring_n2 + lensing_ring_n1) * beaming_flux;
                    photon_glow += ring_profile * 0.48;

                    // Relativistic frequency shift: blueshifted white-cyan on approaching limb, redshifted amber on receding limb
                    vec3 approaching_tint = mix(uBlackHoleColors[i], vec3(0.92, 0.97, 1.0), 0.65);
                    vec3 receding_tint = uBlackHoleColors[i] * vec3(1.0, 0.52, 0.28);
                    vec3 doppler_color = mix(receding_tint, approaching_tint, clamp(cos_phi * 0.5 + 0.5, 0.0, 1.0));
                    glow_color = mix(glow_color, doppler_color, clamp(ring_profile, 0.0, 1.0));
                }

                // Event Horizon Shadow Depression (EHT ~10:1 central brightness depression inside b_crit)
                if (r_norm < 1.0) {
                    float core = 1.0 - smoothstep(0.84, 1.0, r_norm);
                    max_core_void = max(max_core_void, clamp(core, 0.0, 0.98));
                }
            }
        }

        // Apply strictly achromatic General Relativistic ray deflection (no prism RGB splitting in vacuum)
        vec2 warped_uv = clamp(uv - total_displacement, 0.001, 0.999);
        vec3 final_color = texture2D(textureSampler, warped_uv).rgb;

        // Add Doppler-beamed photon ring (n>=2) + lensing ring (n=1) luminescence
        if (photon_glow > 0.01) {
            vec3 lum = mix(vec3(1.0, 0.96, 0.88), glow_color, 0.58) * photon_glow;
            final_color += lum;
        }

        // Ergospheric Blandford-Znajek Magnetospheric Corona & Polarized Synchrotron Halo
        // (EHT Collaboration 2019 V, arXiv:1906.11242; 2021 VIII, arXiv:2105.01173):
        // Replaces theatrical optical "Hawking radiation" (which is T_H ~ 2.9 nK << T_CMB for stellar/SMBH)
        // with relativistic synchrotron emission from poloidal/azimuthal magnetic field lines in a MAD corona.
        for (int i = 0; i < 4; i++) {
            if (float(i) >= uBlackHoleCount) break;
            vec3 bh = uBlackHoles[i];
            vec2 bh_center_aspect = vec2(bh.x * aspect, bh.y);
            vec2 delta = uv_aspect - bh_center_aspect;
            float dist_screen = length(delta);
            float r_norm = dist_screen / max(bh.z, 0.0001);
            if (r_norm >= 0.96 && r_norm < 1.85) {
                float corona_env = smoothstep(0.96, 1.10, r_norm) * smoothstep(1.85, 1.12, r_norm);
                float angle = atan(delta.y, delta.x);
                // Azimuthal-poloidal spiral pitch pattern of organized near-horizon magnetic fields (EHT VIII)
                float spiral_phase = angle * 6.0 + log(max(r_norm, 0.95)) * 14.0 - uTime * 3.2;
                float b_field_filament = 0.72 + 0.28 * cos(spiral_phase);
                // Relativistic Doppler boost on approaching limb (delta.x < 0)
                float cos_phi = -delta.x / max(dist_screen, 0.0001);
                float doppler_boost = clamp(1.0 + 0.55 * cos_phi, 0.35, 1.65);
                float corona_intensity = (0.16 + uHawkingIntensity * 0.55 + uCinematicMode * 0.32) * corona_env * b_field_filament * doppler_boost;
                vec3 synch_color = mix(uBlackHoleColors[i], vec3(1.0, 0.88, 0.68), clamp(0.45 + 0.35 * cos_phi, 0.0, 1.0));
                final_color += synch_color * corona_intensity;
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

        gl_FragColor = vec4(final_color, 1.0);
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
      "uHawkingIntensity"
    ],
    null,
    1.0,
    camera
  );

  lensingPP.onApply = (effect) => {
    const ww = engine.getRenderWidth() || window.innerWidth;
    const wh = engine.getRenderHeight() || window.innerHeight;
    effect.setFloat2("uScreenResolution", ww, wh);
    effect.setFloat("uTime", performance.now() * 0.001);
    effect.setFloat("uCinematicMode", (window as any).__cinematicMode ? 1.0 : 0.0);
    effect.setFloat("uAnamorphicFlare", (window as any).__anamorphicFlare !== false ? 1.0 : 0.0);
    const baseHawking = (window as any).__hawkingIntensity || 0.0;
    const sceneTension = (window as any).__sceneTension || 0.0;
    const climaxPulse = (window as any).__climaxPulse || 0.0;
    effect.setFloat(
      "uHawkingIntensity",
      Math.min(1.8, baseHawking + sceneTension * 0.32 + climaxPulse * 0.65)
    );

    const bhData: number[] = [];
    const bhColors: number[] = [];
    let count = 0;

    const activeBhs = celestialEntitiesRef.current
      .filter((e) => e.type === "blackhole" && !e.isDestroyed)
      .sort((a, b) => (a.isOutgoing ? 1 : 0) - (b.isOutgoing ? 1 : 0));

    const cssW = window.innerWidth || ww;
    const cssH = window.innerHeight || wh;
    const globalViewport = camera.viewport.toGlobal(ww, wh);
    const transformMatrix = scene.getTransformMatrix();

    activeBhs.forEach((bh) => {
      if (count >= 4) return;
      const scale = bh.scale !== undefined ? bh.scale : 1.0;
      if (scale <= 0.015) return;

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
      const smoothScaleFade = Math.min(1.0, Math.max(0.0, (scale - 0.015) / 0.25));
      // Safe clamp: black hole lensing core cannot consume more than 22% of viewport height
      const normRadius = Math.min(0.22, Math.max(0.001, (screenPixelRadius / wh) * smoothScaleFade));

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
