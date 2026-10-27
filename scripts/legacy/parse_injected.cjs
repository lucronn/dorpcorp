const fs = require('fs');
const content = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');
const lines = content.split('\n');
const idx = lines.findIndex((l) => l.includes('// --- WORMHOLE TRANSIT LOGIC ---'));
if(idx !== -1) {
    console.log(lines.slice(idx, idx + 150).join('\n'));
}
