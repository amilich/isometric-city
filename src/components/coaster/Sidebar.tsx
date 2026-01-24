'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { Tool, TOOL_INFO } from '@/games/coaster/types';
import { WEATHER_DISPLAY, WEATHER_EFFECTS } from '@/games/coaster/types/economy';
import { COASTER_TYPE_STATS, getCoasterCategory } from '@/games/coaster/types/tracks';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { openCoasterCommandMenu } from '@/components/coaster/CommandMenu';
import {
  COASTER_TYPE_PRIMARY_COLORS,
  COASTER_TYPE_TOOL_MAP,
  COASTER_TRACK_TOOLS,
  DIRECT_TOOLS,
  SUBMENU_CATEGORIES,
} from '@/components/coaster/tooling';
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
} from '@/components/ui/tooltip';

// =============================================================================
// WEATHER DISPLAY COMPONENT
// =============================================================================

const WeatherDisplay = React.memo(function WeatherDisplay({ 
  weather 
}: { 
  weather: { current: string; temperature: number; forecast: string[] } 
}) {
  const current = weather.current as keyof typeof WEATHER_DISPLAY;
  const display = WEATHER_DISPLAY[current] || WEATHER_DISPLAY.sunny;
  const effects = WEATHER_EFFECTS[current] || WEATHER_EFFECTS.sunny;
  
  // Build effect description
  const effectDescriptions: string[] = [];
  if (effects.guestSpawnMultiplier < 0.8) effectDescriptions.push('Fewer guests arriving');
  if (effects.guestSpawnMultiplier > 1.2) effectDescriptions.push('More guests arriving');
  if (effects.leaveChanceMultiplier > 1.5) effectDescriptions.push('Guests leaving early');
  if (effects.outdoorRidePopularity < 0.5) effectDescriptions.push('Outdoor rides less popular');
  if (effects.waterRidePopularity > 1.3) effectDescriptions.push('Water rides popular');
  if (effects.indoorRidePopularity > 1.3) effectDescriptions.push('Indoor rides popular');
  if (effects.drinkSalesMultiplier > 1.3) effectDescriptions.push('Drink sales boosted');
  if (effects.foodSalesMultiplier > 1.2) effectDescriptions.push('Food sales boosted');
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-md cursor-help">
            <span className="text-2xl">{display.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium" style={{ color: display.color }}>
                {display.name}
              </div>
              <div className="text-xs text-muted-foreground">
                {Math.round(weather.temperature)}°C
              </div>
            </div>
            {/* Forecast dots */}
            <div className="flex gap-0.5">
              {weather.forecast.slice(0, 3).map((fc, i) => {
                const fcDisplay = WEATHER_DISPLAY[fc as keyof typeof WEATHER_DISPLAY] || WEATHER_DISPLAY.sunny;
                return (
                  <span key={i} className="text-xs opacity-60" title={fcDisplay.name}>
                    {fcDisplay.icon}
                  </span>
                );
              })}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <div className="text-sm font-medium mb-1">{display.name} - {Math.round(weather.temperature)}°C</div>
          {effectDescriptions.length > 0 ? (
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {effectDescriptions.map((desc, i) => (
                <li key={i}>• {desc}</li>
              ))}
            </ul>
          ) : (
            <div className="text-xs text-muted-foreground">Normal park conditions</div>
          )}
          <div className="text-xs text-muted-foreground mt-1 pt-1 border-t border-border">
            Forecast: {weather.forecast.slice(0, 3).map(fc => 
              WEATHER_DISPLAY[fc as keyof typeof WEATHER_DISPLAY]?.name || 'Unknown'
            ).join(' → ')}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

// =============================================================================
// HOVER SUBMENU COMPONENT
// =============================================================================

// Hover Submenu Component for collapsible tool categories
// Implements triangle-rule safe zone for forgiving cursor navigation
const ITEMS_PER_PAGE = 5; // Show 5 items initially, then 5 more each time

const HoverSubmenu = React.memo(function HoverSubmenu({
  label,
  tools,
  selectedTool,
  cash,
  onSelectTool,
  forceOpenUpward = false,
}: {
  label: string;
  tools: Tool[];
  selectedTool: Tool;
  cash: number;
  onSelectTool: (tool: Tool) => void;
  forceOpenUpward?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, buttonHeight: 0, openUpward: false });
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMousePos = useRef<{ x: number; y: number } | null>(null);
  
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
  
  // Reset visible count when menu closes
  useEffect(() => {
    if (!isOpen) {
      setVisibleCount(ITEMS_PER_PAGE);
    }
  }, [isOpen]);
  
  const visibleTools = tools.slice(0, visibleCount);
  const hasMore = visibleCount < tools.length;
  const remainingCount = tools.length - visibleCount;
  
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
        variant={hasSelectedTool ? 'default' : 'ghost'}
        className={`w-full justify-between gap-2 px-3 py-2.5 h-auto text-sm group transition-all duration-200 ${
          hasSelectedTool ? 'bg-primary text-primary-foreground' : ''
        } ${isOpen ? 'bg-muted/80' : ''}`}
      >
        <span className="font-medium">{label}</span>
        <svg 
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
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
          className="fixed w-52 bg-sidebar backdrop-blur-sm border border-sidebar-border rounded-md shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
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
          <div className="p-1.5 flex flex-col gap-0.5 max-h-64 overflow-y-auto">
            {visibleTools.map(tool => {
              const info = TOOL_INFO[tool];
              if (!info) return null;
              const isSelected = selectedTool === tool;
              const canAfford = cash >= info.cost;
              
              return (
                <Button
                  key={tool}
                  onClick={() => onSelectTool(tool)}
                  disabled={!canAfford && info.cost > 0}
                  variant={isSelected ? 'default' : 'ghost'}
                  className={`w-full justify-start gap-2 px-3 py-2 h-auto text-sm transition-all duration-150 ${
                    isSelected ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted/60'
                  }`}
                  title={`${info.description} - Cost: $${info.cost.toLocaleString()}`}
                >
                  <span className="flex-1 text-left truncate">{info.name}</span>
                  <span className={`text-xs ${isSelected ? 'opacity-80' : 'opacity-50'}`}>${info.cost.toLocaleString()}</span>
                </Button>
              );
            })}
            {hasMore && (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  setVisibleCount(prev => prev + ITEMS_PER_PAGE);
                }}
                variant="ghost"
                className="w-full justify-center gap-1 px-3 py-1.5 h-auto text-xs text-muted-foreground hover:text-foreground border-t border-sidebar-border/30 mt-1 rounded-none"
              >
                <span>Show {Math.min(remainingCount, ITEMS_PER_PAGE)} more</span>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

// =============================================================================
// EXIT DIALOG
// =============================================================================

function ExitDialog({
  open,
  onOpenChange,
  onSaveAndExit,
  onExitWithoutSaving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveAndExit: () => void;
  onExitWithoutSaving: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            onClick={onExitWithoutSaving}
            className="w-full sm:w-auto"
          >
            Exit Without Saving
          </Button>
          <Button onClick={onSaveAndExit} className="w-full sm:w-auto">
            Save & Exit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// SIDEBAR COMPONENT
// =============================================================================

interface SidebarProps {
  onExit?: () => void;
}

export function Sidebar({ onExit }: SidebarProps) {
  const { state, setTool, saveGame, startCoasterBuild, cancelCoasterBuild } = useCoaster();
  const { selectedTool, finances, weather, buildingCoasterType } = state;
  const [showExitDialog, setShowExitDialog] = useState(false);
  
  const handleSaveAndExit = useCallback(() => {
    saveGame();
    setShowExitDialog(false);
    onExit?.();
  }, [saveGame, onExit]);
  
  const handleExitWithoutSaving = useCallback(() => {
    setShowExitDialog(false);
    onExit?.();
  }, [onExit]);
  
  const handleSelectTool = useCallback((tool: Tool) => {
    // Check if this is a coaster type selection tool
    const coasterType = COASTER_TYPE_TOOL_MAP[tool];
    if (coasterType) {
      // Start building a coaster of this type
      startCoasterBuild(coasterType);
      // Switch to coaster build mode
      setTool('coaster_build');
    } else {
      setTool(tool);
    }
  }, [setTool, startCoasterBuild]);
  
  return (
    <div className="w-56 bg-sidebar border-r border-sidebar-border flex flex-col h-screen fixed left-0 top-0 z-40">
      {/* Header */}
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <span className="text-sidebar-foreground font-bold tracking-tight">
            ISOCOASTER
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={openCoasterCommandMenu}
              title="Search (⌘K)"
              className="h-7 w-7 text-muted-foreground hover:text-sidebar-foreground"
            >
              <svg 
                className="w-4 h-4" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </Button>
            {onExit && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowExitDialog(true)}
                title="Exit to Menu"
                className="h-7 w-7 text-muted-foreground hover:text-sidebar-foreground"
              >
                <svg
                  className="w-4 h-4 -scale-x-100"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {/* Weather Display */}
      <div className="px-2 py-2 border-b border-sidebar-border">
        <WeatherDisplay weather={weather} />
      </div>
      
      {/* Active Coaster Type with Track Tools */}
      {buildingCoasterType && (
        <div className="px-2 py-2 border-b border-sidebar-border bg-primary/10">
          {/* Coaster type header */}
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md mb-2">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: COASTER_TYPE_PRIMARY_COLORS[buildingCoasterType] ?? '#dc2626' }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-primary truncate">
                {COASTER_TYPE_STATS[buildingCoasterType]?.name ?? 'Custom Coaster'}
              </div>
              <div className="text-[10px] text-muted-foreground capitalize">
                {getCoasterCategory(buildingCoasterType)} coaster
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                cancelCoasterBuild();
                setTool('select');
              }}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              title="Cancel coaster build"
            >
              ✕
            </Button>
          </div>
          
          {/* Track tools - shown inline when building a coaster */}
          <div className="flex flex-col gap-0.5">
            {COASTER_TRACK_TOOLS.map(tool => {
              const info = TOOL_INFO[tool];
              if (!info) return null;
              const isSelected = selectedTool === tool;
              const canAfford = finances.cash >= info.cost;
              
              return (
                <Button
                  key={tool}
                  onClick={() => setTool(tool)}
                  disabled={!canAfford && info.cost > 0}
                  variant={isSelected ? 'default' : 'ghost'}
                  className={`w-full justify-start gap-2 px-3 py-1.5 h-auto text-xs ${
                    isSelected ? 'bg-primary text-primary-foreground' : ''
                  }`}
                  title={info.description}
                >
                  <span className="flex-1 text-left">{info.name}</span>
                  {info.cost > 0 && (
                    <span className={`text-[10px] ${isSelected ? 'opacity-80' : 'opacity-50'}`}>
                      ${info.cost}
                    </span>
                  )}
                </Button>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Tool Categories */}
      <ScrollArea className="flex-1 py-2">
        {/* Section: TOOLS (direct buttons) */}
        <div className="px-3 py-1.5">
          <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Tools</span>
        </div>
        <div className="px-2 flex flex-col gap-0.5 mb-2">
          {DIRECT_TOOLS.map(tool => {
            const info = TOOL_INFO[tool];
            if (!info) return null;
            const isSelected = selectedTool === tool;
            
            return (
              <Button
                key={tool}
                onClick={() => handleSelectTool(tool)}
                variant={isSelected ? 'default' : 'ghost'}
                className={`w-full justify-start gap-2 px-3 py-2 h-auto text-sm ${
                  isSelected ? 'bg-primary text-primary-foreground' : ''
                }`}
                title={info.description}
              >
                <span className="flex-1 text-left">{info.name}</span>
                {info.cost > 0 && (
                  <span className={`text-xs ${isSelected ? 'opacity-80' : 'opacity-50'}`}>
                    ${info.cost}
                  </span>
                )}
              </Button>
            );
          })}
        </div>
        
        {/* Section: BUILDINGS (hover submenus) */}
        <div className="px-3 py-1.5 mt-2">
          <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Buildings</span>
        </div>
        <div className="px-2 flex flex-col gap-0.5">
          {SUBMENU_CATEGORIES.map((category, index) => (
            <HoverSubmenu
              key={category.key}
              label={category.label}
              tools={category.tools}
              selectedTool={selectedTool}
              cash={finances.cash}
              onSelectTool={handleSelectTool}
              forceOpenUpward={index >= SUBMENU_CATEGORIES.length - 2}
            />
          ))}
        </div>
      </ScrollArea>
      
      {/* Exit dialog */}
      <ExitDialog
        open={showExitDialog}
        onOpenChange={setShowExitDialog}
        onSaveAndExit={handleSaveAndExit}
        onExitWithoutSaving={handleExitWithoutSaving}
      />
    </div>
  );
}

export default Sidebar;
