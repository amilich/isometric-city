// Game Over Dialog for Competitive Mode
'use client';

import React from 'react';
import { useCompetitiveGame } from '@/context/CompetitiveGameContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface GameOverDialogProps {
  onPlayAgain: () => void;
  onExit: () => void;
}

export function GameOverDialog({ onPlayAgain, onExit }: GameOverDialogProps) {
  const { state } = useCompetitiveGame();
  
  const winner = state.players.find(p => p.id === state.winner);
  const player = state.players.find(p => p.isHuman);
  const isVictory = winner?.isHuman;
  
  // Calculate stats
  const gameDurationMinutes = Math.floor(state.gameDuration / 60);
  const gameDurationSeconds = Math.floor(state.gameDuration % 60);
  
  // Sort players by score for final standings
  const sortedPlayers = [...state.players].sort((a, b) => b.score - a.score);
  
  return (
    <Dialog open={state.gameOver} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className={isVictory ? 'text-green-500' : 'text-red-500'}>
            {isVictory ? '🎉 Victory!' : '💀 Defeat'}
          </DialogTitle>
          <DialogDescription>
            {isVictory
              ? 'Congratulations! You have conquered all your enemies!'
              : `${winner?.name || 'An enemy'} has destroyed your city.`}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {/* Game Duration */}
          <div className="text-center text-sm text-muted-foreground mb-4">
            Game Duration: {gameDurationMinutes}:{String(gameDurationSeconds).padStart(2, '0')}
          </div>
          
          {/* Final Standings */}
          <div className="bg-muted/50 rounded-lg p-3 mb-4">
            <h4 className="text-sm font-semibold mb-2">Final Standings</h4>
            <div className="space-y-2">
              {sortedPlayers.map((p, index) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 text-sm ${
                    p.isHuman ? 'text-blue-400' : ''
                  } ${p.isEliminated ? 'opacity-50' : ''}`}
                >
                  <span className="font-bold w-4">{index + 1}.</span>
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="flex-1">{p.name}</span>
                  <span className="font-bold text-yellow-400">{p.score.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Your Stats */}
          {player && (
            <div className="bg-muted/50 rounded-lg p-3">
              <h4 className="text-sm font-semibold mb-2">Your Statistics</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Final Score:</div>
                <div className="font-bold text-yellow-400">{player.score.toLocaleString()}</div>
                
                <div className="text-muted-foreground">Units Killed:</div>
                <div className="text-green-400">{player.unitsKilled}</div>
                
                <div className="text-muted-foreground">Units Lost:</div>
                <div className="text-red-400">{player.unitsLost}</div>
                
                <div className="text-muted-foreground">Buildings Destroyed:</div>
                <div className="text-orange-400">{player.buildingsDestroyed}</div>
                
                <div className="text-muted-foreground">Final Treasury:</div>
                <div>${player.money.toLocaleString()}</div>
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onExit}
            className="w-full sm:w-auto"
          >
            Exit to Menu
          </Button>
          <Button
            onClick={onPlayAgain}
            className="w-full sm:w-auto"
          >
            Play Again
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
