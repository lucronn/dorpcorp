const fs = require('fs');
const file = 'src/components/ParticleCanvas.tsx';
let content = fs.readFileSync(file, 'utf8');

const target1 = `      // Generate Tube (Transit Tunnel)
      const path = [];
      for (let i = 0; i < 60; i++) {
          path.push(new BABYLON.Vector3(0, 0, i * 20));
      }`;

const rep1 = `      // Generate Tube (Transit Tunnel)
      const path = [];
      for (let i = 0; i < 60; i++) {
          path.push(new BABYLON.Vector3(0, 0, -1000 + i * 50));
      }`;

content = content.replace(target1, rep1);
fs.writeFileSync(file, content);
