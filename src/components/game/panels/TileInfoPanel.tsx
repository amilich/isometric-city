'use client';

import React from 'react';
import { Tile } from '@/types/game';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CloseIcon } from '@/components/ui/Icons';
import {
  TileServicesAt,
  clamp,
  computeCrimeIndex,
  computeLandValueIndex,
  computeTrafficIndex,
} from '@/lib/tileMetrics';

interface TileInfoPanelProps {
  tile: Tile;
  grid: Tile[][];
  gridSize: number;
  services: {
    police: number[][];
    fire: number[][];
    health: number[][];
    education: number[][];
    power: boolean[][];
    water: boolean[][];
  };
  onClose: () => void;
  isMobile?: boolean;
}

export function TileInfoPanel({ 
  tile, 
  grid,
  gridSize,
  services, 
  onClose,
  isMobile = false
}: TileInfoPanelProps) {
  const { x, y } = tile;

  // Derived local metrics (used for overlays + growth logic). These are *not* directly stored
  // in the tile to avoid extra simulation churn.
  const servicesAt: TileServicesAt = {
    fire: services.fire[y][x],
    police: services.police[y][x],
    health: services.health[y][x],
    education: services.education[y][x],
    power: services.power[y][x],
    water: services.water[y][x],
  };

  const pollutionIndex = clamp(tile.pollution, 0, 100);
  const landValueIndex = computeLandValueIndex(tile, servicesAt, grid, x, y, gridSize);
  const crimeIndex = computeCrimeIndex(tile, servicesAt, grid, x, y, gridSize);
  const trafficIndex = (() => {
    if (tile.building.type === 'road') {
      return computeTrafficIndex(grid, x, y, gridSize);
    }
    // For non-road tiles, show the max nearby road traffic (if any).
    let best = 0;
    const dirs: Array<[number, number]> = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;
      if (grid[ny][nx].building.type !== 'road') continue;
      best = Math.max(best, computeTrafficIndex(grid, nx, ny, gridSize));
    }
    return best;
  })();
  
  return (
    <Card 
      className={`${isMobile ? 'fixed left-0 right-0 w-full rounded-none border-x-0 border-t border-b z-30' : 'absolute top-4 right-4 w-72'}`} 
      style={isMobile ? { top: 'calc(72px + env(safe-area-inset-top, 0px))' } : undefined}
    >
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-sans">Tile ({x}, {y})</CardTitle>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <CloseIcon size={14} />
        </Button>
      </CardHeader>
      
      <CardContent className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Building</span>
          <span className="capitalize">{tile.building.type.replace(/_/g, ' ')}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Zone</span>
          <Badge variant={
            tile.zone === 'residential' ? 'default' :
            tile.zone === 'commercial' ? 'secondary' :
            tile.zone === 'industrial' ? 'outline' : 'secondary'
          } className={
            tile.zone === 'residential' ? 'bg-green-500/20 text-green-400' :
            tile.zone === 'commercial' ? 'bg-blue-500/20 text-blue-400' :
            tile.zone === 'industrial' ? 'bg-amber-500/20 text-amber-400' : ''
          }>
            {tile.zone === 'none' ? 'Unzoned' : tile.zone}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Level</span>
          <span>{tile.building.level}/5</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Population</span>
          <span>{tile.building.population}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Jobs</span>
          <span>{tile.building.jobs}</span>
        </div>
        
        <Separator />
        
        <div className="flex justify-between">
          <span className="text-muted-foreground">Power</span>
          <Badge variant={tile.building.powered ? 'default' : 'destructive'}>
            {tile.building.powered ? 'Connected' : 'No Power'}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Water</span>
          <Badge variant={tile.building.watered ? 'default' : 'destructive'} className={tile.building.watered ? 'bg-cyan-500/20 text-cyan-400' : ''}>
            {tile.building.watered ? 'Connected' : 'No Water'}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Land Value</span>
          <span
            className={
              landValueIndex > 70
                ? 'text-green-400'
                : landValueIndex > 40
                  ? 'text-amber-400'
                  : 'text-red-400'
            }
          >
            {Math.round(landValueIndex)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Pollution</span>
          <span className={tile.pollution > 50 ? 'text-red-400' : tile.pollution > 25 ? 'text-amber-400' : 'text-green-400'}>
            {Math.round(tile.pollution)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Traffic</span>
          <span
            className={
              trafficIndex > 70
                ? 'text-red-400'
                : trafficIndex > 40
                  ? 'text-amber-400'
                  : 'text-green-400'
            }
          >
            {Math.round(trafficIndex)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Crime</span>
          <span
            className={
              crimeIndex > 70
                ? 'text-red-400'
                : crimeIndex > 40
                  ? 'text-amber-400'
                  : 'text-green-400'
            }
          >
            {Math.round(crimeIndex)}%
          </span>
        </div>
        
        {tile.building.onFire && (
          <>
            <Separator />
            <div className="flex justify-between text-red-400">
              <span>ON FIRE!</span>
              <span>{Math.round(tile.building.fireProgress)}% damage</span>
            </div>
          </>
        )}
        
        <Separator />
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Service Coverage</div>
        
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Police</span>
            <span>{Math.round(services.police[y][x])}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fire</span>
            <span>{Math.round(services.fire[y][x])}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Health</span>
            <span>{Math.round(services.health[y][x])}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Education</span>
            <span>{Math.round(services.education[y][x])}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
