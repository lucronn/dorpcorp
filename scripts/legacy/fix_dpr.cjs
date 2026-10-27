const fs = require('fs');
let content = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');

const replace1 = `    // 2. Layered Typography Tracer Texture
    const hudDpr = window.devicePixelRatio || 1;
    const hudTexture = new BABYLON.DynamicTexture("hudTex", { width: ww * dpr, height: wh * dpr }, scene, false);
    const hudCtx = hudTexture.getContext() as CanvasRenderingContext2D | null;
    if (hudCtx) {
      hudCtx.scale(dpr, dpr);`;

const with1 = `    // 2. Layered Typography Tracer Texture
    const hudDpr = window.devicePixelRatio || 1;
    const hudTexture = new BABYLON.DynamicTexture("hudTex", { width: ww * hudDpr, height: wh * hudDpr }, scene, false);
    const hudCtx = hudTexture.getContext() as CanvasRenderingContext2D | null;
    if (hudCtx) {
      hudCtx.scale(hudDpr, hudDpr);`;

content = content.replace(replace1, with1);

const replace2 = `  const updateHudTexture = (targetStage: number) => {
    if (!hudPlaneRef.current || !hudTextureRef.current) return;
    const ww = window.innerWidth;
    const wh = window.innerHeight;
    const hudDpr = window.devicePixelRatio || 1;

    const texture = hudTextureRef.current;
    const context = texture.getContext() as CanvasRenderingContext2D | null;
    if (!context) return;
    context.clearRect(0, 0, ww * dpr, wh * dpr);
    // context.scale is already applied once, wait, if we clear we don't need to re-scale, but let's make sure
    context.save();
    context.resetTransform();
    context.clearRect(0, 0, ww * dpr, wh * dpr);
    context.scale(dpr, dpr);`;

const with2 = `  const updateHudTexture = (targetStage: number) => {
    if (!hudPlaneRef.current || !hudTextureRef.current) return;
    const ww = window.innerWidth;
    const wh = window.innerHeight;
    const hudDpr = window.devicePixelRatio || 1;

    const texture = hudTextureRef.current;
    const context = texture.getContext() as CanvasRenderingContext2D | null;
    if (!context) return;
    context.clearRect(0, 0, ww * hudDpr, wh * hudDpr);
    // context.scale is already applied once, wait, if we clear we don't need to re-scale, but let's make sure
    context.save();
    context.resetTransform();
    context.clearRect(0, 0, ww * hudDpr, wh * hudDpr);
    context.scale(hudDpr, hudDpr);`;

content = content.replace(replace2, with2);
fs.writeFileSync('src/components/ParticleCanvas.tsx', content);
