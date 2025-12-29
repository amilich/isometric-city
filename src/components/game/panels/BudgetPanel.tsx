'use client';

import React from 'react';
import { useGame } from '@/context/GameContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

export function BudgetPanel() {
  const { state, setActivePanel, setBudgetFunding, setTaxRate } = useGame();
  const { budget, stats, taxRate } = state;
  
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
      <DialogContent className="max-w-[800px] flex flex-row gap-6">
        {/* Sol Taraf: Bütçe ve Gelir/Gider */}
        <div className="flex-1 space-y-6">
          <DialogHeader>
            <DialogTitle>Bütçe Yönetimi</DialogTitle>
          </DialogHeader>
          
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

        {/* Sağ Taraf: Vergi Ayarları */}
        <div className="w-[300px] border-l border-border pl-6 space-y-6">
           <DialogHeader>
            <DialogTitle>Vergi Ayarları</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
               <div className="flex justify-between items-center mb-4">
                  <Label className="text-base font-bold text-white">Genel Vergi Oranı</Label>
                  <span className={`text-lg font-mono font-bold ${
                    taxRate < 8 ? 'text-green-400' : 
                    taxRate > 12 ? 'text-red-400' : 'text-yellow-400'
                  }`}>
                    %{taxRate}
                  </span>
               </div>
               
               <Slider
                  value={[taxRate]}
                  onValueChange={(value) => setTaxRate(value[0])}
                  min={0}
                  max={20}
                  step={1}
                  className="py-2"
                />
                
                <div className="flex justify-between text-xs text-slate-400 mt-2">
                  <span>Düşük (%0)</span>
                  <span>Normal (%9)</span>
                  <span>Yüksek (%20)</span>
                </div>
            </div>

            <div className="space-y-2 text-sm text-slate-300">
               <p className="font-bold text-white border-b border-slate-700 pb-1 mb-2">Vergi Etkileri</p>
               <div className="flex justify-between">
                  <span>Konut Talebi:</span>
                  <span className={taxRate > 9 ? 'text-red-400' : 'text-green-400'}>
                     {taxRate > 9 ? 'Azalır' : taxRate < 9 ? 'Artar' : 'Dengeli'}
                  </span>
               </div>
               <div className="flex justify-between">
                  <span>Ticari Talep:</span>
                   <span className={taxRate > 10 ? 'text-red-400' : 'text-green-400'}>
                     {taxRate > 10 ? 'Azalır' : taxRate < 8 ? 'Artar' : 'Dengeli'}
                  </span>
               </div>
               <div className="flex justify-between">
                  <span>Endüstriyel Talep:</span>
                   <span className={taxRate > 11 ? 'text-red-400' : 'text-green-400'}>
                     {taxRate > 11 ? 'Azalır' : taxRate < 7 ? 'Artar' : 'Dengeli'}
                  </span>
               </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
