const fs = require('fs');
const file = 'src/components/ParticleCanvas/TextureUtils.ts';
let content = fs.readFileSync(file, 'utf8');

const target = `export const generateGalaxyTexture = (baseColor: string, secondaryColor: string, scene: BABYLON.Scene) => {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new BABYLON.DynamicTexture("galaxy_empty", canvas, scene, true);

  ctx.clearRect(0, 0, 512, 512);

  const cx = 256;
  const cy = 256;
  const c1 = parseColorToRgb(baseColor);
  const c2 = parseColorToRgb(secondaryColor || baseColor);

  // 1. Core glow (supermassive star cluster/blackhole core)
  const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 80);
  coreGrad.addColorStop(0, "rgba(255, 255, 255, 1.0)");
  coreGrad.addColorStop(0.2, \`rgba(\${c1.r}, \${Math.min(255, c1.g + 40)}, \${Math.min(255, c1.b + 60)}, 0.85)\`);
  coreGrad.addColorStop(0.55, \`rgba(\${c2.r}, \${c2.g}, \${c2.b}, 0.38)\`);
  coreGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 80, 0, Math.PI * 2);
  ctx.fill();

  // 2. Swirling spiral arms (using logarithmic spiral: r = a * e^(b * theta))
  const numArms = 2 + Math.floor(Math.random() * 2); // 2 to 3 arms
  const maxR = 248;

  for (let arm = 0; arm < numArms; arm++) {
    const armOffset = (arm / numArms) * Math.PI * 2;

    for (let step = 0; step < 400; step++) {
      const theta = (step / 400) * Math.PI * 4.5; // spiral rotation length
      const r = 24 + Math.pow(theta, 1.25) * 11; // outward expansion
      if (r > maxR) break;

      const angle = theta + armOffset;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;

      // Draw wispy gas cloud particle
      const size = 5.0 + Math.random() * 9.0;
      const progress = r / maxR;
      const alpha = (1.0 - progress) * 0.28 * (0.35 + Math.random() * 0.65);
      
      const col = Math.random() > 0.45 ? c1 : c2;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, size);
      grad.addColorStop(0, \`rgba(\${col.r}, \${col.g}, \${col.b}, \${alpha})\`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();

      // Sprinkle actual bright star clusters on arms
      if (step % 4 === 0) {
        const starX = x + (Math.random() - 0.5) * 16 * (1.0 + progress * 2.0);
        const starY = y + (Math.random() - 0.5) * 16 * (1.0 + progress * 2.0);
        const starR = 0.5 + Math.random() * 1.5;
        ctx.fillStyle = Math.random() > 0.4 ? "rgba(255, 255, 255, 0.95)" : "rgba(160, 235, 255, 0.9)";
        ctx.beginPath();
        ctx.arc(starX, starY, starR, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // 3. Sprinkle background random field stars
  for (let i = 0; i < 150; i++) {
    const rx = Math.random() * 512;
    const ry = Math.random() * 512;
    const dist = Math.sqrt((rx - cx)*(rx - cx) + (ry - cy)*(ry - cy));
    if (dist > maxR) continue;

    const starR = 0.4 + Math.random() * 1.4;
    const alpha = (1.0 - dist / maxR) * 0.85;
    ctx.fillStyle = \`rgba(255, 255, 255, \${alpha})\`;
    ctx.beginPath();
    ctx.arc(rx, ry, starR, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4. Modulate with absorption fBm dust lanes
  const imgData = ctx.getImageData(0, 0, 512, 512);
  const data = imgData.data;
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const idx = (y * 512 + x) * 4;
      if (data[idx+3] === 0) continue;
      
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      
      // Logarithmic spiral dust lane mapping
      const spiralVal = Math.sin(Math.log(dist || 1) * 3.5 - angle * 2.0);
      if (spiralVal > 0.4) {
        const noise = fBmNoise2D(x * 0.03, y * 0.03, 3);
        const absorption = 0.45 * noise * (dist / 256);
        data[idx] = Math.round(data[idx] * (1.0 - absorption));
        data[idx+1] = Math.round(data[idx+1] * (1.0 - absorption * 1.2));
        data[idx+2] = Math.round(data[idx+2] * (1.0 - absorption * 1.5));
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new BABYLON.DynamicTexture("galaxy_tex", canvas, scene, true);`;

