'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { msg, useMessages } from 'gt-next';
import { useGame } from '@/context/GameContext';
import { Tool, TOOL_INFO } from '@/types/game';
import { useMobile } from '@/hooks/useMobile';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';

// Global callback to open the command menu
let openCommandMenuCallback: (() => void) | null = null;

export function openCommandMenu() {
  openCommandMenuCallback?.();
}

// Define all menu items with categories
// Note: name and description store raw message objects for translation
interface MenuItem {
  id: string;
  type: 'tool' | 'panel';
  tool?: Tool;
  panel?: 'budget' | 'statistics' | 'advisors' | 'settings';
  name: unknown; // Raw message object from msg()
  description: unknown; // Raw message object from msg()
  cost?: number;
  category: string;
  keywords: string[];
}

const MENU_CATEGORIES = [
  { key: 'tools', label: msg('Tools') },
  { key: 'zones', label: msg('Zones') },
  { key: 'zoning', label: msg('Zoning') },
  { key: 'services', label: msg('Services') },
  { key: 'parks', label: msg('Parks') },
  { key: 'sports', label: msg('Sports') },
  { key: 'waterfront', label: msg('Waterfront') },
  { key: 'community', label: msg('Community') },
  { key: 'utilities', label: msg('Utilities') },
  { key: 'special', label: msg('Special') },
  { key: 'panels', label: msg('Panels') },
] as const;

