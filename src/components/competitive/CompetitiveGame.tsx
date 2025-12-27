// Main Competitive Game Component
'use client';

import React from 'react';
import { CompetitiveGameProvider, useCompetitiveGame } from '@/context/CompetitiveGameContext';
import { CompetitiveCanvas } from './CompetitiveCanvas';
import { MilitarySidebar } from './MilitarySidebar';
import { Scoreboard } from './Scoreboard';
import { GameOverDialog } from './GameOverDialog';
import { Button } from '@/components/ui/button';

interface CompetitiveGameProps {
  onExit: () => void;
}

function CompetitiveGameInner({ onExit }: CompetitiveGameProps) {
  const { state, setActivePanel, startGame, setSpeed } = useCompetitiveGame();
  
  const handlePlayAgain = () => {
    startGame();
  };
  
  return (
    <div className="w-full h-full flex bg-slate-950">
      {/* Military Sidebar - always visible in competitive mode */}
      <MilitarySidebar />
      
      {/* Main game area */}
      <div className="flex-1 flex flex-col relative">
        {/* Top bar */}
        <div className="h-12 bg-slate-900/90 border-b border-slate-700 flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <span className="text-white font-bold">COMPETITIVE</span>
            
            {/* Speed controls */}
            <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5">
              {[0, 1, 2, 3].map(speed => (
                <button
                  key={speed}
                  onClick={() => setSpeed(speed as 0 | 1 | 2 | 3)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    state.speed === speed
                      ? 'bg-blue-500 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {speed === 0 ? '⏸' : '▶'.repeat(speed)}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Player resources */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-400">Money:</span>
              <span className="text-green-400 font-bold">
                ${state.players.find(p => p.id === 'player')?.money.toLocaleString() || 0}
              </span>
            </div>
            
            {/* Game time */}
            <div className="text-sm text-slate-400">
              {Math.floor(state.gameDuration / 60)}:{String(Math.floor(state.gameDuration % 60)).padStart(2, '0')}
            </div>
            
            {/* Exit button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onExit}
              className="text-slate-400 hover:text-white"
            >
              <svg className="w-4 h-4 mr-1 -scale-x-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Exit
            </Button>
          </div>
        </div>
        
        {/* Game canvas */}
        <CompetitiveCanvas />
        
        {/* Scoreboard overlay */}
        <Scoreboard />
      </div>
      
      {/* Game over dialog */}
      <GameOverDialog onPlayAgain={handlePlayAgain} onExit={onExit} />
    </div>
  );
}

export default function CompetitiveGame({ onExit }: CompetitiveGameProps) {
  return (
    <CompetitiveGameProvider>
      <CompetitiveGameInner onExit={onExit} />
    </CompetitiveGameProvider>
  );
}
