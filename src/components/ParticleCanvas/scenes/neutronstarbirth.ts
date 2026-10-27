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

  const isNeutronStar = Math.random() > 0.5;
  const remnant: CelestialEntity = {
    type: isNeutronStar ? "star" : "blackhole",
    x: star.x,
    y: star.y,
    radius: isNeutronStar ? 6 : 10,
    color: isNeutronStar ? "#4deeea" : "#110b14",
    secondaryColor: isNeutronStar ? "#ffffff" : "#000000",
    vx: (star.vx || 0) * 0.5,
    vy: (star.vy || 0) * 0.5,
    mass: isNeutronStar ? star.mass * 0.6 : star.mass * 1.5,
    scale: 0.05,
    currentRadius: isNeutronStar ? 6 : 10,
    originalRadius: isNeutronStar ? 6 : 10,
    targetRadius: isNeutronStar ? 6 : 10,
    isPhysicsEnabled: true,
    isDestroyed: false,
  };

  entities.push(remnant);
  createDustSplash(star.x, star.y, star.color, 180);
  createDustSplash(star.x, star.y, "#ffffff", 120);
  if (audio.playSupernova) audio.playSupernova();

  const systemName = isNeutronStar ? "Neutron Star Synthesis" : "Micro Singularity Formation";
  const systemDesc = isNeutronStar
    ? "A massive star has collapsed under gravity, fusing its protons and electrons into a super-dense, spinning neutron core."
    : "A dying star core collapsed past its Schwarzschild radius, punching a miniature hole in the fabric of space.";
  const systemTags = [isNeutronStar ? "★ COMPACT STAR" : "🕳 SINGULARITY", "☄ CORE COLLAPSE", "★ LOCAL NEBULA"];

  return { remnant, systemName, systemDesc, systemTags };
}
