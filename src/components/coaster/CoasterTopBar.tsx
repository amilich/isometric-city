'use client';

import React from 'react';
import { msg, useMessages, useGT } from 'gt-next';
import { useCoaster } from '@/context/CoasterContext';
import { Button } from '@/components/ui/button';
import { MoneyIcon, PopulationIcon, HappyIcon, PlayIcon, PauseIcon, FastForwardIcon } from '@/components/ui/Icons';

const MONTHS = [
  msg('Jan'),
  msg('Feb'),
  msg('Mar'),
  msg('Apr'),
  msg('May'),
  msg('Jun'),
  msg('Jul'),
  msg('Aug'),
  msg('Sep'),
  msg('Oct'),
  msg('Nov'),
  msg('Dec'),
];

export function CoasterTopBar() {
  const { state, setSpeed } = useCoaster();
  const { finance, guests, parkRating, hour, day, month, year, speed, parkName } = state;
  const m = useMessages();
  const gt = useGT();

  const hourInt = Math.floor(hour);
  const minutes = Math.floor((hour - hourInt) * 60);
  const timeLabel = `${hourInt.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  const dateLabel = gt('{month} {day}, {year}', { month: m(MONTHS[Math.max(0, month - 1)]), day, year });

  return (
    <div className="h-16 border-b border-border bg-card/70 backdrop-blur-md px-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="text-lg font-semibold text-foreground tracking-wide">{parkName}</div>
        <div className="text-xs text-muted-foreground uppercase tracking-widest">{dateLabel}</div>
        <div className="text-xs text-muted-foreground uppercase tracking-widest">{timeLabel}</div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-sm text-foreground">
          <MoneyIcon size={18} />
          <span className="font-semibold">${finance.money.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-foreground">
          <PopulationIcon size={18} />
          <span className="font-semibold">{guests.length}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-foreground">
          <HappyIcon size={18} />
          <span className="font-semibold">{parkRating}%</span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant={speed === 0 ? 'default' : 'ghost'}
            size="icon-sm"
            onClick={() => setSpeed(0)}
            title={gt('Pause')}
          >
            <PauseIcon size={16} />
          </Button>
          <Button
            variant={speed === 1 ? 'default' : 'ghost'}
            size="icon-sm"
            onClick={() => setSpeed(1)}
            title={gt('Normal Speed')}
          >
            <PlayIcon size={16} />
          </Button>
          <Button
            variant={speed === 2 ? 'default' : 'ghost'}
            size="icon-sm"
            onClick={() => setSpeed(2)}
            title={gt('Fast Speed')}
          >
            <FastForwardIcon size={16} />
          </Button>
          <Button
            variant={speed === 3 ? 'default' : 'ghost'}
            size="icon-sm"
            onClick={() => setSpeed(3)}
            title={gt('Ultra Speed')}
          >
            <FastForwardIcon size={16} className="translate-x-0.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
