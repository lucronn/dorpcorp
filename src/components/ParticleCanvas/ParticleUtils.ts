import { Particle, projects } from "../../types";

/**
 * Expands a 10-bit integer into 30 bits by inserting 2 zeros between each bit
 * for 3D Morton code (Z-order curve) spatial indexing.
 */
export const expandBits10 = (v: number): number => {
  let x = Math.max(0, Math.min(1023, Math.floor(v))) & 0x000003ff;
  x = (x | (x << 16)) & 0x030000ff;
  x = (x | (x << 8)) & 0x0300f00f;
  x = (x | (x << 4)) & 0x030c30c3;
  x = (x | (x << 2)) & 0x09249249;
  return x >>> 0;
};

/**
 * Computes a 30-bit 3D Morton code (Z-order curve) for normalized coordinates in [0, 1].
 */
export const encodeMorton3D = (nx: number, ny: number, nz: number = 0.5): number => {
  const sx = isFinite(nx) ? Math.max(0, Math.min(1, nx)) : 0.5;
  const sy = isFinite(ny) ? Math.max(0, Math.min(1, ny)) : 0.5;
  const sz = isFinite(nz) ? Math.max(0, Math.min(1, nz)) : 0.5;
  const ix = Math.floor(sx * 1023);
  const iy = Math.floor(sy * 1023);
  const iz = Math.floor(sz * 1023);
  return ((expandBits10(ix) | (expandBits10(iy) << 1) | (expandBits10(iz) << 2)) >>> 0);
};

/**
 * Deterministic Mulberry32 PRNG for seeded spatial permutations.
 */
