'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useGame } from '@/context/GameContext';
import { Tool, TOOL_INFO } from '@/types/game';
import { SPRITE_PACKS, DEFAULT_SPRITE_PACK_ID } from '@/lib/renderConfig';
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
} from '@/components/ui/Icons';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { openCommandMenu } from '@/components/ui/CommandMenu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SpritePreview = ({ tool }: { tool: string }) => {
  const pack = SPRITE_PACKS.find(p => p.id === DEFAULT_SPRITE_PACK_ID) || SPRITE_PACKS[0];
  let src = pack.src;
  let cols = pack.cols;
  let rows = pack.rows;
  let row = 0;
  let col = 0;
  let found = false;

  // Check parks first
  if (pack.parksBuildings && pack.parksBuildings[tool]) {
    src = pack.parksSrc || src;
    cols = pack.parksCols || cols;
    rows = pack.parksRows || rows;
    const pos = pack.parksBuildings[tool];
    row = pos.row;
    col = pos.col;
    found = true;
  }
  // Check farms
  else if (pack.farmsVariants && pack.farmsVariants[tool] && pack.farmsVariants[tool].length > 0) {
     src = pack.farmsSrc || src;
     cols = pack.farmsCols || cols;
     rows = pack.farmsRows || rows;
     row = pack.farmsVariants[tool][0].row;
     col = pack.farmsVariants[tool][0].col;
     found = true;
  }
   // Check shops
  else if (pack.shopsVariants && pack.shopsVariants[tool] && pack.shopsVariants[tool].length > 0) {
     src = pack.shopsSrc || src;
     cols = pack.shopsCols || cols;
     rows = pack.shopsRows || rows;
     row = pack.shopsVariants[tool][0].row;
     col = pack.shopsVariants[tool][0].col;
     found = true;
  }
   // Check stations
  else if (pack.stationsVariants && pack.stationsVariants[tool] && pack.stationsVariants[tool].length > 0) {
     src = pack.stationsSrc || src;
     cols = pack.stationsCols || cols;
     rows = pack.stationsRows || rows;
     row = pack.stationsVariants[tool][0].row;
     col = pack.stationsVariants[tool][0].col;
     found = true;
  }
  // Default sprite sheet
  else if (pack.buildingToSprite[tool]) {
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

// Hover Submenu Component for collapsible tool categories
// Implements triangle-rule safe zone for forgiving cursor navigation
const HoverSubmenu = React.memo(function HoverSubmenu({
  label,
  tools,
  selectedTool,
  money,
  onSelectTool,
  forceOpenUpward = false,
}: {
  label: string;
  tools: Tool[];
  selectedTool: Tool;
  money: number;
  onSelectTool: (tool: Tool) => void;
  forceOpenUpward?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, buttonHeight: 0, openUpward: false });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMousePos = useRef<{ x: number; y: number } | null>(null);
  const t = useTranslations('Game.Tools');
  
  const hasSelectedTool = tools.includes(selectedTool);
  const SUBMENU_GAP = 12; // Gap between sidebar and submenu
  const SUBMENU_MAX_HEIGHT = 220; // Approximate max height of submenu
  
  const clearCloseTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);
  
  const handleMouseEnter = useCallback(() => {
    clearCloseTimeout();
    // Calculate position based on button location
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      
      // Check if opening downward would overflow the screen
      const spaceBelow = viewportHeight - rect.top;
      const openUpward = forceOpenUpward || (spaceBelow < SUBMENU_MAX_HEIGHT && rect.top > SUBMENU_MAX_HEIGHT);
      
      setMenuPosition({
        top: openUpward ? rect.bottom : rect.top,
        left: rect.right + SUBMENU_GAP,
        buttonHeight: rect.height,
        openUpward,
      });
    }
    setIsOpen(true);
  }, [clearCloseTimeout, forceOpenUpward]);
  
  // Triangle rule: Check if cursor is moving toward the submenu
  const isMovingTowardSubmenu = useCallback((e: React.MouseEvent) => {
    if (!lastMousePos.current || !submenuRef.current) return false;
    
    const submenuRect = submenuRef.current.getBoundingClientRect();
    const currentX = e.clientX;
    const currentY = e.clientY;
    const lastX = lastMousePos.current.x;
    const lastY = lastMousePos.current.y;
    
    // Check if moving rightward (toward submenu)
    const movingRight = currentX > lastX;
    
    // Check if cursor is within vertical bounds of submenu (with generous padding)
    const padding = 50;
    const withinVerticalBounds = 
      currentY >= submenuRect.top - padding && 
      currentY <= submenuRect.bottom + padding;
    
    return movingRight && withinVerticalBounds;
  }, []);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, []);
  
  const handleMouseLeave = useCallback((e: React.MouseEvent) => {
    // If moving toward submenu, use a longer delay
    const delay = isMovingTowardSubmenu(e) ? 300 : 100;
    
    clearCloseTimeout();
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, delay);
  }, [clearCloseTimeout, isMovingTowardSubmenu]);
  
  const handleSubmenuEnter = useCallback(() => {
    clearCloseTimeout();
  }, [clearCloseTimeout]);
  
  const handleSubmenuLeave = useCallback(() => {
    clearCloseTimeout();
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 100);
  }, [clearCloseTimeout]);
  
  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return (
    <div 
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Category Header Button */}
      <Button
        ref={buttonRef}
        variant={hasSelectedTool ? 'game-tool-selected' : 'game-tool'}
        className={`w-full justify-between gap-2 px-3 py-2.5 h-auto text-sm group transition-all duration-200 ${
          isOpen && !hasSelectedTool ? 'bg-slate-700/80 border-slate-500 text-white' : ''
        }`}
      >
        <span className="font-medium">{label}</span>
        <div className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>
          <ChevronRightIcon size={16} />
        </div>
      </Button>
      
      {/* Invisible bridge/safe-zone between button and submenu for triangle rule */}
      {isOpen && (
        <div
          className="fixed"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left - SUBMENU_GAP}px`,
            width: `${SUBMENU_GAP + 8}px`, // Overlap slightly with submenu
            height: `${Math.max(menuPosition.buttonHeight, 200)}px`, // Tall enough to cover path
            zIndex: 9998,
          }}
          onMouseEnter={handleSubmenuEnter}
          onMouseLeave={handleSubmenuLeave}
        />
      )}
      
      {/* Flyout Submenu - uses fixed positioning to escape all parent containers */}
      {isOpen && (
        <div 
          ref={submenuRef}
          className="fixed w-52 bg-sidebar backdrop-blur-sm border border-sidebar-border rounded-md shadow-xl overflow-hidden animate-submenu-in"
          style={{ 
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(96, 165, 250, 0.1)',
            zIndex: 9999,
            ...(menuPosition.openUpward 
              ? { bottom: `${window.innerHeight - menuPosition.top}px` }
              : { top: `${menuPosition.top}px` }),
            left: `${menuPosition.left}px`,
          }}
          onMouseEnter={handleSubmenuEnter}
          onMouseLeave={handleSubmenuLeave}
        >
          <div className="px-3 py-2 border-b border-sidebar-border/50 bg-muted/30">
            <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">{label}</span>
          </div>
          <div className="p-2 grid grid-cols-4 gap-1 max-h-64 overflow-y-auto">
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
                      onClick={() => onSelectTool(tool)}
                      disabled={!canAfford && info.cost > 0}
                      variant={isSelected ? 'game-icon-selected' : 'game-icon'}
                      className="w-10 h-10 p-0 justify-center items-center"
                    >
                      {Icon ? <Icon size={20} /> : <span className="text-xs">{name.substring(0, 2)}</span>}
                    </Button>
                  </TooltipTrigger>
                  {/* Use Portal to render tooltip outside of overflow-hidden container */}
                  <TooltipContent side="right" sideOffset={10} className="z-[99999]">
                    <div className="flex flex-row gap-3 items-start p-1">
                      <SpritePreview tool={tool} />
                      <div className="flex flex-col gap-1 min-w-[140px]">
                        <span className="font-bold text-base">{name}</span>
                        <span className="text-xs text-muted-foreground leading-snug">{description}</span>
                        {info.cost > 0 && <span className="text-sm font-mono text-emerald-400 font-bold mt-1">₺{info.cost.toLocaleString()}</span>}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

// Exit confirmation dialog component
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('Title')}</DialogTitle>
          <DialogDescription>
            {t('Description')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="game-danger"
            onClick={onExitWithoutSaving}
            className="w-full sm:w-auto"
          >
            {t('ExitWithoutSaving')}
          </Button>
          <Button
            onClick={onSaveAndExit}
            variant="game-success"
            className="w-full sm:w-auto"
          >
            {t('SaveAndExit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Memoized Sidebar Component  
export const Sidebar = React.memo(function Sidebar({ onExit }: { onExit?: () => void }) {
  const { state, setTool, setActivePanel, saveCity } = useGame();
  const { selectedTool, stats, activePanel } = state;
  const [showExitDialog, setShowExitDialog] = useState(false);
  const t = useTranslations('Game');
  
  const handleSaveAndExit = useCallback(() => {
    saveCity();
    setShowExitDialog(false);
    onExit?.();
  }, [saveCity, onExit]);
  
  const handleExitWithoutSaving = useCallback(() => {
    setShowExitDialog(false);
    onExit?.();
  }, [onExit]);
  
  // Direct tool categories (shown inline)
  const directCategories = useMemo(() => ({
    'TOOLS': ['select', 'bulldoze', 'road', 'rail', 'subway'] as Tool[],
    'ZONES': ['zone_residential', 'zone_commercial', 'zone_industrial', 'zone_dezone'] as Tool[],
  }), []);
  
  // Submenu categories (hover to expand) - includes all new assets from main
  const submenuCategories = useMemo(() => [
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
      key: 'waterfront', 
      label: t('Tools.Categories.waterfront'), 
      tools: ['marina_docks_small', 'pier_large'] as Tool[]
    },
    { 
      key: 'community', 
      label: t('Tools.Categories.community'), 
      tools: ['community_center', 'animal_pens_farm', 'office_building_small'] as Tool[]
    },
    { 
      key: 'utilities', 
      label: t('Tools.Categories.utilities'), 
      tools: ['power_plant', 'water_tower', 'subway_station', 'rail_station'] as Tool[],
      forceOpenUpward: true
    },
    { 
      key: 'special', 
      label: t('Tools.Categories.special'), 
      tools: ['stadium', 'museum', 'airport', 'space_program', 'city_hall', 'amusement_park'] as Tool[],
      forceOpenUpward: true
    },
  ], [t]);
  
  return (
    <TooltipProvider delayDuration={0} skipDelayDuration={0} disableHoverableContent>
      <div className="w-56 bg-sidebar border-r border-sidebar-border flex flex-col h-full relative z-40">
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <span className="text-sidebar-foreground font-bold tracking-tight">Truncgil MyCity</span>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="game-icon"
                  onClick={openCommandMenu}
                  className="text-muted-foreground hover:text-sidebar-foreground"
                >
                  <SearchIcon size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t('Tooltips.Search')}</TooltipContent>
            </Tooltip>
            
            {onExit && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="game-icon"
                    onClick={() => setShowExitDialog(true)}
                    className="text-muted-foreground hover:text-sidebar-foreground"
                  >
                    <ExitIcon size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{t('Tooltips.BackToMenu')}</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
      
      <ScrollArea className="flex-1 py-2">
        {/* Direct categories (TOOLS, ZONES) */}
        {Object.entries(directCategories).map(([category, tools]) => (
          <div key={category} className="mb-1">
            <div className="px-4 py-2 text-[10px] font-bold tracking-widest text-muted-foreground">
              {t(`Tools.Categories.${category}`)}
            </div>
            <div className="px-4 grid grid-cols-4 gap-1">
              {tools.map(tool => {
                const info = TOOL_INFO[tool];
                if (!info) return null;
                const isSelected = selectedTool === tool;
                const canAfford = stats.money >= info.cost;
                const Icon = ToolIcons[tool];
                
                const name = t(`Tools.Items.${tool}.name`);
                const description = t(`Tools.Items.${tool}.description`);

                return (
                  <Tooltip key={tool}>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => setTool(tool)}
                        disabled={!canAfford && info.cost > 0}
                        variant={isSelected ? 'game-icon-selected' : 'game-icon'}
                        className="w-10 h-10 p-0 justify-center items-center"
                      >
                        {Icon ? <Icon size={20} /> : <span className="text-xs">{name.substring(0, 2)}</span>}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={10}>
                      <div className="flex flex-col gap-1">
                        <span className="font-bold">{name}</span>
                        <span className="text-xs text-muted-foreground">{description}</span>
                        {info.cost > 0 && <span className="text-xs font-mono text-green-400">₺{info.cost.toLocaleString()}</span>}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        ))}
        
        {/* Separator */}
        <div className="mx-4 my-2 h-px bg-sidebar-border/50" />
        
        {/* Buildings header */}
        <div className="px-4 py-2 text-[10px] font-bold tracking-widest text-muted-foreground">
          {t('Tools.Categories.BUILDINGS')}
        </div>
        
        {/* Submenu categories */}
        <div className="px-2 flex flex-col gap-0.5">
          {submenuCategories.map(({ key, label, tools, forceOpenUpward }) => (
            <HoverSubmenu
              key={key}
              label={label}
              tools={tools}
              selectedTool={selectedTool}
              money={stats.money}
              onSelectTool={setTool}
              forceOpenUpward={forceOpenUpward}
            />
          ))}
        </div>
      </ScrollArea>
      
      <div className="border-t border-sidebar-border p-2">
        <div className="grid grid-cols-4 gap-1">
          {[
            { panel: 'budget' as const, icon: <BudgetIcon size={16} />, label: t('Panels.Budget') },
            { panel: 'statistics' as const, icon: <ChartIcon size={16} />, label: t('Panels.Statistics') },
            { panel: 'advisors' as const, icon: <AdvisorIcon size={16} />, label: t('Panels.Advisors') },
            { panel: 'settings' as const, icon: <SettingsIcon size={16} />, label: t('Panels.Settings') },
          ].map(({ panel, icon, label }) => (
            <Tooltip key={panel}>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => setActivePanel(activePanel === panel ? 'none' : panel)}
                  variant={activePanel === panel ? 'game-icon-selected' : 'game-icon'}
                  className="w-full h-9 justify-center"
                >
                  {icon}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
      
      <ExitDialog
        open={showExitDialog}
        onOpenChange={setShowExitDialog}
        onSaveAndExit={handleSaveAndExit}
        onExitWithoutSaving={handleExitWithoutSaving}
      />
    </div>
    </TooltipProvider>
  );
});

export default Sidebar;
