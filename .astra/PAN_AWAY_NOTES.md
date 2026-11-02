# Camera pan-away remesh transitions

Branch: `fix/depth-and-transition-cuts`, extending `fbcc166`.

## Behavior and implementation

- Normal scene switches now pan toward a foreground companion moon, hold behind its opaque surface while the field is remapped, then pan back to the already formed destination. Departure takes about 420 ms and return about 520 ms at normal frame rates. There is no normal full-screen DOM blackout.
- `RemeshPanAway` chooses the side of the nearest dense celestial neighbor (planet, star, black hole, or neutron star). When none exists, it uses a right-side foreground moon. This dedicated procedural sphere is independent of the entity/particle pool, so replacing that pool cannot remove the occluder. Its silhouette starts outside the composition, crosses the view with camera yaw, and covers the viewport at the hidden handoff. The surface stays aligned across that handoff. No image assets or dependencies were added.
- `RemeshCover` queues entity, particle, and typography mutations. Actual camera/frustum geometry and shader readiness must confirm coverage, and a covered frame must have rendered before queued mutations can run. Entity installation precedes particle mapping, including resize/navigation races. The existing particle simulation snaps to final moving targets and discards old momentum; two formed, scene-ready rendered frames are required before return.
- The moon uses a dedicated foreground rendering group with depth clearing, so transparent scene particles cannot draw through it. The coverage predicate includes the viewport diagonal, near clip, and a conservative inset for tessellation and postprocessing. An unexpected coverage loss during remapping raises the short colored fallback veil before drawing.
- Rapid navigation replaces pending work and reverses an in-progress return. Effects that own the camera wait for an active remap/return to finish. Wormhole target changes are queued near the end of the throat and executed after the transit relinquishes the camera. Canceled transits cannot replace a newer selection.
- Startup and reduced motion use a dark blue, opaque gradient veil and a 60 ms reveal after formed frames, without the previous minimum black hold. Reduced motion bypasses the long effects flight, keeps the existing fixed FOV/roll behavior, and is honored if enabled during a pan. Slow/backgrounded frames cannot skip the coverage gate.
- The moon is not pickable and the fallback veil has `pointer-events: none`; HTML HUD controls remain above the canvas and usable during movement.
- The volumetric Y-depth work from `fbcc166` is unchanged: particle volume generators, simulation volume updates, galaxy mesh layers, XYZ collision distance, and inclined orbits are retained.

## Verification

```sh
npm test
npm run lint
npm run build
npm run test:browser
```

The unit suite covers queued mutations, rendered coverage, stalled frames, two-frame settlement, reversed/canceled pans, resize ordering, coverage loss, live reduced-motion changes, and persistent XYZ volume. Babylon NullEngine tests independently intersect actual sphere triangles with all viewport corner/edge/center rays at 390, 1200, and 2400 px, including after relocating the camera to the destination.

The browser suite serves only the local production build and blocks external requests. It exercises desktop and mobile normal motion plus mobile reduced motion, float/morph changes, wormholes, supernova rebirth, rapid changes, a real HUD click during return, effects requested during departure, transit cancellation, and resize. It samples actual veil styles and geometric coverage during pending remaps and requires zero normal-motion DOM blackouts. Departure, occlusion, return, and final composition PNGs are written to the artifact directory.

This workspace's declared Puppeteer package is not installed. Use the already-installed local bundle without fetching anything:

```sh
PUPPETEER_MODULE=/home/corp/.npm/_npx/15c61037b1978c83/node_modules/chrome-devtools-mcp/build/src/third_party/index.js \
TEST_ARTIFACT_DIR=/tmp/curtis-pan-away npm run test:browser
```

Validated on 2026-11-01: `npm test` passed all 21 tests, TypeScript lint passed, and the production build passed. The existing Babylon bundle-size warning remains informational. The final local Chromium run passed all three configurations:

| Viewport | Motion | Sampled remap/settling frames | Coverage leaks | Blocked HUD samples |
| --- | --- | ---: | ---: | ---: |
| 1200 × 800 | Normal | 28 | 0 | 0 |
| 390 × 800 | Normal | 26 | 0 | 0 |
| 390 × 800 | Reduced | 17 | 0 | 0 |

Both normal-motion runs had zero DOM veils. All runs had zero page runtime errors and finished with no pending particles. The reduced-motion run had no camera pan, fixed 60° FOV, and zero roll. Departure/occlusion/return PNGs were visually inspected: the moon silhouette crosses the scene, fills the remap frame, and withdraws to reveal the destination. Artifacts are in `/tmp/curtis-pan-away`; the run log is `/tmp/curtis-pan-browser.log`.

## Operator visual check

1. Switch between Spiral Galaxy, Binary Planets, Nebula Cradle, and Exoplanet Cluster. Observe the foreground silhouette crossing the frame and the formed destination returning; particles must never scramble into place.
2. Click a different HUD stage during the return. Check that the latest choice wins and that the HUD remains readable/clickable.
3. Try a wormhole or supernova, then select another scene. Resize during a transition; check both portrait and landscape.
4. Emulate reduced motion and repeat. Expect a brief colored veil without a pan or long black hold.
5. Inspect `window.__cosmicCanvas.getTransitionCover()`: pending remaps require `occluded && margin > 0` or `opacity === 1`; normal pans have `mode: "pan"` and `opacity: 0`. `revision`, `panProgress`, `panSource`, and `pendingJobs` expose the handoff for debugging.

No web search, external browsing, or gcloud deployment. The operator owns promotion.
