const fs = require('fs');
const content = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');
const lines = content.split('\n');
const start = lines.findIndex(l => l.includes('const render = () => {'));
if(start !== -1) {
  console.log(lines.slice(start, start + 30).join('\n'));
}
