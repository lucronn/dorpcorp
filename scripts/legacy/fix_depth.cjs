const fs = require('fs');
let code = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');

code = code.replace(
    /const floatZ = Math\.sin\(time \* floatSpeed \* 0\.7 \+ i \* 0\.04\) \* 45;/,
    'const floatZ = Math.sin(time * floatSpeed * 0.7 + i * 0.04) * 8;' // Reduced from 45 to 8 for sharper reading
);

code = code.replace(
    /let density = isMobileDevice \? 2 : 1;\n  if \(totalPixels > 2500000\) density = isMobileDevice \? 3 : 2;\n  if \(totalPixels > 5000000\) density = isMobileDevice \? 4 : 3;/,
    'let density = isMobileDevice ? 2 : 1;\n  if (totalPixels > 2500000) density = isMobileDevice ? 2 : 1;\n  if (totalPixels > 5000000) density = isMobileDevice ? 3 : 2;'
);

fs.writeFileSync('src/components/ParticleCanvas.tsx', code);
console.log("Fixed depth and density");
