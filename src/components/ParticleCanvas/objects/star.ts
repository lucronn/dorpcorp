import * as BABYLON from "@babylonjs/core";
import { CelestialEntity } from "../types";

/**
 * Pure particle representation: Returns a lightweight tracking transform node
 * without solid 3D geometric meshes, letting the particle simulation engine
 * render all fusion core, coronal flare, and polar jet structures exclusively via particles.
 */
export function createStarMesh(
  entity: CelestialEntity,
  wx: number,
  wy: number,
  initScale: number,
  scene: BABYLON.Scene
): BABYLON.TransformNode {
  const starContainer = new BABYLON.TransformNode("star_group", scene);
  starContainer.position.set(wx, wy, 0);
  starContainer.scaling.set(initScale, initScale, initScale);
  return starContainer;
}
