'use client';

import React, { useMemo, useState } from 'react';
import { T, msg, useMessages, useGT } from 'gt-next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Guest, GuestThoughtType } from '@/games/coaster/types';

const FILTER_OPTIONS = [
  { key: 'all', label: msg('All') },
  { key: 'wandering', label: msg('Wandering') },
  { key: 'queue', label: msg('Queueing') },
  { key: 'ride', label: msg('On Ride') },
  { key: 'shop', label: msg('At Shop') },
  { key: 'leaving', label: msg('Leaving') },
];

const MOOD_LABELS = {
  thrilled: msg('Thrilled'),
  happy: msg('Happy'),
  okay: msg('Okay'),
  unhappy: msg('Unhappy'),
};

const NEED_HINTS = {
  hungry: msg('Hungry'),
  thirsty: msg('Thirsty'),
  bathroom: msg('Bathroom'),
  tired: msg('Tired'),
};

interface GuestPanelProps {
  guests: Guest[];
  onClose: () => void;
}

export default function GuestPanel({ guests, onClose }: GuestPanelProps) {
  const [filter, setFilter] = useState<'all' | 'wandering' | 'queue' | 'ride' | 'shop' | 'leaving'>('all');
  const m = useMessages();
  const gt = useGT();

  const getMoodStyles = (guest: Guest) => {
    if (guest.happiness >= 180) {
      return { label: MOOD_LABELS.thrilled, className: 'border-emerald-500/30 bg-emerald-500/20 text-emerald-200' };
    }
    if (guest.happiness >= 140) {
      return { label: MOOD_LABELS.happy, className: 'border-sky-500/30 bg-sky-500/20 text-sky-200' };
    }
    if (guest.happiness >= 100) {
      return { label: MOOD_LABELS.okay, className: 'border-amber-500/30 bg-amber-500/20 text-amber-200' };
    }
    return { label: MOOD_LABELS.unhappy, className: 'border-rose-500/30 bg-rose-500/20 text-rose-200' };
  };

  const getNeedHint = (guest: Guest) => {
    if (guest.needs.hunger < 80) return NEED_HINTS.hungry;
    if (guest.needs.thirst < 80) return NEED_HINTS.thirsty;
    if (guest.needs.bathroom < 60) return NEED_HINTS.bathroom;
    if (guest.needs.energy < 60) return NEED_HINTS.tired;
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

  const filteredGuests = useMemo(() => {
    if (filter === 'all') return guests;
    if (filter === 'queue') return guests.filter((guest) => guest.state === 'queuing');
    if (filter === 'ride') return guests.filter((guest) => guest.state === 'on_ride');
    if (filter === 'shop') return guests.filter((guest) => guest.state === 'at_shop');
    if (filter === 'leaving') return guests.filter((guest) => guest.state === 'leaving_park');
    return guests.filter((guest) => guest.state === 'wandering');
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
          {FILTER_OPTIONS.map((item) => (
            <Button
              key={item.key}
              variant={filter === item.key ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFilter(item.key as typeof filter)}
            >
              {m(item.label)}
            </Button>
          ))}
        </div>
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <T>
              <span>Total Guests</span>
            </T>
            <span className="font-semibold">{guests.length}</span>
          </div>
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
                          {m(mood.label)}
                        </span>
                        <span>{gt('Energy {percent}%', { percent: Math.round((guest.needs.energy / 255) * 100) })}</span>
                        {needHint && (
                          <span className="text-amber-200/80">{m(needHint)}</span>
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
