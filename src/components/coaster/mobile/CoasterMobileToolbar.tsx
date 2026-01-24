'use client';

import React, { useState, useCallback } from 'react';
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
    <svg 
      className={`w-[${size}px] h-[${size}px]`} 
      style={{ width: size, height: size }} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2"
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

// Quick tool icons
const QuickToolIcons: Partial<Record<Tool, React.ReactNode>> = {
  select: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 4l16 8-8 3-3 8z" />
    </svg>
  ),
  bulldoze: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M6 6v14a2 2 0 002 2h8a2 2 0 002-2V6M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2" />
    </svg>
  ),
  path: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19L12 12L20 19" />
      <path d="M4 12L12 5L20 12" />
    </svg>
  ),
  queue: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h16v16H4z" strokeDasharray="4 2" />
    </svg>
  ),
};

// =============================================================================
// TOOL CATEGORIES
// =============================================================================

// Submenu categories matching the sidebar
const SUBMENU_CATEGORIES: { key: string; label: string; tools: Tool[] }[] = [
  {
    key: 'paths',
    label: 'Paths',
    tools: ['path', 'queue'],
  },
  {
    key: 'terrain',
    label: 'Terrain',
    tools: ['zone_water', 'zone_land'],
  },
  {
    key: 'trees',
    label: 'Trees',
    tools: [
      'tree_oak', 'tree_maple', 'tree_pine', 'tree_palm', 'tree_cherry',
      'bush_hedge', 'bush_flowering', 'topiary_ball',
    ],
  },
  {
    key: 'flowers',
    label: 'Flowers',
    tools: ['flowers_bed', 'flowers_planter', 'flowers_wild', 'ground_cover'],
  },
  {
    key: 'furniture',
    label: 'Furniture',
    tools: [
      'bench_wooden', 'bench_metal', 'bench_ornate',
      'lamp_victorian', 'lamp_modern', 'lamp_pathway',
      'trash_can_basic', 'trash_can_fancy',
    ],
  },
  {
    key: 'fountains',
    label: 'Fountains',
    tools: [
      'fountain_small_1', 'fountain_small_2', 'fountain_small_3',
      'fountain_medium_1', 'fountain_medium_2', 'fountain_medium_3',
      'fountain_large_1', 'fountain_large_2', 'fountain_large_3',
      'pond_small', 'pond_medium', 'pond_koi',
      'splash_pad', 'water_jets', 'dancing_fountain',
    ],
  },
  {
    key: 'food',
    label: 'Food & Drink',
    tools: [
      'food_hotdog', 'food_burger', 'food_fries', 'food_corndog', 'food_pretzel',
      'food_icecream', 'food_cotton_candy', 'food_candy_apple', 'food_churros', 'food_funnel_cake',
      'drink_soda', 'drink_lemonade', 'drink_smoothie', 'drink_coffee', 'drink_slushie',
      'snack_popcorn', 'snack_nachos', 'snack_pizza', 'snack_cookies', 'snack_donuts',
      'food_tacos', 'food_noodles', 'food_kebab', 'food_crepes', 'food_waffles',
      'cart_pirate', 'cart_space', 'cart_medieval', 'cart_western', 'cart_tropical',
    ],
  },
  {
    key: 'shops',
    label: 'Shops & Services',
    tools: [
      'shop_souvenir', 'shop_emporium', 'shop_photo', 'shop_ticket', 'shop_collectibles',
      'shop_toys', 'shop_plush', 'shop_apparel', 'shop_bricks', 'shop_rc',
      'shop_candy', 'shop_fudge', 'shop_jewelry', 'shop_popcorn_shop', 'shop_soda_fountain',
      'game_ring_toss', 'game_balloon', 'game_shooting', 'game_darts', 'game_basketball',
      'arcade_building', 'vr_experience', 'photo_booth', 'caricature', 'face_paint',
      'restroom', 'first_aid', 'lockers', 'stroller_rental', 'atm',
    ],
  },
  {
    key: 'rides_small',
    label: 'Small Rides',
    tools: [
      'ride_kiddie_coaster', 'ride_kiddie_train', 'ride_kiddie_planes', 'ride_kiddie_boats', 'ride_kiddie_cars',
      'ride_teacups', 'ride_scrambler', 'ride_tilt_a_whirl', 'ride_spinning_apples', 'ride_whirlwind',
      'ride_carousel', 'ride_antique_cars', 'ride_monorail_car', 'ride_sky_ride_car', 'ride_train_car',
      'ride_bumper_cars', 'ride_go_karts', 'ride_simulator', 'ride_motion_theater', 'ride_4d_theater',
      'ride_bumper_boats', 'ride_paddle_boats', 'ride_lazy_river', 'ride_water_play', 'ride_splash_zone',
      'ride_haunted_house', 'ride_ghost_train', 'ride_dark_ride', 'ride_tunnel', 'ride_themed_facade',
    ],
  },
  {
    key: 'rides_large',
    label: 'Large Rides',
    tools: [
      'ride_ferris_classic', 'ride_ferris_modern', 'ride_ferris_observation', 'ride_ferris_double', 'ride_ferris_led',
      'ride_drop_tower', 'ride_space_shot', 'ride_observation_tower', 'ride_sky_swing', 'ride_star_flyer',
      'ride_swing_ride', 'ride_wave_swinger', 'ride_flying_scooters', 'ride_enterprise', 'ride_loop_o_plane',
      'ride_top_spin', 'ride_frisbee', 'ride_afterburner', 'ride_inversion', 'ride_meteorite',
      'ride_log_flume', 'ride_rapids', 'ride_train_station', 'ride_monorail_station', 'ride_chairlift',
      'show_4d', 'show_stunt', 'show_dolphin', 'show_amphitheater', 'show_parade_float',
    ],
  },
  {
    key: 'coasters_wooden',
    label: 'Wooden Coasters',
    tools: [
      'coaster_type_wooden_classic',
      'coaster_type_wooden_twister',
    ],
  },
  {
    key: 'coasters_steel',
    label: 'Steel Coasters',
    tools: [
      'coaster_type_steel_sit_down',
      'coaster_type_steel_standup',
      'coaster_type_steel_inverted',
      'coaster_type_steel_floorless',
      'coaster_type_steel_wing',
      'coaster_type_steel_flying',
      'coaster_type_steel_4d',
      'coaster_type_steel_spinning',
      'coaster_type_launch_coaster',
      'coaster_type_hyper_coaster',
      'coaster_type_giga_coaster',
    ],
  },
  {
    key: 'coasters_water',
    label: 'Water Coasters',
    tools: [
      'coaster_type_water_coaster',
    ],
  },
  {
    key: 'coasters_specialty',
    label: 'Specialty Coasters',
    tools: [
      'coaster_type_mine_train',
      'coaster_type_bobsled',
      'coaster_type_suspended',
    ],
  },
  {
    key: 'infrastructure',
    label: 'Infrastructure',
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

// Primary colors for each coaster type
const COASTER_TYPE_PRIMARY_COLORS: Record<string, string> = {
  wooden_classic: '#8B4513',
  wooden_twister: '#A0522D',
  steel_sit_down: '#dc2626',
  steel_standup: '#7c3aed',
  steel_inverted: '#2563eb',
  steel_floorless: '#059669',
  steel_wing: '#ea580c',
  steel_flying: '#0891b2',
  steel_4d: '#be123c',
  steel_spinning: '#65a30d',
  launch_coaster: '#e11d48',
  hyper_coaster: '#0d9488',
  giga_coaster: '#4f46e5',
  water_coaster: '#0ea5e9',
  mine_train: '#92400e',
  bobsled: '#1d4ed8',
  suspended: '#b45309',
};

// =============================================================================
// COASTER TRACK TOOLS PANEL
// =============================================================================

interface CoasterTrackToolsProps {
  onClose: () => void;
}

function CoasterTrackToolsPanel({ onClose }: CoasterTrackToolsProps) {
  const { state, setTool, cancelCoasterBuild } = useCoaster();
  const { selectedTool, finances, buildingCoasterType } = state;
  
  const trackTools: Tool[] = [
    'coaster_build', 'coaster_track', 'coaster_turn_left', 'coaster_turn_right',
    'coaster_slope_up', 'coaster_slope_down', 'coaster_loop', 'coaster_station'
  ];
  
  if (!buildingCoasterType) return null;
  
  return (
    <Card className="absolute bottom-20 left-2 right-2 rounded-xl overflow-hidden z-50">
      {/* Header with coaster type */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-primary/10">
        <div className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: COASTER_TYPE_PRIMARY_COLORS[buildingCoasterType] ?? '#dc2626' }}
          />
          <div>
            <div className="text-xs font-medium text-primary">
              {COASTER_TYPE_STATS[buildingCoasterType]?.name ?? 'Custom Coaster'}
            </div>
            <div className="text-[10px] text-muted-foreground capitalize">
              {getCoasterCategory(buildingCoasterType)} coaster
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            cancelCoasterBuild();
            setTool('select');
            onClose();
          }}
          className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
        >
          Cancel
        </Button>
      </div>
      
      {/* Track tools grid */}
      <div className="p-2 grid grid-cols-4 gap-1">
        {trackTools.map(tool => {
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
              className={`h-auto py-2 px-1 flex flex-col items-center gap-0.5 text-[10px] ${
                isSelected ? 'bg-primary text-primary-foreground' : ''
              }`}
              title={info.description}
            >
              <span className="truncate w-full text-center">{info.name.replace('Track: ', '')}</span>
              {info.cost > 0 && (
                <span className={`text-[9px] ${isSelected ? 'opacity-80' : 'opacity-50'}`}>
                  ${info.cost}
                </span>
              )}
            </Button>
          );
        })}
      </div>
    </Card>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface CoasterMobileToolbarProps {
  onOpenPanel: (panel: 'finances' | 'settings') => void;
}

