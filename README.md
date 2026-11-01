# curtis.click Portfolio

Interactive 3D developer portfolio and cosmic web visualizer built with React 19, Babylon.js 9, Tailwind CSS 4, Motion, and Node.js.

## Key Features

- **Relativistic Astrophysics Engine**: Real-time 3D simulation powered by Babylon.js with custom GLSL post-processing shaders for Schwarzschild black hole gravitational lensing, depth-of-field blur, Voronoi frame shattering, and spacetime fabric distortion.
- **Interactive Astrophysics Tools**:
  - **Gravitational Slingshot Probes**: Launch probes with real-time trajectory forecasting around orbital bodies, calculating n-body gravitational pull and relativistic swallowing.
  - **Tidal Disruption Events (TDE)**: Trigger Roche-limit stellar disruption simulations complete with asymmetric tidal shear, accretion disk flare, and relativistic gamma-ray burst jets.
  - **Hawking Radiation Engine**: Quantum particle emission simulation at the event horizon boundary with scale-aware emitter geometry.
  - **Stellar Cataclysms & Supernovae**: Dynamic neutron star and micro-singularity synthesis upon core collapse.
- **Cinematic Transitions & Gravity-Reactive Camera**: The director, gravity camera rig, particle transport and FX bus share shot timing. Organic particle morphs remain visible through camera moves; rebuilding celestial bodies is masked at the handoff. `[B]` plunges into a black hole; `[W]` takes the wormhole. Reduced motion disables the opening travel, idle breathing and wormhole flight.
- **Generative Cosmic Systems**: Dynamic cosmic system synthesis powered by Google Gemini (`gemini-2.5-flash` or configurable `$GEMINI_MODEL`) via `@google/genai` with seamless procedural fallback across 6 core archetypes (`BLACKHOLE_CENTRIC`, `BINARY_PLANETS`, `NEBULA_CRADLE`, `EXOPLANET_CLUSTER`, `SPIRAL_GALAXY`, `STELLAR_PULSAR`). Supports prompt and archetype overrides via API requests.
- **Web Audio Score Synthesizer**: Custom procedural Web Audio engine inspired by Hans Zimmer's *Interstellar* score, featuring church organ and celestial piano synthesis, cathedral reverb, cosmic clock ticks, and gravitational redshift pitch shifts. Universal runtime guards ensure safe execution in SSR and Node.js testing environments.
- **Autonomous Ambient Screensaver**: Smooth transitions, camera orbits, global hotkey navigation (`[A]` Autopilot, `[C]` Cinematic 2.39:1 mode, `[W]` Wormhole, `[N]` Supernova, `[T]` TDE, `[P]` Slingshot Probe, `[M]` Audio Mute Toggle, `[B]` Plunge into the black hole, `[K]` Collide the two closest bodies, `[F]` Feed the black hole, `[↑]`/`[↓]`/`[PageUp]`/`[PageDown]`/`[1]`–`[6]` Stage navigation, `[Escape]` Exit Cinema / Autopilot / Overlays / Target Lock), and HUD overlays tailored for interactive portfolio exploration. Keyboard interactions actively reset idle activity timers.

## Five cinematic improvements

1. **Opening and stage entry** — A visible 180 ms establishing beat starts wide, then pushes into the composition over 1.6 seconds. Stage arrivals return early enough to read the particle formation and finish with a gentle dolly settle.
2. **Transition continuity** — Stage/scene handoffs hold for only 48/64 ms. Particle arrival starts at the remap and finishes with the director, while lensing follows the camera envelope. Absolute phase deadlines handle slow frames; interrupted shots preserve the full camera and lens pose.
3. **Black-hole and wormhole transit** — A 3-second inspiral keeps the photon-ring silhouette visible through 85% of the fall. A shared 2.8-second capture/tunnel/emerge clock drives wormhole travel, FOV, lensing and particle pull, with a dark throat masking the rebuild and a 1.2-second exit settle. Entry preserves the actual camera pose and configured lens.
4. **Depth and light** — Focus tracks subject distance; collision severity adds a brief focus, exposure and bloom response through the FX bus. Separate typography limits keep in-canvas labels legible; DOM HUD elements remain outside post-processing. The DoF toggle is respected.
5. **Idle and autopilot breathing** — Slow camera drift and depth-layered dust motion keep quiet scenes alive. Navigation quickly suppresses breathing; it returns gradually after 1.4 seconds of inactivity. Target locks and active transitions take priority, and reduced motion disables the added movement.

