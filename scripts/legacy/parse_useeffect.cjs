const fs = require('fs');
const content = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');
const lines = content.split('\n');
console.log(lines.slice(2843 - 1, 2843 + 30).join('\n'));
