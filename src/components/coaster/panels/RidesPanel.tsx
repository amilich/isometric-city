'use client';

import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Ride } from '@/games/coaster/types';
import { estimateQueueWaitMinutes, getRideDispatchCapacity } from '@/lib/coasterQueue';

interface RidesPanelProps {
  rides: Ride[];
  onClose: () => void;
  onSelectRide: (rideId: string) => void;
  onToggleRide: (rideId: string) => void;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  open: { label: 'Open', className: 'text-emerald-400' },
  closed: { label: 'Closed', className: 'text-amber-400' },
  broken: { label: 'Broken', className: 'text-rose-400' },
  testing: { label: 'Testing', className: 'text-sky-400' },
  building: { label: 'Building', className: 'text-slate-400' },
  storm_closed: { label: 'Storm Closed', className: 'text-sky-300' },
};

export default function RidesPanel({ rides, onClose, onSelectRide, onToggleRide }: RidesPanelProps) {
  const sortedRides = useMemo(
    () => rides.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [rides]
  );

  return (
    <div className="absolute top-20 right-6 z-50 w-96">
      <Card className="bg-card/95 border-border/70 shadow-xl">
        <div className="flex items-start justify-between p-4 border-b border-border/60">
          <div>
            <div className="text-sm text-muted-foreground uppercase tracking-[0.2em]">Rides</div>
            <div className="text-lg font-semibold">Ride Operations</div>
          </div>
          <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close rides panel">
            ✕
          </Button>
        </div>
        <div className="p-4 space-y-4 text-sm">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Attractions</div>
          <ScrollArea className="h-56 rounded-md border border-border/50">
            <div className="p-3 space-y-3">
              {sortedRides.length === 0 && (
                <div className="text-xs text-muted-foreground">No rides built yet.</div>
              )}
              {sortedRides.map((ride) => {
                const status = ride.weatherClosed && ride.status === 'closed'
                  ? STATUS_STYLES.storm_closed
                  : STATUS_STYLES[ride.status] ?? STATUS_STYLES.building;
                const estimatedWait = estimateQueueWaitMinutes(
                  ride.queue.guestIds.length,
                  ride.stats.rideTime,
                  getRideDispatchCapacity(ride)
                );
                return (
                  <div key={ride.id} className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{ride.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Queue {ride.queue.guestIds.length} / {ride.queue.maxLength} ·{' '}
                        <span className={`font-semibold uppercase tracking-[0.1em] ${status.className}`}>
                          {status.label}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {estimatedWait > 0 ? `${estimatedWait} min wait` : 'No wait'} · ${ride.price} ticket ·{' '}
                        {Math.round(ride.stats.reliability * 100)}% reliable
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {Math.round(ride.stats.uptime * 100)}% uptime · {ride.stats.totalRiders} riders
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => onSelectRide(ride.id)}
                      >
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant={ride.status === 'open' ? 'outline' : 'default'}
                        className="h-7 px-2 text-xs"
                        disabled={ride.status === 'broken' || ride.weatherClosed}
                        onClick={() => onToggleRide(ride.id)}
                      >
                        {ride.weatherClosed ? 'Storm' : ride.status === 'open' ? 'Close' : 'Open'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </Card>
    </div>
  );
}
