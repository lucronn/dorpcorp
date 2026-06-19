import React, { useState, useEffect } from 'react';
import { ParticleCanvas, projects } from './components/ParticleCanvas';
import { WavelengthBackground } from './components/WavelengthBackground';
import { AnimatePresence, motion } from 'motion/react';
import { ExternalLink, Github, Volume2, VolumeX } from 'lucide-react';
import { audio } from './utils/audio';

export default function App() {
  const [stage, setStage] = useState(0);
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    let ticking = false;
    let maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);

    const handleResize = () => {
      maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY || document.documentElement.scrollTop;
          const scrollFraction = Math.max(0, Math.min(1, scrollY / maxScroll));
          
          // 6 even stages: 0 to 5
          const numStages = 6;
          const newStage = Math.min(numStages - 1, Math.floor(scrollFraction * numStages));
          
          setStage(prev => {
            if (prev !== newStage) {
              audio.playStageSwell(newStage); // Play dramatic luxury synth chord swell
              return newStage;
            }
            return prev;
          });
          ticking = false;
        });
        ticking = true;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleClick = (e: MouseEvent) => {
      // Play high fidelity physical audio click pop matching the ripple shockwave
      audio.playRippleShockwave();
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('click', handleClick);
    handleScroll();
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
    };
  }, []);

  const activeProjectIndex = stage - 2;
  const project = activeProjectIndex >= 0 && activeProjectIndex < projects.length ? projects[activeProjectIndex] : null;

  return (
    <div className="relative bg-[#322d29] text-slate-200 overflow-x-hidden font-sans selection:bg-[#c14b2a]/30 selection:text-white">
      {/* Background visual engine */}
      <WavelengthBackground />
      
      {/* Interactive Sound Orchestration HUD Toggle */}
      <button 
        onClick={(e) => {
          e.stopPropagation();
          const nextMute = !muted;
          setMuted(nextMute);
          audio.setMute(nextMute);
        }}
        className="fixed top-6 right-6 lg:top-8 lg:right-8 z-50 flex items-center gap-3 px-4.5 py-2 bg-[#f9f8f3]/5 border border-[#e8e2d7]/15 hover:bg-[#e8e2d7]/10 hover:border-[#e8e2d7]/30 text-[#f5f2eb] rounded-full text-[10px] font-mono tracking-widest font-semibold transition-all shadow-[0_15px_30px_rgba(0,0,0,0.3)] backdrop-blur-md cursor-pointer group"
        title={muted ? "Enable celestial audio ambiance" : "Mute audio"}
      >
        <span className="relative flex h-2 w-2 items-center justify-center">
          {!muted && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c14b2a] opacity-75"></span>
          )}
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${muted ? 'bg-[#e8e2d7]/40' : 'bg-[#c14b2a]'}`}></span>
        </span>
        
        <span>{muted ? 'SOUND ON' : 'SOUND OFF'}</span>
        
        <div className="flex gap-[2px] items-end h-3">
          <div className={`w-[2px] bg-[#c14b2a] rounded-sm transition-all duration-300 ${muted ? 'h-1 opacity-30' : 'h-3'}`} />
          <div className={`w-[2px] bg-[#c14b2a] rounded-sm transition-all duration-300 [animation-delay:0.15s] ${muted ? 'h-1.5 opacity-30' : 'h-2.5'}`} />
          <div className={`w-[2px] bg-[#c14b2a] rounded-sm transition-all duration-300 [animation-delay:0.3s] ${muted ? 'h-1 opacity-30' : 'h-3.5'}`} />
        </div>
      </button>

      {/* HUD Layout for Project Details (Immersive, no box overlays) */}
      <div 
         className="fixed inset-0 z-30 pointer-events-none flex items-end sm:items-center justify-start p-6 sm:p-16"
      >
        <AnimatePresence mode="wait">
          {stage >= 2 && project && (
            <motion.div
              key={`hud-${stage}`}
              initial={{ y: 50, opacity: 0, filter: 'blur(10px)' }}
              animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
              exit={{ y: -50, opacity: 0, filter: 'blur(10px)' }}
              transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
              id="project-hud"
              className="w-full max-w-[500px] pointer-events-auto"
            >
              {/* Top Section */}
              <div className="flex flex-col items-start z-10 w-full relative mb-8 opacity-0 pointer-events-none">
                <div id="project-number" className="font-mono text-xs text-[#f5f2eb]/40 tracking-[0.4em] leading-none mb-4 font-semibold uppercase">
                  Project {String(activeProjectIndex + 1).padStart(2, '0')} // 04
                </div>
                <div id="project-category" className="font-mono text-xs tracking-widest text-[#4deeea] font-bold uppercase opacity-90 drop-shadow-[0_0_12px_rgba(77,238,234,0.3)]">
                  {project.category}
                </div>
              </div>

              {/* Middle textual content */}
              <div className="z-10 text-left mb-10 opacity-0 pointer-events-none">
                <h3 id="project-title" className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-[#f5f2eb] mb-6 tracking-tight font-serif drop-shadow-[0_4px_32px_rgba(0,0,0,0.9)]">
                  {project.title}
                </h3>
                <p id="project-description" className="text-[#f5f2eb]/70 text-base sm:text-lg leading-relaxed font-sans font-light drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]">
                  {project.description}
                </p>
              </div>

              {/* Tags & Actions */}
              <div className="z-10 flex flex-col gap-8">
                <div className="flex flex-wrap gap-2 opacity-0 pointer-events-none">
                  {project.tags.map(tag => (
                     <span key={tag} className="project-tag px-3 py-1.5 bg-[#f5f2eb]/5 backdrop-blur-sm border border-[#e1d6c0]/20 rounded-full text-[10px] font-mono text-[#f5f2eb]/80 tracking-widest shadow-sm">
                       {tag}
                     </span>
                  ))}
                </div>
                
                <div className="flex gap-4">
                  <motion.button 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.6, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
                      id="project-repo-btn" 
                      className="flex items-center gap-2 px-8 py-4 bg-black/40 backdrop-blur-md hover:bg-[#f5f2eb]/20 rounded-full border-2 border-[#f5f2eb]/40 text-sm font-mono tracking-widest text-[#f5f2eb] transition-all cursor-pointer shadow-[0_4px_16px_rgba(0,0,0,0.5)]">
                      <Github size={16} /> REPO
                  </motion.button>
                  <motion.button 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.6, delay: 0.75, ease: [0.16, 1, 0.3, 1] }}
                      id="project-live-btn" 
                      className="flex items-center gap-2 px-8 py-4 bg-[#c14b2a]/90 hover:bg-[#a64023] shadow-[0_0_40px_rgba(193,75,42,0.6)] text-[#f9f8f3] rounded-full border-2 border-[#f9f8f3]/60 text-sm font-bold tracking-widest font-mono transition-all cursor-pointer backdrop-blur-md">
                      <ExternalLink size={16} /> LIVE
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Particle System Canvas - Positioned slightly above the HTML so it looks like it's drawing the frame around the readable text */}
      <div className="fixed inset-0 z-10 pointer-events-none opacity-90">
        <ParticleCanvas stage={stage} />
      </div>

      {/* The invisible scrolling track providing native scroll height */}
      <div className="w-full relative z-20 shrink-0" style={{ height: '800vh' }} />

      {/* Unobtrusive scroll direction hint */}
      <div 
         className="fixed bottom-12 left-1/2 -translate-x-1/2 z-30 font-mono text-xs tracking-widest text-slate-500 uppercase flex flex-col items-center gap-2 pointer-events-none transition-opacity duration-1000" 
         style={{ opacity: stage > 0 ? 0.0 : 1 }}
      >
         <span>Scroll Sequence</span>
         <div className="w-px h-8 bg-gradient-to-b from-slate-500 to-transparent"></div>
      </div>
    </div>
  );
}
