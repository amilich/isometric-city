'use client';

import React from 'react';
import { msg, useMessages } from 'gt-next';
import { useCoaster } from '@/context/CoasterContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const UI_LABELS = {
  guests: msg('Guests'),
  count: msg('Guests in Park'),
  happiness: msg('Average Happiness'),
  hunger: msg('Average Hunger'),
  thirst: msg('Average Thirst'),
  energy: msg('Average Energy'),
};

export function GuestsPanel() {
  const { state, setActivePanel } = useCoaster();
  const { guests } = state;
  const m = useMessages();

  const averages = guests.reduce(
    (acc, guest) => {
      acc.happiness += guest.needs.happiness;
      acc.hunger += guest.needs.hunger;
      acc.thirst += guest.needs.thirst;
      acc.energy += guest.needs.energy;
      return acc;
    },
    { happiness: 0, hunger: 0, thirst: 0, energy: 0 }
  );

  const count = guests.length || 1;

  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-[380px]">
        <DialogHeader>
          <DialogTitle>{m(UI_LABELS.guests)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{m(UI_LABELS.count)}</span>
            <span className="font-semibold">{guests.length}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{m(UI_LABELS.happiness)}</span>
            <span className="font-semibold">{Math.round(averages.happiness / count)}%</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{m(UI_LABELS.hunger)}</span>
            <span className="font-semibold">{Math.round(averages.hunger / count)}%</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{m(UI_LABELS.thirst)}</span>
            <span className="font-semibold">{Math.round(averages.thirst / count)}%</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{m(UI_LABELS.energy)}</span>
            <span className="font-semibold">{Math.round(averages.energy / count)}%</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
