const fs = require('fs');
let code = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');

code = code.replace(
    /const colors = new Float32Array\(totalCount \* 4\);/,
    'const colors = new Float32Array(totalCount * 4);\n    const extras = new Float32Array(totalCount);'
);

code = code.replace(
    /pointsMesh\.setVerticesData\(BABYLON\.VertexBuffer\.ColorKind, colors, true, 4\);/,
    'pointsMesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors, true, 4);\n    pointsMesh.setVerticesData("extraData", extras, true, 1);'
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
        if (extraData > 0.5) {
          gl_PointSize = pointSize * 0.7; // Softer, smaller lettering
        } else {
          gl_PointSize = pointSize; // Ambient stars keep original size
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
        if (vExtra > 0.5) {
          // Lettering: softer glow, less overwhelming
          alpha = smoothstep(0.5, 0.2, dist) * 0.5;
          float core = smoothstep(0.2, 0.0, dist);
          alpha += core * 0.9;
        } else {
          // Ambient stars: standard glow
          alpha = smoothstep(0.5, 0.1, dist);
        }
        vec3 finalColor = vColor.rgb * vColor.a * alpha;
        gl_FragColor = vec4(finalColor, 1.0);
      }
    \`;`;
code = code.replace(oldFragmentShader, newFragmentShader);

code = code.replace(
    /attributes: \["position", "color"\],/,
    'attributes: ["position", "color", "extraData"],'
);

// Now in the render loop, update extras array
// Find: colors[i * 4 + 3] = globalAlpha; \n      }
// Replace with updating extras[i] = (!p.isCosmicAmbient && !p.isTail) ? 1.0 : 0.0;
const targetRenderLoopEnd = /        colors\[i \* 4 \+ 2\] = \(b \/ 255\) \* globalAlpha \* bFactor \* particleBrightness;\n        colors\[i \* 4 \+ 3\] = globalAlpha;\n      \}/;
const newRenderLoopEnd = `        colors[i * 4 + 2] = (b / 255) * globalAlpha * bFactor * particleBrightness;
        colors[i * 4 + 3] = globalAlpha;
        extras[i] = (!p.isCosmicAmbient && !p.isTail) ? 1.0 : 0.0;
      }`;
code = code.replace(targetRenderLoopEnd, newRenderLoopEnd);

// Find: pointsMeshRef.current.updateVerticesData(BABYLON.VertexBuffer.ColorKind, colors);
// Add updating extraData
code = code.replace(
    /pointsMeshRef\.current\.updateVerticesData\(BABYLON\.VertexBuffer\.ColorKind, colors\);/,
    'pointsMeshRef.current.updateVerticesData(BABYLON.VertexBuffer.ColorKind, colors);\n        pointsMeshRef.current.updateVerticesData("extraData", extras);'
);

fs.writeFileSync('src/components/ParticleCanvas.tsx', code);
console.log("Added extraData attribute");
