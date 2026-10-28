import * as BABYLON from "@babylonjs/core";
import { CelestialEntity } from "../types";

export function createNebulaMesh(
  _entity: CelestialEntity,
  wx: number,
  wy: number,
  initScale: number,
  scene: BABYLON.Scene
): BABYLON.TransformNode {
  if (!scene || (scene as any).isDisposed) {
    return null as any;
  }
  // Nebulae are represented purely through fluid particle dynamics, not static 3D sphere blobs
  const safeWx = isFinite(wx) ? wx : 0;
  const safeWy = isFinite(wy) ? wy : 0;
  const safeScale = isFinite(initScale) && initScale > 0 ? initScale : 1.0;
  const nebContainer = new BABYLON.TransformNode("nebula_group", scene);
  nebContainer.position.set(safeWx, safeWy, -100);
  nebContainer.scaling.set(safeScale, safeScale, safeScale);
  return nebContainer;
}

