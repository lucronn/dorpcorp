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

  const nucleusRad = isMobile ? 32 : 55;
  entities.push({
    type: "star",
    x: cx,
    y: cy,
    radius: nucleusRad,
    color: "#ffffff",
    secondaryColor: "#ffeaad",
    vx: 0,
    vy: 0,
    mass: nucleusRad * nucleusRad * 12,
    scale: 0,
    currentRadius: nucleusRad,
    originalRadius: nucleusRad,
    targetRadius: nucleusRad,
    isPhysicsEnabled: false,
    isDestroyed: false,
  });

  entities.push({
    type: "nebula",
    x: cx,
    y: cy,
    radius: isMobile ? 180 : 300,
    color: "rgba(218, 112, 214, 0.12)",
    vx: 0,
    vy: 0,
    mass: 1000,
    scale: 0,
    currentRadius: isMobile ? 180 : 300,
    originalRadius: isMobile ? 180 : 300,
    targetRadius: isMobile ? 180 : 300,
    isPhysicsEnabled: false,
    isDestroyed: false,
  });

  entities.push({
    type: "nebula",
    x: cx,
    y: cy,
    radius: isMobile ? 220 : 350,
    color: "rgba(77, 238, 234, 0.12)",
    vx: 0,
    vy: 0,
    mass: 1200,
    scale: 0,
    currentRadius: isMobile ? 220 : 350,
    originalRadius: isMobile ? 220 : 350,
    targetRadius: isMobile ? 220 : 350,
    isPhysicsEnabled: false,
    isDestroyed: false,
  });

  return { systemName, systemDesc, systemTags, entities };
}
