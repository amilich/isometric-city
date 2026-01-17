'use client';

import React, { useState, useCallback } from 'react';
import { T, msg, useMessages, useGT, Currency } from 'gt-next';
import { useCoaster } from '@/context/CoasterContext';
import { Tool, TOOL_INFO } from '@/games/coaster/types';
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

// =============================================================================
// TOOL CATEGORIES
// =============================================================================

const TOOL_CATEGORIES: { name: string; tools: Tool[] }[] = [
  { name: msg('Tools'), tools: ['select', 'bulldoze'] },
  { name: msg('Paths'), tools: ['path', 'queue'] },
  { name: msg('Trees'), tools: [
    'tree_oak', 'tree_maple', 'tree_pine', 'tree_palm', 'tree_cherry',
    'bush_hedge', 'bush_flowering', 'topiary_ball',
  ] },
  { name: msg('Flowers'), tools: ['flowers_bed', 'flowers_planter', 'flowers_wild', 'ground_cover'] },
  { name: msg('Furniture'), tools: [
    'bench_wooden', 'bench_metal', 'bench_ornate',
    'lamp_victorian', 'lamp_modern', 'lamp_pathway',
    'trash_can_basic', 'trash_can_fancy',
  ] },
  { name: msg('Food'), tools: ['food_hotdog', 'food_burger', 'food_icecream', 'food_cotton_candy', 'food_popcorn'] },
  { name: msg('Shops'), tools: ['shop_souvenir', 'shop_toys', 'shop_photo', 'restroom', 'first_aid'] },
  { name: msg('Rides'), tools: [
    'ride_carousel', 'ride_teacups', 'ride_ferris_wheel', 'ride_drop_tower',
    'ride_swing_ride', 'ride_bumper_cars', 'ride_go_karts', 'ride_haunted_house',
    'ride_log_flume',
  ] },
  { name: msg('Coasters'), tools: [
    'coaster_build',
    'coaster_track',
    'coaster_turn_left',
    'coaster_turn_right',
    'coaster_slope_up',
    'coaster_slope_down',
    'coaster_loop',
    'coaster_station',
  ] },
  { name: msg('Infrastructure'), tools: ['park_entrance', 'staff_building'] },
];

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
          <T>
            <DialogTitle>Exit to Menu</DialogTitle>
            <DialogDescription>
              Would you like to save your park before exiting?
            </DialogDescription>
          </T>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <T>
            <Button
              variant="outline"
              onClick={onExitWithoutSaving}
              className="w-full sm:w-auto"
            >
              Exit Without Saving
            </Button>
          </T>
          <T>
            <Button onClick={onSaveAndExit} className="w-full sm:w-auto">
              Save & Exit
            </Button>
          </T>
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
  const { state, setTool, saveGame } = useCoaster();
  const { selectedTool, finances } = state;
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(TOOL_CATEGORIES[0].name);
  const m = useMessages();
  const gt = useGT();
  
  const handleSaveAndExit = useCallback(() => {
    saveGame();
    setShowExitDialog(false);
    onExit?.();
  }, [saveGame, onExit]);
  
  const handleExitWithoutSaving = useCallback(() => {
    setShowExitDialog(false);
    onExit?.();
  }, [onExit]);
  
  const toggleCategory = useCallback((category: string) => {
    setExpandedCategory(prev => prev === category ? null : category);
  }, []);
  
  return (
    <div className="w-56 bg-sidebar border-r border-sidebar-border flex flex-col h-screen fixed left-0 top-0 z-40">
      {/* Header */}
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <T>
            <span className="text-sidebar-foreground font-bold tracking-tight">
              COASTER TYCOON
            </span>
          </T>
          {onExit && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowExitDialog(true)}
              title={gt('Exit to Menu')}
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
      
      {/* Tool Categories */}
      <ScrollArea className="flex-1 py-2">
        {TOOL_CATEGORIES.map((category) => (
          <div key={category.name} className="mb-1">
            {/* Category header */}
            <button
              onClick={() => toggleCategory(category.name)}
              className={`w-full px-4 py-2 text-left text-xs font-bold tracking-widest uppercase transition-colors ${
                expandedCategory === category.name
                  ? 'text-white bg-white/5'
                  : 'text-muted-foreground hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{m(category.name)}</span>
                <svg
                  className={`w-4 h-4 transition-transform ${
                    expandedCategory === category.name ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </button>

            {/* Tools in category */}
            {expandedCategory === category.name && (
              <div className="px-2 py-1 flex flex-col gap-0.5">
                {category.tools.map(tool => {
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
                      className={`w-full justify-start gap-2 px-3 py-2 h-auto text-sm ${
                        isSelected ? 'bg-primary text-primary-foreground' : ''
                      }`}
                      title={gt('{description} - ${cost}', { description: m(info.description), cost: info.cost })}
                    >
                      <span className="flex-1 text-left truncate">{m(info.name)}</span>
                      {info.cost > 0 && (
                        <span className={`text-xs ${isSelected ? 'opacity-80' : 'opacity-50'}`}>
                          ${info.cost}
                        </span>
                      )}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </ScrollArea>
      
      {/* Bottom panel buttons */}
      <div className="border-t border-sidebar-border p-2">
        <div className="text-xs text-muted-foreground text-center">
          <Currency currency="USD">{finances.cash}</Currency>
        </div>
      </div>
      
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
