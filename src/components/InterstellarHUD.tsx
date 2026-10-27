import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TransitionStateInfo } from './ParticleCanvas/TransitionManager';
import { Zap, Compass, Flame, GripHorizontal, ChevronDown, ChevronUp, X, Sparkles } from 'lucide-react';

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
  onTriggerWormhole?: () => void;
  onTriggerTDE?: () => void;
  onLaunchProbe?: () => void;
  tdeStatus?: string;
  isTdeActive?: boolean;
  onClose?: () => void;
}

export const InterstellarHUD: React.FC<InterstellarHUDProps> = ({
  sequenceInfo,
  transitionInfo,
  onTriggerTransition,
  onTriggerWormhole,
  onTriggerTDE,
  onLaunchProbe,
  tdeStatus,
  isTdeActive = false,
  onClose,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isMinimized, setIsMinimized] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  const isTransitioning = transitionInfo?.isTransitioning;

  return (
    <motion.div
      ref={cardRef}
      key={`hud-interstellar-draggable-${sequenceInfo.name}`}
      drag
      dragMomentum={false}
      dragElastic={0.05}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      id="interstellar-hud"
      className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-40 pointer-events-auto touch-none select-none"
      style={{ touchAction: 'none' }}
    >
      <AnimatePresence mode="wait">
        {isMinimized ? (
          /* Minimized Floating Pill Badge */
          <motion.button
            key="minimized-pill"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsMinimized(false)}
            className="flex items-center gap-2 px-3 py-2 rounded-full bg-black/75 hover:bg-black/90 backdrop-blur-xl border border-[#e8e2d7]/20 hover:border-[#ffd778]/50 text-[#f5f2eb] shadow-[0_8px_32px_rgba(0,0,0,0.7)] transition-all cursor-pointer group active:scale-95"
            title="Expand cosmic sequence telemetry"
          >
            <span className="flex h-2 w-2 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4deeea] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4deeea]"></span>
            </span>

            <span className="font-mono text-[9px] text-[#4deeea] font-bold tracking-widest uppercase">
              COSMIC
            </span>

            <span className="font-serif text-[11px] font-semibold text-[#f5f2eb] tracking-tight truncate max-w-[120px] sm:max-w-[160px]">
              {sequenceInfo.name}
            </span>

            <ChevronUp className="w-3.5 h-3.5 text-white/60 group-hover:text-white transition-colors shrink-0 ml-0.5" />
          </motion.button>
        ) : (
          /* Full Expanded HUD Card */
          <motion.div
            key="expanded-card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="w-[calc(100vw-2rem)] max-w-[260px] sm:max-w-[250px] max-h-[min(540px,75vh)] flex flex-col bg-black/70 backdrop-blur-2xl border border-[#e8e2d7]/20 hover:border-[#ffd778]/40 rounded-2xl p-3 shadow-[0_16px_36px_rgba(0,0,0,0.8)] overflow-hidden"
          >
            {/* Tactile Drag Handle & Action Bar */}
            <div className="flex items-center justify-between pb-2 border-b border-white/10 shrink-0 cursor-grab active:cursor-grabbing">
              <div className="flex items-center gap-1.5 text-white/50">
                <GripHorizontal className="w-4 h-4 text-white/40" />
                <span className="font-mono text-[7.5px] tracking-widest uppercase text-white/40">
                  DRAG TO MOVE
                </span>
              </div>

              <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
                {/* Minimize Button */}
                <button
                  type="button"
                  onClick={() => setIsMinimized(true)}
                  className="p-1 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                  title="Minimize to compact pill"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {/* Close Button */}
                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1 rounded-md hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-colors cursor-pointer"
                    title="Close telemetry"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Content Body */}
            <div
              className="flex flex-col gap-2.5 pt-2.5 overflow-y-auto overscroll-contain pr-0.5 text-left"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {/* Top Engine Label & ID */}
              <div className="flex flex-col gap-0.5 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[8px] text-[#f5f2eb]/50 tracking-widest font-semibold uppercase">
                    COSMIC SEQUENCE
                  </span>
                  {sequenceInfo.id && (
                    <span className="font-mono text-[7.5px] text-[#ffd778] font-bold tracking-wider uppercase border border-[#ffd778]/30 px-1 bg-[#ffd778]/10 rounded">
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
                <div className="flex flex-col gap-1 p-2 rounded-lg bg-white/5 border border-white/10 shrink-0">
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

              {/* TDE Live Status Banner */}
              {isTdeActive && (
                <div className="flex flex-col gap-1 p-2 rounded-lg bg-amber-500/15 border border-amber-400/40 animate-pulse shrink-0">
                  <div className="flex items-center justify-between font-mono text-[8px] text-[#ffd778] tracking-wider uppercase font-semibold">
                    <span className="flex items-center gap-1">
                      <Flame className="w-3 h-3 text-[#ff5722] animate-bounce" />
                      TDE ACTIVE: ROCHE LIMIT BREACH
                    </span>
                  </div>
                  {tdeStatus && (
                    <div className="text-[7.5px] text-[#ffdd88] font-mono leading-tight">
                      {tdeStatus}
                    </div>
                  )}
                </div>
              )}

              {/* Middle textual content */}
              <div className="flex flex-col gap-1 shrink-0">
                <h3 className="text-sm font-semibold text-[#f5f2eb] tracking-tight font-serif">
                  {sequenceInfo.name}
                </h3>
                <p className="text-[#f5f2eb]/70 text-[10px] leading-relaxed font-sans font-light">
                  {sequenceInfo.description}
                </p>
              </div>

              {/* Interactive Astrophysics Actions */}
              <div className="flex flex-col gap-1.5 shrink-0 pt-0.5">
                {/* Tidal Disruption Event (TDE) Trigger */}
                {onTriggerTDE && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTriggerTDE();
                    }}
                    disabled={isTdeActive}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-[#f25f35]/20 to-[#ffd778]/15 hover:from-[#f25f35]/35 hover:to-[#ffd778]/25 border border-[#f25f35]/40 hover:border-[#ffd778] text-[#f5f2eb] font-mono text-[8px] tracking-wider font-semibold uppercase flex items-center justify-between transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]"
                    title="Launch a rogue star into the black hole's Roche limit (Hotkey: T)"
                  >
                    <span className="flex items-center gap-1.5">
                      <Flame className="w-3 h-3 text-[#f25f35]" />
                      <span>{isTdeActive ? 'TDE IN PROGRESS' : 'LAUNCH ROGUE STAR'}</span>
                    </span>
                    <span className="text-[7.5px] px-1 py-0.5 rounded bg-white/10 text-[#ffd778] border border-white/15">
                      [T]
                    </span>
                  </button>
                )}

                {/* Gravitational Slingshot Probe Trigger */}
                {onLaunchProbe && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onLaunchProbe();
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/30 border border-cyan-400/35 hover:border-cyan-400 text-[#f5f2eb] font-mono text-[8px] tracking-wider font-semibold uppercase flex items-center justify-between transition-all duration-200 cursor-pointer active:scale-[0.98]"
                    title="Launch glowing probe comet or click-and-drag anywhere in space (Hotkey: P)"
                  >
                    <span className="flex items-center gap-1.5">
                      <Compass className="w-3 h-3 text-[#4deeea]" />
                      <span>SLINGSHOT PROBE</span>
                    </span>
                    <span className="text-[7.5px] px-1 py-0.5 rounded bg-white/10 text-[#4deeea] border border-white/15">
                      [P / DRAG]
                    </span>
                  </button>
                )}

                {/* Wormhole Warp Trigger Button */}
                {onTriggerWormhole && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTriggerWormhole();
                    }}
                    disabled={isTransitioning}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/35 border border-indigo-400/40 hover:border-indigo-300 text-[#f5f2eb] font-mono text-[8px] tracking-wider font-semibold uppercase flex items-center justify-between transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]"
                    title="Engage Einstein-Rosen Wormhole Transit to a new star system (Hotkey: W)"
                  >
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-indigo-300" />
                      <span>WORMHOLE TRANSIT</span>
                    </span>
                    <span className="text-[7.5px] px-1 py-0.5 rounded bg-white/10 text-indigo-200 border border-white/15">
                      [W]
                    </span>
                  </button>
                )}

                {/* Trigger Supernova Shift Button */}
                {onTriggerTransition && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTriggerTransition();
                    }}
                    disabled={isTransitioning}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#c14b2a]/20 hover:bg-[#c14b2a]/35 border border-[#c14b2a]/40 hover:border-[#c14b2a] text-[#f5f2eb] font-mono text-[8px] tracking-wider font-semibold uppercase flex items-center justify-between transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]"
                    title="Trigger relativistic core collapse and supernova rebirth (Hotkey: N)"
                  >
                    <span className="flex items-center gap-1.5">
                      <Zap className="w-3 h-3 text-[#ffd778]" />
                      <span>{isTransitioning ? 'TRANSITIONING...' : 'TRIGGER SUPERNOVA'}</span>
                    </span>
                    <span className="text-[7.5px] px-1 py-0.5 rounded bg-white/10 text-[#ffd778] border border-white/15">
                      [N]
                    </span>
                  </button>
                )}
              </div>

              {/* Action hints / tags */}
              <div className="flex flex-wrap gap-1 pt-1 shrink-0">
                {sequenceInfo.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[7.5px] font-mono text-white/70 tracking-wider uppercase"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
