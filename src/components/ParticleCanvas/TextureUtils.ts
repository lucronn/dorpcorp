import * as BABYLON from "@babylonjs/core";

export const parseColorToRgb = (color: string) => {
  let r = 255, g = 255, b = 255;
  if (!color) return { r, g, b };
  const cleaned = color.trim().toLowerCase();
  if (cleaned.startsWith("#")) {
    const hex = cleaned.replace("#", "");
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16) || 255;
      g = parseInt(hex[1] + hex[1], 16) || 255;
      b = parseInt(hex[2] + hex[2], 16) || 255;
    } else if (hex.length >= 6) {
      r = parseInt(hex.substring(0, 2), 16) || 255;
      g = parseInt(hex.substring(2, 4), 16) || 255;
      b = parseInt(hex.substring(4, 6), 16) || 255;
    }
  } else if (cleaned.startsWith("rgb") || cleaned.startsWith("rgba")) {
    const matches = cleaned.match(/\d+/g);
    if (matches) {
      r = parseInt(matches[0] || "255", 10);
      g = parseInt(matches[1] || "255", 10);
      b = parseInt(matches[2] || "255", 10);
    }
  }
  return { r, g, b };
};

export const createCircleTexture = (scene: BABYLON.Scene) => {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255, 255, 255, 1.0)");
    grad.addColorStop(0.18, "rgba(255, 252, 245, 0.85)");
    grad.addColorStop(0.4, "rgba(255, 245, 235, 0.4)");
    grad.addColorStop(0.75, "rgba(240, 235, 225, 0.08)");
    grad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  const texture = new BABYLON.DynamicTexture("circle_tex", canvas, scene, true);
  texture.hasAlpha = true;
  texture.update();
  return texture;
};

// Procedural 2D Value Noise function for fast texture generation
export const valueNoise2D = (x: number, y: number): number => {
  const X = Math.floor(x);
  const Y = Math.floor(y);
  const fx = x - X;
  const fy = y - Y;

  const u = fx * fx * (3.0 - 2.0 * fx);
  const v = fy * fy * (3.0 - 2.0 * fy);

  const hash = (i: number, j: number) => {
    const s = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453123;
    return s - Math.floor(s);
  };

  const n00 = hash(X, Y);
  const n10 = hash(X + 1, Y);
  const n01 = hash(X, Y + 1);
  const n11 = hash(X + 1, Y + 1);

  return n00 * (1.0 - u) * (1.0 - v) +
         n10 * u * (1.0 - v) +
         n01 * (1.0 - u) * v +
         n11 * u * v;
};

