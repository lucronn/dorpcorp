import { CelestialEntity } from "../types";

export function buildStellarPulsarScene(
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

  const systemName = "Vela Magnetar";
  const systemDesc = "A hyper-dense relativistic pulsar emitting collimated high-energy particle beams.";
  const systemTags = ["★ MAGNETAR", "⚡ RELATIVISTIC BEAMS", "☄ ULTRA-DENSE CORE"];

  const coreRad = isMobile ? 18 : 28;
  entities.push({
    type: "star",
    x: cx,
    y: cy,
    radius: coreRad,
    color: "#ffffff",
    secondaryColor: "#00ffd2",
    vx: 0,
    vy: 0,
    mass: coreRad * coreRad * 20,
    scale: 1.0,
    targetScale: 1.0,
    currentRadius: coreRad,
    originalRadius: coreRad,
    targetRadius: coreRad,
    isPhysicsEnabled: false,
    isDestroyed: false,
  });

  // Diamond remnant pulsar companion planet (PSR J1719-1438 b analog)
  const planetRad = isMobile ? 14 : 20;
  const orbitRad = isMobile ? 220 : 380;
  const orbitSpeed = 0.0035;
  entities.push({
    type: "planet",
    x: cx + orbitRad,
    y: cy,
    radius: planetRad,
    color: "#4deeea",
    secondaryColor: "#a5f3fc",
    hasRings: true,
    ringColor: "rgba(77, 238, 234, 0.4)",
    orbitRadius: orbitRad,
    orbitAngle: 0,
    orbitSpeed: orbitSpeed,
    centerX: cx,
    centerY: cy,
    vx: 0,
    vy: orbitRad * orbitSpeed,
    mass: planetRad * planetRad * 3,
    scale: 1.0,
    targetScale: 1.0,
    currentRadius: planetRad,
    originalRadius: planetRad,
    targetRadius: planetRad,
    isPhysicsEnabled: false,
    isDestroyed: false,
  });

  return { systemName, systemDesc, systemTags, entities };
}
