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
    grad.addColorStop(0, "rgba(255, 255, 255, 0.85)");
    grad.addColorStop(0.12, "rgba(255, 255, 255, 0.65)");
    grad.addColorStop(0.3, "rgba(255, 248, 240, 0.32)");
    grad.addColorStop(0.6, "rgba(255, 245, 235, 0.1)");
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

    const ringColor = `rgba(${Math.min(255, col.r + ring * 2)}, ${Math.min(255, col.g + 20 + ring * 1.5)}, ${col.b}, ${alpha})`;
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 1.4 + Math.random() * 1.6;
    ctx.shadowColor = `rgba(255, 170, 0, ${alpha * 0.8})`;
    ctx.shadowBlur = 12;
    ctx.stroke();
  }

  const grad = ctx.createRadialGradient(cx, cy, 48, cx, cy, 240);
  grad.addColorStop(0, "rgba(0,0,0,1.0)");
  grad.addColorStop(0.1, "rgba(0,0,0,1.0)");
  grad.addColorStop(0.12, `rgba(${col.r}, ${col.g}, ${col.b}, 0.95)`);
  grad.addColorStop(0.35, `rgba(235, 100, 0, 0.45)`);
  grad.addColorStop(0.75, `rgba(180, 50, 0, 0.12)`);
  grad.addColorStop(1.0, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 240, 0, Math.PI * 2);
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
  coreGrad.addColorStop(0.2, `rgba(${c1.r}, ${Math.min(255, c1.g + 40)}, ${Math.min(255, c1.b + 60)}, 0.85)`);
  coreGrad.addColorStop(0.55, `rgba(${c2.r}, ${c2.g}, ${c2.b}, 0.38)`);
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
      grad.addColorStop(0, `rgba(${col.r}, ${col.g}, ${col.b}, ${alpha})`);
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
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
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

  const texture = new BABYLON.DynamicTexture("galaxy_tex", canvas, scene, true);
  texture.hasAlpha = true;
  texture.update();
  return texture;
};

export const generateNebulaTexture = (baseColor: string, secondaryColor: string, scene: BABYLON.Scene) => {
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
  ctx.shadowColor = `rgba(${c1.r}, ${c1.g}, ${c1.b}, 0.2)`;
  ctx.shadowBlur = 15;
  for (let i = 0; i < 6; i++) {
    const col = Math.random() > 0.5 ? c1 : c2;
    ctx.strokeStyle = `rgba(${col.r}, ${col.g}, ${col.b}, 0.14)`;
    ctx.lineWidth = 1.5 + Math.random() * 2.0;
    ctx.beginPath();
    ctx.moveTo(cx + (Math.random() - 0.5) * 240, cy + (Math.random() - 0.5) * 240);
    ctx.bezierCurveTo(
      cx + (Math.random() - 0.5) * 220, cy + (Math.random() - 0.5) * 220,
      cx + (Math.random() - 0.5) * 220, cy + (Math.random() - 0.5) * 220,
      cx + (Math.random() - 0.5) * 240, cy + (Math.random() - 0.5) * 240
    );
    ctx.stroke();
  }

  const texture = new BABYLON.DynamicTexture("nebula_tex", canvas, scene, true);
  texture.hasAlpha = true;
  texture.update();
  return texture;
};

