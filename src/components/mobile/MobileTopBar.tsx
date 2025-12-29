'use client';

import React, { useState, useCallback } from 'react';
import { msg, useMessages } from 'gt-next';
import { useGame } from '@/context/GameContext';
import { Tile } from '@/types/game';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import {
  PlayIcon,
  PauseIcon,
  PopulationIcon,
  MoneyIcon,
  HappyIcon,
  HealthIcon,
  EducationIcon,
  SafetyIcon,
  EnvironmentIcon,
  CloseIcon,
} from '@/components/ui/Icons';
import { Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LanguageSelector } from '@/components/ui/LanguageSelector';

// Translatable UI labels
const UI_LABELS = {
  pop: msg('Pop'),
  funds: msg('Funds'),
  tax: msg('Tax'),
  taxRate: msg('Tax Rate'),
  emptyLot: msg('Empty Lot'),
  jobsLower: msg('jobs'),
  jobs: msg('Jobs'),
  hasPower: msg('Has power'),
  noPower: msg('No power'),
  hasWater: msg('Has water'),
  noWater: msg('No water'),
  happiness: msg('Happiness'),
  health: msg('Health'),
  education: msg('Education'),
  safety: msg('Safety'),
  environment: msg('Environ'),
  population: msg('Population'),
  monthlyIncome: msg('Monthly Income'),
  monthlyExpenses: msg('Monthly Expenses'),
  weeklyNet: msg('Weekly Net'),
  exitToMainMenu: msg('Exit to Main Menu'),
  exitDialogTitle: msg('Exit to Main Menu'),
  exitDialogDescription: msg('Would you like to save your city before exiting?'),
  exitWithoutSaving: msg('Exit Without Saving'),
  saveAndExit: msg('Save & Exit'),
  zone: msg('Zone'),
};

// Sun/Moon icon for time of day
function TimeOfDayIcon({ hour }: { hour: number }) {
  const isNight = hour < 6 || hour >= 20;
  const isDawn = hour >= 6 && hour < 8;
  const isDusk = hour >= 18 && hour < 20;

  if (isNight) {
    return (
      <svg className="w-3 h-3 text-blue-300" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
      </svg>
    );
  } else if (isDawn || isDusk) {
    return (
      <svg className="w-3 h-3 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0z" />
      </svg>
    );
  } else {
    return (
      <svg className="w-3 h-3 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0z" />
      </svg>
    );
  }
}

