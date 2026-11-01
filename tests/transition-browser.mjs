import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
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
const artifactDir = process.env.TEST_ARTIFACT_DIR || "/tmp/curtis-depth-transitions";
await mkdir(artifactDir, { recursive: true });

try {
  for (const [width, reduced] of [[1200, false], [390, true]]) {
    const page = await browser.newPage();
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
    await page.goto("http://127.0.0.1:4175/", { waitUntil: "networkidle0" });
    await page.waitForFunction(() => window.__cosmicCanvas?.getTransitionCover().phase === "idle", { timeout: 30000 });
    await page.click('button[title="Pause on this Scene [Space]"]');
    await page.evaluate(() => {
      window.__coverSamples = [];
      const observe = () => {
        const state = window.__cosmicCanvas?.getTransitionCover();
        const element = document.querySelector("[data-transition-cover]");
        if (state && element) {
          const css = getComputedStyle(element);
          window.__coverSamples.push({ ...state, actualOpacity: Number(css.opacity), background: css.backgroundColor });
        }
        window.__coverObserver = requestAnimationFrame(observe);
      };
      observe();
    });

    const switchScene = async (archetype, kind = "float", stage = 0) => {
      const state = await page.evaluate(({ archetype, kind, stage }) => {
        window.__cosmicCanvas.switchToScene(archetype, kind, stage);
        return window.__cosmicCanvas.getTransitionCover();
      }, { archetype, kind, stage });
      if (kind === "float" || kind === "morph" || reduced) {
        assert.equal(state.opacity, 1, "the same task that changes targets must raise full cover");
        assert(state.pendingParticles > 0);
      }
      await page.waitForFunction(() => window.__cosmicCanvas.getTransitionCover().phase === "idle", { timeout: 30000 });
      assert.equal(await page.evaluate(() => window.__cosmicCanvas.getCurrentArchetype()), archetype);
    };

    await page.click('button[title^="01 // SELECTED WORKS"]');
    await page.waitForFunction(() => window.__cosmicCanvas.getTransitionCover().phase === "idle");
    assert.equal(await page.evaluate(() => window.__cosmicCanvas.getCurrentArchetype()), "SPIRAL_GALAXY");
    assert(await page.evaluate(() => [...document.querySelectorAll("span")].some(el => el.textContent === "01 // SELECTED WORKS")), "HUD selection follows the cut without the old 3.2 second delay");
    await switchScene("SPIRAL_GALAXY");
    assert(await page.evaluate(() => window.__cosmicCanvas.getTransitionCover().cameraZ < 0), "open on the readable side of typography");
    await page.screenshot({ path: `${artifactDir}/galaxy-${width}.png` });
    await switchScene("BINARY_PLANETS", "morph", 2);
    await switchScene("NEBULA_CRADLE", "float", 3);
    await page.screenshot({ path: `${artifactDir}/nebula-${width}.png` });

    // Rapid changes must supersede both a pending cut and its partially visible reveal.
    await page.evaluate(() => {
      window.__cosmicCanvas.switchToScene("SPIRAL_GALAXY", "float", 4);
      window.__cosmicCanvas.switchToScene("EXOPLANET_CLUSTER", "morph", 5);
    });
    await page.waitForFunction(() => window.__cosmicCanvas.getTransitionCover().phase === "idle");
    assert.equal(await page.evaluate(() => window.__cosmicCanvas.getCurrentArchetype()), "EXOPLANET_CLUSTER");

    // Observe the remap inside the real wormhole, not only the final settled frame.
    await page.evaluate(() => window.__cosmicCanvas.switchToScene("SPIRAL_GALAXY", "wormhole", 0));
    await page.waitForFunction(() => window.__cosmicCanvas.getTransitionCover().opacity === 1, { timeout: 15000 });
    assert.equal(await page.evaluate(() => window.__cosmicCanvas.getTransitionCover().opacity), 1);
    await page.waitForFunction(() => window.__cosmicCanvas.getTransitionCover().phase === "idle", { timeout: 30000 });

    await page.evaluate(() => window.__cosmicCanvas.switchToScene("NEBULA_CRADLE", "supernova", 0));
    await page.waitForFunction(() => window.__cosmicCanvas.getTransitionCover().opacity === 1, { timeout: 15000 });
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
    await page.waitForFunction(() => window.__cosmicCanvas.getTransitionCover().opacity === 1, { timeout: 10000 });
    await page.waitForFunction(() => window.__cosmicCanvas.getTransitionCover().phase === "idle");

    const result = await page.evaluate(() => {
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
        leaks: pending.filter(s => s.actualOpacity !== 1 || s.background !== "rgb(0, 0, 0)"),
        hudClickable: !!hit?.closest("button"), final: window.__cosmicCanvas.getTransitionCover() };
    });
    assert(result.pendingFrames > 0, "test must actually sample the remesh window");
    assert.deepEqual(result.leaks, []);
    assert(result.hudClickable, "canvas cover must leave the HUD interactive");
    assert.equal(result.final.pendingParticles, 0);
    assert.equal(result.final.reducedMotion, reduced);
    if (reduced) {
      assert.equal(result.final.transitActive, false);
      assert.equal(result.final.cameraRoll, 0);
      assert(Math.abs(result.final.cameraFov - Math.PI / 3) < 0.00001);
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ width, reduced, ...result }));
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
