import type { Tile, TileKind } from '@/games/tower/types';

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

/**
 * Default tower-defense path generator (seeded).
 *
 * Generates a simple zig-zag path from left → right with 2 vertical turns,
 * while keeping the start and end roughly centered for readability.
 */
export function generateDefaultPath(gridSize: number, seed: number): {
  path: { x: number; y: number }[];
  spawn: { x: number; y: number };
  base: { x: number; y: number };
} {
  const rand = mulberry32(seed);
  const midY = Math.floor(gridSize / 2);
  const clampY = (y: number) => Math.max(4, Math.min(gridSize - 5, y));

  const x1 = Math.floor(gridSize * 0.22);
  const x2 = Math.floor(gridSize * 0.55);
  const x3 = Math.floor(gridSize * 0.78);

  const offsetA = 5 + Math.floor(rand() * 7); // 5-11
  const offsetB = 4 + Math.floor(rand() * 8); // 4-11
  const dirA = rand() < 0.5 ? -1 : 1;
  const dirB = dirA * (rand() < 0.5 ? -1 : 1);

  const yA = clampY(midY + dirA * offsetA);
  const yB = clampY(yA + dirB * offsetB);

  const waypoints: Array<{ x: number; y: number }> = [
    { x: 0, y: midY },
    { x: x1, y: midY },
    { x: x1, y: yA },
    { x: x2, y: yA },
    { x: x2, y: yB },
    { x: x3, y: yB },
    { x: x3, y: midY },
    { x: gridSize - 1, y: midY },
  ];

  const path: Array<{ x: number; y: number }> = [];

  function pushIfNew(p: { x: number; y: number }) {
    const last = path[path.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) path.push(p);
  }

  function addLine(from: { x: number; y: number }, to: { x: number; y: number }) {
    let x = from.x;
    let y = from.y;
    pushIfNew({ x, y });
    while (x !== to.x || y !== to.y) {
      if (x < to.x) x += 1;
      else if (x > to.x) x -= 1;
      else if (y < to.y) y += 1;
      else if (y > to.y) y -= 1;
      pushIfNew({ x, y });
    }
  }

  for (let i = 0; i < waypoints.length - 1; i++) {
    addLine(waypoints[i]!, waypoints[i + 1]!);
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

