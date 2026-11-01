import React from "react";
import { X, Sparkles, Radio, Zap, Globe, Orbit, Flame, Disc } from "lucide-react";

export interface CosmicSceneItem {
  id: string;
  archetype: string;
  name: string;
  subtitle: string;
  desc: string;
  badges: string[];
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
}

export const COSMIC_CATALOG: CosmicSceneItem[] = [
  {
    id: "blackhole",
    archetype: "BLACKHOLE_CENTRIC",
    name: "M87* Kerr Singularity",
    subtitle: "General Relativity & Event Horizon Telescope",
    desc: "A spinning Kerr black hole with achromatic null-geodesic lensing, a logarithmic n≥2 photon sub-ring, and MAD polarized synchrotron corona.",
    badges: ["🕳 NULL GEODESICS", "PHOTON RING (n≥2)", "MAD CORONA"],
    icon: Disc,
    accentColor: "#f97316",
  },
  {
    id: "kilonova",
    archetype: "KILONOVA_MERGER",
    name: "GW170817 Binary Kilonova",
    subtitle: "Multi-Messenger Gravitational Wave Merger",
    desc: "Binary neutron star inspiral generating high-frequency gravitational-wave chirps and radioactive r-process nucleosynthesis (gold & platinum synthesis).",
    badges: ["💫 GW CHIRP INSPIRAL", "r-PROCESS EJECTA", "sGRB RELATIVISTIC JET"],
    icon: Sparkles,
    accentColor: "#fbbf24",
  },
  {
    id: "blazar",
    archetype: "RELATIVISTIC_BLAZAR",
    name: "M87* Relativistic Blazar",
    subtitle: "Active Galactic Nucleus (AGN) & Superluminal Jet",
    desc: "A 6.5-billion-solar-mass black hole powering a collimated helical polar jet with apparent superluminal motion (β_app ≈ 6c) and HST-1 synchrotron shock knots.",
    badges: ["⚡ SUPERLUMINAL (β_app≈6c)", "SMBH 6.5×10⁹ M☉", "HST-1 KNOT"],
    icon: Zap,
    accentColor: "#38bdf8",
  },
  {
    id: "trappist",
    archetype: "EXOPLANET_CLUSTER",
    name: "TRAPPIST-1 Resonant Chain",
    subtitle: "Laplace 3-Body Mean-Motion Resonance Architecture",
    desc: "A cool M-dwarf host star surrounded by planets with nested Keplerian semi-major axes locked in a 3-body Laplace resonance chain (n₁ - 3n₂ + 2n₃ = 0).",
    badges: ["🪐 LAPLACE 3:2:1", "M-DWARF HOST", "KEPLERIAN DYNAMICS"],
    icon: Orbit,
    accentColor: "#4deeea",
  },
  {
    id: "spiral",
    archetype: "SPIRAL_GALAXY",
    name: "Andromeda Spiral Galaxy",
    subtitle: "NFW Dark Matter Halo & Density Waves",
    desc: "Grand-design spiral galaxy stabilized by an extended NFW dark matter halo, exhibiting a flat rotational velocity profile and Lin-Shu density wave arms.",
    badges: ["🌌 FLAT ROTATION v_c(r)", "NFW DM HALO", "H II STARBURST"],
    icon: Globe,
    accentColor: "#818cf8",
  },
  {
    id: "binary",
    archetype: "BINARY_PLANETS",
    name: "Gemini Barycentric Binary",
    subtitle: "Mutual Keplerian Orbit & Roche-Lobe Overflow",
    desc: "Two terrestrial planets orbiting their mutual center of mass, transferring atmospheric plasma via Roche-lobe overflow through the inner L1 Lagrange point.",
    badges: ["☄ BARYCENTER ORBIT", "ROCHE-LOBE L1", "HYDRODYNAMIC STREAM"],
    icon: Flame,
    accentColor: "#2dd4bf",
  },
  {
    id: "nebula",
    archetype: "NEBULA_CRADLE",
    name: "Ionized H II Stellar Nursery",
    subtitle: "Photoionization & Protostellar Bok Globules",
    desc: "Dense interstellar H II cloud sculpted by intense ultraviolet radiation pressure from newly formed O/B hypergiant stars carving hollow shock fronts.",
    badges: ["☁ H II REGION", "O/B HYPERGIANTS", "BOK GLOBULES"],
    icon: Sparkles,
    accentColor: "#ec4899",
  },
  {
    id: "pulsar",
    archetype: "STELLAR_PULSAR",
    name: "Vela Relativistic Pulsar",
    subtitle: "Goldreich-Julian Magnetosphere & Synchrotron Torus",
    desc: "Rapidly spinning neutron star with a 10¹² Gauss magnetic field, launching polar cap pair-plasma cascades and an equatorial synchrotron wind nebula.",
    badges: ["★ NEUTRON STAR", "10¹² GAUSS DIPOLE", "SYNCHROTRON TORUS"],
    icon: Radio,
    accentColor: "#a855f7",
  },
];

