import type { GameState, Tile } from '@/games/tower/types';
import { createEmptyTile } from '@/games/tower/types';
import { applyPathToGrid, generateStraightMidPath } from '@/games/tower/lib/pathing';
import { uuid } from '@/games/tower/lib/math';

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function carvePonds(grid: Tile[][], gridSize: number, seed: number) {
  const rand = mulberry32(seed);
  const pondCount = 2 + Math.floor(rand() * 2); // 2-3 ponds
  const midY = Math.floor(gridSize / 2);

  for (let i = 0; i < pondCount; i++) {
    const radius = 3 + Math.floor(rand() * 3); // 3-5
    const cx = Math.floor(rand() * (gridSize - radius * 2)) + radius;
    let cy = Math.floor(rand() * (gridSize - radius * 2)) + radius;

    // Keep ponds away from the path row so we don't block the main lane.
    if (Math.abs(cy - midY) <= radius + 1) {
      cy = cy < midY ? Math.max(radius, midY - radius - 3) : Math.min(gridSize - radius - 1, midY + radius + 3);
    }

    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) continue;
        const dx = x - cx;
        const dy = y - cy;
        const d2 = dx * dx + dy * dy;
        const r2 = radius * radius;
        // soft edge
        if (d2 <= r2 && rand() > 0.12) {
          grid[y]![x] = { ...grid[y]![x]!, terrain: 'water' };
        }
      }
    }
  }
}

export function createInitialTowerGameState(name?: string, gridSize: number = 60, seed?: number): GameState {
  const actualSeed = seed ?? Math.floor(Math.random() * 1_000_000_000);
  const id = uuid('tower-run');

  const grid: Tile[][] = [];
  for (let y = 0; y < gridSize; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < gridSize; x++) {
      row.push(createEmptyTile(x, y));
    }
    grid.push(row);
  }

  // Add some water features for visual interest / placement constraints.
  carvePonds(grid, gridSize, actualSeed);

  const { path, spawn, base } = generateStraightMidPath(gridSize);
  applyPathToGrid(grid, path, spawn, base);

  // Ensure path tiles are always grass (walkable).
  for (const p of path) {
    const tile = grid[p.y]?.[p.x];
    if (tile) {
      grid[p.y]![p.x] = { ...tile, terrain: 'grass' };
    }
  }

  return {
    id,
    seed: actualSeed,
    gridSize,
    grid,
    tick: 0,
    speed: 1,
    selectedTool: 'select',
    activePanel: 'none',

    money: 300,
    lives: 20,

    path,
    spawn,
    base,

    enemies: [],
    projectiles: [],

    waveState: 'idle',
    waveSpawnQueue: [],

    settings: {
      name: name ?? 'IsoTower Run',
      difficulty: 'normal',
      showGrid: true,
    },
    stats: {
      wave: 0,
      kills: 0,
      leaks: 0,
      moneyEarned: 0,
      moneySpent: 0,
    },
  };
}

