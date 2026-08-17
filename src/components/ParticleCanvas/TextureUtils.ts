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
  } else if (cleaned.startsWith("rgb")) {
    const matches = cleaned.match(/\d+/g);
    if (matches) {
      r = parseInt(matches[0] || "255", 10);
      g = parseInt(matches[1] || "255", 10);
      b = parseInt(matches[2] || "255", 10);
    }
  }
  return { r, g, b };
};

export const parseColorToBabylonColor3 = (color: string) => {
  const { r, g, b } = parseColorToRgb(color);
  return new BABYLON.Color3(r / 255, g / 255, b / 255);
};

export const parseColorToBabylonColor4 = (color: string, alpha: number = 1.0) => {
  const { r, g, b } = parseColorToRgb(color);
  return new BABYLON.Color4(r / 255, g / 255, b / 255, alpha);
};

/** Ultra-soft particle point texture with smooth Gaussian falloff and zero hard edges */
export const createCircleTexture = (scene: BABYLON.Scene): BABYLON.DynamicTexture => {
  const size = 128;
  const texture = new BABYLON.DynamicTexture("circle_particle_tex", size, scene, false);
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  if (!ctx) return texture;

  ctx.clearRect(0, 0, size, size);
  const center = size / 2;
  const grad = ctx.createRadialGradient(center, center, 0, center, center, center);
  grad.addColorStop(0.0, "rgba(255, 255, 255, 1.0)");
  grad.addColorStop(0.12, "rgba(255, 255, 255, 0.85)");
  grad.addColorStop(0.3, "rgba(255, 255, 255, 0.45)");
  grad.addColorStop(0.55, "rgba(255, 255, 255, 0.15)");
  grad.addColorStop(0.8, "rgba(255, 255, 255, 0.03)");
  grad.addColorStop(1.0, "rgba(255, 255, 255, 0.0)");

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  texture.hasAlpha = true;
  texture.update();
  return texture;
};

/** Smooth, ethereal radial glow disc texture for stars, light halos, and flares with zero color banding */
export const createCircularGlowTexture = (colorStr: string, scene: BABYLON.Scene): BABYLON.DynamicTexture => {
  const size = 512;
  const texture = new BABYLON.DynamicTexture("glow_disc_tex", size, scene, true, BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  if (!ctx) return texture;

  const { r, g, b } = parseColorToRgb(colorStr);
  ctx.clearRect(0, 0, size, size);
  const center = size / 2;

  // Multi-stop ultra-smooth radial gradient
  const grad = ctx.createRadialGradient(center, center, 0, center, center, center);
  grad.addColorStop(0.0, `rgba(${r}, ${g}, ${b}, 1.0)`);
  grad.addColorStop(0.12, `rgba(${r}, ${g}, ${b}, 0.88)`);
  grad.addColorStop(0.25, `rgba(${r}, ${g}, ${b}, 0.58)`);
  grad.addColorStop(0.42, `rgba(${r}, ${g}, ${b}, 0.32)`);
  grad.addColorStop(0.62, `rgba(${r}, ${g}, ${b}, 0.12)`);
  grad.addColorStop(0.82, `rgba(${r}, ${g}, ${b}, 0.03)`);
  grad.addColorStop(1.0, `rgba(${r}, ${g}, ${b}, 0.0)`);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Sub-pixel dither pass to break up 8-bit quantization steps and eliminate posterization/banding
  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0) {
      const noise = (Math.random() - 0.5) * 4.0;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
      data[i + 3] = Math.min(255, Math.max(0, data[i + 3] + noise * 0.4));
    }
  }
  ctx.putImageData(imgData, 0, 0);

  texture.hasAlpha = true;
  texture.update(true);
  return texture;
};

