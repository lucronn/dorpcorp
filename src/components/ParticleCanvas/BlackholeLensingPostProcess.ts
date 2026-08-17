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
    uniform int uBlackHoleCount;
    uniform float uTime;

    mat3 rotateX(float a) {
        float s = sin(a); float c = cos(a);
        return mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c);
    }
    mat3 rotateZ(float a) {
        float s = sin(a); float c = cos(a);
        return mat3(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0);
    }

    void main(void) {
        vec2 uv = vUV;
        float aspect = uScreenResolution.x / uScreenResolution.y;
        
        vec3 final_color = texture2D(textureSampler, uv).rgb;
        
        int best_bh = -1;
        float min_dist = 9999.0;
        vec2 best_delta = vec2(0.0);
        
        for (int i = 0; i < 4; i++) {
            if (i >= uBlackHoleCount) break;
            vec3 bh = uBlackHoles[i];
            vec2 delta = (uv - bh.xy);
            delta.x *= aspect;
            float dist = length(delta) / max(bh.z, 0.0001);
            if (dist < min_dist) {
                min_dist = dist;
                best_bh = i;
                best_delta = delta;
            }
        }

        // If pixel is within range of a black hole, perform null-geodesic raytracing
        if (best_bh != -1 && min_dist < 18.0) {
            vec3 bh = uBlackHoles[best_bh];
            vec3 bh_color = uBlackHoleColors[best_bh];
            
            // Schwarzschild Metric Gravitational Lensing Parameters:
            // Schwarzschild Radius: r_s = 1.0 (normalized)
            // Photon Sphere: r_ph = 1.5 * r_s
            // Critical Impact Parameter / Event Horizon Shadow Radius:
            // b_crit = (3 * sqrt(3) / 2) * r_s = 2.598076 * r_s
            float rs = 1.0;
            float b_crit = 2.598076;

            // 1. ABSOLUTE OPAQUE SCHWARZSCHILD EVENT HORIZON SHADOW CORE
            // Sightlines with impact parameter b <= b_crit cross the event horizon.
            // Light is 100% absorbed with zero reflection or transmission (pure pitch-black).
            if (min_dist <= b_crit) {
                gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                return;
            }

            // Ray origin and direction in local Schwarzschild space
            // Camera is placed at z = -8
            vec3 pos = vec3(best_delta.x / bh.z, best_delta.y / bh.z, -8.0);
            vec3 vel = vec3(0.0, 0.0, 1.0);
            
            vec3 h = cross(pos, vel);
            float h2 = dot(h, h);
            
            vec3 prev_pos = pos;
            
            float disk_inner = b_crit; // Accretion disk starts outside critical shadow boundary
            float disk_outer = 10.0 * rs;
            
            // Inclination 75 degrees, slow rotation
            mat3 disk_rot = rotateX(1.3) * rotateZ(uTime * 0.2); 
            
            float disk_alpha = 0.0;
            vec3 disk_color_accum = vec3(0.0);
            bool in_horizon = false;
            
            float closest_r = 9999.0;
            
            for (int step = 0; step < 85; step++) {
                float r2 = dot(pos, pos);
                float r = sqrt(r2);
                closest_r = min(closest_r, r);
                
                if (r < b_crit) {
                    in_horizon = true;
                    break;
                }
                if (r > 20.0 && pos.z > 0.0) {
                    break; // Escaped gravitational pull
                }
                
                float dt = min(0.18, r * 0.1); // Adaptive step size
                
                // Schwarzschild geodesic equation for light deflection:
                // d^2 u / dphi^2 + u = 1.5 * r_s * u^2
                vec3 accel = -1.5 * rs * h2 * pos / (r2 * r2 * r);
                vel = normalize(vel + accel * dt);
                
                prev_pos = pos;
                pos += vel * dt;
                
                // Accretion disk intersection (z=0 plane in disk space)
                vec3 d_pos = disk_rot * pos;
                vec3 d_prev = disk_rot * prev_pos;
                if (d_pos.y * d_prev.y < 0.0) {
                    float t = d_prev.y / (d_prev.y - d_pos.y);
                    vec3 hit = mix(d_prev, d_pos, t);
                    float hit_r = length(hit.xz);
                    
                    if (hit_r > disk_inner && hit_r < disk_outer) {
                        float v_mag = sqrt(rs / (2.0 * hit_r));
                        vec3 v_dir = normalize(vec3(-hit.z, 0.0, hit.x));
                        vec3 v_disk = v_dir * v_mag;
                        
                        vec3 v_ray = disk_rot * vel;
                        float gamma = 1.0 / sqrt(1.0 - v_mag * v_mag);
                        float D = 1.0 / (gamma * (1.0 - dot(v_disk, -v_ray)));
                        
                        float intensity = pow(D, 3.5); // Relativistic Doppler beaming
                        
                        float temp = 1.0 - smoothstep(disk_inner, disk_outer, hit_r);
                        temp = pow(temp, 1.2);
                        
                        float angle = atan(hit.z, hit.x);
                        float noise = sin(hit_r * 6.0 - uTime * 3.0) * sin(angle * 8.0 + uTime * 5.0);
                        noise = noise * 0.5 + 0.5;
                        
                        vec3 col_hot = vec3(1.0, 1.0, 1.0);
                        vec3 col_cold = bh_color;
                        vec3 base_col = mix(col_cold, col_hot, temp);
                        
                        base_col *= (0.5 + 0.5 * noise);
                        vec3 c = base_col * intensity * temp * 2.5;
                        
                        float a = temp * 0.95;
                        
                        disk_color_accum += c * a * (1.0 - disk_alpha);
                        disk_alpha += a * (1.0 - disk_alpha);
                    }
                }
            }
            
            if (in_horizon) {
                final_color = vec3(0.0); // Pure pitch-black Schwarzschild shadow core
            } else {
                // Background deflection mapping
                vec2 deflection = vel.xy / max(vel.z, 0.1);
                vec2 deflected_uv = bh.xy + vec2(deflection.x / aspect, deflection.y) * bh.z;
                
                // Mask deflected sample if it lands inside the event horizon shadow
                float def_dist = length((deflected_uv - bh.xy) * vec2(aspect, 1.0)) / max(bh.z, 0.0001);
                vec3 bg_color = vec3(0.0);
                if (def_dist > b_crit) {
                    float ca = length(vel.xy) * 0.02;
                    float red = texture2D(textureSampler, clamp(deflected_uv + vec2(ca, 0.0), 0.001, 0.999)).r;
                    float green = texture2D(textureSampler, clamp(deflected_uv, 0.001, 0.999)).g;
                    float blue = texture2D(textureSampler, clamp(deflected_uv - vec2(ca, 0.0), 0.001, 0.999)).b;
                    bg_color = vec3(red, green, blue);
                }
                
                // Add photon ring glow if ray passed close to photon sphere (r_ph = 1.5 * r_s)
                float p_glow = 0.0;
                if (closest_r > b_crit && closest_r < 3.5) {
                    p_glow = smoothstep(3.5, b_crit, closest_r) * 2.2;
                    p_glow *= pow(max(0.0, 1.0 - disk_alpha), 2.0); // Occluded by accretion disk
                }
                vec3 p_color = bh_color * p_glow;
                
                final_color = bg_color * (1.0 - disk_alpha) + disk_color_accum + p_color;
            }
            
            // Soft falloff at the edge of the raytraced bounding box to avoid hard clipping lines
            float edge_blend = smoothstep(18.0, 15.0, min_dist);
            final_color = mix(texture2D(textureSampler, uv).rgb, final_color, edge_blend);
        }
        
        gl_FragColor = vec4(final_color, 1.0);
    }
  `;

  const lensingPP = new BABYLON.PostProcess(
    "blackholeLensingPP",
    "blackholeLensing",
    ["uScreenResolution", "uBlackHoles", "uBlackHoleColors", "uBlackHoleCount", "uTime"],
    null,
    1.0,
    camera
  );

  lensingPP.onApply = (effect) => {
    const ww = engine.getRenderWidth() || window.innerWidth;
    const wh = engine.getRenderHeight() || window.innerHeight;
    effect.setFloat2("uScreenResolution", ww, wh);
    effect.setFloat("uTime", performance.now() * 0.001);

    const bhData: number[] = [];
    const bhColors: number[] = [];
    let count = 0;

    const activeBhs = celestialEntitiesRef.current.filter(
      (e) => e.type === "blackhole" && !e.isDestroyed
    );

    activeBhs.forEach((bh) => {
      if (count >= 4) return;
      const wx = bh.x - ww / 2;
      const wy = -(bh.y - wh / 2);
      const wz = bh.z || 0;
      const worldVec = new BABYLON.Vector3(wx, wy, wz);

      const proj = BABYLON.Vector3.Project(
        worldVec,
        BABYLON.Matrix.Identity(),
        scene.getTransformMatrix(),
        camera.viewport.toGlobal(ww, wh)
      );

      const uvX = proj.x / ww;
      const uvY = 1.0 - proj.y / wh;
      const normRadius = (bh.radius * (bh.scale ?? 1.0)) / wh;

      bhData.push(uvX, uvY, normRadius);

      const rgb = parseColorToRgb(bh.color || "#ffffff");
      bhColors.push(rgb.r / 255.0, rgb.g / 255.0, rgb.b / 255.0);

      count++;
    });

    effect.setFloat("uBlackHoleCount", count);
    if (count > 0) {
      effect.setArray3("uBlackHoles", bhData);
      effect.setArray3("uBlackHoleColors", bhColors);
    }
  };

  lensingPostProcessRef.current = lensingPP;
}
