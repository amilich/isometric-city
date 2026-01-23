'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { Tool, TOOL_INFO, ToolCategory } from '@/games/coaster/types';
import { useMobile } from '@/hooks/useMobile';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';

// Global callback to open the command menu
let openCoasterCommandMenuCallback: (() => void) | null = null;

export function openCoasterCommandMenu() {
  openCoasterCommandMenuCallback?.();
}

// Define all menu items with categories
interface MenuItem {
  id: string;
  type: 'tool' | 'panel';
  tool?: Tool;
  panel?: 'finances' | 'guests' | 'rides' | 'staff' | 'settings';
  name: string;
  description: string;
  cost?: number;
  category: string;
  keywords: string[];
}

// Menu categories for the coaster game
const MENU_CATEGORIES = [
  { key: 'tools', label: 'Tools' },
  { key: 'paths', label: 'Paths' },
  { key: 'terrain', label: 'Terrain' },
  { key: 'coasters_wooden', label: 'Wooden Coasters' },
  { key: 'coasters_steel', label: 'Steel Coasters' },
  { key: 'coasters_specialty', label: 'Specialty Coasters' },
  { key: 'coasters_track', label: 'Coaster Track' },
  { key: 'trees', label: 'Trees & Shrubs' },
  { key: 'flowers', label: 'Flowers' },
  { key: 'furniture', label: 'Furniture' },
  { key: 'fountains', label: 'Fountains' },
  { key: 'food', label: 'Food & Drink' },
  { key: 'shops', label: 'Shops & Services' },
  { key: 'rides_small', label: 'Small Rides' },
  { key: 'rides_large', label: 'Large Rides' },
  { key: 'infrastructure', label: 'Infrastructure' },
  { key: 'panels', label: 'Panels' },
] as const;

// Map ToolCategory to our menu categories
function getCategoryKey(tool: Tool, toolCategory: ToolCategory): string {
  // Handle coaster type tools specially
  if (tool.startsWith('coaster_type_wooden')) return 'coasters_wooden';
  if (tool.startsWith('coaster_type_steel') || 
      tool.startsWith('coaster_type_launch') || 
      tool.startsWith('coaster_type_hyper') || 
      tool.startsWith('coaster_type_giga')) return 'coasters_steel';
  if (tool.startsWith('coaster_type_water')) return 'coasters_specialty';
  if (tool.startsWith('coaster_type_mine') || 
      tool.startsWith('coaster_type_bobsled') || 
      tool.startsWith('coaster_type_suspended')) return 'coasters_specialty';
  
  // Handle coaster building tools
  if (tool.startsWith('coaster_')) return 'coasters_track';
  
  // Use the tool's category for others
  return toolCategory;
}