/** Accretion Disk texture for Black Holes with a dark inner event horizon hole and smooth soft outer radial decay */
export const generateAccretionDiskTexture = (colorStr: string, secondaryStr: string, scene: BABYLON.Scene): BABYLON.DynamicTexture => {
  const size = 512;
  const texture = new BABYLON.DynamicTexture("accretion_disk_tex", size, scene, true, BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  if (!ctx) return texture;

  const { r: r1, g: g1, b: b1 } = parseColorToRgb(colorStr);
  const { r: r2, g: g2, b: b2 } = parseColorToRgb(secondaryStr);

  ctx.clearRect(0, 0, size, size);
  const center = size / 2;

  // Outer glowing plasma ring with strict inner black void and smooth outer falloff
  const grad = ctx.createRadialGradient(center, center, 0, center, center, size * 0.5);
  grad.addColorStop(0.0, `rgba(0, 0, 0, 0.0)`);
  grad.addColorStop(0.28, `rgba(0, 0, 0, 0.0)`);
  grad.addColorStop(0.32, `rgba(${r1}, ${g1}, ${b1}, 0.98)`);
  grad.addColorStop(0.42, `rgba(${r2}, ${g2}, ${b2}, 0.85)`);
  grad.addColorStop(0.68, `rgba(${r1}, ${g1}, ${b1}, 0.35)`);
  grad.addColorStop(0.88, `rgba(${r2}, ${g2}, ${b2}, 0.06)`);
  grad.addColorStop(1.0, `rgba(0, 0, 0, 0.0)`);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Add subtle swirl noise bands for realistic accretion plasma streams
  ctx.save();
  ctx.translate(center, center);
  ctx.lineWidth = 3;
  for (let a = 0; a < Math.PI * 2; a += 0.15) {
    const startR = size * 0.30;
    const endR = size * 0.44;
    const alpha = 0.06 + Math.sin(a * 8) * 0.04;
    ctx.strokeStyle = `rgba(${r2}, ${g2}, ${b2}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(0, 0, startR + (endR - startR) * (a / (Math.PI * 2)), a, a + 0.4);
    ctx.stroke();
  }
  ctx.restore();

  // Strict inner radial mask pass: enforce 100% pure transparent void at center
  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;
  const cutoffR = size * 0.28;
  const cutoffR2 = cutoffR * cutoffR;
  for (let y = 0; y < size; y++) {
    const dy = y - center;
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const idx = (y * size + x) * 4;
      if (dx * dx + dy * dy < cutoffR2) {
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 0;
      } else if (data[idx + 3] > 0) {
        const noise = (Math.random() - 0.5) * 3.5;
        data[idx] = Math.min(255, Math.max(0, data[idx] + noise));
        data[idx + 1] = Math.min(255, Math.max(0, data[idx + 1] + noise));
        data[idx + 2] = Math.min(255, Math.max(0, data[idx + 2] + noise));
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);

  texture.hasAlpha = true;
  texture.update(true);
  return texture;
};

/** Crisp, razor-thin Photon Ring halo surrounding a Black Hole's pitch-black event horizon silhouette */
export const generatePhotonRingTexture = (colorStr: string, secondaryStr: string, scene: BABYLON.Scene): BABYLON.DynamicTexture => {
  const size = 512;
  const texture = new BABYLON.DynamicTexture("photon_ring_tex", size, scene, true, BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  if (!ctx) return texture;

  const { r: r1, g: g1, b: b1 } = parseColorToRgb(colorStr);
  const { r: r2, g: g2, b: b2 } = parseColorToRgb(secondaryStr);

  ctx.clearRect(0, 0, size, size);
  const center = size / 2;

  // IMPORTANT: Inner radius 0.0 to size * 0.23 MUST BE 100% TRANSPARENT / PURE BLACK VOID
  const ringInnerR = size * 0.23;
  const ringPeakR = size * 0.255;
  const ringOuterR = size * 0.46;

  const grad = ctx.createRadialGradient(center, center, 0, center, center, size * 0.5);
  grad.addColorStop(0.0, "rgba(0, 0, 0, 0.0)");
  grad.addColorStop(ringInnerR / (size * 0.5), "rgba(0, 0, 0, 0.0)");
  
  // Razor-sharp intense photon sphere ring (ISCO / photon orbit boundary)
  grad.addColorStop((ringInnerR + (ringPeakR - ringInnerR) * 0.5) / (size * 0.5), `rgba(255, 255, 255, 1.0)`);
  grad.addColorStop(ringPeakR / (size * 0.5), `rgba(${r1}, ${g1}, ${b1}, 0.95)`);
  grad.addColorStop((ringPeakR + 18) / (size * 0.5), `rgba(${r2}, ${g2}, ${b2}, 0.60)`);
  grad.addColorStop((ringPeakR + 45) / (size * 0.5), `rgba(${r1}, ${g1}, ${b1}, 0.18)`);
  grad.addColorStop(ringOuterR / (size * 0.5), "rgba(0, 0, 0, 0.0)");

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Strict inner radial mask pass for photon ring
  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;
  const ringCutoffR = size * 0.24;
  const ringCutoffR2 = ringCutoffR * ringCutoffR;
  for (let y = 0; y < size; y++) {
    const dy = y - center;
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const idx = (y * size + x) * 4;
      if (dx * dx + dy * dy < ringCutoffR2) {
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 0;
      } else if (data[idx + 3] > 0) {
        const noise = (Math.random() - 0.5) * 3.0;
        data[idx] = Math.min(255, Math.max(0, data[idx] + noise));
        data[idx + 1] = Math.min(255, Math.max(0, data[idx + 1] + noise));
        data[idx + 2] = Math.min(255, Math.max(0, data[idx + 2] + noise));
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);

  texture.hasAlpha = true;
  texture.update(true);
  return texture;
};

export const generateAdvancedPlanetTexture = (colorHex: string, secondaryHex: string, scene: BABYLON.Scene): BABYLON.DynamicTexture => {
  const width = 512;
  const height = 256;
  const texture = new BABYLON.DynamicTexture("planet_adv_tex", { width, height }, scene, false);
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  if (!ctx) return texture;

  const { r: r1, g: g1, b: b1 } = parseColorToRgb(colorHex);
  const { r: r2, g: g2, b: b2 } = parseColorToRgb(secondaryHex);

  // Base oceanic/surface color gradient
  const baseGrad = ctx.createLinearGradient(0, 0, 0, height);
  baseGrad.addColorStop(0, `rgb(${Math.max(0, r1 - 30)}, ${Math.max(0, g1 - 30)}, ${Math.max(0, b1 - 30)})`);
  baseGrad.addColorStop(0.5, `rgb(${r1}, ${g1}, ${b1})`);
  baseGrad.addColorStop(1, `rgb(${Math.max(0, r1 - 40)}, ${Math.max(0, g1 - 40)}, ${Math.max(0, b1 - 40)})`);
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, width, height);

  // Soft blended continents / surface feature clouds
  for (let i = 0; i < 35; i++) {
    const cx = Math.random() * width;
    const cy = Math.random() * height;
    const rx = 30 + Math.random() * 80;
    const ry = 15 + Math.random() * 40;

    const radGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
    radGrad.addColorStop(0, `rgba(${r2}, ${g2}, ${b2}, 0.55)`);
    radGrad.addColorStop(0.6, `rgba(${r2}, ${g2}, ${b2}, 0.25)`);
    radGrad.addColorStop(1, `rgba(${r2}, ${g2}, ${b2}, 0.0)`);

    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  texture.update();
  return texture;
};

export const generatePlanetNightLightsTexture = (colorHex: string, secondaryHex: string, scene: BABYLON.Scene): BABYLON.DynamicTexture => {
  const width = 512;
  const height = 256;
  const texture = new BABYLON.DynamicTexture("planet_night_tex", { width, height }, scene, false);
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  if (!ctx) return texture;

  ctx.fillStyle = "rgba(0, 0, 0, 1.0)";
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 180; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const size = 0.8 + Math.random() * 1.5;
    const alpha = 0.3 + Math.random() * 0.5;
    ctx.fillStyle = `rgba(255, 210, 120, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  texture.update();
  return texture;
};

export const generatePlanetBumpNormalTexture = (scene: BABYLON.Scene): BABYLON.DynamicTexture => {
  const width = 256;
  const height = 128;
  const texture = new BABYLON.DynamicTexture("planet_bump_tex", { width, height }, scene, false);
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  if (!ctx) return texture;

  ctx.fillStyle = "rgb(128, 128, 255)";
  ctx.fillRect(0, 0, width, height);
  texture.update();
  return texture;
};

export const generateProceduralCloudTexture = (colorHex: string, scene: BABYLON.Scene): BABYLON.DynamicTexture => {
  const width = 512;
  const height = 256;
  const texture = new BABYLON.DynamicTexture("cloud_tex", { width, height }, scene, false);
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  if (!ctx) return texture;

  const { r, g, b } = parseColorToRgb(colorHex);
  ctx.clearRect(0, 0, width, height);

  for (let i = 0; i < 40; i++) {
    const cx = Math.random() * width;
    const cy = Math.random() * height;
    const rad = 20 + Math.random() * 60;

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    grad.addColorStop(0, `rgba(${Math.min(255, r + 60)}, ${Math.min(255, g + 60)}, ${Math.min(255, b + 60)}, 0.45)`);
    grad.addColorStop(0.5, `rgba(${Math.min(255, r + 40)}, ${Math.min(255, g + 40)}, ${Math.min(255, b + 40)}, 0.20)`);
    grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.0)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  texture.hasAlpha = true;
  texture.update();
  return texture;
};

export const generateAuroraTexture = (colorHex: string, scene: BABYLON.Scene): BABYLON.DynamicTexture => {
  const size = 256;
  const texture = new BABYLON.DynamicTexture("aurora_tex", size, scene, false);
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  if (!ctx) return texture;

  const { r, g, b } = parseColorToRgb(colorHex);
  ctx.clearRect(0, 0, size, size);

  const center = size / 2;
  const grad = ctx.createRadialGradient(center, center, 0, center, center, center);
  grad.addColorStop(0.0, `rgba(${r}, ${g}, ${b}, 0.7)`);
  grad.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, 0.35)`);
  grad.addColorStop(0.75, `rgba(${r}, ${g}, ${b}, 0.08)`);
  grad.addColorStop(1.0, `rgba(${r}, ${g}, ${b}, 0.0)`);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  texture.hasAlpha = true;
  texture.update();
  return texture;
};

export const generateStarTexture = (baseColor: string, secondaryColor: string, scene: BABYLON.Scene): BABYLON.DynamicTexture => {
  const size = 512;
  const texture = new BABYLON.DynamicTexture("star_surface_tex", size, scene, true, BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  if (!ctx) return texture;

  const { r: r1, g: g1, b: b1 } = parseColorToRgb(baseColor);
  const { r: r2, g: g2, b: b2 } = parseColorToRgb(secondaryColor);

  // Base luminous solar surface
  ctx.fillStyle = `rgb(${r1}, ${g1}, ${b1})`;
  ctx.fillRect(0, 0, size, size);

  // Solar convection cells & dynamic plasma turbulence
  for (let i = 0; i < 110; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 12 + Math.random() * 55;

    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${r2}, ${g2}, ${b2}, 0.70)`);
    grad.addColorStop(0.4, `rgba(${r2}, ${g2}, ${b2}, 0.35)`);
    grad.addColorStop(0.8, `rgba(${r1}, ${g1}, ${b1}, 0.10)`);
    grad.addColorStop(1, `rgba(${r1}, ${g1}, ${b1}, 0.0)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sub-pixel dither pass to eliminate 8-bit color quantization banding
  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 3.5;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  texture.update(true);
  return texture;
};

export const generateConcentricRingTexture = (ringColor: string, scene: BABYLON.Scene): BABYLON.DynamicTexture => {
  const size = 512;
  const texture = new BABYLON.DynamicTexture("ring_tex", size, scene, false);
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  if (!ctx) return texture;

  const { r, g, b } = parseColorToRgb(ringColor);
  ctx.clearRect(0, 0, size, size);
  const center = size / 2;

  // Soft translucent ring bands with feathered radial edges
  for (let radius = 70; radius < center - 15; radius += 6 + Math.random() * 10) {
    const bandWidth = 3 + Math.random() * 6;
    const alpha = 0.15 + Math.random() * 0.45;

    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    ctx.lineWidth = bandWidth;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Soft radial inner/outer opacity mask so the rings fade gracefully at inner & outer boundaries
  const maskGrad = ctx.createRadialGradient(center, center, 60, center, center, center - 10);
  maskGrad.addColorStop(0.0, "rgba(0,0,0,1.0)");
  maskGrad.addColorStop(0.15, "rgba(0,0,0,0.0)");
  maskGrad.addColorStop(0.85, "rgba(0,0,0,0.0)");
  maskGrad.addColorStop(1.0, "rgba(0,0,0,1.0)");

  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = maskGrad;
  ctx.beginPath();
  ctx.arc(center, center, center, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  texture.hasAlpha = true;
  texture.update();
  return texture;
};

export const generateDistortedLightwaveTexture = (baseColor: string, scene: BABYLON.Scene): BABYLON.DynamicTexture => {
  const size = 256;
  const texture = new BABYLON.DynamicTexture("lightwave_tex", size, scene, false);
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  if (!ctx) return texture;

  const { r, g, b } = parseColorToRgb(baseColor);
  ctx.clearRect(0, 0, size, size);
  const center = size / 2;

  const grad = ctx.createRadialGradient(center, center, 0, center, center, center);
  grad.addColorStop(0.0, `rgba(${r}, ${g}, ${b}, 0.85)`);
  grad.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, 0.45)`);
  grad.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, 0.10)`);
  grad.addColorStop(1.0, `rgba(${r}, ${g}, ${b}, 0.0)`);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  texture.hasAlpha = true;
  texture.update();
  return texture;
};

export const generateGalaxyTexture = (baseColor: string, secondaryColor: string, scene: BABYLON.Scene): BABYLON.DynamicTexture => {
  const size = 512;
  const texture = new BABYLON.DynamicTexture("galaxy_tex", size, scene, false);
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  if (!ctx) return texture;

  const { r: r1, g: g1, b: b1 } = parseColorToRgb(baseColor);
  const { r: r2, g: g2, b: b2 } = parseColorToRgb(secondaryColor);

  ctx.clearRect(0, 0, size, size);
  const center = size / 2;

  // Ultra-soft core glow fading out smoothly
  const grad = ctx.createRadialGradient(center, center, 0, center, center, center);
  grad.addColorStop(0.0, `rgba(${r2}, ${g2}, ${b2}, 0.95)`);
  grad.addColorStop(0.18, `rgba(${r1}, ${g1}, ${b1}, 0.65)`);
  grad.addColorStop(0.45, `rgba(${r1}, ${g1}, ${b1}, 0.25)`);
  grad.addColorStop(0.75, `rgba(${r1}, ${g1}, ${b1}, 0.06)`);
  grad.addColorStop(1.0, `rgba(0, 0, 0, 0.0)`);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Soft spiral arms made of feathered particles
  ctx.save();
  ctx.translate(center, center);
  for (let arm = 0; arm < 2; arm++) {
    const baseAngle = arm * Math.PI;
    for (let r = 15; r < center * 0.85; r += 2) {
      const angle = baseAngle + (r / 35);
      const scatterX = (Math.random() - 0.5) * (r * 0.35);
      const scatterY = (Math.random() - 0.5) * (r * 0.35);
      const x = Math.cos(angle) * r + scatterX;
      const y = Math.sin(angle) * r + scatterY;
      const puffRad = 8 + Math.random() * 20;

      const puffGrad = ctx.createRadialGradient(x, y, 0, x, y, puffRad);
      puffGrad.addColorStop(0, `rgba(${r2}, ${g2}, ${b2}, 0.22)`);
      puffGrad.addColorStop(0.5, `rgba(${r1}, ${g1}, ${b1}, 0.08)`);
      puffGrad.addColorStop(1, `rgba(0, 0, 0, 0)`);

      ctx.fillStyle = puffGrad;
      ctx.beginPath();
      ctx.arc(x, y, puffRad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  texture.hasAlpha = true;
  texture.update();
  return texture;
};

export const generateNebulaTexture = (baseColor: string, secondaryColor: string, scene: BABYLON.Scene): BABYLON.DynamicTexture => {
  const size = 512;
  const texture = new BABYLON.DynamicTexture("nebula_tex", size, scene, false);
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  if (!ctx) return texture;

  const { r: r1, g: g1, b: b1 } = parseColorToRgb(baseColor);
  const { r: r2, g: g2, b: b2 } = parseColorToRgb(secondaryColor);

  ctx.clearRect(0, 0, size, size);
  const center = size / 2;

  // Draw 30 overlapping ultra-soft gaussian gas puffs
  for (let i = 0; i < 30; i++) {
    const cx = size * 0.25 + Math.random() * size * 0.5;
    const cy = size * 0.25 + Math.random() * size * 0.5;
    const rad = 60 + Math.random() * 110;

    const useSec = Math.random() > 0.4;
    const cr = useSec ? r2 : r1;
    const cg = useSec ? g2 : g1;
    const cb = useSec ? b2 : b1;

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    grad.addColorStop(0.0, `rgba(${cr}, ${cg}, ${cb}, 0.35)`);
    grad.addColorStop(0.35, `rgba(${cr}, ${cg}, ${cb}, 0.18)`);
    grad.addColorStop(0.7, `rgba(${cr}, ${cg}, ${cb}, 0.05)`);
    grad.addColorStop(1.0, `rgba(${cr}, ${cg}, ${cb}, 0.0)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Smooth radial outer mask to ensure zero sharp square borders on the texture
  const outerMask = ctx.createRadialGradient(center, center, size * 0.25, center, center, size * 0.48);
  outerMask.addColorStop(0.0, "rgba(0, 0, 0, 0.0)");
  outerMask.addColorStop(1.0, "rgba(0, 0, 0, 1.0)");

  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = outerMask;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = "source-over";

  texture.hasAlpha = true;
  texture.update();
  return texture;
};

