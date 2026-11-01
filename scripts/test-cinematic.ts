/**
 * Pure-logic tests for the cinematic camera layer & physics-driven transition pipeline
 * (director, multi-stage phases, camera splines, Morton Z-order stratification,
 * 3D spatial bucket optimal transport, per-particle wavefront activation, 3D curl noise,
 * critically damped spring arrival, blackbody continuity, gravity rig, black-hole capture, FX bus).
 */
import assert from "node:assert/strict";
import {
  CinematicTransitionDirector,
  TransitionDirector,
  SHOT_PRESETS,
  NEUTRAL_SHOT,
  smoothstep,
  resolveTransitionStagePhase,
} from "../src/components/ParticleCanvas/cinematic/CinematicTransitionDirector";
import {
  CameraRig,
  RIG_LIMITS,
  computeGravityField,
  springStep,
  smoothNoise,
  advanceIdleBlend,
  sampleIdleBreathing,
  sampleIdleParticle,
} from "../src/components/ParticleCanvas/cinematic/CameraRig";
import {
  createCaptureState,
  computeCapturePose,
} from "../src/components/ParticleCanvas/cinematic/BlackHoleCapture";
import {
  cinematicFx,
  collisionSeverity,
  drainCollisions,
  emitCollision,
  resetCinematicFx,
  updateCinematicOptics,
} from "../src/components/ParticleCanvas/cinematic/CinematicFxBus";
import { entitiesToGravityBodies } from "../src/components/ParticleCanvas/cinematic/CinematicRuntime";
import {
  settleParticlesToTargets,
  assignTargetsOptimalTransport,
  snapshotParticleTransitionStart,
  triggerOrganicParticleDisperse,
} from "../src/components/ParticleCanvas/ParticleMapper";
import {
  encodeMorton3D,
  seededFisherYatesShuffle,
  stratifyTargetsByMorton,
} from "../src/components/ParticleCanvas/ParticleUtils";
import {
  computeCurlNoise3D,
  computeLocalWavefrontProgress,
  quinticSmoothstep,
  computeCriticallyDampedSpringForce,
  advanceCriticalSpring,
  computeArrivalCorrection,
  computeBlackbodyColorContinuity,
} from "../src/components/ParticleCanvas/PhysicsUtils";
import { settleEntitiesInstantly } from "../src/components/ParticleCanvas/TransitionManager";
import { simulateParticles } from "../src/components/ParticleCanvas/ParticleSimulationEngine";
import { CelestialEntity, Particle } from "../src/components/ParticleCanvas/types";
import { sampleWormholeTransit, WORMHOLE_REBUILD_PROGRESS } from "../src/components/ParticleCanvas/cinematic/TransitChoreography";

let passed = 0;
let total = 0;
function runTest(name: string, fn: () => void) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
  }
}

/** Steps the director at 60 fps until `until` ms, returning every snapshot. */
function drive(d: CinematicTransitionDirector, from: number, until: number) {
  const shots = [];
  for (let t = from; t <= until; t += 1000 / 60) shots.push({ t, ...d.update(t) });
  return shots;
}

console.log("\nCinematic camera layer & Physics-Driven Transition Pipeline");

runTest("entry: visible establish beat, wide-to-close settle, reduced-motion bypass", () => {
  const d = new CinematicTransitionDirector();
  d.establish(0);
  const start = d.update(0);
  assert.equal(start.foregroundAlpha, 1);
  assert.ok(start.dolly >= 0.15);
  assert.equal(d.update(100).dolly, start.dolly, "hold the first composition long enough to read");
  const shots = drive(d, 100, 2000);
  assert.ok(shots.every(s => s.foregroundAlpha === 1));
  assert.ok(d.update(2000).phase === "IDLE");
  assert.ok(shots.find(s => s.t > 1400)!.dolly < start.dolly * 0.2);
  d.reducedMotion = true;
  d.establish(3000);
  assert.equal(d.update(3000), NEUTRAL_SHOT);
});

runTest("continuity: remap starts the arrival clock and low frame rates do not add holds", () => {
  for (const preset of ["stage", "scene"] as const) {
    const timing = SHOT_PRESETS[preset];
    assert.ok(timing.holdMs <= 64);
    for (const fps of [30, 60, 120]) {
      const d = new CinematicTransitionDirector();
      let rebuilds = 0;
      d.request({ key: "scene", preset, apply: () => rebuilds++ }, 0);
      let progress = 0;
      const duration = timing.departMs + timing.holdMs + timing.revealMs;
      for (let t = 0; t < duration; t += 1000 / fps) {
        const s = d.update(t);
        if (s.phase === "DEPART") assert.equal(s.particleProgress, 1);
        if (s.phase === "HIDDEN") assert.equal(s.particleProgress, 0);
        if (s.phase === "REVEAL") {
          assert.ok(s.particleProgress >= progress);
          progress = s.particleProgress;
        }
      }
      assert.equal(d.update(duration).phase, "IDLE");
      assert.equal(rebuilds, 1);
    }
    const stalled = new CinematicTransitionDirector();
    let rebuilds = 0;
    stalled.request({ key: "stalled", preset, apply: () => rebuilds++ }, 0);
    assert.equal(stalled.update(10000).phase, "IDLE");
    assert.equal(rebuilds, 1);
  }
});

