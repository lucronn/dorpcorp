const fs = require('fs');
const file = 'src/components/ParticleCanvas.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `          pbrStarLight = new BABYLON.PointLight("starLight", new BABYLON.Vector3(0, 0, 0), scene);`;

const rep = `          if (pbrStarLight) pbrStarLight.dispose();
          pbrStarLight = new BABYLON.PointLight("starLight", new BABYLON.Vector3(0, 0, 0), scene);`;

content = content.replace(target, rep);
fs.writeFileSync(file, content);
