import type { CelestialEntity, Particle } from "./types";

/** Sample once per layout. Persistent independent height prevents orbital updates
 * from collapsing an apparently 3D, tilted ellipse back onto a single plane. */
export function initializeParticleVolume(p: Particle, index: number, random = Math.random) {
  const host = p.interstellarEntity as CelestialEntity | undefined;
  p.volumeLatitude = random() * 2 - 1;
  const r = p.orbitRadius ?? host?.radius ?? 50;
  const type = p.interstellarType;
  if (type === "planet" && !p.isPlanetRing && host) {
    // A volume outside the solid planet, not a single equatorial hoop.
    p.orbitRadius = host.radius * Math.cbrt(1.08 ** 3 + random() * (1.9 ** 3 - 1.08 ** 3));
  } else if (type === "nebula" && host?.type === "nebula") {
    p.orbitRadius = host.radius * Math.cbrt(random());
  }
  const bulge = type === "galaxy" ? (host?.radius ?? 50) * 0.4 * Math.exp(-r / 100) : 0;
  const scaleHeight = type === "galaxy" ? 8 + r * 0.09 + bulge
    : type === "background_galaxy" ? 5 + r * 0.23 : Math.max(2, r * 0.07);
  // Thin disk, thick disk, halo strata; symmetric about the local XZ plane.
  const stratum = index % 10 < 6 ? 0.7 : index % 10 < 9 ? 1.8 : 3.2;
  p.volumeHeight = (random() * 2 - 1) * scaleHeight * stratum;
  p.orbitAngle ??= random() * Math.PI * 2;
  p.orbitRadius ??= r;
}

/** Writes into the particle without allocating vectors in the frame loop. */
export function updateParticleVolumeTarget(p: Particle, host?: CelestialEntity, compaction = 1): boolean {
  const type = p.interstellarType;
  const sphere = (type === "planet" && !p.isPlanetRing) || type === "nebula" || (type === "star" && !p.isDustDisk);
  const disk = type === "galaxy" || type === "blackhole" || type === "pulsar_ring" || p.isPlanetRing || p.isDustDisk;
  if (!sphere && !disk) return false;
  const r = (p.orbitRadius ?? host?.radius ?? 50) * compaction;
  const angle = p.orbitAngle ?? 0;
  let x: number, y: number, z: number;
  if (sphere) {
    const latitude = p.volumeLatitude ?? 0;
    const equator = r * Math.sqrt(Math.max(0, 1 - latitude * latitude));
    x = Math.cos(angle) * equator;
    y = r * latitude * (type === "nebula" ? 0.85 : 1);
    z = Math.sin(angle) * equator;
  } else {
    const inclination = type === "galaxy" ? 0.72 : p.isPlanetRing ? 0.3 : 0.4;
    const height = (p.volumeHeight ?? 0) * compaction;
    const planeZ = Math.sin(angle) * r;
    x = Math.cos(angle) * r;
    y = height * Math.cos(inclination) + planeZ * Math.sin(inclination);
    z = planeZ * Math.cos(inclination) - height * Math.sin(inclination);
  }
  p.targetX = (host?.x ?? 0) + x;
  p.targetY = (host?.y ?? 0) + y;
  p.targetZ = (host?.z ?? 0) + z;
  return true;
}

export function updateBackgroundVolumeTarget(p: Particle) {
  const r = p.orbitRadius ?? 20;
  const latitude = p.volumeLatitude ?? 0;
  const equator = p.galaxyType === "elliptical" ? r * Math.sqrt(1 - latitude * latitude) : r;
  const x = Math.cos(p.orbitAngle ?? 0) * equator;
  const y = p.galaxyType === "elliptical" ? r * latitude : (p.volumeHeight ?? 0);
  const z = Math.sin(p.orbitAngle ?? 0) * equator;
  const pitch = p.galaxyPitch ?? 0;
  const yaw = p.galaxyYaw ?? 0;
  const tiltedY = y * Math.cos(pitch) - z * Math.sin(pitch);
  p.targetX = (p.galaxyX ?? 0) + x * Math.cos(yaw) - tiltedY * Math.sin(yaw);
  p.targetY = (p.galaxyY ?? 0) + x * Math.sin(yaw) + tiltedY * Math.cos(yaw);
  p.targetZ = (p.galaxyZ ?? 1600) + y * Math.sin(pitch) + z * Math.cos(pitch);
}
