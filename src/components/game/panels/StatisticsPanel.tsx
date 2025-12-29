'use client';

import React, { useState, useRef, useEffect } from 'react';
import { msg, useMessages } from 'gt-next';
import { useGame } from '@/context/GameContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Translatable UI labels
const UI_LABELS = {
  cityStatistics: msg('City Statistics'),
  population: msg('Population'),
  jobs: msg('Jobs'),
  treasury: msg('Treasury'),
  weekly: msg('Weekly'),
  money: msg('Money'),
  happiness: msg('Happiness'),
  notEnoughData: msg('Not enough data yet. Keep playing to see historical trends.'),
};

export function StatisticsPanel() {
  const { state, setActivePanel } = useGame();
  const { history, stats } = state;
  const [activeTab, setActiveTab] = useState<'population' | 'money' | 'happiness'>('population');
  const m = useMessages();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || history.length < 2) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;
    
    ctx.fillStyle = '#1a1f2e';
    ctx.fillRect(0, 0, width, height);
    
    let data: number[] = [];
    let color = '#10b981';
    const formatValue = (v: number) => v.toLocaleString();
    
    switch (activeTab) {
      case 'population':
        data = history.map(h => h.population);
        color = '#10b981';
        break;
      case 'money':
        data = history.map(h => h.money);
        color = '#f59e0b';
        break;
      case 'happiness':
        data = history.map(h => h.happiness);
        color = '#ec4899';
        break;
    }
    
    if (data.length < 2) return;
    
    const minVal = Math.min(...data);
    const maxVal = Math.max(...data);
    const range = maxVal - minVal || 1;
    
    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = padding + (height - padding * 2) * (i / 4);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const stepX = (width - padding * 2) / (data.length - 1);
    
    data.forEach((val, i) => {
      const x = padding + i * stepX;
      const y = padding + (height - padding * 2) * (1 - (val - minVal) / range);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
  }, [history, activeTab]);
  
  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{m(UI_LABELS.cityStatistics)}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <Card className="p-2 sm:p-3">
              <div className="text-muted-foreground text-[10px] sm:text-xs mb-1">{m(UI_LABELS.population)}</div>
              <div className="font-mono tabular-nums font-semibold text-green-400 text-sm sm:text-base truncate">{stats.population.toLocaleString()}</div>
            </Card>
            <Card className="p-2 sm:p-3">
              <div className="text-muted-foreground text-[10px] sm:text-xs mb-1">{m(UI_LABELS.jobs)}</div>
              <div className="font-mono tabular-nums font-semibold text-blue-400 text-sm sm:text-base truncate">{stats.jobs.toLocaleString()}</div>
            </Card>
            <Card className="p-2 sm:p-3">
              <div className="text-muted-foreground text-[10px] sm:text-xs mb-1">{m(UI_LABELS.treasury)}</div>
              <div className="font-mono tabular-nums font-semibold text-amber-400 text-sm sm:text-base truncate">${stats.money.toLocaleString()}</div>
            </Card>
            <Card className="p-2 sm:p-3">
              <div className="text-muted-foreground text-[10px] sm:text-xs mb-1">{m(UI_LABELS.weekly)}</div>
              <div className={`font-mono tabular-nums font-semibold text-sm sm:text-base truncate ${stats.income - stats.expenses >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${Math.floor((stats.income - stats.expenses) / 4).toLocaleString()}
              </div>
            </Card>
          </div>
          
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="grid w-full grid-cols-3 h-auto">
              <TabsTrigger value="population" className="text-xs sm:text-sm py-2 px-2 sm:px-3">{m(UI_LABELS.population)}</TabsTrigger>
              <TabsTrigger value="money" className="text-xs sm:text-sm py-2 px-2 sm:px-3">{m(UI_LABELS.money)}</TabsTrigger>
              <TabsTrigger value="happiness" className="text-xs sm:text-sm py-2 px-2 sm:px-3">{m(UI_LABELS.happiness)}</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <Card className="p-4">
            {history.length < 2 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                {m(UI_LABELS.notEnoughData)}
              </div>
            ) : (
              <canvas ref={canvasRef} width={536} height={200} className="w-full rounded-md" />
            )}
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
