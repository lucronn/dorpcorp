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
    scale: 0,
    currentRadius: bhRad,
    originalRadius: bhRad,
    targetRadius: bhRad,
    isPhysicsEnabled: false,
    isDestroyed: false,
  });

  const pCount = isMobile ? 1 : 2;
  for (let p = 0; p < pCount; p++) {
    const orbitRad = (isMobile ? 500 : 850) + p * (isMobile ? 250 : 400);
    const angle = Math.random() * Math.PI * 2;
    const pRadius = (isMobile ? 12 : 22) + Math.random() * 12;
    const orbitSpeed = 0.003 + Math.random() * 0.003;

    entities.push({
      type: "planet",
      x: cx + Math.cos(angle) * orbitRad,
      y: cy + Math.sin(angle) * orbitRad,
      radius: pRadius,
      color: p === 0 ? "#4deeea" : "#ffd778",
      secondaryColor: "#00ffd2",
      hasRings: Math.random() > 0.4,
      ringColor: p === 0 ? "rgba(77, 238, 234, 0.45)" : "rgba(255, 215, 120, 0.4)",
      orbitRadius: orbitRad,
      orbitAngle: angle,
      orbitSpeed: orbitSpeed,
      centerX: cx,
      centerY: cy,
      vx: -Math.sin(angle) * orbitRad * orbitSpeed * 1.5,
      vy: Math.cos(angle) * orbitRad * orbitSpeed * 1.5,
      mass: pRadius * pRadius,
      initialMass: pRadius * pRadius,
      scale: 0,
      currentRadius: pRadius,
      originalRadius: pRadius,
      targetRadius: pRadius,
      isPhysicsEnabled: false,
      isDestroyed: false,
    });
  }

  return { systemName, systemDesc, systemTags, entities };
}
