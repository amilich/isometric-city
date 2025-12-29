'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useGame } from '@/context/GameContext';
import { Tool, TOOL_INFO } from '@/types/game';
import { useTranslations } from 'next-intl';
import {
  BudgetIcon,
  ChartIcon,
  AdvisorIcon,
  SettingsIcon,
  SearchIcon,
  ExitIcon,
  ChevronRightIcon,
  ToolIcons,
  PauseIcon,
  PlayIcon,
  FastForwardIcon
} from '@/components/ui/Icons';
import { Home, Briefcase, Factory } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { openCommandMenu } from '@/components/ui/CommandMenu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SPRITE_PACKS, DEFAULT_SPRITE_PACK_ID } from '@/lib/renderConfig';

// Reusing SpritePreview from Sidebar
const SpritePreview = ({ tool }: { tool: string }) => {
  const pack = SPRITE_PACKS.find(p => p.id === DEFAULT_SPRITE_PACK_ID) || SPRITE_PACKS[0];
  let src = pack.src;
  let cols = pack.cols;
  let rows = pack.rows;
  let row = 0;
  let col = 0;
  let found = false;

  if (pack.parksBuildings && pack.parksBuildings[tool]) {
    src = pack.parksSrc || src;
    cols = pack.parksCols || cols;
    rows = pack.parksRows || rows;
    const pos = pack.parksBuildings[tool];
    row = pos.row;
    col = pos.col;
    found = true;
  } else if (pack.farmsVariants && pack.farmsVariants[tool] && pack.farmsVariants[tool].length > 0) {
     src = pack.farmsSrc || src;
     cols = pack.farmsCols || cols;
     rows = pack.farmsRows || rows;
     row = pack.farmsVariants[tool][0].row;
     col = pack.farmsVariants[tool][0].col;
     found = true;
  } else if (pack.shopsVariants && pack.shopsVariants[tool] && pack.shopsVariants[tool].length > 0) {
     src = pack.shopsSrc || src;
     cols = pack.shopsCols || cols;
     rows = pack.shopsRows || rows;
     row = pack.shopsVariants[tool][0].row;
     col = pack.shopsVariants[tool][0].col;
     found = true;
  } else if (pack.stationsVariants && pack.stationsVariants[tool] && pack.stationsVariants[tool].length > 0) {
     src = pack.stationsSrc || src;
     cols = pack.stationsCols || cols;
     rows = pack.stationsRows || rows;
     row = pack.stationsVariants[tool][0].row;
     col = pack.stationsVariants[tool][0].col;
     found = true;
  } else if (pack.buildingToSprite[tool]) {
    const spriteKey = pack.buildingToSprite[tool];
    const index = pack.spriteOrder.indexOf(spriteKey);
    if (index !== -1) {
      if (pack.layout === 'column') {
        col = Math.floor(index / pack.rows);
        row = index % pack.rows;
      } else {
        col = index % pack.cols;
        row = Math.floor(index / pack.cols);
      }
      found = true;
    }
  }

  if (!found) return null;

  return (
    <div className="w-16 h-16 relative overflow-hidden rounded bg-blue-50/10 border border-white/10 flex-shrink-0 shadow-sm">
      <img 
        src={src} 
        alt=""
        className="max-w-none absolute"
        style={{
          width: `${cols * 100}%`,
          imageRendering: 'pixelated',
          transform: `translate(-${(col / cols) * 100}%, -${(row / rows) * 100}%)`,
          top: 0,
          left: 0
        }}
      />
    </div>
  );
};

