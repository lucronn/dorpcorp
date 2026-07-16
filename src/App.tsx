import React, { useState, useEffect } from 'react';
import { ParticleCanvas } from './components/ParticleCanvas';
import { WavelengthBackground } from './components/WavelengthBackground';
import { ErrorOverlay } from './components/ErrorOverlay';
import { projects } from './types';
import { AnimatePresence, motion } from 'motion/react';
import { ExternalLink, Github, Volume2, VolumeX, Eye, EyeOff, Terminal } from 'lucide-react';
import { audio } from './utils/audio';

function ErrorOverlay() {
  const [errors, setErrors] = useState<string[]>([]);
  useEffect(() => {
    const origError = console.error;
    console.error = (...args) => {
      setErrors(e => [...e, args.map(a => {
        try {
          return typeof a === 'object' ? JSON.stringify(a) : String(a);
        } catch (err) {
          return String(a);
        }
      }).join(' ')].slice(-5));
      origError(...args);
    };
    window.onerror = (msg, url, line, col, error) => {
      setErrors(e => [...e, `${msg} at ${line}:${col}`].slice(-5));
    };
    return () => { console.error = origError; };
  }, []);
  if (errors.length === 0) return null;
  return (
    <div style={{position:'fixed', zIndex: 9999, top:0, left:0, background:'rgba(255,0,0,0.8)', color:'white', padding:10, fontSize:12, pointerEvents:'none', width:'100%'}}>
      {errors.map((e, i) => <div key={i}>{e}</div>)}
    </div>
  );
}

