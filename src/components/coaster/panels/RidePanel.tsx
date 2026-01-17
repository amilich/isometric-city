'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
  const [price, setPrice] = useState(ride.price);

  useEffect(() => {
    setPrice(ride.price);
  }, [ride.price]);

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
          <T>
            <div className="flex items-center justify-between">
              <span>Status</span>
              <span className={`text-xs font-semibold uppercase tracking-[0.15em] ${ride.status === 'open' ? 'text-emerald-400' : 'text-amber-400'}`}>
                <Var>{statusLabel}</Var>
              </span>
            </div>
          </T>
          <T>
            <div className="flex items-center justify-between">
              <span>Queue</span>
              <span>
                <Var>{queueLength}</Var> / <Var>{ride.queue.maxLength}</Var> guests
              </span>
            </div>
          </T>
          <T>
            <div className="flex items-center justify-between">
              <span>Estimated Wait</span>
              <span><Var>{estimatedWait}</Var> min</span>
            </div>
          </T>
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
            <T>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Reliability</span>
                <span><Var>{reliabilityPercent}</Var>%</span>
              </div>
            </T>
            <Progress value={reliabilityPercent} className="h-2" />
            <T>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Uptime</span>
                <span><Var>{uptimePercent}</Var>%</span>
              </div>
            </T>
            <Progress value={uptimePercent} className="h-2" />
          </div>
          <div className="space-y-2">
            <T>
              <div className="flex items-center justify-between">
                <span>Ticket Price</span>
                <span>$<Var>{price}</Var></span>
              </div>
            </T>
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
