// Scoreboard component for Competitive Mode
'use client';

import React from 'react';
import { useCompetitiveGame } from '@/context/CompetitiveGameContext';

export function Scoreboard() {
  const { state } = useCompetitiveGame();
  
  // Sort players by score (highest first)
  const sortedPlayers = [...state.players].sort((a, b) => b.score - a.score);
  
  return (
    <div className="absolute top-4 right-4 bg-slate-900/90 border border-slate-700 rounded-lg shadow-xl overflow-hidden min-w-[200px] z-50">
      {/* Header */}
      <div className="px-3 py-2 bg-slate-800/50 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Scoreboard</span>
          <span className="text-xs text-slate-500">
            {Math.floor(state.gameDuration / 60)}:{String(Math.floor(state.gameDuration % 60)).padStart(2, '0')}
          </span>
        </div>
      </div>
      
      {/* Player List */}
      <div className="divide-y divide-slate-700/50">
        {sortedPlayers.map((player, index) => (
          <div
            key={player.id}
            className={`px-3 py-2 flex items-center gap-3 ${
              player.isEliminated ? 'opacity-40' : ''
            } ${player.isHuman ? 'bg-blue-500/10' : ''}`}
          >
            {/* Rank */}
            <span className="text-xs font-bold text-slate-500 w-4">
              {index + 1}
            </span>
            
            {/* Color indicator */}
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: player.color }}
            />
            
            {/* Name */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">
                {player.name}
                {player.isHuman && (
                  <span className="text-blue-400 ml-1">(You)</span>
                )}
              </div>
              {player.isEliminated && (
                <div className="text-xs text-red-400">Eliminated</div>
              )}
            </div>
            
            {/* Score */}
            <div className="text-right">
              <div className="text-sm font-bold text-yellow-400">
                {player.score.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500">
                ${(player.money / 1000).toFixed(1)}k
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Stats */}
      <div className="px-3 py-2 bg-slate-800/30 border-t border-slate-700">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div className="text-slate-500">Your Units:</div>
          <div className="text-white text-right">
            {state.militaryUnits.filter(u => u.owner === 'player' && u.state !== 'dead').length}
          </div>
          <div className="text-slate-500">Kills:</div>
          <div className="text-green-400 text-right">
            {state.players.find(p => p.isHuman)?.unitsKilled || 0}
          </div>
          <div className="text-slate-500">Losses:</div>
          <div className="text-red-400 text-right">
            {state.players.find(p => p.isHuman)?.unitsLost || 0}
          </div>
        </div>
      </div>
    </div>
  );
}
