const fs = require('fs');
let code = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');

const targetBracketsRegex = /                p\.vy = 0;\n              \}\n            \}\n          \}\n        \}\);/g;

const newBrackets = `                p.vy = 0;
              }
            }
          }
          } else {
            // Collide with planets/stars
            const colDist = entity.radius + (isMobileDevice ? 2 : 3);
            if (bdist < colDist && !p.isTail) { // let tail particles (shatter debris) pass or maybe not? Let's say all particles
              const nx = bdx / bdist;
              const ny = bdy / bdist;
              
              // Bounce velocity
              const dot = p.vx * nx + p.vy * ny;
              if (dot > 0) {
                  p.vx -= 2 * dot * nx;
                  p.vy -= 2 * dot * ny;
                  p.vx += (Math.random() - 0.5) * 4; // Add scatter
                  p.vy += (Math.random() - 0.5) * 4;
              }
              
              // Push out of the celestial body to prevent clipping
              p.x = entity.x - nx * (colDist + 1);
              p.y = entity.y - ny * (colDist + 1);
            }
          }
        });`;

if (code.match(targetBracketsRegex)) {
    code = code.replace(targetBracketsRegex, newBrackets);
    fs.writeFileSync('src/components/ParticleCanvas.tsx', code);
    console.log("Added planet collision logic");
} else {
    console.error("Could not find brackets to replace");
}
