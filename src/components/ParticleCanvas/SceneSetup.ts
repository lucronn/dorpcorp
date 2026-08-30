import React from "react";
import * as BABYLON from "@babylonjs/core";
import { CelestialEntity } from "./types";

export const initializeScene = (
  canvas: HTMLCanvasElement,
  sceneRef: React.MutableRefObject<BABYLON.Scene | null>,
  cameraRef: React.MutableRefObject<BABYLON.TargetCamera | null>,
  engineRef: React.MutableRefObject<BABYLON.Engine | null>,
  fov: number,
  cameraZ: number
) => {
  const engine = new BABYLON.Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    premultipliedAlpha: true,
  });
  engineRef.current = engine;

  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);
  sceneRef.current = scene;

  const camera = new BABYLON.TargetCamera(
    "camera",
    new BABYLON.Vector3(0, 0, -cameraZ),
    scene
  );
  camera.setTarget(BABYLON.Vector3.Zero());
  camera.fov = (fov * Math.PI) / 180;
  camera.maxZ = 50000;
  
  cameraRef.current = camera;

  // Space Hemispheric Ambient Light (Deep space ambient fill)
  const hemiLight = new BABYLON.HemisphericLight(
    "space_hemi_light",
    new BABYLON.Vector3(0.4, 1.0, -0.4),
    scene
  );
  hemiLight.intensity = 0.95;
  hemiLight.groundColor = new BABYLON.Color3(0.06, 0.06, 0.12);
  hemiLight.diffuse = new BABYLON.Color3(1.0, 0.98, 0.92);

  // Directional Key Starlight (Creates dramatic planetary shadow terminators and ocean specular)
  const dirLight = new BABYLON.DirectionalLight(
    "star_dir_light",
    new BABYLON.Vector3(-1.0, -0.4, 0.8),
    scene
  );
  dirLight.intensity = 1.8;
  dirLight.diffuse = new BABYLON.Color3(1.0, 0.96, 0.88);
  dirLight.specular = new BABYLON.Color3(1.0, 1.0, 1.0);

  return { engine, scene, camera };
};
