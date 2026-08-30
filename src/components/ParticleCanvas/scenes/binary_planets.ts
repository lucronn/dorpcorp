import { CelestialEntity } from "../types";

export function buildBinaryPlanetsScene(
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

  const systemName = "Gemini Synapse";
  const systemDesc = "A dance of twin sister planets locked in mutual orbit, connected by a high-energy particle bridge.";
  const systemTags = ["🪐 TWIN PLANETS", "🌈 ENERGETIC BRIDGE", "☁ NEBULA SHIELD"];

  const separation = isMobile ? 90 : 135;
  const p1Radius = isMobile ? 32 : 48;
  const p2Radius = isMobile ? 28 : 42;

  entities.push({
    type: "planet",
    x: cx - separation,
    y: cy,
    radius: p1Radius,
    color: "#00ffd2",
    secondaryColor: "#20c997",
    hasRings: true,
    ringColor: "rgba(0,255,210,0.55)",
    orbitRadius: separation,
    orbitAngle: Math.PI,
    orbitSpeed: 0.004,
    centerX: cx,
    centerY: cy,
    vx: -Math.sin(Math.PI) * separation * 0.004 * 1.5,
    vy: Math.cos(Math.PI) * separation * 0.004 * 1.5,
    mass: p1Radius * p1Radius,
    initialMass: p1Radius * p1Radius,
    scale: 1.0,
    currentRadius: p1Radius,
    originalRadius: p1Radius,
    targetRadius: p1Radius,
    isPhysicsEnabled: false,
    isDestroyed: false,
  });

  entities.push({
    type: "planet",
    x: cx + separation,
    y: cy,
    radius: p2Radius,
    color: "#da70d6",
    secondaryColor: "#8a2be2",
    hasRings: false,
    orbitRadius: separation,
    orbitAngle: 0,
    orbitSpeed: 0.004,
    centerX: cx,
    centerY: cy,
    vx: -Math.sin(0) * separation * 0.004 * 1.5,
    vy: Math.cos(0) * separation * 0.004 * 1.5,
    mass: p2Radius * p2Radius,
    initialMass: p2Radius * p2Radius,
    scale: 1.0,
    currentRadius: p2Radius,
    originalRadius: p2Radius,
    targetRadius: p2Radius,
    isPhysicsEnabled: false,
    isDestroyed: false,
  });

  const nebRad = isMobile ? 250 : 450;
  entities.push({
    type: "nebula",
    x: cx,
    y: cy,
    radius: nebRad,
    color: "rgba(120, 80, 220, 0.14)",
    vx: 0,
    vy: 0,
    mass: nebRad * nebRad * 0.02,
    scale: 1.0,
    currentRadius: nebRad,
    originalRadius: nebRad,
    targetRadius: nebRad,
    isPhysicsEnabled: false,
    isDestroyed: false,
  });

  return { systemName, systemDesc, systemTags, entities };
}
