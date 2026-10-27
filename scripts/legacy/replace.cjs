const fs = require('fs');
let code = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');

const targetLoopRegex = /for \(let y = 0; y < height; y \+= density\) \{\n    for \(let x = 0; x < width; x \+= density\) \{\n      const idx = \(y \* width \+ x\) \* 4;\n      const alpha = tData\[idx \+ 3\];\n      if \(alpha > 80\) \{\n        const r = tData\[idx\];\n        const g = tData\[idx \+ 1\];\n        const b = tData\[idx \+ 2\];\n        coords\.push\(\{\n          x,\n          y,\n          color: \`rgb\(\\\${r\},\\\${g\},\\\${b\}\)\`,\n        \}\);\n      \}\n    \}\n  \}/;

const newLoop = `const searchDist = Math.max(2, density);
  for (let y = 0; y < height; y += density) {
    for (let x = 0; x < width; x += density) {
      const idx = (y * width + x) * 4;
      const alpha = tData[idx + 3];
      if (alpha > 80) {
        let isEdge = false;
        
        // Edge detection
        for (let dy = -searchDist; dy <= searchDist; dy++) {
          for (let dx = -searchDist; dx <= searchDist; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nIdx = (ny * width + nx) * 4;
              if (tData[nIdx + 3] < 80) {
                isEdge = true;
                break;
              }
            } else {
              isEdge = true;
            }
          }
          if (isEdge) break;
        }

        let r = tData[idx];
        let g = tData[idx + 1];
        let b = tData[idx + 2];

        if (isEdge) {
          // Bright contrasting color for edges to make them pop
          r = Math.min(255, r + 150);
          g = Math.min(255, g + 150);
          b = Math.min(255, b + 180);
        } else {
          // Darken the interior significantly so the edges stand out
          r = Math.floor(r * 0.2);
          g = Math.floor(g * 0.2);
          b = Math.floor(b * 0.2);
        }

        coords.push({
          x,
          y,
          color: \`rgb(\${r},\${g},\${b})\`,
        });
      }
    }
  }`;

if (code.match(targetLoopRegex)) {
    code = code.replace(targetLoopRegex, newLoop);
    fs.writeFileSync('src/components/ParticleCanvas.tsx', code);
    console.log("Replaced loop successfully");
} else {
    console.error("Could not find loop to replace");
}
