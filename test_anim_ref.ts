import * as BABYLON from "@babylonjs/core";
let engine = new BABYLON.NullEngine();
let scene = new BABYLON.Scene(engine);
let cam = new BABYLON.TargetCamera("cam", new BABYLON.Vector3(0,0,-10), scene);
cam.setTarget(BABYLON.Vector3.Zero());

try {
    BABYLON.Animation.CreateAndStartAnimation("test", cam, "position", 60, 10, cam.position, new BABYLON.Vector3(0,0,0), 0, new BABYLON.CubicEase());
    for(let i=0; i<15; i++) {
        scene.render();
        console.log(cam.position.z);
    }
} catch (e: any) {
    console.error(e.message);
}
