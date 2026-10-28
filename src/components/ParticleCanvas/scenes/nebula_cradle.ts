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
  const safeWidth = isFinite(width) && width > 0 ? width : 1920;
  const safeHeight = isFinite(height) && height > 0 ? height : 1080;
  const cx = safeWidth / 2;
  const cy = safeHeight / 2;
  const entities: CelestialEntity[] = [];

  const systemName = "Vela Breeding Ground";
  const systemDesc = "A stellar nursery where new stars coalesce within colorful gas envelopes.";
  const systemTags = ["★ STELLAR NURSERY", "🔮 VELA NEBULA", "🪐 PROTOPLANETS"];

  const radius1 = isMobile ? 120 : 220;
  const neb1Rad = isMobile ? 180 : 300;
  const neb2Rad = isMobile ? 160 : 260;
  const pRadius = isMobile ? 18 : 32;

  entities.push({
    type: "nebula",
    x: cx - radius1 * 0.7,
    y: cy - radius1 * 0.4,
    radius: neb1Rad,
    color: "rgba(242, 95, 53, 0.22)",
    orbitRadius: radius1,
    orbitAngle: Math.PI * 0.8,
    orbitSpeed: 0.002,
    centerX: cx,
    centerY: cy,
    vx: 0,
    vy: 0,
    mass: neb1Rad * neb1Rad * 0.02,
    scale: 1.0,
    targetScale: 1.0,
    currentRadius: neb1Rad,
    originalRadius: neb1Rad,
    targetRadius: neb1Rad,
    isPhysicsEnabled: false,
    isDestroyed: false,
  });

  entities.push({
    type: "nebula",
    x: cx + radius1 * 0.7,
    y: cy + radius1 * 0.4,
    radius: neb2Rad,
    color: "rgba(77, 238, 234, 0.20)",
    orbitRadius: radius1,
    orbitAngle: -Math.PI * 0.2,
    orbitSpeed: 0.002,
    centerX: cx,
    centerY: cy,
    vx: 0,
    vy: 0,
    mass: neb2Rad * neb2Rad * 0.02,
    scale: 1.0,
    targetScale: 1.0,
    currentRadius: neb2Rad,
    originalRadius: neb2Rad,
    targetRadius: neb2Rad,
    isPhysicsEnabled: false,
    isDestroyed: false,
  });

  entities.push({
    type: "star",
    x: cx,
    y: cy,
    radius: pRadius,
    color: "#ffffff",
    secondaryColor: "#ffd778",
    vx: 0,
    vy: 0,
    mass: pRadius * pRadius * 8,
    scale: 1.0,
    targetScale: 1.0,
    currentRadius: pRadius,
    originalRadius: pRadius,
    targetRadius: pRadius,
    isPhysicsEnabled: false,
    isDestroyed: false,
  });

  return { systemName, systemDesc, systemTags, entities };
}
