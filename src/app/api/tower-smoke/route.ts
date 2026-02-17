import { NextResponse } from 'next/server';
import { createInitialTowerGameState } from '@/games/tower/lib/initialState';
import { simulateTowerTick, startWaveState } from '@/games/tower/lib/simulateTick';
import { TOWER_DEFINITIONS } from '@/games/tower/types/towers';
import { uuid } from '@/games/tower/lib/math';

/**
 * Lightweight, headless smoke test endpoint for the tower defense simulation.
 * Useful in environments where we can't interact with the UI directly.
 *
 * Query params (optional):
 * - wave: simulate a specific wave number (e.g. 6 for flyers)
 * - waves: simulate N waves sequentially starting from wave 1
 * - noTowers: if "1", do not place any towers (useful for leak/game-over behavior)
 * - maxTicks: hard cap on simulation ticks (default 2000)
 */
export function GET(req: Request) {
  const url = new URL(req.url);
  const waveParam = Number(url.searchParams.get('wave') ?? '');
  const wavesParam = Number(url.searchParams.get('waves') ?? '');
  const requestedSingleWave = Number.isFinite(waveParam) && waveParam > 0 ? Math.floor(waveParam) : null;
  const wavesToSimulate =
    Number.isFinite(wavesParam) && wavesParam > 0 ? Math.min(20, Math.floor(wavesParam)) : requestedSingleWave ? 1 : 1;
  const noTowers = url.searchParams.get('noTowers') === '1';
  const maxTicksParam = Number(url.searchParams.get('maxTicks') ?? '');
  const maxTicks = Number.isFinite(maxTicksParam) && maxTicksParam > 0 ? Math.min(20000, Math.floor(maxTicksParam)) : 2000;

  const gridSize = 30;
  let state = createInitialTowerGameState('Smoke Test', gridSize, 12345);

  // Give plenty of money for the test.
  state = { ...state, money: 99999 };

  if (requestedSingleWave) {
    // Jump directly to a later wave by setting current wave to N-1.
    state = {
      ...state,
      waveState: 'idle',
      waveSpawnQueue: [],
      stats: { ...state.stats, wave: Math.max(0, requestedSingleWave - 1) },
    };
  }

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

  let towersPlaced = 0;
  if (!noTowers) {
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
      towersPlaced += 1;
    }
  }

  let wavesSimulated = 0;
  for (let w = 0; w < wavesToSimulate; w++) {
    if (state.waveState === 'game_over') break;
    state = startWaveState(state);
    wavesSimulated += 1;

    for (let i = 0; i < maxTicks; i++) {
      state = simulateTowerTick(state);
      if (state.waveState === 'complete' || state.waveState === 'game_over') break;
    }

    if (state.waveState === 'game_over') break;
  }

  return NextResponse.json({
    ok: true,
    tick: state.tick,
    wave: state.stats.wave,
    waveState: state.waveState,
    wavesSimulated,
    kills: state.stats.kills,
    leaks: state.stats.leaks,
    money: state.money,
    lives: state.lives,
    towersPlaced,
    noTowers,
    enemiesRemaining: state.enemies.length,
    projectilesRemaining: state.projectiles.length,
  });
}

