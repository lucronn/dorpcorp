const fs = require('fs');
let code = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');

const targetLoopRegex = /\/\/ Spacetime gravity bending is always active![\s\S]*?if \(bdist < entity\.radius \* 0\.5 && Math\.random\(\) < 0\.15\) \{/;

// We need to replace the inner part of celestialEntitiesRef.current.forEach
const targetEntityLoopRegex = /celestialEntitiesRef\.current\.forEach\(\(entity\) => \{\n          if \(entity\.isDestroyed \|\| entity\.type !== "blackhole"\) return;\n          const bdx = entity\.x - p\.x;\n          const bdy = entity\.y - p\.y;\n          const bdist = Math\.sqrt\(bdx \* bdx \+ bdy \* bdy\) \|\| 1;\n\n          if \(bdist < entity\.radius \* gravityRadiusMult\) \{\n            const pullFactor = 1\.0 - bdist \/ \(entity\.radius \* gravityRadiusMult\);\n            suctionAlpha = Math\.max\(suctionAlpha, pullFactor \* \(isInterstellarRef\.current \? 1\.0 : 0\.3\)\);\n\n            const basePullStrength = isInterstellarRef\.current \? 4\.8 : 1\.4;\n            p\.vx \+= \(bdx \/ bdist\) \* pullFactor \* basePullStrength;\n            p\.vy \+= \(bdy \/ bdist\) \* pullFactor \* basePullStrength;\n\n            if \(bdist < entity\.radius \* 1\.25\) \{\n              \/\/ Smoothly fade out particle emission brightness to exactly 0 as it crosses the event horizon\n              const transitionProgress = \(bdist - entity\.radius \* 1\.02\) \/ \(entity\.radius \* 0\.23\);\n              particleBrightness = Math\.max\(0\.0, Math\.min\(1\.0, transitionProgress\)\);\n              \n              if \(bdist < entity\.radius \* 0\.5 && Math\.random\(\) < 0\.15\) \{/g;

const newEntityLoop = `celestialEntitiesRef.current.forEach((entity) => {
          if (entity.isDestroyed) return;
          const bdx = entity.x - p.x;
          const bdy = entity.y - p.y;
          const bdist = Math.sqrt(bdx * bdx + bdy * bdy) || 1;

          if (entity.type === "blackhole") {
            if (bdist < entity.radius * gravityRadiusMult) {
              const pullFactor = 1.0 - bdist / (entity.radius * gravityRadiusMult);
              suctionAlpha = Math.max(suctionAlpha, pullFactor * (isInterstellarRef.current ? 1.0 : 0.3));

              const basePullStrength = isInterstellarRef.current ? 4.8 : 1.4;
              p.vx += (bdx / bdist) * pullFactor * basePullStrength;
              p.vy += (bdy / bdist) * pullFactor * basePullStrength;

              if (bdist < entity.radius * 1.25) {
                // Smoothly fade out particle emission brightness to exactly 0 as it crosses the event horizon
                const transitionProgress = (bdist - entity.radius * 1.02) / (entity.radius * 0.23);
                particleBrightness = Math.max(0.0, Math.min(1.0, transitionProgress));
                
                if (bdist < entity.radius * 0.5 && Math.random() < 0.15) {`;

if (code.match(targetEntityLoopRegex)) {
    code = code.replace(targetEntityLoopRegex, newEntityLoop);
    fs.writeFileSync('src/components/ParticleCanvas.tsx', code);
    console.log("Replaced gravity loop for blackhole");
} else {
    console.error("Could not find gravity loop");
}
