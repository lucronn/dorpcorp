import { CelestialEntity } from "../types";

export function createNeutronStarBirthEvent(
  star: CelestialEntity,
  entities: CelestialEntity[],
  createDustSplash: (x: number, y: number, color: string, count: number) => void,
  audio: any
): {
  remnant: CelestialEntity;
  systemName: string;
  systemDesc: string;
  systemTags: string[];
} {
  star.isDestroyed = true;

  const isNeutronStar = Math.random() > 0.45;
  // Natal hydrodynamic / asymmetric-neutrino pulsar kick (Janka 2012, arXiv:1206.2503)
  const kickAngle = Math.random() * Math.PI * 2;
  const kickSpeed = isNeutronStar ? 1.8 + Math.random() * 1.4 : 0.6;
  // Strict mass-energy conservation: compact remnant retains only core mass fraction (< progenitor mass)
  // after ejecting the stellar envelope and radiating ~10^53 erg in neutrinos.
  const remnantMass = isNeutronStar ? star.mass * 0.22 : star.mass * 0.48;
  const remnantRadius = isNeutronStar ? 7 : 10;

  const remnant: CelestialEntity = {
    type: isNeutronStar ? "star" : "blackhole",
    x: star.x,
    y: star.y,
    radius: remnantRadius,
    color: isNeutronStar ? "#ffffff" : "#ff6600",
    // secondaryColor "#00ffd2" activates magnetar dipole beams & synchrotron torus in createStarMesh (Kaspi & Beloborodov 2017, arXiv:1703.00068)
    secondaryColor: isNeutronStar ? "#00ffd2" : "#ffd778",
    vx: (star.vx || 0) * 0.5 + Math.cos(kickAngle) * kickSpeed,
    vy: (star.vy || 0) * 0.5 + Math.sin(kickAngle) * kickSpeed,
    mass: remnantMass,
    initialMass: remnantMass,
    scale: 0.05,
    currentRadius: remnantRadius,
    originalRadius: remnantRadius,
    targetRadius: remnantRadius,
    isPhysicsEnabled: true,
    isDestroyed: false,
  };

  entities.push(remnant);
  createDustSplash(star.x, star.y, star.color, 180);
  createDustSplash(star.x, star.y, "#ffffff", 120);
  if (audio.playSupernova) audio.playSupernova();

  const systemName = isNeutronStar ? "Magnetar Core-Collapse Remnant" : "Fallback Stellar Black Hole";
  const systemDesc = isNeutronStar
    ? "An iron-core progenitor exceeded the Chandrasekhar limit, rebounding at nuclear saturation density via neutrino-driven SASI shock revival to leave a rapidly spinning, ultra-magnetized magnetar (B ~ 10^15 G) with a natal pulsar kick."
    : "Following core collapse and delayed fallback accretion past the Tolman-Oppenheimer-Volkoff (TOV) limit, the proto-neutron star collapsed into a stellar-mass Kerr black hole while ejecting its metal-enriched envelope.";
  const systemTags = [
    isNeutronStar ? "★ MAGNETAR (B~10¹⁵G)" : "🕳 FALLBACK BH (<M_prog)",
    "☄ SASI NEUTRINO SHOCK",
    "★ NATAL PULSAR KICK",
  ];

  return { remnant, systemName, systemDesc, systemTags };
}
