const fs = require('fs');
const content = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');
const lines = content.split('\n');
const initIndex = lines.findIndex(l => l.includes('const initializeScene ='));
console.log('initializeScene is at line:', initIndex + 1);
if (initIndex !== -1) {
  console.log(lines.slice(initIndex, initIndex + 30).join('\n'));
}
