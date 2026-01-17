'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { CoasterTool, TOOL_INFO } from '@/games/coaster/types/game';
import { 
  RIDE_DEFINITIONS, 
  SHOP_DEFINITIONS, 
  SCENERY_DEFINITIONS,
  RideType,
  ShopType,
  SceneryType,
} from '@/games/coaster/types/buildings';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Tool category configuration
const TOOL_CATEGORIES = {
  TOOLS: ['select', 'bulldoze'] as CoasterTool[],
  PATHS: ['path_standard', 'path_queue'] as CoasterTool[],
  TERRAIN: ['terrain_raise', 'terrain_lower', 'terrain_smooth', 'terrain_water', 'terrain_own_land'] as CoasterTool[],
  STAFF: ['hire_handyman', 'hire_mechanic', 'hire_security', 'hire_entertainer'] as CoasterTool[],
};

// Ride category configuration
const RIDE_CATEGORIES = {
  'Gentle Rides': ['carousel', 'ferris_wheel', 'observation_tower', 'spiral_slide', 'merry_go_round', 'haunted_house', 'dodgems', 'maze', 'mini_train'] as RideType[],
  'Thrill Rides': ['swinging_ship', 'swinging_inverter_ship', 'top_spin', 'twist', 'motion_simulator', 'go_karts', 'launched_freefall', 'enterprise', 'scrambled_eggs'] as RideType[],
  'Water Rides': ['log_flume', 'river_rapids', 'splash_boats', 'rowing_boats', 'dinghy_slide', 'water_coaster'] as RideType[],
  'Roller Coasters': ['junior_coaster', 'wooden_coaster', 'steel_coaster', 'corkscrew_coaster', 'looping_coaster', 'inverted_coaster', 'suspended_coaster', 'stand_up_coaster', 'mine_train_coaster', 'wild_mouse', 'bobsled_coaster', 'vertical_drop_coaster', 'hypercoaster', 'flying_coaster', 'multi_dimension_coaster'] as RideType[],
  'Transport': ['miniature_railway', 'monorail', 'suspended_monorail', 'chairlift'] as RideType[],
};

// Shop categories
const SHOP_CATEGORIES = {
  'Food Stalls': ['burger_stall', 'pizza_stall', 'hot_dog_stall', 'ice_cream_stall', 'popcorn_stall', 'candy_stall', 'donut_stall'] as ShopType[],
  'Drink Stalls': ['coffee_stall', 'drink_stall'] as ShopType[],
  'Merchandise': ['balloon_stall', 'hat_stall', 't_shirt_stall', 'souvenir_stall'] as ShopType[],
  'Facilities': ['information_kiosk', 'first_aid', 'restrooms', 'atm'] as ShopType[],
};

// Scenery categories
const SCENERY_CATEGORIES = {
  'Trees': ['tree_oak', 'tree_pine', 'tree_palm', 'tree_willow'] as SceneryType[],
  'Gardens': ['bush', 'flower_bed'] as SceneryType[],
  'Furniture': ['bench', 'trash_bin', 'lamp_post'] as SceneryType[],
  'Decorations': ['fountain_small', 'fountain_large', 'statue', 'rock', 'sign'] as SceneryType[],
  'Barriers': ['fence_wood', 'fence_iron', 'hedge'] as SceneryType[],
};

interface HoverSubmenuProps {
  label: string;
  children: React.ReactNode;
  isSelected?: boolean;
}

