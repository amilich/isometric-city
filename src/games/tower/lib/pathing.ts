import type { Tile, TileKind } from '@/games/tower/types';

/**
 * Very simple deterministic path generator for MVP.
 *
 * Produces a single-tile-wide path:
 * - Spawn at x=0, y=mid
 * - Base at x=gridSize-1, y=mid
 * - Straight horizontal path in grid-space (increasing x)
 */
export function generateStraightMidPath(gridSize: number): {
  path: { x: number; y: number }[];
  spawn: { x: number; y: number };
  base: { x: number; y: number };
} {
  const midY = Math.floor(gridSize / 2);
  const path: { x: number; y: number }[] = [];
  for (let x = 0; x < gridSize; x++) {
    path.push({ x, y: midY });
  }

  return {
    path,
    spawn: path[0]!,
    base: path[path.length - 1]!,
  };
}

export function applyPathToGrid(grid: Tile[][], path: { x: number; y: number }[], spawn: { x: number; y: number }, base: { x: number; y: number }) {
  for (const p of path) {
    const tile = grid[p.y]?.[p.x];
    if (tile) {
      tile.kind = 'path';
    }
  }

  const spawnTile = grid[spawn.y]?.[spawn.x];
  if (spawnTile) spawnTile.kind = 'spawn';

  const baseTile = grid[base.y]?.[base.x];
  if (baseTile) baseTile.kind = 'base';
}

export function isBuildableTileKind(kind: TileKind): boolean {
  return kind === 'empty';
}