runTest("continuity: scene spline, FOV and lensing have no boundary discontinuity", () => {
  const d = new CinematicTransitionDirector();
  d.request({ key: "scene", preset: "scene", apply: () => {} }, 0);
  let prev = d.update(0);
  for (let t = 8; t <= 2300; t += 8) {
    const s = d.update(t);
    assert.ok(Math.abs(s.fovDegrees - prev.fovDegrees) < 1.5, `FOV jump at ${t}`);
    assert.ok(Math.abs(s.splineOffset.z - prev.splineOffset.z) < 0.03, `dolly jump at ${t}`);
    assert.ok(Math.abs(s.lensing - prev.lensing) < 0.06);
    prev = s;
  }
});

runTest("continuity: rapid navigation preserves the full pose and lens, not just the veil", () => {
  const d = new CinematicTransitionDirector();
  let n = 0;
  d.request({ key: "stage", preset: "stage", apply: () => n++ }, 0);
  drive(d, 0, 900);
  const before = d.update(900);
  d.request({ key: "stage", preset: "scene", apply: () => n++ }, 900);
  const after = d.update(901);
  for (const key of ["yaw", "pitch", "roll", "dolly", "fovDegrees", "focusDistanceFactor", "lensing"] as const) {
    assert.ok(Math.abs(after[key] - before[key]) < 0.01, key);
  }
  assert.ok(Math.abs(after.splineOffset.z - before.splineOffset.z) < 0.01);
  drive(d, 902, 5000);
  assert.equal(n, 2);
  d.request({ key: "stage", preset: "stage", apply: () => n++ }, 6000);
  const departing = d.update(6350);
  d.request({ key: "scene", preset: "supernova", apply: () => n++ }, 6350);
  const upgraded = d.update(6351);
  assert.ok(Math.abs(upgraded.yaw - departing.yaw) < 0.01);
  assert.ok(Math.abs(upgraded.fovDegrees - departing.fovDegrees) < 0.01);
});

runTest("transit: capture → tunnel → emerge shares a bounded rush and masks the remap", () => {
  assert.equal(sampleWormholeTransit(0).intensity, 0);
  assert.equal(sampleWormholeTransit(0).travel, 0);
  assert.equal(sampleWormholeTransit(1).intensity, 0);
  assert.equal(sampleWormholeTransit(1).travel, 1);
  assert.equal(sampleWormholeTransit(1).fovOffset, 0);
  assert.equal(sampleWormholeTransit(1).roll, 0);
  assert.equal(sampleWormholeTransit(WORMHOLE_REBUILD_PROGRESS).eclipse, 1);
  assert.equal(sampleWormholeTransit(0.15).phase, "capture");
  assert.equal(sampleWormholeTransit(0.5).phase, "tunnel");
  assert.equal(sampleWormholeTransit(0.85).phase, "emerge");
  let previous = 0;
  for (let u = 0; u <= 1; u += 0.005) {
    const s = sampleWormholeTransit(u);
    assert.ok(s.travel >= previous && s.fovOffset <= 0.38);
    assert.ok(s.intensity >= 0 && s.intensity <= 1);
    previous = s.travel;
  }
});