const replacement = `export const generateGalaxyTexture = (baseColor: string, secondaryColor: string, scene: BABYLON.Scene) => {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new BABYLON.DynamicTexture("galaxy_empty", canvas, scene, true);

  ctx.clearRect(0, 0, 1024, 1024);

  const cx = 512;
  const cy = 512;
  const c1 = parseColorToRgb(baseColor);
  const c2 = parseColorToRgb(secondaryColor || baseColor);

  // 1. Core glow (supermassive star cluster/blackhole core) - Brighter and denser
  const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 140);
  coreGrad.addColorStop(0, "rgba(255, 255, 255, 1.0)");
  coreGrad.addColorStop(0.1, "rgba(255, 250, 240, 0.95)");
  coreGrad.addColorStop(0.3, \`rgba(\${c1.r}, \${Math.min(255, c1.g + 50)}, \${Math.min(255, c1.b + 80)}, 0.8)\`);
  coreGrad.addColorStop(0.6, \`rgba(\${c2.r}, \${c2.g}, \${c2.b}, 0.4)\`);
  coreGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 140, 0, Math.PI * 2);
  ctx.fill();

  // 2. Swirling spiral arms (using logarithmic spiral: r = a * e^(b * theta))
  const numArms = 2 + Math.floor(Math.random() * 3); // 2 to 4 arms for more complex galaxies
  const maxR = 480;

  for (let arm = 0; arm < numArms; arm++) {
    const armOffset = (arm / numArms) * Math.PI * 2;
    const twist = 5.5 + Math.random(); // How tightly wound the arms are

    for (let step = 0; step < 800; step++) {
      const theta = (step / 800) * Math.PI * twist; 
      const r = 30 + Math.pow(theta, 1.35) * 16; 
      if (r > maxR) break;

      const angle = theta + armOffset;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;

      // Draw wispy gas cloud particle
      const size = 10.0 + Math.random() * 20.0;
      const progress = r / maxR;
      const alpha = (1.0 - progress) * 0.15 * (0.3 + Math.random() * 0.7);
      
      const col = Math.random() > 0.4 ? c1 : c2;
      
      // Some HII regions (pink/red star-forming regions) along the arms
      const isHII = Math.random() > 0.95 && progress > 0.2 && progress < 0.8;
      let rCol = col.r, gCol = col.g, bCol = col.b;
      if (isHII) {
        rCol = 255; gCol = 50; bCol = 100;
      }
      
      const grad = ctx.createRadialGradient(x, y, 0, x, y, size);
      grad.addColorStop(0, \`rgba(\${rCol}, \${gCol}, \${bCol}, \${alpha})\`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();

      // Sprinkle actual bright star clusters on arms
      if (step % 3 === 0) {
        // Closer to core = tighter spread, further out = looser spread
        const spread = 20 * (1.0 + progress * 3.0);
        const starX = x + (Math.random() - 0.5) * spread;
        const starY = y + (Math.random() - 0.5) * spread;
        const starR = 0.8 + Math.random() * 2.2;
        
        // Young blue stars in arms
        ctx.fillStyle = Math.random() > 0.3 ? "rgba(200, 240, 255, 0.9)" : "rgba(255, 255, 255, 0.95)";
        ctx.beginPath();
        ctx.arc(starX, starY, starR, 0, Math.PI * 2);
        ctx.fill();
        
        // Soft glow for bigger stars
        if (starR > 1.8) {
          const glowGrad = ctx.createRadialGradient(starX, starY, 0, starX, starY, starR * 4);
          glowGrad.addColorStop(0, "rgba(200, 240, 255, 0.4)");
          glowGrad.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = glowGrad;
          ctx.beginPath();
          ctx.arc(starX, starY, starR * 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // 3. Sprinkle background random field stars (Halo stars, older, redder/yellower)
  for (let i = 0; i < 400; i++) {
    const rx = Math.random() * 1024;
    const ry = Math.random() * 1024;
    const dist = Math.sqrt((rx - cx)*(rx - cx) + (ry - cy)*(ry - cy));
    if (dist > maxR + 50) continue;

    const starR = 0.5 + Math.random() * 1.5;
    const alpha = (1.0 - dist / (maxR + 50)) * 0.7;
    // Halo stars are typically older (yellow/orange/red)
    ctx.fillStyle = \`rgba(\${255}, \${220 + Math.random() * 35}, \${180 + Math.random() * 75}, \${alpha})\`;
    ctx.beginPath();
    ctx.arc(rx, ry, starR, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4. Modulate with absorption fBm dust lanes (Dark matter/dust)
  const imgData = ctx.getImageData(0, 0, 1024, 1024);
  const data = imgData.data;
  for (let y = 0; y < 1024; y++) {
    for (let x = 0; x < 1024; x++) {
      const idx = (y * 1024 + x) * 4;
      if (data[idx+3] === 0) continue;
      
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      
      // Logarithmic spiral dust lane mapping
      // Match the dust lanes to the inner edges of the spiral arms
      const spiralVal = Math.sin(Math.log(dist || 1) * (numArms * 1.5) - angle * numArms);
      if (spiralVal > 0.2) {
        // High frequency noise for clumpy dust
        const noise = fBmNoise2D(x * 0.015, y * 0.015, 4);
        // More absorption in the dense lanes
        const absorption = 0.65 * noise * Math.min(1.0, (dist / 150)); 
        
        data[idx] = Math.round(data[idx] * Math.max(0, 1.0 - absorption));
        data[idx+1] = Math.round(data[idx+1] * Math.max(0, 1.0 - absorption * 1.3)); // Absorbs blue/green more
        data[idx+2] = Math.round(data[idx+2] * Math.max(0, 1.0 - absorption * 1.8)); // Leaving reddish dust
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new BABYLON.DynamicTexture("galaxy_tex", canvas, scene, true);`;

if (content.indexOf(target) !== -1) {
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content);
  console.log('Replaced');
} else {
  console.log('Not found');
}
