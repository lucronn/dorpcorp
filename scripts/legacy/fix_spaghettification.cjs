const fs = require('fs');
let code = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');

code = code.replace(
    /Math\.random\(\) > 0\.5 \? victim\.color : \(victim\.ringColor \|\| "#ffffff"\)\n        \);/,
    'Math.random() > 0.5 ? victim.color : (victim.ringColor || "#ffffff"),\n          0.002 + Math.random() * 0.008 // Slow decay to let them orbit\n        );'
);

// We need to fix spawnTailParticle calls elsewhere which might pass vx, vy.
// In shatter debris they were originally passing vx, vy but in original spawnTailParticle it did `tailP.vx = -vx * 0.15`.
// Since I changed it to `tailP.vx = vx`, let's make sure dust and shatter are somewhat scaled down.
code = code.replace(/const vx = Math\.cos\(angle\) \* speed;/g, 'const vx = Math.cos(angle) * speed * 0.5;');
code = code.replace(/const vy = Math\.sin\(angle\) \* speed;/g, 'const vy = Math.sin(angle) * speed * 0.5;');

fs.writeFileSync('src/components/ParticleCanvas.tsx', code);
console.log("Fixed spaghettification decay");
