const fs = require('fs');
const file = 'src/components/ParticleCanvas/TextureUtils.ts';
let content = fs.readFileSync(file, 'utf8');

const target = `export const generateDistortedLightwaveTexture = (baseColor: string, scene: BABYLON.Scene) => {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new BABYLON.DynamicTexture("lensing_empty", canvas, scene, true);

  ctx.clearRect(0, 0, 512, 512);

  const cx = 256;
  const cy = 256;
  const col = parseColorToRgb(baseColor);

  for (let ring = 0; ring < 32; ring++) {
    const baseRadius = 65 + ring * 5.5;
    const progress = ring / 32;
    const alpha = Math.sin(progress * Math.PI) * 0.75 * Math.max(0.1, 1.0 - progress);

    ctx.beginPath();
    const steps = 180;
    for (let i = 0; i <= steps; i++) {
      const theta = (i / steps) * Math.PI * 2;
      
      const wave1 = Math.sin(theta * 3.0 + ring * 0.15) * 8.0;
      const wave2 = Math.cos(theta * 5.0 - ring * 0.25) * 5.0;
      const wave3 = Math.sin(theta * 8.0) * 3.0;
      
      const r = baseRadius + wave1 + wave2 + wave3;
      const x = cx + Math.cos(theta) * r;
      const y = cy + Math.sin(theta) * r;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();

    const ringColor = \`rgba(\${Math.min(255, col.r + ring * 2)}, \${Math.min(255, col.g + 20 + ring * 1.5)}, \${col.b}, \${alpha})\`;
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 1.4 + Math.random() * 1.6;
    ctx.shadowColor = \`rgba(255, 170, 0, \${alpha * 0.8})\`;
    ctx.shadowBlur = 12;
    ctx.stroke();
  }

  const grad = ctx.createRadialGradient(cx, cy, 48, cx, cy, 240);
  grad.addColorStop(0, "rgba(0,0,0,1.0)");
  grad.addColorStop(0.1, "rgba(0,0,0,1.0)");
  grad.addColorStop(0.12, \`rgba(\${col.r}, \${col.g}, \${col.b}, 0.95)\`);
  grad.addColorStop(0.35, \`rgba(235, 100, 0, 0.45)\`);
  grad.addColorStop(0.75, \`rgba(180, 50, 0, 0.12)\`);
  grad.addColorStop(1.0, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 240, 0, Math.PI * 2);
  ctx.fill();

  const texture = new BABYLON.DynamicTexture("lensing_tex", canvas, scene, true);`;

const replacement = `export const generateDistortedLightwaveTexture = (baseColor: string, scene: BABYLON.Scene) => {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new BABYLON.DynamicTexture("lensing_empty", canvas, scene, true);

  ctx.clearRect(0, 0, 1024, 1024);

  const cx = 512;
  const cy = 512;
  const col = parseColorToRgb(baseColor);

  // Doppler beaming effect (brighter on one side representing material moving toward observer)
  const dopplerAngle = Math.PI / 4; 

  for (let ring = 0; ring < 64; ring++) {
    const baseRadius = 120 + ring * 5.5;
    const progress = ring / 64;
    
    ctx.beginPath();
    const steps = 360;
    for (let i = 0; i <= steps; i++) {
      const theta = (i / steps) * Math.PI * 2;
      
      // Complex gravitational distortion waves
      const wave1 = Math.sin(theta * 2.0 + ring * 0.1) * 15.0;
      const wave2 = Math.cos(theta * 7.0 - ring * 0.3) * 6.0;
      const wave3 = Math.sin(theta * 13.0) * 2.5;
      
      const r = baseRadius + wave1 + wave2 + wave3;
      const x = cx + Math.cos(theta) * r;
      const y = cy + Math.sin(theta) * r;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();

    ctx.lineWidth = 1.0 + Math.random() * 3.0;
    
    // Calculate color per ring, but we'll also apply a gradient mask for doppler shift later
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = 1024;
    tempCanvas.height = 1024;
    const tCtx = tempCanvas.getContext("2d");
    if (tCtx) {
      tCtx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const theta = (i / steps) * Math.PI * 2;
        const wave1 = Math.sin(theta * 2.0 + ring * 0.1) * 15.0;
        const wave2 = Math.cos(theta * 7.0 - ring * 0.3) * 6.0;
        const wave3 = Math.sin(theta * 13.0) * 2.5;
        const r = baseRadius + wave1 + wave2 + wave3;
        const x = cx + Math.cos(theta) * r;
        const y = cy + Math.sin(theta) * r;
        if (i === 0) tCtx.moveTo(x, y);
        else tCtx.lineTo(x, y);
      }
      tCtx.closePath();
      
      tCtx.lineWidth = ctx.lineWidth;
      // White hot inner, cooling down outer
      const heat = 1.0 - progress;
      const rVal = Math.min(255, col.r + heat * 100);
      const gVal = Math.min(255, col.g + heat * 50);
      const bVal = Math.min(255, col.b + heat * 20);
      
      const grad = tCtx.createLinearGradient(
        cx + Math.cos(dopplerAngle - Math.PI) * 512, cy + Math.sin(dopplerAngle - Math.PI) * 512,
        cx + Math.cos(dopplerAngle) * 512, cy + Math.sin(dopplerAngle) * 512
      );
      
      // Doppler beaming: redshift (dimmer, redder) receding, blueshift (brighter, whiter) approaching
      const alphaBase = Math.sin(progress * Math.PI) * Math.max(0.2, 1.0 - progress);
      grad.addColorStop(0, \`rgba(\${rVal}, \${Math.max(0, gVal-50)}, \${Math.max(0, bVal-100)}, \${alphaBase * 0.3})\`); // receding
      grad.addColorStop(0.5, \`rgba(\${rVal}, \${gVal}, \${col.b}, \${alphaBase * 0.8})\`); 
      grad.addColorStop(1, \`rgba(255, 255, 255, \${alphaBase * 1.5})\`); // approaching
      
      tCtx.strokeStyle = grad;
      tCtx.shadowColor = \`rgba(\${rVal}, \${gVal}, \${col.b}, \${alphaBase})\`;
      tCtx.shadowBlur = 8 + heat * 12;
      tCtx.stroke();
      
      ctx.drawImage(tempCanvas, 0, 0);
    }
  }

  // Photon ring (ultra-bright inner boundary)
  const photonGrad = ctx.createRadialGradient(cx, cy, 90, cx, cy, 140);
  photonGrad.addColorStop(0, "rgba(0,0,0,0)");
  photonGrad.addColorStop(0.2, \`rgba(255, 255, 255, 0.95)\`);
  photonGrad.addColorStop(0.4, \`rgba(\${col.r}, \${col.g}, \${col.b}, 0.8)\`);
  photonGrad.addColorStop(1.0, "rgba(0,0,0,0)");
  ctx.fillStyle = photonGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 140, 0, Math.PI * 2);
  ctx.fill();

  const texture = new BABYLON.DynamicTexture("lensing_tex", canvas, scene, true);`;
  
if (content.indexOf(target) !== -1) {
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content);
  console.log('Replaced');
} else {
  console.log('Not found');
}