runTest("capture: horizon silhouette survives the rush; close-range takeover cannot jump outward", () => {
  const state = createCaptureState(0, { x: 0, y: 0, z: -65 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 60);
  assert.ok(Math.abs(computeCapturePose(state, 0).pos.z + 65) < 1e-6);
  assert.equal(computeCapturePose(state, state.durationMs * 0.85).blackout, 0);
  assert.equal(computeCapturePose(state, state.durationMs).blackout, 1);
});

runTest("optics: distance tracking and severity response preserve bounded HUD headroom", () => {
  const evaluate = (distance: number, severity: number, typography = false) => {
    resetCinematicFx();
    for (let i = 0; i < 180; i++) {
      cinematicFx.collisionStress = severity;
      updateCinematicOptics(cinematicFx, {
        dt: 1 / 60, subjectDistance: distance, restDistance: 1500, rackFocus: 0.6,
        apertureDepthFactor: 0.8, bloomSpike: severity, music: 0.1,
        typography, cinematic: !typography, reducedMotion: false,
      });
    }
    return { ...cinematicFx };
  };
  const wide = evaluate(1500, 0);
  const near = evaluate(450, 0);
  const impact = evaluate(450, 1);
  const text = evaluate(450, 1, true);
  assert.ok(near.focusDistanceFactor < wide.focusDistanceFactor * 0.5);
  assert.ok(near.apertureDepthFactor < wide.apertureDepthFactor);
  assert.ok(impact.exposure > near.exposure && impact.bloom > near.bloom);
  assert.ok(impact.exposure <= 1.16 && impact.bloom <= 0.28);
  assert.ok(text.exposure <= 1.07 && text.bloom <= 0.13 && text.dofAmount <= 0.18);
  resetCinematicFx();
  assert.equal(cinematicFx.exposure, 1);
  assert.equal(cinematicFx.collisionStress, 0);
});

runTest("idle: breath yields to navigation, recovers smoothly and agrees across frame rates", () => {
  const step = (fps: number, previous: number, idle: number, blocked: boolean) => {
    for (let i = 0; i < fps; i++) previous = advanceIdleBlend(previous, idle, 1 / fps, blocked);
    return previous;
  };
  assert.ok(Math.abs(step(30, 0, 5000, false) - step(120, 0, 5000, false)) < 1e-6);
  const idle = step(60, 0, 5000, false);
  assert.ok(idle > 0.7);
  assert.ok(step(60, idle, 0, false) < 0.001);
  assert.ok(step(60, idle, 5000, true) < 0.001);
  assert.ok(advanceIdleBlend(1, 0, 0.6, false) < 0.001, "slow frames still yield promptly to input");
  assert.notDeepEqual(sampleIdleBreathing(1, 1), sampleIdleBreathing(4, 1));
  assert.ok(Math.abs(sampleIdleBreathing(2, 1, true).x) < Math.abs(sampleIdleBreathing(2, 1).x) * 0.25);
  assert.ok(Object.values(sampleIdleBreathing(10, 0)).every(n => n === 0));
  assert.deepEqual(sampleIdleParticle(2, 0.5, 1), sampleIdleParticle(2, 0.5, 1));
  assert.ok(Object.values(sampleIdleParticle(5, 2, 0)).every(n => n === 0));
});

runTest("arrival: exact spring is stable at low FPS and every wave lands on the shared deadline", () => {
  const initial = { x: 1400, y: -700, z: 900, vx: 0, vy: 0, vz: 0 };
  const fast = { ...initial }, slow = { ...initial };
  for (let i = 0; i < 60; i++) advanceCriticalSpring(fast, 0, 0, 0, 0.28, 1);
  for (let i = 0; i < 20; i++) advanceCriticalSpring(slow, 0, 0, 0, 0.28, 3);
  assert.ok(Math.hypot(slow.x, slow.y, slow.z) < 0.01);
  assert.ok(Math.abs(fast.x - slow.x) < 1e-8, "the analytic solution agrees across frame rates");
  for (const step of [0.01, 0.2, 0.75]) {
    let previous = 0, distance = 1000;
    for (let progress = step; previous < 1; progress += step) {
      const current = Math.min(1, progress);
      distance *= 1 - computeArrivalCorrection(previous, current);
      previous = current;
    }
    assert.equal(distance, 0);
  }
  assert.equal(computeArrivalCorrection(1, 1), 0, "steady state remains interactive");
});

runTest("director: IDLE → DEPART → HIDDEN → REVEAL → IDLE, rebuild runs exactly once while hidden", () => {
  const d = new CinematicTransitionDirector();
  let applied = 0;
  let veilAtApply = -1;
  let last = 0;
  assert.equal(d.update(0), NEUTRAL_SHOT);
  d.request({ key: "stage", preset: "stage", apply: () => { applied++; veilAtApply = last; } }, 0);
  assert.equal(d.currentPhase, "DEPART");
  const phases = new Set<string>();
  const stagePhases = new Set<string>();
  for (let t = 0; t <= 4000; t += 1000 / 60) {
    const s = d.update(t);
    last = s.veil;
    phases.add(s.phase);
    stagePhases.add(s.transitionPhase);
  }
  assert.deepEqual([...phases].sort(), ["DEPART", "HIDDEN", "IDLE", "REVEAL"].sort());
  assert.ok(stagePhases.has("PHASE_DESTABILIZE"));
  assert.ok(stagePhases.has("PHASE_TRANSIT_CUTSCENE"));
  assert.ok(stagePhases.has("PHASE_SETTLE"));
  assert.equal(applied, 1);
  assert.ok(veilAtApply > 0.95, `rebuild must happen with the subject hidden (veil ${veilAtApply})`);
  assert.equal(d.currentPhase, "IDLE");
  assert.equal(d.isBusy, false);
});

runTest("TransitionDirector: multi-stage phases map 0-25% DESTABILIZE, 25-75% TRANSIT_CUTSCENE, 75-100% SETTLE", () => {
  assert.equal(resolveTransitionStagePhase(0.0, true), "IDLE");
  assert.equal(resolveTransitionStagePhase(0.10, false), "PHASE_DESTABILIZE");
  assert.equal(resolveTransitionStagePhase(0.24, false), "PHASE_DESTABILIZE");
  assert.equal(resolveTransitionStagePhase(0.25, false), "PHASE_TRANSIT_CUTSCENE");
  assert.equal(resolveTransitionStagePhase(0.50, false), "PHASE_TRANSIT_CUTSCENE");
  assert.equal(resolveTransitionStagePhase(0.74, false), "PHASE_TRANSIT_CUTSCENE");
  assert.equal(resolveTransitionStagePhase(0.75, false), "PHASE_SETTLE");
  assert.equal(resolveTransitionStagePhase(0.99, false), "PHASE_SETTLE");
});

runTest("TransitionDirector: maneuvers produce expected FOV warp, bloom spike, shockwave, and angular velocity", () => {
  const d = new TransitionDirector();
  // Relativistic jet / warp pass widens FOV from 45 deg toward 85 deg and back to 45 deg
  d.request({ key: "w", preset: "warp", apply: () => {} }, 0);
  const warpShots = drive(d, 0, 3000);
  const maxFovDeg = Math.max(...warpShots.map((s) => s.fovDegrees));
  assert.ok(maxFovDeg > 75 && maxFovDeg <= 85.1, `Expected FOV to widen near 85 deg, got ${maxFovDeg}`);

  // Kilonova / Supernova flash masking produces volumetric bloomSpike and shockwaveRadius
  d.reset(true);
  d.request({ key: "sn", preset: "supernova", apply: () => {} }, 0);
  const snShots = drive(d, 0, 4500);
  const maxBloom = Math.max(...snShots.map((s) => s.bloomSpike));
  const maxShockwave = Math.max(...snShots.map((s) => s.shockwaveRadius));
  assert.ok(maxBloom > 0.7, `Expected strong bloom spike, got ${maxBloom}`);
  assert.ok(maxShockwave > 0.8, `Expected expanding shockwave shell, got ${maxShockwave}`);
});

runTest("Morton 3D Z-order stratification & Optimal Transport bucketing decouple sequential glyph order", () => {
  const m0 = encodeMorton3D(0, 0, 0);
  const m1 = encodeMorton3D(1, 1, 1);
  assert.equal(m0, 0);
  assert.ok(m1 > 0);

  // Create sequential scanline points (left-to-right, top-to-bottom)
  const scanline: { x: number; y: number; color: string }[] = [];
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 20; x++) {
      scanline.push({ x: x * 50, y: y * 50, color: "#4deeea" });
    }
  }
  const stratified = stratifyTargetsByMorton(scanline, 1000, 500, 42);
  assert.equal(stratified.length, scanline.length);

  // Verify adjacent indices in stratified output are spatially dispersed (not 50px scanline neighbors)
  let totalStepDist = 0;
  for (let i = 1; i < stratified.length; i++) {
    totalStepDist += Math.hypot(stratified[i]!.x - stratified[i - 1]!.x, stratified[i]!.y - stratified[i - 1]!.y);
  }
  const avgStepDist = totalStepDist / (stratified.length - 1);
  assert.ok(avgStepDist > 180, `Expected dispersed adjacent targets (>180px avg distance), got ${avgStepDist}`);

  // Optimal transport coarse 3D spatial bucket assignment
  const dummyParticles: Particle[] = scanline.map((pt, idx) => ({
    x: pt.x,
    y: pt.y,
    z: 0,
    targetX: 0,
    targetY: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    color: "#ffffff",
    baseColor: "#ffffff",
    size: 1,
    seed: [(idx * 0.13) % 1, (idx * 0.29) % 1, (idx * 0.47) % 1, (idx * 0.71) % 1],
  }));
  const assigned = assignTargetsOptimalTransport(dummyParticles, stratified, 1000, 500, 99);
  assert.equal(assigned.length, dummyParticles.length);
});

