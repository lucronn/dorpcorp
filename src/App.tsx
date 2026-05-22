import React, { useState, useEffect } from 'react';
import { ParticleCanvas, projects } from './components/ParticleCanvas';
import { WavelengthBackground } from './components/WavelengthBackground';
import { AnimatePresence, motion } from 'motion/react';
import { ExternalLink, Github } from 'lucide-react';

export default function App() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const height = window.innerHeight;
      const maxScroll = Math.max(1, document.body.scrollHeight - height);
      
      const scrollFraction = Math.max(0, Math.min(1, scrollY / maxScroll));
      
      // 6 stages: 0 to 5
      const newStage = Math.round(scrollFraction * 5);
      if (newStage !== stage) {
        setStage(newStage);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [stage]);

  const activeProjectIndex = stage - 2;
  const project = activeProjectIndex >= 0 && activeProjectIndex < projects.length ? projects[activeProjectIndex] : null;

  return (
    <div className="relative bg-[#322d29] text-slate-200 overflow-x-hidden font-sans selection:bg-[#c14b2a]/30 selection:text-white">
      {/* Background visual engine */}
      <WavelengthBackground />
      
      {/* Dynamic Background Darkening layer to make the active card pop out massively */}
      <div 
        className="fixed inset-0 z-0 bg-[#2b2623]/85 backdrop-blur-[4px] transition-all duration-1000 pointer-events-none"
        style={{ opacity: stage >= 2 ? 1 : 0 }}
      />
      
      {/* Real HTML Elements (Tied to the same grid layout as the canvas architectural frame) */}
      <div className="fixed inset-0 z-0 pointer-events-none flex items-center justify-center p-6 lg:p-16">
        <AnimatePresence mode="wait">
          {false && stage >= 2 && project && (
            <motion.div
              key={`card-${stage}`}
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -15 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              id="project-card"
              className="w-full max-w-[1000px] h-full max-h-[600px] bg-[#f9f8f3] shadow-[0_60px_150px_-20px_rgba(20,15,10,0.9),0_20px_50px_-10px_rgba(20,15,10,0.7)] border border-[#e8e2d7] rounded-3xl p-8 lg:p-12 flex flex-col justify-between overflow-hidden"
            >
              {/* Top Section */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 1.0 }}
                className="flex justify-between items-start z-10 w-full relative"
              >
                <div id="project-icon" className="p-4 bg-[#f0ebd9] border border-[#e1d6c0] shadow-sm relative rounded-xl">
                  {React.createElement(project.icon, { className: "w-8 h-8 text-[#c14b2a] stroke-[1.5]" })}
                </div>
                <div id="project-number" className="font-mono text-sm text-[#9c9388] tracking-widest leading-none pt-2 font-semibold">
                  {String(activeProjectIndex + 1).padStart(2, '0')} // 04
                </div>
              </motion.div>

              {/* Middle textual content */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 1.1 }}
                className="z-10 mt-auto mb-10 text-left pt-6"
              >
                <div id="project-category" className="font-mono text-xs tracking-widest text-[#c14b2a] font-bold uppercase mb-4 opacity-90">
                  {project.category}
                </div>
                <h3 id="project-title" className="text-3xl md:text-5xl font-semibold text-[#27221e] mb-6 tracking-tight drop-shadow-sm font-serif">
                  {project.title}
                </h3>
                <p id="project-description" className="text-[#6b635a] max-w-2xl text-base md:text-lg leading-relaxed font-sans font-normal">
                  {project.description}
                </p>
              </motion.div>

              {/* Tags & Actions */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 1.2 }}
                className="z-10 flex flex-col md:flex-row items-start md:items-end justify-between gap-8 pointer-events-auto"
              >
                <div className="flex flex-wrap gap-3">
                  {project.tags.map(tag => (
                    <span key={tag} className="project-tag px-5 py-2 bg-[#f0ebd9] border border-[#e1d6c0] rounded-full text-xs font-mono text-[#5c544d] font-semibold transition-colors hover:bg-[#e8e2d7] hover:text-[#27221e]">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex gap-4">
                  <button id="project-repo-btn" className="flex items-center gap-2 px-6 py-2.5 bg-transparent hover:bg-[#f0ebd9] rounded-xl border border-[#e1d6c0] text-sm font-mono text-[#5c544d] font-semibold hover:text-[#27221e] transition-all cursor-pointer shadow-sm">
                      <Github size={16} /> REPO
                  </button>
                  <button id="project-live-btn" className="flex items-center gap-2 px-6 py-2.5 bg-[#c14b2a] hover:bg-[#a64023] text-[#f9f8f3] rounded-xl font-mono text-sm transition-all cursor-pointer shadow-md font-semibold">
                      <ExternalLink size={16} /> LIVE
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Particle System Canvas - Positioned slightly above the HTML so it looks like it's drawing the frame around the readable text */}
      <div className="fixed inset-0 z-10 pointer-events-none opacity-90 mix-blend-screen">
        <ParticleCanvas stage={stage} />
      </div>

      {/* The invisible scrolling track providing native scroll height */}
      <div className="w-full relative z-20 pointer-events-none" style={{ height: '1500vh' }}>
          {/* Unobtrusive scroll direction hint */}
          <div 
             className="fixed bottom-12 left-1/2 -translate-x-1/2 font-mono text-xs tracking-widest text-slate-500 uppercase flex flex-col items-center gap-2 pointer-events-none transition-opacity duration-1000" 
             style={{ opacity: stage > 0 ? 0.0 : 1 }}
          >
             <span>Scroll Sequence</span>
             <div className="w-px h-8 bg-gradient-to-b from-slate-500 to-transparent"></div>
          </div>
      </div>
    </div>
  );
}
