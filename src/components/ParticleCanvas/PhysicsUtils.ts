import { CelestialEntity } from "./types";

export const blendHexColors = (c1: string, c2: string, weight: number): string => {
  if (!c1.startsWith("#") || !c2.startsWith("#")) return c1;
  const r1 = parseInt(c1.slice(1, 3), 16);
  const g1 = parseInt(c1.slice(3, 5), 16);
  const b1 = parseInt(c1.slice(5, 7), 16);

  const r2 = parseInt(c2.slice(1, 3), 16);
  const g2 = parseInt(c2.slice(3, 5), 16);
  const b2 = parseInt(c2.slice(5, 7), 16);

  const r = Math.round(r1 * (1 - weight) + r2 * weight);
  const g = Math.round(g1 * (1 - weight) + g2 * weight);
  const b = Math.round(b1 * (1 - weight) + b2 * weight);

  const rs = r.toString(16).padStart(2, "0");
  const gs = g.toString(16).padStart(2, "0");
  const bs = b.toString(16).padStart(2, "0");

  return `#${rs}${gs}${bs}`;
};

type SpawnParticleFn = (
  x: number,
  y: number,
  z: number,
  vx: number,
  vy: number,
  color: string,
  decayRate?: number
) => void;

export const createDustSplash = (
  x: number,
  y: number,
  color: string,
  count: number,
  spawnP: SpawnParticleFn
) => {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.0 + Math.random() * 8.5;
    const vx = Math.cos(angle) * speed * 0.5;
    const vy = Math.sin(angle) * speed * 0.5;
    spawnP(x, y, (Math.random() - 0.5) * 40, vx, vy, color);
  }
};

export const createShatterDebris = (
  x: number,
  y: number,
  color: string,
  count: number,
  spawnP: SpawnParticleFn
) => {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * 2.0;
    const vx = Math.cos(angle) * speed * 0.5;
    const vy = Math.sin(angle) * speed * 0.5;
    spawnP(x, y, (Math.random() - 0.5) * 120, vx, vy, color);
  }
};

export const createSpaghettificationDebris = (
  bh: CelestialEntity,
  victim: CelestialEntity,
  spawnP: SpawnParticleFn
) => {
  const count = Math.min(2000, Math.floor(victim.radius * 20));
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * victim.radius;
    const px = victim.x + Math.cos(angle) * r;
    const py = victim.y + Math.sin(angle) * r;

    const dx = px - bh.x;
    const dy = py - bh.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const orbitAngle = Math.atan2(dy, dx) + Math.PI / 2;
    const speed = 10.0 + Math.random() * 15.0;
    const vx = Math.cos(orbitAngle) * speed + (bh.x - px) * 0.05;
    const vy = Math.sin(orbitAngle) * speed + (bh.y - py) * 0.05;

    spawnP(
      px,
      py,
      (Math.random() - 0.5) * victim.radius * 2,
      vx,
      vy,
      Math.random() > 0.5 ? victim.color : (victim.ringColor || "#ffffff"),
      0.002 + Math.random() * 0.008
    );
  }
};

export const swallowEntity = (
  bh: CelestialEntity,
  victim: CelestialEntity
) => {
  victim.isSwallowing = true;
  victim.destroyedBy = "blackhole";
  const newMass = (bh.mass || 100) + (victim.mass || 50);
  bh.mass = newMass;

  // Blackhole target radius swells from ingested mass!
  const targetRadius = Math.min(bh.radius * 1.5, Math.sqrt(newMass / 15));
  bh.targetRadius = targetRadius;
};