runTest("Wavefront triggering t_local, quintic smoothstep, 3D curl noise, critically damped spring, and blackbody continuity", () => {
  // Outer particle (dNorm = 0.0) activates before inner particle (dNorm = 1.0)
  const tOuter = computeLocalWavefrontProgress(0.35, 0.0, 0.1, 0.45, 0.20);
  const tInner = computeLocalWavefrontProgress(0.35, 1.0, 0.1, 0.45, 0.20);
  assert.ok(tOuter > tInner, `Outer wavefront (${tOuter}) must lead inner wavefront (${tInner})`);
  assert.equal(quinticSmoothstep(0), 0);
  assert.equal(quinticSmoothstep(1), 1);
  assert.equal(quinticSmoothstep(0.5), 0.5);

  // 3D Curl Noise is finite and deterministic
  const c1 = computeCurlNoise3D(120, -45, 80, 2.5);
  const c2 = computeCurlNoise3D(120, -45, 80, 2.5);
  assert.deepEqual(c1, c2);
  assert.ok(Number.isFinite(c1.x) && Number.isFinite(c1.y) && Number.isFinite(c1.z));
  assert.deepEqual(computeCurlNoise3D(NaN, 0, 0, 1), { x: 0, y: 0, z: 0 });

  // Critically damped spring pulls toward target and opposes velocity
  const f = computeCriticallyDampedSpringForce(100, 0, 0, 0, 0, 0, 10, 0, 0, 0.16);
  assert.ok(f.fx < 0, "Restoring + damping force must oppose positive displacement and velocity");

  // Blackbody continuity shifts high-velocity transit particles toward hotter blue/white
  const cold = computeBlackbodyColorContinuity(200, 100, 50, 200, 100, 50, 0.5, 0, false);
  const hot = computeBlackbodyColorContinuity(200, 100, 50, 200, 100, 50, 0.5, 35, true);
  assert.ok(hot.b > cold.b && hot.heatBoost > 1.0, "High velocity in transit boosts blue channel and emissive heat");
});

