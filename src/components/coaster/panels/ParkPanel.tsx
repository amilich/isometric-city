'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ParkStats, WeatherState } from '@/games/coaster/types';
import { T, Var, Num, useGT } from 'gt-next';

interface ParkPanelProps {
  parkName: string;
  stats: ParkStats;
  weather: WeatherState;
  onClose: () => void;
}

export default function ParkPanel({ parkName, stats, weather, onClose }: ParkPanelProps) {
  const gt = useGT();
  const ratingPercent = Math.round((stats.rating / 999) * 100);
  const cleanlinessPercent = Math.round((stats.cleanliness / 255) * 100);
  const excitementPercent = Math.min(100, Math.round(stats.excitement));
  const nauseaPercent = Math.min(100, Math.round(stats.nausea));

  return (
    <div className="absolute top-20 right-6 z-50 w-80">
      <Card className="bg-card/95 border-border/70 shadow-xl">
        <div className="flex items-start justify-between p-4 border-b border-border/60">
          <div>
            <T>
              <div className="text-sm text-muted-foreground uppercase tracking-[0.2em]">Park</div>
            </T>
            <T><div className="text-lg font-semibold"><Var>{parkName}</Var></div></T>
          </div>
          <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label={gt('Close park panel')}>
            ✕
          </Button>
        </div>
        <div className="p-4 space-y-4 text-sm">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <T><span>Park Rating</span></T>
              <T><span><Num>{stats.rating}</Num> / 999</span></T>
            </div>
            <Progress value={ratingPercent} className="h-2" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <T><span>Cleanliness</span></T>
              <T><span><Num>{cleanlinessPercent}</Num>%</span></T>
            </div>
            <Progress value={cleanlinessPercent} className="h-2" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <T><span>Excitement</span></T>
              <T><span><Num>{excitementPercent}</Num>%</span></T>
            </div>
            <Progress value={excitementPercent} className="h-2" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <T><span>Nausea</span></T>
              <T><span><Num>{nauseaPercent}</Num>%</span></T>
            </div>
            <Progress value={nauseaPercent} className="h-2" />
          </div>
          <div className="flex items-center justify-between text-sm">
            <T><span>Guests in Park</span></T>
            <span className="font-semibold"><Num>{stats.guestsInPark}</Num></span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <T><span>Total Visitors</span></T>
            <span className="font-semibold"><Num>{stats.totalGuests}</Num></span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <T><span>Weather</span></T>
            <T>
              <span className="capitalize text-muted-foreground">
                <Var>{weather.type}</Var> · <Num>{weather.temperature}</Num>°C
              </span>
            </T>
          </div>
        </div>
      </Card>
    </div>
  );
}
