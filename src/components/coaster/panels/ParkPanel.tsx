'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { ParkStats, WeatherState } from '@/games/coaster/types';

interface ParkPanelProps {
  parkName: string;
  stats: ParkStats;
  weather: WeatherState;
  onNameChange: (name: string) => void;
  onClose: () => void;
}

export default function ParkPanel({ parkName, stats, weather, onNameChange, onClose }: ParkPanelProps) {
  const ratingPercent = Math.round((stats.rating / 999) * 100);
  const cleanlinessPercent = Math.round((stats.cleanliness / 255) * 100);
  const sceneryPercent = Math.round((stats.scenery / 255) * 100);
  const excitementPercent = Math.min(100, Math.round(stats.excitement));
  const nauseaPercent = Math.min(100, Math.round(stats.nausea));

  return (
    <div className="absolute top-20 right-6 z-50 w-80">
      <Card className="bg-card/95 border-border/70 shadow-xl">
        <div className="flex items-start justify-between p-4 border-b border-border/60">
          <div>
            <div className="text-sm text-muted-foreground uppercase tracking-[0.2em]">Park</div>
            <div className="text-lg font-semibold">{parkName}</div>
          </div>
          <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close park panel">
            ✕
          </Button>
        </div>
        <div className="p-4 space-y-4 text-sm">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Park Name</div>
            <Input
              value={parkName}
              onChange={(event) => onNameChange(event.target.value)}
              maxLength={32}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Park Rating</span>
              <span>{stats.rating} / 999</span>
            </div>
            <Progress value={ratingPercent} className="h-2" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Cleanliness</span>
              <span>{cleanlinessPercent}%</span>
            </div>
            <Progress value={cleanlinessPercent} className="h-2" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Scenery</span>
              <span>{sceneryPercent}%</span>
            </div>
            <Progress value={sceneryPercent} className="h-2" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Excitement</span>
              <span>{excitementPercent}%</span>
            </div>
            <Progress value={excitementPercent} className="h-2" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Nausea</span>
              <span>{nauseaPercent}%</span>
            </div>
            <Progress value={nauseaPercent} className="h-2" />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Guests in Park</span>
            <span className="font-semibold">{stats.guestsInPark}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Litter</span>
            <span className="font-semibold">{stats.litter}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Total Visitors</span>
            <span className="font-semibold">{stats.totalGuests}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Weather</span>
            <span className="capitalize text-muted-foreground">
              {weather.type} · {weather.temperature}°C
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
