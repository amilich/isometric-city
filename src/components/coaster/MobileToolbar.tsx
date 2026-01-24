'use client';

import React, { useState, useCallback } from 'react';
import { T, useGT, msg, useMessages } from 'gt-next';
import { useCoaster } from '@/context/CoasterContext';
import { Tool, TOOL_INFO } from '@/games/coaster/types';
import { COASTER_TYPE_STATS, getCoasterCategory } from '@/games/coaster/types/tracks';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// =============================================================================
// ICONS
// =============================================================================

function CloseIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function SelectIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 4l16 8-8 3-3 8z" />
    </svg>
  );
}

function BulldozeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M6 6v14a2 2 0 002 2h8a2 2 0 002-2V6M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2" />
    </svg>
  );
}

function PathIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 20L10 14M14 10L20 4" />
      <circle cx="10" cy="14" r="2" />
      <circle cx="14" cy="10" r="2" />
    </svg>
  );
}

function CoasterIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 20c2-3 4-7 6-8s4 1 6 0 4-5 6-8" />
      <circle cx="5" cy="20" r="2" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="4" r="1.5" />
    </svg>
  );
}

function TreeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22v-7" />
      <path d="M12 15l-4-4 4-8 4 8-4 4z" />
    </svg>
  );
}

function FoodIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <line x1="6" y1="1" x2="6" y2="4" />
      <line x1="10" y1="1" x2="10" y2="4" />
      <line x1="14" y1="1" x2="14" y2="4" />
    </svg>
  );
}

function RideIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2v20" />
      <path d="M2 12h20" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// =============================================================================
// TOOL CATEGORIES
// =============================================================================

// Tool categories with their tools - simplified for mobile
const TOOL_CATEGORIES: { key: string; label: string; tools: Tool[] }[] = [
  {
    key: 'paths',
    label: msg('Paths'),
    tools: ['path', 'queue'],
  },
  {
    key: 'terrain',
    label: msg('Terrain'),
    tools: ['zone_water', 'zone_land'],
  },
  {
    key: 'trees',
    label: msg('Trees & Plants'),
    tools: [
      'tree_oak', 'tree_maple', 'tree_pine', 'tree_palm', 'tree_cherry',
      'bush_hedge', 'bush_flowering', 'topiary_ball',
      'flowers_bed', 'flowers_planter', 'flowers_wild',
    ],
  },
  {
    key: 'furniture',
    label: msg('Furniture'),
    tools: [
      'bench_wooden', 'bench_metal', 'bench_ornate',
      'lamp_victorian', 'lamp_modern', 'lamp_pathway',
      'trash_can_basic', 'trash_can_fancy',
    ],
  },
  {
    key: 'fountains',
    label: msg('Fountains'),
    tools: [
      'fountain_small_1', 'fountain_small_2', 'fountain_medium_1', 'fountain_large_1',
      'pond_small', 'pond_medium', 'splash_pad', 'water_jets',
    ],
  },
  {
    key: 'food',
    label: msg('Food & Drink'),
    tools: [
      'food_hotdog', 'food_burger', 'food_icecream', 'food_cotton_candy',
      'drink_soda', 'drink_lemonade', 'snack_popcorn', 'snack_pizza',
    ],
  },
  {
    key: 'shops',
    label: msg('Shops & Services'),
    tools: [
      'shop_souvenir', 'shop_toys', 'shop_candy', 'arcade_building',
      'restroom', 'first_aid', 'atm',
    ],
  },
  {
    key: 'rides_small',
    label: msg('Small Rides'),
    tools: [
      'ride_carousel', 'ride_teacups', 'ride_bumper_cars', 'ride_go_karts',
      'ride_kiddie_coaster', 'ride_kiddie_train', 'ride_haunted_house',
    ],
  },
  {
    key: 'rides_large',
    label: msg('Large Rides'),
    tools: [
      'ride_ferris_classic', 'ride_drop_tower', 'ride_swing_ride',
      'ride_log_flume', 'ride_rapids',
    ],
  },
  {
    key: 'coasters_wooden',
    label: msg('Wooden Coasters'),
    tools: [
      'coaster_type_wooden_classic',
      'coaster_type_wooden_twister',
    ],
  },
  {
    key: 'coasters_steel',
    label: msg('Steel Coasters'),
    tools: [
      'coaster_type_steel_sit_down',
      'coaster_type_steel_inverted',
      'coaster_type_steel_wing',
      'coaster_type_launch_coaster',
      'coaster_type_hyper_coaster',
    ],
  },
  {
    key: 'coasters_specialty',
    label: msg('Specialty Coasters'),
    tools: [
      'coaster_type_water_coaster',
      'coaster_type_mine_train',
      'coaster_type_bobsled',
    ],
  },
  {
    key: 'infrastructure',
    label: msg('Infrastructure'),
    tools: ['park_entrance', 'staff_building'],
  },
];

