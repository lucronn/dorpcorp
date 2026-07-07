const fs = require('fs');
let code = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');

// 1. Remove halo from letters
const oldPixelShader = /\} else if \(vExtra > 0\.5\) \{[\s\S]*?\} else \{/;
const newPixelShader = `} else if (vExtra > 0.5) {
          // Lettering - solid core
          alpha = smoothstep(0.4, 0.1, dist) * 0.9;
        } else {`;
code = code.replace(oldPixelShader, newPixelShader);

// 2. Reduce base bloom
code = code.replace(/pipeline\.bloomWeight = 1\.5;/g, "pipeline.bloomWeight = 0.8;");
code = code.replace(/pipeline\.bloomWeight = 1\.5 \+ progress \* 2\.0;/g, "pipeline.bloomWeight = 0.8 + progress * 2.0;");
code = code.replace(/pipeline\.bloomWeight = 1\.5 \+ fadeOut \* 5\.5;/g, "pipeline.bloomWeight = 0.8 + fadeOut * 4.5;");
code = code.replace(/pipeline\.bloomWeight = 1\.5 \+ pulse;/g, "pipeline.bloomWeight = 0.8 + pulse;");

// 3. Neuter the chromatic flashing
const oldShock = /const shock = Math\.sin\(\(snElapsed \/ 100\) - \(dist \/ 80\)\) \* Math\.max\(0, 1 - \(snElapsed \/ 3000\)\);/g;
const newShock = `const shock = Math.sin((snElapsed / 100) - (dist / 80)) * Math.max(0, 1 - (snElapsed / 3000)) * 0.1;`; // Much more subtle
code = code.replace(oldShock, newShock);

fs.writeFileSync('src/components/ParticleCanvas.tsx', code);
console.log("Glow fixed");
