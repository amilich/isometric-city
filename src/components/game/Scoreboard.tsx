'use client';

import React from 'react';
import { useGame } from '@/context/GameContext';
import { Card } from '@/components/ui/card';

export function Scoreboard() {
  const { state } = useGame();
  if (state.gameMode !== 'competitive' || !state.competitive) return null;

  const players = [...state.competitive.players].sort((a, b) => b.score - a.score);

  return (
    <Card className="absolute top-6 right-8 p-3 shadow-lg bg-card/90 border-border/70 w-[220px]">
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold mb-2">
        Scoreboard
      </div>
      <div className="flex flex-col gap-1">
        {players.map((p) => (
          <div
            key={p.id}
            className={`flex items-center justify-between text-xs px-2 py-1 rounded-md border border-border/50 ${
              p.eliminated ? 'opacity-50' : 'opacity-100'
            }`}
            title={p.eliminated ? 'Eliminated' : `Tech ${p.techLevel}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              <span className="truncate">{p.name}</span>
            </div>
            <div className="flex items-center gap-2 tabular-nums">
              <span className="text-muted-foreground">${Math.floor(p.money).toLocaleString()}</span>
              <span className="font-semibold">{Math.floor(p.score).toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

