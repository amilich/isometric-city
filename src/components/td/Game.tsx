'use client';

import React from 'react';
import Link from 'next/link';
import { useTD } from '@/context/TDContext';
import { TDGrid } from './TDGrid';
import { Button } from '@/components/ui/button';
import { TOWER_STATS } from '@/games/td/types/game';
import type { TowerType } from '@/games/td/types';
import { ArrowLeft, Swords, DollarSign, Heart, Pause, Play, RotateCcw } from 'lucide-react';

interface GameProps {
  onExit?: () => void;
}

const TOWER_TYPES: { type: TowerType; label: string }[] = [
  { type: 'basic', label: 'Basic' },
  { type: 'cannon', label: 'Cannon' },
  { type: 'ice', label: 'Ice' },
  { type: 'laser', label: 'Laser' },
];

export default function TDGame({ onExit }: GameProps) {
  const {
    state,
    setTool,
    setSpeed,
    setSelectedTile,
    restart,
  } = useTD();
  const selectedTile = state.selectedTile
    ? state.grid[state.selectedTile.y]?.[state.selectedTile.x]
    : null;

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-slate-900/80 border-b border-slate-700/50">
        <div className="flex items-center gap-4">
          {onExit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onExit}
              className="text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Exit
            </Button>
          )}
          <Link
            href="/"
            className="text-slate-400 hover:text-white text-sm transition-colors"
          >
            IsoCity
          </Link>
          <Link
            href="/coaster"
            className="text-slate-400 hover:text-white text-sm transition-colors"
          >
            IsoCoaster
          </Link>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-white">
            <DollarSign className="w-4 h-4 text-amber-400" />
            <span className="font-mono font-medium">{state.money}</span>
          </div>
          <div className="flex items-center gap-2 text-white">
            <Heart className="w-4 h-4 text-red-400" />
            <span className="font-mono font-medium">
              {state.lives}/{state.startLives}
            </span>
          </div>
          <div className="flex items-center gap-2 text-white">
            <Swords className="w-4 h-4 text-slate-400" />
            <span className="font-mono font-medium">Wave {state.currentWave}</span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSpeed(state.speed === 0 ? 1 : 0)}
              className="text-slate-400 hover:text-white"
            >
              {state.speed === 0 ? (
                <Play className="w-4 h-4" />
              ) : (
                <Pause className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={restart}
              className="text-slate-400 hover:text-white"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Game over / Win overlay */}
      {(state.phase === 'lost' || state.phase === 'won') && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-slate-800 border border-slate-600 rounded-lg p-8 text-center max-w-sm">
            <h2 className="text-2xl font-bold text-white mb-2">
              {state.phase === 'won' ? 'Victory!' : 'Game Over'}
            </h2>
            <p className="text-slate-400 mb-6">
              {state.phase === 'won'
                ? `You survived ${state.currentWave} waves!`
                : `Wave ${state.currentWave} was too much.`}
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={restart} className="bg-amber-600 hover:bg-amber-700">
                Play Again
              </Button>
              {onExit && (
                <Button variant="outline" onClick={onExit}>
                  Exit
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {/* Sidebar - Tower selection */}
        <div className="flex-shrink-0 w-48 bg-slate-900/60 border-r border-slate-700/50 p-3 flex flex-col gap-2">
          <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Towers
          </h3>
          {TOWER_TYPES.map(({ type, label }) => {
            const stats = TOWER_STATS[type];
            const isSelected = state.selectedTool === type;
            const canAfford = state.money >= stats.cost;
            return (
              <button
                key={type}
                onClick={() => setTool(type)}
                disabled={!canAfford}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  isSelected
                    ? 'bg-amber-500/20 border-amber-500/50 text-white'
                    : canAfford
                      ? 'bg-slate-800/50 border-slate-600 hover:bg-slate-700/50 text-white'
                      : 'bg-slate-800/30 border-slate-700/50 text-slate-500 cursor-not-allowed'
                }`}
              >
                <div className="font-medium">{label}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  ${stats.cost} • {stats.damage}dmg • {stats.range}r
                </div>
              </button>
            );
          })}

          <button
            onClick={() => setTool('sell')}
            className={`w-full text-left p-3 rounded-lg border transition-all ${
              state.selectedTool === 'sell'
                ? 'bg-red-500/20 border-red-500/50 text-white'
                : 'bg-slate-800/50 border-slate-600 hover:bg-slate-700/50 text-white'
            }`}
          >
            <div className="font-medium">Sell Tower</div>
            <div className="text-xs text-slate-400 mt-0.5">50% refund</div>
          </button>

          {selectedTile?.tower && (
            <div className="mt-4 p-3 rounded-lg bg-slate-800/50 border border-slate-600">
              <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                Selected
              </h3>
              <div className="text-sm text-white">
                {TOWER_STATS[selectedTile.tower.type].name}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {selectedTile.tower.damage} dmg • {selectedTile.tower.range} range
              </div>
            </div>
          )}
        </div>

        {/* Main canvas */}
        <div className="flex-1 relative min-w-0">
          <TDGrid className="w-full h-full" />
        </div>
      </div>
    </div>
  );
}
