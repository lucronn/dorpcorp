import * as BABYLON from "@babylonjs/core";
let engine = new BABYLON.NullEngine();
let scene = new BABYLON.Scene(engine);
let cam = new BABYLON.TargetCamera("cam", new BABYLON.Vector3(0,0,-10), scene);
let pp1 = new BABYLON.PostProcess("PP1", "blackAndWhite", null, null, 1.0, cam);
let pp2 = new BABYLON.PostProcess("PP2", "blackAndWhite", null, null, 1.0, cam);
pp2.dispose();
scene.render();
console.log("Rendered with 1 post process left.");
