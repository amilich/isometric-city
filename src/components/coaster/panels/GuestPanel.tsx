'use client';

import React, { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Guest } from '@/games/coaster/types';
import { T, Num, Currency, useGT } from 'gt-next';

interface GuestPanelProps {
  guests: Guest[];
  onClose: () => void;
}

export default function GuestPanel({ guests, onClose }: GuestPanelProps) {
  const gt = useGT();
  const [filter, setFilter] = useState<'all' | 'wandering' | 'queue' | 'ride' | 'shop'>('all');

  const filteredGuests = useMemo(() => {
    if (filter === 'all') return guests;
    if (filter === 'queue') return guests.filter((guest) => guest.state === 'queuing');
    if (filter === 'ride') return guests.filter((guest) => guest.state === 'on_ride');
    if (filter === 'shop') return guests.filter((guest) => guest.state === 'at_shop');
    return guests.filter((guest) => guest.state === 'wandering');
  }, [filter, guests]);

  return (
    <div className="absolute top-20 right-6 z-50 w-80">
      <Card className="bg-card/95 border-border/70 shadow-xl">
        <div className="flex items-start justify-between p-4 border-b border-border/60">
          <T>
            <div>
              <div className="text-sm text-muted-foreground uppercase tracking-[0.2em]">Guests</div>
              <div className="text-lg font-semibold">Park Visitors</div>
            </div>
          </T>
          <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label={gt('Close guest panel')}>
            ✕
          </Button>
        </div>
        <T>
          <div className="px-4 pt-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">Filters</div>
        </T>
        <div className="px-4 py-2 flex flex-wrap gap-2 text-xs">
          {[
            { key: 'all', label: gt('All') },
            { key: 'wandering', label: gt('Wandering') },
            { key: 'queue', label: gt('Queueing') },
            { key: 'ride', label: gt('On Ride') },
            { key: 'shop', label: gt('At Shop') },
          ].map((item) => (
            <Button
              key={item.key}
              variant={filter === item.key ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFilter(item.key as typeof filter)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <div className="px-4 pb-4">
          <T>
            <div className="flex items-center justify-between text-sm mb-2">
              <span>Total Guests</span>
              <span className="font-semibold"><Num>{guests.length}</Num></span>
            </div>
          </T>
          <ScrollArea className="h-56 rounded-md border border-border/50">
            <div className="p-3 space-y-2 text-sm">
              {filteredGuests.length === 0 && (
                <T>
                  <div className="text-muted-foreground text-xs">No guests match this filter.</div>
                </T>
              )}
              {filteredGuests.map((guest) => (
                <div key={guest.id} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{guest.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">{guest.state.replace('_', ' ')}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <Currency currency="USD">{guest.money}</Currency>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </Card>
    </div>
  );
}