runTest("director: veil is continuous (no frame-to-frame jump > 0.08) and fg is fully hidden at HIDDEN", () => {
  const d = new CinematicTransitionDirector();
  d.request({ key: "s", preset: "scene", apply: () => {} }, 0);
  const shots = drive(d, 0, 5000);
  for (let i = 1; i < shots.length; i++) {
    assert.ok(Math.abs(shots[i]!.veil - shots[i - 1]!.veil) < 0.08, `veil jump at ${shots[i]!.t}`);
    assert.ok(Math.abs(shots[i]!.yaw - shots[i - 1]!.yaw) < 0.06, `yaw jump at ${shots[i]!.t}`);
  }
  for (const s of shots.filter((x) => x.phase === "HIDDEN")) assert.ok(s.foregroundAlpha < 0.01);
});

runTest("director: requests during DEPART coalesce by key and the heavier preset wins", () => {
  const d = new CinematicTransitionDirector();
  const log: string[] = [];
  d.request({ key: "stage", preset: "stage", apply: () => log.push("a") }, 0);
  d.update(100);
  d.request({ key: "stage", preset: "stage", apply: () => log.push("b") }, 100);
  d.request({ key: "scene", preset: "supernova", apply: () => log.push("c") }, 120);
  assert.equal(d.pendingCount, 2);
  // stage depart (560 ms) would be over by 900 ms; the supernova preset keeps departing.
  d.update(900);
  assert.equal(d.currentPhase, "DEPART");
  drive(d, 900, 7000);
  assert.deepEqual(log, ["b", "c"]);
});

runTest("director: a request during REVEAL reverses from the current veil without a jump", () => {
  const d = new CinematicTransitionDirector();
  let n = 0;
  d.request({ key: "k", preset: "stage", apply: () => n++ }, 0);
  let t = 0;
  let s = d.update(t);
  while (s.phase !== "REVEAL") s = d.update((t += 16));
  for (let i = 0; i < 20; i++) s = d.update((t += 16));
  const before = s.veil;
  assert.ok(before > 0.05 && before < 1);
  d.request({ key: "k", preset: "stage", apply: () => n++ }, t);
  const after = d.update(t + 1).veil;
  assert.ok(Math.abs(after - before) < 0.02, `reversal jumped ${before} → ${after}`);
  drive(d, t, t + 5000);
  assert.equal(n, 2);
});

runTest("director: cutToHidden applies at once and emerges; reset flushes; throwing rebuilds are counted", () => {
  const d = new CinematicTransitionDirector();
  let ran = false;
  d.cutToHidden({ key: "emerge", preset: "emerge", apply: () => { ran = true; } }, 0);
  assert.equal(ran, true);
  assert.equal(d.currentPhase, "HIDDEN");
  assert.equal(d.update(1).veil, 1);
  drive(d, 1, 4000);
  assert.equal(d.currentPhase, "IDLE");

  const silence = console.error;
  console.error = () => {};
  try {
    d.request({ key: "boom", apply: () => { throw new Error("x"); } }, 5000);
    drive(d, 5000, 9000);
  } finally {
    console.error = silence;
  }
  assert.equal(d.errorCount, 1);
  assert.equal(d.currentPhase, "IDLE");

  let flushed = false;
  d.request({ key: "late", apply: () => { flushed = true; } }, 10000);
  d.reset(true);
  assert.equal(flushed, true);
  assert.equal(d.currentPhase, "IDLE");
});

runTest("director: reduced motion never moves the camera", () => {
  const d = new CinematicTransitionDirector();
  d.reducedMotion = true;
  d.request({ key: "s", preset: "scene", apply: () => {} }, 0);
  for (const s of drive(d, 0, 3000)) {
    assert.equal(s.yaw, 0);
    assert.equal(s.pitch, 0);
    assert.equal(s.dolly, 0);
  }
  assert.equal(SHOT_PRESETS.reduced.yaw, 0);
});

