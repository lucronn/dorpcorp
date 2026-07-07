const fs = require('fs');
let code = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');

const targetShaderRegex = /float alpha = smoothstep\(0\.5, 0\.1, dist\);\n        \/\/ Add a core brightness\n        float core = smoothstep\(0\.2, 0\.0, dist\);\n        vec3 finalColor = vColor\.rgb \* vColor\.a \* \(alpha \+ core \* 1\.5\);\n        gl_FragColor = vec4\(finalColor, 1\.0\);/g;

const newShader = `float alpha = smoothstep(0.5, 0.1, dist);
        vec3 finalColor = vColor.rgb * vColor.a * alpha;
        gl_FragColor = vec4(finalColor, 1.0);`;

code = code.replace(targetShaderRegex, newShader);
code = code.replace(/pointsMaterial\.setFloat\("pointSize", \(isMobileDevice \? 3\.0 : 4\.5\) \* dpr\);/, 'pointsMaterial.setFloat("pointSize", (isMobileDevice ? 1.5 : 2.5) * dpr);');

fs.writeFileSync('src/components/ParticleCanvas.tsx', code);
console.log("Reduced glow and size");
