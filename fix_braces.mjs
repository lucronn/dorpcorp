import fs from 'fs';
let code = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf8');
code = code.replace(/\} else if \(!isTransitActiveRef\.current\) \{ if \(transitObserver\) \{ scene\.onBeforeRenderObservable\.remove\(transitObserver\); transitObserver = null; \} \}\n        \} else if \(!isTransitActiveRef\.current\) \{ if \(transitObserver\) \{ scene\.onBeforeRenderObservable\.remove\(transitObserver\); transitObserver = null; \} \}\n        \}/, "} else if (!isTransitActiveRef.current) { if (transitObserver) { scene.onBeforeRenderObservable.remove(transitObserver); transitObserver = null; } }");
fs.writeFileSync('src/components/ParticleCanvas.tsx', code);
