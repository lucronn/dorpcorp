import React, { useState, useEffect, useRef, useCallback } from "react";
import { Volume2, VolumeX, FastForward, Maximize2, Minimize2, Sparkles } from "lucide-react";
import { audio } from "../utils/audio";

const ARCHETYPES = [
  "BLACKHOLE_CENTRIC",
  "STELLAR_PULSAR",
  "SPIRAL_GALAXY",
  "BINARY_PLANETS",
  "EXOPLANET_CLUSTER",
  "NEBULA_CRADLE",
] as const;

type ArchetypeType = (typeof ARCHETYPES)[number];

const ARCHETYPE_META: Record<ArchetypeType, { name: string; subtitle: string; tag: string }> = {
  BLACKHOLE_CENTRIC: {
    name: "Cygnus X-1 Singularity",
    subtitle: "Supermassive Black Hole · Multi-Layer Accretion Disk",
    tag: "GRAVITATIONAL LENSING",
  },
  STELLAR_PULSAR: {
    name: "Vela Pulsar PSR B0833-45",
    subtitle: "Relativistic Magnetized Neutron Core · Synchrotron Jets",
    tag: "POLAR BEAM RESONANCE",
  },
  SPIRAL_GALAXY: {
    name: "Messier 81 Spiral Galaxy",
    subtitle: "Logarithmic Stellar Arms · Barycentric Central Bulge",
    tag: "GALACTIC ROTATION",
  },
  BINARY_PLANETS: {
    name: "Kepler-1647 Binary System",
    subtitle: "Gravitational Roche Lobe Coupling · Slingshot Orbits",
    tag: "CO-ORBITAL DYNAMICS",
  },
  EXOPLANET_CLUSTER: {
    name: "TRAPPIST-1 Exoplanet System",
    subtitle: "Resonant Laplace Chain · Multi-World Orbital Mechanics",
    tag: "RESONANT HARMONICS",
  },
  NEBULA_CRADLE: {
    name: "Orion Molecular Cloud",
    subtitle: "Volumetric Emission Filaments · Stellar Protostar Nursery",
    tag: "HYDRODYNAMIC EMISSION",
  },
};

interface CosmicScreensaverOverlayProps {
  onExitScreensaver?: () => void;
  muted?: boolean;
  onToggleMute?: () => void;
}

