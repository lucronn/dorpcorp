# curtis.click Portfolio

Interactive 3D developer portfolio and cosmic web visualizer built with React 19, Babylon.js, Tailwind CSS 4, Motion, and Node.js.

## Tech Stack

- **Frontend**: React 19, TypeScript, Babylon.js 9 (`@babylonjs/core`), Motion (`motion`), Lucide Icons.
- **Styling**: Tailwind CSS 4 (`@tailwindcss/vite`).
- **Server**: Express, esbuild, TypeScript execution with `tsx`.
- **Bundler**: Vite 6 for client assets and esbuild for the SSR/server bundle.

## Available Scripts

| Script | Command | Description |
|---|---|---|
| `npm run dev` | `tsx server.ts` | Start development server with live reload |
| `npm run build` | `vite build && esbuild server.ts ...` | Build client assets to `dist/` and server to `dist/server.cjs` |
| `npm run lint` | `tsc --noEmit` | Run TypeScript type checking without emitting files |
| `npm test` | `tsc --noEmit` | Execute project verification test suite |
| `npm start` | `node dist/server.cjs` | Run the compiled production server |
| `npm run clean` | `rm -rf dist server.js` | Clean build output directories |

## Docker Deployment

Build the container image:
```bash
docker build -t curtis-click-portfolio .
```

Run locally on port 8080:
```bash
docker run -p 8080:8080 --env-file .env.example curtis-click-portfolio
```
