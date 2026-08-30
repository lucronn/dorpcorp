import React from "react";
import * as BABYLON from "@babylonjs/core";
import { CelestialEntity } from "./types";

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
  startWormholeTransit: (targetPos?: BABYLON.Vector3, viewDir?: BABYLON.Vector3, bhRadius?: number) => Promise<void>;
  lensingPostProcessRef?: React.MutableRefObject<BABYLON.PostProcess | null>;
  wormholePostProcessRef?: React.MutableRefObject<BABYLON.PostProcess | null>;
  activeSupernovaFxRef: React.MutableRefObject<any>;
  triggerSupernovaTransition?: (x?: number, y?: number) => void;
}

export function isUIElement(target: HTMLElement | null): boolean {
  if (!target) return false;
  if (target.tagName === "CANVAS" || target.id === "canvas-babylon") {
    return false;
  }
  if (
    target.closest &&
    (target.closest(".pointer-events-auto") ||
      target.closest("button") ||
      target.closest("input") ||
      target.closest("a") ||
      target.closest("[role='dialog']"))
  ) {
    return true;
  }
  return target.tagName !== "CANVAS" && target.id !== "canvas-babylon";
}

export function setupParticleCanvasEvents(ctx: EventManagerContext) {
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
    ctx.lastUserActivityRef.current = Date.now();
    if (ctx.isScreensaverActiveRef.current) {
      ctx.isScreensaverActiveRef.current = false;
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    ctx.mouseRef.current.x = e.clientX;
    ctx.mouseRef.current.y = e.clientY;
    ctx.mouseRef.current.lastMoved = Date.now();

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

  const handleDeviceOrientation = (e: DeviceOrientationEvent) => {
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
    const DOC = window.DeviceOrientationEvent as any;
    if (DOC && typeof DOC.requestPermission === "function") {
      DOC.requestPermission()
        .then((permissionState: string) => {
          if (permissionState === "granted") {
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

    requestGyroPermission();

    ctx.ripplesRef.current.push({ x: e.clientX, y: e.clientY, life: 1.0 });

    const currentW = window.innerWidth;
    const currentH = window.innerHeight;
    const clickX = e.clientX;
    const clickY = e.clientY;

    let nearestEntity: CelestialEntity | null = null;
    let minDistance = 160;

    ctx.celestialEntitiesRef.current.forEach((entity) => {
      if (entity.isDestroyed) return;
      const dist = Math.sqrt((entity.x - clickX) * (entity.x - clickX) + (entity.y - clickY) * (entity.y - clickY));
      if (dist < minDistance) {
        minDistance = dist;
        nearestEntity = entity;
      }
    });

    const inputs = ctx.inputControllerRef.current;
    if (nearestEntity) {
      const wx = (nearestEntity as CelestialEntity).x - currentW / 2;
      const wy = -((nearestEntity as CelestialEntity).y - currentH / 2);
      const wz = (nearestEntity as CelestialEntity).z || 0;

      inputs.targetLock = {
        x: wx,
        y: wy,
        z: wz,
        active: true,
        entityId: (nearestEntity as CelestialEntity).id || "unknown"
      };
    } else {
      inputs.targetLock = {
        x: 0,
        y: 0,
        z: 0,
        active: false,
        entityId: null
      };
    }

    if (ctx.triggerSupernovaTransition) {
      ctx.triggerSupernovaTransition(e.clientX, e.clientY);
    } else if (!ctx.supernovaRef.current) {
      ctx.isInterstellarRef.current = true;
      ctx.celestialEntitiesRef.current.forEach((entity) => {
        entity.isDestroyed = true;
      });

      ctx.cameraShakeRef.current = 12.0;

      ctx.supernovaRef.current = {
        time: Date.now(),
        exploded: true,
        isCalmShift: true,
        x: e.clientX,
        y: e.clientY,
      };
      console.log("[DEBUG] Click triggered supernova at x:", ctx.supernovaRef.current.x, "y:", ctx.supernovaRef.current.y);
      ctx.audio.playSupernova();
      ctx.audio.playRippleShockwave();
      ctx.fetchNextGeminiScene();
    }
    resetActivity();
  };

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches && e.touches[0]) {
      const target = e.target as HTMLElement | null;
      if (isUIElement(target)) {
        return;
      }
      const touch = e.touches[0];
      const simulatedClick = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        target: target,
      } as unknown as MouseEvent;
      handleClick(simulatedClick);
    }
  };

  const handleScrollPhysics = () => {
    const currentScrollY =
      window.scrollY || document.documentElement.scrollTop;
    const delta = currentScrollY - ctx.lastScrollYRef.current;
    ctx.scrollVelocityRef.current += delta * 0.08;
    ctx.lastScrollYRef.current = currentScrollY;

    const maxScroll = (document.documentElement.scrollHeight - window.innerHeight) || 1200;
    const inputs = ctx.inputControllerRef.current;
    inputs.targetScrollTimeline = currentScrollY / maxScroll;
    inputs.targetCameraZDepthOffset = (currentScrollY / maxScroll) * -600.0;

    resetActivity();
  };

  window.addEventListener("resize", handleResize);
  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("click", handleClick);
  window.addEventListener("touchstart", handleTouchStart, { passive: true });
  window.addEventListener("scroll", handleScrollPhysics, { passive: true });

  const DOC = window.DeviceOrientationEvent as any;
  if (!DOC || typeof DOC.requestPermission !== "function") {
    window.addEventListener("deviceorientation", handleDeviceOrientation);
  }

  const triggerPlanetaryFlyby = (targetNode: any) => {
    const scene = ctx.sceneRef.current;
    const camera = ctx.cameraRef.current;
    if (!camera || !scene || ctx.isTransitActiveRef.current) return;
    ctx.isTransitActiveRef.current = true;
    const targetPos = targetNode.getAbsolutePosition().clone();
    
    // Choose an offset that looks cinematic
    const dir = targetPos.subtract(camera.position).normalize();
    const right = BABYLON.Vector3.Cross(dir, new BABYLON.Vector3(0, 1, 0)).normalize();
    const offset = right.scale(300).add(new BABYLON.Vector3(0, 150, -350));
    const flyToPos = targetPos.add(offset);

    // Create a sweeping bezier curve for the camera path
    const controlPoint = camera.position.clone().add(flyToPos).scale(0.5).add(new BABYLON.Vector3(0, 400, 200));
    const bezier = BABYLON.Curve3.CreateQuadraticBezier(camera.position, controlPoint, flyToPos, 60);
    const points = bezier.getPoints();

    const camAnim = new BABYLON.Animation("camFly", "position", 60, BABYLON.Animation.ANIMATIONTYPE_VECTOR3, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
    const keys = points.map((p, i) => ({ frame: i * 2, value: p })); // 120 frames total
    camAnim.setKeys(keys);

    const easing = new BABYLON.CubicEase();
    easing.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);
    camAnim.setEasingFunction(easing);

    scene.beginDirectAnimation(camera, [camAnim], 0, 120, false, 1, () => {
      ctx.isTransitActiveRef.current = false;
    });
    BABYLON.Animation.CreateAndStartAnimation("camTarget", camera, "target", 60, 120, camera.getTarget(), targetPos, 0, new BABYLON.CubicEase());
  };

  let pointerObserver: BABYLON.Observer<BABYLON.PointerInfo> | null = null;

  if (ctx.sceneRef.current) {
    pointerObserver = ctx.sceneRef.current.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
        const evt = pointerInfo.event as MouseEvent | PointerEvent | TouchEvent;
        const target = evt?.target as HTMLElement | null;
        if (target && isUIElement(target)) {
          return;
        }
        const scene = ctx.sceneRef.current;
        const camera = ctx.cameraRef.current;
        if (!scene || !camera) return;

        // Optimized picking check: only pick meshes that are part of interactive groups
        const pickPredicate = (mesh: BABYLON.AbstractMesh) => {
            if (!mesh.isPickable || mesh.name === "hudPlane") return false;
            // Ignore particle systems, shockwaves, debris
            if (mesh.name.startsWith("sn_") || mesh.name.includes("debris") || mesh.name.includes("flare")) return false;
            return true;
        };

        const pickResult = scene.pick(scene.pointerX, scene.pointerY, pickPredicate);

        if (pickResult && pickResult.hit && pickResult.pickedMesh) {
          const meshName = pickResult.pickedMesh.name;
          const parentNode = pickResult.pickedMesh.parent;
          
          // Check if clicked a black hole
          if ((parentNode && parentNode.name === "bh_group") || meshName.startsWith("event_horizon_")) {
            const bhNode = parentNode?.name === "bh_group" ? parentNode : pickResult.pickedMesh;
            const bhPos = bhNode.getAbsolutePosition();
            const dir = bhPos.subtract(camera.position).normalize();
            
            // Get the physical radius of the event horizon core mesh
            let coreMesh;
            if (bhNode.name === "bh_group") {
              coreMesh = bhNode.getChildMeshes().find(m => m.name.startsWith("event_horizon_core_3d"));
            } else {
              coreMesh = pickResult.pickedMesh;
            }
            const bhRadius = coreMesh ? (coreMesh.getBoundingInfo().boundingSphere.radiusWorld) / 2.598 : 100;
            
            ctx.startWormholeTransit(bhPos, dir, bhRadius);
            return;
          }

          if (parentNode && (parentNode.name === "planet_group" || parentNode.name === "nebula_group" || parentNode.name === "galaxy_group" || parentNode.name === "star_group")) {
            triggerPlanetaryFlyby(parentNode);
            return;
          }
          if (meshName.startsWith("planet_") || meshName === "ring_mesh" || meshName === "atmosphere_glow" || meshName.startsWith("star_")) {
            triggerPlanetaryFlyby(pickResult.pickedMesh);
            return;
          }
        }
        
        if (!ctx.isInterstellarRef.current) {
          const ray = scene.createPickingRay(scene.pointerX, scene.pointerY, BABYLON.Matrix.Identity(), camera);
          const targetPoint = ray.origin.add(ray.direction.scale(1500));
          ctx.startWormholeTransit(targetPoint, ray.direction);
        }
      }
    });
  }

  const cleanup = () => {
    window.removeEventListener("resize", handleResize);
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("click", handleClick);
    window.removeEventListener("touchstart", handleTouchStart);
    window.removeEventListener("scroll", handleScrollPhysics);
    window.removeEventListener("deviceorientation", handleDeviceOrientation);
    delete (window as any).activateSequence;

    if (pointerObserver && ctx.sceneRef.current) {
      ctx.sceneRef.current.onPointerObservable.remove(pointerObserver);
    }

    if (ctx.lensingPostProcessRef && ctx.lensingPostProcessRef.current) {
      ctx.lensingPostProcessRef.current.dispose();
    }

    if (ctx.wormholePostProcessRef && ctx.wormholePostProcessRef.current) {
      ctx.wormholePostProcessRef.current.dispose();
    }

    if (ctx.activeSupernovaFxRef.current) {
      ctx.activeSupernovaFxRef.current.dispose();
      ctx.activeSupernovaFxRef.current = null;
    }

    if (ctx.rendererRef.current) {
      ctx.rendererRef.current.stopRenderLoop();
      ctx.rendererRef.current.dispose();
    }
  };

  return cleanup;
}
