import * as BABYLON from "@babylonjs/core";
import { TdeState } from "./TidalDisruptionEngine";
import { CelestialEntity } from "./types";

export interface TidalDisruptionFXInstance {
  isDisposed: boolean;
  dispose: () => void;
  update: (
    now: number,
    tde: TdeState,
    blackHole: CelestialEntity | null,
    screenWidth: number,
    screenHeight: number
  ) => void;
}

/**
 * High-fidelity 3D Multi-Layered Particle Spray and Shredding Shader System
 * for Tidal Disruption Events (TDE) around supermassive black holes.
 *
 * Implements:
 * 1. Layer 1 (Dense Core): 2,500 particles with custom "Shredding" GPU vertex & fragment shader,
 *    simulating hydrodynamic tidal stretching and mass dissipation into accretion streamers.
 * 2. Layer 2 (Gaseous Mantle Spray): 2,500 particles simulating outer envelope stripping into parabolic plumes.
 * 3. Layer 3 (Accretion Stream): 3,500 particles modeling Keplerian debris falling onto the event horizon.
 * 4. Layer 4 (Relativistic Polar Spray): 2,000 particles simulating collimated biconical relativistic jets & shock knots.
 */
export function spawnTidalDisruptionFX(scene: BABYLON.Scene): TidalDisruptionFXInstance {
  if (!scene || scene.isDisposed) {
    return {
      get isDisposed() {
        return true;
      },
      dispose: () => {},
      update: () => {},
    };
  }

  let isDisposed = false;
  const disposables: { dispose: () => void }[] = [];

  // =========================================================================
  // LAYER 1: DENSE CORE PLASMA PARTICLES & SHREDDING SHADER
  // =========================================================================
  const CORE_COUNT = 2500;
  const coreMesh = new BABYLON.Mesh("tde_core_spray", scene);
  disposables.push(coreMesh);

  // Buffer data for Core
  const corePositions = new Float32Array(CORE_COUNT * 3);
  const coreNormals = new Float32Array(CORE_COUNT * 3); // Encodes rest relative offset (nx, ny, nz)
  const coreUVs = new Float32Array(CORE_COUNT * 2);     // u: radial distance (0..1), v: random seed (0..1)
  const coreColors = new Float32Array(CORE_COUNT * 4);

  for (let i = 0; i < CORE_COUNT; i++) {
    // Generate uniform sphere distribution with radial concentration
    const u = Math.random();
    const v = Math.random();
    const theta = u * 2.0 * Math.PI;
    const phi = Math.acos(2.0 * v - 1.0);
    // Radial density concentrated in stellar core: r ~ pow(rand, 0.45)
    const r = Math.pow(Math.random(), 0.45);

    const nx = r * Math.sin(phi) * Math.cos(theta);
    const ny = r * Math.sin(phi) * Math.sin(theta);
    const nz = r * Math.cos(phi);

    coreNormals[i * 3 + 0] = nx;
    coreNormals[i * 3 + 1] = ny;
    coreNormals[i * 3 + 2] = nz;

    corePositions[i * 3 + 0] = 0;
    corePositions[i * 3 + 1] = 0;
    corePositions[i * 3 + 2] = 0;

    coreUVs[i * 2 + 0] = r;              // radial dist
    coreUVs[i * 2 + 1] = Math.random();  // seed

    // Photosphere core initial color: Warm solar incandescent gold
    coreColors[i * 4 + 0] = 1.0;
    coreColors[i * 4 + 1] = 0.88;
    coreColors[i * 4 + 2] = 0.55;
    coreColors[i * 4 + 3] = 1.0;
  }

  const coreVertexData = new BABYLON.VertexData();
  coreVertexData.positions = corePositions;
  coreVertexData.normals = coreNormals;
  coreVertexData.uvs = coreUVs;
  coreVertexData.colors = coreColors;
  coreVertexData.applyToMesh(coreMesh, true);

  // Shredding Shader Material
  const shreddingShaderMat = new BABYLON.ShaderMaterial(
    "tde_shredding_shader",
    scene,
    {
      vertexSource: `
        precision highp float;
        attribute vec3 position;
        attribute vec3 normal; // relative unit offset
        attribute vec2 uv;     // uv.x = normalized radius, uv.y = seed
        attribute vec4 color;

        uniform mat4 worldViewProjection;
        uniform mat4 world;
        uniform vec3 uStarPos;
        uniform vec3 uBhPos;
        uniform float uStarRadius;
        uniform float uTidalStrain;
        uniform float uDissipation;
        uniform float uCompressionFlash;
        uniform float uTime;
        uniform float uDpr;

        varying vec4 vColor;
        varying float vFlash;
        varying float vDissipate;

        void main() {
          vec3 tidalDir = normalize(uBhPos - uStarPos);
          if (length(uBhPos - uStarPos) < 0.001) {
            tidalDir = vec3(1.0, 0.0, 0.0);
          }

          // Cross vector for orbital plane
          vec3 perpDir = normalize(cross(tidalDir, vec3(0.0, 0.0, 1.0)));
          if (length(perpDir) < 0.001) perpDir = vec3(0.0, 1.0, 0.0);
          vec3 normDir = cross(tidalDir, perpDir);

          float r = uStarRadius * (1.0 - uDissipation * 0.35);

          // Rest position on the stellar body
          vec3 restOffset = (normal.x * perpDir + normal.y * normDir + normal.z * vec3(0.0, 0.0, 1.0)) * r;

          // Projection along tidal axis toward the black hole
          float tidalProj = dot(normal, vec3(1.0, 0.0, 0.0));

          // 1. Spaghettification & Tidal Stretching
          float elongation = uTidalStrain * (1.2 + tidalProj * 1.8);
          vec3 stretchOffset = tidalDir * (tidalProj * r * elongation);

          // 2. Transverse Tidal Compression
          float compFactor = 1.0 / sqrt(max(0.2, 1.0 + uTidalStrain * 0.8));
          vec3 compOffset = (restOffset - dot(restOffset, tidalDir) * tidalDir) * compFactor;

          // 3. Dynamic Mass Shredding & Filament Dispersal
          // Outer particles (uv.x near 1.0) peel off first into turbulent accretion streamers
          float peelThreshold = 1.0 - uDissipation;
          float isStripped = step(peelThreshold, uv.x);
          float stripSeverity = max(0.0, uv.x - peelThreshold) / max(0.01, uDissipation + 0.01);

          // Chaotic Keplerian shear streamer displacement
          float streamPhase = uTime * 0.003 + uv.y * 6.2831;
          vec3 streamerDrift = (tidalDir * (stripSeverity * 140.0) +
                               perpDir * (sin(streamPhase) * stripSeverity * 65.0) +
                               normDir * (cos(streamPhase * 1.3) * stripSeverity * 35.0)) * isStripped;

          vec3 finalPos = uStarPos + compOffset + stretchOffset + streamerDrift;

          // Compute particle point size based on compression and proximity
          float pointSize = (3.5 + uCompressionFlash * 5.0) * uDpr;
          if (isStripped > 0.5) {
            pointSize = max(1.8, pointSize * (1.0 - stripSeverity * 0.5));
          }
          gl_PointSize = clamp(pointSize, 2.0, 32.0);

          // Blackbody radiation color transition
          // Approaching: Solar Gold -> Periapsis: Incandescent White Compression -> Shredded: Hot Orange Accretion Stream
          vec3 baseColor = mix(vec3(1.0, 0.82, 0.4), vec3(1.0, 0.45, 0.1), uv.x * 0.8);
          vec3 flashColor = vec3(1.0, 1.0, 1.0);
          vec3 shreddedColor = mix(vec3(1.0, 0.6, 0.15), vec3(0.95, 0.25, 0.05), stripSeverity);

          vec3 finalColor = mix(baseColor, flashColor, uCompressionFlash * 0.95);
          finalColor = mix(finalColor, shreddedColor, isStripped * 0.7);

          float alpha = (1.0 - uDissipation * 0.45) * (1.0 - stripSeverity * 0.3);

          vColor = vec4(finalColor, clamp(alpha, 0.15, 1.0));
          vFlash = uCompressionFlash;
          vDissipate = uDissipation;

          gl_Position = worldViewProjection * vec4(finalPos, 1.0);
        }
      `,
      fragmentSource: `
        precision highp float;
        varying vec4 vColor;
        varying float vFlash;
        varying float vDissipate;

        void main() {
          // Circular Gaussian particle disc with soft anti-aliased edge
          vec2 coord = gl_PointCoord - vec2(0.5);
          float distSq = dot(coord, coord);
          if (distSq > 0.25) discard;

          // Gaussian radial glow
          float intensity = exp(-distSq * 9.0);

          // Intense core bloom during thermonuclear compression flash
          vec3 rgb = vColor.rgb * (1.0 + vFlash * 1.4);
          float alpha = vColor.a * intensity;

          gl_FragColor = vec4(rgb * alpha, alpha);
        }
      `,
    },
    {
      attributes: ["position", "normal", "uv", "color"],
      uniforms: [
        "worldViewProjection",
        "world",
        "uStarPos",
        "uBhPos",
        "uStarRadius",
        "uTidalStrain",
        "uDissipation",
        "uCompressionFlash",
        "uTime",
        "uDpr"
      ],
      needAlphaBlending: true,
    }
  );
  shreddingShaderMat.pointsCloud = true;
  shreddingShaderMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
  shreddingShaderMat.disableDepthWrite = true;
  shreddingShaderMat.backFaceCulling = false;
  coreMesh.material = shreddingShaderMat;
  disposables.push(shreddingShaderMat);

  // =========================================================================
  // LAYER 2: GASEOUS ENVELOPE / MANTLE SPRAY PARTICLES
  // =========================================================================
  const ENVELOPE_COUNT = 2500;
  const envMesh = new BABYLON.Mesh("tde_envelope_spray", scene);
  disposables.push(envMesh);

  interface EnvParticle {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    life: number;
    maxLife: number;
    radiusRel: number;
    angle: number;
    speed: number;
    colorR: number;
    colorG: number;
    colorB: number;
  }

  const envParticles: EnvParticle[] = [];
  const envPositions = new Float32Array(ENVELOPE_COUNT * 3);
  const envColors = new Float32Array(ENVELOPE_COUNT * 4);

  for (let i = 0; i < ENVELOPE_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const rRel = 1.0 + Math.random() * 0.8; // Just outside the core
    envParticles.push({
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      maxLife: 60 + Math.random() * 80,
      radiusRel: rRel,
      angle,
      speed: 0.5 + Math.random() * 1.5,
      colorR: 1.0,
      colorG: 0.65 + Math.random() * 0.3,
      colorB: 0.15 + Math.random() * 0.25,
    });
    envColors[i * 4 + 0] = 1.0;
    envColors[i * 4 + 1] = 0.7;
    envColors[i * 4 + 2] = 0.2;
    envColors[i * 4 + 3] = 0.0;
  }

  const envVertexData = new BABYLON.VertexData();
  envVertexData.positions = envPositions;
  envVertexData.colors = envColors;
  envVertexData.applyToMesh(envMesh, true);

  const envMat = new BABYLON.ShaderMaterial(
    "tde_envelope_mat",
    scene,
    {
      vertexSource: `
        precision highp float;
        attribute vec3 position;
        attribute vec4 color;
        uniform mat4 worldViewProjection;
        uniform float uDpr;
        varying vec4 vColor;
        void main() {
          vColor = color;
          gl_PointSize = clamp(3.0 * uDpr, 2.0, 16.0);
          gl_Position = worldViewProjection * vec4(position, 1.0);
        }
      `,
      fragmentSource: `
        precision highp float;
        varying vec4 vColor;
        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          float distSq = dot(coord, coord);
          if (distSq > 0.25) discard;
          float intensity = exp(-distSq * 8.0);
          gl_FragColor = vec4(vColor.rgb * vColor.a * intensity, vColor.a * intensity);
        }
      `,
    },
    {
      attributes: ["position", "color"],
      uniforms: ["worldViewProjection", "uDpr"],
      needAlphaBlending: true,
    }
  );
  envMat.pointsCloud = true;
  envMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
  envMat.disableDepthWrite = true;
  envMesh.material = envMat;
  disposables.push(envMat);

  // =========================================================================
  // LAYER 3: RELATIVISTIC ACCRETION STREAM PARTICLES
  // =========================================================================
  const ACCRETION_COUNT = 3500;
  const accretionMesh = new BABYLON.Mesh("tde_accretion_stream", scene);
  disposables.push(accretionMesh);

  interface AccretionParticle {
    orbitR: number;
    orbitAngle: number;
    radialVel: number;
    angularVel: number;
    orbitInclination: number;
    energy: number;
    active: boolean;
    life: number;
  }

  const accretionParticles: AccretionParticle[] = [];
  const accPositions = new Float32Array(ACCRETION_COUNT * 3);
  const accColors = new Float32Array(ACCRETION_COUNT * 4);

  for (let i = 0; i < ACCRETION_COUNT; i++) {
    accretionParticles.push({
      orbitR: 0,
      orbitAngle: Math.random() * Math.PI * 2,
      radialVel: 0,
      angularVel: 0.02 + Math.random() * 0.04,
      orbitInclination: (Math.random() - 0.5) * 0.25,
      energy: Math.random(),
      active: false,
      life: 0,
    });
    accColors[i * 4 + 0] = 1.0;
    accColors[i * 4 + 1] = 0.85;
    accColors[i * 4 + 2] = 0.35;
    accColors[i * 4 + 3] = 0.0;
  }

  const accVertexData = new BABYLON.VertexData();
  accVertexData.positions = accPositions;
  accVertexData.colors = accColors;
  accVertexData.applyToMesh(accretionMesh, true);

  const accMat = new BABYLON.ShaderMaterial(
    "tde_acc_mat",
    scene,
    {
      vertexSource: `
        precision highp float;
        attribute vec3 position;
        attribute vec4 color;
        uniform mat4 worldViewProjection;
        uniform float uDpr;
        varying vec4 vColor;
        void main() {
          vColor = color;
          gl_PointSize = clamp(3.2 * uDpr, 2.0, 20.0);
          gl_Position = worldViewProjection * vec4(position, 1.0);
        }
      `,
      fragmentSource: `
        precision highp float;
        varying vec4 vColor;
        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          float distSq = dot(coord, coord);
          if (distSq > 0.25) discard;
          float intensity = exp(-distSq * 10.0);
          gl_FragColor = vec4(vColor.rgb * vColor.a * intensity, vColor.a * intensity);
        }
      `,
    },
    {
      attributes: ["position", "color"],
      uniforms: ["worldViewProjection", "uDpr"],
      needAlphaBlending: true,
    }
  );
  accMat.pointsCloud = true;
  accMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
  accMat.disableDepthWrite = true;
  accretionMesh.material = accMat;
  disposables.push(accMat);

  // =========================================================================
  // LAYER 4: RELATIVISTIC POLAR JET & SHOCK SPRAY PARTICLES
  // =========================================================================
  const JET_COUNT = 2000;
  const jetMesh = new BABYLON.Mesh("tde_polar_jet", scene);
  disposables.push(jetMesh);

  interface JetParticle {
    distFromBh: number;
    radialOffset: number;
    azimuth: number;
    speed: number;
    direction: 1 | -1; // North vs South pole
    active: boolean;
    knotPhase: number;
  }

  const jetParticles: JetParticle[] = [];
  const jetPositions = new Float32Array(JET_COUNT * 3);
  const jetColors = new Float32Array(JET_COUNT * 4);

  for (let i = 0; i < JET_COUNT; i++) {
    jetParticles.push({
      distFromBh: 0,
      radialOffset: Math.random(),
      azimuth: Math.random() * Math.PI * 2,
      speed: 14.0 + Math.random() * 22.0,
      direction: i % 2 === 0 ? 1 : -1,
      active: false,
      knotPhase: Math.random() * Math.PI * 2,
    });
    jetColors[i * 4 + 0] = 0.5;
    jetColors[i * 4 + 1] = 0.9;
    jetColors[i * 4 + 2] = 1.0;
    jetColors[i * 4 + 3] = 0.0;
  }

  const jetVertexData = new BABYLON.VertexData();
  jetVertexData.positions = jetPositions;
  jetVertexData.colors = jetColors;
  jetVertexData.applyToMesh(jetMesh, true);

  const jetMat = new BABYLON.ShaderMaterial(
    "tde_jet_mat",
    scene,
    {
      vertexSource: `
        precision highp float;
        attribute vec3 position;
        attribute vec4 color;
        uniform mat4 worldViewProjection;
        uniform float uDpr;
        varying vec4 vColor;
        void main() {
          vColor = color;
          gl_PointSize = clamp(2.8 * uDpr, 1.5, 18.0);
          gl_Position = worldViewProjection * vec4(position, 1.0);
        }
      `,
      fragmentSource: `
        precision highp float;
        varying vec4 vColor;
        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          float distSq = dot(coord, coord);
          if (distSq > 0.25) discard;
          float intensity = exp(-distSq * 7.5);
          gl_FragColor = vec4(vColor.rgb * vColor.a * intensity, vColor.a * intensity);
        }
      `,
    },
    {
      attributes: ["position", "color"],
      uniforms: ["worldViewProjection", "uDpr"],
      needAlphaBlending: true,
    }
  );
  jetMat.pointsCloud = true;
  jetMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
  jetMat.disableDepthWrite = true;
  jetMesh.material = jetMat;
  disposables.push(jetMat);

  // Dynamic Point Light for dramatic relativistic illumination
  const tdeLight = new BABYLON.PointLight("tde_dynamic_light", new BABYLON.Vector3(0, 0, 0), scene);
  tdeLight.intensity = 0;
  disposables.push(tdeLight);

  // =========================================================================
  // UPDATE LOOP
  // =========================================================================
  const update = (
    now: number,
    tde: TdeState,
    blackHole: CelestialEntity | null,
    screenWidth: number,
    screenHeight: number
  ) => {
    if (isDisposed) return;

    if (!tde.isActive) {
      coreMesh.setEnabled(false);
      envMesh.setEnabled(false);
      accretionMesh.setEnabled(false);
      jetMesh.setEnabled(false);
      tdeLight.intensity = 0;
      return;
    }

    const dpr = typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1.0;
    const safeW = isFinite(screenWidth) && screenWidth > 0 ? screenWidth : 1920;
    const safeH = isFinite(screenHeight) && screenHeight > 0 ? screenHeight : 1080;
    const halfW = safeW / 2;
    const halfH = safeH / 2;

    // Map 2D simulation coordinates to 3D world space
    const starWorldX = tde.starX - halfW;
    const starWorldY = -(tde.starY - halfH);
    const starWorldZ = tde.starZ || 0;

    const bhWorldX = blackHole ? (blackHole.worldX !== undefined ? blackHole.worldX : blackHole.x - halfW) : 0;
    const bhWorldY = blackHole ? (blackHole.worldY !== undefined ? blackHole.worldY : -(blackHole.y - halfH)) : 0;
    const bhWorldZ = blackHole ? (blackHole.worldZ !== undefined ? blackHole.worldZ : (blackHole.z || 0)) : 0;
    const bhRadius = blackHole ? blackHole.radius : 65;

    const dx = bhWorldX - starWorldX;
    const dy = bhWorldY - starWorldY;
    const distToBh = Math.sqrt(dx * dx + dy * dy) || 1;
    const rocheRadius = bhRadius * 2.8;

    // Hydrodynamic tidal strain: rises sharply as star approaches and breaches Roche limit
    const tidalStrain = Math.pow(Math.max(0.1, rocheRadius / Math.max(bhRadius * 1.05, distToBh)), 2.2);

    // Stellar mass dissipation into accretion stream
    const starMass = typeof tde.starMass === "number" ? Math.max(0, Math.min(1.0, tde.starMass)) : 1.0;
    const dissipation = 1.0 - starMass;
    const compFlash = tde.compressionFlash || 0;

    // Dynamic point light following the star's hot core
    tdeLight.position.set(starWorldX, starWorldY, starWorldZ + 30);
    tdeLight.intensity = (0.4 + compFlash * 3.5 + (1.0 - starMass) * 0.8) * (starMass > 0.05 ? 1.0 : 0.0);
    tdeLight.diffuse.set(1.0, 0.8 + compFlash * 0.2, 0.4 + compFlash * 0.6);

    // -----------------------------------------------------------------------
    // 1. UPDATE CORE SHREDDING SHADER
    // -----------------------------------------------------------------------
    if (tde.stage === "STAR_APPROACH" || tde.stage === "ROCHE_RUPTURE" || (tde.stage === "ACCRETION_SURGE" && starMass > 0.01)) {
      coreMesh.setEnabled(true);
      shreddingShaderMat.setVector3("uStarPos", new BABYLON.Vector3(starWorldX, starWorldY, starWorldZ));
      shreddingShaderMat.setVector3("uBhPos", new BABYLON.Vector3(bhWorldX, bhWorldY, bhWorldZ));
      shreddingShaderMat.setFloat("uStarRadius", Math.max(2.0, tde.starRadius));
      shreddingShaderMat.setFloat("uTidalStrain", Math.min(6.5, tidalStrain));
      shreddingShaderMat.setFloat("uDissipation", dissipation);
      shreddingShaderMat.setFloat("uCompressionFlash", compFlash);
      shreddingShaderMat.setFloat("uTime", now);
      shreddingShaderMat.setFloat("uDpr", dpr);
    } else {
      coreMesh.setEnabled(false);
    }

    // -----------------------------------------------------------------------
    // 2. UPDATE GASEOUS ENVELOPE / MANTLE SPRAY
    // -----------------------------------------------------------------------
    if (tidalStrain > 0.15 && (tde.stage === "STAR_APPROACH" || tde.stage === "ROCHE_RUPTURE" || tde.stage === "ACCRETION_SURGE")) {
      envMesh.setEnabled(true);
      envMat.setFloat("uDpr", dpr);

      const tidalDirX = dx / distToBh;
      const tidalDirY = dy / distToBh;
      const perpX = -tidalDirY;
      const perpY = tidalDirX;

      const peelRate = Math.min(1.0, tidalStrain * 0.35 + dissipation * 0.65);

      for (let i = 0; i < ENVELOPE_COUNT; i++) {
        const ep = envParticles[i];
        if (ep.life <= 0) {
          if (Math.random() < peelRate * 0.45) {
            ep.life = ep.maxLife;
            // Spawn on outer stellar atmosphere
            const spawnAngle = ep.angle + now * 0.001;
            const spawnR = tde.starRadius * ep.radiusRel;
            ep.x = starWorldX + Math.cos(spawnAngle) * spawnR;
            ep.y = starWorldY + Math.sin(spawnAngle) * spawnR;
            ep.z = starWorldZ + (Math.random() - 0.5) * tde.starRadius * 0.8;

            // Velocity: Orbital motion around star + pull toward black hole
            const stripSpeed = 3.0 + Math.random() * 8.0 * tidalStrain;
            ep.vx = tde.starVx * 0.6 + tidalDirX * stripSpeed + (Math.random() - 0.5) * 3.0;
            ep.vy = -tde.starVy * 0.6 + tidalDirY * stripSpeed + (Math.random() - 0.5) * 3.0;
            ep.vz = (Math.random() - 0.5) * 4.0;
          }
        } else {
          // Physics step: Accelerate toward black hole gravity
          const pDdx = bhWorldX - ep.x;
          const pDdy = bhWorldY - ep.y;
          const pDist = Math.sqrt(pDdx * pDdx + pDdy * pDdy) || 1;
          const pull = Math.min(25.0, (rocheRadius * 40.0) / (pDist * pDist + 400.0));

          ep.vx += (pDdx / pDist) * pull * 0.8;
          ep.vy += (pDdy / pDist) * pull * 0.8;

          ep.x += ep.vx;
          ep.y += ep.vy;
          ep.z += ep.vz;
          ep.life -= 1.0;

          // Dissolve if engulfed by event horizon
          if (pDist < bhRadius * 0.95) {
            ep.life = 0;
          }
        }

        const alpha = Math.max(0, ep.life / ep.maxLife);
        envPositions[i * 3 + 0] = ep.x;
        envPositions[i * 3 + 1] = ep.y;
        envPositions[i * 3 + 2] = ep.z;

        envColors[i * 4 + 0] = ep.colorR;
        envColors[i * 4 + 1] = ep.colorG;
        envColors[i * 4 + 2] = ep.colorB;
        envColors[i * 4 + 3] = alpha * 0.85;
      }

      envMesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, envPositions);
      envMesh.updateVerticesData(BABYLON.VertexBuffer.ColorKind, envColors);
    } else {
      envMesh.setEnabled(false);
    }

    // -----------------------------------------------------------------------
    // 3. UPDATE ACCRETION STREAM PARTICLES
    // -----------------------------------------------------------------------
    const isAccreting = tde.stage === "ROCHE_RUPTURE" || tde.stage === "ACCRETION_SURGE" || tde.stage === "GRB_DETONATION" || tde.stage === "COOLDOWN";
    if (isAccreting) {
      accretionMesh.setEnabled(true);
      accMat.setFloat("uDpr", dpr);

      const surgeFactor = (tde.accretionGlowMultiplier || 1.0) - 1.0;
      const targetActiveCount = Math.floor(ACCRETION_COUNT * Math.min(1.0, dissipation * 0.8 + surgeFactor * 0.35 + 0.15));

      for (let i = 0; i < ACCRETION_COUNT; i++) {
        const ap = accretionParticles[i];
        if (!ap.active && i < targetActiveCount) {
          ap.active = true;
          // Spawn in the returning accretion stream
          ap.orbitR = bhRadius * (1.25 + Math.pow(Math.random(), 1.5) * 3.8);
          ap.orbitAngle = Math.random() * Math.PI * 2;
          ap.radialVel = -0.15 - Math.random() * 0.35;
          ap.angularVel = Math.sqrt(450.0 / Math.max(10.0, ap.orbitR)) * (0.015 + Math.random() * 0.008);
          ap.life = 1.0;
        }

        if (ap.active) {
          // Keplerian orbital motion with relativistic periapsis precession
          ap.orbitAngle += ap.angularVel * (1.0 + (bhRadius * 1.2) / Math.max(1.0, ap.orbitR));
          ap.orbitR += ap.radialVel;

          // Accretion disk inner boundary: ISCO / Event horizon swallow
          if (ap.orbitR < bhRadius * 1.1) {
            ap.orbitR = bhRadius * (2.8 + Math.random() * 2.2); // Recycled returning gas
          }

          const px = bhWorldX + Math.cos(ap.orbitAngle) * ap.orbitR;
          const py = bhWorldY + Math.sin(ap.orbitAngle) * (ap.orbitR * 0.42); // Orbital inclination tilt
          const pz = bhWorldZ + Math.sin(ap.orbitAngle * 2.0) * (bhRadius * ap.orbitInclination);

          accPositions[i * 3 + 0] = px;
          accPositions[i * 3 + 1] = py;
          accPositions[i * 3 + 2] = pz;

          // Relativistic Doppler brightening & blackbody temperature
          const doppler = Math.cos(ap.orbitAngle); // +1 moving toward observer, -1 away
          const temperature = Math.min(1.0, (bhRadius * 2.5) / Math.max(10.0, ap.orbitR));

          const red = 1.0;
          const green = 0.55 + temperature * 0.4 + (doppler > 0 ? doppler * 0.15 : 0);
          const blue = 0.15 + temperature * 0.75 + (doppler > 0 ? doppler * 0.25 : 0);
          const alpha = (0.45 + temperature * 0.55) * Math.min(1.0, 0.4 + surgeFactor * 0.6);

          accColors[i * 4 + 0] = red;
          accColors[i * 4 + 1] = green;
          accColors[i * 4 + 2] = blue;
          accColors[i * 4 + 3] = alpha;
        } else {
          accPositions[i * 3 + 0] = bhWorldX;
          accPositions[i * 3 + 1] = bhWorldY;
          accPositions[i * 3 + 2] = bhWorldZ;
          accColors[i * 4 + 3] = 0;
        }
      }

      accretionMesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, accPositions);
      accretionMesh.updateVerticesData(BABYLON.VertexBuffer.ColorKind, accColors);
    } else {
      accretionMesh.setEnabled(false);
    }

    // -----------------------------------------------------------------------
    // 4. UPDATE RELATIVISTIC POLAR SPRAY & SHOCK JETS
    // -----------------------------------------------------------------------
    const beamIntensity = tde.grbBeamIntensity || 0;
    const isJetActive = (tde.stage === "GRB_DETONATION" || tde.stage === "COOLDOWN") && beamIntensity > 0.01;

    if (isJetActive) {
      jetMesh.setEnabled(true);
      jetMat.setFloat("uDpr", dpr);

      const maxJetDist = Math.max(screenWidth, screenHeight) * 1.2;

      for (let i = 0; i < JET_COUNT; i++) {
        const jp = jetParticles[i];
        if (!jp.active) {
          jp.active = true;
          jp.distFromBh = bhRadius * 0.6 + Math.random() * 20.0;
        }

        // Relativistic acceleration along the jet spine
        jp.distFromBh += jp.speed * (0.8 + beamIntensity * 0.6);
        if (jp.distFromBh > maxJetDist) {
          jp.distFromBh = bhRadius * 0.6 + Math.random() * 15.0; // Continuous relativistic feed
        }

        // Collimated nozzle opening cone (ultra-narrow relativistic opening angle ~ 2-5 degrees)
        const openingAngle = 0.045 + (1.0 - beamIntensity) * 0.03;
        const currentRadius = (bhRadius * 0.2) + jp.distFromBh * openingAngle * jp.radialOffset;

        jp.azimuth += 0.03;
        const jx = bhWorldX + Math.cos(jp.azimuth) * currentRadius;
        // Jet points along Y axis (perpendicular to equatorial accretion disk)
        const jy = bhWorldY + jp.direction * jp.distFromBh;
        const jz = bhWorldZ + Math.sin(jp.azimuth) * currentRadius;

        jetPositions[i * 3 + 0] = jx;
        jetPositions[i * 3 + 1] = jy;
        jetPositions[i * 3 + 2] = jz;

        // Shock knots: Standing diamond shocks along the jet axis
        const knotOsc = Math.sin((jp.distFromBh / (bhRadius * 1.8)) * Math.PI * 2.0);
        const knotBoost = Math.max(0, knotOsc) * 0.5;

        // Synchrotron radiation spectrum: ultra-bright diamond white core -> cyan -> ionized violet
        const progress = jp.distFromBh / maxJetDist;
        const fade = Math.pow(Math.max(0, 1.0 - progress), 1.4);

        const r = 0.55 + knotBoost * 0.45;
        const g = 0.85 + knotBoost * 0.15;
        const b = 1.0;
        const alpha = beamIntensity * fade * (0.65 + knotBoost * 0.35);

        jetColors[i * 4 + 0] = r;
        jetColors[i * 4 + 1] = g;
        jetColors[i * 4 + 2] = b;
        jetColors[i * 4 + 3] = alpha;
      }

      jetMesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, jetPositions);
      jetMesh.updateVerticesData(BABYLON.VertexBuffer.ColorKind, jetColors);
    } else {
      jetMesh.setEnabled(false);
    }
  };

  // Cleanup & resource release
  const dispose = () => {
    if (isDisposed) return;
    isDisposed = true;

    disposables.forEach((item) => {
      try {
        item.dispose();
      } catch (_) {}
    });
    disposables.length = 0;
  };

  return {
    get isDisposed() {
      return isDisposed;
    },
    dispose,
    update,
  };
}
