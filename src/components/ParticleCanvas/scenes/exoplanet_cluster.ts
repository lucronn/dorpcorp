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
  const cx = width / 2;
  const cy = height / 2;
  const entities: CelestialEntity[] = [];

  const systemName = "Solana Triad";
  const systemDesc = "Three crystal exoplanets clustered in a co-orbital gravitational field.";
  const systemTags = ["🪐 ORBITAL TRIAD", "⚡ CONNECTOR HIGHS", "★ DEEP VOID"];

  const r = isMobile ? 180 : 290;

  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3;
    const pRadius = (isMobile ? 26 : 48) + (i % 2) * 8;
    const orbitSpeed = 0.010;

    entities.push({
      type: "planet",
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      radius: pRadius,
      color: i === 0 ? "#4deeea" : i === 1 ? "#ffd778" : "#ff5e62",
      secondaryColor: "#ffffff",
      hasRings: i === 0,
      ringColor: "rgba(77, 238, 234, 0.55)",
      orbitRadius: r,
      orbitAngle: angle,
      orbitSpeed: orbitSpeed,
      centerX: cx,
      centerY: cy,
      vx: -Math.sin(angle) * r * orbitSpeed * 1.5,
      vy: Math.cos(angle) * r * orbitSpeed * 1.5,
      mass: pRadius * pRadius,
      scale: 1.0,
      currentRadius: pRadius,
      originalRadius: pRadius,
      targetRadius: pRadius,
      isPhysicsEnabled: false,
      isDestroyed: false,
    });
  }

  return { systemName, systemDesc, systemTags, entities };
}
