'use client';

import React, { useMemo } from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { CoasterTool, TOOL_INFO } from '@/games/coaster/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { T, useGT, useMessages } from 'gt-next';

type ToolGroup = {
  label: string;
  tools: CoasterTool[];
};

export default function CoasterSidebar() {
  const { state, setTool, setActivePanel } = useCoaster();
  const { selectedTool, finance, activePanel } = state;
  const gt = useGT();
  const m = useMessages();

  const toolGroups = useMemo<ToolGroup[]>(() => [
    { label: gt('Tools'), tools: ['select', 'path', 'queue_path', 'coaster_track', 'bulldoze', 'water'] },
    { label: gt('Scenery'), tools: ['scenery_tree', 'scenery_flower'] },
    { label: gt('Rides'), tools: ['ride_carousel', 'ride_ferris_wheel', 'ride_bumper_cars', 'ride_swing', 'ride_haunted_house', 'ride_spiral_slide'] },
    { label: gt('Shops'), tools: ['shop_food', 'shop_drink', 'shop_toilet'] },
  ], [gt]);

  return (
    <div className="w-56 bg-sidebar border-r border-sidebar-border flex flex-col h-full">
      <div className="px-4 py-4 border-b border-sidebar-border">
        <T>
          <div className="text-sidebar-foreground font-bold tracking-tight">COASTER PARK</div>
          <div className="text-xs text-muted-foreground mt-1">Theme Park Tools</div>
        </T>
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
                return (
                  <Button
                    key={tool}
                    onClick={() => setTool(tool)}
                    disabled={!canAfford && info.cost > 0}
                    variant={isSelected ? 'default' : 'ghost'}
                    className={`w-full justify-start gap-2 px-3 py-2 h-auto text-sm ${
                      isSelected ? 'bg-primary text-primary-foreground' : ''
                    }`}
                  >
                    <span className="flex-1 text-left truncate">{m(info.name)}</span>
                    {info.cost > 0 && (
                      <span className="text-xs opacity-60">${info.cost}</span>
                    )}
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
        <div className="mt-2 mb-4">
          <div className="px-4 py-2 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
            <T>Management</T>
          </div>
          <div className="px-2 flex flex-col gap-1">
            <Button
              variant={activePanel === 'park' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => setActivePanel(activePanel === 'park' ? 'none' : 'park')}
            >
              <T>Park Overview</T>
            </Button>
            <Button
              variant={activePanel === 'rides' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => setActivePanel(activePanel === 'rides' ? 'none' : 'rides')}
            >
              <T>Ride Ops</T>
            </Button>
            <Button
              variant={activePanel === 'finance' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => setActivePanel(activePanel === 'finance' ? 'none' : 'finance')}
            >
              <T>Finance</T>
            </Button>
            <Button
              variant={activePanel === 'guests' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => setActivePanel(activePanel === 'guests' ? 'none' : 'guests')}
            >
              <T>Guests</T>
            </Button>
            <Button
              variant={activePanel === 'staff' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => setActivePanel(activePanel === 'staff' ? 'none' : 'staff')}
            >
              <T>Staff</T>
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