// Map coaster type tools to their CoasterType values
const COASTER_TYPE_TOOL_MAP: Record<string, string> = {
  'coaster_type_wooden_classic': 'wooden_classic',
  'coaster_type_wooden_twister': 'wooden_twister',
  'coaster_type_steel_sit_down': 'steel_sit_down',
  'coaster_type_steel_standup': 'steel_standup',
  'coaster_type_steel_inverted': 'steel_inverted',
  'coaster_type_steel_floorless': 'steel_floorless',
  'coaster_type_steel_wing': 'steel_wing',
  'coaster_type_steel_flying': 'steel_flying',
  'coaster_type_steel_4d': 'steel_4d',
  'coaster_type_steel_spinning': 'steel_spinning',
  'coaster_type_launch_coaster': 'launch_coaster',
  'coaster_type_hyper_coaster': 'hyper_coaster',
  'coaster_type_giga_coaster': 'giga_coaster',
  'coaster_type_water_coaster': 'water_coaster',
  'coaster_type_mine_train': 'mine_train',
  'coaster_type_bobsled': 'bobsled',
  'coaster_type_suspended': 'suspended',
};

// Track building tools shown when building a coaster
const TRACK_BUILD_TOOLS: Tool[] = [
  'coaster_build',
  'coaster_track',
  'coaster_turn_left',
  'coaster_turn_right',
  'coaster_slope_up',
  'coaster_slope_down',
  'coaster_loop',
  'coaster_station',
];

// =============================================================================
// MOBILE TOOLBAR COMPONENT
// =============================================================================

interface MobileCoasterToolbarProps {
  onOpenPanel: (panel: 'finances' | 'guests' | 'rides' | 'staff' | 'settings') => void;
}

