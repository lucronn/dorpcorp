const fs = require('fs');
let code = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');

// Replace standard console.log with one that also posts to our error endpoint for critical stuff, 
// or just wrap the setTimeout body in a try/catch.
code = code.replace(
  /setTimeout\(\(\) => \{\n\s*if \(\!scene \|\| scene\.isDisposed\) return;/g,
  `setTimeout(() => {
          try {
          if (!scene || scene.isDisposed) return;`
);

code = code.replace(
  /flyingObjects = \[\];\n\s*tunnelMesh = null;\n\n\s*const ww = window\.innerWidth;\n\s*const wh = window\.innerHeight;\n\n\s*isInterstellarRef\.current = true;\n\n\s*if \(geminiData\) \{\n\s*nextGeminiSceneRef\.current = geminiData; \n\s*\}\n\s*generateInterstellarScene\(ww, wh, true\);\n\s*mapParticlesToInterstellar\(ww, wh\);\n\s*\}, 3000\);/g,
  `flyingObjects = [];
          tunnelMesh = null;

          const ww = window.innerWidth;
          const wh = window.innerHeight;

          isInterstellarRef.current = true;

          if (geminiData) {
              nextGeminiSceneRef.current = geminiData; 
          }
          generateInterstellarScene(ww, wh, true);
          mapParticlesToInterstellar(ww, wh);
          } catch(err) {
             console.error(err);
             fetch('/api/log-error', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: err.stack || err.message }) });
          }
      }, 3000);`
);

fs.writeFileSync('src/components/ParticleCanvas.tsx', code);
