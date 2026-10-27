import { CelestialEntity } from "../types";

export function buildSpiralGalaxyScene(
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

  const systemName = "Andromeda Shard";
  const systemDesc = "A magnificent grand-design spiral galaxy spinning in silent majesty.";
  const systemTags = ["🌌 SPIRAL GALAXY", "☄ GALACTIC CORE", "★ STELLAR DISPERSION"];

  const nucleusRad = isMobile ? 36 : 60;
  entities.push({
    type: "galaxy",
    x: cx,
    y: cy,
    radius: nucleusRad,
    color: "#ffffff",
    secondaryColor: "#ffd778",
    vx: 0,
    vy: 0,
    mass: nucleusRad * nucleusRad * 16,
    scale: 1.0,
    targetScale: 1.0,
    currentRadius: nucleusRad,
    originalRadius: nucleusRad,
    targetRadius: nucleusRad,
    isPhysicsEnabled: false,
    isDestroyed: false,
  });

  return { systemName, systemDesc, systemTags, entities };
}
