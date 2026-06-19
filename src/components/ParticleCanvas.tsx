import React, { useEffect, useRef } from 'react';
import { Layers, Database, Zap, Globe } from 'lucide-react';
import { audio } from '../utils/audio';

export const projects = [
  {
    title: 'Aura Compute',
    category: 'System Architecture',
    description: 'A deeply integrated distributed load balancer built with sub-millisecond routing thresholds. Utilizing spatial partitioning algorithms for optimal cluster distribution.',
    tags: ['Rust', 'WebGL', 'WASM'],
    icon: Layers,
  },
  {
    title: 'Nexus Data Engine',
    category: 'Backend Pipeline',
    description: 'High-throughput event streaming engine parsing thousands of interconnected websockets. Designed with immutable data paradigms and aggressive memory management.',
    tags: ['Go', 'Kafka', 'Redis'],
    icon: Database,
  },
  {
    title: 'Void Interface',
    category: 'Interactive Application',
    description: 'A completely headless canvas application prioritizing raw GPU performance over DOM manipulation. 120 FPS target output with zero garbage collection stutter.',
    tags: ['TypeScript', 'Three.js', 'GLSL'],
    icon: Zap,
  },
  {
    title: 'Echo Identity',
    category: 'Protocol Service',
    description: 'Cryptographically secure zero-knowledge authentication layer providing seamless cross-platform identity verification without exposing PII payloads.',
    tags: ['Cryptography', 'Node.js', 'gRPC'],
    icon: Globe,
  }
];

interface Particle {
  x: number;
  y: number;
  z: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  vz: number;
  color: string;
  baseColor: string;
  size: number;
  isCosmicAmbient?: boolean;
  driftSpeed?: number;
}

// Remove static PARTICLE_COUNT

