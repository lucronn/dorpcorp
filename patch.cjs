const fs = require('fs');
let code = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf8');

code = code.replace(
`              () => {
                  isTransitActive = false;
              }`,
`              () => {
                  isTransitActive = false;
                  if (animationComplete) {
                      animationComplete();
                  }
              }`
);

code = code.replace(
`          // Trigger transition callback to notify parent React UI
          if (animationComplete) {
              animationComplete();
          }`,
``
);

fs.writeFileSync('src/components/ParticleCanvas.tsx', code);
