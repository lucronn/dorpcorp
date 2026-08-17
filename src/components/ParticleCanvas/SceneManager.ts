import React from "react";
import { CelestialEntity } from "./types";
import { buildBlackholeCentricScene } from "./scenes/blackhole_centric";
import { buildBinaryPlanetsScene } from "./scenes/binary_planets";
import { buildNebulaCradleScene } from "./scenes/nebula_cradle";
import { buildExoplanetClusterScene } from "./scenes/exoplanet_cluster";
import { buildSpiralGalaxyScene } from "./scenes/spiral_galaxy";
import { transitionToNewEntities } from "./TransitionManager";

export async function fetchNextGeminiScene(
  isFetchingRef: React.MutableRefObject<boolean>,
  nextGeminiSceneRef: React.MutableRefObject<any>
): Promise<void> {
  if (isFetchingRef.current) return;
  isFetchingRef.current = true;
  try {
    const res = await fetch("/api/generate-cosmic-scene", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      if (data && data.systemName) {
        nextGeminiSceneRef.current = data;
      }
    }
  } catch (e) {
    console.warn("Failed to fetch custom Gemini scene:", e);
  } finally {
    isFetchingRef.current = false;
  }
}

export function registerAndSaveSequence(
  systemName: string,
  systemDesc: string,
  systemTags: string[],
  entitiesList: CelestialEntity[],
  archetype: string,
  onSequenceGenerated?: (seq: { id: string; name: string; description: string; tags: string[] }) => void
): string {
  const seqId =
    "seq-" +
    systemName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  try {
    const saved = localStorage.getItem("cosmic_debug_sequences");
    const list = saved ? JSON.parse(saved) : {};
    list[seqId] = {
      id: seqId,
      systemName,
      systemDesc,
      systemTags,
      archetype,
      entities: entitiesList.map((e) => ({
        type: e.type,
        radius: e.radius,
        color: e.color,
        secondaryColor: e.secondaryColor || e.color,
        hasRings: e.hasRings || false,
        ringColor: e.ringColor || "",
        x: e.x,
        y: e.y,
        z: e.z || 0,
        vx: e.vx || 0,
        vy: e.vy || 0,
        vz: e.vz || 0,
        mass: e.mass,
        scale: e.scale,
        currentRadius: e.currentRadius,
        originalRadius: e.originalRadius,
        targetRadius: e.targetRadius,
        isPhysicsEnabled: e.isPhysicsEnabled || false,
        isDestroyed: e.isDestroyed || false,
        isSwallowing: e.isSwallowing || false,
        destroyedBy: e.destroyedBy || "",
      })),
    };
    localStorage.setItem("cosmic_debug_sequences", JSON.stringify(list));
    localStorage.setItem("cosmic_last_sequence_id", seqId);
  } catch (e) {
    // Ignore gracefully
  }
  if (onSequenceGenerated) {
    onSequenceGenerated({
      id: seqId,
      name: systemName,
      description: systemDesc,
      tags: systemTags,
    });
  }
  return seqId;
}

