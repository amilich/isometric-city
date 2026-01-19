'use client';

import React from 'react';
import { msg, useMessages } from 'gt-next';
import { useCoaster } from '@/context/CoasterContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

const UI_LABELS = {
  finances: msg('Finances'),
  cash: msg('Cash on Hand'),
  income: msg('Daily Income'),
  expenses: msg('Daily Expenses'),
  entranceFee: msg('Entrance Fee'),
};

export function FinancesPanel() {
  const { state, setActivePanel, setEntranceFee } = useCoaster();
  const { finance } = state;
  const m = useMessages();

  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{m(UI_LABELS.finances)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4 pb-4 border-b border-border">
            <div>
              <div className="text-muted-foreground text-xs mb-1">{m(UI_LABELS.cash)}</div>
              <div className="text-foreground font-mono">${finance.money.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs mb-1">{m(UI_LABELS.income)}</div>
              <div className="text-green-400 font-mono">${finance.dailyIncome.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs mb-1">{m(UI_LABELS.expenses)}</div>
              <div className="text-red-400 font-mono">${finance.dailyExpenses.toLocaleString()}</div>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm">{m(UI_LABELS.entranceFee)}</Label>
            <div className="flex items-center gap-4">
              <Slider
                value={[finance.entranceFee]}
                onValueChange={(value) => setEntranceFee(value[0])}
                min={0}
                max={60}
                step={1}
                className="flex-1"
              />
              <span className="w-12 text-right font-mono text-sm">${finance.entranceFee}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
