'use client';

import React, { useMemo } from 'react';
import { T, msg, useMessages, useGT } from 'gt-next';
import { useCoaster } from '@/context/CoasterContext';
import { COASTER_TOOL_INFO, CoasterTool } from '@/games/coaster/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Coins, Ticket, Users, Settings } from 'lucide-react';

const CATEGORY_LABELS: Record<string, unknown> = {
  tools: msg('Tools'),
  paths: msg('Paths'),
  coasters: msg('Coasters'),
  flat: msg('Flat Rides'),
  water: msg('Water Rides'),
  stalls: msg('Stalls & Facilities'),
  scenery: msg('Scenery'),
  staff: msg('Staff'),
};

const PANEL_LABELS: Record<string, unknown> = {
  finances: msg('Finances'),
  rides: msg('Rides'),
  guests: msg('Guests'),
  settings: msg('Settings'),
};

export function CoasterSidebar() {
  const { state, setTool, setActivePanel } = useCoaster();
  const { selectedTool, finance, activePanel } = state;
  const m = useMessages();
  const gt = useGT();

  const categories = useMemo(
    () => [
      { key: 'tools', tools: ['select', 'bulldoze'] as CoasterTool[] },
      { key: 'paths', tools: ['path', 'queue'] as CoasterTool[] },
      {
        key: 'coasters',
        tools: [
          'coaster_track',
          'coaster_station',
          'coaster_lift',
          'coaster_brakes',
          'coaster_booster',
          'coaster_loop',
          'coaster_corkscrew',
        ] as CoasterTool[],
      },
      { key: 'flat', tools: ['carousel', 'ferris_wheel', 'swing_ride', 'junior_coaster', 'scrambler'] as CoasterTool[] },
      { key: 'water', tools: ['log_flume'] as CoasterTool[] },
      { key: 'stalls', tools: ['food_stall', 'drink_stall', 'souvenir_stall', 'toilet', 'information'] as CoasterTool[] },
      { key: 'scenery', tools: ['tree', 'bench', 'lamp', 'fence'] as CoasterTool[] },
      { key: 'staff', tools: ['staff_handyman', 'staff_mechanic', 'staff_security', 'staff_entertainer'] as CoasterTool[] },
    ],
    []
  );

  return (
    <div className="w-56 bg-sidebar border-r border-sidebar-border flex flex-col h-screen fixed left-0 top-0 z-40">
      <div className="px-4 py-4 border-b border-sidebar-border">
        <T><div className="text-sidebar-foreground font-bold tracking-tight">COASTER PARK</div></T>
      </div>

      <ScrollArea className="flex-1 py-2">
        {categories.map((category) => (
          <div key={category.key} className="mb-2">
            <div className="px-4 py-2 text-[10px] font-bold tracking-widest text-muted-foreground">
              {m(CATEGORY_LABELS[category.key] as Parameters<typeof m>[0])}
            </div>
            <div className="px-2 flex flex-col gap-0.5">
              {category.tools.map((tool) => {
                const info = COASTER_TOOL_INFO[tool];
                const isSelected = selectedTool === tool;
                const canAfford = finance.money >= info.cost;

                return (
                  <Button
                    key={tool}
                    onClick={() => setTool(tool)}
                    disabled={!canAfford && info.cost > 0}
                    variant={isSelected ? 'default' : 'ghost'}
                    className={`w-full justify-start gap-3 px-3 py-2 h-auto text-sm ${
                      isSelected ? 'bg-primary text-primary-foreground' : ''
                    }`}
                    title={info.cost > 0 ? gt('{description} - Cost: ${cost}', { description: m(info.description), cost: info.cost }) : m(info.description)}
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
        <div className="grid grid-cols-4 gap-1">
          {[
            { panel: 'finances' as const, icon: <Coins className="w-4 h-4" /> },
            { panel: 'rides' as const, icon: <Ticket className="w-4 h-4" /> },
            { panel: 'guests' as const, icon: <Users className="w-4 h-4" /> },
            { panel: 'settings' as const, icon: <Settings className="w-4 h-4" /> },
          ].map(({ panel, icon }) => (
            <Button
              key={panel}
              onClick={() => setActivePanel(activePanel === panel ? 'none' : panel)}
              variant={activePanel === panel ? 'default' : 'ghost'}
              size="icon-sm"
              className="w-full"
              title={m(PANEL_LABELS[panel] as Parameters<typeof m>[0])}
            >
              {icon}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
