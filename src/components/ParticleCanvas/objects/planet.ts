import * as BABYLON from "@babylonjs/core";
import { CelestialEntity } from "../types";

export function createPlanetMesh(
  _entity: CelestialEntity,
  wx: number,
  wy: number,
  initScale: number,
  scene: BABYLON.Scene
): BABYLON.TransformNode {
  // Celestial bodies are rendered via pristine particle gravitation rather than cartoon plastic spheres
  const planetContainer = new BABYLON.TransformNode("planet_group", scene);
  planetContainer.position.set(wx, wy, 0);
  planetContainer.scaling.set(initScale, initScale, initScale);
  return planetContainer;
}
