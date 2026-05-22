import React, { useEffect, useRef } from 'react';

export const WavelengthBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const scrollRef = useRef(0);
  
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
      const dpr = window.devicePixelRatio || 1;
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
      scrollRef.current = window.scrollY;
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('scroll', handleScroll);
    
    let time = 0;
    let animationId: number;
    
    const lines = 12;
    let currentX = width / 2;
    let currentY = height / 2;
    
    const render = () => {
      ctx.fillStyle = '#322d29';
      ctx.fillRect(0, 0, width, height);
      
      currentX += (mouseRef.current.x - currentX) * 0.05;
      currentY += (mouseRef.current.y - currentY) * 0.05;
      
      const normalizedY = currentY / height;
      const baseAmplitude = 30 + normalizedY * 100; // Calmer waves
      
      ctx.lineWidth = 1;
      
      // Incorporate scroll depth into the phase to make waves shift vertically with scroll
      const scrollPhase = scrollRef.current * 0.01;
      
      for (let i = 0; i < lines; i++) {
        ctx.beginPath();
        
        // Much subtler, sharper, high-end white lines with low opacity
        const alpha = 0.02 + (i / lines) * 0.04;
        ctx.strokeStyle = `rgba(240, 235, 217, ${alpha})`;
        
        for (let x = 0; x <= width; x += 15) { // Wider steps for smoother vectors
          const distToMouse = Math.abs(x - currentX);
          const influence = Math.max(0, 1 - distToMouse / (width * 0.5)); // Wider mouse influence
          
          const freq1 = 0.0015 + (i * 0.0001);
          const freq2 = 0.003 - (i * 0.0002);
          
          const yOffset = (height / 2) 
            + Math.sin(x * freq1 + time * 0.01 + i + scrollPhase) * baseAmplitude
            + Math.cos(x * freq2 - time * 0.01 - i + scrollPhase * 1.5) * (baseAmplitude * 0.4)
            + Math.sin(x * 0.005 + time * 0.02) * (influence * 80);
            
          if (x === 0) {
            ctx.moveTo(x, yOffset);
          } else {
            ctx.lineTo(x, yOffset);
          }
        }
        
        ctx.stroke();
      }
      
      time += 0.5; // Slower, more deliberate motion
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
      className="fixed inset-0 z-0 pointer-events-none opacity-60" 
    />
  );
};