function HoverSubmenu({ label, children, isSelected }: HoverSubmenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <Button
        variant={isSelected ? 'default' : 'ghost'}
        className={`w-full justify-between gap-2 px-3 py-2.5 h-auto text-sm ${
          isSelected ? 'bg-purple-600 text-white' : ''
        } ${isOpen ? 'bg-white/10' : ''}`}
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
      
      {isOpen && (
        <div 
          className="fixed w-56 bg-slate-900/95 backdrop-blur-sm border border-white/20 rounded-md shadow-xl overflow-hidden z-[9999]"
          style={{ 
            left: '232px',
            marginTop: '-38px',
          }}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
        >
          <div className="px-3 py-2 border-b border-white/10 bg-white/5">
            <span className="text-[10px] font-bold tracking-widest text-white/60 uppercase">{label}</span>
          </div>
          <div className="p-1.5 flex flex-col gap-0.5 max-h-64 overflow-y-auto">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

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
      <DialogContent className="sm:max-w-md bg-slate-900 border-white/20">
        <DialogHeader>
          <DialogTitle className="text-white">Exit to Menu</DialogTitle>
          <DialogDescription className="text-white/60">
            Would you like to save your park before exiting?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onExitWithoutSaving}
            className="w-full sm:w-auto border-white/20 text-white hover:bg-white/10"
          >
            Exit Without Saving
          </Button>
          <Button
            onClick={onSaveAndExit}
            className="w-full sm:w-auto bg-purple-600 hover:bg-purple-500"
          >
            Save & Exit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CoasterSidebarProps {
  onExit?: () => void;
}

export function CoasterSidebar({ onExit }: CoasterSidebarProps) {
  const { 
    state, 
    setTool, 
    setSelectedRideType, 
    setSelectedShopType,
    setSelectedSceneryType,
    setActivePanel,
    savePark,
  } = useCoaster();
  const { selectedTool, finances, activePanel, research } = state;
  const [showExitDialog, setShowExitDialog] = useState(false);

  const handleToolClick = useCallback((tool: CoasterTool) => {
    setTool(tool);
    setSelectedRideType(undefined);
    setSelectedShopType(undefined);
    setSelectedSceneryType(undefined);
  }, [setTool, setSelectedRideType, setSelectedShopType, setSelectedSceneryType]);

  const handleRideClick = useCallback((rideType: RideType) => {
    setTool('place_ride');
    setSelectedRideType(rideType);
    setSelectedShopType(undefined);
    setSelectedSceneryType(undefined);
  }, [setTool, setSelectedRideType, setSelectedShopType, setSelectedSceneryType]);

  const handleShopClick = useCallback((shopType: ShopType) => {
    setTool('place_shop');
    setSelectedShopType(shopType);
    setSelectedRideType(undefined);
    setSelectedSceneryType(undefined);
  }, [setTool, setSelectedShopType, setSelectedRideType, setSelectedSceneryType]);

  const handleSceneryClick = useCallback((sceneryType: SceneryType) => {
    setTool('place_scenery');
    setSelectedSceneryType(sceneryType);
    setSelectedRideType(undefined);
    setSelectedShopType(undefined);
  }, [setTool, setSelectedRideType, setSelectedShopType, setSelectedSceneryType]);

  const handleSaveAndExit = useCallback(() => {
    savePark();
    setShowExitDialog(false);
    onExit?.();
  }, [savePark, onExit]);

  const handleExitWithoutSaving = useCallback(() => {
    setShowExitDialog(false);
    onExit?.();
  }, [onExit]);

  // Filter to only unlocked rides
  const unlockedRides = useMemo(() => new Set(research.unlockedRides), [research.unlockedRides]);
  const unlockedShops = useMemo(() => new Set(research.unlockedShops), [research.unlockedShops]);
  const unlockedScenery = useMemo(() => new Set(research.unlockedScenery), [research.unlockedScenery]);

  return (
    <div className="w-56 bg-slate-900/90 backdrop-blur-sm border-r border-white/10 flex flex-col h-screen fixed left-0 top-0 z-40">
      {/* Header */}
      <div className="px-4 py-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <span className="text-white font-bold tracking-tight">COASTER TYCOON</span>
          {onExit && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowExitDialog(true)}
              title="Exit to Menu"
              className="h-7 w-7 text-white/40 hover:text-white hover:bg-white/10"
            >
              <svg className="w-4 h-4 -scale-x-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 py-2">
        {/* Tools */}
        <div className="mb-1">
          <div className="px-4 py-2 text-[10px] font-bold tracking-widest text-white/40">
            TOOLS
          </div>
          <div className="px-2 flex flex-col gap-0.5">
            {TOOL_CATEGORIES.TOOLS.map(tool => {
              const info = TOOL_INFO[tool];
              return (
                <Button
                  key={tool}
                  onClick={() => handleToolClick(tool)}
                  variant={selectedTool === tool ? 'default' : 'ghost'}
                  className={`w-full justify-start gap-3 px-3 py-2 h-auto text-sm ${
                    selectedTool === tool ? 'bg-purple-600 text-white' : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  <span className="flex-1 text-left">{info.name}</span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Paths */}
        <div className="mx-4 my-2 h-px bg-white/10" />
        <div className="mb-1">
          <div className="px-4 py-2 text-[10px] font-bold tracking-widest text-white/40">
            PATHS
          </div>
          <div className="px-2 flex flex-col gap-0.5">
            {TOOL_CATEGORIES.PATHS.map(tool => {
              const info = TOOL_INFO[tool];
              const canAfford = finances.cash >= info.cost;
              return (
                <Button
                  key={tool}
                  onClick={() => handleToolClick(tool)}
                  disabled={!canAfford && info.cost > 0}
                  variant={selectedTool === tool ? 'default' : 'ghost'}
                  className={`w-full justify-start gap-3 px-3 py-2 h-auto text-sm ${
                    selectedTool === tool ? 'bg-purple-600 text-white' : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  <span className="flex-1 text-left">{info.name}</span>
                  <span className="text-xs opacity-60">${info.cost}</span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Rides */}
        <div className="mx-4 my-2 h-px bg-white/10" />
        <div className="px-4 py-2 text-[10px] font-bold tracking-widest text-white/40">
          RIDES
        </div>
        <div className="px-2 flex flex-col gap-0.5">
          {Object.entries(RIDE_CATEGORIES).map(([category, rides]) => {
            const availableRides = rides.filter(r => unlockedRides.has(r));
            if (availableRides.length === 0) return null;
            
            const hasSelectedRide = availableRides.includes(state.selectedRideType as RideType);
            
            return (
              <HoverSubmenu key={category} label={category} isSelected={hasSelectedRide}>
                {availableRides.map(rideType => {
                  const def = RIDE_DEFINITIONS[rideType];
                  const canAfford = finances.cash >= def.buildCost;
                  const isSelected = state.selectedRideType === rideType;
                  
                  return (
                    <Button
                      key={rideType}
                      onClick={() => handleRideClick(rideType)}
                      disabled={!canAfford}
                      variant={isSelected ? 'default' : 'ghost'}
                      className={`w-full justify-start gap-2 px-3 py-2 h-auto text-sm ${
                        isSelected ? 'bg-purple-600 text-white' : 'text-white/80 hover:bg-white/10'
                      }`}
                    >
                      <span className="flex-1 text-left truncate">{def.name}</span>
                      <span className="text-xs opacity-60">${(def.buildCost / 1000).toFixed(0)}k</span>
                    </Button>
                  );
                })}
              </HoverSubmenu>
            );
          })}
        </div>

        {/* Shops */}
        <div className="mx-4 my-2 h-px bg-white/10" />
        <div className="px-4 py-2 text-[10px] font-bold tracking-widest text-white/40">
          SHOPS & FACILITIES
        </div>
        <div className="px-2 flex flex-col gap-0.5">
          {Object.entries(SHOP_CATEGORIES).map(([category, shops]) => {
            const availableShops = shops.filter(s => unlockedShops.has(s));
            if (availableShops.length === 0) return null;
            const hasSelectedShop = availableShops.includes(state.selectedShopType as ShopType);
            
            return (
              <HoverSubmenu key={category} label={category} isSelected={hasSelectedShop}>
                {availableShops.map(shopType => {
                  const def = SHOP_DEFINITIONS[shopType];
                  const canAfford = finances.cash >= def.buildCost;
                  const isSelected = state.selectedShopType === shopType;
                  
                  return (
                    <Button
                      key={shopType}
                      onClick={() => handleShopClick(shopType)}
                      disabled={!canAfford}
                      variant={isSelected ? 'default' : 'ghost'}
                      className={`w-full justify-start gap-2 px-3 py-2 h-auto text-sm ${
                        isSelected ? 'bg-purple-600 text-white' : 'text-white/80 hover:bg-white/10'
                      }`}
                    >
                      <span className="flex-1 text-left truncate">{def.name}</span>
                      <span className="text-xs opacity-60">${def.buildCost}</span>
                    </Button>
                  );
                })}
              </HoverSubmenu>
            );
          })}
        </div>

        {/* Scenery */}
        <div className="mx-4 my-2 h-px bg-white/10" />
        <div className="px-4 py-2 text-[10px] font-bold tracking-widest text-white/40">
          SCENERY
        </div>
        <div className="px-2 flex flex-col gap-0.5">
          {Object.entries(SCENERY_CATEGORIES).map(([category, items]) => {
            const availableItems = items.filter(s => unlockedScenery.has(s));
            if (availableItems.length === 0) return null;
            
            const hasSelectedItem = availableItems.includes(state.selectedSceneryType as SceneryType);
            
            return (
              <HoverSubmenu key={category} label={category} isSelected={hasSelectedItem}>
                {availableItems.map(sceneryType => {
                  const def = SCENERY_DEFINITIONS[sceneryType];
                  const canAfford = finances.cash >= def.buildCost;
                  const isSelected = state.selectedSceneryType === sceneryType;
                  
                  return (
                    <Button
                      key={sceneryType}
                      onClick={() => handleSceneryClick(sceneryType)}
                      disabled={!canAfford}
                      variant={isSelected ? 'default' : 'ghost'}
                      className={`w-full justify-start gap-2 px-3 py-2 h-auto text-sm ${
                        isSelected ? 'bg-purple-600 text-white' : 'text-white/80 hover:bg-white/10'
                      }`}
                    >
                      <span className="flex-1 text-left truncate">{def.name}</span>
                      <span className="text-xs opacity-60">${def.buildCost}</span>
                    </Button>
                  );
                })}
              </HoverSubmenu>
            );
          })}
        </div>

        {/* Terrain */}
        <div className="mx-4 my-2 h-px bg-white/10" />
        <div className="px-4 py-2 text-[10px] font-bold tracking-widest text-white/40">
          TERRAIN
        </div>
        <div className="px-2 flex flex-col gap-0.5">
          {TOOL_CATEGORIES.TERRAIN.map(tool => {
            const info = TOOL_INFO[tool];
            const canAfford = finances.cash >= info.cost;
            return (
              <Button
                key={tool}
                onClick={() => handleToolClick(tool)}
                disabled={!canAfford && info.cost > 0}
                variant={selectedTool === tool ? 'default' : 'ghost'}
                className={`w-full justify-start gap-3 px-3 py-2 h-auto text-sm ${
                  selectedTool === tool ? 'bg-purple-600 text-white' : 'text-white/80 hover:bg-white/10'
                }`}
              >
                <span className="flex-1 text-left">{info.name}</span>
                {info.cost > 0 && <span className="text-xs opacity-60">${info.cost}</span>}
              </Button>
            );
          })}
        </div>

        {/* Staff */}
        <div className="mx-4 my-2 h-px bg-white/10" />
        <HoverSubmenu label="Staff">
          {TOOL_CATEGORIES.STAFF.map(tool => {
            const info = TOOL_INFO[tool];
            return (
              <Button
                key={tool}
                onClick={() => handleToolClick(tool)}
                variant="ghost"
                className="w-full justify-start gap-2 px-3 py-2 h-auto text-sm text-white/80 hover:bg-white/10"
              >
                <span className="flex-1 text-left truncate">{info.name}</span>
                <span className="text-xs opacity-60">${info.cost}</span>
              </Button>
            );
          })}
        </HoverSubmenu>
      </ScrollArea>

      {/* Bottom panel buttons */}
      <div className="border-t border-white/10 p-2">
        <div className="grid grid-cols-5 gap-1">
          {[
            { panel: 'rides' as const, icon: '🎢', label: 'Rides' },
            { panel: 'guests' as const, icon: '👥', label: 'Guests' },
            { panel: 'staff' as const, icon: '👷', label: 'Staff' },
            { panel: 'finances' as const, icon: '💰', label: 'Finances' },
            { panel: 'park' as const, icon: '🏰', label: 'Park' },
          ].map(({ panel, icon, label }) => (
            <Button
              key={panel}
              onClick={() => setActivePanel(activePanel === panel ? 'none' : panel)}
              variant={activePanel === panel ? 'default' : 'ghost'}
              size="icon"
              className={`w-full h-8 ${activePanel === panel ? 'bg-purple-600' : 'hover:bg-white/10'}`}
              title={label}
            >
              <span className="text-sm">{icon}</span>
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
    </div>
  );
}
