import React, { useRef, useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { TransitionStateInfo } from './ParticleCanvas/TransitionManager';
import { Zap } from 'lucide-react';

interface SequenceInfo {
  name: string;
  description: string;
  id?: string;
  tags: string[];
}

interface InterstellarHUDProps {
  sequenceInfo: SequenceInfo;
  transitionInfo?: TransitionStateInfo;
  onTriggerTransition?: () => void;
}

export const InterstellarHUD: React.FC<InterstellarHUDProps> = ({
  sequenceInfo,
  transitionInfo,
  onTriggerTransition,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (ref.current) {
      setDimensions({
        width: ref.current.offsetWidth,
        height: ref.current.offsetHeight
      });
    }
  }, []);
  
  // Motion values for cursor position relative to the center of the card
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  // Spring physics for smooth return
  const springConfig = { damping: 20, stiffness: 150, mass: 0.5 };
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);
  
  // Transform values based on distance from center
  const rotateX = useTransform(springY, [-100, 100], [15, -15]); // Adjust max rotation degrees
  const rotateY = useTransform(springX, [-100, 100], [-15, 15]);
  const translateX = useTransform(springX, [-100, 100], [-10, 10]);
  const translateY = useTransform(springY, [-100, 100], [-10, 10]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Distance from center
    x.set(e.clientX - centerX);
    y.set(e.clientY - centerY);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
    setIsHovered(false);
  };

  const isTransitioning = transitionInfo?.isTransitioning;

  return (
    <motion.div
      ref={ref}
      key={`hud-interstellar-compact-${sequenceInfo.name}`}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        x: translateX,
        y: translateY,
        transformPerspective: 800,
      }}
      id="interstellar-hud"
      className="fixed bottom-6 left-6 z-40 w-full max-w-[210px] pointer-events-auto flex flex-col gap-2.5 text-left relative"
    >

      <motion.div 
        animate={{ opacity: isHovered ? 0 : 1, filter: isHovered ? 'blur(10px)' : 'blur(0px)', scale: isHovered ? 0.95 : 1 }}
        transition={{ duration: 0.3 }}
        className="w-full h-full flex flex-col gap-2.5 bg-black/35 backdrop-blur-md border border-[#e8e2d7]/15 rounded-xl p-3.5 shadow-[0_12px_24px_rgba(0,0,0,0.5)]"
      >
        {/* Top Section */}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[8px] text-[#f5f2eb]/40 tracking-widest font-semibold uppercase">
              COSMIC SEQUENCE
            </span>
            {sequenceInfo.id && (
              <span className="font-mono text-[7.5px] text-[#ffd778] font-bold tracking-wider uppercase border border-[#ffd778]/25 px-1 bg-[#ffd778]/5 rounded">
                {sequenceInfo.id}
              </span>
            )}
          </div>
          <div className="font-mono text-[9px] tracking-widest text-[#4deeea] font-bold uppercase drop-shadow-[0_0_8px_rgba(77,238,234,0.3)]">
            ASTROPHYSICS ENGINE
          </div>
        </div>

        {/* State Machine Transition Status Overlay */}
        {transitionInfo && (
          <div className="flex flex-col gap-1 p-2 rounded bg-white/5 border border-white/10">
            <div className="flex items-center justify-between font-mono text-[8px] text-[#4deeea] tracking-wider uppercase font-semibold">
              <span className="flex items-center gap-1">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${isTransitioning ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
                STATE: {transitionInfo.stage}
              </span>
              <span>{Math.round(transitionInfo.progress * 100)}%</span>
            </div>
            <div className="text-[8px] text-slate-300 font-mono truncate">
              {transitionInfo.description}
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden mt-0.5">
              <div 
                className="bg-gradient-to-r from-cyan-400 to-amber-400 h-full transition-all duration-300"
                style={{ width: `${Math.round(transitionInfo.progress * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Middle textual content */}
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-[#f5f2eb] tracking-tight font-serif">
            {sequenceInfo.name}
          </h3>
          <p className="text-[#f5f2eb]/70 text-[10px] leading-relaxed font-sans font-light">
            {sequenceInfo.description}
          </p>
        </div>

        {/* Trigger Supernova Shift Button */}
        {onTriggerTransition && (
          <button
            
            onClick={(e) => {
              e.stopPropagation();
              onTriggerTransition();
            }}
            disabled={isTransitioning}
            className="w-full mt-1 px-2 py-1.5 rounded bg-[#c14b2a]/20 hover:bg-[#c14b2a]/40 border border-[#c14b2a]/40 hover:border-[#c14b2a] text-[#f5f2eb] font-mono text-[9px] tracking-wider font-semibold uppercase flex items-center justify-center gap-1.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Zap className="w-3 h-3 text-[#ffd778]" />
            <span>{isTransitioning ? 'TRANSITIONING...' : 'TRIGGER SUPERNOVA'}</span>
          </button>
        )}

        {/* Action hints / tags */}
        <div className="flex flex-wrap gap-1 mt-0.5">
          {sequenceInfo.tags.slice(0, 3).map(tag => (
              <span key={tag} className="px-1.5 py-0.5 bg-[#f5f2eb]/5 border border-[#e1d6c0]/15 rounded text-[8px] font-mono text-[#f5f2eb]/80 tracking-widest uppercase">
                {tag}
              </span>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};
