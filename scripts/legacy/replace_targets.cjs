const fs = require('fs');
let code = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');

const targetFuncRegex = /const generateTargetsForStage = \([\s\S]*?\} \}\n  \}\n\n  return coords;\n\};/;
const match = code.match(targetFuncRegex);
if (!match) {
    console.error("Could not find generateTargetsForStage");
    process.exit(1);
}

const newFunc = `const generateTargetsForStage = (
  index: number,
  width: number,
  height: number,
): { x: number; y: number; color: string }[] => {
  if (width <= 0 || height <= 0) return [];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const coords: { x: number; y: number; color: string }[] = [];
  if (!ctx) return coords;

  drawStageLayoutTemplate(ctx, index, width, height, "full");

  const tData = ctx.getImageData(0, 0, width, height).data;

  const totalPixels = width * height;
  const isMobileDevice =
    /iPad|iPhone|iPod|Android/i.test(navigator.userAgent) || width < 768;
  let density = isMobileDevice ? 2 : 1;
  if (totalPixels > 2500000) density = isMobileDevice ? 3 : 2;
  if (totalPixels > 5000000) density = isMobileDevice ? 4 : 3;

  const searchDist = Math.max(2, density);

  for (let y = 0; y < height; y += density) {
    for (let x = 0; x < width; x += density) {
      const idx = (y * width + x) * 4;
      const alpha = tData[idx + 3];
      if (alpha > 80) {
        let isEdge = false;
        
        // Edge detection
        for (let dy = -searchDist; dy <= searchDist; dy++) {
          for (let dx = -searchDist; dx <= searchDist; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
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
          // Bright contrasting color for edges to make them pop
          // We can use a bright white/cyan or we can just boost the color to max brightness
          r = Math.min(255, r + 150);
          g = Math.min(255, g + 150);
          b = Math.min(255, b + 150);
        } else {
          // Darken the interior significantly so the edges stand out
          r = Math.floor(r * 0.15);
          g = Math.floor(g * 0.15);
          b = Math.floor(b * 0.15);
        }

        coords.push({
          x,
          y,
          color: \`rgb(\${r},\${g},\${b})\`,
        });
      }
    }
  }

  return coords;
};`;

code = code.replace(targetFuncRegex, newFunc);
fs.writeFileSync('src/components/ParticleCanvas.tsx', code);
console.log("Replaced generateTargetsForStage");
