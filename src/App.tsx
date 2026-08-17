import React, { useState, useEffect, useRef } from 'react';
import { ParticleCanvas } from './components/ParticleCanvas';
import { WavelengthBackground } from './components/WavelengthBackground';
import { ErrorOverlay } from './components/ErrorOverlay';
import { projects } from './types';
import { ProjectHUD } from './components/ProjectHUD';
import { InterstellarHUD } from './components/InterstellarHUD';
import { DebugInspectorCard } from './components/DebugInspectorCard';
import { ParticleFilters } from './components/ParticleCanvas/types';
import { CosmicTransitionStateMachine, TransitionStateInfo } from './components/ParticleCanvas/TransitionManager';
import { AnimatePresence, motion, useScroll, useTransform } from 'motion/react';
import { ExternalLink, Github, Volume2, VolumeX, Eye, EyeOff, Terminal } from 'lucide-react';
import { audio } from './utils/audio';
import { CustomCursor } from './components/CustomCursor';

export default function App() {
  const [stage, setStage] = useState(0);
  const [isInterstellar, setIsInterstellar] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const transitionStateMachineRef = useRef<CosmicTransitionStateMachine>(new CosmicTransitionStateMachine());
  const [transitionInfo, setTransitionInfo] = useState<TransitionStateInfo>({
    stage: 'IDLE_BLACKHOLE',
    progress: 0,
    description: 'Singularity Core Stable',
    isTransitioning: false,
  });
  const [particleFilters, setParticleFilters] = useState<ParticleFilters>({
    ambient: false,
    celestial: true,
    bridges: true,
    tails: true,
    typography: true,
  });
  useEffect(() => {
    const safeStringify = (val: any): string => {
      if (val === null || val === undefined) return String(val);
      if (typeof val !== 'object') return String(val);
      try {
        const seen = new WeakSet();
        return JSON.stringify(val, (key, value) => {
          if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) return '[Circular]';
            seen.add(value);
          }
          return value;
        });
      } catch {
        return String(val);
      }
    };

    const origLog = console.log;
    console.log = (...args) => {
      origLog(...args);
      const msg = args.map(safeStringify).join(' ');
      if (msg.includes("[DEBUG]") || msg.includes("Error")) {
         setDebugLogs(prev => [...prev.slice(-15), msg]);
      }
    };
    
    const origError = console.error;
    console.error = (...args) => {
      origError(...args);
      const msg = "[ERROR] " + args.map(safeStringify).join(' ');
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
    id: 'seq-singularity-event',
    name: 'Singularity Event',
    description: 'A supermassive rotating black hole locking dozens of systems in an aggressive accretion orbit.',
    tags: ['🕳 BLACK HOLE', '☄ ACCRETION DISK', '★ GRAVITY SHEAR']
  });
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });
  const [muted, setMuted] = useState(true);
  const [showSequenceCard, setShowSequenceCard] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const [textParticleSpeed, setTextParticleSpeed] = useState<number>(0.12);
  const [ambientParticleSpeed, setAmbientParticleSpeed] = useState<number>(0.15);
  const [objectParticleSpeed, setObjectParticleSpeed] = useState<number>(0.15);
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
      const target = e.target as HTMLElement | null;
      if (target && target.tagName !== "CANVAS" && target.id !== "canvas-babylon") {
        if (
          target.closest &&
          (target.closest(".pointer-events-auto") ||
            target.closest("button") ||
            target.closest("input") ||
            target.closest("a") ||
            target.closest("[role='dialog']"))
        ) {
          resetIdleTimer();
          return;
        }
      }
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
      <CustomCursor />
      <ErrorOverlay />
      {/* Background visual engine */}
      <WavelengthBackground stage={stage} />
      <DebugInspectorCard
        showDebug={showDebug}
        setShowDebug={setShowDebug}
        debugLogs={debugLogs}
        particleFilters={particleFilters}
        setParticleFilters={setParticleFilters}
        textParticleSpeed={textParticleSpeed}
        setTextParticleSpeed={setTextParticleSpeed}
        ambientParticleSpeed={ambientParticleSpeed}
        setAmbientParticleSpeed={setAmbientParticleSpeed}
        objectParticleSpeed={objectParticleSpeed}
        setObjectParticleSpeed={setObjectParticleSpeed}
      />
      
      {/* Control Pod in Top Right Corner */}
      <div className="fixed top-6 right-6 lg:top-8 lg:right-8 z-50 flex items-center gap-3">
        {/* Info Toggle Button (only when interstellar/screensaver) */}
        <AnimatePresence>
          {isInterstellar && (
            <motion.button
              data-magnetic
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
                  <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-[#4deeea] opacity-50"></span>
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
          data-magnetic
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
              <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-[#c14b2a] opacity-50"></span>
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
          data-magnetic
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
              <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-[#4deeea] opacity-50"></span>
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
         className="fixed inset-0 z-30 pointer-events-none p-6 sm:p-16"
      >
        <AnimatePresence>
          {!isInterstellar && stage >= 2 && project && (
            <ProjectHUD project={project} index={activeProjectIndex} key={`hud-${stage}`} />
          )}
        </AnimatePresence>
      </div>

      {/* Sequence Card (25% size, bottom left corner, toggle-able) */}
      <AnimatePresence>
        {isInterstellar && showSequenceCard && (
          <InterstellarHUD 
            sequenceInfo={sequenceInfo} 
            transitionInfo={transitionInfo}
            onTriggerTransition={() => {
              if (transitionStateMachineRef.current) {
                transitionStateMachineRef.current.executeBlackHoleToSupernovaTransition({
                  x: window.innerWidth / 2,
                  y: window.innerHeight / 2,
                });
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Particle System Canvas - Positioned slightly above the HTML so it looks like it's drawing the frame around the readable text */}
      <div className="fixed inset-0 z-10 opacity-90">
        <ParticleCanvas 
          stage={stage} 
          isInterstellar={isInterstellar} 
          animationComplete={() => setIsInterstellar(true)} 
          onSequenceGenerated={setSequenceInfo}
          showDebug={showDebug}
          particleFilters={particleFilters}
          textParticleSpeed={textParticleSpeed}
          ambientParticleSpeed={ambientParticleSpeed}
          objectParticleSpeed={objectParticleSpeed}
          onTransitionStateChange={setTransitionInfo}
          transitionStateMachineRef={transitionStateMachineRef}
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
