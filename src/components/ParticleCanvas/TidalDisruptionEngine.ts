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
  compressionFlash: number; // Thermonuclear core compression flash flare
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
  if (!tdeState) return false;
  if (tdeState.isActive && tdeState.stage !== "COOLDOWN") {
    return false;
  }

  const safeWidth = isFinite(screenWidth) && screenWidth > 0 ? screenWidth : 1920;
  const safeHeight = isFinite(screenHeight) && screenHeight > 0 ? screenHeight : 1080;

  // Locate the black hole or center
  const entities = Array.isArray(celestialEntities) ? celestialEntities : [];
  const bh = entities.find((e) => e && !e.isDestroyed && e.type === "blackhole");
  const cx = bh ? bh.x : safeWidth / 2;
  const cy = bh ? bh.y : safeHeight / 2;
  const bhRadius = bh ? bh.radius : 65;

  // Position the rogue star on a high-velocity hyperbolic inbound trajectory towards the black hole
  const spawnAngle = Math.PI * 1.25;
  const spawnDist = Math.max(safeWidth * 0.42, 640);
  const startX = cx + Math.cos(spawnAngle) * spawnDist;
  const startY = cy + Math.sin(spawnAngle) * spawnDist;

  // Aim trajectory to plunge right into the Roche limit
  const targetPericenter = bhRadius * 1.75;
  const targetX = cx + targetPericenter;
  const targetY = cy + targetPericenter * 0.35;

  const dx = targetX - startX;
  const dy = targetY - startY;
  const dist = Math.hypot(dx, dy) || 1;
  const initialSpeed = 17.5;

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

  if (audio?.playTidalDisruption) {
    audio.playTidalDisruption("approach");
  }
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
  if (!tde || !tde.isActive) return;

  const safeWidth = isFinite(screenWidth) && screenWidth > 0 ? screenWidth : 1920;
  const safeHeight = isFinite(screenHeight) && screenHeight > 0 ? screenHeight : 1080;

  const entities = Array.isArray(celestialEntities) ? celestialEntities : [];
  const bh = entities.find((e) => e && !e.isDestroyed && e.type === "blackhole");
  const cx = bh ? bh.x : safeWidth / 2;
  const cy = bh ? bh.y : safeHeight / 2;
  const bhRadius = bh ? bh.radius : 65;
  const rocheRadius = bhRadius * 2.85;

  const dx = cx - tde.starX;
  const dy = cy - tde.starY;
  const dist = Math.hypot(dx, dy) || 1;

  if (tde.stage === "STAR_APPROACH") {
    // Gravitational acceleration towards black hole
    const gForce = (bhRadius * 15500) / (dist * dist + 1500);
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
          decay: 0.015 + Math.random() * 0.015,
          size: 2.2 + Math.random() * 3.2,
        });
      }
    }

    // Stellar core rupture at Roche limit
    if (dist <= rocheRadius) {
      tde.stage = "ROCHE_RUPTURE";
      tde.compressionFlash = 1.0;
      tde.statusMessage = "ROCHE LIMIT BREACHED: STELLAR CORE DISRUPTED INTO TIDAL DEBRIS STREAM";
      if (audio?.playTidalDisruption) {
        audio.playTidalDisruption("spaghettify");
      }
      if (cameraShakeRef) cameraShakeRef.current = 24.0;
      if (Array.isArray(ripplesRef?.current)) {
        while (ripplesRef.current.length >= 25) {
          ripplesRef.current.shift();
        }
        ripplesRef.current.push({ x: tde.starX, y: tde.starY, life: 1.0 });
      }

      // Disintegrate the star into 16 glowing stellar fragments with varied masses and orbits
      const fragmentColors = ["#ffffff", "#fff9c4", "#ffd54f", "#ff9800", "#ff5722", "#4deeea"];
      tde.fragments = [];
      const numFragments = 16;
      for (let f = 0; f < numFragments; f++) {
        const offsetDist = (f - numFragments / 2) * (tde.starRadius * 0.32);
        const fAngle = tde.rotation + (Math.random() - 0.5) * 0.5;
        const fragSpeedMult = 0.8 + (f / numFragments) * 0.45 + (Math.random() - 0.5) * 0.25;
        tde.fragments.push({
          x: tde.starX + Math.cos(fAngle) * offsetDist,
          y: tde.starY + Math.sin(fAngle) * offsetDist,
          z: (Math.random() - 0.5) * 25,
          vx: tde.starVx * fragSpeedMult + (Math.random() - 0.5) * 4.0,
          vy: tde.starVy * fragSpeedMult + (Math.random() - 0.5) * 4.0,
          radius: Math.max(5.0, tde.starRadius * (0.2 + Math.random() * 0.25)),
          color: fragmentColors[f % fragmentColors.length]!,
          life: 1.0,
          decay: 0.003 + Math.random() * 0.004,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.18,
          stretchX: 1.2 + Math.random() * 0.6,
          stretchY: 0.75 + Math.random() * 0.25,
        });
      }

      // Spawn 320+ tidal streamer particles curling into the accretion disk
      const streamerColors = ["#ffffff", "#fff59d", "#ffd778", "#ff9800", "#ff5722", "#4deeea"];
      for (let s = 0; s < 320; s++) {
        const spreadAngle = (Math.random() - 0.5) * 0.9;
        const tangX = -dy / dist;
        const tangY = dx / dist;
        const radSpread = (Math.random() - 0.5) * (tde.starRadius * 1.5);
        const streamerSpeed = Math.hypot(tde.starVx, tde.starVy) * (0.65 + Math.random() * 0.8);

        tde.streamers.push({
          x: tde.starX + radSpread * tangX,
          y: tde.starY + radSpread * tangY,
          z: (Math.random() - 0.5) * 45,
          vx: tde.starVx * 0.35 + tangX * streamerSpeed * (Math.random() > 0.4 ? 1 : 0.6) + Math.cos(spreadAngle) * 3.5,
          vy: tde.starVy * 0.35 + tangY * streamerSpeed * (Math.random() > 0.4 ? 1 : 0.6) + Math.sin(spreadAngle) * 3.5,
          vz: (Math.random() - 0.5) * 6,
          color: streamerColors[Math.floor(Math.random() * streamerColors.length)]!,
          life: 1.0,
          decay: 0.004 + Math.random() * 0.006,
          size: Math.max(2.2, 2.2 + Math.random() * 4.5),
        });
      }
    }
  } else if (tde.stage === "ROCHE_RUPTURE") {
    // Hydrodynamic shredding: differential gravity strips stellar envelope into accretion stream
    const tidalStrain = Math.pow(rocheRadius / Math.max(bhRadius * 1.05, dist), 2.0);
    const dissipationRate = 0.022 * (1.0 + Math.min(2.5, tidalStrain));
    tde.starMass = Math.max(0, tde.starMass - dissipationRate);
    tde.shredDissipation = Math.min(1.0, 1.0 - tde.starMass);
    // Polytropic stellar radius reduces as mass is shredded into stream, preserving core density
    tde.starRadius = tde.initialRadius * Math.pow(Math.max(0.001, tde.starMass), 1.0 / 3.0);
    tde.stretchX = Math.min(3.8, tde.stretchX + 0.04 * tidalStrain);
    tde.asymmetryFactor = Math.min(1.0, tde.asymmetryFactor + 0.05);
    tde.compressionFlash = Math.max(0, tde.compressionFlash - 0.035);

    // Update remaining star core movement
    tde.starX += tde.starVx * 0.85;
    tde.starY += tde.starVy * 0.85;

    // Update fragments in orbit around black hole
    const activeFragments: TdeFragment[] = [];
    for (let f = 0; f < tde.fragments.length; f++) {
      const frag = tde.fragments[f]!;
      if (
        !frag ||
        !isFinite(frag.x) ||
        !isFinite(frag.y) ||
        !isFinite(frag.vx) ||
        !isFinite(frag.vy) ||
        !isFinite(frag.radius) ||
        frag.radius <= 0
      ) {
        continue;
      }
      frag.life -= frag.decay;
      if (frag.life <= 0) continue;

      const fdx = cx - frag.x;
      const fdy = cy - frag.y;
      const fdist = Math.hypot(fdx, fdy) || 1;

      if (fdist <= bhRadius * 1.12) {
        // Swallowed by event horizon
        if (Array.isArray(ripplesRef?.current)) {
          while (ripplesRef.current.length >= 25) {
            ripplesRef.current.shift();
          }
          ripplesRef.current.push({ x: frag.x, y: frag.y, life: 0.6 });
        }
        continue;
      }

      // Strong Keplerian pull + orbital swirl
      const fPull = (bhRadius * 16000) / (fdist * fdist + 1200);
      const tangX = -fdy / fdist;
      const tangY = fdx / fdist;

      frag.vx += (fdx / fdist) * fPull * 0.045 + tangX * 2.2 * (bhRadius / fdist);
      frag.vy += (fdy / fdist) * fPull * 0.045 + tangY * 2.2 * (bhRadius / fdist);
      frag.vx *= 0.985;
      frag.vy *= 0.985;

      frag.x += frag.vx;
      frag.y += frag.vy;
      frag.rotation += frag.rotSpeed;
      frag.stretchX = Math.min(2.5, frag.stretchX + 0.03);
      frag.radius *= 0.993;

      activeFragments.push(frag);
    }
    tde.fragments = activeFragments;

    // Transition to Accretion Surge when star mass is completely shredded into accretion stream
    const isMassDepleted = tde.starMass <= 0.03 && tde.fragments.length <= 4;
    const isProgressionTimedOut = tde.starMass <= 0.01 && (Date.now() - tde.startTime > 6500);
    if (isMassDepleted || isProgressionTimedOut) {
      tde.starMass = 0;
      tde.starRadius = 0;
      tde.stage = "ACCRETION_SURGE";
      tde.statusMessage = "ACCRETION SURGE: HYPER-LUMINOUS MASS FEEDING DISK";
    }
  } else if (tde.stage === "ACCRETION_SURGE") {
    tde.accretionGlowMultiplier = Math.min(4.8, tde.accretionGlowMultiplier + 0.16);

    // Update remaining fragments
    const activeFragments: TdeFragment[] = [];
    for (let f = 0; f < tde.fragments.length; f++) {
      const frag = tde.fragments[f]!;
      frag.life -= frag.decay * 1.5;
      if (frag.life <= 0) continue;
      frag.x += frag.vx;
      frag.y += frag.vy;
      frag.radius *= 0.97;
      if (frag.radius > 1.2) activeFragments.push(frag);
    }
    tde.fragments = activeFragments;

    // After feeding mass, trigger Relativistic Polar Gamma-Ray Burst
    if (tde.accretionGlowMultiplier >= 4.2) {
      tde.stage = "GRB_DETONATION";
      tde.statusMessage = "RELATIVISTIC GAMMA-RAY BURST (GRB) OUTFLOW DETONATED";
      tde.grbBeamIntensity = 1.0;
      tde.grbShockwaveRadius = 24;
      if (audio?.playTidalDisruption) {
        audio.playTidalDisruption("grb");
      }
      if (cameraShakeRef) cameraShakeRef.current = 28.0;
      if (Array.isArray(ripplesRef?.current)) {
        while (ripplesRef.current.length >= 25) {
          ripplesRef.current.shift();
        }
        ripplesRef.current.push({ x: cx, y: cy, life: 1.0 });
      }

      // Initialize relativistic jet knots along north & south polar axes
      tde.jetKnots = [];
      for (let k = 0; k < 8; k++) {
        tde.jetKnots.push({
          distance: bhRadius * 0.5 + k * 45,
          speed: 26 + Math.random() * 18,
          intensity: 0.8 + Math.random() * 0.2,
          size: 4 + Math.random() * 6,
          direction: k % 2 === 0 ? 1 : -1,
        });
      }
    }
  } else if (tde.stage === "GRB_DETONATION") {
    // Expand polar GRB shockwave rings & advance relativistic knots
    tde.grbShockwaveRadius += 30;
    if (cameraShakeRef) {
      cameraShakeRef.current = Math.max(cameraShakeRef.current || 0, 14.0);
    }

    // Advance relativistic shock knots along the jet
    tde.jetKnots.forEach((knot) => {
      knot.distance += knot.speed;
      knot.intensity *= 0.97;
    });

    if (tde.grbShockwaveRadius > Math.max(screenWidth, screenHeight) * 1.35) {
      tde.stage = "COOLDOWN";
      tde.statusMessage = "TDE COMPLETE: ACCRETION EQUILIBRIUM RESTORED";
    }
  } else if (tde.stage === "COOLDOWN") {
    // Cool down beam and accretion glow back to 1.0 quiescent state
    tde.grbBeamIntensity = Math.max(0, tde.grbBeamIntensity - 0.016);
    tde.accretionGlowMultiplier = Math.max(1.0, tde.accretionGlowMultiplier - 0.022);

    tde.jetKnots.forEach((knot) => {
      knot.distance += knot.speed * 0.8;
      knot.intensity = Math.max(0, knot.intensity - 0.02);
    });

    if (tde.grbBeamIntensity <= 0.01 && tde.accretionGlowMultiplier <= 1.05) {
      tde.isActive = false;
      tde.stage = "IDLE";
      tde.statusMessage = "Singularity Core Stable";
      tde.streamers = [];
      tde.fragments = [];
      tde.jetKnots = [];
    }
  }

  // Update spiraling streamer particles
  const nextStreamers: TdeStreamerParticle[] = [];
  const decayMult = tde.stage === "COOLDOWN" ? 2.5 : 1.0;
  for (let i = 0; i < tde.streamers.length; i++) {
    const p = tde.streamers[i];
    if (
      !p ||
      !isFinite(p.x) ||
      !isFinite(p.y) ||
      !isFinite(p.z) ||
      !isFinite(p.vx) ||
      !isFinite(p.vy) ||
      !isFinite(p.vz) ||
      isNaN(p.life) ||
      p.life <= 0
    ) {
      continue;
    }
    p.life -= p.decay * decayMult;
    if (p.life <= 0) continue;

    const pdx = cx - p.x;
    const pdy = cy - p.y;
    const pdist = Math.hypot(pdx, pdy) || 1;

    // Keplerian pull + orbital swirl
    if (pdist <= bhRadius * 1.05) {
      // Swallowed by event horizon
      continue;
    }

    const pull = (bhRadius * 14000) / (pdist * pdist + 220);
    const tangX = -pdy / pdist;
    const tangY = pdx / pdist;
    const swirlForce = 6.8 * (bhRadius / pdist);

    p.vx += (pdx / pdist) * pull * 0.05 + tangX * swirlForce;
    p.vy += (pdy / pdist) * pull * 0.05 + tangY * swirlForce;
    p.vx *= 0.982;
    p.vy *= 0.982;

    p.x += p.vx;
    p.y += p.vy;
    p.z += p.vz;

    nextStreamers.push(p);
  }
  tde.streamers = nextStreamers.length > 400 ? nextStreamers.slice(-400) : nextStreamers;
}
