'use client';

import React from 'react';
import { useGame } from '@/context/GameContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

export function BudgetPanel() {
  const { state, setActivePanel, setBudgetFunding } = useGame();
  const { budget, stats } = state;
  
  const categories = [
    { key: 'police', ...budget.police },
    { key: 'fire', ...budget.fire },
    { key: 'health', ...budget.health },
    { key: 'education', ...budget.education },
    { key: 'transportation', ...budget.transportation },
    { key: 'parks', ...budget.parks },
    { key: 'power', ...budget.power },
    { key: 'water', ...budget.water },
  ];
  
  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Bütçe</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4 pb-4 border-b border-border">
            <div>
              <div className="text-muted-foreground text-xs mb-1">Gelir</div>
              <div className="text-green-400 font-mono">₺{stats.income.toLocaleString()}/ay</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs mb-1">Giderler</div>
              <div className="text-red-400 font-mono">₺{stats.expenses.toLocaleString()}/ay</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs mb-1">Net</div>
              <div className={`font-mono ${stats.income - stats.expenses >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ₺{(stats.income - stats.expenses).toLocaleString()}/ay
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            {categories.map(cat => (
              <div key={cat.key} className="flex items-center gap-4">
                <Label className="w-28 text-sm">{cat.name}</Label>
                <Slider
                  value={[cat.funding]}
                  onValueChange={(value) => setBudgetFunding(cat.key as keyof typeof budget, value[0])}
                  min={0}
                  max={100}
                  step={5}
                  className="flex-1"
                />
                <span className="w-12 text-right font-mono text-sm">{cat.funding}%</span>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
