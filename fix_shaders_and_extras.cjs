const fs = require('fs');
let code = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');

code = code.replace(
  /          colors\[i \* 4 \+ 3\] = 1\.0;\n          continue;/g,
  '          colors[i * 4 + 3] = 1.0;\n          extras[i] = 0.0;\n          continue;'
);

const oldVertexShader = /BABYLON\.Effect\.ShadersStore\["customParticleVertexShader"\] = `[\s\S]*?    `;/;
const newVertexShader = `BABYLON.Effect.ShadersStore["customParticleVertexShader"] = \`
      precision highp float;
      attribute vec3 position;
      attribute vec4 color;
      attribute float extraData;
      uniform mat4 worldViewProjection;
      uniform float pointSize;
      varying vec4 vColor;
      varying float vExtra;
      void main(void) {
        gl_Position = worldViewProjection * vec4(position, 1.0);
        if (extraData > 1.5) {
          gl_PointSize = pointSize * 0.4; // Tail particles (very small)
        } else if (extraData > 0.5) {
          gl_PointSize = pointSize * 0.7; // Lettering (medium)
        } else {
          gl_PointSize = pointSize * 0.5; // Ambient stars (small)
        }
        vColor = color;
        vExtra = extraData;
      }
    \`;`;
code = code.replace(oldVertexShader, newVertexShader);

const oldFragmentShader = /BABYLON\.Effect\.ShadersStore\["customParticlePixelShader"\] = `[\s\S]*?    `;/;
const newFragmentShader = `BABYLON.Effect.ShadersStore["customParticlePixelShader"] = \`
      precision highp float;
      varying vec4 vColor;
      varying float vExtra;
      void main(void) {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord);
        if (dist > 0.5) discard;
        
        float alpha = 0.0;
        if (vExtra > 1.5) {
          // Tail particles: very soft and dim
          alpha = smoothstep(0.5, 0.1, dist) * 0.3;
        } else if (vExtra > 0.5) {
          // Lettering: softer glow, less overwhelming
          alpha = smoothstep(0.5, 0.2, dist) * 0.5;
          float core = smoothstep(0.2, 0.0, dist);
          alpha += core * 0.9;
        } else {
          // Ambient stars: dim, less flashy
          alpha = smoothstep(0.5, 0.2, dist) * 0.4;
          float core = smoothstep(0.1, 0.0, dist);
          alpha += core * 0.8;
        }
        vec3 finalColor = vColor.rgb * vColor.a * alpha;
        gl_FragColor = vec4(finalColor, 1.0);
      }
    \`;`;
code = code.replace(oldFragmentShader, newFragmentShader);

fs.writeFileSync('src/components/ParticleCanvas.tsx', code);
console.log("Fixed shaders and extras array");
