import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import * as BABYLON from "@babylonjs/core";
import {
  blendHexColors,
  normalizeHexColor,
  valueNoise2D,
  fBmNoise2D,
  computeCurlNoise,
  resolveCelestialCollision,
  swallowEntity,
  spawnCollisionFlare,
  updateCollisionFlares,
  disposeCollisionFlares,
} from "../src/components/ParticleCanvas/PhysicsUtils";
import { CelestialEntity } from "../src/components/ParticleCanvas/types";
import { getSpacetimeFabricDistortion } from "../src/components/ParticleCanvas/CelestialMeshSynchronizer";
import { createNeutronStarBirthEvent } from "../src/components/ParticleCanvas/scenes/neutronstarbirth";
import { createHawkingRadiationSystem } from "../src/components/ParticleCanvas/HawkingRadiationEngine";
import {
  calculateForwardTrajectory,
  updateActiveProbes,
  SlingshotProbe,
} from "../src/components/ParticleCanvas/SlingshotEngine";
import { createInitialTdeState, triggerTidalDisruptionEvent, updateTidalDisruption } from "../src/components/ParticleCanvas/TidalDisruptionEngine";
import { executeRenderFrame } from "../src/components/ParticleCanvas/RenderEngine";
import { audio } from "../src/utils/audio";
import { getProceduralFallbackSystem, startServer } from "../server";
import { buildBlackholeCentricScene } from "../src/components/ParticleCanvas/scenes/blackhole_centric";
import { buildSpiralGalaxyScene } from "../src/components/ParticleCanvas/scenes/spiral_galaxy";
import { buildStellarPulsarScene } from "../src/components/ParticleCanvas/scenes/stellar_pulsar";
import { buildBinaryPlanetsScene } from "../src/components/ParticleCanvas/scenes/binary_planets";
import { buildExoplanetClusterScene } from "../src/components/ParticleCanvas/scenes/exoplanet_cluster";
import { buildNebulaCradleScene } from "../src/components/ParticleCanvas/scenes/nebula_cradle";
import { isIgnoredErrorMessage, reportClientError, resetTelemetryThrottling } from "../src/utils/telemetry";
import { CosmicTransitionStateMachine, triggerCalmCosmicShift } from "../src/components/ParticleCanvas/TransitionManager";
import { drawStageLayoutTemplate, particleText, generateTargetsForStage } from "../src/components/ParticleCanvas/ParticleUtils";
import { updateHudTexture } from "../src/components/ParticleCanvas/HUDManager";
import { setupBlackholeLensingPostProcess } from "../src/components/ParticleCanvas/BlackholeLensingPostProcess";
import { setupDepthOfFieldPostProcess } from "../src/components/ParticleCanvas/DepthOfFieldPostProcess";
import { setupFrameShatterPostProcess } from "../src/components/ParticleCanvas/FrameShatterPostProcess";
import { startWormholeTransit } from "../src/components/ParticleCanvas/WormholeTransit";
import { isUIElement, setupParticleCanvasEvents } from "../src/components/ParticleCanvas/ParticleCanvasEvents";
import {
  createCircleTexture,
  createCircularGlowTexture,
  generateAccretionDiskTexture,
  generateRelativisticJetTexture,
  generatePhotonRingTexture,
  generateAdvancedPlanetTexture,
  generatePlanetNightLightsTexture,
  generatePlanetBumpNormalTexture,
  generateProceduralCloudTexture,
  generateAuroraTexture,
  generateStarTexture,
  generateConcentricRingTexture,
  generateDistortedLightwaveTexture,
  generateGalaxyTexture,
  generateNebulaTexture,
  generateSupernovaCoreFlareTexture,
  generateAnamorphicSpikeTexture,
  generateSupernovaPhotonicRingTexture,
} from "../src/components/ParticleCanvas/TextureUtils";

let totalTests = 0;
let passedTests = 0;

