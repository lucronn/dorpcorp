import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ParticleCanvas } from './components/ParticleCanvas';
import { ErrorOverlay } from './components/ErrorOverlay';
import { projects } from './types';
import { ProjectHUD } from './components/ProjectHUD';
import { InterstellarHUD } from './components/InterstellarHUD';
import { CinematicOverlay } from './components/CinematicOverlay';
import { CosmicScreensaverOverlay } from './components/CosmicScreensaverOverlay';
import { DebugInspectorCard } from './components/DebugInspectorCard';
import { ParticleFilters, CelestialEntity, CinematicCameraMode } from './components/ParticleCanvas/types';
import { CosmicTransitionStateMachine, TransitionStateInfo } from './components/ParticleCanvas/TransitionManager';
import { AnimatePresence, motion } from 'motion/react';
import {
  Eye,
  EyeOff,
  Terminal,
  Film,
  Sparkles,
  Flame,
  Compass,
  Orbit,
  ChevronDown,
  Radio,
} from 'lucide-react';
import { audio } from './utils/audio';

const STAGE_NAV_ITEMS = [
  { stage: 0, code: '00', label: 'SINGULARITY' },
  { stage: 1, code: '01', label: 'SELECTED WORKS' },
  { stage: 2, code: '02', label: 'AI ENGINEERING' },
  { stage: 3, code: '03', label: 'AUTONOMY' },
  { stage: 4, code: '04', label: 'ALIGNMENT' },
  { stage: 5, code: '05', label: 'SYNTHESIS' },
];

