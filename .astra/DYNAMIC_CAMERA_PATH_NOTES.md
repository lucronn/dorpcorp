# Dynamic camera path during remesh

Branch: `fix/depth-and-transition-cuts`, based on `b9cb54b`.

## Ride and camera ownership

`RemeshPanAway` now follows a piecewise cubic Hermite position spline with
quaternion orientation keyframes. The departure starts at the presented camera,
dives below the local composition toward a nearby body, then climbs and banks
into open space. X, Y, and Z all change, with pitch, yaw, and restrained roll.
The nearest forward body determines scale and which side the ride passes.

Normal timing is 720 ms departure, at least 160 ms of moving off-frustum travel,
and 640 ms arrival (about 1.52 seconds, plus any extra formation/readiness time).
The hidden segment keeps translating on all three axes and changing orientation;
it does not park at a hold pose. A delayed remap extends this moving segment.
Arrival follows a separate higher arc and settles onto the live destination pose.
Interrupted arrivals restart from the last presented position and orientation,
carrying the measured translation velocity into the next spline.

`ParticleCanvas` restores the independent scene-director pose before simulation
and installs the flight pose before rendering. `RenderEngine` retires the legacy
7.8-second morph animation when a remesh ride takes ownership, so a second flight
cannot drag the destination beneath the new spline. FX retain their existing
camera-ownership queue. The existing `TransitionManager` installation of fully
formed entities at final XYZ is unchanged.

## Space, depth, and remap safety

The 7,000-star distant shell remains present in every direction. Another 1,200
sparse stars share that same point mesh and provide world-space translation
parallax. Their periodic field wraps only beyond a radial visibility fade; stars
are independent of scene selection and particle remapping. There is no added
occluder mesh, full-frame shader surface, DOM veil, or opacity cover.

Every active frame remeasures uploaded visible mutable particles and enabled
scene meshes. Every hidden flight pose projects the full bounds behind the
camera's near plane, with 192 world units of minimum clearance. This validation
also covers expanded destination geometry and changed viewport/FOV. Safety
projection can move the corridor further outward when bounds expand.

Mutation still requires a previously rendered off-frustum frame and a fresh
coverage check. Return still requires two rendered, ready, fully formed frames,
in addition to the minimum normal-motion cruise duration. Shader compilation
keeps the last actual space frame presented. Flight clocks pause when rendering
is unavailable and cap a resumed frame's delta at 64 ms. No elapsed-time fallback
can reveal unformed particles. Volumetric Y-depth mapping and its simulation
covariance tests are retained.

Reduced motion (including live preference changes) uses a direct starfield cut,
then a cut to the formed destination with a 100 ms settle of at most about 5.4
world units across XYZ and less than 0.3 degrees of pitch/yaw. It skips the
animated dive, banking, and cruise. No cover is introduced.

## Verification

The unit suite checks each normal flight segment for XYZ translation and
pitch/yaw/roll changes, curved departure, and continuous motion during delayed
formation. At widths 390, 1200, and 2400, for both motion preferences, it separately
checks Babylon frustum planes against actual body geometry and particle points.
It also exercises expanded destination bounds, new FOV, persistent stars,
interrupted arrival, tiny reduced-motion settle, and exact final pose recovery.

The production browser suite samples unique rendered frames on desktop normal,
mobile normal, and mobile reduced motion. Each normal navigation checks XYZ and
pitch/yaw/roll ranges separately for departure, off-frustum cruise, and approach,
and rejects repeated stationary camera positions. Existing pixel, no-cover,
remesh visibility, rapid navigation, FX handoff, resize, live preference, and HUD
interaction assertions remain. Sequential ride PNGs and JSON metrics are saved
to `/tmp/curtis-dynamic-camera`.

Final validation:

- `npm test`: 24/24 passing, including the existing volume covariance checks.
- `npm run lint`: passing.
- `npm run build`: passing; the existing Babylon bundle-size warning remains.
- `npm run test:browser`: all three cases passing, with no runtime errors.
- `git diff --check`: passing.

| Viewport | Motion | Sampled frames | Remap frames | Minimum lit pixels | Minimum open-space pixels |
| --- | --- | ---: | ---: | ---: | ---: |
| 1200 × 800 | Normal | 482 | 32 | 160 | 39.0% |
| 390 × 800 | Normal | 560 | 32 | 69 | 62.4% |
| 390 × 800 | Reduced | 95 | 20 | 87 | 93.0% |

All 1,137 sampled frames passed the applicable no-cover, starfield, and hidden
remap checks. All cases finished idle with zero queued jobs or pending particles,
and the HUD remained clickable. Each normal ride sampled 11 moving departure
frames, 3 moving corridor frames, and 10 moving approach frames. Every segment
changed X/Y/Z by more than 5 world units and pitch/yaw/roll by more than 0.002
radians; no adjacent samples had a stationary camera.

For example, the binary-planet ride's hidden corridor covered X/Y/Z ranges of
29.5/13.2/25.7 units on desktop and 29.8/13.4/26.2 on mobile, while remaining
entirely off-frustum. Its desktop departure covered 8871/1527/1437 units and its
separate approach 8563/1657/1947 units. The wider departure reflects the actual
outgoing volume that must be excluded, rather than a fixed camera offset.

Reviewed sequential desktop and mobile captures: the outgoing composition grows
and shifts in perspective through the dive and bank, space remains populated
during the handoff, and the formed destination enters along the higher approach.
Contact sheets are `/tmp/curtis-dynamic-camera/desktop-contact-sheet.jpg` and
`/tmp/curtis-dynamic-camera/mobile-contact-sheet.jpg`; full-size PNGs preserve the
sparse stars that become faint in the downsampled contact sheets. Browser checks
use local Chromium with SwiftShader and blocked external requests, with the scene
API stubbed. The timing constants describe rendered animation time; slow rendering
or shader readiness can extend wall-clock duration.

## Guidance

I applied the `modern-web-guidance` motion guide's instruction to “Use
`prefers-reduced-motion` media queries to turn off heavy motion for users who
prefer it.” The existing live media-query listener selects the separate cut and
small multi-axis settle, rather than accelerating the full flight.

No `gcloud` command or deployment is part of this change.
