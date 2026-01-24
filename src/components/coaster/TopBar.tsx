'use client';

import React from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

// =============================================================================
// SPEED ICONS
// =============================================================================

function PauseIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function FastForwardIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M4 5v14l9-7-9-7zm10 0v14l9-7-9-7z" />
    </svg>
  );
}

function SuperFastIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M2 5v14l7-7-7-7zm8 0v14l7-7-7-7zm8 0v14l4-7-4-7z" />
    </svg>
  );
}

// =============================================================================
// TOPBAR COMPONENT
// =============================================================================

interface TopBarProps {
  isMultiplayer?: boolean;
  playerCount?: number;
}

export function TopBar({ isMultiplayer = false, playerCount = 0 }: TopBarProps) {
  const { state, setSpeed, setActivePanel, setParkSettings } = useCoaster();
  const { settings, stats, finances, year, month, day, hour, minute, speed } = state;
  
  // Calculate demand based on ticket price
  const ticketPrice = settings.entranceFee;
  const demandPercent = Math.max(30, Math.round(100 * Math.exp(-ticketPrice / 80)));
  
  // Format time - use Math.floor for minute since it can be fractional
  const displayMinute = Math.floor(minute);
  const timeString = `${hour.toString().padStart(2, '0')}:${displayMinute.toString().padStart(2, '0')}`;
  const dateString = `Year ${year}, Month ${month}, Day ${day}`;
  
  // Format month name
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = monthNames[(month - 1) % 12];
  
  return (
    <div className="h-14 bg-slate-900/95 border-b border-slate-700 flex items-center px-4 gap-6">
      {/* Park name and date - fixed width to prevent layout jitter */}
      <div className="flex flex-col min-w-[180px]">
        <span className="text-white font-medium text-sm truncate">{settings.name}</span>
        <span className="text-white/50 text-xs tabular-nums">{monthName} {day}, Year {year} — {timeString}</span>
      </div>
      
      {/* Separator */}
      <div className="w-px h-8 bg-slate-700" />
      
      {/* Speed controls */}
      <div className="flex items-center gap-1">
        <Button
          variant={speed === 0 ? 'default' : 'ghost'}
          size="icon"
          className="h-8 w-8"
          onClick={() => setSpeed(0)}
          title="Pause"
        >
          <PauseIcon />
        </Button>
        <Button
          variant={speed === 1 ? 'default' : 'ghost'}
          size="icon"
          className="h-8 w-8"
          onClick={() => setSpeed(1)}
          title="Normal speed"
        >
          <PlayIcon />
        </Button>
        <Button
          variant={speed === 2 ? 'default' : 'ghost'}
          size="icon"
          className="h-8 w-8"
          onClick={() => setSpeed(2)}
          title="Fast"
        >
          <FastForwardIcon />
        </Button>
        <Button
          variant={speed === 3 ? 'default' : 'ghost'}
          size="icon"
          className="h-8 w-8"
          onClick={() => setSpeed(3)}
          title="Super fast"
        >
          <SuperFastIcon />
        </Button>
      </div>
      
      {/* Separator */}
      <div className="w-px h-8 bg-slate-700" />
      
      {/* Stats */}
      <div className="flex items-center gap-6 text-sm">
        {/* Money */}
        <div className="flex flex-col items-center">
          <span className="text-green-400 font-medium">${finances.cash.toLocaleString()}</span>
          <span className="text-white/40 text-xs">Cash</span>
        </div>
        
        {/* Guests */}
        <div className="flex flex-col items-center">
          <span className="text-blue-400 font-medium">{stats.guestsInPark}</span>
          <span className="text-white/40 text-xs">Guests</span>
        </div>
        
        {/* Park Rating */}
        <div className="flex flex-col items-center">
          <span className="text-yellow-400 font-medium">{stats.parkRating}</span>
          <span className="text-white/40 text-xs">Rating</span>
        </div>
      </div>
      
      {/* Separator */}
      <div className="w-px h-8 bg-slate-700" />
      
      {/* Ticket Price Slider - compact */}
      <div className="flex items-center gap-2">
        <span className="text-white/70 text-xs">Ticket</span>
        <Slider
          value={[ticketPrice]}
          onValueChange={(value) => setParkSettings({ entranceFee: value[0] })}
          min={0}
          max={100}
          step={5}
          className="w-16"
        />
        <span className="text-green-400 font-medium text-xs min-w-[28px]">${ticketPrice}</span>
      </div>
      
      {/* Spacer */}
      <div className="flex-1" />

      {isMultiplayer && (
        <div className="px-2 py-1 text-xs text-slate-300 bg-slate-800/80 rounded-md">
          Co-op: {playerCount} player{playerCount === 1 ? '' : 's'}
        </div>
      )}
      
      {/* Panel buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant={state.activePanel === 'finances' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActivePanel(state.activePanel === 'finances' ? 'none' : 'finances')}
        >
          Finances
        </Button>
        <Button
          variant={state.activePanel === 'settings' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActivePanel(state.activePanel === 'settings' ? 'none' : 'settings')}
        >
          Settings
        </Button>
      </div>
    </div>
  );
}

export default TopBar;
