const fs = require('fs');
let code = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');

// Replace pointSize
const oldPointSize = /pointsMaterial\.setFloat\("pointSize", \(isMobileDevice \? 5\.0 : 8\.0\) \* dpr\);/;
const newPointSize = `pointsMaterial.setFloat("pointSize", (isMobileDevice ? 8.0 : 12.0) * dpr);`;
code = code.replace(oldPointSize, newPointSize);

// Update vertex shader point sizes so they look less pixelated
const oldVertex = /gl_PointSize = pointSize \* 1\.0; \/\/ Tail particles[\s\S]*?gl_PointSize = pointSize \* \(1\.2 \+ fract\(position\.x \* 123\.456\) \* 1\.2\); \/\/ Ambient stars/;
const newVertex = `gl_PointSize = pointSize * 1.5; // Tail particles
        } else if (extraData > 0.5) {
          gl_PointSize = pointSize * 1.5; // Lettering
        } else {
          gl_PointSize = pointSize * (1.5 + fract(position.x * 123.456) * 1.5); // Ambient stars`;
code = code.replace(oldVertex, newVertex);

// Update fragment shader to look much more beautiful, soft, organic
const oldPixel = /float alpha = 0\.0;[\s\S]*?vec3 finalColor = vColor\.rgb \* alpha;/;
const newPixel = `float alpha = 0.0;
        
        // Soft gaussian-like falloff for anti-aliasing
        float gaussian = exp(-dist * dist * 12.0);
        
        if (vExtra > 1.5) {
          // Tail particles - soft, slightly elongated
          alpha = gaussian * 0.4;
        } else if (vExtra > 0.5) {
          // Lettering - very clean, crisp core with soft edge to prevent pixelation
          alpha = smoothstep(0.45, 0.1, dist) * 0.9;
        } else {
          // Ambient stars - organic bokeh-like core with subtle cross
          float crossX = smoothstep(0.5, 0.0, abs(coord.x)) * exp(-abs(coord.y) * 20.0);
          float crossY = smoothstep(0.5, 0.0, abs(coord.y)) * exp(-abs(coord.x) * 20.0);
          float starCore = gaussian * 0.7;
          
          float twinkle = 0.7 + 0.3 * sin(vPos.x * 12.0 + vPos.y * 12.0);
          
          alpha = (starCore + crossX * 0.5 + crossY * 0.5) * twinkle;
        }
        
        // Final color mix
        vec3 finalColor = vColor.rgb * alpha;`;
code = code.replace(oldPixel, newPixel);

fs.writeFileSync('src/components/ParticleCanvas.tsx', code);
console.log("Particles updated");
