'use client';

import React from 'react';
import { msg, useMessages } from 'gt-next';
import { useCoaster } from '@/context/CoasterContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

const UI_LABELS = {
  rides: msg('Rides'),
  status: msg('Status'),
  price: msg('Price'),
  open: msg('Open'),
  closed: msg('Closed'),
  testing: msg('Testing'),
  close: msg('Close'),
  waitTime: msg('Wait'),
  guests: msg('Guests'),
  revenue: msg('Revenue'),
  noRides: msg('Build some rides to manage pricing and status.'),
};

export function RidesPanel() {
  const { state, setActivePanel, updateRide } = useCoaster();
  const { rides } = state;
  const m = useMessages();

  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{m(UI_LABELS.rides)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
          {rides.length === 0 && (
            <div className="text-sm text-muted-foreground">{m(UI_LABELS.noRides)}</div>
          )}

          {rides.map((ride) => (
            <div key={ride.id} className="border border-border/60 rounded-md p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-foreground">{ride.name}</div>
                  <div className="text-xs text-muted-foreground capitalize">{ride.type.replace('_', ' ')}</div>
                </div>
                <Button
                  variant={ride.status !== 'closed' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() =>
                    updateRide(ride.id, {
                      status: ride.status === 'closed' ? 'open' : 'closed',
                    })
                  }
                >
                  {ride.status === 'closed' ? m(UI_LABELS.open) : m(UI_LABELS.close)}
                </Button>
              </div>

              {ride.price > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">{m(UI_LABELS.price)}</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[ride.price]}
                      onValueChange={(value) => updateRide(ride.id, { price: value[0] })}
                      min={0}
                      max={25}
                      step={1}
                      className="flex-1"
                    />
                    <span className="w-12 text-right font-mono text-sm">${ride.price}</span>
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                {m(UI_LABELS.status)}:{' '}
                <span className="capitalize">
                  {ride.status === 'testing'
                    ? m(UI_LABELS.testing)
                    : ride.status === 'open'
                    ? m(UI_LABELS.open)
                    : m(UI_LABELS.closed)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                <span>
                  {m(UI_LABELS.waitTime)}: {ride.performance.waitTime.toFixed(1)}m
                </span>
                <span>
                  {m(UI_LABELS.guests)}: {ride.performance.guestsToday}
                </span>
                <span>
                  {m(UI_LABELS.revenue)}: ${Math.round(ride.performance.revenueToday)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
