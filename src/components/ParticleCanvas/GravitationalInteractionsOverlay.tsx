import React, { useEffect, useRef } from "react";
import * as BABYLON from "@babylonjs/core";
import { SlingshotAimState, SlingshotProbe } from "./SlingshotEngine";
import { TdeState } from "./TidalDisruptionEngine";
import { CelestialEntity } from "./types";

interface GravitationalInteractionsOverlayProps {
  slingshotAim?: SlingshotAimState;
  slingshotAimRef?: React.MutableRefObject<SlingshotAimState>;
  probes?: SlingshotProbe[];
  probesRef?: React.MutableRefObject<SlingshotProbe[]>;
  tdeState?: TdeState;
  tdeStateRef?: React.MutableRefObject<TdeState>;
  activeBlackhole?: CelestialEntity | null;
  celestialEntitiesRef?: React.MutableRefObject<CelestialEntity[]>;
  cursorPos?: { x: number; y: number };
  mouseRef?: React.MutableRefObject<{ x: number; y: number; lastMoved: number }>;
  isSlingshotMode?: boolean;
  sceneRef?: React.MutableRefObject<BABYLON.Scene | null>;
  cameraRef?: React.MutableRefObject<BABYLON.TargetCamera | null>;
  rendererRef?: React.MutableRefObject<BABYLON.Engine | null>;
}

