'use client';

import React from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X } from 'lucide-react';
import { T, useGT } from 'gt-next';

export function GuestsPanel() {
  const { state, setActivePanel } = useCoaster();
  const { guests } = state;
  const gt = useGT();

  // Calculate averages
  const avgHappiness = guests.length > 0 
    ? Math.round(guests.reduce((sum, g) => sum + g.happiness, 0) / guests.length)
    : 0;
  
  const avgHunger = guests.length > 0
    ? Math.round(guests.reduce((sum, g) => sum + g.hunger, 0) / guests.length)
    : 0;

  const avgThirst = guests.length > 0
    ? Math.round(guests.reduce((sum, g) => sum + g.thirst, 0) / guests.length)
    : 0;

  const getHappinessColor = (value: number) => {
    if (value >= 180) return 'text-green-400';
    if (value >= 100) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getNeedColor = (value: number) => {
    if (value >= 180) return 'text-red-400';
    if (value >= 100) return 'text-yellow-400';
    return 'text-green-400';
  };

  return (
    <Card className="fixed top-16 right-4 w-80 max-h-[calc(100vh-5rem)] bg-slate-900/95 border-white/10 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <T><h2 className="text-white font-bold">Guests</h2></T>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setActivePanel('none')}
          className="h-6 w-6 text-white/50 hover:text-white hover:bg-white/10"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-3 bg-white/5 rounded-lg text-center">
            <p className="text-3xl font-bold text-white">{guests.length}</p>
            <T><p className="text-xs text-white/50">Total Guests</p></T>
          </div>
          <div className="p-3 bg-white/5 rounded-lg text-center">
            <p className={`text-3xl font-bold ${getHappinessColor(avgHappiness)}`}>
              {Math.round(avgHappiness / 2.55)}%
            </p>
            <T><p className="text-xs text-white/50">Avg Happiness</p></T>
          </div>
        </div>

        {/* Average Needs */}
        <div className="mb-6">
          <T><h3 className="text-white/50 text-xs uppercase tracking-wider mb-3">Average Needs</h3></T>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <T><span className="text-sm text-white/60 w-20">Happiness</span></T>
              <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${(avgHappiness / 255) * 100}%` }}
                />
              </div>
              <span className={`text-sm font-mono w-12 text-right ${getHappinessColor(avgHappiness)}`}>
                {Math.round(avgHappiness / 2.55)}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <T><span className="text-sm text-white/60 w-20">Hunger</span></T>
              <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-orange-500 transition-all"
                  style={{ width: `${(avgHunger / 255) * 100}%` }}
                />
              </div>
              <span className={`text-sm font-mono w-12 text-right ${getNeedColor(avgHunger)}`}>
                {Math.round(avgHunger / 2.55)}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <T><span className="text-sm text-white/60 w-20">Thirst</span></T>
              <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${(avgThirst / 255) * 100}%` }}
                />
              </div>
              <span className={`text-sm font-mono w-12 text-right ${getNeedColor(avgThirst)}`}>
                {Math.round(avgThirst / 2.55)}%
              </span>
            </div>
          </div>
        </div>

        {/* Guest List */}
        <div>
          <h3 className="text-white/50 text-xs uppercase tracking-wider mb-3">
            {gt('Recent Guests ({shown} of {total})', { shown: Math.min(10, guests.length), total: guests.length })}
          </h3>
          {guests.length === 0 ? (
            <T>
              <p className="text-white/50 text-sm text-center py-4">
                No guests in the park yet.
              </p>
            </T>
          ) : (
            <div className="space-y-2">
              {guests.slice(0, 10).map(guest => (
                <div 
                  key={guest.id}
                  className="p-2 bg-white/5 rounded flex items-center gap-3"
                >
                  <div 
                    className="w-6 h-6 rounded-full"
                    style={{ backgroundColor: guest.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{guest.name}</p>
                    <p className="text-white/50 text-xs">{guest.state}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs ${getHappinessColor(guest.happiness)}`}>
                      😊 {Math.round(guest.happiness / 2.55)}%
                    </p>
                    <p className="text-white/40 text-xs">${guest.cash}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}
