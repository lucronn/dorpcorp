const fs = require('fs');
let code = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf8');

code = code.replace(
`    scene.onPointerObservable.add((pointerInfo) => {`,
`    scene.onPointerObservable.add((pointerInfo) => {
        if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
            console.log("[DEBUG] scene.onPointerObservable POINTERDOWN triggered", pointerInfo);
        }`
);

code = code.replace(
`    const startWormholeTransit = async (targetPos?: BABYLON.Vector3, viewDir?: BABYLON.Vector3) => {`,
`    const startWormholeTransit = async (targetPos?: BABYLON.Vector3, viewDir?: BABYLON.Vector3) => {
      console.log("[DEBUG] startWormholeTransit called", { targetPos, viewDir });`
);

code = code.replace(
`          // Trigger transition callback to notify parent React UI
          if (animationComplete) {
              animationComplete();
          }`,
`          // Trigger transition callback to notify parent React UI
          console.log("[DEBUG] Wormhole transit finished, calling animationComplete()");
          if (animationComplete) {
              animationComplete();
          }`
);

fs.writeFileSync('src/components/ParticleCanvas.tsx', code);