export function generateInterstellarScene(
  width: number,
  height: number,
  isInterstellar: boolean,
  forceInterstellar: boolean,
  celestialEntitiesRef: React.MutableRefObject<CelestialEntity[]>,
  nextGeminiSceneRef: React.MutableRefObject<any>,
  isFetchingRef: React.MutableRefObject<boolean>,
  archetypeRef: React.MutableRefObject<string>,
  entityTransitionActiveRef: React.MutableRefObject<boolean>,
  entityTransitionStartTimeRef: React.MutableRefObject<number>,
  interstellarSceneGeneratedTimeRef: React.MutableRefObject<number>,
  supernovaX?: number,
  supernovaY?: number,
  onSequenceGenerated?: (seq: { id: string; name: string; description: string; tags: string[] }) => void
): void {
  if (!isInterstellar && !forceInterstellar) {
    celestialEntitiesRef.current = [];
    return;
  }

  let entities: CelestialEntity[] = [];
  const isMobile = width < 768;
  const spawnX = supernovaX !== undefined ? supernovaX : width / 2;
  const spawnY = supernovaY !== undefined ? supernovaY : height / 2;

  const geminiData = nextGeminiSceneRef.current;
  if (geminiData && Array.isArray(geminiData.entities) && geminiData.entities.length > 0) {
    nextGeminiSceneRef.current = null;
    fetchNextGeminiScene(isFetchingRef, nextGeminiSceneRef);

    archetypeRef.current = geminiData.archetype;
    const systemName = geminiData.systemName;
    const systemDesc = geminiData.systemDesc;
    const systemTags = geminiData.systemTags;

    const cx = width / 2;
    const cy = height / 2;

    const hasStoredCoordinates =
      Array.isArray(geminiData.entities) &&
      geminiData.entities.some((e: any) => e.x !== undefined && e.y !== undefined);

    if (hasStoredCoordinates) {
      geminiData.entities.forEach((entity: any) => {
        entities.push({
          type: entity.type,
          x: entity.x,
          y: entity.y,
          z: entity.z !== undefined ? entity.z : 0,
          radius: Math.min(entity.radius || 20, 120),
          color: entity.color,
          secondaryColor: entity.secondaryColor || entity.color,
          hasRings: entity.hasRings || false,
          ringColor: entity.ringColor || "",
          orbitRadius: entity.orbitRadius || 0,
          orbitAngle: entity.orbitAngle || 0,
          orbitSpeed: entity.orbitSpeed || 0,
          centerX: entity.centerX !== undefined ? entity.centerX : cx,
          centerY: entity.centerY !== undefined ? entity.centerY : cy,
          vx: entity.vx !== undefined ? entity.vx : 0,
          vy: entity.vy !== undefined ? entity.vy : 0,
          vz: entity.vz !== undefined ? entity.vz : 0,
          mass: entity.mass !== undefined ? entity.mass : entity.radius * entity.radius,
          initialMass: entity.initialMass !== undefined ? entity.initialMass : entity.radius * entity.radius,
          scale: entity.scale !== undefined ? entity.scale : 0.05,
          currentRadius: Math.min(entity.currentRadius !== undefined ? entity.currentRadius : entity.radius || 20, 120),
          originalRadius: Math.min(entity.originalRadius !== undefined ? entity.originalRadius : entity.radius || 20, 120),
          targetRadius: Math.min(entity.targetRadius !== undefined ? entity.targetRadius : entity.radius || 20, 120),
          isPhysicsEnabled: entity.isPhysicsEnabled !== undefined ? entity.isPhysicsEnabled : false,
          isDestroyed: entity.isDestroyed !== undefined ? entity.isDestroyed : false,
          isSwallowing: entity.isSwallowing !== undefined ? entity.isSwallowing : false,
          destroyedBy: entity.destroyedBy || "",
        });
      });
    } else {
      const bhEntity = geminiData.entities.find((e: any) => e.type === "blackhole");
      if (bhEntity) {
        entities.push({
          type: "blackhole",
          x: cx,
          y: cy,
          radius: Math.min(bhEntity.radius || 30, 120),
          color: bhEntity.color,
          secondaryColor: bhEntity.secondaryColor || bhEntity.color,
          vx: 0,
          vy: 0,
          mass: Math.min(bhEntity.radius || 30, 120) * Math.min(bhEntity.radius || 30, 120) * 15,
          initialMass: Math.min(bhEntity.radius || 30, 120) * Math.min(bhEntity.radius || 30, 120) * 15,
          scale: 0,
          currentRadius: Math.min(bhEntity.radius || 30, 120),
          originalRadius: Math.min(bhEntity.radius || 30, 120),
          targetRadius: Math.min(bhEntity.radius || 30, 120),
          isPhysicsEnabled: false,
          isDestroyed: false,
        });
      }

      const otherEntities = geminiData.entities.filter((e: any) => e.type !== "blackhole");
      otherEntities.forEach((entity: any, idx: number) => {
        const orbitRad = (isMobile ? 350 : 600) + idx * (isMobile ? 180 : 320);
        const angle = Math.random() * Math.PI * 2;
        const orbitSpeed = 0.0012 + Math.random() * 0.0012;

        entities.push({
          type: entity.type,
          x: cx + Math.cos(angle) * orbitRad,
          y: cy + Math.sin(angle) * orbitRad,
          radius: Math.min(entity.radius || 20, 120),
          color: entity.color,
          secondaryColor: entity.secondaryColor || entity.color,
          hasRings: entity.hasRings,
          ringColor: entity.ringColor,
          orbitRadius: orbitRad,
          orbitAngle: angle,
          orbitSpeed: orbitSpeed,
          centerX: cx,
          centerY: cy,
          vx: -Math.sin(angle) * orbitRad * orbitSpeed * 1.5,
          vy: Math.cos(angle) * orbitRad * orbitSpeed * 1.5,
          mass: Math.min(entity.radius || 20, 120) * Math.min(entity.radius || 20, 120),
          initialMass: Math.min(entity.radius || 20, 120) * Math.min(entity.radius || 20, 120),
          scale: 0,
          currentRadius: Math.min(entity.radius || 20, 120),
          originalRadius: Math.min(entity.radius || 20, 120),
          targetRadius: Math.min(entity.radius || 20, 120),
          isPhysicsEnabled: false,
          isDestroyed: false,
        });
      });
    }

    transitionToNewEntities(
      celestialEntitiesRef.current,
      entities,
      spawnX,
      spawnY,
      entityTransitionActiveRef,
      entityTransitionStartTimeRef
    );
    interstellarSceneGeneratedTimeRef.current = Date.now();
    registerAndSaveSequence(
      systemName,
      systemDesc,
      systemTags,
      entities,
      archetypeRef.current,
      onSequenceGenerated
    );
    return;
  }

  const archetypes = [
    "BLACKHOLE_CENTRIC",
    "BINARY_PLANETS",
    "NEBULA_CRADLE",
    "EXOPLANET_CLUSTER",
    "SPIRAL_GALAXY",
  ];
  // Sequence #1 always defaults to the supermassive BLACKHOLE_CENTRIC
  const chosenArchetype =
    !archetypeRef.current
      ? "BLACKHOLE_CENTRIC"
      : archetypes[Math.floor(Math.random() * archetypes.length)] || "BLACKHOLE_CENTRIC";
  archetypeRef.current = chosenArchetype;

  let sceneData: {
    systemName: string;
    systemDesc: string;
    systemTags: string[];
    entities: CelestialEntity[];
  };

  if (chosenArchetype === "BLACKHOLE_CENTRIC") {
    sceneData = buildBlackholeCentricScene(width, height, isMobile);
  } else if (chosenArchetype === "BINARY_PLANETS") {
    sceneData = buildBinaryPlanetsScene(width, height, isMobile);
  } else if (chosenArchetype === "NEBULA_CRADLE") {
    sceneData = buildNebulaCradleScene(width, height, isMobile);
  } else if (chosenArchetype === "EXOPLANET_CLUSTER") {
    sceneData = buildExoplanetClusterScene(width, height, isMobile);
  } else {
    sceneData = buildSpiralGalaxyScene(width, height, isMobile);
  }

  entities = sceneData.entities;

  transitionToNewEntities(
    celestialEntitiesRef.current,
    entities,
    spawnX,
    spawnY,
    entityTransitionActiveRef,
    entityTransitionStartTimeRef
  );
  interstellarSceneGeneratedTimeRef.current = Date.now();
  registerAndSaveSequence(
    sceneData.systemName,
    sceneData.systemDesc,
    sceneData.systemTags,
    entities,
    archetypeRef.current,
    onSequenceGenerated
  );
}
