import { NextResponse } from 'next/server';
import { createInitialTowerGameState } from '@/games/tower/lib/initialState';
import { simulateTowerTick, startWaveState } from '@/games/tower/lib/simulateTick';
import { TOWER_DEFINITIONS } from '@/games/tower/types/towers';
import { uuid } from '@/games/tower/lib/math';

/**
 * Lightweight, headless smoke test endpoint for the tower defense simulation.
 * Useful in environments where we can't interact with the UI directly.
 */
export function GET() {
  const gridSize = 30;
  let state = createInitialTowerGameState('Smoke Test', gridSize, 12345);

  // Give plenty of money for the test.
  state = { ...state, money: 99999 };

  // Place a tesla tower near the middle of the path so it can get kills.
  const midY = Math.floor(gridSize / 2);
  const placements: Array<{ x: number; y: number; type: 'tesla' | 'cannon' | 'mortar'; level: 1 | 2 | 3 }> = [
    { x: 8, y: midY - 2, type: 'tesla', level: 3 },
    { x: 8, y: midY + 2, type: 'cannon', level: 3 },
    { x: 13, y: midY - 2, type: 'mortar', level: 3 },
  ];

  state.grid = state.grid.map((row) => row.slice());
  for (const p of placements) {
    const tile = state.grid[p.y]?.[p.x];
    if (!tile || tile.kind !== 'empty') continue;
    state.grid[p.y] = state.grid[p.y]!.slice();
    state.grid[p.y]![p.x] = {
      ...tile,
      tower: {
        id: uuid(`tower-${p.type}`),
        type: p.type,
        level: p.level,
        targeting: TOWER_DEFINITIONS[p.type].defaultTargeting,
        totalSpent: 0,
        cooldownRemainingTicks: 0,
      },
    };
  }

  state = startWaveState(state);

  const maxTicks = 2000;
  for (let i = 0; i < maxTicks; i++) {
    state = simulateTowerTick(state);
    if (state.waveState === 'complete' || state.waveState === 'game_over') break;
  }

  return NextResponse.json({
    ok: true,
    tick: state.tick,
    wave: state.stats.wave,
    waveState: state.waveState,
    kills: state.stats.kills,
    leaks: state.stats.leaks,
    money: state.money,
    lives: state.lives,
    enemiesRemaining: state.enemies.length,
    projectilesRemaining: state.projectiles.length,
  });
}

