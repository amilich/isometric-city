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

function StatTile({
  label,
  value,
  colorClassName,
}: {
  label: string;
  value: string | number;
  colorClassName: string;
}) {
  return (
    <div className="min-w-[78px] rounded-md border border-white/10 bg-emerald-950/30 px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <span className={`block text-sm font-mono tabular-nums font-semibold leading-none ${colorClassName}`}>
        {value}
      </span>
      <span className="mt-1.5 block text-[9px] uppercase tracking-[0.14em] text-white/45 leading-none">
        {label}
      </span>
    </div>
  );
}

// =============================================================================
// TOPBAR COMPONENT
// =============================================================================

export function TopBar() {
  const { state, setSpeed, setActivePanel, setParkSettings } = useCoaster();
  const { settings, stats, finances, year, month, day, hour, minute, speed } = state;
  
  const ticketPrice = settings.entranceFee;
  
  // Format time - use Math.floor for minute since it can be fractional
  const displayMinute = Math.floor(minute);
  const timeString = `${hour.toString().padStart(2, '0')}:${displayMinute.toString().padStart(2, '0')}`;
  
  // Format month name
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = monthNames[(month - 1) % 12];
  
  return (
    <div className="h-16 bg-slate-950/90 border-b border-white/10 flex items-center px-4 gap-5 shadow-[0_10px_35px_rgba(0,0,0,0.22)] backdrop-blur-md">
      {/* Park name and date - fixed width to prevent layout jitter */}
      <div className="flex flex-col min-w-[180px]">
        <span className="text-white font-semibold text-sm tracking-wide truncate">{settings.name}</span>
        <span className="text-white/50 text-xs tabular-nums">{monthName} {day}, Year {year} — {timeString}</span>
      </div>
      
      {/* Separator */}
      <div className="w-px h-9 bg-white/10" />
      
      {/* Speed controls */}
      <div className="flex items-center gap-0.5 rounded-md border border-white/10 bg-emerald-950/30 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <Button
          variant={speed === 0 ? 'default' : 'ghost'}
          size="icon"
          className="h-8 w-8 rounded-sm"
          onClick={() => setSpeed(0)}
          title="Pause"
        >
          <PauseIcon />
        </Button>
        <Button
          variant={speed === 1 ? 'default' : 'ghost'}
          size="icon"
          className="h-8 w-8 rounded-sm"
          onClick={() => setSpeed(1)}
          title="Normal speed"
        >
          <PlayIcon />
        </Button>
        <Button
          variant={speed === 2 ? 'default' : 'ghost'}
          size="icon"
          className="h-8 w-8 rounded-sm"
          onClick={() => setSpeed(2)}
          title="Fast"
        >
          <FastForwardIcon />
        </Button>
        <Button
          variant={speed === 3 ? 'default' : 'ghost'}
          size="icon"
          className="h-8 w-8 rounded-sm"
          onClick={() => setSpeed(3)}
          title="Super fast"
        >
          <SuperFastIcon />
        </Button>
      </div>
      
      {/* Separator */}
      <div className="w-px h-9 bg-white/10" />
      
      {/* Stats */}
      <div className="flex items-center gap-2 text-sm">
        <StatTile label="Cash" value={`$${finances.cash.toLocaleString()}`} colorClassName="text-emerald-300" />
        <StatTile label="Guests" value={stats.guestsInPark.toLocaleString()} colorClassName="text-sky-300" />
        <StatTile label="Rating" value={stats.parkRating} colorClassName="text-amber-200" />
      </div>
      
      {/* Separator */}
      <div className="w-px h-9 bg-white/10" />
      
      {/* Ticket Price Slider - compact */}
      <div className="flex items-center gap-2 rounded-md border border-white/10 bg-emerald-950/30 px-3 py-1.5">
        <span className="text-white/70 text-xs">Ticket</span>
        <Slider
          value={[ticketPrice]}
          onValueChange={(value) => setParkSettings({ entranceFee: value[0] })}
          min={0}
          max={100}
          step={5}
          className="w-16"
        />
        <span className="text-emerald-300 font-mono tabular-nums font-semibold text-xs min-w-[34px]">${ticketPrice}</span>
      </div>
      
      {/* Spacer */}
      <div className="flex-1" />
      
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