export function MobileCoasterToolbar({ onOpenPanel }: MobileCoasterToolbarProps) {
  const { state, setTool, startCoasterBuild, cancelCoasterBuild } = useCoaster();
  const { selectedTool, finances, buildingCoasterType } = state;
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const gt = useGT();
  const m = useMessages();

  const handleCategoryClick = useCallback((category: string) => {
    if (expandedCategory === category) {
      setExpandedCategory(null);
    } else {
      setExpandedCategory(category);
    }
  }, [expandedCategory]);

  const handleToolSelect = useCallback((tool: Tool, closeMenu: boolean = false) => {
    // Check if this is a coaster type selection tool
    const coasterType = COASTER_TYPE_TOOL_MAP[tool];
    if (coasterType) {
      // Start building a coaster of this type
      startCoasterBuild(coasterType);
      // Switch to coaster build mode
      setTool('coaster_build');
    } else if (selectedTool === tool && tool !== 'select') {
      // If the tool is already selected and it's not 'select', toggle back to select
      setTool('select');
    } else {
      setTool(tool);
    }
    
    setExpandedCategory(null);
    if (closeMenu) {
      setShowMenu(false);
    }
  }, [selectedTool, setTool, startCoasterBuild]);

  const handleCancelCoasterBuild = useCallback(() => {
    cancelCoasterBuild();
    setTool('select');
  }, [cancelCoasterBuild, setTool]);

  return (
    <>
      {/* Bottom Toolbar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
        <Card className="rounded-none border-x-0 border-b-0 bg-card/95 backdrop-blur-sm">
          {/* Active Coaster Build Mode Indicator */}
          {buildingCoasterType && (
            <div className="flex items-center justify-between px-4 py-1.5 border-b border-sidebar-border/50 bg-primary/10 text-xs">
              <div className="flex items-center gap-2">
                <CoasterIcon size={14} />
                <span className="text-foreground font-medium">
                  {COASTER_TYPE_STATS[buildingCoasterType]?.name ?? gt('Custom Coaster')}
                </span>
                <span className="text-muted-foreground capitalize text-[10px]">
                  ({getCoasterCategory(buildingCoasterType)})
                </span>
              </div>
              <button
                onClick={handleCancelCoasterBuild}
                className="text-muted-foreground hover:text-destructive"
              >
                <CloseIcon size={14} />
              </button>
            </div>
          )}

          <div className="flex items-center justify-around px-2 py-2 gap-1">
            {/* Quick access tools */}
            <Button
              variant={selectedTool === 'select' ? 'default' : 'ghost'}
              size="icon"
              className="h-11 w-11"
              onClick={() => handleToolSelect('select')}
            >
              <SelectIcon />
            </Button>

            <Button
              variant={selectedTool === 'bulldoze' ? 'default' : 'ghost'}
              size="icon"
              className="h-11 w-11 text-red-400"
              onClick={() => handleToolSelect('bulldoze')}
            >
              <BulldozeIcon />
            </Button>

            <Button
              variant={selectedTool === 'path' ? 'default' : 'ghost'}
              size="icon"
              className="h-11 w-11"
              onClick={() => handleToolSelect('path')}
            >
              <PathIcon />
            </Button>

            {/* Coaster button - shows track tools when building */}
            {buildingCoasterType ? (
              <Button
                variant={selectedTool === 'coaster_build' ? 'default' : 'ghost'}
                size="icon"
                className="h-11 w-11 text-purple-400"
                onClick={() => handleToolSelect('coaster_build')}
              >
                <CoasterIcon />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11"
                onClick={() => {
                  setShowMenu(true);
                  setExpandedCategory('coasters_steel');
                }}
              >
                <CoasterIcon />
              </Button>
            )}

            <Button
              variant={selectedTool.startsWith('tree_') || selectedTool.startsWith('bush_') || selectedTool.startsWith('flowers_') ? 'default' : 'ghost'}
              size="icon"
              className="h-11 w-11"
              onClick={() => {
                setShowMenu(true);
                setExpandedCategory('trees');
              }}
            >
              <TreeIcon />
            </Button>

            <Button
              variant={selectedTool.startsWith('food_') || selectedTool.startsWith('drink_') || selectedTool.startsWith('snack_') ? 'default' : 'ghost'}
              size="icon"
              className="h-11 w-11"
              onClick={() => {
                setShowMenu(true);
                setExpandedCategory('food');
              }}
            >
              <FoodIcon />
            </Button>

            <Button
              variant={selectedTool.startsWith('ride_') ? 'default' : 'ghost'}
              size="icon"
              className="h-11 w-11"
              onClick={() => {
                setShowMenu(true);
                setExpandedCategory('rides_small');
              }}
            >
              <RideIcon />
            </Button>

            {/* More tools menu button */}
            <Button
              variant={showMenu ? 'default' : 'secondary'}
              size="icon"
              className="h-11 w-11"
              onClick={() => setShowMenu(!showMenu)}
            >
              {showMenu ? (
                <CloseIcon size={20} />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="19" cy="12" r="1" />
                  <circle cx="5" cy="12" r="1" />
                </svg>
              )}
            </Button>
          </div>
        </Card>
      </div>

      {/* Expanded Tool Menu */}
      {showMenu && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setShowMenu(false)}>
          <Card
            className="absolute bottom-20 left-2 right-2 max-h-[70vh] overflow-hidden rounded-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Park Management section at top */}
            <div className="p-3 border-b border-border flex-shrink-0">
              <T>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  Park Management
                </div>
              </T>
              <div className="grid grid-cols-4 gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-full text-xs"
                  onClick={() => { onOpenPanel('finances'); setShowMenu(false); }}
                >
                  <T>Finances</T>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-full text-xs"
                  onClick={() => { onOpenPanel('guests'); setShowMenu(false); }}
                >
                  <T>Guests</T>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-full text-xs"
                  onClick={() => { onOpenPanel('rides'); setShowMenu(false); }}
                >
                  <T>Rides</T>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-full text-xs"
                  onClick={() => { onOpenPanel('settings'); setShowMenu(false); }}
                >
                  <T>Settings</T>
                </Button>
              </div>
            </div>

            {/* Track Building Tools - shown when building a coaster */}
            {buildingCoasterType && (
              <div className="p-3 border-b border-border flex-shrink-0 bg-primary/5">
                <T>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                    Track Building
                  </div>
                </T>
                <div className="grid grid-cols-4 gap-2">
                  {TRACK_BUILD_TOOLS.map((tool) => {
                    const info = TOOL_INFO[tool];
                    if (!info) return null;
                    const isSelected = selectedTool === tool;
                    const canAfford = finances.cash >= info.cost;

                    return (
                      <Button
                        key={tool}
                        variant={isSelected ? 'default' : 'ghost'}
                        size="sm"
                        className="h-10 w-full text-xs"
                        disabled={!canAfford && info.cost > 0}
                        onClick={() => handleToolSelect(tool, false)}
                      >
                        {info.name.replace('Track: ', '').replace('Coaster ', '')}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="p-2 space-y-1 pb-4">
                {/* Category buttons */}
                {TOOL_CATEGORIES.map((category) => (
                  <div key={category.key}>
                    <Button
                      variant={expandedCategory === category.key ? 'secondary' : 'ghost'}
                      className="w-full justify-start gap-3 h-12"
                      onClick={() => handleCategoryClick(category.key)}
                    >
                      <span className="flex-1 text-left font-medium">{m(category.label)}</span>
                      <svg
                        className={`w-4 h-4 transition-transform ${expandedCategory === category.key ? 'rotate-180' : ''}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </Button>

                    {/* Expanded tools */}
                    {expandedCategory === category.key && (
                      <div className="pl-4 py-1 space-y-0.5">
                        {category.tools.map((tool) => {
                          const info = TOOL_INFO[tool];
                          if (!info) return null;
                          const isSelected = selectedTool === tool;
                          const canAfford = finances.cash >= info.cost;

                          return (
                            <Button
                              key={tool}
                              variant={isSelected ? 'default' : 'ghost'}
                              className="w-full justify-start gap-3 h-11"
                              disabled={!canAfford && info.cost > 0}
                              onClick={() => handleToolSelect(tool, true)}
                            >
                              <span className="flex-1 text-left">{info.name}</span>
                              {info.cost > 0 && (
                                <span className={`text-xs font-mono ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
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
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

export default MobileCoasterToolbar;
