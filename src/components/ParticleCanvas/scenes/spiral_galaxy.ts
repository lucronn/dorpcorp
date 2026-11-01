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
  const systemDesc = "A grand-design spiral galaxy stabilized by an extended NFW dark matter halo, exhibiting a flat rotational velocity profile and Lin-Shu density wave arms.";
  const systemTags = ["🌌 SPIRAL GALAXY", "☄ DARK MATTER HALO", "★ DENSITY WAVES"];

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
