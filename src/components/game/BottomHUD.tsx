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
import { 
  Home, 
  Briefcase, 
  Factory, 
  Shield, 
  TreeDeciduous, 
  Trophy, 
  Tent, 
  Zap, 
  Star,
  Heart,
  GraduationCap,
  Smile,
  Leaf,
  Building2,
  Anchor,
  ChevronDown,
  ChevronUp,
  Activity,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
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
  icon: Icon,
  tools,
  selectedTool,
  money,
  onSelectTool,
}: {
  label: string;
  icon: React.ElementType;
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
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-[#1a1d26]/95 backdrop-blur-md border border-slate-600 rounded-xl p-3 shadow-2xl z-[60] min-w-[320px] max-w-[400px] animate-in slide-in-from-bottom-4 fade-in duration-200">
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
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isOpen ? 'default' : 'secondary'}
            className={`w-12 h-12 rounded-full shadow-lg border-2 transition-all p-0 flex items-center justify-center ${
              hasSelectedTool || isOpen
                ? 'bg-blue-600 border-blue-400 text-white hover:bg-blue-500' 
                : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
            onClick={() => setIsOpen(!isOpen)}
          >
            <Icon size={20} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={10} className="bg-slate-900 border-slate-700 text-white">
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
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
  const { selectedTool, stats, activePanel, speed, year, month, day, cityName } = state;
  const date = useMemo(() => new Date(year, month - 1, day), [year, month, day]);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false); // Default open
  
  // Instant profit/loss tracking
  const prevMoneyRef = useRef(stats.money);
  const [moneyDiff, setMoneyDiff] = useState(0);

  // Instant population tracking
  const prevPopRef = useRef(stats.population);
  const [popDiff, setPopDiff] = useState(0);

  useEffect(() => {
    const diff = stats.money - prevMoneyRef.current;
    if (diff !== 0) {
       setMoneyDiff(diff);
       prevMoneyRef.current = stats.money;
       // Reset diff after 2 seconds
       const timer = setTimeout(() => setMoneyDiff(0), 2000);
       return () => clearTimeout(timer);
    }
  }, [stats.money]);

  useEffect(() => {
    const diff = stats.population - prevPopRef.current;
    if (diff !== 0) {
       setPopDiff(diff);
       prevPopRef.current = stats.population;
       // Reset diff after 2 seconds
       const timer = setTimeout(() => setPopDiff(0), 2000);
       return () => clearTimeout(timer);
    }
  }, [stats.population]);

  const t = useTranslations('Game');
  
  const avgRating = (stats.happiness + stats.health + stats.education + stats.safety + stats.environment) / 5;
  const grade = avgRating >= 90 ? 'A+' : avgRating >= 80 ? 'A' : avgRating >= 70 ? 'B' : avgRating >= 60 ? 'C' : avgRating >= 50 ? 'D' : 'F';
  const gradeColor = avgRating >= 70 ? 'text-green-400' : avgRating >= 50 ? 'text-amber-400' : 'text-red-400';
  
  // Close stats on outside click
  const statsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statsRef.current && !statsRef.current.contains(event.target as Node)) {
        setShowStats(false);
      }
    };
    if (showStats) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showStats]);
  
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
      icon: Shield,
      tools: ['police_station', 'fire_station', 'hospital', 'school', 'university'] as Tool[]
    },
    { 
      key: 'parks', 
      label: t('Tools.Categories.parks'), 
      icon: TreeDeciduous,
      tools: ['park', 'park_large', 'tennis', 'playground_small', 'playground_large', 'community_garden', 'pond_park', 'park_gate', 'greenhouse_garden'] as Tool[]
    },
    { 
      key: 'sports', 
      label: t('Tools.Categories.sports'), 
      icon: Trophy,
      tools: ['basketball_courts', 'soccer_field_small', 'baseball_field_small', 'football_field', 'baseball_stadium', 'swimming_pool', 'skate_park', 'bleachers_field'] as Tool[]
    },
    { 
      key: 'recreation', 
      label: t('Tools.Categories.recreation'), 
      icon: Tent,
      tools: ['mini_golf_course', 'go_kart_track', 'amphitheater', 'roller_coaster_small', 'campground', 'cabin_house', 'mountain_lodge', 'mountain_trailhead'] as Tool[]
    },
    { 
      key: 'waterfront', 
      label: 'Waterfront', 
      icon: Anchor,
      tools: ['marina_docks_small', 'pier_large'] as Tool[]
    },
    { 
      key: 'utilities', 
      label: t('Tools.Categories.utilities'), 
      icon: Zap,
      tools: ['power_plant', 'water_tower', 'subway_station', 'rail_station'] as Tool[]
    },
    { 
      key: 'special', 
      label: t('Tools.Categories.special'), 
      icon: Star,
      tools: ['stadium', 'museum', 'airport', 'space_program', 'city_hall', 'amusement_park'] as Tool[]
    },
  ], [t]);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="fixed bottom-4 left-0 right-0 flex flex-wrap lg:flex-nowrap justify-between items-end px-4 lg:px-6 z-[50] pointer-events-none select-none">
        
        {/* LEFT: Home Button & Stats Drawer */}
        <div className="pointer-events-auto relative flex items-end gap-2 max-w-full lg:max-w-none" ref={statsRef}>
             {/* Stats Drawer */}
             {showStats && (
               <div className="absolute bottom-16 left-0 w-64 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-200 z-50">
                 <div className="flex flex-col gap-3">
                   <div className="px-2 py-1 border-b border-white/10 text-[11px] font-bold tracking-[0.2em] text-emerald-400 uppercase text-center mb-1">
                     {t('Stats.title')}
                   </div>
                   
                   <div className="space-y-3">
                     {/* Happiness */}
                     <div className="space-y-1.5">
                       <div className="flex justify-between items-center text-xs font-bold text-slate-300 px-1">
                         <div className="flex items-center gap-1.5">
                           <Smile size={14} className="text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" />
                           <span>{t('Stats.happiness')}</span>
                         </div>
                         <span className="font-mono text-yellow-400">{Math.round(stats.happiness)}%</span>
                       </div>
                       <div className="h-2.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/10 shadow-inner">
                         <div 
                           className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.4)] transition-all duration-500 rounded-full" 
                           style={{ width: `${Math.min(100, Math.max(0, stats.happiness))}%` }}
                         />
                       </div>
                     </div>

                     {/* Health */}
                     <div className="space-y-1.5">
                       <div className="flex justify-between items-center text-xs font-bold text-slate-300 px-1">
                         <div className="flex items-center gap-1.5">
                           <Heart size={14} className="text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]" />
                           <span>{t('Stats.health')}</span>
                         </div>
                         <span className="font-mono text-red-400">{Math.round(stats.health)}%</span>
                       </div>
                       <div className="h-2.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/10 shadow-inner">
                         <div 
                           className="h-full bg-gradient-to-r from-red-600 to-red-400 shadow-[0_0_10px_rgba(248,113,113,0.4)] transition-all duration-500 rounded-full" 
                           style={{ width: `${Math.min(100, Math.max(0, stats.health))}%` }}
                         />
                       </div>
                     </div>

                     {/* Education */}
                     <div className="space-y-1.5">
                       <div className="flex justify-between items-center text-xs font-bold text-slate-300 px-1">
                         <div className="flex items-center gap-1.5">
                           <GraduationCap size={14} className="text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]" />
                           <span>{t('Stats.education')}</span>
                         </div>
                         <span className="font-mono text-blue-400">{Math.round(stats.education)}%</span>
                       </div>
                       <div className="h-2.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/10 shadow-inner">
                         <div 
                           className="h-full bg-gradient-to-r from-blue-600 to-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.4)] transition-all duration-500 rounded-full" 
                           style={{ width: `${Math.min(100, Math.max(0, stats.education))}%` }}
                         />
                       </div>
                     </div>

                     {/* Safety */}
                     <div className="space-y-1.5">
                       <div className="flex justify-between items-center text-xs font-bold text-slate-300 px-1">
                         <div className="flex items-center gap-1.5">
                           <Shield size={14} className="text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]" />
                           <span>{t('Stats.safety')}</span>
                         </div>
                         <span className="font-mono text-indigo-400">{Math.round(stats.safety)}%</span>
                       </div>
                       <div className="h-2.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/10 shadow-inner">
                         <div 
                           className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.4)] transition-all duration-500 rounded-full" 
                           style={{ width: `${Math.min(100, Math.max(0, stats.safety))}%` }}
                         />
                       </div>
                     </div>

                     {/* Environment */}
                     <div className="space-y-1.5">
                       <div className="flex justify-between items-center text-xs font-bold text-slate-300 px-1">
                         <div className="flex items-center gap-1.5">
                           <Leaf size={14} className="text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
                           <span>{t('Stats.environment')}</span>
                         </div>
                         <span className="font-mono text-green-400">{Math.round(stats.environment)}%</span>
                       </div>
                       <div className="h-2.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/10 shadow-inner">
                         <div 
                           className="h-full bg-gradient-to-r from-green-600 to-green-400 shadow-[0_0_10px_rgba(74,222,128,0.4)] transition-all duration-500 rounded-full" 
                           style={{ width: `${Math.min(100, Math.max(0, stats.environment))}%` }}
                         />
                       </div>
                     </div>
                   </div>
                 </div>
                 
                 {/* Triangle pointer */}
                 <div className="absolute -bottom-2 left-6 w-4 h-4 bg-[#1a1d26]/95 border-b border-r border-slate-600 rotate-45"></div>
               </div>
             )}

             <Button
                variant="secondary"
                size="icon"
                className={`w-12 h-12 rounded-full shadow-lg border-2 transition-all ${
                  showStats 
                    ? 'bg-emerald-600 border-emerald-400 text-white hover:bg-emerald-500' 
                    : 'bg-slate-900/90 border-slate-700 text-emerald-400 hover:bg-slate-800 hover:text-emerald-300'
                }`}
                onClick={() => setShowStats(!showStats)}
             >
                <Building2 size={24} />
             </Button>
        </div>

        {/* CENTER: Toolbar */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-0 flex items-end justify-center gap-3 overflow-visible pointer-events-auto pb-0">
          
          <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md p-2 rounded-2xl border border-slate-700 shadow-2xl mb-1">
            {/* Main Tools Group */}
            <div className="flex gap-2">
              {mainTools.map(tool => {
                  const Icon = ToolIcons[tool];
                  const isSelected = selectedTool === tool;
                  return (
                    <Tooltip key={tool}>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => setTool(tool)}
                          variant={isSelected ? 'default' : 'secondary'}
                          className={`w-12 h-12 rounded-full shadow-lg border-2 transition-all flex items-center justify-center ${
                             isSelected 
                               ? 'bg-blue-600 border-blue-400 text-white hover:bg-blue-500' 
                               : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          {Icon && <Icon size={24} />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={10} className="bg-slate-900 border-slate-700 text-white">
                        {t(`Tools.Items.${tool}.name`)}
                      </TooltipContent>
                    </Tooltip>
                  );
              })}
            </div>

            {/* Zones Group */}
            <div className="flex gap-2 pl-2 border-l border-white/10">
              {zoneTools.map(tool => {
                  const isSelected = selectedTool === tool;
                  // Custom colors for zones
                  let colorClass = "bg-slate-900/90 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white";
                  let Icon = null;
                  
                  if (tool === 'zone_residential') {
                      colorClass = isSelected ? "text-white bg-green-600 border-green-400 hover:bg-green-500" : "text-green-500 border-slate-700 bg-slate-900/90 hover:text-green-400 hover:bg-slate-800";
                      Icon = Home;
                  }
                  if (tool === 'zone_commercial') {
                      colorClass = isSelected ? "text-white bg-blue-600 border-blue-400 hover:bg-blue-500" : "text-blue-500 border-slate-700 bg-slate-900/90 hover:text-blue-400 hover:bg-slate-800";
                      Icon = Briefcase;
                  }
                  if (tool === 'zone_industrial') {
                      colorClass = isSelected ? "text-white bg-yellow-600 border-yellow-400 hover:bg-yellow-500" : "text-yellow-500 border-slate-700 bg-slate-900/90 hover:text-yellow-400 hover:bg-slate-800";
                      Icon = Factory;
                  }
                  if (isSelected && tool === 'zone_dezone') colorClass = "text-white bg-red-600 border-red-400 hover:bg-red-500";

                  return (
                    <Tooltip key={tool}>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => setTool(tool)}
                          variant="ghost"
                          className={`w-12 h-12 rounded-full shadow-lg border-2 transition-all duration-200 justify-center items-center p-0 ${colorClass} ${isSelected ? 'scale-110' : ''}`}
                        >
                          {Icon ? <Icon size={24} strokeWidth={2.5} /> : <span className="font-black text-lg">X</span>}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={10} className="bg-slate-900 border-slate-700 text-white">
                        {t(`Tools.Items.${tool}.name`)}
                      </TooltipContent>
                    </Tooltip>
                  );
              })}
            </div>
          </div>

          {/* Categories Popups */}
          <div className="flex gap-2 pl-2 border-l border-white/10 ml-2 bg-slate-900/90 backdrop-blur-md p-2 rounded-2xl border border-slate-700 shadow-2xl mb-1 flex-nowrap overflow-x-auto max-w-[calc(100vw-100px)] lg:max-w-none scrollbar-hide" style={{ overflow: 'visible' }}>
             {categoryGroups.map(group => (
               <PopupMenu 
                  key={group.key}
                  label={group.label} 
                  icon={group.icon}
                  tools={group.tools}
                  selectedTool={selectedTool}
                  money={stats.money}
                  onSelectTool={setTool}
               />
             ))}
          </div>

        </div>

        {/* RIGHT: Status & Systems */}
        {isCollapsed ? (
          <div className="pointer-events-auto flex flex-col justify-end items-end ml-auto lg:ml-0 mt-2 lg:mt-0">
             <Button 
                variant="secondary"
                className="w-12 h-12 rounded-full shadow-lg border-2 border-slate-700 bg-slate-900/90 text-slate-300 hover:bg-slate-800 hover:text-white flex items-center justify-center p-0"
                onClick={() => setIsCollapsed(false)}
             >
                <Activity size={24} />
             </Button>
          </div>
        ) : (
        <div className="pointer-events-auto flex flex-col w-[280px] bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-2xl p-4 shadow-2xl mb-1 ml-auto lg:ml-0 mt-2 lg:mt-0 relative group">
          
          {/* Collapse Button */}
          <button 
            onClick={() => setIsCollapsed(true)}
            className="absolute top-2 right-2 text-slate-500 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
            title="Panel'i Küçült"
          >
            <ChevronDown size={16} />
          </button>

          {/* City Name & Date */}
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/10 pr-6">
            <div className="font-bold text-white text-sm truncate max-w-[150px]" title={cityName}>
              {cityName || "My City"}
            </div>
             <div className="text-xs font-mono text-slate-400">
               {date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </div>
          </div>

          {/* Money & Pop */}
          <div className="flex-1 flex flex-col justify-center gap-2 mb-2">
            <div className="flex justify-between items-end">
               <div className={`text-4xl font-black ${gradeColor} drop-shadow-md bg-black/20 px-2 rounded`}>
                  {grade}
               </div>
               <div className="flex flex-col items-end">
                 <div className="text-emerald-400 font-mono text-3xl font-bold text-right drop-shadow-md tracking-tight">
                    ₺{formatNumber(stats.money)}
                 </div>
                 {/* Instant Profit/Loss Indicator */}
                 <div className="h-4 flex items-center justify-end">
                    {moneyDiff !== 0 && (
                      <div className={`text-xs font-mono font-bold flex items-center gap-1 animate-in fade-in slide-in-from-bottom-1 duration-300 ${moneyDiff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {moneyDiff > 0 ? <ArrowUp size={12} strokeWidth={3} /> : <ArrowDown size={12} strokeWidth={3} />}
                        <span>₺{formatNumber(Math.abs(moneyDiff))}</span>
                      </div>
                    )}
                 </div>
               </div>
            </div>
            <div className="flex justify-between items-center text-slate-400 text-[10px] uppercase font-bold tracking-wider border-t border-white/10 pt-2">
               <span>Population</span>
               <div className="flex items-center gap-2">
                 {/* Instant Population Indicator */}
                 {popDiff !== 0 && (
                    <div className={`text-[10px] font-mono font-bold flex items-center gap-0.5 animate-in fade-in slide-in-from-bottom-1 duration-300 ${popDiff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {popDiff > 0 ? <ArrowUp size={10} strokeWidth={3} /> : <ArrowDown size={10} strokeWidth={3} />}
                      <span>{formatNumber(Math.abs(popDiff))}</span>
                    </div>
                 )}
                 <span className="text-white text-base">{formatNumber(stats.population)}</span>
               </div>
            </div>
             <div className="flex justify-between items-center text-slate-500 text-[10px] font-mono">
               <span className={speed === 0 ? 'text-amber-500' : 'text-slate-400'}>{speed === 0 ? 'PAUSED' : speed === 1 ? 'NORMAL' : 'FAST'}</span>
            </div>
          </div>

          {/* Game Controls */}
          <div className="flex gap-2 justify-end items-center mt-1 border-t border-white/10 pt-2">
             
             <Tooltip>
               <TooltipTrigger asChild>
                 <Button variant={speed === 0 ? 'destructive' : 'secondary'} onClick={() => setSpeed(speed === 0 ? 1 : 0)} className="h-8 w-8 p-0 rounded-lg">
                   {speed === 0 ? <PlayIcon size={16} /> : <PauseIcon size={16} />}
                 </Button>
               </TooltipTrigger>
               <TooltipContent>Play/Pause</TooltipContent>
             </Tooltip>

             <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant={speed > 1 ? 'default' : 'secondary'} onClick={() => setSpeed(speed > 1 ? 1 : 3)} className="h-8 w-8 p-0 rounded-lg">
                    <FastForwardIcon size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Fast Forward</TooltipContent>
             </Tooltip>

             <div className="w-px h-6 bg-white/10 mx-1" />

             <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" onClick={() => setShowExitDialog(true)} className="h-8 w-8 p-0 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10">
                    <ExitIcon size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('Dialogs.Exit.Title')}</TooltipContent>
             </Tooltip>
          </div>

        </div>
        )}

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
