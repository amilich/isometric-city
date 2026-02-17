'use client';

import React from 'react';
import { useTower } from '@/context/TowerContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { T, Var, Num, Currency } from 'gt-next';

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
            <T><div className="text-muted-foreground text-xs">Wave</div></T>
            <div className="font-mono text-lg"><Num>{stats.wave}</Num></div>
            <T><div className="text-xs text-muted-foreground"><Var>{waveState.replace(/_/g, ' ')}</Var></div></T>
          </Card>
          <Card className="p-3">
            <T><div className="text-muted-foreground text-xs">Money</div></T>
            <div className="font-mono text-lg text-amber-400"><Currency currency="USD">{money}</Currency></div>
            <T><div className="text-xs text-muted-foreground">Spent <Currency currency="USD">{stats.moneySpent}</Currency></div></T>
          </Card>
          <Card className="p-3">
            <T><div className="text-muted-foreground text-xs">Lives</div></T>
            <div className={`font-mono text-lg ${lives > 0 ? 'text-green-400' : 'text-red-400'}`}><Num>{lives}</Num></div>
            <T><div className="text-xs text-muted-foreground">Leaks <Num>{stats.leaks}</Num></div></T>
          </Card>
          <Card className="p-3">
            <T><div className="text-muted-foreground text-xs">Kills</div></T>
            <div className="font-mono text-lg"><Num>{stats.kills}</Num></div>
          </Card>
          <Card className="p-3">
            <T><div className="text-muted-foreground text-xs">Tick</div></T>
            <div className="font-mono text-lg"><Num>{tick}</Num></div>
          </Card>
          <Card className="p-3">
            <T><div className="text-muted-foreground text-xs">Earned</div></T>
            <div className="font-mono text-lg text-emerald-400"><Currency currency="USD">{stats.moneyEarned}</Currency></div>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

