import React, { useState } from "react";
import { ParticleFilters } from "./ParticleCanvas/types";
import {
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  X,
  Sparkles,
  Layers,
  Activity,
  Check,
  RotateCcw,
  SlidersHorizontal,
  Terminal,
  Crosshair,
  Copy,
  Gauge,
  Zap,
} from "lucide-react";

interface DebugInspectorCardProps {
  showDebug: boolean;
  setShowDebug: (show: boolean) => void;
  debugLogs: string[];
  particleFilters: ParticleFilters;
  setParticleFilters: React.Dispatch<React.SetStateAction<ParticleFilters>>;
  textParticleSpeed?: number;
  setTextParticleSpeed?: (speed: number) => void;
  ambientParticleSpeed?: number;
  setAmbientParticleSpeed?: (speed: number) => void;
  objectParticleSpeed?: number;
  setObjectParticleSpeed?: (speed: number) => void;
}

export const DebugInspectorCard: React.FC<DebugInspectorCardProps> = ({
  showDebug,
  setShowDebug,
  debugLogs,
  particleFilters,
  setParticleFilters,
  textParticleSpeed = 0.12,
  setTextParticleSpeed,
  ambientParticleSpeed = 0.15,
  setAmbientParticleSpeed,
  objectParticleSpeed = 0.15,
  setObjectParticleSpeed,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<"toggles" | "speed" | "logs">("toggles");

  if (!showDebug) return null;

  const toggleFilter = (key: keyof ParticleFilters) => {
    setParticleFilters((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const setAllFilters = (value: boolean) => {
    setParticleFilters({
      ambient: value,
      celestial: value,
      bridges: value,
      tails: value,
      typography: value,
    });
  };

  const activeFilterCount = Object.values(particleFilters).filter(Boolean).length;
  const speedVal = textParticleSpeed;
  const speedPercentage = Math.round(speedVal * 100);
  const ambVal = ambientParticleSpeed;
  const ambPercentage = Math.round(ambVal * 100);
  const objVal = objectParticleSpeed;
  const objPercentage = Math.round(objVal * 100);

  // Minimized Compact Chip Mode
  if (isMinimized) {
    return (
      <div
        className="fixed top-4 left-4 z-[9999] pointer-events-auto font-mono text-xs animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 bg-slate-950/90 border border-emerald-500/50 hover:border-emerald-400 px-3 py-2 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.3)] backdrop-blur-md transition-all duration-200">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>

          <span className="font-bold text-emerald-300 text-[11px] tracking-wide flex items-center gap-1.5">
            DEBUG &amp; INSPECTOR
          </span>

          <div className="h-3 w-[1px] bg-slate-800 my-auto" />

          <span className="text-[10px] text-slate-300 flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-0.5 rounded-full border border-slate-800">
            <Gauge className="w-3 h-3 text-emerald-400" />
            <span>Text: {speedPercentage}%</span>
            <span className="text-slate-600">|</span>
            <span>Amb: {ambPercentage}%</span>
            <span className="text-slate-600">|</span>
            <span>Obj: {objPercentage}%</span>
          </span>

          <button
            onClick={() => setIsMinimized(false)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-semibold transition-all hover:scale-105 ml-1"
            title="Expand Debug Inspector Window"
          >
            <Eye className="w-3 h-3" />
            <span>Expand Panel</span>
          </button>

          <button
            onClick={() => setShowDebug(false)}
            className="p-1 hover:bg-red-500/20 rounded-full text-slate-400 hover:text-red-400 transition-colors ml-0.5"
            title="Close Debug Mode Completely"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Expanded Inspector Panel Window
  return (
    <div
      className="fixed top-4 left-4 z-[9999] pointer-events-auto font-mono text-xs w-[380px] sm:w-[420px] max-w-[92vw] bg-slate-950/95 border border-emerald-500/40 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.85)] backdrop-blur-xl overflow-hidden flex flex-col transition-all duration-300 animate-fadeIn"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-emerald-500/30 px-3.5 py-2.5 bg-slate-900/80">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="font-bold text-emerald-300 text-[11px] tracking-wider uppercase flex items-center gap-1.5">
            DEBUG &amp; INSPECTOR
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-emerald-300 transition-colors flex items-center gap-1 text-[10px]"
            title="Hide Inspector Window (Full View Mode)"
          >
            <EyeOff className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline text-emerald-400/90 font-medium">Hide Window</span>
          </button>

          <button
            onClick={() => setShowDebug(false)}
            className="p-1.5 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
            title="Close Debug Mode"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-800/80 bg-slate-950/60 p-1 gap-1">
        <button
          onClick={() => setActiveTab("toggles")}
          className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-all ${
            activeTab === "toggles"
              ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
          }`}
        >
          <SlidersHorizontal className="w-3 h-3 text-cyan-400" />
          <span>Layers ({activeFilterCount}/5)</span>
        </button>

        <button
          onClick={() => setActiveTab("speed")}
          className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-all ${
            activeTab === "speed"
              ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
          }`}
        >
          <Gauge className="w-3 h-3 text-emerald-400" />
          <span>Text Speed ({speedPercentage}%)</span>
        </button>

        <button
          onClick={() => setActiveTab("logs")}
          className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-all ${
            activeTab === "logs"
              ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
          }`}
        >
          <Terminal className="w-3 h-3 text-amber-400" />
          <span>Logs ({debugLogs.length})</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-3.5 max-h-[48vh] overflow-y-auto custom-scrollbar">
        {activeTab === "toggles" && (
          <div className="flex flex-col gap-3">
            {/* Quick Presets Bar */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-800/60 pb-2">
              <span className="flex items-center gap-1 text-slate-300 font-medium">
                <Sparkles className="w-3 h-3 text-yellow-400" />
                <span>Live Particle Type Toggles</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setAllFilters(true)}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                >
                  All On
                </button>
                <button
                  onClick={() => setAllFilters(false)}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                >
                  All Off
                </button>
              </div>
            </div>

            {/* Toggle Switches */}
            <div className="flex flex-col gap-2">
              {/* Ambient Stardust */}
              <label className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group">
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${particleFilters.ambient ? "bg-cyan-500/20 text-cyan-300" : "bg-slate-800 text-slate-500"}`}>
                    🌌
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-slate-200 group-hover:text-white">
                      Ambient Stardust &amp; Galaxies
                    </span>
                    <span className="text-[9px] text-slate-400">
                      Cosmic background dust, drift field &amp; distant galaxies
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={particleFilters.ambient}
                  onChange={() => toggleFilter("ambient")}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </label>

              {/* Celestial Accretion */}
              <label className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group">
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${particleFilters.celestial ? "bg-amber-500/20 text-amber-300" : "bg-slate-800 text-slate-500"}`}>
                    🪐
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-slate-200 group-hover:text-white">
                      Celestial &amp; Accretion Orbits
                    </span>
                    <span className="text-[9px] text-slate-400">
                      Black hole disk, planets, stars &amp; nebula ring particles
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={particleFilters.celestial}
                  onChange={() => toggleFilter("celestial")}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </label>

              {/* Wormhole Bridges */}
              <label className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group">
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${particleFilters.bridges ? "bg-indigo-500/20 text-indigo-300" : "bg-slate-800 text-slate-500"}`}>
                    🌉
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-slate-200 group-hover:text-white">
                      Gravitational Bridges
                    </span>
                    <span className="text-[9px] text-slate-400">
                      Wormhole streams &amp; inter-entity particle flows
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={particleFilters.bridges}
                  onChange={() => toggleFilter("bridges")}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </label>

              {/* Jet Trails & Debris */}
              <label className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group">
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${particleFilters.tails ? "bg-rose-500/20 text-rose-300" : "bg-slate-800 text-slate-500"}`}>
                    ☄
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-slate-200 group-hover:text-white">
                      Jet Trails &amp; Spaghettification
                    </span>
                    <span className="text-[9px] text-slate-400">
                      Cursor gravity jet trails &amp; tidal disruption debris
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={particleFilters.tails}
                  onChange={() => toggleFilter("tails")}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </label>

              {/* Project Typography */}
              <div className="flex flex-col p-2 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all gap-2">
                <label className="flex items-center justify-between cursor-pointer group">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg ${particleFilters.typography ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-slate-500"}`}>
                      🔤
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-slate-200 group-hover:text-white">
                        Project Typography Text
                      </span>
                      <span className="text-[9px] text-slate-400">
                        Particle text characters &amp; stage card letter forms
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={particleFilters.typography}
                    onChange={() => toggleFilter("typography")}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </label>

                <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px]">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-emerald-400" />
                    Speed: <strong className="text-emerald-300">{speedPercentage}%</strong>
                  </span>
                  <button
                    onClick={() => setActiveTab("speed")}
                    className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-semibold text-[9px] transition-all"
                  >
                    Adjust Speed Slider →
                  </button>
                </div>
              </div>
            </div>

            {/* Target Reticles Notice */}
            <div className="p-2.5 bg-emerald-950/30 border border-emerald-800/40 rounded-xl text-[10px] text-slate-300 flex items-start gap-2">
              <Crosshair className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-emerald-300 block mb-0.5">3D Reticles &amp; Object Labels Active</strong>
                Floating target badges are rendered directly on celestial objects. Click any badge on screen to copy its unique ID.
              </div>
            </div>
          </div>
        )}

        {activeTab === "speed" && (
          <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
            {/* Header / Description */}
            <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-[10px]">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-emerald-300 flex items-center gap-1.5 text-[11px]">
                  <Zap className="w-3.5 h-3.5 text-yellow-400" />
                  Particle Emitter Speed Controls
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[10px]">
                  3 Active Emitters
                </span>
              </div>
              <p className="text-slate-300 leading-relaxed text-[10px]">
                Independently tune motion velocities and orbital dynamics for Typography, Ambience, and Celestial Object emitters in real-time.
              </p>
            </div>

            {/* 1. Typography Text Particles Slider */}
            <div className="p-3 bg-slate-900/70 border border-slate-800 rounded-xl flex flex-col gap-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-200">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span>🔤</span>
                  <span>Text Typography Speed</span>
                </span>
                <span className="text-emerald-300 font-mono font-bold text-[10px]">
                  {speedPercentage}% ({speedVal.toFixed(2)}x)
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[9px] text-slate-400 font-mono shrink-0">2%</span>
                <input
                  type="range"
                  min="0.02"
                  max="0.50"
                  step="0.01"
                  value={speedVal}
                  onChange={(e) => setTextParticleSpeed?.(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400 hover:accent-emerald-300"
                />
                <span className="text-[9px] text-slate-400 font-mono shrink-0">50%</span>
              </div>

              <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-800/80">
                <span className="text-[9px] text-slate-400 font-medium">Presets:</span>
                <div className="flex items-center gap-1">
                  {[
                    { label: "5% Slow", val: 0.05 },
                    { label: "12% Calm", val: 0.12 },
                    { label: "25% Med", val: 0.25 },
                    { label: "40% Fast", val: 0.40 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => setTextParticleSpeed?.(preset.val)}
                      className={`px-2 py-0.5 rounded text-[9px] font-semibold transition-all ${
                        Math.abs(speedVal - preset.val) < 0.02
                          ? "bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 shadow-sm"
                          : "bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Ambience Particle Emitters Slider */}
            <div className="p-3 bg-slate-900/70 border border-slate-800 rounded-xl flex flex-col gap-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-200">
                <span className="flex items-center gap-1.5 text-cyan-400">
                  <span>✨</span>
                  <span>Ambience Particle Emitters</span>
                </span>
                <span className="text-cyan-300 font-mono font-bold text-[10px]">
                  {ambPercentage}% ({ambVal.toFixed(2)}x)
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[9px] text-slate-400 font-mono shrink-0">2%</span>
                <input
                  type="range"
                  min="0.02"
                  max="0.50"
                  step="0.01"
                  value={ambVal}
                  onChange={(e) => setAmbientParticleSpeed?.(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300"
                />
                <span className="text-[9px] text-slate-400 font-mono shrink-0">50%</span>
              </div>

              <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-800/80">
                <span className="text-[9px] text-slate-400 font-medium">Presets:</span>
                <div className="flex items-center gap-1">
                  {[
                    { label: "5% Subtle", val: 0.05 },
                    { label: "15% Ambient", val: 0.15 },
                    { label: "30% Flowing", val: 0.30 },
                    { label: "45% Dynamic", val: 0.45 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => setAmbientParticleSpeed?.(preset.val)}
                      className={`px-2 py-0.5 rounded text-[9px] font-semibold transition-all ${
                        Math.abs(ambVal - preset.val) < 0.02
                          ? "bg-cyan-500/30 text-cyan-300 border border-cyan-500/50 shadow-sm"
                          : "bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Object Particle Emitters Slider */}
            <div className="p-3 bg-slate-900/70 border border-slate-800 rounded-xl flex flex-col gap-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-200">
                <span className="flex items-center gap-1.5 text-indigo-400">
                  <span>🪐</span>
                  <span>Object Emitters &amp; Orbits</span>
                </span>
                <span className="text-indigo-300 font-mono font-bold text-[10px]">
                  {objPercentage}% ({objVal.toFixed(2)}x)
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[9px] text-slate-400 font-mono shrink-0">2%</span>
                <input
                  type="range"
                  min="0.02"
                  max="0.50"
                  step="0.01"
                  value={objVal}
                  onChange={(e) => setObjectParticleSpeed?.(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-400 hover:accent-indigo-300"
                />
                <span className="text-[9px] text-slate-400 font-mono shrink-0">50%</span>
              </div>

              <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-800/80">
                <span className="text-[9px] text-slate-400 font-medium">Presets:</span>
                <div className="flex items-center gap-1">
                  {[
                    { label: "5% Gentle", val: 0.05 },
                    { label: "15% Orbit", val: 0.15 },
                    { label: "30% Active", val: 0.30 },
                    { label: "45% High Energy", val: 0.45 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => setObjectParticleSpeed?.(preset.val)}
                      className={`px-2 py-0.5 rounded text-[9px] font-semibold transition-all ${
                        Math.abs(objVal - preset.val) < 0.02
                          ? "bg-indigo-500/30 text-indigo-300 border border-indigo-500/50 shadow-sm"
                          : "bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "logs" && (
          <div className="flex flex-col gap-1.5">
            <div className="text-[10px] text-slate-400 flex items-center justify-between pb-1 border-b border-slate-800">
              <span>Console Stream (Most Recent)</span>
              <span className="text-emerald-400 font-bold">{debugLogs.length} Events</span>
            </div>

            {debugLogs.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-[11px] italic">
                No debug events logged yet. Move your mouse or trigger a supernova to see live events.
              </div>
            ) : (
              <div className="flex flex-col gap-1 text-[10px]">
                {debugLogs.map((log, i) => (
                  <div
                    key={`log-${i}`}
                    className={`leading-tight break-all p-1.5 rounded border ${
                      log.includes("ERROR")
                        ? "bg-red-950/40 border-red-800/60 text-red-300"
                        : "bg-slate-900/60 border-slate-800 text-slate-300"
                    }`}
                  >
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Info & Full View Toggle */}
      <div className="px-3.5 py-2 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
        <span className="text-slate-400">
          Tip: Click <strong className="text-emerald-400 font-medium">"Hide Window"</strong> above for unobstructed viewing.
        </span>
        <button
          onClick={() => setIsMinimized(true)}
          className="text-emerald-400 hover:underline font-semibold flex items-center gap-1"
        >
          <span>Hide</span>
          <ChevronUp className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
