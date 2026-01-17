'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Ride } from '@/games/coaster/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { estimateQueueWaitMinutes, getRideDispatchCapacity } from '@/lib/coasterQueue';
import { T, Num, useGT } from 'gt-next';

interface RidePanelProps {
  ride: Ride;
  onClose: () => void;
  onToggleStatus: () => void;
  onPriceChange: (price: number) => void;
}

export default function RidePanel({ ride, onClose, onToggleStatus, onPriceChange }: RidePanelProps) {
  const [price, setPrice] = useState(ride.price);
  const gt = useGT();

  useEffect(() => {
    setPrice(ride.price);
  }, [ride.price]);

  const queueLength = ride.queue.guestIds.length;
  const estimatedWait = estimateQueueWaitMinutes(queueLength, ride.stats.rideTime, getRideDispatchCapacity(ride));
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
          <div>
            <T><div className="text-sm text-muted-foreground uppercase tracking-[0.2em]">Ride</div></T>
            <div className="text-lg font-semibold">{ride.name}</div>
          </div>
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
            <T>
              <span>
                <Num>{queueLength}</Num> / <Num>{ride.queue.maxLength}</Num> guests
              </span>
            </T>
          </div>
          <div className="flex items-center justify-between">
            <T><span>Estimated Wait</span></T>
            <T><span><Num>{estimatedWait}</Num> min</span></T>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            <div>
              <T><div className="text-muted-foreground">Excitement</div></T>
              <div className="font-semibold"><Num>{ride.excitement}</Num></div>
            </div>
            <div>
              <T><div className="text-muted-foreground">Intensity</div></T>
              <div className="font-semibold"><Num>{ride.intensity}</Num></div>
            </div>
            <div>
              <T><div className="text-muted-foreground">Nausea</div></T>
              <div className="font-semibold"><Num>{ride.nausea}</Num></div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <T><span>Reliability</span></T>
              <span><Num>{reliabilityPercent}</Num>%</span>
            </div>
            <Progress value={reliabilityPercent} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <T><span>Uptime</span></T>
              <span><Num>{uptimePercent}</Num>%</span>
            </div>
            <Progress value={uptimePercent} className="h-2" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <T><span>Ticket Price</span></T>
              <span>$<Num>{price}</Num></span>
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