const drawStageLayoutTemplate = (
  ctx: CanvasRenderingContext2D,
  index: number,
  width: number,
  height: number,
  mode: 'full' | 'tracer',
  opacity: number = 1.0
) => {
   if (width <= 0 || height <= 0) return;
   
   const isTracer = mode === 'tracer';
   if (isTracer) return; // Hide all faint background vectors/text so only particles are seen
   
   // Theme Palette Colors
   const colorRust = isTracer ? `rgba(193, 75, 42, ${opacity * 0.20})` : '#c14b2a';   // terracotta accent
   const colorLight = isTracer ? `rgba(245, 242, 235, ${opacity * 0.15})` : '#f5f2eb';  // luxurious ivory
   const colorGold = isTracer ? `rgba(243, 203, 109, ${opacity * 0.18})` : '#f3cb6d';   // sparkling warm gold

   ctx.fillStyle = colorLight;
   ctx.strokeStyle = colorLight;
   
   if (index === 0) {
      let fontSize = Math.min(width * 0.12, 140);
      
      // Draw subtitle label
      ctx.fillStyle = colorRust;
      ctx.font = `800 ${Math.max(16, width * 0.018)}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      (ctx as any).letterSpacing = width < 768 ? "2px" : "6px";
      ctx.fillText("CURTIS CLICK  //  PORTFOLIO", width / 2, height / 2 - fontSize * 0.7);

      // Draw main name
      ctx.fillStyle = colorLight;
      ctx.strokeStyle = colorRust;
      ctx.lineWidth = isTracer ? 1.0 : (width < 768 ? 2 : 4);
      ctx.font = `800 ${fontSize}px "Inter", sans-serif`;
      (ctx as any).letterSpacing = width < 768 ? "6px" : "16px";
      
      ctx.strokeText("CURTIS CLICK", width / 2, height / 2);
      ctx.fillText("CURTIS CLICK", width / 2, height / 2);
      (ctx as any).letterSpacing = "0px";
   } 
   else if (index === 1) {
      const maxW = 1200;
      const mx = Math.max(0, (width - maxW) / 2);
      const pxLayout = width < 768 ? 24 : width < 1024 ? 48 : 64;
      const headerX = mx + pxLayout;
      const headerY = height / 2 - 40;
      
      ctx.font = `800 ${Math.max(16, width * 0.018)}px "JetBrains Mono", monospace`;
      ctx.fillStyle = colorRust;
      ctx.textAlign = 'left';
      (ctx as any).letterSpacing = "4px";
      ctx.fillText("01 // SELECTED WORKS", headerX, headerY - 60);

      ctx.fillStyle = colorLight;
      ctx.strokeStyle = colorRust;
      ctx.lineWidth = isTracer ? 1.0 : (width < 768 ? 2 : 3);
      ctx.font = `900 ${Math.min(width * 0.07, 72)}px "Inter", sans-serif`;
      (ctx as any).letterSpacing = "2px";
      
      ctx.strokeText("ENGINEERED EXPERIENCES", headerX, headerY);
      ctx.strokeText("FOR THE MODERN WEB.", headerX, headerY + Math.min(width * 0.08, 84));
      
      ctx.fillText("ENGINEERED EXPERIENCES", headerX, headerY);
      ctx.fillText("FOR THE MODERN WEB.", headerX, headerY + Math.min(width * 0.08, 84));
      (ctx as any).letterSpacing = "0px";
   }
   else if (index >= 2 && index <= 5) {
      const pIndex = index - 2;
      const p = projects[pIndex];
      const isMobile = width < 640;
      
      const containerPad = isMobile ? 24 : 64;
      const hudMaxW = 500;
      const hudX = containerPad;
      const descMaxW = Math.min(hudMaxW, width - containerPad * 2);

      const numH = 16; // text-base
      const catH = 16; // text-base
      const topPartH = numH + 24 + catH + 48;
      
      const titleFontSize = isMobile ? 64 : width < 1024 ? 90 : 120;
      // approximate 1.625 line height for description
      const descLineH = isMobile ? 42 : 52; 
      
      ctx.font = `300 ${isMobile ? 26 : 32}px "Inter", sans-serif`;
      const words = p.description.split(' ');
      let line = '';
      let descLines = 0;
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        if (ctx.measureText(testLine).width > descMaxW && n > 0) {
          line = words[n] + ' ';
          descLines++;
        } else {
          line = testLine;
        }
      }
      if (line !== '') descLines++;
      const descH = descLines * descLineH;
      const midPartH = titleFontSize + 32 + descH + 48;

      const tagH = 36;
      const btnHTotal = 50;
      const botPartH = tagH + 48 + btnHTotal;

      // Calculate total HUD height to perfectly vertical-align with tailwind flex rules
      const totalH = topPartH + midPartH + botPartH;
      const hudY = isMobile ? (height - containerPad - totalH) : ((height - totalH) / 2);

      let currentY = hudY;
      ctx.lineWidth = 1.5;

      // 1. Draw Project Number and Category
      ctx.fillStyle = colorLight;
      ctx.font = `600 18px "JetBrains Mono", monospace`;
      ctx.textAlign = 'left';
      (ctx as any).letterSpacing = "0.4em";
      const pNumStr = `PROJECT ${String(pIndex + 1).padStart(2, '0')} // 04`;
      ctx.fillText(pNumStr, hudX, currentY + numH);
      currentY += numH + 24;
      
      ctx.font = `bold 20px "JetBrains Mono", monospace`;
      (ctx as any).letterSpacing = "0.1em";
      ctx.fillStyle = '#4deeea';
      ctx.fillText(p.category.toUpperCase(), hudX, currentY + catH);
      currentY += catH + 48;

      // 2. Title and Description
      ctx.fillStyle = colorLight;
      ctx.strokeStyle = colorRust;
      ctx.lineWidth = 1.0; // Moderate stroke for headline
      ctx.font = `bold ${titleFontSize}px "Playfair Display", Georgia, serif`;
      (ctx as any).letterSpacing = "-0.02em";
      ctx.strokeText(p.title, hudX, currentY + titleFontSize * 0.8);
      ctx.fillText(p.title, hudX, currentY + titleFontSize * 0.8);
      currentY += titleFontSize + 32;

      ctx.font = `200 ${isMobile ? 26 : 32}px "Inter", sans-serif`;
      (ctx as any).letterSpacing = "0px";
      line = '';
      let lineY = currentY + (isMobile ? 26 : 32);
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        if (ctx.measureText(testLine).width > descMaxW && n > 0) {
          ctx.fillText(line.trim(), hudX, lineY);
          line = words[n] + ' ';
          lineY += descLineH;
        } else {
          line = testLine;
        }
      }
      if (line.trim().length > 0) {
        ctx.fillText(line.trim(), hudX, lineY);
      }
      currentY = lineY + 48;

      // 3. Tags
      ctx.font = `400 16px "JetBrains Mono", monospace`;
      (ctx as any).letterSpacing = "0.1em";
      let tagX = hudX;
      let tagY = currentY + 14;
      
      p.tags.forEach(tag => {
        const tw = ctx.measureText(tag).width;
        const twTotal = tw + 32; 
        
        if (tagX + twTotal > hudX + descMaxW) {
            tagX = hudX;
            tagY += tagH + 12;
        }
        ctx.strokeStyle = colorLight;
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(tagX, tagY - tagH / 2 - 2, twTotal, tagH, tagH / 2);
        else ctx.rect(tagX, tagY - tagH / 2 - 2, twTotal, tagH);
        ctx.stroke();
        
        ctx.fillStyle = colorLight;
        ctx.textAlign = 'center';
        ctx.fillText(tag, tagX + twTotal / 2, tagY + 4);
        
        tagX += twTotal + 12;
      });
      
      currentY = tagY + 18 + 48;

      // 4. Buttons (REPO/LIVE)
      // REMOVED: Using HTML overlay buttons instead so they remain fully interactive
   } else {
      // Plasma energized A.I. Engineering layout
      const fontSize = Math.min(width * 0.15, 160);
      
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Draw energetic plasma text
      ctx.fillStyle = isTracer ? `rgba(77, 238, 234, ${opacity * 0.20})` : '#4deeea'; // Plasma cyan-blue
      ctx.strokeStyle = colorRust;
      ctx.lineWidth = isTracer ? 0.8 : (width < 768 ? 2 : 4);
      ctx.font = `800 italic ${fontSize}px "Inter", sans-serif`;
      (ctx as any).letterSpacing = "8px";
      ctx.strokeText("A.I.", width / 2, height / 2 - fontSize * 0.4);
      ctx.fillText("A.I.", width / 2, height / 2 - fontSize * 0.4);
      
      ctx.fillStyle = isTracer ? `rgba(224, 247, 250, ${opacity * 0.15})` : '#e0f7fa'; // Bright energizing white-cyan
      ctx.font = `800 ${Math.min(width * 0.1, 120)}px "Inter", sans-serif`;
      (ctx as any).letterSpacing = width < 768 ? "6px" : "12px";
      ctx.strokeText("ENGINEERING", width / 2, height / 2 + fontSize * 0.2);
      ctx.fillText("ENGINEERING", width / 2, height / 2 + fontSize * 0.2);
      (ctx as any).letterSpacing = "0px";
   }
};

