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
  wormholeTimeRef?: React.MutableRefObject<number>;
  wormholeIntensityRef?: React.MutableRefObject<number>;
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
  viewDir?: BABYLON.Vector3,
  bhRadius?: number
): Promise<void> {
  const {
    cameraRef,
    sceneRef,
    rendererRef,
    isTransitActiveRef,
    transitStartTimeRef,
    transitTargetPosRef,
    transitDirRef,
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
    // 3D Camera and Relativistic Tunnel Transit (Pure 3D geometry and motion)
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
    tunnelMesh.renderingGroupId = 2;

    let flyingObjects: BABYLON.Mesh[] = [];

    const tunnelStartPos = origCameraPos.add(dirForPath.scale(400));
    const mouthMesh = BABYLON.MeshBuilder.CreateTorus("wormhole_mouth", { diameter: 72, thickness: 3.5, tessellation: 64 }, scene);
    mouthMesh.position = tunnelStartPos;
    mouthMesh.lookAt(origCameraPos);
    mouthMesh.renderingGroupId = 2;
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
    vortexDisc.renderingGroupId = 2;

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
      mesh.renderingGroupId = 2;
      flyingObjects.push(mesh);
    }

    let hasCrossedEventHorizon = false;
    let transitionTargetIntensity = 0.0;

    // If there is no black hole, trigger effects instantly
    if (!bhRadius) {
      hasCrossedEventHorizon = true;
      transitionTargetIntensity = 1.0;
      BABYLON.Animation.CreateAndStartAnimation("fovAnim", camera, "fov", 60, 60, camera.fov, 1.6, 0, new BABYLON.QuadraticEase());
    }

    let transitObserver: BABYLON.Observer<BABYLON.Scene> | null = scene.onBeforeRenderObservable.add(() => {
      if (isTransitActiveRef.current) {
        
        if (bhRadius && targetPos && !hasCrossedEventHorizon) {
          const dist = BABYLON.Vector3.Distance(camera.position, targetPos);
          // Mid-way through event horizon: bhRadius * 1.3 (event horizon is ~bhRadius*2.6)
          if (dist < bhRadius * 1.3) {
            hasCrossedEventHorizon = true;
            transitionTargetIntensity = 1.0;
            // Begin FOV stretch now!
            BABYLON.Animation.CreateAndStartAnimation("fovAnim", camera, "fov", 60, 60, camera.fov, 1.6, 0, new BABYLON.QuadraticEase());
          }
        }
        
        if (wormholeIntensityRef) {
          wormholeIntensityRef.current += (transitionTargetIntensity - wormholeIntensityRef.current) * 0.08;
        }
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

        if (wormholeIntensityRef) {
          wormholeIntensityRef.current = 0.0;
        }

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
