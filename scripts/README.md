# Scripts Directory

This directory contains test suites, utility scripts, and archived development artifacts for the `curtis.click` portfolio.

## Active Scripts

| Script | Purpose |
|---|---|
| [`test-integrity.ts`](file:///home/corp/curtis-click-portfolio/scripts/test-integrity.ts) | Automated 32-test integrity test suite that validates physics & color utilities (hex normalization, NaN-free blending, value noise, fBm, curl noise, momentum/overlap resolution, black hole accretion swallowing, and collision flare lifecycle with clean GPU material disposal), procedural cosmic generation across 70 iterations and all 6 archetypes (`BLACKHOLE_CENTRIC`, `BINARY_PLANETS`, `NEBULA_CRADLE`, `EXOPLANET_CLUSTER`, `SPIRAL_GALAXY`, `STELLAR_PULSAR`), contracts across all 6 procedural scene builders, neutron star collapse semantics, deterministic slingshot trajectories with event horizon capture and zero-scale entity filtering, tidal disruption initial state, hyperbolic approach, and mass-depleted progression safeguards, Web Audio engine modulation bounds and disposal, CosmicTransitionStateMachine asynchronous stages and cancellation, TransitionManager SSR safety in triggerCalmCosmicShift, ParticleUtils SSR safety and defensive layout bounds for both `particleText` and `generateTargetsForStage`, build artifacts and clean 3-bundle chunk assets, HTTP server probes, requested archetype overrides and unknown archetype sanitization, structured JSON object error log sanitization & bounded rotation, and graceful port conflict rejection. Run via `npm test`. |

## Legacy Scripts (`scripts/legacy/`)

The [`legacy/`](file:///home/corp/curtis-click-portfolio/scripts/legacy) subdirectory contains historical codemod, AST transform, and regex patch scripts used during earlier iterations of the Babylon.js and shader architecture migration. They are kept for historical reference and are not part of the active runtime, build, or test pipelines.