runTest("gravity field: points at the mass, saturates, ignores bad bodies", () => {
  const f = computeGravityField({ x: 0, y: 0, z: 0 }, [{ x: 500, y: 0, z: 0, mass: 54000, radius: 60, isBlackHole: true }], 1000);
  assert.ok(f.dir.x > 0.99);
  assert.ok(f.strength > 0 && f.strength < 1);
  const near = computeGravityField({ x: 0, y: 0, z: 0 }, [{ x: 70, y: 0, z: 0, mass: 54000, radius: 60, isBlackHole: true }], 1000);
  assert.ok(near.strength > f.strength && near.strength <= 1);
  assert.ok(near.horizonProximity > 0.9);
  const bad = computeGravityField({ x: 0, y: 0, z: 0 }, [{ x: NaN, y: 0, z: 0, mass: -1, radius: 1 }, null as any], 1000);
  assert.equal(bad.strength, 0);
  assert.deepEqual(bad.dir, { x: 0, y: 0, z: 0 });
});

runTest("camera rig: drifts toward mass within RIG_LIMITS, stays finite, impulses decay", () => {
  const rig = new CameraRig();
  const camZ = 1500;
  const base = {
    cameraPos: { x: 0, y: 0, z: -camZ },
    right: { x: 1, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 },
    forward: { x: 0, y: 0, z: 1 },
    bodies: [{ x: 800, y: 0, z: 0, mass: 200000, radius: 80, isBlackHole: true }],
    cameraZ: camZ,
    responsiveness: 1,
  };
  let out = rig.update({ ...base, time: 0, dt: 1 / 60 });
  for (let i = 1; i < 600; i++) out = rig.update({ ...base, time: i / 60, dt: 1 / 60 });
  assert.ok(out.offset.x > 0, "drifts toward the mass on +x");
  assert.ok(out.yaw > 0, "leans toward the mass");
  const maxOffset = (RIG_LIMITS.drift * 1.3 + RIG_LIMITS.shake + RIG_LIMITS.kick) * camZ;
  assert.ok(Math.hypot(out.offset.x, out.offset.y, out.offset.z) < maxOffset);
  assert.ok(Math.abs(out.roll) <= 0.06);

  rig.addImpulse({ x: 0, y: 1, z: 0 }, 1);
  let peak = 0;
  for (let i = 0; i < 30; i++) {
    rig.update({ ...base, bodies: [], time: 10 + i / 60, dt: 1 / 60 });
    peak = Math.max(peak, rig.kickEnergy);
  }
  assert.ok(peak > 0.005, "impulse moves the camera");
  for (let i = 0; i < 400; i++) rig.update({ ...base, bodies: [], time: 11 + i / 60, dt: 1 / 60 });
  assert.ok(rig.kickEnergy < peak * 0.05, "impulse decays");

  const nan = rig.update({ ...base, cameraPos: { x: NaN, y: 0, z: 0 }, dt: NaN, time: NaN, responsiveness: NaN });
  for (const v of [nan.offset.x, nan.offset.y, nan.offset.z, nan.yaw, nan.pitch, nan.roll]) assert.ok(Number.isFinite(v));
});

runTest("camera rig: typography responsiveness damps the motion", () => {
  const run = (resp: number) => {
    const rig = new CameraRig();
    let o = rig.update({
      cameraPos: { x: 0, y: 0, z: -1500 }, right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 }, forward: { x: 0, y: 0, z: 1 },
      bodies: [{ x: 600, y: 0, z: 0, mass: 100000, radius: 60 }], cameraZ: 1500, responsiveness: resp, time: 0, dt: 1 / 60,
    });
    for (let i = 0; i < 300; i++) {
      o = rig.update({
        cameraPos: { x: 0, y: 0, z: -1500 }, right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 }, forward: { x: 0, y: 0, z: 1 },
        bodies: [{ x: 600, y: 0, z: 0, mass: 100000, radius: 60 }], cameraZ: 1500, responsiveness: resp, time: i / 60, dt: 1 / 60,
      });
    }
    return Math.abs(o.offset.x);
  };
  assert.ok(run(0.3) < run(1) * 0.5);
});

runTest("springStep / smoothNoise: stable and bounded", () => {
  let p = 1;
  let v = 0;
  for (let i = 0; i < 600; i++) [p, v] = springStep(p, v, 0, 5, 1, 1 / 60);
  assert.ok(Math.abs(p) < 1e-3);
  [p, v] = springStep(NaN, NaN, NaN, 5, 1, 1);
  assert.ok(Number.isFinite(p) && Number.isFinite(v));
  for (let t = 0; t < 50; t += 0.37) assert.ok(Math.abs(smoothNoise(t, 3)) <= 1);
});

