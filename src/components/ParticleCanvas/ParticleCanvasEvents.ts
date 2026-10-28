import React from "react";
import * as BABYLON from "@babylonjs/core";
import { CelestialEntity } from "./types";
import { calculateForwardTrajectory, SlingshotAimState, SlingshotProbe } from "./SlingshotEngine";
import { TdeState, triggerTidalDisruptionEvent } from "./TidalDisruptionEngine";

export interface EventManagerContext {
  rendererRef: React.MutableRefObject<BABYLON.Engine | null>;
  hudPlaneRef: React.MutableRefObject<BABYLON.Mesh | null>;
  cameraRef: React.MutableRefObject<BABYLON.TargetCamera | null>;
  fovRef: React.MutableRefObject<number>;
  mouseRef: React.MutableRefObject<{ x: number; y: number; lastMoved: number }>;
  stageRef: React.MutableRefObject<number>;
  mapParticlesToStage: (stage: number, burst: boolean) => void;
  mapParticlesToInterstellar?: (ww: number, wh: number) => void;
  updateHudTexture: (stage: number) => void;
  lastUserActivityRef: React.MutableRefObject<number>;
  isScreensaverActiveRef: React.MutableRefObject<boolean>;
  screensaverOpacityRef?: React.MutableRefObject<number>;
  inputControllerRef: React.MutableRefObject<any>;
  ripplesRef: React.MutableRefObject<{ x: number; y: number; life: number }[]>;
  celestialEntitiesRef: React.MutableRefObject<CelestialEntity[]>;
  isInterstellarRef: React.MutableRefObject<boolean>;
  supernovaRef: React.MutableRefObject<any>;
  cameraShakeRef: React.MutableRefObject<number>;
  audio: any;
  fetchNextGeminiScene: () => void;
  lastScrollYRef: React.MutableRefObject<number>;
  scrollVelocityRef: React.MutableRefObject<number>;
  isTransitActiveRef: React.MutableRefObject<boolean>;
  sceneRef: React.MutableRefObject<BABYLON.Scene | null>;
  startWormholeTransit: (targetPos?: BABYLON.Vector3, viewDir?: BABYLON.Vector3) => Promise<void>;
  lensingPostProcessRef: React.MutableRefObject<BABYLON.PostProcess | null>;
  wormholePostProcessRef: React.MutableRefObject<BABYLON.PostProcess | null>;
  activeSupernovaFxRef: React.MutableRefObject<any>;
  triggerSupernovaTransition?: (x?: number, y?: number) => void;
  slingshotAimRef?: React.MutableRefObject<SlingshotAimState>;
  probesRef?: React.MutableRefObject<SlingshotProbe[]>;
  tdeStateRef?: React.MutableRefObject<TdeState>;
  triggerTdeFn?: () => void;
  isSlingshotModeRef?: React.MutableRefObject<boolean>;
  targetZoomToHorizonRef?: React.MutableRefObject<number>;
  zoomToHorizonRef?: React.MutableRefObject<number>;
  shatterIntensityRef?: React.MutableRefObject<number>;
}

export function isUIElement(target: HTMLElement | null): boolean {
  if (!target) return false;
  if (target.tagName === "CANVAS" || target.id === "canvas-babylon") {
    return false;
  }
  if ((target as any).isContentEditable) {
    return true;
  }
  if (
    target.closest &&
    (target.closest(".pointer-events-auto") ||
      target.closest("button") ||
      target.closest("input") ||
      target.closest("select") ||
      target.closest("textarea") ||
      target.closest("a") ||
      target.closest("[role='dialog']"))
  ) {
    return true;
  }
  return target.tagName !== "CANVAS" && target.id !== "canvas-babylon";
}

