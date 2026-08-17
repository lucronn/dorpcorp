import React from "react";
import * as BABYLON from "@babylonjs/core";
import { generateAccretionDiskTexture, generateDistortedLightwaveTexture, createCircularGlowTexture } from "./TextureUtils";

export interface WormholeTransitParams {
  cameraRef: React.MutableRefObject<BABYLON.Camera | null>;
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
  } = params;

  if (isTransitActiveRef.current) return;

  const engine = rendererRef.current;
  const camera = cameraRef.current;
  const scene = sceneRef.current;
  if (!scene || scene.isDisposed || !camera || !engine) return;

  isTransitActiveRef.current = true;
  const transitStartTime = Date.now();
  transitStartTimeRef.current = transitStartTime;
  transitTargetPosRef.current = targetPos || null;
  transitDirRef.current = viewDir || null;

  try {
    if (!wormholePostProcessRef.current && camera) {
      BABYLON.Effect.ShadersStore["wormholePixelShader"] = `
        precision highp float;
        varying vec2 vUV;
        uniform sampler2D textureSampler;
        uniform float time;
        uniform float intensity;

        float hash(vec2 p) { return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); }

        void main(void) {
          if (intensity <= 0.0) {
            gl_FragColor = texture2D(textureSampler, vUV);
            return;
          }
          vec2 uv = vUV;
          vec2 center = vec2(0.5);
          vec2 dir = center - uv;
          float dist = length(dir);

          float pull = (1.0 - smoothstep(0.0, 0.5, dist)) * intensity * 1.5;
          float angle = pull * time * 2.0;
          float s = sin(angle);
          float c = cos(angle);
          mat2 rot = mat2(c, -s, s, c);

          vec2 swirledUV = center + rot * (uv - center) * (1.0 - pull * 0.3);

          if (dist > 0.0001) {
            dir = dir / dist;
          } else {
            dir = vec2(0.0);
          }

          float blurAmount = min(time * 0.015, 0.05) * intensity + pull * 0.04;
          vec4 sum = vec4(0.0);
          float samples = 8.0;
          for (float i = 0.0; i < 8.0; i++) {
            sum += texture2D(textureSampler, swirledUV + dir * (i / samples) * blurAmount);
          }
          sum /= samples;

          vec3 eventHorizonGlow = vec3(0.1, 0.5, 1.0) * pow(pull, 3.0) * 1.5;
          vec4 finalColor = mix(texture2D(textureSampler, uv), sum, intensity);
          finalColor.rgb += eventHorizonGlow;

          gl_FragColor = finalColor;
        }
      `;

      const wormholePP = new BABYLON.PostProcess("WormholePP", "wormhole", ["time", "intensity"], null, 1.0, camera);
      wormholePP.onApply = (effect) => {
        wormholeTimeRef.current += 0.016;
        effect.setFloat("time", wormholeTimeRef.current);
        effect.setFloat("intensity", wormholeIntensityRef.current);
      };
      wormholePostProcessRef.current = wormholePP;
    }

    wormholeTimeRef.current = 0.0;
    wormholeIntensityRef.current = 1.0;

    BABYLON.Animation.CreateAndStartAnimation("fovAnim", camera, "fov", 60, 60, camera.fov, 1.6, 0, new BABYLON.QuadraticEase());

    const origCameraPos = camera.position.clone();
    const dir = viewDir ? viewDir.normalize() : new BABYLON.Vector3(0, 0, 1);
    const lookAtPoint = origCameraPos.add(dir.scale(2000));
    camera.setTarget(lookAtPoint);

    const flyDestination = targetPos || origCameraPos.add(dir.scale(1200));
    const easeInOut = new BABYLON.CubicEase();
    easeInOut.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);
    BABYLON.Animation.CreateAndStartAnimation("camTransitAnim", camera, "position", 60, 180, origCameraPos, flyDestination, 0, easeInOut);

    const path = [];
    const dirForPath = viewDir ? viewDir.normalize() : new BABYLON.Vector3(0, 0, 1);
    for (let i = 0; i < 60; i++) {
      path.push(origCameraPos.add(dirForPath.scale(400 + i * 45)));
    }
    let tunnelMesh: BABYLON.Mesh | null = BABYLON.MeshBuilder.CreateTube("wormhole_tunnel", { path, radius: 35, sideOrientation: BABYLON.Mesh.BACKSIDE }, scene);
    tunnelMesh.metadata = { dir: dirForPath };

    let flyingObjects: BABYLON.Mesh[] = [];

    const tunnelStartPos = origCameraPos.add(dirForPath.scale(400));
    const mouthMesh = BABYLON.MeshBuilder.CreateTorus("wormhole_mouth", { diameter: 72, thickness: 3.5, tessellation: 64 }, scene);
    mouthMesh.position = tunnelStartPos;
    mouthMesh.lookAt(origCameraPos);
    const mouthMat = new BABYLON.PBRMaterial("mouthMat", scene);
    mouthMat.emissiveColor = new BABYLON.Color3(0.0, 0.9, 1.0);
    mouthMat.albedoColor = new BABYLON.Color3(0.05, 0.0, 0.2);
    mouthMat.metallic = 0.9;
    mouthMat.roughness = 0.1;
    mouthMesh.material = mouthMat;
    flyingObjects.push(mouthMesh);

    const vortexDisc = BABYLON.MeshBuilder.CreateDisc("vortex_disc", { radius: 35, tessellation: 64 }, scene);
    vortexDisc.position = tunnelStartPos.add(dirForPath.scale(0.5));
    vortexDisc.lookAt(origCameraPos);

    const vortexMaterial = new BABYLON.StandardMaterial("vortexMat", scene);
    const vTex = generateAccretionDiskTexture("#00ccff", "#9900ff", scene);
    vortexMaterial.diffuseTexture = vTex;
    vortexMaterial.emissiveTexture = vTex;
    vortexMaterial.opacityTexture = vTex;
    vortexMaterial.disableLighting = true;
    vortexMaterial.backFaceCulling = false;
    vortexMaterial.alphaMode = BABYLON.Engine.ALPHA_ADD;
    vortexDisc.material = vortexMaterial;
    flyingObjects.push(vortexDisc);

    const tunnelMat = new BABYLON.StandardMaterial("tunnelMat", scene);
    const tTex = generateDistortedLightwaveTexture("#0088ff", scene);
    tunnelMat.diffuseTexture = tTex;
    tunnelMat.emissiveTexture = tTex;
    tunnelMat.opacityTexture = tTex;
    tunnelMat.disableLighting = true;
    tunnelMat.backFaceCulling = false;
    tunnelMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
    tunnelMat.alpha = 0.55;
    tunnelMesh.material = tunnelMat;

    const dirForObjs = viewDir ? viewDir.normalize() : new BABYLON.Vector3(0, 0, 1);
    const wispTex = createCircularGlowTexture("#4deeea", scene);
    const wispMat = new BABYLON.StandardMaterial("wispTransitMat", scene);
    wispMat.diffuseTexture = wispTex;
    wispMat.emissiveTexture = wispTex;
    wispMat.opacityTexture = wispTex;
    wispMat.disableLighting = true;
    wispMat.backFaceCulling = false;
    wispMat.alphaMode = BABYLON.Engine.ALPHA_ADD;

    for (let i = 0; i < 24; i++) {
      const diameter = 12 + Math.random() * 20;
      const mesh = BABYLON.MeshBuilder.CreateSphere("transit_wisp_3d_" + i, { diameter, segments: 16 }, scene);
      const forwardOffset = Math.random() * 1000 + 100;
      const radialOffset = new BABYLON.Vector3((Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50);
      mesh.position = origCameraPos.add(dirForObjs.scale(forwardOffset)).add(radialOffset);
      mesh.material = wispMat;
      flyingObjects.push(mesh);
    }

    let transitObserver: BABYLON.Observer<BABYLON.Scene> | null = scene.onBeforeRenderObservable.add(() => {
      if (isTransitActiveRef.current) {
        const moveDir = tunnelMesh && tunnelMesh.metadata && tunnelMesh.metadata.dir ? tunnelMesh.metadata.dir : new BABYLON.Vector3(0, 0, 1);
        flyingObjects.forEach((m) => {
          if (m && !m.isDisposed) {
            m.position.subtractInPlace(moveDir.scale(5));
            m.rotation.x += 0.05;
            m.rotation.y += 0.05;
            if (camera && BABYLON.Vector3.Distance(m.position, camera.position) < 50) {
              m.position.addInPlace(moveDir.scale(1000));
            }
          }
        });
      }
    });

    setTimeout(() => {
      try {
        if (!scene || scene.isDisposed) return;

        if (transitObserver) {
          scene.onBeforeRenderObservable.remove(transitObserver);
          transitObserver = null;
        }

        scene.stopAnimation(camera);
        camera.animations = [];

        const cameraZ = cameraZRef.current;
        camera.fov = (fovRef.current * Math.PI) / 180 || 1.0;
        camera.position.set(0, 0, -cameraZ);
        camera.setTarget(BABYLON.Vector3.Zero());

        wormholeIntensityRef.current = 0.0;

        if (tunnelMesh) {
          tunnelMesh.dispose();
          tunnelMesh = null;
        }
        flyingObjects.forEach((m) => {
          if (m) {
            if (m.material) m.material.dispose();
            m.dispose();
          }
        });
        flyingObjects = [];

        const ww = window.innerWidth;
        const wh = window.innerHeight;

        isInterstellarRef.current = true;

        const geminiData = nextGeminiSceneRef.current;
        if (geminiData) {
          nextGeminiSceneRef.current = geminiData;
        }
        generateInterstellarScene(ww, wh, true);
        mapParticlesToInterstellar(ww, wh);

        isTransitActiveRef.current = false;

        if (animationComplete) {
          animationComplete();
        }
      } catch (e) {
        console.error("[DEBUG] Error inside transit setTimeout:", e);
        wormholeIntensityRef.current = 0.0;
        isTransitActiveRef.current = false;
      }
    }, 3000);
  } catch (err) {
    console.error("[DEBUG] Error starting wormhole transit:", err);
    wormholeIntensityRef.current = 0.0;
    isTransitActiveRef.current = false;
  }
}
