'use client';

import React, { useState } from 'react';
import { useGame } from '@/context/GameContext';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import {
  PlayIcon,
  PauseIcon,
  HappyIcon,
  HealthIcon,
  EducationIcon,
  SafetyIcon,
  EnvironmentIcon,
  ShareIcon,
  CheckIcon,
} from '@/components/ui/Icons';
import { copyShareUrl } from '@/lib/shareState';

// ============================================================================
// TIME OF DAY ICON
// ============================================================================

interface TimeOfDayIconProps {
  hour: number;
}

export const TimeOfDayIcon = ({ hour }: TimeOfDayIconProps) => {
  const isNight = hour < 6 || hour >= 20;
  const isDawn = hour >= 6 && hour < 8;
  const isDusk = hour >= 18 && hour < 20;
  
  if (isNight) {
    return (
      <span className="material-symbols-rounded text-blue-300" style={{ fontSize: '16px' }}>
        dark_mode
      </span>
    );
  } else if (isDawn || isDusk) {
    return (
      <span className="material-symbols-rounded text-orange-400" style={{ fontSize: '16px' }}>
        wb_twilight
      </span>
    );
  } else {
    return (
      <span className="material-symbols-rounded text-yellow-400" style={{ fontSize: '16px' }}>
        light_mode
      </span>
    );
  }
};

// ============================================================================
// STAT BADGE
// ============================================================================

interface StatBadgeProps {
  value: string;
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
}

export function StatBadge({ value, label, variant = 'default' }: StatBadgeProps) {
  const colorClass = variant === 'success' ? 'text-green-500' : 
                     variant === 'warning' ? 'text-amber-500' : 
                     variant === 'destructive' ? 'text-red-500' : 'text-foreground';
  
  return (
    <div className="flex flex-col items-start min-w-[70px]">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-0.5">{label}</div>
      <div className={`text-sm font-mono tabular-nums font-semibold ${colorClass}`}>{value}</div>
    </div>
  );
}

// ============================================================================
// DEMAND INDICATOR
// ============================================================================

interface DemandIndicatorProps {
  label: string;
  demand: number;
  color: string;
}

export function DemandIndicator({ label, demand, color }: DemandIndicatorProps) {
  const height = Math.abs(demand) / 2;
  const isPositive = demand >= 0;
  
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`text-[10px] font-bold ${color}`}>{label}</span>
      <div className="w-3 h-8 bg-secondary relative rounded-sm overflow-hidden">
        <div className="absolute left-0 right-0 top-1/2 h-px bg-border" />
        <div
          className={`absolute left-0 right-0 ${color.replace('text-', 'bg-')}`}
          style={{
            height: `${height}%`,
            top: isPositive ? `${50 - height}%` : '50%',
          }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// MINI STAT (for StatsPanel)
// ============================================================================

interface MiniStatProps {
  icon: React.ReactNode;
  label: string;
  value: number;
}

export function MiniStat({ icon, label, value }: MiniStatProps) {
  const color = value >= 70 ? 'text-green-500' : value >= 40 ? 'text-amber-500' : 'text-red-500';
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono ${color}`}>{Math.round(value)}%</span>
    </div>
  );
}

// ============================================================================
// STATS PANEL
// ============================================================================

export const StatsPanel = React.memo(function StatsPanel() {
  const { state } = useGame();
  const { stats } = state;
  
  return (
    <div className="h-8 bg-secondary/50 border-b border-border flex items-center justify-center gap-8 text-xs">
      <MiniStat icon={<HappyIcon size={12} />} label="Mutluluk" value={stats.happiness} />
      <MiniStat icon={<HealthIcon size={12} />} label="Sağlık" value={stats.health} />
      <MiniStat icon={<EducationIcon size={12} />} label="Eğitim" value={stats.education} />
      <MiniStat icon={<SafetyIcon size={12} />} label="Güvenlik" value={stats.safety} />
      <MiniStat icon={<EnvironmentIcon size={12} />} label="Çevre" value={stats.environment} />
    </div>
  );
});

// ============================================================================
// TOP BAR
// ============================================================================

export const TopBar = React.memo(function TopBar() {
  const { state, setSpeed, setTaxRate, isSaving, visualHour } = useGame();
  const { stats, year, month, day, speed, taxRate, cityName } = state;
  
  const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const formattedDate = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}-${year}`;
  
  return (
    <div className="h-14 bg-card border-b border-border flex items-center justify-between px-4">
      <div className="flex items-center gap-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-foreground font-semibold text-sm">{cityName}</h1>
            {isSaving && (
              <span className="text-muted-foreground text-xs italic animate-pulse">Kaydediliyor...</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-mono tabular-nums">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>{monthNames[month - 1]} {year}</span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{formattedDate}</p>
              </TooltipContent>
            </Tooltip>
            <TimeOfDayIcon hour={visualHour} />
          </div>
        </div>
        
        <div className="flex items-center gap-0 bg-secondary rounded-md p-0">
          {[0, 1, 2, 3].map(s => (
            <Button
              key={s}
              onClick={() => setSpeed(s as 0 | 1 | 2 | 3)}
              variant={speed === s ? 'game-icon-selected' : 'game-icon'}
              className="h-9 w-9 p-0 m-0"
              title={s === 0 ? 'Duraklat' : s === 1 ? 'Normal' : s === 2 ? 'Hızlı' : 'Çok Hızlı'}
            >
              {s === 0 ? <PauseIcon size={12} /> : 
               s === 1 ? <PlayIcon size={12} /> : 
               s === 2 ? (
                 <div className="flex items-center -space-x-[5px]">
                   <PlayIcon size={12} />
                   <PlayIcon size={12} />
                 </div>
               ) :
               <div className="flex items-center -space-x-[7px]">
                 <PlayIcon size={12} />
                 <PlayIcon size={12} />
                 <PlayIcon size={12} />
               </div>}
            </Button>
          ))}
        </div>
      </div>
      
      <div className="flex items-center gap-8">
        <StatBadge value={stats.population.toLocaleString()} label="Nüfus" />
        <StatBadge value={stats.jobs.toLocaleString()} label="İşler" />
        <StatBadge 
          value={`₺${stats.money.toLocaleString()}`} 
          label="Fonlar"
          variant={stats.money < 0 ? 'destructive' : stats.money < 1000 ? 'warning' : 'success'}
        />
        <Separator orientation="vertical" className="h-8" />
        <StatBadge 
          value={`₺${(stats.income - stats.expenses).toLocaleString()}`}  
          label="Aylık"
          variant={stats.income - stats.expenses >= 0 ? 'success' : 'destructive'}
        />
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <DemandIndicator label="R" demand={stats.demand.residential} color="text-green-500" />
          <DemandIndicator label="C" demand={stats.demand.commercial} color="text-blue-500" />
          <DemandIndicator label="I" demand={stats.demand.industrial} color="text-amber-500" />
        </div>
        
        <Separator orientation="vertical" className="h-8" />
        
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Vergi</span>
          <Slider
            value={[taxRate]}
            onValueChange={(value: number[]) => setTaxRate(value[0])}
            min={0}
            max={100}
            step={1}
            className="w-16"
          />
          <span className="text-foreground text-xs font-mono tabular-nums w-8">{taxRate}%</span>
        </div>
      </div>
    </div>
  );
});