// Build menu items from tools
function buildMenuItems(): MenuItem[] {
  const items: MenuItem[] = [];

  // Get all tools from TOOL_INFO
  const allTools = Object.keys(TOOL_INFO) as Tool[];
  
  for (const tool of allTools) {
    const info = TOOL_INFO[tool];
    const categoryKey = getCategoryKey(tool, info.category);
    
    // Build keywords based on tool type
    const keywords: string[] = [
      info.name.toLowerCase(),
      tool.replace(/_/g, ' '),
      categoryKey,
    ];
    
    // Add extra keywords based on category
    if (categoryKey === 'coasters_wooden') {
      keywords.push('coaster', 'wooden', 'wood', 'classic');
    } else if (categoryKey === 'coasters_steel') {
      keywords.push('coaster', 'steel', 'metal', 'modern');
    } else if (categoryKey === 'coasters_specialty') {
      keywords.push('coaster', 'special', 'unique');
    } else if (categoryKey === 'coasters_track') {
      keywords.push('coaster', 'track', 'build', 'piece');
    } else if (categoryKey === 'food') {
      keywords.push('food', 'drink', 'eat', 'snack', 'restaurant');
    } else if (categoryKey === 'shops') {
      keywords.push('shop', 'store', 'buy', 'sell', 'gift');
    } else if (categoryKey === 'rides_small') {
      keywords.push('ride', 'small', 'family', 'kiddie');
    } else if (categoryKey === 'rides_large') {
      keywords.push('ride', 'large', 'thrill', 'big');
    } else if (categoryKey === 'trees') {
      keywords.push('tree', 'plant', 'nature', 'green', 'bush', 'shrub');
    } else if (categoryKey === 'flowers') {
      keywords.push('flower', 'plant', 'garden', 'decor');
    } else if (categoryKey === 'furniture') {
      keywords.push('bench', 'lamp', 'trash', 'seat', 'light');
    } else if (categoryKey === 'fountains') {
      keywords.push('water', 'fountain', 'pond', 'splash');
    } else if (categoryKey === 'paths') {
      keywords.push('path', 'walkway', 'queue', 'line');
    } else if (categoryKey === 'terrain') {
      keywords.push('terrain', 'land', 'water', 'terraform');
    } else if (categoryKey === 'infrastructure') {
      keywords.push('entrance', 'staff', 'building', 'utility');
    }
    
    items.push({
      id: tool,
      type: 'tool',
      tool,
      name: info.name,
      description: info.description,
      cost: info.cost,
      category: categoryKey,
      keywords,
    });
  }

  // Add panels
  const panels: { panel: 'finances' | 'guests' | 'rides' | 'staff' | 'settings'; name: string; description: string; keywords: string[] }[] = [
    { panel: 'finances', name: 'Finances', description: 'View park finances and budgets', keywords: ['finances', 'money', 'budget', 'income', 'expenses', 'profit'] },
    { panel: 'guests', name: 'Guests', description: 'View guest information and statistics', keywords: ['guests', 'visitors', 'people', 'attendance', 'satisfaction'] },
    { panel: 'rides', name: 'Rides', description: 'Manage rides and attractions', keywords: ['rides', 'attractions', 'coasters', 'maintenance'] },
    { panel: 'staff', name: 'Staff', description: 'Manage park employees', keywords: ['staff', 'employees', 'workers', 'mechanics', 'janitors'] },
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

export function CoasterCommandMenu() {
  const { isMobileDevice } = useMobile();
  const { state, setTool, setActivePanel, startCoasterBuild } = useCoaster();
  const { finances, activePanel } = state;

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
    openCoasterCommandMenuCallback = () => handleOpenChange(true);
    return () => {
      openCoasterCommandMenuCallback = null;
    };
  }, [handleOpenChange]);

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!search.trim()) return ALL_MENU_ITEMS;

    const searchLower = search.toLowerCase().trim();
    return ALL_MENU_ITEMS.filter(item => {
      // Check name
      if (item.name.toLowerCase().includes(searchLower)) return true;
      // Check description
      if (item.description.toLowerCase().includes(searchLower)) return true;
      // Check keywords
      if (item.keywords.some(kw => kw.includes(searchLower))) return true;
      // Check category
      if (item.category.includes(searchLower)) return true;
      return false;
    });
  }, [search]);

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
      // Skip if typing in an input (except for our command menu input)
      const target = e.target as HTMLElement;
      if ((target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) && 
          target !== inputRef.current) {
        return;
      }
      
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
      // Check if this is a coaster type selection tool
      const coasterType = COASTER_TYPE_TOOL_MAP[item.tool];
      if (coasterType) {
        // Start building a coaster of this type
        startCoasterBuild(coasterType);
        // Switch to coaster build mode
        setTool('coaster_build');
      } else {
        setTool(item.tool);
      }
    } else if (item.type === 'panel' && item.panel) {
      setActivePanel(activePanel === item.panel ? 'none' : item.panel);
    }
    setOpen(false);
  }, [setTool, setActivePanel, activePanel, startCoasterBuild]);

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
            placeholder="Search rides, buildings, tools..."
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
                      {category.label}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {items.map((item) => {
                        const globalIndex = flatItems.indexOf(item);
                        const isSelected = globalIndex === selectedIndex;
                        const canAfford = item.cost === undefined || item.cost === 0 || finances.cash >= item.cost;

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
                              <span className="font-medium truncate">{item.name}</span>
                              <span className={cn(
                                'text-xs truncate',
                                isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'
                              )}>
                                {item.description}
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
