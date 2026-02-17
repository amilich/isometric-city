'use client';

import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTower } from '@/context/TowerContext';
import { TOOL_INFO, type Tool } from '@/games/tower/types';
import { Settings, BarChart3 } from 'lucide-react';

function ToolPill({ tool }: { tool: Tool }) {
  const { state, setTool } = useTower();
  const selected = state.selectedTool === tool;
  const info = TOOL_INFO[tool];
  const disabled = info.cost > 0 && state.money < info.cost;

  const short = useMemo(() => {
    if (tool === 'select') return 'Sel';
    if (tool === 'bulldoze') return 'Sell';
    if (tool.startsWith('tower_')) return info.name.replace(' Tower', '').slice(0, 6);
    return info.name.slice(0, 6);
  }, [tool, info.name]);

  return (
    <Button
      onClick={() => setTool(tool)}
      disabled={disabled}
      variant={selected ? 'default' : 'ghost'}
      className={`h-10 px-3 rounded-md whitespace-nowrap ${selected ? '' : 'bg-white/5 hover:bg-white/10'}`}
      title={info.description + (info.cost > 0 ? ` ($${info.cost})` : '')}
    >
      <span className="text-xs font-medium">{short}</span>
    </Button>
  );
}

export function TowerMobileToolbar() {
  const { state, setActivePanel } = useTower();

  const tools = useMemo(
    () => ['select', 'bulldoze', 'tower_cannon', 'tower_archer', 'tower_tesla', 'tower_ice', 'tower_mortar', 'tower_sniper'] as Tool[],
    []
  );

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-30"
      style={{
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
      }}
    >
      <Card className="bg-slate-950/90 border-slate-700 shadow-xl">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex-1 overflow-x-auto overscroll-x-contain">
            <div className="flex items-center gap-2 pr-2 w-max">
              {tools.map((t) => (
                <ToolPill key={t} tool={t} />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1 pl-1">
            <Button
              variant={state.activePanel === 'stats' ? 'default' : 'ghost'}
              size="icon"
              className="h-10 w-10"
              onClick={() => setActivePanel(state.activePanel === 'stats' ? 'none' : 'stats')}
              title="Stats"
            >
              <BarChart3 className="w-4 h-4" />
            </Button>
            <Button
              variant={state.activePanel === 'settings' ? 'default' : 'ghost'}
              size="icon"
              className="h-10 w-10"
              onClick={() => setActivePanel(state.activePanel === 'settings' ? 'none' : 'settings')}
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

