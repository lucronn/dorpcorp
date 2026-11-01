import { clamp01, quinticEase, smoothstep } from "./CinematicTransitionDirector";

export const WORMHOLE_DURATION_MS = 2800;
export const WORMHOLE_REBUILD_PROGRESS = 0.58;
export const WORMHOLE_EXIT_SETTLE_MS = 1200;

/** One clock for the tunnel, camera, particle pull and optical rush. */
export function sampleWormholeTransit(progress: number) {
  const u = clamp01(progress);
  const capture = smoothstep(0, 0.28, u);
  const exit = smoothstep(0.62, 1, u);
  const intensity = capture * (1 - exit);
  return {
    phase: u < 0.28 ? "capture" : u < 0.62 ? "tunnel" : "emerge",
    intensity,
    travel: quinticEase(u),
    // FOV breath leads the rush slightly, then recovers to the configured lens.
    fovOffset: intensity * 0.38,
    roll: intensity === 0 ? 0 : Math.sin(u * Math.PI * 2) * intensity * 0.1,
    exit,
    // Thin dark iris masks the remap, without bleaching the throat silhouette.
    eclipse: smoothstep(0.46, 0.58, u) * (1 - smoothstep(0.58, 0.72, u)),
  };
}
