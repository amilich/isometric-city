'use client';

import React, { useMemo } from 'react';
import { useRiseGame } from '@/context/RiseGameContext';
import { RiseCanvas } from './RiseCanvas';
import { AGE_CONFIGS } from '@/games/rise/constants';
import { BUILDING_COSTS, UNIT_COSTS, POP_COST } from '@/games/rise/constants';
import { ResourcePool } from '@/games/rise/types';
import { RiseMinimap } from './RiseMinimap';
import { TILE_HEIGHT, TILE_WIDTH } from '@/components/game/types';
import { TopStats } from './TopStats';
import { SelectionPanel } from './SelectionPanel';
import { Tips } from './Tips';

const SPEED_LABELS: Record<0 | 1 | 2 | 3, string> = {
  0: 'Pause',
  1: '1x',
  2: '2x',
  3: '4x',
};

export default function RiseGame() {
  const { state, setSpeed, spawnCitizen, trainUnit, ageUp, setAIDifficulty } = useRiseGame();
  const [activeBuild, setActiveBuild] = React.useState<string | null>(null);
  const [offset, setOffset] = React.useState<{ x: number; y: number }>({ x: 520, y: 120 });
  const player = state.players.find(p => p.id === state.localPlayerId);
  const ageLabel = useMemo(() => {
    if (!player) return '';
    const cfg = AGE_CONFIGS.find(a => a.id === player.age);
    return cfg?.label ?? player.age;
  }, [player]);
  const ai = state.players.find(p => p.id === 'ai');

  const canAfford = React.useCallback(
    (cost: Partial<ResourcePool>) => {
      if (!player) return false;
      for (const key of Object.keys(cost) as (keyof ResourcePool)[]) {
        if ((player.resources[key] ?? 0) < (cost[key] ?? 0)) return false;
      }
      return true;
    },
    [player]
  );

  const centerOnTile = (tx: number, ty: number) => {
    const canvasW = 1400;
    const canvasH = 900;
    const ox = canvasW / 2 - (tx - ty) * (TILE_WIDTH / 2);
    const oy = canvasH / 2 - (tx + ty) * (TILE_HEIGHT / 2);
    setOffset({ x: ox, y: oy });
  };

  const centerOnCity = (ownerId: string) => {
    const city = state.buildings.find(b => b.ownerId === ownerId && b.type === 'city_center');
    if (city) {
      centerOnTile(city.tile.x, city.tile.y);
    }
  };

  const ageUpInfo = React.useMemo(() => {
    if (!player) return { can: false, reason: 'No player' };
    const currentIndex = AGE_CONFIGS.findIndex(a => a.id === player.age);
    const next = AGE_CONFIGS[currentIndex + 1];
    if (!next) return { can: false, reason: 'Max age' };
    const elapsedSinceAge = state.elapsedSeconds - (player.ageStartSeconds ?? 0);
    if (elapsedSinceAge < (next.minDurationSeconds ?? 0)) {
      const remaining = Math.max(0, Math.ceil(next.minDurationSeconds - elapsedSinceAge));
      return { can: false, reason: `Locked ${remaining}s` };
    }
    if (!canAfford(next.nextCost || {})) {
      return { can: false, reason: 'Need resources' };
    }
    return { can: true, reason: 'Ready' };
  }, [player, state.elapsedSeconds, canAfford]);

  if (!player) return null;

  return (
    <div className="w-full h-full min-h-screen bg-slate-950 text-slate-100 flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between gap-4">
        <TopStats resources={player.resources} ageId={player.age} />
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-md text-sm font-semibold"
            onClick={spawnCitizen}
            disabled={state.gameStatus !== 'playing'}
          >
            Spawn Citizen
          </button>
          <button
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-md text-sm font-semibold"
            onClick={ageUp}
            disabled={!ageUpInfo.can}
            title={ageUpInfo.reason}
          >
            Age Up
          </button>
          <div className="flex items-center gap-1 bg-slate-900/80 border border-slate-800 rounded-lg px-2 py-1">
            {([0, 1, 2, 3] as const).map(s => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-2 py-1 rounded-md text-xs font-semibold ${
                  state.speed === s ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {SPEED_LABELS[s]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-slate-900/80 border border-slate-800 rounded-lg px-2 py-1">
            <span className="text-xs text-slate-400">AI</span>
            {(['easy','medium','hard'] as const).map(d => (
              <button
                key={d}
                onClick={() => setAIDifficulty(d)}
                className={`px-2 py-1 rounded-md text-xs font-semibold ${
                  ai?.controller.difficulty === d ? 'bg-amber-500 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-slate-900/80 border border-slate-800 rounded-lg px-2 py-1">
            <button
              className="px-2 py-1 text-xs rounded-md bg-slate-800 hover:bg-slate-700"
              onClick={() => centerOnCity(state.localPlayerId)}
            >
              Center on City
            </button>
            <button
              className="px-2 py-1 text-xs rounded-md bg-slate-800 hover:bg-slate-700"
              onClick={() => centerOnCity('ai')}
            >
              Enemy City
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="w-72 bg-slate-900/70 border border-slate-800 rounded-lg p-3 flex flex-col gap-3">
          <div>
            <div className="text-xs uppercase text-slate-400 mb-1">Build</div>
            <div className="grid grid-cols-2 gap-2">
              {['farm','lumber_camp','mine','house','barracks','factory','siege_factory','airbase','market','library','university','oil_rig','tower','fort'].map(b => {
                const cost = BUILDING_COSTS[b as keyof typeof BUILDING_COSTS];
                const affordable = canAfford(cost || {});
                return (
                  <button
                    key={b}
                    onClick={() => affordable && setActiveBuild(b)}
                    className={`text-left px-2 py-1 rounded-md text-xs border ${activeBuild===b?'border-amber-400 bg-slate-800 text-amber-300':'border-slate-700 bg-slate-800/60 text-slate-200'} ${affordable?'hover:border-slate-500':'opacity-50 cursor-not-allowed'}`}
                    title={cost ? Object.entries(cost).map(([k,v]) => `${k}:${v}`).join(' ') : ''}
                    disabled={!affordable}
                  >
                    {b.replace('_',' ')}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-400 mb-1">Train</div>
            <div className="grid grid-cols-2 gap-2">
              {(['infantry','ranged','vehicle','siege','air'] as const).map(t => {
                const cost = UNIT_COSTS[t];
                const pop = POP_COST[t] ?? 1;
                const affordable = canAfford(cost || {}) && player.resources.population + pop <= player.resources.popCap;
                return (
                  <button
                    key={t}
                    className={`px-2 py-1 rounded-md text-xs ${affordable ? 'bg-slate-800/60 hover:bg-slate-800' : 'bg-slate-800/40 text-slate-500 cursor-not-allowed'}`}
                    onClick={() => affordable && trainUnit(t)}
                    title={`${Object.entries(cost||{}).map(([k,v])=>`${k}:${v}`).join(' ')} pop:${pop}`}
                    disabled={!affordable}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="text-xs text-slate-400">
            Left click: place building (when a build is selected). Drag: select units. Right click: move / gather / attack.
          </div>
          <SelectionPanel state={state} />
          <Tips />
        </div>

        <div className="relative flex-1 min-h-[720px] rounded-lg overflow-hidden border border-slate-800 bg-slate-900/60">
          <RiseCanvas activeBuild={activeBuild} onBuildPlaced={() => setActiveBuild(null)} offset={offset} />
          {state.gameStatus !== 'playing' && (
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-slate-900/90 border border-slate-700 rounded-xl px-6 py-4 text-center shadow-xl space-y-3">
                <div className="text-xl font-bold text-slate-100">
                  {state.gameStatus === 'won' ? 'Victory!' : 'Defeat'}
                </div>
                <div className="text-sm text-slate-300">City center {state.gameStatus === 'won' ? 'captured' : 'lost'}.</div>
                <button
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-md text-sm font-semibold text-white"
                  onClick={() => window.location.reload()}
                >
                  Restart
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="w-64">
          <RiseMinimap state={state} onNavigate={centerOnTile} />
        </div>
      </div>

      <div className="flex gap-2 text-xs text-slate-400">
        <span>Left drag: select units. Right click: move / gather / attack. Select a build to place it with left click.</span>
      </div>
    </div>
  );
}
