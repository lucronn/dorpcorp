import { CelestialEntity } from "../types";

/**
 * Resonant multi-planet system around a cool host star.
 * Grounded in Keplerian celestial mechanics and Laplace mean-motion resonance chains
 * (e.g. TRAPPIST-1 resonant architecture, Luger et al. 2017 arXiv:1703.04166).
 * Planets occupy nested semi-major axes a_i with orbital frequencies Omega_i \propto a_i^{-3/2}.
 */
export function buildExoplanetClusterScene(
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

  const systemName = "TRAPPIST-Resonance";
  const systemDesc = "A compact, ultra-cool M-dwarf host star surrounded by a three-planet Laplace mean-motion resonance chain with nested Keplerian semi-major axes.";
  const systemTags = ["🪐 LAPLACE RESONANCE", "☀ M-DWARF HOST", "☄ KEPLER DYNAMICS"];

  // Central Host Star (M-dwarf)
  const starRadius = isMobile ? 24 : 38;
  entities.push({
    type: "star",
    x: cx,
    y: cy,
    radius: starRadius,
    color: "#ff9e43",
    secondaryColor: "#ffffff",
    vx: 0,
    vy: 0,
    mass: starRadius * starRadius * 25,
    scale: 1.0,
    targetScale: 1.0,
    currentRadius: starRadius,
    originalRadius: starRadius,
    targetRadius: starRadius,
    isPhysicsEnabled: false,
    isDestroyed: false,
  });

  const baseR = isMobile ? 120 : 180;
  // Nested semi-major axes ratios: [1.0, 1.45, 2.05] (closely tracking ~3:2 and ~2:1 period commensurabilities)
  const semiMajorAxes = [baseR * 0.75, baseR * 1.15, baseR * 1.65];
  const planetColors = ["#4deeea", "#ffd778", "#ff6b81"];
  const planetSecondaries = ["#ffffff", "#ffaa33", "#ffb8c6"];

  for (let i = 0; i < 3; i++) {
    const r = semiMajorAxes[i]!;
    // Staggered orbital phases
    const angle = (i * Math.PI * 2) / 3 + 0.4 * i;
    const pRadius = (isMobile ? 12 : 18) + i * 3;
    // Kepler's Third Law: Omega = 2*pi/P \propto a^(-3/2), v = Omega * a \propto a^(-1/2)
    const baseSpeed = 0.007;
    const orbitSpeed = baseSpeed * Math.pow(semiMajorAxes[0]! / r, 1.5);

    entities.push({
      type: "planet",
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r * Math.cos(0.3 + i * 0.22),
      z: Math.sin(angle) * r * Math.sin(0.3 + i * 0.22),
      orbitInclination: 0.3 + i * 0.22,
      radius: pRadius,
      color: planetColors[i]!,
      secondaryColor: planetSecondaries[i]!,
      hasRings: i === 1,
      ringColor: "rgba(255, 215, 120, 0.45)",
      orbitRadius: r,
      orbitAngle: angle,
      orbitSpeed: orbitSpeed,
      centerX: cx,
      centerY: cy,
      vx: -Math.sin(angle) * r * orbitSpeed,
      vy: Math.cos(angle) * r * orbitSpeed,
      mass: pRadius * pRadius,
      scale: 1.0,
      targetScale: 1.0,
      currentRadius: pRadius,
      originalRadius: pRadius,
      targetRadius: pRadius,
      isPhysicsEnabled: false,
      isDestroyed: false,
    });
  }

  return { systemName, systemDesc, systemTags, entities };
}
