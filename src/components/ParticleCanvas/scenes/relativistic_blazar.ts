import { CelestialEntity } from "../types";

/**
 * Relativistic Blazar & Active Galactic Nucleus (AGN) Jet (M87 / 3C 273 class).
 * A supermassive black hole powering a collimated Blandford-Znajek relativistic jet
 * oriented close to the observer's line of sight (theta ~ 14 deg).
 * Relativistic light-travel time effects produce apparent superluminal motion
 * (beta_app = (beta * sin theta) / (1 - beta * cos theta) ~ 6.0 c)
 * and intense Doppler-boosted polarized synchrotron radiation from shock knots.
 */
export function buildRelativisticBlazarScene(
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

  const systemName = "M87* Relativistic Blazar";
  const systemDesc = "A 6.5-billion-solar-mass Kerr black hole powering a collimated relativistic jet showing apparent superluminal motion (β_app ≈ 6c) and polarized synchrotron shock knots.";
  const systemTags = ["⚡ SUPERLUMINAL JET (6c)", "🕳 SMBH SINGULARITY", "★ SYNCHROTRON SHOCK KNOTS"];

  const bhRadius = isMobile ? 36 : 56;

  // Central Supermassive Black Hole
  entities.push({
    type: "blackhole",
    x: cx,
    y: cy,
    radius: bhRadius,
    color: "#ff7700",
    secondaryColor: "#ffffff",
    vx: 0,
    vy: 0,
    mass: bhRadius * bhRadius * 25,
    initialMass: bhRadius * bhRadius * 25,
    scale: 1.0,
    targetScale: 1.0,
    currentRadius: bhRadius,
    originalRadius: bhRadius,
    targetRadius: bhRadius,
    isPhysicsEnabled: false,
    isDestroyed: false,
  });

  // Synchrotron Shock Knot HST-1 (Internal magnetic reconnection shock)
  const knot1Dist = isMobile ? 95 : 150;
  entities.push({
    type: "star",
    x: cx + knot1Dist * 0.45,
    y: cy - knot1Dist,
    radius: isMobile ? 10 : 16,
    color: "#ffffff",
    secondaryColor: "#38bdf8",
    vx: 0,
    vy: 0,
    mass: 120,
    scale: 1.0,
    targetScale: 1.0,
    currentRadius: isMobile ? 10 : 16,
    originalRadius: isMobile ? 10 : 16,
    targetRadius: isMobile ? 10 : 16,
    isPhysicsEnabled: false,
    isDestroyed: false,
  });

  // Shock Knot A (Terminal jet deceleration knot)
  const knot2Dist = isMobile ? 180 : 280;
  entities.push({
    type: "star",
    x: cx + knot2Dist * 0.45,
    y: cy - knot2Dist,
    radius: isMobile ? 12 : 20,
    color: "#bae6fd",
    secondaryColor: "#0284c7",
    vx: 0,
    vy: 0,
    mass: 160,
    scale: 1.0,
    targetScale: 1.0,
    currentRadius: isMobile ? 12 : 20,
    originalRadius: isMobile ? 12 : 20,
    targetRadius: isMobile ? 12 : 20,
    isPhysicsEnabled: false,
    isDestroyed: false,
  });

  // Magnetized Torus Radio Cocoon
  const cocoonRadius = isMobile ? 240 : 380;
  entities.push({
    type: "nebula",
    x: cx,
    y: cy,
    radius: cocoonRadius,
    color: "rgba(56, 189, 248, 0.16)",
    secondaryColor: "rgba(249, 115, 22, 0.14)",
    vx: 0,
    vy: 0,
    mass: cocoonRadius * cocoonRadius * 0.012,
    scale: 1.0,
    targetScale: 1.0,
    currentRadius: cocoonRadius,
    originalRadius: cocoonRadius,
    targetRadius: cocoonRadius,
    isPhysicsEnabled: false,
    isDestroyed: false,
  });

  return { systemName, systemDesc, systemTags, entities };
}