// Fractional Brownian Motion (fBm) with multiple noise octaves
export const fBmNoise2D = (x: number, y: number, octaves: number = 4): number => {
  let value = 0.0;
  let amplitude = 0.5;
  let frequency = 1.0;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * valueNoise2D(x * frequency, y * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
};

export const generateAdvancedPlanetTexture = (baseColor: string, secondaryColor: string, scene: BABYLON.Scene) => {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new BABYLON.DynamicTexture("planet_empty", canvas, scene, true);

  const c1 = parseColorToRgb(baseColor);
  const c2 = parseColorToRgb(secondaryColor || baseColor);

  // 1. Base map using fractional Brownian Motion (fBm) bands for gas giants and rich planet surfaces
  const imgData = ctx.createImageData(512, 256);
  const data = imgData.data;

  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 512; x++) {
      const idx = (y * 512 + x) * 4;

      // Create rich fluid-like atmospheric banding patterns
      const noiseVal = fBmNoise2D(x * 0.015, y * 0.05, 4);
      const band = Math.sin(y * 0.08 + noiseVal * 3.5);
      const t = Math.max(0, Math.min(1, (band + 1.0) / 2));

      // Blend albedo channels
      data[idx] = Math.round(c1.r * (1 - t) + c2.r * t);
      data[idx+1] = Math.round(c1.g * (1 - t) + c2.g * t);
      data[idx+2] = Math.round(c1.b * (1 - t) + c2.b * t);
      data[idx+3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  // 2. Add dynamic, detailed, wavy cloud micro-bands
  for (let i = 0; i < 28; i++) {
    const y = Math.floor(Math.random() * 256);
    const h = Math.floor(1 + Math.random() * 8);
    const alpha = 0.08 + Math.random() * 0.22;
    const useBaseColor = Math.random() > 0.55;
    const col = useBaseColor ? c1 : c2;
    
    ctx.fillStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${alpha})`;
    ctx.beginPath();
    
    const waveFreq = 2 + Math.floor(Math.random() * 4);
    const waveAmp = 2 + Math.random() * 8;
    const phase = Math.random() * Math.PI * 2;

    for (let x = 0; x <= 512; x += 4) {
      const angle = (x / 512) * Math.PI * 2 * waveFreq + phase;
      const dy = Math.sin(angle) * waveAmp;
      if (x === 0) {
        ctx.moveTo(x, y + dy);
      } else {
        ctx.lineTo(x, y + dy);
      }
    }
    ctx.lineTo(512, y + h);
    ctx.lineTo(0, y + h);
    ctx.closePath();
    ctx.fill();
  }

  // 3. Add planetary storms / eddies
  const numStorms = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < numStorms; i++) {
    const stormX = Math.random() * 512;
    const stormY = 50 + Math.random() * 156;
    const stormR1 = 14 + Math.random() * 16;
    const stormR2 = 7 + Math.random() * 8;
    const rotation = (Math.random() - 0.5) * 0.4;

    const grad = ctx.createRadialGradient(stormX, stormY, 0, stormX, stormY, stormR1);
    const stormType = Math.random();
    let stormColor = "rgba(255, 255, 255, 0.75)";
    if (stormType < 0.35) {
      stormColor = `rgba(${Math.max(0, c1.r - 80)}, ${Math.max(0, c1.g - 80)}, ${Math.max(0, c1.b - 80)}, 0.8)`;
    } else if (stormType < 0.7) {
      stormColor = `rgba(${Math.min(255, c2.r + 50)}, ${Math.min(255, c2.g + 50)}, ${Math.min(255, c2.b + 50)}, 0.85)`;
    }

    grad.addColorStop(0, stormColor);
    grad.addColorStop(0.35, `rgba(${c1.r}, ${c1.g}, ${c1.b}, 0.35)`);
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(stormX, stormY, stormR1, stormR2, rotation, 0, Math.PI * 2);
    ctx.fill();

    if (stormX + stormR1 > 512) {
      const wrapX = stormX - 512;
      const gradWrap = ctx.createRadialGradient(wrapX, stormY, 0, wrapX, stormY, stormR1);
      gradWrap.addColorStop(0, stormColor);
      gradWrap.addColorStop(0.35, `rgba(${c1.r}, ${c1.g}, ${c1.b}, 0.35)`);
      gradWrap.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = gradWrap;
      ctx.beginPath();
      ctx.ellipse(wrapX, stormY, stormR1, stormR2, rotation, 0, Math.PI * 2);
      ctx.fill();
    } else if (stormX - stormR1 < 0) {
      const wrapX = stormX + 512;
      const gradWrap = ctx.createRadialGradient(wrapX, stormY, 0, wrapX, stormY, stormR1);
      gradWrap.addColorStop(0, stormColor);
      gradWrap.addColorStop(0.35, `rgba(${c1.r}, ${c1.g}, ${c1.b}, 0.35)`);
      gradWrap.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = gradWrap;
      ctx.beginPath();
      ctx.ellipse(wrapX, stormY, stormR1, stormR2, rotation, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 4. Smooth fine-grain fractal detail overlay for organic planetary albedo detailing
  const imgData2 = ctx.getImageData(0, 0, 512, 256);
  const data2 = imgData2.data;
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 512; x++) {
      const idx = (y * 512 + x) * 4;
      const detailNoise = fBmNoise2D(x * 0.18, y * 0.18, 2);
      const noise = (detailNoise - 0.5) * 6.5; // gentle, smooth organic detail
      data2[idx] = Math.max(0, Math.min(255, data2[idx] + noise));
      data2[idx+1] = Math.max(0, Math.min(255, data2[idx+1] + noise));
      data2[idx+2] = Math.max(0, Math.min(255, data2[idx+2] + noise));
    }
  }
  ctx.putImageData(imgData2, 0, 0);

  const texture = new BABYLON.DynamicTexture("planet_tex", canvas, scene, true);
  texture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
  texture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
  texture.update();
  return texture;
};

export const generateConcentricRingTexture = (ringColor: string, scene: BABYLON.Scene) => {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, 512, 512);

  const cx = 256;
  const cy = 256;
  const col = parseColorToRgb(ringColor);

  for (let r = 85; r <= 245; r++) {
    const norm = (r - 85) / 160;
    let alpha = Math.sin(norm * Math.PI);

    if (norm > 0.44 && norm < 0.52) {
      alpha *= 0.04;
    } else if (norm > 0.82 && norm < 0.86) {
      alpha *= 0.1;
    } else {
      const ringletDetail = Math.sin(norm * 160) * 0.25 + Math.sin(norm * 60) * 0.15;
      alpha += ringletDetail;
    }

    alpha = Math.max(0, Math.min(0.72, alpha));

    ctx.strokeStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${alpha})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  const texture = new BABYLON.DynamicTexture("ring_tex", canvas, scene, true);
  texture.hasAlpha = true;
  texture.update();
  return texture;
};

export const generateDistortedLightwaveTexture = (baseColor: string, scene: BABYLON.Scene) => {
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
      grad.addColorStop(0, `rgba(${rVal}, ${Math.max(0, gVal-50)}, ${Math.max(0, bVal-100)}, ${alphaBase * 0.3})`); // receding
      grad.addColorStop(0.5, `rgba(${rVal}, ${gVal}, ${col.b}, ${alphaBase * 0.8})`); 
      grad.addColorStop(1, `rgba(255, 255, 255, ${alphaBase * 1.5})`); // approaching
      
      tCtx.strokeStyle = grad;
      tCtx.shadowColor = `rgba(${rVal}, ${gVal}, ${col.b}, ${alphaBase})`;
      tCtx.shadowBlur = 8 + heat * 12;
      tCtx.stroke();
      
      ctx.drawImage(tempCanvas, 0, 0);
    }
  }

  // Photon ring (ultra-bright inner boundary)
  const photonGrad = ctx.createRadialGradient(cx, cy, 90, cx, cy, 140);
  photonGrad.addColorStop(0, "rgba(0,0,0,0)");
  photonGrad.addColorStop(0.2, `rgba(255, 255, 255, 0.95)`);
  photonGrad.addColorStop(0.4, `rgba(${col.r}, ${col.g}, ${col.b}, 0.8)`);
  photonGrad.addColorStop(1.0, "rgba(0,0,0,0)");
  ctx.fillStyle = photonGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 140, 0, Math.PI * 2);
  ctx.fill();

  const texture = new BABYLON.DynamicTexture("lensing_tex", canvas, scene, true);
  texture.hasAlpha = true;
  texture.update();
  return texture;
};

export const createCircularGlowTexture = (colorStr: string, scene: BABYLON.Scene) => {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, colorStr);
    grad.addColorStop(0.5, colorStr.replace(/[\d\.]+\)$/, "0.3)"));
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  const texture = new BABYLON.DynamicTexture("glow_tex", canvas, scene, true);
  texture.hasAlpha = true;
  texture.update();
  return texture;
};

export const generateGalaxyTexture = (baseColor: string, secondaryColor: string, scene: BABYLON.Scene) => {
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
  coreGrad.addColorStop(0.3, `rgba(${c1.r}, ${Math.min(255, c1.g + 50)}, ${Math.min(255, c1.b + 80)}, 0.8)`);
  coreGrad.addColorStop(0.6, `rgba(${c2.r}, ${c2.g}, ${c2.b}, 0.4)`);
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
      grad.addColorStop(0, `rgba(${rCol}, ${gCol}, ${bCol}, ${alpha})`);
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
    ctx.fillStyle = `rgba(${255}, ${220 + Math.random() * 35}, ${180 + Math.random() * 75}, ${alpha})`;
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

  const texture = new BABYLON.DynamicTexture("galaxy_tex", canvas, scene, true);
  texture.hasAlpha = true;
  texture.update();
  return texture;
};

export const generateNebulaTexture = (baseColor: string, secondaryColor: string, scene: BABYLON.Scene) => {
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
      ctx.fillStyle = Math.random() > 0.3 ? `rgba(220, 245, 255, ${alpha})` : `rgba(255, 255, 255, ${alpha * 0.9})`;
      ctx.beginPath();
      ctx.arc(starX, starY, size, 0, Math.PI * 2);
      ctx.fill();
      
      // Star glow
      if (size > 2.0) {
        const glowGrad = ctx.createRadialGradient(starX, starY, 0, starX, starY, size * 5);
        glowGrad.addColorStop(0, `rgba(200, 240, 255, ${alpha * 0.4})`);
        glowGrad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(starX, starY, size * 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  const texture = new BABYLON.DynamicTexture("nebula_tex", canvas, scene, true);
  texture.hasAlpha = true;
  texture.update();
  return texture;
};

