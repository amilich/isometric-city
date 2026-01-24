'use client';

import React, { useCallback, useState } from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { MobileBar } from '@/components/mobile/MobileBar';
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
import { Button } from '@/components/ui/button';
import { WEATHER_DISPLAY } from '@/games/coaster/types/economy';

function PauseIcon() {
  return (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function FastForwardIcon() {
  return (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
      <path d="M4 5v14l9-7-9-7zm10 0v14l9-7-9-7z" />
    </svg>
  );
}

function SuperFastIcon() {
  return (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
      <path d="M2 5v14l7-7-7-7zm8 0v14l7-7-7-7zm8 0v14l4-7-4-7z" />
    </svg>
  );
}

function formatMoneyShort(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return `${value}`;
}

export function CoasterMobileTopBar({ exitAction }: { exitAction?: () => void }) {
  const { state, setSpeed, setParkSettings, saveGame } = useCoaster();
  const { settings, stats, finances, year, month, day, hour, minute, speed, weather } = state;
  const [showDetails, setShowDetails] = useState(false);
  const [showTicketSlider, setShowTicketSlider] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);

  const displayMinute = Math.floor(minute);
  const timeString = `${hour.toString().padStart(2, '0')}:${displayMinute
    .toString()
    .padStart(2, '0')}`;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = monthNames[(month - 1) % 12];
  const weatherDisplay = WEATHER_DISPLAY[weather.current] ?? WEATHER_DISPLAY.sunny;
  const ticketPrice = settings.entranceFee;

  const handleSaveAndExit = useCallback(() => {
    saveGame();
    setShowExitDialog(false);
    exitAction?.();
  }, [saveGame, exitAction]);

  const handleExitWithoutSaving = useCallback(() => {
    setShowExitDialog(false);
    exitAction?.();
  }, [exitAction]);

  return (
    <>
      <MobileBar position="top">
        <div className="flex items-center justify-between px-3 py-1.5">
          <button
            className="flex items-center gap-3 min-w-0 active:opacity-70 p-0 m-0 mr-auto"
            onClick={() => setShowDetails(!showDetails)}
          >
            <div className="flex flex-col items-start">
              <span className="text-foreground font-semibold text-xs truncate max-w-[88px]">
                {settings.name}
              </span>
              <span className="text-muted-foreground text-[10px] font-mono">
                {monthName} {day}, Y{year} {timeString}
              </span>
            </div>
            <div className="flex flex-col items-start">
              <span className={`text-xs font-mono font-semibold ${finances.cash < 0 ? 'text-red-500' : 'text-green-400'}`}>
                ${formatMoneyShort(finances.cash)}
              </span>
              <span className="text-[9px] text-muted-foreground">Cash</span>
            </div>
            <div className="flex flex-col items-start">
              <span className="text-xs font-mono font-semibold text-foreground">
                {stats.guestsInPark}
              </span>
              <span className="text-[9px] text-muted-foreground">Guests</span>
            </div>
          </button>

          <div className="flex items-center gap-1">
            <div className="flex items-center gap-0 bg-secondary rounded-sm h-6 overflow-hidden p-0 m-0">
              <button
                onClick={() => setSpeed(0)}
                className={`h-6 w-6 min-w-6 p-0 m-0 flex items-center justify-center rounded-none ${
                  speed === 0 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent/20'
                }`}
                title="Pause"
              >
                <PauseIcon />
              </button>
              <button
                onClick={() => setSpeed(1)}
                className={`h-6 w-6 min-w-6 p-0 m-0 flex items-center justify-center rounded-none ${
                  speed === 1 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent/20'
                }`}
                title="Normal speed"
              >
                <PlayIcon />
              </button>
              <button
                onClick={() => setSpeed(2)}
                className={`h-6 w-6 min-w-6 p-0 m-0 flex items-center justify-center rounded-none ${
                  speed === 2 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent/20'
                }`}
                title="Fast"
              >
                <FastForwardIcon />
              </button>
              <button
                onClick={() => setSpeed(3)}
                className={`h-6 w-6 min-w-6 p-0 m-0 flex items-center justify-center rounded-none ${
                  speed === 3 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent/20'
                }`}
                title="Super fast"
              >
                <SuperFastIcon />
              </button>
            </div>

            {exitAction && (
              <button
                onClick={() => setShowExitDialog(true)}
                className="h-6 w-6 p-0 m-0 flex items-center justify-center text-muted-foreground hover:text-foreground"
                title="Exit to Main Menu"
              >
                <svg className="w-3 h-3 -scale-x-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-3 py-1 border-t border-sidebar-border/50 bg-secondary/30">
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ color: weatherDisplay.color }}>{weatherDisplay.icon}</span>
            <span className="text-[10px] text-muted-foreground">{weatherDisplay.name}</span>
            <span className="text-[10px] text-muted-foreground">{Math.round(weather.temperature)} C</span>
          </div>

          <button
            className="flex items-center gap-1 active:opacity-70"
            onClick={() => setShowTicketSlider(!showTicketSlider)}
            disabled={settings.payPerRide}
          >
            <span className="text-[9px] text-muted-foreground">Ticket</span>
            <span className={`text-[10px] font-mono ${settings.payPerRide ? 'text-muted-foreground' : 'text-foreground'}`}>
              {settings.payPerRide ? 'Per ride' : `$${ticketPrice}`}
            </span>
          </button>

          <div className="flex items-center gap-1">
            <span className="text-[9px] text-muted-foreground">Rating</span>
            <span className="text-[10px] font-mono text-foreground">{stats.parkRating}</span>
          </div>
        </div>

        {showTicketSlider && !settings.payPerRide && (
          <div className="border-t border-sidebar-border/50 bg-secondary/30 px-3 py-0.5 flex items-center gap-2 text-[10px]">
            <span className="text-muted-foreground whitespace-nowrap">Ticket</span>
            <Slider
              value={[ticketPrice]}
              onValueChange={(value) => setParkSettings({ entranceFee: value[0] })}
              min={0}
              max={100}
              step={5}
              className="flex-1"
            />
            <span className="font-mono text-foreground w-10 text-right shrink-0">${ticketPrice}</span>
            <button
              onClick={() => setShowTicketSlider(false)}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              x
            </button>
          </div>
        )}
      </MobileBar>

      {showDetails && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm pt-[72px]"
          onClick={() => setShowDetails(false)}
        >
          <Card className="mx-2 mt-2 rounded-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 grid grid-cols-4 gap-3">
              <StatItem label="Rating" value={`${stats.parkRating}`} color="text-yellow-400" />
              <StatItem label="Happy" value={`${Math.round(stats.averageHappiness)}%`} color="text-emerald-400" />
              <StatItem label="Guests" value={`${stats.guestsInPark}`} color="text-blue-400" />
              <StatItem label="Value" value={`$${formatMoneyShort(stats.parkValue)}`} color="text-purple-400" />
            </div>

            <Separator />

            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Cash</span>
                <span className="text-sm font-mono text-foreground">${finances.cash.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Monthly Income</span>
                <span className="text-sm font-mono text-green-400">${finances.incomeTotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Monthly Expenses</span>
                <span className="text-sm font-mono text-red-400">${finances.expenseTotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Monthly Profit</span>
                <span className={`text-sm font-mono ${finances.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${finances.profit.toLocaleString()}
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}

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
            <Button
              onClick={handleSaveAndExit}
              className="w-full sm:w-auto"
            >
              Save & Exit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`text-sm font-mono font-semibold ${color}`}>{value}</span>
      <span className="text-[9px] text-muted-foreground">{label}</span>
    </div>
  );
}

export default CoasterMobileTopBar;
