const fs = require('fs');
let code = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');

const tailFuncRegex = /    const spawnTailParticle = \([\s\S]*?      \}\n    \};\n\n    spawnTailParticleRef\.current = spawnTailParticle;/;

const newTailFunc = `    const spawnTailParticle = (
      x: number,
      y: number,
      z: number,
      vx: number,
      vy: number,
      color: string,
      decayRate?: number
    ) => {
      if (tailCount === 0 || tailStartIndex === -1) return;
      const tIdx = tailStartIndex + (tailIndex % tailCount);
      tailIndex++;

      const tailP = tempParticles[tIdx];
      if (tailP) {
        tailP.x = x;
        tailP.y = y;
        tailP.z = z;
        tailP.vx = vx;
        tailP.vy = vy;
        tailP.vz = (Math.random() - 0.5) * 2;
        tailP.color = color;
        tailP.life = 1.0;
        tailP.decay = decayRate || (0.04 + Math.random() * 0.05);
      }
    };

    spawnTailParticleRef.current = spawnTailParticle;`;

code = code.replace(tailFuncRegex, newTailFunc);
// also update the type signature
code = code.replace(/vy: number,\n        color: string,\n      \) => void\)/, 'vy: number,\n        color: string,\n        decayRate?: number\n      ) => void)');

fs.writeFileSync('src/components/ParticleCanvas.tsx', code);
console.log("Fixed tail particles");
