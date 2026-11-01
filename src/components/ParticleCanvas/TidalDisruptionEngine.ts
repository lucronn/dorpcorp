import { CelestialEntity } from "./types";
import { audio } from "../../utils/audio";

export interface TdeStreamerParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: string;
  life: number;
  decay: number;
  size: number;
  isUnbound?: boolean; // true for epsilon > 0 hyperbolic escaping tail (50% of debris mass), false for epsilon < 0 bound fallback stream
}

export interface TdeFragment {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  life: number;
  decay: number;
  rotation: number;
  rotSpeed: number;
  stretchX: number;
  stretchY: number;
  isUnbound?: boolean;
}

export interface TdeJetKnot {
  distance: number;
  speed: number;
  intensity: number;
  size: number;
  direction: 1 | -1; // North (+1) or South (-1)
}

export interface TdeState {
  isActive: boolean;
  stage: "IDLE" | "STAR_APPROACH" | "ROCHE_RUPTURE" | "ACCRETION_SURGE" | "GRB_DETONATION" | "COOLDOWN";
  startTime: number;
  ruptureTime?: number;
  betaPenetration?: number; // Impact parameter beta = r_t / r_p (Guillochon & Ramirez-Ruiz 2013, arXiv:1206.2350)
  fallbackExponent?: number; // Power-law index n = -5/3 (-1.67) for full disruption or -2.2 for partial disruption
  starX: number;
  starY: number;
  starZ: number;
  starVx: number;
  starVy: number;
  starRadius: number;
  initialRadius: number;
  starMass: number; // 1.0 down to 0.0 as mass dissipates into shredded stream
  shredDissipation: number; // 0.0 to 1.0 fraction of mass shredded into accretion stream
  starColor: string;
  stretchX: number;
  stretchY: number;
  asymmetryFactor: number; // 0 (spherical) to 1.0 (strongly elongated tear with sharp leading cusp)
  compressionFlash: number; // Homologous vertical pancake compression flash at periapsis (Rossi et al. 2021, arXiv:2005.12528)
  rotation: number;
  streamers: TdeStreamerParticle[];
  fragments: TdeFragment[];
  jetKnots: TdeJetKnot[];
  accretionGlowMultiplier: number;
  grbBeamIntensity: number;
  grbShockwaveRadius: number;
  statusMessage: string;
}

export function createInitialTdeState(): TdeState {
  return {
    isActive: false,
    stage: "IDLE",
    startTime: 0,
    ruptureTime: 0,
    betaPenetration: 1.85,
    fallbackExponent: -1.67,
    starX: 0,
    starY: 0,
    starZ: 0,
    starVx: 0,
    starVy: 0,
    starRadius: 36,
    initialRadius: 36,
    starMass: 1.0,
    shredDissipation: 0.0,
    starColor: "#ffd778",
    stretchX: 1.0,
    stretchY: 1.0,
    asymmetryFactor: 0.0,
    compressionFlash: 0.0,
    rotation: 0,
    streamers: [],
    fragments: [],
    jetKnots: [],
    accretionGlowMultiplier: 1.0,
    grbBeamIntensity: 0.0,
    grbShockwaveRadius: 0,
    statusMessage: "Singularity Quiescent",
  };
}

/**
 * Initiates an interactive Tidal Disruption Event (TDE)
 */
