import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface CardParticlesProps {
  isHovered: boolean;
  width?: number;
  height?: number;
  color?: string;
  count?: number;
}

export const CardParticles: React.FC<CardParticlesProps> = ({ 
  isHovered, 
  width = 300, 
  height = 200, 
  color = "#f5f2eb",
  count = 60 
}) => {
  const particles = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      // Starting position (randomly distributed within the card area)
      const startX = Math.random() * Math.max(width, 100);
      const startY = Math.random() * Math.max(height, 100);
      
      // Target position (exploded outwards)
      const angle = Math.random() * Math.PI * 2;
      const distance = 50 + Math.random() * 200;
      const targetX = startX + Math.cos(angle) * distance;
      const targetY = startY + Math.sin(angle) * distance;
      
      const size = 1 + Math.random() * 3;
      
      return {
        id: i,
        startX,
        startY,
        targetX,
        targetY,
        size,
        delay: Math.random() * 0.8,
        duration: 0.8 + Math.random() * 1.2,
      };
    });
  }, [width, height, count]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      <AnimatePresence>
        {isHovered && particles.map(p => (
          <motion.div
            key={p.id}
            initial={{ 
              x: p.startX, 
              y: p.startY, 
              opacity: 0, 
              scale: 0 
            }}
            animate={{ 
              x: p.targetX, 
              y: p.targetY, 
              opacity: [0, 1, 0], 
              scale: [0, p.size / 2, 0],
              rotate: Math.random() * 360
            }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ 
              duration: p.duration, 
              delay: p.delay,
              ease: "easeOut",
              opacity: { times: [0, 0.2, 1] },
              scale: { times: [0, 0.2, 1] },
              repeat: Infinity
            }}
            className="absolute rounded-full"
            style={{ 
              width: p.size, 
              height: p.size, 
              backgroundColor: color,
              boxShadow: `0 0 ${p.size * 2}px ${color}` 
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};
