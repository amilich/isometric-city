'use client';

import React, { useState } from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { Tool, TOOL_INFO } from '@/games/coaster/types';
import { COASTER_TYPE_STATS, getCoasterCategory } from '@/games/coaster/types/tracks';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  COASTER_TYPE_PRIMARY_COLORS,
  COASTER_TYPE_TOOL_MAP,
  COASTER_TRACK_TOOLS,
  SUBMENU_CATEGORIES,
} from '@/components/coaster/tooling';
import { CloseIcon, SelectIcon, BulldozeIcon, RoadIcon } from '@/components/ui/Icons';

function QueueIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h10M4 12h10M4 18h10" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="18" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  );
}

interface MobileToolbarProps {
  onOpenPanel: (panel: 'finances' | 'settings') => void;
}

export function MobileToolbar({ onOpenPanel }: MobileToolbarProps) {
  const { state, setTool, startCoasterBuild, cancelCoasterBuild } = useCoaster();
  const { selectedTool, finances, buildingCoasterType } = state;
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  const handleToolSelect = (tool: Tool, closeMenu: boolean = false) => {
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
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
        <Card className="rounded-none border-x-0 border-b-0 bg-card/95 backdrop-blur-sm">
          {selectedTool && TOOL_INFO[selectedTool] && (
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
            <Button
              variant={selectedTool === 'select' ? 'default' : 'ghost'}
              size="icon"
              className="h-11 w-11"
              onClick={() => handleToolSelect('select')}
            >
              <SelectIcon size={20} />
            </Button>

            <Button
              variant={selectedTool === 'bulldoze' ? 'default' : 'ghost'}
              size="icon"
              className="h-11 w-11 text-red-400"
              onClick={() => handleToolSelect('bulldoze')}
            >
              <BulldozeIcon size={20} />
            </Button>

            <Button
              variant={selectedTool === 'path' ? 'default' : 'ghost'}
              size="icon"
              className="h-11 w-11"
              onClick={() => handleToolSelect('path')}
            >
              <RoadIcon size={20} />
            </Button>

            <Button
              variant={selectedTool === 'queue' ? 'default' : 'ghost'}
              size="icon"
              className="h-11 w-11"
              onClick={() => handleToolSelect('queue')}
            >
              <QueueIcon />
            </Button>

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
                    onOpenPanel('finances');
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
                    onOpenPanel('settings');
                    setShowMenu(false);
                  }}
                >
                  Settings
                </Button>
              </div>
            </div>

            {buildingCoasterType && (
              <div className="p-3 border-b border-border flex-shrink-0 bg-secondary/20">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: COASTER_TYPE_PRIMARY_COLORS[buildingCoasterType] ?? '#dc2626' }}
                  />
                  <div className="flex-1">
                    <div className="text-xs font-medium">
                      {COASTER_TYPE_STATS[buildingCoasterType]?.name ?? 'Custom Coaster'}
                    </div>
                    <div className="text-[10px] text-muted-foreground capitalize">
                      {getCoasterCategory(buildingCoasterType)} coaster
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      cancelCoasterBuild();
                      setTool('select');
                    }}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    title="Cancel coaster build"
                  >
                    x
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {COASTER_TRACK_TOOLS.map((tool) => {
                    const info = TOOL_INFO[tool];
                    if (!info) return null;
                    const canAfford = finances.cash >= info.cost;
                    return (
                      <Button
                        key={tool}
                        variant={selectedTool === tool ? 'default' : 'ghost'}
                        size="sm"
                        className="h-9 text-xs justify-between"
                        disabled={!canAfford && info.cost > 0}
                        onClick={() => handleToolSelect(tool)}
                      >
                        <span className="truncate">{info.name}</span>
                        {info.cost > 0 && (
                          <span className={`text-[10px] ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
                            ${info.cost}
                          </span>
                        )}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="p-2 space-y-1 pb-4">
                {SUBMENU_CATEGORIES.map((category) => (
                  <div key={category.key}>
                    <Button
                      variant={expandedCategory === category.key ? 'secondary' : 'ghost'}
                      className="w-full justify-start gap-3 h-12"
                      onClick={() => {
                        setExpandedCategory(expandedCategory === category.key ? null : category.key);
                      }}
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
                              <span className="flex-1 text-left truncate">{info.name}</span>
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

export default MobileToolbar;
