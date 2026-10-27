# Scripts Directory

This directory contains test suites, utility scripts, and archived development artifacts for the `curtis.click` portfolio.

## Active Scripts

| Script | Purpose |
|---|---|
| [`test-integrity.ts`](file:///home/corp/curtis-click-portfolio/scripts/test-integrity.ts) | Automated 19-test integrity test suite that validates physics & color utilities (hex normalization, NaN-free blending, value noise, fBm, curl noise, and momentum/overlap resolution), procedural cosmic generation across 50 iterations and 5 archetypes, neutron star collapse semantics, deterministic slingshot trajectories with event horizon capture, tidal disruption initial state & hyperbolic approach, Web Audio engine disposal, build artifacts, HTTP server probes, and graceful port conflict rejection. Run via `npm test`. |

## Legacy Scripts (`scripts/legacy/`)

The [`legacy/`](file:///home/corp/curtis-click-portfolio/scripts/legacy) subdirectory contains historical codemod, AST transform, and regex patch scripts used during earlier iterations of the Babylon.js and shader architecture migration. They are kept for historical reference and are not part of the active runtime, build, or test pipelines.