export const createSeededRng = (seed: number): (() => number) => {
  let a = (Math.floor(isFinite(seed) ? seed : 1337) ^ 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Deterministic seeded Fisher-Yates permutation in-place.
 */
export const seededFisherYatesShuffle = <T>(arr: T[], seed: number = 42): T[] => {
  if (!Array.isArray(arr) || arr.length <= 1) return arr;
  const rng = createSeededRng(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
};

/**
 * Decouples buffer index order from sequential scanline / glyph spatial order:
 * 1. Computes a jittered 3D Morton code (Z-order curve) for each target point.
 * 2. Stratifies points along the Z-order curve into interleaved buckets.
 * 3. Applies a seeded Fisher-Yates permutation so adjacent buffer indices
 *    map to spatially dispersed coordinates across the entire formation.
 */
export const stratifyTargetsByMorton = <T extends { x: number; y: number; z?: number }>(
  coords: T[],
  width: number,
  height: number,
  seed: number = 1337
): T[] => {
  if (!Array.isArray(coords) || coords.length <= 1) return coords;
  const safeW = isFinite(width) && width > 0 ? width : 1920;
  const safeH = isFinite(height) && height > 0 ? height : 1080;
  const rng = createSeededRng(seed);

  const keyed = coords.map((pt, idx) => {
    const jx = (rng() - 0.5) * 0.04;
    const jy = (rng() - 0.5) * 0.04;
    const jz = (rng() - 0.5) * 0.04;
    const nx = pt.x / safeW + jx;
    const ny = pt.y / safeH + jy;
    const nz = ((pt.z ?? 0) + 500) / 1000 + jz;
    const morton = encodeMorton3D(nx, ny, nz);
    return { pt, morton, idx };
  });

  // Sort along Z-order space-filling curve first
  keyed.sort((a, b) => a.morton - b.morton || a.idx - b.idx);

  // Interleave Z-order strata (stride permutation across 16 strata) before seeded Fisher-Yates
  const n = keyed.length;
  const stride = Math.min(16, Math.max(1, Math.floor(Math.sqrt(n))));
  const stratified: T[] = new Array(n);
  let writeIdx = 0;
  for (let offset = 0; offset < stride; offset++) {
    for (let k = offset; k < n; k += stride) {
      stratified[writeIdx++] = keyed[k]!.pt;
    }
  }

  return seededFisherYatesShuffle(stratified, seed ^ 0x5bf03635);
};

export const drawStageLayoutTemplate = (
  ctx: CanvasRenderingContext2D,
  index: number,
  width: number,
  height: number,
  mode: "full" | "tracer",
  opacity: number = 1.0,
) => {
  if (!ctx || !isFinite(width) || !isFinite(height) || width <= 0 || height <= 0) return;

  const isTracer = mode === "tracer";
  if (isTracer) return; // Hide all faint background vectors/text so only particles are seen

  // Theme Palette Colors
  const colorLight = "#ffffff";

  ctx.fillStyle = colorLight;
  ctx.strokeStyle = colorLight;

  if (index === 0) {
    let fontSize = Math.min(width * 0.12, 140);
    ctx.textAlign = "center";

    ctx.strokeStyle = "#4deeea"; // Electric cyan outline for sharp definition and contrast
    ctx.fillStyle = "#4deeea"; // Deep, dark glowing cosmic indigo-violet center
    ctx.lineWidth = width < 768 ? 5 : 10; // Thick stroke to ensure outline is well defined
    ctx.font = `800 ${fontSize}px "Inter", sans-serif`;
    (ctx as any).letterSpacing = width < 768 ? "6px" : "16px";

    ctx.strokeText("CURTIS CLICK", width / 2, height / 2);
    ctx.fillText("CURTIS CLICK", width / 2, height / 2);
    (ctx as any).letterSpacing = "0px";
  } else if (index === 1) {
    const maxW = 1200;
    const mx = Math.max(0, (width - maxW) / 2);
    const pxLayout = width < 768 ? 24 : width < 1024 ? 48 : 64;
    const headerX = mx + pxLayout;
    const headerY = height / 2 - 40;

    ctx.font = `800 ${Math.max(16, width * 0.018)}px "JetBrains Mono", monospace`;
    ctx.strokeStyle = "#f25f35"; // Vibrant neon orange/rust outline
    ctx.fillStyle = "#f25f35"; // Deep, dark glowing rich burgundy/crimson center
    ctx.lineWidth = 3;
    ctx.textAlign = "left";
    (ctx as any).letterSpacing = "4px";
    ctx.strokeText("01 // SELECTED WORKS", headerX, headerY - 60);
    ctx.fillText("01 // SELECTED WORKS", headerX, headerY - 60);

    ctx.strokeStyle = "#f25f35"; // Vibrant neon orange/rust outline
    ctx.fillStyle = "#f25f35"; // Deep, dark glowing rich burgundy/crimson center
    ctx.lineWidth = width < 768 ? 4 : 8;
    ctx.font = `900 ${Math.min(width * 0.07, 72)}px "Inter", sans-serif`;
    (ctx as any).letterSpacing = "2px";

    ctx.strokeText("ENGINEERED EXPERIENCES", headerX, headerY);
    ctx.strokeText(
      "FOR THE MODERN WEB.",
      headerX,
      headerY + Math.min(width * 0.08, 84),
    );

    ctx.fillText("ENGINEERED EXPERIENCES", headerX, headerY);
    ctx.fillText(
      "FOR THE MODERN WEB.",
      headerX,
      headerY + Math.min(width * 0.08, 84),
    );
    (ctx as any).letterSpacing = "0px";
  } else if (index >= 2 && index <= 5) {
    const pIndex = index - 2;
    const p = projects[pIndex];
    if (!p) return;
    const isMobile = width < 640;

    const containerPad = isMobile ? 24 : 48;
    const hudMaxW = Math.min(1100, width - containerPad * 2);
    const hudX = width / 2;
    const descMaxW = hudMaxW;

    const titleFontSize = isMobile
      ? Math.min(54, height * 0.08)
      : width < 1024
        ? 90
        : 130;

    let appliedTitleFontSize = titleFontSize;
    ctx.font = `bold ${appliedTitleFontSize}px "Playfair Display", Georgia, serif`;
    (ctx as any).letterSpacing = "-0.02em";
    while (
      ctx.measureText(p.title).width > descMaxW &&
      appliedTitleFontSize > 30
    ) {
      appliedTitleFontSize -= 2;
      ctx.font = `bold ${appliedTitleFontSize}px "Playfair Display", Georgia, serif`;
    }
    (ctx as any).letterSpacing = "0px";

    ctx.textAlign = "center";
    ctx.strokeStyle = "#ffd778"; // Glowing gold outline
    ctx.fillStyle = "#ffd778"; // Deep, dark glowing stellar midnight-indigo center
    ctx.lineWidth = width < 768 ? 5 : 10;
    ctx.strokeText(p.title, hudX, height / 2 - 30);
    ctx.fillText(p.title, hudX, height / 2 - 30);

    const catFontSize = Math.min(20, Math.max(11, width * 0.015));
    ctx.font = `bold ${catFontSize}px "JetBrains Mono", monospace`;
    ctx.strokeStyle = "#ffd778"; // Glowing gold outline
    ctx.fillStyle = "#ffd778"; // Deep, dark glowing stellar midnight-indigo center
    ctx.lineWidth = 4;
    (ctx as any).letterSpacing = "8px";
    ctx.strokeText(p.category, hudX, height / 2 - 130);
    ctx.fillText(p.category, hudX, height / 2 - 130);
    (ctx as any).letterSpacing = "0px";

    ctx.strokeStyle = `rgba(242, 95, 53, ${0.4})`;
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(hudX - hudMaxW / 2, height / 2 - 95);
    ctx.lineTo(hudX + hudMaxW / 2, height / 2 - 95);
    ctx.stroke();

    ctx.font = `600 ${Math.min(14, Math.max(10, width * 0.012))}px "JetBrains Mono", monospace`;
    ctx.strokeStyle = "#4deeea"; // Electric cyan outline for sharp definition
    ctx.fillStyle = "#4deeea"; // Deep, dark glowing cosmic indigo-violet center
    ctx.lineWidth = 4;
    ctx.strokeText(
      "CURTIS CLICK // MULTI-MODAL PORTFOLIO",
      hudX,
      height / 2 + 150,
    );
    ctx.fillText(
      "CURTIS CLICK // MULTI-MODAL PORTFOLIO",
      hudX,
      height / 2 + 150,
    );
  }
};

export const particleText = (
  text: string,
  size: number,
  depth: number,
  densityMultiplier: number,
  glow: number,
  x: number,
  y: number,
  color: string,
  width: number,
  height: number,
  fontFamily: string = '"Inter", sans-serif',
  fontWeight: string = '800',
  align: CanvasTextAlign = 'center',
  letterSpacing: string = '0px',
  lineWidthMultiplier: number = 0.05
): { x: number; y: number; color: string, isProjectText: boolean }[] => {
  if (typeof document === "undefined" || !isFinite(width) || !isFinite(height) || width <= 0 || height <= 0 || !isFinite(size) || size <= 0) return [];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];

  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = size * lineWidthMultiplier;
  ctx.font = `${fontWeight} ${size}px ${fontFamily}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  (ctx as any).letterSpacing = letterSpacing;

  const lines = text.split('\n');
  lines.forEach((line, i) => {
    ctx.strokeText(line, x, y + (i * size * 1.2));
    ctx.fillText(line, x, y + (i * size * 1.2));
  });

  const tData = ctx.getImageData(0, 0, width, height).data;
  const coords: { x: number; y: number; color: string, isProjectText: boolean }[] = [];

  const userAgentStr = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isMobileDevice = /iPad|iPhone|iPod|Android/i.test(userAgentStr) || width < 768;
  const totalPixels = width * height;

  let baseDensity = isMobileDevice ? 2 : 1;
  if (totalPixels > 2500000) baseDensity = isMobileDevice ? 2 : 1;
  if (totalPixels > 5000000) baseDensity = isMobileDevice ? 3 : 2;

  const step = Math.max(1, Math.round(baseDensity / densityMultiplier));
  const searchDist = Math.max(2, step);
  const rng = createSeededRng(text.length * 4099 + Math.floor(x + y));

  for (let py = 0; py < height; py += step) {
    for (let px = 0; px < width; px += step) {
      const idx = (py * width + px) * 4;
      const alpha = tData[idx + 3];
      if (alpha > 80) {
        let isEdge = false;
        for (let dy = -searchDist; dy <= searchDist; dy++) {
          for (let dx = -searchDist; dx <= searchDist; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = px + dx;
            const ny = py + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nIdx = (ny * width + nx) * 4;
              if (tData[nIdx + 3] < 80) {
                isEdge = true;
                break;
              }
            } else {
              isEdge = true;
            }
          }
          if (isEdge) break;
        }

        let r = tData[idx];
        let g = tData[idx + 1];
        let b = tData[idx + 2];

        if (isEdge) {
          r = Math.min(255, r + 40 * depth);
          g = Math.min(255, g + 60 * depth);
          b = Math.min(255, b + 90 * depth);
        } else {
          if (rng() > 0.05 * (1 + depth)) continue;
          r = Math.floor(r * 0.3);
          g = Math.floor(g * 0.3);
          b = Math.floor(b * 0.3);
        }

        r = Math.min(255, r * glow);
        g = Math.min(255, g * glow);
        b = Math.min(255, b * glow);

        coords.push({
          x: px,
          y: py,
          color: `rgb(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)})`,
          isProjectText: true,
        });
      }
    }
  }
  return coords;
};

export const generateTargetsForStage = (
  index: number,
  width: number,
  height: number,
): { x: number; y: number; color: string, isProjectText: boolean }[] => {
  if (typeof document === "undefined" || !isFinite(width) || !isFinite(height) || width <= 0 || height <= 0) return [];

  let coords: { x: number; y: number; color: string, isProjectText: boolean }[] = [];

  if (index === 0) {
    let fontSize = Math.min(width * 0.12, 140);
    const ls = width < 768 ? "6px" : "16px";
    coords = particleText("CURTIS CLICK", fontSize, 1.0, 1.0, 0.6, width / 2, height / 2, "#4deeea", width, height, '"Inter", sans-serif', "800", "center", ls);
  } else if (index === 1) {
    const maxW = 1200;
    const mx = Math.max(0, (width - maxW) / 2);
    const pxLayout = width < 768 ? 24 : width < 1024 ? 48 : 64;
    const headerX = mx + pxLayout;
    const headerY = height / 2 - 40;
    
    const smallFontSize = Math.max(16, width * 0.018);
    const p1 = particleText("01 // SELECTED WORKS", smallFontSize, 1.0, 1.0, 0.6, headerX, headerY - 60, "#f25f35", width, height, '"JetBrains Mono", monospace', "800", "left", "4px", 0.05);
    
    const bigFontSize = Math.min(width * 0.07, 72);
    const p2 = particleText("ENGINEERED EXPERIENCES\nFOR THE MODERN WEB.", bigFontSize, 1.0, 1.0, 0.6, headerX, headerY, "#f25f35", width, height, '"Inter", sans-serif', "900", "left", "2px", width < 768 ? 0.06 : 0.11);
    
    coords = [...p1, ...p2];
  } else if (index >= 2 && index <= 5) {
    const pIndex = index - 2;
    const p = projects[pIndex];
    if (!p) return [];
    const isMobile = width < 640;
    const containerPad = isMobile ? 24 : 48;
    const hudMaxW = Math.min(1100, width - containerPad * 2);
    const hudX = width / 2;
    const descMaxW = hudMaxW;
    const titleFontSize = isMobile
      ? Math.min(54, height * 0.08)
      : width < 1024
        ? 90
        : 130;
    
    const measureCanvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
    const mctx = measureCanvas ? measureCanvas.getContext("2d") : null;
    let appliedTitleFontSize = titleFontSize;
    if (mctx) {
      mctx.font = `bold ${appliedTitleFontSize}px "Playfair Display", Georgia, serif`;
      (mctx as any).letterSpacing = "-0.02em";
      while (
        mctx.measureText(p.title).width > descMaxW &&
        appliedTitleFontSize > 30
      ) {
        appliedTitleFontSize -= 2;
        mctx.font = `bold ${appliedTitleFontSize}px "Playfair Display", Georgia, serif`;
      }
    }

    const p1 = particleText(p.title, appliedTitleFontSize, 1.0, 1.0, 0.6, hudX, height / 2 - 30, "#ffd778", width, height, '"Playfair Display", Georgia, serif', "bold", "center", "-0.02em");
    
    const catFontSize = Math.min(20, Math.max(11, width * 0.015));
    const p2 = particleText(p.category, catFontSize, 1.0, 1.0, 0.6, hudX, height / 2 - 130, "#ffd778", width, height, '"JetBrains Mono", monospace', "bold", "center", "8px");
    
    const p3: {x:number,y:number,color:string, isProjectText: boolean}[] = [];
    const lineY = height / 2 - 95;
    const lineStartX = hudX - hudMaxW / 2;
    const lineEndX = hudX + hudMaxW / 2;
    const density = width < 768 ? 4 : 2;
    const lineRng = createSeededRng((index + 1) * 1999);
    for (let lx = lineStartX; lx <= lineEndX; lx += density) {
      if (lineRng() < 0.3) continue;
      p3.push({ x: lx, y: lineY, color: "rgb(242,95,53)", isProjectText: true });
    }

    const p4FontSize = Math.min(14, Math.max(10, width * 0.012));
    const p4 = particleText("CURTIS CLICK // MULTI-MODAL PORTFOLIO", p4FontSize, 1.0, 1.0, 0.6, hudX, height / 2 + 150, "#4deeea", width, height, '"JetBrains Mono", monospace', "600", "center", "0px");

    coords = [...p1, ...p2, ...p3, ...p4];
  }

  // Stratify and permute target coordinates using 3D Morton code (Z-order curve) + seeded Fisher-Yates
  return stratifyTargetsByMorton(coords, width, height, (index + 1) * 7919);
};