// Build menu items from tools
function buildMenuItems(): MenuItem[] {
  const items: MenuItem[] = [];

  // Tools category
  const toolsCategory: Tool[] = ['select', 'bulldoze', 'road', 'rail', 'subway'];
  toolsCategory.forEach(tool => {
    const info = TOOL_INFO[tool];
    items.push({
      id: tool,
      type: 'tool',
      tool,
      name: info.name,
      description: info.description,
      cost: info.cost,
      category: 'tools',
      keywords: [info.name.toLowerCase(), tool, 'tool', 'infrastructure'],
    });
  });

  // Zones category (R/C/I)
  const zonesCategory: Tool[] = ['zone_residential', 'zone_commercial', 'zone_industrial'];
  zonesCategory.forEach(tool => {
    const info = TOOL_INFO[tool];
    items.push({
      id: tool,
      type: 'tool',
      tool,
      name: info.name,
      description: info.description,
      cost: info.cost,
      category: 'zones',
      keywords: [info.name.toLowerCase(), tool, 'zone'],
    });
  });

  // Zoning category (de-zone and terraform tools)
  const zoningCategory: Tool[] = ['zone_dezone', 'zone_water', 'zone_land'];
  zoningCategory.forEach(tool => {
    const info = TOOL_INFO[tool];
    const keywords = [info.name.toLowerCase(), tool, 'zoning'];
    if (tool === 'zone_water') {
      keywords.push('water', 'terraform', 'lake', 'ocean');
    } else if (tool === 'zone_land') {
      keywords.push('land', 'terraform', 'grass', 'fill');
    } else {
      keywords.push('remove', 'clear');
    }
    items.push({
      id: tool,
      type: 'tool',
      tool,
      name: info.name,
      description: info.description,
      cost: info.cost,
      category: 'zoning',
      keywords,
    });
  });

  // Services
  const servicesCategory: Tool[] = ['police_station', 'fire_station', 'hospital', 'school', 'university'];
  servicesCategory.forEach(tool => {
    const info = TOOL_INFO[tool];
    items.push({
      id: tool,
      type: 'tool',
      tool,
      name: info.name,
      description: info.description,
      cost: info.cost,
      category: 'services',
      keywords: [info.name.toLowerCase(), tool, 'service', 'building'],
    });
  });

  // Parks (includes former recreation items)
  const parksCategory: Tool[] = ['tree', 'park', 'park_large', 'tennis', 'playground_small', 'playground_large', 'community_garden', 'pond_park', 'park_gate', 'greenhouse_garden', 'mini_golf_course', 'go_kart_track', 'amphitheater', 'roller_coaster_small', 'campground', 'cabin_house', 'mountain_lodge', 'mountain_trailhead'];
  parksCategory.forEach(tool => {
    const info = TOOL_INFO[tool];
    items.push({
      id: tool,
      type: 'tool',
      tool,
      name: info.name,
      description: info.description,
      cost: info.cost,
      category: 'parks',
      keywords: [info.name.toLowerCase(), tool, 'park', 'green', 'nature', 'recreation', 'entertainment'],
    });
  });

  // Sports
  const sportsCategory: Tool[] = ['basketball_courts', 'soccer_field_small', 'baseball_field_small', 'football_field', 'baseball_stadium', 'swimming_pool', 'skate_park', 'bleachers_field'];
  sportsCategory.forEach(tool => {
    const info = TOOL_INFO[tool];
    items.push({
      id: tool,
      type: 'tool',
      tool,
      name: info.name,
      description: info.description,
      cost: info.cost,
      category: 'sports',
      keywords: [info.name.toLowerCase(), tool, 'sports', 'recreation', 'field'],
    });
  });

  // Waterfront
  const waterfrontCategory: Tool[] = ['marina_docks_small', 'pier_large'];
  waterfrontCategory.forEach(tool => {
    const info = TOOL_INFO[tool];
    items.push({
      id: tool,
      type: 'tool',
      tool,
      name: info.name,
      description: info.description,
      cost: info.cost,
      category: 'waterfront',
      keywords: [info.name.toLowerCase(), tool, 'water', 'waterfront', 'dock', 'pier', 'marina'],
    });
  });

  // Community
  const communityCategory: Tool[] = ['community_center', 'animal_pens_farm', 'office_building_small'];
  communityCategory.forEach(tool => {
    const info = TOOL_INFO[tool];
    items.push({
      id: tool,
      type: 'tool',
      tool,
      name: info.name,
      description: info.description,
      cost: info.cost,
      category: 'community',
      keywords: [info.name.toLowerCase(), tool, 'community', 'building'],
    });
  });

  // Utilities
  const utilitiesCategory: Tool[] = ['power_plant', 'water_tower', 'subway_station', 'rail_station'];
  utilitiesCategory.forEach(tool => {
    const info = TOOL_INFO[tool];
    items.push({
      id: tool,
      type: 'tool',
      tool,
      name: info.name,
      description: info.description,
      cost: info.cost,
      category: 'utilities',
      keywords: [info.name.toLowerCase(), tool, 'utility', 'power', 'water', 'infrastructure', 'transit', 'station', 'train'],
    });
  });

  // Special
  const specialCategory: Tool[] = ['stadium', 'museum', 'airport', 'space_program', 'city_hall', 'amusement_park'];
  specialCategory.forEach(tool => {
    const info = TOOL_INFO[tool];
    items.push({
      id: tool,
      type: 'tool',
      tool,
      name: info.name,
      description: info.description,
      cost: info.cost,
      category: 'special',
      keywords: [info.name.toLowerCase(), tool, 'special', 'landmark', 'attraction'],
    });
  });

  // Panels
  const panels: { panel: 'budget' | 'statistics' | 'advisors' | 'settings'; name: string; description: string; keywords: string[] }[] = [
    { panel: 'budget', name: 'Budget', description: 'Manage city finances and funding', keywords: ['budget', 'money', 'finance', 'tax', 'funding'] },
    { panel: 'statistics', name: 'Statistics', description: 'View city statistics and charts', keywords: ['statistics', 'stats', 'charts', 'data', 'info'] },
    { panel: 'advisors', name: 'Advisors', description: 'Get advice from city advisors', keywords: ['advisors', 'advice', 'help', 'tips'] },
    { panel: 'settings', name: 'Settings', description: 'Game settings and preferences', keywords: ['settings', 'options', 'preferences', 'config'] },
  ];

  panels.forEach(({ panel, name, description, keywords }) => {
    items.push({
      id: `panel-${panel}`,
      type: 'panel',
      panel,
      name,
      description,
      category: 'panels',
      keywords,
    });
  });

  return items;
}

const ALL_MENU_ITEMS = buildMenuItems();

