'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { ParkStats, WeatherState } from '@/games/coaster/types';
import { T, Var, Num, useGT } from 'gt-next';

interface ParkPanelProps {
  parkName: string;
  stats: ParkStats;
  weather: WeatherState;
  onNameChange: (name: string) => void;
  onClose: () => void;
}

export default function ParkPanel({ parkName, stats, weather, onNameChange, onClose }: ParkPanelProps) {
  const gt = useGT();
  const ratingPercent = Math.round((stats.rating / 999) * 100);
  const cleanlinessPercent = Math.round((stats.cleanliness / 255) * 100);
  const excitementPercent = Math.min(100, Math.round(stats.excitement));
  const nauseaPercent = Math.min(100, Math.round(stats.nausea));

  return (
    <div className="absolute top-20 right-6 z-50 w-80">
      <Card className="bg-card/95 border-border/70 shadow-xl">
        <div className="flex items-start justify-between p-4 border-b border-border/60">
          <T>
            <div>
              <div className="text-sm text-muted-foreground uppercase tracking-[0.2em]">Park</div>
              <div className="text-lg font-semibold"><Var>{parkName}</Var></div>
            </div>
          </T>
          <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label={gt('Close park panel')}>
            ✕
          </Button>
        </div>
        <div className="p-4 space-y-4 text-sm">
          <div className="space-y-2">
            <T><div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Park Name</div></T>
            <Input
              value={parkName}
              onChange={(event) => onNameChange(event.target.value)}
              maxLength={32}
            />
          </div>
          <div className="space-y-2">
            <T>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Park Rating</span>
                <span><Num>{stats.rating}</Num> / 999</span>
              </div>
            </T>
            <Progress value={ratingPercent} className="h-2" />
          </div>
          <div className="space-y-2">
            <T>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Cleanliness</span>
                <span><Num>{cleanlinessPercent}</Num>%</span>
              </div>
            </T>
            <Progress value={cleanlinessPercent} className="h-2" />
          </div>
          <div className="space-y-2">
            <T>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Excitement</span>
                <span><Num>{excitementPercent}</Num>%</span>
              </div>
            </T>
            <Progress value={excitementPercent} className="h-2" />
          </div>
          <div className="space-y-2">
            <T>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Nausea</span>
                <span><Num>{nauseaPercent}</Num>%</span>
              </div>
            </T>
            <Progress value={nauseaPercent} className="h-2" />
          </div>
          <T>
            <div className="flex items-center justify-between text-sm">
              <span>Guests in Park</span>
              <span className="font-semibold"><Num>{stats.guestsInPark}</Num></span>
            </div>
          </T>
          <T>
            <div className="flex items-center justify-between text-sm">
              <span>Total Visitors</span>
              <span className="font-semibold"><Num>{stats.totalGuests}</Num></span>
            </div>
          </T>
          <T>
            <div className="flex items-center justify-between text-sm">
              <span>Weather</span>
              <span className="capitalize text-muted-foreground">
                <Var>{weather.type}</Var> · <Num>{weather.temperature}</Num>°C
              </span>
            </div>
          </T>
        </div>
      </Card>
    </div>
  );
}
