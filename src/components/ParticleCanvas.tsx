import React, { useEffect, useRef } from 'react';
import { Layers, Database, Zap, Globe } from 'lucide-react';
import { audio } from '../utils/audio';

export const projects = [
  {
    title: 'AI Engineering',
    category: 'WHO I AM',
    description: 'Ten years of engineering experience. Full-stack systems, agentic pipelines, and the evaluations that keep AI models honest.',
    tags: ['AI Engineering', 'Production AI', 'LLM Optimization'],
    icon: Database,
  },
  {
    title: 'Architecting Autonomy',
    category: 'WHAT I BUILD',
    description: 'Autonomous agentic systems and large-scale RAG pipelines. Built to reason, plan, and execute reliably.',
    tags: ['Agentic Workflows', 'LangChain', 'VectorDBs'],
    icon: Zap,
  },
  {
    title: 'Frontier Model Alignment',
    category: 'HOW I TEST',
    description: 'RLHF evaluation, red-teaming, and hallucination analysis on frontier models, including Claude Code and Fable. Selected as a Worldsim evaluator, under 1% acceptance.',
    tags: ['RLHF', 'Red-Teaming', 'Worldsim'],
    icon: Layers,
  },
  {
    title: 'Technical Depth & Synthesis',
    category: 'MY EXPERTISE',
    description: 'Not only code. Domain expertise in CAD, civil and structural engineering, and fluid dynamics. Messy real-world data, turned into high-fidelity training corpuses.',
    tags: ['OpenFOAM', 'OpenSEES', 'SMEs'],
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
   const colorRust = isTracer ? `rgba(242, 95, 53, ${opacity * 0.20})` : '#f25f35';
   const colorLight = isTracer ? `rgba(255, 255, 255, ${opacity * 0.15})` : '#ffffff';
   const colorGold = isTracer ? `rgba(255, 215, 120, ${opacity * 0.18})` : '#ffd778';

   ctx.fillStyle = colorLight;
   ctx.strokeStyle = colorLight;
   
   if (index === 0) {
      let fontSize = Math.min(width * 0.12, 140);
      
      ctx.fillStyle = colorRust;
      ctx.font = `800 ${Math.max(16, width * 0.018)}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      (ctx as any).letterSpacing = width < 768 ? "2px" : "6px";
      ctx.fillText("CURTIS CLICK  //  PORTFOLIO", width / 2, height / 2 - fontSize * 0.7);

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
      
      const containerPad = isMobile ? 16 : 48;
      const hudMaxW = Math.min(1100, width - containerPad * 2);
      const hudX = width / 2;
      const descMaxW = hudMaxW;

      const numH = 16; 
      const catH = 20; 
      const topPartH = numH + 24 + catH + 48;
      
      const titleFontSize = isMobile ? 64 : width < 1024 ? 90 : 130;
      const descFontSize = isMobile ? 32 : 46;
      const descLineH = isMobile ? 48 : 68; 
      
      ctx.font = `300 ${descFontSize}px "Inter", sans-serif`;
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

      const tagH = 40;
      const botPartH = tagH + 48;

      const totalH = topPartH + midPartH + botPartH;
      const hudY = isMobile ? (height - containerPad - totalH + 40) : ((height - totalH) / 2);

      let currentY = hudY;
      ctx.lineWidth = 1.5;

      ctx.fillStyle = colorLight;
      ctx.font = `bold 24px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      (ctx as any).letterSpacing = "0.4em";
      const pNumStr = `CHAPTER ${String(pIndex + 1).padStart(2, '0')} // 04`;
      ctx.fillText(pNumStr, hudX, currentY + numH);
      currentY += numH + 32;
      
      ctx.font = `900 32px "JetBrains Mono", monospace`;
      (ctx as any).letterSpacing = "0.15em";
      ctx.fillStyle = '#88ffff';
      ctx.fillText(p.category.toUpperCase(), hudX, currentY + catH);
      currentY += catH + 56;

      ctx.fillStyle = colorLight;
      ctx.strokeStyle = colorRust;
      ctx.lineWidth = 1.0; 
      
      let appliedTitleFontSize = titleFontSize;
      ctx.font = `bold ${appliedTitleFontSize}px "Playfair Display", Georgia, serif`;
      (ctx as any).letterSpacing = "-0.02em";
      while (ctx.measureText(p.title).width > descMaxW && appliedTitleFontSize > 30) {
         appliedTitleFontSize -= 2;
         ctx.font = `bold ${appliedTitleFontSize}px "Playfair Display", Georgia, serif`;
      }
      
      ctx.strokeText(p.title, hudX, currentY + appliedTitleFontSize * 0.8);
      ctx.fillText(p.title, hudX, currentY + appliedTitleFontSize * 0.8);
      currentY += appliedTitleFontSize + 48;

      ctx.font = `500 ${descFontSize}px "Inter", sans-serif`;
      (ctx as any).letterSpacing = "0px";
      line = '';
      let lineY = currentY + descFontSize;
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
      currentY = lineY + 64;

   } else {
      const fontSize = Math.min(width * 0.15, 160);
      
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      ctx.fillStyle = isTracer ? `rgba(136, 255, 255, ${opacity * 0.20})` : '#88ffff';
      ctx.strokeStyle = colorRust;
      ctx.lineWidth = isTracer ? 0.8 : (width < 768 ? 2 : 4);
      ctx.font = `800 italic ${fontSize}px "Inter", sans-serif`;
      (ctx as any).letterSpacing = "8px";
      ctx.strokeText("A.I.", width / 2, height / 2 - fontSize * 0.4);
      ctx.fillText("A.I.", width / 2, height / 2 - fontSize * 0.4);
      
      ctx.fillStyle = isTracer ? `rgba(224, 247, 250, ${opacity * 0.15})` : '#e0f7fa'; 
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
   
   // Optimized dynamic density checks to prevent memory/CPU bloat on 4K/high-res screens
   const totalPixels = width * height;
   const isMobileDevice = /iPad|iPhone|iPod|Android/i.test(navigator.userAgent) || (width < 768);
   let density = isMobileDevice ? 3 : 2;
   if (totalPixels > 2000000) density = 3;
   if (totalPixels > 4000000) density = 4;
   
   for (let y = 0; y < height; y += density) {
      for (let x = 0; x < width; x += density) {
          const idx = (y * width + x) * 4;
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
   
   // Shuffle coordinates
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
              return;
           }
           
           const totalTargetable = particlesRef.current.length - 180;
           const mappedIndex = (coords.length > totalTargetable) 
              ? Math.floor((targetIndex / totalTargetable) * coords.length)
              : targetIndex % coords.length;
              
           const safeIndex = Math.min(Math.max(0, Math.floor(mappedIndex)), coords.length - 1);
           const t = coords[safeIndex] || coords[0];
           targetIndex++;
           
           p.targetX = t.x;
           p.targetY = t.y;
           p.baseColor = t.color;
           p.color = t.color;
           
           if (triggerBurst) {
              p.vx = (Math.random() - 0.5) * 65;
              p.vy = (Math.random() - 0.5) * 65;
              p.vz = (Math.random() - 0.5) * 110;
           }
       });
     }
  };

  useEffect(() => {
    const prevStage = stageRef.current;
    stageRef.current = stage;
    lastStageChangeRef.current = Date.now();
    
    mappingTimersRef.current.forEach(clearTimeout);
    mappingTimersRef.current = [];

    const isProjectToProject = (stage >= 2 && stage <= 5) && (prevStage >= 2 && prevStage <= 5);
    
    mapParticlesToStage(stage, !isProjectToProject);

    return () => {};
  }, [stage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false }); // Minor perf optimization
    if (!ctx) return;
    
    let animationId: number;
    let time = 0;
    
    const init = () => {
      const ww = window.innerWidth;
      const wh = window.innerHeight;
      
      const isMobileDevice = /iPad|iPhone|iPod|Android/i.test(navigator.userAgent) || (ww < 768);
      // Perf Optimization: Fallback to DPR=1.0 on gigantic ultra-wide or 4K layouts to save massive canvas fill-rate.
      const dpr = isMobileDevice ? 1.0 : Math.min(ww > 2000 ? 1.0 : 1.5, window.devicePixelRatio || 1);
      
      canvas.width = ww * dpr;
      canvas.height = wh * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${ww}px`;
      canvas.style.height = `${wh}px`;
      
      const tempParticles: Particle[] = [];
      const fallbackColor = '#ffffff';

      const numStars = isMobileDevice ? 60 : 180;
      for (let s = 0; s < numStars; s++) {
        const starColor = Math.random() > 0.65 ? '#ffcc99' : '#ffffff'; 
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
      
      const initialCoords = generateTargetsForStage(0, ww, wh);
      
      // Perf Optimization: Dramatically reduced processing caps for highly stable 60 FPS
      const maxCap = isMobileDevice ? 8000 : 20000;
      const minCap = isMobileDevice ? 4000 : 10000;
      const particleCount = Math.min(maxCap, Math.max(minCap, initialCoords.length));
      
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
          size: Math.max(0.8, 0.5 + Math.random() * 1.0),
        });
      }
      
      tempParticles.sort((a, b) => a.color.localeCompare(b.color));
      particlesRef.current = tempParticles;
      
      mapParticlesToStage(stageRef.current, false);
    };
    
    document.fonts.ready.then(() => {
      init();
      
      const render = () => {
         const currentW = window.innerWidth;
         const currentH = window.innerHeight;
         const isMobileDevice = /iPad|iPhone|iPod|Android/i.test(navigator.userAgent) || (currentW < 768);
         
         ctx.fillStyle = '#0a0a0a';
         ctx.fillRect(0, 0, currentW, currentH);
         time++;
         
         const elapsed = Date.now() - lastStageChangeRef.current;

         let chromaticShift = 0;
         if (elapsed < 900) {
           const pTransit = elapsed / 900;
           chromaticShift = Math.sin(pTransit * Math.PI) * 15.0; 
         }

         let tracerOpacity = 0.85;
         if (elapsed < 1200) {
           const pTransit = elapsed / 1200;
           tracerOpacity = 0.15 + pTransit * 0.70;
         }
         ctx.save();
         drawStageLayoutTemplate(ctx, stageRef.current, currentW, currentH, 'tracer', tracerOpacity);
         ctx.restore();

         scrollVelocityRef.current *= 0.92;
         
         const particles = particlesRef.current;
         let lastColor = '';
         
         let attractionMultiplier = 1.0;
         if (elapsed > 1200) {
           attractionMultiplier = Math.max(0.65, 1 - (elapsed - 1200) / 800);
         }
         
         let globalAlpha = 1.0;
         if (elapsed > 1200) {
           const alphaFade = Math.min(1.0, (elapsed - 1200) / 1000);
           globalAlpha = 1.0 - alphaFade * 0.35; 
         }
         ctx.globalAlpha = globalAlpha;

         // Perf Optimization: Lift computations outside of the tight particle loop
         const isTypographyMode = stageRef.current >= 2 && stageRef.current <= 5;
         const floatScaleX = isTypographyMode ? 0 : (1 - attractionMultiplier) * 0.5; 
         const floatScaleY = isTypographyMode ? 0 : (1 - attractionMultiplier) * 0.5;
         const floatSpeed = 0.012;

         const activeRipples = ripplesRef.current.map(ripple => {
             const maxDist = (1 - ripple.life) * 400; 
             const bandWidth = 40; 
             const minDist = Math.max(0, maxDist - bandWidth);
             const maxDistBound = maxDist + bandWidth;
             return {
                 ...ripple,
                 maxDist,
                 bandWidth,
                 minDistSq: minDist * minDist,
                 maxDistBoundSq: maxDistBound * maxDistBound
             };
         });
         
         for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            
            if (p.isCosmicAmbient) {
              p.y -= scrollVelocityRef.current * (p.driftSpeed || 0.2);
              p.x += Math.sin(time * 0.005 + i) * 0.15; 
              
              if (p.y < 0) p.y = currentH;
              if (p.y > currentH) p.y = 0;
              if (p.x < 0) p.x = currentW;
              if (p.x > currentW) p.x = 0;
              
              const mdx = mouseRef.current.x - p.x;
              const mdy = mouseRef.current.y - p.y;
              const mDistSq = mdx * mdx + mdy * mdy;
              if (mDistSq < 19600) {
                 const mDist = Math.sqrt(mDistSq);
                 const mForce = (140 - mDist) / 140;
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
              continue; 
            }
           
           p.vy -= scrollVelocityRef.current * 0.16;
           p.vx += Math.sin(i * 0.05 + time * 0.1) * Math.abs(scrollVelocityRef.current) * 0.03;

           p.x += p.vx;
           p.y += p.vy;
           p.z += p.vz;
           
           p.vx *= 0.86;
           p.vy *= 0.86;
           p.vz *= 0.86;
           
           const dx = p.targetX - p.x;
           const dy = p.targetY - p.y;
           const distSq = dx*dx + dy*dy;
           
           const springTension = isTypographyMode 
               ? Math.max(0.08, Math.min(0.75, 40.0 / Math.max(1, distSq)))
               : 0.08;
           
           if (distSq > 1.0) {
             p.x += dx * springTension * attractionMultiplier;
             p.y += dy * springTension * attractionMultiplier;
           } else {
             if (attractionMultiplier > 0.01) {
               p.x = p.targetX;
               p.y = p.targetY;
             }
           }
           
           // Perf Optimization: Skips 20,000 idle math operations dynamically based on layout
           let floatX = 0;
           let floatY = 0;
           if (floatScaleX > 0) {
               floatX = Math.sin(time * floatSpeed + p.targetY * 0.015 + i * 0.012) * floatScaleX;
               floatY = Math.cos(time * floatSpeed * 0.9 + p.targetX * 0.015 + i * 0.012) * floatScaleY;
           }
           const floatZ = Math.sin(time * floatSpeed * 0.7 + i * 0.04) * 45;
           
           p.z += (floatZ - p.z) * 0.05;
 
           const drawX = p.x + floatX;
           const drawY = p.y + floatY;
           
           const scaleOffset = p.z * 0.01;
           let drawSize = Math.max(0.5, p.size * (1 + scaleOffset)); 
           
           const mdx = mouseRef.current.x - drawX;
           const mdy = mouseRef.current.y - drawY;
           const mDistSq = mdx * mdx + mdy * mdy;
           
           if (mDistSq < 40000) {
              const mDist = Math.sqrt(mDistSq);
             let mForce = Math.pow((200 - mDist) / 200, 1.5); 
             
             if (isTypographyMode && distSq < 15) {
                mForce *= (distSq / 15) * 0.4; 
             }
             
             const tx = -mdy / (mDist || 1);
             const ty = mdx / (mDist || 1);
             const orbitalSpeed = 4.5 * mForce;
             const pullSpeed = mDist > 30 ? 1.5 * mForce : -2.0; 
             
             p.vx += (mdx / (mDist || 1)) * pullSpeed;
             p.vy += (mdy / (mDist || 1)) * pullSpeed;
             p.vx += tx * orbitalSpeed;
             p.vy += ty * orbitalSpeed;
             
             if (mForce > 0.6 && Math.random() > 0.993) {
                audio.playInteractiveMallet(mForce, drawX / currentW);
             }
             
             const warpMlt = mForce * 4.0;
             const warpStep = isMobileDevice ? 32 : 16;
             if (warpMlt > 0.5 && i % warpStep === 0) {
                ctx.beginPath();
                ctx.moveTo(drawX, drawY);
                
                const cpX = drawX + tx * 80 * mForce + (mouseRef.current.x - drawX) * 0.5;
                const cpY = drawY + ty * 80 * mForce + (mouseRef.current.y - drawY) * 0.5;
                
                const stringPullX = drawX + (mouseRef.current.x - drawX) * (mForce * 0.88);
                const stringPullY = drawY + (mouseRef.current.y - drawY) * (mForce * 0.88);
                
                ctx.quadraticCurveTo(cpX, cpY, stringPullX, stringPullY);
                
                const isNeon = i % 3 === 0;
                ctx.strokeStyle = isNeon 
                    ? `rgba(77, 238, 234, ${mForce * 0.85})` 
                    : `rgba(245, 242, 235, ${mForce * 0.65})`; 
                ctx.lineWidth = Math.max(0.5, mForce * 2.0);
                ctx.stroke();
             }
           }
           
           activeRipples.forEach(ripple => {
               const rdx = ripple.x - drawX;
               const rdy = ripple.y - drawY;
               const rDistSq = rdx * rdx + rdy * rdy;
               
               if (rDistSq > ripple.minDistSq && rDistSq < ripple.maxDistBoundSq) {
                 const rDist = Math.sqrt(rDistSq);
                 const rForce = (1 - Math.abs(rDist - ripple.maxDist) / ripple.bandWidth) * ripple.life;
                 drawSize += rForce * 8;
                 p.vx -= (rdx / (rDist || 1)) * rForce * 4.0;
                 p.vy -= (rdy / (rDist || 1)) * rForce * 4.0;
                 p.vz -= rForce * 10;
               }
           });
           
           let drawSizeFinal = drawSize;
           if (i % 24 === 0) { 
             const sparkleWeight = Math.sin(time * 0.075 + i * 0.12);
             if (sparkleWeight > 0.8) {
               drawSizeFinal += (sparkleWeight - 0.8) * 4.0;
             }
           } else if (i % 41 === 0) { 
             const goldWeight = Math.sin(time * 0.09 + i * 0.14);
             if (goldWeight > 0.82) {
               drawSizeFinal += (goldWeight - 0.82) * 5.0;
             }
           }
           
           if (lastColor !== p.color) {
               ctx.fillStyle = p.color;
               lastColor = p.color;
           }
           
           // Perf Optimization: Limits fillStyle swapping thrash
           if (chromaticShift > 0.5 && i % 4 === 0) {
              ctx.fillStyle = '#f25f35';
              ctx.fillRect(drawX - chromaticShift, drawY, drawSizeFinal, drawSizeFinal);
              
              ctx.fillStyle = '#88ffff';
              ctx.fillRect(drawX + chromaticShift, drawY, drawSizeFinal, drawSizeFinal);
              
              ctx.fillStyle = p.color;
              ctx.fillRect(drawX, drawY, Math.max(1, drawSizeFinal - 1), Math.max(1, drawSizeFinal - 1));
              
              lastColor = ''; // Reset sort caching for the next iteration step
           } else {
              ctx.fillRect(drawX, drawY, drawSizeFinal, drawSizeFinal);
           }
         }
         
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
       
       const isMobileDevice = /iPad|iPhone|iPod|Android/i.test(navigator.userAgent) || (window.innerWidth < 768);
       const dpr = isMobileDevice ? 1.0 : Math.min(ww > 2000 ? 1.0 : 1.5, window.devicePixelRatio || 1);
       
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
           if (ww !== lastWidth || Math.abs(wh - lastHeight) > 120) {
               lastWidth = ww;
               lastHeight = wh;
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
      scrollVelocityRef.current += delta * 0.08; 
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