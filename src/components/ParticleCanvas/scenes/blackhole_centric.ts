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

  const bhRad = isMobile ? 20 : 28;
  entities.push({
    type: "blackhole",
    x: cx,
    y: cy,
    radius: bhRad,
    color: "#ff7700",
    secondaryColor: "#f25f35",
    vx: 0,
    vy: 0,
    mass: bhRad * bhRad * 15,
    initialMass: bhRad * bhRad * 15,
    scale: 1.0,
    currentRadius: bhRad,
    originalRadius: bhRad,
    targetRadius: bhRad,
    isPhysicsEnabled: false,
    isDestroyed: false,
  });

  const pCount = isMobile ? 1 : 2;
  for (let p = 0; p < pCount; p++) {
    const orbitRad = (isMobile ? 120 : 160) + p * (isMobile ? 70 : 95);
    const angle = (p * Math.PI) + 0.45;
    const pRadius = (isMobile ? 16 : 24) + p * 4;
    const orbitSpeed = 0.004 + (1 - p * 0.3) * 0.002;

    entities.push({
      type: "planet",
      x: cx + Math.cos(angle) * orbitRad,
      y: cy + Math.sin(angle) * orbitRad,
      radius: pRadius,
      color: p === 0 ? "#4deeea" : "#ffd778",
      secondaryColor: p === 0 ? "#00ffd2" : "#ff5e62",
      hasRings: p === 1,
      ringColor: "rgba(255, 215, 120, 0.65)",
      orbitRadius: orbitRad,
      orbitAngle: angle,
      orbitSpeed: orbitSpeed,
      centerX: cx,
      centerY: cy,
      vx: -Math.sin(angle) * orbitRad * orbitSpeed * 1.5,
      vy: Math.cos(angle) * orbitRad * orbitSpeed * 1.5,
      mass: pRadius * pRadius,
      initialMass: pRadius * pRadius,
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