export const blendColorsHex = (color1: string, color2: string, weight1: number = 0.5): string => {
  const rgb1 = parseColorToRgb(color1);
  const rgb2 = parseColorToRgb(color2);
  const w1 = Math.max(0, Math.min(1, weight1));
  const w2 = 1 - w1;
  const r = Math.round(rgb1.r * w1 + rgb2.r * w2);
  const g = Math.round(rgb1.g * w1 + rgb2.g * w2);
  const b = Math.round(rgb1.b * w1 + rgb2.b * w2);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

/** High-Energy Supernova Core Glow & Optical Flash Texture */
export const generateSupernovaCoreFlareTexture = (scene: BABYLON.Scene): BABYLON.DynamicTexture => {
  const size = 512;
  const texture = new BABYLON.DynamicTexture("sn_core_flare_tex", size, scene, true, BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  if (!ctx) return texture;

  ctx.clearRect(0, 0, size, size);
  const center = size / 2;

  // Ultra-bright multi-stage radial core with white-hot center and cyan-to-violet corona
  const grad = ctx.createRadialGradient(center, center, 0, center, center, center);
  grad.addColorStop(0.0, "rgba(255, 255, 255, 1.0)");
  grad.addColorStop(0.06, "rgba(255, 255, 255, 0.98)");
  grad.addColorStop(0.14, "rgba(220, 245, 255, 0.85)");
  grad.addColorStop(0.28, "rgba(80, 220, 255, 0.55)");
  grad.addColorStop(0.48, "rgba(180, 70, 255, 0.25)");
  grad.addColorStop(0.70, "rgba(255, 50, 150, 0.08)");
  grad.addColorStop(0.88, "rgba(40, 160, 255, 0.02)");
  grad.addColorStop(1.0, "rgba(0, 0, 0, 0.0)");

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Subtle radial rays / photon spikes radiating from core
  ctx.save();
  ctx.translate(center, center);
  for (let i = 0; i < 24; i++) {
    const angle = (i * Math.PI * 2) / 24;
    const len = center * (0.6 + Math.sin(i * 3.7) * 0.35);
    const rayGrad = ctx.createLinearGradient(0, 0, Math.cos(angle) * len, Math.sin(angle) * len);
    rayGrad.addColorStop(0, "rgba(255, 255, 255, 0.4)");
    rayGrad.addColorStop(0.3, "rgba(100, 230, 255, 0.2)");
    rayGrad.addColorStop(1, "rgba(180, 50, 255, 0.0)");

    ctx.strokeStyle = rayGrad;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.restore();

  // Dither pass to ensure silky gradient with zero 8-bit color banding
  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0) {
      const noise = (Math.random() - 0.5) * 3.0;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
  }
  ctx.putImageData(imgData, 0, 0);

  texture.hasAlpha = true;
  texture.update(true);
  return texture;
};

/** Anamorphic Lens Flare & 4-Point Optical Diffraction Starburst */
export const generateAnamorphicSpikeTexture = (scene: BABYLON.Scene): BABYLON.DynamicTexture => {
  const size = 512;
  const texture = new BABYLON.DynamicTexture("sn_anamorphic_tex", size, scene, true, BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  if (!ctx) return texture;

  ctx.clearRect(0, 0, size, size);
  const center = size / 2;

  // 1. Long horizontal anamorphic glare streak
  const horizGrad = ctx.createLinearGradient(0, center, size, center);
  horizGrad.addColorStop(0.0, "rgba(0, 200, 255, 0.0)");
  horizGrad.addColorStop(0.25, "rgba(100, 220, 255, 0.25)");
  horizGrad.addColorStop(0.45, "rgba(255, 255, 255, 0.90)");
  horizGrad.addColorStop(0.50, "rgba(255, 255, 255, 1.0)");
  horizGrad.addColorStop(0.55, "rgba(255, 255, 255, 0.90)");
  horizGrad.addColorStop(0.75, "rgba(100, 220, 255, 0.25)");
  horizGrad.addColorStop(1.0, "rgba(0, 200, 255, 0.0)");

  ctx.fillStyle = horizGrad;
  ctx.fillRect(0, center - 6, size, 12);

  // 2. Vertical optical spike
  const vertGrad = ctx.createLinearGradient(center, 0, center, size);
  vertGrad.addColorStop(0.0, "rgba(255, 120, 220, 0.0)");
  vertGrad.addColorStop(0.35, "rgba(255, 180, 255, 0.25)");
  vertGrad.addColorStop(0.48, "rgba(255, 255, 255, 0.95)");
  vertGrad.addColorStop(0.50, "rgba(255, 255, 255, 1.0)");
  vertGrad.addColorStop(0.52, "rgba(255, 255, 255, 0.95)");
  vertGrad.addColorStop(0.65, "rgba(255, 180, 255, 0.25)");
  vertGrad.addColorStop(1.0, "rgba(255, 120, 220, 0.0)");

  ctx.fillStyle = vertGrad;
  ctx.fillRect(center - 5, 0, 10, size);

  // 3. Diagonal 45-degree cross diffraction spikes
  ctx.save();
  ctx.translate(center, center);
  ctx.rotate(Math.PI / 4);
  const diagGrad = ctx.createLinearGradient(-size * 0.35, 0, size * 0.35, 0);
  diagGrad.addColorStop(0, "rgba(120, 255, 220, 0.0)");
  diagGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.85)");
  diagGrad.addColorStop(1, "rgba(120, 255, 220, 0.0)");
  ctx.fillStyle = diagGrad;
  ctx.fillRect(-size * 0.35, -2, size * 0.7, 4);

  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = diagGrad;
  ctx.fillRect(-size * 0.35, -2, size * 0.7, 4);
  ctx.restore();

  // 4. Central intense glare hotspot
  const centerGlow = ctx.createRadialGradient(center, center, 0, center, center, 35);
  centerGlow.addColorStop(0.0, "rgba(255, 255, 255, 1.0)");
  centerGlow.addColorStop(0.4, "rgba(200, 240, 255, 0.8)");
  centerGlow.addColorStop(1.0, "rgba(0, 0, 0, 0.0)");
  ctx.fillStyle = centerGlow;
  ctx.beginPath();
  ctx.arc(center, center, 35, 0, Math.PI * 2);
  ctx.fill();

  texture.hasAlpha = true;
  texture.update(true);
  return texture;
};

/** Photonic Relativistic Shockwave Wavefront Ring Texture */
export const generateSupernovaPhotonicRingTexture = (
  primaryColor: string,
  secondaryColor: string,
  scene: BABYLON.Scene
): BABYLON.DynamicTexture => {
  const size = 512;
  const texture = new BABYLON.DynamicTexture("sn_photonic_ring_tex", size, scene, true, BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  if (!ctx) return texture;

  const { r: r1, g: g1, b: b1 } = parseColorToRgb(primaryColor);
  const { r: r2, g: g2, b: b2 } = parseColorToRgb(secondaryColor);

  ctx.clearRect(0, 0, size, size);
  const center = size / 2;

  // Thin, sharp shockwave ring with feathered edges and harmonic ripples
  const innerR = size * 0.30;
  const peakR = size * 0.38;
  const outerR = size * 0.47;

  const grad = ctx.createRadialGradient(center, center, 0, center, center, size * 0.5);
  grad.addColorStop(0.0, "rgba(0, 0, 0, 0.0)");
  grad.addColorStop(innerR / (size * 0.5), "rgba(0, 0, 0, 0.0)");
  grad.addColorStop((innerR + (peakR - innerR) * 0.6) / (size * 0.5), `rgba(${r2}, ${g2}, ${b2}, 0.5)`);
  grad.addColorStop(peakR / (size * 0.5), `rgba(255, 255, 255, 1.0)`);
  grad.addColorStop((peakR + 6) / (size * 0.5), `rgba(${r1}, ${g1}, ${b1}, 0.95)`);
  grad.addColorStop((peakR + 24) / (size * 0.5), `rgba(${r2}, ${g2}, ${b2}, 0.40)`);
  grad.addColorStop(outerR / (size * 0.5), `rgba(${r1}, ${g1}, ${b1}, 0.08)`);
  grad.addColorStop(1.0, "rgba(0, 0, 0, 0.0)");

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  texture.hasAlpha = true;
  texture.update(true);
  return texture;
};
