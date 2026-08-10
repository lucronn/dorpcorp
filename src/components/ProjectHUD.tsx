import React, { useState, useRef, useEffect } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'motion/react';
import { Project } from '../types';
import { CardParticles } from './CardParticles';

interface ProjectHUDProps {
  project: any;
  index: number;
}

export const ProjectHUD: React.FC<ProjectHUDProps> = ({ project, index }) => {
  const { scrollYProgress } = useScroll();
  const stage = index + 2;
  const start = stage / 6;
  const end = (stage + 1) / 6;

  // Compute parallax transforms for depth effect
  const yCat = useTransform(scrollYProgress, [start, end], [15, -15]);
  const yTitle = useTransform(scrollYProgress, [start, end], [35, -35]);
  const yDesc = useTransform(scrollYProgress, [start, end], [55, -55]);
  const yTags = useTransform(scrollYProgress, [start, end], [75, -75]);

  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.offsetWidth,
        height: containerRef.current.offsetHeight
      });
    }
  }, []);

  return (
    <motion.div
      ref={containerRef}
      key={`hud-${stage}`}
      initial={{ y: 50, opacity: 0, filter: 'blur(10px)' }}
      animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
      exit={{ y: -50, opacity: 0, filter: 'blur(10px)' }}
      transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
      id="project-hud"
      className="absolute bottom-6 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 left-6 sm:left-16 w-full max-w-[500px] pointer-events-auto flex flex-col relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardParticles isHovered={isHovered} width={dimensions.width} height={dimensions.height} color="#4deeea" count={120} />
      
      <motion.div 
        animate={{ opacity: isHovered ? 0 : 1, filter: isHovered ? 'blur(10px)' : 'blur(0px)', scale: isHovered ? 0.95 : 1 }}
        transition={{ duration: 0.3 }}
        className="w-full h-full flex flex-col"
      >
        {/* Top Section */}
        <motion.div style={{ y: yCat }} className="flex flex-col items-start z-10 w-full relative mb-8">
          <div id="project-number" className="font-mono text-xs text-[#f5f2eb]/40 tracking-[0.4em] leading-none mb-4 font-semibold uppercase">
            Project {String(index + 1).padStart(2, '0')} // 04
          </div>
          <div id="project-category" className="font-mono text-xs tracking-widest text-[#4deeea] font-bold uppercase opacity-90 drop-shadow-[0_0_12px_rgba(77,238,234,0.3)]">
            {project.category}
          </div>
        </motion.div>

        {/* Middle textual content */}
        <div className="z-10 text-left mb-10">
          <motion.h3 style={{ y: yTitle }} id="project-title" className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-[#f5f2eb] mb-6 tracking-tight font-serif drop-shadow-[0_4px_32px_rgba(0,0,0,0.9)]">
            {project.title}
          </motion.h3>
          <motion.p style={{ y: yDesc }} id="project-description" className="text-[#f5f2eb]/70 text-base sm:text-lg leading-relaxed font-sans font-light drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]">
            {project.description}
          </motion.p>
        </div>

        {/* Tags & Actions */}
        <motion.div style={{ y: yTags }} className="z-10 flex flex-col gap-8">
          <div className="flex flex-wrap gap-2">
            {project.tags.map((tag: string) => (
               <span key={tag} className="project-tag px-3 py-1.5 bg-[#f5f2eb]/5 backdrop-blur-sm border border-[#e1d6c0]/20 rounded-full text-[10px] font-mono text-[#f5f2eb]/80 tracking-widest shadow-sm">
                 {tag}
               </span>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};