export function triggerTidalDisruptionEvent(
  tdeState: TdeState,
  celestialEntities: CelestialEntity[],
  screenWidth: number,
  screenHeight: number
): boolean {
  if (tdeState.isActive && tdeState.stage !== "COOLDOWN") {
    return false;
  }

  // Locate the black hole or center
  const bh = celestialEntities.find((e) => !e.isDestroyed && !e.isOutgoing && e.type === "blackhole");
  const cx = bh ? bh.x : screenWidth / 2;
  const cy = bh ? bh.y : screenHeight / 2;
  const bhRadius = bh ? bh.radius : 65;

  // Position the rogue star on a high-velocity hyperbolic inbound trajectory towards the black hole
  const spawnAngle = Math.PI * 1.25;
  const spawnDist = Math.max(screenWidth * 0.42, 640);
  const startX = cx + Math.cos(spawnAngle) * spawnDist;
  const startY = cy + Math.sin(spawnAngle) * spawnDist;

  // Aim trajectory to plunge right into the Roche limit
  const targetPericenter = bhRadius * 1.75;
  const targetX = cx + targetPericenter;
  const targetY = cy + targetPericenter * 0.35;

  const dx = targetX - startX;
  const dy = targetY - startY;
  const dist = Math.hypot(dx, dy) || 1;
  const initialSpeed = 6.2;

  const starRadius = Math.max(28, bhRadius * 0.45);

  tdeState.isActive = true;
  tdeState.stage = "STAR_APPROACH";
  tdeState.startTime = Date.now();
  tdeState.starX = startX;
  tdeState.starY = startY;
  tdeState.starZ = 15;
  tdeState.starVx = (dx / dist) * initialSpeed;
  tdeState.starVy = (dy / dist) * initialSpeed;
  tdeState.starRadius = starRadius;
  tdeState.initialRadius = starRadius;
  tdeState.starMass = 1.0;
  tdeState.shredDissipation = 0.0;
  tdeState.starColor = "#ffd778";
  tdeState.stretchX = 1.0;
  tdeState.stretchY = 1.0;
  tdeState.asymmetryFactor = 0.0;
  tdeState.compressionFlash = 0.0;
  tdeState.rotation = Math.atan2(dy, dx);
  tdeState.streamers = [];
  tdeState.fragments = [];
  tdeState.jetKnots = [];
  tdeState.accretionGlowMultiplier = 1.0;
  tdeState.grbBeamIntensity = 0.0;
  tdeState.grbShockwaveRadius = 0;
  tdeState.statusMessage = "TDE TRIGGERED: ROGUE STAR INBOUND TO ROCHE LIMIT";

  audio.playTidalDisruption("approach");
  return true;
}

/**
 * Updates the Tidal Disruption Event simulation frame
 */
