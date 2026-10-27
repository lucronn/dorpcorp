import React, { useState, useRef, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { Project, projects } from '../types';

interface ProjectHUDProps {
  project: Project;
  index: number;
  onNavigateStage?: (stage: number) => void;
  onEnterSandbox?: () => void;
}

export const ProjectHUD: React.FC<ProjectHUDProps> = ({
  project,
  index,
  onNavigateStage,
  onEnterSandbox,
}) => {
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
      onMouseEnter={() => {
        if (typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches) {
          setIsHovered(true);
        }
      }}
      onMouseLeave={() => setIsHovered(false)}
    >
      
      <motion.div 
        animate={{ opacity: 1, filter: 'blur(0px)', scale: isHovered ? 1.02 : 1 }}
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
        <motion.div style={{ y: yTags }} className="z-10 flex flex-col gap-4">
          {project.metrics && project.metrics.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {project.metrics.map((metric: string) => (
                <span
                  key={metric}
                  className="px-2.5 py-1 bg-[#4deeea]/10 backdrop-blur-md border border-[#4deeea]/30 rounded-md text-[9.5px] font-mono text-[#4deeea] font-semibold tracking-widest uppercase shadow-[0_0_15px_rgba(77,238,234,0.12)]"
                >
                  ◆ {metric}
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {project.tags.map((tag: string) => (
               <span key={tag} className="project-tag px-3 py-1.5 bg-[#f5f2eb]/5 backdrop-blur-sm border border-[#e1d6c0]/20 hover:border-[#ffd778]/40 rounded-full text-[10px] font-mono text-[#f5f2eb]/85 tracking-widest shadow-sm transition-colors">
                 {tag}
               </span>
            ))}
          </div>

          {onNavigateStage && (
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateStage(stage - 1);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black/60 hover:bg-white/10 border border-white/15 hover:border-white/35 text-[#f5f2eb]/80 hover:text-white font-mono text-[9.5px] tracking-[0.18em] uppercase backdrop-blur-xl transition-all cursor-pointer active:scale-95"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-[#4deeea]" />
                <span>{index === 0 ? '01 // OVERVIEW' : `0${stage - 1} // PREV`}</span>
              </button>

              {index < projects.length - 1 ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigateStage(stage + 1);
                  }}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#4deeea]/15 hover:bg-[#4deeea]/25 border border-[#4deeea]/40 hover:border-[#4deeea] text-[#f5f2eb] font-mono text-[9.5px] tracking-[0.18em] font-semibold uppercase backdrop-blur-xl transition-all cursor-pointer active:scale-95"
                >
                  <span>NEXT: 0{stage + 1} // {projects[index + 1]?.title.split(' ')[0]}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#4deeea]" />
                </button>
              ) : (
                onEnterSandbox && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEnterSandbox();
                    }}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-indigo-500/20 hover:bg-indigo-500/35 border border-indigo-400/45 hover:border-indigo-300 text-indigo-100 font-mono text-[9.5px] tracking-[0.18em] font-semibold uppercase backdrop-blur-xl transition-all cursor-pointer active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                    <span>WARP TO 3D SANDBOX [W]</span>
                  </button>
                )
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
};
