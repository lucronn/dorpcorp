import * as BABYLON from "@babylonjs/core";
import { drawStageLayoutTemplate } from "./ParticleUtils";

export function updateHudTexture(
  targetStage: number,
  hudPlane: BABYLON.Mesh | null,
  hudTexture: BABYLON.DynamicTexture | null
): void {
  if (!hudPlane || !hudTexture || hudPlane.isDisposed() || hudTexture.isDisposed()) return;
  const ww = typeof window !== "undefined" && isFinite(window.innerWidth) && window.innerWidth > 0
    ? window.innerWidth
    : 1920;
  const wh = typeof window !== "undefined" && isFinite(window.innerHeight) && window.innerHeight > 0
    ? window.innerHeight
    : 1080;
  const hudDpr = typeof window !== "undefined" && isFinite(window.devicePixelRatio) && window.devicePixelRatio > 0
    ? window.devicePixelRatio
    : 1;

  const context = hudTexture.getContext() as CanvasRenderingContext2D | null;
  if (!context) return;

  const safeStage = isFinite(targetStage) ? Math.max(0, Math.floor(targetStage)) : 0;
  context.save();
  context.resetTransform();
  context.clearRect(0, 0, ww * hudDpr, wh * hudDpr);
  context.scale(hudDpr, hudDpr);
  drawStageLayoutTemplate(context, safeStage, ww, wh, "full");
  context.restore();
  hudTexture.update();
}
