import { CelestialEntity } from "../types";
import { fBmNoise2D } from "../PhysicsUtils";

export function buildSpiralGalaxyScene(
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

  const systemName = "Andromeda Shard";
  const systemDesc = "A magnificent grand-design spiral galaxy spinning in silent majesty.";
  const systemTags = ["🌌 SPIRAL GALAXY", "☄ GALACTIC CORE", "★ STELLAR DISPERSION"];

  const nucleusRad = isMobile ? 32 : 55;
  entities.push({
    type: "star",
    x: cx,
    y: cy,
    radius: nucleusRad,
    color: "#ffffff",
    secondaryColor: "#ffeaad",
    vx: 0,
    vy: 0,
    mass: nucleusRad * nucleusRad * 12,
    scale: 1.0,
    currentRadius: nucleusRad,
    originalRadius: nucleusRad,
    targetRadius: nucleusRad,
    isPhysicsEnabled: false,
    isDestroyed: false,
  });

  const numArms = 2;
  const maxRadius = isMobile ? 400 : 700;
  const armTwist = 3.5; 
  const numStars = isMobile ? 4 : 8;
  const colors = ["#ffeaad", "#ffffff", "#add8e6", "#ffb6c1"];

  for (let i = 0; i < numStars; i++) {
    // Generate stars primarily along the arms, with some dispersion
    const t = Math.pow(Math.random(), 0.5); // Push more towards outer edges
    const r = Math.max(nucleusRad + 20, maxRadius * t); 
    
    // Choose which arm this star belongs to
    const armIndex = Math.floor(Math.random() * numArms);
    const armAngleOffset = (Math.PI * 2 / numArms) * armIndex;
    
    // Base angle based on spiral formula
    let angle = armTwist * t + armAngleOffset;
    
    // Add perlin noise displacement for organic arm shape and thickness
    const noiseVal = fBmNoise2D(r * 0.005, angle, 4);
    angle += noiseVal * 0.4; // Distort angle for arm thickness
    const rDistorted = r + noiseVal * 50; // Distort radius

    const posX = cx + Math.cos(angle) * rDistorted;
    const posY = cy + Math.sin(angle) * rDistorted;
    
    // Outer stars move slower
    const orbitSpeed = 0.0002 + (1 - t) * 0.001; 

    const radius = 2 + Math.random() * (isMobile ? 8 : 15);
    const color = colors[Math.floor(Math.random() * colors.length)];

    entities.push({
      type: "planet",
      x: posX,
      y: posY,
      radius: radius,
      color: color,
      secondaryColor: color,
      vx: -Math.sin(angle) * rDistorted * orbitSpeed * 1.5,
      vy: Math.cos(angle) * rDistorted * orbitSpeed * 1.5,
      mass: radius * radius,
      initialMass: radius * radius,
      scale: 1.0,
      currentRadius: radius,
      originalRadius: radius,
      targetRadius: radius,
      orbitRadius: rDistorted,
      orbitAngle: angle,
      orbitSpeed: orbitSpeed,
      centerX: cx,
      centerY: cy,
      isPhysicsEnabled: false,
      isDestroyed: false,
    });
  }

  entities.push({
    type: "nebula",
    x: cx,
    y: cy,
    radius: isMobile ? 180 : 300,
    color: "rgba(218, 112, 214, 0.12)",
    vx: 0,
    vy: 0,
    mass: 1000,
    scale: 1.0,
    currentRadius: isMobile ? 180 : 300,
    originalRadius: isMobile ? 180 : 300,
    targetRadius: isMobile ? 180 : 300,
    isPhysicsEnabled: false,
    isDestroyed: false,
  });

  return { systemName, systemDesc, systemTags, entities };
}
