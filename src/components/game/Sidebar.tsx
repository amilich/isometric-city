'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { msg, useMessages } from 'gt-next';
import { useGame } from '@/context/GameContext';
import { Tool, TOOL_INFO } from '@/types/game';

// Translatable category labels
const CATEGORY_LABELS: Record<string, unknown> = {
  TOOLS: msg('Tools'),
  ZONES: msg('Zones'),
  tools: msg('Tools'),
  zones: msg('Zones'),
  zoning: msg('Zoning'),
  expandCity: msg('Expand City'),
  services: msg('Services'),
  parks: msg('Parks'),
  sports: msg('Sports'),
  waterfront: msg('Waterfront'),
  community: msg('Community'),
  utilities: msg('Utilities'),
  special: msg('Special'),
};

// UI labels for translation
const UI_LABELS = {
  budget: msg('Budget'),
  statistics: msg('Statistics'),
  advisors: msg('Advisors'),
  settings: msg('Settings'),
};
import {
  BudgetIcon,
  ChartIcon,
  AdvisorIcon,
  SettingsIcon,
} from '@/components/ui/Icons';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { openCommandMenu } from '@/components/ui/CommandMenu';
import { Users, X } from 'lucide-react';
import { ShareModal } from '@/components/multiplayer/ShareModal';
import { CustomBuildingPanel } from '@/components/game/panels/CustomBuildingPanel';
import { useCustomBuildings, CustomBuilding } from '@/context/CustomBuildingsContext';
import { useMultiplayerOptional } from '@/context/MultiplayerContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import '@/components/game/panels/fal-branding.css';

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
  label: unknown; // Message object from msg() for translation
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
  const m = useMessages();
  
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
        <span className="font-medium">{m(label as Parameters<typeof m>[0])}</span>
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
            <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">{m(label as Parameters<typeof m>[0])}</span>
          </div>
          <div className="p-1.5 flex flex-col gap-0.5 max-h-48 overflow-y-auto">
            {tools.map(tool => {
              const info = TOOL_INFO[tool];
              if (!info) return null;
              const isSelected = selectedTool === tool;
              const canAfford = money >= info.cost;
              
              return (
                <Button
                  key={tool}
                  onClick={() => onSelectTool(tool)}
                  disabled={!canAfford && info.cost > 0}
                  variant={isSelected ? 'default' : 'ghost'}
                  className={`w-full justify-start gap-2 px-3 py-2 h-auto text-sm transition-all duration-150 ${
                    isSelected ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted/60'
                  }`}
                  title={`${m(info.description)} - Cost: $${info.cost.toLocaleString()}`}
                >
                  <span className="flex-1 text-left truncate">{m(info.name)}</span>
                  <span className={`text-xs ${isSelected ? 'opacity-80' : 'opacity-50'}`}>${info.cost.toLocaleString()}</span>
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

// Action Submenu Component for executing actions (like expand/shrink city)
const ActionSubmenu = React.memo(function ActionSubmenu({
  label,
  actions,
}: {
  label: unknown;
  actions: { key: string; name: unknown; description: string; onClick: () => void }[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, buttonHeight: 0, openUpward: false });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMousePos = useRef<{ x: number; y: number } | null>(null);
  const m = useMessages();
  
  const SUBMENU_GAP = 12;
  const SUBMENU_MAX_HEIGHT = 220;
  
  const clearCloseTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);
  
  const handleMouseEnter = useCallback(() => {
    clearCloseTimeout();
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.top;
      const openUpward = spaceBelow < SUBMENU_MAX_HEIGHT && rect.top > SUBMENU_MAX_HEIGHT;
      
      setMenuPosition({
        top: openUpward ? rect.bottom : rect.top,
        left: rect.right + SUBMENU_GAP,
        buttonHeight: rect.height,
        openUpward,
      });
    }
    setIsOpen(true);
  }, [clearCloseTimeout]);
  
  const isMovingTowardSubmenu = useCallback((e: React.MouseEvent) => {
    if (!lastMousePos.current || !submenuRef.current) return false;
    
    const submenuRect = submenuRef.current.getBoundingClientRect();
    const currentX = e.clientX;
    const currentY = e.clientY;
    const lastX = lastMousePos.current.x;
    
    const movingRight = currentX > lastX;
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
      <Button
        ref={buttonRef}
        variant="ghost"
        className={`w-full justify-between gap-2 px-3 py-2.5 h-auto text-sm group transition-all duration-200 ${isOpen ? 'bg-muted/80' : ''}`}
      >
        <span className="font-medium">{m(label as Parameters<typeof m>[0])}</span>
        <svg 
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Button>
      
      {isOpen && (
        <div
          className="fixed"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left - SUBMENU_GAP}px`,
            width: `${SUBMENU_GAP + 8}px`,
            height: `${Math.max(menuPosition.buttonHeight, 200)}px`,
            zIndex: 9998,
          }}
          onMouseEnter={handleSubmenuEnter}
          onMouseLeave={handleSubmenuLeave}
        />
      )}
      
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
            <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">{m(label as Parameters<typeof m>[0])}</span>
          </div>
          <div className="p-1.5 flex flex-col gap-0.5 max-h-48 overflow-y-auto">
            {actions.map(action => (
              <Button
                key={action.key}
                onClick={action.onClick}
                variant="ghost"
                className="w-full justify-start gap-2 px-3 py-2 h-auto text-sm transition-all duration-150 hover:bg-muted/60"
                title={action.description}
              >
                <span className="flex-1 text-left truncate">{m(action.name as Parameters<typeof m>[0])}</span>
              </Button>
            ))}
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
  const { state, setTool: setGameTool, setActivePanel, saveCity, expandCity, shrinkCity } = useGame();
  const { selectedTool, stats, activePanel } = state;
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showCustomBuildingPanel, setShowCustomBuildingPanel] = useState(false);
  const multiplayer = useMultiplayerOptional();
  const { customBuildings, addCustomBuilding, selectedCustomBuildingId, selectCustomBuilding, removeCustomBuilding, isCustomBuildingMode } = useCustomBuildings();
  const hasShownShareModalRef = useRef(false);
  
  // Wrapper for setTool that also clears custom building selection
  const setTool = useCallback((tool: Tool) => {
    setGameTool(tool);
    // Clear custom building selection when switching to any tool
    if (selectedCustomBuildingId) {
      selectCustomBuilding(null);
    }
  }, [setGameTool, selectCustomBuilding, selectedCustomBuildingId]);
  
  // Auto-show share modal when first connecting as host (not guest)
  // Guests have initialState set (received from host), hosts don't
  useEffect(() => {
    const isHost = multiplayer?.connectionState === 'connected' && multiplayer?.roomCode && !multiplayer?.initialState;
    if (isHost && !hasShownShareModalRef.current) {
      hasShownShareModalRef.current = true;
      setShowShareModal(true);
    }
  }, [multiplayer?.connectionState, multiplayer?.roomCode, multiplayer?.initialState]);
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
  
  // Direct tool categories (shown inline)
  const directCategories = useMemo(() => ({
    'TOOLS': ['select', 'bulldoze', 'road', 'rail', 'subway'] as Tool[],
    'ZONES': ['zone_residential', 'zone_commercial', 'zone_industrial'] as Tool[],
  }), []);
  
  // Zoning submenu (shown under ZONES section, before BUILDINGS)
  const zoningSubmenu = useMemo(() => ({
    key: 'zoning',
    label: CATEGORY_LABELS.zoning,
    tools: ['zone_dezone', 'zone_water', 'zone_land'] as Tool[]
  }), []);
  
  // Expand City submenu (shown under TOOLS section)
  const expandCityActions = useMemo(() => [
    {
      key: 'expand_city',
      name: TOOL_INFO['expand_city'].name,
      description: 'Add 15 tiles to each edge of the city',
      onClick: expandCity,
    },
    {
      key: 'shrink_city',
      name: TOOL_INFO['shrink_city'].name,
      description: 'Remove 15 tiles from each edge of the city',
      onClick: shrinkCity,
    },
  ], [expandCity, shrinkCity]);
  
  // Submenu categories (hover to expand) - includes all new assets from main
  const submenuCategories = useMemo(() => [
    { 
      key: 'services', 
      label: CATEGORY_LABELS.services, 
      tools: ['police_station', 'fire_station', 'hospital', 'school', 'university'] as Tool[]
    },
    { 
      key: 'parks', 
      label: CATEGORY_LABELS.parks, 
      tools: ['tree', 'park', 'park_large', 'tennis', 'playground_small', 'playground_large', 'community_garden', 'pond_park', 'park_gate', 'greenhouse_garden', 'mini_golf_course', 'go_kart_track', 'amphitheater', 'roller_coaster_small', 'campground', 'cabin_house', 'mountain_lodge', 'mountain_trailhead'] as Tool[]
    },
    { 
      key: 'sports', 
      label: CATEGORY_LABELS.sports, 
      tools: ['basketball_courts', 'soccer_field_small', 'baseball_field_small', 'football_field', 'baseball_stadium', 'swimming_pool', 'skate_park', 'bleachers_field'] as Tool[]
    },
    { 
      key: 'waterfront', 
      label: CATEGORY_LABELS.waterfront, 
      tools: ['marina_docks_small', 'pier_large'] as Tool[]
    },
    { 
      key: 'community', 
      label: CATEGORY_LABELS.community, 
      tools: ['community_center', 'animal_pens_farm', 'office_building_small'] as Tool[]
    },
    { 
      key: 'utilities', 
      label: CATEGORY_LABELS.utilities, 
      tools: ['power_plant', 'water_tower', 'subway_station', 'rail_station'] as Tool[],
      forceOpenUpward: true
    },
    { 
      key: 'special', 
      label: CATEGORY_LABELS.special, 
      tools: ['stadium', 'museum', 'airport', 'space_program', 'city_hall', 'amusement_park'] as Tool[],
      forceOpenUpward: true
    },
  ], []);
  
  return (
    <div className="w-56 bg-sidebar border-r border-sidebar-border flex flex-col h-screen fixed left-0 top-0 z-40">
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <span className="text-sidebar-foreground font-bold tracking-tight">ISOCITY</span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={openCommandMenu}
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
            {/* Invite button - only show if in multiplayer context */}
            {multiplayer && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowShareModal(true)}
                title="Invite Players"
                className="h-7 w-7 text-muted-foreground hover:text-sidebar-foreground"
              >
                <Users className="w-4 h-4" />
              </Button>
            )}
            {onExit && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowExitDialog(true)}
                title="Exit to Main Menu"
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
            )}
          </div>
        </div>
      </div>
      
      <ScrollArea className="flex-1 py-2">
        {/* Direct categories (TOOLS, ZONES) */}
        {Object.entries(directCategories).map(([category, tools]) => (
          <div key={category} className="mb-1">
            {/* Separator above ZONES */}
            {category === 'ZONES' && (
              <div className="mx-4 my-2 h-px bg-sidebar-border/50" />
            )}
            <div className="px-4 py-2 text-[10px] font-bold tracking-widest text-muted-foreground">
              {m((CATEGORY_LABELS[category] || category) as Parameters<typeof m>[0])}
            </div>
            <div className="px-2 flex flex-col gap-0.5">
              {tools.map(tool => {
                const info = TOOL_INFO[tool];
                if (!info) return null;
                const isSelected = selectedTool === tool;
                const canAfford = stats.money >= info.cost;
                
                return (
                  <Button
                    key={tool}
                    onClick={() => setTool(tool)}
                    disabled={!canAfford && info.cost > 0}
                    variant={isSelected ? 'default' : 'ghost'}
                    className={`w-full justify-start gap-3 px-3 py-2 h-auto text-sm ${
                      isSelected ? 'bg-primary text-primary-foreground' : ''
                    }`}
                    title={`${m(info.description)}${info.cost > 0 ? ` - Cost: $${info.cost}` : ''}`}
                  >
                    <span className="flex-1 text-left truncate">{m(info.name)}</span>
                    {info.cost > 0 && (
                      <span className="text-xs opacity-60">${info.cost}</span>
                    )}
                  </Button>
                );
              })}
              {/* Expand City submenu - appears after TOOLS category */}
              {category === 'TOOLS' && (
                <ActionSubmenu
                  key="expandCity"
                  label={CATEGORY_LABELS.expandCity}
                  actions={expandCityActions}
                />
              )}
              {/* Zoning submenu - appears after ZONES category */}
              {category === 'ZONES' && (
                <HoverSubmenu
                  key={zoningSubmenu.key}
                  label={zoningSubmenu.label}
                  tools={zoningSubmenu.tools}
                  selectedTool={selectedTool}
                  money={stats.money}
                  onSelectTool={setTool}
                />
              )}
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
        
        {/* AI Building Creator */}
        <div className="mx-4 my-2 h-px bg-sidebar-border/50" />
        <div className="px-4 py-2 text-[10px] font-bold tracking-widest text-muted-foreground">
          CUSTOM BUILDINGS
        </div>
        <div className="px-2 pb-2 space-y-1">
          <Button
            onClick={() => setShowCustomBuildingPanel(true)}
            variant="outline"
            className="w-full justify-start gap-2 px-3 py-2.5 h-auto text-sm bg-gradient-to-r from-purple-600/10 to-pink-600/10 border-purple-500/30 hover:border-purple-500/50 hover:from-purple-600/20 hover:to-pink-600/20 transition-all duration-200 group"
          >
            <svg 
              className="fal-logo-button w-4 h-4 text-purple-400" 
              viewBox="0 0 624 624" 
              fill="currentColor" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path fillRule="evenodd" clipRule="evenodd" d="M402.365 0C413.17 0.000231771 421.824 8.79229 422.858 19.5596C432.087 115.528 508.461 191.904 604.442 201.124C615.198 202.161 624 210.821 624 221.638V402.362C624 413.179 615.198 421.839 604.442 422.876C508.461 432.096 432.087 508.472 422.858 604.44C421.824 615.208 413.17 624 402.365 624H221.635C210.83 624 202.176 615.208 201.142 604.44C191.913 508.472 115.538 432.096 19.5576 422.876C8.80183 421.839 0 413.179 0 402.362V221.638C0 210.821 8.80183 202.161 19.5576 201.124C115.538 191.904 191.913 115.528 201.142 19.5596C202.176 8.79215 210.83 0 221.635 0H402.365ZM312 124C208.17 124 124 208.17 124 312C124 415.83 208.17 500 312 500C415.83 500 500 415.83 500 312C500 208.17 415.83 124 312 124Z"/>
            </svg>
            <span className="flex-1 text-left">Create New</span>
          </Button>
          
          {/* List of custom buildings for placement */}
          {customBuildings.length > 0 && (
            <div className="flex flex-col gap-0.5 mt-2">
              {customBuildings.map((building) => {
                const isSelected = selectedCustomBuildingId === building.id;
                const canAfford = stats.money >= building.cost;
                return (
                  <div key={building.id} className="relative group">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeCustomBuilding(building.id);
                        // Deselect if the removed building was selected
                        if (isSelected) {
                          selectCustomBuilding(null);
                          setTool('select');
                        }
                      }}
                      className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-4 h-4 flex items-center justify-center rounded-sm bg-red-600/80 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove building"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <Button
                      onClick={() => {
                        if (isSelected) {
                          selectCustomBuilding(null);
                          setTool('select');
                        } else {
                          selectCustomBuilding(building.id);
                          // Use setGameTool directly to avoid the wrapper clearing our selection
                          setGameTool('select');
                        }
                      }}
                      disabled={!canAfford}
                      variant={isSelected ? 'default' : 'ghost'}
                      className={`w-full justify-start gap-2 pl-6 pr-2 py-1.5 h-auto text-sm ${
                        isSelected ? 'bg-purple-600 text-white ring-2 ring-purple-400' : ''
                      }`}
                      title={`${building.name} - $${building.cost}`}
                    >
                      <img 
                        src={building.spriteUrl} 
                        alt={building.name}
                        className="w-6 h-6 rounded object-cover flex-shrink-0"
                      />
                      <span className="flex-1 text-left truncate text-xs">{building.name}</span>
                      <span className="text-[10px] opacity-60">${building.cost}</span>
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
      
      <div className="border-t border-sidebar-border p-2">
        <div className="grid grid-cols-4 gap-1">
          {[
            { panel: 'budget' as const, icon: <BudgetIcon size={16} />, labelKey: 'budget' as const },
            { panel: 'statistics' as const, icon: <ChartIcon size={16} />, labelKey: 'statistics' as const },
            { panel: 'advisors' as const, icon: <AdvisorIcon size={16} />, labelKey: 'advisors' as const },
            { panel: 'settings' as const, icon: <SettingsIcon size={16} />, labelKey: 'settings' as const },
          ].map(({ panel, icon, labelKey }) => (
            <Button
              key={panel}
              onClick={() => setActivePanel(activePanel === panel ? 'none' : panel)}
              variant={activePanel === panel ? 'default' : 'ghost'}
              size="icon-sm"
              className="w-full"
              title={String(m(UI_LABELS[labelKey]))}
            >
              {icon}
            </Button>
          ))}
        </div>
      </div>
      
      <ExitDialog
        open={showExitDialog}
        onOpenChange={setShowExitDialog}
        onSaveAndExit={handleSaveAndExit}
        onExitWithoutSaving={handleExitWithoutSaving}
      />
      
      {multiplayer && (
        <ShareModal
          open={showShareModal}
          onOpenChange={setShowShareModal}
        />
      )}
      
      <CustomBuildingPanel
        open={showCustomBuildingPanel}
        onOpenChange={setShowCustomBuildingPanel}
        onBuildingCreated={(building: CustomBuilding) => {
          addCustomBuilding(building);
          // Auto-select the custom building for immediate placement
          selectCustomBuilding(building.id);
          setGameTool('select'); // Clear any other tool selection
        }}
      />
    </div>
  );
});

export default Sidebar;