runTest("black-hole capture: continuous at u=0, accelerating inspiral, redshift then blackout, done flag", () => {
  const start = { x: 0, y: 0, z: -1500 };
  const look = { x: 0, y: 0, z: 0 };
  const bh = { x: 200, y: 50, z: 0 };
  const st = createCaptureState(1000, start, look, bh, 60, 4000);
  const p0 = computeCapturePose(st, 1000);
  assert.ok(Math.hypot(p0.pos.x - start.x, p0.pos.y - start.y, p0.pos.z - start.z) < 1e-6, "no snap at hand-over");
  assert.ok(Math.hypot(p0.look.x - look.x, p0.look.y - look.y, p0.look.z - look.z) < 1e-6);
  assert.equal(p0.blackout, 0);
  let prevR = Infinity;
  let prevStep = 0;
  let prevPos = p0.pos;
  for (let t = 1000; t <= 5000; t += 50) {
    const p = computeCapturePose(st, t);
    const r = Math.hypot(p.pos.x - bh.x, p.pos.y - bh.y, p.pos.z - bh.z);
    assert.ok(r <= prevR + 1e-6, "radius never grows");
    prevR = r;
    const step = Math.hypot(p.pos.x - prevPos.x, p.pos.y - prevPos.y, p.pos.z - prevPos.z);
    if (t > 1000 && t < 3000) assert.ok(step >= prevStep - 1e-6, "fall accelerates");
    prevStep = step;
    prevPos = p.pos;
    assert.ok(p.redshift >= 0 && p.redshift <= 1 && p.blackout >= 0 && p.blackout <= 1);
  }
  assert.ok(prevR < 60 * 1.2, "ends at the horizon");
  const mid = computeCapturePose(st, 3000);
  assert.ok(mid.blackout === 0 && mid.done === false);
  const end = computeCapturePose(st, 5000);
  assert.equal(end.done, true);
  assert.equal(end.blackout, 1);
  assert.ok(end.redshift > 0.99);
});

runTest("fx bus: collision severity is monotonic/saturating, queue drains and is bounded", () => {
  resetCinematicFx();
  assert.equal(collisionSeverity(0), 0);
  assert.equal(collisionSeverity(NaN), 0);
  assert.ok(collisionSeverity(100) < collisionSeverity(1000));
  assert.ok(collisionSeverity(1e9) <= 1);
  emitCollision({ x: 0, y: 0, z: 0, energy: 0, time: 0 });
  emitCollision({ x: 0, y: 0, z: 0, energy: NaN, time: 0 });
  assert.equal(drainCollisions().length, 0);
  for (let i = 0; i < 40; i++) emitCollision({ x: i, y: 0, z: 0, energy: 50, time: i });
  const drained = drainCollisions();
  assert.equal(drained.length, 16);
  assert.equal(drained[drained.length - 1]!.x, 39);
  assert.equal(drainCollisions().length, 0);
  cinematicFx.flash = 1;
  resetCinematicFx();
  assert.equal(cinematicFx.flash, 0);
  assert.equal(cinematicFx.foregroundAlpha, 1);
});

runTest("entitiesToGravityBodies: screen → world, excludes nebulas/destroyed, black holes dominate", () => {
  const bodies = entitiesToGravityBodies(
    [
      { x: 500, y: 300, radius: 40, type: "blackhole" },
      { x: 100, y: 100, radius: 40, type: "star", z: 20 },
      { x: 0, y: 0, radius: 200, type: "nebula" },
      { x: 0, y: 0, radius: 20, type: "planet", isDestroyed: true },
      { x: NaN, y: 0, radius: 20, type: "planet" },
    ],
    1000,
    600
  );
  assert.equal(bodies.length, 2);
  assert.ok(bodies[0]!.x === 0 && bodies[0]!.y === 0 && bodies[0]!.z === 0);
  assert.equal(bodies[0]!.isBlackHole, true);
  assert.deepEqual([bodies[1]!.x, bodies[1]!.y, bodies[1]!.z], [-400, 200, 20]);
  assert.ok(bodies[0]!.mass > bodies[1]!.mass);
});

runTest("settleParticlesToTargets: puts particles on targets, kills tails, clears motion history", () => {
  const ps = [
    { x: 0, y: 0, z: 5, vx: 3, vy: 3, vz: 3, targetX: 10, targetY: 20, targetZ: 7, prevDrawX: 1, prevDrawY: 1 },
    { x: 0, y: 0, z: 0, vx: 1, vy: 1, vz: 1, isTail: true, life: 1, prevDrawX: 1 },
    { x: 1, y: 2, z: 3, isCosmicAmbient: true, targetX: 50, targetY: 50 },
  ] as unknown as Particle[];
  const n = settleParticlesToTargets(ps);
  assert.equal(n, 1);
  const [a, tail, amb] = ps as any[];
  assert.deepEqual([a.x, a.y, a.z, a.vx, a.vy, a.vz], [10, 20, 7, 0, 0, 0]);
  assert.equal(a.prevDrawX, undefined);
  assert.equal(tail.life, 0);
  assert.equal(amb.x, 1);
  assert.equal(settleParticlesToTargets(null as any), 0);
});

