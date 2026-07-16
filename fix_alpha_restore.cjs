const fs = require('fs');
const file = 'src/components/ParticleCanvas.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `          // Restore pointsMesh visibility
          const pMesh = scene.getMeshByName("pointsMesh");
          if (pMesh) pMesh.isVisible = true;`;

const rep = `          // Restore pointsMesh visibility
          const pMesh = scene.getMeshByName("pointsMesh");
          if (pMesh) {
              pMesh.isVisible = true;
              if (pMesh.material) pMesh.material.alpha = 1;
          }`;

content = content.replace(target, rep);
fs.writeFileSync(file, content);
