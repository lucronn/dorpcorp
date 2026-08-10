import React, { useEffect, useState, useRef } from "react";
import * as BABYLON from "@babylonjs/core";
import { CelestialEntity } from "./ParticleCanvas/types";
import { Copy, Check, Crosshair, Sparkles, Layers, Compass } from "lucide-react";

interface ProjectedObject {
  id: string;
  type: "blackhole" | "planet" | "nebula" | "star" | "galaxy" | "supernova" | "wormhole" | "project_card";
  label: string;
  x: number; // screen pixel X
  y: number; // screen pixel Y
  z: number; // depth
  worldX: number;
  worldY: number;
  worldZ: number;
  radius: number;
  scale: number;
  mass?: number;
  color?: string;
  inFrustum: boolean;
  entityRef?: CelestialEntity;
}

interface DebugObjectOverlayProps {
  celestialEntitiesRef: React.MutableRefObject<CelestialEntity[]>;
  sceneRef: React.MutableRefObject<BABYLON.Scene | null>;
  cameraRef: React.MutableRefObject<BABYLON.Camera | null>;
  rendererRef: React.MutableRefObject<BABYLON.Engine | null>;
  showDebug: boolean;
  stage: number;
  supernovaRef?: React.MutableRefObject<{ x: number; y: number; time: number } | null>;
  activeWormholeRef?: React.MutableRefObject<any>;
}

