import * as BABYLON from "@babylonjs/core";
import { CelestialEntity } from "../types";

/**
 * Pure particle representation: Returns a lightweight tracking transform node
 * without solid 3D geometric meshes, letting the particle simulation engine
 * render all multi-lobe billowing interstellar gas clouds exclusively via particles.
 */
export function createNebulaMesh(
  entity: CelestialEntity,
  wx: number,
  wy: number,
  initScale: number,
  scene: BABYLON.Scene
): BABYLON.TransformNode {
  const nebContainer = new BABYLON.TransformNode("nebula_group", scene);
  nebContainer.position.set(wx, wy, 0);
  nebContainer.scaling.set(initScale, initScale, initScale);
  return nebContainer;
}
