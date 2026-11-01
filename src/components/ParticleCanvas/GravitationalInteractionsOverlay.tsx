import React from "react";
import * as BABYLON from "@babylonjs/core";
import { SlingshotAimState, SlingshotProbe } from "./SlingshotEngine";
import { TdeState } from "./TidalDisruptionEngine";
import { CelestialEntity } from "./types";

export interface GravitationalInteractionsOverlayProps {
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

/**
 * Scene-integrated 2D HUD overlays, dotted circles, crosshairs, and artificial 2D probes
 * have been intentionally removed to preserve pure, natural 3D cosmic scenes.
 */
export const GravitationalInteractionsOverlay: React.FC<GravitationalInteractionsOverlayProps> = () => {
  return null;
};
