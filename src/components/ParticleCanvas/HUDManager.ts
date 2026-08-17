import * as BABYLON from "@babylonjs/core";
import { drawStageLayoutTemplate } from "./ParticleUtils";

export function updateHudTexture(
  targetStage: number,
  hudPlane: BABYLON.Mesh | null,
  hudTexture: BABYLON.DynamicTexture | null
): void {
  if (!hudPlane || !hudTexture) return;
  const ww = window.innerWidth;
  const wh = window.innerHeight;
  const hudDpr = window.devicePixelRatio || 1;

  const context = hudTexture.getContext() as CanvasRenderingContext2D | null;
  if (!context) return;

  context.save();
  context.resetTransform();
  context.clearRect(0, 0, ww * hudDpr, wh * hudDpr);
  context.scale(hudDpr, hudDpr);
  drawStageLayoutTemplate(context, targetStage, ww, wh, "full");
  context.restore();
  hudTexture.update();
}
