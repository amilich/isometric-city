'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useGame } from '@/context/GameContext';
import { Tool, TOOL_INFO } from '@/types/game';
import {
  BudgetIcon,
  ChartIcon,
  AdvisorIcon,
  SettingsIcon,
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
import { ShortcutTooltip } from '@/components/ui/ShortcutTooltip';
import { KEYBOARD_SHORTCUTS } from './shortcuts';
import { TOOL_CATEGORIES } from './categories';

function getToolShortcut(tool: Tool | string): string | undefined {
  if (tool === 'bulldoze') return KEYBOARD_SHORTCUTS.BULLDOZE.label;
  if (tool === 'select') return KEYBOARD_SHORTCUTS.SELECT.label;
  if (tool === 'road') return KEYBOARD_SHORTCUTS.ROAD.label;
  if (tool === 'rail') return KEYBOARD_SHORTCUTS.RAIL.label;
  if (tool === 'subway') return KEYBOARD_SHORTCUTS.SUBWAY.label;
  if (tool === 'zone_residential') return KEYBOARD_SHORTCUTS.RESIDENTIAL.label;
  if (tool === 'zone_commercial') return KEYBOARD_SHORTCUTS.COMMERCIAL.label;
  if (tool === 'zone_industrial') return KEYBOARD_SHORTCUTS.INDUSTRIAL.label;
  if (tool === 'zone_dezone') return KEYBOARD_SHORTCUTS.DEZONE.label;
  
  for (const cat of TOOL_CATEGORIES) {
    if (cat.shortcut && cat.tools.includes(tool as Tool)) {
      return cat.shortcut.toUpperCase();
    }
  }
  
  return undefined;
}

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
          <div className="p-1.5 flex flex-col gap-0.5 max-h-48 overflow-y-auto">
            {tools.map(tool => {
              const info = TOOL_INFO[tool];
              if (!info) return null;
              const isSelected = selectedTool === tool;
              const canAfford = money >= info.cost;
              const shortcut = getToolShortcut(tool);
              
              const tooltipContent = `${info.description}${info.cost > 0 ? ` - Cost: $${info.cost}` : ''}`;
              
              return (
                <ShortcutTooltip key={tool} content={tooltipContent} shortcut={shortcut}>
                  <Button
                    onClick={() => onSelectTool(tool)}
                    disabled={!canAfford && info.cost > 0}
                    variant={isSelected ? 'default' : 'ghost'}
                    className={`w-full justify-start gap-2 px-3 py-2 h-auto text-sm transition-all duration-150 ${
                      isSelected ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted/60'
                    }`}
                  >
                    <span className="flex-1 text-left truncate">
                      {info.name}
                      {shortcut && <span className="ml-1.5 text-[10px] opacity-60 font-mono">({shortcut})</span>}
                    </span>
                    {info.cost > 0 && (
                      <span className={`text-xs ${isSelected ? 'opacity-80' : 'opacity-50'}`}>${info.cost.toLocaleString()}</span>
                    )}
                  </Button>
                </ShortcutTooltip>
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exit to Main Menu</DialogTitle>
          <DialogDescription>
            Would you like to save your city before exiting?
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
          <Button
            onClick={onSaveAndExit}
            className="w-full sm:w-auto"
          >
            Save & Exit
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
  const submenuCategories = useMemo(() => TOOL_CATEGORIES, []);
  
  return (
    <div className="w-56 bg-sidebar border-r border-sidebar-border flex flex-col h-full relative z-40">
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <span className="text-sidebar-foreground font-bold tracking-tight">ISOCITY</span>
          <div className="flex items-center gap-1">
            <ShortcutTooltip content="Search" shortcut={KEYBOARD_SHORTCUTS.SEARCH.label}>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={openCommandMenu}
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
            </ShortcutTooltip>
            {onExit && (
              <ShortcutTooltip content="Exit to Main Menu">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowExitDialog(true)}
                  className="h-7 w-7 text-muted-foreground hover:text-sidebar-foreground"
                >
                  <svg 
                    className="w-4 h-4 -scale-x-100" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </Button>
              </ShortcutTooltip>
            )}
          </div>
        </div>
      </div>
      
      <ScrollArea className="flex-1 py-2">
        {/* Direct categories (TOOLS, ZONES) */}
        {Object.entries(directCategories).map(([category, tools]) => (
          <div key={category} className="mb-1">
            <div className="px-4 py-2 text-[10px] font-bold tracking-widest text-muted-foreground">
              {category}
            </div>
            <div className="px-2 flex flex-col gap-0.5">
              {tools.map(tool => {
                const info = TOOL_INFO[tool];
                if (!info) return null;
                const isSelected = selectedTool === tool;
                const canAfford = stats.money >= info.cost;
                const shortcut = getToolShortcut(tool);
                
                const tooltipContent = `${info.description}${info.cost > 0 ? ` - Cost: $${info.cost}` : ''}`;
                
                return (
                  <ShortcutTooltip key={tool} content={tooltipContent} shortcut={shortcut}>
                    <Button
                      onClick={() => setTool(tool)}
                      disabled={!canAfford && info.cost > 0}
                      variant={isSelected ? 'default' : 'ghost'}
                      className={`w-full justify-start gap-3 px-3 py-2 h-auto text-sm ${
                        isSelected ? 'bg-primary text-primary-foreground' : ''
                      }`}
                    >
                      <span className="flex-1 text-left truncate">{info.name}</span>
                      {info.cost > 0 && (
                        <span className="text-xs opacity-60">${info.cost}</span>
                      )}
                    </Button>
                  </ShortcutTooltip>
                );
              })}
            </div>
          </div>
        ))}
        
        {/* Separator */}
        <div className="mx-4 my-2 h-px bg-sidebar-border/50" />
        
        {/* Buildings header */}
        <div className="px-4 py-2 text-[10px] font-bold tracking-widest text-muted-foreground">
          BUILDINGS
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
            { panel: 'budget' as const, icon: <BudgetIcon size={16} />, label: 'Budget' },
            { panel: 'statistics' as const, icon: <ChartIcon size={16} />, label: 'Statistics' },
            { panel: 'advisors' as const, icon: <AdvisorIcon size={16} />, label: 'Advisors' },
            { panel: 'settings' as const, icon: <SettingsIcon size={16} />, label: 'Settings' },
          ].map(({ panel, icon, label }) => (
            <ShortcutTooltip key={panel} content={label}>
              <Button
                onClick={() => setActivePanel(activePanel === panel ? 'none' : panel)}
                variant={activePanel === panel ? 'default' : 'ghost'}
                size="icon-sm"
                className="w-full"
              >
                {icon}
              </Button>
            </ShortcutTooltip>
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
  );
});

export default Sidebar;
