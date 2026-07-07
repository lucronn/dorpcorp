const fs = require('fs');
let code = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');

// 1. Rewrite mergeEntities
const mergeRegex = /const mergeEntities = \([\s\S]*?    \/\/ --- Interactive Mouse Gravitational Warp/m;

const newMerge = `const mergeEntities = (survivor: CelestialEntity, victim: CelestialEntity) => {
      // Both planets shatter and trigger a cosmic resetting shockwave
      victim.isDestroyed = true;
      victim.destroyedBy = "collision";
      survivor.isDestroyed = true;
      survivor.destroyedBy = "collision";

      const midX = (survivor.x + victim.x) / 2;
      const midY = (survivor.y + victim.y) / 2;

      // Trigger massive supernova reset from the collision point
      if (!supernovaRef.current) {
        supernovaRef.current = {
          time: Date.now(),
          exploded: false,
          isCalmShift: false, // Violent explosion
          x: midX,
          y: midY,
        };
        fetchNextGeminiScene();
      }

      // Play major shockwave sound
      audio.playRippleShockwave();
      
      // Inject multiple high-intensity space-time ripples
      for (let r = 0; r < 12; r++) {
        ripplesRef.current.push({
          x: midX + (Math.random() - 0.5) * 120,
          y: midY + (Math.random() - 0.5) * 120,
          life: 1.0,
        });
      }

      if (onSequenceGenerated) {
        onSequenceGenerated({
          name: "Catastrophic Planetary Collision",
          description: "A kinetic impact of absolute magnitude has ruptured spacetime, unleashing shockwaves that entangle all light and matter before giving birth to a new cosmos.",
          tags: ["💥 SPATIAL RUPTURE", "☄ CATASTROPHIC IMPACT", "★ COSMIC REBIRTH"]
        });
      }
    };

    // --- Interactive Mouse Gravitational Warp`;

code = code.replace(mergeRegex, newMerge);

// 2. Fix the chromatic aberration during supernova
const colorRegex = /\/\/ Map colors\s+let r = p\.r \?\? 255;\s+let g = p\.g \?\? 255;\s+let b = p\.b \?\? 255;[\s\S]*?colors\[i \* 4 \+ 3\] = globalAlpha;/;

const newColorLogic = `// Map colors
        let r = p.r ?? 255;
        let g = p.g ?? 255;
        let b = p.b ?? 255;

        if (supernovaColorOverride) {
          if (supernovaColorOverride === "rgba(255, 120, 50, 1)") {
            r = 255;
            g = 120;
            b = 50;
          } else {
            r = 255;
            g = 255;
            b = 255;
          }
        }

        // Apply global visual fading & chromatic aberrations on color arrays
        let rFactor = 1.0;
        let gFactor = 1.0;
        let bFactor = 1.0;

        if (activeSupernova && !activeSupernova.isCalmShift && snElapsed > 0) {
          const snX = activeSupernova.x;
          const snY = activeSupernova.y;
          const dist = Math.sqrt((drawX - snX) * (drawX - snX) + (drawY - snY) * (drawY - snY));
          
          // Entangle colors/light/wavelengths with shockwaves
          const shock = Math.sin((snElapsed / 100) - (dist / 80)) * Math.max(0, 1 - (snElapsed / 3000));
          if (i % 3 === 0) {
            rFactor = 1.0 + shock * 2.5;
            bFactor = 1.0 - shock * 0.8;
          } else if (i % 3 === 1) {
            gFactor = 1.0 + shock * 2.5;
            rFactor = 1.0 - shock * 0.8;
          } else {
            bFactor = 1.0 + shock * 2.5;
            gFactor = 1.0 - shock * 0.8;
          }
        }

        colors[i * 4] = Math.min(1.0, Math.max(0.0, (r / 255) * globalAlpha * rFactor * particleBrightness));
        colors[i * 4 + 1] = Math.min(1.0, Math.max(0.0, (g / 255) * globalAlpha * gFactor * particleBrightness));
        colors[i * 4 + 2] = Math.min(1.0, Math.max(0.0, (b / 255) * globalAlpha * bFactor * particleBrightness));
        colors[i * 4 + 3] = globalAlpha;`;

code = code.replace(colorRegex, newColorLogic);

fs.writeFileSync('src/components/ParticleCanvas.tsx', code);
console.log("Done");
