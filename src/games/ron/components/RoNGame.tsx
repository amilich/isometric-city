/**
 * Rise of Nations - Main Game Component
 * 
 * Integrates all game components: canvas, sidebar, minimap.
 */
'use client';

import React, { useState, useCallback } from 'react';
import { RoNProvider, useRoN } from '../context/RoNContext';
import { RoNCanvas } from './RoNCanvas';
import { RoNSidebar } from './RoNSidebar';
import { RoNMiniMap } from './RoNMiniMap';
import { RoNBuildingPanel } from './RoNBuildingPanel';
import { Button } from '@/components/ui/button';
import { AGE_INFO } from '../types/ages';
import { PLAYER_COLORS } from '../lib/renderConfig';

function GameContent({ onExit }: { onExit?: () => void }) {
  const { state, getCurrentPlayer, newGame } = useRoN();
  const [navigationTarget, setNavigationTarget] = useState<{ x: number; y: number } | null>(null);
  
  const currentPlayer = getCurrentPlayer();
  
  // Handle navigation from minimap
  const handleNavigate = useCallback((x: number, y: number) => {
    setNavigationTarget({ x, y });
    // Clear after a moment
    setTimeout(() => setNavigationTarget(null), 100);
  }, []);
  
  // Victory/Defeat overlay
  if (state.gameOver) {
    const winner = state.winnerId 
      ? state.players.find(p => p.id === state.winnerId)
      : null;
    const isVictory = winner?.id === currentPlayer?.id;
    
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900">
        <div className="text-center p-8 bg-slate-800 rounded-lg shadow-xl">
          <h1 className={`text-4xl font-bold mb-4 ${isVictory ? 'text-green-400' : 'text-red-400'}`}>
            {isVictory ? '🏆 Victory!' : '💀 Defeat'}
          </h1>
          {winner && (
            <p className="text-xl text-white mb-6">
              {winner.name} has conquered all!
            </p>
          )}
          <div className="flex gap-4 justify-center">
            <Button 
              onClick={() => newGame({ 
                gridSize: 50, 
                playerConfigs: [
                  { name: 'Player', type: 'human', color: '#3b82f6' },
                  { name: 'AI', type: 'ai', difficulty: 'medium', color: '#ef4444' },
                ]
              })}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Play Again
            </Button>
            {onExit && (
              <Button onClick={onExit} variant="outline">
                Exit
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="w-full h-full flex bg-slate-900">
      {/* Sidebar */}
      <RoNSidebar />
      
      {/* Main game area */}
      <div className="flex-1 ml-64 relative">
        {/* Top bar - players info */}
        <div className="absolute top-0 left-0 right-0 z-20 bg-slate-800/80 backdrop-blur-sm p-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {state.players.map((player, index) => (
              <div 
                key={player.id}
                className={`flex items-center gap-2 px-3 py-1 rounded ${
                  player.id === currentPlayer?.id ? 'bg-slate-700' : ''
                }`}
              >
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: PLAYER_COLORS[index] }}
                />
                <span className="text-white text-sm">{player.name}</span>
                <span className="text-xs" style={{ color: AGE_INFO[player.age].color }}>
                  ({AGE_INFO[player.age].name})
                </span>
                {player.isDefeated && (
                  <span className="text-red-400 text-xs">☠️</span>
                )}
              </div>
            ))}
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-white text-sm">
              Tick: {state.tick}
            </span>
            {onExit && (
              <Button size="sm" variant="ghost" onClick={onExit}>
                Exit
              </Button>
            )}
          </div>
        </div>
        
        {/* Canvas */}
        <RoNCanvas 
          navigationTarget={navigationTarget}
          onNavigationComplete={() => setNavigationTarget(null)}
        />
        
        {/* MiniMap */}
        <RoNMiniMap onNavigate={handleNavigate} />
        
        {/* Building Info Panel */}
        {state.selectedBuildingPos && (
          <>
            {/* Debug indicator */}
            <div className="fixed top-0 left-1/2 bg-green-500 text-white px-4 py-2 z-[9999] rounded-b">
              BUILDING SELECTED: {state.selectedBuildingPos.x}, {state.selectedBuildingPos.y}
            </div>
            <RoNBuildingPanel onClose={() => {}} />
          </>
        )}
        
        {/* Help overlay */}
        <div className="absolute bottom-4 left-4 z-20 bg-slate-800/80 backdrop-blur-sm p-2 rounded text-xs text-slate-300">
          <div>Left Click: Select / Place</div>
          <div>Right Click: Move / Attack</div>
          <div>Middle Click / Alt+Drag: Pan</div>
          <div>Scroll: Zoom</div>
          <div>Drag: Box Select</div>
        </div>
      </div>
    </div>
  );
}

interface RoNGameProps {
  onExit?: () => void;
}

export function RoNGame({ onExit }: RoNGameProps) {
  return (
    <RoNProvider>
      <GameContent onExit={onExit} />
    </RoNProvider>
  );
}

export default RoNGame;