export function CommandMenu() {
  const { isMobileDevice } = useMobile();
  const { state, setTool, setActivePanel } = useGame();
  const { stats } = state;
  const m = useMessages();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  
  // Handler to update search and reset selection
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setSelectedIndex(0);
  }, []);
  
  // Handler for dialog open state changes
  const handleOpenChange = useCallback((newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, []);

  // Register global callback to open the menu
  useEffect(() => {
    openCommandMenuCallback = () => handleOpenChange(true);
    return () => {
      openCommandMenuCallback = null;
    };
  }, [handleOpenChange]);

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!search.trim()) return ALL_MENU_ITEMS;

    const searchLower = search.toLowerCase().trim();
    return ALL_MENU_ITEMS.filter(item => {
      // Check name (decode translation for search)
      const name = String(m(item.name as Parameters<typeof m>[0]));
      if (name.toLowerCase().includes(searchLower)) return true;
      // Check description (decode translation for search)
      const description = String(m(item.description as Parameters<typeof m>[0]));
      if (description.toLowerCase().includes(searchLower)) return true;
      // Check keywords
      if (item.keywords.some(kw => kw.includes(searchLower))) return true;
      // Check category
      if (item.category.includes(searchLower)) return true;
      return false;
    });
  }, [search, m]);

  // Group filtered items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, MenuItem[]> = {};
    filteredItems.forEach(item => {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    });
    return groups;
  }, [filteredItems]);

  // Flat list for keyboard navigation
  const flatItems = useMemo(() => {
    const result: MenuItem[] = [];
    MENU_CATEGORIES.forEach(cat => {
      if (groupedItems[cat.key]) {
        result.push(...groupedItems[cat.key]);
      }
    });
    return result;
  }, [groupedItems]);

  // Handle keyboard shortcut to open
  useEffect(() => {
    // Don't register on mobile
    if (isMobileDevice) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileDevice]);

  // Handle item selection
  const handleSelect = useCallback((item: MenuItem) => {
    if (item.type === 'tool' && item.tool) {
      setTool(item.tool);
    } else if (item.type === 'panel' && item.panel) {
      setActivePanel(state.activePanel === item.panel ? 'none' : item.panel);
    }
    setOpen(false);
  }, [setTool, setActivePanel, state.activePanel]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current || flatItems.length === 0) return;
    
    const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, flatItems.length]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % flatItems.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + flatItems.length) % flatItems.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (flatItems[selectedIndex]) {
          handleSelect(flatItems[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
    }
  }, [flatItems, selectedIndex, handleSelect]);

  // Don't render on mobile
  if (isMobileDevice) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="p-0 gap-0 max-w-lg overflow-hidden bg-sidebar border-sidebar-border shadow-2xl"
        onKeyDown={handleKeyDown}
      >
        <VisuallyHidden.Root>
          <DialogTitle>Command Menu</DialogTitle>
        </VisuallyHidden.Root>
        
        {/* Search input */}
        <div className="flex items-center border-b border-sidebar-border px-3">
          <svg 
            className="w-4 h-4 text-muted-foreground shrink-0" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search tools, buildings, panels..."
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent h-12 text-sm"
          />
          <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-sidebar-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <ScrollArea className="max-h-[360px]">
          <div ref={listRef} className="p-2">
            {flatItems.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No results found.
              </div>
            ) : (
              MENU_CATEGORIES.map(category => {
                const items = groupedItems[category.key];
                if (!items || items.length === 0) return null;

                return (
                  <div key={category.key} className="mb-2">
                    <div className="px-2 py-1.5 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                      {m(category.label as Parameters<typeof m>[0])}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {items.map((item) => {
                        const globalIndex = flatItems.indexOf(item);
                        const isSelected = globalIndex === selectedIndex;
                        const canAfford = item.cost === undefined || item.cost === 0 || stats.money >= item.cost;

                        return (
                          <button
                            key={item.id}
                            data-index={globalIndex}
                            onClick={() => handleSelect(item)}
                            disabled={!canAfford}
                            className={cn(
                              'flex items-center justify-between gap-2 px-3 py-2 rounded-sm text-sm transition-colors text-left w-full',
                              isSelected 
                                ? 'bg-primary text-primary-foreground' 
                                : 'hover:bg-muted/60',
                              !canAfford && 'opacity-50 cursor-not-allowed'
                            )}
                          >
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span className="font-medium truncate">{m(item.name as Parameters<typeof m>[0])}</span>
                              <span className={cn(
                                'text-xs truncate',
                                isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'
                              )}>
                                {m(item.description as Parameters<typeof m>[0])}
                              </span>
                            </div>
                            {item.cost !== undefined && item.cost > 0 && (
                              <span className={cn(
                                'text-xs shrink-0',
                                isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'
                              )}>
                                ${item.cost.toLocaleString()}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Footer hint */}
        <div className="flex items-center justify-between border-t border-sidebar-border px-3 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="inline-flex h-4 items-center rounded border border-sidebar-border bg-muted px-1 font-mono text-[10px]">↑</kbd>
              <kbd className="inline-flex h-4 items-center rounded border border-sidebar-border bg-muted px-1 font-mono text-[10px]">↓</kbd>
              <span>navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="inline-flex h-4 items-center rounded border border-sidebar-border bg-muted px-1 font-mono text-[10px]">↵</kbd>
              <span>select</span>
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="inline-flex h-4 items-center rounded border border-sidebar-border bg-muted px-1 font-mono text-[10px]">⌘</kbd>
            <kbd className="inline-flex h-4 items-center rounded border border-sidebar-border bg-muted px-1 font-mono text-[10px]">K</kbd>
            <span>to toggle</span>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
