import * as BABYLON from "@babylonjs/core";
import { CelestialEntity } from "../types";

/**
 * Pure particle representation: Returns a lightweight tracking transform node
 * without solid 3D geometric meshes, letting the particle simulation engine
 * render all photon rings, accretion disks, and event horizon void zones exclusively via particles.
 */
export function createBlackholeMesh(
  entity: CelestialEntity,
  wx: number,
  wy: number,
  initScale: number,
  scene: BABYLON.Scene
): BABYLON.TransformNode {
  const bhContainer = new BABYLON.TransformNode("bh_group", scene);
  bhContainer.position.set(wx, wy, 0);
  bhContainer.scaling.set(initScale, initScale, initScale);
  return bhContainer;
}
