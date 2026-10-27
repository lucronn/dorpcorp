# curtis.click Portfolio

Interactive 3D developer portfolio and cosmic web visualizer built with React 19, Babylon.js 9, Tailwind CSS 4, Motion, and Node.js.

## Key Features

- **Relativistic Astrophysics Engine**: Real-time 3D simulation powered by Babylon.js with custom GLSL post-processing shaders for Schwarzschild black hole gravitational lensing, depth-of-field blur, Voronoi frame shattering, and spacetime fabric distortion.
- **Interactive Astrophysics Tools**:
  - **Gravitational Slingshot Probes**: Launch probes with real-time trajectory forecasting around orbital bodies, calculating n-body gravitational pull and relativistic swallowing.
  - **Tidal Disruption Events (TDE)**: Trigger Roche-limit stellar disruption simulations complete with asymmetric tidal shear, accretion disk flare, and relativistic gamma-ray burst jets.
  - **Hawking Radiation Engine**: Quantum particle emission simulation at the event horizon boundary.
  - **Stellar Cataclysms & Supernovae**: Dynamic neutron star and micro-singularity synthesis upon core collapse.
- **Generative Cosmic Systems**: Dynamic cosmic system synthesis powered by Google Gemini (`gemini-2.5-flash` or configurable `$GEMINI_MODEL`) via `@google/genai` with seamless procedural fallback across 6 core archetypes (`BLACKHOLE_CENTRIC`, `BINARY_PLANETS`, `NEBULA_CRADLE`, `EXOPLANET_CLUSTER`, `SPIRAL_GALAXY`, `STELLAR_PULSAR`). Supports prompt and archetype overrides via API requests.
- **Web Audio Score Synthesizer**: Custom procedural Web Audio engine inspired by Hans Zimmer's *Interstellar* score, featuring church organ and celestial piano synthesis, cathedral reverb, cosmic clock ticks, and gravitational redshift pitch shifts. Universal runtime guards ensure safe execution in SSR and Node.js testing environments.
- **Autonomous Ambient Screensaver**: Smooth transitions, camera orbits, hotkey navigation, and HUD overlays tailored for interactive portfolio exploration.

## Tech Stack

- **Frontend**: React 19, TypeScript 5.8, Babylon.js 9 (`@babylonjs/core`), Motion (`motion`), Lucide Icons.
- **Styling**: Tailwind CSS 4 (`@tailwindcss/vite`).
- **Server**: Express 4, esbuild, TypeScript execution via `tsx`.
- **Bundler**: Vite 6 with functional chunk splitting (`babylon`, `vendor`, and `index` bundles) for client assets and esbuild for the production CommonJS server bundle.

## Available Scripts

| Script | Command | Description |
|---|---|---|
| `npm run dev` | `tsx server.ts` | Start development server with Vite middleware |
| `npm run build` | `vite build && esbuild server.ts ...` | Build client assets to `dist/` and server to `dist/server.cjs` |
| `npm run lint` | `tsc --noEmit` | Run TypeScript type checking without emitting files |
| `npm test` | `tsc --noEmit && tsx scripts/test-integrity.ts` | Execute TypeScript check and the automated 36-test integrity test suite |
| `npm start` | `node dist/server.cjs` | Run the compiled production server on port 8080 (or `$PORT`) |
| `npm run clean` | `rm -rf dist server.js client_errors.log` | Clean build outputs and local log files |

## Health Checks & API Endpoints

The server exposes lightweight health check endpoints for container orchestrators, Docker healthchecks, and uptime monitors:

- `GET /health` — Returns JSON `{ status: "healthy", service: "curtis-click-portfolio", timestamp, uptime, nodeVersion, memoryUsage: { rss, heapTotal, heapUsed } }`
- `GET /api/health` — API health check alias (returns identical payload)
- `POST /api/generate-cosmic-scene` — Generates a dynamic cosmic system via Gemini 2.5 Flash or procedural fallback (supports optional `{ archetype, prompt }` JSON payload for targeted generation with archetype validation)
- `POST /api/log-error` — Ingests client-side telemetry and error logs with structured object parsing, string sanitization, and automated 1MB log rotation
- `ALL /api/*` — 404 handler preventing unmatched API requests from serving client HTML

The HTTP server includes automatic port collision detection (`EADDRINUSE`) with clean diagnostics advising how to override the target port using the `PORT` environment variable (e.g., `PORT=3000 npm run dev`).

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