export function updateTidalDisruption(
  tde: TdeState,
  celestialEntities: CelestialEntity[],
  screenWidth: number,
  screenHeight: number,
  cameraShakeRef: { current: number },
  ripplesRef: { current: { x: number; y: number; life: number }[] }
): void {
  if (!tde.isActive) return;

  const bh = celestialEntities.find((e) => !e.isDestroyed && !e.isOutgoing && e.type === "blackhole");
  const cx = bh ? bh.x : screenWidth / 2;
  const cy = bh ? bh.y : screenHeight / 2;
  const bhRadius = bh ? bh.radius : 65;
  const rocheRadius = bhRadius * 2.85;

  const dx = cx - tde.starX;
  const dy = cy - tde.starY;
  const dist = Math.hypot(dx, dy) || 1;

  if (tde.stage === "STAR_APPROACH") {
    // Gravitational acceleration towards black hole
    const gForce = (bhRadius * 5200) / (dist * dist + 1800);
    tde.starVx += (dx / dist) * gForce * 0.9;
    tde.starVy += (dy / dist) * gForce * 0.9;

    tde.starX += tde.starVx;
    tde.starY += tde.starVy;
    tde.rotation = Math.atan2(dy, dx);

    // Asymmetric tidal stretching (Spaghettification) as it nears the Roche limit
    if (dist < rocheRadius * 2.4) {
      const tidalIntensity = Math.max(0, Math.min(1.0, 1.0 - (dist - bhRadius) / (rocheRadius * 2.4 - bhRadius)));
      tde.asymmetryFactor = Math.pow(tidalIntensity, 1.1);
      // Elongate forward while preserving a substantial, visible cross-section (never collapse into a needle)
      tde.stretchX = 1.0 + Math.pow(tidalIntensity, 1.2) * 1.8;
      tde.stretchY = Math.max(0.72, 1.0 - Math.pow(tidalIntensity, 1.0) * 0.28);

      // Continuous stripping of hot incandescent plasma sparks peeling from the leading edge
      if (Math.random() < 0.6 + tidalIntensity * 0.4) {
        const streamAngle = tde.rotation + (Math.random() - 0.5) * 0.4;
        const sparkSpeed = Math.hypot(tde.starVx, tde.starVy) * (1.1 + Math.random() * 0.5);
        tde.streamers.push({
          x: tde.starX + Math.cos(streamAngle) * (tde.starRadius * tde.stretchX * 1.1),
          y: tde.starY + Math.sin(streamAngle) * (tde.starRadius * tde.stretchX * 1.1),
          z: (Math.random() - 0.5) * 20,
          vx: Math.cos(streamAngle) * sparkSpeed,
          vy: Math.sin(streamAngle) * sparkSpeed,
          vz: (Math.random() - 0.5) * 4,
          color: Math.random() > 0.3 ? "#ffffff" : "#ffd778",
          life: 0.9,
          decay: 0.008 + Math.random() * 0.008,
          size: 2.2 + Math.random() * 3.2,
        });
      }
    }

    // Polytropic stellar disruption at the tidal radius r_t = R_* (M_BH / M_*)^(1/3)
    // (Guillochon & Ramirez-Ruiz 2013, arXiv:1206.2350; Rossi et al. 2021, arXiv:2005.12528)
    if (dist <= rocheRadius) {
      tde.stage = "ROCHE_RUPTURE";
      tde.ruptureTime = Date.now();
      tde.betaPenetration = 1.85; // Full disruption penetration factor beta = r_t / r_p >= 1.85 for gamma = 5/3 polytrope
      tde.fallbackExponent = -1.67; // Canonical dM/dt ~ t^(-5/3) fallback scaling
      tde.compressionFlash = 1.0; // Homologous vertical pancake compression shock at pericenter
      tde.statusMessage =
        "ROCHE LIMIT BREACHED (β=1.85): 50% BOUND FALLBACK (t^-5/3) / 50% UNBOUND HYPERBOLIC STREAM";
      audio.playTidalDisruption("spaghettify");
      cameraShakeRef.current = 18.0;
      ripplesRef.current.push({ x: tde.starX, y: tde.starY, life: 1.0 });

      // Continuous hydrodynamic debris filament condensations (replacing brittle rock shattering):
      // Frozen-in specific energy spread Delta_epsilon = G * M_BH * R_* / r_t^2 splits debris 50/50 into
      // bound returning filaments (epsilon < 0) and unbound hyperbolic filaments (epsilon > 0).
      const filamentColors = ["#ffffff", "#fff9c4", "#ffd54f", "#ff9800", "#ff5722"];
      tde.fragments = [];
      const numFilaments = 16;
      for (let f = 0; f < numFilaments; f++) {
        const specificEnergyNorm = (f / (numFilaments - 1)) * 2.0 - 1.0; // -1 (most bound) to +1 (most unbound)
        const isUnbound = specificEnergyNorm > 0;
        const offsetDist = specificEnergyNorm * (tde.starRadius * 1.45);
        const fAngle = tde.rotation + specificEnergyNorm * 0.22;
        const speedBoost = 1.0 + specificEnergyNorm * 0.38;
        tde.fragments.push({
          x: tde.starX - Math.cos(fAngle) * offsetDist,
          y: tde.starY - Math.sin(fAngle) * offsetDist,
          z: (Math.random() - 0.5) * 14,
          vx: tde.starVx * speedBoost * 0.72,
          vy: tde.starVy * speedBoost * 0.72,
          radius: Math.max(4.0, tde.starRadius * (0.22 - Math.abs(specificEnergyNorm) * 0.08)),
          color: filamentColors[f % filamentColors.length]!,
          life: 1.0,
          decay: isUnbound ? 0.0022 : 0.0016,
          rotation: fAngle,
          rotSpeed: 0.03,
          stretchX: 2.4 + Math.abs(specificEnergyNorm) * 1.4, // Thin hydrodynamical filament geometry
          stretchY: 0.35,
          isUnbound,
        });
      }

      // Spawn 340 hydrodynamic debris stream particles split 50/50 between bound (epsilon < 0) and unbound (epsilon > 0)
      const streamerColors = ["#ffffff", "#fff59d", "#ffd778", "#ff9800", "#ff5722"];
      for (let s = 0; s < 340; s++) {
        const isUnbound = s % 2 === 0; // Exact 50% bound, 50% unbound mass partition (Rees 1988; Rossi et al. 2021)
        const tangX = -dy / dist;
        const tangY = dx / dist;
        const radialDirX = dx / dist; // Toward BH (L1 bound lobe)
        const radialDirY = dy / dist;
        const lobeSign = isUnbound ? -1.0 : 1.0; // +1 toward BH (bound L1), -1 away from BH (unbound L2)
        const energySpread = (0.2 + Math.random() * 0.8) * lobeSign;
        const baseSpeed = Math.hypot(tde.starVx, tde.starVy);

        tde.streamers.push({
          x: tde.starX + radialDirX * energySpread * tde.starRadius * 1.15,
          y: tde.starY + radialDirY * energySpread * tde.starRadius * 1.15,
          z: (Math.random() - 0.5) * 28,
          vx:
            tde.starVx * (isUnbound ? 0.85 + Math.random() * 0.28 : 0.35 + Math.random() * 0.22) +
            tangX * baseSpeed * (isUnbound ? 0.65 : 0.45),
          vy:
            tde.starVy * (isUnbound ? 0.85 + Math.random() * 0.28 : 0.35 + Math.random() * 0.22) +
            tangY * baseSpeed * (isUnbound ? 0.65 : 0.45),
          vz: (Math.random() - 0.5) * 3.2,
          color: streamerColors[Math.floor(Math.random() * streamerColors.length)]!,
          life: 1.0,
          decay: isUnbound ? 0.0024 + Math.random() * 0.002 : 0.0016 + Math.random() * 0.002,
          size: Math.max(2.0, 2.0 + Math.random() * 3.8),
          isUnbound,
        });
      }
    }
  } else if (tde.stage === "ROCHE_RUPTURE") {
    // Hydrodynamic shredding: differential gravity strips stellar envelope into bound & unbound tidal streams
    const tidalStrain = Math.pow(rocheRadius / Math.max(bhRadius * 1.05, dist), 2.0);
    const dissipationRate = 0.0048 * (1.0 + Math.min(2.2, tidalStrain));
    tde.starMass = Math.max(0, tde.starMass - dissipationRate);
    tde.shredDissipation = Math.min(1.0, 1.0 - tde.starMass);
    // Polytropic stellar radius reduces as mass is shredded into stream, preserving core density
    tde.starRadius = tde.initialRadius * Math.pow(Math.max(0.001, tde.starMass), 1.0 / 3.0);
    tde.stretchX = Math.min(3.8, tde.stretchX + 0.018 * tidalStrain);
    tde.asymmetryFactor = Math.min(1.0, tde.asymmetryFactor + 0.025);
    tde.compressionFlash = Math.max(0, tde.compressionFlash - 0.016);

    // Update remaining star core movement
    tde.starX += tde.starVx * 0.38;
    tde.starY += tde.starVy * 0.38;

    // Update bound & unbound hydrodynamic stream knots
    const activeFragments: TdeFragment[] = [];
    for (let f = 0; f < tde.fragments.length; f++) {
      const frag = tde.fragments[f]!;
      frag.life -= frag.decay;
      if (frag.life <= 0) continue;

      const fdx = cx - frag.x;
      const fdy = cy - frag.y;
      const fdist = Math.hypot(fdx, fdy) || 1;

      if (fdist <= bhRadius * 1.12) {
        // Swallowed by event horizon
        ripplesRef.current.push({ x: frag.x, y: frag.y, life: 0.6 });
        continue;
      }

      const fPull = (bhRadius * 9500) / (fdist * fdist + 1400);
      const tangX = -fdy / fdist;
      const tangY = fdx / fdist;

      if (frag.isUnbound) {
        // Unbound debris (epsilon > 0) escapes along hyperbolic trajectory with weak gravity deflection
        frag.vx += (fdx / fdist) * fPull * 0.012;
        frag.vy += (fdy / fdist) * fPull * 0.012;
      } else {
        // Bound debris (epsilon < 0) undergoes relativistic apsidal precession & circularization
        frag.vx += (fdx / fdist) * fPull * 0.042 + tangX * 1.75 * (bhRadius / fdist);
        frag.vy += (fdy / fdist) * fPull * 0.042 + tangY * 1.75 * (bhRadius / fdist);
        frag.vx *= 0.988;
        frag.vy *= 0.988;
      }

      frag.x += frag.vx;
      frag.y += frag.vy;
      frag.rotation = Math.atan2(frag.vy, frag.vx);
      frag.stretchX = Math.min(3.4, frag.stretchX + 0.018);
      frag.radius *= 0.996;

      activeFragments.push(frag);
    }
    tde.fragments = activeFragments;

    // Transition to Stream-Stream Circularization & t^(-5/3) Fallback Surge
    if (tde.starMass <= 0.03 && tde.fragments.length <= 4) {
      tde.starMass = 0;
      tde.starRadius = 0;
      tde.stage = "ACCRETION_SURGE";
      tde.statusMessage =
        "STREAM-STREAM SHOCK CIRCULARIZATION: SUPER-EDDINGTON FALLBACK (dM/dt ∝ t^-5/3)";
    }
  } else if (tde.stage === "ACCRETION_SURGE") {
    tde.accretionGlowMultiplier = Math.min(4.8, tde.accretionGlowMultiplier + 0.032);

    // Update remaining filaments
    const activeFragments: TdeFragment[] = [];
    for (let f = 0; f < tde.fragments.length; f++) {
      const frag = tde.fragments[f]!;
      frag.life -= frag.decay * 1.2;
      if (frag.life <= 0) continue;
      frag.x += frag.vx;
      frag.y += frag.vy;
      frag.radius *= 0.985;
      if (frag.radius > 1.2) activeFragments.push(frag);
    }
    tde.fragments = activeFragments;

    // Launch Relativistic Jetted TDE Outflow (Swift J1644+57 class Blandford-Znajek jet, not a standard GRB)
    if (tde.accretionGlowMultiplier >= 4.2) {
      tde.stage = "GRB_DETONATION";
      tde.statusMessage =
        "RELATIVISTIC JETTED TDE OUTFLOW (SWIFT J1644 CLASS): BLANDFORD-ZNAJEK POLAR JET";
      tde.grbBeamIntensity = 1.0;
      tde.grbShockwaveRadius = 24;
      audio.playTidalDisruption("grb");
      cameraShakeRef.current = 20.0;
      ripplesRef.current.push({ x: cx, y: cy, life: 1.0 });

      // Initialize relativistic internal shock knots along north & south polar axes
      tde.jetKnots = [];
      for (let k = 0; k < 8; k++) {
        tde.jetKnots.push({
          distance: bhRadius * 0.5 + k * 45,
          speed: 14 + Math.random() * 10,
          intensity: 0.85 + Math.random() * 0.15,
          size: 4 + Math.random() * 6,
          direction: k % 2 === 0 ? 1 : -1,
        });
      }
    }
  } else if (tde.stage === "GRB_DETONATION") {
    // Expand radiative circularization shockwave & advance relativistic jet knots
    tde.grbShockwaveRadius += 12;
    cameraShakeRef.current = Math.max(cameraShakeRef.current, 10.0);

    tde.jetKnots.forEach((knot) => {
      knot.distance += knot.speed;
      knot.intensity *= 0.986;
    });

    if (tde.grbShockwaveRadius > Math.max(screenWidth, screenHeight) * 1.35) {
      tde.stage = "COOLDOWN";
      tde.statusMessage = "TDE FALLBACK DECAY: L(t) ∝ (t / t_fb)^(-5/3) ASYMPTOTE";
    }
  } else if (tde.stage === "COOLDOWN") {
    // Authentic t^(-5/3) fallback luminosity decay curve (Guillochon & Ramirez-Ruiz 2013, arXiv:1206.2350)
    const elapsedSinceRuptureSec = Math.max(0.5, (Date.now() - (tde.ruptureTime || tde.startTime)) / 1000);
    const tFbCharacteristic = 4.2; // Characteristic fallback timescale in simulation seconds
    const powerLawDecay = Math.pow(Math.max(1.0, elapsedSinceRuptureSec / tFbCharacteristic), -5.0 / 3.0);
    tde.grbBeamIntensity = Math.max(0, Math.min(tde.grbBeamIntensity - 0.0055, powerLawDecay));
    tde.accretionGlowMultiplier = Math.max(1.0, 1.0 + 3.8 * powerLawDecay);

    tde.jetKnots.forEach((knot) => {
      knot.distance += knot.speed * 0.65;
      knot.intensity = Math.max(0, knot.intensity - 0.008);
    });

    if (tde.grbBeamIntensity <= 0.01 && tde.accretionGlowMultiplier <= 1.08) {
      tde.isActive = false;
      tde.stage = "IDLE";
      tde.statusMessage = "Singularity Core Stable";
      tde.streamers = [];
      tde.fragments = [];
      tde.jetKnots = [];
    }
  }

  // Update bound fallback stream (epsilon < 0) & unbound hyperbolic ejecta tail (epsilon > 0)
  const nextStreamers: TdeStreamerParticle[] = [];
  const decayMult = tde.stage === "COOLDOWN" ? 2.2 : 1.0;
  for (let i = 0; i < tde.streamers.length; i++) {
    const p = tde.streamers[i];
    if (!p) continue;
    p.life -= p.decay * decayMult;
    if (p.life <= 0) continue;

    const pdx = cx - p.x;
    const pdy = cy - p.y;
    const pdist = Math.hypot(pdx, pdy) || 1;

    if (pdist <= bhRadius * 1.05) {
      // Accreted across the event horizon
      continue;
    }

    const pull = (bhRadius * 14000) / (pdist * pdist + 220);
    const tangX = -pdy / pdist;
    const tangY = pdx / pdist;

    if (p.isUnbound) {
      // Unbound debris (50% of stellar mass, epsilon > 0) escapes hyperbolically to infinity
      p.vx += (pdx / pdist) * pull * 0.012;
      p.vy += (pdy / pdist) * pull * 0.012;
    } else {
      // Bound debris (50% of stellar mass, epsilon < 0) returns to pericenter & circularizes via apsidal precession
      const swirlForce = 6.8 * (bhRadius / pdist);
      p.vx += (pdx / pdist) * pull * 0.05 + tangX * swirlForce;
      p.vy += (pdy / pdist) * pull * 0.05 + tangY * swirlForce;
      p.vx *= 0.982;
      p.vy *= 0.982;
    }

    p.x += p.vx;
    p.y += p.vy;
    p.z += p.vz;

    nextStreamers.push(p);
  }
  tde.streamers = nextStreamers;
}