export default function App() {
  const [stage, setStage] = useState(0);
  const [isInterstellar, setIsInterstellar] = useState(false);
  const [isAutopilot, setIsAutopilot] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const transitionStateMachineRef = useRef<CosmicTransitionStateMachine>(new CosmicTransitionStateMachine());
  const [transitionInfo, setTransitionInfo] = useState<TransitionStateInfo>({
    stage: 'IDLE_BLACKHOLE',
    progress: 0,
    description: 'Singularity Core Stable',
    isTransitioning: false,
  });
  const [tdeStateInfo, setTdeStateInfo] = useState<{
    isActive: boolean;
    stage: string;
    status: string;
  }>({
    isActive: false,
    stage: 'IDLE',
    status: 'Singularity Core Stable',
  });

  const handleTriggerTDE = useCallback(() => {
    setIsInterstellar(true);
    if ((window as any).triggerTDE) {
      (window as any).triggerTDE();
    } else if ((window as any).__cosmicCanvas?.triggerTDE) {
      (window as any).__cosmicCanvas.triggerTDE();
    }
  }, []);

  const handleLaunchProbe = useCallback(() => {
    setIsInterstellar(true);
    if ((window as any).__cosmicCanvas?.launchProbe) {
      (window as any).__cosmicCanvas.launchProbe();
    } else {
      const simulatedKey = new KeyboardEvent('keydown', { key: 'p', bubbles: true });
      window.dispatchEvent(simulatedKey);
    }
  }, []);

  const handleTriggerWormhole = useCallback(() => {
    setIsInterstellar(true);
    if ((window as any).__cosmicCanvas?.startWormholeTransit) {
      (window as any).__cosmicCanvas.startWormholeTransit();
    }
  }, []);

  const handleTriggerSupernova = useCallback(() => {
    setIsInterstellar(true);
    if ((window as any).__cosmicCanvas?.triggerSupernovaTransition) {
      (window as any).__cosmicCanvas.triggerSupernovaTransition();
    }
  }, []);

  const scrollToStage = useCallback((targetStage: number) => {
    setIsAutopilot(false);
    setIsInterstellar(false);
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const numStages = 6;
    const targetY = ((targetStage + 0.15) / numStages) * maxScroll;
    window.scrollTo({ top: targetY, behavior: 'smooth' });
    setStage(targetStage);
    audio.playStageSwell(targetStage);
  }, []);

  const [particleFilters, setParticleFilters] = useState<ParticleFilters>(() => {
    try {
      const saved = localStorage.getItem('cosmic_particle_filters');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ambient: parsed.ambient !== false,
          celestial: parsed.celestial !== false,
          bridges: parsed.bridges !== false,
          tails: parsed.tails !== false,
          typography: parsed.typography !== false,
        };
      }
    } catch {}
    return {
      ambient: true,
      celestial: true,
      bridges: true,
      tails: true,
      typography: true,
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem('cosmic_particle_filters', JSON.stringify(particleFilters));
    } catch {}
  }, [particleFilters]);

  useEffect(() => {
    const safeStringify = (val: any): string => {
      if (val === null || val === undefined) return String(val);
      if (typeof val !== 'object') return String(val);
      try {
        const seen = new WeakSet();
        return JSON.stringify(val, (_key, value) => {
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

    const isIgnored = (msg: string) => {
      if (!msg) return true;
      const lower = msg.toLowerCase();
      return (
        lower.includes('websocket') ||
        lower.includes('[vite]') ||
        lower.includes('hmr') ||
        lower.includes('failed to connect to websocket')
      );
    };

    const origLog = console.log;
    const origError = console.error;
    const origOnError = window.onerror;
    const origOnUnhandledRejection = window.onunhandledrejection;

    console.log = (...args) => {
      origLog(...args);
      const msg = args.map(safeStringify).join(' ');
      if (!isIgnored(msg) && (msg.includes('[DEBUG]') || msg.includes('Error'))) {
        setDebugLogs((prev) => [...prev.slice(-15), msg]);
      }
    };

    console.error = (...args) => {
      origError(...args);
      const msg = '[ERROR] ' + args.map(safeStringify).join(' ');
      if (!isIgnored(msg)) {
        setDebugLogs((prev) => [...prev.slice(-15), msg]);
      }
    };

    window.onerror = (message, source, lineno) => {
      const msg = '[ERROR] ' + message + ' at ' + source + ':' + lineno;
      if (!isIgnored(msg)) {
        setDebugLogs((prev) => [...prev.slice(-15), msg]);
      }
    };
    window.onunhandledrejection = (event) => {
      const msg =
        '[ERROR] Unhandled Rejection: ' + (event.reason ? event.reason.toString() : 'Unknown');
      if (!isIgnored(msg)) {
        setDebugLogs((prev) => [...prev.slice(-15), msg]);
      }
    };

    return () => {
      console.log = origLog;
      console.error = origError;
      window.onerror = origOnError;
      window.onunhandledrejection = origOnUnhandledRejection;
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
    description:
      'A supermassive rotating black hole locking dozens of systems in an aggressive accretion orbit.',
    tags: ['🕳 BLACK HOLE', '☄ ACCRETION DISK', '★ GRAVITY SHEAR'],
  });
  const [, setMousePos] = useState({ x: -1000, y: -1000 });
  const [muted, setMuted] = useState(true);
  const [showSequenceCard, setShowSequenceCard] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return false;
  });
  const [showDebug, setShowDebug] = useState(false);
  const [textParticleSpeed, setTextParticleSpeed] = useState<number>(0.12);
  const [ambientParticleSpeed, setAmbientParticleSpeed] = useState<number>(0.15);
  const [objectParticleSpeed, setObjectParticleSpeed] = useState<number>(0.15);
  const [, setIsIdle] = useState(false);

  // Cinematic Experience State
  const [isCinematicMode, setIsCinematicMode] = useState(false);
  const [cinematicCameraMode, setCinematicCameraMode] = useState<CinematicCameraMode>('orbit');
  const [cinematicSpeedMultiplier, setCinematicSpeedMultiplier] = useState<number>(1.0);
  const [anamorphicFlaresEnabled, setAnamorphicFlaresEnabled] = useState(true);
  const [dofEnabled, setDofEnabled] = useState(true);
  const [selectedEntity, setSelectedEntity] = useState<CelestialEntity | null>(null);

  useEffect(() => {
    audio.setCinematicMode(isCinematicMode);
  }, [isCinematicMode]);

  // Refs so the (mount-once) hotkey handler sees current values.
  const stageForKeysRef = useRef(stage);
  stageForKeysRef.current = stage;
  const cinematicForKeysRef = useRef(isCinematicMode);
  cinematicForKeysRef.current = isCinematicMode;

  // Global hotkeys [A], [C], [W], [N], [T], [P], [M], [Escape] for Autopilot, Cinema & Interstellar Sandbox state sync
  // plus stage navigation: [↑]/[↓], [PageUp]/[PageDown], [1]–[6] (outside cinema mode, where digits pick camera modes).
  useEffect(() => {
    const NUM_STAGES = 6;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) return;
      if (!cinematicForKeysRef.current && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const cur = stageForKeysRef.current;
        let next: number | null = null;
        if (e.key === 'ArrowDown' || e.key === 'PageDown') next = Math.min(NUM_STAGES - 1, cur + 1);
        else if (e.key === 'ArrowUp' || e.key === 'PageUp') next = Math.max(0, cur - 1);
        else if (/^[1-6]$/.test(e.key)) next = parseInt(e.key, 10) - 1;
        if (next !== null) {
          e.preventDefault();
          if (next !== cur) scrollToStage(next);
          return;
        }
      }
      if (e.key === 'a' || e.key === 'A') {
        setIsAutopilot((prev) => {
          const next = !prev;
          if (next) {
            setIsInterstellar(true);
          }
          return next;
        });
      } else if (e.key === 'c' || e.key === 'C') {
        setIsCinematicMode((prev) => !prev);
      } else if (e.key === 'm' || e.key === 'M') {
        setMuted((prev) => {
          const next = !prev;
          audio.setMute(next);
          return next;
        });
      } else if (e.key === 'Escape') {
        setIsCinematicMode(false);
        setIsAutopilot(false);
        setShowDebug(false);
        setSelectedEntity(null);
      } else if (
        e.key === 'w' ||
        e.key === 'W' ||
        e.key === 'n' ||
        e.key === 'N' ||
        e.key === 't' ||
        e.key === 'T' ||
        e.key === 'p' ||
        e.key === 'P'
      ) {
        setIsInterstellar(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [scrollToStage]);

  useEffect(() => {
    let ticking = false;
    let maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);

    let idleTimer: ReturnType<typeof setTimeout>;
    const resetIdleTimer = () => {
      setIsIdle(false);
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        setIsIdle(true);
      }, 5000);
    };
    resetIdleTimer();

    const handleResize = () => {
      maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    };

    const handleScroll = () => {
      audio.pingInteraction();
      resetIdleTimer();
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY || document.documentElement.scrollTop;
          const scrollFraction = Math.max(0, Math.min(1, scrollY / maxScroll));

          const numStages = 6;
          const newStage = Math.min(numStages - 1, Math.floor(scrollFraction * numStages));

          setStage((prev) => {
            if (prev !== newStage) {
              audio.playStageSwell(newStage);
              setIsInterstellar(false);
              setIsAutopilot(false);
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
      audio.pingInteraction();
      setMousePos({ x: e.clientX, y: e.clientY });
      resetIdleTimer();
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.tagName !== 'CANVAS' && target.id !== 'canvas-babylon') {
        if (
          target.closest &&
          (target.closest('.pointer-events-auto') ||
            target.closest('button') ||
            target.closest('input') ||
            target.closest('a') ||
            target.closest("[role='dialog']"))
        ) {
          resetIdleTimer();
          return;
        }
      }
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
    window.addEventListener('keydown', handleKeyPress, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeyPress);
      clearTimeout(idleTimer);
    };
  }, []);

  const activeProjectIndex = stage - 2;
  const project =
    activeProjectIndex >= 0 && activeProjectIndex < projects.length
      ? projects[activeProjectIndex]
      : null;

  return (
    <div className="relative bg-black text-slate-200 overflow-x-hidden font-sans selection:bg-[#c14b2a]/30 selection:text-white">
      <ErrorOverlay showDebug={showDebug} />

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

      {/* Top-Left Brand Identity Pill (Hidden when Debug panel, Cinema mode, or Autopilot is open) */}
      <AnimatePresence>
        {!showDebug && !isCinematicMode && !isAutopilot && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.35 }}
            className="fixed top-3 left-3 sm:top-6 sm:left-6 z-40 pointer-events-auto"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                scrollToStage(0);
              }}
              className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-black/60 hover:bg-white/10 border border-white/15 hover:border-[#4deeea]/40 backdrop-blur-xl shadow-[0_8px_20px_rgba(0,0,0,0.5)] transition-all cursor-pointer group"
              title="Return to Stage 00 // Singularity Hero"
            >
              <span className="relative flex h-2 w-2 items-center justify-center shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4deeea] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#4deeea]"></span>
              </span>
              <span className="font-mono text-[9.5px] font-bold tracking-[0.2em] text-[#f5f2eb] uppercase group-hover:text-[#4deeea] transition-colors">
                CURTIS CLICK
              </span>
              <span className="hidden md:inline font-mono text-[8.5px] tracking-widest text-white/45 uppercase border-l border-white/15 pl-2.5">
                AI ENGINEER // ASTROPHYSICS ENGINE
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Control Pod in Top Right Corner - Responsive and compact */}
      {!isAutopilot && (
        <div className="fixed top-3 right-3 sm:top-6 sm:right-6 z-50 flex items-center gap-1.5 sm:gap-2">
          {/* Info / Telemetry Toggle Button (only when interstellar) */}
          <AnimatePresence>
            {isInterstellar && (
              <motion.button
                initial={{ opacity: 0, x: 20, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.8 }}
                transition={{ duration: 0.3 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSequenceCard(!showSequenceCard);
                }}
                className="flex items-center justify-center gap-1.5 border bg-black/60 border-white/15 hover:bg-white/10 hover:border-white/30 text-[#f5f2eb] rounded-full font-mono tracking-widest font-semibold transition-all duration-200 shadow-[0_8px_20px_rgba(0,0,0,0.5)] backdrop-blur-xl cursor-pointer group w-8 h-8 sm:w-auto p-0 sm:px-3 sm:py-1.5 text-[9.5px]"
                title={
                  showSequenceCard
                    ? 'Hide cosmic sequence telemetry'
                    : 'Show cosmic sequence telemetry'
                }
              >
                <span className="relative flex h-2 w-2 items-center justify-center shrink-0">
                  {showSequenceCard && (
                    <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-[#4deeea] opacity-60"></span>
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                      !showSequenceCard ? 'bg-white/30' : 'bg-[#4deeea]'
                    }`}
                  ></span>
                </span>

                <span className="hidden sm:inline overflow-hidden whitespace-nowrap">
                  TELEMETRY
                </span>

                {showSequenceCard ? (
                  <Eye className="w-3.5 h-3.5 shrink-0 text-[#4deeea]" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5 shrink-0 text-white/50" />
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
            className="flex items-center justify-center gap-1.5 border bg-black/60 border-white/15 hover:bg-white/10 hover:border-white/30 text-[#f5f2eb] rounded-full font-mono tracking-widest font-semibold transition-all duration-200 shadow-[0_8px_20px_rgba(0,0,0,0.5)] backdrop-blur-xl cursor-pointer group w-8 h-8 sm:w-auto p-0 sm:px-3 sm:py-1.5 text-[9.5px]"
            title={muted ? 'Enable celestial audio ambiance (Hotkey: M)' : 'Mute audio (Hotkey: M)'}
          >
            <span className="relative flex h-2 w-2 items-center justify-center shrink-0">
              {!muted && (
                <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-[#c14b2a] opacity-60"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                  muted ? 'bg-white/30' : 'bg-[#c14b2a]'
                }`}
              ></span>
            </span>

            <span className="hidden sm:inline overflow-hidden whitespace-nowrap">
              {muted ? 'MUTED' : 'AUDIO'}
            </span>

            <div className="flex gap-[2px] items-end h-3 shrink-0">
              <div
                className={`w-[2px] bg-[#c14b2a] rounded-sm transition-all duration-300 ${
                  muted ? 'h-1 opacity-30' : 'h-3'
                }`}
              />
              <div
                className={`w-[2px] bg-[#c14b2a] rounded-sm transition-all duration-300 [animation-delay:0.15s] ${
                  muted ? 'h-1.5 opacity-30' : 'h-2.5'
                }`}
              />
              <div
                className={`w-[2px] bg-[#c14b2a] rounded-sm transition-all duration-300 [animation-delay:0.3s] ${
                  muted ? 'h-1 opacity-30' : 'h-3.5'
                }`}
              />
            </div>
          </button>

          {/* Wormhole Transit Trigger */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleTriggerWormhole();
            }}
            className="flex items-center justify-center gap-1.5 border border-white/15 bg-black/60 hover:bg-indigo-500/20 hover:border-indigo-400/50 text-[#f5f2eb] rounded-full font-mono tracking-widest font-semibold transition-all duration-200 shadow-[0_8px_20px_rgba(0,0,0,0.5)] backdrop-blur-xl cursor-pointer group w-8 h-8 sm:w-auto p-0 sm:px-3 sm:py-1.5 text-[9.5px]"
            title="Engage Einstein-Rosen Wormhole Transit to a new star system [W]"
          >
            <Orbit className="w-3.5 h-3.5 text-indigo-300 group-hover:rotate-180 transition-transform duration-500" />
            <span className="hidden sm:inline">WARP</span>
            <span className="hidden lg:inline text-[7.5px] opacity-60">[W]</span>
          </button>

          {/* TDE Rogue Star Trigger */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleTriggerTDE();
            }}
            className={`flex items-center justify-center gap-1.5 border rounded-full font-mono tracking-widest font-semibold transition-all duration-200 shadow-[0_8px_20px_rgba(0,0,0,0.5)] backdrop-blur-xl cursor-pointer group w-8 h-8 sm:w-auto p-0 sm:px-3 sm:py-1.5 text-[9.5px] ${
              tdeStateInfo.isActive
                ? 'bg-[#f25f35]/25 border-[#f25f35] text-[#ffd778] animate-pulse'
                : 'bg-black/60 border-white/15 hover:bg-[#f25f35]/20 hover:border-[#f25f35]/50 text-[#f5f2eb]'
            }`}
            title="Launch a rogue star into the black hole's Roche limit [T]"
          >
            <Flame
              className={`w-3.5 h-3.5 ${
                tdeStateInfo.isActive ? 'text-[#ff5722] animate-bounce' : 'text-[#f25f35]'
              }`}
            />
            <span className="hidden sm:inline">TDE</span>
            <span className="hidden lg:inline text-[7.5px] opacity-60">[T]</span>
          </button>

          {/* Slingshot Probe Trigger */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleLaunchProbe();
            }}
            className="flex items-center justify-center gap-1.5 border border-white/15 bg-black/60 hover:bg-cyan-500/20 hover:border-cyan-400/50 text-[#f5f2eb] rounded-full font-mono tracking-widest font-semibold transition-all duration-200 shadow-[0_8px_20px_rgba(0,0,0,0.5)] backdrop-blur-xl cursor-pointer group w-8 h-8 sm:w-auto p-0 sm:px-3 sm:py-1.5 text-[9.5px]"
            title="Launch a glowing probe or click-and-drag anywhere in space [P]"
          >
            <Compass className="w-3.5 h-3.5 text-[#4deeea]" />
            <span className="hidden sm:inline">PROBE</span>
            <span className="hidden lg:inline text-[7.5px] opacity-60">[P]</span>
          </button>

          {/* Autopilot Cosmic Screensaver Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsInterstellar(true);
              setIsAutopilot(true);
            }}
            className="hidden sm:flex items-center justify-center gap-1.5 border border-white/15 bg-black/60 hover:bg-emerald-500/20 hover:border-emerald-400/50 text-[#f5f2eb] rounded-full font-mono tracking-widest font-semibold transition-all duration-200 shadow-[0_8px_20px_rgba(0,0,0,0.5)] backdrop-blur-xl cursor-pointer group px-3 py-1.5 text-[9.5px]"
            title="Enter Autonomous Cosmic Screensaver Autopilot [A]"
          >
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span>AUTOPILOT</span>
            <span className="hidden lg:inline text-[7.5px] opacity-60">[A]</span>
          </button>

          {/* Cinematic Experience Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsCinematicMode(!isCinematicMode);
            }}
            className={`flex items-center justify-center gap-1.5 border rounded-full font-mono tracking-widest font-semibold transition-all duration-200 shadow-[0_8px_20px_rgba(0,0,0,0.5)] backdrop-blur-xl cursor-pointer group w-8 h-8 sm:w-auto p-0 sm:px-3 sm:py-1.5 text-[9.5px] ${
              isCinematicMode
                ? 'bg-[#ffd778]/15 border-[#ffd778]/50 text-[#ffd778] shadow-[0_0_20px_rgba(255,215,120,0.2)]'
                : 'bg-black/60 border-white/15 hover:bg-white/10 hover:border-[#ffd778]/30 text-[#f5f2eb]'
            }`}
            title={
              isCinematicMode ? 'Exit Cinematic 2.39:1 mode [C]' : 'Enter Cinematic 2.39:1 mode [C]'
            }
          >
            <span className="relative flex h-2 w-2 items-center justify-center shrink-0">
              {isCinematicMode && (
                <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-[#ffd778] opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                  isCinematicMode ? 'bg-[#ffd778]' : 'bg-white/30'
                }`}
              ></span>
            </span>

            <span className="hidden sm:inline overflow-hidden whitespace-nowrap">CINEMA</span>

            <Film className="w-3.5 h-3.5 shrink-0" />
          </button>

          {/* Debug Logs Overlay Toggle - Desktop Only */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDebug(!showDebug);
            }}
            className="hidden md:flex items-center justify-center gap-1.5 border bg-black/60 border-white/15 hover:bg-white/10 hover:border-white/30 text-[#f5f2eb] rounded-full font-mono tracking-widest font-semibold transition-all duration-200 shadow-[0_8px_20px_rgba(0,0,0,0.5)] backdrop-blur-xl cursor-pointer group px-3 py-1.5 text-[9.5px]"
            title={showDebug ? 'Hide system debug overlay' : 'Show system debug overlay'}
          >
            <span className="relative flex h-2 w-2 items-center justify-center shrink-0">
              {showDebug && (
                <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-[#4deeea] opacity-50"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                  !showDebug ? 'bg-white/30' : 'bg-[#4deeea]'
                }`}
              ></span>
            </span>

            <span className="overflow-hidden whitespace-nowrap">DEBUG</span>

            <Terminal className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>
      )}

      {/* Right-Edge Stage & Sandbox Navigation Rail */}
      <AnimatePresence>
        {!isCinematicMode && !isAutopilot && (
          <motion.nav
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.4 }}
            aria-label="Portfolio Stage Navigation"
            className="hidden lg:flex fixed right-6 top-1/2 -translate-y-1/2 z-40 flex-col items-end gap-2.5 pointer-events-auto select-none"
          >
            {STAGE_NAV_ITEMS.map((item) => {
              const isActive = !isInterstellar && stage === item.stage;
              return (
                <button
                  key={item.code}
                  onClick={(e) => {
                    e.stopPropagation();
                    scrollToStage(item.stage);
                  }}
                  className="group flex items-center gap-2.5 py-1 px-2 rounded-full transition-all cursor-pointer"
                  title={`Jump to Stage ${item.code} // ${item.label}`}
                >
                  <span
                    className={`font-mono text-[8.5px] tracking-[0.2em] uppercase transition-all duration-200 ${
                      isActive
                        ? 'opacity-100 text-[#4deeea] font-bold translate-x-0'
                        : 'opacity-0 group-hover:opacity-80 text-[#f5f2eb]/70 translate-x-1 group-hover:translate-x-0'
                    }`}
                  >
                    {item.code} // {item.label}
                  </span>
                  <span
                    className={`rounded-full transition-all duration-300 ${
                      isActive
                        ? 'w-2.5 h-2.5 bg-[#4deeea] shadow-[0_0_10px_#4deeea]'
                        : 'w-1.5 h-1.5 bg-white/25 group-hover:bg-white/70'
                    }`}
                  />
                </button>
              );
            })}

            <div className="w-4 h-px bg-white/10 my-0.5 mr-1" />

            {/* Interstellar Sandbox Node */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isInterstellar) {
                  handleTriggerWormhole();
                } else {
                  setShowSequenceCard(true);
                }
              }}
              className="group flex items-center gap-2.5 py-1 px-2 rounded-full transition-all cursor-pointer"
              title="Warp to Interstellar Astrophysics Sandbox [W]"
            >
              <span
                className={`font-mono text-[8.5px] tracking-[0.2em] uppercase transition-all duration-200 ${
                  isInterstellar
                    ? 'opacity-100 text-[#ffd778] font-bold'
                    : 'opacity-0 group-hover:opacity-90 text-[#ffd778]/80'
                }`}
              >
                ∞ // SANDBOX
              </span>
              <span
                className={`rounded-full transition-all duration-300 ${
                  isInterstellar
                    ? 'w-2.5 h-2.5 bg-[#ffd778] shadow-[0_0_12px_#ffd778]'
                    : 'w-1.5 h-1.5 bg-[#ffd778]/40 group-hover:bg-[#ffd778]'
                }`}
              />
            </button>
          </motion.nav>
        )}
      </AnimatePresence>

      {/* Stage 0 Hero Subtitle & Quick Actions Bar (Below 3D CURTIS CLICK Particle Typography) */}
      <AnimatePresence>
        {!isCinematicMode && !isAutopilot && !isInterstellar && stage === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-10 sm:bottom-14 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-4 pointer-events-auto w-[92vw] max-w-xl text-center"
          >
            <div className="flex flex-wrap items-center justify-center gap-2 px-3.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10 font-mono text-[9px] sm:text-[10px] tracking-[0.22em] text-[#e8e2d7]/80 uppercase">
              <span className="text-[#4deeea] font-semibold">AI ENGINEERING</span>
              <span className="text-white/25">•</span>
              <span>AGENTIC ARCHITECTURE</span>
              <span className="text-white/25">•</span>
              <span className="text-[#ffd778]">FRONTIER MODEL ALIGNMENT</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  scrollToStage(1);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#f5f2eb]/10 hover:bg-[#f5f2eb]/20 border border-[#f5f2eb]/25 hover:border-[#4deeea]/60 text-[#f5f2eb] font-mono text-[10px] tracking-[0.2em] font-semibold uppercase backdrop-blur-xl transition-all cursor-pointer active:scale-95"
              >
                <span>EXPLORE PORTFOLIO</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#4deeea] animate-bounce" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleTriggerWormhole();
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/15 hover:bg-indigo-500/30 border border-indigo-400/35 hover:border-indigo-300 text-indigo-200 font-mono text-[10px] tracking-[0.2em] font-semibold uppercase backdrop-blur-xl transition-all cursor-pointer active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                <span>WORMHOLE SANDBOX [W]</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stage 1 Selected Works Interactive Index Dock (Below 3D SELECTED WORKS Headline) */}
      <AnimatePresence>
        {!isCinematicMode && !isAutopilot && !isInterstellar && stage === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-6 sm:bottom-10 left-1/2 -translate-x-1/2 z-30 w-[92vw] max-w-5xl pointer-events-auto"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
              {projects.map((item, idx) => {
                const targetStageNum = idx + 2;
                return (
                  <button
                    key={item.title}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      scrollToStage(targetStageNum);
                    }}
                    className="group text-left p-3 sm:p-3.5 rounded-2xl bg-black/65 hover:bg-white/[0.08] border border-white/15 hover:border-[#4deeea]/50 backdrop-blur-xl shadow-[0_12px_28px_rgba(0,0,0,0.65)] transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-mono text-[8.5px] tracking-[0.22em] text-[#f25f35] font-bold uppercase">
                        0{targetStageNum} // {item.category}
                      </span>
                      <span className="font-mono text-[8px] text-white/40 group-hover:text-[#4deeea] transition-colors">
                        OPEN →
                      </span>
                    </div>
                    <div className="font-serif text-sm sm:text-base font-semibold text-[#f5f2eb] group-hover:text-white tracking-tight">
                      {item.title}
                    </div>
                    {item.metrics && item.metrics[0] && (
                      <div className="font-mono text-[8px] tracking-widest text-[#4deeea]/90 uppercase truncate">
                        ◆ {item.metrics[0]}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Autonomous Screensaver Overlay when Autopilot Mode is active */}
      {isAutopilot && (
        <CosmicScreensaverOverlay
          onExitScreensaver={() => setIsAutopilot(false)}
          muted={muted}
          onToggleMute={() => {
            const nextMute = !muted;
            setMuted(nextMute);
            audio.setMute(nextMute);
          }}
        />
      )}

      {/* Cinematic Viewfinder, Scope Letterbox & Director Controls */}
      <CinematicOverlay
        isCinematicMode={isCinematicMode}
        onToggleCinematicMode={() => setIsCinematicMode(!isCinematicMode)}
        cameraMode={cinematicCameraMode}
        onChangeCameraMode={setCinematicCameraMode}
        speedMultiplier={cinematicSpeedMultiplier}
        onChangeSpeedMultiplier={setCinematicSpeedMultiplier}
        selectedEntity={selectedEntity}
        onClearSelectedEntity={() => {
          setSelectedEntity(null);
          if ((window as any).__cosmicCanvas?.clearTargetLock) {
            (window as any).__cosmicCanvas.clearTargetLock();
          }
        }}
        anamorphicFlaresEnabled={anamorphicFlaresEnabled}
        onToggleAnamorphicFlares={() => setAnamorphicFlaresEnabled(!anamorphicFlaresEnabled)}
        dofEnabled={dofEnabled}
        onToggleDof={() => setDofEnabled(!dofEnabled)}
      />

      {/* HUD Layout for Project Details (Immersive, no box overlays - hidden in cinematic/autopilot mode) */}
      <div className="fixed inset-0 z-30 pointer-events-none p-6 sm:p-16">
        <AnimatePresence>
          {!isCinematicMode && !isAutopilot && !isInterstellar && stage >= 2 && project && (
            <ProjectHUD
              project={project}
              index={activeProjectIndex}
              onNavigateStage={scrollToStage}
              onEnterSandbox={handleTriggerWormhole}
              key={`hud-${stage}`}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Sequence Card (draggable, collapsible, toggle-able - hidden in cinematic/autopilot mode) */}
      <AnimatePresence>
        {!isCinematicMode && !isAutopilot && isInterstellar && showSequenceCard && (
          <InterstellarHUD
            sequenceInfo={sequenceInfo}
            transitionInfo={transitionInfo}
            onTriggerTransition={handleTriggerSupernova}
            onTriggerWormhole={handleTriggerWormhole}
            onTriggerTDE={handleTriggerTDE}
            onLaunchProbe={handleLaunchProbe}
            tdeStatus={tdeStateInfo.status}
            isTdeActive={tdeStateInfo.isActive}
            onClose={() => setShowSequenceCard(false)}
          />
        )}
      </AnimatePresence>

      {/* Particle System Canvas - Positioned slightly above the HTML so it looks like it's drawing the frame around the readable text */}
      <div className="fixed inset-0 z-10 opacity-95">
        <ParticleCanvas
          stage={stage}
          isInterstellar={isInterstellar || isAutopilot}
          animationComplete={() => setIsInterstellar(true)}
          onSequenceGenerated={setSequenceInfo}
          showDebug={showDebug}
          particleFilters={particleFilters}
          textParticleSpeed={textParticleSpeed}
          ambientParticleSpeed={ambientParticleSpeed}
          objectParticleSpeed={objectParticleSpeed}
          onTransitionStateChange={setTransitionInfo}
          transitionStateMachineRef={transitionStateMachineRef}
          isCinematicMode={isCinematicMode || isAutopilot}
          cinematicCameraMode={cinematicCameraMode}
          cinematicSpeedMultiplier={cinematicSpeedMultiplier}
          anamorphicFlaresEnabled={anamorphicFlaresEnabled}
          dofEnabled={dofEnabled}
          onSelectedEntityChange={setSelectedEntity}
          onTdeStateChange={setTdeStateInfo}
        />
      </div>

      {/* The invisible scrolling track providing native scroll height */}
      <div className="w-full relative z-20 shrink-0 pointer-events-none" style={{ height: '800vh' }} />
    </div>
  );
}
