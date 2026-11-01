import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ParticleCanvas } from './components/ParticleCanvas';
import { ErrorOverlay } from './components/ErrorOverlay';
import { CinematicOverlay } from './components/CinematicOverlay';
import { CosmicScreensaverOverlay } from './components/CosmicScreensaverOverlay';
import { DebugInspectorCard } from './components/DebugInspectorCard';
import { ParticleFilters, CelestialEntity, CinematicCameraMode } from './components/ParticleCanvas/types';
import { CosmicTransitionStateMachine, TransitionStateInfo } from './components/ParticleCanvas/TransitionManager';
import { CosmicCatalogModal } from './components/CosmicCatalogModal';
import { AnimatePresence, motion } from 'motion/react';
import {
  Sparkles,
  Flame,
  Compass,
  Orbit,
  Globe,
  Film,
  Terminal,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
} from 'lucide-react';
import { audio } from './utils/audio';

export interface StageConfig {
  stage: number;
  archetype: string;
  title: string;
  sceneName: string;
}

export const STAGE_CONFIGS: StageConfig[] = [
  {
    stage: 0,
    archetype: 'BLACKHOLE_CENTRIC',
    title: '00 // CURTIS CLICK',
    sceneName: 'M87* Kerr Singularity',
  },
  {
    stage: 1,
    archetype: 'SPIRAL_GALAXY',
    title: '01 // SELECTED WORKS',
    sceneName: 'Messier 81 Spiral Galaxy',
  },
  {
    stage: 2,
    archetype: 'RELATIVISTIC_BLAZAR',
    title: '02 // AI ENGINEERING',
    sceneName: 'M87* Relativistic Blazar',
  },
  {
    stage: 3,
    archetype: 'EXOPLANET_CLUSTER',
    title: '03 // AUTONOMY',
    sceneName: 'TRAPPIST-1 Resonant Chain',
  },
  {
    stage: 4,
    archetype: 'KILONOVA_MERGER',
    title: '04 // ALIGNMENT',
    sceneName: 'GW170817 Binary Kilonova',
  },
  {
    stage: 5,
    archetype: 'NEBULA_CRADLE',
    title: '05 // SYNTHESIS',
    sceneName: 'Orion Molecular Cloud',
  },
];

export const ARCHETYPE_TO_STAGE: Record<string, number> = {
  BLACKHOLE_CENTRIC: 0,
  SPIRAL_GALAXY: 1,
  RELATIVISTIC_BLAZAR: 2,
  EXOPLANET_CLUSTER: 3,
  KILONOVA_MERGER: 4,
  BINARY_PLANETS: 4,
  NEBULA_CRADLE: 5,
  STELLAR_PULSAR: 2,
};

