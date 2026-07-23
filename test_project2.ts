import * as BABYLON from "@babylonjs/core";
let engine = new BABYLON.NullEngine();
let scene = new BABYLON.Scene(engine);
let cam = new BABYLON.TargetCamera("cam", new BABYLON.Vector3(0,0,-10), scene);
cam.setTarget(BABYLON.Vector3.Zero());

scene.onBeforeRenderObservable.add(() => {
    let pos = new BABYLON.Vector3(0,0,0);
    let vp = cam.viewport.toGlobal(1000, 1000);
    let screenPos = BABYLON.Vector3.Project(pos, BABYLON.Matrix.Identity(), scene.getTransformMatrix(), vp);
    console.log(screenPos);
});

scene.render();
