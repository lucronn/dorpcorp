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
  const [isControlsExpanded, setIsControlsExpanded] = useState(true);
  const [isFlashing, setIsFlashing] = useState(false);

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

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
