const fs = require('fs');
const content = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');
const lines = content.split('\n');
console.log(lines.slice(3210, 3230).join('\n'));
