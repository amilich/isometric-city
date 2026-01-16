'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Ride } from '@/games/coaster/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { T, Var, Num, Currency, useGT } from 'gt-next';

interface RidePanelProps {
  ride: Ride;
  onClose: () => void;
  onToggleStatus: () => void;
  onPriceChange: (price: number) => void;
}

export default function RidePanel({ ride, onClose, onToggleStatus, onPriceChange }: RidePanelProps) {
  const gt = useGT();
  const [price, setPrice] = useState(ride.price);

  useEffect(() => {
    setPrice(ride.price);
  }, [ride.price]);

  const queueLength = ride.queue.guestIds.length;
  const rideTimeMinutes = Math.max(1, Math.round(ride.stats.rideTime / 60));
  const estimatedWait = ride.stats.capacity > 0
    ? Math.round((queueLength / ride.stats.capacity) * rideTimeMinutes)
    : 0;

  const statusLabel = useMemo(() => {
    switch (ride.status) {
      case 'open':
        return gt('Open', { $context: 'Ride status indicating the ride is open' });
      case 'closed':
        return gt('Closed', { $context: 'Ride status indicating the ride is closed' });
      case 'broken':
        return gt('Broken', { $context: 'Ride status indicating the ride is broken' });
      case 'testing':
        return gt('Testing', { $context: 'Ride status indicating the ride is being tested' });
      default:
        return gt('Building', { $context: 'Ride status indicating the ride is being built' });
    }
  }, [ride.status, gt]);

  return (
    <div className="absolute top-20 right-6 z-50 w-72">
      <Card className="bg-card/95 border-border/70 shadow-xl">
        <div className="flex items-start justify-between p-4 border-b border-border/60">
          <T>
            <div>
              <div className="text-sm text-muted-foreground uppercase tracking-[0.2em]">Ride</div>
              <div className="text-lg font-semibold"><Var>{ride.name}</Var></div>
            </div>
          </T>
          <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label={gt('Close ride panel')}>
            ✕
          </Button>
        </div>
        <div className="p-4 space-y-4 text-sm">
          <T>
            <div className="flex items-center justify-between">
              <span>Status</span>
              <Var>
                <span className={`text-xs font-semibold uppercase tracking-[0.15em] ${ride.status === 'open' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {statusLabel}
                </span>
              </Var>
            </div>
          </T>
          <T>
            <div className="flex items-center justify-between">
              <span>Queue</span>
              <span><Num>{queueLength}</Num> guests</span>
            </div>
          </T>
          <T>
            <div className="flex items-center justify-between">
              <span>Estimated Wait</span>
              <span><Num>{estimatedWait}</Num> min</span>
            </div>
          </T>
          <T>
            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div>
                <div className="text-muted-foreground">Excitement</div>
                <div className="font-semibold"><Num>{ride.excitement}</Num></div>
              </div>
              <div>
                <div className="text-muted-foreground">Intensity</div>
                <div className="font-semibold"><Num>{ride.intensity}</Num></div>
              </div>
              <div>
                <div className="text-muted-foreground">Nausea</div>
                <div className="font-semibold"><Num>{ride.nausea}</Num></div>
              </div>
            </div>
          </T>
          <T>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Ticket Price</span>
                <span><Currency currency="USD">{price}</Currency></span>
              </div>
              <Var>
                <Slider
                  value={[price]}
                  min={0}
                  max={10}
                  step={1}
                  onValueChange={(value) => setPrice(value[0])}
                  onValueCommit={(value) => onPriceChange(value[0])}
                />
              </Var>
            </div>
          </T>
          <Button className="w-full" variant={ride.status === 'open' ? 'outline' : 'default'} onClick={onToggleStatus}>
            {ride.status === 'open' ? gt('Close Ride') : gt('Open Ride')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
