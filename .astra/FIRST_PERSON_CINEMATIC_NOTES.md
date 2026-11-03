# First-person cinematic transit

Branch: `fix/depth-and-transition-cuts`, based on `2d39c62`.

## Camera language

`RemeshFlyThrough` replaces `RemeshPanAway`. The camera is the flying observer:
an accelerating forward push, a pitched dive, a banked 146-degree turn and pull-up,
continued forward thrust into open space, then a curved forward approach to the
formed destination. Nothing in this controller looks at the scene origin or at a
fixed celestial target while translating sideways.

Departure positions follow a cubic Hermite spline built by integrating nose
direction times throttle. Independent quaternion attitude comes from smooth
yaw/pitch controls, with up to about 14 degrees of bank. The nearest forward body
sets the scale and turn side. Initial travel is bounded by that body's distance;
extra clearance thrust ramps up after the turn, when the nose faces open space.
This keeps the initial push from plunging into the black hole's bright disk.

The hidden segment integrates forward velocity with small continuing yaw/pitch
changes and bank. It keeps flying if formation takes longer. Arrival uses a
separate Hermite path through a gate behind the destination viewing position.
Arc-length timing carries thrust into the approach and brakes at the endpoint.
The observer looks slightly ahead into the path's next turn. The final tangent
points along the destination's forward vector, so the scene approaches through
depth instead of sliding sideways or receding on a backwards dolly.

Normal timing is 1,120 ms departure, at least 240 ms hidden flight and 1,280 ms
arrival: approximately 2.64 seconds of rendered animation time. Shader readiness
or slow rendering can extend wall-clock time. Flight progress pauses when frames
cannot render and caps resumed deltas at 64 ms.

## Ownership and remap safety

`ParticleCanvas` restores the scene director's independent pose before simulation,
then installs the first-person pose before rendering. `RenderEngine` relinquishes
the legacy morph flight for the whole transition. Arrival latches a destination
pose and installs its exact endpoint before returning control to the director.
Interrupted arrivals start from the last presented position and orientation and
carry a bounded forward speed into the next departure. FX requests retain their serialized
camera handoff. `TransitionManager` installs full-size entities at final XYZ only
inside the guarded remap callback; it does not drive a competing camera.

The coordinator and debug API now use `departing`, `flight`, and `flightProgress`
instead of `panning`, `pan`, and `panProgress`. Diagnostics expose the actual
camera forward vector and current owner, making sideways travel observable.

Every active frame measures uploaded visible mutable particles and enabled meshes,
including glows and trails. Before any remap, the full measured volume must be
behind the near plane, with a 192-unit clearance. The coordinator requires both a
previously rendered hidden frame and a fresh coverage check. Newly expanded
geometry or a resized frustum is checked again every hidden frame. Extra safety
movement is along the nose and persists, so shrinking geometry cannot pull the
camera backwards. Return requires two ready, fully formed, hidden rendered frames.

The persistent distant and world-space foreground stars stay enabled throughout.
Their light is more visible during the open-space interval. Nearby stars grow with
perspective during forward thrust (capped at seven pixels), while distant stars
retain a fixed size. The same radial fade hides foreground wrapping. No stars
are regenerated for a transition.

There is no opacity animation, DOM veil, full-frame shader surface, moon wipe or
new occluder mesh. Volumetric Y-depth mapping and simulation are retained.

Reduced motion, including a live preference change, selects a starfield cut and
then the formed destination, with a 100 ms forward settle of at most four world
units and less than 0.21 degrees of combined pitch/yaw. It skips the banked flight.

## Verification

Unit checks independently test Babylon frustum planes against bodies and particle
positions, alongside persistent visible stars and absence of cover geometry. At
390/1200/2400 widths and 16/32/64 ms rendered steps, normal flights must accelerate,
turn and travel forward during departure, delayed remapping and approach. Each
moving step must align with the average actual view direction by more than 0.9.
Reduced motion, expanded geometry, FOV changes, interrupted arrival and exact
endpoint recovery are also exercised. Existing volume covariance tests remain.

The Chromium suite runs the local production build on desktop and mobile with
normal/reduced motion. It checks forward travel, heading changes and exclusive
flight ownership per segment; the forward alignment threshold is 0.85. It also
checks every sampled remap frame, full-viewport DOM paint (including overlays
without a special test attribute), canvas pixels for stars/open space, rapid
navigation, FX handoff, resizes, live motion preference changes and HUD interaction.
External requests are blocked and the scene API is stubbed. Captures and metrics
are written to `/tmp/curtis-first-person`.

Final validation:

- `npm test`: 24/24 passing, including volume covariance and phase handoffs.
- `npm run lint`: passing.
- `npm run build`: passing; the existing Babylon bundle-size warning remains.
- `npm run test:browser`: all three cases passing, with no page errors.
- `git diff --check`: passing.

| Starting viewport | Motion | Sampled frames | Remap frames | Minimum lit pixels | Minimum open-space pixels |
| --- | --- | ---: | ---: | ---: | ---: |
| 1200 × 800 | Normal | 692 | 46 | 768 | 47.8% |
| 390 × 800 | Normal | 825 | 46 | 321 | 71.1% |
| 390 × 800 | Reduced | 94 | 20 | 349 | 92.7% |

All 1,611 sampled frames passed the applicable checks.
All 112 sampled remap frames stayed off-frustum; no covers, blank frames,
missing starfields or blocked HUD frames were found. Each case finished idle with
zero queued jobs and zero pending particles. The lowest measured forward/heading
alignment across the six normal navigations was 0.9944 (1.0 means entirely
forward), including departure, moving remesh window and arrival. Reduced motion
had zero animated departure frames and finished at the normal FOV with zero roll.

Reviewed sequential desktop/mobile PNGs, native-resolution hidden-flight frames,
and `desktop-contact.jpg` / `mobile-contact.jpg`. The source composition grows
before the bank, stars remain visible through the open-space interval, and the
formed destination grows into view along the final approach. `desktop-flight.mp4`
and `mobile-flight.mp4` replay the captured rendered frames at 15.625 fps (the
64 ms simulation step reached under local Chromium/SwiftShader). These artifacts
live in `/tmp/curtis-first-person`; they are not a hardware frame-rate benchmark.


## Guidance

I used the `modern-web-guidance` motion guide: “Use `prefers-reduced-motion` media
queries to turn off heavy motion for users who prefer it.” The live preference
listener selects the separate cut and tiny forward settle, rather than speeding
up the full flight.

No deployment or `gcloud` command is part of this change.
