/**
 * Pure-logic tests for the cinematic camera layer
 * (director, gravity rig, black-hole capture, FX bus, instant settling).
 */
import assert from "node:assert/strict";
import {
  CinematicTransitionDirector,
  SHOT_PRESETS,
  NEUTRAL_SHOT,
  smoothstep,
} from "../src/components/ParticleCanvas/cinematic/CinematicTransitionDirector";
import {
  CameraRig,
  RIG_LIMITS,
  computeGravityField,
  springStep,
  smoothNoise,
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
} from "../src/components/ParticleCanvas/cinematic/CinematicFxBus";
import { entitiesToGravityBodies } from "../src/components/ParticleCanvas/cinematic/CinematicRuntime";
import { settleParticlesToTargets } from "../src/components/ParticleCanvas/ParticleMapper";
import { settleEntitiesInstantly } from "../src/components/ParticleCanvas/TransitionManager";
import { CelestialEntity, Particle } from "../src/components/ParticleCanvas/types";

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

console.log("\nCinematic camera layer");

runTest("director: IDLE → DEPART → HIDDEN → REVEAL → IDLE, rebuild runs exactly once while hidden", () => {
  const d = new CinematicTransitionDirector();
  let applied = 0;
  let veilAtApply = -1;
  let last = 0;
  assert.equal(d.update(0), NEUTRAL_SHOT);
  d.request({ key: "stage", preset: "stage", apply: () => { applied++; veilAtApply = last; } }, 0);
  assert.equal(d.currentPhase, "DEPART");
  const phases = new Set<string>();
  for (let t = 0; t <= 4000; t += 1000 / 60) {
    const s = d.update(t);
    last = s.veil;
    phases.add(s.phase);
  }
  assert.deepEqual([...phases].sort(), ["DEPART", "HIDDEN", "IDLE", "REVEAL"].sort());
  assert.equal(applied, 1);
  assert.ok(veilAtApply > 0.95, `rebuild must happen with the subject hidden (veil ${veilAtApply})`);
  assert.equal(d.currentPhase, "IDLE");
  assert.equal(d.isBusy, false);
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
  // stage depart (760 ms) would be over by 900 ms; the supernova preset keeps departing.
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

console.log(`\n  Cinematic tests passed: ${passed} / ${total}\n`);
if (passed < total) process.exit(1);