export const GravitationalInteractionsOverlay: React.FC<GravitationalInteractionsOverlayProps> = ({
  slingshotAim,
  slingshotAimRef,
  probes,
  probesRef,
  tdeState,
  tdeStateRef,
  activeBlackhole,
  celestialEntitiesRef,
  cursorPos,
  mouseRef,
  isSlingshotMode = false,
  sceneRef,
  cameraRef,
  rendererRef,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const now = performance.now();
      const scene = sceneRef?.current;
      const camera = cameraRef?.current;
      const has3DProjection = !!(scene && !scene.isDisposed && camera && rendererRef?.current);
      const transformMatrix = has3DProjection ? scene!.getTransformMatrix() : null;
      const globalViewport = has3DProjection ? camera!.viewport.toGlobal(width, height) : null;

      const project3D = (
        x2d: number,
        y2d: number,
        z3d = 0,
        radius = 0,
        worldX?: number,
        worldY?: number,
        worldZ?: number
      ): { x: number; y: number; radius: number; inFrustum: boolean } => {
        if (!has3DProjection || !transformMatrix || !globalViewport) {
          return { x: x2d, y: y2d, radius, inFrustum: true };
        }
        const wx = worldX !== undefined ? worldX : x2d - width / 2;
        const wy = worldY !== undefined ? worldY : -(y2d - height / 2);
        const wz = worldZ !== undefined ? worldZ : z3d;

        const projCenter = BABYLON.Vector3.Project(
          new BABYLON.Vector3(wx, wy, wz),
          BABYLON.Matrix.IdentityReadOnly,
          transformMatrix,
          globalViewport
        );
        if (
          isNaN(projCenter.x) ||
          isNaN(projCenter.y) ||
          isNaN(projCenter.z) ||
          projCenter.z < 0.0 ||
          projCenter.z > 1.0
        ) {
          return { x: x2d, y: y2d, radius, inFrustum: false };
        }

        let projRadius = radius;
        if (radius > 0) {
          const projEdgeX = BABYLON.Vector3.Project(
            new BABYLON.Vector3(wx + radius, wy, wz),
            BABYLON.Matrix.IdentityReadOnly,
            transformMatrix,
            globalViewport
          );
          const projEdgeY = BABYLON.Vector3.Project(
            new BABYLON.Vector3(wx, wy + radius, wz),
            BABYLON.Matrix.IdentityReadOnly,
            transformMatrix,
            globalViewport
          );
          const distX = Math.hypot(projEdgeX.x - projCenter.x, projEdgeX.y - projCenter.y);
          const distY = Math.hypot(projEdgeY.x - projCenter.x, projEdgeY.y - projCenter.y);
          const bestDist = Math.max(isNaN(distX) ? 0 : distX, isNaN(distY) ? 0 : distY);
          if (bestDist > 0.5) {
            projRadius = bestDist;
          }
        }

        return {
          x: projCenter.x,
          y: projCenter.y,
          radius: projRadius,
          inFrustum: true,
        };
      };

      // Read live frame data from refs or props
      const curAim = slingshotAimRef
        ? slingshotAimRef.current
        : slingshotAim || { isAiming: false, originX: 0, originY: 0, currentX: 0, currentY: 0, trajectoryPoints: [] };
      const curProbes = probesRef ? probesRef.current : probes || [];
      const curTde = tdeStateRef ? tdeStateRef.current : tdeState || { isActive: false, stage: "IDLE" as const, streamers: [], accretionGlowMultiplier: 1, grbBeamIntensity: 0, grbShockwaveRadius: 0 };
      const curPos = mouseRef ? mouseRef.current : cursorPos || { x: -1000, y: -1000 };
      const curBh = celestialEntitiesRef
        ? celestialEntitiesRef.current.find((e) => !e.isDestroyed && e.type === "blackhole") || null
        : activeBlackhole || null;

      const projectedBh = curBh
        ? project3D(
            curBh.x,
            curBh.y,
            curBh.z || 0,
            curBh.radius * (curBh.scale ?? 1.0),
            curBh.worldX,
            curBh.worldY,
            curBh.worldZ
          )
        : null;

      // 1. RELATIVISTIC PROXIMITY HUD & EINSTEIN RING DEFLECTION RETICLE
      if (curBh && !curBh.isDestroyed && projectedBh && projectedBh.inFrustum) {
        const bhX = projectedBh.x;
        const bhY = projectedBh.y;
        const bhRadius = projectedBh.radius;
        const distToBh = Math.hypot(curPos.x - bhX, curPos.y - bhY);
        const influenceZone = bhRadius * 3.8;

        if (distToBh < influenceZone) {
          const proximity = Math.max(0, 1.0 - (distToBh - bhRadius) / (influenceZone - bhRadius));
          const rsRatio = Math.min(0.96, bhRadius / Math.max(bhRadius * 1.02, distToBh));
          const g00 = Math.sqrt(Math.max(0.04, 1.0 - rsRatio));
          const timeDilation = 1.0 / g00;
          const redshiftZ = timeDilation - 1.0;

          // Holographic Einstein Ring Bending Guides around Event Horizon
          ctx.save();
          ctx.strokeStyle = `rgba(242, 95, 53, ${0.18 + proximity * 0.35})`;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 6]);
          ctx.beginPath();
          ctx.arc(bhX, bhY, bhRadius * 1.55, 0, Math.PI * 2); // Photon sphere ring
          ctx.stroke();

          ctx.strokeStyle = `rgba(77, 238, 234, ${0.15 + proximity * 0.25})`;
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.arc(bhX, bhY, bhRadius * 2.85, 0, Math.PI * 2); // Roche limit boundary
          ctx.stroke();

          // Luminous Einstein Ring Light-Bending Arcs (Gravitational deflection of star rays)
          const ringRadius = bhRadius * 1.55;
          const numArcs = 8;
          ctx.setLineDash([]);
          for (let a = 0; a < numArcs; a++) {
            const arcAngle = now * 0.00035 + (a * Math.PI * 2) / numArcs;
            const arcSpan = 0.32 + proximity * 0.45;
            const arcAlpha = (0.28 + proximity * 0.58) * (0.65 + 0.35 * Math.sin(now * 0.003 + a));
            
            // Primary bent star ray arc
            ctx.strokeStyle = `rgba(255, 235, 170, ${arcAlpha})`;
            ctx.lineWidth = 1.8 + proximity * 2.2;
            ctx.beginPath();
            ctx.arc(bhX, bhY, ringRadius + Math.sin(a * 1.5) * 2.0, arcAngle, arcAngle + arcSpan);
            ctx.stroke();

            // Chromatic dispersion fringe on outer deflection
            ctx.strokeStyle = `rgba(77, 238, 234, ${arcAlpha * 0.65})`;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(bhX, bhY, ringRadius + 3.2, arcAngle - 0.04, arcAngle + arcSpan + 0.04);
            ctx.stroke();
          }

          // Subtle shimmering Hawking Radiation quantum photons emanating from the horizon
          const isCinematic = (window as any).__cinematicMode === true;
          const hawkingIntensity = Math.min(1.0, proximity * 0.75 + (isCinematic ? 0.65 : 0.0));
          const numHawkingRays = Math.round(16 + hawkingIntensity * 28);
          for (let h = 0; h < numHawkingRays; h++) {
            const hAngle = (h * Math.PI * 2) / numHawkingRays + Math.sin(now * 0.002 + h * 1.7) * 0.15;
            const hDistInner = bhRadius * (0.98 + Math.sin(now * 0.005 + h * 3.1) * 0.06);
            const hDistOuter = hDistInner + 12 + hawkingIntensity * 38 + Math.sin(now * 0.008 + h * 2.4) * 8;
            const hAlpha = (0.2 + hawkingIntensity * 0.7) * (0.5 + 0.5 * Math.sin(now * 0.012 + h * 2.7));
            const x1 = bhX + Math.cos(hAngle) * hDistInner;
            const y1 = bhY + Math.sin(hAngle) * hDistInner;
            const x2 = bhX + Math.cos(hAngle) * hDistOuter;
            const y2 = bhY + Math.sin(hAngle) * hDistOuter;

            ctx.strokeStyle = h % 3 === 0
              ? `rgba(103, 232, 249, ${hAlpha})` // Cherenkov cyan
              : h % 3 === 1
              ? `rgba(192, 132, 252, ${hAlpha * 0.9})` // Quantum violet
              : `rgba(255, 255, 255, ${hAlpha * 0.95})`; // Virtual photon white
            ctx.lineWidth = 0.8 + hawkingIntensity * 1.4;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
          }

          // Reticle over cursor
          ctx.strokeStyle = `rgba(255, 215, 120, ${0.45 + proximity * 0.5})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(curPos.x, curPos.y, 18, 0, Math.PI * 2);
          ctx.stroke();

          // Small crosshair ticks
          const tickLen = 6;
          ctx.beginPath();
          ctx.moveTo(curPos.x - 24, curPos.y);
          ctx.lineTo(curPos.x - 24 + tickLen, curPos.y);
          ctx.moveTo(curPos.x + 24, curPos.y);
          ctx.lineTo(curPos.x + 24 - tickLen, curPos.y);
          ctx.moveTo(curPos.x, curPos.y - 24);
          ctx.lineTo(curPos.x, curPos.y - 24 + tickLen);
          ctx.moveTo(curPos.x, curPos.y + 24);
          ctx.lineTo(curPos.x, curPos.y + 24 - tickLen);
          ctx.stroke();

          // Relativistic Telemetry Readout attached to cursor
          const hudX = curPos.x + 28;
          const hudY = curPos.y - 22;
          ctx.font = "9px 'JetBrains Mono', monospace";
          ctx.fillStyle = "rgba(0, 0, 0, 0.76)";
          ctx.fillRect(hudX - 6, hudY - 10, 182, 62);
          ctx.strokeStyle = "rgba(255, 215, 120, 0.4)";
          ctx.strokeRect(hudX - 6, hudY - 10, 182, 62);

          ctx.fillStyle = "#ffd778";
          ctx.fillText(`SCHWARZSCHILD: ${Math.round(proximity * 100)}% PROXIMITY`, hudX, hudY + 2);
          ctx.fillStyle = "#4deeea";
          ctx.fillText(`TIME DILATION (Δτ): ${timeDilation.toFixed(2)}x SLOW`, hudX, hudY + 14);
          ctx.fillStyle = "#f25f35";
          ctx.fillText(`GRAVITATIONAL REDSHIFT: z=${redshiftZ.toFixed(2)}`, hudX, hudY + 26);
          ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
          ctx.fillText(`EINSTEIN RING DEFLECTION ACTIVE`, hudX, hudY + 37);
          ctx.fillStyle = "#a78bfa";
          ctx.fillText(`HAWKING RADIATION: ${Math.round(hawkingIntensity * 100)}% (SHIMMERING)`, hudX, hudY + 48);
          ctx.restore();
        }
      }

      // 2. TIDAL DISRUPTION EVENT (TDE) ASTROPHYSICS HUD (3D WebGL PARTICLES RENDER THE SPRAY & SHREDDING SHADER)
      if (curTde.isActive) {
        // Roche Tidal Limit Boundary Display around Black Hole
        if (
          curBh &&
          projectedBh &&
          projectedBh.inFrustum &&
          (curTde.stage === "STAR_APPROACH" || curTde.stage === "ROCHE_RUPTURE")
        ) {
          ctx.save();
          const rocheR = projectedBh.radius * 2.8;
          ctx.strokeStyle = "rgba(255, 215, 120, 0.28)";
          ctx.lineWidth = 1.0;
          ctx.setLineDash([4, 6]);
          ctx.beginPath();
          ctx.arc(projectedBh.x, projectedBh.y, rocheR, 0, Math.PI * 2);
          ctx.stroke();

          ctx.font = "8px 'JetBrains Mono', monospace";
          ctx.fillStyle = "rgba(255, 215, 120, 0.65)";
          ctx.fillText("ROCHE TIDAL LIMIT r_t", projectedBh.x + rocheR + 6, projectedBh.y + 3);
          ctx.restore();
        }

        // Star Trajectory Telemetry Bracket (Non-geometric corner brackets with mass shredding telemetry)
        if (curTde.stage === "STAR_APPROACH" || curTde.stage === "ROCHE_RUPTURE") {
          const projStar = project3D(
            curTde.starX,
            curTde.starY,
            curTde.starZ || 0,
            curTde.starRadius
          );
          if (projStar.inFrustum) {
            ctx.save();
            const sx = projStar.x;
            const sy = projStar.y;
            const bracketR = Math.max(16, projStar.radius * 1.5);
            const cornerLen = 6;

            ctx.strokeStyle = "rgba(255, 215, 120, 0.45)";
            ctx.lineWidth = 1.0;
            // Top-left
            ctx.beginPath();
            ctx.moveTo(sx - bracketR, sy - bracketR + cornerLen);
            ctx.lineTo(sx - bracketR, sy - bracketR);
            ctx.lineTo(sx - bracketR + cornerLen, sy - bracketR);
            // Top-right
            ctx.moveTo(sx + bracketR - cornerLen, sy - bracketR);
            ctx.lineTo(sx + bracketR, sy - bracketR);
            ctx.lineTo(sx + bracketR, sy - bracketR + cornerLen);
            // Bottom-left
            ctx.moveTo(sx - bracketR, sy + bracketR - cornerLen);
            ctx.lineTo(sx - bracketR, sy + bracketR);
            ctx.lineTo(sx - bracketR + cornerLen, sy + bracketR);
            // Bottom-right
            ctx.moveTo(sx + bracketR - cornerLen, sy + bracketR);
            ctx.lineTo(sx + bracketR, sy + bracketR);
            ctx.lineTo(sx + bracketR, sy + bracketR - cornerLen);
            ctx.stroke();

            ctx.font = "8px 'JetBrains Mono', monospace";
            ctx.fillStyle = "rgba(255, 215, 120, 0.85)";
            const massPct = Math.max(0, Math.round((curTde.starMass ?? 1.0) * 100));
            ctx.fillText(`ROGUE STELLAR CORE [MASS: ${massPct}%]`, sx + bracketR + 8, sy - bracketR + 6);

            if (curTde.stage === "ROCHE_RUPTURE") {
              ctx.fillStyle = "rgba(242, 95, 53, 0.95)";
              const shredPct = Math.min(100, Math.round((curTde.shredDissipation ?? 0) * 100));
              ctx.fillText(`HYDRODYNAMIC SHREDDING: ${shredPct}% DISSIPATED`, sx + bracketR + 8, sy - bracketR + 17);
            }
            ctx.restore();
          }
        }
      }

      // 3. SLINGSHOT AIMING TRAJECTORY & RETICLE
      if (curAim.isAiming) {
        ctx.save();
        const ox = curAim.originX;
        const oy = curAim.originY;
        const cx = curAim.currentX;
        const cy = curAim.currentY;

        // Pull vector arrow / rubberband
        ctx.strokeStyle = "rgba(77, 238, 234, 0.65)";
        ctx.lineWidth = 1.8;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(cx, cy);
        ctx.stroke();

        // Origin Launch Reticle
        ctx.setLineDash([]);
        ctx.strokeStyle = "#4deeea";
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(ox, oy, 12, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(ox, oy, 4, 0, Math.PI * 2);
        ctx.fill();

        // Pull handle
        ctx.strokeStyle = "rgba(255, 215, 120, 0.9)";
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.stroke();

        // Forward Predicted Keplerian Trajectory Path
        const pts = curAim.trajectoryPoints || [];
        if (pts.length > 1) {
          const projPts = pts.map((pt) => ({
            ...pt,
            ...project3D(pt.x, pt.y, 0),
          }));
          ctx.beginPath();
          ctx.moveTo(projPts[0]!.x, projPts[0]!.y);
          for (let i = 1; i < projPts.length; i++) {
            ctx.lineTo(projPts[i]!.x, projPts[i]!.y);
          }
          ctx.strokeStyle = "rgba(77, 238, 234, 0.45)";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 5]);
          ctx.stroke();

          // Dotted trajectory nodes with speed and horizon warning
          ctx.setLineDash([]);
          for (let i = 0; i < projPts.length; i += 3) {
            const pt = projPts[i]!;
            if (!pt.inFrustum) continue;
            const isBound = pt.isHorizonBound;
            ctx.fillStyle = isBound ? "#ff3344" : (pt.speed > 25 ? "#ffd778" : "#4deeea");
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, isBound ? 4.5 : (pt.speed > 25 ? 3.5 : 2.5), 0, Math.PI * 2);
            ctx.fill();
          }

          const hasHorizonCapture = projPts.some((p) => p.isHorizonBound);
          if (hasHorizonCapture) {
            const lastPt = projPts[projPts.length - 1]!;
            ctx.font = "bold 9px 'JetBrains Mono', monospace";
            ctx.fillStyle = "#ff4444";
            ctx.fillText("⚠ EVENT HORIZON PLUNGE", lastPt.x + 12, lastPt.y);
          }
        }
        ctx.restore();
      }

      // 4. ACTIVE PROBES & IONIZATION COMET TAILS
      if (curProbes && curProbes.length > 0) {
        ctx.save();
        for (let p = 0; p < curProbes.length; p++) {
          const probe = curProbes[p];
          if (!probe || probe.isSwallowed) continue;

          const projProbe = project3D(probe.x, probe.y, probe.z || 0);
          if (!projProbe.inFrustum) continue;

          // Ionization Trail
          if (probe.trail && probe.trail.length > 1) {
            const projTrail = probe.trail.map((tp) => project3D(tp.x, tp.y, tp.z || 0));
            ctx.beginPath();
            ctx.moveTo(projTrail[0]!.x, projTrail[0]!.y);
            for (let t = 1; t < projTrail.length; t++) {
              ctx.lineTo(projTrail[t]!.x, projTrail[t]!.y);
            }
            const lastTrail = projTrail[projTrail.length - 1]!;
            const trailGrad = ctx.createLinearGradient(
              projProbe.x,
              projProbe.y,
              lastTrail.x,
              lastTrail.y
            );
            trailGrad.addColorStop(0, "rgba(77, 238, 234, 0.85)");
            trailGrad.addColorStop(0.4, "rgba(0, 255, 210, 0.5)");
            trailGrad.addColorStop(1, "rgba(0, 255, 210, 0)");

            ctx.strokeStyle = trailGrad;
            ctx.lineWidth = 2.4;
            ctx.stroke();
          }

          // Probe Radiant Core
          const speed = Math.hypot(probe.vx, probe.vy);
          ctx.fillStyle = speed > 28 ? "#ffd778" : "#ffffff";
          ctx.beginPath();
          ctx.arc(projProbe.x, projProbe.y, 3.8, 0, Math.PI * 2);
          ctx.fill();

          // Outer halo pulse
          ctx.strokeStyle = "rgba(77, 238, 234, 0.65)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(projProbe.x, projProbe.y, 7.5 + Math.sin(now * 0.01 + p) * 1.5, 0, Math.PI * 2);
          ctx.stroke();

          // Velocity readout tag
          if (speed > 16) {
            ctx.font = "8px 'JetBrains Mono', monospace";
            ctx.fillStyle = "#ffd778";
            ctx.fillText(`${(speed * 0.03).toFixed(2)}c`, projProbe.x + 9, projProbe.y - 6);
          }
        }
        ctx.restore();
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-20"
      style={{ width: "100%", height: "100%" }}
    />
  );
};
