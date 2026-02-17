'use client';

import React from 'react';
import { useTower } from '@/context/TowerContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';

export function StatsPanel() {
  const { state, setActivePanel } = useTower();
  const { stats, money, lives, tick, waveState } = state;

  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Run Stats</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card className="p-3">
            <div className="text-muted-foreground text-xs">Wave</div>
            <div className="font-mono text-lg">{stats.wave}</div>
            <div className="text-xs text-muted-foreground">{waveState.replace(/_/g, ' ')}</div>
          </Card>
          <Card className="p-3">
            <div className="text-muted-foreground text-xs">Money</div>
            <div className="font-mono text-lg text-amber-400">${money.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Spent ${stats.moneySpent.toLocaleString()}</div>
          </Card>
          <Card className="p-3">
            <div className="text-muted-foreground text-xs">Lives</div>
            <div className={`font-mono text-lg ${lives > 0 ? 'text-green-400' : 'text-red-400'}`}>{lives}</div>
            <div className="text-xs text-muted-foreground">Leaks {stats.leaks}</div>
          </Card>
          <Card className="p-3">
            <div className="text-muted-foreground text-xs">Kills</div>
            <div className="font-mono text-lg">{stats.kills}</div>
          </Card>
          <Card className="p-3">
            <div className="text-muted-foreground text-xs">Tick</div>
            <div className="font-mono text-lg">{tick}</div>
          </Card>
          <Card className="p-3">
            <div className="text-muted-foreground text-xs">Earned</div>
            <div className="font-mono text-lg text-emerald-400">${stats.moneyEarned.toLocaleString()}</div>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