`npm test` covers shot continuity, interrupted navigation, frame-rate-independent deadlines, transit envelopes, close-horizon capture, optical bounds, idle/input handoff, and the existing particle/physics integrity checks.

## Tech Stack

- **Frontend**: React 19, TypeScript 5.8, Babylon.js 9 (`@babylonjs/core`), Motion (`motion`), Lucide Icons.
- **Styling**: Tailwind CSS 4 (`@tailwindcss/vite`).
- **Server**: Express 4, esbuild, TypeScript execution via `tsx`.
- **Bundler**: Vite 6 with functional chunk splitting (`babylon`, `vendor` including `framer-motion`/`motion`/`react`/`lucide-react`, and `index` bundles) for client assets and esbuild for the production CommonJS server bundle.

## Available Scripts

| Script | Command | Description |
|---|---|---|
| `npm run dev` | `tsx server.ts` | Start development server with Vite middleware |
| `npm run build` | `vite build && esbuild server.ts ...` | Build client assets to `dist/` and server to `dist/server.cjs` |
| `npm run lint` | `tsc --noEmit` | Run TypeScript type checking without emitting files |
| `npm test` | `tsc --noEmit && tsx scripts/test-integrity.ts && tsx scripts/test-cinematic.ts` | Execute TypeScript check, the 116-test integrity suite, and the cinematic camera-layer suite |
| `npm start` | `node dist/server.cjs` | Run the compiled production server on port 8080 (or `$PORT`) |
| `npm run preview` | `node dist/server.cjs` | Preview the compiled production build locally |
| `npm run clean` | `rm -rf dist server.js client_errors.log` | Clean build outputs and local log files |

## Health Checks & API Endpoints

The server exposes lightweight health check endpoints for container orchestrators, Docker healthchecks, and uptime monitors:

- `GET /health` — Returns JSON `{ status: "healthy", service: "curtis-click-portfolio", environment, model, timestamp, uptime, nodeVersion, memoryUsage: { rss, heapTotal, heapUsed } }`
- `GET /api/health` — API health check alias (returns identical payload)
- `GET /version` — Returns application version, service name, node version, uptime, and supported cosmic archetypes list
- `GET /api/version` — Version endpoint alias (returns identical payload)
- `POST /api/generate-cosmic-scene` — Generates a dynamic cosmic system via Gemini 2.5 Flash or procedural fallback (supports optional `{ archetype, prompt }` JSON payload for targeted generation with archetype validation)
- `POST /api/log-error` — Ingests client-side telemetry and error logs with structured object and plain text beacon parsing, string sanitization, and automated 1MB log rotation
- `ALL /api/*` — 404 handler preventing unmatched API requests from serving client HTML

The HTTP server includes JSON body-parser error-handling middleware that intercepts malformed JSON payloads and returns structured 400 responses, terminal API error middleware catching unhandled route exceptions to return structured 500 JSON, dynamic `PORT=0` support for ephemeral port assignment, automatic port collision detection (`EADDRINUSE`) with clean diagnostics advising how to override the target port using the `PORT` environment variable (e.g., `PORT=3000 npm run dev`), as well as clean process signal (`SIGTERM`/`SIGINT`) listener deregistration on server shutdown.

## Environment Configuration

Configure environment variables via `.env` (refer to [`.env.example`](file:///home/corp/curtis-click-portfolio/.env.example)):

```bash
# GEMINI_API_KEY: Optional API key for live Gemini cosmic system generation
GEMINI_API_KEY="your-gemini-api-key"

# GEMINI_MODEL: Gemini model name for cosmic scene synthesis (defaults to gemini-2.5-flash)
GEMINI_MODEL="gemini-2.5-flash"

# PORT: Port the HTTP server binds to (default: 8080)
PORT=8080

# NODE_ENV: Application environment ('development' | 'production')
NODE_ENV=production
```

## Docker Deployment

The application features a reproducible multi-stage Docker build (`builder` compiles assets and server bundles; `runner` deploys a minimal `node:22-slim` container with production-only dependencies):

Build the container image:
```bash
docker build -t curtis-click-portfolio .
```

Run locally on port 8080 (or customize via `-e PORT=...`):
```bash
docker run -p 8080:8080 --env-file .env.example curtis-click-portfolio
```

The container listens on port 8080 by default (`ENV PORT=8080`), matching the exposed Docker port and health probes.
