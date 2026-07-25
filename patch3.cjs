const fs = require('fs');
const file = 'src/components/ParticleCanvas/TextureUtils.ts';
let content = fs.readFileSync(file, 'utf8');

const target = `export const generateNebulaTexture = (baseColor: string, secondaryColor: string, scene: BABYLON.Scene) => {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new BABYLON.DynamicTexture("nebula_empty", canvas, scene, true);

  ctx.clearRect(0, 0, 512, 512);

  const cx = 256;
  const cy = 256;
  const c1 = parseColorToRgb(baseColor);
  const c2 = parseColorToRgb(secondaryColor || baseColor);

  // Volumetric procedural gas mapping using fractional Brownian Motion (fBm)
  const imgData = ctx.createImageData(512, 512);
  const data = imgData.data;

  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const idx = (y * 512 + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 256) {
        data[idx+3] = 0;
        continue;
      }

      // Generate multi-octave turbulent noise density map
      const nVal = fBmNoise2D(x * 0.007, y * 0.007, 5);
      const normDist = dist / 256;
      
      // Gaseous envelope profile (smoother falloff at outer margins)
      const envelope = Math.pow(1.0 - normDist, 1.8);
      const density = Math.max(0.0, nVal * envelope);

      // Color interpolation of gas filaments
      const t = Math.sin(nVal * Math.PI);
      const r = Math.round(c1.r * (1 - t) + c2.r * t);
      const g = Math.round(c1.g * (1 - t) + c2.g * t);
      const b = Math.round(c1.b * (1 - t) + c2.b * t);

      data[idx] = r;
      data[idx+1] = g;
      data[idx+2] = b;
      data[idx+3] = Math.round(density * 255 * 0.9);
    }
  }
  ctx.putImageData(imgData, 0, 0);

  // Filamentary strands layer (dynamic Bézier filaments for high contrast depth)
  ctx.shadowColor = \`rgba(\${c1.r}, \${c1.g}, \${c1.b}, 0.2)\`;
  ctx.shadowBlur = 15;
  for (let i = 0; i < 6; i++) {
    const col = Math.random() > 0.5 ? c1 : c2;
    ctx.strokeStyle = \`rgba(\${col.r}, \${col.g}, \${col.b}, \${0.05 + Math.random() * 0.1})\`;
    ctx.lineWidth = 15 + Math.random() * 40;
    
    ctx.beginPath();
    ctx.moveTo(100 + Math.random() * 312, 100 + Math.random() * 312);
    ctx.bezierCurveTo(
      Math.random() * 512, Math.random() * 512,
      Math.random() * 512, Math.random() * 512,
      100 + Math.random() * 312, 100 + Math.random() * 312
    );
    ctx.stroke();
  }

  // Scattered newborn stars embedded in gas
  for (let i = 0; i < 60; i++) {
    const starX = cx + (Math.random() - 0.5) * 400;
    const starY = cy + (Math.random() - 0.5) * 400;
    const dist = Math.sqrt((starX - cx)**2 + (starY - cy)**2);
    if (dist > 230) continue;
    
    const size = 0.5 + Math.random() * 2.0;
    const alpha = (1.0 - dist / 256) * Math.random();
    ctx.fillStyle = Math.random() > 0.5 ? \`rgba(255, 255, 255, \${alpha})\` : \`rgba(150, 220, 255, \${alpha * 0.8})\`;
    ctx.beginPath();
    ctx.arc(starX, starY, size, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new BABYLON.DynamicTexture("nebula_tex", canvas, scene, true);`;

