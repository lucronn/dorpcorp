import assert from "node:assert/strict";
import { test } from "node:test";
import { RemeshCover, settleRemappedParticle } from "../src/components/ParticleCanvas/RemeshCover";
import { mapParticlesToInterstellar } from "../src/components/ParticleCanvas/ParticleMapper";
import { simulateParticles, type SimulationContext } from "../src/components/ParticleCanvas/ParticleSimulationEngine";
import { initializeParticleVolume, updateBackgroundVolumeTarget } from "../src/components/ParticleCanvas/ParticleVolume";
import { transitionToNewEntities } from "../src/components/ParticleCanvas/TransitionManager";
import { buildSpiralGalaxyScene } from "../src/components/ParticleCanvas/scenes/spiral_galaxy";
import { buildBinaryPlanetsScene } from "../src/components/ParticleCanvas/scenes/binary_planets";
import { buildExoplanetClusterScene } from "../src/components/ParticleCanvas/scenes/exoplanet_cluster";
import { buildNebulaCradleScene } from "../src/components/ParticleCanvas/scenes/nebula_cradle";
import { buildBlackholeCentricScene } from "../src/components/ParticleCanvas/scenes/blackhole_centric";
import type { Particle, CelestialEntity } from "../src/components/ParticleCanvas/types";

const particle = (): Particle => ({ x: -3000, y: 2500, z: -900, targetX: 10, targetY: 20, targetZ: 30,
  vx: 50, vy: -60, vz: 80, color: "#ffffff", baseColor: "#ffffff", size: 1 });

function seeded(seed = 194) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

function context(entities: CelestialEntity[]): SimulationContext {
  return { currentW: 1200, currentH: 800, time: 0, globalTimeMultiplier: 1,
    musicAmpVal: 0, musicBands: { bass: 0, mid: 0, treble: 0 }, musicSpeedFactor: 1,
    activeBlackholes: [], activeCollidables: entities.filter(e => e.type === "planet"), activeSupernova: null,
    snElapsed: 10000, scrollVelocity: 0, ambientParticleSpeed: 0.15, objectParticleSpeed: 0.15, textParticleSpeed: 0.12,
    particleFilters: { ambient: true, celestial: true, bridges: true, tails: true, typography: true },
    globalAlpha: 1, isTypographyMode: false, isInterstellar: true, vortexMultiplier: 0,
    attractionMultiplier: 1, mousePos: { x: -99999, y: -99999 }, celestialEntities: entities,
    spawnTailParticle: () => {}, screensaverOpacity: 0, isTransitActive: false, transitProgress: 0,
    transitCx: 600, transitCy: 400, activeRipples: [], audio: {} };
}

function step(particles: Particle[], ctx: SimulationContext) {
  const positions = new Float32Array(particles.length * 3);
  simulateParticles(particles, positions, new Float32Array(particles.length * 4), new Float32Array(particles.length), ctx);
  assert(positions.every(Number.isFinite));
  return positions;
}

// A tilted sheet has nonzero X/Y/Z spreads but zero covariance determinant.
function assertVolume(points: number[][], minDet = 0.00015) {
  assert(points.length > 100);
  const means = [0, 1, 2].map(axis => points.reduce((sum, p) => sum + p[axis], 0) / points.length);
  const cov = [0, 1, 2].map(a => [0, 1, 2].map(b => points.reduce((sum, p) => sum + (p[a] - means[a]) * (p[b] - means[b]), 0) / points.length));
  const trace = cov[0][0] + cov[1][1] + cov[2][2];
  const [a, b, c] = cov;
  const determinant = a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  assert(cov[1][1] / trace > 0.035, `Y variance / total = ${cov[1][1] / trace}`);
  assert(determinant / trace ** 3 > minDet, `volume determinant = ${determinant / trace ** 3}`);
}

