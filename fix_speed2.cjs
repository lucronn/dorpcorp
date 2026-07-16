const fs = require('fs');
let lines = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8').split('\n');
const renderStart = lines.findIndex(l => l.includes('const render = () => {'));
if(renderStart !== -1) {
    const insertIdx = lines.findIndex((l, i) => i > renderStart && l.includes('const now = Date.now();'));
    if(insertIdx !== -1) {
        lines.splice(insertIdx + 1, 0,
            '      const dt = rendererRef.current ? rendererRef.current.getDeltaTime() : 16.666;',
            '      const globalTimeMultiplier = Math.min(dt / 16.666, 3.0);'
        );
        fs.writeFileSync('src/components/ParticleCanvas.tsx', lines.join('\n'));
        console.log("Success");
    }
}
