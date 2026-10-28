import { CelestialEntity } from "../types";

export function createNeutronStarBirthEvent(
  star: CelestialEntity,
  entities: CelestialEntity[],
  createDustSplash?: (x: number, y: number, color: string, count: number) => void,
  audio?: any
): {
  remnant: CelestialEntity;
  systemName: string;
  systemDesc: string;
  systemTags: string[];
} {
  if (star) {
    star.isDestroyed = true;
  }

  const isNeutronStar = Math.random() > 0.5;
  const validMass =
    star?.mass && isFinite(star.mass) && star.mass > 0
      ? star.mass
      : star && isFinite(star.radius) && star.radius > 0
      ? star.radius * star.radius * 2
      : 100;
  const remnantMass = isNeutronStar ? validMass * 0.6 : validMass * 1.5;

  const starX = star && isFinite(star.x) ? star.x : 0;
  const starY = star && isFinite(star.y) ? star.y : 0;
  const starColor = star?.color || "#4deeea";

  const remnantId = `${isNeutronStar ? "neutron-star" : "micro-singularity"}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
  const remnant: CelestialEntity = {
    id: remnantId,
    type: isNeutronStar ? "star" : "blackhole",
    x: starX,
    y: starY,
    radius: isNeutronStar ? 6 : 10,
    color: isNeutronStar ? "#4deeea" : "#110b14",
    secondaryColor: isNeutronStar ? "#ffffff" : "#000000",
    vx: (star?.vx || 0) * 0.5,
    vy: (star?.vy || 0) * 0.5,
    mass: remnantMass,
    initialMass: remnantMass,
    scale: 0.05,
    currentRadius: isNeutronStar ? 6 : 10,
    originalRadius: isNeutronStar ? 6 : 10,
    targetRadius: isNeutronStar ? 6 : 10,
    isPhysicsEnabled: true,
    isDestroyed: false,
  };

  if (Array.isArray(entities)) {
    entities.push(remnant);
  }
  if (typeof createDustSplash === "function") {
    createDustSplash(starX, starY, starColor, 180);
    createDustSplash(starX, starY, "#ffffff", 120);
  }
  if (audio && typeof audio.playSupernova === "function") {
    audio.playSupernova();
  }

  const systemName = isNeutronStar ? "Neutron Star Synthesis" : "Micro Singularity Formation";
  const systemDesc = isNeutronStar
    ? "A massive star has collapsed under gravity, fusing its protons and electrons into a super-dense, spinning neutron core."
    : "A dying star core collapsed past its Schwarzschild radius, punching a miniature hole in the fabric of space.";
  const systemTags = [isNeutronStar ? "★ COMPACT STAR" : "🕳 SINGULARITY", "☄ CORE COLLAPSE", "★ LOCAL NEBULA"];

  return { remnant, systemName, systemDesc, systemTags };
}