for (const reduced of [false, true]) {
  test(`remaps wait for a rendered pan/veil and two formed frames (reduced motion ${reduced})`, () => {
    const cover = new RemeshCover();
    cover.reducedMotion = reduced;
    const particles = [particle()];
    let writes = 0;
    cover.request("particles", () => {
      assert(cover.isCovered(!reduced), "target writes must occur behind the moon or veil");
      particles[0].targetX = 999;
      cover.remapped(particles);
      writes++;
    });
    cover.advance(0);
    cover.advance(9000);
    assert(cover.panProgress < 0.2, "a stalled tab cannot skip the departure");
    assert.equal(writes, 0);
    cover.flush(true);
    assert.equal(writes, 0, "coverage must actually render before remapping");
    cover.afterRender(true, !reduced);
    cover.flush(!reduced);
    assert.equal(writes, 1);
    assert.equal(cover.opacity, reduced ? 1 : 0, "normal motion never needs a black overlay");
    cover.afterRender(false, !reduced);
    cover.advance(15000);
    assert.equal(cover.phase, "settling", "elapsed time cannot reveal pending work");
    settleRemappedParticle(particles[0]);
    cover.afterRender(true, !reduced);
    assert.equal(cover.phase, "settling", "one formed frame is insufficient");
    cover.afterRender(true, !reduced);
    assert.equal(cover.phase, "returning");
    for (let now = 15016; now < 16000; now += 16) cover.advance(now);
    assert.equal(cover.phase, "idle");
    assert.equal(cover.opacity, 0);
    assert.equal(particles[0].vx, 0);
    assert.equal(particles[0].x, 999);
  });
}

test("coverage loss, rapid navigation and reversed return cannot expose pending work", () => {
  const cover = new RemeshCover();
  const particles = [particle()];
  let selected = "old";
  cover.request("scene", () => { selected = "stale"; });
  cover.cancelPending();
  cover.request("scene", () => { selected = "latest"; cover.remapped(particles); });
  cover.afterRender(true, true);
  cover.flush(false);
  assert.equal(selected, "old", "resize/camera coverage must be revalidated before mutations");
  cover.flush(true);
  assert.equal(selected, "latest");
  cover.afterRender(true, false);
  cover.afterRender(true, true);
  assert.equal(cover.phase, "settling", "coverage loss resets formed-frame count");
  cover.afterRender(true, true);
  assert.equal(cover.phase, "returning");
  cover.request("scene", () => cover.remapped(particles));
  cover.advance(60000);
  cover.afterRender(false, false);
  cover.flush(false);
  assert.equal(cover.phase, "panning");
  assert.equal(cover.pendingJobs, 1);
});

test("reduced motion can be enabled during a pan without a long hold", () => {
  const cover = new RemeshCover();
  cover.request("scene", () => {});
  cover.advance(0);
  cover.advance(32);
  cover.reducedMotion = true;
  cover.advance(48);
  assert.equal(cover.mode, "veil");
  assert.equal(cover.opacity, 1);
  cover.afterRender(true, false);
  cover.flush(false);
  cover.afterRender(true, false);
  cover.afterRender(true, false);
  cover.advance(108);
  assert.equal(cover.phase, "idle");
});

test("new entities are already full size at their final XYZ behind occlusion", () => {
  const current: CelestialEntity[] = [{ type: "planet", x: 0, y: 0, radius: 20, color: "#fff", isOutgoing: true }];
  const active = { current: true }, started = { current: 100 };
  transitionToNewEntities(current, [{ type: "galaxy", x: 50, y: 80, z: 120, radius: 40, scale: 0.02, color: "#fff" }], 0, 0, active, started);
  assert.equal(current.length, 1);
  assert.deepEqual([current[0].x, current[0].y, current[0].z, current[0].scale], [50, 80, 120, 1]);
  assert.equal(active.current, false);
});

