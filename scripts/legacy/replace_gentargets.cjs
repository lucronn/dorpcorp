const fs = require('fs');
let code = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');

const oldFuncRegex = /const generateTargetsForStage = \([\s\S]*?\n\};\n\ninterface CelestialEntity/m;

const newFunc = `const generateTargetsForStage = (
  index: number,
  width: number,
  height: number,
): { x: number; y: number; color: string }[] => {
  if (width <= 0 || height <= 0) return [];

  const particleText = (
    text: string,
    size: number,
    depth: number,
    densityMultiplier: number,
    glow: number,
    x: number,
    y: number,
    color: string,
    fontFamily: string = '"Inter", sans-serif',
    fontWeight: string = '800',
    align: CanvasTextAlign = 'center',
    letterSpacing: string = '0px',
    lineWidthMultiplier: number = 0.05
  ) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return [];

    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = size * lineWidthMultiplier;
    ctx.font = \`\${fontWeight} \${size}px \${fontFamily}\`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    (ctx as any).letterSpacing = letterSpacing;

    const lines = text.split('\\n');
    lines.forEach((line, i) => {
      ctx.strokeText(line, x, y + (i * size * 1.2));
      ctx.fillText(line, x, y + (i * size * 1.2));
    });

    const tData = ctx.getImageData(0, 0, width, height).data;
    const coords: { x: number; y: number; color: string }[] = [];

    const isMobileDevice = /iPad|iPhone|iPod|Android/i.test(navigator.userAgent) || width < 768;
    const totalPixels = width * height;

    let baseDensity = isMobileDevice ? 2 : 1;
    if (totalPixels > 2500000) baseDensity = isMobileDevice ? 2 : 1;
    if (totalPixels > 5000000) baseDensity = isMobileDevice ? 3 : 2;

    const step = Math.max(1, Math.round(baseDensity / densityMultiplier));
    const searchDist = Math.max(2, step);

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
            // Keep less interior particles for higher depth, maybe?
            // "depth" can just be used to control the contrast / 3D feel.
            if (Math.random() > 0.05 * (1 + depth)) continue; 
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
            color: \`rgb(\${Math.floor(r)},\${Math.floor(g)},\${Math.floor(b)})\`,
          });
        }
      }
    }
    return coords;
  };

  let coords: { x: number; y: number; color: string }[] = [];

  if (index === 0) {
    let fontSize = Math.min(width * 0.12, 140);
    const ls = width < 768 ? "6px" : "16px";
    coords = particleText("CURTIS CLICK", fontSize, 1.0, 1.0, 1.0, width / 2, height / 2, "#4deeea", '"Inter", sans-serif', "800", "center", ls);
  } else if (index === 1) {
    const maxW = 1200;
    const mx = Math.max(0, (width - maxW) / 2);
    const pxLayout = width < 768 ? 24 : width < 1024 ? 48 : 64;
    const headerX = mx + pxLayout;
    const headerY = height / 2 - 40;
    
    const smallFontSize = Math.max(16, width * 0.018);
    const p1 = particleText("01 // SELECTED WORKS", smallFontSize, 1.0, 1.0, 1.0, headerX, headerY - 60, "#f25f35", '"JetBrains Mono", monospace', "800", "left", "4px", 0.05);
    
    const bigFontSize = Math.min(width * 0.07, 72);
    const p2 = particleText("ENGINEERED EXPERIENCES\\nFOR THE MODERN WEB.", bigFontSize, 1.0, 1.0, 1.0, headerX, headerY, "#f25f35", '"Inter", sans-serif', "900", "left", "2px", width < 768 ? 0.06 : 0.11);
    
    coords = [...p1, ...p2];
  } else if (index >= 2 && index <= 5) {
    const projects = [
      { title: "SERENE" },
      { title: "AI STUDIO BUILD" },
      { title: "NEBULA DASH" },
      { title: "VOID CHAT" },
    ];
    // Need to get the actual project title from the state or define it here. 
    // Wait! projects is defined globally above this!
    
`;
