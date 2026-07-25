const fs = require('fs');
const file = 'src/components/ParticleCanvas.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `    BABYLON.Effect.ShadersStore["wormholePixelShader"] = \`
      precision highp float;
      varying vec2 vUV;
      uniform sampler2D textureSampler;
      uniform float time;
      uniform float intensity;
      void main(void) {
          vec2 uv = vUV;
          vec4 baseColor = texture2D(textureSampler, uv);
          if (intensity <= 0.0) {
              gl_FragColor = baseColor;
              return;
          }
          
          vec2 dir = vec2(0.5) - uv;
          float dist = length(dir);
          if (dist > 0.0001) {
              dir = dir / dist;
          } else {
              dir = vec2(0.0);
          }
          
          // Smoothly building radial blur
          float blurAmount = min(time * 0.015, 0.04) * intensity;
          
          vec4 sum = vec4(0.0);
          sum += texture2D(textureSampler, uv + dir * 0.0 * blurAmount);
          sum += texture2D(textureSampler, uv + dir * 0.1 * blurAmount);
          sum += texture2D(textureSampler, uv + dir * 0.2 * blurAmount);
          sum += texture2D(textureSampler, uv + dir * 0.3 * blurAmount);
          sum += texture2D(textureSampler, uv + dir * 0.4 * blurAmount);
          sum += texture2D(textureSampler, uv + dir * 0.5 * blurAmount);
          sum += texture2D(textureSampler, uv + dir * 0.6 * blurAmount);
          sum += texture2D(textureSampler, uv + dir * 0.7 * blurAmount);
          sum += texture2D(textureSampler, uv + dir * 0.8 * blurAmount);
          sum += texture2D(textureSampler, uv + dir * 0.9 * blurAmount);
          sum /= 10.0;
          
          // Subtle, elegant chromatic aberration
          float ca = blurAmount * 0.35;
          sum.r = texture2D(textureSampler, uv + dir * ca).r;
          sum.b = texture2D(textureSampler, uv - dir * ca).b;
          gl_FragColor = mix(baseColor, sum, intensity);
      }
    \`;`;

const replacement = `    BABYLON.Effect.ShadersStore["wormholePixelShader"] = \`
      precision highp float;
      varying vec2 vUV;
      uniform sampler2D textureSampler;
      uniform float time;
      uniform float intensity;
      
      // Noise function for relativistic distortion
      float hash(float n) { return fract(sin(n) * 1e4); }
      float hash(vec2 p) { return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); }
      float noise(vec2 x) {
          vec2 i = floor(x);
          vec2 f = fract(x);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }
      
      void main(void) {
          vec2 uv = vUV;
          vec2 center = vec2(0.5);
          vec2 dir = center - uv;
          float dist = length(dir);
          
          if (intensity <= 0.0) {
              gl_FragColor = texture2D(textureSampler, uv);
              return;
          }
          
          // Wormhole tunnel effect: space bends inward drastically
          // dist = max(dist, 0.001); // prevent division by zero
          
          // The tunnel gets deeper as intensity increases
          float pull = (1.0 - smoothstep(0.0, 0.5, dist)) * intensity * 2.0;
          
          // Rotate UVs around center (swirling effect)
          float angle = pull * time * 2.0;
          float s = sin(angle);
          float c = cos(angle);
          mat2 rot = mat2(c, -s, s, c);
          
          vec2 swirledUV = center + rot * (uv - center) * (1.0 - pull * 0.4);
          
          // Add some relativistic quantum noise
          float n = noise(swirledUV * 20.0 - time * 5.0) * pull * 0.05;
          swirledUV += vec2(n);
          
          if (dist > 0.0001) {
              dir = dir / dist;
          } else {
              dir = vec2(0.0);
          }
          
          // Smoothly building radial blur (motion blur falling into the singularity)
          float blurAmount = min(time * 0.015, 0.06) * intensity + pull * 0.05;
          
          vec4 sum = vec4(0.0);
          float samples = 12.0;
          for(float i=0.0; i<12.0; i++) {
              sum += texture2D(textureSampler, swirledUV + dir * (i / samples) * blurAmount);
          }
          sum /= samples;
          
          // Relativistic Chromatic Aberration & Blueshift
          // Light getting pulled into the wormhole blueshifts (gets brighter and bluer/whiter)
          float ca = blurAmount * 0.6;
          sum.r = texture2D(textureSampler, swirledUV + dir * ca * 1.5).r;
          sum.g = texture2D(textureSampler, swirledUV + dir * ca * 0.5).g;
          sum.b = texture2D(textureSampler, swirledUV - dir * ca * 0.5).b;
          
          // Extreme brightness at the singularity edge
          vec3 eventHorizonGlow = vec3(0.1, 0.5, 1.0) * pow(pull, 3.0) * 2.0;
          
          vec4 finalColor = mix(texture2D(textureSampler, uv), sum, intensity);
          finalColor.rgb += eventHorizonGlow;
          
          gl_FragColor = finalColor;
      }
    \`;`;

if (content.indexOf(target) !== -1) {
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content);
  console.log('Replaced');
} else {
  console.log('Not found');
}
