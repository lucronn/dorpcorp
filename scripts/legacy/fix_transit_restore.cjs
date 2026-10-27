const fs = require('fs');
const file = 'src/components/ParticleCanvas.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `          wormholePostProcess.dispose();
          if (tunnelMesh) tunnelMesh.dispose();
          flyingObjects.forEach(m => m.dispose());
          flyingObjects = [];`;

const rep = `          wormholePostProcess.dispose();
          if (tunnelMesh) tunnelMesh.dispose();
          flyingObjects.forEach(m => m.dispose());
          flyingObjects = [];
          
          // Restore pointsMesh visibility
          const pMesh = scene.getMeshByName("pointsMesh");
          if (pMesh) pMesh.isVisible = true;

          // Dispose old planets
          if (pbrPlanets) {
              pbrPlanets.forEach(p => p.dispose());
          }
          pbrPlanets = [];`;

content = content.replace(target, rep);
fs.writeFileSync(file, content);
