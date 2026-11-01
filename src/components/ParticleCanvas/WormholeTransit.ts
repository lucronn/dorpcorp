import React from "react";
import * as BABYLON from "@babylonjs/core";
import { generateAccretionDiskTexture, generateDistortedLightwaveTexture, createCircularGlowTexture } from "./TextureUtils";
import { quinticEaseInOut } from "./PhysicsUtils";

export interface WormholeTransitParams {
  cameraRef: React.MutableRefObject<BABYLON.TargetCamera | BABYLON.Camera | null>;
  sceneRef: React.MutableRefObject<BABYLON.Scene | null>;
  rendererRef: React.MutableRefObject<BABYLON.Engine | null>;
  isTransitActiveRef: React.MutableRefObject<boolean>;
  transitStartTimeRef: React.MutableRefObject<number>;
  transitTargetPosRef: React.MutableRefObject<BABYLON.Vector3 | null>;
  transitDirRef: React.MutableRefObject<BABYLON.Vector3 | null>;
  wormholePostProcessRef: React.MutableRefObject<BABYLON.PostProcess | null>;
  wormholeTimeRef: React.MutableRefObject<number>;
  wormholeIntensityRef: React.MutableRefObject<number>;
  fovRef: React.MutableRefObject<number>;
  cameraZRef: React.MutableRefObject<number>;
  isInterstellarRef: React.MutableRefObject<boolean>;
  nextGeminiSceneRef: React.MutableRefObject<any>;
  generateInterstellarScene: (ww: number, wh: number, forceNew?: boolean) => void;
  mapParticlesToInterstellar: (ww: number, wh: number) => void;
  animationComplete?: () => void;
  transitionStartTimeRef?: React.MutableRefObject<number>;
  transitionActiveRef?: React.MutableRefObject<number | boolean>;
  transitionStartPosRef?: React.MutableRefObject<BABYLON.Vector3 | null>;
  audio?: any;
  cancelTransitRef?: React.MutableRefObject<(() => void) | null>;
}