export default function App() {
  const [stage, setStage] = useState(0);
  const [isInterstellar, setIsInterstellar] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  useEffect(() => {
    const origLog = console.log;
    console.log = (...args) => {
      origLog(...args);
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      if (msg.includes("[DEBUG]") || msg.includes("Error")) {
         setDebugLogs(prev => [...prev.slice(-15), msg]);
      }
    };
    
    const origError = console.error;
    console.error = (...args) => {
      origError(...args);
      const msg = "[ERROR] " + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      setDebugLogs(prev => [...prev.slice(-15), msg]);
    };

    window.onerror = (message, source, lineno, colno, error) => {
      const msg = "[ERROR] " + message + " at " + source + ":" + lineno;
      setDebugLogs(prev => [...prev.slice(-15), msg]);
    };
    window.onunhandledrejection = (event) => {
      const msg = "[ERROR] Unhandled Rejection: " + (event.reason ? event.reason.toString() : 'Unknown');
      setDebugLogs(prev => [...prev.slice(-15), msg]);
    };
  }, []);
  const [sequenceInfo, setSequenceInfo] = useState<{
    id?: string;
    name: string;
    description: string;
    tags: string[];
  }>({
    id: 'seq-andromeda-gateway',
    name: 'Interstellar Void',
    description: 'A pocket universe birthed from the supernova dust. Move your cursor to bend spacetime with gravity, or click anywhere to collapse reality and seed a new cosmic sequence.',
    tags: ['★ NEBULAS', '🪐 PLANETS & RINGS', '☄ ACCRETION DISK', '🕳 BLACK HOLE']
  });
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });
  const [muted, setMuted] = useState(true);
  const [showSequenceCard, setShowSequenceCard] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const [isIdle, setIsIdle] = useState(false);
  const [isSoundHovered, setIsSoundHovered] = useState(false);
  const [isInfoHovered, setIsInfoHovered] = useState(false);
  const [isDebugHovered, setIsDebugHovered] = useState(false);

  const isSoundCompacted = isIdle && !isSoundHovered;
  const isInfoCompacted = isIdle && !isInfoHovered;
  const isDebugCompacted = isIdle && !isDebugHovered;

  useEffect(() => {
    let ticking = false;
    let maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);

    let idleTimer: ReturnType<typeof setTimeout>;
    const resetIdleTimer = () => {
      setIsIdle(false);
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        setIsIdle(true);
      }, 5000); // 5 seconds idle threshold
    };
    resetIdleTimer();

    const handleResize = () => {
      maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    };

    const handleScroll = () => {
      audio.pingInteraction(); // Introduce darker secondary track on scroll
      resetIdleTimer();
      if (!ticking) {
        window.requestAnimationFrame(() => {
          let scrollY = window.scrollY || document.documentElement.scrollTop;
          
          // Endless scrolling loop
          if (scrollY >= maxScroll - 2) {
             window.scrollTo({ top: 10, behavior: 'instant' });
             scrollY = 10;
          } else if (scrollY <= 0) {
             window.scrollTo({ top: maxScroll - 10, behavior: 'instant' });
             scrollY = maxScroll - 10;
          }

          const scrollFraction = Math.max(0, Math.min(1, scrollY / maxScroll));
          
          // 6 even stages: 0 to 5
          const numStages = 6;
          const newStage = Math.min(numStages - 1, Math.floor(scrollFraction * numStages));
          
          setStage(prev => {
            if (prev !== newStage) {
              audio.playStageSwell(newStage); // Play dramatic luxury synth chord swell
              setIsInterstellar(false); // Reset interstellar mode when user scrolls
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
      audio.pingInteraction(); // Slowly build darker tones on mouse movement
      setMousePos({ x: e.clientX, y: e.clientY });
      resetIdleTimer();
    };

    const handleClick = (e: MouseEvent) => {
      // Play high fidelity physical audio click pop matching the ripple shockwave
      audio.playRippleShockwave();
      resetIdleTimer();
    };

    const handleKeyPress = () => {
      resetIdleTimer();
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('click', handleClick);
    window.addEventListener('keypress', handleKeyPress, { passive: true });
    handleScroll();
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keypress', handleKeyPress);
      clearTimeout(idleTimer);
    };
  }, []);

  const activeProjectIndex = stage - 2;
  const project = activeProjectIndex >= 0 && activeProjectIndex < projects.length ? projects[activeProjectIndex] : null;

  return (
    <div className="relative bg-black text-slate-200 overflow-x-hidden font-sans selection:bg-[#c14b2a]/30 selection:text-white">
      <ErrorOverlay />
      {/* Background visual engine */}
      <WavelengthBackground />
      {showDebug && (
        <div className="fixed top-0 left-0 z-[9999] p-4 text-green-400 font-mono text-xs max-w-[50vw] pointer-events-none bg-black/80">
          {debugLogs.map((log, i) => <div key={i}>{log}</div>)}
        </div>
      )}
      
      {/* Control Pod in Top Right Corner */}
      <div className="fixed top-6 right-6 lg:top-8 lg:right-8 z-50 flex items-center gap-3">
        {/* Info Toggle Button (only when interstellar/screensaver) */}
        <AnimatePresence>
          {isInterstellar && (
            <motion.button
              initial={{ opacity: 0, x: 20, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.8 }}
              transition={{ duration: 0.4 }}
              onClick={(e) => {
                e.stopPropagation();
                setShowSequenceCard(!showSequenceCard);
              }}
              onMouseEnter={() => setIsInfoHovered(true)}
              onMouseLeave={() => setIsInfoHovered(false)}
              className={`flex items-center justify-center gap-2 border bg-[#f9f8f3]/5 border-[#e8e2d7]/15 hover:bg-[#e8e2d7]/10 hover:border-[#e8e2d7]/30 text-[#f5f2eb] rounded-full font-mono tracking-widest font-semibold transition-all duration-300 shadow-[0_15px_30px_rgba(0,0,0,0.3)] backdrop-blur-md cursor-pointer group ${
                isInfoCompacted 
                  ? 'w-10 h-10 p-0 opacity-25' 
                  : 'px-4 py-2 w-auto opacity-100 text-[10px]'
              }`}
              title={showSequenceCard ? "Hide cosmic sequence telemetry" : "Show cosmic sequence telemetry"}
            >
              <span className="relative flex h-2 w-2 items-center justify-center shrink-0">
                {showSequenceCard && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4deeea] opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${!showSequenceCard ? 'bg-[#e8e2d7]/40' : 'bg-[#4deeea]'}`}></span>
              </span>

              {!isInfoCompacted && (
                <span className="overflow-hidden whitespace-nowrap">
                  {showSequenceCard ? 'TELEMETRY ON' : 'TELEMETRY OFF'}
                </span>
              )}

              {showSequenceCard ? (
                <Eye className="w-3.5 h-3.5 shrink-0 text-[#4deeea]" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 shrink-0 text-[#e8e2d7]/60" />
              )}
            </motion.button>
          )}
        </AnimatePresence>

        {/* Interactive Sound Orchestration HUD Toggle */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            const nextMute = !muted;
            setMuted(nextMute);
            audio.setMute(nextMute);
          }}
          onMouseEnter={() => setIsSoundHovered(true)}
          onMouseLeave={() => setIsSoundHovered(false)}
          className={`flex items-center justify-center gap-2 border bg-[#f9f8f3]/5 border-[#e8e2d7]/15 hover:bg-[#e8e2d7]/10 hover:border-[#e8e2d7]/30 text-[#f5f2eb] rounded-full font-mono tracking-widest font-semibold transition-all duration-300 shadow-[0_15px_30px_rgba(0,0,0,0.3)] backdrop-blur-md cursor-pointer group ${
            isSoundCompacted 
              ? 'w-10 h-10 p-0 opacity-25' 
              : 'px-4 py-2 w-auto opacity-100 text-[10px]'
          }`}
          title={muted ? "Enable celestial audio ambiance" : "Mute audio"}
        >
          <span className="relative flex h-2 w-2 items-center justify-center shrink-0">
            {!muted && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c14b2a] opacity-75"></span>
            )}
            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${muted ? 'bg-[#e8e2d7]/40' : 'bg-[#c14b2a]'}`}></span>
          </span>
          
          {!isSoundCompacted && (
            <span className="overflow-hidden whitespace-nowrap">
              {muted ? 'SOUND ON' : 'SOUND OFF'}
            </span>
          )}
          
          <div className="flex gap-[2px] items-end h-3 shrink-0">
            <div className={`w-[2px] bg-[#c14b2a] rounded-sm transition-all duration-300 ${muted ? 'h-1 opacity-30' : 'h-3'}`} />
            <div className={`w-[2px] bg-[#c14b2a] rounded-sm transition-all duration-300 [animation-delay:0.15s] ${muted ? 'h-1.5 opacity-30' : 'h-2.5'}`} />
            <div className={`w-[2px] bg-[#c14b2a] rounded-sm transition-all duration-300 [animation-delay:0.3s] ${muted ? 'h-1 opacity-30' : 'h-3.5'}`} />
          </div>
        </button>

        {/* Debug Logs Overlay Toggle */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setShowDebug(!showDebug);
          }}
          onMouseEnter={() => setIsDebugHovered(true)}
          onMouseLeave={() => setIsDebugHovered(false)}
          className={`flex items-center justify-center gap-2 border bg-[#f9f8f3]/5 border-[#e8e2d7]/15 hover:bg-[#e8e2d7]/10 hover:border-[#e8e2d7]/30 text-[#f5f2eb] rounded-full font-mono tracking-widest font-semibold transition-all duration-300 shadow-[0_15px_30px_rgba(0,0,0,0.3)] backdrop-blur-md cursor-pointer group ${
            isDebugCompacted 
              ? 'w-10 h-10 p-0 opacity-25' 
              : 'px-4 py-2 w-auto opacity-100 text-[10px]'
          }`}
          title={showDebug ? "Hide system debug overlay" : "Show system debug overlay"}
        >
          <span className="relative flex h-2 w-2 items-center justify-center shrink-0">
            {showDebug && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4deeea] opacity-75"></span>
            )}
            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${!showDebug ? 'bg-[#e8e2d7]/40' : 'bg-[#4deeea]'}`}></span>
          </span>
          
          {!isDebugCompacted && (
            <span className="overflow-hidden whitespace-nowrap">
              {showDebug ? 'DEBUG ON' : 'DEBUG OFF'}
            </span>
          )}
          
          <Terminal className="w-3.5 h-3.5 shrink-0" />
        </button>
      </div>

      {/* HUD Layout for Project Details (Immersive, no box overlays) */}
      <div 
         className="fixed inset-0 z-30 pointer-events-none flex items-end sm:items-center justify-start p-6 sm:p-16"
      >
        <AnimatePresence mode="wait">
          {!isInterstellar && stage >= 2 && project && (
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
              <div className="flex flex-col items-start z-10 w-full relative mb-8">
                <div id="project-number" className="font-mono text-xs text-[#f5f2eb]/40 tracking-[0.4em] leading-none mb-4 font-semibold uppercase">
                  Project {String(activeProjectIndex + 1).padStart(2, '0')} // 04
                </div>
                <div id="project-category" className="font-mono text-xs tracking-widest text-[#4deeea] font-bold uppercase opacity-90 drop-shadow-[0_0_12px_rgba(77,238,234,0.3)]">
                  {project.category}
                </div>
              </div>

              {/* Middle textual content */}
              <div className="z-10 text-left mb-10">
                <h3 id="project-title" className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-[#f5f2eb] mb-6 tracking-tight font-serif drop-shadow-[0_4px_32px_rgba(0,0,0,0.9)]">
                  {project.title}
                </h3>
                <p id="project-description" className="text-[#f5f2eb]/70 text-base sm:text-lg leading-relaxed font-sans font-light drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]">
                  {project.description}
                </p>
              </div>

              {/* Tags & Actions */}
              <div className="z-10 flex flex-col gap-8">
                <div className="flex flex-wrap gap-2">
                  {project.tags.map(tag => (
                     <span key={tag} className="project-tag px-3 py-1.5 bg-[#f5f2eb]/5 backdrop-blur-sm border border-[#e1d6c0]/20 rounded-full text-[10px] font-mono text-[#f5f2eb]/80 tracking-widest shadow-sm">
                       {tag}
                     </span>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sequence Card (25% size, bottom left corner, toggle-able) */}
      <AnimatePresence>
        {isInterstellar && showSequenceCard && (
          <motion.div
            key={`hud-interstellar-compact-${sequenceInfo.name}`}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            id="interstellar-hud"
            className="fixed bottom-6 left-6 z-40 w-full max-w-[210px] bg-black/35 backdrop-blur-md border border-[#e8e2d7]/15 rounded-xl p-3.5 shadow-[0_12px_24px_rgba(0,0,0,0.5)] pointer-events-auto flex flex-col gap-2.5 text-left"
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

            {/* Middle textual content */}
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-[#f5f2eb] tracking-tight font-serif">
                {sequenceInfo.name}
              </h3>
              <p className="text-[#f5f2eb]/70 text-[10px] leading-relaxed font-sans font-light">
                {sequenceInfo.description}
              </p>
            </div>

            {/* Action hints / tags */}
            <div className="flex flex-wrap gap-1 mt-1">
              {sequenceInfo.tags.slice(0, 3).map(tag => (
                 <span key={tag} className="px-1.5 py-0.5 bg-[#f5f2eb]/5 border border-[#e1d6c0]/15 rounded text-[8px] font-mono text-[#f5f2eb]/80 tracking-widest uppercase">
                   {tag}
                 </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Particle System Canvas - Positioned slightly above the HTML so it looks like it's drawing the frame around the readable text */}
      <div className="fixed inset-0 z-10 opacity-90">
        <ParticleCanvas 
          stage={stage} 
          isInterstellar={isInterstellar} 
          animationComplete={() => setIsInterstellar(true)} 
          onSequenceGenerated={setSequenceInfo}
        />
      </div>

      {/* The invisible scrolling track providing native scroll height */}
      <div className="w-full relative z-20 shrink-0 pointer-events-none" style={{ height: '800vh' }} />

      {/* Unobtrusive scroll direction hint */}
      <div 
         className="fixed bottom-12 left-1/2 -translate-x-1/2 z-30 font-mono text-xs tracking-widest text-slate-500 uppercase flex flex-col items-center gap-2 pointer-events-none transition-opacity duration-1000" 
         style={{ opacity: isInterstellar || stage > 0 ? 0.0 : 1 }}
      >
         <span>Scroll Sequence</span>
         <div className="w-px h-8 bg-gradient-to-b from-slate-500 to-transparent"></div>
      </div>
    </div>
  );
}
