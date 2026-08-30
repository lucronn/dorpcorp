import * as BABYLON from "@babylonjs/core";
import { CelestialEntity } from "../types";

/**
 * Pure particle representation: Returns a lightweight tracking transform node
 * without solid 3D geometric meshes, letting the particle simulation engine
 * render all surface, atmosphere, cloud, and ring structures exclusively via particles.
 */
export function createPlanetMesh(
  entity: CelestialEntity,
  wx: number,
  wy: number,
  initScale: number,
  scene: BABYLON.Scene
): BABYLON.TransformNode {
  const planetContainer = new BABYLON.TransformNode("planet_group", scene);
  planetContainer.position.set(wx, wy, 0);
  planetContainer.scaling.set(initScale, initScale, initScale);
  return planetContainer;
}
