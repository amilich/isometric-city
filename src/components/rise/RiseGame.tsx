'use client';

import React, { useMemo } from 'react';
import { useRiseGame } from '@/context/RiseGameContext';
import { RiseCanvas } from './RiseCanvas';
import { AGE_CONFIGS, BUILDING_COSTS, UNIT_COSTS, POP_COST, BUILDING_AGE_REQ, UNIT_AGE_REQ } from '@/games/rise/constants';
import { ResourcePool } from '@/games/rise/types';
import { RiseMinimap } from './RiseMinimap';
import { TILE_HEIGHT, TILE_WIDTH } from '@/components/game/types';
import { TopStats } from './TopStats';
import { SelectionPanel } from './SelectionPanel';
import { Tips } from './Tips';
import { AgeProgress } from './AgeProgress';
import { Legend } from './Legend';

const SPEED_LABELS: Record<0 | 1 | 2 | 3, string> = {
  0: 'Pause',
  1: '1x',
  2: '2x',
  3: '4x',
};

export default function RiseGame() {
  const { state, setSpeed, spawnCitizen, trainUnit, ageUp, setAIDifficulty, restart } = useRiseGame();
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

  const meetsAge = React.useCallback(
    (required: string | undefined) => {
      if (!required) return true;
      if (!player) return false;
      return AGE_CONFIGS.findIndex(a => a.id === player.age) >= AGE_CONFIGS.findIndex(a => a.id === required);
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

  const viewport = React.useMemo(() => {
    const canvasW = 1400;
    const canvasH = 900;
    const corners = [
      { sx: 0, sy: 0 },
      { sx: canvasW, sy: 0 },
      { sx: 0, sy: canvasH },
      { sx: canvasW, sy: canvasH },
    ];
    const toGrid = (sx: number, sy: number) => {
      const adjustedX = sx - offset.x - TILE_WIDTH / 2;
      const adjustedY = sy - offset.y - TILE_HEIGHT / 2;
      const gx = (adjustedX / (TILE_WIDTH / 2) + adjustedY / (TILE_HEIGHT / 2)) / 2;
      const gy = (adjustedY / (TILE_HEIGHT / 2) - adjustedX / (TILE_WIDTH / 2)) / 2;
      return { x: Math.round(gx), y: Math.round(gy) };
    };
    const points = corners.map(c => toGrid(c.sx, c.sy));
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    const xs = points.map(p => clamp(p.x, 0, state.gridSize - 1));
    const ys = points.map(p => clamp(p.y, 0, state.gridSize - 1));
    return {
      x1: Math.min(...xs),
      y1: Math.min(...ys),
      x2: Math.max(...xs),
      y2: Math.max(...ys),
    };
  }, [offset, state.gridSize]);

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

  // Hotkeys for speed / actions
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.key === '1') setSpeed(1);
      if (e.key === '2') setSpeed(2);
      if (e.key === '3') setSpeed(3);
      if (e.key === '0' || e.key === ' ') setSpeed(0);
      if (e.key.toLowerCase() === 'r') restart();
      if (e.key.toLowerCase() === 'c') spawnCitizen();
      if (e.key.toLowerCase() === 'a') ageUp();
      if (e.key.toLowerCase() === 'b') setActiveBuild('barracks');
      if (e.key.toLowerCase() === 'f') setActiveBuild('farm');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setSpeed, restart, spawnCitizen, ageUp]);

  if (!player) return null;

  return (
    <div className="w-full h-full min-h-screen bg-slate-950 text-slate-100 flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between gap-4">
        <TopStats resources={player.resources} ageId={player.age} elapsedSeconds={state.elapsedSeconds} />
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
          <div className="text-[11px] text-slate-400">{ageUpInfo.reason}</div>
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
          <div className="flex items-center gap-1 bg-slate-900/80 border border-slate-800 rounded-lg px-2 py-1">
            <span className="text-xs uppercase text-slate-400">Status</span>
            <span
              className={`px-2 py-1 text-xs rounded-md ${
                state.gameStatus === 'playing'
                  ? 'bg-emerald-600/30 text-emerald-200'
                  : state.gameStatus === 'won'
                  ? 'bg-amber-500/30 text-amber-200'
                  : 'bg-rose-500/30 text-rose-200'
              }`}
            >
              {state.gameStatus}
            </span>
            <button
              className="px-2 py-1 text-xs rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200"
              onClick={restart}
            >
              Restart
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
                const requiredAge = BUILDING_AGE_REQ[b] || 'classics';
                const hasAge = meetsAge(requiredAge);
                const affordable = cost ? canAfford(cost) : true;
                const enabled = hasAge && affordable && state.gameStatus === 'playing';
                const titleParts: string[] = [];
                if (cost) titleParts.push(Object.entries(cost).map(([k,v]) => `${k}:${v}`).join(' '));
                if (!hasAge) titleParts.push(`Requires ${requiredAge}`);
                return (
                  <button
                    key={b}
                    onClick={() => enabled && setActiveBuild(b)}
                    className={`text-left px-2 py-1 rounded-md text-xs border ${activeBuild===b?'border-amber-400 bg-slate-800 text-amber-300':'border-slate-700 bg-slate-800/60 text-slate-200'} ${enabled?'hover:border-slate-500':'opacity-50 cursor-not-allowed'}`}
                    title={titleParts.join(' | ')}
                    disabled={!enabled}
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
                const requiredAge = UNIT_AGE_REQ[t] || 'classics';
                const hasAge = meetsAge(requiredAge);
                const affordable = cost ? canAfford(cost) : true;
                const hasPop = player.resources.population + pop <= player.resources.popCap;
                const enabled = hasAge && affordable && hasPop && state.gameStatus === 'playing';
                const titleParts: string[] = [`pop:${pop}`];
                if (cost) titleParts.push(Object.entries(cost).map(([k,v])=>`${k}:${v}`).join(' '));
                if (!hasAge) titleParts.push(`Requires ${requiredAge}`);
                if (!hasPop) titleParts.push('Pop cap reached');
                return (
                  <button
                    key={t}
                    className={`px-2 py-1 rounded-md text-xs ${enabled ? 'bg-slate-800/60 hover:bg-slate-800' : 'bg-slate-800/40 text-slate-500 cursor-not-allowed'}`}
                    onClick={() => enabled && trainUnit(t)}
                    title={titleParts.join(' | ')}
                    disabled={!enabled}
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
          <Legend />
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
                  onClick={restart}
                >
                  Restart
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="w-64 space-y-3">
          <RiseMinimap state={state} onNavigate={centerOnTile} viewport={viewport} />
          <AgeProgress age={player.age} elapsedSinceAge={state.elapsedSeconds - (player.ageStartSeconds ?? 0)} />
        </div>
      </div>

      <div className="flex gap-2 text-xs text-slate-400">
        <span>Left drag: select units. Right click: move / gather / attack. Select a build to place it with left click.</span>
      </div>
    </div>
  );
}
