import * as BABYLON from "@babylonjs/core";
let engine = new BABYLON.NullEngine();
let scene = new BABYLON.Scene(engine);
let cam = new BABYLON.UniversalCamera("cam", BABYLON.Vector3.Zero(), scene);
console.log("cam.target is: ", typeof cam.target);
console.log("cam.getTarget is: ", typeof cam.getTarget);
if ('target' in cam) {
    console.log("target property exists!");
}
