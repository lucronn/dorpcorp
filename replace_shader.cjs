const fs = require('fs');
let code = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');

const oldShader = /    BABYLON\.Effect\.ShadersStore\["customParticlePixelShader"\] = `[\s\S]*?    `;/;

const newShader = `    BABYLON.Effect.ShadersStore["customParticlePixelShader"] = \`
      precision highp float;
      varying vec4 vColor;
      void main(void) {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord);
        if (dist > 0.5) discard;
        // Soft edge
        float alpha = smoothstep(0.5, 0.1, dist);
        // Add a core brightness
        float core = smoothstep(0.2, 0.0, dist);
        vec3 finalColor = vColor.rgb * vColor.a * (alpha + core * 1.5);
        gl_FragColor = vec4(finalColor, 1.0);
      }
    \`;`;

code = code.replace(oldShader, newShader);
code = code.replace(/pointsMaterial\.setFloat\("pointSize", \(isMobileDevice \? 2\.0 : 3\.0\) \* dpr\);/, 'pointsMaterial.setFloat("pointSize", (isMobileDevice ? 3.0 : 4.5) * dpr);');

fs.writeFileSync('src/components/ParticleCanvas.tsx', code);
console.log("Replaced shader");