runTest("settleEntitiesInstantly: replaces bodies at their final pose with fresh ids", () => {
  const current = [{ id: "old", type: "star", x: 0, y: 0, radius: 10 }] as unknown as CelestialEntity[];
  const target = [
    { id: "sun", type: "star", x: 100, y: 200, z: 30, radius: 25, scale: 0.1 },
    { type: "planet", x: NaN, y: 5, radius: -1 },
  ] as unknown as CelestialEntity[];
  settleEntitiesInstantly(current, target);
  assert.equal(current.length, 2);
  const [s, p] = current as any[];
  assert.ok(s.id.startsWith("sun~") && s.id !== "sun", "fresh id so stale meshes are never reused");
  assert.deepEqual([s.x, s.y, s.z, s.radius, s.scale], [100, 200, 30, 25, 1]);
  assert.deepEqual([s.targetX, s.targetY, s.targetRadius], [100, 200, 25]);
  assert.equal(p.x, 0);
  assert.equal(p.radius, 20);
});

runTest("smoothstep handles equal edges", () => {
  assert.equal(smoothstep(1, 1, 0.5), 0);
  assert.equal(smoothstep(1, 1, 2), 1);
});

runTest("simulateParticles: organic wavefront morphing, 3D curl dispersion, and spring arrival converge without NaNs or block locking", () => {
  const count = 64;
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: 200 + (i % 8) * 40,
      y: 200 + Math.floor(i / 8) * 40,
      z: 0,
      targetX: 800 + ((i * 7) % 8) * 35,
      targetY: 400 + ((i * 3) % 8) * 35,
      targetZ: 10,
      vx: 0,
      vy: 0,
      vz: 0,
      color: "#4deeea",
      baseColor: "#4deeea",
      size: 1,
      isProjectText: true,
    });
  }
  snapshotParticleTransitionStart(particles, 500, 300, 0, 600, true);
  triggerOrganicParticleDisperse(particles, 500, 300, 0, 1.0);

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 4);
  const extras = new Float32Array(count);
  const velocities = new Float32Array(count * 3);

  for (let step = 0; step <= 40; step++) {
    const uProgress = step / 40;
    simulateParticles(
      particles,
      positions,
      colors,
      extras,
      {
        currentW: 1920,
        currentH: 1080,
        time: step * 1.0,
        globalTimeMultiplier: 1.0,
        musicAmpVal: 0,
        musicBands: { bass: 0, mid: 0, treble: 0 },
        musicSpeedFactor: 1.0,
        activeBlackholes: [{ type: "blackhole", x: 960, y: 540, radius: 55, color: "#ff8800" }],
        activeCollidables: [],
        activeSupernova: null,
        snElapsed: 9999,
        scrollVelocity: 0,
        ambientParticleSpeed: 0.15,
        objectParticleSpeed: 0.15,
        textParticleSpeed: 0.18,
        particleFilters: { ambient: true, celestial: true, bridges: true, tails: true, typography: true },
        globalAlpha: 1.0,
        isTypographyMode: true,
        isInterstellar: false,
        vortexMultiplier: 1.0,
        attractionMultiplier: 1.0,
        mousePos: { x: -1000, y: -1000 },
        celestialEntities: [],
        spawnTailParticle: () => {},
        screensaverOpacity: 0,
        isTransitActive: false,
        transitProgress: 0,
        transitCx: 960,
        transitCy: 540,
        activeRipples: [],
        audio: null,
        foregroundAlpha: 1.0,
        transitionProgress: uProgress,
        velocities,
        directorShockwaveRadius: uProgress < 0.8 ? uProgress : 0,
      },
      velocities
    );
  }

  for (let i = 0; i < count; i++) {
    assert.ok(Number.isFinite(positions[i * 3]!) && Number.isFinite(positions[i * 3 + 1]!) && Number.isFinite(positions[i * 3 + 2]!));
    assert.ok(Number.isFinite(velocities[i * 3]!) && Number.isFinite(velocities[i * 3 + 1]!) && Number.isFinite(velocities[i * 3 + 2]!));
    assert.ok(Number.isFinite(colors[i * 4]!) && colors[i * 4 + 3]! > 0);
  }
  const arrivalError = particles.reduce((sum, p) => sum + Math.hypot(p.x - p.targetX, p.y - p.targetY), 0) / count;
  assert.ok(arrivalError < 8, `formation must be readable when the shot settles (mean error ${arrivalError}px)`);
});

console.log(`\n  Cinematic tests passed: ${passed} / ${total}\n`);
if (passed < total) process.exit(1);
