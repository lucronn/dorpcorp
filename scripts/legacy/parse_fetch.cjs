const fs = require('fs');
const content = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');
const lines = content.split('\n');
const idx = lines.findIndex(l => l.includes('const fetchNextGeminiScene ='));
if (idx !== -1) {
    console.log(lines.slice(idx, idx + 40).join('\n'));
}
