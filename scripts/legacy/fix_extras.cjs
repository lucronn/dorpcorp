const fs = require('fs');
let code = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');

const targetRenderLoopEnd = /        colors\[i \* 4 \+ 2\] = \(b \/ 255\) \* globalAlpha \* bFactor \* particleBrightness;\n        colors\[i \* 4 \+ 3\] = globalAlpha;\n        extras\[i\] = \(!p\.isCosmicAmbient && !p\.isTail\) \? 1\.0 : 0\.0;\n      \}/;
const newRenderLoopEnd = `        colors[i * 4 + 2] = (b / 255) * globalAlpha * bFactor * particleBrightness;
        colors[i * 4 + 3] = globalAlpha;
        extras[i] = 1.0; // Lettering
      }`;
code = code.replace(targetRenderLoopEnd, newRenderLoopEnd);

const tailColorRegex = /            colors\[i \* 4 \+ 3\] = tailOpacity;\n          \} else \{/;
const newTailColor = `            colors[i * 4 + 3] = tailOpacity;
            extras[i] = 2.0; // Tail particles
          } else {`;
code = code.replace(tailColorRegex, newTailColor);

const ambientColorRegex = /            colors\[i \* 4 \+ 3\] = 1\.0;\n          \}\n          continue;/;
// wait, we changed ambient recently. Let's check how ambient is currently.
