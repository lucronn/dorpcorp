import React from "react";
import * as BABYLON from "@babylonjs/core";
import { CelestialEntity, CelestialMeshInstance, Particle } from "./types";
import {
  createBlackholeMesh,
  createPlanetMesh,
  createNebulaMesh,
  createGalaxyMesh,
  createStarMesh,
} from "./CelestialMeshBuilder";
import { createCircularGlowTexture } from "./TextureUtils";
import { createNeutronStarBirthEvent } from "./scenes/neutronstarbirth";
import { createHawkingRadiationSystem } from "./HawkingRadiationEngine";
import { spawnCollisionFlare, createShatterDebris, blendHexColors, CollisionResult } from "./PhysicsUtils";

export function getSpacetimeFabricDistortion(
  wx: number,
  wy: number,
  ww: number,
  wh: number,
  celestialEntitiesRef: React.MutableRefObject<CelestialEntity[]>,
  activeRipples: {
    x: number;
    y: number;
    life: number;
    maxDist: number;
    bandWidth: number;
    minDistSq: number;
    maxDistBoundSq: number;
  }[],
  time: number,
  disturbance: number
): number {
  let gravityZ = 0;

  celestialEntitiesRef.current.forEach((entity) => {
    if (entity.isDestroyed) return;
    const ex = entity.x - ww / 2;
    const ey = -(entity.y - wh / 2);

    const dx = ex - wx;
    const dy = ey - wy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    const range = entity.radius * (entity.type === "blackhole" ? 3.5 : 1.8);
    if (dist < range) {
      const intensity = (range - dist) / range;
      const pullDepth = entity.type === "blackhole" ? 180 : 45;
      gravityZ += Math.pow(intensity, 1.8) * pullDepth * (0.2 + disturbance * 0.8);
    }
  });

  activeRipples.forEach((ripple) => {
    const rx = ripple.x - ww / 2;
    const ry = -(ripple.y - wh / 2);
    const dx = rx - wx;
    const dy = ry - wy;
    const distSq = dx * dx + dy * dy;

    if (distSq > ripple.minDistSq && distSq < ripple.maxDistBoundSq) {
      const dist = Math.sqrt(distSq);
      const rForce = (1.0 - Math.abs(dist - ripple.maxDist) / ripple.bandWidth) * ripple.life;
      gravityZ += rForce * 25;
    }
  });

  if (disturbance > 0.01) {
    const pulseWave = Math.sin((wx + wy) * 0.012 - time * 0.06) * 6 * Math.min(1.0, disturbance);
    gravityZ += pulseWave;
  }

  return gravityZ;
}