export async function startWormholeTransit(
  params: WormholeTransitParams,
  targetPos?: BABYLON.Vector3,
  viewDir?: BABYLON.Vector3
): Promise<void> {
  const {
    cameraRef,
    sceneRef,
    rendererRef,
    isTransitActiveRef,
    transitStartTimeRef,
    transitTargetPosRef,
    transitDirRef,
    wormholePostProcessRef,
    wormholeTimeRef,
    wormholeIntensityRef,
    fovRef,
    cameraZRef,
    isInterstellarRef,
    nextGeminiSceneRef,
    generateInterstellarScene,
    mapParticlesToInterstellar,
    animationComplete,
    transitionStartTimeRef,
    transitionActiveRef,
    transitionStartPosRef,
    audio,
    cancelTransitRef,
  } = params;

  if (isTransitActiveRef.current) return;

  const engine = rendererRef.current;
  const camera = cameraRef.current as BABYLON.TargetCamera | null;
  const scene = sceneRef.current;
  if (!scene || scene.isDisposed || !camera || !engine) return;

  isTransitActiveRef.current = true;
  const transitDurationMs = 5600;
  const transitStartTime = Date.now();
  transitStartTimeRef.current = transitStartTime;
  transitTargetPosRef.current = targetPos || null;
  transitDirRef.current = viewDir || null;

  if (audio) {
    if (typeof audio.playStageSwell === "function") {
      audio.playStageSwell(3);
    } else if (typeof audio.playRippleShockwave === "function") {
      audio.playRippleShockwave();
    }
  }

  try {
    if (!wormholePostProcessRef.current && camera) {
      BABYLON.Effect.ShadersStore["wormholePixelShader"] = `
        precision highp float;
        varying vec2 vUV;
        uniform sampler2D textureSampler;
        uniform float time;
        uniform float intensity;

        void main(void) {
          if (intensity <= 0.001) {
            gl_FragColor = texture2D(textureSampler, vUV);
            return;
          }
          vec2 uv = vUV;
          vec2 center = vec2(0.5);
          vec2 dir = center - uv;
          float dist = length(dir);

          float pull = (1.0 - smoothstep(0.0, 0.62, dist)) * intensity * 1.35;
          float angle = pull * (1.2 + sin(time * 1.8) * 0.4);
          float s = sin(angle);
          float c = cos(angle);
          mat2 rot = mat2(c, -s, s, c);

          vec2 swirledUV = center + rot * (uv - center) * (1.0 - pull * 0.28);

          vec2 normDir = dist > 0.0001 ? (dir / dist) : vec2(0.0);
          float blurAmount = (0.012 + pull * 0.038) * intensity;

          vec4 sum = vec4(0.0);
          const float samples = 8.0;
          for (float i = 0.0; i < 8.0; i++) {
            float t = i / samples;
            vec2 sampleUV = clamp(swirledUV + normDir * t * blurAmount, 0.002, 0.998);
            sum += texture2D(textureSampler, sampleUV);
          }
          sum /= samples;

          // Morris-Thorne / Ellis Traversable Wormhole Lensing & Einstein Ring Caustic
          // (James, von Tunzelmann, Franklin & Thorne 2015, "Visualizing Interstellar's Wormhole", arXiv:1502.03809):
          // Metric: ds^2 = -c^2 dt^2 + dl^2 + r^2(l)(dtheta^2 + sin^2(theta) dphi^2), r(l) = sqrt(b_0^2 + l^2).
          // A traversable wormhole has NO event horizon; light rays grazing the throat r = b_0 execute
          // unstable spherical photon orbits, forming a sharp Einstein ring of lensed starlight around the throat.
          float einsteinRing = exp(-pow((dist - 0.21) / 0.042, 2.0)) * smoothstep(0.04, 0.16, dist);
          vec3 causticsStarlight = mix(vec3(1.0, 0.94, 0.80), vec3(0.72, 0.89, 1.0), clamp(dist * 2.2, 0.0, 1.0))
            * (pow(pull, 2.2) * 0.65 + einsteinRing * intensity * 0.58);

          vec4 baseCol = texture2D(textureSampler, uv);
          vec4 finalColor = mix(baseCol, sum, clamp(intensity * 0.92, 0.0, 1.0));
          finalColor.rgb += causticsStarlight;

          gl_FragColor = vec4(finalColor.rgb, 1.0);
        }
      `;

      const wormholePP = new BABYLON.PostProcess(
        "WormholePP",
        "wormhole",
        ["time", "intensity"],
        null,
        1.0,
        camera
      );
      wormholePP.onApply = (effect) => {
        wormholeTimeRef.current += 0.016;
        effect.setFloat("time", wormholeTimeRef.current);
        effect.setFloat("intensity", wormholeIntensityRef.current);
      };
      wormholePostProcessRef.current = wormholePP;
    }

    wormholeTimeRef.current = 0.0;
    wormholeIntensityRef.current = 0.02;

    const origCameraPos = camera.position.clone();
    const baseFov = (fovRef.current * Math.PI) / 180 || 1.047;

    // Determine true camera forward direction so we never snap 180 degrees
    let forwardDir: BABYLON.Vector3;
    if (viewDir && viewDir.lengthSquared() > 0.0001) {
      forwardDir = viewDir.clone().normalize();
    } else {
      const toOrigin = BABYLON.Vector3.Zero().subtract(origCameraPos);
      if (toOrigin.lengthSquared() > 1.0) {
        forwardDir = toOrigin.normalize();
      } else {
        try {
          forwardDir = camera.getForwardRay(1).direction.clone().normalize();
        } catch {
          forwardDir = new BABYLON.Vector3(0, 0, 1);
        }
      }
    }

    // Construct an orthonormal basis around forwardDir for curved wormhole spiral offsets
    const worldUp = Math.abs(forwardDir.y) < 0.9 ? new BABYLON.Vector3(0, 1, 0) : new BABYLON.Vector3(1, 0, 0);
    const rightDir = BABYLON.Vector3.Cross(worldUp, forwardDir).normalize();
    const upDir = BABYLON.Vector3.Cross(forwardDir, rightDir).normalize();

    const getTunnelPoint = (distanceAlong: number) => {
      const wavePhase = distanceAlong * 0.0032;
      const swayX = Math.sin(wavePhase) * 45.0;
      const swayY = Math.cos(wavePhase * 0.85) * 35.0;
      return origCameraPos
        .add(forwardDir.scale(distanceAlong))
        .add(rightDir.scale(swayX))
        .add(upDir.scale(swayY));
    };

    const path: BABYLON.Vector3[] = [];
    for (let i = 0; i < 65; i++) {
      path.push(getTunnelPoint(120 + i * 42));
    }

    let tunnelMesh: BABYLON.Mesh | null = BABYLON.MeshBuilder.CreateTube(
      "wormhole_tunnel",
      {
        path,
        radiusFunction: (idx) => {
          const t = idx / 64;
          // Wide entry mouth tapering into relativistic throat and flaring at exit
          return 155 - Math.sin(t * Math.PI) * 55;
        },
        tessellation: 40,
        sideOrientation: BABYLON.Mesh.DOUBLESIDE,
      },
      scene
    );

    let flyingObjects: BABYLON.Mesh[] = [];

    const tunnelStartPos = getTunnelPoint(220);
    const mouthMesh = BABYLON.MeshBuilder.CreateTorus(
      "wormhole_mouth",
      { diameter: 290, thickness: 6.5, tessellation: 64 },
      scene
    );
    mouthMesh.position = tunnelStartPos.clone();
    mouthMesh.lookAt(origCameraPos);
    const mouthMat = new BABYLON.StandardMaterial("mouthMat", scene);
    mouthMat.emissiveColor = new BABYLON.Color3(0.2, 0.85, 1.0);
    mouthMat.diffuseColor = new BABYLON.Color3(0.05, 0.1, 0.3);
    mouthMat.disableLighting = true;
    mouthMat.alpha = 0.85;
    mouthMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
    mouthMesh.material = mouthMat;
    flyingObjects.push(mouthMesh);

    const vortexDisc = BABYLON.MeshBuilder.CreateDisc(
      "vortex_disc",
      { radius: 145, tessellation: 64 },
      scene
    );
    vortexDisc.position = getTunnelPoint(230);
    vortexDisc.lookAt(origCameraPos);

    const vortexMaterial = new BABYLON.StandardMaterial("vortexMat", scene);
    const vTex = generateAccretionDiskTexture("#ffd778", "#bae6fd", scene);
    vortexMaterial.diffuseTexture = vTex;
    vortexMaterial.emissiveTexture = vTex;
    vortexMaterial.opacityTexture = vTex;
    vortexMaterial.disableLighting = true;
    vortexMaterial.backFaceCulling = false;
    vortexMaterial.alphaMode = BABYLON.Engine.ALPHA_ADD;
    vortexMaterial.alpha = 0.78;
    vortexDisc.material = vortexMaterial;
    flyingObjects.push(vortexDisc);

    const tunnelMat = new BABYLON.StandardMaterial("tunnelMat", scene);
    const tTex = generateDistortedLightwaveTexture("#00a8ff", scene);
    tunnelMat.diffuseTexture = tTex;
    tunnelMat.emissiveTexture = tTex;
    tunnelMat.opacityTexture = tTex;
    tunnelMat.disableLighting = true;
    tunnelMat.backFaceCulling = false;
    tunnelMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
    tunnelMat.alpha = 0.52;
    tunnelMesh.material = tunnelMat;

    const wispTex = createCircularGlowTexture("#4deeea", scene);
    const wispMat = new BABYLON.StandardMaterial("wispTransitMat", scene);
    wispMat.diffuseTexture = wispTex;
    wispMat.emissiveTexture = wispTex;
    wispMat.opacityTexture = wispTex;
    wispMat.disableLighting = true;
    wispMat.backFaceCulling = false;
    wispMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
    wispMat.alpha = 0.75;

    for (let i = 0; i < 28; i++) {
      const diameter = 8 + Math.random() * 14;
      const mesh = BABYLON.MeshBuilder.CreateSphere(
        "transit_wisp_3d_" + i,
        { diameter, segments: 12 },
        scene
      );
      const forwardOffset = 180 + Math.random() * 2100;
      const angle = Math.random() * Math.PI * 2;
      const rad = 35 + Math.random() * 85;
      const basePt = getTunnelPoint(forwardOffset);
      mesh.position = basePt
        .add(rightDir.scale(Math.cos(angle) * rad))
        .add(upDir.scale(Math.sin(angle) * rad));
      mesh.material = wispMat;
      flyingObjects.push(mesh);
    }

    let hasSpawnedNewSystem = false;

    let transitObserver: BABYLON.Observer<BABYLON.Scene> | null =
      scene.onBeforeRenderObservable.add(() => {
        if (!isTransitActiveRef.current || transitStartTimeRef.current !== transitStartTime || !camera || scene.isDisposed) return;

        const elapsed = Date.now() - transitStartTime;
        const progress = Math.min(1.0, Math.max(0.0, elapsed / transitDurationMs));

        // Smooth bell-curve intensity envelope (ramps up smoothly, peaks mid-transit, fades out cleanly)
        const envelope = Math.sin(progress * Math.PI);
        const smoothEnvelope = envelope * envelope * (3.0 - 2.0 * envelope);
        wormholeIntensityRef.current = smoothEnvelope;

        // Smooth FOV warp expansion and restoration
        camera.fov = baseFov + smoothEnvelope * 0.48;

        // Smooth C2 quintic S-curve camera flight along the curved wormhole throat
        const easeT = quinticEaseInOut(progress);
        const travelDist = easeT * 1850;
        const camPos = getTunnelPoint(travelDist);
        const lookAheadPos = getTunnelPoint(travelDist + 420);

        camera.position.copyFrom(camPos);
        if (typeof camera.setTarget === "function") {
          camera.setTarget(lookAheadPos);
        }

        // Fade tunnel and mouth smoothly at entry and exit
        tunnelMat.alpha = 0.58 * smoothEnvelope;
        mouthMat.alpha = 0.85 * smoothEnvelope;
        vortexMaterial.alpha = 0.78 * smoothEnvelope;
        wispMat.alpha = 0.75 * smoothEnvelope;

        if (tTex && "uOffset" in tTex) {
          (tTex as BABYLON.Texture).uOffset += 0.022;
          (tTex as BABYLON.Texture).vOffset += 0.014;
        }
        vortexDisc.rotation.z += 0.055;

        flyingObjects.forEach((m, idx) => {
          if (m && !m.isDisposed && m !== mouthMesh && m !== vortexDisc) {
            m.position.subtractInPlace(forwardDir.scale(14));
            m.rotation.z += 0.04 + (idx % 3) * 0.015;
          }
        });

        // Cut inside the throat; keep the remap covered through the camera handoff.
        if (progress >= 0.82 && !hasSpawnedNewSystem) {
          hasSpawnedNewSystem = true;
          const ww = window.innerWidth;
          const wh = window.innerHeight;
          isInterstellarRef.current = true;
          generateInterstellarScene(ww, wh, true);
          mapParticlesToInterstellar(ww, wh);
        }
      });

    const disposeTunnel = () => {
      const materialsToDispose = new Set<BABYLON.Material>();
      if (tunnelMesh) {
        if (tunnelMesh.material) materialsToDispose.add(tunnelMesh.material);
        tunnelMesh.dispose();
        tunnelMesh = null;
      }
      flyingObjects.forEach((m) => {
        if (m && !m.isDisposed()) {
          if (m.material) materialsToDispose.add(m.material);
          m.dispose();
        }
      });
      flyingObjects = [];
      materialsToDispose.forEach((mat) => {
        try {
          const textures = (mat as any).getActiveTextures ? (mat as any).getActiveTextures() : [];
          textures.forEach((tex: any) => tex?.dispose?.());
          mat.dispose();
        } catch {}
      });
    };

    let completionTimer: ReturnType<typeof setTimeout>;
    if (cancelTransitRef) {
      cancelTransitRef.current = () => {
        clearTimeout(completionTimer);
        if (transitObserver) scene.onBeforeRenderObservable.remove(transitObserver);
        transitObserver = null;
        disposeTunnel();
        isTransitActiveRef.current = false;
        transitStartTimeRef.current = 0;
        wormholeIntensityRef.current = 0;
        camera.fov = baseFov;
        cancelTransitRef.current = null;
      };
    }

    completionTimer = setTimeout(() => {
      try {
        if (!scene || scene.isDisposed) return;

        if (transitObserver) {
          scene.onBeforeRenderObservable.remove(transitObserver);
          transitObserver = null;
        }

        if (transitStartTimeRef.current !== transitStartTime) {
          disposeTunnel();
          return;
        }

        scene.stopAnimation(camera);
        camera.animations = [];
        camera.fov = baseFov;
        wormholeIntensityRef.current = 0.0;

        // Ensure new system was generated even if tab was backgrounded
        if (!hasSpawnedNewSystem) {
          hasSpawnedNewSystem = true;
          const ww = window.innerWidth;
          const wh = window.innerHeight;
          isInterstellarRef.current = true;
          generateInterstellarScene(ww, wh, true);
          mapParticlesToInterstellar(ww, wh);
        }

        if (transitionActiveRef) transitionActiveRef.current = false;
        if (transitionStartPosRef) transitionStartPosRef.current = null;

        disposeTunnel();
        if (cancelTransitRef) cancelTransitRef.current = null;
        isTransitActiveRef.current = false;

        if (animationComplete) {
          animationComplete();
        }
      } catch (e) {
        console.error("[DEBUG] Error inside transit completion:", e);
        wormholeIntensityRef.current = 0.0;
        isTransitActiveRef.current = false;
      }
    }, transitDurationMs);
  } catch (err) {
    console.error("[DEBUG] Error starting wormhole transit:", err);
    wormholeIntensityRef.current = 0.0;
    isTransitActiveRef.current = false;
  }
}
