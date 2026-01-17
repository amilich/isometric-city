'use client';

import React from 'react';
import { T, useGT, msg, useMessages } from 'gt-next';
import { useCoaster } from '@/context/CoasterContext';
import { Button } from '@/components/ui/button';

interface CoasterTopBarProps {
  isMobile?: boolean;
  onExit?: () => void;
}

const MONTHS = [
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

export function CoasterTopBar({ isMobile, onExit }: CoasterTopBarProps) {
  const gt = useGT();
  const m = useMessages();
  const { state, setSpeed, isSaving } = useCoaster();
  const { park, finances, guests, year, month, day, hour, minute, speed } = state;

  const formatTime = (h: number, mm: number) => {
    const hh = h.toString().padStart(2, '0');
    const mmStr = mm.toString().padStart(2, '0');
    return `${hh}:${mmStr}`;
  };

  const formatDate = () => {
    return gt('{month} {day}, Year {year}', { month: m(MONTHS[month - 1]), day, year });
  };

  const formatCash = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(2)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`;
    }
    return `$${amount.toLocaleString()}`;
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 700) return 'text-green-400';
    if (rating >= 400) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (isMobile) {
    return (
      <div className="fixed top-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-sm border-b border-white/10 px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-white font-medium truncate max-w-[120px]">{park.name}</span>
            <span className="text-white/60 text-sm">{formatCash(finances.cash)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${getRatingColor(park.parkRating)}`}>
              ⭐ {park.parkRating}
            </span>
            <span className="text-white/60 text-sm">👥 {guests.length}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-12 bg-slate-900/90 backdrop-blur-sm border-b border-white/10 flex items-center justify-between px-4">
      {/* Left section - Park info */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-white font-bold">{park.name}</span>
          {isSaving && (
            <span className="text-xs text-white/40 animate-pulse"><T>Saving...</T></span>
          )}
        </div>
        
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-white/50">💰</span>
            <span className={`font-mono font-medium ${finances.cash < 0 ? 'text-red-400' : 'text-green-400'}`}>
              {formatCash(finances.cash)}
            </span>
          </div>
          
          {finances.loan > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-white/50">📉</span>
              <span className="font-mono text-orange-400">
                -{formatCash(finances.loan)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Center section - Stats */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-1.5" title={gt('Park Rating')}>
          <span className="text-white/50">⭐</span>
          <span className={`font-medium ${getRatingColor(park.parkRating)}`}>
            {park.parkRating}
          </span>
        </div>

        <div className="flex items-center gap-1.5" title={gt('Guests')}>
          <span className="text-white/50">👥</span>
          <span className="text-white font-medium">
            {guests.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5" title={gt('Staff')}>
          <span className="text-white/50">👷</span>
          <span className="text-white font-medium">
            {state.staff.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5" title={gt('Rides')}>
          <span className="text-white/50">🎢</span>
          <span className="text-white font-medium">
            {state.rides.filter(r => r.status === 'open').length}/{state.rides.length}
          </span>
        </div>
      </div>

      {/* Right section - Date/Time and Speed */}
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-white/80 text-sm font-medium">
            {formatTime(hour, minute)}
          </div>
          <div className="text-white/50 text-xs">
            {formatDate()}
          </div>
        </div>
        
        {/* Speed controls */}
        <div className="flex items-center gap-1 bg-white/5 rounded-md p-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSpeed(0)}
            className={`h-7 w-7 ${speed === 0 ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'}`}
            title={gt('Pause')}
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSpeed(1)}
            className={`h-7 w-7 ${speed === 1 ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'}`}
            title={gt('Normal Speed')}
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSpeed(2)}
            className={`h-7 w-7 ${speed === 2 ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'}`}
            title={gt('Fast')}
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4 5v14l9-7z" />
              <path d="M13 5v14l9-7z" />
            </svg>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSpeed(3)}
            className={`h-7 w-7 ${speed === 3 ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'}`}
            title={gt('Very Fast')}
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2 5v14l6-7z" />
              <path d="M9 5v14l6-7z" />
              <path d="M16 5v14l6-7z" />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  );
}
