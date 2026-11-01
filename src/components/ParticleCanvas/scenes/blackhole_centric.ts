import { CelestialEntity } from "../types";

export function buildBlackholeCentricScene(
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

  const systemName = "Singularity Core";
  const systemDesc = "A supermassive rotating black hole locking dozens of systems in an aggressive accretion orbit.";
  const systemTags = ["🕳 BLACK HOLE", "☄ ACCRETION DISK", "★ GRAVITY SHEAR"];

  const bhRad = isMobile ? 45 : 75;
  entities.push({
    type: "blackhole",
    x: cx,
    y: cy,
    radius: bhRad,
    color: "#ff6600",
    secondaryColor: "#f25f35",
    vx: 0,
    vy: 0,
    mass: bhRad * bhRad * 15,
    initialMass: bhRad * bhRad * 15,
    scale: 1.0,
    targetScale: 1.0,
    currentRadius: bhRad,
    originalRadius: bhRad,
    targetRadius: bhRad,
    isPhysicsEnabled: false,
    isDestroyed: false,
  });

  return { systemName, systemDesc, systemTags, entities };
}
