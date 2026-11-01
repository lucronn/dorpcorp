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

  const systemName = "Vela Relativistic Pulsar";
  const systemDesc = "A rapidly rotating neutron star with a dipolar magnetic field (B ~ 10¹² G), launching Goldreich-Julian magnetospheric e⁺e⁻ pair cascades along the magnetic axis and an equatorial synchrotron wind nebula.";
  const systemTags = ["★ NEUTRON STAR", "⚡ RELATIVISTIC JETS", "☄ SYNCHROTRON WIND"];

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

  return { systemName, systemDesc, systemTags, entities };
}
