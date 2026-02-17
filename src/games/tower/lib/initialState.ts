import type { GameState, Tile } from '@/games/tower/types';
import { createEmptyTile } from '@/games/tower/types';
import { applyPathToGrid, generateStraightMidPath } from '@/games/tower/lib/pathing';
import { uuid } from '@/games/tower/lib/math';

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

  const { path, spawn, base } = generateStraightMidPath(gridSize);
  applyPathToGrid(grid, path, spawn, base);

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