const generateTargetsForStage = (index: number, width: number, height: number): {x: number, y: number, color: string}[] => {
   if (width <= 0 || height <= 0) return [];
   const canvas = document.createElement('canvas');
   canvas.width = width;
   canvas.height = height;
   const ctx = canvas.getContext('2d', { willReadFrequently: true });
   const coords: {x: number, y: number, color: string}[] = [];
   if (!ctx) return coords;

   drawStageLayoutTemplate(ctx, index, width, height, 'full');
   
   const tData = ctx.getImageData(0, 0, width, height).data;
   // Higher density mapping (lower float value means tighter, more dense particle placement)
   const density = width < 768 ? 0.7 : 0.45; 
   for (let y = 0; y < height; y += density) {
      for (let x = 0; x < width; x += density) {
          const idx = (Math.floor(y) * width + Math.floor(x)) * 4;
          const alpha = tData[idx + 3];
          if (alpha > 80) {
              const r = tData[idx];
              const g = tData[idx + 1];
              const b = tData[idx + 2];
              coords.push({
                x, 
                y, 
                color: `rgb(${r},${g},${b})`
              });
          }
      }
   }
   
   // Shuffle coordinates for beautiful transition distributions
   for (let i = coords.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [coords[i], coords[j]] = [coords[j], coords[i]];
   }
   
   return coords;
};