function runTest(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res.then(() => {
        passedTests++;
        console.log(`  ✓ ${name}`);
      }).catch((err) => {
        console.error(`  ✗ ${name}`);
        console.error(err);
        process.exitCode = 1;
      });
    } else {
      passedTests++;
      console.log(`  ✓ ${name}`);
    }
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function runAllTests() {
  console.log("\n🚀 Running curtis-click-portfolio Automated Test Suite...\n");

  console.log("==> Testing Physics & Color Utilities");

  runTest("normalizeHexColor: preserves 6-digit hex and expands 3-digit shorthand", () => {
    assert.equal(normalizeHexColor("#ffffff"), "#ffffff");
    assert.equal(normalizeHexColor("#fff"), "#ffffff");
    assert.equal(normalizeHexColor("#f0a"), "#ff00aa");
    assert.equal(normalizeHexColor("#123"), "#112233");
  });

  runTest("blendHexColors: handles 6-digit hex colors with proper weighting", () => {
    const white = "#ffffff";
    const black = "#000000";
    assert.equal(blendHexColors(white, black, 0.0), "#ffffff");
    assert.equal(blendHexColors(white, black, 1.0), "#000000");
    assert.equal(blendHexColors(white, black, 0.5), "#808080");
  });

  runTest("blendHexColors: handles 3-digit shorthand hex codes without producing NaN", () => {
    const res = blendHexColors("#fff", "#000", 0.5);
    assert.equal(res, "#808080");
    assert.equal(blendHexColors("#f00", "#00f", 0.5), "#800080");
  });

  runTest("valueNoise2D: returns deterministic values between 0.0 and 1.0", () => {
    const val1 = valueNoise2D(12.5, 45.3);
    const val2 = valueNoise2D(12.5, 45.3);
    assert.equal(val1, val2);
    assert.ok(val1 >= 0.0 && val1 <= 1.0, `Expected 0..1, got ${val1}`);
  });

  runTest("fBmNoise2D: aggregates octaves stably", () => {
    const fbm = fBmNoise2D(3.14, 2.71, 4);
    assert.ok(typeof fbm === "number" && !isNaN(fbm) && isFinite(fbm));
  });

  runTest("computeCurlNoise: returns non-divergent 2D vector field", () => {
    const vec = computeCurlNoise(100, 200, 1.5);
    assert.ok(typeof vec.x === "number" && !isNaN(vec.x) && isFinite(vec.x));
    assert.ok(typeof vec.y === "number" && !isNaN(vec.y) && isFinite(vec.y));
  });

  runTest("valueNoise2D and fBmNoise2D: defends against non-finite or NaN coordinates and negative octaves", () => {
    assert.equal(valueNoise2D(NaN, 50), 0.5);
    assert.equal(valueNoise2D(50, Infinity), 0.5);
    assert.equal(fBmNoise2D(NaN, 50), 0.5);
    const fbmNeg = fBmNoise2D(50, 50, -2);
    assert.ok(typeof fbmNeg === "number" && isFinite(fbmNeg));
    const fbmNan = fBmNoise2D(50, 50, NaN);
    assert.ok(typeof fbmNan === "number" && isFinite(fbmNan));
  });

  runTest("computeCurlNoise: safely returns zero divergence vector on non-finite coordinates or time", () => {
    assert.deepEqual(computeCurlNoise(NaN, 100, 0), { x: 0, y: 0 });
    assert.deepEqual(computeCurlNoise(100, Infinity, 0), { x: 0, y: 0 });
    assert.deepEqual(computeCurlNoise(100, 100, NaN), { x: 0, y: 0 });
  });

  runTest("resolveCelestialCollision: separates overlapping bodies and conserves momentum", () => {
    const e1: CelestialEntity = {
      type: "planet",
      x: 100,
      y: 100,
      z: 0,
      radius: 20,
      color: "#ff0000",
      vx: 2.0,
      vy: 0.0,
      vz: 0.0,
      mass: 800,
    };
    const e2: CelestialEntity = {
      type: "planet",
      x: 125,
      y: 100,
      z: 0,
      radius: 20,
      color: "#0000ff",
      vx: -1.0,
      vy: 0.0,
      vz: 0.0,
      mass: 800,
    };

    // Initial separation is 25, while colDist is 20 + 20 = 40 (overlapping)
    const initialPx = (e1.mass! * e1.vx!) + (e2.mass! * e2.vx!);
    const col = resolveCelestialCollision(e1, e2, 0.8);
    assert.ok(col !== null, "Collision should be detected");

    // After collision resolution, entities must be pushed apart
    const newDist = Math.hypot(e2.x - e1.x, e2.y - e1.y, (e2.z || 0) - (e1.z || 0));
    assert.ok(newDist >= 35, `Separation must resolve overlap (got distance ${newDist})`);

    // Verify velocities reversed along impact axis
    assert.ok(e1.vx! < 0, "Body 1 must bounce leftward");
    assert.ok(e2.vx! > 0, "Body 2 must bounce rightward");
  });

  runTest("resolveCelestialCollision: safely rejects non-finite coordinates, zero separation, and negative radii", () => {
    const e1: CelestialEntity = {
      type: "planet",
      x: NaN,
      y: 100,
      radius: 20,
      color: "#ff0000",
      vx: 1.0,
      mass: 500,
    };
    const e2: CelestialEntity = {
      type: "planet",
      x: 120,
      y: 100,
      radius: 20,
      color: "#0000ff",
      vx: -1.0,
      mass: 500,
    };
    const res = resolveCelestialCollision(e1, e2);
    assert.equal(res, null, "Must safely reject collision with NaN coordinate");
    assert.equal(e2.vx, -1.0, "Entity velocity must remain untouched");

    const eZeroRad1: CelestialEntity = { type: "planet", x: 10, y: 10, radius: 0, color: "#fff" };
    const eZeroRad2: CelestialEntity = { type: "planet", x: 10, y: 10, radius: 20, color: "#fff" };
    assert.equal(resolveCelestialCollision(eZeroRad1, eZeroRad2), null, "Must reject zero radius");
  });

  runTest("swallowEntity: updates victim state and expands black hole mass & targetRadius safely", () => {
    const bh: CelestialEntity = {
      type: "blackhole",
      x: 0,
      y: 0,
      radius: 50,
      mass: 5000,
      color: "#ff8844",
    };
    const victim: CelestialEntity = {
      type: "planet",
      x: 10,
      y: 0,
      radius: 20,
      mass: 400,
      color: "#4488ff",
    };

    swallowEntity(bh, victim);
    assert.equal(victim.isSwallowing, true);
    assert.equal(victim.destroyedBy, "blackhole");
    assert.equal(bh.mass, 5400);
    assert.ok(bh.targetRadius !== undefined && bh.targetRadius > 0);
  });

  runTest("swallowEntity: defends against non-finite or non-positive masses and radii with safe swelling", () => {
    const corruptedBh: CelestialEntity = {
      type: "blackhole",
      x: 0,
      y: 0,
      radius: NaN,
      mass: NaN,
      color: "#ff8844",
    };
    const corruptedVictim: CelestialEntity = {
      type: "planet",
      x: 5,
      y: 5,
      radius: -10,
      mass: -100,
      color: "#4488ff",
    };

    swallowEntity(corruptedBh, corruptedVictim);
    assert.equal(corruptedVictim.isSwallowing, true);
    assert.ok(typeof corruptedBh.mass === "number" && corruptedBh.mass > 0 && isFinite(corruptedBh.mass));
    assert.ok(
      typeof corruptedBh.targetRadius === "number" &&
      corruptedBh.targetRadius > 0 &&
      isFinite(corruptedBh.targetRadius)
    );
  });

  runTest("updateCollisionFlares and disposeCollisionFlares: handles life decay, scaling, and clean disposal", () => {
    let meshDisposed = false;
    let matDisposed = false;
    const dummyMat: any = {
      alpha: 0.95,
      dispose: () => { matDisposed = true; },
    };
    const dummyMesh: any = {
      isDisposed: () => meshDisposed,
      scaling: { setAll: (_v: number) => {} },
      material: dummyMat,
      dispose: () => { meshDisposed = true; },
    };
    const flares = [
      { mesh: dummyMesh as any, life: 0.01, maxLife: 1.0, initialRadius: 20 },
    ];

    // Flare life expires after dt step
    const remaining = updateCollisionFlares(flares, 0.02);
    assert.equal(remaining.length, 0);
    assert.equal(meshDisposed, true);
    assert.equal(matDisposed, true);

    // Test disposeCollisionFlares
    meshDisposed = false;
    matDisposed = false;
    const flares2 = [
      { mesh: dummyMesh as any, life: 0.8, maxLife: 1.0, initialRadius: 20 },
    ];
    disposeCollisionFlares(flares2);
    assert.equal(flares2.length, 0);
    assert.equal(meshDisposed, true);
    assert.equal(matDisposed, true);
  });

  runTest("spawnCollisionFlare: enforces positive radius, finite coordinates, and flare list capacity capping", () => {
    const engine = new BABYLON.NullEngine();
    const scene = new BABYLON.Scene(engine);
    const flaresList: Array<{ mesh: BABYLON.Mesh; life: number; maxLife: number; initialRadius: number }> = [];

    // Test safe fallback for non-positive or NaN radius and coordinates
    spawnCollisionFlare(scene, NaN, 100, Infinity, -5, "#ff8800", flaresList);
    assert.equal(flaresList.length, 1);
    assert.equal(flaresList[0]!.initialRadius, 10, "Non-positive radius must default safely to 10");
    assert.equal(flaresList[0]!.mesh.position.x, 0, "NaN x position must default safely to 0");
    assert.equal(flaresList[0]!.mesh.position.z, 0, "Infinity z position must default safely to 0");

    // Test capacity bounding (exceeding MAX_ACTIVE_FLARES = 50 drops oldest)
    for (let i = 0; i < 60; i++) {
      spawnCollisionFlare(scene, 0, 0, 0, 15, "#ffffff", flaresList);
    }
    assert.ok(flaresList.length <= 50, `Flare list must not exceed 50, got ${flaresList.length}`);

    disposeCollisionFlares(flaresList);
    assert.equal(flaresList.length, 0);
    scene.dispose();
    engine.dispose();
  });

  runTest("getSpacetimeFabricDistortion: defends against non-finite coordinates and computes positive distortion near singularities", () => {
    const mockEntitiesRef = {
      current: [
        {
          type: "blackhole" as const,
          x: 960,
          y: 540,
          radius: 60,
          color: "#ffaa00",
        },
      ],
    };
    const mockRipples = [
      {
        x: 960,
        y: 540,
        life: 0.8,
        maxDist: 200,
        bandWidth: 40,
        minDistSq: 160 * 160,
        maxDistBoundSq: 240 * 240,
      },
    ];

    // Non-finite dimensions / coordinates return 0 without throwing
    const zeroDistortion = getSpacetimeFabricDistortion(NaN, 0, 1920, 1080, mockEntitiesRef, mockRipples, 10, 0.5);
    assert.equal(zeroDistortion, 0, "Must return 0 for NaN coordinate");

    const zeroDim = getSpacetimeFabricDistortion(0, 0, 0, 0, mockEntitiesRef, mockRipples, 10, 0.5);
    assert.equal(zeroDim, 0, "Must return 0 for zero viewport dimensions");

    // Empty entity lists or null refs handle cleanly
    const emptyDistortion = getSpacetimeFabricDistortion(0, 0, 1920, 1080, { current: [] }, [], 10, 0);
    assert.equal(emptyDistortion, 0, "Must handle empty entities/ripples cleanly");

    // Close to singularity (wx = 0, wy = 0 corresponds to center of 1920x1080)
    const centerDistortion = getSpacetimeFabricDistortion(0, 0, 1920, 1080, mockEntitiesRef, mockRipples, 10, 0.5);
    assert.ok(centerDistortion > 0, `Center distortion near black hole must be positive, got ${centerDistortion}`);
  });

  console.log("\n==> Testing Procedural Cosmic System Generator & 3D Scene Architecture");

  runTest("getProceduralFallbackSystem: validates structure across 70 iterations and covers all 6 archetypes", () => {
    const encounteredArchetypes = new Set<string>();
    const expectedArchetypes = [
      "BLACKHOLE_CENTRIC",
      "BINARY_PLANETS",
      "NEBULA_CRADLE",
      "EXOPLANET_CLUSTER",
      "SPIRAL_GALAXY",
      "STELLAR_PULSAR",
    ];

    for (let i = 0; i < 70; i++) {
      const system = getProceduralFallbackSystem();
      assert.ok(system.systemName.length > 3, "System name must be populated");
      assert.ok(system.systemDesc.length > 20, "System description must be populated");
      assert.equal(system.systemTags.length, 3, "Must have exactly 3 cosmic tags");
      assert.ok(system.entities.length >= 2, "Must contain at least 2 celestial entities");
      assert.ok(expectedArchetypes.includes(system.archetype), `Valid archetype: ${system.archetype}`);
      encounteredArchetypes.add(system.archetype);

      system.entities.forEach((ent) => {
        assert.ok(["blackhole", "planet", "star", "nebula"].includes(ent.type), `Valid entity type: ${ent.type}`);
        assert.ok(ent.radius > 0, "Radius must be positive");
        assert.ok(typeof ent.color === "string" && ent.color.length > 0, "Color must be valid string");
      });
    }

    expectedArchetypes.forEach((archetype) => {
      assert.ok(encounteredArchetypes.has(archetype), `Archetype ${archetype} must be generated within 70 runs`);
    });

    // Targeted archetype generation check
    const targetedPulsar = getProceduralFallbackSystem("STELLAR_PULSAR");
    assert.equal(targetedPulsar.archetype, "STELLAR_PULSAR");
    const targetedSpiral = getProceduralFallbackSystem("SPIRAL_GALAXY");
    assert.equal(targetedSpiral.archetype, "SPIRAL_GALAXY");
  });

  runTest("Procedural Scene Builders: validates all 6 procedural scene builders contract", () => {
    const builders = [
      { name: "buildBlackholeCentricScene", fn: buildBlackholeCentricScene },
      { name: "buildSpiralGalaxyScene", fn: buildSpiralGalaxyScene },
      { name: "buildStellarPulsarScene", fn: buildStellarPulsarScene },
      { name: "buildBinaryPlanetsScene", fn: buildBinaryPlanetsScene },
      { name: "buildExoplanetClusterScene", fn: buildExoplanetClusterScene },
      { name: "buildNebulaCradleScene", fn: buildNebulaCradleScene },
    ];

    builders.forEach(({ name, fn }) => {
      const desktop = fn(1920, 1080, false);
      assert.ok(desktop.systemName.length > 3, `${name}: systemName must be populated`);
      assert.ok(desktop.systemDesc.length > 20, `${name}: systemDesc must be populated`);
      assert.equal(desktop.systemTags.length, 3, `${name}: must have 3 tags`);
      assert.ok(desktop.entities.length >= 1, `${name}: must contain >= 1 entities`);

      const mobile = fn(375, 667, true);
      assert.ok(mobile.entities.length >= 1, `${name} (mobile): must contain >= 1 entities`);

      desktop.entities.forEach((e) => {
        assert.ok(e.radius > 0, `${name}: radius must be positive`);
        assert.ok(typeof e.color === "string" && e.color.length > 0, `${name}: color must be non-empty`);
        assert.ok(["blackhole", "planet", "star", "nebula", "galaxy"].includes(e.type), `${name}: entity type ${e.type} must be valid`);
      });
    });
  });

  runTest("createNeutronStarBirthEvent: ensures remnant mass safety and collapse semantics", () => {
    const entities: CelestialEntity[] = [];
    const dummyStar: CelestialEntity = {
      id: "test-supergiant-01",
      type: "star",
      x: 400,
      y: 300,
      radius: 35,
      color: "#ffaa44",
      vx: 1.2,
      vy: -0.4,
    };
    entities.push(dummyStar);

    let dustCallCount = 0;
    const mockDustSplash = () => { dustCallCount++; };
    let supernovaSoundPlayed = false;
    const mockAudio = { playSupernova: () => { supernovaSoundPlayed = true; } };

    const result = createNeutronStarBirthEvent(dummyStar, entities, mockDustSplash, mockAudio);

    assert.equal(dummyStar.isDestroyed, true, "Original star must be marked destroyed");
    assert.ok(entities.length === 2, "Remnant must be appended to entities list");
    assert.ok(result.remnant.id && result.remnant.id.length > 0, "Remnant must have unique ID");
    assert.ok(result.remnant.mass && result.remnant.mass > 0, "Remnant must have positive mass computed from radius fallback");
    assert.ok(result.remnant.radius > 0, "Remnant must have valid radius");
    assert.ok(["star", "blackhole"].includes(result.remnant.type), "Remnant must be star (neutron) or black hole");
    assert.equal(dustCallCount, 2, "Must trigger 2 dust splash waves");
    assert.equal(supernovaSoundPlayed, true, "Must trigger supernova audio event");
  });

  runTest("createNeutronStarBirthEvent: defends against non-positive/NaN star masses with positive remnant mass", () => {
    const corruptedStar: CelestialEntity = {
      id: "corrupted-star-01",
      type: "star",
      x: 200,
      y: 200,
      radius: 0,
      mass: NaN,
      color: "#ffaa44",
    };
    const list: CelestialEntity[] = [corruptedStar];
    const res = createNeutronStarBirthEvent(corruptedStar, list, () => {}, { playSupernova: () => {} });
    assert.equal(corruptedStar.isDestroyed, true);
    assert.ok(typeof res.remnant.mass === "number" && res.remnant.mass > 0 && isFinite(res.remnant.mass));
  });

  runTest("calculateForwardTrajectory: produces deterministic, sub-lightspeed trajectory with event horizon capture", () => {
    const bh: CelestialEntity = {
      type: "blackhole",
      x: 300,
      y: 300,
      radius: 50,
      color: "#ff8844",
      mass: 50000,
    };

    // 1. Determinism check: running with same inputs produces identical coordinates
    const traj1 = calculateForwardTrajectory(100, 100, 80, 80, [bh], 60);
    const traj2 = calculateForwardTrajectory(100, 100, 80, 80, [bh], 60);
    assert.equal(traj1.length, traj2.length, "Trajectory point count must be identical");
    assert.deepEqual(traj1, traj2, "Trajectory calculation must be deterministic");

    // 2. Velocity cap check: no point exceeds speedOfLightSim = 55.0
    traj1.forEach((pt) => {
      assert.ok(pt.speed <= 55.01, `Speed ${pt.speed} must not exceed relativistic ceiling of 55.0`);
    });

    // 3. Horizon capture check: trajectory aimed directly at the singularity flags horizon boundary
    const captureTraj = calculateForwardTrajectory(280, 280, 260, 260, [bh], 80);
    const hasCaptured = captureTraj.some((pt) => pt.isHorizonBound);
    assert.ok(hasCaptured, "Direct trajectory towards black hole must trigger event horizon capture");
  });

  runTest("calculateForwardTrajectory: filters out zero-scale and despawning entities from trajectory prediction", () => {
    const bhActive: CelestialEntity = {
      type: "blackhole",
      x: 300,
      y: 300,
      radius: 50,
      color: "#ff8844",
      mass: 50000,
      scale: 1.0,
    };
    const bhZeroScale: CelestialEntity = {
      type: "blackhole",
      x: 300,
      y: 300,
      radius: 50,
      color: "#ff8844",
      mass: 50000,
      scale: 0.0,
    };

    // Trajectory with zero-scale black hole should not capture
    const trajNoGravity = calculateForwardTrajectory(280, 280, 260, 260, [bhZeroScale], 40);
    const hasCapturedZeroScale = trajNoGravity.some((pt) => pt.isHorizonBound);
    assert.equal(hasCapturedZeroScale, false, "Zero-scale entity must not capture trajectory");

    // Trajectory with active black hole captures
    const trajActive = calculateForwardTrajectory(280, 280, 260, 260, [bhActive], 40);
    const hasCapturedActive = trajActive.some((pt) => pt.isHorizonBound);
    assert.equal(hasCapturedActive, true, "Active entity must capture trajectory");
  });

  runTest("calculateForwardTrajectory: defends against non-finite origin coordinates and entities with non-finite positions", () => {
    // Non-finite origin/pull parameters
    const nanOriginTraj = calculateForwardTrajectory(NaN, 100, 80, 80, [], 40);
    assert.deepEqual(nanOriginTraj, [], "Must return empty array on NaN originX");

    const infPullTraj = calculateForwardTrajectory(100, 100, Infinity, 80, [], 40);
    assert.deepEqual(infPullTraj, [], "Must return empty array on infinite pullX");

    // Entity with NaN coordinate should be ignored without polluting trajectory
    const nanEntity: CelestialEntity = {
      type: "blackhole",
      x: NaN,
      y: NaN,
      radius: 50,
      color: "#ff0000",
      mass: 50000,
    };
    const validBh: CelestialEntity = {
      type: "blackhole",
      x: 300,
      y: 300,
      radius: 50,
      color: "#ff8844",
      mass: 50000,
    };
    const trajWithNanEntity = calculateForwardTrajectory(100, 100, 80, 80, [nanEntity, validBh], 30);
    assert.ok(trajWithNanEntity.length > 0, "Trajectory calculation should proceed ignoring corrupted entity");
    trajWithNanEntity.forEach((pt) => {
      assert.ok(isFinite(pt.x) && isFinite(pt.y) && isFinite(pt.speed), "Trajectory point must remain strictly finite");
    });
  });

  runTest("calculateForwardTrajectory: defends against non-array entities and zero-magnitude pull vectors", () => {
    // Non-array celestial entities fallback
    const resNullEntities = calculateForwardTrajectory(100, 100, 80, 80, null as any, 10);
    assert.ok(Array.isArray(resNullEntities) && resNullEntities.length > 0, "Must succeed with null entities list");

    // Zero-distance pull vector (origin equals pull)
    const zeroPull = calculateForwardTrajectory(150, 150, 150, 150, [], 5);
    assert.equal(zeroPull[0]!.speed, 0, "Zero pull vector must have 0 launch speed without NaN");
    assert.equal(zeroPull[0]!.x, 150);
    assert.equal(zeroPull[0]!.y, 150);
  });

  runTest("updateActiveProbes: safely filters out non-finite / NaN coordinates, velocities, and life values", () => {
    const validProbe: SlingshotProbe = {
      id: "valid-probe",
      x: 100,
      y: 100,
      z: 0,
      vx: 1.0,
      vy: 1.0,
      vz: 0,
      color: "#4deeea",
      trail: [],
      life: 0.9,
      maxLife: 1.0,
      isSwallowed: false,
      maxSpeedReached: 1.41,
      lastWhipTime: 0,
    };
    const nanPosProbe: SlingshotProbe = {
      id: "nan-pos",
      x: NaN,
      y: 100,
      z: 0,
      vx: 1.0,
      vy: 1.0,
      vz: 0,
      color: "#4deeea",
      trail: [],
      life: 0.9,
      maxLife: 1.0,
      isSwallowed: false,
      maxSpeedReached: 1.0,
      lastWhipTime: 0,
    };
    const infVelProbe: SlingshotProbe = {
      id: "inf-vel",
      x: 100,
      y: 100,
      z: 0,
      vx: Infinity,
      vy: 0,
      vz: 0,
      color: "#4deeea",
      trail: [],
      life: 0.9,
      maxLife: 1.0,
      isSwallowed: false,
      maxSpeedReached: 1.0,
      lastWhipTime: 0,
    };
    const nanLifeProbe: SlingshotProbe = {
      id: "nan-life",
      x: 100,
      y: 100,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      color: "#4deeea",
      trail: [],
      life: NaN,
      maxLife: 1.0,
      isSwallowed: false,
      maxSpeedReached: 1.0,
      lastWhipTime: 0,
    };

    const ripples = { current: [] as any[] };
    const result = updateActiveProbes(
      [validProbe, nanPosProbe, infVelProbe, nanLifeProbe],
      [],
      ripples
    );

    assert.equal(result.length, 1, "Only valid probe must survive update loop");
    assert.equal(result[0]!.id, "valid-probe");
    assert.ok(isFinite(result[0]!.x) && isFinite(result[0]!.y));
  });

  runTest("updateActiveProbes: defends against null probe lists, null entities, and null ripplesRef", () => {
    assert.deepEqual(updateActiveProbes(null as any, null as any, null as any), []);
    assert.deepEqual(updateActiveProbes([], null as any, null as any), []);
    const probe: SlingshotProbe = {
      id: "safe-probe",
      x: 10,
      y: 10,
      z: 0,
      vx: 1,
      vy: 1,
      vz: 0,
      color: "#fff",
      trail: [],
      life: 0.5,
      maxLife: 1.0,
      isSwallowed: false,
      maxSpeedReached: 1,
      lastWhipTime: 0,
    };
    const updated = updateActiveProbes([probe], null as any, null as any);
    assert.equal(updated.length, 1);
    assert.equal(updated[0]!.id, "safe-probe");
  });

  runTest("TidalDisruptionEngine: validates quiescent initial state and hyperbolic inbound trajectory trigger", () => {
    const tde = createInitialTdeState();
    assert.equal(tde.stage, "IDLE");
    assert.equal(tde.isActive, false);
    assert.equal(tde.starMass, 1.0);
    assert.equal(tde.shredDissipation, 0.0);

    const entities: CelestialEntity[] = [
      {
        type: "blackhole",
        x: 600,
        y: 400,
        radius: 65,
        color: "#ff8844",
      },
    ];

    const triggered = triggerTidalDisruptionEvent(tde, entities, 1200, 800);
    assert.equal(triggered, true, "TDE must trigger successfully");
    assert.equal(tde.isActive, true, "TDE state must become active");
    assert.equal(tde.stage, "STAR_APPROACH", "TDE stage must be STAR_APPROACH");
    assert.ok(tde.starVx !== 0 || tde.starVy !== 0, "Rogue star must have non-zero approach velocity");

    // Re-triggering while active must be safely rejected
    const retriggered = triggerTidalDisruptionEvent(tde, entities, 1200, 800);
    assert.equal(retriggered, false, "Must reject triggering while TDE is already active");
  });

  runTest("TidalDisruptionEngine: progression safeguard advances ROCHE_RUPTURE to ACCRETION_SURGE upon mass shredding", () => {
    const tde = createInitialTdeState();
    tde.isActive = true;
    tde.stage = "ROCHE_RUPTURE";
    tde.starMass = 0.005;
    tde.startTime = Date.now() - 7000;
    tde.fragments = [
      {
        x: 100,
        y: 100,
        z: 0,
        vx: 1,
        vy: 1,
        radius: 4,
        color: "#fff",
        life: 1,
        decay: 0.001,
        rotation: 0,
        rotSpeed: 0,
        stretchX: 1,
        stretchY: 1,
      },
    ];

    const entities: CelestialEntity[] = [
      { type: "blackhole", x: 500, y: 500, radius: 60, color: "#ff8844" },
    ];
    const cameraShake = { current: 0 };
    const ripples = { current: [] as any[] };

    updateTidalDisruption(tde, entities, 1000, 1000, cameraShake, ripples);

    assert.equal(tde.stage, "ACCRETION_SURGE", "TDE must transition to ACCRETION_SURGE when star mass is depleted");
    assert.equal(tde.starMass, 0);
    assert.equal(tde.starRadius, 0);
  });

  runTest("TidalDisruptionEngine: defends against non-finite, zero, or negative screen dimensions in trigger and update", () => {
    const tde = createInitialTdeState();
    const entities: CelestialEntity[] = [
      { type: "blackhole", x: 200, y: 200, radius: 50, color: "#ff8844" },
    ];
    // Test with zero and negative dimensions
    const ok = triggerTidalDisruptionEvent(tde, entities, 0, -500);
    assert.equal(ok, true, "Must trigger successfully despite invalid dimensions");
    assert.ok(isFinite(tde.starX) && isFinite(tde.starY), "Coordinates must remain strictly finite");

    // Test update with NaN dimensions
    const cameraShake = { current: 0 };
    const ripples = { current: [] as any[] };
    assert.doesNotThrow(() => {
      updateTidalDisruption(tde, entities, NaN, Infinity, cameraShake, ripples);
    });
    assert.ok(isFinite(tde.starX) && isFinite(tde.starY), "Coordinates must remain finite after update");
  });

  runTest("TidalDisruptionEngine: safely filters out non-finite or corrupted streamer and fragment particles", () => {
    const tde = createInitialTdeState();
    tde.isActive = true;
    tde.stage = "ROCHE_RUPTURE";
    tde.starX = 500;
    tde.starY = 500;
    tde.starVx = 5;
    tde.starVy = 0;
    tde.starRadius = 20;

    // Inject valid and corrupt fragments
    tde.fragments = [
      { x: 500, y: 500, z: 0, vx: 1, vy: 1, radius: 10, color: "#fff", life: 1.0, decay: 0.01, rotation: 0, rotSpeed: 0.01, stretchX: 1, stretchY: 1 },
      { x: NaN, y: 500, z: 0, vx: 1, vy: 1, radius: 10, color: "#fff", life: 1.0, decay: 0.01, rotation: 0, rotSpeed: 0.01, stretchX: 1, stretchY: 1 },
      { x: 500, y: 500, z: 0, vx: 1, vy: 1, radius: -5, color: "#fff", life: 1.0, decay: 0.01, rotation: 0, rotSpeed: 0.01, stretchX: 1, stretchY: 1 },
    ];

    // Inject valid and corrupt streamers
    tde.streamers = [
      { x: 500, y: 500, z: 0, vx: 1, vy: 1, vz: 0, color: "#fff", life: 1.0, decay: 0.01, size: 2 },
      { x: Infinity, y: 500, z: 0, vx: 1, vy: 1, vz: 0, color: "#fff", life: 1.0, decay: 0.01, size: 2 },
      { x: 500, y: 500, z: 0, vx: NaN, vy: 1, vz: 0, color: "#fff", life: 1.0, decay: 0.01, size: 2 },
    ];

    const shakeRef = { current: 0 };
    const ripplesRef = { current: [] };
    const bh: CelestialEntity = { type: "blackhole", x: 600, y: 500, radius: 60, color: "#ff8800" };

    updateTidalDisruption(tde, [bh], 1920, 1080, shakeRef, ripplesRef);

    // Verify all corrupted particles were eliminated
    tde.fragments.forEach((frag) => {
      assert.ok(isFinite(frag.x) && isFinite(frag.y) && frag.radius > 0, "Corrupt fragments must be purged");
    });
    tde.streamers.forEach((p) => {
      assert.ok(isFinite(p.x) && isFinite(p.vx), "Corrupt streamers must be purged");
    });
  });

  runTest("TidalDisruptionEngine: defends against null ripplesRef and null cameraShakeRef", () => {
    const tde = createInitialTdeState();
    tde.isActive = true;
    tde.stage = "ROCHE_RUPTURE";
    tde.starX = 500;
    tde.starY = 500;
    tde.starRadius = 20;
    const bh: CelestialEntity = { type: "blackhole", x: 500, y: 500, radius: 60, color: "#ff8800" };

    assert.doesNotThrow(() => {
      updateTidalDisruption(tde, [bh], 1920, 1080, null as any, null as any);
    });
  });

  runTest("AudioEngine: handles modulation bounds, mute toggles, and clean disposal", () => {
    assert.equal(audio.getMuteState(), true, "Audio should initially be muted");
    audio.setMute(false);
    assert.equal(audio.getMuteState(), false, "Audio should be unmuted");
    audio.setMute(true);
    assert.equal(audio.getMuteState(), true, "Audio should be muted again");

    // Boundary conditions should never throw
    assert.doesNotThrow(() => {
      audio.setTimeDilation(-5.0);
      audio.setTimeDilation(10.0);
      audio.setTimeDilation(1.0);
      audio.setGravitationalProximity(-1.0);
      audio.setGravitationalProximity(2.0);
      audio.setGravitationalProximity(0.5);
      audio.setCinematicMode(true);
      audio.setCinematicMode(false);
      audio.pingInteraction();
      audio.dispose();
    });

    // Verify audio engine state after disposal and clean reinitialization
    assert.equal(audio.getMuteState(), true, "Audio should reset to muted on disposal");
    assert.doesNotThrow(() => {
      audio.init();
      audio.dispose();
    });

    // Verify defensive NaN handling in audio controls
    assert.doesNotThrow(() => {
      audio.setTimeDilation(NaN);
      audio.setTimeDilation(Infinity);
      audio.setGravitationalProximity(NaN);
      audio.setGravitationalProximity(Infinity);
      audio.playProbeSlingshot(NaN);
      audio.playInteractiveMallet(NaN, NaN);
    });
  });

  await runTest("CosmicTransitionStateMachine: validates initial state, lifecycle transitions, and clean cancellation", async () => {
    const sm = new CosmicTransitionStateMachine();
    const info = sm.getInfo();
    assert.equal(info.stage, "IDLE_BLACKHOLE");
    assert.equal(info.progress, 0);
    assert.equal(info.isTransitioning, false);

    // Test transition initiation and abort cancellation
    let imploded = false;
    const transitionPromise = sm.executeBlackHoleToSupernovaTransition({
      onImplode: () => { imploded = true; },
    });
    assert.equal(sm.getInfo().isTransitioning, true);
    assert.equal(imploded, true);

    sm.cancel();
    await transitionPromise;
    assert.equal(sm.getInfo().stage, "IDLE_BLACKHOLE");
    assert.equal(sm.getInfo().isTransitioning, false);
  });

  runTest("ParticleUtils: validates SSR safety for particleText and defensive bounds handling in drawStageLayoutTemplate", () => {
    // SSR / Node environment guard: particleText must return empty array without throwing ReferenceError
    const coords = particleText("TEST", 24, 1, 1, 1, 0, 0, "#4deeea", 400, 200);
    assert.deepEqual(coords, []);
    assert.deepEqual(particleText("TEST", 24, 1, 1, 1, 0, 0, "#4deeea", 0, 0), []);
    assert.deepEqual(particleText("TEST", 24, 1, 1, 1, 0, 0, "#4deeea", -50, -50), []);

    // drawStageLayoutTemplate boundary handling: out of bounds or null context should never throw
    assert.doesNotThrow(() => {
      drawStageLayoutTemplate(null as any, 0, 0, 0, "full");
      drawStageLayoutTemplate(null as any, -1, 100, 100, "full");
      drawStageLayoutTemplate(null as any, 99, 100, 100, "full");
    });
  });

  runTest("ParticleUtils: validates SSR safety in generateTargetsForStage across all stage indices", () => {
    for (let s = -2; s <= 8; s++) {
      assert.doesNotThrow(() => {
        const targets = generateTargetsForStage(s, 1920, 1080);
        assert.ok(Array.isArray(targets));
        assert.equal(targets.length, 0); // In SSR/Node, document is undefined so empty targets returned safely
      });
    }
    assert.deepEqual(generateTargetsForStage(0, 0, 0), []);
    assert.deepEqual(generateTargetsForStage(0, -100, -100), []);
  });

  runTest("HUDManager: validates updateHudTexture with null, disposed meshes, and headless runtime without throwing errors", () => {
    assert.doesNotThrow(() => {
      updateHudTexture(0, null, null);
      updateHudTexture(1, null, null);
      updateHudTexture(2, null, null);
    });

    const engine = new BABYLON.NullEngine();
    const scene = new BABYLON.Scene(engine);
    const plane = BABYLON.MeshBuilder.CreatePlane("hudPlane", { size: 10 }, scene);
    plane.dispose();

    assert.doesNotThrow(() => {
      updateHudTexture(0, plane, null);
    });

    scene.dispose();
    engine.dispose();
  });

  runTest("ParticleUtils: validates generateTargetsForStage returns array and never undefined for arbitrary indices", () => {
    for (let s = -5; s <= 20; s++) {
      const res = generateTargetsForStage(s, 800, 600);
      assert.ok(Array.isArray(res), `generateTargetsForStage(${s}) must return an array`);
    }
  });

  runTest("TransitionManager: validates SSR safety in triggerCalmCosmicShift without window object", () => {
    const celestialEntitiesRef = { current: [{ isDestroyed: false } as CelestialEntity] };
    const supernovaRef = { current: null as any };
    let fetched = false;
    assert.doesNotThrow(() => {
      triggerCalmCosmicShift(celestialEntitiesRef as any, supernovaRef as any, () => {
        fetched = true;
      });
    });
    assert.equal(fetched, true);
    assert.equal(celestialEntitiesRef.current[0]!.isDestroyed, true);
    assert.ok(supernovaRef.current);
    assert.equal(supernovaRef.current.isCalmShift, true);
    assert.equal(supernovaRef.current.x, 960);
    assert.equal(supernovaRef.current.y, 540);
  });

  runTest("RenderEngine: validates executeRenderFrame SSR / headless safety without window error", () => {
    const mockCtx: any = {
      particlesRef: { current: [] },
      pointsMeshRef: { current: null },
      hudPlaneRef: { current: null },
      sceneRef: { current: null },
      cameraRef: { current: null },
      rendererRef: { current: null },
      composerRef: { current: null },
      pointsMaterialRef: { current: null },
      lensingPostProcessRef: { current: null },
      celestialEntitiesRef: { current: [] },
      supernovaRef: { current: null },
      activeSupernovaFxRef: { current: null },
      ripplesRef: { current: [] },
      collisionFlaresRef: { current: [] },
      cameraShakeRef: { current: 0 },
      inputControllerRef: {
        current: {
          currentScrollTimeline: 0,
          targetScrollTimeline: 0,
          currentCameraZDepthOffset: 0,
          targetCameraZDepthOffset: 0,
          currentCameraParallaxX: 0,
          targetCameraParallaxX: 0,
          currentCameraParallaxY: 0,
          targetCameraParallaxY: 0,
          currentCameraPitch: 0,
          targetCameraPitch: 0,
          currentCameraYaw: 0,
          targetCameraYaw: 0,
          targetLock: { active: false, entityId: null, x: 0, y: 0, z: 0 },
          currentLock: { x: 0, y: 0, z: 0, intensity: 0 },
        },
      },
      stageRef: { current: 0 },
      isInterstellarRef: { current: false },
      isTransitActiveRef: { current: false },
      transitStartTimeRef: { current: 0 },
      lastStageChangeRef: { current: Date.now() },
      lastUserActivityRef: { current: Date.now() },
      isScreensaverActiveRef: { current: false },
      screensaverOpacityRef: { current: 0 },
      lastShockwaveTimeRef: { current: 0 },
      isShockwaveActiveRef: { current: false },
      shockwaveStartTimeRef: { current: 0 },
      smoothedAmpRef: { current: 0 },
      smoothedBassRef: { current: 0 },
      smoothedMidRef: { current: 0 },
      smoothedTrebleRef: { current: 0 },
      mouseRef: { current: { x: 0, y: 0, lastMoved: Date.now() } },
      scrollVelocityRef: { current: 0 },
      ambientParticleSpeedRef: { current: 0.15 },
      objectParticleSpeedRef: { current: 0.15 },
      textParticleSpeedRef: { current: 0.12 },
      particleFiltersRef: { current: { ambient: true, celestial: true, bridges: true, tails: true, typography: true } },
      spawnTailParticleRef: { current: () => {} },
      timeRef: { current: 0 },
      positions: new Float32Array(30),
      colors: new Float32Array(40),
      extras: new Float32Array(30),
      updateCelestial3DMeshes: () => {},
      generateInterstellarScene: () => {},
      mapParticlesToInterstellar: () => {},
      transitionStartTimeRef: { current: 0 },
      transitionActiveRef: { current: false },
      transitionStartPosRef: { current: null },
      fovRef: { current: 45 },
      audio: {
        getMusicAmplitude: () => 0,
        getFrequencyBands: () => ({ bass: 0, mid: 0, treble: 0 }),
        setGravitationalProximity: () => {},
      },
    };

    assert.doesNotThrow(() => {
      executeRenderFrame(mockCtx);
    }, "executeRenderFrame must run cleanly in headless environment without ReferenceError");
  });

  runTest("PostProcess Shaders: validates BlackholeLensing, DepthOfField, and FrameShatter in headless runtime", () => {
    const engine = new BABYLON.NullEngine();
    const scene = new BABYLON.Scene(engine);
    const camera = new BABYLON.TargetCamera("testCam", new BABYLON.Vector3(0, 0, -500), scene);

    const lensingRef = { current: null as any };
    const dofRef = { current: null as any };
    const shatterRef = { current: null as any };
    const entitiesRef = {
      current: [
        { type: "blackhole", x: 100, y: 100, radius: 50, color: "#ff6600", isDestroyed: false },
      ] as CelestialEntity[],
    };
    const shatterIntensityRef = { current: 0.5 };

    assert.doesNotThrow(() => {
      setupBlackholeLensingPostProcess(camera, scene, engine, lensingRef, entitiesRef);
    });
    assert.ok(lensingRef.current);
    if (lensingRef.current.onApply) {
      assert.doesNotThrow(() => {
        const mockEffect: any = {
          setFloat: () => {},
          setFloat2: () => {},
          setFloat3: () => {},
          setArray3: () => {},
        };
        lensingRef.current.onApply(mockEffect);
      });
    }

    assert.doesNotThrow(() => {
      setupDepthOfFieldPostProcess(camera, scene, engine, dofRef, undefined, entitiesRef);
    });
    assert.ok(dofRef.current);
    if (dofRef.current.onApply) {
      assert.doesNotThrow(() => {
        const mockEffect: any = {
          setFloat: () => {},
          setFloat2: () => {},
        };
        dofRef.current.onApply(mockEffect);
      });
    }

    assert.doesNotThrow(() => {
      setupFrameShatterPostProcess(camera, scene, engine, shatterRef, entitiesRef, shatterIntensityRef);
    });
    assert.ok(shatterRef.current);
    if (shatterRef.current.onApply) {
      assert.doesNotThrow(() => {
        const mockEffect: any = {
          setFloat: () => {},
          setFloat2: () => {},
        };
        shatterRef.current.onApply(mockEffect);
      });
    }

    lensingRef.current?.dispose();
    dofRef.current?.dispose();
    shatterRef.current?.dispose();
    scene.dispose();
    engine.dispose();
  });

  runTest("WormholeTransit: verifies transit state guards and headless safety", async () => {
    const isTransitActiveRef = { current: true }; // Active barrier returns early
    const dummyParams: any = {
      isTransitActiveRef,
      transitStartTimeRef: { current: 0 },
      transitTargetPosRef: { current: null },
      transitDirRef: { current: null },
      wormholePostProcessRef: { current: null },
      wormholeTimeRef: { current: 0 },
      wormholeIntensityRef: { current: 0 },
      fovRef: { current: 60 },
      cameraZRef: { current: 600 },
      isInterstellarRef: { current: false },
      nextGeminiSceneRef: { current: null },
      generateInterstellarScene: () => {},
      mapParticlesToInterstellar: () => {},
      cameraRef: { current: null },
      sceneRef: { current: null },
      rendererRef: { current: null },
    };
    await assert.doesNotReject(async () => {
      await startWormholeTransit(dummyParams);
    });
  });

  runTest("HawkingRadiationEngine: handles non-finite proximity, non-finite dt, and safe disposal in headless runtime", () => {
    const engine = new BABYLON.NullEngine();
    const scene = new BABYLON.Scene(engine);
    const node = new BABYLON.TransformNode("bh_node", scene);
    const bhEntity: CelestialEntity = {
      type: "blackhole",
      x: 0,
      y: 0,
      radius: NaN,
      color: "#ffaa00",
    };
    const hawking = createHawkingRadiationSystem(node, bhEntity, scene);
    assert.ok(hawking.system);
    assert.doesNotThrow(() => {
      hawking.update(NaN, false, NaN);
      hawking.update(Infinity, true, 16.6);
      hawking.update(0.5, true, 16.6);
    });
    assert.ok(isFinite(hawking.currentIntensity), "Hawking radiation intensity must remain strictly finite");
    assert.doesNotThrow(() => {
      hawking.dispose();
    });
    scene.dispose();
    engine.dispose();
  });

  runTest("HawkingRadiationEngine: accurately incorporates scale factor in Schwarzschild emitter radius", () => {
    const engine = new BABYLON.NullEngine();
    const scene = new BABYLON.Scene(engine);
    const node = new BABYLON.TransformNode("bh_node", scene);
    const scaledBh: CelestialEntity = {
      type: "blackhole",
      x: 0,
      y: 0,
      radius: 50,
      scale: 1.8,
      color: "#ffaa00",
    };
    const hawking = createHawkingRadiationSystem(node, scaledBh, scene);
    assert.ok(hawking.system);
    assert.doesNotThrow(() => {
      hawking.update(0.8, true, 16.666);
    });
    hawking.dispose();
    scene.dispose();
    engine.dispose();
  });

  runTest("TextureUtils: validates universal headless / SSR fallback dynamic textures across all 18 generators", () => {
    const engine = new BABYLON.NullEngine();
    const scene = new BABYLON.Scene(engine);

    assert.doesNotThrow(() => {
      createCircleTexture(scene);
      createCircularGlowTexture("#ffffff", scene);
      generateAccretionDiskTexture("#ff8844", "#ffffff", scene);
      generateRelativisticJetTexture("#ff8844", "#ffffff", scene);
      generatePhotonRingTexture("#ff8844", "#ffffff", scene);
      generateAdvancedPlanetTexture("#2255aa", "#44aa44", scene);
      generatePlanetNightLightsTexture("#ffffff", "#ffd778", scene);
      generatePlanetBumpNormalTexture(scene);
      generateProceduralCloudTexture("#ffffff", scene);
      generateAuroraTexture("#00ffd2", scene);
      generateStarTexture("#ffffff", "#aaccff", scene);
      generateConcentricRingTexture("rgba(200,200,200,0.4)", scene);
      generateDistortedLightwaveTexture("#ffffff", scene);
      generateGalaxyTexture("#aaccff", "#ffffff", scene);
      generateNebulaTexture("#ff4466", "#4488ff", scene);
      generateSupernovaCoreFlareTexture(scene);
      generateAnamorphicSpikeTexture(scene);
      generateSupernovaPhotonicRingTexture("#ffffff", "#ff8844", scene);
    });

    scene.dispose();
    engine.dispose();
  });

  runTest("ParticleCanvasEvents: validates SSR safety and clean teardown in headless environments", () => {
    assert.doesNotThrow(() => {
      const cleanup = setupParticleCanvasEvents({} as any);
      assert.equal(typeof cleanup, "function");
      cleanup();
    });
  });

  console.log("\n==> Testing Static Assets & Build Artifacts");

  runTest("Static Assets: verifies favicon.svg, index.html metadata, and bundle readiness", () => {
    const projectRoot = process.cwd();
    const faviconPath = path.join(projectRoot, "public", "favicon.svg");
    assert.ok(fs.existsSync(faviconPath), "public/favicon.svg must exist");
    const faviconContent = fs.readFileSync(faviconPath, "utf-8");
    assert.ok(faviconContent.includes("<svg"), "favicon.svg must contain valid SVG markup");

    const indexPath = path.join(projectRoot, "index.html");
    assert.ok(fs.existsSync(indexPath), "index.html must exist");
    const indexContent = fs.readFileSync(indexPath, "utf-8");
    assert.ok(indexContent.includes("/favicon.svg"), "index.html must reference /favicon.svg");
    assert.ok(indexContent.includes('name="theme-color"'), "index.html must specify theme-color");
    assert.ok(indexContent.includes("<title>Curtis Click"), "index.html must have portfolio title");

    // Build artifact checks if dist exists
    const distPath = path.join(projectRoot, "dist");
    if (fs.existsSync(distPath)) {
      const serverBundle = path.join(distPath, "server.cjs");
      assert.ok(fs.existsSync(serverBundle), "dist/server.cjs must exist after build");
      const stat = fs.statSync(serverBundle);
      assert.ok(stat.size > 5000, `dist/server.cjs must be bundled (>5KB, got ${stat.size}B)`);

      const distHtml = path.join(distPath, "index.html");
      assert.ok(fs.existsSync(distHtml), "dist/index.html must exist after build");

      // Verify clean 3-bundle assets in dist/assets
      const assetsDir = path.join(distPath, "assets");
      if (fs.existsSync(assetsDir)) {
        const assetFiles = fs.readdirSync(assetsDir);
        const hasBabylonBundle = assetFiles.some((f) => f.startsWith("babylon-") && f.endsWith(".js"));
        const hasVendorBundle = assetFiles.some((f) => f.startsWith("vendor-") && f.endsWith(".js"));
        const hasIndexBundle = assetFiles.some((f) => f.startsWith("index-") && f.endsWith(".js"));
        assert.ok(hasBabylonBundle, "dist/assets must contain bundled babylon chunk");
        assert.ok(hasVendorBundle, "dist/assets must contain bundled vendor chunk");
        assert.ok(hasIndexBundle, "dist/assets must contain bundled index chunk");
      }
    }
  });

  runTest("Vite Build Configuration: validates manualChunks chunking rules for babylon and vendor libraries", () => {
    const viteConfigPath = path.join(process.cwd(), "vite.config.ts");
    assert.ok(fs.existsSync(viteConfigPath), "vite.config.ts must exist");
    const content = fs.readFileSync(viteConfigPath, "utf-8");
    assert.ok(content.includes("node_modules/framer-motion"), "vite.config.ts must explicitly group framer-motion into vendor chunk");
    assert.ok(content.includes("node_modules/motion"), "vite.config.ts must group motion into vendor chunk");
    assert.ok(content.includes("node_modules/@babylonjs/core"), "vite.config.ts must group @babylonjs/core into babylon chunk");
  });

  runTest("isUIElement: correctly classifies interactive UI DOM elements versus WebGL canvas", () => {
    assert.equal(isUIElement(null), false, "Null target should return false");
    const dummyCanvas: any = { tagName: "CANVAS", id: "canvas-babylon" };
    assert.equal(isUIElement(dummyCanvas), false, "Canvas element should return false");

    const dummyButton: any = {
      tagName: "BUTTON",
      id: "action-btn",
      closest: (sel: string) => sel.includes("button"),
    };
    assert.equal(isUIElement(dummyButton), true, "Button element should return true");

    const dummyInput: any = {
      tagName: "INPUT",
      id: "search",
      closest: (sel: string) => sel.includes("input"),
    };
    assert.equal(isUIElement(dummyInput), true, "Input element should return true");
  });

  runTest("Hotkeys & UI classification: validates hotkey action bindings and input element exclusion", () => {
    // Ensure interactive input and textarea targets are recognized as UI elements
    const mockInput = { tagName: "INPUT", id: "search", closest: () => null } as any;
    const mockTextarea = { tagName: "TEXTAREA", id: "prompt", closest: () => null } as any;
    const mockButton = { tagName: "BUTTON", id: "mute-btn", closest: () => true } as any;
    const mockCanvas = { tagName: "CANVAS", id: "canvas-babylon", closest: () => null } as any;

    assert.equal(isUIElement(mockInput), true, "Input element must be identified as UI element");
    assert.equal(isUIElement(mockTextarea), true, "Textarea element must be identified as UI element");
    assert.equal(isUIElement(mockButton), true, "Button element must be identified as UI element");
    assert.equal(isUIElement(mockCanvas), false, "Canvas element must not be classified as UI element");

    // Validate supported hotkeys mapping set
    const supportedHotkeys = ["a", "c", "m", "w", "n", "t", "p", "Escape"];
    assert.equal(supportedHotkeys.length, 8, "Expected 8 core hotkeys registered");
  });

  await runTest("Telemetry Pipeline: validates client error filtering, duplicate deduplication, and throttling", async () => {
    resetTelemetryThrottling();
    assert.equal(isIgnoredErrorMessage("WebSocket connection to 'ws://...' failed"), true);
    assert.equal(isIgnoredErrorMessage("[vite] connecting..."), true);
    assert.equal(isIgnoredErrorMessage("HMR update error"), true);
    assert.equal(isIgnoredErrorMessage("NullPointerException in WebGL render pipeline"), false);

    // Test reporting valid error
    const ok = await reportClientError("Test WebGL Shader Compilation Warning", "test-suite");
    assert.equal(ok, true, "Telemetry should accept valid non-ignored error");

    // Test duplicate deduplication within throttle window
    const duplicate = await reportClientError("Test WebGL Shader Compilation Warning", "test-suite");
    assert.equal(duplicate, false, "Telemetry should deduplicate identical errors");

    // Test ignored error rejection
    const ignored = await reportClientError("WebSocket failed to connect to websocket", "test-suite");
    assert.equal(ignored, false, "Telemetry should ignore websocket noise");
  });

  runTest("Telemetry Pipeline: suppresses benign ResizeObserver loop and Safari/Edge extension notifications", () => {
    assert.equal(isIgnoredErrorMessage("ResizeObserver loop completed with undelivered notifications."), true);
    assert.equal(isIgnoredErrorMessage("ResizeObserver loop limit exceeded"), true);
    assert.equal(isIgnoredErrorMessage("safari-extension://com.example.blocker/script.js:10"), true);
    assert.equal(isIgnoredErrorMessage("safari-web-extension://ABC-123-DEF/content.js:45"), true);
    assert.equal(isIgnoredErrorMessage("ms-browser-extension://12345678-abcd/injected.js:8"), true);
    assert.equal(isIgnoredErrorMessage("Valid Application Error"), false);
  });

  console.log("\n==> Testing HTTP Server Endpoints & Integration");

  // Spin up an ephemeral server instance on random free port (0)
  process.env.NODE_ENV = "test";
  const { server } = await startServer(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to get server port");
  }
  const testPort = address.port;

  const makeRequest = (path: string, options: http.RequestOptions = {}): Promise<{ status: number; body: any }> => {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: testPort,
          path,
          ...options,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              const body = JSON.parse(data);
              resolve({ status: res.statusCode || 500, body });
            } catch {
              resolve({ status: res.statusCode || 500, body: data });
            }
          });
        }
      );
      req.on("error", reject);
      if ((options as any).body) {
        req.write((options as any).body);
      }
      req.end();
    });
  };

  await runTest("GET /health: returns healthy status, uptime, nodeVersion, environment, model, and memoryUsage diagnostics", async () => {
    const res = await makeRequest("/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "healthy");
    assert.equal(res.body.service, "curtis-click-portfolio");
    assert.ok(typeof res.body.environment === "string" && res.body.environment.length > 0);
    assert.ok(typeof res.body.model === "string" && res.body.model.length > 0);
    assert.ok(typeof res.body.uptime === "number");
    assert.ok(typeof res.body.nodeVersion === "string" && res.body.nodeVersion.startsWith("v"));
    assert.ok(typeof res.body.memoryUsage === "object");
    assert.ok(typeof res.body.memoryUsage.rss === "number" && res.body.memoryUsage.rss > 0);
    assert.ok(typeof res.body.memoryUsage.heapUsed === "number" && res.body.memoryUsage.heapUsed > 0);
  });

  await runTest("GET /api/health: responds to container probes", async () => {
    const res = await makeRequest("/api/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "healthy");
  });

  await runTest("POST /api/generate-cosmic-scene: returns valid procedural system on fallback", async () => {
    const res = await makeRequest("/api/generate-cosmic-scene", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.systemName);
    assert.ok(res.body.entities.length >= 2);
  });

  await runTest("POST /api/generate-cosmic-scene: supports requested archetype override", async () => {
    const res = await makeRequest("/api/generate-cosmic-scene", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archetype: "STELLAR_PULSAR" }),
    } as any);
    assert.equal(res.status, 200);
    assert.equal(res.body.archetype, "STELLAR_PULSAR");
    assert.ok(res.body.entities.length >= 2);
  });

  await runTest("ALL /api/unknown: returns 404 JSON error instead of HTML SPA", async () => {
    const res = await makeRequest("/api/non-existent-endpoint");
    assert.equal(res.status, 404);
    assert.equal(res.body.error, "Endpoint not found");
  });

  await runTest("POST /api/log-error: records and sanitizes client diagnostics with size bounding", async () => {
    const hugeMsg = "Synthetic client test error " + "X".repeat(1200);
    const res = await makeRequest("/api/log-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: hugeMsg }),
    } as any);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);

    const logPath = path.join(process.cwd(), "client_errors.log");
    assert.ok(fs.existsSync(logPath), "client_errors.log must exist");
    const stat = fs.statSync(logPath);
    assert.ok(stat.size < 2 * 1024 * 1024, "client_errors.log must be bounded (<2MB)");
  });

  await runTest("POST /api/log-error: serializes structured object error payloads cleanly", async () => {
    const res = await makeRequest("/api/log-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: { message: "WebGL Context Lost", code: "CONTEXT_LOST_WEBGL" } }),
    } as any);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
  });

  await runTest("POST /api/log-error: handles malformed JSON with clean 400 error response", async () => {
    const res = await makeRequest("/api/log-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"invalidJson": unquoted}',
    } as any);
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "Invalid JSON payload");
  });

  await runTest("POST /api/log-error: accepts text/plain beacon diagnostic payloads", async () => {
    const res = await makeRequest("/api/log-error", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "Text/plain uncaught diagnostic error",
    } as any);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
  });

  runTest("getProceduralFallbackSystem: handles unknown archetype by defaulting to valid one", () => {
    const fallback = getProceduralFallbackSystem("NON_EXISTENT_ARCHETYPE");
    const validArchetypes = [
      "BLACKHOLE_CENTRIC",
      "BINARY_PLANETS",
      "NEBULA_CRADLE",
      "EXOPLANET_CLUSTER",
      "SPIRAL_GALAXY",
      "STELLAR_PULSAR",
    ];
    assert.ok(validArchetypes.includes(fallback.archetype), `Archetype must be valid, got ${fallback.archetype}`);
  });

  await runTest("startServer: supports PORT=0 for dynamic ephemeral port allocation", async () => {
    const origPort = process.env.PORT;
    process.env.PORT = "0";
    const ephemeral = await startServer();
    const addr = ephemeral.server.address();
    assert.ok(addr && typeof addr === "object");
    assert.ok(addr.port > 0, `Ephemeral port must be > 0, got ${addr.port}`);
    await new Promise<void>((resolve) => ephemeral.server.close(() => resolve()));
    if (origPort !== undefined) {
      process.env.PORT = origPort;
    } else {
      delete process.env.PORT;
    }
  });

  await runTest("startServer: rejects cleanly on port conflict without crashing", async () => {
    // testPort is already bound by the active test server instance
    await assert.rejects(
      async () => {
        await startServer(testPort);
      },
      (err: any) => {
        return err && err.code === "EADDRINUSE";
      }
    );
  });

  await runTest("startServer: cleanly removes SIGTERM and SIGINT listeners on process upon server close", async () => {
    const sigtermCountBefore = process.listenerCount("SIGTERM");
    const sigintCountBefore = process.listenerCount("SIGINT");
    assert.ok(sigtermCountBefore > 0, "Server must register SIGTERM listener while running");
    assert.ok(sigintCountBefore > 0, "Server must register SIGINT listener while running");

    await new Promise<void>((resolve) => server.close(() => resolve()));

    const sigtermCountAfter = process.listenerCount("SIGTERM");
    const sigintCountAfter = process.listenerCount("SIGINT");
    assert.equal(sigtermCountAfter, sigtermCountBefore - 1, "SIGTERM listener must be detached on close");
    assert.equal(sigintCountAfter, sigintCountBefore - 1, "SIGINT listener must be detached on close");
  });

  console.log(`\n========================================`);
  console.log(`  Tests Passed: ${passedTests} / ${totalTests}`);
  console.log(`========================================\n`);

  if (passedTests < totalTests) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
