const fs = require('fs');
let code = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');

const targetRegex = /        if \(isEdge\) \{\n          \/\/ Bright contrasting color for edges to make them pop\n          r = Math\.min\(255, r \+ 150\);\n          g = Math\.min\(255, g \+ 150\);\n          b = Math\.min\(255, b \+ 180\);\n        \} else \{\n          \/\/ Darken the interior significantly so the edges stand out\n          r = Math\.floor\(r \* 0\.15\);\n          g = Math\.floor\(g \* 0\.15\);\n          b = Math\.floor\(b \* 0\.15\);\n        \}/;

const newCode = `        if (isEdge) {
          // Bright contrasting color for edges to make them pop
          r = Math.min(255, r + 150);
          g = Math.min(255, g + 150);
          b = Math.min(255, b + 180);
        } else {
          // Drop interior particles entirely or keep very few
          if (Math.random() > 0.05) continue; // Skip 95% of interior particles
          r = Math.floor(r * 0.3);
          g = Math.floor(g * 0.3);
          b = Math.floor(b * 0.3);
        }`;

if (code.match(targetRegex)) {
    code = code.replace(targetRegex, newCode);
    fs.writeFileSync('src/components/ParticleCanvas.tsx', code);
    console.log("Replaced edge logic successfully");
} else {
    console.error("Could not find edge logic to replace");
}
