const fs = require('fs');
let code = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');

// Replace vertex shader
const oldVertex = /BABYLON\.Effect\.ShadersStore\["customParticleVertexShader"\] = `[\s\S]*?    `;/;
const newVertex = `BABYLON.Effect.ShadersStore["customParticleVertexShader"] = \`
      precision highp float;
      attribute vec3 position;
      attribute vec4 color;
      attribute float extraData;
      uniform mat4 worldViewProjection;
      uniform float pointSize;
      varying vec4 vColor;
      varying float vExtra;
      varying vec3 vPos;
      void main(void) {
        gl_Position = worldViewProjection * vec4(position, 1.0);
        if (extraData > 1.5) {
          gl_PointSize = pointSize * 1.0; // Tail particles
        } else if (extraData > 0.5) {
          gl_PointSize = pointSize * 1.5; // Lettering
        } else {
          gl_PointSize = pointSize * (1.2 + fract(position.x * 123.456) * 1.2); // Ambient stars
        }
        vColor = color;
        vExtra = extraData;
        vPos = position;
      }
    \`;`;
code = code.replace(oldVertex, newVertex);

// Replace fragment shader
const oldFragment = /BABYLON\.Effect\.ShadersStore\["customParticlePixelShader"\] = `[\s\S]*?    `;/;
const newFragment = `BABYLON.Effect.ShadersStore["customParticlePixelShader"] = \`
      precision highp float;
      varying vec4 vColor;
      varying float vExtra;
      varying vec3 vPos;
      void main(void) {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord);
        if (dist > 0.5) discard;
        
        float alpha = 0.0;
        if (vExtra > 1.5) {
          // Tail particles
          alpha = smoothstep(0.5, 0.0, dist) * 0.25;
        } else if (vExtra > 0.5) {
          // Lettering - soft orb
          float core = smoothstep(0.2, 0.0, dist) * 0.7;
          float halo = smoothstep(0.5, 0.2, dist) * 0.3;
          alpha = core + halo;
        } else {
          // Ambient stars - cross flare
          float crossX = smoothstep(0.5, 0.0, abs(coord.x)) * smoothstep(0.08, 0.0, abs(coord.y));
          float crossY = smoothstep(0.5, 0.0, abs(coord.y)) * smoothstep(0.08, 0.0, abs(coord.x));
          float starCore = smoothstep(0.3, 0.0, dist) * 0.4;
          
          float twinkle = 0.8 + 0.2 * sin(vPos.x * 10.0 + vPos.y * 10.0); // very basic pseudo-twinkle
          
          alpha = (starCore + crossX * 0.4 + crossY * 0.4) * twinkle;
        }
        
        vec3 finalColor = vColor.rgb * alpha;
        gl_FragColor = vec4(finalColor, 1.0);
      }
    \`;`;
code = code.replace(oldFragment, newFragment);

// Replace pointSize
const oldPointSize = /pointsMaterial\.setFloat\("pointSize", \(isMobileDevice \? 2\.5 : 4\.0\) \* dpr\);/;
const newPointSize = `pointsMaterial.setFloat("pointSize", (isMobileDevice ? 5.0 : 8.0) * dpr);`;
code = code.replace(oldPointSize, newPointSize);

fs.writeFileSync('src/components/ParticleCanvas.tsx', code);
console.log("Shaders updated");
