import assert from "node:assert/strict";
import { test } from "node:test";
import * as BABYLON from "@babylonjs/core";
import { RemeshCover } from "../src/components/ParticleCanvas/RemeshCover";
import { RemeshPanAway } from "../src/components/ParticleCanvas/RemeshPanAway";

for (const width of [390, 1200, 2400]) {
  test(`foreground moon covers real viewport rays through the camera handoff at width ${width}`, () => {
    const engine = new BABYLON.NullEngine({ renderWidth: width, renderHeight: 800, textureSize: 256, deterministicLockstep: false, lockstepMaxSteps: 4 });
    const scene = new BABYLON.Scene(engine);
    const camera = new BABYLON.TargetCamera("camera", new BABYLON.Vector3(150, 200, -1500), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.fov = Math.PI / 3;
    const pan = new RemeshPanAway(scene, camera);
    const cover = new RemeshCover();
    cover.request("test", () => {});
    cover.advance(0);
    pan.apply(cover, [], width, 800);
    assert.equal(pan.coverage().occluded, false, "moon starts outside the composition");
    const startYaw = camera.rotation.y;
    for (let time = 16; time <= 448; time += 16) {
      pan.restore();
      cover.advance(time);
      pan.apply(cover, [], width, 800);
      scene.render();
    }
    assert(Math.abs(camera.rotation.y - startYaw) > 0.7, "the camera actually pans");
    const assertOccluded = () => {
      assert(pan.coverage().occluded, JSON.stringify(pan.coverage()));
      // Independent triangle intersections, not the director's angular predicate.
      for (const x of [0, width / 2, width]) for (const y of [0, 400, 800]) {
        const ray = BABYLON.Ray.CreateNew(x, y, width, 800, BABYLON.Matrix.Identity(), camera.getViewMatrix(true), camera.getProjectionMatrix(true));
        assert(ray.intersectsMesh(pan.moon).hit, `uncovered viewport ray ${x}, ${y}`);
      }
    };
    assertOccluded();
    cover.afterRender(true, true);
    cover.flush(true);
    pan.restore();
    camera.position.set(-800, 400, -2400);
    camera.setTarget(new BABYLON.Vector3(100, -50, 200));
    pan.apply(cover, [], width, 800);
    scene.render();
    assertOccluded();
    cover.afterRender(true, true);
    cover.afterRender(true, true);
    for (let time = 464; time < 1100; time += 16) {
      pan.restore();
      cover.advance(time);
      pan.apply(cover, [], width, 800);
    }
    assert.equal(cover.phase, "idle");
    assert.equal(pan.moon.isEnabled(), false);
    assert.equal(camera.position.z, -2400);
    pan.dispose();
    scene.dispose();
    engine.dispose();
  });
}
