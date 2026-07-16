const fs = require('fs');
let code = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf8');

code = code.replace(
`    const generateInterstellarScene = (width: number, height: number) => {`,
`    const generateInterstellarScene = (width: number, height: number) => {
      console.log("[DEBUG] generateInterstellarScene called. Current stage:", stageRef.current, "isInterstellarRef:", isInterstellarRef.current);`
);

code = code.replace(
`    transitionToNewEntities(entities);
    interstellarSceneGeneratedTimeRef.current = Date.now();
    registerAndSaveSequence(systemName, systemDesc, systemTags, entities);`,
`    console.log("[DEBUG] Entities generated: ", entities.length, "bh:", entities.filter(e => e.type === 'blackhole').length, "planets:", entities.filter(e => e.type === 'planet').length);
    transitionToNewEntities(entities);
    interstellarSceneGeneratedTimeRef.current = Date.now();
    registerAndSaveSequence(systemName, systemDesc, systemTags, entities);`
);

code = code.replace(
`    const startWormholeTransit = async (targetPos?: BABYLON.Vector3, viewDir?: BABYLON.Vector3) => {`,
`    const startWormholeTransit = async (targetPos?: BABYLON.Vector3, viewDir?: BABYLON.Vector3) => {
      console.log("[DEBUG] startWormholeTransit triggered!");`
);

fs.writeFileSync('src/components/ParticleCanvas.tsx', code);
