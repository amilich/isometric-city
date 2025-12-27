'use client';

import React from 'react';
import { Tile } from '@/types/game';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CloseIcon } from '@/components/ui/Icons';

interface TileInfoPanelProps {
  tile: Tile;
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
  services, 
  onClose,
  isMobile = false
}: TileInfoPanelProps) {
  const { x, y } = tile;
  
  if (isMobile) {
    return (
      <div 
        className="fixed left-0 right-0 w-full bg-card/95 backdrop-blur-sm border-t border-b border-border z-30"
        style={{ top: 'calc(72px + env(safe-area-inset-top, 0px))' }}
      >
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-medium">Tile ({x}, {y})</span>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <CloseIcon size={14} />
          </Button>
        </div>
      </div>
    );
  }
  
  // Desktop: Docked right panel
  return (
    <div 
      className="absolute top-0 right-0 bottom-0 w-64 bg-card/95 backdrop-blur-sm border-l border-border shadow-2xl z-20
                 animate-in slide-in-from-right-full duration-200"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-sm font-semibold tracking-tight">Tile ({x}, {y})</span>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} className="hover:bg-destructive/20">
          <CloseIcon size={14} />
        </Button>
      </div>
      
      {/* Content */}
      <div className="p-4 space-y-3 text-sm overflow-y-auto" style={{ maxHeight: 'calc(100% - 52px)' }}>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Building</span>
          <span className="capitalize">{tile.building.type.replace(/_/g, ' ')}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Area</span>
          <Badge variant={
            tile.zone === 'residential' ? 'default' :
            tile.zone === 'commercial' ? 'secondary' :
            tile.zone === 'industrial' ? 'outline' : 'secondary'
          } className={
            tile.zone === 'residential' ? 'bg-green-500/20 text-green-400' :
            tile.zone === 'commercial' ? 'bg-blue-500/20 text-blue-400' :
            tile.zone === 'industrial' ? 'bg-amber-500/20 text-amber-400' : ''
          }>
            {tile.zone === 'none' ? 'Without region' : tile.zone}
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
          <span className="text-muted-foreground">Works</span>
          <span>{tile.building.jobs}</span>
        </div>
        
        <Separator />
        
        <div className="flex justify-between">
          <span className="text-muted-foreground">Electricity</span>
          <Badge variant={tile.building.powered ? 'default' : 'destructive'}>
            {tile.building.powered ? 'Connected' : 'No electricity.'}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Are</span>
          <Badge variant={tile.building.watered ? 'default' : 'destructive'} className={tile.building.watered ? 'bg-cyan-500/20 text-cyan-400' : ''}>
            {tile.building.watered ? 'Connected' : 'No water.'}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Land Value</span>
          <span>${tile.landValue}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Pollution</span>
          <span className={tile.pollution > 50 ? 'text-red-400' : tile.pollution > 25 ? 'text-amber-400' : 'text-green-400'}>
            {Math.round(tile.pollution)}%
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
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Scope of Service</div>
        
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Policy</span>
            <span>{Math.round(services.police[y][x])}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fire-fighting</span>
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
      </div>
    </div>
  );
}
