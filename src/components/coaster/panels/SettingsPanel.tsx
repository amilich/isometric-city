'use client';

import React from 'react';
import { msg, useMessages } from 'gt-next';
import { useCoaster } from '@/context/CoasterContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';

const UI_LABELS = {
  settings: msg('Settings'),
  parkName: msg('Park Name'),
  maxGuests: msg('Max Guests'),
};

export function SettingsPanel() {
  const { state, setActivePanel, setParkName, setMaxGuests } = useCoaster();
  const { parkName, maxGuests } = state;
  const m = useMessages();

  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{m(UI_LABELS.settings)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>{m(UI_LABELS.parkName)}</Label>
            <Input value={parkName} onChange={(event) => setParkName(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>{m(UI_LABELS.maxGuests)}</Label>
            <div className="flex items-center gap-4">
              <Slider
                value={[maxGuests]}
                onValueChange={(value) => setMaxGuests(value[0])}
                min={100}
                max={1000}
                step={50}
                className="flex-1"
              />
              <span className="w-12 text-right font-mono text-sm">{maxGuests}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
