const fs = require('fs');
let content = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');

const replace1 = `      const isMobileDevice =
        /iPad|iPhone|iPod|Android/i.test(navigator.userAgent) || currentW < 768;
      const now = Date.now();
      
      // Dynamic Web Audio API metrics for real-time visual synchronization`;

const with1 = `      const isMobileDevice =
        /iPad|iPhone|iPod|Android/i.test(navigator.userAgent) || currentW < 768;
      const now = Date.now();
      const dt = rendererRef.current ? rendererRef.current.getDeltaTime() : 16.666;
      const globalTimeMultiplier = Math.min(dt / 16.666, 3.0);
      
      // Dynamic Web Audio API metrics for real-time visual synchronization`;

content = content.replace(replace1, with1);

const replace2 = `        // Calculate gravitational Time Dilation near black holes
        let localTimeDilation = 1.0;
        celestialEntitiesRef.current.forEach((entity) => {
          if (entity.isDestroyed || entity.type !== "blackhole") return;
          const gdx = entity.x - p.x;
          const gdy = entity.y - p.y;
          const gdist = Math.sqrt(gdx * gdx + gdy * gdy) || 1;
          const horizonZone = entity.radius * 3.5;
          if (gdist < horizonZone) {
            // General Relativistic Schwarzschild Time Dilation approximation
            const ratio = Math.max(0.04, Math.min(1.0, (gdist - entity.radius * 0.4) / (horizonZone - entity.radius * 0.4)));
            const dilation = Math.sqrt(ratio);
            if (dilation < localTimeDilation) {
              localTimeDilation = dilation;
            }
          }
        });`;

const with2 = `        // Calculate gravitational Time Dilation near black holes
        let localTimeDilation = globalTimeMultiplier;
        celestialEntitiesRef.current.forEach((entity) => {
          if (entity.isDestroyed || entity.type !== "blackhole") return;
          const gdx = entity.x - p.x;
          const gdy = entity.y - p.y;
          const gdist = Math.sqrt(gdx * gdx + gdy * gdy) || 1;
          const horizonZone = entity.radius * 3.5;
          if (gdist < horizonZone) {
            // General Relativistic Schwarzschild Time Dilation approximation
            const ratio = Math.max(0.04, Math.min(1.0, (gdist - entity.radius * 0.4) / (horizonZone - entity.radius * 0.4)));
            const dilation = Math.sqrt(ratio);
            if ((dilation * globalTimeMultiplier) < localTimeDilation) {
              localTimeDilation = dilation * globalTimeMultiplier;
            }
          }
        });`;

content = content.replace(replace2, with2);
fs.writeFileSync('src/components/ParticleCanvas.tsx', content);
