'use client';

import React, { useState, useCallback } from 'react';
import { T, useGT, msg, useMessages } from 'gt-next';
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

const monthNames = [
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

// =============================================================================
// ICONS
// =============================================================================

function PlayIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function CloseIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function GuestsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function MoneyIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function StarIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

// =============================================================================
// MOBILE TOP BAR COMPONENT
// =============================================================================

interface MobileCoasterTopBarProps {
  selectedTile: Tile | null;
  onCloseTile: () => void;
  onExit?: () => void;
}

export function MobileCoasterTopBar({
  selectedTile,
  onCloseTile,
  onExit,
}: MobileCoasterTopBarProps) {
  const { state, setSpeed, setParkSettings, saveGame } = useCoaster();
  const { settings, stats, finances, year, month, day, hour, minute, speed, weather, selectedTool } = state;
  const [showDetails, setShowDetails] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showTicketSlider, setShowTicketSlider] = useState(false);
  const gt = useGT();
  const m = useMessages();

  const handleSaveAndExit = useCallback(() => {
    saveGame();
    setShowExitDialog(false);
    onExit?.();
  }, [saveGame, onExit]);

  const handleExitWithoutSaving = useCallback(() => {
    setShowExitDialog(false);
    onExit?.();
  }, [onExit]);
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
          {/* Left: Park name, date, weather */}
          <button
            className="flex items-center gap-3 min-w-0 active:opacity-70 p-0 m-0 mr-auto"
            onClick={() => setShowDetails(!showDetails)}
          >
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-1">
                <span className="text-foreground font-semibold text-xs truncate max-w-[80px]">
                  {settings.name}
                </span>
                <span className="text-sm">{weatherDisplay.icon}</span>
              </div>
              <span className="text-muted-foreground text-[10px] font-mono">
                {gt('{month} {day}, Yr {year}', { month: m(monthNames[month - 1]), day, year })}
              </span>
            </div>
            <div className="flex flex-col items-start">
              <span className="text-xs font-mono font-semibold text-blue-400">
                {stats.guestsInPark}
              </span>
              <T><span className="text-[9px] text-muted-foreground">Guests</span></T>
            </div>
            <div className="flex flex-col items-start">
              <span className={`text-xs font-mono font-semibold ${finances.cash < 0 ? 'text-red-500' : finances.cash < 1000 ? 'text-amber-500' : 'text-green-500'}`}>
                ${finances.cash >= 1000000 ? `${(finances.cash / 1000000).toFixed(1)}M` : finances.cash >= 1000 ? `${(finances.cash / 1000).toFixed(0)}k` : finances.cash}
              </span>
              <T><span className="text-[9px] text-muted-foreground">Cash</span></T>
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
                title={gt('Pause')}
              >
                <PauseIcon size={12} />
              </button>
              <button
                onClick={() => setSpeed(1)}
                className={`h-6 w-6 min-w-6 p-0 m-0 flex items-center justify-center rounded-none ${
                  speed === 1 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent/20'
                }`}
                title={gt('Normal speed')}
              >
                <PlayIcon size={12} />
              </button>
              <button
                onClick={() => setSpeed(2)}
                className={`h-6 w-6 min-w-6 p-0 m-0 flex items-center justify-center rounded-none ${
                  speed === 2 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent/20'
                }`}
                title={gt('2x speed')}
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
                title={gt('3x speed')}
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
                title={gt('Exit to Main Menu')}
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

        {/* Stats row */}
        <div className="flex items-center justify-between px-3 py-1 border-t border-sidebar-border/50 bg-secondary/30">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <StarIcon size={10} />
              <span className="text-[10px] font-mono text-yellow-400">{stats.parkRating}</span>
            </div>
            <span className="text-[9px] text-muted-foreground">
              {gt('{temperature}°C', { temperature: Math.round(weather.temperature) })}
            </span>
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
            <T><span className="text-[9px] text-muted-foreground">Ticket</span></T>
            <span className="text-[10px] font-mono text-foreground">${settings.entranceFee}</span>
          </button>

          <div className="flex items-center gap-1">
            <span className={`text-[10px] font-mono ${finances.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {finances.profit >= 0 ? '+' : ''}${finances.profit.toLocaleString()}{gt('/mo')}
            </span>
          </div>
        </div>

        {/* Ticket Price Slider Row */}
        {showTicketSlider && !selectedTile && (
          <div className="border-t border-sidebar-border/50 bg-secondary/30 px-3 py-0.5 flex items-center gap-2 text-[10px]">
            <T><span className="text-muted-foreground whitespace-nowrap">Ticket Price</span></T>
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

        {/* Selected Tool Info Row */}
        {selectedTool && TOOL_INFO[selectedTool] && selectedTool !== 'select' && (
          <div className="flex items-center justify-between px-4 py-1 border-t border-sidebar-border/50 bg-secondary/30 text-xs">
            <span className="text-foreground font-medium">
              {TOOL_INFO[selectedTool].name}
            </span>
            {TOOL_INFO[selectedTool].cost > 0 && (
              <span className={`font-mono ${finances.cash >= TOOL_INFO[selectedTool].cost ? 'text-green-400' : 'text-red-400'}`}>
                ${TOOL_INFO[selectedTool].cost}
              </span>
            )}
          </div>
        )}

        {/* Tile Info Row */}
        {selectedTile && selectedTool === 'select' && (
          <div className="border-t border-sidebar-border/50 bg-gradient-to-b from-secondary/60 to-secondary/20 px-3 py-0.5 flex items-center gap-2 text-[10px]">
            {/* Building info */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className={`w-2 h-2 rounded-full ${
                selectedTile.terrain === 'water' ? 'bg-blue-500' :
                selectedTile.path ? 'bg-amber-500' :
                selectedTile.building.type !== 'empty' ? 'bg-green-500' : 'bg-muted-foreground/40'
              }`} />
              <span className="text-xs font-medium text-foreground capitalize">
                {selectedTile.building.type === 'empty'
                  ? (selectedTile.path ? gt('Path') : selectedTile.terrain)
                  : selectedTile.building.type.replace(/_/g, ' ')}
              </span>
            </div>

            {/* Building stats */}
            {selectedTile.building.type !== 'empty' && selectedTile.building.operating && (
              <T><span className="text-green-400 shrink-0">Operating</span></T>
            )}
            {selectedTile.building.type !== 'empty' && selectedTile.building.broken && (
              <T><span className="text-red-400 shrink-0">Broken</span></T>
            )}

            {/* Spacer */}
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
            {/* Stats grid */}
            <div className="p-4 grid grid-cols-4 gap-3">
              <StatItem
                icon={<GuestsIcon size={16} />}
                label={gt('Guests')}
                value={stats.guestsInPark}
                color="text-blue-400"
                isNumber
              />
              <StatItem
                icon={<StarIcon size={16} />}
                label={gt('Rating')}
                value={stats.parkRating}
                color={stats.parkRating >= 700 ? 'text-green-500' : stats.parkRating >= 400 ? 'text-amber-500' : 'text-red-500'}
                isNumber
              />
              <StatItem
                icon={<MoneyIcon size={16} />}
                label={gt('Park Value')}
                value={`$${(stats.parkValue / 1000).toFixed(0)}k`}
                color="text-emerald-400"
              />
              <StatItem
                icon={<span className="text-lg">{weatherDisplay.icon}</span>}
                label={gt('Weather')}
                value={`${Math.round(weather.temperature)}°C`}
                color={weatherDisplay.color}
              />
            </div>

            <Separator />

            {/* Detailed finances */}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <T><span className="text-sm text-muted-foreground">Total Guests</span></T>
                <span className="text-sm font-mono text-foreground">{stats.guestsTotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <T><span className="text-sm text-muted-foreground">Avg. Happiness</span></T>
                <span className="text-sm font-mono text-foreground">{Math.round(stats.averageHappiness)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <T><span className="text-sm text-muted-foreground">Monthly Income</span></T>
                <span className="text-sm font-mono text-green-400">${finances.incomeTotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <T><span className="text-sm text-muted-foreground">Monthly Expenses</span></T>
                <span className="text-sm font-mono text-red-400">${finances.expenseTotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <T><span className="text-sm text-muted-foreground">Monthly Profit</span></T>
                <span className={`text-sm font-mono ${finances.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${finances.profit.toLocaleString()}
                </span>
              </div>
            </div>

            <Separator />

            {/* Ticket price slider */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <T><span className="text-sm text-muted-foreground">Ticket Price</span></T>
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
              <T>
                <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                  <span>$0</span>
                  <span>$100</span>
                </div>
              </T>
            </div>
          </Card>
        </div>
      )}

      {/* Exit confirmation dialog */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <T><DialogTitle>Exit to Main Menu</DialogTitle></T>
            <T>
              <DialogDescription>
                Would you like to save your park before exiting?
              </DialogDescription>
            </T>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleExitWithoutSaving}
              className="w-full sm:w-auto"
            >
              <T>Exit Without Saving</T>
            </Button>
            <Button
              onClick={handleSaveAndExit}
              className="w-full sm:w-auto"
            >
              <T>Save & Exit</T>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatItem({
  icon,
  label,
  value,
  color,
  isNumber = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  isNumber?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-muted-foreground">{icon}</span>
      <span className={`text-sm font-mono font-semibold ${color}`}>
        {isNumber ? value.toLocaleString() : value}
      </span>
      <span className="text-[9px] text-muted-foreground">{label}</span>
    </div>
  );
}

export default MobileCoasterTopBar;
