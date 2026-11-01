# Depth and transition cuts

Branch: `fix/depth-and-transition-cuts`, based on production 00014 (`6b70042`).

## Changes

- A black canvas cover is raised synchronously before scene generation, target reassignment, typography changes, and resize remaps. It does not cover the HTML HUD or intercept input. HUD selection changes immediately, and voyage status follows actual cover completion rather than the old 3.2/7.8-second timers.
- Incoming entities are installed at their final XYZ and full scale under that cut. The particle simulation installs the new moving targets and clears old-layout momentum before uploading its vertex buffer. The previous 7.8-second entity fly-in and delayed typography coalescence are removed from scene switches.
- The cover holds through remapping and settling. Release requires at least two rendered, formed frames, scene readiness, and a minimum 120 ms hold. It then reveals over 180 ms. Elapsed time alone cannot uncover pending particles; background tabs and slow frames extend the hold.
- Wormhole remapping occurs near the end of the throat, with full cover through camera handoff. Cancellation disposes the tunnel and cancels its observer/timer. Supernova rebirth ends the outgoing blast before remapping. Repeated scene requests restart the cut. Orbit shots open from the front of the typography so the reveal does not start with mirrored text.
- `prefers-reduced-motion` uses the same cut with a 60 ms reveal, bypasses wormhole/supernova/kilonova flights, and disables automatic camera orbit, shake, and FOV breathing. Explicit camera input remains available.
- Galaxy and disk particles have persistent, independently sampled height with thin-disk, thick-disk, and halo strata. Planet envelopes and nebulae sample latitude and radius throughout XYZ volume. Both initial mapping and continuous simulation use the same volume functions, preventing later flattening.
- Miniature background galaxies now have volume too. The galaxy texture uses three faint, separated layers around its existing spherical bulge. Planet collision response measures XYZ distance. Exoplanets use distinct inclined orbits, and orbital mesh synchronization now evolves Z.
- Particle counts and texture resolution are unchanged. Volume sampling happens on remap; target updates allocate no vectors. The galaxy mesh adds two small discs sharing the existing material and texture. Cover readiness checks run only during a cut/reveal.

## Automated verification

```sh
npm test
npm run lint
npm run build
npm run test:browser
```

The unit suite checks full opacity during reassignment/dispersion/settling, stalled frames, repeated remaps, already-formed entity coordinates, and paused particle motion. Seeded scene samples at 390 and 1200 px are checked before and after 90 simulation frames. Y variance and the full XYZ covariance determinant reject both pancakes and tilted flat sheets.

The browser suite serves the local production build on `127.0.0.1:4175`, blocks external requests, and stubs the scene API. It samples actual cover styles during pending remaps across scene cuts, morphs, wormholes, supernova rebirth, rapid changes, and resize. It also checks HUD interaction, runtime errors, and the reduced-motion fallback. It uses `/usr/bin/chromium` by default; set `CHROME_BIN` to override. Screenshots go to `/tmp/curtis-depth-transitions` (override with `TEST_ARTIFACT_DIR`). `PUPPETEER_MODULE` can point to an already-installed Puppeteer-compatible module; this workspace's declared Puppeteer dependency was absent, so validation used the locally installed Chrome DevTools bundle without fetching packages.

Validated on 2026-11-01: all 15 unit tests passed, `npm run lint` passed, and the production build passed. The final local browser run sampled 16 remap/settling frames on desktop and 9 with mobile reduced motion, with zero cover leaks, zero page runtime errors, and an interactive HUD in both runs. Opening camera orientation, immediate HUD selection, fixed reduced-motion FOV/roll, superseded wormhole cancellation, and resize remapping also passed. The existing large Babylon chunk warning remains informational.

Run validation sequentially on memory-constrained machines; Babylon bundling is substantial. `NODE_OPTIONS=--max-old-space-size=3072 npm run build` can bound build heap usage.

## Visual verification

1. Run `npm run dev` and open the local app. Switch repeatedly between Spiral Galaxy, Binary Planets, Nebula Cradle, and Exoplanet Cluster in the catalog. The canvas should cut to black and reveal the formed layout; the HTML controls remain readable.
2. Use the existing debug API in the local browser console to select a transition: `window.__cosmicCanvas.switchToScene('SPIRAL_GALAXY', 'wormhole', 0)` or use `'morph'`, `'float'`, or `'supernova'`. Inspect `window.__cosmicCanvas.getTransitionCover()` for phase, opacity, and pending particle count. Pending particles must always have opacity 1.
3. During a wormhole or partially revealed cut, select another scene. The newer selection must remain active after the old transition would have finished. Resize during a cut and check that the replacement targets remain covered.
4. Orbit around the galaxy and planets, including near the disk edge. Look for stars above and below the disk, spherical planetary envelopes, foreground/background nebular depth, and separated orbital planes. The existing orbit, parallax, depth sizing, and optional DoF now act on genuinely different XYZ positions.
5. Enable reduced motion in browser rendering emulation, then repeat the transitions at mobile width. Expect a short black cut without automatic flight, roll, shake, or FOV punch.

No web research, new dependencies, or deployment are part of this change. Production promotion remains with the operator.
