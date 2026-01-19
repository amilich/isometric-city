'use client';

import React, { useMemo } from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { CoasterTool, TOOL_INFO } from '@/games/coaster/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

type ToolGroup = {
  label: string;
  tools: CoasterTool[];
};

export default function CoasterSidebar() {
  const { state, setTool, setActivePanel } = useCoaster();
  const { selectedTool, finance, activePanel } = state;

  const researchUnlocks = useMemo(
    () => new Map(state.research.items.map((item) => [item.id, item.unlocked])),
    [state.research.items]
  );

  const toolUnlocks = useMemo<Partial<Record<CoasterTool, string>>>(() => ({
    ride_coaster_wooden: 'coaster_wooden',
    ride_coaster_steel: 'coaster_steel',
  }), []);

  const toolGroups = useMemo<ToolGroup[]>(() => [
    { label: 'Tools', tools: ['select', 'path', 'queue_path', 'terrain_raise', 'terrain_lower', 'terrain_smooth', 'coaster_track', 'bulldoze', 'water'] },
    { label: 'Scenery', tools: ['scenery_tree', 'scenery_flower', 'scenery_bench', 'scenery_shrub', 'scenery_lamp', 'scenery_statue', 'scenery_fountain', 'scenery_trash_can', 'scenery_fence'] },
    { label: 'Rides', tools: ['ride_carousel', 'ride_ferris_wheel', 'ride_bumper_cars', 'ride_swing', 'ride_haunted_house', 'ride_spiral_slide', 'ride_coaster_wooden', 'ride_coaster_steel'] },
    { label: 'Shops', tools: ['shop_food', 'shop_drink', 'shop_ice_cream', 'shop_souvenir', 'shop_info', 'shop_atm', 'shop_first_aid', 'shop_toilet', 'shop_staff_room'] },
  ], []);

  return (
    <div className="w-56 bg-sidebar border-r border-sidebar-border flex flex-col h-full">
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="text-sidebar-foreground font-bold tracking-tight">COASTER PARK</div>
        <div className="text-xs text-muted-foreground mt-1">Theme Park Tools</div>
      </div>
      <ScrollArea className="flex-1 py-2 pb-10">
        {toolGroups.map((group) => (
          <div key={group.label} className="mb-4">
            <div className="px-4 py-2 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
              {group.label}
            </div>
            <div className="px-2 flex flex-col gap-0.5">
              {group.tools.map((tool) => {
                const info = TOOL_INFO[tool];
                const isSelected = selectedTool === tool;
                const canAfford = finance.cash >= info.cost;
                const unlockKey = toolUnlocks[tool];
                const isUnlocked = unlockKey ? researchUnlocks.get(unlockKey) : true;
                const isDisabled = (!canAfford && info.cost > 0) || !isUnlocked;
                const costLabel = !isUnlocked ? 'Research' : info.cost > 0 ? `$${info.cost}` : '';
                return (
                  <Button
                    key={tool}
                    onClick={() => setTool(tool)}
                    disabled={isDisabled}
                    variant={isSelected ? 'default' : 'ghost'}
                    className={`w-full justify-start gap-2 px-3 py-2 h-auto text-sm ${
                      isSelected ? 'bg-primary text-primary-foreground' : ''
                    }`}
                  >
                    <span className="flex-1 text-left truncate">{info.name}</span>
                    {costLabel && (
                      <span className="text-xs opacity-60">{costLabel}</span>
                    )}
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
        <div className="mt-2 mb-4">
          <div className="px-4 py-2 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
            Management
          </div>
          <div className="px-2 flex flex-col gap-1">
            <Button
              variant={activePanel === 'park' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => setActivePanel(activePanel === 'park' ? 'none' : 'park')}
            >
              Park Overview
            </Button>
            <Button
              variant={activePanel === 'rides' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => setActivePanel(activePanel === 'rides' ? 'none' : 'rides')}
            >
              Ride Ops
            </Button>
            <Button
              variant={activePanel === 'shops' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => setActivePanel(activePanel === 'shops' ? 'none' : 'shops')}
            >
              Shop Ops
            </Button>
            <Button
              variant={activePanel === 'finance' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => setActivePanel(activePanel === 'finance' ? 'none' : 'finance')}
            >
              Finance
            </Button>
            <Button
              variant={activePanel === 'guests' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => setActivePanel(activePanel === 'guests' ? 'none' : 'guests')}
            >
              Guests
            </Button>
            <Button
              variant={activePanel === 'staff' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => setActivePanel(activePanel === 'staff' ? 'none' : 'staff')}
            >
              Staff
            </Button>
            <Button
              variant={activePanel === 'research' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => setActivePanel(activePanel === 'research' ? 'none' : 'research')}
            >
              Research
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
