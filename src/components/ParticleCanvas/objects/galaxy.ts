import * as BABYLON from "@babylonjs/core";
import { CelestialEntity } from "../types";

/**
 * Pure particle representation: Returns a lightweight tracking transform node
 * without solid 3D geometric meshes, letting the particle simulation engine
 * render all spiral arms and galactic core density waves exclusively via particles.
 */
export function createGalaxyMesh(
  entity: CelestialEntity,
  wx: number,
  wy: number,
  initScale: number,
  scene: BABYLON.Scene
): BABYLON.TransformNode {
  const galaxyContainer = new BABYLON.TransformNode("galaxy_group", scene);
  galaxyContainer.position.set(wx, wy, 0);
  galaxyContainer.scaling.set(initScale, initScale, initScale);
  return galaxyContainer;
}
