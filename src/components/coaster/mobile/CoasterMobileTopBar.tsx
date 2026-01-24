'use client';

import React, { useState, useCallback } from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { Tile, TOOL_INFO } from '@/games/coaster/types';
import { WEATHER_DISPLAY } from '@/games/coaster/types/economy';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// =============================================================================
// ICONS
// =============================================================================

function PlayIcon({ size = 12 }: { size?: number }) {
  return (
    <svg className={`w-[${size}px] h-[${size}px]`} style={{ width: size, height: size }} fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon({ size = 12 }: { size?: number }) {
  return (
    <svg className={`w-[${size}px] h-[${size}px]`} style={{ width: size, height: size }} fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function CloseIcon({ size = 12 }: { size?: number }) {
  return (
    <svg 
      className={`w-[${size}px] h-[${size}px]`} 
      style={{ width: size, height: size }} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2"
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

// =============================================================================
// UI LABELS
// =============================================================================

const UI_LABELS = {
  cash: 'Cash',
  guests: 'Guests',
  rating: 'Rating',
  ticket: 'Ticket',
  ticketPrice: 'Ticket Price',
  exitToMainMenu: 'Exit to Main Menu',
  exitDialogTitle: 'Exit to Main Menu',
  exitDialogDescription: 'Would you like to save your park before exiting?',
  exitWithoutSaving: 'Exit Without Saving',
  saveAndExit: 'Save & Exit',
};

// =============================================================================
// STAT ITEM
// =============================================================================

function StatItem({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-muted-foreground">{icon}</span>
      <span className={`text-sm font-mono font-semibold ${color}`}>{Math.round(value)}</span>
      <span className="text-[9px] text-muted-foreground">{label}</span>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface CoasterMobileTopBarProps {
  selectedTile: Tile | null;
  onCloseTile: () => void;
  onExit?: () => void;
}

export function CoasterMobileTopBar({ 
  selectedTile,
  onCloseTile,
  onExit,
}: CoasterMobileTopBarProps) {
  const { state, setSpeed, setParkSettings, saveGame } = useCoaster();
  const { settings, stats, finances, year, month, day, hour, minute, speed, weather } = state;
  const [showDetails, setShowDetails] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showTicketSlider, setShowTicketSlider] = useState(false);

  const handleSaveAndExit = useCallback(() => {
    saveGame();
    setShowExitDialog(false);
    onExit?.();
  }, [saveGame, onExit]);

  const handleExitWithoutSaving = useCallback(() => {
    setShowExitDialog(false);
    onExit?.();
  }, [onExit]);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Format time
  const displayMinute = Math.floor(minute);
  const timeString = `${hour.toString().padStart(2, '0')}:${displayMinute.toString().padStart(2, '0')}`;
  
  // Weather display
  const currentWeather = weather.current as keyof typeof WEATHER_DISPLAY;
  const weatherDisplay = WEATHER_DISPLAY[currentWeather] || WEATHER_DISPLAY.sunny;

  return (
    <>
      {/* Main Top Bar */}
      <Card className="fixed top-0 left-0 right-0 z-40 rounded-none border-x-0 border-t-0 bg-card/95 backdrop-blur-sm safe-area-top">
        <div className="flex items-center justify-between px-3 py-1.5">
          {/* Left: Park name, date, stats */}
          <button
            className="flex items-center gap-3 min-w-0 active:opacity-70 p-0 m-0 mr-auto"
            onClick={() => setShowDetails(!showDetails)}
          >
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-1">
                <span className="text-foreground font-semibold text-xs truncate max-w-[80px]">
                  {settings.name}
                </span>
                <span className="text-base" title={weatherDisplay.name}>{weatherDisplay.icon}</span>
              </div>
              <span className="text-muted-foreground text-[10px] font-mono">
                {monthNames[month - 1]} {day}, Y{year}
              </span>
            </div>
            <div className="flex flex-col items-start">
              <span className={`text-xs font-mono font-semibold ${finances.cash < 0 ? 'text-red-500' : finances.cash < 1000 ? 'text-amber-500' : 'text-green-500'}`}>
                ${finances.cash >= 1000000 ? `${(finances.cash / 1000000).toFixed(1)}M` : finances.cash >= 1000 ? `${(finances.cash / 1000).toFixed(0)}k` : finances.cash.toLocaleString()}
              </span>
              <span className="text-[9px] text-muted-foreground">{UI_LABELS.cash}</span>
            </div>
            <div className="flex flex-col items-start">
              <span className="text-xs font-mono font-semibold text-blue-400">
                {stats.guestsInPark}
              </span>
              <span className="text-[9px] text-muted-foreground">{UI_LABELS.guests}</span>
            </div>
          </button>

          {/* Speed controls and exit button */}
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-0 bg-secondary rounded-sm h-6 overflow-hidden p-0 m-0">
              <button
                onClick={() => setSpeed(0)}
                className={`h-6 w-6 min-w-6 p-0 m-0 flex items-center justify-center rounded-none ${
                  speed === 0 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent/20'
                }`}
                title="Pause"
              >
                <PauseIcon size={12} />
              </button>
              <button
                onClick={() => setSpeed(1)}
                className={`h-6 w-6 min-w-6 p-0 m-0 flex items-center justify-center rounded-none ${
                  speed === 1 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent/20'
                }`}
                title="Normal speed"
              >
                <PlayIcon size={12} />
              </button>
              <button
                onClick={() => setSpeed(2)}
                className={`h-6 w-6 min-w-6 p-0 m-0 flex items-center justify-center rounded-none ${
                  speed === 2 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent/20'
                }`}
                title="2x speed"
              >
                <div className="flex items-center -space-x-[5px]">
                  <PlayIcon size={12} />
                  <PlayIcon size={12} />
                </div>
              </button>
              <button
                onClick={() => setSpeed(3)}
                className={`h-6 w-6 min-w-6 p-0 m-0 flex items-center justify-center rounded-none ${
                  speed === 3 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent/20'
                }`}
                title="3x speed"
              >
                <div className="flex items-center -space-x-[7px]">
                  <PlayIcon size={12} />
                  <PlayIcon size={12} />
                  <PlayIcon size={12} />
                </div>
              </button>
            </div>

            {/* Exit button */}
            {onExit && (
              <button
                onClick={() => setShowExitDialog(true)}
                className="h-6 w-6 p-0 m-0 flex items-center justify-center text-muted-foreground hover:text-foreground"
                title="Exit to Main Menu"
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

        {/* Second row: Rating, Ticket Price, Time */}
        <div className="flex items-center justify-between px-3 py-1 border-t border-sidebar-border/50 bg-secondary/30">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-muted-foreground">{UI_LABELS.rating}</span>
              <span className={`text-[10px] font-mono font-semibold ${
                stats.parkRating >= 700 ? 'text-green-400' : 
                stats.parkRating >= 400 ? 'text-amber-400' : 'text-red-400'
              }`}>{stats.parkRating}</span>
            </div>
          </div>

          <button
            className="flex items-center gap-1 active:opacity-70"
            onClick={() => {
              const newShowTicketSlider = !showTicketSlider;
              setShowTicketSlider(newShowTicketSlider);
              if (newShowTicketSlider && selectedTile) {
                onCloseTile();
              }
            }}
          >
            <span className="text-[9px] text-muted-foreground">{UI_LABELS.ticket}</span>
            <span className="text-[10px] font-mono text-green-400">${settings.entranceFee}</span>
          </button>

          <div className="flex items-center gap-1">
            <span className="text-[10px] font-mono text-muted-foreground">{timeString}</span>
          </div>
        </div>

        {/* Ticket Price Slider Row */}
        {showTicketSlider && !selectedTile && (
          <div className="border-t border-sidebar-border/50 bg-secondary/30 px-3 py-0.5 flex items-center gap-2 text-[10px]">
            <span className="text-muted-foreground whitespace-nowrap">{UI_LABELS.ticketPrice}</span>
            <Slider
              value={[settings.entranceFee]}
              onValueChange={(value) => setParkSettings({ entranceFee: value[0] })}
              min={0}
              max={100}
              step={5}
              className="flex-1"
            />
            <span className="font-mono text-foreground w-8 text-right shrink-0">${settings.entranceFee}</span>
            <button 
              onClick={() => setShowTicketSlider(false)} 
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <CloseIcon size={12} />
            </button>
          </div>
        )}

        {/* Tile Info Row - Mobile Only */}
        {selectedTile && selectedTile.building.type !== 'empty' && (
          <div className="border-t border-sidebar-border/50 bg-gradient-to-b from-secondary/60 to-secondary/20 px-3 py-0.5 flex items-center gap-2 text-[10px]">
            {/* Building name */}
            <span className="text-xs font-medium text-foreground capitalize truncate">
              {TOOL_INFO[selectedTile.building.type as keyof typeof TOOL_INFO]?.name || selectedTile.building.type.replace(/_/g, ' ')}
            </span>
            
            {/* Operating status */}
            {selectedTile.building.operating !== undefined && (
              <span className={`shrink-0 ${selectedTile.building.operating ? 'text-green-400' : 'text-muted-foreground/60'}`}>
                {selectedTile.building.operating ? 'Open' : 'Closed'}
              </span>
            )}
            
            {/* Spacer to push close button right */}
            <div className="flex-1" />
            
            {/* Close button */}
            <button 
              onClick={onCloseTile} 
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <CloseIcon size={12} />
            </button>
          </div>
        )}
      </Card>

      {/* Expanded Details Panel */}
      {showDetails && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm pt-[72px]"
          onClick={() => setShowDetails(false)}
        >
          <Card
            className="mx-2 mt-2 rounded-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Weather & Time */}
            <div className="p-4 flex items-center gap-4 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-3xl">{weatherDisplay.icon}</span>
                <div>
                  <div className="text-sm font-medium" style={{ color: weatherDisplay.color }}>
                    {weatherDisplay.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {Math.round(weather.temperature)}°C
                  </div>
                </div>
              </div>
              <div className="flex-1 text-right">
                <div className="text-sm font-mono">{timeString}</div>
                <div className="text-xs text-muted-foreground">
                  {monthNames[month - 1]} {day}, Year {year}
                </div>
              </div>
            </div>
            
            {/* Stats grid */}
            <div className="p-4 grid grid-cols-4 gap-3">
              <StatItem
                icon={<span className="text-green-400">$</span>}
                label={UI_LABELS.cash}
                value={finances.cash}
                color={finances.cash < 0 ? 'text-red-500' : 'text-green-500'}
              />
              <StatItem
                icon={<span className="text-blue-400">👤</span>}
                label={UI_LABELS.guests}
                value={stats.guestsInPark}
                color="text-blue-400"
              />
              <StatItem
                icon={<span className="text-yellow-400">⭐</span>}
                label={UI_LABELS.rating}
                value={stats.parkRating}
                color={stats.parkRating >= 700 ? 'text-green-400' : stats.parkRating >= 400 ? 'text-amber-400' : 'text-red-400'}
              />
              <StatItem
                icon={<span className="text-purple-400">🎢</span>}
                label="Rides"
                value={stats.totalRides}
                color="text-purple-400"
              />
            </div>

            <Separator />

            {/* Detailed finances */}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Guests (all time)</span>
                <span className="text-sm font-mono text-foreground">{stats.guestsTotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Park Value</span>
                <span className="text-sm font-mono text-foreground">${stats.parkValue.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Monthly Profit</span>
                <span className={`text-sm font-mono ${finances.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${finances.profit.toLocaleString()}
                </span>
              </div>
            </div>

            <Separator />

            {/* Ticket price slider */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{UI_LABELS.ticketPrice}</span>
                <span className="text-sm font-mono text-foreground">${settings.entranceFee}</span>
              </div>
              <Slider
                value={[settings.entranceFee]}
                onValueChange={(value) => setParkSettings({ entranceFee: value[0] })}
                min={0}
                max={100}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                <span>$0</span>
                <span>$100</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Exit confirmation dialog */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{UI_LABELS.exitDialogTitle}</DialogTitle>
            <DialogDescription>
              {UI_LABELS.exitDialogDescription}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleExitWithoutSaving}
              className="w-full sm:w-auto"
            >
              {UI_LABELS.exitWithoutSaving}
            </Button>
            <Button
              onClick={handleSaveAndExit}
              className="w-full sm:w-auto"
            >
              {UI_LABELS.saveAndExit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CoasterMobileTopBar;