export function CoasterMobileToolbar({ onOpenPanel }: CoasterMobileToolbarProps) {
  const { state, setTool, startCoasterBuild } = useCoaster();
  const { selectedTool, finances, buildingCoasterType } = state;
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  const handleCategoryClick = (category: string) => {
    if (expandedCategory === category) {
      setExpandedCategory(null);
    } else {
      setExpandedCategory(category);
    }
  };

  const handleToolSelect = useCallback((tool: Tool, closeMenu: boolean = false) => {
    // Check if this is a coaster type selection tool
    const coasterType = COASTER_TYPE_TOOL_MAP[tool];
    if (coasterType) {
      startCoasterBuild(coasterType);
      setTool('coaster_build');
    } else if (selectedTool === tool && tool !== 'select') {
      setTool('select');
    } else {
      setTool(tool);
    }
    setExpandedCategory(null);
    if (closeMenu) {
      setShowMenu(false);
    }
  }, [selectedTool, setTool, startCoasterBuild]);

  return (
    <>
      {/* Coaster Track Tools Panel - shown when building a coaster */}
      {buildingCoasterType && (
        <CoasterTrackToolsPanel onClose={() => {}} />
      )}
      
      {/* Bottom Toolbar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
        <Card className="rounded-none border-x-0 border-b-0 bg-card/95 backdrop-blur-sm">
          {/* Selected tool info - now above the toolbar */}
          {selectedTool && TOOL_INFO[selectedTool] && !buildingCoasterType && (
            <div className="flex items-center justify-between px-4 py-1.5 border-b border-sidebar-border/50 bg-secondary/30 text-xs">
              <span className="text-foreground font-medium">
                {TOOL_INFO[selectedTool].name}
              </span>
              {TOOL_INFO[selectedTool].cost > 0 && (
                <span className={`font-mono ${finances.cash >= TOOL_INFO[selectedTool].cost ? 'text-green-400' : 'text-red-400'}`}>
                  ${TOOL_INFO[selectedTool].cost}
                </span>
              )}
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
              {QuickToolIcons.select}
            </Button>

            <Button
              variant={selectedTool === 'bulldoze' ? 'default' : 'ghost'}
              size="icon"
              className="h-11 w-11 text-red-400"
              onClick={() => handleToolSelect('bulldoze')}
            >
              {QuickToolIcons.bulldoze}
            </Button>

            <Button
              variant={selectedTool === 'path' ? 'default' : 'ghost'}
              size="icon"
              className="h-11 w-11"
              onClick={() => handleToolSelect('path')}
            >
              {QuickToolIcons.path}
            </Button>

            <Button
              variant={selectedTool === 'queue' ? 'default' : 'ghost'}
              size="icon"
              className="h-11 w-11"
              onClick={() => handleToolSelect('queue')}
            >
              {QuickToolIcons.queue}
            </Button>

            {/* Coaster quick access */}
            <Button
              variant={buildingCoasterType ? 'default' : 'ghost'}
              size="icon"
              className="h-11 w-11"
              onClick={() => {
                if (!buildingCoasterType) {
                  // Open menu to coasters section
                  setShowMenu(true);
                  setExpandedCategory('coasters_steel');
                }
              }}
            >
              <span className="text-lg">🎢</span>
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
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                Park Management
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-full text-xs"
                  onClick={() => { onOpenPanel('finances'); setShowMenu(false); }}
                >
                  Finances
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-full text-xs"
                  onClick={() => { onOpenPanel('settings'); setShowMenu(false); }}
                >
                  Settings
                </Button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="p-2 space-y-1 pb-4">
                {/* Category buttons */}
                {SUBMENU_CATEGORIES.map((category) => (
                  <div key={category.key}>
                    <Button
                      variant={expandedCategory === category.key ? 'secondary' : 'ghost'}
                      className="w-full justify-start gap-3 h-12"
                      onClick={() => handleCategoryClick(category.key)}
                    >
                      <span className="flex-1 text-left font-medium">{category.label}</span>
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
                          const canAfford = finances.cash >= info.cost;

                          return (
                            <Button
                              key={tool}
                              variant={selectedTool === tool ? 'default' : 'ghost'}
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

export default CoasterMobileToolbar;
