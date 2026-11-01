import { CelestialEntity } from "../types";

/**
 * Binary planet system in mutual Keplerian orbit around their common barycenter.
 * Masses follow 3D volumetric scaling (M \propto R^3) with semi-major distances
 * inversely proportional to mass (r1 * m1 = r2 * m2).
 * Particle transfer models hydrodynamic Roche-lobe overflow through the inner L1 Lagrange point.
 */
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

  const systemName = "Gemini Barycenter";
  const systemDesc = "Twin planets locked in mutual orbit around their common center of mass, transferring atmospheric plasma via Roche-lobe overflow through the L1 Lagrange point.";
  const systemTags = ["🪐 BARYCENTRIC ORBIT", "⚡ ROCHE-LOBE L1", "☁ TIDAL ENVELOPE"];

  const separation = isMobile ? 180 : 320;
  const p1Radius = isMobile ? 24 : 42;
  const p2Radius = isMobile ? 20 : 36;

  // Volumetric mass scaling: M \propto R^3
  const m1 = Math.pow(p1Radius, 3) * 0.05;
  const m2 = Math.pow(p2Radius, 3) * 0.05;
  const totalMass = m1 + m2;

  // Barycentric distances: r1 = d * (m2 / totalMass), r2 = d * (m1 / totalMass)
  const r1 = separation * (m2 / totalMass);
  const r2 = separation * (m1 / totalMass);

  const mutualAngularVelocity = 0.005;

  entities.push({
    type: "planet",
    x: cx - r1,
    y: cy,
    radius: p1Radius,
    color: "#00ffd2",
    secondaryColor: "#20c997",
    hasRings: true,
    ringColor: "rgba(0,255,210,0.45)",
    orbitRadius: r1,
    orbitAngle: Math.PI,
    orbitSpeed: mutualAngularVelocity,
    centerX: cx,
    centerY: cy,
    vx: -Math.sin(Math.PI) * r1 * mutualAngularVelocity,
    vy: Math.cos(Math.PI) * r1 * mutualAngularVelocity,
    mass: m1,
    initialMass: m1,
    scale: 1.0,
    targetScale: 1.0,
    currentRadius: p1Radius,
    originalRadius: p1Radius,
    targetRadius: p1Radius,
    isPhysicsEnabled: false,
    isDestroyed: false,
  });

  entities.push({
    type: "planet",
    x: cx + r2,
    y: cy,
    radius: p2Radius,
    color: "#da70d6",
    secondaryColor: "#8a2be2",
    hasRings: false,
    orbitRadius: r2,
    orbitAngle: 0,
    orbitSpeed: mutualAngularVelocity,
    centerX: cx,
    centerY: cy,
    vx: -Math.sin(0) * r2 * mutualAngularVelocity,
    vy: Math.cos(0) * r2 * mutualAngularVelocity,
    mass: m2,
    initialMass: m2,
    scale: 1.0,
    targetScale: 1.0,
    currentRadius: p2Radius,
    originalRadius: p2Radius,
    targetRadius: p2Radius,
    isPhysicsEnabled: false,
    isDestroyed: false,
  });

  const nebRad = isMobile ? 220 : 380;
  entities.push({
    type: "nebula",
    x: cx,
    y: cy,
    radius: nebRad,
    color: "rgba(120, 80, 220, 0.18)",
    vx: 0,
    vy: 0,
    mass: nebRad * nebRad * 0.02,
    scale: 1.0,
    targetScale: 1.0,
    currentRadius: nebRad,
    originalRadius: nebRad,
    targetRadius: nebRad,
    isPhysicsEnabled: false,
    isDestroyed: false,
  });

  return { systemName, systemDesc, systemTags, entities };
}
