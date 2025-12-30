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
import { AIMessagePanel } from './AIMessagePanel';
import { AIAgentsSidebar, AI_SIDEBAR_DEFAULT_WIDTH } from './AIAgentsSidebar';
import { Button } from '@/components/ui/button';
import { AGE_INFO } from '../types/ages';
import { PLAYER_COLORS } from '../lib/renderConfig';
import { SpeedControl } from '@/components/game/shared';
import { StatBadge } from '@/components/game/TopBar';

function GameContent({ onExit }: { onExit?: () => void }) {
  const { 
    state, 
    getCurrentPlayer, 
    newGame, 
    selectedBuildingPos, 
    setSpeed, 
    debugAddResources,
    agenticAI,
    setAgenticAIEnabled,
    markAIMessageRead,
    clearAIMessages,
    clearAIConversations,
  } = useRoN();
  const [navigationTarget, setNavigationTarget] = useState<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState<{ 
    offset: { x: number; y: number }; 
    zoom: number; 
    canvasSize: { width: number; height: number } 
  } | null>(null);
  const [aiSidebarWidth, setAiSidebarWidth] = useState(AI_SIDEBAR_DEFAULT_WIDTH);
  
  const currentPlayer = getCurrentPlayer();
  
  // Handle navigation from minimap
  const handleNavigate = useCallback((x: number, y: number) => {
    setNavigationTarget({ x, y });
    // Clear after a moment
    setTimeout(() => setNavigationTarget(null), 100);
  }, []);
  
  // Handle viewport changes from canvas (for minimap)
  const handleViewportChange = useCallback((newViewport: { 
    offset: { x: number; y: number }; 
    zoom: number; 
    canvasSize: { width: number; height: number } 
  }) => {
    setViewport(newViewport);
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
                gridSize: 160,
                playerConfigs: [
                  { name: 'Player', type: 'human', color: '#3b82f6' },
                  { name: 'AI Red', type: 'ai', difficulty: 'medium', color: '#ef4444' },
                  { name: 'AI Green', type: 'ai', difficulty: 'medium', color: '#22c55e' },
                  { name: 'AI Purple', type: 'ai', difficulty: 'medium', color: '#a855f7' },
                  { name: 'AI Orange', type: 'ai', difficulty: 'medium', color: '#f97316' },
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
  
  // Match IsoCity's layout structure exactly
  return (
    <div className="w-full h-full min-h-[720px] overflow-hidden bg-slate-900 flex">
      {/* Left Sidebar - uses same pattern as IsoCity */}
      <RoNSidebar />
      
      {/* Main game area - uses flex-col like IsoCity */}
      <div 
        className="flex-1 flex flex-col ml-56 transition-[margin]"
        style={{ marginRight: agenticAI.enabled ? aiSidebarWidth : 0 }}
      >
        {/* Top bar - as flex child (not absolute) like IsoCity */}
        <div className="h-14 bg-card border-b border-border flex items-center justify-between px-4">
          {/* Left section: Players, Speed control */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              {state.players.map((player, index) => {
                // Calculate elimination timer
                const ELIMINATION_TICKS = 1200;
                const ticksWithoutCity = player.noCitySinceTick !== null 
                  ? state.tick - player.noCitySinceTick 
                  : 0;
                const secondsRemaining = player.noCitySinceTick !== null
                  ? Math.max(0, Math.ceil((ELIMINATION_TICKS - ticksWithoutCity) / 10))
                  : null;
                
                return (
                  <div 
                    key={player.id}
                    className={`flex items-center gap-2 px-2 py-1 rounded text-sm ${
                      player.id === currentPlayer?.id ? 'bg-secondary' : ''
                    }`}
                    title={secondsRemaining !== null 
                      ? `No cities! Eliminated in ${secondsRemaining}s` 
                      : player.isDefeated 
                        ? 'Defeated' 
                        : `${player.name} - ${player.population}/${player.populationCap} pop`
                    }
                  >
                    <div 
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: PLAYER_COLORS[index] }}
                    />
                    <span className="text-foreground">{player.name}</span>
                    {player.isDefeated ? (
                      <span className="text-red-500 text-xs">Eliminated</span>
                    ) : secondsRemaining !== null ? (
                      <span className="text-amber-500 text-xs font-mono animate-pulse">
                        {secondsRemaining}s
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
            
            {/* Speed control - same component as IsoCity */}
            <SpeedControl 
              speed={state.gameSpeed as 0 | 1 | 2 | 3} 
              onSpeedChange={setSpeed} 
            />
          </div>
          
          {/* Center section: Population and resources like IsoCity */}
          <div className="flex items-center gap-0.5">
            {currentPlayer && (
              <>
                <StatBadge
                  value={`${currentPlayer.population}/${currentPlayer.populationCap}`}
                  label="Pop"
                />
                <StatBadge
                  value={Math.floor(currentPlayer.resources.food).toString()}
                  label="Food"
                  variant={currentPlayer.resources.food < 50 ? 'warning' : 'default'}
                />
                <StatBadge
                  value={Math.floor(currentPlayer.resources.wood).toString()}
                  label="Wood"
                  variant={currentPlayer.resources.wood < 50 ? 'warning' : 'default'}
                />
                <StatBadge
                  value={Math.floor(currentPlayer.resources.metal).toString()}
                  label="Metal"
                  variant={currentPlayer.resources.metal < 50 ? 'warning' : 'default'}
                />
                <StatBadge
                  value={Math.floor(currentPlayer.resources.gold).toString()}
                  label="Gold"
                  variant={currentPlayer.resources.gold < 50 ? 'warning' : 'default'}
                />
                <StatBadge
                  value={Math.floor(currentPlayer.resources.knowledge).toString()}
                  label="Know"
                  variant={currentPlayer.resources.knowledge < 50 ? 'warning' : 'default'}
                />
                <StatBadge
                  value={Math.floor(currentPlayer.resources.oil).toString()}
                  label="Oil"
                  variant={currentPlayer.resources.oil < 20 ? 'warning' : 'default'}
                />
              </>
            )}
          </div>
          
          {/* Right section: Agentic AI toggle, Debug and Exit */}
          <div className="flex items-center gap-2 justify-end">
            {/* Agentic AI toggle */}
            <Button
              size="sm"
              variant={agenticAI.enabled ? "default" : "outline"}
              onClick={() => setAgenticAIEnabled(!agenticAI.enabled)}
              className={agenticAI.enabled ? "bg-purple-600 hover:bg-purple-700" : ""}
              title={agenticAI.enabled ? "Disable Agentic AI (using OpenAI)" : "Enable Agentic AI opponent (requires OPENAI_API_KEY)"}
            >
              {agenticAI.isThinking && "🤔 "}
              {agenticAI.enabled ? "AI: ON" : "AI: OFF"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={debugAddResources}
              title="Add 50 of each resource (debug)"
            >
              +50
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => newGame({
                gridSize: 160,
                playerConfigs: [
                  { name: 'Player', type: 'human', color: '#3b82f6' },
                  { name: 'AI Red', type: 'ai', difficulty: 'medium', color: '#ef4444' },
                  { name: 'AI Green', type: 'ai', difficulty: 'medium', color: '#22c55e' },
                  { name: 'AI Purple', type: 'ai', difficulty: 'medium', color: '#a855f7' },
                  // { name: 'AI Orange', type: 'ai', difficulty: 'medium', color: '#f97316' },
                ],
              })}
              title="Start new game (1 human + 4 AIs)"
            >
              New Game
            </Button>
            {onExit && (
              <Button size="sm" variant="ghost" onClick={onExit}>
                Exit
              </Button>
            )}
          </div>
        </div>
        
        {/* Canvas area - flex-1 relative like IsoCity */}
        <div className="flex-1 relative overflow-visible">
          <RoNCanvas 
            navigationTarget={navigationTarget}
            onNavigationComplete={() => setNavigationTarget(null)}
            onViewportChange={handleViewportChange}
          />
          
          {/* MiniMap with viewport indicator */}
          <RoNMiniMap onNavigate={handleNavigate} viewport={viewport} />
          
          {/* Agentic AI Message Panel - positioned left of minimap */}
          {agenticAI.enabled && (
            <AIMessagePanel
              messages={agenticAI.messages}
              isThinking={agenticAI.isThinking}
              onMarkRead={markAIMessageRead}
              onClear={clearAIMessages}
            />
          )}
          
          {/* Building Info Panel - absolute within canvas area like IsoCity's TileInfoPanel */}
          {selectedBuildingPos && (
            <RoNBuildingPanel onClose={() => {}} />
          )}
        </div>
      </div>
      
      {/* Right Sidebar - AI Agents (only when AI is enabled) */}
      {agenticAI.enabled && (
        <div className="fixed right-0 top-0 h-screen z-40">
          <AIAgentsSidebar 
            conversations={agenticAI.conversations}
            players={state.players}
            onClear={clearAIConversations}
            onWidthChange={setAiSidebarWidth}
          />
        </div>
      )}
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
