import * as BABYLON from "@babylonjs/core";
let engine = new BABYLON.NullEngine();
let scene = new BABYLON.Scene(engine);
let cam = new BABYLON.UniversalCamera("cam", new BABYLON.Vector3(0,0,-10), scene);
cam.setTarget(BABYLON.Vector3.Zero());

try {
    BABYLON.Animation.CreateAndStartAnimation("camTarget", cam, "target", 60, 120, cam.getTarget(), new BABYLON.Vector3(1, 1, 1), 0, new BABYLON.CubicEase());
    console.log("Animation created successfully.");
    scene.render();
    console.log("Scene rendered successfully.");
} catch (e: any) {
    console.error(e.message);
}
