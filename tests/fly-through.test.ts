import assert from "node:assert/strict";
import { test } from "node:test";
import * as BABYLON from "@babylonjs/core";
import { RemeshCover } from "../src/components/ParticleCanvas/RemeshCover";
import { RemeshFlyThrough } from "../src/components/ParticleCanvas/RemeshFlyThrough";
import type { Particle } from "../src/components/ParticleCanvas/types";

type Sample = { position: BABYLON.Vector3; rotation: BABYLON.Vector3; forward: BABYLON.Vector3 };
function assertFlight(samples: Sample[], label: string, minimum = 40) {
  for (const axis of ["x", "y", "z"] as const) {
    const positions = samples.map(s => s.position[axis]);
    const angles = samples.map(s => s.rotation[axis]);
    assert(Math.max(...positions) - Math.min(...positions) > minimum, `${label}: no ${axis} travel`);
    assert(Math.max(...angles) - Math.min(...angles) > 0.008, `${label}: no ${axis} rotation`);
  }
  let forwardDistance = 0;
  for (let i = 1; i < samples.length; i++) {
    const step = samples[i].position.subtract(samples[i - 1].position);
    const nose = samples[i].forward.add(samples[i - 1].forward).normalize();
    if (step.length() < 0.01) continue;
    const alignment = BABYLON.Vector3.Dot(step.normalizeToNew(), nose);
    assert(alignment > 0.9, `${label}: forward/heading alignment ${alignment} at frame ${i} (sideways or backwards travel)`);
    forwardDistance += BABYLON.Vector3.Dot(step, nose);
  }
  assert(forwardDistance > minimum * 2, `${label}: must thrust along the look direction`);
  assert(samples.some(s => BABYLON.Vector3.Dot(s.forward, samples[0].forward) < 0.999), `${label}: must turn while moving`);
  const moving = samples.slice(1).filter((s, i) => BABYLON.Vector3.Distance(s.position, samples[i].position) > 0.01);
  assert(moving.length >= samples.length - 2, `${label}: camera stopped during flight`);
}

