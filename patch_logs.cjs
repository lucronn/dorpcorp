const fs = require('fs');
let code = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf8');

code = code.replace(
`        supernovaRef.current = {
          time: Date.now(),
          exploded: false,
          isCalmShift: true,
          x: e.clientX,
          y: e.clientY,
        };`,
`        supernovaRef.current = {
          time: Date.now(),
          exploded: false,
          isCalmShift: true,
          x: e.clientX,
          y: e.clientY,
        };
        console.log("[DEBUG] Click triggered supernova/shift", supernovaRef.current);`
);

code = code.replace(
`        if (snElapsed >= transitionThreshold && !activeSupernova.transitioned) {
          activeSupernova.transitioned = true;
          if (animationComplete) {
            animationComplete();
          }`,
`        if (snElapsed >= transitionThreshold && !activeSupernova.transitioned) {
          console.log("[DEBUG] Calm shift transition threshold reached, generating new scene.");
          activeSupernova.transitioned = true;
          if (animationComplete) {
            animationComplete();
          }`
);

fs.writeFileSync('src/components/ParticleCanvas.tsx', code);