// Popup Menu for Categories (Opening Upwards)
const PopupMenu = ({
  label,
  tools,
  selectedTool,
  money,
  onSelectTool,
}: {
  label: string;
  tools: Tool[];
  selectedTool: Tool;
  money: number;
  onSelectTool: (tool: Tool) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations('Game.Tools');
  const hasSelectedTool = tools.includes(selectedTool);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // When selected tool changes, close menu if it's not one of ours
  useEffect(() => {
    if (!tools.includes(selectedTool)) {
        setIsOpen(false);
    }
  }, [selectedTool, tools]);

  return (
    <div className="relative" ref={containerRef}>
      {isOpen && (
        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-[#1a1d26]/95 backdrop-blur-md border border-slate-600 rounded-xl p-3 shadow-2xl z-50 min-w-[320px] max-w-[400px] animate-in slide-in-from-bottom-4 fade-in duration-200">
           <div className="px-2 py-1.5 mb-3 border-b border-white/10 text-[11px] font-bold tracking-[0.2em] text-emerald-400 uppercase text-center">
            {label}
          </div>
          <div className="grid grid-cols-5 gap-2">
            {tools.map(tool => {
              const info = TOOL_INFO[tool];
              if (!info) return null;
              const isSelected = selectedTool === tool;
              const canAfford = money >= info.cost;
              const Icon = ToolIcons[tool];
              const name = t(`Items.${tool}.name`);
              const description = t(`Items.${tool}.description`);

              return (
                <Tooltip key={tool}>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => {
                        onSelectTool(tool);
                        setIsOpen(false);
                      }}
                      disabled={!canAfford && info.cost > 0}
                      variant={isSelected ? 'game-icon-selected' : 'game-icon'}
                      className="w-12 h-12 p-0 justify-center items-center hover:scale-110 transition-transform active:scale-95"
                    >
                      {Icon ? <Icon size={22} /> : <span className="text-[10px] font-bold">{name.substring(0, 2)}</span>}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={10} className="bg-slate-900 border-slate-700">
                    <div className="flex flex-row gap-3 items-start p-1 max-w-[200px]">
                      <SpritePreview tool={tool} />
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-base text-white">{name}</span>
                        <span className="text-xs text-slate-300 leading-snug">{description}</span>
                        {info.cost > 0 && <span className="text-sm font-mono text-emerald-400 font-bold mt-1">₺{info.cost.toLocaleString()}</span>}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
           {/* Triangle pointer */}
           <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#1a1d26]/95 border-b border-r border-slate-600 rotate-45"></div>
        </div>
      )}
      <Button
        variant={hasSelectedTool ? 'game-tool-selected' : 'game-tool'}
        className={`h-14 px-3 flex flex-col items-center justify-center gap-1 min-w-[70px] transition-all ${isOpen ? 'bg-slate-700 text-white ring-2 ring-emerald-500/50' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-bold text-[10px] uppercase tracking-wider">{label}</span>
        <div className={`transition-transform duration-200 ${isOpen ? '-rotate-90' : 'rotate-90'}`}>
          <ChevronRightIcon size={12} />
        </div>
      </Button>
    </div>
  );
};

function ExitDialog({ 
  open, 
  onOpenChange, 
  onSaveAndExit, 
  onExitWithoutSaving 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onSaveAndExit: () => void;
  onExitWithoutSaving: () => void;
}) {
  const t = useTranslations('Game.Dialogs.Exit');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl">{t('Title')}</DialogTitle>
          <DialogDescription className="text-slate-400">{t('Description')}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="game-danger" onClick={onExitWithoutSaving}>{t('ExitWithoutSaving')}</Button>
          <Button onClick={onSaveAndExit} variant="game-success">{t('SaveAndExit')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Format number with commas
const formatNumber = (num: number) => {
  return new Intl.NumberFormat('en-US').format(num);
};

export const BottomHUD = React.memo(function BottomHUD({ 
  onExit,
  // children prop is removed because MiniMap is moved to top right
}: { 
  onExit?: () => void;
  children?: React.ReactNode; 
}) {
  const { state, setTool, setActivePanel, saveCity, setSpeed } = useGame();
  const { selectedTool, stats, activePanel, speed, date } = state;
  const [showExitDialog, setShowExitDialog] = useState(false);
  const t = useTranslations('Game');
  
  const handleSaveAndExit = useCallback(() => {
    saveCity();
    setShowExitDialog(false);
    onExit?.();
  }, [saveCity, onExit]);

  // Main Toolbar Categories
  const mainTools = ['select', 'bulldoze', 'road', 'rail', 'subway'] as Tool[];
  const zoneTools = ['zone_residential', 'zone_commercial', 'zone_industrial', 'zone_dezone'] as Tool[];

  const categoryGroups = useMemo(() => [
    { 
      key: 'services', 
      label: t('Tools.Categories.services'), 
      tools: ['police_station', 'fire_station', 'hospital', 'school', 'university'] as Tool[]
    },
    { 
      key: 'parks', 
      label: t('Tools.Categories.parks'), 
      tools: ['park', 'park_large', 'tennis', 'playground_small', 'playground_large', 'community_garden', 'pond_park', 'park_gate', 'greenhouse_garden'] as Tool[]
    },
    { 
      key: 'sports', 
      label: t('Tools.Categories.sports'), 
      tools: ['basketball_courts', 'soccer_field_small', 'baseball_field_small', 'football_field', 'baseball_stadium', 'swimming_pool', 'skate_park', 'bleachers_field'] as Tool[]
    },
    { 
      key: 'recreation', 
      label: t('Tools.Categories.recreation'), 
      tools: ['mini_golf_course', 'go_kart_track', 'amphitheater', 'roller_coaster_small', 'campground', 'cabin_house', 'mountain_lodge', 'mountain_trailhead'] as Tool[]
    },
    { 
      key: 'utilities', 
      label: t('Tools.Categories.utilities'), 
      tools: ['power_plant', 'water_tower', 'subway_station', 'rail_station'] as Tool[]
    },
    { 
      key: 'special', 
      label: t('Tools.Categories.special'), 
      tools: ['stadium', 'museum', 'airport', 'space_program', 'city_hall', 'amusement_park'] as Tool[]
    },
  ], [t]);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="fixed bottom-0 left-0 right-0 h-[80px] bg-[#1a1d26] border-t border-slate-700 flex shadow-2xl z-[50] select-none">
        
        {/* LEFT: Spacer or Logo could go here */}
        <div className="flex items-center h-full bg-[#15171e] px-3 border-r border-white/5 relative z-10 shadow-xl min-w-[60px] justify-center">
            {/* Can add a small game logo here if desired */}
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                <Home size={14} className="text-emerald-400" />
            </div>
        </div>

        {/* CENTER: Toolbar */}
        <div className="flex-1 flex items-center justify-center px-4 gap-6 overflow-visible relative">
          
          <div className="flex items-center gap-2">
            {/* Main Tools Group */}
            <div className="flex gap-1 bg-black/20 p-1.5 rounded-xl border border-white/5 shadow-inner">
              {mainTools.map(tool => {
                  const Icon = ToolIcons[tool];
                  const isSelected = selectedTool === tool;
                  return (
                    <Tooltip key={tool}>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => setTool(tool)}
                          variant={isSelected ? 'game-icon-selected' : 'game-icon'}
                          className="w-10 h-10 rounded-lg"
                        >
                          {Icon && <Icon size={20} />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={10}>{t(`Tools.Items.${tool}.name`)}</TooltipContent>
                    </Tooltip>
                  );
              })}
            </div>

            {/* Zones Group */}
            <div className="flex gap-1 bg-black/20 p-1.5 rounded-xl border border-white/5 shadow-inner">
              {zoneTools.map(tool => {
                  const isSelected = selectedTool === tool;
                  // Custom colors for zones
                  let colorClass = "text-slate-400 hover:text-white";
                  let Icon = null;
                  
                  if (tool === 'zone_residential') {
                      colorClass = isSelected ? "text-white bg-green-600 hover:bg-green-500" : "text-green-500 hover:text-green-400 hover:bg-green-500/20";
                      Icon = Home;
                  }
                  if (tool === 'zone_commercial') {
                      colorClass = isSelected ? "text-white bg-blue-600 hover:bg-blue-500" : "text-blue-500 hover:text-blue-400 hover:bg-blue-500/20";
                      Icon = Briefcase;
                  }
                  if (tool === 'zone_industrial') {
                      colorClass = isSelected ? "text-white bg-yellow-600 hover:bg-yellow-500" : "text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/20";
                      Icon = Factory;
                  }
                  if (isSelected && tool === 'zone_dezone') colorClass = "text-white";

                  return (
                    <Tooltip key={tool}>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => setTool(tool)}
                          variant="ghost"
                          className={`w-10 h-10 rounded-lg transition-all duration-200 ${colorClass} justify-center items-center p-0 border border-transparent ${isSelected ? 'shadow-[0_0_10px_rgba(255,255,255,0.2)] scale-110' : ''}`}
                        >
                          {Icon ? <Icon size={20} strokeWidth={2.5} /> : <span className="font-black text-base">X</span>}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={10}>{t(`Tools.Items.${tool}.name`)}</TooltipContent>
                    </Tooltip>
                  );
              })}
            </div>
          </div>

          {/* Categories Popups */}
          <div className="flex gap-1.5 overflow-visible">
             {categoryGroups.map(group => (
               <PopupMenu 
                  key={group.key}
                  label={group.label} 
                  tools={group.tools}
                  selectedTool={selectedTool}
                  money={stats.money}
                  onSelectTool={setTool}
               />
             ))}
          </div>

        </div>

        {/* RIGHT: Status & Systems */}
        <div className="flex flex-col w-[280px] bg-[#15171e] border-l border-white/5 p-3 relative z-10 shadow-xl">
          
          {/* Money & Pop */}
          <div className="flex-1 flex flex-col justify-center gap-1 mb-1">
            <div className="text-emerald-400 font-mono text-2xl font-bold text-right drop-shadow-md tracking-tight">
              ₺{formatNumber(stats.money)}
            </div>
            <div className="flex justify-between items-center text-slate-400 text-[10px] uppercase font-bold tracking-wider border-t border-white/5 pt-1">
               <span>Population</span>
               <span className="text-white text-sm">{formatNumber(stats.population)}</span>
            </div>
             <div className="flex justify-between items-center text-slate-500 text-[10px] font-mono">
               <span>{date?.toLocaleDateString ? date.toLocaleDateString() : 'Loading...'}</span>
               <span className={speed === 0 ? 'text-amber-500' : 'text-slate-400'}>{speed === 0 ? 'PAUSED' : speed === 1 ? 'NORMAL' : 'FAST'}</span>
            </div>
          </div>

          {/* Game Controls */}
          <div className="flex gap-1 justify-end items-center mt-1">
             <Tooltip>
               <TooltipTrigger asChild>
                 <Button variant={activePanel === 'budget' ? 'game-icon-selected' : 'game-icon'} onClick={() => setActivePanel(activePanel === 'budget' ? 'none' : 'budget')} className="h-7 w-7 p-0 rounded-md">
                   <BudgetIcon size={14} />
                 </Button>
               </TooltipTrigger>
               <TooltipContent>{t('Panels.Budget')}</TooltipContent>
             </Tooltip>

             <Tooltip>
               <TooltipTrigger asChild>
                 <Button variant={activePanel === 'statistics' ? 'game-icon-selected' : 'game-icon'} onClick={() => setActivePanel(activePanel === 'statistics' ? 'none' : 'statistics')} className="h-7 w-7 p-0 rounded-md">
                   <ChartIcon size={14} />
                 </Button>
               </TooltipTrigger>
               <TooltipContent>{t('Panels.Statistics')}</TooltipContent>
             </Tooltip>

             <div className="w-px h-4 bg-white/10 mx-1" />

             <Tooltip>
               <TooltipTrigger asChild>
                 <Button variant={speed === 0 ? 'game-danger' : 'game-icon'} onClick={() => setSpeed(speed === 0 ? 1 : 0)} className="h-7 w-7 p-0 rounded-md">
                   {speed === 0 ? <PlayIcon size={14} /> : <PauseIcon size={14} />}
                 </Button>
               </TooltipTrigger>
               <TooltipContent>Play/Pause</TooltipContent>
             </Tooltip>

             <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant={speed > 1 ? 'game-icon-selected' : 'game-icon'} onClick={() => setSpeed(speed > 1 ? 1 : 3)} className="h-7 w-7 p-0 rounded-md">
                    <FastForwardIcon size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Fast Forward</TooltipContent>
             </Tooltip>

             <div className="w-px h-4 bg-white/10 mx-1" />

             <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" onClick={() => setShowExitDialog(true)} className="h-7 w-7 p-0 rounded-md text-red-400 hover:text-red-300 hover:bg-red-500/10">
                    <ExitIcon size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('Dialogs.Exit.Title')}</TooltipContent>
             </Tooltip>
          </div>

        </div>

        <ExitDialog
          open={showExitDialog}
          onOpenChange={setShowExitDialog}
          onSaveAndExit={handleSaveAndExit}
          onExitWithoutSaving={() => {
             setShowExitDialog(false);
             onExit?.();
          }}
        />
      </div>
    </TooltipProvider>
  );
});
