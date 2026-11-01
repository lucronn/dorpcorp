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
  test(`cover holds during reassignment, dispersion and settling (reduced motion ${reduced})`, () => {
    const writes: number[] = [];
    const cover = new RemeshCover(opacity => writes.push(opacity));
    cover.reducedMotion = reduced;
    const particles = [particle()];
    cover.begin(0);
    assert.equal(writes.at(-1), 1, "cover is synchronous before target changes");
    particles[0].targetX = 999;
    cover.afterRender(false, 9000);
    assert.equal(cover.opacity, 1, "elapsed time cannot reveal a remapping scene");
    cover.remapped(particles);
    cover.afterRender(false, 15000);
    assert.equal(cover.opacity, 1, "unsettled particles remain fully occluded");
    settleRemappedParticle(particles[0]);
    cover.afterRender(true, 16000);
    assert.equal(cover.phase, "settling", "one frame is insufficient");
    cover.afterRender(true, 16016);
    assert.equal(cover.phase, "revealing");
    assert.equal(cover.opacity, 1);
    cover.afterRender(true, 16200);
    assert.equal(cover.phase, "idle");
    assert.equal(cover.opacity, 0);
    assert.equal(particles[0].vx, 0);
    assert.equal(particles[0].x, 999);
  });
}

test("rapid remap restarts cover; a stalled/backgrounded frame never unmasks pending work", () => {
  const cover = new RemeshCover();
  const particles = [particle()];
  cover.begin(0); cover.remapped(particles);
  cover.afterRender(true, 120); cover.afterRender(true, 136); cover.afterRender(true, 200);
  assert(cover.opacity < 1);
  cover.begin(210); cover.remapped(particles);
  cover.afterRender(false, 60000);
  assert.equal(cover.opacity, 1);
  cover.afterRender(true, 60016);
  assert.equal(cover.phase, "settling");
});

test("new entities are already full size at their final XYZ under the cut", () => {
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
        cover.begin(0); cover.remapped(particles);
        const ctx = context(entities);
        ctx.currentW = width;
        // Even at speed zero the hidden remap must finish, including typography.
        ctx.objectParticleSpeed = 0;
        const positions = step(particles, ctx);
        assert(particles.every(p => !p.needsRemesh));
        assert.equal(cover.opacity, 1);
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
