'use client';

import React, { useMemo } from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { CoasterTool, TOOL_INFO } from '@/games/coaster/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { T, msg, useMessages, useGT } from 'gt-next';

type ToolGroup = {
  label: string;
  tools: CoasterTool[];
};

const TOOL_GROUP_LABELS = {
  tools: msg('Tools'),
  scenery: msg('Scenery'),
  rides: msg('Rides'),
  shops: msg('Shops'),
};

export default function CoasterSidebar() {
  const { state, setTool, setActivePanel } = useCoaster();
  const { selectedTool, finance, activePanel } = state;
  const m = useMessages();
  const gt = useGT();

  const toolGroups = useMemo<ToolGroup[]>(() => [
    { label: TOOL_GROUP_LABELS.tools, tools: ['select', 'path', 'queue_path', 'coaster_track', 'bulldoze', 'water'] },
    { label: TOOL_GROUP_LABELS.scenery, tools: ['scenery_tree', 'scenery_flower'] },
    { label: TOOL_GROUP_LABELS.rides, tools: ['ride_carousel', 'ride_ferris_wheel', 'ride_bumper_cars', 'ride_swing', 'ride_haunted_house', 'ride_spiral_slide'] },
    { label: TOOL_GROUP_LABELS.shops, tools: ['shop_food', 'shop_drink', 'shop_toilet'] },
  ], []);

  return (
    <div className="w-56 bg-sidebar border-r border-sidebar-border flex flex-col h-full">
      <div className="px-4 py-4 border-b border-sidebar-border">
        <T>
          <div className="text-sidebar-foreground font-bold tracking-tight">COASTER PARK</div>
          <div className="text-xs text-muted-foreground mt-1">Theme Park Tools</div>
        </T>
      </div>
      <ScrollArea className="flex-1 py-2">
        {toolGroups.map((group) => (
          <div key={group.label} className="mb-4">
            <div className="px-4 py-2 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
              {m(group.label)}
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
      </ScrollArea>
      <div className="border-t border-sidebar-border p-2">
        <Button
          variant={activePanel === 'finance' ? 'default' : 'ghost'}
          className="w-full justify-start"
          onClick={() => setActivePanel(activePanel === 'finance' ? 'none' : 'finance')}
        >
          {gt('Finance')}
        </Button>
      </div>
    </div>
  );
}
