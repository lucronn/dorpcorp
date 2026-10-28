import * as BABYLON from "@babylonjs/core";
import { CelestialEntity } from "../types";

export function createPlanetMesh(
  _entity: CelestialEntity,
  wx: number,
  wy: number,
  initScale: number,
  scene: BABYLON.Scene
): BABYLON.TransformNode {
  if (!scene || (scene as any).isDisposed) {
    return null as any;
  }
  // Celestial bodies are rendered via pristine particle gravitation rather than cartoon plastic spheres
  const safeWx = isFinite(wx) ? wx : 0;
  const safeWy = isFinite(wy) ? wy : 0;
  const safeScale = isFinite(initScale) && initScale > 0 ? initScale : 1.0;
  const planetContainer = new BABYLON.TransformNode("planet_group", scene);
  planetContainer.position.set(safeWx, safeWy, 0);
  planetContainer.scaling.set(safeScale, safeScale, safeScale);
  return planetContainer;
}
