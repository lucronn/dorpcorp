import { CelestialEntity } from "../types";

/**
 * Binary Neutron Star Merger & Kilonova (GW170817 / AT2017gfo).
 * Two compact neutron stars (M1 ~ 1.4 M_sun, M2 ~ 1.3 M_sun, rho ~ 2.7e14 g/cm^3)
 * in relativistic inspiral emitting quadrupolar gravitational radiation.
 * Post-merger dynamic ejecta synthesize heavy r-process elements (gold, platinum)
 * fueling an optical/IR kilonova and a collimated relativistic jet.
 */
export function buildKilonovaMergerScene(
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

  const systemName = "GW170817 Kilonova";
  const systemDesc = "A binary neutron star coalescence emitting high-frequency gravitational-wave chirps, launching radioactive r-process ejecta that synthesize heavy elements like gold and platinum.";
  const systemTags = ["💫 GW CHIRP INSPIRAL", "⚛ r-PROCESS NUCLEOSYNTHESIS", "⚡ KILONOVA FIREBALL"];

  const separation = isMobile ? 85 : 135;
  const ns1Radius = isMobile ? 14 : 20;
  const ns2Radius = isMobile ? 12 : 18;

  // Ultra-dense nuclear mass scaling (rho ~ 2.7e14 g/cm^3)
  const m1 = Math.pow(ns1Radius, 3) * 0.12;
  const m2 = Math.pow(ns2Radius, 3) * 0.12;
  const totalMass = m1 + m2;

  const r1 = separation * (m2 / totalMass);
  const r2 = separation * (m1 / totalMass);

  // Relativistic high-frequency orbital velocity
  const orbitalSpeed = isMobile ? 0.014 : 0.018;

  // Primary Neutron Star (M1 ~ 1.4 M_sun)
  entities.push({
    type: "star",
    x: cx - r1,
    y: cy,
    radius: ns1Radius,
    color: "#e0f2fe", // Incandescent nuclear surface
    secondaryColor: "#38bdf8", // Relativistic magnetospheric glow
    hasRings: false,
    orbitRadius: r1,
    orbitAngle: Math.PI,
    orbitSpeed: orbitalSpeed,
    centerX: cx,
    centerY: cy,
    vx: -Math.sin(Math.PI) * r1 * orbitalSpeed,
    vy: Math.cos(Math.PI) * r1 * orbitalSpeed,
    mass: m1,
    initialMass: m1,
    scale: 1.0,
    targetScale: 1.0,
    currentRadius: ns1Radius,
    originalRadius: ns1Radius,
    targetRadius: ns1Radius,
    isPhysicsEnabled: false,
    isDestroyed: false,
  });

  // Secondary Neutron Star (M2 ~ 1.3 M_sun)
  entities.push({
    type: "star",
    x: cx + r2,
    y: cy,
    radius: ns2Radius,
    color: "#fdf4ff",
    secondaryColor: "#c084fc",
    hasRings: false,
    orbitRadius: r2,
    orbitAngle: 0,
    orbitSpeed: orbitalSpeed,
    centerX: cx,
    centerY: cy,
    vx: -Math.sin(0) * r2 * orbitalSpeed,
    vy: Math.cos(0) * r2 * orbitalSpeed,
    mass: m2,
    initialMass: m2,
    scale: 1.0,
    targetScale: 1.0,
    currentRadius: ns2Radius,
    originalRadius: ns2Radius,
    targetRadius: ns2Radius,
    isPhysicsEnabled: false,
    isDestroyed: false,
  });

  // Expanding Radioactive r-process Kilonova Ejecta Cloud
  const ejectaRadius = isMobile ? 220 : 360;
  entities.push({
    type: "nebula",
    x: cx,
    y: cy,
    radius: ejectaRadius,
    color: "rgba(255, 185, 80, 0.22)", // Warm lanthanide radioactive decay glow
    secondaryColor: "rgba(168, 85, 247, 0.18)", // Lanthanide-poor blue kilonova component
    vx: 0,
    vy: 0,
    mass: ejectaRadius * ejectaRadius * 0.015,
    scale: 1.0,
    targetScale: 1.0,
    currentRadius: ejectaRadius,
    originalRadius: ejectaRadius,
    targetRadius: ejectaRadius,
    isPhysicsEnabled: false,
    isDestroyed: false,
  });

  return { systemName, systemDesc, systemTags, entities };
}
