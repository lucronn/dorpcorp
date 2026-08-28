const BABYLON = require('@babylonjs/core');
const engine = new BABYLON.NullEngine();
const scene = new BABYLON.Scene(engine);
const ps = new BABYLON.ParticleSystem("test", 100, scene);
console.log(ps.createConeEmitter.toString());
