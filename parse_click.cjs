const fs = require('fs');
const content = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');
const lines = content.split('\n');
const hcIndex = lines.findIndex(l => l.includes('const handleClick = (e: MouseEvent) => {'));
console.log('handleClick is at line:', hcIndex + 1);
if (hcIndex !== -1) {
  console.log(lines.slice(hcIndex, hcIndex + 40).join('\n'));
}
