/**
 * Core rendering types shared across all games
 */

import { GridPosition, ScreenPosition, GridBounds } from './grid';

// Re-export grid types commonly used with rendering
export type { ScreenPosition, GridPosition, GridBounds };

// Isometric constants
export const DEFAULT_TILE_WIDTH = 64;
export const DEFAULT_HEIGHT_RATIO = 0.60;
export const DEFAULT_TILE_HEIGHT = DEFAULT_TILE_WIDTH * DEFAULT_HEIGHT_RATIO;

/** Camera state for panning and zooming */
export interface CameraState {
  offset: ScreenPosition;
  zoom: number;
}

/** Canvas/viewport dimensions */
export interface ViewportSize {
  width: number;
  height: number;
}

/** Full viewport state */
export interface ViewportState extends CameraState {
  canvasSize: ViewportSize;
}

/** Base world render state that games extend */
export interface BaseWorldRenderState {
  gridSize: number;
  offset: ScreenPosition;
  zoom: number;
  speed: number;
  canvasSize: ViewportSize;
}

/** Convert grid coordinates to screen coordinates (isometric projection) */
export function gridToScreen(
  gridX: number,
  gridY: number,
  tileWidth: number = DEFAULT_TILE_WIDTH,
  tileHeight: number = DEFAULT_TILE_HEIGHT
): ScreenPosition {
  return {
    x: (gridX - gridY) * (tileWidth / 2),
    y: (gridX + gridY) * (tileHeight / 2),
  };
}

/** Convert screen coordinates to grid coordinates */
export function screenToGrid(
  screenX: number,
  screenY: number,
  tileWidth: number = DEFAULT_TILE_WIDTH,
  tileHeight: number = DEFAULT_TILE_HEIGHT
): GridPosition {
  const x = (screenX / (tileWidth / 2) + screenY / (tileHeight / 2)) / 2;
  const y = (screenY / (tileHeight / 2) - screenX / (tileWidth / 2)) / 2;
  return { x: Math.floor(x), y: Math.floor(y) };
}

/** Check if a grid position is within bounds */
export function isInBounds(pos: GridPosition, bounds: GridBounds): boolean {
  return pos.x >= bounds.minX && pos.x <= bounds.maxX && 
         pos.y >= bounds.minY && pos.y <= bounds.maxY;
}

/** Check if a grid position is within a grid of given size */
export function isInGrid(pos: GridPosition, gridSize: number): boolean {
  return pos.x >= 0 && pos.x < gridSize && pos.y >= 0 && pos.y < gridSize;
}
