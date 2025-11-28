/**
 * Shared rendering helper utilities for canvas drawing operations
 */

import { BuildingType, Tile } from '@/types/game';
import { TILE_WIDTH, TILE_HEIGHT } from './types';

/**
 * Viewport bounds for culling objects outside the visible area
 */
export interface ViewportBounds {
  viewLeft: number;
  viewTop: number;
  viewRight: number;
  viewBottom: number;
  viewWidth: number;
  viewHeight: number;
}

/**
 * Building types that don't occlude vehicles/pedestrians
 */
const NON_OCCLUDING_TYPES: BuildingType[] = ['road', 'rail', 'grass', 'empty', 'water', 'tree'];

/**
 * Calculate viewport bounds for rendering culling
 */
export function calculateViewportBounds(
  canvas: HTMLCanvasElement,
  offset: { x: number; y: number },
  zoom: number,
  dpr: number,
  padding: { left?: number; right?: number; top?: number; bottom?: number } = {}
): ViewportBounds {
  const viewWidth = canvas.width / (dpr * zoom);
  const viewHeight = canvas.height / (dpr * zoom);
  
  const leftPad = padding.left ?? TILE_WIDTH;
  const rightPad = padding.right ?? TILE_WIDTH;
  const topPad = padding.top ?? TILE_HEIGHT * 2;
  const bottomPad = padding.bottom ?? TILE_HEIGHT * 2;

  return {
    viewWidth,
    viewHeight,
    viewLeft: -offset.x / zoom - leftPad,
    viewTop: -offset.y / zoom - topPad,
    viewRight: viewWidth - offset.x / zoom + rightPad,
    viewBottom: viewHeight - offset.y / zoom + bottomPad,
  };
}

/**
 * Check if an entity at a given tile position is occluded by a building in front of it
 * Uses isometric depth sorting - entities with lower depth (x+y) are behind higher depth
 */
export function isEntityBehindBuilding(
  grid: Tile[][],
  gridSize: number,
  entityTileX: number,
  entityTileY: number
): boolean {
  const entityDepth = entityTileX + entityTileY;

  // Check tiles that could visually cover this entity
  // Only check tiles directly in front (higher depth means drawn later/on top)
  for (let dy = 0; dy <= 1; dy++) {
    for (let dx = 0; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue; // Skip the entity's own tile

      const checkX = entityTileX + dx;
      const checkY = entityTileY + dy;

      // Skip if out of bounds
      if (checkX < 0 || checkY < 0 || checkX >= gridSize || checkY >= gridSize) {
        continue;
      }

      const tile = grid[checkY]?.[checkX];
      if (!tile) continue;

      const buildingType = tile.building.type;

      // Skip tiles that don't occlude (roads, grass, empty, water, trees)
      if (NON_OCCLUDING_TYPES.includes(buildingType)) {
        continue;
      }

      // Check if this building tile has higher depth (drawn after/on top)
      const buildingDepth = checkX + checkY;

      // Only hide if building is strictly in front (higher depth)
      if (buildingDepth > entityDepth) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if a point is within viewport bounds
 */
export function isInViewport(
  x: number,
  y: number,
  bounds: ViewportBounds,
  entityPadding: { x?: number; y?: number } = {}
): boolean {
  const padX = entityPadding.x ?? 0;
  const padY = entityPadding.y ?? 0;
  
  return (
    x >= bounds.viewLeft - padX &&
    x <= bounds.viewRight + padX &&
    y >= bounds.viewTop - padY &&
    y <= bounds.viewBottom + padY
  );
}

/**
 * Setup canvas context with standard transforms for world rendering
 */
export function setupCanvasContext(
  ctx: CanvasRenderingContext2D,
  offset: { x: number; y: number },
  zoom: number,
  dpr: number
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr * zoom, dpr * zoom);
  ctx.translate(offset.x / zoom, offset.y / zoom);
}

/**
 * Clear canvas and reset transforms
 */
export function clearCanvas(ctx: CanvasRenderingContext2D): void {
  const canvas = ctx.canvas;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}
