const fs = require('fs');
let content = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');

// Fix the one on line 3221 back to `const dpr = ...`
const replace = `    const circTex = createCircleTexture(scene);
    const hudDpr = window.devicePixelRatio || 1;
    
    // Add shader for particles`;

const with3 = `    const circTex = createCircleTexture(scene);
    const dpr = window.devicePixelRatio || 1;
    
    // Add shader for particles`;

content = content.replace(replace, with3);
fs.writeFileSync('src/components/ParticleCanvas.tsx', content);