export function setupParticleCanvasEvents(ctx: EventManagerContext) {
  if (typeof window === "undefined") {
    return () => {};
  }

  let isCleanedUp = false;
  let resizeTimeout: ReturnType<typeof setTimeout>;
  let lastWidth = window.innerWidth;
  let lastHeight = window.innerHeight;

  const handleResize = () => {
    const ww = window.innerWidth;
    const wh = window.innerHeight;

    if (ctx.rendererRef.current) {
      ctx.rendererRef.current.resize();
    }

    if (ctx.hudPlaneRef.current && ctx.cameraRef.current) {
      const planeZ = -60;
      const cameraZ = Math.max(10.0, wh / (2 * Math.tan((ctx.fovRef.current * Math.PI) / 360))) * 2.5;
      const scaleFactor = (cameraZ + planeZ) / cameraZ;
      ctx.hudPlaneRef.current.scaling.set(scaleFactor, scaleFactor, 1);

      const parallaxIntensity = 0.03;
      const offsetX = (ctx.mouseRef.current.x - ww / 2) * parallaxIntensity;
      const offsetY = -(ctx.mouseRef.current.y - wh / 2) * parallaxIntensity;
      ctx.hudPlaneRef.current.position.set(offsetX, offsetY, 0);
    }

    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (ww !== lastWidth || Math.abs(wh - lastHeight) > 120) {
        lastWidth = ww;
        lastHeight = wh;
        if (ctx.isInterstellarRef.current) {
          if (ctx.mapParticlesToInterstellar) ctx.mapParticlesToInterstellar(ww, wh);
        } else {
          ctx.mapParticlesToStage(ctx.stageRef.current, false);
        }
        ctx.updateHudTexture(ctx.stageRef.current);
      }
    }, 200);
  };

  const resetActivity = () => {
    if (ctx.lastUserActivityRef) {
      ctx.lastUserActivityRef.current = Date.now();
    }
    if (ctx.isScreensaverActiveRef) {
      ctx.isScreensaverActiveRef.current = false;
    }
    if (ctx.screensaverOpacityRef) {
      ctx.screensaverOpacityRef.current = 0.0;
    }
  };

  let isDragging = false;
  let draggedEntity: CelestialEntity | null = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let dragDistance = 0;
  let aimDistance = 0;
  let lastHoverToneTime = 0;

  const getEntityScreenPos = (entity: CelestialEntity): { x: number; y: number; radius: number; inFrustum: boolean } => {
    const ww = window.innerWidth;
    const wh = window.innerHeight;
    const baseRad = entity.radius * (entity.scale ?? 1.0);
    const scene = ctx.sceneRef.current;
    const camera = ctx.cameraRef.current;
    if (!scene || scene.isDisposed || !camera || !ctx.rendererRef.current) {
      return { x: entity.x, y: entity.y, radius: baseRad, inFrustum: true };
    }
    const wx = entity.worldX !== undefined ? entity.worldX : entity.x - ww / 2;
    const wy = entity.worldY !== undefined ? entity.worldY : -(entity.y - wh / 2);
    const wz = entity.worldZ !== undefined ? entity.worldZ : (entity.z || 0);
    const transformMatrix = scene.getTransformMatrix();
    const globalViewport = camera.viewport.toGlobal(ww, wh);

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
      return { x: entity.x, y: entity.y, radius: baseRad, inFrustum: false };
    }

    const projEdgeX = BABYLON.Vector3.Project(
      new BABYLON.Vector3(wx + baseRad, wy, wz),
      BABYLON.Matrix.IdentityReadOnly,
      transformMatrix,
      globalViewport
    );
    const projEdgeY = BABYLON.Vector3.Project(
      new BABYLON.Vector3(wx, wy + baseRad, wz),
      BABYLON.Matrix.IdentityReadOnly,
      transformMatrix,
      globalViewport
    );
    const distX = Math.hypot(projEdgeX.x - projCenter.x, projEdgeX.y - projCenter.y);
    const distY = Math.hypot(projEdgeY.x - projCenter.x, projEdgeY.y - projCenter.y);
    const projRad = Math.max(isNaN(distX) ? baseRad : distX, isNaN(distY) ? baseRad : distY, 12);

    return {
      x: projCenter.x,
      y: projCenter.y,
      radius: projRad,
      inFrustum: true,
    };
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (isUIElement(e.target as HTMLElement)) return;
    const clickX = e.clientX;
    const clickY = e.clientY;

    let nearest: CelestialEntity | null = null;
    let minD = 180;
    ctx.celestialEntitiesRef.current.forEach((entity) => {
      if (entity.isDestroyed) return;
      const proj = getEntityScreenPos(entity);
      if (!proj.inFrustum) return;
      const d = Math.hypot(proj.x - clickX, proj.y - clickY);
      const grabRadius = Math.max(110, proj.radius * 2.5);
      if (d < grabRadius && d < minD) {
        minD = d;
        nearest = entity;
      }
    });

    if (nearest) {
      isDragging = true;
      draggedEntity = nearest;
      dragOffsetX = (nearest as CelestialEntity).x - clickX;
      dragOffsetY = (nearest as CelestialEntity).y - clickY;
      dragDistance = 0;
      document.body.style.cursor = "grabbing";
      if (ctx.audio?.pingInteraction) ctx.audio.pingInteraction();
    } else if (e.button === 0) {
      // Gravitational Slingshot: Click-and-drag from any point in space to aim trajectory
      if (ctx.slingshotAimRef) {
        ctx.slingshotAimRef.current.isAiming = true;
        ctx.slingshotAimRef.current.originX = clickX;
        ctx.slingshotAimRef.current.originY = clickY;
        ctx.slingshotAimRef.current.currentX = clickX;
        ctx.slingshotAimRef.current.currentY = clickY;
        ctx.slingshotAimRef.current.trajectoryPoints = calculateForwardTrajectory(
          clickX,
          clickY,
          clickX,
          clickY,
          ctx.celestialEntitiesRef.current
        );
        aimDistance = 0;
      }
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    ctx.mouseRef.current.x = e.clientX;
    ctx.mouseRef.current.y = e.clientY;
    ctx.mouseRef.current.lastMoved = Date.now();

    if (ctx.slingshotAimRef && ctx.slingshotAimRef.current.isAiming) {
      const aim = ctx.slingshotAimRef.current;
      aim.currentX = e.clientX;
      aim.currentY = e.clientY;
      aimDistance = Math.hypot(aim.originX - e.clientX, aim.originY - e.clientY);
      aim.trajectoryPoints = calculateForwardTrajectory(
        aim.originX,
        aim.originY,
        e.clientX,
        e.clientY,
        ctx.celestialEntitiesRef.current
      );
      resetActivity();
      return;
    }

    if (isDragging && draggedEntity) {
      const prevX = draggedEntity.x;
      const prevY = draggedEntity.y;
      draggedEntity.x = e.clientX + dragOffsetX;
      draggedEntity.y = e.clientY + dragOffsetY;
      draggedEntity.vx = (draggedEntity.x - prevX) * 0.25;
      draggedEntity.vy = (draggedEntity.y - prevY) * 0.25;
      dragDistance += Math.hypot(draggedEntity.x - prevX, draggedEntity.y - prevY);
      resetActivity();
      return;
    }

    // Hover detection over celestial bodies (e.g. black hole)
    let isHoveringCelestial = false;
    ctx.celestialEntitiesRef.current.forEach((entity) => {
      if (entity.isDestroyed) return;
      const proj = getEntityScreenPos(entity);
      if (!proj.inFrustum) return;
      const d = Math.hypot(proj.x - e.clientX, proj.y - e.clientY);
      if (d < Math.max(95, proj.radius * 2.4)) {
        isHoveringCelestial = true;
        const now = Date.now();
        if (now - lastHoverToneTime > 1500) {
          lastHoverToneTime = now;
          if (ctx.audio?.pingInteraction) ctx.audio.pingInteraction();
        }
      }
    });

    if (!isUIElement(e.target as HTMLElement)) {
      document.body.style.cursor = isHoveringCelestial ? "grab" : "default";
    }

    const currentW = window.innerWidth;
    const currentH = window.innerHeight;

    const normX = (e.clientX - currentW / 2) / (currentW / 2 || 1);
    const normY = -(e.clientY - currentH / 2) / (currentH / 2 || 1);

    const inputs = ctx.inputControllerRef.current;
    if (!inputs.gyroActive) {
      inputs.targetCameraParallaxX = normX * 85.0;
      inputs.targetCameraParallaxY = normY * 85.0;
      inputs.targetCameraPitch = normY * 0.22;
      inputs.targetCameraYaw = normX * 0.22;
    } else {
      inputs.targetCameraParallaxX = normX * 45.0;
      inputs.targetCameraParallaxY = normY * 45.0;
    }

    resetActivity();
  };

  const handleMouseUp = (_e: MouseEvent) => {
    if (ctx.slingshotAimRef && ctx.slingshotAimRef.current.isAiming) {
      const aim = ctx.slingshotAimRef.current;
      const dx = aim.originX - aim.currentX;
      const dy = aim.originY - aim.currentY;
      const pullDist = Math.hypot(dx, dy);

      if (pullDist > 14 && ctx.probesRef) {
        // Launch glowing probe or particle comet
        const launchSpeedMultiplier = 0.095;
        let vx = dx * launchSpeedMultiplier;
        let vy = dy * launchSpeedMultiplier;
        const maxLaunchSpeed = 38.0;
        const mag = Math.hypot(vx, vy);
        if (mag > maxLaunchSpeed) {
          vx = (vx / mag) * maxLaunchSpeed;
          vy = (vy / mag) * maxLaunchSpeed;
        }

        const colors = ["#4deeea", "#ffd778", "#ff5722", "#00ffcc", "#70d6ff", "#f25f35"];
        const probeColor = colors[Math.floor(Math.random() * colors.length)]!;

        ctx.probesRef.current.push({
          id: `probe-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          x: aim.originX,
          y: aim.originY,
          z: 0,
          vx,
          vy,
          vz: (Math.random() - 0.5) * 2.0,
          color: probeColor,
          trail: [{ x: aim.originX, y: aim.originY, z: 0, alpha: 1.0 }],
          life: 1.0,
          maxLife: 1.0,
          isSwallowed: false,
          maxSpeedReached: Math.hypot(vx, vy),
          lastWhipTime: 0,
        });

        if (ctx.audio?.playProbeLaunch) {
          ctx.audio.playProbeLaunch();
        }
        if (Array.isArray(ctx.ripplesRef?.current)) {
          ctx.ripplesRef.current.push({ x: aim.originX, y: aim.originY, life: 0.6 });
        }
      }

      aim.isAiming = false;
      aim.trajectoryPoints = [];
    }

    if (isDragging && draggedEntity) {
      document.body.style.cursor = "default";
      if (dragDistance > 20) {
        // Gravitational wave shockwave on slingshot release
        if (Array.isArray(ctx.ripplesRef?.current)) {
          ctx.ripplesRef.current.push({ x: draggedEntity.x, y: draggedEntity.y, life: 1.0 });
        }
        ctx.audio.playRippleShockwave();
        draggedEntity.vx = (draggedEntity.vx || 0) * 1.5;
        draggedEntity.vy = (draggedEntity.vy || 0) * 1.5;
      }
      isDragging = false;
      draggedEntity = null;
    }
  };

  const handleDeviceOrientation = (e: DeviceOrientationEvent) => {
    if (isCleanedUp) return;
    if (e.beta !== null && e.gamma !== null) {
      const inputs = ctx.inputControllerRef.current;
      inputs.gyroActive = true;

      const targetPitch = Math.max(-0.45, Math.min(0.45, (e.beta - 60) * 0.012));
      const targetYaw = Math.max(-0.45, Math.min(0.45, e.gamma * 0.012));

      inputs.targetCameraPitch = targetPitch;
      inputs.targetCameraYaw = targetYaw;
    }
  };

  const requestGyroPermission = () => {
    if (isCleanedUp) return;
    const DOC = window.DeviceOrientationEvent as any;
    if (DOC && typeof DOC.requestPermission === "function") {
      DOC.requestPermission()
        .then((permissionState: string) => {
          if (!isCleanedUp && permissionState === "granted") {
            window.addEventListener("deviceorientation", handleDeviceOrientation);
          }
        })
        .catch((err: any) => {
          console.warn("DeviceOrientation permission request failed:", err);
        });
    }
  };

  const handleClick = (e: MouseEvent) => {
    if (isUIElement(e.target as HTMLElement)) {
      return;
    }

    if (dragDistance > 15 || aimDistance > 14) {
      // Was a drag or slingshot launch, do not treat as click
      aimDistance = 0;
      return;
    }

    requestGyroPermission();

    const currentW = window.innerWidth;
    const currentH = window.innerHeight;
    const clickX = typeof e.clientX === "number" && !isNaN(e.clientX) ? e.clientX : currentW / 2;
    const clickY = typeof e.clientY === "number" && !isNaN(e.clientY) ? e.clientY : currentH / 2;

    if (Array.isArray(ctx.ripplesRef?.current)) {
      ctx.ripplesRef.current.push({ x: clickX, y: clickY, life: 1.0 });
    }

    let nearestEntity: CelestialEntity | null = null;
    let minDistance = 180;

    ctx.celestialEntitiesRef.current.forEach((entity) => {
      if (entity.isDestroyed || isNaN(entity.x) || isNaN(entity.y)) return;
      const proj = getEntityScreenPos(entity);
      if (!proj.inFrustum) return;
      const dist = Math.hypot(proj.x - clickX, proj.y - clickY);
      const hitThreshold = Math.max(minDistance, proj.radius * 2.2);
      if (dist < hitThreshold && dist < minDistance) {
        minDistance = dist;
        nearestEntity = entity;
      }
    });

    const inputs = ctx.inputControllerRef.current;
    if (nearestEntity) {
      const ent = nearestEntity as CelestialEntity;
      const wx = ent.worldX !== undefined ? ent.worldX : (isNaN(ent.x) ? 0 : ent.x - currentW / 2);
      const wy = ent.worldY !== undefined ? ent.worldY : (isNaN(ent.y) ? 0 : -(ent.y - currentH / 2));
      const wz = ent.worldZ !== undefined ? ent.worldZ : (isNaN(ent.z || 0) ? 0 : (ent.z || 0));

      inputs.targetLock = {
        x: wx,
        y: wy,
        z: wz,
        active: true,
        entityId: ent.id || "unknown"
      };

      if ((window as any).__onSelectedEntityChange) {
        (window as any).__onSelectedEntityChange(nearestEntity);
      }

      // Singularity pulse acoustic shockwave
      if (Array.isArray(ctx.ripplesRef?.current)) {
        ctx.ripplesRef.current.push({
          x: isNaN(ent.x) ? currentW / 2 : ent.x,
          y: isNaN(ent.y) ? currentH / 2 : ent.y,
          life: 1.0
        });
      }
      ctx.audio.playRippleShockwave();
    } else {
      inputs.targetLock = {
        x: 0,
        y: 0,
        z: 0,
        active: false,
        entityId: null
      };

      if ((window as any).__onSelectedEntityChange) {
        (window as any).__onSelectedEntityChange(null);
      }
      ctx.audio.playRippleShockwave();
    }

    resetActivity();
  };

  const handleDoubleClick = (e: MouseEvent) => {
    if (isUIElement(e.target as HTMLElement)) return;
    // On mobile devices, do not detonate the scene on accidental double-tap.
    if (window.innerWidth < 768) return;
    if (ctx.triggerSupernovaTransition) {
      ctx.triggerSupernovaTransition(e.clientX, e.clientY);
    }
  };

  let lastTouchStartTime = 0;

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches && e.touches[0]) {
      const target = e.target as HTMLElement | null;
      if (isUIElement(target)) {
        return;
      }
      lastTouchStartTime = performance.now();
      const touch = e.touches[0];
      const clickX = touch.clientX;
      const clickY = touch.clientY;

      let nearest: CelestialEntity | null = null;
      let minD = 180;
      ctx.celestialEntitiesRef.current.forEach((entity) => {
        if (entity.isDestroyed) return;
        const proj = getEntityScreenPos(entity);
        if (!proj.inFrustum) return;
        const d = Math.hypot(proj.x - clickX, proj.y - clickY);
        const grabRadius = Math.max(110, proj.radius * 2.5);
        if (d < grabRadius && d < minD) {
          minD = d;
          nearest = entity;
        }
      });

      if (nearest) {
        isDragging = true;
        draggedEntity = nearest;
        dragOffsetX = (nearest as CelestialEntity).x - clickX;
        dragOffsetY = (nearest as CelestialEntity).y - clickY;
        dragDistance = 0;
        if (ctx.audio?.pingInteraction) ctx.audio.pingInteraction();
      }
      // Note: Do NOT simulate a click here; the browser fires a standard click on touchend/tap
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (isDragging && draggedEntity && e.touches && e.touches[0]) {
      const touch = e.touches[0];
      const prevX = draggedEntity.x;
      const prevY = draggedEntity.y;
      draggedEntity.x = touch.clientX + dragOffsetX;
      draggedEntity.y = touch.clientY + dragOffsetY;
      draggedEntity.vx = (draggedEntity.x - prevX) * 0.25;
      draggedEntity.vy = (draggedEntity.y - prevY) * 0.25;
      dragDistance += Math.hypot(draggedEntity.x - prevX, draggedEntity.y - prevY);
      resetActivity();
    }
  };

  const handleTouchEnd = () => {
    if (isDragging && draggedEntity) {
      if (dragDistance > 20) {
        if (Array.isArray(ctx.ripplesRef?.current)) {
          ctx.ripplesRef.current.push({ x: draggedEntity.x, y: draggedEntity.y, life: 1.0 });
        }
        ctx.audio.playRippleShockwave();
        draggedEntity.vx = (draggedEntity.vx || 0) * 1.5;
        draggedEntity.vy = (draggedEntity.vy || 0) * 1.5;
      }
      isDragging = false;
      draggedEntity = null;
    }
  };

  const handleScrollPhysics = () => {
    const currentScrollY =
      window.scrollY || document.documentElement.scrollTop || 0;
    const delta = currentScrollY - ctx.lastScrollYRef.current;
    ctx.scrollVelocityRef.current += delta * 0.08;
    ctx.lastScrollYRef.current = currentScrollY;

    const maxScroll = Math.max(1, (document.documentElement.scrollHeight - window.innerHeight));
    const inputs = ctx.inputControllerRef.current;
    if (inputs) {
      inputs.targetScrollTimeline = Math.max(0, Math.min(1, currentScrollY / maxScroll));
      inputs.targetCameraZDepthOffset = (currentScrollY / maxScroll) * -600.0;
    }

    resetActivity();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
        (target as any).isContentEditable)
    ) {
      return;
    }

    resetActivity();

    if (e.key === "t" || e.key === "T") {
      // Hotkey: Launch rogue star into Roche limit for Tidal Disruption Event (TDE)
      if (ctx.triggerTdeFn) {
        ctx.triggerTdeFn();
      } else if (ctx.tdeStateRef) {
        triggerTidalDisruptionEvent(
          ctx.tdeStateRef.current,
          ctx.celestialEntitiesRef.current,
          window.innerWidth,
          window.innerHeight
        );
      }
    } else if (e.key === "p" || e.key === "P") {
      // Hotkey: Launch glowing probe comet towards mouse or black hole
      if (ctx.probesRef) {
        const MAX_ACTIVE_PROBES = 25;
        if (ctx.probesRef.current.length >= MAX_ACTIVE_PROBES) {
          ctx.probesRef.current = ctx.probesRef.current.slice(-MAX_ACTIVE_PROBES + 1);
        }
        const ww = window.innerWidth;
        const wh = window.innerHeight;
        const spawnX = ctx.mouseRef.current.x > 0 ? ctx.mouseRef.current.x : ww * 0.25;
        const spawnY = ctx.mouseRef.current.y > 0 ? ctx.mouseRef.current.y : wh * 0.25;
        const bh = ctx.celestialEntitiesRef.current.find((ent) => !ent.isDestroyed && ent.type === "blackhole");
        const targetX = bh ? bh.x : ww / 2;
        const targetY = bh ? bh.y : wh / 2;
        const dx = targetX - spawnX;
        const dy = targetY - spawnY;
        const dist = Math.hypot(dx, dy) || 1;
        const speed = 20.0;

        ctx.probesRef.current.push({
          id: `probe-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          x: spawnX,
          y: spawnY,
          z: 0,
          vx: (dx / dist) * speed + (-dy / dist) * 7.0, // High-speed slingshot injection
          vy: (dy / dist) * speed + (dx / dist) * 7.0,
          vz: (Math.random() - 0.5) * 2.0,
          color: "#4deeea",
          trail: [{ x: spawnX, y: spawnY, z: 0, alpha: 1.0 }],
          life: 1.0,
          maxLife: 1.0,
          isSwallowed: false,
          maxSpeedReached: speed,
          lastWhipTime: 0,
        });

        if (ctx.audio?.playProbeLaunch) {
          ctx.audio.playProbeLaunch();
        }
        if (Array.isArray(ctx.ripplesRef?.current)) {
          if (ctx.ripplesRef.current.length >= 25) {
            ctx.ripplesRef.current.shift();
          }
          ctx.ripplesRef.current.push({ x: spawnX, y: spawnY, life: 0.6 });
        }
      }
    } else if (e.key === "w" || e.key === "W") {
      // Hotkey: Engage Einstein-Rosen Wormhole Transit to a new cosmic system
      if (ctx.startWormholeTransit) {
        ctx.startWormholeTransit();
      }
    } else if (e.key === "n" || e.key === "N") {
      // Hotkey: Trigger Supernova Core Collapse & Rebirth
      if (ctx.triggerSupernovaTransition) {
        ctx.triggerSupernovaTransition(window.innerWidth / 2, window.innerHeight / 2);
      }
    }
  };

  const handleWheel = (e: WheelEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && isUIElement(target)) return;

    const currentScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const isCinematic = (window as any).__cinematicMode === true;
    const isSandboxOrCinematic = ctx.isInterstellarRef.current || isCinematic || e.ctrlKey || e.metaKey || e.altKey;

    // When scrolling normally through portfolio stages (scrollY > 4), never hijack wheel scroll!
    if (!isSandboxOrCinematic && currentScrollY > 4) {
      if (ctx.targetZoomToHorizonRef) {
        ctx.targetZoomToHorizonRef.current = 0.0;
      }
      (window as any).__targetHorizonZoom = 0.0;
      return;
    }

    // Detect if black hole exists in celestial entities
    const bh = ctx.celestialEntitiesRef.current.find(
      (ent) => !ent.isDestroyed && ent.type === "blackhole"
    );

    if (bh) {
      // On Stage 0 top (scrollY <= 4) without sandbox mode, only zoom if scrolling UP into the black hole or unwinding existing zoom
      const currentTarget =
        ctx.targetZoomToHorizonRef?.current ?? (window as any).__targetHorizonZoom ?? 0.0;
      if (!isSandboxOrCinematic && e.deltaY > 0 && currentTarget <= 0.01) {
        // User is scrolling down from Stage 0 to Stage 1 — allow native page scroll
        return;
      }

      const zoomStep = -e.deltaY * 0.0016;
      const nextZoom = Math.max(0.0, Math.min(1.05, currentTarget + zoomStep));

      if (ctx.targetZoomToHorizonRef) {
        ctx.targetZoomToHorizonRef.current = nextZoom;
      }
      (window as any).__targetHorizonZoom = nextZoom;

      // If user is actively zooming into the black hole, prevent default page jumping
      if (nextZoom > 0.02 || currentTarget > 0.02) {
        e.preventDefault();
      }
      resetActivity();
    }
  };

  window.addEventListener("resize", handleResize);
  window.addEventListener("mousedown", handleMouseDown);
  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mouseup", handleMouseUp);
  window.addEventListener("click", handleClick);
  window.addEventListener("dblclick", handleDoubleClick);
  window.addEventListener("wheel", handleWheel, { passive: false });
  window.addEventListener("touchstart", handleTouchStart, { passive: true });
  window.addEventListener("touchmove", handleTouchMove, { passive: true });
  window.addEventListener("touchend", handleTouchEnd, { passive: true });
  window.addEventListener("scroll", handleScrollPhysics, { passive: true });
  window.addEventListener("keydown", handleKeyDown);

  const DOC = window.DeviceOrientationEvent as any;
  if (!DOC || typeof DOC.requestPermission !== "function") {
    window.addEventListener("deviceorientation", handleDeviceOrientation);
  }

  let pointerObserver: BABYLON.Observer<BABYLON.PointerInfo> | null = null;

  if (ctx.sceneRef.current) {
    pointerObserver = ctx.sceneRef.current.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
        const evt = pointerInfo.event as MouseEvent | PointerEvent | TouchEvent;
        const target = evt?.target as HTMLElement | null;
        if (target && isUIElement(target)) {
          return;
        }
        const pickResult = pointerInfo.pickInfo;
        if (pickResult && pickResult.hit && pickResult.pickedMesh) {
          const meshName = pickResult.pickedMesh.name || "";
          if (meshName && meshName !== "hudPlane") {
            let matchedEntity: CelestialEntity | undefined;
            let cursorNode: BABYLON.Node | null = pickResult.pickedMesh;
            while (cursorNode) {
              if (cursorNode.metadata?.entityRef && !cursorNode.metadata.entityRef.isDestroyed) {
                matchedEntity = cursorNode.metadata.entityRef;
                break;
              }
              cursorNode = cursorNode.parent;
            }

            if (!matchedEntity) {
              const parentNode = pickResult.pickedMesh.parent;
              let targetType: string | null = null;
              if (parentNode && typeof parentNode.name === "string") {
                if (parentNode.name === "bh_group") targetType = "blackhole";
                else if (parentNode.name === "planet_group") targetType = "planet";
                else if (parentNode.name === "star_group") targetType = "star";
                else if (parentNode.name === "nebula_group") targetType = "nebula";
                else if (parentNode.name === "galaxy_group") targetType = "galaxy";
              }
              if (!targetType) {
                if (meshName.startsWith("event_horizon_") || meshName.startsWith("bh_")) targetType = "blackhole";
                else if (meshName.startsWith("planet_") || meshName === "ring_mesh" || meshName === "atmosphere_glow") targetType = "planet";
                else if (meshName.startsWith("star_")) targetType = "star";
                else if (meshName.startsWith("nebula_")) targetType = "nebula";
                else if (meshName.startsWith("gal_")) targetType = "galaxy";
              }
              if (targetType) {
                matchedEntity = ctx.celestialEntitiesRef.current.find(
                  (e) => !e.isDestroyed && e.type === targetType
                );
              }
            }

            if (matchedEntity) {
              const inputs = ctx.inputControllerRef.current;
              const curW = window.innerWidth;
              const curH = window.innerHeight;
              const wx = matchedEntity.worldX !== undefined ? matchedEntity.worldX : (isNaN(matchedEntity.x) ? 0 : matchedEntity.x - curW / 2);
              const wy = matchedEntity.worldY !== undefined ? matchedEntity.worldY : (isNaN(matchedEntity.y) ? 0 : -(matchedEntity.y - curH / 2));
              const wz = matchedEntity.worldZ !== undefined ? matchedEntity.worldZ : (isNaN(matchedEntity.z || 0) ? 0 : (matchedEntity.z || 0));
              inputs.targetLock = {
                x: wx,
                y: wy,
                z: wz,
                active: true,
                entityId: matchedEntity.id || "unknown",
              };
              if ((window as any).__onSelectedEntityChange) {
                (window as any).__onSelectedEntityChange(matchedEntity);
              }
              if (Array.isArray(ctx.ripplesRef?.current)) {
                ctx.ripplesRef.current.push({
                  x: isNaN(matchedEntity.x) ? curW / 2 : matchedEntity.x,
                  y: isNaN(matchedEntity.y) ? curH / 2 : matchedEntity.y,
                  life: 1.0,
                });
              }
              ctx.audio.playRippleShockwave();
            }
          }
        }
      }
    });
  }

  const cleanup = () => {
    isCleanedUp = true;
    clearTimeout(resizeTimeout);
    window.removeEventListener("resize", handleResize);
    window.removeEventListener("mousedown", handleMouseDown);
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
    window.removeEventListener("click", handleClick);
    window.removeEventListener("dblclick", handleDoubleClick);
    window.removeEventListener("wheel", handleWheel);
    window.removeEventListener("touchstart", handleTouchStart);
    window.removeEventListener("touchmove", handleTouchMove);
    window.removeEventListener("touchend", handleTouchEnd);
    window.removeEventListener("scroll", handleScrollPhysics);
    window.removeEventListener("deviceorientation", handleDeviceOrientation);
    window.removeEventListener("keydown", handleKeyDown);
    delete (window as any).activateSequence;

    if (pointerObserver && ctx.sceneRef.current) {
      ctx.sceneRef.current.onPointerObservable.remove(pointerObserver);
      pointerObserver = null;
    }

    if (ctx.activeSupernovaFxRef.current) {
      ctx.activeSupernovaFxRef.current.dispose();
      ctx.activeSupernovaFxRef.current = null;
    }
  };

  return cleanup;
}