interface Props {
  stage: number;
}

export const ParticleCanvas: React.FC<Props> = ({ stage }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageTargetsRef = useRef<{x: number, y: number, color: string}[][]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const stageRef = useRef(stage);
  const lastStageChangeRef = useRef<number>(Date.now());
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const ripplesRef = useRef<{x: number, y: number, life: number}[]>([]);
  const mappingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scrollVelocityRef = useRef(0);
  const lastScrollYRef = useRef(window.scrollY || document.documentElement.scrollTop);

  // Helper system to dynamically recalculate target mapping coordinates for particles
  const mapParticlesToStage = (targetStage: number, triggerBurst: boolean) => {
    const ww = window.innerWidth;
    const wh = window.innerHeight;
    
    const coords = generateTargetsForStage(targetStage, ww, wh);
    if (!coords || coords.length === 0) return;
    
    stageTargetsRef.current[targetStage] = coords;
    
    if (particlesRef.current.length > 0) {
       let targetIndex = 0;
       particlesRef.current.forEach((p) => {
           if (p.isCosmicAmbient) {
              // Cosmic stars drift freely based on cosmic physics, they are not mapped to stage targets.
              return;
           }
           
           const totalTargetable = particlesRef.current.length - 180;
           const mappedIndex = (coords.length > totalTargetable) 
              ? Math.floor((targetIndex / totalTargetable) * coords.length)
              : targetIndex % coords.length;
              
           const safeIndex = Math.min(Math.max(0, Math.floor(mappedIndex)), coords.length - 1);
           const t = coords[safeIndex] || coords[0];
           targetIndex++;
           
           // Removed random fuzzy jitter to keep particle edges crisp
           const jitterX = 0;
           const jitterY = 0;
           
           p.targetX = t.x + jitterX;
           p.targetY = t.y + jitterY;
           p.baseColor = t.color;
           p.color = t.color;
           
           if (triggerBurst) {
              // Scatter burst on transition swipes
              p.vx = (Math.random() - 0.5) * 65;
              p.vy = (Math.random() - 0.5) * 65;
              p.vz = (Math.random() - 0.5) * 110;
           }
       });
     }
  };

  // Listen for stage-transition changes and align dynamically
  useEffect(() => {
    const prevStage = stageRef.current;
    stageRef.current = stage;
    lastStageChangeRef.current = Date.now();
    
    // Clear any pending mapping timers from previous transitions
    mappingTimersRef.current.forEach(clearTimeout);
    mappingTimersRef.current = [];

    const isProjectToProject = (stage >= 2 && stage <= 5) && (prevStage >= 2 && prevStage <= 5);
    
    // Trigger the layout change instantly once with a spectacular explosion burst!
    mapParticlesToStage(stage, !isProjectToProject);

    return () => {
      // no-op
    };
  }, [stage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    let animationId: number;
    let time = 0;
    
    const init = () => {
      const ww = window.innerWidth;
      const wh = window.innerHeight;
      
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      canvas.width = ww * dpr;
      canvas.height = wh * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${ww}px`;
      canvas.style.height = `${wh}px`;
      
      const tempParticles: Particle[] = [];
      const fallbackColor = '#f5f2eb';

      // Design choice: 180 beautiful background cosmic stars that drift and swirl with parallax
      const numStars = 180;
      for (let s = 0; s < numStars; s++) {
        const starColor = Math.random() > 0.65 ? '#ebaa75' : '#f5f2eb'; // Amber copper/gold or soft white
        tempParticles.push({
          x: Math.random() * ww,
          y: Math.random() * wh,
          z: (Math.random() - 0.5) * 400,
          targetX: 0,
          targetY: 0,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          vz: 0,
          color: starColor,
          baseColor: starColor,
          size: Math.max(0.8, 1.2 + Math.random() * 1.8),
          isCosmicAmbient: true,
          driftSpeed: 0.12 + Math.random() * 0.35,
        });
      }
      
      // Compute initial coordinates based on stage 0
      const initialCoords = generateTargetsForStage(0, ww, wh);
      const particleCount = Math.min(120000, Math.max(20000, initialCoords.length));
      
      for (let i = 0; i < particleCount; i++) {
        const t = initialCoords[i % initialCoords.length] || { x: ww/2, y: wh/2, color: fallbackColor };
        const col = t.color || fallbackColor;
        tempParticles.push({
          x: ww / 2 + (Math.random() - 0.5) * ww,
          y: wh / 2 + (Math.random() - 0.5) * wh,
          z: (Math.random() - 0.5) * 500,
          targetX: t.x,
          targetY: t.y,
          vx: 0,
          vy: 0,
          vz: 0,
          color: col,
          baseColor: col,
          size: Math.max(0.6, 0.2 + Math.random() * 0.9), // Fine but visible structure
        });
      }
      
      // Sorting reduces fillStyle bindings
      tempParticles.sort((a, b) => a.color.localeCompare(b.color));
      particlesRef.current = tempParticles;
      
      // Map correctly to the starting stage
      mapParticlesToStage(stageRef.current, false);
    };
    
    document.fonts.ready.then(() => {
      init();
      
      const render = () => {
         const currentW = window.innerWidth;
         const currentH = window.innerHeight;
         ctx.clearRect(0, 0, currentW, currentH);
         time++;
         
         const elapsed = Date.now() - lastStageChangeRef.current;

         // High performance chromatic aberration shift tracker peaking during rapid stage swipes
         let chromaticShift = 0;
         if (elapsed < 900) {
           const pTransit = elapsed / 900;
           chromaticShift = Math.sin(pTransit * Math.PI) * 15.0; // Peak 15px shift
         }

         // Draw subtle tracer layout lines to anchor the edges of text beautifully
         // Fades in to reach perfect clarity as particles stabilize
         let tracerOpacity = 0.85;
         if (elapsed < 1200) {
           const pTransit = elapsed / 1200;
           tracerOpacity = 0.15 + pTransit * 0.70;
         }
         ctx.save();
         drawStageLayoutTemplate(ctx, stageRef.current, currentW, currentH, 'tracer', tracerOpacity);
         ctx.restore();

         // Damp scroll velocity physics wind force
         scrollVelocityRef.current *= 0.92;
         
         const particles = particlesRef.current;
         let lastColor = '';
         
         // Smooth attraction decay to disintegrate particles once settled
         let attractionMultiplier = 1.0;
         if (elapsed > 1200) {
           attractionMultiplier = Math.max(0.65, 1 - (elapsed - 1200) / 800);
         }
         
         // Smoothly fade canvas overall alpha to preserve clear text readability
         let globalAlpha = 0.95;
         if (elapsed > 1200) {
           const alphaFade = Math.min(1.0, (elapsed - 1200) / 1000);
           globalAlpha = 0.95 - alphaFade * 0.55; 
         }
         ctx.globalAlpha = globalAlpha;
         
         for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            if (p.isCosmicAmbient) {
              // Particle is an ambient cosmic star — let it float across the sky with scrolls!
              p.y -= scrollVelocityRef.current * (p.driftSpeed || 0.2);
              p.x += Math.sin(time * 0.005 + i) * 0.15; // Slow wavy float
              
              // Standard loop encapsulation coordinates to keep them on screen infinitely
              if (p.y < 0) p.y = currentH;
              if (p.y > currentH) p.y = 0;
              if (p.x < 0) p.x = currentW;
              if (p.x > currentW) p.x = 0;
              
              // Apply hover magnetic gravity to cosmic stars as well
              const mdx = mouseRef.current.x - p.x;
              const mdy = mouseRef.current.y - p.y;
              const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
              if (mDist < 140) {
                 const mForce = (140 - mDist) / 140;
                 // Swirl them around mouse
                 const tx = -mdy / (mDist || 1);
                 const ty = mdx / (mDist || 1);
                 p.vx += tx * mForce * 1.6;
                 p.vy += ty * mForce * 1.6;
              }
              
              p.x += p.vx;
              p.y += p.vy;
              p.vx *= 0.94;
              p.vy *= 0.94;
              
              let drawSize = p.size;
              if (i % 6 === 0) {
                 const sparkleWeight = Math.sin(time * 0.05 + i);
                 if (sparkleWeight > 0.72) {
                    drawSize += (sparkleWeight - 0.72) * 4;
                 }
              }
              
              if (lastColor !== p.color) {
                 ctx.fillStyle = p.color;
                 lastColor = p.color;
              }
              ctx.fillRect(Math.round(p.x), Math.round(p.y), Math.round(Math.max(1, drawSize)), Math.round(Math.max(1, drawSize)));
              continue; // Skip layout spring updates
            }
           
           // Blow particles in vertical axis matching scroll speed, creating elegant trail cascades!
           p.vy -= scrollVelocityRef.current * 0.16;
           // Also add a minor lateral dispersion (turbulence) proportional to scroll velocity
           p.vx += Math.sin(i * 0.05 + time * 0.1) * Math.abs(scrollVelocityRef.current) * 0.03;

           p.x += p.vx;
           p.y += p.vy;
           p.z += p.vz;
           
           p.vx *= 0.86;
           p.vy *= 0.86;
           p.vz *= 0.86;
           
           const dx = p.targetX - p.x;
           const dy = p.targetY - p.y;
           const dist = dx*dx + dy*dy;
           
           const isTypographyMode = stageRef.current >= 2 && stageRef.current <= 5;
           
           // Distance-Field style boundary enforcement
           // Particles closer to their target have exponentially higher restorative spring tension,
           // securing the edges of character boundaries like a solid crystal lattice to ensure legibility.
           const springTension = isTypographyMode 
               ? Math.max(0.08, Math.min(0.75, 40.0 / Math.max(1, dist)))
               : 0.08;
           
           // High performance spring settle
           if (dist > 1.0) {
             p.x += dx * springTension * attractionMultiplier;
             p.y += dy * springTension * attractionMultiplier;
           } else {
             if (attractionMultiplier > 0.01) {
               p.x = p.targetX;
               p.y = p.targetY;
             }
           }
           
           // Breathtaking gentle 3D wave float motion (applies wider floating ranges when released)
           const floatScaleX = isTypographyMode ? 0 : (1 - attractionMultiplier) * 0.5; 
           const floatScaleY = isTypographyMode ? 0 : (1 - attractionMultiplier) * 0.5;
           const floatSpeed = 0.012;
           const floatX = Math.sin(time * floatSpeed + p.targetY * 0.015 + i * 0.012) * floatScaleX;
           const floatY = Math.cos(time * floatSpeed * 0.9 + p.targetX * 0.015 + i * 0.012) * floatScaleY;
           const floatZ = Math.sin(time * floatSpeed * 0.7 + i * 0.04) * 45;
           
           p.z += (floatZ - p.z) * 0.05;
 
           // Un-rounded coordinates allow sub-pixel precision and very smooth rendering limits jagged noise
           const drawX = p.x + floatX;
           const drawY = p.y + floatY;
           
           const scaleOffset = p.z * 0.01;
           let drawSize = Math.max(0.5, p.size * (1 + scaleOffset)); // Sub-pixel accurate precise sizing
           
           // Mouse interaction (Spacetime Wormhole / Event Horizon)
           const mdx = mouseRef.current.x - drawX;
           const mdy = mouseRef.current.y - drawY;
           const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
           
           if (mDist < 200) {
             let mForce = Math.pow((200 - mDist) / 200, 1.5); // non-linear gravity well
             
             // Structural core protection (Distance-field boundary logic)
             // Greatly reduce the disruption on particles that define the crystal logic of typography boundaries
             if (isTypographyMode && dist < 15) {
                mForce *= (dist / 15) * 0.4; // Massively reduced disruption at core to preserve legibility
             }
             
             // Event horizon gravity pull (pulls INTO the center) + immense orbital framing
             const tx = -mdy / (mDist || 1);
             const ty = mdx / (mDist || 1);
             const orbitalSpeed = 4.5 * mForce;
             const pullSpeed = mDist > 30 ? 1.5 * mForce : -2.0; // Pulls in, but pushes out if exactly at the singularity
             
             p.vx += (mdx / (mDist || 1)) * pullSpeed;
             p.vy += (mdy / (mDist || 1)) * pullSpeed;
             p.vx += tx * orbitalSpeed;
             p.vy += ty * orbitalSpeed;
             
             // Trigger interactive mallet on near particles with cursor velocity / intensity
             if (mForce > 0.6 && Math.random() > 0.993) {
                audio.playInteractiveMallet(mForce, drawX / window.innerWidth);
             }
             
             // Spacetime warping effect (Spaghettification / Relativistic Strings)
             // Particles are drawn into long, beautiful curved strings spiraling into the singularity
             const warpMlt = mForce * 4.0;
             if (warpMlt > 0.5) {
                ctx.beginPath();
                ctx.moveTo(drawX, drawY);
                
                // Calculate control point for standard quadratic bezier curve toward the cursor
                // Bend it using the orbital tangent to create a 3D spaghettification spiral
                const cpX = drawX + tx * 80 * mForce + (mouseRef.current.x - drawX) * 0.5;
                const cpY = drawY + ty * 80 * mForce + (mouseRef.current.y - drawY) * 0.5;
                
                // End point gets sucked deeply into the singularity based on attraction force
                const stringPullX = drawX + (mouseRef.current.x - drawX) * (mForce * 0.88);
                const stringPullY = drawY + (mouseRef.current.y - drawY) * (mForce * 0.88);
                
                ctx.quadraticCurveTo(cpX, cpY, stringPullX, stringPullY);
                
                // Color shift towards extreme energetic states near the event horizon (indigo, cyan, white)
                const isNeon = i % 3 === 0;
                ctx.strokeStyle = isNeon 
                    ? `rgba(77, 238, 234, ${mForce * 0.85})` // Space cyan
                    : `rgba(245, 242, 235, ${mForce * 0.65})`; // Ivory stardust
                ctx.lineWidth = Math.max(0.5, mForce * 2.0);
                ctx.stroke();
             }
           }
           
           // Click ripples (shockwaves)
           ripplesRef.current.forEach(ripple => {
             if (ripple.life > 0) {
               const rdx = ripple.x - drawX;
               const rdy = ripple.y - drawY;
               const rDist = Math.sqrt(rdx * rdx + rdy * rdy);
               const maxDist = (1 - ripple.life) * 400; // expand up to 400px
               const bandWidth = 40; // width of the shockwave ring
               
               if (rDist > maxDist - bandWidth && rDist < maxDist + bandWidth) {
                 const rForce = (1 - Math.abs(rDist - maxDist) / bandWidth) * ripple.life;
                 drawSize += rForce * 8;
                 p.vx -= (rdx / (rDist || 1)) * rForce * 4.0;
                 p.vy -= (rdy / (rDist || 1)) * rForce * 4.0;
                 p.vz -= rForce * 10;
               }
             }
           });
           
           // Sparkle glitter flaring effect (grows wider and more intense when released)
           let drawSizeFinal = drawSize;
           if (i % 24 === 0) { // Twinkle stars
             const sparkleWeight = Math.sin(time * 0.075 + i * 0.12);
             if (sparkleWeight > 0.8) {
               drawSizeFinal += (sparkleWeight - 0.8) * 4.0;
             }
           } else if (i % 41 === 0) { // Warm luxury gold or Plasma flares
             const goldWeight = Math.sin(time * 0.09 + i * 0.14);
             if (goldWeight > 0.82) {
               drawSizeFinal += (goldWeight - 0.82) * 5.0;
             }
           }
           
           if (lastColor !== p.color) {
               ctx.fillStyle = p.color;
               lastColor = p.color;
           }
           
           if (chromaticShift > 0.5 && i % 3 !== 0) {
              // Draw dynamic left terracotta-red shadow offset
              ctx.fillStyle = '#c14b2a';
              ctx.fillRect(Math.round(drawX - chromaticShift), drawY, drawSizeFinal, drawSizeFinal);
              
              // Draw dynamic right celestial-cyan shadow offset
              ctx.fillStyle = '#4deeea';
              ctx.fillRect(Math.round(drawX + chromaticShift), drawY, drawSizeFinal, drawSizeFinal);
              
              // Draw neutral core with the layout particle's assigned color
              ctx.fillStyle = p.color;
              ctx.fillRect(drawX, drawY, Math.max(1, drawSizeFinal - 1), Math.max(1, drawSizeFinal - 1));
              lastColor = p.color;
           } else {
              ctx.fillRect(drawX, drawY, drawSizeFinal, drawSizeFinal);
           }
         }
         
         // Update and clean up ripples array
         ripplesRef.current.forEach(r => r.life -= 0.02);
         ripplesRef.current = ripplesRef.current.filter(r => r.life > 0);
         
         animationId = requestAnimationFrame(render);
      };
      
      render();
    });
    
    let resizeTimeout: ReturnType<typeof setTimeout>;
    let lastWidth = window.innerWidth;
    let lastHeight = window.innerHeight;

    const handleResize = () => {
       const ww = window.innerWidth;
       const wh = window.innerHeight;
       
       const dpr = Math.min(1.5, window.devicePixelRatio || 1);
       const canvas = canvasRef.current;
       if (canvas && ctx) {
         canvas.width = ww * dpr;
         canvas.height = wh * dpr;
         ctx.scale(dpr, dpr);
         canvas.style.width = `${ww}px`;
         canvas.style.height = `${wh}px`;
       }
       
       clearTimeout(resizeTimeout);
       resizeTimeout = setTimeout(() => {
           // Only trigger expensive remap if width changes or height changes significantly (mobile URL bar avoidance)
           if (ww !== lastWidth || Math.abs(wh - lastHeight) > 120) {
               lastWidth = ww;
               lastHeight = wh;
               // Settle particles calmly inside their updated targets
               mapParticlesToStage(stageRef.current, false);
           }
       }, 200);
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };
    
    const handleClick = (e: MouseEvent) => {
      ripplesRef.current.push({ x: e.clientX, y: e.clientY, life: 1.0 });
    };

    const handleScrollPhysics = () => {
      const currentScrollY = window.scrollY || document.documentElement.scrollTop;
      const delta = currentScrollY - lastScrollYRef.current;
      scrollVelocityRef.current += delta * 0.08; // sensitivity control
      lastScrollYRef.current = currentScrollY;
    };
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);
    window.addEventListener('scroll', handleScrollPhysics, { passive: true });
    
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('scroll', handleScrollPhysics);
    };
  }, []); 
  
  return <canvas ref={canvasRef} className="block" />;
};