interface CosmicCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectScene: (archetype: string) => void;
  currentArchetype?: string;
  onTriggerKilonova?: () => void;
}

export const CosmicCatalogModal: React.FC<CosmicCatalogModalProps> = ({
  isOpen,
  onClose,
  onSelectScene,
  currentArchetype,
  onTriggerKilonova,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-slate-950/90 border border-white/15 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.8)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-300">
              <Orbit className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-semibold font-mono tracking-wider text-slate-100 uppercase">
                  Cosmic Observatory // Scene Catalog
                </h2>
                <span className="px-2 py-0.5 text-[9px] font-mono uppercase rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                  8 Astrophysics Archetypes
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-400">
                Peer-reviewed General Relativity & Multi-Messenger space environments
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
            title="Close Catalog [Esc]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Cataclysm Action Bar */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-gradient-to-r from-amber-500/10 via-cyan-500/10 to-indigo-500/10 border-b border-white/5 text-[11px] font-mono">
          <span className="text-slate-300 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            Interactive Cataclysms Available:
          </span>
          <div className="flex items-center gap-2">
            {onTriggerKilonova && (
              <button
                onClick={() => {
                  onTriggerKilonova();
                  onClose();
                }}
                className="px-3 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-200 text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>TRIGGER KILONOVA MERGER [K]</span>
              </button>
            )}
          </div>
        </div>

        {/* Catalog Grid */}
        <div className="overflow-y-auto p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-3.5 scrollbar-thin scrollbar-thumb-white/10">
          {COSMIC_CATALOG.map((item) => {
            const Icon = item.icon;
            const isCurrent = currentArchetype === item.archetype;

            return (
              <div
                key={item.id}
                onClick={() => {
                  onSelectScene(item.archetype);
                  onClose();
                }}
                className={`relative flex flex-col justify-between p-4 rounded-xl border transition-all duration-200 cursor-pointer group ${
                  isCurrent
                    ? "bg-cyan-950/30 border-cyan-400/60 shadow-[0_0_20px_rgba(56,189,248,0.2)]"
                    : "bg-slate-900/50 hover:bg-slate-800/60 border-white/10 hover:border-white/25"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="p-2 rounded-lg border"
                        style={{
                          backgroundColor: `${item.accentColor}18`,
                          borderColor: `${item.accentColor}45`,
                          color: item.accentColor,
                        }}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs sm:text-sm font-semibold font-mono text-slate-100 group-hover:text-cyan-300 transition-colors">
                          {item.name}
                        </h3>
                        <div className="text-[10px] font-mono text-slate-400">
                          {item.subtitle}
                        </div>
                      </div>
                    </div>

                    {isCurrent && (
                      <span className="px-2 py-0.5 rounded text-[8.5px] font-mono tracking-wider uppercase font-semibold bg-cyan-400/20 text-cyan-300 border border-cyan-400/40 shrink-0">
                        ACTIVE
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] font-sans text-slate-300 leading-relaxed mb-3">
                    {item.desc}
                  </p>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/5">
                  {item.badges.map((badge, bIdx) => (
                    <span
                      key={bIdx}
                      className="px-2 py-0.5 rounded text-[8px] font-mono uppercase bg-white/5 text-slate-400 border border-white/5"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 bg-slate-900/40 flex items-center justify-between text-[10px] font-mono text-slate-400">
          <span>Shortcuts: [S] Catalog · [K] Kilonova · [T] TDE · [W] Wormhole</span>
          <span className="hidden sm:inline text-cyan-400/80">Click any system to transition space-time</span>
        </div>
      </div>
    </div>
  );
};
