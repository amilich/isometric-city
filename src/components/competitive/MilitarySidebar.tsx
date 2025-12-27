// Military Sidebar for Competitive Mode
'use client';

import React from 'react';
import { useCompetitiveGame } from '@/context/CompetitiveGameContext';
import { MilitaryUnitType, MILITARY_UNIT_STATS } from '@/types/competitive';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

// Unit icons (simple SVG representations)
const InfantryIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="6" r="4" />
    <path d="M12 12c-4 0-8 2-8 6v2h16v-2c0-4-4-6-8-6z" />
  </svg>
);

const TankIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <rect x="2" y="14" width="20" height="6" rx="2" />
    <rect x="4" y="10" width="16" height="6" rx="1" />
    <rect x="14" y="6" width="8" height="4" rx="1" />
  </svg>
);

const HelicopterIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <ellipse cx="12" cy="14" rx="6" ry="4" />
    <rect x="4" y="10" width="16" height="2" rx="1" />
    <path d="M18 14h4M2 14h4" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="6" r="2" />
    <line x1="12" y1="8" x2="12" y2="10" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const UNIT_ICONS: Record<MilitaryUnitType, React.ReactNode> = {
  infantry: <InfantryIcon />,
  tank: <TankIcon />,
  military_helicopter: <HelicopterIcon />,
};

export function MilitarySidebar() {
  const { state, trainUnit, setActivePanel } = useCompetitiveGame();
  
  const player = state.players.find(p => p.id === 'player');
  if (!player) return null;
  
  const productionQueue = state.productionQueues.player;
  const playerUnits = state.militaryUnits.filter(u => u.owner === 'player' && u.state !== 'dead');
  const selectedUnits = state.militaryUnits.filter(u => u.selected);
  
  return (
    <div className="w-64 bg-slate-900/95 border-r border-slate-700 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <span className="text-white font-bold">MILITARY</span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setActivePanel('none')}
          className="h-6 w-6 text-slate-400 hover:text-white"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Button>
      </div>
      
      {/* Resources */}
      <div className="px-4 py-3 border-b border-slate-700">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Money:</span>
          <span className="text-green-400 font-bold">${player.money.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-1">
          <span className="text-slate-400">Units:</span>
          <span className="text-blue-400 font-bold">{playerUnits.length}</span>
        </div>
      </div>
      
      {/* Train Units */}
      <div className="px-4 py-3 border-b border-slate-700">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Train Units</h3>
        <div className="space-y-2">
          {(['infantry', 'tank', 'military_helicopter'] as MilitaryUnitType[]).map(type => {
            const stats = MILITARY_UNIT_STATS[type];
            const canAfford = player.money >= stats.cost;
            
            return (
              <Button
                key={type}
                onClick={() => trainUnit(type)}
                disabled={!canAfford}
                variant="outline"
                className={`w-full justify-start gap-3 h-auto py-2 ${
                  canAfford 
                    ? 'border-slate-600 hover:border-blue-500 hover:bg-blue-500/10' 
                    : 'border-slate-700 opacity-50'
                }`}
              >
                <div className="text-blue-400">{UNIT_ICONS[type]}</div>
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium text-white">{stats.name}</div>
                  <div className="text-xs text-slate-400">
                    HP: {stats.health} | ATK: {stats.attackPower}
                  </div>
                </div>
                <div className={`text-sm font-bold ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
                  ${stats.cost}
                </div>
              </Button>
            );
          })}
        </div>
      </div>
      
      {/* Production Queue */}
      {productionQueue.length > 0 && (
        <div className="px-4 py-3 border-b border-slate-700">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Production Queue ({productionQueue.length})
          </h3>
          <div className="space-y-2">
            {productionQueue.slice(0, 5).map((item, index) => {
              const stats = MILITARY_UNIT_STATS[item.type];
              const progress = (item.progress / item.buildTime) * 100;
              
              return (
                <div key={index} className="bg-slate-800/50 rounded p-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-blue-400 scale-75">{UNIT_ICONS[item.type]}</div>
                    <span className="text-sm text-white flex-1">{stats.name}</span>
                    <span className="text-xs text-slate-400">
                      {Math.ceil(item.buildTime - item.progress)}s
                    </span>
                  </div>
                  <Progress value={progress} className="h-1" />
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Selected Units Info */}
      {selectedUnits.length > 0 && (
        <div className="px-4 py-3 border-b border-slate-700">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Selected ({selectedUnits.length})
          </h3>
          <div className="space-y-1">
            {/* Group by type */}
            {(['infantry', 'tank', 'military_helicopter'] as MilitaryUnitType[]).map(type => {
              const count = selectedUnits.filter(u => u.type === type).length;
              if (count === 0) return null;
              
              const stats = MILITARY_UNIT_STATS[type];
              const avgHealth = Math.round(
                selectedUnits.filter(u => u.type === type).reduce((sum, u) => sum + u.health, 0) / count
              );
              
              return (
                <div key={type} className="flex items-center gap-2 text-sm">
                  <div className="text-blue-400 scale-75">{UNIT_ICONS[type]}</div>
                  <span className="text-white">{count}x {stats.name}</span>
                  <span className="text-slate-400 ml-auto">HP: {avgHealth}/{stats.health}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Instructions */}
      <div className="px-4 py-3 mt-auto text-xs text-slate-500">
        <p className="mb-1">• Click/drag to select units</p>
        <p className="mb-1">• Right-click to move/attack</p>
        <p>• Destroy enemy City Hall to win</p>
      </div>
    </div>
  );
}
