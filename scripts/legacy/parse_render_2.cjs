const fs = require('fs');
const content = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');
const lines = content.split('\n');
const renderStartIdx = lines.findIndex(l => l.includes('const render = () => {'));
if (renderStartIdx !== -1) {
    console.log(lines.slice(renderStartIdx, renderStartIdx + 30).join('\n'));
}
