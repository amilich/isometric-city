'use client';

import React from 'react';
import { useTower } from '@/context/TowerContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { T, Var, Currency } from 'gt-next';

export function StatsPanel() {
  const { state, setActivePanel } = useTower();
  const { stats, money, lives, tick, waveState } = state;

  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle><T>Run Stats</T></DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card className="p-3">
            <div className="text-muted-foreground text-xs"><T>Wave</T></div>
            <div className="font-mono text-lg">{stats.wave}</div>
            <div className="text-xs text-muted-foreground">{waveState.replace(/_/g, ' ')}</div>
          </Card>
          <Card className="p-3">
            <div className="text-muted-foreground text-xs"><T>Money</T></div>
            <div className="font-mono text-lg text-amber-400"><Currency currency="USD">{money}</Currency></div>
            <div className="text-xs text-muted-foreground"><T>Spent <Currency currency="USD">{stats.moneySpent}</Currency></T></div>
          </Card>
          <Card className="p-3">
            <div className="text-muted-foreground text-xs"><T>Lives</T></div>
            <div className={`font-mono text-lg ${lives > 0 ? 'text-green-400' : 'text-red-400'}`}>{lives}</div>
            <div className="text-xs text-muted-foreground"><T>Leaks <Var>{stats.leaks}</Var></T></div>
          </Card>
          <Card className="p-3">
            <div className="text-muted-foreground text-xs"><T>Kills</T></div>
            <div className="font-mono text-lg">{stats.kills}</div>
          </Card>
          <Card className="p-3">
            <div className="text-muted-foreground text-xs"><T>Tick</T></div>
            <div className="font-mono text-lg">{tick}</div>
          </Card>
          <Card className="p-3">
            <div className="text-muted-foreground text-xs"><T>Earned</T></div>
            <div className="font-mono text-lg text-emerald-400"><Currency currency="USD">{stats.moneyEarned}</Currency></div>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

