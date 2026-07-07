const fs = require('fs');
let code = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');

const targetFuncRegex = /    \/\/ --- Swallow & Merger Physics Events ---\n    const swallowEntity = \(bh: CelestialEntity, victim: CelestialEntity\) => \{/g;

const newFunc = `    // --- Swallow & Merger Physics Events ---
    function createSpaghettificationDebris(bh: CelestialEntity, victim: CelestialEntity) {
      const spawnP = spawnTailParticleRef.current;
      if (!spawnP) return;
      const count = Math.min(2000, Math.floor(victim.radius * 20)); // Lots of particles!
      for (let i = 0; i < count; i++) {
        // Spawn them over the volume of the victim
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * victim.radius;
        const px = victim.x + Math.cos(angle) * r;
        const py = victim.y + Math.sin(angle) * r;
        
        // Initial velocity orbiting the blackhole
        const dx = px - bh.x;
        const dy = py - bh.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const orbitAngle = Math.atan2(dy, dx) + Math.PI / 2; // Perpendicular
        const speed = 10.0 + Math.random() * 15.0; // Fast orbit
        const vx = Math.cos(orbitAngle) * speed + (bh.x - px) * 0.05; // Slightly inwards
        const vy = Math.sin(orbitAngle) * speed + (bh.y - py) * 0.05;
        
        spawnP(
          px,
          py,
          (Math.random() - 0.5) * victim.radius * 2, // Z scatter
          vx,
          vy,
          Math.random() > 0.5 ? victim.color : (victim.ringColor || "#ffffff")
        );
      }
    }

    const swallowEntity = (bh: CelestialEntity, victim: CelestialEntity) => {`;

if (code.match(targetFuncRegex)) {
    code = code.replace(targetFuncRegex, newFunc);
    
    // Replace createDustSplash with createSpaghettificationDebris
    code = code.replace(/createDustSplash\(victim\.x, victim\.y, victim\.color, 160\);/, 'createSpaghettificationDebris(bh, victim);\n      createShatterDebris(victim.x, victim.y, victim.color || "#ffffff", 100);');
    
    fs.writeFileSync('src/components/ParticleCanvas.tsx', code);
    console.log("Added spaghettification");
} else {
    console.error("Could not find swallowEntity");
}
