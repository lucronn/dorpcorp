const fs = require('fs');
let content = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');

const replace1 = `    // 2. Layered Typography Tracer Texture
    const hudTexture = new BABYLON.DynamicTexture("hudTex", { width: ww, height: wh }, scene, false);
    const hudCtx = hudTexture.getContext() as CanvasRenderingContext2D | null;
    if (hudCtx) {
      drawStageLayoutTemplate(hudCtx, stageRef.current, ww, wh, "full");
    }`;

const with1 = `    // 2. Layered Typography Tracer Texture
    const dpr = window.devicePixelRatio || 1;
    const hudTexture = new BABYLON.DynamicTexture("hudTex", { width: ww * dpr, height: wh * dpr }, scene, false);
    const hudCtx = hudTexture.getContext() as CanvasRenderingContext2D | null;
    if (hudCtx) {
      hudCtx.scale(dpr, dpr);
      drawStageLayoutTemplate(hudCtx, stageRef.current, ww, wh, "full");
    }`;

const replace2 = `  const updateHudTexture = (targetStage: number) => {
    if (!hudPlaneRef.current || !hudTextureRef.current) return;
    const ww = window.innerWidth;
    const wh = window.innerHeight;

    const texture = hudTextureRef.current;
    const context = texture.getContext() as CanvasRenderingContext2D | null;
    if (!context) return;
    context.clearRect(0, 0, ww, wh);
    drawStageLayoutTemplate(context, targetStage, ww, wh, "full");
    texture.update();
  };`;

const with2 = `  const updateHudTexture = (targetStage: number) => {
    if (!hudPlaneRef.current || !hudTextureRef.current) return;
    const ww = window.innerWidth;
    const wh = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;

    const texture = hudTextureRef.current;
    const context = texture.getContext() as CanvasRenderingContext2D | null;
    if (!context) return;
    context.clearRect(0, 0, ww * dpr, wh * dpr);
    // context.scale is already applied once, wait, if we clear we don't need to re-scale, but let's make sure
    context.save();
    context.resetTransform();
    context.clearRect(0, 0, ww * dpr, wh * dpr);
    context.scale(dpr, dpr);
    drawStageLayoutTemplate(context, targetStage, ww, wh, "full");
    context.restore();
    texture.update();
  };`;

content = content.replace(replace1, with1).replace(replace2, with2);
fs.writeFileSync('src/components/ParticleCanvas.tsx', content);
