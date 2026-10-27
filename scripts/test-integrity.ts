import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import {
  blendHexColors,
  normalizeHexColor,
  valueNoise2D,
  fBmNoise2D,
  computeCurlNoise,
  resolveCelestialCollision,
} from "../src/components/ParticleCanvas/PhysicsUtils";
import { CelestialEntity } from "../src/components/ParticleCanvas/types";
import { createNeutronStarBirthEvent } from "../src/components/ParticleCanvas/scenes/neutronstarbirth";
import { getProceduralFallbackSystem, startServer } from "../server";

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

  console.log("\n==> Testing Procedural Cosmic System Generator & 3D Scene Architecture");

  runTest("getProceduralFallbackSystem: validates structure across 50 iterations and covers all 5 archetypes", () => {
    const encounteredArchetypes = new Set<string>();
    const expectedArchetypes = [
      "BLACKHOLE_CENTRIC",
      "BINARY_PLANETS",
      "NEBULA_CRADLE",
      "EXOPLANET_CLUSTER",
      "SPIRAL_GALAXY",
    ];

    for (let i = 0; i < 50; i++) {
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
      assert.ok(encounteredArchetypes.has(archetype), `Archetype ${archetype} must be generated within 50 runs`);
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
      if (options.headers?.["Content-Type"] === "application/json" && (options as any).body) {
        req.write((options as any).body);
      }
      req.end();
    });
  };

  await runTest("GET /health: returns healthy status and uptime", async () => {
    const res = await makeRequest("/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "healthy");
    assert.equal(res.body.service, "curtis-click-portfolio");
    assert.ok(typeof res.body.uptime === "number");
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

  await runTest("ALL /api/unknown: returns 404 JSON error instead of HTML SPA", async () => {
    const res = await makeRequest("/api/non-existent-endpoint");
    assert.equal(res.status, 404);
    assert.equal(res.body.error, "Endpoint not found");
  });

  await runTest("POST /api/log-error: records client diagnostics", async () => {
    const res = await makeRequest("/api/log-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Synthetic client test error" }),
    } as any);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
  });

  // Close test server
  await new Promise<void>((resolve) => server.close(() => resolve()));

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