for (const width of [390, 1200, 2400]) for (const reduced of [false, true]) {
  test(`first-person flight hides every remesh frame at width ${width}, reduced ${reduced}`, () => {
    const engine = new BABYLON.NullEngine({ renderWidth: width, renderHeight: 800, textureSize: 256, deterministicLockstep: false, lockstepMaxSteps: 4 });
    const scene = new BABYLON.Scene(engine);
    const camera = new BABYLON.TargetCamera("camera", new BABYLON.Vector3(150, 200, -1500), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.fov = Math.PI / 3;
    camera.minZ = 0.5;
    camera.maxZ = 50000;
    const body = BABYLON.MeshBuilder.CreateSphere("real-planet", { diameter: 500 }, scene);
    const positions = new Float32Array([-400, -600, -300, 800, 400, 500]);
    const colors = new Float32Array(8).fill(1);
    const particles = Array.from({ length: 2 }, () => ({ isCosmicAmbient: false } as Particle));
    const entities = [{ type: "planet" as const, x: width / 2, y: 400, z: 0, radius: 250, color: "#fff" }];
    const flight = new RemeshFlyThrough(scene, camera);
    const cover = new RemeshCover();
    cover.reducedMotion = reduced;
    let mutations = 0;
    cover.request("test", () => { assertOutside(); mutations++; });
    const apply = () => flight.apply(cover, entities, width, 800, particles, positions, colors);
    const starVertices = [...flight.stars.mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind)!];
    const assertStars = () => {
      const planes = BABYLON.Frustum.GetPlanes(camera.getTransformationMatrix());
      let visible = 0;
      // The distant shell must remain populated even without nearby stars.
      for (let i = 0; i < 7000 * 3; i += 3) {
        const world = new BABYLON.Vector3(starVertices[i], starVertices[i + 1], starVertices[i + 2]).add(camera.position);
        if (planes.every(p => p.dotCoordinate(world) >= 0)) visible++;
      }
      assert(visible > 100, `only ${visible} distant stars in the frustum`);
      assert(flight.stars.mesh.isEnabled());
      assert.equal(scene.meshes.length, 2, "no replacement moon, plane, or cover geometry");
    };
    const assertOutside = () => {
      assert(flight.coverage().occluded, JSON.stringify(flight.coverage()));
      // Independent Babylon frustum checks, not the controller's safety flag.
      const planes = BABYLON.Frustum.GetPlanes(camera.getTransformationMatrix());
      assert.equal(body.isInFrustum(planes), false);
      for (let i = 0; i < positions.length; i += 3) {
        const point = new BABYLON.Vector3(positions[i], positions[i + 1], positions[i + 2]);
        assert(planes.some(p => p.dotCoordinate(point) < 0), "remappable particle in view");
      }
      assertStars();
    };
    let now = 0;
    const frameMs = width === 2400 ? 64 : width === 1200 ? 32 : 16;
    const journey: Sample[] = [];
    const sample = (): Sample => ({ position: camera.position.clone(), rotation: camera.rotation.clone(), forward: camera.getForwardRay().direction.clone() });
    const tick = () => {
      flight.restore(); cover.advance(now); now += frameMs; apply(); scene.render(); assertStars();
      const frame = sample();
      journey.push(frame);
      return frame;
    };
    const departure: Sample[] = [];
    do { departure.push(tick()); cover.flush(flight.coverage().occluded); } while (cover.flightProgress < 1);
    assert.equal(mutations, 0, "must present an off-frustum frame before remapping");
    if (!reduced) {
      assertFlight(departure, "departure");
      const early = Math.floor(departure.length * 0.15), late = Math.floor(departure.length * 0.6);
      const initialStep = BABYLON.Vector3.Distance(departure[1].position, departure[0].position);
      const thrustStep = BABYLON.Vector3.Distance(departure[late].position, departure[late - 1].position);
      assert(thrustStep > initialStep * 4, "accelerate into depth before the turn");
      const a = departure[early].position.subtract(departure[0].position).normalize();
      const b = departure.at(-1)!.position.subtract(departure[late].position).normalize();
      assert(BABYLON.Vector3.Cross(a, b).length() > 0.2, "departure must curve through depth, not linearly slide");
    }
    assertOutside();
    cover.afterRender(true, true); cover.flush(true);
    assert.equal(mutations, 1);
    flight.restore();
    camera.position.set(-800, 400, -2400);
    camera.setTarget(new BABYLON.Vector3(100, -50, 200));
    const destinationRotation = camera.rotation.clone();
    // Expanded destination geometry and a new FOV must be excluded immediately.
    body.position.set(3500, -1500, 900);
    positions[0] = 9000;
    camera.fov = 1.4;
    apply(); scene.render(); assertOutside();
    const cruise: Sample[] = [];
    for (let i = 0; i < 40; i++) {
      cruise.push(tick()); assertOutside();
      cover.afterRender(false, true); // Delayed formation cannot stop the flight or reveal the scene.
      assert.equal(cover.phase, "settling");
    }
    if (!reduced) assertFlight(cruise, "off-frustum remesh corridor", 20);
    else assert(BABYLON.Vector3.Distance(cruise[0].position, cruise.at(-1)!.position) < 0.001, "reduced motion cuts without cruising");
    cover.afterRender(true, true); cover.afterRender(true, true);
    assert.equal(cover.phase, "returning");
    const approach: Sample[] = [];
    while (cover.phase !== "idle") approach.push(tick());
    if (!reduced) {
      assertFlight(approach, "approach");
      assertFlight(journey, "complete flight including phase handoffs");
    }
    else {
      for (const s of approach) assert(BABYLON.Vector3.Distance(s.position, new BABYLON.Vector3(-800, 400, -2400)) < 6, "cut settle stays tiny");
    }
    assert.deepEqual(camera.position.asArray(), [-800, 400, -2400]);
    assert(BABYLON.Vector3.Distance(camera.rotation, destinationRotation) < 0.00001);

    if (!reduced) {
      cover.request("another", () => {});
      do { tick(); cover.afterRender(true, flight.coverage().occluded); cover.flush(flight.coverage().occluded); } while (cover.phase !== "returning");
      for (let i = 0; i < 4; i++) tick();
      const interrupted = sample();
      cover.request("interrupt", () => assertOutside());
      tick();
      assert(BABYLON.Vector3.Distance(camera.position, interrupted.position) < 0.001, "interrupted arrival starts at the presented position");
      assert(BABYLON.Vector3.Distance(camera.rotation, interrupted.rotation) < 0.001, "interrupted arrival preserves orientation");
      let frames = 0;
      do {
        tick();
        if (cover.covered) assertOutside();
        cover.afterRender(true, flight.coverage().occluded); cover.flush(flight.coverage().occluded);
        assert(++frames < 200, "interrupted flight completes");
      } while (cover.phase !== "idle");
    }
    assert.deepEqual([...flight.stars.mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind)!], starVertices);
    flight.dispose(); scene.dispose(); engine.dispose();
  });
}
