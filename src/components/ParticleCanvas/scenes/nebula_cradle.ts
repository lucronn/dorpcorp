import { CelestialEntity } from "../types";

export function buildNebulaCradleScene(
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

  const systemName = "Vela Breeding Ground";
  const systemDesc = "A stellar nursery where new stars coalesce within colorful gas envelopes.";
  const systemTags = ["★ STELLAR NURSERY", "🔮 VELA NEBULA", "🪐 PROTOPLANETS"];

  const angle1 = Math.atan2(-(isMobile ? 50 : 90), -(isMobile ? 80 : 160));
  const angle2 = Math.atan2(isMobile ? 50 : 90, isMobile ? 80 : 160);
  const radius1 = Math.sqrt((isMobile ? 80 : 160) ** 2 + (isMobile ? 50 : 90) ** 2);
  const neb1Rad = isMobile ? 220 : 360;
  const neb2Rad = isMobile ? 200 : 340;
  const pRadius = isMobile ? 16 : 28;

  entities.push({
    type: "nebula",
    x: cx + Math.cos(angle1) * radius1,
    y: cy + Math.sin(angle1) * radius1,
    radius: neb1Rad,
    color: "rgba(242, 95, 53, 0.16)",
    orbitRadius: radius1,
    orbitAngle: angle1,
    orbitSpeed: 0.001,
    centerX: cx,
    centerY: cy,
    vx: -Math.sin(angle1) * radius1 * 0.001 * 1.5,
    vy: Math.cos(angle1) * radius1 * 0.001 * 1.5,
    mass: neb1Rad * neb1Rad * 0.02,
    scale: 1.0,
    currentRadius: neb1Rad,
    originalRadius: neb1Rad,
    targetRadius: neb1Rad,
    isPhysicsEnabled: false,
    isDestroyed: false,
  });

  entities.push({
    type: "nebula",
    x: cx + Math.cos(angle2) * radius1,
    y: cy + Math.sin(angle2) * radius1,
    radius: neb2Rad,
    color: "rgba(77, 238, 234, 0.15)",
    orbitRadius: radius1,
    orbitAngle: angle2,
    orbitSpeed: 0.001,
    centerX: cx,
    centerY: cy,
    vx: -Math.sin(angle2) * radius1 * 0.001 * 1.5,
    vy: Math.cos(angle2) * radius1 * 0.001 * 1.5,
    mass: neb2Rad * neb2Rad * 0.02,
    scale: 1.0,
    currentRadius: neb2Rad,
    originalRadius: neb2Rad,
    targetRadius: neb2Rad,
    isPhysicsEnabled: false,
    isDestroyed: false,
  });

  entities.push({
    type: "planet",
    x: cx,
    y: cy,
    radius: pRadius,
    color: "#ffd778",
    secondaryColor: "#f25f35",
    vx: 0,
    vy: 0,
    mass: pRadius * pRadius,
    scale: 1.0,
    currentRadius: pRadius,
    originalRadius: pRadius,
    targetRadius: pRadius,
    isPhysicsEnabled: false,
    isDestroyed: false,
  });

  return { systemName, systemDesc, systemTags, entities };
}