export function updateCelestial3DMeshes(
  sceneRef: React.MutableRefObject<BABYLON.Scene | null>,
  celestialGroupRef: React.MutableRefObject<BABYLON.TransformNode | null>,
  celestialEntitiesRef: React.MutableRefObject<CelestialEntity[]>,
  entityTransitionActiveRef: React.MutableRefObject<boolean>,
  entityTransitionStartTimeRef: React.MutableRefObject<number>,
  interstellarSceneGeneratedTimeRef: React.MutableRefObject<number>,
  audio: any,
  isInterstellarRef: React.MutableRefObject<boolean>,
  supernovaRef: React.MutableRefObject<any>,
  triggerCalmCosmicShift: () => void,
  createDustSplash: (x: number, y: number, color: string, count: number) => void,
  registerAndSaveSequence: (name: string, desc: string, tags: string[], list: CelestialEntity[]) => void,
  lastAutonomousEventTimeRef: React.MutableRefObject<number>,
  activeWormholeRef: React.MutableRefObject<any>,
  particlesRef: React.MutableRefObject<Particle[]>,
  swallowEntity: (bh: CelestialEntity, victim: CelestialEntity) => void,
  mergeEntities: (e1: CelestialEntity, e2: CelestialEntity) => CollisionResult | null | void,
  celestialMeshInstancesRef: React.MutableRefObject<CelestialMeshInstance[]>,
  mouseRef: React.MutableRefObject<{ x: number; y: number }>,
  cameraRef: React.MutableRefObject<BABYLON.Camera | null>,
  isShockwaveActiveRef: React.MutableRefObject<boolean>,
  objectParticleSpeedRef: React.MutableRefObject<number>,
  stageRef: React.MutableRefObject<number>,
  screensaverOpacityRef: React.MutableRefObject<number>,
  lastStageChangeRef: React.MutableRefObject<number>,
  collisionFlaresRef: React.MutableRefObject<
    Array<{ mesh: BABYLON.Mesh; life: number; maxLife: number; initialRadius: number }>
  >,
  spawnTailParticleRef: React.MutableRefObject<any>
): void {
  try {
    const scene = sceneRef.current;
    const group = celestialGroupRef.current;
    if (!scene || !group) return;

    const ww = typeof window !== "undefined" ? window.innerWidth : 1920;
    const wh = typeof window !== "undefined" ? window.innerHeight : 1080;
    const entities = celestialEntitiesRef.current;

    let meshTransitionT = 0;
    let isMeshTransitioning = false;
    if (entityTransitionActiveRef.current) {
      const duration = 2400;
      const elapsed = Date.now() - entityTransitionStartTimeRef.current;
      if (elapsed >= duration) {
        entityTransitionActiveRef.current = false;
        entities.forEach((cur) => {
          if (cur.targetX !== undefined) cur.x = cur.targetX;
          if (cur.targetY !== undefined) cur.y = cur.targetY;
          if (cur.targetZ !== undefined) cur.z = cur.targetZ;
          if (cur.targetRadius !== undefined) cur.radius = cur.targetRadius;
          if (cur.targetScale !== undefined) cur.scale = cur.targetScale;
          if (cur.centerX !== undefined && cur.centerY !== undefined && cur.x !== undefined && cur.y !== undefined) {
            cur.orbitAngle = Math.atan2(cur.y - cur.centerY, cur.x - cur.centerX);
            cur.orbitRadius = Math.hypot(cur.x - cur.centerX, cur.y - cur.centerY);
          }
        });
        celestialEntitiesRef.current = entities.filter((e) => !e.isDestroyed && (e.scale ?? 0) > 0.01);
      } else {
        isMeshTransitioning = true;
        const rawT = elapsed / duration;
        meshTransitionT = rawT < 0.5 ? 4 * rawT * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 3) / 2;
      }
    }

    if (isMeshTransitioning) {
      entities.forEach((cur) => {
        if (cur.startX !== undefined && cur.targetX !== undefined) {
          cur.x = (1 - meshTransitionT) * cur.startX + meshTransitionT * cur.targetX;
        }
        if (cur.startY !== undefined && cur.targetY !== undefined) {
          cur.y = (1 - meshTransitionT) * cur.startY + meshTransitionT * cur.targetY;
        }
        if (cur.startZ !== undefined && cur.targetZ !== undefined) {
          cur.z = (1 - meshTransitionT) * cur.startZ + meshTransitionT * cur.targetZ;
        }
        if (cur.startRadius !== undefined && cur.targetRadius !== undefined) {
          cur.radius = (1 - meshTransitionT) * cur.startRadius + meshTransitionT * cur.targetRadius;
        }
        if (cur.startScale !== undefined && cur.targetScale !== undefined) {
          cur.scale = (1 - meshTransitionT) * cur.startScale + meshTransitionT * cur.targetScale;
        }
      });
    }

    const sceneAge = (Date.now() - interstellarSceneGeneratedTimeRef.current) / 1000;
    const musicAmp = audio.getMusicAmplitude ? audio.getMusicAmplitude() : 0;
    const musicBands = audio.getFrequencyBands ? audio.getFrequencyBands() : { bass: 0, mid: 0, treble: 0 };

    if (isInterstellarRef.current && sceneAge > 240.0 && !supernovaRef.current && !(window as any).__screensaverManaged) {
      triggerCalmCosmicShift();
    }

    // Continuous Gravity Drift
    entities.forEach((entity) => {
      if (entity.isDestroyed || entity.type === "blackhole") return;

      const bh = entities.find((e) => e && !e.isDestroyed && e.type === "blackhole");
      if (!bh) return;

      const dx = bh.x - entity.x;
      const dy = bh.y - entity.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      if (entity.isSwallowing) {
        const spiralPull = 0.15;
        entity.vx = (entity.vx || 0) + (dx / dist) * spiralPull;
        entity.vy = (entity.vy || 0) + (dy / dist) * spiralPull;
        if (dist < bh.radius * 1.5) {
          entity.isDestroyed = true;
        }
      } else {
        const dragPull = 0.0008;
        entity.vx = (entity.vx || 0) + (dx / dist) * dragPull;
        entity.vy = (entity.vy || 0) + (dy / dist) * dragPull;
      }
    });

    // Autonomous Cosmic Event Loop
    const now = Date.now();
    if (now - lastAutonomousEventTimeRef.current > 45000) {
      lastAutonomousEventTimeRef.current = now;
      const nonBhEntities = entities.filter((e) => !e.isDestroyed && e.type !== "blackhole");
      const eventChoice = Math.floor(Math.random() * 4);

      if (eventChoice === 0 && nonBhEntities.length >= 2) {
        const e1 = nonBhEntities[Math.floor(Math.random() * nonBhEntities.length)]!;
        const e2 = nonBhEntities[Math.floor(Math.random() * nonBhEntities.length)]!;
        if (e1 !== e2) {
          const idx1 = entities.indexOf(e1);
          const idx2 = entities.indexOf(e2);
          activeWormholeRef.current = {
            startEntityIdx: idx1,
            endEntityIdx: idx2,
            life: 1.0,
            duration: 8000,
          };

          const particles = particlesRef.current;
          let bridgeCount = 0;
          particles.forEach((p) => {
            if (!p.isTail && !p.isCosmicAmbient && bridgeCount < 200) {
              p.interstellarType = "bridge";
              p.bridgeStartEntityIndex = idx1;
              p.bridgeStartEntity = entities[idx1];
              p.bridgeEndEntityIndex = idx2;
              p.bridgeEndEntity = entities[idx2];
              p.bridgeProgress = Math.random();
              p.bridgeSpeed = 0.007 + Math.random() * 0.015;
              bridgeCount++;
            }
          });

          if (audio.playStageSwell) audio.playStageSwell(1);

          registerAndSaveSequence(
            "Wormhole Bridge Activated",
            "A localized quantum bridge has bent spacetime between two orbits. Hot stellar plasma particles funnel instantly through the dimensional throat.",
            ["🕳 ER BRIDGE", "☄ SPATIAL WARP", "★ BENT METRIC"],
            entities
          );
        }
      } else if (eventChoice === 1 && nonBhEntities.length >= 1) {
        const star = nonBhEntities[Math.floor(Math.random() * nonBhEntities.length)]!;
        const eventRes = createNeutronStarBirthEvent(star, entities, createDustSplash, audio);
        registerAndSaveSequence(
          eventRes.systemName,
          eventRes.systemDesc,
          eventRes.systemTags,
          entities
        );
      }
    }

    if (activeWormholeRef.current) {
      activeWormholeRef.current.duration -= 16;
      if (activeWormholeRef.current.duration <= 0) {
        activeWormholeRef.current = null;
      }
    }

    // Handle collisions & swallowing
    for (let i = 0; i < entities.length; i++) {
      const e1 = entities[i];
      if (!e1 || e1.isDestroyed) continue;

      for (let j = i + 1; j < entities.length; j++) {
        const e2 = entities[j];
        if (!e2 || e2.isDestroyed) continue;

        if ((e1.scale ?? 0) < 0.9 || (e2.scale ?? 0) < 0.9) continue;

        const dx = e2.x - e1.x;
        const dy = e2.y - e1.y;
        const dz = (e2.z || 0) - (e1.z || 0);
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const colDist = e1.radius + e2.radius;

        if (dist < colDist) {
          if (e1.type === "blackhole") {
            swallowEntity(e1, e2);
          } else if (e2.type === "blackhole") {
            swallowEntity(e2, e1);
          } else if (!e1.isMerging && !e2.isMerging) {
            const colResult = e1.radius >= e2.radius
              ? mergeEntities(e1, e2)
              : mergeEntities(e2, e1);

            if (colResult && colResult.kineticEnergyDissipated > 0 && sceneRef.current) {
              const contactX = colResult.contactPointX - ww / 2;
              const contactY = -(colResult.contactPointY - wh / 2);
              const contactZ = colResult.contactPointZ || 0;
              const flareColor = blendHexColors(e1.color || "#ffffff", e2.color || "#ffffff", 0.5);

              spawnCollisionFlare(
                sceneRef.current,
                contactX,
                contactY,
                contactZ,
                Math.min(35, Math.max(8, (e1.radius + e2.radius) * 0.3)),
                flareColor,
                collisionFlaresRef.current
              );

              if (spawnTailParticleRef.current) {
                createShatterDebris(
                  colResult.contactPointX,
                  colResult.contactPointY,
                  flareColor,
                  14,
                  spawnTailParticleRef.current
                );
              }

              if (colResult.kineticEnergyDissipated > 40 && audio?.playInteractiveMallet) {
                audio.playInteractiveMallet(0.85, colResult.contactPointX / ww);
              }
            }
          }
        }
      }
    }

    entities.forEach((entity, idx) => {
      if (!entity.id) {
        entity.id = `${entity.type}-${idx}-${Math.random().toString(36).substring(2, 9)}`;
      }
    });
    const activeEntityIds = new Set(entities.map((e) => e.id));

    const nextMeshInstances: CelestialMeshInstance[] = [];
    celestialMeshInstancesRef.current.forEach((inst) => {
      const entity = inst.entityRef;
      const isStillPresent = activeEntityIds.has(entity.id);
      const shouldDispose = !isStillPresent || (entity.isDestroyed && (entity.scale ?? 0) <= 0.02);

      if (shouldDispose) {
        inst.mesh.getChildMeshes(false).forEach((m) => {
          if (m.material) {
            const mats = (m.material as any).subMaterials || [m.material];
            mats.forEach((mat: any) => {
              if (mat) {
                const textures = mat.getActiveTextures ? mat.getActiveTextures() : [];
                textures.forEach((tex: any) => {
                  if (tex && typeof tex.dispose === "function") {
                    tex.dispose();
                  }
                });
                if (typeof mat.dispose === "function") {
                  mat.dispose();
                }
              }
            });
          }
          m.dispose();
        });
        if (inst.hawkingSystem && typeof inst.hawkingSystem.dispose === "function") {
          inst.hawkingSystem.dispose();
        }
        inst.mesh.dispose();
      } else {
        nextMeshInstances.push(inst);
      }
    });
    celestialMeshInstancesRef.current = nextMeshInstances;

    entities.forEach((entity) => {
      const hasMesh = celestialMeshInstancesRef.current.some((inst) => inst.entityRef.id === entity.id);
      if (hasMesh || entity.isDestroyed) return;

      const entityId = entity.id!;
      const wx = entity.x - ww / 2;
      const wy = -(entity.y - wh / 2);

      entity.scale = entity.scale !== undefined && entity.scale > 0 ? entity.scale : 1.0;
      entity.currentRadius = entity.currentRadius ?? entity.radius;
      entity.originalRadius = entity.originalRadius ?? entity.radius;
      const initScale = entity.scale * (entity.currentRadius / entity.originalRadius);

      let createdMeshNode: BABYLON.TransformNode | null = null;
      let hawkingSystem: any = undefined;

      if (entity.type === "blackhole") {
        createdMeshNode = createBlackholeMesh(entity, wx, wy, initScale, scene);
        hawkingSystem = createHawkingRadiationSystem(createdMeshNode, entity, scene);
      } else if (entity.type === "galaxy") {
        createdMeshNode = createGalaxyMesh(entity, wx, wy, initScale, scene);
      } else if (entity.type === "star") {
        createdMeshNode = createStarMesh(entity, wx, wy, initScale, scene);
      } else if (entity.type === "planet") {
        createdMeshNode = createPlanetMesh(entity, wx, wy, initScale, scene);
      } else if (entity.type === "nebula") {
        createdMeshNode = createNebulaMesh(entity, wx, wy, initScale, scene);
      }

      if (createdMeshNode) {
        createdMeshNode.metadata = { entityId, entityRef: entity };
        if (celestialGroupRef.current) {
          createdMeshNode.parent = celestialGroupRef.current;
        }
        celestialMeshInstancesRef.current.push({
          id: entityId,
          mesh: createdMeshNode,
          entityRef: entity,
          hawkingSystem,
        });
      }
    });

    // Update positions, scaling, rotations, spaghettification
    celestialMeshInstancesRef.current.forEach((inst) => {
      const entity = inst.entityRef;
      const wx = entity.x - ww / 2;
      const wy = -(entity.y - wh / 2);

      if (!isMeshTransitioning && !entity.isDestroyed) {
        if (entity.scale === undefined || entity.scale < 1.0) {
          entity.scale = Math.min(1.0, (entity.scale || 0) + 0.05);
        }
      }
      entity.scale = entity.scale !== undefined && entity.scale > 0 ? entity.scale : 1.0;
      entity.currentRadius = entity.currentRadius ?? entity.radius;
      entity.originalRadius = entity.originalRadius ?? entity.radius;

      const baseScale = entity.scale * (entity.currentRadius / entity.originalRadius);
      let finalScale = baseScale;

      if (entity.isDestroyed) {
        entity.scale *= 0.88;
        finalScale = entity.scale * (entity.currentRadius / entity.originalRadius);
      }

      let finalScaleX = finalScale;
      let finalScaleY = finalScale;
      let finalScaleZ = finalScale;

      let blackholeDist = 100000;
      let nearestBh: CelestialEntity | null = null;
      celestialEntitiesRef.current.forEach((other) => {
        if (other.type === "blackhole" && !other.isDestroyed && other !== entity) {
          const odx = other.x - entity.x;
          const ody = other.y - entity.y;
          const odist = Math.sqrt(odx * odx + ody * ody);
          if (odist < blackholeDist) {
            blackholeDist = odist;
            nearestBh = other;
          }
        }
      });

      if (nearestBh && entity.type !== "blackhole" && entity.type !== "nebula" && !entity.isDestroyed) {
        const bh = nearestBh as CelestialEntity;
        const horizonZone = bh.radius * 4.2;
        if (blackholeDist < horizonZone) {
          const intensity = (horizonZone - blackholeDist) / horizonZone;

          const stretchFactor = 1.0 + intensity * 1.35;
          const compressFactor = Math.max(0.12, 1.0 - intensity * 0.48);

          finalScaleX = finalScale * stretchFactor;
          finalScaleY = finalScale * compressFactor;
          finalScaleZ = finalScale * compressFactor;

          const angleToBh = Math.atan2(bh.y - entity.y, bh.x - entity.x);
          inst.mesh.rotation.z = -angleToBh;

          if (blackholeDist < bh.radius * 1.12) {
            entity.isDestroyed = true;
            entity.destroyedBy = "blackhole";

            if (sceneRef.current) {
              const flareMesh = BABYLON.MeshBuilder.CreateTorus("bh_devour_flare_3d_torus", { diameter: bh.radius * 2.8, thickness: bh.radius * 0.4, tessellation: 32 }, sceneRef.current);
              flareMesh.position.set(bh.x - ww / 2, -(bh.y - wh / 2), -5);
              flareMesh.renderingGroupId = 1;
              const flareMat = new BABYLON.StandardMaterial("devourMat", sceneRef.current);
              const flareTex = createCircularGlowTexture(bh.color, sceneRef.current);
              flareMat.diffuseTexture = flareTex;
              flareMat.emissiveTexture = flareTex;
              flareMat.opacityTexture = flareTex;
              flareMat.disableLighting = true;
              flareMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
              flareMesh.material = flareMat;

              collisionFlaresRef.current.push({
                mesh: flareMesh,
                life: 1.0,
                maxLife: 1.0,
                initialRadius: bh.radius * 2.8,
              });
            }

            if (audio.playInteractiveMallet) audio.playInteractiveMallet(0.95, bh.x / ww);

            if (spawnTailParticleRef.current) {
              for (let k = 0; k < 25; k++) {
                const ang = Math.random() * Math.PI * 2;
                const spd = 3 + Math.random() * 8;
                spawnTailParticleRef.current(
                  bh.x + Math.cos(ang) * bh.radius * 0.9,
                  bh.y + Math.sin(ang) * bh.radius * 0.9,
                  0,
                  Math.cos(ang) * spd,
                  Math.sin(ang) * spd,
                  entity.color || "#ffaa00",
                  0.05
                );
              }
            }
          }
        } else {
          inst.mesh.rotation.z = 0;
        }
      } else {
        inst.mesh.rotation.z = 0;
      }

      inst.mesh.scaling.set(finalScaleX, finalScaleY, finalScaleZ);

      if (entity.type === "blackhole") {
        const mouseNormX = (mouseRef.current.x - ww / 2) / (ww / 2 || 1);
        const mouseNormY = (mouseRef.current.y - wh / 2) / (wh / 2 || 1);

        const cursorDistToBH = Math.hypot(mouseRef.current.x - entity.x, mouseRef.current.y - entity.y);
        const bhHoverProximity = Math.max(0, 1.0 - cursorDistToBH / (entity.radius * 3.8));

        // Update subtle shimmering Hawking Radiation quantum particle effect
        if (inst.hawkingSystem && typeof inst.hawkingSystem.update === "function") {
          const isCinematic = (window as any).__cinematicMode === true;
          let camProximity = 0;
          if (cameraRef.current) {
            const camDist = BABYLON.Vector3.Distance(
              cameraRef.current.position,
              new BABYLON.Vector3(wx, wy, entity.z || 0)
            );
            camProximity = Math.max(0, 1.0 - (camDist - entity.radius) / (entity.radius * 4.2));
          }
          const combinedProximity = Math.max(bhHoverProximity, camProximity);
          inst.hawkingSystem.update(combinedProximity, isCinematic, 16.666);
        }

        // Smooth gyroscopic precession & reactive tilt following cursor
        const basePrecessionX = Math.sin(now * 0.0007) * 0.12;
        const basePrecessionY = Math.cos(now * 0.0005) * 0.14;
        const interactiveTiltX = -mouseNormY * 0.45 * (0.4 + bhHoverProximity * 0.7);
        const interactiveTiltY = mouseNormX * 0.55 * (0.4 + bhHoverProximity * 0.7);

        inst.mesh.rotation.x = basePrecessionX + interactiveTiltX;
        inst.mesh.rotation.y = basePrecessionY + interactiveTiltY;
        inst.mesh.rotation.z = Math.sin(now * 0.0003) * 0.08;

        const parallaxX = mouseNormX * 35.0 * (1.0 + bhHoverProximity * 0.5);
        const parallaxY = mouseNormY * 35.0 * (1.0 + bhHoverProximity * 0.5);
        inst.mesh.position.set(wx + parallaxX, wy + parallaxY, entity.z || 0);
        entity.worldX = inst.mesh.position.x;
        entity.worldY = inst.mesh.position.y;
        entity.worldZ = inst.mesh.position.z;

        // Relativistic polar jet particle emissions
        if (spawnTailParticleRef.current && Math.random() < 0.65) {
          const jetSpeed = 7.0 + Math.random() * 8.0;
          // North nozzle
          spawnTailParticleRef.current(
            entity.x + (Math.random() - 0.5) * entity.radius * 0.15,
            entity.y - entity.radius * 0.6,
            (Math.random() - 0.5) * 8,
            (Math.random() - 0.5) * 1.5,
            -jetSpeed,
            Math.random() > 0.4 ? "#ffffff" : (entity.secondaryColor || "#ffd778"),
            0.04
          );
          // South nozzle
          spawnTailParticleRef.current(
            entity.x + (Math.random() - 0.5) * entity.radius * 0.15,
            entity.y + entity.radius * 0.6,
            (Math.random() - 0.5) * 8,
            (Math.random() - 0.5) * 1.5,
            jetSpeed,
            Math.random() > 0.4 ? "#a5f3fc" : (entity.color || "#ff6600"),
            0.04
          );
        }
      } else if (entity.type !== "nebula") {
        let meshZ = entity.z || 0;
        let meshGravityZ = 0;
        celestialEntitiesRef.current.forEach((other) => {
          if (other.isDestroyed || other === entity) return;
          const odx = other.x - entity.x;
          const ody = other.y - entity.y;
          const odist = Math.sqrt(odx * odx + ody * ody) || 1;
          const range = other.radius * (other.type === "blackhole" ? 3.5 : 2.0);
          if (odist < range) {
            const intensity = (range - odist) / range;
            const pullDepth = other.type === "blackhole" ? 180 : 45;
            meshGravityZ += Math.pow(intensity, 1.8) * pullDepth;
          }
        });
        meshZ += meshGravityZ;

        const mouseNormX = (mouseRef.current.x - ww / 2) / (ww / 2 || 1);
        const mouseNormY = (mouseRef.current.y - wh / 2) / (wh / 2 || 1);
        const parallaxFactor = 0.15;
        const parallaxX = mouseNormX * meshZ * parallaxFactor;
        const parallaxY = mouseNormY * meshZ * parallaxFactor;

        inst.mesh.position.set(wx + parallaxX, wy + parallaxY, meshZ);
        entity.worldX = inst.mesh.position.x;
        entity.worldY = inst.mesh.position.y;
        entity.worldZ = inst.mesh.position.z;
      } else {
        inst.mesh.position.set(wx, wy, -30);
        entity.worldX = inst.mesh.position.x;
        entity.worldY = inst.mesh.position.y;
        entity.worldZ = inst.mesh.position.z;
        if (cameraRef.current) {
          inst.mesh.rotation.copyFrom(cameraRef.current.rotation);
        }
      }

      const isPulse = isShockwaveActiveRef.current;
      const objSpeedMult = (objectParticleSpeedRef.current ?? 0.15) / 0.15;
      inst.mesh.getChildMeshes().forEach((child) => {
        if (child.name === "planet_sphere" || child.name === "star_core" || child.name === "galaxy_core") {
          const spinBase = (child.name === "star_core" ? 0.008 : 0.0042) * objSpeedMult;
          child.rotation.y += spinBase + (musicBands.mid * 0.02 + musicBands.treble * 0.01) * objSpeedMult;
        } else if (child.name === "planet_clouds_inner") {
          child.rotation.y += (0.0055 + musicBands.mid * 0.01) * objSpeedMult;
          child.rotation.x += 0.0002 * objSpeedMult;
        } else if (child.name === "planet_clouds_outer") {
          child.rotation.y -= (0.0035 + musicBands.treble * 0.01) * objSpeedMult;
          child.rotation.z += 0.0003 * objSpeedMult;
        } else if (child.name === "planet_aurora_north" || child.name === "planet_aurora_south") {
          child.rotation.z += 0.008 * objSpeedMult;
        } else if (child.name === "planet_shield") {
          child.rotation.y += 0.002 * objSpeedMult;
          child.rotation.x += 0.001 * objSpeedMult;
          const shieldPulse = 1.0 + Math.sin(now * 0.003) * 0.025 + musicAmp * 0.04;
          child.scaling.set(shieldPulse, shieldPulse, shieldPulse);
        } else if (child.name.indexOf("galaxy_ellipsoid_bg") !== -1) {
          child.rotation.z -= (0.0016 + (isPulse ? 0.012 : 0) + musicBands.bass * 0.006) * objSpeedMult;
        } else if (child.name.indexOf("galaxy_ellipsoid") !== -1) {
          child.rotation.z += (0.0024 + (isPulse ? 0.016 : 0) + musicBands.mid * 0.008) * objSpeedMult;
        } else if (child.name.indexOf("accretion_layer_1") !== -1) {
          const bhHoverProximity = Math.max(0, 1.0 - Math.hypot(mouseRef.current.x - entity.x, mouseRef.current.y - entity.y) / (entity.radius * 3.8));
          child.rotation.z += (0.012 + musicBands.bass * 0.01 + bhHoverProximity * 0.02) * objSpeedMult;
          const pulse = 1.0 + Math.sin(Date.now() * 0.002) * 0.015 + musicAmp * 0.035;
          child.scaling.set(pulse, pulse, pulse);
        } else if (child.name.indexOf("accretion_layer_2") !== -1) {
          child.rotation.z -= (0.008 + musicBands.mid * 0.006) * objSpeedMult;
          const pulse = 1.0 + Math.cos(Date.now() * 0.0015) * 0.018 + musicAmp * 0.025;
          child.scaling.set(pulse, pulse, pulse);
        } else if (child.name.indexOf("gravitational_lensing") !== -1) {
          child.rotation.z += (0.003 + musicBands.bass * 0.003) * objSpeedMult;
          const pulse = 1.0 + Math.sin(Date.now() * 0.001) * 0.015 + musicAmp * 0.025;
          child.scaling.set(pulse, pulse, pulse);
        } else if (child.name.indexOf("bh_photon_ring") !== -1) {
          child.rotation.z += (0.025 + musicBands.treble * 0.015) * objSpeedMult;
          const pulse = 1.0 + Math.sin(Date.now() * 0.004) * 0.03 + musicBands.treble * 0.06;
          child.scaling.set(pulse, pulse, pulse);
        } else if (child.name.indexOf("bh_jet_north") !== -1 || child.name.indexOf("bh_jet_south") !== -1) {
          child.rotation.y += (0.02 + musicAmp * 0.03) * objSpeedMult;
          const bhHoverProximity = Math.max(0, 1.0 - Math.hypot(mouseRef.current.x - entity.x, mouseRef.current.y - entity.y) / (entity.radius * 3.8));
          const jetPulse = 1.0 + Math.sin(Date.now() * 0.006) * 0.08 + musicAmp * 0.35 + bhHoverProximity * 0.35;
          child.scaling.set(jetPulse, 1.0 + musicAmp * 0.45, jetPulse);
        } else if (child.name.indexOf("bh_jet_pinch") !== -1) {
          const pinchWave = 1.0 + Math.sin(Date.now() * 0.008 + child.position.y * 0.04) * 0.16;
          child.scaling.set(pinchWave, pinchWave, pinchWave);
        } else if (child.name.indexOf("bh_ergosphere") !== -1) {
          child.rotation.z += 0.015 * objSpeedMult;
          const ergoPulse = 1.0 + Math.sin(Date.now() * 0.003) * 0.05 + musicBands.bass * 0.07;
          child.scaling.set(ergoPulse, ergoPulse, ergoPulse);
        } else if (child.name.indexOf("nebula_sphere_1") !== -1) {
          child.rotation.y += (0.0008 + musicBands.mid * 0.003) * objSpeedMult;
          child.rotation.x += (0.0004 + musicBands.mid * 0.002) * objSpeedMult;
        } else if (child.name.indexOf("nebula_sphere_2") !== -1) {
          child.rotation.y -= (0.0006 + musicBands.mid * 0.002) * objSpeedMult;
          child.rotation.z += (0.0005 + musicBands.mid * 0.001) * objSpeedMult;
        } else {
          child.rotation.z += (0.003 + musicBands.mid * 0.005) * objSpeedMult;
        }
      });
    });

    let targetGroupOpacity = isInterstellarRef.current ? 1.0 : 0.95;
    if (stageRef.current === 0 && !isInterstellarRef.current) {
      targetGroupOpacity = 0.95;
    } else {
      const stageChangeElapsed = Date.now() - lastStageChangeRef.current;
      if (!isInterstellarRef.current) {
        if (stageChangeElapsed < 4000) {
          if (stageChangeElapsed < 3000) {
            targetGroupOpacity = 0.0;
          } else {
            const fadeProgress = (stageChangeElapsed - 3000) / 1000;
            targetGroupOpacity = 0.95 * fadeProgress;
          }
        }
      }
    }

    if (celestialGroupRef.current) {
      celestialGroupRef.current.getChildMeshes(false).forEach((child) => {
        if (child.material && child.material instanceof BABYLON.StandardMaterial) {
          const mat = child.material;
          if (child.name === "event_horizon_core_3d") {
            mat.needDepthBufferWrite = true;
            mat.alpha = 1.0;
            return;
          }
          if (child.name.indexOf("bh_jet") !== -1 || child.name.indexOf("bh_photon") !== -1) {
            mat.alpha = Math.min(1.0, 0.92 + musicAmp * 0.25);
            return;
          }

          if (!mat.metadata) {
            mat.metadata = { baseOpacity: mat.alpha ?? 1.0, fadeIn: 0.01 };
          }
          if (mat.metadata.fadeIn < 1.0) {
            mat.metadata.fadeIn += 0.06;
            if (mat.metadata.fadeIn > 1.0) mat.metadata.fadeIn = 1.0;
          }
          const baseOpacity = mat.metadata.baseOpacity * mat.metadata.fadeIn;
          const musicPulseOpacity = 0.38 * musicAmp;
          mat.alpha = baseOpacity * (targetGroupOpacity + musicPulseOpacity * (1 - targetGroupOpacity));
        }
      });
    }
  } catch (err) {
    console.error("[DEBUG] Error in updateCelestial3DMeshes:", err instanceof Error ? err.message : String(err));
  }
}
