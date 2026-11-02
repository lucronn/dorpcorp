import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { preview } from "vite";
const browserModule = await import(process.env.PUPPETEER_MODULE || "puppeteer");
const puppeteer = browserModule.default || browserModule.puppeteer;

// Tests only the local production build. All external requests are blocked.
const server = await preview({ preview: { host: "127.0.0.1", port: 4175, strictPort: true } });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_BIN || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--disable-dev-shm-usage"],
});
const artifactDir = process.env.TEST_ARTIFACT_DIR || "/tmp/curtis-cinematic-no-cover";
await mkdir(artifactDir, { recursive: true });

let activePage;
try {
  for (const [width, reduced] of [[1200, false], [390, false], [390, true]]) {
    const page = await browser.newPage();
    activePage = page;
    await page.setViewport({ width, height: 800, deviceScaleFactor: 1 });
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: reduced ? "reduce" : "no-preference" }]);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on("request", request => {
      const url = request.url();
      if (url.includes("/api/")) return request.respond({ status: 200, contentType: "application/json", body: "{}" });
      if (url.startsWith("http://127.0.0.1:4175/") || url.startsWith("data:") || url.startsWith("blob:")) return request.continue();
      return request.abort();
    });
    await page.evaluateOnNewDocument(() => {
      window.__coverSamples = [];
      window.__panImages = {};
      window.__blankImages = [];
      const pixels = document.createElement("canvas");
      const context = pixels.getContext("2d", { willReadFrequently: true });
      const observe = () => {
        const state = window.__cosmicCanvas?.getTransitionCover();
        const element = document.querySelector("[data-transition-cover]");
        if (state && state.renderedFrames > 0) {
          const beat = state.phase === "panning" && state.panProgress > 0.45 && state.panProgress < 0.75 ? "departing"
            : state.phase === "settling" ? "off-frustum"
            : state.phase === "returning" && state.panProgress < 0.65 ? "returning" : null;
          if (beat && !window.__panImages[beat]) {
            window.__panImages[beat] = document.querySelector("#canvas-babylon").toDataURL("image/png");
          }
          const button = document.querySelector('button[title^="01 // SELECTED WORKS"]');
          const rect = button?.getBoundingClientRect();
          const hit = rect && document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
          let imageStats = null;
          if (state.phase !== "idle") {
            const canvas = document.querySelector("#canvas-babylon");
            pixels.width = canvas.width; pixels.height = canvas.height;
            context.drawImage(canvas, 0, 0);
            const rgba = context.getImageData(0, 0, pixels.width, pixels.height).data;
            let dark = 0, lit = 0;
            for (let i = 0; i < rgba.length; i += 4) {
              const light = Math.max(rgba[i], rgba[i + 1], rgba[i + 2]);
              if (light < 18) dark++;
              if (light > 45) lit++;
            }
            imageStats = { darkRatio: dark / (rgba.length / 4), litPixels: lit };
            if ((lit < 20 || imageStats.darkRatio < 0.18) && window.__blankImages.length < 10) {
              window.__blankImages.push(canvas.toDataURL("image/png"));
            }
          }
          window.__coverSamples.push({ ...state, hasCoverElement: !!element, imageStats,
            hudClickable: !!hit?.closest("button") });
        }
        window.__coverObserver = requestAnimationFrame(observe);
      };
      observe();
    });

    const assertSpaceVisible = async () => {
      const blanks = await page.evaluate(() => window.__coverSamples.filter(s =>
        s.imageStats && (s.imageStats.darkRatio < 0.18 || s.imageStats.litPixels < 20)));
      assert.deepEqual(blanks, [], "every rendered transition frame must contain stars and open space");
    };
    await page.goto("http://127.0.0.1:4175/", { waitUntil: "networkidle0" });
    await page.waitForFunction(() => window.__cosmicCanvas?.getTransitionCover().phase === "idle", { timeout: 30000 });
    await assertSpaceVisible();
    await page.click('button[title="Pause on this Scene [Space]"]');

    const switchScene = async (archetype, kind = "float", stage = 0) => {
      const state = await page.evaluate(({ archetype, kind, stage }) => {
        window.__cosmicCanvas.switchToScene(archetype, kind, stage);
        return window.__cosmicCanvas.getTransitionCover();
      }, { archetype, kind, stage });
      if (kind === "float" || kind === "morph" || reduced) {
        assert.equal(state.phase, "panning", "navigation queues a departure before changing targets");
        assert.equal(state.pendingParticles, 0);
        assert(state.pendingJobs > 0);
        assert.equal(state.opacity, 0);
      }
      await page.waitForFunction(() => window.__cosmicCanvas.getTransitionCover().phase === "idle", { timeout: 30000 });
      await assertSpaceVisible();
      assert.equal(await page.evaluate(() => window.__cosmicCanvas.getCurrentArchetype()), archetype);
    };

    await page.click('button[title^="01 // SELECTED WORKS"]');
    await page.waitForFunction(() => window.__cosmicCanvas.getTransitionCover().phase === "idle");
    assert.equal(await page.evaluate(() => window.__cosmicCanvas.getCurrentArchetype()), "SPIRAL_GALAXY");
    assert(await page.evaluate(() => [...document.querySelectorAll("span")].some(el => el.textContent === "01 // SELECTED WORKS")), "HUD selection follows navigation without the old 3.2 second delay");
    await switchScene("SPIRAL_GALAXY");
    assert(await page.evaluate(() => window.__cosmicCanvas.getTransitionCover().cameraZ < 0), "open on the readable side of typography");
    await page.screenshot({ path: `${artifactDir}/galaxy-${width}-${reduced}.png` });
    await switchScene("BINARY_PLANETS", "morph", 2);
    await switchScene("NEBULA_CRADLE", "float", 3);
    await page.screenshot({ path: `${artifactDir}/nebula-${width}-${reduced}.png` });

    // Rapid changes supersede pending departures and partially completed returns.
    await page.evaluate(() => {
      window.__cosmicCanvas.switchToScene("SPIRAL_GALAXY", "float", 4);
      window.__cosmicCanvas.switchToScene("EXOPLANET_CLUSTER", "morph", 5);
    });
    await page.waitForFunction(() => window.__cosmicCanvas.getTransitionCover().phase === "idle");
    assert.equal(await page.evaluate(() => window.__cosmicCanvas.getCurrentArchetype()), "EXOPLANET_CLUSTER");

    if (!reduced) {
      await page.evaluate(() => window.__cosmicCanvas.switchToScene("BINARY_PLANETS", "float", 2));
      await page.waitForFunction(() => {
        const state = window.__cosmicCanvas.getTransitionCover();
        return state.phase === "returning" && state.panProgress < 0.8;
      });
      // Click the real HTML HUD while the camera is returning.
      await page.click('button[title^="01 // SELECTED WORKS"]');
      await page.waitForFunction(() => window.__cosmicCanvas.getTransitionCover().phase === "idle");
      assert.equal(await page.evaluate(() => window.__cosmicCanvas.getCurrentArchetype()), "SPIRAL_GALAXY");

      // An effects request arriving during departure waits for camera ownership.
      await page.evaluate(() => {
        window.__cosmicCanvas.switchToScene("BINARY_PLANETS", "float", 2);
        window.__cosmicCanvas.switchToScene("NEBULA_CRADLE", "wormhole", 3);
      });
      await page.waitForFunction(() => window.__cosmicCanvas.getTransitionCover().transitActive, { timeout: 30000 });
      await page.waitForFunction(() => {
        const state = window.__cosmicCanvas.getTransitionCover();
        return state.phase === "idle" && !state.transitActive;
      }, { timeout: 30000 });
      assert.equal(await page.evaluate(() => window.__cosmicCanvas.getCurrentArchetype()), "NEBULA_CRADLE");
    }

    // Observe the queued handoff after the wormhole releases camera ownership.
    await page.evaluate(() => window.__cosmicCanvas.switchToScene("SPIRAL_GALAXY", "wormhole", 0));
    await page.waitForFunction(() => window.__cosmicCanvas.getTransitionCover().phase === "settling", { timeout: 30000 });
    assert(await page.evaluate(() => { const s = window.__cosmicCanvas.getTransitionCover(); return s.occluded && s.starfieldEnabled && s.opacity === 0; }));
    await page.waitForFunction(() => window.__cosmicCanvas.getTransitionCover().phase === "idle", { timeout: 30000 });

    await page.evaluate(() => window.__cosmicCanvas.switchToScene("NEBULA_CRADLE", "supernova", 0));
    await page.waitForFunction(() => window.__cosmicCanvas.getTransitionCover().phase === "settling", { timeout: 30000 });
    await page.waitForFunction(() => window.__cosmicCanvas.getTransitionCover().phase === "idle", { timeout: 30000 });

    if (!reduced) {
      // An old transit must never replace the scene after a newer selection.
      await page.evaluate(() => {
        window.__cosmicCanvas.switchToScene("BINARY_PLANETS", "wormhole", 1);
        window.__cosmicCanvas.switchToScene("EXOPLANET_CLUSTER", "float", 2);
      });
      await page.waitForFunction(() => window.__cosmicCanvas.getTransitionCover().phase === "idle");
      await new Promise(resolve => setTimeout(resolve, 5700));
      assert.equal(await page.evaluate(() => window.__cosmicCanvas.getCurrentArchetype()), "EXOPLANET_CLUSTER");
    }

    await page.setViewport({ width: width + 80, height: 800, deviceScaleFactor: 1 });
    await page.waitForFunction(() => window.__cosmicCanvas.getTransitionCover().phase === "settling", { timeout: 10000 });
    // Change the frustum again while destination buffers are still settling.
    const beforeResizeRevision = await page.evaluate(() => window.__cosmicCanvas.getTransitionCover().revision);
    await page.setViewport({ width: width + 160, height: 720, deviceScaleFactor: 1 });
    // Reduced-motion returns can finish before the resize debounce fires. Wait
    // for this resize's revision as well as idle, not the preceding return.
    await page.waitForFunction(revision => {
      const s = window.__cosmicCanvas.getTransitionCover();
      return s.revision > revision && s.phase === "idle" && s.pendingJobs === 0;
    }, { timeout: 30000 }, beforeResizeRevision);

    if (!reduced) {
      await page.evaluate(() => window.__cosmicCanvas.switchToScene("BINARY_PLANETS", "float", 2));
      await page.waitForFunction(() => {
        const s = window.__cosmicCanvas.getTransitionCover();
        return s.phase === "panning" && s.panProgress > 0;
      });
      await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
      await page.waitForFunction(() => window.__cosmicCanvas.getTransitionCover().phase === "idle");
      assert.equal(await page.evaluate(() => window.__cosmicCanvas.getTransitionCover().mode), "cut");
      await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
      await page.waitForFunction(() => !window.__cosmicCanvas.getTransitionCover().reducedMotion);
    }

    const result = await page.evaluate((reduced) => {
      cancelAnimationFrame(window.__coverObserver);
      const samples = window.__coverSamples;
      const pending = samples.filter(s => s.pendingParticles > 0 || s.phase === "remapping" || s.phase === "settling");
      const visibleButton = [...document.querySelectorAll("button")].find(button => {
        const r = button.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight;
      });
      const rect = visibleButton?.getBoundingClientRect();
      const hit = rect && document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return { frames: samples.length, pendingFrames: pending.length,
        leaks: pending.filter(s => !(s.occluded && s.margin > 0)),
        covers: samples.filter(s => s.hasCoverElement || s.opacity !== 0 || s.occluderEnabled),
        blankFrames: samples.filter(s => s.imageStats && (s.imageStats.darkRatio < 0.18 || s.imageStats.litPixels < 20)),
        missingStars: samples.filter(s => !s.starfieldEnabled),
        minLitPixels: Math.min(...samples.filter(s => s.imageStats).map(s => s.imageStats.litPixels)),
        minDarkRatio: Math.min(...samples.filter(s => s.imageStats).map(s => s.imageStats.darkRatio)),
        panFrames: samples.filter(s => s.phase === "panning" && s.panProgress > 0 && s.panProgress < 1).length,
        returnFrames: samples.filter(s => s.phase === "returning").length,
        blockedHudFrames: pending.filter(s => !s.hudClickable),
        hudClickable: !!hit?.closest("button"), final: window.__cosmicCanvas.getTransitionCover() };
    }, reduced);
    const captures = await page.evaluate(() => window.__panImages);
    for (const [beat, data] of Object.entries(captures)) {
      await writeFile(`${artifactDir}/${beat}-${width}-${reduced}.png`, Buffer.from(data.split(",")[1], "base64"));
    }
    assert(result.pendingFrames > 0, "test must actually sample the remesh window");
    assert.deepEqual(result.leaks, []);
    assert.deepEqual(result.covers, []);
    assert.deepEqual(result.blankFrames, []);
    assert.deepEqual(result.missingStars, []);
    assert.deepEqual(result.blockedHudFrames, []);
    assert(result.returnFrames > 0);
    if (!reduced) assert(result.panFrames > 0, "observe real camera departures");
    assert(result.hudClickable, "camera transition must leave the HUD interactive");
    assert.equal(result.final.phase, "idle");
    assert.equal(result.final.pendingJobs, 0);
    assert.equal(result.final.pendingParticles, 0);
    assert.equal(result.final.reducedMotion, reduced);
    if (reduced) {
      assert.equal(result.final.transitActive, false);
      assert.equal(result.final.cameraRoll, 0);
      assert(Math.abs(result.final.cameraFov - Math.PI / 3) < 0.00001);
    }
    assert.deepEqual(errors, []);
    await writeFile(`${artifactDir}/metrics-${width}-${reduced}.json`, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ width, reduced, ...result }));
    await page.close();
  }
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    const blanks = await activePage.evaluate(() => window.__blankImages || []);
    for (const [i, data] of blanks.entries()) {
      await writeFile(`${artifactDir}/blank-${i}.png`, Buffer.from(data.split(",")[1], "base64"));
    }
    const state = await activePage.evaluate(() => ({ current: window.__cosmicCanvas?.getTransitionCover(), samples: window.__coverSamples?.slice(-30) }));
    await writeFile(`${artifactDir}/failure.json`, JSON.stringify(state, null, 2));
    await activePage.screenshot({ path: `${artifactDir}/failure.png` });
    console.error("Browser failure state:", JSON.stringify(state.current));
  }
  throw error;
} finally {
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
