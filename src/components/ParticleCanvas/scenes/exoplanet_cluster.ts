import { CelestialEntity } from "../types";

export function buildExoplanetClusterScene(
  width: number,
  height: number,
  isMobile: boolean
): {
  systemName: string;
  systemDesc: string;
  systemTags: string[];
  entities: CelestialEntity[];
} {
  const safeWidth = isFinite(width) && width > 0 ? width : 1920;
  const safeHeight = isFinite(height) && height > 0 ? height : 1080;
  const cx = safeWidth / 2;
  const cy = safeHeight / 2;
  const entities: CelestialEntity[] = [];

  const systemName = "Solana Triad";
  const systemDesc = "Three crystal exoplanets clustered in a co-orbital gravitational field.";
  const systemTags = ["🪐 ORBITAL TRIAD", "⚡ CONNECTOR HIGHS", "★ DEEP VOID"];

  const r = isMobile ? 160 : 280;

  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3;
    const pRadius = (isMobile ? 16 : 26) + i * 4;
    const orbitSpeed = 0.004;

    entities.push({
      type: "planet",
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      radius: pRadius,
      color: i === 0 ? "#4deeea" : i === 1 ? "#ffd778" : "#ff5e62",
      secondaryColor: "#ffffff",
      hasRings: i === 0,
      ringColor: "rgba(77, 238, 234, 0.45)",
      orbitRadius: r,
      orbitAngle: angle,
      orbitSpeed: orbitSpeed,
      centerX: cx,
      centerY: cy,
      vx: -Math.sin(angle) * r * orbitSpeed,
      vy: Math.cos(angle) * r * orbitSpeed,
      mass: pRadius * pRadius,
      scale: 1.0,
      targetScale: 1.0,
      currentRadius: pRadius,
      originalRadius: pRadius,
      targetRadius: pRadius,
      isPhysicsEnabled: false,
      isDestroyed: false,
    });
  }

  return { systemName, systemDesc, systemTags, entities };
}
