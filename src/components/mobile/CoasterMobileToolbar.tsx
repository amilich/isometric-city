'use client';

import React, { useMemo, useState } from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { Tool, TOOL_INFO, ToolCategory } from '@/games/coaster/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MobileBar } from '@/components/mobile/MobileBar';
import { COASTER_TYPE_STATS, getCoasterCategory } from '@/games/coaster/types/tracks';
import {
  COASTER_TYPE_PRIMARY_COLORS,
  COASTER_TYPE_TOOL_MAP,
  TRACK_BUILD_TOOLS,
} from '@/components/coaster/coasterTooling';

const CATEGORY_LABELS: Record<ToolCategory, string> = {
  tools: 'Tools',
  paths: 'Paths',
  terrain: 'Terrain',
  coasters: 'Coasters',
  trees: 'Trees',
  flowers: 'Flowers',
  furniture: 'Furniture',
  fountains: 'Fountains',
  food: 'Food & Drink',
  shops: 'Shops & Services',
  rides_small: 'Small Rides',
  rides_large: 'Large Rides',
  theming: 'Theming',
  infrastructure: 'Infrastructure',
};

const CATEGORY_ORDER: ToolCategory[] = [
  'tools',
  'paths',
  'terrain',
  'coasters',
  'trees',
  'flowers',
  'furniture',
  'fountains',
  'food',
  'shops',
  'rides_small',
  'rides_large',
  'theming',
  'infrastructure',
];

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
    <div className="w-5 h-5 rounded-sm bg-slate-600 flex items-center justify-center text-[9px] font-bold text-white">
      P
    </div>
  ),
  queue: (
    <div className="w-5 h-5 rounded-sm bg-slate-500 flex items-center justify-center text-[9px] font-bold text-white">
      Q
    </div>
  ),
};

export function CoasterMobileToolbar() {
  const { state, setTool, setActivePanel, startCoasterBuild, cancelCoasterBuild } = useCoaster();
  const { selectedTool, finances, buildingCoasterType } = state;
  const [expandedCategory, setExpandedCategory] = useState<ToolCategory | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  const toolsByCategory = useMemo(() => {
    const map = new Map<ToolCategory, Tool[]>();
    for (const [toolKey, info] of Object.entries(TOOL_INFO)) {
      const tool = toolKey as Tool;
      const existing = map.get(info.category) ?? [];
      existing.push(tool);
      map.set(info.category, existing);
    }

    for (const tools of map.values()) {
      tools.sort((a, b) => TOOL_INFO[a].name.localeCompare(TOOL_INFO[b].name));
    }

    return map;
  }, []);

  const handleCategoryClick = (category: ToolCategory) => {
    if (expandedCategory === category) {
      setExpandedCategory(null);
    } else {
      setExpandedCategory(category);
    }
  };

  const handleToolSelect = (tool: Tool, closeMenu: boolean = false) => {
    if (selectedTool === tool && tool !== 'select') {
      setTool('select');
    } else {
      const coasterType = COASTER_TYPE_TOOL_MAP[tool];
      if (coasterType) {
        startCoasterBuild(coasterType);
        setTool('coaster_build');
      } else {
        setTool(tool);
      }
    }

    setExpandedCategory(null);
    if (closeMenu) {
      setShowMenu(false);
    }
  };

  return (
    <>
      <MobileBar position="bottom">
        {selectedTool && TOOL_INFO[selectedTool] && (
          <div className="flex items-center justify-between px-4 py-1.5 border-b border-sidebar-border/50 bg-secondary/30 text-xs">
            <span className="text-foreground font-medium">{TOOL_INFO[selectedTool].name}</span>
            {TOOL_INFO[selectedTool].cost > 0 && (
              <span className={`font-mono ${finances.cash >= TOOL_INFO[selectedTool].cost ? 'text-green-400' : 'text-red-400'}`}>
                ${TOOL_INFO[selectedTool].cost}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-around px-2 py-2 gap-1">
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

          <Button
            variant={showMenu ? 'default' : 'secondary'}
            size="icon"
            className="h-11 w-11"
            onClick={() => setShowMenu(!showMenu)}
          >
            {showMenu ? (
              <span className="text-lg">x</span>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="1" />
                <circle cx="19" cy="12" r="1" />
                <circle cx="5" cy="12" r="1" />
              </svg>
            )}
          </Button>
        </div>
      </MobileBar>

      {showMenu && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setShowMenu(false)}>
          <Card
            className="absolute bottom-20 left-2 right-2 max-h-[70vh] overflow-hidden rounded-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-border flex-shrink-0">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                Park Management
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-full text-xs"
                  onClick={() => {
                    setActivePanel('finances');
                    setShowMenu(false);
                  }}
                >
                  Finances
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-full text-xs"
                  onClick={() => {
                    setActivePanel('settings');
                    setShowMenu(false);
                  }}
                >
                  Settings
                </Button>
              </div>
            </div>

            {buildingCoasterType && (
              <div className="p-3 border-b border-border flex-shrink-0">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: COASTER_TYPE_PRIMARY_COLORS[buildingCoasterType] ?? '#dc2626' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-foreground truncate">
                      {COASTER_TYPE_STATS[buildingCoasterType]?.name ?? 'Custom Coaster'}
                    </div>
                    <div className="text-[10px] text-muted-foreground capitalize">
                      {getCoasterCategory(buildingCoasterType)} coaster
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      cancelCoasterBuild();
                      setTool('select');
                    }}
                    title="Cancel coaster build"
                  >
                    x
                  </Button>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {TRACK_BUILD_TOOLS.map((tool) => {
                    const info = TOOL_INFO[tool];
                    if (!info) return null;
                    const canAfford = finances.cash >= info.cost;
                    const isSelected = selectedTool === tool;

                    return (
                      <Button
                        key={tool}
                        variant={isSelected ? 'default' : 'ghost'}
                        size="sm"
                        className="h-10 text-[9px] leading-tight"
                        disabled={!canAfford && info.cost > 0}
                        onClick={() => handleToolSelect(tool, true)}
                      >
                        {info.name}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            <ScrollArea className="flex-1 min-h-0">
              <div className="p-2 space-y-1 pb-4">
                {CATEGORY_ORDER.map((category) => {
                  const tools = toolsByCategory.get(category);
                  if (!tools || tools.length === 0) {
                    return null;
                  }

                  return (
                    <div key={category}>
                      <Button
                        variant={expandedCategory === category ? 'secondary' : 'ghost'}
                        className="w-full justify-start gap-3 h-12"
                        onClick={() => handleCategoryClick(category)}
                      >
                        <span className="flex-1 text-left font-medium">
                          {CATEGORY_LABELS[category] || category}
                        </span>
                        <svg
                          className={`w-4 h-4 transition-transform ${expandedCategory === category ? 'rotate-180' : ''}`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </Button>

                      {expandedCategory === category && (
                        <div className="pl-4 py-1 space-y-0.5">
                          {tools.map((tool) => {
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
                  );
                })}
              </div>
            </ScrollArea>
          </Card>
        </div>
      )}
    </>
  );
}

export default CoasterMobileToolbar;