export const CosmicScreensaverOverlay: React.FC<CosmicScreensaverOverlayProps> = ({
  onExitScreensaver,
  muted: externalMuted,
  onToggleMute,
}) => {
  const [currentArchetype, setCurrentArchetype] = useState<ArchetypeType>("BLACKHOLE_CENTRIC");
  const [internalMuted, setInternalMuted] = useState(() => (audio as any).isMuted !== false);
  const isMuted = externalMuted !== undefined ? externalMuted : internalMuted;
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [eventNotification, setEventNotification] = useState<string | null>(null);
  const [cycleProgress, setCycleProgress] = useState(0);

  const shuffleBagRef = useRef<ArchetypeType[]>([...ARCHETYPES]);
  const sceneStartTimeRef = useRef<number>(Date.now());
  const sceneDurationRef = useRef<number>(36000); // 36s default (30-45s range)
  const midEventTriggeredRef = useRef<boolean>(false);
  const transitionTriggeredRef = useRef<boolean>(false);
  const activityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mark window as screensaver managed
  useEffect(() => {
    (window as any).__screensaverManaged = true;
    return () => {
      delete (window as any).__screensaverManaged;
    };
  }, []);

  // Pick next non-repeating archetype using shuffle bag
  const getNextArchetype = useCallback((): ArchetypeType => {
    if (shuffleBagRef.current.length === 0) {
      shuffleBagRef.current = ARCHETYPES.filter((a) => a !== currentArchetype);
    }
    const idx = Math.floor(Math.random() * shuffleBagRef.current.length);
    const chosen = shuffleBagRef.current.splice(idx, 1)[0] || "SPIRAL_GALAXY";
    return chosen;
  }, [currentArchetype]);

  // Handle mid-scene cataclysms (TDE, Pulsar flares, Roche bridges)
  const triggerMidSceneEvent = useCallback((archetype: ArchetypeType) => {
    const canvasApi = (window as any).__cosmicCanvas;
    if (!canvasApi) return;

    if (archetype === "BLACKHOLE_CENTRIC") {
      setEventNotification("Tidal Disruption Event: Stellar Shredding Detected");
      canvasApi.triggerTDE?.();
    } else if (archetype === "STELLAR_PULSAR") {
      setEventNotification("Relativistic Jet Flare: Synchrotron Pulse Shockwave");
      canvasApi.triggerPulsarShockwave?.();
    } else if (archetype === "BINARY_PLANETS") {
      setEventNotification("Gravitational Slingshot: Interplanetary Probe Trajectory");
      canvasApi.launchProbe?.();
    } else {
      setEventNotification("Cosmic Wavefront: High-Energy Particle Surge");
      canvasApi.launchProbe?.();
    }

    setTimeout(() => {
      setEventNotification(null);
    }, 4500);
  }, []);

  // Execute transition to next scene
  const transitionToNextScene = useCallback(() => {
    if (transitionTriggeredRef.current) return;
    transitionTriggeredRef.current = true;

    const nextArch = getNextArchetype();
    (window as any).__forcedNextArchetype = nextArch;

    const canvasApi = (window as any).__cosmicCanvas;
    if (canvasApi) {
      // Black-hole systems may end with the camera being captured by the hole;
      // otherwise alternate between wormhole and supernova crossfade.
      const usePlunge = currentArchetype === "BLACKHOLE_CENTRIC" && Math.random() > 0.4;
      const useWormhole = Math.random() > 0.45;
      if (usePlunge && canvasApi.plungeIntoBlackHole?.()) {
        setEventNotification("Event Horizon Crossing: Camera Captured");
      } else if (useWormhole && canvasApi.startWormholeTransit) {
        setEventNotification("Einstein-Rosen Wormhole Transit Engaged");
        canvasApi.startWormholeTransit();
      } else if (canvasApi.triggerSupernovaTransition) {
        setEventNotification("Stellar Core Collapse & Supernova Rebirth");
        canvasApi.triggerSupernovaTransition();
      } else {
        canvasApi.nextScene();
      }
    }

    // Reset scene state after transition initiates
    setTimeout(() => {
      setCurrentArchetype(nextArch);
      sceneStartTimeRef.current = Date.now();
      // Randomize duration between 32 and 44 seconds
      sceneDurationRef.current = 32000 + Math.floor(Math.random() * 12000);
      midEventTriggeredRef.current = false;
      transitionTriggeredRef.current = false;
      setEventNotification(null);
    }, 3200);
  }, [getNextArchetype, currentArchetype]);

  // Main autonomous clock timer
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - sceneStartTimeRef.current;
      const totalDuration = sceneDurationRef.current;
      const progress = Math.min(1.0, elapsed / totalDuration);
      setCycleProgress(progress);

      // Mid-scene cosmic cataclysm around 52% of duration (~18s - 24s)
      if (progress >= 0.52 && !midEventTriggeredRef.current && !transitionTriggeredRef.current) {
        midEventTriggeredRef.current = true;
        triggerMidSceneEvent(currentArchetype);
      }

      // End-of-scene transition at 100%
      if (progress >= 1.0 && !transitionTriggeredRef.current) {
        transitionToNextScene();
      }
    }, 250);

    return () => clearInterval(interval);
  }, [currentArchetype, triggerMidSceneEvent, transitionToNextScene]);

  // Mouse activity and auto-hide gesture
  const resetActivity = useCallback(() => {
    setShowControls(true);
    if (activityTimerRef.current) {
      clearTimeout(activityTimerRef.current);
    }
    activityTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3200);
  }, []);

  useEffect(() => {
    const handleActivity = () => resetActivity();
    window.addEventListener("mousemove", handleActivity, { passive: true });
    window.addEventListener("touchstart", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity, { passive: true });
    window.addEventListener("click", handleActivity);

    // Initial brief 3s indicator so user knows controls exist, then fade out
    resetActivity();

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
      if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
    };
  }, [resetActivity]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (typeof document === "undefined") return;
    try {
      if (!document.fullscreenElement) {
        if (typeof document.documentElement.requestFullscreen === "function") {
          document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
        }
      } else {
        if (typeof document.exitFullscreen === "function") {
          document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
        }
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Audio toggle
  const toggleAudio = useCallback(() => {
    if (onToggleMute) {
      onToggleMute();
      return;
    }
    setInternalMuted((prev) => {
      const next = !prev;
      try {
        audio.setMute(next);
      } catch {}
      return next;
    });
  }, [onToggleMute]);

  const meta = ARCHETYPE_META[currentArchetype] || ARCHETYPE_META.BLACKHOLE_CENTRIC;

  return (
    <div
      className={`fixed inset-0 pointer-events-none select-none z-30 transition-opacity duration-700 ${
        showControls ? "cursor-default" : "cursor-none"
      }`}
    >
      {/* Event notification banner (fades in when cataclysm occurs) */}
      <div
        className={`absolute top-8 left-1/2 -translate-x-1/2 transition-all duration-700 ${
          eventNotification
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-4 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-black/60 backdrop-blur-md border border-amber-500/30 text-amber-300/90 shadow-[0_0_25px_rgba(245,158,11,0.2)]">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span className="text-xs font-mono tracking-widest uppercase font-semibold">
            {eventNotification}
          </span>
        </div>
      </div>

      {/* Subtle bottom-left astronomical metadata badge (auto-hides with controls) */}
      <div
        className={`absolute bottom-8 left-8 transition-opacity duration-700 ${
          showControls ? "opacity-90" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex flex-col gap-1 max-w-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400/80 animate-ping inline-block" />
            <span className="text-[10px] font-mono tracking-[0.2em] text-cyan-400 uppercase font-semibold">
              {meta.tag}
            </span>
          </div>
          <h1 className="text-xl font-medium tracking-tight text-white/95 font-sans drop-shadow-md">
            {meta.name}
          </h1>
          <p className="text-xs text-white/60 font-sans tracking-wide">
            {meta.subtitle}
          </p>

          {/* Thin ambient progress track */}
          <div className="w-48 h-0.5 bg-white/10 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-amber-400 transition-all duration-300 ease-linear"
              style={{ width: `${Math.round(cycleProgress * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Floating minimalist ambient control pill (auto-hides after 3s) */}
      <div
        className={`absolute bottom-8 right-8 transition-all duration-700 ${
          showControls
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-3 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-1.5 p-1.5 rounded-full bg-black/50 backdrop-blur-xl border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
          {/* Sound Toggle */}
          <button
            onClick={toggleAudio}
            title={isMuted ? "Enable Ambient Audio" : "Mute Audio"}
            className="p-2.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-white/50" />
            ) : (
              <Volume2 className="w-4 h-4 text-cyan-400 animate-pulse" />
            )}
          </button>

          {/* Next Cosmic Scene Skip */}
          <button
            onClick={transitionToNextScene}
            title="Next Celestial Phenomenon"
            className="p-2.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
          >
            <FastForward className="w-4 h-4 text-white/80" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            className="p-2.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-white/70" />
            ) : (
              <Maximize2 className="w-4 h-4 text-white/70" />
            )}
          </button>

          {onExitScreensaver && (
            <button
              onClick={onExitScreensaver}
              title="Exit Autopilot & Return to Portfolio [A]"
              className="px-3 py-1.5 ml-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-[10px] font-mono tracking-widest uppercase text-cyan-300 font-semibold transition-all cursor-pointer"
            >
              EXIT AUTOPILOT
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