const layouts = [
  ["SPIRAL_GALAXY", buildSpiralGalaxyScene, ["galaxy"]],
  ["BINARY_PLANETS", buildBinaryPlanetsScene, ["planet", "ring", "nebula"]],
  ["EXOPLANET_CLUSTER", buildExoplanetClusterScene, ["planet", "star"]],
  ["NEBULA_CRADLE", buildNebulaCradleScene, ["nebula"]],
  ["BLACKHOLE_CENTRIC", buildBlackholeCentricScene, ["blackhole"]],
] as const;

for (const [archetype, build, types] of layouts) {
  for (const width of [390, 1200]) {
    test(`${archetype} has persistent volume at width ${width}, including during simulation`, () => {
      const random = Math.random;
      Math.random = seeded();
      try {
        const entities = build(width, 800, width < 768).entities;
        const particles = Array.from({ length: 6000 }, particle);
        mapParticlesToInterstellar(width, 800, { current: entities }, { current: archetype }, { current: particles }, { current: -1 }, -1);
        const cover = new RemeshCover();
        cover.request("particles", () => cover.remapped(particles));
        cover.afterRender(true, true); cover.flush(true);
        const ctx = context(entities);
        ctx.currentW = width;
        // Even at speed zero the hidden remap must finish, including typography.
        ctx.objectParticleSpeed = 0;
        const positions = step(particles, ctx);
        assert(particles.every(p => !p.needsRemesh));
        assert(cover.covered);
        assert.equal(cover.opacity, 0);
        for (let i = 0; i < particles.length; i++) {
          assert(Math.abs(positions[i * 3 + 1] + particles[i].targetY - 400) < 0.001);
        }
        const check = () => {
          for (const type of types) {
            const subset = particles.filter(p => type === "ring" ? p.isPlanetRing : p.interstellarType === type && !p.isPlanetRing);
            assertVolume(subset.map(p => [p.targetX - p.interstellarEntity.x, p.targetY - p.interstellarEntity.y, (p.targetZ ?? 0) - (p.interstellarEntity.z ?? 0)]));
            assertVolume(subset.map(p => [p.x - p.interstellarEntity.x, p.y - p.interstellarEntity.y, p.z - (p.interstellarEntity.z ?? 0)]));
          }
        };
        check();
        ctx.objectParticleSpeed = 0.15;
        for (let frame = 1; frame <= 90; frame++) { ctx.time = frame; step(particles, ctx); }
        check();
      } finally { Math.random = random; }
    });
  }
}

test("miniature spiral and elliptical background galaxies occupy 3D volume", () => {
  for (const galaxyType of ["spiral", "elliptical"] as const) {
    const random = seeded();
    const particles = Array.from({ length: 2000 }, (_, i) => {
      const p = { ...particle(), interstellarType: "background_galaxy" as const, galaxyType, orbitRadius: 10 + random() * 180, orbitAngle: random() * Math.PI * 2 };
      initializeParticleVolume(p, i, random);
      updateBackgroundVolumeTarget(p);
      return p;
    });
    assertVolume(particles.map(p => [p.targetX, p.targetY, p.targetZ!]));
  }
});

test("resize work maps after replacement entities and coverage loss fails closed", () => {
  const cover = new RemeshCover();
  const order: string[] = [];
  cover.request("particles", () => order.push("particles"));
  cover.request("entities", () => order.push("entities"));
  cover.afterRender(true, true);
  cover.flush(true);
  assert.deepEqual(order, ["entities", "particles"]);
  cover.protect(false);
  assert.equal(cover.mode, "veil");
  assert.equal(cover.opacity, 1);
});

test("superseding a departure with an FX request can finish the canceled pan", () => {
  const cover = new RemeshCover();
  cover.request("entities", () => assert.fail("superseded work must not run"));
  cover.cancelPending();
  cover.afterRender(true, true);
  cover.flush(true);
  cover.afterRender(true, true);
  cover.afterRender(true, true);
  cover.advance(0);
  cover.advance(64);
  assert.equal(cover.phase, "idle");
});
