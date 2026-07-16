const fs = require('fs');
const file = 'src/components/ParticleCanvas.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `          // Generate Pristine Solar System
          const starGlow = new BABYLON.GlowLayer("starGlow", scene);`;

const rep = `          // Generate Pristine Solar System
          const oldGlow = scene.getGlowLayerByName("starGlow");
          if (oldGlow) oldGlow.dispose();
          const starGlow = new BABYLON.GlowLayer("starGlow", scene);`;

content = content.replace(target, rep);
fs.writeFileSync(file, content);
