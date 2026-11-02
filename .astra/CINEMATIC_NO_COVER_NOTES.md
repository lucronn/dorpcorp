# Cinematic remesh without a cover

This change replaces the `da770ff` foreground moon and grey-blue DOM veil on
`fix/depth-and-transition-cuts`. No deployment is part of this work.

## Camera and space

- Normal navigation uses a 420 ms eased pan/dolly toward open space and a 520 ms
  return. The outgoing composition leaves the frustum before any target writes.
- `RemeshPanAway` bounds the actual uploaded, visible foreground particles and
  enabled scene meshes. It places the look-away camera beyond the furthest extent
  along its sight line, leaving the whole mutable volume behind the near plane
  with a 96-unit buffer. This is stronger than testing only the viewport center.
- Bounds are recomputed on each active frame, including destination geometry and
  resize. A larger destination can move the held camera along its sight line;
  the starfield retains its orientation through the handoff.
- `DeepSpaceField` supplies 7,000 fixed, sparse point stars in every direction.
  It follows camera translation, retains world orientation, and is always present,
  including idle scenes and FX. It is independent of particle target assignment.
  It has no full-frame geometry or opaque surface, and is excluded from bloom.
- The full-frame foreground moon, its shader/depth-clear group, and the DOM
  gradient cover are removed. There is no opacity fallback.
  The old debug API retains `opacity: 0` and `occluderEnabled: false` for consumers.

## Handoff and accessibility

- `RemeshCover` is now only a render-driven work queue. A real off-frustum frame
  must be presented before mutation; two formed, ready, off-frustum frames must
  render before returning. Timeouts cannot release pending remaps.
- Entity replacement precedes particle mapping. Old velocities are discarded
  while off-screen. The existing volumetric Y-depth implementation is retained.
- Canvas resizing is committed in the render callback, so clearing its drawing
  buffer cannot leave an empty frame between resize and render. While materials
  and optical effects compile, the previous real space frame remains presented.
- New navigation supersedes queued work. A reversed return starts its next
  departure at the last presented camera pose. FX still respect camera ownership.
- Reduced motion and startup use a direct starfield cut, followed by a formed-scene
  cut and a 100 ms, less-than-one-degree settling nudge. A live reduced-motion
  preference change switches to this path. There is no fast animated whip, FOV
  punch, fade, sheet, or iris in this path.

## Verification

Unit tests retain volume covariance and simulation checks and independently test
Babylon frustum planes against particles and body geometry at 390, 1200, and 2400
pixel widths for both motion preferences. They verify persistent stars, expanded
destination bounds, changed FOV, rendered-frame gating, stalled-frame timing,
navigation supersession, and coverage loss without an opacity fallback.

The production browser suite samples actual canvas pixels and transition state
from the first rendered startup frame onward. It exercises HUD navigation, morph/float, wormhole/supernova
handoffs, rapid navigation, reversed returns, resize during settling, and live
reduced-motion changes. It rejects cover elements, occluder geometry, exposed
remaps, missing stars, solid-color/black frames, and blocked HUD interactions.
It waits for the final debounced resize revision to finish, including reduced
motion, and asserts no remaining jobs or particles. Screenshots and JSON metrics
are saved under `/tmp/curtis-cinematic-no-cover`.

Visual review of desktop departure and mobile look-away/return captures confirmed
open space with individual stars during the handoff, and formed bodies and
volumetric typography on return. Validation uses local Chromium with SwiftShader;
external requests are blocked and the scene API is stubbed.

Final validation:

- `npm test`: 24/24 pass, including the existing volume tests.
- `npm run lint`: pass.
- `npm run build`: pass. Vite reports the existing large Babylon bundle warning.
- `npm run test:browser`: pass for desktop normal motion, mobile normal motion,
  and mobile reduced motion. All cases finish idle with zero queued jobs and zero
  pending particles. No runtime errors, cover elements, blank frames, missing
  stars, exposed remaps, or blocked HUD interactions were observed.

| Width | Motion | Sampled frames | Remap frames | Minimum lit pixels | Minimum open-space pixels |
| --- | --- | ---: | ---: | ---: | ---: |
| 1200 | Normal | 392 | 34 | 122 | 45.3% |
| 390 | Normal | 521 | 34 | 46 | 63.7% |
| 390 | Reduced | 101 | 23 | 55 | 93.1% |

The pixel checks require at least 20 pixels brighter than 45/255 and at least 18%
open-space pixels darker than 18/255 in each sampled transition image. Frustum
checks independently require every pending remap frame to be outside the camera
view. The initial validation caught blank drawing buffers during shader warmup
and resize; the render readiness gate and deferred resize fixed those failures.

No `gcloud` command or deployment was run.

## Guidance

Consulted the `modern-web-guidance` motion guide. Its instruction to “Use
`prefers-reduced-motion` media queries to turn off heavy motion for users who
prefer it” informed the separate cut/nudge path and its live preference handling.
