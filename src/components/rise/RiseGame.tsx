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
import { useGT, msg, useMessages } from 'gt-next';

const SPEED_LABELS: Record<0 | 1 | 2 | 3, string> = {
  0: msg('Pause'),
  1: '1x',
  2: '2x',
  3: '4x',
};

export default function RiseGame() {
  const gt = useGT();
  const m = useMessages();
  const { state, setSpeed, spawnCitizen, trainUnit, ageUp, setAIDifficulty, restart, selectUnits } = useRiseGame();
  const [activeBuild, setActiveBuild] = React.useState<string | null>(null);
  const [offset, setOffset] = React.useState<{ x: number; y: number }>({ x: 520, y: 120 });
  const [showAlerts, setShowAlerts] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = window.localStorage.getItem('rise_show_alerts');
    return stored === null ? true : stored === 'true';
  });
  const player = state.players.find(p => p.id === state.localPlayerId);
  const ageLabel = useMemo(() => {
    if (!player) return '';
    const cfg = AGE_CONFIGS.find(a => a.id === player.age);
    return cfg?.label ?? player.age;
  }, [player]);
  const ai = state.players.find(p => p.id === 'ai');
  const idleCycleRef = React.useRef(0);
  const selectArmyRef = React.useRef(0);
  const underAttack = React.useMemo(
    () =>
      state.gameStatus === 'playing' &&
      (state.buildings.some(b => b.ownerId === state.localPlayerId && b.hp < b.maxHp) ||
        state.units.some(u => u.ownerId === state.localPlayerId && u.hp < u.maxHp)),
    [state.buildings, state.units, state.localPlayerId, state.gameStatus]
  );
  const alertInfo = React.useMemo(() => {
    if (!state.lastDamageAt) return null;
    const age = state.elapsedSeconds - state.lastDamageAt.time;
    return { age, x: state.lastDamageAt.x, y: state.lastDamageAt.y };
  }, [state.lastDamageAt, state.elapsedSeconds]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('rise_show_alerts', showAlerts ? 'true' : 'false');
  }, [showAlerts]);

  const hotkeyInfo = React.useMemo(
    () => [
      { label: msg('Speed 1/2/3/0'), keys: '1/2/3/0' },
      { label: msg('Pause'), keys: 'Space' },
      { label: msg('Spawn citizen'), keys: 'C' },
      { label: msg('Age up'), keys: 'A' },
      { label: msg('Build barracks'), keys: 'B' },
      { label: msg('Build farm'), keys: 'F' },
      { label: msg('Idle worker'), keys: 'I' },
      { label: msg('Army group'), keys: 'M' },
      { label: msg('Center on city/enemy'), keys: 'H / E' },
      { label: msg('Jump to alert'), keys: 'J' },
      { label: msg('Toggle alerts'), keys: 'L' },
      { label: msg('Pan'), keys: 'WASD / Arrows' },
      { label: msg('Cancel/Clear'), keys: 'Esc' },
    ],
    []
  );

  const panCamera = React.useCallback((dx: number, dy: number) => {
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  }, []);

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

  const centerOnTile = React.useCallback((tx: number, ty: number) => {
    const canvasW = 1400;
    const canvasH = 900;
    const ox = canvasW / 2 - (tx - ty) * (TILE_WIDTH / 2);
    const oy = canvasH / 2 - (tx + ty) * (TILE_HEIGHT / 2);
    setOffset({ x: ox, y: oy });
  }, []);

  const centerOnCity = React.useCallback(
    (ownerId: string) => {
      const city = state.buildings.find(b => b.ownerId === ownerId && b.type === 'city_center');
      if (city) {
        centerOnTile(city.tile.x, city.tile.y);
      }
    },
    [state.buildings, centerOnTile]
  );

  const selectNextIdleCitizen = React.useCallback(() => {
    const idle = state.units.filter(
      u => u.ownerId === state.localPlayerId && u.type === 'citizen' && u.order.kind === 'idle'
    );
    if (idle.length === 0) return;
    idleCycleRef.current = (idleCycleRef.current + 1) % idle.length;
    const pick = idle[idleCycleRef.current];
    selectUnits([pick.id]);
  }, [state.units, state.localPlayerId, selectUnits]);

  const selectNextArmyGroup = React.useCallback(() => {
    const army = state.units.filter(u => u.ownerId === state.localPlayerId && u.type !== 'citizen');
    if (army.length === 0) return;
    const chunkSize = 12;
    const groupCount = Math.ceil(army.length / chunkSize);
    selectArmyRef.current = (selectArmyRef.current + 1) % groupCount;
    const start = selectArmyRef.current * chunkSize;
    const group = army.slice(start, start + chunkSize);
    selectUnits(group.map(u => u.id));
  }, [state.units, state.localPlayerId, selectUnits]);

  const jumpToLastAttack = React.useCallback(() => {
    if (!state.lastDamageAt) return;
    centerOnTile(state.lastDamageAt.x, state.lastDamageAt.y);
  }, [state.lastDamageAt, centerOnTile]);

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
    if (!player) return { can: false, reason: gt('No player') };
    const currentIndex = AGE_CONFIGS.findIndex(a => a.id === player.age);
    const next = AGE_CONFIGS[currentIndex + 1];
    if (!next) return { can: false, reason: gt('Max age') };
    const elapsedSinceAge = state.elapsedSeconds - (player.ageStartSeconds ?? 0);
    if (elapsedSinceAge < (next.minDurationSeconds ?? 0)) {
      const remaining = Math.max(0, Math.ceil(next.minDurationSeconds - elapsedSinceAge));
      return { can: false, reason: gt('Locked {remaining}s', { remaining }) };
    }
    if (!canAfford(next.nextCost || {})) {
      return { can: false, reason: gt('Need resources') };
    }
    return { can: true, reason: gt('Ready') };
  }, [player, state.elapsedSeconds, canAfford, gt]);

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
      if (e.key.toLowerCase() === 'i') selectNextIdleCitizen();
      if (e.key.toLowerCase() === 'm') selectNextArmyGroup();
      if (e.key.toLowerCase() === 'j') {
        jumpToLastAttack();
      }
      if (e.key.toLowerCase() === 'l') {
        setShowAlerts(prev => !prev);
      }
      if (e.key.toLowerCase() === 'h') centerOnCity(state.localPlayerId);
      if (e.key.toLowerCase() === 'e') centerOnCity('ai');
      if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') {
        e.preventDefault();
        panCamera(0, -40);
      }
      if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') {
        e.preventDefault();
        panCamera(0, 40);
      }
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
        e.preventDefault();
        panCamera(-60, 0);
      }
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
        e.preventDefault();
        panCamera(60, 0);
      }
      if (e.key === 'Escape') {
        setActiveBuild(null);
        selectUnits([]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setSpeed, restart, spawnCitizen, ageUp, selectNextIdleCitizen, selectNextArmyGroup, selectUnits, panCamera, centerOnCity, state.localPlayerId, jumpToLastAttack]);

  if (!player) return null;

  return (
    <div className="w-full h-full min-h-screen bg-slate-950 text-slate-100 flex flex-col gap-3 p-3">
      {showAlerts && alertInfo && alertInfo.age < 8 && (
        <div className="fixed top-4 right-4 z-40">
          <div className="bg-rose-900/80 border border-rose-700 rounded-lg px-4 py-3 shadow-xl text-sm text-rose-50 flex items-center gap-3">
            <div className="flex flex-col">
              <span className="font-semibold">{gt('Under attack!')}</span>
              <span className="text-xs text-rose-100/80">{gt('Alert {age}s ago', { age: Math.max(0, Math.floor(alertInfo.age)) })}</span>
            </div>
            <button
              className="px-3 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
              onClick={jumpToLastAttack}
              title={gt('Jump to last alert (J)')}
            >
              {gt('Jump (J)')}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <TopStats resources={player.resources} ageId={player.age} elapsedSeconds={state.elapsedSeconds} />
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-md text-sm font-semibold"
            onClick={spawnCitizen}
            disabled={state.gameStatus !== 'playing'}
          >
            {gt('Spawn Citizen')}
          </button>
          <button
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-md text-sm font-semibold"
            onClick={ageUp}
            disabled={!ageUpInfo.can}
            title={ageUpInfo.reason}
          >
            {gt('Age Up')}
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
                {m(SPEED_LABELS[s])}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-slate-900/80 border border-slate-800 rounded-lg px-2 py-1">
            <span className="text-xs text-slate-400">{gt('AI')}</span>
            {(['easy','medium','hard'] as const).map(d => (
              <button
                key={d}
                onClick={() => setAIDifficulty(d)}
                className={`px-2 py-1 rounded-md text-xs font-semibold ${
                  ai?.controller.difficulty === d ? 'bg-amber-500 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                {d === 'easy' ? gt('easy') : d === 'medium' ? gt('medium') : gt('hard')}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-slate-900/80 border border-slate-800 rounded-lg px-2 py-1">
            <button
              className="px-2 py-1 text-xs rounded-md bg-slate-800 hover:bg-slate-700"
              onClick={() => centerOnCity(state.localPlayerId)}
            >
              {gt('Center on City')}
            </button>
            <button
              className="px-2 py-1 text-xs rounded-md bg-slate-800 hover:bg-slate-700"
              onClick={() => centerOnCity('ai')}
            >
              {gt('Enemy City')}
            </button>
          </div>
          <div className="flex items-center gap-1 bg-slate-900/80 border border-slate-800 rounded-lg px-2 py-1">
            <span className="text-xs uppercase text-slate-400">{gt('Status')}</span>
            <span
              className={`px-2 py-1 text-xs rounded-md ${
                state.gameStatus === 'playing'
                  ? 'bg-emerald-600/30 text-emerald-200'
                  : state.gameStatus === 'won'
                  ? 'bg-amber-500/30 text-amber-200'
                  : 'bg-rose-500/30 text-rose-200'
              }`}
            >
              {state.gameStatus === 'playing' ? gt('playing') : state.gameStatus === 'won' ? gt('won') : gt('lost')}
            </span>
            <button
              className="px-2 py-1 text-xs rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200"
              onClick={restart}
            >
              {gt('Restart')}
            </button>
            {showAlerts && underAttack && (
              <span className="px-2 py-1 text-xs rounded-md bg-rose-600/40 text-rose-100 border border-rose-500/50">
                {gt('Under attack!')}
              </span>
            )}
            {showAlerts && alertInfo && (
              <div className="flex items-center gap-1 bg-rose-900/40 border border-rose-700 rounded-md px-2 py-1 text-rose-100 text-[11px]">
                <span>{gt('Alert {age}s ago', { age: Math.max(0, Math.floor(alertInfo.age)) })}</span>
                <button
                  className="px-1.5 py-0.5 bg-rose-700/60 hover:bg-rose-600 rounded text-[11px] font-semibold"
                  onClick={jumpToLastAttack}
                  title={gt('Jump to last alert (hotkey: J)')}
                >
                  {gt('Jump')}
                </button>
              </div>
            )}
            <button
              className="px-2 py-1 text-xs rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200"
              onClick={() => {
                setActiveBuild(null);
                selectUnits([]);
              }}
              title={gt('Clear selection / cancel build (hotkey: Esc)')}
            >
              {gt('Clear (Esc)')}
            </button>
          </div>
          <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 rounded-lg px-2 py-1">
            <div className="text-xs text-slate-400">{gt('Idle citizens:')}</div>
            <div className="text-xs font-semibold text-slate-100">
              {state.units.filter(u => u.ownerId === state.localPlayerId && u.type === 'citizen' && u.order.kind === 'idle').length}
            </div>
            <button
              className="px-2 py-1 text-xs rounded-md bg-amber-500/80 hover:bg-amber-500 text-black font-semibold"
              onClick={selectNextIdleCitizen}
              title={gt('Select next idle citizen (hotkey: I)')}
            >
              {gt('Cycle (I)')}
            </button>
            <button
              className="px-2 py-1 text-xs rounded-md bg-indigo-500/80 hover:bg-indigo-500 text-black font-semibold"
              onClick={selectNextArmyGroup}
              title={gt('Select next army group (hotkey: M)')}
            >
              {gt('Army (M)')}
            </button>
            <button
              className={`px-2 py-1 text-xs rounded-md ${showAlerts ? 'bg-emerald-700/70 hover:bg-emerald-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'} border border-slate-700`}
              onClick={() => setShowAlerts(!showAlerts)}
              title={gt('Toggle alert pings/toasts')}
            >
              {gt('Alerts: {status}', { status: showAlerts ? gt('On') : gt('Off') })}
            </button>
            <div className="relative group">
              <button className="px-2 py-1 text-xs rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700">
                {gt('Hotkeys')}
              </button>
              <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-30">
                <div className="bg-slate-900/95 border border-slate-800 rounded-lg shadow-xl p-3 text-[11px] text-slate-200 w-64 space-y-1">
                  {hotkeyInfo.map(h => (
                    <div key={m(h.label)} className="flex justify-between gap-2">
                      <span className="text-slate-400">{m(h.label)}</span>
                      <span className="font-semibold text-slate-100">{h.keys}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="w-72 bg-slate-900/70 border border-slate-800 rounded-lg p-3 flex flex-col gap-3">
          <div>
            <div className="text-xs uppercase text-slate-400 mb-1">{gt('Build')}</div>
            <div className="grid grid-cols-2 gap-2">
              {['farm','lumber_camp','mine','house','barracks','factory','siege_factory','airbase','market','library','university','oil_rig','tower','fort'].map(b => {
                const cost = BUILDING_COSTS[b as keyof typeof BUILDING_COSTS];
                const requiredAge = BUILDING_AGE_REQ[b] || 'classics';
                const hasAge = meetsAge(requiredAge);
                const affordable = cost ? canAfford(cost) : true;
                const enabled = hasAge && affordable && state.gameStatus === 'playing';
                const titleParts: string[] = [];
                if (cost) titleParts.push(Object.entries(cost).map(([k,v]) => `${k}:${v}`).join(' '));
                if (!hasAge) titleParts.push(gt('Requires {age}', { age: requiredAge }));
                const buildingName = b === 'farm' ? gt('farm') : b === 'lumber_camp' ? gt('lumber camp') : b === 'mine' ? gt('mine') : b === 'house' ? gt('house') : b === 'barracks' ? gt('barracks') : b === 'factory' ? gt('factory') : b === 'siege_factory' ? gt('siege factory') : b === 'airbase' ? gt('airbase') : b === 'market' ? gt('market') : b === 'library' ? gt('library') : b === 'university' ? gt('university') : b === 'oil_rig' ? gt('oil rig') : b === 'tower' ? gt('tower') : gt('fort');
                return (
                  <button
                    key={b}
                    onClick={() => enabled && setActiveBuild(b)}
                    className={`text-left px-2 py-1 rounded-md text-xs border ${activeBuild===b?'border-amber-400 bg-slate-800 text-amber-300':'border-slate-700 bg-slate-800/60 text-slate-200'} ${enabled?'hover:border-slate-500':'opacity-50 cursor-not-allowed'}`}
                    title={titleParts.join(' | ')}
                    disabled={!enabled}
                  >
                    {buildingName}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-400 mb-1">{gt('Train')}</div>
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
                if (!hasAge) titleParts.push(gt('Requires {age}', { age: requiredAge }));
                if (!hasPop) titleParts.push(gt('Pop cap reached'));
                const unitName = t === 'infantry' ? gt('infantry') : t === 'ranged' ? gt('ranged') : t === 'vehicle' ? gt('vehicle') : t === 'siege' ? gt('siege') : gt('air');
                return (
                  <button
                    key={t}
                    className={`px-2 py-1 rounded-md text-xs ${enabled ? 'bg-slate-800/60 hover:bg-slate-800' : 'bg-slate-800/40 text-slate-500 cursor-not-allowed'}`}
                    onClick={() => enabled && trainUnit(t)}
                    title={titleParts.join(' | ')}
                    disabled={!enabled}
                  >
                    {unitName}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="text-xs text-slate-400">
            {gt('Left click: place building (when a build is selected). Drag: select units. Right click: move / gather / attack.')}
          </div>
          <SelectionPanel state={state} />
          <Tips />
          <Legend />
        </div>

        <div className="relative flex-1 min-h-[720px] rounded-lg overflow-hidden border border-slate-800 bg-slate-900/60">
          <RiseCanvas activeBuild={activeBuild} onBuildPlaced={() => setActiveBuild(null)} offset={offset} showAlerts={showAlerts} />
          {state.gameStatus !== 'playing' && (
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-slate-900/90 border border-slate-700 rounded-xl px-6 py-4 text-center shadow-xl space-y-3">
                <div className="text-xl font-bold text-slate-100">
                  {state.gameStatus === 'won' ? gt('Victory!') : gt('Defeat')}
                </div>
                <div className="text-sm text-slate-300">{gt('City center {status}.', { status: state.gameStatus === 'won' ? gt('captured') : gt('lost') })}</div>
                <button
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-md text-sm font-semibold text-white"
                  onClick={restart}
                >
                  {gt('Restart')}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="w-64 space-y-3">
          <RiseMinimap state={state} onNavigate={centerOnTile} viewport={viewport} showAlerts={showAlerts} />
          <AgeProgress age={player.age} elapsedSinceAge={state.elapsedSeconds - (player.ageStartSeconds ?? 0)} />
        </div>
      </div>

      <div className="flex gap-2 text-xs text-slate-400">
        <span>{gt('Left drag: select units. Right click: move / gather / attack. Select a build to place it with left click.')}</span>
      </div>
    </div>
  );
}
