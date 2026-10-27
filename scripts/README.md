# Scripts Directory

This directory contains test suites, utility scripts, and archived development artifacts for the `curtis.click` portfolio.

## Active Scripts

| Script | Purpose |
|---|---|
| [`test-integrity.ts`](file:///home/corp/curtis-click-portfolio/scripts/test-integrity.ts) | Automated test suite that executes typechecking, validates procedural cosmic generation across 50 iterations and all 5 archetypes, verifies 3D scene definitions and remnant mass safety, checks build artifacts and static assets, and tests live HTTP server `/health` and 404 behavior. Run via `npm test`. |

## Legacy Scripts (`scripts/legacy/`)

The [`legacy/`](file:///home/corp/curtis-click-portfolio/scripts/legacy) subdirectory contains historical codemod, AST transform, and regex patch scripts used during earlier iterations of the Babylon.js and shader architecture migration. They are kept for historical reference and are not part of the active runtime, build, or test pipelines.
