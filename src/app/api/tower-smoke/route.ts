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

  // Place towers near the early path so it can get kills.
  const anchor = state.path[Math.min(10, state.path.length - 1)] ?? state.spawn;

  function findEmptyNear(targetX: number, targetY: number): { x: number; y: number } | null {
    for (let r = 0; r <= 6; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const x = targetX + dx;
          const y = targetY + dy;
          if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) continue;
          const tile = state.grid[y]?.[x];
          if (!tile) continue;
          if (tile.kind !== 'empty') continue;
          if (tile.terrain !== 'grass') continue;
          return { x, y };
        }
      }
    }
    return null;
  }

  const placements: Array<{ dx: number; dy: number; type: 'tesla' | 'cannon' | 'mortar'; level: 1 | 2 | 3 }> = [
    { dx: 2, dy: -3, type: 'tesla', level: 3 },
    { dx: 2, dy: 3, type: 'cannon', level: 3 },
    { dx: 6, dy: -3, type: 'mortar', level: 3 },
  ];

  state.grid = state.grid.map((row) => row.slice());
  for (const p of placements) {
    const pos = findEmptyNear(anchor.x + p.dx, anchor.y + p.dy);
    if (!pos) continue;
    const tile = state.grid[pos.y]?.[pos.x];
    if (!tile || tile.kind !== 'empty' || tile.terrain !== 'grass') continue;
    state.grid[pos.y] = state.grid[pos.y]!.slice();
    state.grid[pos.y]![pos.x] = {
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

