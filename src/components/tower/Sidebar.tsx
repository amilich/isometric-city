'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTower } from '@/context/TowerContext';
import { TOOL_INFO, type Tool } from '@/games/tower/types';
import { Settings, BarChart3, LogOut } from 'lucide-react';
import { T, useGT } from 'gt-next';

const HoverSubmenu = React.memo(function HoverSubmenu({
  label,
  tools,
  selectedTool,
  money,
  onSelectTool,
  forceOpenUpward = false,
}: {
  label: string;
  tools: Tool[];
  selectedTool: Tool;
  money: number;
  onSelectTool: (tool: Tool) => void;
  forceOpenUpward?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, buttonHeight: 0, openUpward: false });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMousePos = useRef<{ x: number; y: number } | null>(null);

  const hasSelectedTool = tools.includes(selectedTool);
  const SUBMENU_GAP = 12;
  const SUBMENU_MAX_HEIGHT = 240;

  const clearCloseTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    clearCloseTimeout();
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.top;
      const openUpward = forceOpenUpward || (spaceBelow < SUBMENU_MAX_HEIGHT && rect.top > SUBMENU_MAX_HEIGHT);

      setMenuPosition({
        top: openUpward ? rect.bottom : rect.top,
        left: rect.right + SUBMENU_GAP,
        buttonHeight: rect.height,
        openUpward,
      });
    }
    setIsOpen(true);
  }, [clearCloseTimeout, forceOpenUpward]);

  const isMovingTowardSubmenu = useCallback((e: React.MouseEvent) => {
    if (!lastMousePos.current || !submenuRef.current) return false;
    const rect = submenuRef.current.getBoundingClientRect();
    const movingRight = e.clientX > lastMousePos.current.x;
    const padding = 50;
    const withinVertical =
      e.clientY >= rect.top - padding && e.clientY <= rect.bottom + padding;
    return movingRight && withinVertical;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent) => {
      const delay = isMovingTowardSubmenu(e) ? 300 : 120;
      clearCloseTimeout();
      timeoutRef.current = setTimeout(() => setIsOpen(false), delay);
    },
    [clearCloseTimeout, isMovingTowardSubmenu]
  );

  const handleSubmenuEnter = useCallback(() => clearCloseTimeout(), [clearCloseTimeout]);

  const handleSubmenuLeave = useCallback(() => {
    clearCloseTimeout();
    timeoutRef.current = setTimeout(() => setIsOpen(false), 100);
  }, [clearCloseTimeout]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className="relative" onMouseEnter={handleMouseEnter} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <Button
        ref={buttonRef}
        variant={hasSelectedTool ? 'default' : 'ghost'}
        className={`w-full justify-between gap-2 px-3 py-2.5 h-auto text-sm transition-all duration-200 ${
          isOpen ? 'bg-muted/80' : ''
        } ${hasSelectedTool ? 'bg-primary text-primary-foreground' : ''}`}
      >
        <span className="font-medium">{label}</span>
        <svg className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Button>

      {isOpen && (
        <div
          className="fixed"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left - SUBMENU_GAP}px`,
            width: `${SUBMENU_GAP + 8}px`,
            height: `${Math.max(menuPosition.buttonHeight, 220)}px`,
            zIndex: 9998,
          }}
          onMouseEnter={handleSubmenuEnter}
          onMouseLeave={handleSubmenuLeave}
        />
      )}

      {isOpen && (
        <div
          ref={submenuRef}
          className="fixed w-52 bg-sidebar backdrop-blur-sm border border-sidebar-border rounded-md shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
          style={{
            zIndex: 9999,
            ...(menuPosition.openUpward ? { bottom: `${window.innerHeight - menuPosition.top}px` } : { top: `${menuPosition.top}px` }),
            left: `${menuPosition.left}px`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(96,165,250,0.1)',
          }}
          onMouseEnter={handleSubmenuEnter}
          onMouseLeave={handleSubmenuLeave}
        >
          <div className="px-3 py-2 border-b border-sidebar-border/50 bg-muted/30">
            <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">{label}</span>
          </div>
          <div className="p-1.5 flex flex-col gap-0.5 max-h-52 overflow-y-auto">
            {tools.map((tool) => {
              const info = TOOL_INFO[tool];
              const isSelected = selectedTool === tool;
              const canAfford = money >= info.cost;
              return (
                <Button
                  key={tool}
                  onClick={() => onSelectTool(tool)}
                  disabled={!canAfford && info.cost > 0}
                  variant={isSelected ? 'default' : 'ghost'}
                  className={`w-full justify-start gap-2 px-3 py-2 h-auto text-sm transition-all duration-150 ${
                    isSelected ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted/60'
                  }`}
                  title={`${info.description}${info.cost > 0 ? ` — $${info.cost}` : ''}`}
                >
                  <span className="flex-1 text-left truncate">{info.name}</span>
                  {info.cost > 0 && <span className={`text-xs ${isSelected ? 'opacity-80' : 'opacity-50'}`}>${info.cost}</span>}
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

export function Sidebar({ onExit }: { onExit?: () => void }) {
  const { state, setTool, setActivePanel } = useTower();
  const { selectedTool, money, activePanel } = state;
  const gt = useGT();

  const directTools = useMemo(() => ['select', 'bulldoze'] as Tool[], []);
  const towerTools = useMemo(
    () => ['tower_cannon', 'tower_archer', 'tower_tesla', 'tower_ice', 'tower_mortar', 'tower_sniper'] as Tool[],
    []
  );

  return (
    <div className="w-56 bg-sidebar border-r border-sidebar-border flex flex-col h-screen fixed left-0 top-0 z-40">
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <span className="text-sidebar-foreground font-bold tracking-tight">ISOTOWER</span>
          {onExit && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onExit}
              title={gt('Exit to Menu')}
              className="h-7 w-7 text-muted-foreground hover:text-sidebar-foreground"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 py-2">
        <div className="px-4 py-2 text-[10px] font-bold tracking-widest text-muted-foreground uppercase"><T>Tools</T></div>
        <div className="px-2 flex flex-col gap-0.5">
          {directTools.map((tool) => {
            const info = TOOL_INFO[tool];
            const isSelected = selectedTool === tool;
            return (
              <Button
                key={tool}
                onClick={() => setTool(tool)}
                variant={isSelected ? 'default' : 'ghost'}
                className={`w-full justify-start gap-3 px-3 py-2 h-auto text-sm ${
                  isSelected ? 'bg-primary text-primary-foreground' : ''
                }`}
                title={info.description}
              >
                <span className="flex-1 text-left truncate">{info.name}</span>
              </Button>
            );
          })}
        </div>

        <div className="mx-4 my-2 h-px bg-sidebar-border/50" />
        <div className="px-4 py-2 text-[10px] font-bold tracking-widest text-muted-foreground uppercase"><T>Towers</T></div>

        <div className="px-2 flex flex-col gap-0.5">
          <HoverSubmenu label={gt('Build Towers')} tools={towerTools} selectedTool={selectedTool} money={money} onSelectTool={setTool} />
        </div>
      </ScrollArea>

      <div className="border-t border-sidebar-border p-2">
        <div className="grid grid-cols-2 gap-1">
          <Button
            onClick={() => setActivePanel(activePanel === 'stats' ? 'none' : 'stats')}
            variant={activePanel === 'stats' ? 'default' : 'ghost'}
            size="icon-sm"
            className="w-full"
            title={gt('Stats')}
          >
            <BarChart3 className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => setActivePanel(activePanel === 'settings' ? 'none' : 'settings')}
            variant={activePanel === 'settings' ? 'default' : 'ghost'}
            size="icon-sm"
            className="w-full"
            title={gt('Settings')}
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

