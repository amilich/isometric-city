'use client';

import React, { useMemo, useState } from 'react';
import { Ride } from '@/games/coaster/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { estimateQueueWaitMinutes } from '@/lib/coasterQueue';
import { T, Var, useGT } from 'gt-next';

interface RidePanelProps {
  ride: Ride;
  onClose: () => void;
  onToggleStatus: () => void;
  onPriceChange: (price: number) => void;
}

export default function RidePanel({ ride, onClose, onToggleStatus, onPriceChange }: RidePanelProps) {
  const gt = useGT();
  const [priceState, setPriceState] = useState({ id: ride.id, price: ride.price });
  const price = priceState.id === ride.id ? priceState.price : ride.price;
  const setPrice = (newPrice: number) => setPriceState({ id: ride.id, price: newPrice });

  const queueLength = ride.queue.guestIds.length;
  const estimatedWait = estimateQueueWaitMinutes(queueLength, ride.stats.rideTime, ride.stats.capacity);
  const reliabilityPercent = Math.round(ride.stats.reliability * 100);
  const uptimePercent = Math.round(ride.stats.uptime * 100);

  const statusLabel = useMemo(() => {
    switch (ride.status) {
      case 'open':
        return gt('Open');
      case 'closed':
        return gt('Closed');
      case 'broken':
        return gt('Broken');
      case 'testing':
        return gt('Testing');
      default:
        return gt('Building');
    }
  }, [ride.status, gt]);

  const canToggle = ride.status === 'open' || ride.status === 'closed';
  const toggleLabel = ride.status === 'broken'
    ? gt('Awaiting Repair')
    : ride.status === 'open'
      ? gt('Close Ride')
      : gt('Open Ride');

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
          <div className="flex items-center justify-between">
            <T><span>Status</span></T>
            <span className={`text-xs font-semibold uppercase tracking-[0.15em] ${ride.status === 'open' ? 'text-emerald-400' : 'text-amber-400'}`}>
              {statusLabel}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <T><span>Queue</span></T>
            <span>
              {gt('{current} / {max} guests', { current: queueLength, max: ride.queue.maxLength })}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <T><span>Estimated Wait</span></T>
            <span>{gt('{minutes} min', { minutes: estimatedWait })}</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            <T>
              <div>
                <div className="text-muted-foreground">Excitement</div>
                <div className="font-semibold"><Var>{ride.excitement}</Var></div>
              </div>
            </T>
            <T>
              <div>
                <div className="text-muted-foreground">Intensity</div>
                <div className="font-semibold"><Var>{ride.intensity}</Var></div>
              </div>
            </T>
            <T>
              <div>
                <div className="text-muted-foreground">Nausea</div>
                <div className="font-semibold"><Var>{ride.nausea}</Var></div>
              </div>
            </T>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <T><span>Reliability</span></T>
              <span>{gt('{percent}%', { percent: reliabilityPercent })}</span>
            </div>
            <Progress value={reliabilityPercent} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <T><span>Uptime</span></T>
              <span>{gt('{percent}%', { percent: uptimePercent })}</span>
            </div>
            <Progress value={uptimePercent} className="h-2" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <T><span>Ticket Price</span></T>
              <span>{gt('${price}', { price })}</span>
            </div>
            <Slider
              value={[price]}
              min={0}
              max={10}
              step={1}
              onValueChange={(value) => setPrice(value[0])}
              onValueCommit={(value) => onPriceChange(value[0])}
            />
          </div>
          <Button
            className="w-full"
            variant={ride.status === 'open' ? 'outline' : 'default'}
            onClick={onToggleStatus}
            disabled={!canToggle}
          >
            {toggleLabel}
          </Button>
        </div>
      </Card>
    </div>
  );
}