export const DebugObjectOverlay: React.FC<DebugObjectOverlayProps> = ({
  celestialEntitiesRef,
  sceneRef,
  cameraRef,
  rendererRef,
  showDebug,
  stage,
  supernovaRef,
  activeWormholeRef,
}) => {
  const [projectedObjects, setProjectedObjects] = useState<ProjectedObject[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!showDebug) return;

    let animId: number;

    const updateProjections = () => {
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const engine = rendererRef.current;
      const ww = window.innerWidth;
      const wh = window.innerHeight;

      if (!scene || scene.isDisposed || !camera || !engine) {
        animId = requestAnimationFrame(updateProjections);
        return;
      }

      const transformMatrix = scene.getTransformMatrix();
      const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());

      const entities = celestialEntitiesRef.current || [];
      const projectedList: ProjectedObject[] = [];

      entities.forEach((entity, idx) => {
        if (entity.isDestroyed || (entity.scale ?? 1.0) < 0.02) return;

        // Ensure entity has a clear, deterministic ID
        if (!entity.id) {
          entity.id = `${entity.type}-${idx + 1}`;
        }

        const wx = entity.x - ww / 2;
        const wy = -(entity.y - wh / 2);
        const wz = entity.z || 0;

        const pos3D = new BABYLON.Vector3(wx, wy, wz);
        const projected = BABYLON.Vector3.Project(
          pos3D,
          BABYLON.Matrix.IdentityReadOnly,
          transformMatrix,
          viewport
        );

        const inFrustum = projected.z >= 0 && projected.z <= 1.0;
        const screenX = projected.x;
        const screenY = projected.y;

        projectedList.push({
          id: entity.id,
          type: entity.type,
          label: `${entity.type.toUpperCase()}`,
          x: Math.round(screenX),
          y: Math.round(screenY),
          z: Math.round(wz),
          worldX: Math.round(entity.x),
          worldY: Math.round(entity.y),
          worldZ: Math.round(wz),
          radius: Math.round(entity.radius),
          scale: Number((entity.scale ?? 1.0).toFixed(2)),
          mass: entity.mass ? Math.round(entity.mass) : undefined,
          color: entity.color,
          inFrustum,
          entityRef: entity,
        });
      });

      // Special active events
      if (supernovaRef?.current) {
        const sn = supernovaRef.current;
        const elapsed = Date.now() - sn.time;
        if (elapsed < 5000) {
          projectedList.push({
            id: `supernova-core-${Math.floor(sn.time % 10000)}`,
            type: "supernova",
            label: "SUPERNOVA CORE",
            x: Math.round(sn.x),
            y: Math.round(sn.y),
            z: 0,
            worldX: Math.round(sn.x),
            worldY: Math.round(sn.y),
            worldZ: 0,
            radius: 120,
            scale: 1.5,
            color: "#ff5e62",
            inFrustum: true,
          });
        }
      }

      if (activeWormholeRef?.current) {
        projectedList.push({
          id: "wormhole-transit-bridge",
          type: "wormhole",
          label: "WORMHOLE BRIDGE",
          x: Math.round(ww / 2),
          y: Math.round(wh / 2),
          z: 0,
          worldX: Math.round(ww / 2),
          worldY: Math.round(wh / 2),
          worldZ: 0,
          radius: 200,
          scale: 2.0,
          color: "#4deeea",
          inFrustum: true,
        });
      }

      setProjectedObjects(projectedList);
      animId = requestAnimationFrame(updateProjections);
    };

    animId = requestAnimationFrame(updateProjections);
    return () => cancelAnimationFrame(animId);
  }, [showDebug, celestialEntitiesRef, sceneRef, cameraRef, rendererRef, supernovaRef, activeWormholeRef]);

  if (!showDebug) return null;

  const handleCopyId = (e: React.MouseEvent, id: string, type: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id);
      setSelectedId(id);
      console.log(`%c[DEBUG] [COPIED OBJECT ID] ${id} (Type: ${type})`, "color: #4deeea; font-weight: bold;");
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => setCopiedId(null), 2500);
    });
  };

  const getTypeStyle = (type: ProjectedObject["type"]) => {
    switch (type) {
      case "blackhole":
        return {
          border: "border-[#4deeea]",
          bg: "bg-[#4deeea]/15",
          text: "text-[#4deeea]",
          badgeBg: "bg-[#4deeea]",
          dot: "bg-[#4deeea]",
        };
      case "planet":
        return {
          border: "border-[#ffd778]",
          bg: "bg-[#ffd778]/15",
          text: "text-[#ffd778]",
          badgeBg: "bg-[#ffd778]",
          dot: "bg-[#ffd778]",
        };
      case "star":
        return {
          border: "border-[#ffee55]",
          bg: "bg-[#ffee55]/15",
          text: "text-[#ffee55]",
          badgeBg: "bg-[#ffee55]",
          dot: "bg-[#ffee55]",
        };
      case "nebula":
        return {
          border: "border-[#ff5e62]",
          bg: "bg-[#ff5e62]/15",
          text: "text-[#ff5e62]",
          badgeBg: "bg-[#ff5e62]",
          dot: "bg-[#ff5e62]",
        };
      case "galaxy":
        return {
          border: "border-[#88bbff]",
          bg: "bg-[#88bbff]/15",
          text: "text-[#88bbff]",
          badgeBg: "bg-[#88bbff]",
          dot: "bg-[#88bbff]",
        };
      case "supernova":
        return {
          border: "border-red-500 animate-pulse",
          bg: "bg-red-500/20",
          text: "text-red-400",
          badgeBg: "bg-red-500",
          dot: "bg-red-500",
        };
      case "wormhole":
        return {
          border: "border-cyan-400 animate-pulse",
          bg: "bg-cyan-500/20",
          text: "text-cyan-300",
          badgeBg: "bg-cyan-400",
          dot: "bg-cyan-400",
        };
      default:
        return {
          border: "border-slate-400",
          bg: "bg-slate-800/60",
          text: "text-slate-200",
          badgeBg: "bg-slate-400",
          dot: "bg-slate-400",
        };
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-[9990] overflow-hidden select-none font-mono">
      {/* Toast Confirmation */}
      {copiedId && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none bg-slate-950/95 border border-[#4deeea] text-[#4deeea] px-4 py-2 rounded-full shadow-[0_0_25px_rgba(77,238,234,0.4)] text-xs font-semibold flex items-center gap-2 backdrop-blur-md animate-bounce">
          <Check className="w-4 h-4 text-[#4deeea]" />
          <span>Copied Object ID to Clipboard: <strong className="text-white underline">{copiedId}</strong></span>
        </div>
      )}

      {/* Floating Target Reticles & Badges on screen */}
      {projectedObjects.map((obj, i) => {
        if (!obj.inFrustum) return null;

        // Ensure within screen padding
        const clampX = Math.max(20, Math.min(window.innerWidth - 180, obj.x));
        const clampY = Math.max(20, Math.min(window.innerHeight - 80, obj.y));
        const style = getTypeStyle(obj.type);
        const isSelected = selectedId === obj.id;

        return (
          <div
            key={`obj-debug-${obj.id}-${i}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto transition-transform duration-75 group"
            style={{ left: `${clampX}px`, top: `${clampY}px` }}
            onClick={(e) => handleCopyId(e, obj.id, obj.type)}
          >
            {/* Target Reticle Ring */}
            <div className="relative flex items-center justify-center">
              <div
                className={`w-10 h-10 rounded-full border border-dashed ${style.border} flex items-center justify-center ${
                  isSelected ? "scale-125 border-solid shadow-[0_0_15px_rgba(77,238,234,0.8)]" : "opacity-80 group-hover:opacity-100 group-hover:scale-110"
                } transition-all duration-200`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
              </div>

              {/* Leader Line & Identifier Card */}
              <div className="absolute left-6 top-6 flex flex-col gap-1 bg-slate-950/90 border border-slate-700/80 group-hover:border-slate-400 p-2 rounded-lg shadow-2xl backdrop-blur-md text-[10px] min-w-[150px] pointer-events-auto transition-all duration-200 hover:scale-105">
                <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold text-slate-950 ${style.badgeBg}`}>
                    #{i + 1} {obj.label}
                  </span>
                  <button
                    onClick={(e) => handleCopyId(e, obj.id, obj.type)}
                    className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                    title="Click to copy object ID"
                  >
                    {copiedId === obj.id ? (
                      <Check className="w-3 h-3 text-green-400" />
                    ) : (
                      <Copy className="w-3 h-3 text-cyan-400" />
                    )}
                  </button>
                </div>

                <div className="flex flex-col gap-0.5 text-slate-300">
                  <div className="font-bold text-white text-[11px] truncate tracking-tight text-cyan-300">
                    ID: {obj.id}
                  </div>
                  <div className="text-slate-400 text-[9px] flex items-center gap-1">
                    <span>Pos: ({obj.worldX}, {obj.worldY}, {obj.worldZ})</span>
                  </div>
                  <div className="text-slate-400 text-[9px] flex items-center gap-2">
                    <span>Radius: {obj.radius}px</span>
                    <span>Scale: {obj.scale}</span>
                  </div>
                </div>

                <div className="text-[8px] text-slate-500 italic mt-0.5 border-t border-slate-900 pt-0.5 flex justify-between">
                  <span>Click badge to copy ID</span>
                  <span>Z: {obj.z}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
