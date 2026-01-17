'use client';

import React, { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Guest, GuestItem, GuestThoughtType } from '@/games/coaster/types';
import { T, Var, useGT } from 'gt-next';

interface GuestPanelProps {
  guests: Guest[];
  onClose: () => void;
}

export default function GuestPanel({ guests, onClose }: GuestPanelProps) {
  const [filter, setFilter] = useState<'all' | 'wandering' | 'queue' | 'ride' | 'shop' | 'leaving'>('all');
  const gt = useGT();

  const getMoodStyles = (guest: Guest) => {
    if (guest.happiness >= 180) {
      return { label: gt('Thrilled'), className: 'border-emerald-500/30 bg-emerald-500/20 text-emerald-200' };
    }
    if (guest.happiness >= 140) {
      return { label: gt('Happy'), className: 'border-sky-500/30 bg-sky-500/20 text-sky-200' };
    }
    if (guest.happiness >= 100) {
      return { label: gt('Okay'), className: 'border-amber-500/30 bg-amber-500/20 text-amber-200' };
    }
    return { label: gt('Unhappy'), className: 'border-rose-500/30 bg-rose-500/20 text-rose-200' };
  };

  const getNeedHint = (guest: Guest) => {
    if (guest.needs.hunger < 80) return gt('Hungry');
    if (guest.needs.thirst < 80) return gt('Thirsty');
    if (guest.needs.bathroom < 60) return gt('Bathroom');
    if (guest.needs.energy < 60) return gt('Tired');
    return null;
  };

  const getThoughtClass = (type: GuestThoughtType) => {
    switch (type) {
      case 'positive':
        return 'text-emerald-200';
      case 'negative':
        return 'text-rose-200';
      case 'warning':
        return 'text-amber-200';
      default:
        return 'text-slate-200';
    }
  };

  const getItemLabel = (item: GuestItem) => {
    switch (item) {
      case 'food':
        return gt('Snack');
      case 'drink':
        return gt('Drink');
      case 'souvenir':
        return gt('Souvenir');
      case 'map':
        return gt('Park Map');
      case 'hat':
        return gt('Hat');
      case 'balloon':
        return gt('Balloon');
      default:
        return gt('Item');
    }
  };

  const filteredGuests = useMemo(() => {
    if (filter === 'all') return guests;
    if (filter === 'queue') return guests.filter((guest) => guest.state === 'queuing' || guest.state === 'heading_to_ride');
    if (filter === 'ride') return guests.filter((guest) => guest.state === 'on_ride');
    if (filter === 'shop') return guests.filter((guest) => guest.state === 'at_shop' || guest.state === 'heading_to_shop');
    if (filter === 'leaving') return guests.filter((guest) => guest.state === 'leaving_park');
    return guests.filter((guest) => guest.state === 'wandering' || guest.state === 'sitting');
  }, [filter, guests]);

  return (
    <div className="absolute top-20 right-6 z-50 w-80">
      <Card className="bg-card/95 border-border/70 shadow-xl">
        <div className="flex items-start justify-between p-4 border-b border-border/60">
          <div>
            <T>
              <div className="text-sm text-muted-foreground uppercase tracking-[0.2em]">Guests</div>
              <div className="text-lg font-semibold">Park Visitors</div>
            </T>
          </div>
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
            { key: 'leaving', label: gt('Leaving') },
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
              <span className="font-semibold"><Var>{guests.length}</Var></span>
            </div>
          </T>
          <ScrollArea className="h-56 rounded-md border border-border/50">
            <div className="p-3 space-y-2 text-sm">
              {filteredGuests.length === 0 && (
                <T>
                  <div className="text-muted-foreground text-xs">No guests match this filter.</div>
                </T>
              )}
              {filteredGuests.map((guest) => {
                const mood = getMoodStyles(guest);
                const needHint = getNeedHint(guest);
                const latestThought = guest.thoughts[0];
                return (
                  <div key={guest.id} className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{guest.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{guest.state.replace('_', ' ')}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${mood.className}`}>
                          {mood.label}
                        </span>
                        <span>{gt('Energy {percent}%', { percent: Math.round((guest.needs.energy / 255) * 100) })}</span>
                        {needHint && (
                          <span className="text-amber-200/80">{needHint}</span>
                        )}
                        {guest.hasItem && (
                          <span className="text-emerald-200/80">{getItemLabel(guest.hasItem)}</span>
                        )}
                      </div>
                      {latestThought && (
                        <div className={`mt-1 text-[10px] italic ${getThoughtClass(latestThought.type)}`}>
                          {latestThought.message}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ${guest.money}
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
