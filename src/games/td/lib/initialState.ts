/**
 * Tower Defense - Initial state and path generation
 */

import type { GameState, Tile, Tower, Wave } from '../types';

const GRID_SIZE = 14;
const START_MONEY = 150;
const START_LIVES = 20;

/**
 * Generate a simple path from top-left area to bottom-right area
 * Path winds through the grid
 */
function generatePath(): { x: number; y: number }[] {
  const path: { x: number; y: number }[] = [];
  // Spawn at top-left, goal at bottom-right
  // Path: down right edge, then across bottom, then up right side
  for (let y = 0; y < 4; y++) path.push({ x: 1, y });
  for (let x = 1; x < GRID_SIZE - 1; x++) path.push({ x, y: 4 });
  for (let y = 4; y < GRID_SIZE - 2; y++) path.push({ x: GRID_SIZE - 2, y });
  for (let x = GRID_SIZE - 2; x >= 2; x--) path.push({ x, y: GRID_SIZE - 3 });
  for (let y = GRID_SIZE - 3; y < GRID_SIZE; y++) path.push({ x: 2, y });
  path.push({ x: 1, y: GRID_SIZE - 1 }); // Goal
  return path;
}

function createEmptyGrid(path: { x: number; y: number }[]): Tile[][] {
  const pathSet = new Set(path.map((p) => `${p.x},${p.y}`));
  const pathIndexMap = new Map(path.map((p, i) => [`${p.x},${p.y}`, i]));

  const grid: Tile[][] = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      const key = `${x},${y}`;
      const pathIndex = pathIndexMap.get(key) ?? -1;
      const isSpawn = pathIndex === 0;
      const isGoal = pathIndex === path.length - 1;

      row.push({
        x,
        y,
        type: pathSet.has(key) ? (isSpawn ? 'spawn' : isGoal ? 'goal' : 'path') : 'grass',
        tower: null,
        pathIndex,
      });
    }
    grid.push(row);
  }
  return grid;
}

export function createInitialState(): GameState {
  const path = generatePath();

  return {
    id: `td-${Date.now()}`,
    gridSize: GRID_SIZE,
    path,
    grid: createEmptyGrid(path),

    money: START_MONEY,
    lives: START_LIVES,
    startLives: START_LIVES,

    currentWave: 0,
    waveEnemiesRemaining: 0,
    waveSpawnCooldown: 0,
    waveEnemyQueue: [],

    enemies: [],
    projectiles: [],

    tick: 0,
    lastTickAt: 0,
    phase: 'playing',
    speed: 1,

    selectedTool: 'basic',
    selectedTile: null,
    hoveredTile: null,

    gameVersion: 1,
  };
}

/**
 * Predefined waves - gets harder each wave
 */
export function getWave(waveNumber: number): Wave {
  const base = waveNumber + 1;
  return {
    enemies: [
      { type: 'basic', count: 3 + base * 2, delay: 800 },
      { type: 'fast', count: Math.floor(base / 2), delay: 600 },
      { type: 'tank', count: Math.floor(base / 3), delay: 1200 },
    ],
    reward: 50 + waveNumber * 25,
  };
}

export function canPlaceTower(state: GameState, x: number, y: number): boolean {
  if (x < 0 || x >= state.gridSize || y < 0 || y >= state.gridSize) return false;
  const tile = state.grid[y][x];
  return tile.type === 'grass' && tile.tower === null;
}

import { TOWER_STATS } from '../types/game';

export function getTowerCost(type: Tower['type']): number {
  return TOWER_STATS[type].cost;
}
