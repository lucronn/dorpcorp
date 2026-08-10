import React, { useEffect, useRef } from 'react';

interface Props {
  stage?: number;
}

export const WavelengthBackground: React.FC<Props> = ({ stage = 0 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const scrollRef = useRef(0);
  
  const stageRef = useRef(stage);
  const swellIntensityRef = useRef(0);

  useEffect(() => {
    // Stage changes remain calm and static without opacity spikes
  }, [stage]);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let width = window.innerWidth;
    let height = window.innerHeight;
    
    const setSize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };
    
    setSize();
    window.addEventListener('resize', setSize);
    
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: e.clientX,
        y: e.clientY
      };
    };

    const handleScroll = () => {
      scrollRef.current = window.scrollY || document.documentElement.scrollTop;
    };
    
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    let time = 0;
    let animationId: number;
    
    const lines = 12;
    let currentX = width / 2;
    let currentY = height / 2;
    
    const render = () => {
      // Smooth continuous waves that warp based on scroll depth rather than freezing
      const scrollFactor = Math.min(1.0, scrollRef.current / (height * 4));
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
      
      currentX += (mouseRef.current.x - currentX) * 0.05;
      currentY += (mouseRef.current.y - currentY) * 0.05;
      
      const normalizedY = currentY / height;
      const baseAmplitude = (30 + normalizedY * 100) * (1.0 - scrollFactor * 0.4); // Waves get calmer as you descend deeper
      
      // Smooth, static amplitude for photosensitive safety
      const dynamicAmplitude = baseAmplitude;

      ctx.lineWidth = 1;
      
      const scrollPhase = scrollRef.current * 0.002;
      
      for (let i = 0; i < lines; i++) {
        ctx.beginPath();
        
        const baseAlpha = 0.02 + (i / lines) * 0.04; 
        
        let strokeStyle = `rgba(245, 242, 235, ${baseAlpha})`; 
        
        if (i % 4 === 0) {
          strokeStyle = `rgba(193, 75, 42, ${baseAlpha * 0.8})`;
        } else if (i % 3 === 1) {
          strokeStyle = `rgba(77, 238, 234, ${baseAlpha * 0.7})`;
        }
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = i % 3 === 0 ? 1.2 : 1.0;
        
        for (let x = 0; x <= width; x += 20) { 
          const distToMouse = Math.abs(x - currentX);
          const influence = Math.max(0, 1 - distToMouse / (width * 0.5)); 
          
          const freq1 = 0.0012 + (i * 0.0001);
          const freq2 = 0.002 - (i * 0.0001);
          
          const yOffset = (height / 2) 
            + Math.sin(x * freq1 + time * 0.005 + i + scrollPhase) * dynamicAmplitude
            + Math.cos(x * freq2 - time * 0.005 - i + scrollPhase * 1.2) * (dynamicAmplitude * 0.3)
            + Math.sin(x * 0.003 + time * 0.008) * (influence * 15);
            
          if (x === 0) {
            ctx.moveTo(x, yOffset);
          } else {
            ctx.lineTo(x, yOffset);
          }
        }
        
        ctx.stroke();
      }
      
      time += 0.008; // Slower, more deliberate motion for a calm realistic wave
      animationId = requestAnimationFrame(render);
    };
    
    render();
    
    return () => {
      window.removeEventListener('resize', setSize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 z-0 pointer-events-none opacity-85" 
    />
  );
};
