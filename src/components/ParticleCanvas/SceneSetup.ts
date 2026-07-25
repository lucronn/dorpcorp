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

  return { engine, scene, camera };
};
