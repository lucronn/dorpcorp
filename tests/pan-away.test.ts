import assert from "node:assert/strict";
import { test } from "node:test";
import * as BABYLON from "@babylonjs/core";
import { RemeshCover } from "../src/components/ParticleCanvas/RemeshCover";
import { RemeshPanAway } from "../src/components/ParticleCanvas/RemeshPanAway";
import type { Particle } from "../src/components/ParticleCanvas/types";

for (const width of [390, 1200, 2400]) for (const reduced of [false, true]) {
  test(`remesh stays outside real frustum planes; stars survive at width ${width}, reduced ${reduced}`, () => {
    const engine = new BABYLON.NullEngine({ renderWidth: width, renderHeight: 800, textureSize: 256, deterministicLockstep: false, lockstepMaxSteps: 4 });
    const scene = new BABYLON.Scene(engine);
    const camera = new BABYLON.TargetCamera("camera", new BABYLON.Vector3(150, 200, -1500), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.fov = Math.PI / 3;
    camera.minZ = 0.5;
    camera.maxZ = 50000;
    const body = BABYLON.MeshBuilder.CreateSphere("real-planet", { diameter: 500 }, scene);
    const positions = new Float32Array([-400, -600, -300, 800, 400, 500]);
    const particles = Array.from({ length: 2 }, () => ({ isCosmicAmbient: false } as Particle));
    const pan = new RemeshPanAway(scene, camera);
    const cover = new RemeshCover();
    cover.reducedMotion = reduced;
    cover.request("test", () => {});
    const apply = () => pan.apply(cover, [], width, 800, particles, positions, new Float32Array(8).fill(1));
    const starVertices = [...pan.stars.mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind)!];
    const assertStars = () => {
      const planes = BABYLON.Frustum.GetPlanes(camera.getTransformationMatrix());
      let visible = 0;
      for (let i = 0; i < starVertices.length; i += 3) {
        const world = new BABYLON.Vector3(starVertices[i], starVertices[i + 1], starVertices[i + 2]).add(camera.position);
        if (planes.every(p => p.dotCoordinate(world) >= 0)) visible++;
      }
      assert(visible > 100, `only ${visible} stars in the frustum`);
      assert(pan.stars.mesh.isEnabled());
      assert.equal(scene.meshes.length, 2, "no replacement moon, plane, or cover geometry");
    };
    cover.advance(0);
    apply();
    const startRotation = camera.rotation.clone();
    for (let time = 16; time <= 448; time += 16) {
      pan.restore(); cover.advance(time); apply(); scene.render(); assertStars();
    }
    if (!reduced) assert(BABYLON.Vector3.Distance(camera.rotation, startRotation) > 1, "real camera departure");
    const assertOutside = () => {
      assert(pan.coverage().occluded, JSON.stringify(pan.coverage()));
      // Independently test Babylon's frustum planes against the actual geometry.
      const planes = BABYLON.Frustum.GetPlanes(camera.getTransformationMatrix());
      assert.equal(body.isInFrustum(planes), false);
      for (let i = 0; i < positions.length; i += 3) {
        const point = new BABYLON.Vector3(positions[i], positions[i + 1], positions[i + 2]);
        assert(planes.some(p => p.dotCoordinate(point) < 0), "remappable particle in view");
      }
      assertStars();
    };
    assertOutside();
    cover.afterRender(true, true); cover.flush(true);
    pan.restore();
    camera.position.set(-800, 400, -2400);
    camera.setTarget(new BABYLON.Vector3(100, -50, 200));
    // Destination geometry extends beyond the departure bounds; also change FOV.
    body.position.set(3500, -1500, 900);
    positions[0] = 9000;
    camera.fov = 1.4;
    apply(); scene.render(); assertOutside();
    cover.afterRender(true, true); cover.afterRender(true, true);
    if (!reduced) {
      // A user can reverse a partially completed return without exposing targets
      // or jumping back to the previous scene director's unpanned camera.
      pan.restore(); cover.advance(512); apply(); scene.render();
      const presentedPosition = camera.position.clone();
      const presentedRotation = camera.rotation.clone();
      cover.request("new-navigation", () => {});
      pan.restore(); cover.advance(528); apply();
      assert(BABYLON.Vector3.Distance(camera.position, presentedPosition) < 0.001);
      assert(BABYLON.Vector3.Distance(camera.rotation, presentedRotation) < 0.001);
      for (let time = 544; time <= 992; time += 16) {
        pan.restore(); cover.advance(time); apply(); scene.render();
      }
      assertOutside();
      cover.afterRender(true, true); cover.flush(true);
      cover.afterRender(true, true); cover.afterRender(true, true);
    }
    for (let time = 1008; time < 1700; time += 16) {
      pan.restore(); cover.advance(time); apply(); scene.render(); assertStars();
    }
    assert.equal(cover.phase, "idle");
    assert.equal(camera.position.z, -2400);
    assert.deepEqual([...pan.stars.mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind)!], starVertices);
    pan.dispose(); scene.dispose(); engine.dispose();
  });
}
