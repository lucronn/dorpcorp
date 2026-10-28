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
  const nebContainer = new BABYLON.TransformNode("nebula_group", scene);
  nebContainer.position.set(wx, wy, -100);
  nebContainer.scaling.set(initScale, initScale, initScale);
  return nebContainer;
}