const replacement = `export const generateNebulaTexture = (baseColor: string, secondaryColor: string, scene: BABYLON.Scene) => {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new BABYLON.DynamicTexture("nebula_empty", canvas, scene, true);

  ctx.clearRect(0, 0, 1024, 1024);

  const cx = 512;
  const cy = 512;
  const c1 = parseColorToRgb(baseColor);
  const c2 = parseColorToRgb(secondaryColor || baseColor);

  // Volumetric procedural gas mapping using fractional Brownian Motion (fBm)
  const imgData = ctx.createImageData(1024, 1024);
  const data = imgData.data;

  // Additional 3rd color for more dynamic nebulae
  const c3 = {
    r: Math.min(255, c2.r + 50),
    g: Math.max(0, c2.g - 50),
    b: Math.min(255, c1.b + 50)
  };

  for (let y = 0; y < 1024; y++) {
    for (let x = 0; x < 1024; x++) {
      const idx = (y * 1024 + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 512) {
        data[idx+3] = 0;
        continue;
      }

      // Generate multi-octave turbulent noise density map
      const nVal = fBmNoise2D(x * 0.004, y * 0.004, 6);
      const normDist = dist / 512;
      
      // Gaseous envelope profile (smoother falloff at outer margins)
      const envelope = Math.pow(1.0 - normDist, 1.5);
      const density = Math.max(0.0, nVal * envelope);

      // Color interpolation of gas filaments (3-way)
      let r, g, b;
      if (nVal < 0.33) {
        const t = nVal / 0.33;
        r = c1.r * (1 - t) + c2.r * t;
        g = c1.g * (1 - t) + c2.g * t;
        b = c1.b * (1 - t) + c2.b * t;
      } else if (nVal < 0.66) {
        const t = (nVal - 0.33) / 0.33;
        r = c2.r * (1 - t) + c3.r * t;
        g = c2.g * (1 - t) + c3.g * t;
        b = c2.b * (1 - t) + c3.b * t;
      } else {
        const t = (nVal - 0.66) / 0.34;
        r = c3.r * (1 - t) + c1.r * t;
        g = c3.g * (1 - t) + c1.g * t;
        b = c3.b * (1 - t) + c1.b * t;
      }

      // Add a bit of dark matter absorption (dark clouds inside the nebula)
      const darkNoise = fBmNoise2D(x * 0.01 + 50, y * 0.01 + 50, 4);
      let finalDensity = density;
      if (darkNoise > 0.6) {
        finalDensity *= 1.0 - ((darkNoise - 0.6) * 2.5); // Sharp dropoff for dark pillars
      }

      data[idx] = Math.round(r);
      data[idx+1] = Math.round(g);
      data[idx+2] = Math.round(b);
      data[idx+3] = Math.round(Math.max(0, finalDensity) * 255 * 0.95);
    }
  }
  ctx.putImageData(imgData, 0, 0);

  // Scattered newborn stars embedded in gas (Open clusters)
  const numClusters = 2 + Math.floor(Math.random() * 3);
  for (let c = 0; c < numClusters; c++) {
    const clusterX = cx + (Math.random() - 0.5) * 500;
    const clusterY = cy + (Math.random() - 0.5) * 500;
    
    for (let i = 0; i < 40; i++) {
      const starX = clusterX + (Math.random() - 0.5) * 150;
      const starY = clusterY + (Math.random() - 0.5) * 150;
      const dist = Math.sqrt((starX - cx)**2 + (starY - cy)**2);
      if (dist > 450) continue;
      
      const size = 0.5 + Math.random() * 2.5;
      const alpha = (1.0 - dist / 512) * Math.random();
      
      // Extremely hot, bright blue/white stars typical of emission nebulae
      ctx.fillStyle = Math.random() > 0.3 ? \`rgba(220, 245, 255, \${alpha})\` : \`rgba(255, 255, 255, \${alpha * 0.9})\`;
      ctx.beginPath();
      ctx.arc(starX, starY, size, 0, Math.PI * 2);
      ctx.fill();
      
      // Star glow
      if (size > 2.0) {
        const glowGrad = ctx.createRadialGradient(starX, starY, 0, starX, starY, size * 5);
        glowGrad.addColorStop(0, \`rgba(200, 240, 255, \${alpha * 0.4})\`);
        glowGrad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(starX, starY, size * 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  const texture = new BABYLON.DynamicTexture("nebula_tex", canvas, scene, true);`;

if (content.indexOf(target) !== -1) {
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content);
  console.log('Replaced');
} else {
  console.log('Not found');
}
