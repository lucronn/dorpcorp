const fs = require('fs');
let code = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');

const targetEdgeRegex = /        if \(isEdge\) \{\n          \/\/ Bright contrasting color for edges to make them pop\n          r = Math\.min\(255, r \+ 150\);\n          g = Math\.min\(255, g \+ 150\);\n          b = Math\.min\(255, b \+ 180\);\n        \} else \{/g;

const newEdge = `        if (isEdge) {
          // Bright contrasting color for edges to make them pop
          r = Math.min(255, r + 40);
          g = Math.min(255, g + 60);
          b = Math.min(255, b + 90);
        } else {`;

code = code.replace(targetEdgeRegex, newEdge);

fs.writeFileSync('src/components/ParticleCanvas.tsx', code);
console.log("Reduced edge glow");
