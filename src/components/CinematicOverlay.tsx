import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  Compass, 
  Eye, 
  EyeOff, 
  FastForward, 
  Maximize2, 
  Minimize2, 
  Play, 
  Sparkles, 
  Video, 
  Radio, 
  Activity,
  Layers,
  Crosshair,
  Sliders,
  ChevronUp,
  ChevronDown,
  Aperture
} from 'lucide-react';
import { CelestialEntity, CinematicCameraMode } from './ParticleCanvas/types';
import { audio } from '../utils/audio';

interface CinematicOverlayProps {
  isCinematicMode: boolean;
  onToggleCinematicMode: () => void;
  cameraMode: CinematicCameraMode;
  onChangeCameraMode: (mode: CinematicCameraMode) => void;
  speedMultiplier: number;
  onChangeSpeedMultiplier: (speed: number) => void;
  selectedEntity: CelestialEntity | null;
  onClearSelectedEntity: () => void;
  anamorphicFlaresEnabled: boolean;
  onToggleAnamorphicFlares: () => void;
  dofEnabled?: boolean;
  onToggleDof?: () => void;
}

export const CinematicOverlay: React.FC<CinematicOverlayProps> = ({
  isCinematicMode,
  onToggleCinematicMode,
  cameraMode,
  onChangeCameraMode,
  speedMultiplier,
  onChangeSpeedMultiplier,
  selectedEntity,
  onClearSelectedEntity,
  anamorphicFlaresEnabled,
  onToggleAnamorphicFlares,
  dofEnabled = true,
  onToggleDof,
}) => {
  const [showLetterbox, setShowLetterbox] = useState(true);
  const [showTelemetry, setShowTelemetry] = useState(true);
  const [isControlsExpanded, setIsControlsExpanded] = useState(true);
  const [isFlashing, setIsFlashing] = useState(false);
  const [fps, setFps] = useState(60);
  const [timeCode, setTimeCode] = useState("00:00:00:00");

  // Keep a running cinematic timecode clock (24 FPS)
  useEffect(() => {
    let frame = 0;
    const interval = setInterval(() => {
      frame++;
      const f = (frame % 24).toString().padStart(2, '0');
      const totalSec = Math.floor(frame / 24);
      const s = (totalSec % 60).toString().padStart(2, '0');
      const m = (Math.floor(totalSec / 60) % 60).toString().padStart(2, '0');
      const h = Math.floor(totalSec / 3600).toString().padStart(2, '0');
      setTimeCode(`${h}:${m}:${s}:${f}`);
    }, 1000 / 24);

    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is in an input, textarea, select, or contenteditable element
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'c' || e.key === 'C') {
        onToggleCinematicMode();
      } else if (isCinematicMode) {
        if (e.key === 'l' || e.key === 'L') {
          setShowLetterbox((prev) => !prev);
        } else if (e.key === '1') {
          onChangeCameraMode('orbit');
        } else if (e.key === '2') {
          onChangeCameraMode('horizon');
        } else if (e.key === '3') {
          onChangeCameraMode('deep');
        } else if (e.key === '4') {
          onChangeCameraMode('chase');
        } else if (e.key === '5') {
          onChangeCameraMode('free');
        } else if (e.key === '[') {
          const speeds = [0.25, 0.5, 1.0, 2.5];
          const curIdx = speeds.indexOf(speedMultiplier);
          if (curIdx > 0) onChangeSpeedMultiplier(speeds[curIdx - 1]);
        } else if (e.key === ']') {
          const speeds = [0.25, 0.5, 1.0, 2.5];
          const curIdx = speeds.indexOf(speedMultiplier);
          if (curIdx < speeds.length - 1) onChangeSpeedMultiplier(speeds[curIdx + 1]);
        } else if (e.key === 'd' || e.key === 'D') {
          if (onToggleDof) onToggleDof();
        } else if (e.key === 's' || e.key === 'S') {
          captureSnapshot();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCinematicMode, speedMultiplier, onToggleCinematicMode, onChangeCameraMode, onChangeSpeedMultiplier, onToggleDof]);

  const captureSnapshot = () => {
    audio.playCameraShutter();
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 150);

    const canvas = document.getElementById('canvas-babylon') as HTMLCanvasElement | null;
    if (canvas) {
      try {
        const link = document.createElement('a');
        link.download = `interstellar_frame_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } catch (err) {
        console.warn("Snapshot direct capture failed:", err);
      }
    }
  };

  const cameraModes: { id: CinematicCameraMode; label: string; desc: string }[] = [
    { id: 'orbit', label: 'ORBITAL SWEEP', desc: 'Continuous 360° celestial fly-around' },
    { id: 'horizon', label: 'HORIZON DIVE', desc: 'Photon sphere close-up encounter' },
    { id: 'deep', label: 'COSMIC PERCH', desc: 'Elevated panoramic system view' },
    { id: 'chase', label: 'ORBIT CHASE', desc: 'Follows nearest companion world' },
    { id: 'free', label: 'FREE INERTIA', desc: 'Interactive smooth mouse drift' },
  ];

  const speedOptions = [
    { value: 0.25, label: '0.25x', tag: 'TIME DILATION' },
    { value: 0.5, label: '0.5x', tag: 'FILMIC' },
    { value: 1.0, label: '1.0x', tag: 'REALTIME' },
    { value: 2.5, label: '2.5x', tag: 'WARP' },
  ];

  return (
    <>
      {/* Flash shutter effect on snapshot */}
      <AnimatePresence>
        {isFlashing && (
          <motion.div
            initial={{ opacity: 0.85 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-white pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Anamorphic 2.39:1 Cinemascope Letterbox Matte Bars */}
      <AnimatePresence>
        {isCinematicMode && showLetterbox && (
          <>
            <motion.div
              initial={{ y: '-100%' }}
              animate={{ y: '0%' }}
              exit={{ y: '-100%' }}
              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
              className="fixed top-0 left-0 right-0 z-40 bg-black pointer-events-none border-b border-white/[0.04]"
              style={{ height: 'max(44px, calc((100vh - (100vw / 2.39)) / 2))' }}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: '0%' }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
              className="fixed bottom-0 left-0 right-0 z-40 bg-black pointer-events-none border-t border-white/[0.04]"
              style={{ height: 'max(44px, calc((100vh - (100vw / 2.39)) / 2))' }}
            />
          </>
        )}
      </AnimatePresence>

      {/* Cinematic Viewfinder & Telemetry Overlay */}
      <AnimatePresence>
        {isCinematicMode && showTelemetry && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-40 pointer-events-none p-6 sm:p-10 flex flex-col justify-between select-none"
          >
            {/* Top Viewfinder Bar */}
            <div className="flex items-start justify-between">
              {/* Left Top: Film Recording Indicator & Optical Specs */}
              <div className="flex flex-col gap-1 font-mono text-[9px] text-[#e8e2d7]/70">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                  </span>
                  <span className="text-white font-semibold tracking-widest uppercase">REC</span>
                  <span className="text-white/40">|</span>
                  <span className="text-[#ffd778] tracking-wider">{timeCode}</span>
                  <span className="text-white/40">|</span>
                  <span className="text-emerald-400">24 FPS</span>
                </div>
                <div className="hidden sm:flex items-center gap-3 text-[8px] text-[#e8e2d7]/50 tracking-wider">
                  <span>SCOPE 2.39:1</span>
                  <span>50mm T1.3</span>
                  <span className={dofEnabled ? "text-[#ffd778]" : "text-white/30"}>
                    DOF: {dofEnabled ? "ON" : "OFF"}
                  </span>
                </div>
              </div>

              {/* Right Top: Relativistic Celestial Telemetry (hidden on tiny screens to prevent collision) */}
              <div className="hidden md:flex flex-col items-end gap-1 font-mono text-[9px] text-[#e8e2d7]/70 text-right">
                <div className="flex items-center gap-2">
                  <Activity className="w-3 h-3 text-[#4deeea]" />
                  <span className="text-[#4deeea] font-semibold tracking-widest uppercase">
                    SCHWARZSCHILD-KERR METRIC
                  </span>
                </div>
                <div className="text-[8px] text-[#e8e2d7]/50 tracking-wider">
                  <span>b_crit = 2.598 r_s</span>
                  <span className="mx-1.5">|</span>
                  <span>PHOTON SPHERE: LOCKED</span>
                </div>
                <div className="flex items-center gap-1.5 text-[8px] text-cyan-300/80 tracking-wider">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span>HAWKING FLUX: SHIMMERING</span>
                  <span className="text-white/40">|</span>
                  <span className="text-violet-300">T_H = 61.7 nK</span>
                </div>
                {selectedEntity && (
                  <div className="mt-1 px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 text-[8px] flex items-center gap-1.5">
                    <Crosshair className="w-2.5 h-2.5 animate-spin" />
                    <span>TARGET LOCKED: {selectedEntity.type.toUpperCase()} (r={Math.round(selectedEntity.radius)})</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Viewfinder Corners */}
            <div className="flex items-end justify-between">
              {/* Left Bottom: Relativistic Physics Engine Readout */}
              <div className="flex flex-col gap-1 font-mono text-[8px] text-[#e8e2d7]/60">
                <div className="flex items-center gap-2">
                  <span className="text-[#ffd778]">TIME DILATION FACTOR:</span>
                  <span className="text-white font-bold tracking-wider">{speedMultiplier}x</span>
                  {speedMultiplier <= 0.25 && (
                    <span className="text-amber-400 text-[7.5px] uppercase tracking-widest font-semibold px-1 py-0.2 bg-amber-500/10 rounded border border-amber-500/20">
                      1 HR = 7 YRS
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[#e8e2d7]/40">
                  <span>DOPPLER BEAMING: ACTIVE</span>
                  <span>•</span>
                  <span>REDSHIFT CALIBRATION: RELATIVISTIC</span>
                  <span>•</span>
                  <span>GEODESIC: NULL-RAYTRACED</span>
                </div>
              </div>

              {/* Right Bottom: Keybind quick reference */}
              <div className="hidden md:flex items-center gap-3 font-mono text-[8px] text-[#e8e2d7]/40 tracking-wider">
                <span>[C] CINEMATIC</span>
                <span>[L] LETTERBOX</span>
                <span>[1-5] CAMERA</span>
                <span>[S] SNAPSHOT</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Glassmorphic Cinema Director Bar */}
      <AnimatePresence>
        {isCinematicMode && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.4 }}
            className="fixed bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto max-w-[94vw] w-auto"
          >
            <div className="bg-black/70 backdrop-blur-xl border border-white/15 rounded-2xl p-2 sm:p-2.5 shadow-[0_20px_40px_rgba(0,0,0,0.7)] flex flex-col gap-1.5 sm:gap-2 max-w-[94vw] w-auto">
              {/* Header Strip with Toggle Collapse */}
              <div className="flex items-center justify-between gap-2 sm:gap-4 px-1.5 py-0.5">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Video className="w-3.5 h-3.5 text-[#ffd778]" />
                  <span className="font-mono text-[8.5px] sm:text-[9px] font-bold tracking-wider sm:tracking-widest text-[#f5f2eb] uppercase">
                    DIRECTOR POD
                  </span>
                  <span className="font-mono text-[7.5px] sm:text-[8px] text-cyan-400 px-1.5 py-0.2 bg-cyan-950/40 rounded border border-cyan-800/40 uppercase font-semibold">
                    {cameraMode}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      if ((window as any).__cosmicCanvas?.cycleTargetLock) {
                        (window as any).__cosmicCanvas.cycleTargetLock();
                      }
                    }}
                    className={`flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded-md font-mono text-[7.5px] sm:text-[8px] tracking-wider font-semibold border transition-all cursor-pointer ${
                      selectedEntity
                        ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                        : 'bg-white/10 hover:bg-white/20 border-white/10 text-[#f5f2eb]'
                    }`}
                    title="Cycle camera lock through active 3D celestial bodies"
                  >
                    <Crosshair className="w-3 h-3 text-[#4deeea]" />
                    <span>{selectedEntity ? `LOCK: ${selectedEntity.type.toUpperCase()}` : 'LOCK TARGET'}</span>
                  </button>

                  <button
                    onClick={captureSnapshot}
                    className="flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded-md bg-white/10 hover:bg-white/20 text-[#f5f2eb] font-mono text-[7.5px] sm:text-[8px] tracking-wider font-semibold border border-white/10 transition-all cursor-pointer"
                    title="Capture pristine canvas screenshot without UI [S]"
                  >
                    <Camera className="w-3 h-3 text-[#ffd778]" />
                    <span className="hidden sm:inline">CAPTURE STILL</span>
                    <span className="sm:hidden">STILL</span>
                  </button>

                  <button
                    onClick={() => setIsControlsExpanded(!isControlsExpanded)}
                    className="p-1 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                    title={isControlsExpanded ? "Minimize director bar" : "Expand director bar"}
                  >
                    {isControlsExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={onToggleCinematicMode}
                    className="px-2 py-0.5 sm:py-1 rounded-md bg-white/10 hover:bg-red-500/25 border border-white/10 hover:border-red-400/40 text-white/75 hover:text-red-200 font-mono text-[7.5px] sm:text-[8px] tracking-wider uppercase transition-all cursor-pointer"
                    title="Exit CinemaScope Mode [C]"
                  >
                    EXIT [C]
                  </button>
                </div>
              </div>

              {/* Expandable Controls Container */}
              <AnimatePresence>
                {isControlsExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex flex-col gap-2.5 pt-1 overflow-hidden"
                  >
                    {/* Camera Angle Selector Strip */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[8px] text-[#e8e2d7]/50 tracking-widest uppercase mr-1">
                        ANGLES:
                      </span>
                      {cameraModes.map((mode) => {
                        const isActive = cameraMode === mode.id;
                        return (
                          <button
                            key={mode.id}
                            onClick={() => onChangeCameraMode(mode.id)}
                            className={`px-2.5 py-1 rounded-lg font-mono text-[8.5px] tracking-wider font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                              isActive
                                ? 'bg-[#c14b2a] text-white shadow-[0_0_15px_rgba(193,75,42,0.4)] border border-[#ffd778]/40'
                                : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10'
                            }`}
                            title={mode.desc}
                          >
                            <span>{mode.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Speed & Toggles Row */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-white/10">
                      {/* Time Dilation / Speed Factor */}
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[8px] text-[#e8e2d7]/50 tracking-widest uppercase mr-1">
                          TIME WARP:
                        </span>
                        {speedOptions.map((s) => {
                          const isActive = speedMultiplier === s.value;
                          return (
                            <button
                              key={s.value}
                              onClick={() => onChangeSpeedMultiplier(s.value)}
                              className={`px-2 py-0.5 rounded font-mono text-[8px] tracking-wider font-bold transition-all duration-200 cursor-pointer ${
                                isActive
                                  ? 'bg-[#4deeea] text-black shadow-[0_0_12px_rgba(77,238,234,0.4)]'
                                  : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10'
                              }`}
                            >
                              {s.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Visual Feature Toggles */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowLetterbox(!showLetterbox)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[8px] tracking-wider transition-all cursor-pointer ${
                            showLetterbox
                              ? 'bg-white/15 text-white border border-white/20'
                              : 'bg-white/5 text-white/40 border border-white/5'
                          }`}
                          title="Toggle 2.39:1 CinemaScope black letterbox bars"
                        >
                          <Layers className="w-2.5 h-2.5 text-[#ffd778]" />
                          <span>LETTERBOX {showLetterbox ? 'ON' : 'OFF'}</span>
                        </button>

                        <button
                          onClick={onToggleAnamorphicFlares}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[8px] tracking-wider transition-all cursor-pointer ${
                            anamorphicFlaresEnabled
                              ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/40'
                              : 'bg-white/5 text-white/40 border border-white/5'
                          }`}
                          title="Toggle cinematic anamorphic horizontal lens flare streaks"
                        >
                          <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                          <span>ANAMORPHIC {anamorphicFlaresEnabled ? 'ON' : 'OFF'}</span>
                        </button>

                        <button
                          onClick={onToggleDof}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[8px] tracking-wider transition-all cursor-pointer ${
                            dofEnabled
                              ? 'bg-amber-950/60 text-[#ffd778] border border-amber-500/40'
                              : 'bg-white/5 text-white/40 border border-white/5'
                          }`}
                          title="Toggle cinematic depth-of-field lens blur for distant particles [D]"
                        >
                          <Aperture className="w-2.5 h-2.5 text-[#ffd778]" />
                          <span>DOF {dofEnabled ? 'ON' : 'OFF'}</span>
                        </button>

                        <button
                          onClick={() => setShowTelemetry(!showTelemetry)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[8px] tracking-wider transition-all cursor-pointer ${
                            showTelemetry
                              ? 'bg-white/15 text-white border border-white/20'
                              : 'bg-white/5 text-white/40 border border-white/5'
                          }`}
                          title="Toggle on-screen telemetry viewfinder"
                        >
                          {showTelemetry ? <Eye className="w-2.5 h-2.5 text-emerald-400" /> : <EyeOff className="w-2.5 h-2.5" />}
                          <span>HUD</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
