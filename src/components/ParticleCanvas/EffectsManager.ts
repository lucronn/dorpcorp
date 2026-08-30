import React from "react";
import * as BABYLON from "@babylonjs/core";
import { CelestialEntity } from "./types";
import { spawnSupernovaFX, SupernovaFXInstance } from "./SupernovaFX";

export { spawnSupernovaFX };
export type { SupernovaFXInstance };

/**
 * Calculates spacetime fabric gravitational distortion based on celestial bodies and active ripples.
 */
export function getSpacetimeFabricDistortion(
  wx: number,
  wy: number,
  ww: number,
  wh: number,
  celestialEntitiesRef: React.MutableRefObject<CelestialEntity[]>,
  activeRipples: {
    x: number;
    y: number;
    life: number;
    maxDist: number;
    bandWidth: number;
    minDistSq: number;
    maxDistBoundSq: number;
  }[],
  time: number,
  disturbance: number
): number {
  let gravityZ = 0;

  celestialEntitiesRef.current.forEach((entity) => {
    if (entity.isDestroyed) return;
    const ex = entity.x - ww / 2;
    const ey = -(entity.y - wh / 2);

    const dx = ex - wx;
    const dy = ey - wy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    const range = entity.radius * (entity.type === "blackhole" ? 3.5 : 1.8);
    if (dist < range) {
      const intensity = (range - dist) / range;
      const pullDepth = entity.type === "blackhole" ? 180 : 45;
      gravityZ += Math.pow(intensity, 1.8) * pullDepth * (0.2 + disturbance * 0.8);
    }
  });

  activeRipples.forEach((ripple) => {
    const rx = ripple.x - ww / 2;
    const ry = -(ripple.y - wh / 2);
    const dx = rx - wx;
    const dy = ry - wy;
    const distSq = dx * dx + dy * dy;

    if (distSq > ripple.minDistSq && distSq < ripple.maxDistBoundSq) {
      const dist = Math.sqrt(distSq);
      const rForce = (1.0 - Math.abs(dist - ripple.maxDist) / ripple.bandWidth) * ripple.life;
      gravityZ += rForce * 25;
    }
  });

  if (disturbance > 0.01) {
    const pulseWave = Math.sin((wx + wy) * 0.012 - time * 0.06) * 6 * Math.min(1.0, disturbance);
    gravityZ += pulseWave;
  }

  return gravityZ;
}

/**
 * Adds an interactive spacetime gravitational wave ripple at (x, y).
 */
export function addSpacetimeRipple(
  x: number,
  y: number,
  ripplesRef: React.MutableRefObject<
    {
      x: number;
      y: number;
      life: number;
      maxDist?: number;
      bandWidth?: number;
      minDistSq?: number;
      maxDistBoundSq?: number;
    }[]
  >
): void {
  ripplesRef.current.push({
    x,
    y,
    life: 1.0,
  });
}