function DemandBar({ label, demand, color }: { label: string; demand: number; color: string }) {
  const percentage = Math.min(100, Math.abs(demand));
  const isPositive = demand >= 0;

  return (
    <div className="flex items-center gap-1">
      <span className={`text-[9px] font-bold ${color} w-2`}>{label}</span>
      <div className="w-8 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${isPositive ? color.replace('text-', 'bg-') : 'bg-red-500'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function MobileTopBar({ 
  selectedTile, 
  services, 
  onCloseTile,
  onShare,
  onExit,
}: { 
  selectedTile: Tile | null;
  services: { police: number[][]; fire: number[][]; health: number[][]; education: number[][]; power: boolean[][]; water: boolean[][] };
  onCloseTile: () => void;
  onShare?: () => void;
  onExit?: () => void;
}) {
  const { state, setSpeed, setTaxRate, visualHour, saveCity } = useGame();
  const { stats, year, month, speed, taxRate, cityName } = state;
  const [showDetails, setShowDetails] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showTaxSlider, setShowTaxSlider] = useState(false);
  const m = useMessages();

  const handleSaveAndExit = useCallback(() => {
    saveCity();
    setShowExitDialog(false);
    onExit?.();
  }, [saveCity, onExit]);

  const handleExitWithoutSaving = useCallback(() => {
    setShowExitDialog(false);
    onExit?.();
  }, [onExit]);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <>
      {/* Main Top Bar */}
      <Card className="fixed top-0 left-0 right-0 z-40 rounded-none border-x-0 border-t-0 bg-card/95 backdrop-blur-sm safe-area-top">
        <div className="flex items-center justify-between px-3 py-1.5">
          {/* Left: City name, date, Pop/Funds stats */}
          <button
            className="flex items-center gap-3 min-w-0 active:opacity-70 p-0 m-0 mr-auto"
            onClick={() => setShowDetails(!showDetails)}
          >
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-1">
                <span className="text-foreground font-semibold text-xs truncate max-w-[80px]">
                  {cityName}
                </span>
              </div>
              <span className="text-muted-foreground text-[10px] font-mono">
                {monthNames[month - 1]} {year}
              </span>
            </div>
            <div className="flex flex-col items-start">
              <span className="text-xs font-mono font-semibold text-foreground">
                {stats.population >= 1000 ? `${(stats.population / 1000).toFixed(1)}k` : stats.population}
              </span>
              <span className="text-[9px] text-muted-foreground">{m(UI_LABELS.pop)}</span>
            </div>
            <div className="flex flex-col items-start">
              <span className={`text-xs font-mono font-semibold ${stats.money < 0 ? 'text-red-500' : stats.money < 1000 ? 'text-amber-500' : 'text-green-500'}`}>
                ${stats.money >= 1000000 ? `${(stats.money / 1000000).toFixed(1)}M` : stats.money >= 1000 ? `${(stats.money / 1000).toFixed(0)}k` : stats.money}
              </span>
              <span className="text-[9px] text-muted-foreground">{m(UI_LABELS.funds)}</span>
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

            {/* Language selector, Share, and Exit button group */}
            <div className="flex items-center -space-x-0.5">
              <LanguageSelector useDrawer iconSize={12} />

              {onShare && (
                <button
                  onClick={onShare}
                  className="h-6 w-4 p-0 m-0 flex items-center justify-center text-muted-foreground hover:text-foreground"
                  title="Invite Players"
                >
                  <Users className="w-3 h-3" />
                </button>
              )}

              {onExit && (
                <button
                  onClick={() => setShowExitDialog(true)}
                  className="h-6 w-4 p-0 m-0 flex items-center justify-center text-muted-foreground hover:text-foreground"
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

        </div>

        {/* Demand indicators row */}
        <div className="flex items-center justify-between px-3 py-1 border-t border-sidebar-border/50 bg-secondary/30">
          <div className="flex items-center gap-3">
            <DemandBar label="R" demand={stats.demand.residential} color="text-green-500" />
            <DemandBar label="C" demand={stats.demand.commercial} color="text-blue-500" />
            <DemandBar label="I" demand={stats.demand.industrial} color="text-amber-500" />
          </div>

          <button
            className="flex items-center gap-1 active:opacity-70"
            onClick={() => {
              const newShowTaxSlider = !showTaxSlider;
              setShowTaxSlider(newShowTaxSlider);
              if (newShowTaxSlider && selectedTile) {
                onCloseTile();
              }
            }}
          >
            <span className="text-[9px] text-muted-foreground">{m(UI_LABELS.tax)}</span>
            <span className="text-[10px] font-mono text-foreground">{taxRate}%</span>
          </button>

          <div className="flex items-center gap-1">
            <span className={`text-[10px] font-mono ${stats.income - stats.expenses >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stats.income - stats.expenses >= 0 ? '+' : ''}${(stats.income - stats.expenses).toLocaleString()}/mo
            </span>
          </div>
        </div>

        {/* Tax Slider Row */}
        {showTaxSlider && !selectedTile && (
          <div className="border-t border-sidebar-border/50 bg-secondary/30 px-3 py-0.5 flex items-center gap-2 text-[10px]">
            <span className="text-muted-foreground whitespace-nowrap">{m(UI_LABELS.taxRate)}</span>
            <Slider
              value={[taxRate]}
              onValueChange={(value) => setTaxRate(value[0])}
              min={0}
              max={100}
              step={1}
              className="flex-1"
            />
            <span className="font-mono text-foreground w-8 text-right shrink-0">{taxRate}%</span>
            <button 
              onClick={() => setShowTaxSlider(false)} 
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <CloseIcon size={12} />
            </button>
          </div>
        )}

        {/* Tile Info Row - Mobile Only */}
        {selectedTile && (
          <div className="border-t border-sidebar-border/50 bg-gradient-to-b from-secondary/60 to-secondary/20 px-3 py-0.5 flex items-center gap-2 text-[10px]">
            {/* Name */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className={`w-2 h-2 rounded-full ${
                selectedTile.zone === 'residential' ? 'bg-green-500' :
                selectedTile.zone === 'commercial' ? 'bg-blue-500' :
                selectedTile.zone === 'industrial' ? 'bg-amber-500' : 'bg-muted-foreground/40'
              }`} />
              <span className="text-xs font-medium text-foreground capitalize">
                {selectedTile.building.type === 'empty' 
                  ? (selectedTile.zone === 'none' ? m(UI_LABELS.emptyLot) : `${selectedTile.zone} ${m(UI_LABELS.zone)}`)
                  : selectedTile.building.type.replace(/_/g, ' ')}
              </span>
            </div>
            
            {/* Population & Jobs */}
            {selectedTile.building.population > 0 && (
              <div className="flex items-center gap-1 shrink-0">
                <PopulationIcon size={10} className="text-muted-foreground" />
                <span className="text-foreground font-mono">{selectedTile.building.population}</span>
              </div>
            )}
            {selectedTile.building.jobs > 0 && (
              <span className="text-foreground font-mono shrink-0">{selectedTile.building.jobs} {m(UI_LABELS.jobsLower)}</span>
            )}
            
            {/* Utilities */}
            <span className={`shrink-0 ${selectedTile.building.powered ? 'text-yellow-400' : 'text-muted-foreground/60'}`}>
              {selectedTile.building.powered ? m(UI_LABELS.hasPower) : m(UI_LABELS.noPower)}
            </span>
            <span className={`shrink-0 ${selectedTile.building.watered ? 'text-cyan-400' : 'text-muted-foreground/60'}`}>
              {selectedTile.building.watered ? m(UI_LABELS.hasWater) : m(UI_LABELS.noWater)}
            </span>
            
            {/* Land value */}
            <div className="flex items-center gap-1 text-muted-foreground shrink-0">
              <MoneyIcon size={10} />
              <span className="font-mono text-foreground">{selectedTile.landValue}</span>
            </div>
            
            {/* Pollution */}
            {selectedTile.pollution > 0 && (
              <div className="flex items-center gap-1 shrink-0">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  selectedTile.pollution > 50 ? 'bg-red-500' : 
                  selectedTile.pollution > 25 ? 'bg-amber-500' : 'bg-green-500'
                }`} />
                <span className={`font-mono ${
                  selectedTile.pollution > 50 ? 'text-red-400' : 
                  selectedTile.pollution > 25 ? 'text-amber-400' : 'text-green-400'
                }`}>{Math.round(selectedTile.pollution)}%</span>
              </div>
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
            {/* Stats grid */}
            <div className="p-4 grid grid-cols-5 gap-3">
              <StatItem
                icon={<HappyIcon size={16} />}
                label={String(m(UI_LABELS.happiness))}
                value={stats.happiness}
                color={stats.happiness >= 70 ? 'text-green-500' : stats.happiness >= 40 ? 'text-amber-500' : 'text-red-500'}
              />
              <StatItem
                icon={<HealthIcon size={16} />}
                label={String(m(UI_LABELS.health))}
                value={stats.health}
                color={stats.health >= 70 ? 'text-green-500' : stats.health >= 40 ? 'text-amber-500' : 'text-red-500'}
              />
              <StatItem
                icon={<EducationIcon size={16} />}
                label={String(m(UI_LABELS.education))}
                value={stats.education}
                color={stats.education >= 70 ? 'text-green-500' : stats.education >= 40 ? 'text-amber-500' : 'text-red-500'}
              />
              <StatItem
                icon={<SafetyIcon size={16} />}
                label={String(m(UI_LABELS.safety))}
                value={stats.safety}
                color={stats.safety >= 70 ? 'text-green-500' : stats.safety >= 40 ? 'text-amber-500' : 'text-red-500'}
              />
              <StatItem
                icon={<EnvironmentIcon size={16} />}
                label={String(m(UI_LABELS.environment))}
                value={stats.environment}
                color={stats.environment >= 70 ? 'text-green-500' : stats.environment >= 40 ? 'text-amber-500' : 'text-red-500'}
              />
            </div>

            <Separator />

            {/* Detailed finances */}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{m(UI_LABELS.population)}</span>
                <span className="text-sm font-mono text-foreground">{stats.population.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{m(UI_LABELS.jobs)}</span>
                <span className="text-sm font-mono text-foreground">{stats.jobs.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{m(UI_LABELS.monthlyIncome)}</span>
                <span className="text-sm font-mono text-green-400">${stats.income.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{m(UI_LABELS.monthlyExpenses)}</span>
                <span className="text-sm font-mono text-red-400">${stats.expenses.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{m(UI_LABELS.weeklyNet)}</span>
                <span className={`text-sm font-mono ${stats.income - stats.expenses >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${Math.floor((stats.income - stats.expenses) / 4).toLocaleString()}
                </span>
              </div>
            </div>

            <Separator />

            {/* Tax slider */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{m(UI_LABELS.taxRate)}</span>
                <span className="text-sm font-mono text-foreground">{taxRate}%</span>
              </div>
              <Slider
                value={[taxRate]}
                onValueChange={(value) => setTaxRate(value[0])}
                min={0}
                max={100}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                <span>0%</span>
                <span>100%</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Exit confirmation dialog */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{m(UI_LABELS.exitDialogTitle)}</DialogTitle>
            <DialogDescription>
              {m(UI_LABELS.exitDialogDescription)}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleExitWithoutSaving}
              className="w-full sm:w-auto"
            >
              {m(UI_LABELS.exitWithoutSaving)}
            </Button>
            <Button
              onClick={handleSaveAndExit}
              className="w-full sm:w-auto"
            >
              {m(UI_LABELS.saveAndExit)}
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
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-muted-foreground">{icon}</span>
      <span className={`text-sm font-mono font-semibold ${color}`}>{Math.round(value)}%</span>
      <span className="text-[9px] text-muted-foreground">{label}</span>
    </div>
  );
}

export default MobileTopBar;
