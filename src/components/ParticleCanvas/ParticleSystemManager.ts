import * as BABYLON from "@babylonjs/core";

export class ParticleSystemManager {
  private particleSystem: BABYLON.ParticleSystem;

  constructor(scene: BABYLON.Scene, capacity: number = 20000) {
    this.particleSystem = new BABYLON.ParticleSystem("particles", capacity, scene);
    this.particleSystem.particleTexture = new BABYLON.Texture("https://www.babylonjs-playground.com/textures/flare.png", scene);
    this.particleSystem.emitter = BABYLON.Vector3.Zero();
    this.particleSystem.start();
  }

  get system() {
    return this.particleSystem;
  }

  stop() {
    this.particleSystem.stop();
  }
}
