import React, { useEffect, useRef } from 'react';
import { Layers, Database, Zap, Globe } from 'lucide-react';

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
}

const PARTICLE_COUNT = 24000;

const generateTargetsForStage = (index: number, width: number, height: number): {x: number, y: number, color: string}[] => {
   if (width <= 0 || height <= 0) return [];
   const canvas = document.createElement('canvas');
   canvas.width = width;
   canvas.height = height;
   const ctx = canvas.getContext('2d', { willReadFrequently: true });
   const coords: {x: number, y: number, color: string}[] = [];
   if (!ctx) return coords;

   // Theme Palette Colors
   const colorRust = '#c14b2a';   // terracotta accent
   const colorLight = '#f5f2eb';  // luxurious ivory
   const colorGold = '#f3cb6d';   // sparkling warm gold

   ctx.fillStyle = colorLight;
   ctx.strokeStyle = colorLight;
   
   if (index === 0) {
      let fontSize = Math.min(width * 0.12, 140);
      
      // Draw subtitle label
      ctx.fillStyle = colorRust;
      ctx.font = `bold ${Math.max(12, width * 0.015)}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText("CURTIS CLICK  //  PORTFOLIO", width / 2, height / 2 - fontSize * 0.7);

      // Draw main name
      ctx.fillStyle = colorLight;
      ctx.font = `900 ${fontSize}px "Inter", sans-serif`;
      ctx.fillText("CURTIS CLICK", width / 2, height / 2);
   } 
   else if (index === 1) {
      const maxW = 1200;
      const mx = Math.max(0, (width - maxW) / 2);
      const pxLayout = width < 768 ? 24 : width < 1024 ? 48 : 64;
      const headerX = mx + pxLayout;
      const headerY = height / 2 - 40;
      
      ctx.font = `bold 14px "JetBrains Mono", monospace`;
      ctx.fillStyle = colorRust;
      ctx.textAlign = 'left';
      ctx.fillText("01 // SELECTED WORKS", headerX, headerY - 50);

      ctx.fillStyle = colorLight;
      ctx.font = `900 ${Math.min(width * 0.05, 54)}px "Inter", sans-serif`;
      ctx.fillText("ENGINEERED EXPERIENCES", headerX, headerY);
      ctx.fillText("FOR THE MODERN WEB.", headerX, headerY + Math.min(width * 0.06, 64));
   }
   else if (index >= 2 && index <= 5) {
      const drawProjectCards = false;

      if (drawProjectCards) {
         const pIndex = index - 2;
         const p = projects[pIndex];
         
         // Step A: Attempt to locate physical, actual DOM layout nodes
      const cardEl = document.getElementById('project-card');
      const iconEl = document.getElementById('project-icon');
      const numberEl = document.getElementById('project-number');
      const categoryEl = document.getElementById('project-category');
      const titleEl = document.getElementById('project-title');
      const descriptionEl = document.getElementById('project-description');
      const tagEls = document.querySelectorAll('.project-tag');
      const repoBtnEl = document.getElementById('project-repo-btn');
      const liveBtnEl = document.getElementById('project-live-btn');

      // Use a responsive absolute fallback in case element bounds are not yet loaded
      const padding = width < 1024 ? 24 : 64; 
      const maxW = 1000;
      const cardFallbackW = Math.min(width - padding * 2, maxW);
      const cardFallbackX = (width - cardFallbackW) / 2;
      const aspectH = Math.min(height - padding * 2, 600);
      const cardFallbackH = aspectH;
      const cardFallbackY = (height - cardFallbackH) / 2;

      const cardRect = cardEl ? cardEl.getBoundingClientRect() : null;
      const cardX = cardRect ? cardRect.left : cardFallbackX;
      const cardY = cardRect ? cardRect.top : cardFallbackY;
      const cardW = cardRect ? cardRect.width : cardFallbackW;
      const cardH = cardRect ? cardRect.height : cardFallbackH;

      ctx.lineWidth = 1.5;
      
      // 1. Draw elegant corner brackets (matches colorRust terracotta)
      ctx.fillStyle = colorRust;
      ctx.strokeStyle = colorRust;
      const cs = Math.min(40, width * 0.1); 
      const th = 2; 
      
      // Top-Left corner bracket
      ctx.fillRect(cardX, cardY, cs, th);
      ctx.fillRect(cardX, cardY, th, cs);
      
      // Top-Right corner bracket
      ctx.fillRect(cardX + cardW - cs, cardY, cs, th);
      ctx.fillRect(cardX + cardW - th, cardY, th, cs);
      
      // Bottom-Left corner bracket
      ctx.fillRect(cardX, cardY + cardH - th, cs, th);
      ctx.fillRect(cardX, cardY + cardH - cs, th, cs);
      
      // Bottom-Right corner bracket
      ctx.fillRect(cardX + cardW - cs, cardY + cardH - th, cs, th);
      ctx.fillRect(cardX + cardW - th, cardY + cardH - cs, th, cs);

      // 2. Draw Icon capsule/vector outline
      const iconRect = iconEl ? iconEl.getBoundingClientRect() : null;
      const iconX = iconRect ? iconRect.left : cardX + (width < 768 ? 24 : 48);
      const iconY = iconRect ? iconRect.top : cardY + (width < 768 ? 24 : 48);
      const iconW = iconRect ? iconRect.width : (width < 768 ? 40 : 48) + 16;
      const iconH = iconRect ? iconRect.height : (width < 768 ? 40 : 48) + 16;
      
      ctx.strokeStyle = colorRust;
      ctx.strokeRect(iconX, iconY, iconW, iconH);
      
      // Draw decorative vector icon shapes inside the box
      ctx.beginPath();
      const cx = iconX + iconW / 2;
      const cy = iconY + iconH / 2;
      if (pIndex === 0) { // Layers shape
        for (let j = 0; j < 3; j++) {
          const dy = j * 6 - 6;
          const dx = j * 3 - 3;
          ctx.strokeRect(cx - 12 - dx, cy - 7 + dy, 24, 14);
        }
      } else if (pIndex === 1) { // Database shape
        for (let j = 0; j < 3; j++) {
          const dcy = cy - 12 + j * 9;
          ctx.ellipse(cx, dcy, 12, 4, 0, 0, Math.PI * 2);
          ctx.moveTo(cx - 12, dcy);
          ctx.lineTo(cx - 12, dcy + 5);
          ctx.ellipse(cx, dcy + 5, 12, 4, 0, 0, Math.PI);
          ctx.moveTo(cx + 12, dcy);
          ctx.lineTo(cx + 12, dcy + 5);
        }
      } else if (pIndex === 2) { // Zap shape
        ctx.moveTo(cx + 4, cy - 14);
        ctx.lineTo(cx - 10, cy + 2);
        ctx.lineTo(cx - 1, cy + 2);
        ctx.lineTo(cx - 6, cy + 14);
        ctx.lineTo(cx + 10, cy - 2);
        ctx.lineTo(cx + 1, cy - 2);
        ctx.closePath();
      } else if (pIndex === 3) { // Globe shape
        ctx.ellipse(cx, cy, 14, 14, 0, 0, Math.PI * 2);
        ctx.ellipse(cx, cy, 5, 14, 0, 0, Math.PI * 2);
        ctx.ellipse(cx, cy, 14, 4, 0, 0, Math.PI * 2);
      }
      ctx.stroke();

      // 3. Project Number text ("01 // 04")
      const numRect = numberEl ? numberEl.getBoundingClientRect() : null;
      ctx.fillStyle = colorRust;
      ctx.font = `bold ${width < 768 ? 14 : 16}px "JetBrains Mono", monospace`;
      
      const numString = numberEl ? (numberEl.textContent || "").trim() : `${String(pIndex + 1).padStart(2, '0')} // 04`;
      if (numRect) {
         ctx.textAlign = 'right';
         ctx.fillText(numString, numRect.left + numRect.width, numRect.top + numRect.height * 0.82);
      } else {
         ctx.textAlign = 'right';
         ctx.fillText(numString, cardX + cardW - (width < 768 ? 24 : 48), cardY + (width < 768 ? 32 : 56));
      }

      // 4. Category line title (rust)
      const catRect = categoryEl ? categoryEl.getBoundingClientRect() : null;
      ctx.fillStyle = colorRust;
      ctx.font = `bold ${width < 768 ? 11 : 13}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'left';
      if (catRect) {
         ctx.fillText(p.category.toUpperCase(), catRect.left, catRect.top + catRect.height * 0.82);
      } else {
         const catFallbackY = cardY + cardH - (width < 768 ? 240 : 280);
         ctx.fillText(p.category.toUpperCase(), cardX + (width < 768 ? 24 : 48), catFallbackY);
      }

      // 5. Main Title header text in Ivory/Gold
      const titleRect = titleEl ? titleEl.getBoundingClientRect() : null;
      ctx.fillStyle = colorLight;
      ctx.font = `bold ${width < 768 ? 26 : 42}px "Playfair Display", Georgia, serif`;
      ctx.textAlign = 'left';
      if (titleRect) {
         ctx.fillText(p.title, titleRect.left, titleRect.top + titleRect.height * 0.78);
      } else {
         const catFallbackY = cardY + cardH - (width < 768 ? 240 : 280);
         const titleFallbackY = catFallbackY + (width < 768 ? 30 : 54);
         ctx.fillText(p.title, cardX + (width < 768 ? 24 : 48), titleFallbackY);
      }

      // 6. Beautiful Paragraph text wrapped exactly dynamic to DOM description element width
      const descRect = descriptionEl ? descriptionEl.getBoundingClientRect() : null;
      ctx.fillStyle = colorLight;
      ctx.font = `400 ${width < 768 ? 13 : 16}px "Inter", sans-serif`;
      ctx.textAlign = 'left';

      if (descRect) {
         const words = p.description.split(' ');
         let line = '';
         let currentDescY = descRect.top + (width < 768 ? 12 : 14);
         const maxDescW = descRect.width;
         
         for (let n = 0; n < words.length; n++) {
           const testLine = line + words[n] + ' ';
           const metrics = ctx.measureText(testLine);
           if (metrics.width > maxDescW && n > 0) {
             ctx.fillText(line, descRect.left, currentDescY);
             line = words[n] + ' ';
             currentDescY += width < 768 ? 19 : 24;
           } else {
             line = testLine;
           }
         }
         ctx.fillText(line, descRect.left, currentDescY);
      } else {
         // Fallback calculation matching standard responsive heights
         const catFallbackY = cardY + cardH - (width < 768 ? 240 : 280);
         const titleFallbackY = catFallbackY + (width < 768 ? 30 : 54);
         const descFallbackY = titleFallbackY + (width < 768 ? 22 : 32);
         const words = p.description.split(' ');
         let line = '';
         let currentDescY = descFallbackY;
         const maxDescW = Math.min(650, cardW - (width < 768 ? 48 : 96));
         
         for (let n = 0; n < words.length; n++) {
           const testLine = line + words[n] + ' ';
           const metrics = ctx.measureText(testLine);
           if (metrics.width > maxDescW && n > 0) {
             ctx.fillText(line, cardX + (width < 768 ? 24 : 48), currentDescY);
             line = words[n] + ' ';
             currentDescY += width < 768 ? 18 : 24;
           } else {
             line = testLine;
           }
         }
         ctx.fillText(line, cardX + (width < 768 ? 24 : 48), currentDescY);
      }

      // 7. Dynamic Tag outlines matching actual rendering positions
      if (tagEls && tagEls.length > 0) {
         ctx.font = `bold ${width < 768 ? 10 : 12}px "JetBrains Mono", monospace`;
         tagEls.forEach((tagEl) => {
           const r = tagEl.getBoundingClientRect();
           const text = (tagEl.textContent || "").trim();
           
           // Draw rounded capsule around tag coordinates
           ctx.strokeStyle = colorLight;
           ctx.lineWidth = 1;
           ctx.beginPath();
           if (ctx.roundRect) {
             ctx.roundRect(r.left, r.top, r.width, r.height, r.height / 2);
           } else {
             ctx.rect(r.left, r.top, r.width, r.height);
           }
           ctx.stroke();
           
           // Print tag text perfectly centered
           ctx.fillStyle = colorLight;
           ctx.textAlign = 'center';
           ctx.fillText(text, r.left + r.width / 2, r.top + r.height / 2 + (width < 768 ? 3 : 4));
         });
      } else {
         // Fallback rendering
         const tagsY = cardY + cardH - (width < 768 ? 32 : 48);
         ctx.font = `bold ${width < 768 ? 10 : 12}px "JetBrains Mono", monospace`;
         let tagX = cardX + (width < 768 ? 24 : 48);
         p.tags.forEach(tag => {
           const tw = ctx.measureText(tag).width;
           const tagPaddingX = width < 768 ? 12 : 16;
           const tagPaddingY = width < 768 ? 5 : 6;
           const tagW = tw + tagPaddingX * 2;
           const tagH = (width < 768 ? 10 : 12) + tagPaddingY * 2;
           
           ctx.strokeStyle = colorLight;
           ctx.beginPath();
           if (ctx.roundRect) {
             ctx.roundRect(tagX, tagsY - tagH / 2 - 4, tagW, tagH, tagH / 2);
           } else {
             ctx.rect(tagX, tagsY - tagH / 2 - 4, tagW, tagH);
           }
           ctx.stroke();
           
           ctx.fillStyle = colorLight;
           ctx.fillText(tag, tagX + tagPaddingX, tagsY + (width < 768 ? 1 : 2));
           tagX += tagW + (width < 768 ? 8 : 12);
         });
      }

      // 8. Buttons capsules: REPO & LIVE outline/fill matching actual HTML positioning
      const repoRect = repoBtnEl ? repoBtnEl.getBoundingClientRect() : null;
      const liveRect = liveBtnEl ? liveBtnEl.getBoundingClientRect() : null;

      // Draw REPO outline
      if (repoRect) {
         ctx.strokeStyle = colorLight;
         ctx.lineWidth = 1;
         ctx.beginPath();
         if (ctx.roundRect) {
           ctx.roundRect(repoRect.left, repoRect.top, repoRect.width, repoRect.height, 12);
         } else {
           ctx.rect(repoRect.left, repoRect.top, repoRect.width, repoRect.height);
         }
         ctx.stroke();
         
         ctx.textAlign = 'center';
         ctx.font = `bold ${width < 768 ? 10 : 11}px "JetBrains Mono", monospace`;
         ctx.fillStyle = colorLight;
         ctx.fillText("REPO", repoRect.left + repoRect.width / 2, repoRect.top + repoRect.height / 2 + 4);
      } else {
         // Button fallbacks
         const btnW = width < 768 ? 80 : 100;
         const btnH = width < 768 ? 28 : 36;
         const btnY = cardY + cardH - (width < 768 ? 44 : 64);
         const btnX2 = cardX + cardW - (width < 768 ? 24 : 48) - btnW;
         const btnX1 = btnX2 - (width < 768 ? 10 : 14) - btnW;

         ctx.strokeStyle = colorLight;
         ctx.beginPath();
         if (ctx.roundRect) {
           ctx.roundRect(btnX1, btnY, btnW, btnH, 8);
         } else {
           ctx.rect(btnX1, btnY, btnW, btnH);
         }
         ctx.stroke();
         
         ctx.textAlign = 'center';
         ctx.font = `bold ${width < 768 ? 10 : 11}px "JetBrains Mono", monospace`;
         ctx.fillStyle = colorLight;
         ctx.fillText("REPO", btnX1 + btnW / 2, btnY + btnH / 2 + 4);
      }

      // Draw LIVE Button
      if (liveRect) {
         ctx.strokeStyle = colorRust;
         ctx.fillStyle = colorRust;
         ctx.lineWidth = 1;
         ctx.beginPath();
         if (ctx.roundRect) {
           ctx.roundRect(liveRect.left, liveRect.top, liveRect.width, liveRect.height, 12);
         } else {
           ctx.rect(liveRect.left, liveRect.top, liveRect.width, liveRect.height);
         }
         ctx.fill();
         ctx.stroke();

         ctx.textAlign = 'center';
         ctx.font = `bold ${width < 768 ? 10 : 11}px "JetBrains Mono", monospace`;
         ctx.fillStyle = '#ffffff';
         ctx.fillText("LIVE", liveRect.left + liveRect.width / 2, liveRect.top + liveRect.height / 2 + 4);
      } else {
         // Fallback LIVE button
         const btnW = width < 768 ? 80 : 100;
         const btnH = width < 768 ? 28 : 36;
         const btnY = cardY + cardH - (width < 768 ? 44 : 64);
         const btnX2 = cardX + cardW - (width < 768 ? 24 : 48) - btnW;

         ctx.strokeStyle = colorRust;
         ctx.fillStyle = colorRust;
         ctx.beginPath();
         if (ctx.roundRect) {
           ctx.roundRect(btnX2, btnY, btnW, btnH, 8);
         } else {
           ctx.rect(btnX2, btnY, btnW, btnH);
         }
         ctx.fill();
         ctx.stroke();

         ctx.textAlign = 'center';
         ctx.font = `bold ${width < 768 ? 10 : 11}px "JetBrains Mono", monospace`;
         ctx.fillStyle = '#ffffff';
         ctx.fillText("LIVE", btnX2 + btnW / 2, btnY + btnH / 2 + 4);
      }
   } else {
      // Plasma energized A.I. Engineering layout
      const fontSize = Math.min(width * 0.15, 160);
      
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Draw energetic plasma text
      ctx.fillStyle = '#4deeea'; // Plasma cyan-blue
      ctx.font = `900 italic ${fontSize}px "Inter", sans-serif`;
      ctx.fillText("A.I.", width / 2, height / 2 - fontSize * 0.4);
      
      ctx.fillStyle = '#e0f7fa'; // Bright energizing white-cyan
      ctx.font = `900 ${Math.min(width * 0.1, 120)}px "Inter", sans-serif`;
      ctx.fillText("ENGINEERING", width / 2, height / 2 + fontSize * 0.2);
   }
}
   
const tData = ctx.getImageData(0, 0, width, height).data;
   const density = 2.0; 
   for (let y = 0; y < height; y += density) {
      for (let x = 0; x < width; x += density) {
          const idx = (Math.floor(y) * width + Math.floor(x)) * 4;
          const alpha = tData[idx + 3];
          if (alpha > 50) {
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

  // Helper system to dynamically recalculate target mapping coordinates for particles
  const mapParticlesToStage = (targetStage: number, triggerBurst: boolean) => {
    const ww = window.innerWidth;
    const wh = window.innerHeight;
    
    const coords = generateTargetsForStage(targetStage, ww, wh);
    if (!coords || coords.length === 0) return;
    
    stageTargetsRef.current[targetStage] = coords;
    
    if (particlesRef.current.length > 0) {
       particlesRef.current.forEach((p, i) => {
           const t = coords[i % coords.length];
           p.targetX = t.x;
           p.targetY = t.y;
           p.baseColor = t.color;
           p.color = t.color;
           
           if (triggerBurst) {
              // Scatter burst only on transition swipes
              p.vx = (Math.random() - 0.5) * 65;
              p.vy = (Math.random() - 0.5) * 65;
              p.vz = (Math.random() - 0.5) * 110;
           }
       });
    }
  };

  // Listen for stage-transition changes and align dynamically
  useEffect(() => {
    stageRef.current = stage;
    lastStageChangeRef.current = Date.now();
    
    if (stage >= 2) {
        // Wait 350ms of transition settling of Framer motion, then map precisely to real DOM bounds
        const timer = setTimeout(() => {
           mapParticlesToStage(stage, true);
        }, 350);
        return () => clearTimeout(timer);
    } else {
        mapParticlesToStage(stage, true);
    }
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
      
      const dpr = window.devicePixelRatio || 1;
      canvas.width = ww * dpr;
      canvas.height = wh * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${ww}px`;
      canvas.style.height = `${wh}px`;
      
      // Compute initial coordinates based on stage 0
      const initialCoords = generateTargetsForStage(0, ww, wh);
      const tempParticles: Particle[] = [];
      const fallbackColor = '#f5f2eb';
      
      for (let i = 0; i < PARTICLE_COUNT; i++) {
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
          size: Math.max(0.6, 0.9 + Math.random() * 0.9),
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
         
         const particles = particlesRef.current;
         let lastColor = '';
         
         const elapsed = Date.now() - lastStageChangeRef.current;
         
         // Smooth attraction decay to disintegrate particles once settled
         let attractionMultiplier = 1.0;
         if (elapsed > 1200) {
           attractionMultiplier = Math.max(0, 1 - (elapsed - 1200) / 800);
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
           
           p.x += p.vx;
           p.y += p.vy;
           p.z += p.vz;
           
           p.vx *= 0.86;
           p.vy *= 0.86;
           p.vz *= 0.86;
           
           const dx = p.targetX - p.x;
           const dy = p.targetY - p.y;
           const dist = Math.sqrt(dx*dx + dy*dy);
           
           // High performance spring settle
           if (dist > 1.0) {
             p.x += dx * 0.02 * attractionMultiplier;
             p.y += dy * 0.02 * attractionMultiplier;
           } else {
             if (attractionMultiplier > 0.01) {
               p.x = p.targetX;
               p.y = p.targetY;
             }
           }
           
           // Breathtaking gentle 3D wave float motion (applies wider floating ranges when released)
           const floatScaleX = 2.8 + (1 - attractionMultiplier) * 35.0; 
           const floatScaleY = 2.8 + (1 - attractionMultiplier) * 35.0;
           const floatSpeed = 0.012;
           const floatX = Math.sin(time * floatSpeed + p.targetY * 0.015 + i * 0.012) * floatScaleX;
           const floatY = Math.cos(time * floatSpeed * 0.9 + p.targetX * 0.015 + i * 0.012) * floatScaleY;
           const floatZ = Math.sin(time * floatSpeed * 0.7 + i * 0.04) * 45;
           
           p.z += (floatZ - p.z) * 0.05;
 
           const drawX = p.x + floatX;
           const drawY = p.y + floatY;
           
           const scaleOffset = p.z * 0.01;
           let drawSize = Math.max(0.6, p.size * (1 + scaleOffset));
           
           // Sparkle glitter flaring effect (grows wider and more intense when released)
           let finalColor = p.color;
           if (i % 24 === 0) { // Twinkle stars
             const sparkleWeight = Math.sin(time * 0.075 + i * 0.12);
             if (sparkleWeight > 0.8) {
               finalColor = '#ffffff'; 
               drawSize += (sparkleWeight - 0.8) * 4.8;
             }
           } else if (i % 41 === 0) { // Warm luxury gold or Plasma flares
             const isPlasma = stageRef.current >= 2;
             const goldWeight = Math.sin(time * 0.09 + i * 0.14);
             if (goldWeight > 0.82) {
               finalColor = isPlasma ? '#00e5ff' : '#ffdb58'; 
               drawSize += (goldWeight - 0.82) * 5.5;
             }
           }
           
           if (lastColor !== finalColor) {
               ctx.fillStyle = finalColor;
               lastColor = finalColor;
           }
           
           ctx.fillRect(drawX, drawY, drawSize, drawSize);
         }
         
         animationId = requestAnimationFrame(render);
      };
      
      render();
    });
    
    const handleResize = () => {
       const ww = window.innerWidth;
       const wh = window.innerHeight;
       
       const dpr = window.devicePixelRatio || 1;
       canvas.width = ww * dpr;
       canvas.height = wh * dpr;
       ctx.scale(dpr, dpr);
       canvas.style.width = `${ww}px`;
       canvas.style.height = `${wh}px`;
       
       // Settle particles calmly inside their updated targets
       mapParticlesToStage(stageRef.current, false);
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, []); 
  
  return <canvas ref={canvasRef} className="block" />;
};
