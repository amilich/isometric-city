import type { GameState, Tile } from '@/games/tower/types';
import { createInitialTowerGameState } from '@/games/tower/lib/initialState';
import { TOWER_DEFINITIONS } from '@/games/tower/types/towers';
import { uuid } from '@/games/tower/lib/math';

function placeTower(
  state: GameState,
  x: number,
  y: number,
  towerType: keyof typeof TOWER_DEFINITIONS,
  level: 1 | 2 | 3
): GameState {
  const tile = state.grid[y]?.[x];
  if (!tile || tile.kind !== 'empty' || tile.terrain !== 'grass') return state;

  const nextGrid = state.grid.map((row) => row.slice());
  nextGrid[y] = nextGrid[y]!.slice();
  nextGrid[y]![x] = {
    ...tile,
    tower: {
      id: uuid(`tower-${towerType}`),
      type: towerType as any,
      level,
      targeting: TOWER_DEFINITIONS[towerType].defaultTargeting,
      totalSpent: 0,
      cooldownRemainingTicks: 0,
    },
  };

  return { ...state, grid: nextGrid };
}

export function createTowerExampleState(): GameState {
  const gridSize = 55;
  let state = createInitialTowerGameState('Example Run', gridSize, 424242);
  state = { ...state, money: 2500, lives: 20 };

  const midY = Math.floor(gridSize / 2);
  // Place a mixed defense line on both sides of the path
  state = placeTower(state, 10, midY - 3, 'cannon', 2);
  state = placeTower(state, 10, midY + 3, 'ice', 2);
  state = placeTower(state, 14, midY - 3, 'tesla', 2);
  state = placeTower(state, 14, midY + 3, 'archer', 2);
  state = placeTower(state, 18, midY - 3, 'mortar', 2);
  state = placeTower(state, 22, midY + 3, 'sniper', 2);

  state = {
    ...state,
    stats: { ...state.stats, wave: 3, kills: 0, leaks: 0, moneyEarned: 0, moneySpent: 0 },
    waveState: 'complete',
  };

  return state;
}

