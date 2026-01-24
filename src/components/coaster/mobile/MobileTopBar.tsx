'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { Tile } from '@/games/coaster/types';
import { WEATHER_DISPLAY } from '@/games/coaster/types/economy';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PauseIcon, PlayIcon, CloseIcon } from '@/components/ui/Icons';

function formatMoney(value: number) {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(0)}k`;
  }
  return value.toLocaleString();
}

function formatTileLabel(tile: Tile | null) {
  if (!tile) return '';
  if (tile.building?.type && tile.building.type !== 'empty' && tile.building.type !== 'water') {
    return tile.building.type.replace(/_/g, ' ');
  }
  if (tile.queue) return 'Queue Line';
  if (tile.path) return 'Path';
  if (tile.hasCoasterTrack) return 'Coaster Track';
  if (tile.terrain === 'water') return 'Water';
  return 'Empty Tile';
}

function DemandBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-muted-foreground">Demand</span>
      <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-[9px] font-mono text-foreground">{clamped}%</span>
    </div>
  );
}

export function MobileTopBar({
  selectedTile,
  closeTileAction,
  exitAction,
}: {
  selectedTile: Tile | null;
  closeTileAction: () => void;
  exitAction?: () => void;
}) {
  const { state, setSpeed, setParkSettings, saveGame } = useCoaster();
  const { settings, stats, finances, weather, year, month, day, hour, minute, speed } = state;
  const [showExitDialog, setShowExitDialog] = useState(false);
  const weatherDisplay = WEATHER_DISPLAY[weather.current] ?? WEATHER_DISPLAY.sunny;

  const handleSaveAndExit = useCallback(() => {
    saveGame();
    setShowExitDialog(false);
    exitAction?.();
  }, [saveGame, exitAction]);

  const handleExitWithoutSaving = useCallback(() => {
    setShowExitDialog(false);
    exitAction?.();
  }, [exitAction]);

  const timeString = useMemo(() => {
    const displayMinute = Math.floor(minute);
    return `${hour.toString().padStart(2, '0')}:${displayMinute.toString().padStart(2, '0')}`;
  }, [hour, minute]);

  const dateString = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = monthNames[(month - 1) % 12];
    return `${monthName} ${day}, Year ${year}`;
  }, [day, month, year]);

  const demandPercent = Math.max(30, Math.round(100 * Math.exp(-settings.entranceFee / 80)));

  return (
    <>
      <Card className="fixed top-0 left-0 right-0 z-40 rounded-none border-x-0 border-t-0 bg-card/95 backdrop-blur-sm safe-area-top">
        <div className="flex items-center justify-between px-3 py-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex flex-col min-w-0">
              <span className="text-foreground font-semibold text-xs truncate max-w-[120px]">
                {settings.name}
              </span>
              <span className="text-muted-foreground text-[10px] font-mono">
                {dateString} - {timeString}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span>{weatherDisplay.icon}</span>
              <span style={{ color: weatherDisplay.color }}>
                {Math.round(weather.temperature)}C
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-[10px]">
              <div className="flex flex-col items-end">
                <span className={`text-xs font-mono font-semibold ${finances.cash < 0 ? 'text-red-400' : 'text-green-400'}`}>
                  ${formatMoney(finances.cash)}
                </span>
                <span className="text-[9px] text-muted-foreground">Cash</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs font-mono font-semibold text-blue-400">
                  {stats.guestsInPark}
                </span>
                <span className="text-[9px] text-muted-foreground">Guests</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs font-mono font-semibold text-yellow-400">
                  {stats.parkRating}
                </span>
                <span className="text-[9px] text-muted-foreground">Rating</span>
              </div>
            </div>

            <div className="flex items-center gap-0 bg-secondary rounded-sm h-6 overflow-hidden">
              <button
                onClick={() => setSpeed(0)}
                className={`h-6 w-6 min-w-6 p-0 flex items-center justify-center ${
                  speed === 0 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent/20'
                }`}
                title="Pause"
              >
                <PauseIcon size={12} />
              </button>
              <button
                onClick={() => setSpeed(1)}
                className={`h-6 w-6 min-w-6 p-0 flex items-center justify-center ${
                  speed === 1 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent/20'
                }`}
                title="Normal speed"
              >
                <PlayIcon size={12} />
              </button>
              <button
                onClick={() => setSpeed(2)}
                className={`h-6 w-6 min-w-6 p-0 flex items-center justify-center ${
                  speed === 2 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent/20'
                }`}
                title="Fast"
              >
                <div className="flex items-center -space-x-[5px]">
                  <PlayIcon size={12} />
                  <PlayIcon size={12} />
                </div>
              </button>
              <button
                onClick={() => setSpeed(3)}
                className={`h-6 w-6 min-w-6 p-0 flex items-center justify-center ${
                  speed === 3 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent/20'
                }`}
                title="Super fast"
              >
                <div className="flex items-center -space-x-[7px]">
                  <PlayIcon size={12} />
                  <PlayIcon size={12} />
                  <PlayIcon size={12} />
                </div>
              </button>
            </div>

            {exitAction && (
              <button
                onClick={() => setShowExitDialog(true)}
                className="h-6 w-6 p-0 flex items-center justify-center text-muted-foreground hover:text-foreground"
                title="Exit to Menu"
              >
                <svg 
                  className="w-3 h-3 -scale-x-100" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-3 py-1 border-t border-sidebar-border/50 bg-secondary/30">
          <DemandBar percent={demandPercent} />

          <div className="flex items-center gap-2">
            <span className="text-[9px] text-muted-foreground">Ticket</span>
            <Slider
              value={[settings.entranceFee]}
              onValueChange={(value) => setParkSettings({ entranceFee: value[0] })}
              min={0}
              max={100}
              step={5}
              className="w-20"
            />
            <span className="text-[10px] font-mono text-foreground">${settings.entranceFee}</span>
          </div>
        </div>

        {selectedTile && (
          <div className="border-t border-sidebar-border/50 bg-gradient-to-b from-secondary/60 to-secondary/20 px-3 py-0.5 flex items-center gap-2 text-[10px]">
            <span className="text-xs font-medium text-foreground capitalize">
              {formatTileLabel(selectedTile)}
            </span>
            {selectedTile.path && <span className="text-muted-foreground">Path</span>}
            {selectedTile.queue && <span className="text-muted-foreground">Queue</span>}
            {selectedTile.hasCoasterTrack && <span className="text-blue-400">Track</span>}
            <div className="flex-1" />
            <button
              onClick={closeTileAction}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <CloseIcon size={12} />
            </button>
          </div>
        )}
      </Card>

      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Exit to Menu</DialogTitle>
            <DialogDescription>
              Would you like to save your park before exiting?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleExitWithoutSaving}
              className="w-full sm:w-auto"
            >
              Exit Without Saving
            </Button>
            <Button onClick={handleSaveAndExit} className="w-full sm:w-auto">
              Save & Exit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default MobileTopBar;