export default function App() {
  const [stage, setStage] = useState(0);
  const [isAutopilot, setIsAutopilot] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const transitionStateMachineRef = useRef<CosmicTransitionStateMachine>(new CosmicTransitionStateMachine());
  const [, setTransitionInfo] = useState<TransitionStateInfo>({
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
    if ((window as any).triggerTDE) {
      (window as any).triggerTDE();
    } else if ((window as any).__cosmicCanvas?.triggerTDE) {
      (window as any).__cosmicCanvas.triggerTDE();
    }
  }, []);

  const handleTriggerWormhole = useCallback(() => {
    if ((window as any).__cosmicCanvas?.startWormholeTransit) {
      (window as any).__cosmicCanvas.startWormholeTransit();
    }
  }, []);

  const [showCatalogModal, setShowCatalogModal] = useState(false);

  const handleTriggerKilonova = useCallback(() => {
    if ((window as any).triggerKilonova) {
      (window as any).triggerKilonova();
    } else if ((window as any).__cosmicCanvas?.triggerKilonova) {
      (window as any).__cosmicCanvas.triggerKilonova();
    }
  }, []);

  const [voyagePhase, setVoyagePhase] = useState<'OBSERVING' | 'EVENT' | 'DRIFTING'>('OBSERVING');
  const [isVoyagePaused, setIsVoyagePaused] = useState(false);
  const [voyageCycle, setVoyageCycle] = useState(0);
  const lastInteractionTimeRef = useRef<number>(Date.now());
  const voyageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const driftDoneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageRef = useRef<number>(stage);
  stageRef.current = stage;

  const isTdeActiveRef = useRef<boolean>(false);
  isTdeActiveRef.current = tdeStateInfo.isActive;

  const goToStage = useCallback((targetStage: number, explicitArchetype?: string) => {
    if (voyageTimeoutRef.current) clearTimeout(voyageTimeoutRef.current);
    if (eventTimeoutRef.current) clearTimeout(eventTimeoutRef.current);
    if (driftDoneTimeoutRef.current) clearTimeout(driftDoneTimeoutRef.current);

    setVoyagePhase('DRIFTING');
    const targetArch =
      explicitArchetype || STAGE_CONFIGS[targetStage]?.archetype || 'BLACKHOLE_CENTRIC';
    if ((window as any).__cosmicCanvas?.floatAwayToScene) {
      (window as any).__cosmicCanvas.floatAwayToScene(targetArch, targetStage);
    } else if ((window as any).__cosmicCanvas?.switchToScene) {
      (window as any).__cosmicCanvas.switchToScene(targetArch, 'morph', targetStage);
    }

    // The canvas now cuts immediately; keep the HUD on the same selected stage.
    setStage(targetStage);
    setVoyageCycle((c) => c + 1);
    audio.playStageSwell(targetStage);
    const observeArrival = () => {
      const cover = (window as any).__cosmicCanvas?.getTransitionCover?.();
      if (cover && cover.phase !== 'idle') {
        driftDoneTimeoutRef.current = setTimeout(observeArrival, 50);
      } else {
        setVoyagePhase('OBSERVING');
      }
    };
    observeArrival();
  }, []);

  useEffect(() => () => {
    if (driftDoneTimeoutRef.current) clearTimeout(driftDoneTimeoutRef.current);
  }, []);

  const nextStage = useCallback(() => {
    goToStage((stageRef.current + 1) % STAGE_CONFIGS.length);
  }, [goToStage]);

  const prevStage = useCallback(() => {
    goToStage((stageRef.current - 1 + STAGE_CONFIGS.length) % STAGE_CONFIGS.length);
  }, [goToStage]);

  const handleSelectArchetype = useCallback((archetype: string) => {
    const targetStage = ARCHETYPE_TO_STAGE[archetype] ?? 0;
    goToStage(targetStage, archetype);
  }, [goToStage]);

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

  // Console error logger
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
    console.log = (...args) => {
      origLog(...args);
      const msg = args.map(safeStringify).join(' ');
      if (!isIgnored(msg) && (msg.includes('[DEBUG]') || msg.includes('Error'))) {
        setDebugLogs((prev) => [...prev.slice(-15), msg]);
      }
    };

    const origError = console.error;
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
  }, []);

  const [muted, setMuted] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const [textParticleSpeed, setTextParticleSpeed] = useState<number>(0.12);
  const [ambientParticleSpeed, setAmbientParticleSpeed] = useState<number>(0.15);
  const [objectParticleSpeed, setObjectParticleSpeed] = useState<number>(0.15);

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

  // Autonomous Cosmic Voyage Loop: 4-Act choreographed exploration with rising tension, climax, and afterglow
  useEffect(() => {
    if (isVoyagePaused || showCatalogModal || showDebug || isAutopilot) {
      if (voyageTimeoutRef.current) clearTimeout(voyageTimeoutRef.current);
      if (eventTimeoutRef.current) clearTimeout(eventTimeoutRef.current);
      return;
    }

    // Extended observation duration (50s to 68s) so each scene breathes across all 4 acts
    const organicDuration = 50000 + Math.random() * 18000;
    const eventLeadTime = 13000;
    const eventTime = Math.max(24000, organicDuration - eventLeadTime);

    // Act III Climax Event ("after something happens..." with 13s to peak and bask in afterglow)
    const triggerAutonomousClimax = () => {
      if (isVoyagePaused) return;
      const timeSinceUser = Date.now() - lastInteractionTimeRef.current;
      if (timeSinceUser < 12000) {
        eventTimeoutRef.current = setTimeout(
          triggerAutonomousClimax,
          Math.max(2000, 12000 - timeSinceUser)
        );
        return;
      }
      if (
        isTdeActiveRef.current ||
        transitionStateMachineRef.current.getInfo().isTransitioning
      ) {
        return;
      }

      setVoyagePhase('EVENT');
      const canvasApi = (window as any).__cosmicCanvas;
      const curArch =
        canvasApi?.getCurrentArchetype?.() || STAGE_CONFIGS[stageRef.current]?.archetype;
      if (curArch === 'BLACKHOLE_CENTRIC' && Math.random() < 0.35 && canvasApi?.triggerTDE) {
        canvasApi.triggerTDE();
      } else if (canvasApi?.triggerSceneClimax) {
        canvasApi.triggerSceneClimax();
      } else if (canvasApi?.triggerPulsarShockwave) {
        canvasApi.triggerPulsarShockwave();
      }
    };

    eventTimeoutRef.current = setTimeout(triggerAutonomousClimax, eventTime);

    // Act IV Afterglow -> Natural Float Away & Discovery
    const attemptDeparture = () => {
      if (isVoyagePaused) return;
      const timeSinceUser = Date.now() - lastInteractionTimeRef.current;
      if (timeSinceUser < 12000) {
        setVoyagePhase('OBSERVING');
        voyageTimeoutRef.current = setTimeout(
          attemptDeparture,
          Math.max(4000, 12000 - timeSinceUser)
        );
        return;
      }

      // Never cut off an active TDE or Supernova mid-sequence; wait for its completion
      if (
        isTdeActiveRef.current ||
        transitionStateMachineRef.current.getInfo().isTransitioning
      ) {
        voyageTimeoutRef.current = setTimeout(attemptDeparture, 8500);
        return;
      }

      const next = (stageRef.current + 1) % STAGE_CONFIGS.length;
      goToStage(next);
    };

    voyageTimeoutRef.current = setTimeout(attemptDeparture, organicDuration);

    return () => {
      if (voyageTimeoutRef.current) clearTimeout(voyageTimeoutRef.current);
      if (eventTimeoutRef.current) clearTimeout(eventTimeoutRef.current);
    };
  }, [stage, voyageCycle, isVoyagePaused, showCatalogModal, showDebug, isAutopilot, goToStage]);

  // When user interacts with canvas (clicking, dragging), extend observation time
  useEffect(() => {
    const onUserInteract = () => {
      lastInteractionTimeRef.current = Date.now();
      if (voyagePhase === 'EVENT') {
        setVoyagePhase('OBSERVING');
      }
    };
    window.addEventListener('mousedown', onUserInteract);
    window.addEventListener('touchstart', onUserInteract, { passive: true });
    return () => {
      window.removeEventListener('mousedown', onUserInteract);
      window.removeEventListener('touchstart', onUserInteract);
    };
  }, [voyagePhase]);

  // Global hotkeys for Observatory interaction
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsVoyagePaused((prev) => !prev);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown') {
        nextStage();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp') {
        prevStage();
      } else if (['1', '2', '3', '4', '5', '6'].includes(e.key)) {
        goToStage(parseInt(e.key, 10) - 1);
      } else if (e.key === 'a' || e.key === 'A') {
        setIsAutopilot((prev) => !prev);
      } else if (e.key === 'w' || e.key === 'W') {
        handleTriggerWormhole();
      } else if (e.key === 's' || e.key === 'S') {
        setShowCatalogModal((prev) => !prev);
      } else if (e.key === 'k' || e.key === 'K') {
        handleTriggerKilonova();
      } else if (e.key === 't' || e.key === 'T') {
        handleTriggerTDE();
      } else if (e.key === 'c' || e.key === 'C') {
        setIsCinematicMode((prev) => !prev);
      } else if (e.key === 'd' || e.key === 'D') {
        setShowDebug((prev) => !prev);
      } else if (e.key === 'Escape') {
        setShowCatalogModal(false);
        setIsCinematicMode(false);
        setIsAutopilot(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [nextStage, prevStage, goToStage, handleTriggerKilonova, handleTriggerTDE, handleTriggerWormhole]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black text-slate-200 font-sans selection:bg-[#c14b2a]/30 selection:text-white select-none">
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

      {/* Top-Left Brand Identity Pill */}
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
                goToStage(0);
              }}
              className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-black/60 hover:bg-white/10 border border-white/15 hover:border-[#4deeea]/40 backdrop-blur-xl shadow-[0_8px_20px_rgba(0,0,0,0.5)] transition-all cursor-pointer group"
              title="Return to Origin // Curtis Click [1]"
            >
              <span className="relative flex h-2 w-2 items-center justify-center shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4deeea] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#4deeea]"></span>
              </span>
              <span className="font-mono text-[9.5px] font-bold tracking-[0.2em] text-[#f5f2eb] uppercase group-hover:text-[#4deeea] transition-colors">
                CURTIS CLICK
              </span>
              <span className="hidden md:inline font-mono text-[8.5px] tracking-widest text-[#4deeea]/80 uppercase border-l border-white/15 pl-2.5">
                3D OBSERVATORY
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sleek Observatory Command Pod in Top-Right Corner */}
      {!isAutopilot && (
        <div className="fixed top-3 right-3 sm:top-6 sm:right-6 z-50 flex items-center gap-1.5 sm:gap-2">
          {/* Interactive Sound Orchestration Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              const nextMute = !muted;
              setMuted(nextMute);
              audio.setMute(nextMute);
            }}
            className="flex items-center justify-center gap-1.5 border bg-black/60 border-white/15 hover:bg-white/10 hover:border-white/30 text-[#f5f2eb] rounded-full font-mono tracking-widest font-semibold transition-all duration-200 shadow-[0_8px_20px_rgba(0,0,0,0.5)] backdrop-blur-xl cursor-pointer group w-8 h-8 sm:w-auto p-0 sm:px-3 sm:py-1.5 text-[9.5px]"
            title={muted ? 'Enable celestial audio ambiance' : 'Mute audio'}
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

          {/* Cosmic Observatory Scene Catalog */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowCatalogModal((prev) => !prev);
            }}
            className="flex items-center justify-center gap-1.5 border border-cyan-400/30 bg-black/60 hover:bg-cyan-500/20 hover:border-cyan-400/60 text-[#f5f2eb] rounded-full font-mono tracking-widest font-semibold transition-all duration-200 shadow-[0_8px_20px_rgba(0,0,0,0.5)] backdrop-blur-xl cursor-pointer group w-8 h-8 sm:w-auto p-0 sm:px-3 sm:py-1.5 text-[9.5px]"
            title="Open Cosmic Observatory // Scene Catalog [S]"
          >
            <Globe className="w-3.5 h-3.5 text-cyan-300 group-hover:rotate-45 transition-transform duration-300" />
            <span className="hidden sm:inline">SCENES</span>
            <span className="hidden lg:inline text-[7.5px] opacity-60">[S]</span>
          </button>

          {/* Kilonova Merger Trigger */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleTriggerKilonova();
            }}
            className="flex items-center justify-center gap-1.5 border border-amber-400/30 bg-black/60 hover:bg-amber-500/20 hover:border-amber-400/60 text-[#f5f2eb] rounded-full font-mono tracking-widest font-semibold transition-all duration-200 shadow-[0_8px_20px_rgba(0,0,0,0.5)] backdrop-blur-xl cursor-pointer group w-8 h-8 sm:w-auto p-0 sm:px-3 sm:py-1.5 text-[9.5px]"
            title="Trigger Binary Neutron Star Merger & Kilonova GW Chirp [K]"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 group-hover:scale-125 transition-transform duration-300" />
            <span className="hidden sm:inline">KILONOVA</span>
            <span className="hidden lg:inline text-[7.5px] opacity-60">[K]</span>
          </button>

          {/* Wormhole Transit Trigger */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleTriggerWormhole();
            }}
            className="flex items-center justify-center gap-1.5 border border-white/15 bg-black/60 hover:bg-indigo-500/20 hover:border-indigo-400/50 text-[#f5f2eb] rounded-full font-mono tracking-widest font-semibold transition-all duration-200 shadow-[0_8px_20px_rgba(0,0,0,0.5)] backdrop-blur-xl cursor-pointer group w-8 h-8 sm:w-auto p-0 sm:px-3 sm:py-1.5 text-[9.5px]"
            title="Engage Einstein-Rosen Wormhole Transit [W]"
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
              isCinematicMode ? 'Exit CinemaScope 2.39:1 mode [C]' : 'Enter CinemaScope 2.39:1 mode [C]'
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

          {/* Debug Panel Toggle (Desktop only) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDebug(!showDebug);
            }}
            className="hidden md:flex items-center justify-center gap-1.5 border bg-black/60 border-white/15 hover:bg-white/10 hover:border-white/30 text-[#f5f2eb] rounded-full font-mono tracking-widest font-semibold transition-all duration-200 shadow-[0_8px_20px_rgba(0,0,0,0.5)] backdrop-blur-xl cursor-pointer group px-3 py-1.5 text-[9.5px]"
            title={showDebug ? 'Hide debug panel [D]' : 'Show debug panel [D]'}
          >
            <Terminal className="w-3.5 h-3.5 shrink-0" />
            <span className="overflow-hidden whitespace-nowrap">DEBUG</span>
          </button>
        </div>
      )}

      {/* Autonomous Screensaver Overlay when Autopilot is active */}
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

      {/* CinemaScope Viewfinder & Director Controls */}
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

      {/* Cosmic Observatory Scene Catalog Modal */}
      <CosmicCatalogModal
        isOpen={showCatalogModal}
        onClose={() => setShowCatalogModal(false)}
        onSelectScene={handleSelectArchetype}
        currentArchetype={(window as any).__cosmicCanvas?.getCurrentArchetype?.()}
        onTriggerKilonova={handleTriggerKilonova}
      />

      {/* Sleek, Non-Intrusive Floating Constellation Milestone Stepper */}
      <AnimatePresence>
        {!isCinematicMode && !isAutopilot && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.35 }}
            className="fixed bottom-5 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/15 text-white shadow-[0_12px_28px_rgba(0,0,0,0.7)] pointer-events-auto select-none"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                prevStage();
              }}
              className="p-1 rounded-full text-white/50 hover:text-[#4deeea] hover:bg-white/10 transition-colors cursor-pointer"
              title="Previous Scene [← / ↑]"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center gap-1.5 px-1">
              {STAGE_CONFIGS.map((cfg, i) => (
                <button
                  key={cfg.title}
                  onClick={(e) => {
                    e.stopPropagation();
                    goToStage(i);
                  }}
                  className={`transition-all rounded-full cursor-pointer ${
                    stage === i
                      ? 'w-4 h-1.5 bg-[#4deeea] shadow-[0_0_8px_#4deeea]'
                      : 'w-1.5 h-1.5 bg-white/25 hover:bg-white/60'
                  }`}
                  title={`${cfg.title} — ${cfg.sceneName}`}
                />
              ))}
            </div>

            <span className="font-mono text-[9px] sm:text-[9.5px] font-bold tracking-[0.16em] text-[#f5f2eb] uppercase border-l border-white/15 pl-2.5 whitespace-nowrap">
              {STAGE_CONFIGS[stage]?.title}
            </span>

            {/* Seamless Cosmic Voyage Status & Pause Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsVoyagePaused((prev) => !prev);
              }}
              className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-[8.5px] font-mono text-[#4deeea] transition-all cursor-pointer"
              title={isVoyagePaused ? 'Resume Cosmic Voyage [Space]' : 'Pause on this Scene [Space]'}
            >
              {isVoyagePaused ? (
                <>
                  <Play className="w-2.5 h-2.5 fill-current" />
                  <span className="tracking-widest">PAUSED</span>
                </>
              ) : voyagePhase === 'DRIFTING' ? (
                <>
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4deeea] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#4deeea]"></span>
                  </span>
                  <span className="tracking-widest">DRIFTING...</span>
                </>
              ) : voyagePhase === 'EVENT' ? (
                <>
                  <span className="animate-pulse text-[#fbbf24]">✦</span>
                  <span className="tracking-widest text-[#fbbf24]">SURGE</span>
                </>
              ) : (
                <>
                  <Compass className="w-2.5 h-2.5" />
                  <span className="tracking-widest">VOYAGE</span>
                </>
              )}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                nextStage();
              }}
              className="p-1 rounded-full text-white/50 hover:text-[#4deeea] hover:bg-white/10 transition-colors cursor-pointer"
              title="Next Scene [→ / ↓]"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3D Hardware-Accelerated Particle Canvas */}
      <div className="fixed inset-0 z-10 w-full h-full">
        <ParticleCanvas
          stage={stage}
          isInterstellar={true}
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
    </div>
  );
}
