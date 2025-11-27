'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useGame } from '@/context/GameContext';
import { Tool, TOOL_INFO, Tile, BuildingType } from '@/types/game';
import { getBuildingSize } from '@/lib/simulation';
import {
  PlayIcon,
  PauseIcon,
  FastForwardIcon,
  CloseIcon,
  RoadIcon,
  TreeIcon,
  FireIcon,
  PowerIcon,
  WaterIcon,
  PopulationIcon,
  JobsIcon,
  MoneyIcon,
  HappyIcon,
  HealthIcon,
  EducationIcon,
  SafetyIcon,
  MedicalCrossIcon,
  EnvironmentIcon,
  ChartIcon,
  TrophyIcon,
  AdvisorIcon,
  AlertIcon,
  InfoIcon,
  BudgetIcon,
  SettingsIcon,
} from './ui/Icons';
import { SPRITE_SHEET, getSpriteCoords, BUILDING_TO_SPRITE, SPRITE_VERTICAL_OFFSETS, SPRITE_HORIZONTAL_OFFSETS, SPRITE_ORDER, SpritePack, getActiveSpritePack } from '@/lib/renderConfig';

// Import shadcn components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Isometric tile dimensions
const TILE_WIDTH = 64;
const HEIGHT_RATIO = 0.60;
const TILE_HEIGHT = TILE_WIDTH * HEIGHT_RATIO;
const KEY_PAN_SPEED = 520; // Pixels per second for keyboard panning

type CarDirection = 'north' | 'east' | 'south' | 'west';

type Car = {
  id: number;
  tileX: number;
  tileY: number;
  direction: CarDirection;
  progress: number;
  speed: number;
  age: number;
  maxAge: number;
  color: string;
  laneOffset: number;
};

type EmergencyVehicleType = 'fire_truck' | 'police_car';
type EmergencyVehicleState = 'dispatching' | 'responding' | 'returning';

type EmergencyVehicle = {
  id: number;
  type: EmergencyVehicleType;
  tileX: number;
  tileY: number;
  direction: CarDirection;
  progress: number;
  speed: number;
  state: EmergencyVehicleState;
  stationX: number;
  stationY: number;
  targetX: number;
  targetY: number;
  path: { x: number; y: number }[];
  pathIndex: number;
  respondTime: number; // Time spent at the scene
  laneOffset: number;
  flashTimer: number; // For emergency light animation
};

type DirectionMeta = {
  step: { x: number; y: number };
  vec: { dx: number; dy: number };
  angle: number;
  normal: { nx: number; ny: number };
};

type WorldRenderState = {
  grid: Tile[][];
  gridSize: number;
  offset: { x: number; y: number };
  zoom: number;
  speed: number;
};

const CAR_COLORS = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#c084fc'];

function createDirectionMeta(step: { x: number; y: number }, vec: { dx: number; dy: number }): DirectionMeta {
  const length = Math.hypot(vec.dx, vec.dy) || 1;
  return {
    step,
    vec,
    angle: Math.atan2(vec.dy, vec.dx),
    normal: { nx: -vec.dy / length, ny: vec.dx / length },
  };
}

const DIRECTION_META: Record<CarDirection, DirectionMeta> = {
  north: createDirectionMeta({ x: -1, y: 0 }, { dx: -TILE_WIDTH / 2, dy: -TILE_HEIGHT / 2 }),
  east: createDirectionMeta({ x: 0, y: -1 }, { dx: TILE_WIDTH / 2, dy: -TILE_HEIGHT / 2 }),
  south: createDirectionMeta({ x: 1, y: 0 }, { dx: TILE_WIDTH / 2, dy: TILE_HEIGHT / 2 }),
  west: createDirectionMeta({ x: 0, y: 1 }, { dx: -TILE_WIDTH / 2, dy: TILE_HEIGHT / 2 }),
};

const OPPOSITE_DIRECTION: Record<CarDirection, CarDirection> = {
  north: 'south',
  east: 'west',
  south: 'north',
  west: 'east',
};

function getOppositeDirection(direction: CarDirection): CarDirection {
  return OPPOSITE_DIRECTION[direction];
}

function isRoadTile(gridData: Tile[][], gridSizeValue: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSizeValue || y >= gridSizeValue) return false;
  return gridData[y][x].building.type === 'road';
}

function getDirectionOptions(gridData: Tile[][], gridSizeValue: number, x: number, y: number): CarDirection[] {
  const options: CarDirection[] = [];
  if (isRoadTile(gridData, gridSizeValue, x - 1, y)) options.push('north');
  if (isRoadTile(gridData, gridSizeValue, x, y - 1)) options.push('east');
  if (isRoadTile(gridData, gridSizeValue, x + 1, y)) options.push('south');
  if (isRoadTile(gridData, gridSizeValue, x, y + 1)) options.push('west');
  return options;
}

function pickNextDirection(
  previousDirection: CarDirection,
  gridData: Tile[][],
  gridSizeValue: number,
  x: number,
  y: number
): CarDirection | null {
  const options = getDirectionOptions(gridData, gridSizeValue, x, y);
  if (options.length === 0) return null;
  const incoming = getOppositeDirection(previousDirection);
  const filtered = options.filter(dir => dir !== incoming);
  const pool = filtered.length > 0 ? filtered : options;
  return pool[Math.floor(Math.random() * pool.length)];
}

// BFS pathfinding on road network - finds path from start to a tile adjacent to target
function findPathOnRoads(
  gridData: Tile[][],
  gridSizeValue: number,
  startX: number,
  startY: number,
  targetX: number,
  targetY: number
): { x: number; y: number }[] | null {
  // Find the nearest road tile to the target (since buildings aren't on roads)
  const targetRoad = findNearestRoadToBuilding(gridData, gridSizeValue, targetX, targetY);
  if (!targetRoad) return null;
  
  // Find the nearest road tile to the start (station)
  const startRoad = findNearestRoadToBuilding(gridData, gridSizeValue, startX, startY);
  if (!startRoad) return null;
  
  // If start and target roads are the same, return a simple path
  if (startRoad.x === targetRoad.x && startRoad.y === targetRoad.y) {
    return [{ x: startRoad.x, y: startRoad.y }];
  }
  
  // BFS from start road to target road
  const queue: { x: number; y: number; path: { x: number; y: number }[] }[] = [
    { x: startRoad.x, y: startRoad.y, path: [{ x: startRoad.x, y: startRoad.y }] }
  ];
  const visited = new Set<string>();
  visited.add(`${startRoad.x},${startRoad.y}`);
  
  const directions = [
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
  ];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    
    // Check if we reached the target road
    if (current.x === targetRoad.x && current.y === targetRoad.y) {
      return current.path;
    }
    
    for (const { dx, dy } of directions) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const key = `${nx},${ny}`;
      
      if (nx < 0 || ny < 0 || nx >= gridSizeValue || ny >= gridSizeValue) continue;
      if (visited.has(key)) continue;
      if (!isRoadTile(gridData, gridSizeValue, nx, ny)) continue;
      
      visited.add(key);
      queue.push({
        x: nx,
        y: ny,
        path: [...current.path, { x: nx, y: ny }],
      });
    }
  }
  
  return null; // No path found
}

// Find the nearest road tile adjacent to a building
function findNearestRoadToBuilding(
  gridData: Tile[][],
  gridSizeValue: number,
  buildingX: number,
  buildingY: number
): { x: number; y: number } | null {
  // Check adjacent tiles first (distance 1) - including diagonals
  const adjacentOffsets = [
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: -1 },
    { dx: -1, dy: 1 },
    { dx: 1, dy: -1 },
    { dx: 1, dy: 1 },
  ];
  
  for (const { dx, dy } of adjacentOffsets) {
    const nx = buildingX + dx;
    const ny = buildingY + dy;
    if (isRoadTile(gridData, gridSizeValue, nx, ny)) {
      return { x: nx, y: ny };
    }
  }
  
  // BFS to find nearest road within reasonable distance (increased to 20)
  const queue: { x: number; y: number; dist: number }[] = [{ x: buildingX, y: buildingY, dist: 0 }];
  const visited = new Set<string>();
  visited.add(`${buildingX},${buildingY}`);
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.dist > 20) break; // Increased max search distance
    
    for (const { dx, dy } of adjacentOffsets) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const key = `${nx},${ny}`;
      
      if (nx < 0 || ny < 0 || nx >= gridSizeValue || ny >= gridSizeValue) continue;
      if (visited.has(key)) continue;
      visited.add(key);
      
      if (isRoadTile(gridData, gridSizeValue, nx, ny)) {
        return { x: nx, y: ny };
      }
      
      queue.push({ x: nx, y: ny, dist: current.dist + 1 });
    }
  }
  
  return null;
}

// Get direction from current tile to next tile
function getDirectionToTile(fromX: number, fromY: number, toX: number, toY: number): CarDirection | null {
  const dx = toX - fromX;
  const dy = toY - fromY;
  
  if (dx === -1 && dy === 0) return 'north';
  if (dx === 1 && dy === 0) return 'south';
  if (dx === 0 && dy === -1) return 'east';
  if (dx === 0 && dy === 1) return 'west';
  
  return null;
}

// Convert grid coordinates to screen coordinates (isometric)
function gridToScreen(x: number, y: number, offsetX: number, offsetY: number): { screenX: number; screenY: number } {
  const screenX = (x - y) * (TILE_WIDTH / 2) + offsetX;
  const screenY = (x + y) * (TILE_HEIGHT / 2) + offsetY;
  return { screenX, screenY };
}

// Convert screen coordinates to grid coordinates
function screenToGrid(screenX: number, screenY: number, offsetX: number, offsetY: number): { gridX: number; gridY: number } {
  const adjustedX = screenX - offsetX;
  const adjustedY = screenY - offsetY;
  
  const gridX = (adjustedX / (TILE_WIDTH / 2) + adjustedY / (TILE_HEIGHT / 2)) / 2;
  const gridY = (adjustedY / (TILE_HEIGHT / 2) - adjustedX / (TILE_WIDTH / 2)) / 2;
  
  return { gridX: Math.floor(gridX), gridY: Math.floor(gridY) };
}

const EVENT_ICON_MAP: Record<string, React.ReactNode> = {
  fire: <FireIcon size={16} />,
  chart_up: <ChartIcon size={16} />,
  chart_down: <ChartIcon size={16} />,
  population: <PopulationIcon size={16} />,
  tech: <AdvisorIcon size={16} />,
  education: <EducationIcon size={16} />,
  trophy: <TrophyIcon size={16} />,
  power: <PowerIcon size={16} />,
  water: <WaterIcon size={16} />,
  road: <RoadIcon size={16} />,
  balance: <ChartIcon size={16} />,
  cash: <MoneyIcon size={16} />,
  profit: <MoneyIcon size={16} />,
  tree: <TreeIcon size={16} />,
  shield: <SafetyIcon size={16} />,
  disaster: <AlertIcon size={16} />,
  town: <PopulationIcon size={16} />,
  city: <PopulationIcon size={16} />,
  metropolis: <PopulationIcon size={16} />,
  megacity: <PopulationIcon size={16} />,
  happy: <HappyIcon size={16} />,
  environment: <EnvironmentIcon size={16} />,
  jobs: <JobsIcon size={16} />,
  planning: <AdvisorIcon size={16} />,
};

const ADVISOR_ICON_MAP: Record<string, React.ReactNode> = {
  power: <PowerIcon size={18} />,
  water: <WaterIcon size={18} />,
  cash: <MoneyIcon size={18} />,
  shield: <SafetyIcon size={18} />,
  hospital: <HealthIcon size={18} />,
  education: <EducationIcon size={18} />,
  environment: <EnvironmentIcon size={18} />,
  planning: <AdvisorIcon size={18} />,
  jobs: <JobsIcon size={18} />,
};

// Memoized Sidebar Component
const Sidebar = React.memo(function Sidebar() {
  const { state, setTool, setActivePanel } = useGame();
  const { selectedTool, stats, activePanel } = state;
  
  const toolCategories = useMemo(() => ({
    'TOOLS': ['select', 'bulldoze', 'road'] as Tool[],
    'ZONES': ['zone_residential', 'zone_commercial', 'zone_industrial', 'zone_dezone'] as Tool[],
    'SERVICES': ['police_station', 'fire_station', 'hospital', 'school', 'university'] as Tool[],
    'PARKS': ['park', 'park_large', 'tennis'] as Tool[],
    'UTILITIES': ['power_plant', 'water_tower'] as Tool[],
    'SPECIAL': ['stadium', 'museum', 'airport', 'space_program'] as Tool[],
  }), []);
  
  return (
    <div className="w-56 bg-sidebar border-r border-sidebar-border flex flex-col h-full">
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <span className="text-sidebar-foreground font-bold tracking-tight">ISOCITY</span>
        </div>
      </div>
      
      <ScrollArea className="flex-1 py-2">
        {Object.entries(toolCategories).map(([category, tools]) => (
          <div key={category} className="mb-1">
            <div className="px-4 py-2 text-[10px] font-bold tracking-widest text-muted-foreground">
              {category}
            </div>
            <div className="px-2 flex flex-col gap-0.5">
              {tools.map(tool => {
                const info = TOOL_INFO[tool];
                const isSelected = selectedTool === tool;
                const canAfford = stats.money >= info.cost;
                
                return (
                  <Button
                    key={tool}
                    onClick={() => setTool(tool)}
                    disabled={!canAfford && info.cost > 0}
                    variant={isSelected ? 'default' : 'ghost'}
                    className={`w-full justify-start gap-3 px-3 py-2 h-auto text-sm ${
                      isSelected ? 'bg-primary text-primary-foreground' : ''
                    }`}
                    title={`${info.description}${info.cost > 0 ? ` - Cost: $${info.cost}` : ''}`}
                  >
                    <span className="flex-1 text-left truncate">{info.name}</span>
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
        <div className="grid grid-cols-5 gap-1">
          {[
            { panel: 'budget' as const, icon: <BudgetIcon size={16} />, label: 'Budget' },
            { panel: 'statistics' as const, icon: <ChartIcon size={16} />, label: 'Statistics' },
            { panel: 'advisors' as const, icon: <AdvisorIcon size={16} />, label: 'Advisors' },
            { panel: 'achievements' as const, icon: <TrophyIcon size={16} />, label: 'Achievements' },
            { panel: 'settings' as const, icon: <SettingsIcon size={16} />, label: 'Settings' },
          ].map(({ panel, icon, label }) => (
            <Button
              key={panel}
              onClick={() => setActivePanel(activePanel === panel ? 'none' : panel)}
              variant={activePanel === panel ? 'default' : 'ghost'}
              size="icon-sm"
              className="w-full"
              title={label}
            >
              {icon}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
});

// Memoized TopBar Component
const TopBar = React.memo(function TopBar() {
  const { state, setSpeed, setTaxRate, isSaving } = useGame();
  const { stats, year, month, speed, taxRate, cityName } = state;
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  return (
    <div className="h-14 bg-card border-b border-border flex items-center justify-between px-4">
      <div className="flex items-center gap-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-foreground font-semibold text-sm">{cityName}</h1>
            {isSaving && (
              <span className="text-muted-foreground text-xs italic animate-pulse">Saving...</span>
            )}
          </div>
          <div className="text-muted-foreground text-xs">{monthNames[month - 1]} {year}</div>
        </div>
        
        <div className="flex items-center gap-1 bg-secondary rounded-md p-1">
          {[0, 1, 2, 3].map(s => (
            <Button
              key={s}
              onClick={() => setSpeed(s as 0 | 1 | 2 | 3)}
              variant={speed === s ? 'default' : 'ghost'}
              size="icon-sm"
              className="h-7 w-7"
              title={s === 0 ? 'Pause' : s === 1 ? 'Normal' : s === 2 ? 'Fast' : 'Very Fast'}
            >
              {s === 0 ? <PauseIcon size={14} /> : 
               s === 1 ? <PlayIcon size={14} /> : 
               s === 2 ? <FastForwardIcon size={14} /> :
               <div className="flex items-center -space-x-1">
                 <PlayIcon size={10} />
                 <PlayIcon size={10} />
                 <PlayIcon size={10} />
               </div>}
            </Button>
          ))}
        </div>
      </div>
      
      <div className="flex items-center gap-8">
        <StatBadge value={stats.population.toLocaleString()} label="Population" />
        <StatBadge value={stats.jobs.toLocaleString()} label="Jobs" />
        <StatBadge 
          value={`$${stats.money.toLocaleString()}`} 
          label="Funds"
          variant={stats.money < 0 ? 'destructive' : stats.money < 1000 ? 'warning' : 'success'}
        />
        <Separator orientation="vertical" className="h-8" />
        <StatBadge 
          value={`$${(stats.income - stats.expenses).toLocaleString()}`} 
          label="Monthly"
          variant={stats.income - stats.expenses >= 0 ? 'success' : 'destructive'}
        />
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <DemandIndicator label="R" demand={stats.demand.residential} color="text-green-500" />
          <DemandIndicator label="C" demand={stats.demand.commercial} color="text-blue-500" />
          <DemandIndicator label="I" demand={stats.demand.industrial} color="text-amber-500" />
        </div>
        
        <Separator orientation="vertical" className="h-8" />
        
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Tax</span>
          <Slider
            value={[taxRate]}
            onValueChange={(value) => setTaxRate(value[0])}
            min={0}
            max={20}
            step={1}
            className="w-16"
          />
          <span className="text-foreground text-xs font-mono w-8">{taxRate}%</span>
        </div>
      </div>
    </div>
  );
});

function StatBadge({ value, label, variant = 'default' }: { 
  value: string; 
  label: string; 
  variant?: 'default' | 'success' | 'warning' | 'destructive';
}) {
  const colorClass = variant === 'success' ? 'text-green-500' : 
                     variant === 'warning' ? 'text-amber-500' : 
                     variant === 'destructive' ? 'text-red-500' : 'text-foreground';
  
  return (
    <div className="flex flex-col items-start">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-0.5">{label}</div>
      <div className={`text-sm font-mono font-semibold ${colorClass}`}>{value}</div>
    </div>
  );
}

function DemandIndicator({ label, demand, color }: { label: string; demand: number; color: string }) {
  const height = Math.abs(demand) / 2;
  const isPositive = demand >= 0;
  
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`text-[10px] font-bold ${color}`}>{label}</span>
      <div className="w-3 h-8 bg-secondary relative rounded-sm overflow-hidden">
        <div className="absolute left-0 right-0 top-1/2 h-px bg-border" />
        <div
          className={`absolute left-0 right-0 ${color.replace('text-', 'bg-')}`}
          style={{
            height: `${height}%`,
            top: isPositive ? `${50 - height}%` : '50%',
          }}
        />
      </div>
    </div>
  );
}

// Memoized Stats Panel
const StatsPanel = React.memo(function StatsPanel() {
  const { state } = useGame();
  const { stats } = state;
  
  return (
    <div className="h-8 bg-secondary/50 border-b border-border flex items-center justify-center gap-8 text-xs">
      <MiniStat icon={<HappyIcon size={12} />} label="Happiness" value={stats.happiness} />
      <MiniStat icon={<HealthIcon size={12} />} label="Health" value={stats.health} />
      <MiniStat icon={<EducationIcon size={12} />} label="Education" value={stats.education} />
      <MiniStat icon={<SafetyIcon size={12} />} label="Safety" value={stats.safety} />
      <MiniStat icon={<EnvironmentIcon size={12} />} label="Environment" value={stats.environment} />
    </div>
  );
});

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  const color = value >= 70 ? 'text-green-500' : value >= 40 ? 'text-amber-500' : 'text-red-500';
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono ${color}`}>{Math.round(value)}%</span>
    </div>
  );
}

// Canvas-based Minimap - Memoized
const MiniMap = React.memo(function MiniMap() {
  const { state } = useGame();
  const { grid, gridSize } = state;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const size = 140;
    const scale = size / gridSize;
    
    ctx.fillStyle = '#0b1723';
    ctx.fillRect(0, 0, size, size);
    
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const tile = grid[y][x];
        let color = '#2d5a3d';
        
        if (tile.building.type === 'water') color = '#0ea5e9';
        else if (tile.building.type === 'road') color = '#6b7280';
        else if (tile.building.type === 'tree') color = '#166534';
        else if (tile.zone === 'residential' && tile.building.type !== 'grass') color = '#22c55e';
        else if (tile.zone === 'residential') color = '#14532d';
        else if (tile.zone === 'commercial' && tile.building.type !== 'grass') color = '#38bdf8';
        else if (tile.zone === 'commercial') color = '#1d4ed8';
        else if (tile.zone === 'industrial' && tile.building.type !== 'grass') color = '#f59e0b';
        else if (tile.zone === 'industrial') color = '#b45309';
        else if (['police_station', 'fire_station', 'hospital', 'school', 'university'].includes(tile.building.type)) {
          color = '#c084fc';
        } else if (tile.building.type === 'power_plant') color = '#f97316';
        else if (tile.building.type === 'water_tower') color = '#06b6d4';
        else if (tile.building.type === 'park' || tile.building.type === 'park_large' || tile.building.type === 'tennis') color = '#84cc16';
        else if (tile.building.onFire) color = '#ef4444';
        
        ctx.fillStyle = color;
        ctx.fillRect(x * scale, y * scale, Math.ceil(scale), Math.ceil(scale));
      }
    }
  }, [grid, gridSize]);
  
  return (
    <Card className="absolute bottom-6 right-8 p-3 shadow-lg bg-card/90 border-border/70">
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold mb-2">
        Minimap
      </div>
      <canvas
        ref={canvasRef}
        width={140}
        height={140}
        className="block rounded-md border border-border/60"
      />
      <div className="mt-2 grid grid-cols-4 gap-1 text-[8px]">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-green-500 rounded-sm" />
          <span className="text-muted-foreground">R</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-blue-500 rounded-sm" />
          <span className="text-muted-foreground">C</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-amber-500 rounded-sm" />
          <span className="text-muted-foreground">I</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-pink-500 rounded-sm" />
          <span className="text-muted-foreground">S</span>
        </div>
      </div>
    </Card>
  );
});

// Tile Info Panel
function TileInfoPanel({ 
  tile, 
  services, 
  onClose 
}: { 
  tile: Tile; 
  services: { police: number[][]; fire: number[][]; health: number[][]; education: number[][]; power: boolean[][]; water: boolean[][] };
  onClose: () => void;
}) {
  const { x, y } = tile;
  
  return (
    <Card className="absolute top-4 right-4 w-72">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Tile ({x}, {y})</CardTitle>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <CloseIcon size={14} />
        </Button>
      </CardHeader>
      
      <CardContent className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Building</span>
          <span className="capitalize">{tile.building.type.replace(/_/g, ' ')}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Zone</span>
          <Badge variant={
            tile.zone === 'residential' ? 'default' :
            tile.zone === 'commercial' ? 'secondary' :
            tile.zone === 'industrial' ? 'outline' : 'secondary'
          } className={
            tile.zone === 'residential' ? 'bg-green-500/20 text-green-400' :
            tile.zone === 'commercial' ? 'bg-blue-500/20 text-blue-400' :
            tile.zone === 'industrial' ? 'bg-amber-500/20 text-amber-400' : ''
          }>
            {tile.zone === 'none' ? 'Unzoned' : tile.zone}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Level</span>
          <span>{tile.building.level}/5</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Population</span>
          <span>{tile.building.population}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Jobs</span>
          <span>{tile.building.jobs}</span>
        </div>
        
        <Separator />
        
        <div className="flex justify-between">
          <span className="text-muted-foreground">Power</span>
          <Badge variant={tile.building.powered ? 'default' : 'destructive'}>
            {tile.building.powered ? 'Connected' : 'No Power'}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Water</span>
          <Badge variant={tile.building.watered ? 'default' : 'destructive'} className={tile.building.watered ? 'bg-cyan-500/20 text-cyan-400' : ''}>
            {tile.building.watered ? 'Connected' : 'No Water'}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Land Value</span>
          <span>${tile.landValue}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Pollution</span>
          <span className={tile.pollution > 50 ? 'text-red-400' : tile.pollution > 25 ? 'text-amber-400' : 'text-green-400'}>
            {Math.round(tile.pollution)}%
          </span>
        </div>
        
        {tile.building.onFire && (
          <>
            <Separator />
            <div className="flex justify-between text-red-400">
              <span>ON FIRE!</span>
              <span>{Math.round(tile.building.fireProgress)}% damage</span>
            </div>
          </>
        )}
        
        <Separator />
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Service Coverage</div>
        
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Police</span>
            <span>{Math.round(services.police[y][x])}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fire</span>
            <span>{Math.round(services.fire[y][x])}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Health</span>
            <span>{Math.round(services.health[y][x])}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Education</span>
            <span>{Math.round(services.education[y][x])}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Budget Panel
function BudgetPanel() {
  const { state, setActivePanel, setBudgetFunding } = useGame();
  const { budget, stats } = state;
  
  const categories = [
    { key: 'police', ...budget.police },
    { key: 'fire', ...budget.fire },
    { key: 'health', ...budget.health },
    { key: 'education', ...budget.education },
    { key: 'transportation', ...budget.transportation },
    { key: 'parks', ...budget.parks },
    { key: 'power', ...budget.power },
    { key: 'water', ...budget.water },
  ];
  
  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Budget</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4 pb-4 border-b border-border">
            <div>
              <div className="text-muted-foreground text-xs mb-1">Income</div>
              <div className="text-green-400 font-mono">${stats.income.toLocaleString()}/mo</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs mb-1">Expenses</div>
              <div className="text-red-400 font-mono">${stats.expenses.toLocaleString()}/mo</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs mb-1">Net</div>
              <div className={`font-mono ${stats.income - stats.expenses >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${(stats.income - stats.expenses).toLocaleString()}/mo
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            {categories.map(cat => (
              <div key={cat.key} className="flex items-center gap-4">
                <Label className="w-28 text-sm">{cat.name}</Label>
                <Slider
                  value={[cat.funding]}
                  onValueChange={(value) => setBudgetFunding(cat.key as keyof typeof budget, value[0])}
                  min={0}
                  max={100}
                  step={5}
                  className="flex-1"
                />
                <span className="w-12 text-right font-mono text-sm">{cat.funding}%</span>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Achievements Panel
function AchievementsPanel() {
  const { state, setActivePanel } = useGame();
  const { achievements } = state;
  
  const unlocked = achievements.filter(a => a.unlocked);
  const locked = achievements.filter(a => !a.unlocked);
  
  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-[500px] max-h-[600px]">
        <DialogHeader>
          <DialogTitle>Achievements ({unlocked.length}/{achievements.length})</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[450px] pr-4">
          {unlocked.length > 0 && (
            <div className="mb-6">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Unlocked</div>
              <div className="grid grid-cols-2 gap-2">
                {unlocked.map(a => (
                  <Card key={a.id} className="p-3 border-l-2 border-l-primary">
                    <div className="text-foreground text-sm font-medium">{a.name}</div>
                    <div className="text-muted-foreground text-xs mt-1">{a.description}</div>
                  </Card>
                ))}
              </div>
            </div>
          )}
          
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Locked</div>
            <div className="grid grid-cols-2 gap-2">
              {locked.map(a => (
                <Card key={a.id} className="p-3 opacity-60">
                  <div className="text-foreground text-sm font-medium">{a.name}</div>
                  <div className="text-muted-foreground text-xs mt-1">{a.requirement}</div>
                  {a.progress !== undefined && a.target && (
                    <div className="mt-2">
                      <Progress value={(a.progress / a.target) * 100} className="h-1" />
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {a.progress.toLocaleString()} / {a.target.toLocaleString()}
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// Statistics Panel
function StatisticsPanel() {
  const { state, setActivePanel } = useGame();
  const { history, stats } = state;
  const [activeTab, setActiveTab] = useState<'population' | 'money' | 'happiness'>('population');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || history.length < 2) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;
    
    ctx.fillStyle = '#1a1f2e';
    ctx.fillRect(0, 0, width, height);
    
    let data: number[] = [];
    let color = '#10b981';
    const formatValue = (v: number) => v.toLocaleString();
    
    switch (activeTab) {
      case 'population':
        data = history.map(h => h.population);
        color = '#10b981';
        break;
      case 'money':
        data = history.map(h => h.money);
        color = '#f59e0b';
        break;
      case 'happiness':
        data = history.map(h => h.happiness);
        color = '#ec4899';
        break;
    }
    
    if (data.length < 2) return;
    
    const minVal = Math.min(...data);
    const maxVal = Math.max(...data);
    const range = maxVal - minVal || 1;
    
    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = padding + (height - padding * 2) * (i / 4);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const stepX = (width - padding * 2) / (data.length - 1);
    
    data.forEach((val, i) => {
      const x = padding + i * stepX;
      const y = padding + (height - padding * 2) * (1 - (val - minVal) / range);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
  }, [history, activeTab]);
  
  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-[600px]">
        <DialogHeader>
          <DialogTitle>City Statistics</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <Card className="p-3">
              <div className="text-muted-foreground text-xs mb-1">Population</div>
              <div className="font-mono font-semibold text-green-400">{stats.population.toLocaleString()}</div>
            </Card>
            <Card className="p-3">
              <div className="text-muted-foreground text-xs mb-1">Jobs</div>
              <div className="font-mono font-semibold text-blue-400">{stats.jobs.toLocaleString()}</div>
            </Card>
            <Card className="p-3">
              <div className="text-muted-foreground text-xs mb-1">Treasury</div>
              <div className="font-mono font-semibold text-amber-400">${stats.money.toLocaleString()}</div>
            </Card>
            <Card className="p-3">
              <div className="text-muted-foreground text-xs mb-1">Monthly</div>
              <div className={`font-mono font-semibold ${stats.income - stats.expenses >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${(stats.income - stats.expenses).toLocaleString()}
              </div>
            </Card>
          </div>
          
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="population">Population</TabsTrigger>
              <TabsTrigger value="money">Money</TabsTrigger>
              <TabsTrigger value="happiness">Happiness</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <Card className="p-4">
            {history.length < 2 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                Not enough data yet. Keep playing to see historical trends.
              </div>
            ) : (
              <canvas ref={canvasRef} width={536} height={200} className="w-full rounded-md" />
            )}
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Settings Panel
function SettingsPanel() {
  const { state, setActivePanel, setDisastersEnabled, newGame, loadState, exportState, currentSpritePack, availableSpritePacks, setSpritePack } = useGame();
  const { disastersEnabled, cityName, gridSize } = state;
  const [newCityName, setNewCityName] = useState(cityName);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const [importValue, setImportValue] = useState('');
  const [exportCopied, setExportCopied] = useState(false);
  const [importError, setImportError] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [showSpriteTest, setShowSpriteTest] = useState(false);
  
  const handleCopyExport = async () => {
    const exported = exportState();
    await navigator.clipboard.writeText(exported);
    setExportCopied(true);
    setTimeout(() => setExportCopied(false), 2000);
  };
  
  const handleImport = () => {
    setImportError(false);
    setImportSuccess(false);
    if (importValue.trim()) {
      const success = loadState(importValue.trim());
      if (success) {
        setImportSuccess(true);
        setImportValue('');
        setTimeout(() => setImportSuccess(false), 2000);
      } else {
        setImportError(true);
      }
    }
  };
  
  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-[400px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Game Settings</div>
            
            <div className="flex items-center justify-between py-2">
              <div>
                <Label>Disasters</Label>
                <p className="text-muted-foreground text-xs">Enable random fires and disasters</p>
              </div>
              <Switch
                checked={disastersEnabled}
                onCheckedChange={setDisastersEnabled}
              />
            </div>
            
            <div className="py-2">
              <Label>Sprite Pack</Label>
              <p className="text-muted-foreground text-xs mb-2">Choose building artwork style</p>
              <div className="grid grid-cols-1 gap-2">
                {availableSpritePacks.map((pack) => (
                  <button
                    key={pack.id}
                    onClick={() => setSpritePack(pack.id)}
                    className={`flex items-center gap-3 p-2 rounded-md border transition-colors text-left ${
                      currentSpritePack.id === pack.id
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border hover:border-muted-foreground/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="w-10 h-10 rounded overflow-hidden bg-muted flex-shrink-0">
                      <img 
                        src={pack.src} 
                        alt={pack.name}
                        className="w-full h-full object-cover object-top"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{pack.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{pack.src}</div>
                    </div>
                    {currentSpritePack.id === pack.id && (
                      <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">City Information</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>City Name</span>
                <span className="text-foreground">{cityName}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Grid Size</span>
                <span className="text-foreground">{gridSize} x {gridSize}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Auto-Save</span>
                <span className="text-green-400">Enabled</span>
              </div>
            </div>
          </div>
          
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Controls</div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between"><span>Pan (mouse)</span><span className="text-foreground">Alt + Drag / Middle Click</span></div>
              <div className="flex justify-between"><span>Pan (keys)</span><span className="text-foreground">W / A / S / D</span></div>
              <div className="flex justify-between"><span>Zoom</span><span className="text-foreground">Scroll Wheel</span></div>
              <div className="flex justify-between"><span>Place Multiple</span><span className="text-foreground">Click + Drag</span></div>
              <div className="flex justify-between"><span>View Tile Info</span><span className="text-foreground">Select Tool + Click</span></div>
            </div>
          </div>
          
          <Separator />
          
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Export Game</div>
            <p className="text-muted-foreground text-xs mb-2">Copy your game state to share or backup</p>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleCopyExport}
            >
              {exportCopied ? '✓ Copied!' : 'Copy Game State'}
            </Button>
          </div>
          
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Import Game</div>
            <p className="text-muted-foreground text-xs mb-2">Paste a game state to load it</p>
            <textarea
              className="w-full h-20 bg-background border border-border rounded-md p-2 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Paste game state here..."
              value={importValue}
              onChange={(e) => {
                setImportValue(e.target.value);
                setImportError(false);
                setImportSuccess(false);
              }}
            />
            {importError && (
              <p className="text-red-400 text-xs mt-1">Invalid game state. Please check and try again.</p>
            )}
            {importSuccess && (
              <p className="text-green-400 text-xs mt-1">Game loaded successfully!</p>
            )}
            <Button
              variant="outline"
              className="w-full mt-2"
              onClick={handleImport}
              disabled={!importValue.trim()}
            >
              Load Game State
            </Button>
          </div>
          
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Developer Tools</div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowSpriteTest(true)}
            >
              Open Sprite Test View
            </Button>
          </div>
          
          <Separator />
          
          {!showNewGameConfirm ? (
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => setShowNewGameConfirm(true)}
            >
              Start New Game
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm text-center">Are you sure? This will reset all progress.</p>
              <Input
                value={newCityName}
                onChange={(e) => setNewCityName(e.target.value)}
                placeholder="New city name..."
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowNewGameConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    newGame(newCityName || 'New City', gridSize);
                    setActivePanel('none');
                  }}
                >
                  Reset
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
      
      {showSpriteTest && (
        <SpriteTestPanel onClose={() => setShowSpriteTest(false)} />
      )}
    </Dialog>
  );
}

// Background color to filter
const BACKGROUND_COLOR = { r: 255, g: 0, b: 0 };
// Color distance threshold - pixels within this distance will be made transparent
const COLOR_THRESHOLD = 180; // Adjust this value to be more/less aggressive (increased from 10 for better filtering)

/**
 * Filters colors close to the background color from an image, making them transparent
 * @param img The source image to process
 * @param threshold Maximum color distance to consider as background (default: COLOR_THRESHOLD)
 * @returns A new HTMLImageElement with filtered colors made transparent
 */
function filterBackgroundColor(img: HTMLImageElement, threshold: number = COLOR_THRESHOLD): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    try {
      console.log('Starting background color filtering...', { 
        imageSize: `${img.naturalWidth || img.width}x${img.naturalHeight || img.height}`,
        threshold,
        backgroundColor: BACKGROUND_COLOR
      });
      
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      // Draw the original image to the canvas
      ctx.drawImage(img, 0, 0);
      
      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      console.log(`Processing ${data.length / 4} pixels...`);
      
      // Process each pixel
      let filteredCount = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Calculate color distance using Euclidean distance in RGB space
        const distance = Math.sqrt(
          Math.pow(r - BACKGROUND_COLOR.r, 2) +
          Math.pow(g - BACKGROUND_COLOR.g, 2) +
          Math.pow(b - BACKGROUND_COLOR.b, 2)
        );
        
        // If the color is close to the background color, make it transparent
        if (distance <= threshold) {
          data[i + 3] = 0; // Set alpha to 0 (transparent)
          filteredCount++;
        }
      }
      
      // Debug: log filtering results
      const totalPixels = data.length / 4;
      const percentage = filteredCount > 0 ? ((filteredCount / totalPixels) * 100).toFixed(2) : '0.00';
      console.log(`Filtered ${filteredCount} pixels (${percentage}%) from sprite sheet`);
      
      // Put the modified image data back
      ctx.putImageData(imageData, 0, 0);
      
      // Create a new image from the processed canvas
      const filteredImg = new Image();
      filteredImg.onload = () => {
        console.log('Filtered image created successfully');
        resolve(filteredImg);
      };
      filteredImg.onerror = (error) => {
        console.error('Failed to create filtered image:', error);
        reject(new Error('Failed to create filtered image'));
      };
      filteredImg.src = canvas.toDataURL();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Loads an image and applies background color filtering if it's a sprite sheet
 * @param src The image source path
 * @param applyFilter Whether to apply background color filtering (default: true for sprite sheets)
 * @returns Promise resolving to the loaded (and optionally filtered) image
 */
function loadSpriteImage(src: string, applyFilter: boolean = true): Promise<HTMLImageElement> {
  // Check if this is already cached (as filtered version)
  const cacheKey = applyFilter ? `${src}_filtered` : src;
  if (imageCache.has(cacheKey)) {
    return Promise.resolve(imageCache.get(cacheKey)!);
  }
  
  return loadImage(src).then((img) => {
    if (applyFilter) {
      return filterBackgroundColor(img).then((filteredImg: HTMLImageElement) => {
        imageCache.set(cacheKey, filteredImg);
        return filteredImg;
      });
    }
    return img;
  });
}

// Sprite Test Panel
function SpriteTestPanel({ onClose }: { onClose: () => void }) {
  const { currentSpritePack } = useGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [spriteSheet, setSpriteSheet] = useState<HTMLImageElement | null>(null);
  
  // Load sprite sheet from current pack
  useEffect(() => {
    const img = new Image();
    img.onload = () => setSpriteSheet(img);
    img.src = currentSpritePack.src;
  }, [currentSpritePack]);
  
  // Draw sprite test grid
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !spriteSheet) return;
    
    const ctx = canvas.getContext('2d', { 
      willReadFrequently: false,
      alpha: true 
    });
    if (!ctx) return;
    
    // High-DPI rendering for crisp quality
    const dpr = window.devicePixelRatio || 1;
    
    // Improve image rendering quality for pixel art
    ctx.imageSmoothingEnabled = false;
    ctx.imageSmoothingQuality = 'high';
    
    // Grid setup - arrange sprites in rows of 5
    const cols = 5;
    const rows = Math.ceil(currentSpritePack.spriteOrder.length / cols);
    const tileW = 64;
    const tileH = tileW * 0.6;
    const padding = 30;
    const labelHeight = 20;
    
    // Canvas size - account for sprite extending beyond base position
    const canvasWidth = cols * tileW * 2 + padding * 2;
    const canvasHeight = rows * (tileH * 3 + labelHeight) + padding * 2;
    
    // Set actual size in memory (scaled for device pixel ratio)
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    
    // Scale the canvas back down using CSS
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    
    // Scale the drawing context so everything draws at the correct size
    ctx.scale(dpr, dpr);
    
    // Clear with dark background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw grid and sprites
    const sheetWidth = spriteSheet.naturalWidth || spriteSheet.width;
    const sheetHeight = spriteSheet.naturalHeight || spriteSheet.height;
    
    currentSpritePack.spriteOrder.forEach((spriteKey, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      
      // Calculate isometric position for this grid cell
      // Add offset to account for sprites extending left and up from base position
      const baseX = padding + tileW + col * tileW * 1.5;
      const baseY = padding + tileH + row * (tileH * 3 + labelHeight);
      
      // Draw isometric tile outline (diamond shape)
      ctx.strokeStyle = '#3d3d5c';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(baseX, baseY - tileH / 2);
      ctx.lineTo(baseX + tileW / 2, baseY);
      ctx.lineTo(baseX, baseY + tileH / 2);
      ctx.lineTo(baseX - tileW / 2, baseY);
      ctx.closePath();
      ctx.stroke();
      
      // Fill with slight color
      ctx.fillStyle = '#2a2a4a';
      ctx.fill();
      
      // Find a building type that maps to this sprite key
      const buildingType = Object.entries(currentSpritePack.buildingToSprite).find(
        ([, value]) => value === spriteKey
      )?.[0] || spriteKey;
      
      // Get sprite coordinates using the current pack
      const coords = getSpriteCoords(buildingType, sheetWidth, sheetHeight, currentSpritePack);
      
      if (coords) {
        // Calculate destination size preserving aspect ratio
        const destWidth = tileW * 1.2;
        const aspectRatio = coords.sh / coords.sw;
        const destHeight = destWidth * aspectRatio;
        
        // Position: center on tile
        const drawX = baseX - destWidth / 2;
        const drawY = baseY + tileH / 2 - destHeight + destHeight * 0.15;
        
        // Draw sprite (using filtered version if available)
        const filteredSpriteSheet = imageCache.get(`${currentSpritePack.src}_filtered`) || spriteSheet;
        ctx.drawImage(
          filteredSpriteSheet,
          coords.sx, coords.sy, coords.sw, coords.sh,
          Math.round(drawX), Math.round(drawY),
          Math.round(destWidth), Math.round(destHeight)
        );
      }
      
      // Draw label
      ctx.fillStyle = '#888';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(spriteKey, baseX, baseY + tileH + 16);
      
      // Draw index
      ctx.fillStyle = '#666';
      ctx.font = '8px monospace';
      ctx.fillText(`[${index}]`, baseX, baseY + tileH + 26);
    });
  }, [spriteSheet, currentSpritePack]);
  
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Sprite Test View</DialogTitle>
          <DialogDescription>
            All {currentSpritePack.spriteOrder.length} sprites from "{currentSpritePack.name}". Index shown in brackets.
          </DialogDescription>
        </DialogHeader>
        
        <div className="overflow-auto max-h-[70vh] bg-[#1a1a2e] rounded-lg">
          <canvas
            ref={canvasRef}
            className="mx-auto"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>
        
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Sprite sheet: {currentSpritePack.src} ({currentSpritePack.cols}x{currentSpritePack.rows} grid)</p>
          <p>Edit offsets in <code className="bg-muted px-1 rounded">src/lib/renderConfig.ts</code> → each sprite pack's verticalOffsets</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Advisors Panel
function AdvisorsPanel() {
  const { state, setActivePanel } = useGame();
  const { advisorMessages, stats } = state;
  
  const avgRating = (stats.happiness + stats.health + stats.education + stats.safety + stats.environment) / 5;
  const grade = avgRating >= 90 ? 'A+' : avgRating >= 80 ? 'A' : avgRating >= 70 ? 'B' : avgRating >= 60 ? 'C' : avgRating >= 50 ? 'D' : 'F';
  const gradeColor = avgRating >= 70 ? 'text-green-400' : avgRating >= 50 ? 'text-amber-400' : 'text-red-400';
  
  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-[500px] max-h-[600px]">
        <DialogHeader>
          <DialogTitle>City Advisors</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Card className="flex items-center gap-4 p-4">
            <div 
              className={`w-16 h-16 flex items-center justify-center text-3xl font-black rounded-md ${gradeColor} bg-secondary`}
            >
              {grade}
            </div>
            <div>
              <div className="text-foreground font-semibold">Overall City Rating</div>
              <div className="text-muted-foreground text-sm">Based on happiness, health, education, safety & environment</div>
            </div>
          </Card>
          
          <ScrollArea className="max-h-[350px]">
            <div className="space-y-3 pr-4">
              {advisorMessages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AdvisorIcon size={32} className="mx-auto mb-3 opacity-50" />
                  <div className="text-sm">No urgent issues to report!</div>
                  <div className="text-xs mt-1">Your city is running smoothly.</div>
                </div>
              ) : (
                advisorMessages.map((advisor, i) => (
                  <Card key={i} className={`p-3 ${
                    advisor.priority === 'critical' ? 'border-l-2 border-l-red-500' :
                    advisor.priority === 'high' ? 'border-l-2 border-l-amber-500' :
                    advisor.priority === 'medium' ? 'border-l-2 border-l-yellow-500' : ''
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg text-muted-foreground">
                        {ADVISOR_ICON_MAP[advisor.icon] || <InfoIcon size={18} />}
                      </span>
                      <span className="text-foreground font-medium text-sm">{advisor.name}</span>
                      <Badge 
                        variant={
                          advisor.priority === 'critical' ? 'destructive' :
                          advisor.priority === 'high' ? 'destructive' : 'secondary'
                        }
                        className="ml-auto text-[10px]"
                      >
                        {advisor.priority}
                      </Badge>
                    </div>
                    {advisor.messages.map((msg, j) => (
                      <div key={j} className="text-muted-foreground text-sm leading-relaxed">{msg}</div>
                    ))}
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type OverlayMode = 'none' | 'power' | 'water' | 'fire' | 'police' | 'health' | 'education';

// Image cache for building sprites
const imageCache = new Map<string, HTMLImageElement>();

function loadImage(src: string): Promise<HTMLImageElement> {
  if (imageCache.has(src)) {
    return Promise.resolve(imageCache.get(src)!);
  }
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

// Canvas-based Isometric Grid - HIGH PERFORMANCE
function CanvasIsometricGrid({ overlayMode, selectedTile, setSelectedTile }: { 
  overlayMode: OverlayMode; 
  selectedTile: { x: number; y: number } | null; 
  setSelectedTile: (tile: { x: number; y: number } | null) => void;
}) {
  const { state, placeAtTile, connectToCity, currentSpritePack } = useGame();
  const { grid, gridSize, selectedTool, speed, adjacentCities, waterBodies } = state;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const carsCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 620, y: 160 });
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredTile, setHoveredTile] = useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const carsRef = useRef<Car[]>([]);
  const carIdRef = useRef(0);
  const carSpawnTimerRef = useRef(0);
  const emergencyVehiclesRef = useRef<EmergencyVehicle[]>([]);
  const emergencyVehicleIdRef = useRef(0);
  const emergencyDispatchTimerRef = useRef(0);
  const activeFiresRef = useRef<Set<string>>(new Set()); // Track fires that already have a truck dispatched
  const activeCrimesRef = useRef<Set<string>>(new Set()); // Track crimes that already have a car dispatched
  const worldStateRef = useRef<WorldRenderState>({
    grid,
    gridSize,
    offset,
    zoom,
    speed,
  });
  const [lastPlacedTile, setLastPlacedTile] = useState<{ x: number; y: number } | null>(null);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 });
  const [dragStartTile, setDragStartTile] = useState<{ x: number; y: number } | null>(null);
  const [dragEndTile, setDragEndTile] = useState<{ x: number; y: number } | null>(null);
  const [cityConnectionDialog, setCityConnectionDialog] = useState<{ direction: 'north' | 'south' | 'east' | 'west' } | null>(null);
  const keysPressedRef = useRef<Set<string>>(new Set());

  // Only zoning tools show the grid/rectangle selection visualization
  const showsDragGrid = ['zone_residential', 'zone_commercial', 'zone_industrial', 'zone_dezone'].includes(selectedTool);
  
  // Roads, bulldoze, and other tools support drag-to-place but don't show the grid
  const supportsDragPlace = selectedTool !== 'select';
  
  useEffect(() => {
    worldStateRef.current.grid = grid;
    worldStateRef.current.gridSize = gridSize;
  }, [grid, gridSize]);

  useEffect(() => {
    worldStateRef.current.offset = offset;
  }, [offset]);

  useEffect(() => {
    worldStateRef.current.zoom = zoom;
  }, [zoom]);

  useEffect(() => {
    worldStateRef.current.speed = speed;
  }, [speed]);

  // Keyboard panning (WASD / arrow keys)
  useEffect(() => {
    const pressed = keysPressedRef.current;
    const isTypingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return !!el?.closest('input, textarea, select, [contenteditable="true"]');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key)) {
        pressed.add(key);
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      pressed.delete(key);
    };

    let animationFrameId = 0;
    let lastTime = performance.now();

    const tick = (time: number) => {
      animationFrameId = requestAnimationFrame(tick);
      const delta = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      if (!pressed.size) return;

      let dx = 0;
      let dy = 0;
      if (pressed.has('w') || pressed.has('arrowup')) dy += KEY_PAN_SPEED * delta;
      if (pressed.has('s') || pressed.has('arrowdown')) dy -= KEY_PAN_SPEED * delta;
      if (pressed.has('a') || pressed.has('arrowleft')) dx += KEY_PAN_SPEED * delta;
      if (pressed.has('d') || pressed.has('arrowright')) dx -= KEY_PAN_SPEED * delta;

      if (dx !== 0 || dy !== 0) {
        setOffset(prev => ({
          x: prev.x + dx,
          y: prev.y + dy,
        }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    animationFrameId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animationFrameId);
      pressed.clear();
    };
  }, []);

  const spawnRandomCar = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return false;
    
    for (let attempt = 0; attempt < 20; attempt++) {
      const tileX = Math.floor(Math.random() * currentGridSize);
      const tileY = Math.floor(Math.random() * currentGridSize);
      if (!isRoadTile(currentGrid, currentGridSize, tileX, tileY)) continue;
      
      const options = getDirectionOptions(currentGrid, currentGridSize, tileX, tileY);
      if (options.length === 0) continue;
      
      const direction = options[Math.floor(Math.random() * options.length)];
      carsRef.current.push({
        id: carIdRef.current++,
        tileX,
        tileY,
        direction,
        progress: Math.random() * 0.8,
        speed: (0.35 + Math.random() * 0.35) * 0.7,
        age: 0,
        maxAge: 360 + Math.random() * 540,
        color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
        laneOffset: (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 3),
      });
      return true;
    }
    
    return false;
  }, []);

  // Find all fire stations in the grid
  const findStations = useCallback((type: 'fire_station' | 'police_station'): { x: number; y: number }[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return [];
    
    const stations: { x: number; y: number }[] = [];
    for (let y = 0; y < currentGridSize; y++) {
      for (let x = 0; x < currentGridSize; x++) {
        if (currentGrid[y][x].building.type === type) {
          stations.push({ x, y });
        }
      }
    }
    return stations;
  }, []);

  // Find all active fires in the grid
  const findFires = useCallback((): { x: number; y: number }[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return [];
    
    const fires: { x: number; y: number }[] = [];
    for (let y = 0; y < currentGridSize; y++) {
      for (let x = 0; x < currentGridSize; x++) {
        if (currentGrid[y][x].building.onFire) {
          fires.push({ x, y });
        }
      }
    }
    return fires;
  }, []);

  // Find tiles with high crime (simulated based on low police coverage)
  const findCrimeIncidents = useCallback((): { x: number; y: number }[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return [];
    
    const crimes: { x: number; y: number }[] = [];
    // Look for buildings with low police coverage - simulate crime incidents there
    for (let y = 0; y < currentGridSize; y++) {
      for (let x = 0; x < currentGridSize; x++) {
        const tile = currentGrid[y][x];
        // Only consider populated buildings (residential/commercial)
        if (tile.building.type !== 'grass' && 
            tile.building.type !== 'water' && 
            tile.building.type !== 'road' && 
            tile.building.type !== 'tree' &&
            tile.building.type !== 'empty' &&
            tile.building.population > 0 || tile.building.jobs > 0) {
          // Simulate crime incidents in areas with some activity
          // Higher chance in areas with low police coverage
          const policeCoverage = state.services.police[y]?.[x] || 0;
          if (policeCoverage < 30 && Math.random() < 0.001) {
            crimes.push({ x, y });
          }
        }
      }
    }
    return crimes;
  }, [state.services.police]);

  // Dispatch emergency vehicle
  const dispatchEmergencyVehicle = useCallback((
    type: EmergencyVehicleType,
    stationX: number,
    stationY: number,
    targetX: number,
    targetY: number
  ): boolean => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return false;

    const path = findPathOnRoads(currentGrid, currentGridSize, stationX, stationY, targetX, targetY);
    if (!path || path.length === 0) return false;

    const startTile = path[0];
    let direction: CarDirection = 'south'; // Default direction
    
    // If path has at least 2 tiles, get direction from first to second
    if (path.length >= 2) {
      const nextTile = path[1];
      const dir = getDirectionToTile(startTile.x, startTile.y, nextTile.x, nextTile.y);
      if (dir) direction = dir;
    }

    emergencyVehiclesRef.current.push({
      id: emergencyVehicleIdRef.current++,
      type,
      tileX: startTile.x,
      tileY: startTile.y,
      direction,
      progress: 0,
      speed: type === 'fire_truck' ? 0.8 : 0.9, // Emergency vehicles are faster
      state: 'dispatching',
      stationX,
      stationY,
      targetX,
      targetY,
      path,
      pathIndex: 0,
      respondTime: 0,
      laneOffset: 0, // Emergency vehicles drive in the center
      flashTimer: 0,
    });

    return true;
  }, []);

  // Update emergency vehicles dispatch logic
  const updateEmergencyDispatch = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) return;
    
    const fires = findFires();
    const fireStations = findStations('fire_station');
    
    for (const fire of fires) {
      const fireKey = `${fire.x},${fire.y}`;
      if (activeFiresRef.current.has(fireKey)) continue;
      
      // Find nearest fire station
      let nearestStation: { x: number; y: number } | null = null;
      let nearestDist = Infinity;
      
      for (const station of fireStations) {
        const dist = Math.abs(station.x - fire.x) + Math.abs(station.y - fire.y);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestStation = station;
        }
      }
      
      if (nearestStation) {
        if (dispatchEmergencyVehicle('fire_truck', nearestStation.x, nearestStation.y, fire.x, fire.y)) {
          activeFiresRef.current.add(fireKey);
        }
      }
    }

    // Find crimes that need police dispatched
    const crimes = findCrimeIncidents();
    const policeStations = findStations('police_station');
    
    // Limit police dispatches per update to avoid too many at once
    let dispatched = 0;
    for (const crime of crimes) {
      if (dispatched >= 2) break; // Max 2 new police cars per check
      
      const crimeKey = `${crime.x},${crime.y}`;
      if (activeCrimesRef.current.has(crimeKey)) continue;
      
      // Find nearest police station
      let nearestStation: { x: number; y: number } | null = null;
      let nearestDist = Infinity;
      
      for (const station of policeStations) {
        const dist = Math.abs(station.x - crime.x) + Math.abs(station.y - crime.y);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestStation = station;
        }
      }
      
      if (nearestStation) {
        if (dispatchEmergencyVehicle('police_car', nearestStation.x, nearestStation.y, crime.x, crime.y)) {
          activeCrimesRef.current.add(crimeKey);
          dispatched++;
        }
      }
    }
  }, [findFires, findCrimeIncidents, findStations, dispatchEmergencyVehicle]);

  // Update emergency vehicles movement and state
  const updateEmergencyVehicles = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) {
      emergencyVehiclesRef.current = [];
      return;
    }

    const speedMultiplier = currentSpeed === 0 ? 0 : currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2.5 : 4;
    
    // Dispatch check every second or so
    emergencyDispatchTimerRef.current -= delta;
    if (emergencyDispatchTimerRef.current <= 0) {
      updateEmergencyDispatch();
      emergencyDispatchTimerRef.current = 1.5;
    }

    const updatedVehicles: EmergencyVehicle[] = [];
    
    for (const vehicle of emergencyVehiclesRef.current) {
      // Update flash timer for lights
      vehicle.flashTimer += delta * 8;
      
      if (vehicle.state === 'responding') {
        // At the scene - spend some time responding
        vehicle.respondTime += delta * speedMultiplier;
        const respondDuration = vehicle.type === 'fire_truck' ? 8 : 5; // Fire trucks stay longer
        
        if (vehicle.respondTime >= respondDuration) {
          // Done responding - calculate return path
          const returnPath = findPathOnRoads(
            currentGrid, currentGridSize,
            vehicle.tileX, vehicle.tileY,
            vehicle.stationX, vehicle.stationY
          );
          
          if (returnPath && returnPath.length >= 2) {
            vehicle.path = returnPath;
            vehicle.pathIndex = 0;
            vehicle.state = 'returning';
            vehicle.progress = 0;
            
            const nextTile = returnPath[1];
            const dir = getDirectionToTile(vehicle.tileX, vehicle.tileY, nextTile.x, nextTile.y);
            if (dir) vehicle.direction = dir;
          } else {
            // Can't find return path - remove vehicle and clear tracking
            const targetKey = `${vehicle.targetX},${vehicle.targetY}`;
            if (vehicle.type === 'fire_truck') {
              activeFiresRef.current.delete(targetKey);
            } else {
              activeCrimesRef.current.delete(targetKey);
            }
            continue;
          }
        }
        
        updatedVehicles.push(vehicle);
        continue;
      }
      
      // Check if vehicle is still on a valid road
      if (!isRoadTile(currentGrid, currentGridSize, vehicle.tileX, vehicle.tileY)) {
        const targetKey = `${vehicle.targetX},${vehicle.targetY}`;
        if (vehicle.type === 'fire_truck') {
          activeFiresRef.current.delete(targetKey);
        } else {
          activeCrimesRef.current.delete(targetKey);
        }
        continue;
      }
      
      // Move vehicle along path
      vehicle.progress += vehicle.speed * delta * speedMultiplier;
      
      while (vehicle.progress >= 1 && vehicle.pathIndex < vehicle.path.length - 1) {
        vehicle.pathIndex++;
        vehicle.progress -= 1;
        
        const currentTile = vehicle.path[vehicle.pathIndex];
        vehicle.tileX = currentTile.x;
        vehicle.tileY = currentTile.y;
        
        // Check if reached destination
        if (vehicle.pathIndex >= vehicle.path.length - 1) {
          if (vehicle.state === 'dispatching') {
            // Arrived at emergency scene
            vehicle.state = 'responding';
            vehicle.respondTime = 0;
          } else if (vehicle.state === 'returning') {
            // Arrived back at station - remove vehicle
            const targetKey = `${vehicle.targetX},${vehicle.targetY}`;
            if (vehicle.type === 'fire_truck') {
              activeFiresRef.current.delete(targetKey);
            } else {
              activeCrimesRef.current.delete(targetKey);
            }
            continue; // Don't add to updated list - vehicle is done
          }
          break;
        }
        
        // Update direction for next segment
        const nextTile = vehicle.path[vehicle.pathIndex + 1];
        const dir = getDirectionToTile(vehicle.tileX, vehicle.tileY, nextTile.x, nextTile.y);
        if (dir) vehicle.direction = dir;
      }
      
      updatedVehicles.push(vehicle);
    }
    
    emergencyVehiclesRef.current = updatedVehicles;
  }, [updateEmergencyDispatch]);

  const updateCars = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) {
      carsRef.current = [];
      return;
    }
    
    // Speed multiplier: 0 = paused, 1 = normal, 2 = fast (2x), 3 = very fast (4x)
    const speedMultiplier = currentSpeed === 0 ? 0 : currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2.5 : 4;
    
    const maxCars = Math.min(160, Math.max(16, Math.floor(currentGridSize * 2)));
    carSpawnTimerRef.current -= delta;
    if (carsRef.current.length < maxCars && carSpawnTimerRef.current <= 0) {
      if (spawnRandomCar()) {
        carSpawnTimerRef.current = 0.9 + Math.random() * 1.3;
      } else {
        carSpawnTimerRef.current = 0.5;
      }
    }
    
    const updatedCars: Car[] = [];
    for (const car of carsRef.current) {
      let alive = true;
      
      car.age += delta;
      if (car.age > car.maxAge) {
        continue;
      }
      
      if (!isRoadTile(currentGrid, currentGridSize, car.tileX, car.tileY)) {
        continue;
      }
      
      car.progress += car.speed * delta * speedMultiplier;
      let guard = 0;
      while (car.progress >= 1 && guard < 4) {
        guard++;
        const meta = DIRECTION_META[car.direction];
        car.tileX += meta.step.x;
        car.tileY += meta.step.y;
        
        if (!isRoadTile(currentGrid, currentGridSize, car.tileX, car.tileY)) {
          alive = false;
          break;
        }
        
        car.progress -= 1;
        const nextDirection = pickNextDirection(car.direction, currentGrid, currentGridSize, car.tileX, car.tileY);
        if (!nextDirection) {
          alive = false;
          break;
        }
        car.direction = nextDirection;
      }
      
      if (alive) {
        updatedCars.push(car);
      }
    }
    
    carsRef.current = updatedCars;
  }, [spawnRandomCar]);

  const drawCars = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Early exit if no grid data
    if (!currentGrid || currentGridSize <= 0 || carsRef.current.length === 0) {
      return;
    }
    
    ctx.save();
    ctx.scale(dpr * currentZoom, dpr * currentZoom);
    ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);
    
    const viewWidth = canvas.width / (dpr * currentZoom);
    const viewHeight = canvas.height / (dpr * currentZoom);
    const viewLeft = -currentOffset.x / currentZoom - TILE_WIDTH;
    const viewTop = -currentOffset.y / currentZoom - TILE_HEIGHT * 2;
    const viewRight = viewWidth - currentOffset.x / currentZoom + TILE_WIDTH;
    const viewBottom = viewHeight - currentOffset.y / currentZoom + TILE_HEIGHT * 2;
    
    // Helper function to check if a car is behind a building
    const isCarBehindBuilding = (carTileX: number, carTileY: number): boolean => {
      // Only check tiles directly in front (higher depth means drawn later/on top)
      const carDepth = carTileX + carTileY;
      
      // Check a small area - just tiles that could visually cover the car
      for (let dy = 0; dy <= 1; dy++) {
        for (let dx = 0; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue; // Skip the car's own tile
          
          const checkX = carTileX + dx;
          const checkY = carTileY + dy;
          
          // Skip if out of bounds
          if (checkX < 0 || checkY < 0 || checkX >= currentGridSize || checkY >= currentGridSize) {
            continue;
          }
          
          const tile = currentGrid[checkY]?.[checkX];
          if (!tile) continue;
          
          const buildingType = tile.building.type;
          
          // Skip roads, grass, empty, water, and trees (these don't hide cars)
          const skipTypes: BuildingType[] = ['road', 'grass', 'empty', 'water', 'tree'];
          if (skipTypes.includes(buildingType)) {
            continue;
          }
          
          // Check if this building tile has higher depth (drawn after/on top)
          const buildingDepth = checkX + checkY;
          
          // Only hide if building is strictly in front (higher depth)
          if (buildingDepth > carDepth) {
            return true;
          }
        }
      }
      
      return false;
    };
    
    carsRef.current.forEach(car => {
      const { screenX, screenY } = gridToScreen(car.tileX, car.tileY, 0, 0);
      const centerX = screenX + TILE_WIDTH / 2;
      const centerY = screenY + TILE_HEIGHT / 2;
      const meta = DIRECTION_META[car.direction];
      const carX = centerX + meta.vec.dx * car.progress + meta.normal.nx * car.laneOffset;
      const carY = centerY + meta.vec.dy * car.progress + meta.normal.ny * car.laneOffset;
      
      if (carX < viewLeft - 40 || carX > viewRight + 40 || carY < viewTop - 60 || carY > viewBottom + 60) {
        return;
      }
      
      // Check if car is behind a building - if so, skip drawing
      if (isCarBehindBuilding(car.tileX, car.tileY)) {
        return;
      }
      
      ctx.save();
      ctx.translate(carX, carY);
      ctx.rotate(meta.angle);
      
      // Scale down by 30% (multiply by 0.7)
      const scale = 0.7;
      
      ctx.fillStyle = car.color;
      ctx.beginPath();
      ctx.moveTo(-10 * scale, -5 * scale);
      ctx.lineTo(10 * scale, -5 * scale);
      ctx.lineTo(12 * scale, 0);
      ctx.lineTo(10 * scale, 5 * scale);
      ctx.lineTo(-10 * scale, 5 * scale);
      ctx.closePath();
      ctx.fill();
      
      // Windshield
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillRect(-4 * scale, -2.8 * scale, 7 * scale, 5.6 * scale);
      
      // Rear
      ctx.fillStyle = '#111827';
      ctx.fillRect(-10 * scale, -4 * scale, 2.4 * scale, 8 * scale);
      
      ctx.restore();
    });
    
    ctx.restore();
  }, []);

  // Draw emergency vehicles (fire trucks and police cars)
  const drawEmergencyVehicles = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    
    // Early exit if no emergency vehicles
    if (!currentGrid || currentGridSize <= 0 || emergencyVehiclesRef.current.length === 0) {
      return;
    }
    
    ctx.save();
    ctx.scale(dpr * currentZoom, dpr * currentZoom);
    ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);
    
    const viewWidth = canvas.width / (dpr * currentZoom);
    const viewHeight = canvas.height / (dpr * currentZoom);
    const viewLeft = -currentOffset.x / currentZoom - TILE_WIDTH;
    const viewTop = -currentOffset.y / currentZoom - TILE_HEIGHT * 2;
    const viewRight = viewWidth - currentOffset.x / currentZoom + TILE_WIDTH;
    const viewBottom = viewHeight - currentOffset.y / currentZoom + TILE_HEIGHT * 2;
    
    // Helper function to check if a vehicle is behind a building
    const isVehicleBehindBuilding = (tileX: number, tileY: number): boolean => {
      const vehicleDepth = tileX + tileY;
      
      for (let dy = 0; dy <= 1; dy++) {
        for (let dx = 0; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          
          const checkX = tileX + dx;
          const checkY = tileY + dy;
          
          if (checkX < 0 || checkY < 0 || checkX >= currentGridSize || checkY >= currentGridSize) {
            continue;
          }
          
          const tile = currentGrid[checkY]?.[checkX];
          if (!tile) continue;
          
          const buildingType = tile.building.type;
          const skipTypes: BuildingType[] = ['road', 'grass', 'empty', 'water', 'tree'];
          if (skipTypes.includes(buildingType)) {
            continue;
          }
          
          const buildingDepth = checkX + checkY;
          if (buildingDepth > vehicleDepth) {
            return true;
          }
        }
      }
      
      return false;
    };
    
    emergencyVehiclesRef.current.forEach(vehicle => {
      const { screenX, screenY } = gridToScreen(vehicle.tileX, vehicle.tileY, 0, 0);
      const centerX = screenX + TILE_WIDTH / 2;
      const centerY = screenY + TILE_HEIGHT / 2;
      const meta = DIRECTION_META[vehicle.direction];
      const vehicleX = centerX + meta.vec.dx * vehicle.progress + meta.normal.nx * vehicle.laneOffset;
      const vehicleY = centerY + meta.vec.dy * vehicle.progress + meta.normal.ny * vehicle.laneOffset;
      
      // View culling
      if (vehicleX < viewLeft - 40 || vehicleX > viewRight + 40 || vehicleY < viewTop - 60 || vehicleY > viewBottom + 60) {
        return;
      }
      
      ctx.save();
      ctx.translate(vehicleX, vehicleY);
      ctx.rotate(meta.angle);
      
      const scale = 0.6; // Smaller emergency vehicles
      
      // Vehicle body color
      const bodyColor = vehicle.type === 'fire_truck' ? '#dc2626' : '#1e40af';
      
      // Draw vehicle body (longer for fire trucks)
      const length = vehicle.type === 'fire_truck' ? 14 : 11;
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.moveTo(-length * scale, -5 * scale);
      ctx.lineTo(length * scale, -5 * scale);
      ctx.lineTo((length + 2) * scale, 0);
      ctx.lineTo(length * scale, 5 * scale);
      ctx.lineTo(-length * scale, 5 * scale);
      ctx.closePath();
      ctx.fill();
      
      // Draw stripe/accent
      ctx.fillStyle = vehicle.type === 'fire_truck' ? '#fbbf24' : '#ffffff';
      ctx.fillRect(-length * scale * 0.5, -3 * scale, length * scale, 6 * scale * 0.3);
      
      // Draw windshield
      ctx.fillStyle = 'rgba(200, 220, 255, 0.7)';
      ctx.fillRect(-2 * scale, -3 * scale, 5 * scale, 6 * scale);
      
      // Draw emergency lights (flashing)
      const flashOn = Math.sin(vehicle.flashTimer) > 0;
      const flashOn2 = Math.sin(vehicle.flashTimer + Math.PI) > 0;
      
      // Light bar on top
      if (vehicle.type === 'fire_truck') {
        // Fire truck has red lights
        ctx.fillStyle = flashOn ? '#ff0000' : '#880000';
        ctx.fillRect(-6 * scale, -7 * scale, 3 * scale, 3 * scale);
        ctx.fillStyle = flashOn2 ? '#ff0000' : '#880000';
        ctx.fillRect(3 * scale, -7 * scale, 3 * scale, 3 * scale);
        
        // Glow effect
        if (flashOn || flashOn2) {
          ctx.shadowColor = '#ff0000';
          ctx.shadowBlur = 6;
          ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
          ctx.fillRect(-8 * scale, -8 * scale, 16 * scale, 4 * scale);
          ctx.shadowBlur = 0;
        }
      } else {
        // Police car has red and blue lights
        ctx.fillStyle = flashOn ? '#ff0000' : '#880000';
        ctx.fillRect(-5 * scale, -7 * scale, 3 * scale, 3 * scale);
        ctx.fillStyle = flashOn2 ? '#0066ff' : '#003388';
        ctx.fillRect(2 * scale, -7 * scale, 3 * scale, 3 * scale);
        
        // Glow effect
        if (flashOn || flashOn2) {
          ctx.shadowColor = flashOn ? '#ff0000' : '#0066ff';
          ctx.shadowBlur = 6;
          ctx.fillStyle = flashOn ? 'rgba(255, 0, 0, 0.4)' : 'rgba(0, 100, 255, 0.4)';
          ctx.fillRect(-7 * scale, -8 * scale, 14 * scale, 4 * scale);
          ctx.shadowBlur = 0;
        }
      }
      
      // Draw rear wheels/details
      ctx.fillStyle = '#111827';
      ctx.fillRect(-length * scale, -4 * scale, 2 * scale, 8 * scale);
      
      ctx.restore();
    });
    
    ctx.restore();
  }, []);

  // Load sprite sheet on mount and when sprite pack changes
  useEffect(() => {
    // Load the sprite sheet with background color filtering
    setImagesLoaded(false);
    loadSpriteImage(currentSpritePack.src, true)
      .then(() => setImagesLoaded(true))
      .catch(console.error);
  }, [currentSpritePack]);
  
  // Helper function to check if a tile is part of a multi-tile building footprint
  function isPartOfMultiTileBuilding(gridX: number, gridY: number): boolean {
    // Check all possible origin positions that could have a multi-tile building covering this tile
    // For a 2x2 building, check up to 1 tile away in each direction
    // For a 3x3 building, check up to 2 tiles away
    // For a 4x4 building, check up to 3 tiles away
    const maxSize = 4; // Maximum building size
    
    for (let dy = 0; dy < maxSize; dy++) {
      for (let dx = 0; dx < maxSize; dx++) {
        const originX = gridX - dx;
        const originY = gridY - dy;
        
        if (originX >= 0 && originX < gridSize && originY >= 0 && originY < gridSize) {
          const originTile = grid[originY][originX];
          const buildingSize = getBuildingSize(originTile.building.type);
          
          // Check if this tile is within the footprint of the building at origin
          if (buildingSize.width > 1 || buildingSize.height > 1) {
            if (gridX >= originX && gridX < originX + buildingSize.width &&
                gridY >= originY && gridY < originY + buildingSize.height) {
              return true;
            }
          }
        }
      }
    }
    
    return false;
  }
  
  // Helper function to check if a tile is part of a park building footprint
  function isPartOfParkBuilding(gridX: number, gridY: number): boolean {
    const maxSize = 4; // Maximum building size
    const parkBuildings: BuildingType[] = ['park_large'];

    for (let dy = 0; dy < maxSize; dy++) {
      for (let dx = 0; dx < maxSize; dx++) {
        const originX = gridX - dx;
        const originY = gridY - dy;

        if (originX >= 0 && originX < gridSize && originY >= 0 && originY < gridSize) {
          const originTile = grid[originY][originX];

          // Check if this is a park building and if this tile is within its footprint
          if (parkBuildings.includes(originTile.building.type)) {
            const buildingSize = getBuildingSize(originTile.building.type);
            if (gridX >= originX && gridX < originX + buildingSize.width &&
                gridY >= originY && gridY < originY + buildingSize.height) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }
  
  // Update canvas size on resize with high-DPI support
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current && canvasRef.current) {
        const dpr = window.devicePixelRatio || 1;
        const rect = containerRef.current.getBoundingClientRect();
        
        // Set display size
        canvasRef.current.style.width = `${rect.width}px`;
        canvasRef.current.style.height = `${rect.height}px`;
        if (carsCanvasRef.current) {
          carsCanvasRef.current.style.width = `${rect.width}px`;
          carsCanvasRef.current.style.height = `${rect.height}px`;
        }
        
        // Set actual size in memory (scaled for DPI)
        setCanvasSize({
          width: Math.round(rect.width * dpr),
          height: Math.round(rect.height * dpr),
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);
  
  // Main render function
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imagesLoaded) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    
    // Disable image smoothing for crisp pixel art
    ctx.imageSmoothingEnabled = false;
    
    // Clear canvas with gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#0f1419');
    gradient.addColorStop(0.5, '#141c24');
    gradient.addColorStop(1, '#1a2a1f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    // Scale for device pixel ratio first, then apply zoom
    ctx.scale(dpr * zoom, dpr * zoom);
    ctx.translate(offset.x / zoom, offset.y / zoom);
    
    // Calculate visible tile range for culling (account for DPR in canvas size)
    const viewWidth = canvas.width / (dpr * zoom);
    const viewHeight = canvas.height / (dpr * zoom);
    const viewLeft = -offset.x / zoom - TILE_WIDTH;
    const viewTop = -offset.y / zoom - TILE_HEIGHT * 2;
    const viewRight = viewWidth - offset.x / zoom + TILE_WIDTH;
    const viewBottom = viewHeight - offset.y / zoom + TILE_HEIGHT * 2;
    
    type BuildingDraw = {
      screenX: number;
      screenY: number;
      tile: Tile;
      depth: number;
    };
    type OverlayDraw = {
      screenX: number;
      screenY: number;
      tile: Tile;
    };
    const buildingQueue: BuildingDraw[] = [];
    const waterQueue: BuildingDraw[] = [];
    const beachQueue: BuildingDraw[] = [];
    const baseTileQueue: BuildingDraw[] = [];
    const greenBaseTileQueue: BuildingDraw[] = [];
    const overlayQueue: OverlayDraw[] = [];
    
    // Helper function to check if a tile is adjacent to water
    function isAdjacentToWater(gridX: number, gridY: number): boolean {
      const directions = [
        [-1, 0], [1, 0], [0, -1], [0, 1], // cardinal directions
        [-1, -1], [1, -1], [-1, 1], [1, 1] // diagonal directions
      ];
      
      for (const [dx, dy] of directions) {
        const nx = gridX + dx;
        const ny = gridY + dy;
        if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
          if (grid[ny][nx].building.type === 'water') {
            return true;
          }
        }
      }
      return false;
    }
    
    // Draw tiles in isometric order (back to front)
    for (let sum = 0; sum < gridSize * 2 - 1; sum++) {
      for (let x = Math.max(0, sum - gridSize + 1); x <= Math.min(sum, gridSize - 1); x++) {
        const y = sum - x;
        if (y < 0 || y >= gridSize) continue;
        
        const { screenX, screenY } = gridToScreen(x, y, 0, 0);
        
        // Viewport culling
        if (screenX + TILE_WIDTH < viewLeft || screenX > viewRight ||
            screenY + TILE_HEIGHT * 4 < viewTop || screenY > viewBottom) {
          continue;
        }
        
        const tile = grid[y][x];
        const isHovered = hoveredTile?.x === x && hoveredTile?.y === y;
        const isSelected = selectedTile?.x === x && selectedTile?.y === y;
        
        // Check if tile is in drag selection rectangle (only show for zoning tools)
        const isInDragRect = showsDragGrid && dragStartTile && dragEndTile && 
          x >= Math.min(dragStartTile.x, dragEndTile.x) &&
          x <= Math.max(dragStartTile.x, dragEndTile.x) &&
          y >= Math.min(dragStartTile.y, dragEndTile.y) &&
          y <= Math.max(dragStartTile.y, dragEndTile.y);
        
        // Check if this tile needs a gray base tile (buildings except parks)
        const isPark = tile.building.type === 'park' || tile.building.type === 'park_large' || tile.building.type === 'tennis' ||
                       (tile.building.type === 'empty' && isPartOfParkBuilding(x, y));
        const isDirectBuilding = !isPark &&
          tile.building.type !== 'grass' &&
          tile.building.type !== 'empty' &&
          tile.building.type !== 'water' &&
          tile.building.type !== 'road' &&
          tile.building.type !== 'tree';
        const isPartOfBuilding = tile.building.type === 'empty' && isPartOfMultiTileBuilding(x, y);
        const needsGreyBase = (isDirectBuilding || isPartOfBuilding) && !isPark;
        
        // Check if this is a grass/empty tile adjacent to water (needs green base drawn over water)
        const isGrassOrEmpty = tile.building.type === 'grass' || tile.building.type === 'empty';
        const needsGreenBaseOverWater = isGrassOrEmpty && isAdjacentToWater(x, y);
        
        // Draw base tile for all tiles (including water), but skip gray bases for buildings and green bases for grass/empty adjacent to water
        drawIsometricTile(ctx, screenX, screenY, tile, !!(isHovered || isSelected || isInDragRect), zoom, true, needsGreenBaseOverWater);
        
        if (needsGreyBase) {
          baseTileQueue.push({ screenX, screenY, tile, depth: x + y });
        }
        
        if (needsGreenBaseOverWater) {
          greenBaseTileQueue.push({ screenX, screenY, tile, depth: x + y });
        }
        
        // Separate water tiles into their own queue (drawn after base tiles, below other buildings)
        if (tile.building.type === 'water') {
          const size = getBuildingSize(tile.building.type);
          const depth = x + y + size.width + size.height - 2;
          waterQueue.push({ screenX, screenY, tile, depth });
        }
        // Check for beach tiles (grass/empty tiles adjacent to water)
        else if ((tile.building.type === 'grass' || tile.building.type === 'empty') &&
                 isAdjacentToWater(x, y)) {
          beachQueue.push({ screenX, screenY, tile, depth: x + y });
        }
        // Other buildings go to regular building queue
        else {
          const isBuilding = tile.building.type !== 'grass' && tile.building.type !== 'empty';
          if (isBuilding) {
            const size = getBuildingSize(tile.building.type);
            const depth = x + y + size.width + size.height - 2;
            buildingQueue.push({ screenX, screenY, tile, depth });
          }
        }
        
        const showOverlay =
          overlayMode !== 'none' &&
          tile.building.type !== 'grass' &&
          tile.building.type !== 'water' &&
          tile.building.type !== 'road';
        if (showOverlay) {
          overlayQueue.push({ screenX, screenY, tile });
        }
      }
    }
    
    // Draw water sprites (after base tiles, below other buildings)
    waterQueue
      .sort((a, b) => a.depth - b.depth)
      .forEach(({ tile, screenX, screenY }) => {
        drawBuilding(ctx, screenX, screenY, tile);
      });
    
    // Draw green base tiles for grass/empty tiles adjacent to water (after water, before gray bases)
    greenBaseTileQueue
      .sort((a, b) => a.depth - b.depth)
      .forEach(({ tile, screenX, screenY }) => {
        drawGreenBaseTile(ctx, screenX, screenY, tile, zoom);
      });
    
    // Draw gray building base tiles (after water, before buildings)
    baseTileQueue
      .sort((a, b) => a.depth - b.depth)
      .forEach(({ tile, screenX, screenY }) => {
        drawGreyBaseTile(ctx, screenX, screenY, tile, zoom);
      });
    
    // Draw beach tiles (below buildings but above water)
    beachQueue
      .sort((a, b) => a.depth - b.depth)
      .forEach(({ tile, screenX, screenY }) => {
        drawBeach(ctx, screenX, screenY, tile.x, tile.y);
      });
    
    // Draw buildings sorted by depth so multi-tile sprites sit above adjacent tiles
    buildingQueue
      .sort((a, b) => a.depth - b.depth)
      .forEach(({ tile, screenX, screenY }) => {
        drawBuilding(ctx, screenX, screenY, tile);
      });
    
    // Draw overlays last so they remain visible on top of buildings
    overlayQueue.forEach(({ tile, screenX, screenY }) => {
      let fillStyle: string;
      
      if (overlayMode === 'power') {
        fillStyle = tile.building.powered ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)';
      } else if (overlayMode === 'water') {
        fillStyle = tile.building.watered ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)';
      } else if (overlayMode === 'fire') {
        const coverage = state.services.fire[tile.y][tile.x];
        // Red gradient: darker red = better coverage, lighter red = poor coverage
        const intensity = coverage / 100;
        fillStyle = `rgba(239, ${68 + Math.floor(intensity * 100)}, ${68 + Math.floor(intensity * 100)}, ${0.3 + intensity * 0.4})`;
      } else if (overlayMode === 'police') {
        const coverage = state.services.police[tile.y][tile.x];
        // Blue gradient: darker blue = better coverage, lighter blue = poor coverage
        const intensity = coverage / 100;
        fillStyle = `rgba(${59 + Math.floor(intensity * 100)}, ${130 + Math.floor(intensity * 100)}, ${246 - Math.floor(intensity * 50)}, ${0.3 + intensity * 0.4})`;
      } else if (overlayMode === 'health') {
        const coverage = state.services.health[tile.y][tile.x];
        // Green gradient: darker green = better coverage, lighter green = poor coverage
        const intensity = coverage / 100;
        fillStyle = `rgba(${34 + Math.floor(intensity * 100)}, ${197 - Math.floor(intensity * 50)}, ${94 + Math.floor(intensity * 50)}, ${0.3 + intensity * 0.4})`;
      } else if (overlayMode === 'education') {
        const coverage = state.services.education[tile.y][tile.x];
        // Purple gradient: darker purple = better coverage, lighter purple = poor coverage
        const intensity = coverage / 100;
        fillStyle = `rgba(${147 + Math.floor(intensity * 50)}, ${51 + Math.floor(intensity * 100)}, ${234 - Math.floor(intensity * 50)}, ${0.3 + intensity * 0.4})`;
      } else {
        fillStyle = 'rgba(128, 128, 128, 0.4)';
      }
      
      ctx.fillStyle = fillStyle;
      ctx.beginPath();
      ctx.moveTo(screenX + TILE_WIDTH / 2, screenY);
      ctx.lineTo(screenX + TILE_WIDTH, screenY + TILE_HEIGHT / 2);
      ctx.lineTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT);
      ctx.lineTo(screenX, screenY + TILE_HEIGHT / 2);
      ctx.closePath();
      ctx.fill();
    });
    
    // Draw water body names
    if (waterBodies && waterBodies.length > 0) {
      ctx.save();
      ctx.font = `${Math.max(10, 12 / zoom)}px sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.lineWidth = 2;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      for (const waterBody of waterBodies) {
        if (waterBody.tiles.length === 0) continue;
        
        // Calculate center position of water body
        let sumX = 0, sumY = 0;
        for (const tile of waterBody.tiles) {
          sumX += tile.x;
          sumY += tile.y;
        }
        const centerTileX = Math.round(sumX / waterBody.tiles.length);
        const centerTileY = Math.round(sumY / waterBody.tiles.length);
        
        // Convert to screen coordinates
        const { screenX, screenY } = gridToScreen(centerTileX, centerTileY, offset.x / zoom, offset.y / zoom);
        
        // Only draw if visible on screen
        if (screenX >= -TILE_WIDTH && screenX <= canvasSize.width + TILE_WIDTH &&
            screenY >= -TILE_HEIGHT && screenY <= canvasSize.height + TILE_HEIGHT) {
          // Draw text with outline for better visibility
          ctx.strokeText(waterBody.name, screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT / 2);
          ctx.fillText(waterBody.name, screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT / 2);
        }
      }
      
      ctx.restore();
    }
    
    ctx.restore();
  }, [grid, gridSize, offset, zoom, hoveredTile, selectedTile, overlayMode, imagesLoaded, canvasSize, dragStartTile, dragEndTile, state.services, currentSpritePack, waterBodies]);
  
  // Animate decorative car traffic AND emergency vehicles on top of the base canvas
  useEffect(() => {
    const canvas = carsCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.imageSmoothingEnabled = false;
    
    let animationFrameId: number;
    let lastTime = performance.now();
    
    const render = (time: number) => {
      animationFrameId = requestAnimationFrame(render);
      const delta = Math.min((time - lastTime) / 1000, 0.3);
      lastTime = time;
      if (delta > 0) {
        updateCars(delta);
        updateEmergencyVehicles(delta); // Update emergency vehicles!
      }
      drawCars(ctx);
      drawEmergencyVehicles(ctx); // Draw emergency vehicles!
    };
    
    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [canvasSize.width, canvasSize.height, updateCars, drawCars, updateEmergencyVehicles, drawEmergencyVehicles]);
  
  // Draw isometric tile base
  function drawIsometricTile(ctx: CanvasRenderingContext2D, x: number, y: number, tile: Tile, highlight: boolean, currentZoom: number, skipGreyBase: boolean = false, skipGreenBase: boolean = false) {
    const w = TILE_WIDTH;
    const h = TILE_HEIGHT;
    
    // Determine tile colors (top face and shading)
    let topColor = '#4a7c3f'; // grass
    let leftColor = '#3d6634';
    let rightColor = '#5a8f4f';
    let strokeColor = '#2d4a26';
    
    const isPark = tile.building.type === 'park' || tile.building.type === 'park_large' || tile.building.type === 'tennis' ||
                   (tile.building.type === 'empty' && isPartOfParkBuilding(tile.x, tile.y));
    // Check if this is a building (not grass, empty, water, road, tree, park, or tennis)
    // Also check if it's part of a multi-tile building footprint
    const isDirectBuilding = !isPark &&
      tile.building.type !== 'grass' &&
      tile.building.type !== 'empty' &&
      tile.building.type !== 'water' &&
      tile.building.type !== 'road' &&
      tile.building.type !== 'tree';
    const isPartOfBuilding = tile.building.type === 'empty' && isPartOfMultiTileBuilding(tile.x, tile.y);
    const isBuilding = isDirectBuilding || isPartOfBuilding;
    
    // ALL buildings get grey/concrete base tiles (except parks which stay green)
    const hasGreyBase = isBuilding && !isPark;
    
    if (tile.building.type === 'water') {
      topColor = '#2563eb';
      leftColor = '#1d4ed8';
      rightColor = '#3b82f6';
      strokeColor = '#1e3a8a';
    } else if (tile.building.type === 'road') {
      topColor = '#4a4a4a';
      leftColor = '#3a3a3a';
      rightColor = '#5a5a5a';
      strokeColor = '#333';
    } else if (isPark) {
      topColor = '#4a7c3f';
      leftColor = '#3d6634';
      rightColor = '#5a8f4f';
      strokeColor = '#2d4a26';
    } else if (hasGreyBase && !skipGreyBase) {
      // Grey/concrete base tiles for ALL buildings (except parks)
      // Skip if skipGreyBase is true (will be drawn later after water)
      topColor = '#6b7280';
      leftColor = '#4b5563';
      rightColor = '#9ca3af';
      strokeColor = '#374151';
    } else if (tile.zone === 'residential') {
      if (tile.building.type !== 'grass' && tile.building.type !== 'empty') {
        topColor = '#3d7c3f';
        leftColor = '#2d6634';
        rightColor = '#4d8f4f';
      } else {
        topColor = '#2d5a2d';
        leftColor = '#1d4a1d';
        rightColor = '#3d6a3d';
      }
      strokeColor = '#22c55e';
    } else if (tile.zone === 'commercial') {
      if (tile.building.type !== 'grass' && tile.building.type !== 'empty') {
        topColor = '#3a5c7c';
        leftColor = '#2a4c6c';
        rightColor = '#4a6c8c';
      } else {
        topColor = '#2a4a6a';
        leftColor = '#1a3a5a';
        rightColor = '#3a5a7a';
      }
      strokeColor = '#3b82f6';
    } else if (tile.zone === 'industrial') {
      if (tile.building.type !== 'grass' && tile.building.type !== 'empty') {
        topColor = '#7c5c3a';
        leftColor = '#6c4c2a';
        rightColor = '#8c6c4a';
      } else {
        topColor = '#6a4a2a';
        leftColor = '#5a3a1a';
        rightColor = '#7a5a3a';
      }
      strokeColor = '#f59e0b';
    }
    
    // Skip drawing green base for grass/empty tiles adjacent to water (will be drawn later over water)
    const shouldSkipDrawing = skipGreenBase && (tile.building.type === 'grass' || tile.building.type === 'empty');
    
    // Draw the isometric diamond (top face)
    if (!shouldSkipDrawing) {
      ctx.fillStyle = topColor;
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h / 2);
      ctx.lineTo(x + w / 2, y + h);
      ctx.lineTo(x, y + h / 2);
      ctx.closePath();
      ctx.fill();
      
      // Draw grid lines only when zoomed in (hide when zoom < 0.6)
      if (currentZoom >= 0.6) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
      
      // Draw zone border with dashed line (hide when zoomed out, only on grass/empty tiles - not on roads or buildings)
      if (tile.zone !== 'none' && 
          currentZoom >= 0.95 &&
          (tile.building.type === 'grass' || tile.building.type === 'empty')) {
        ctx.strokeStyle = tile.zone === 'residential' ? '#22c55e' : 
                          tile.zone === 'commercial' ? '#3b82f6' : '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 2]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    
    // Highlight on hover/select (always draw, even if base was skipped)
    if (highlight) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h / 2);
      ctx.lineTo(x + w / 2, y + h);
      ctx.lineTo(x, y + h / 2);
      ctx.closePath();
      ctx.stroke();
    }
  }
  
  // Draw green base tile for grass/empty tiles (called after water tiles)
  function drawGreenBaseTile(ctx: CanvasRenderingContext2D, x: number, y: number, tile: Tile, currentZoom: number) {
    const w = TILE_WIDTH;
    const h = TILE_HEIGHT;
    
    // Determine green base colors based on zone
    let topColor = '#4a7c3f'; // default grass
    let leftColor = '#3d6634';
    let rightColor = '#5a8f4f';
    let strokeColor = '#2d4a26';
    
    if (tile.zone === 'residential') {
      topColor = '#2d5a2d';
      leftColor = '#1d4a1d';
      rightColor = '#3d6a3d';
      strokeColor = '#22c55e';
    } else if (tile.zone === 'commercial') {
      topColor = '#2a4a6a';
      leftColor = '#1a3a5a';
      rightColor = '#3a5a7a';
      strokeColor = '#3b82f6';
    } else if (tile.zone === 'industrial') {
      topColor = '#6a4a2a';
      leftColor = '#5a3a1a';
      rightColor = '#7a5a3a';
      strokeColor = '#f59e0b';
    }
    
    // Draw the isometric diamond (top face)
    ctx.fillStyle = topColor;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w, y + h / 2);
    ctx.lineTo(x + w / 2, y + h);
    ctx.lineTo(x, y + h / 2);
    ctx.closePath();
    ctx.fill();
    
    // Draw grid lines only when zoomed in (hide when zoom < 0.6)
    if (currentZoom >= 0.6) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    
    // Draw zone border with dashed line (hide when zoomed out, only on grass/empty tiles)
    if (tile.zone !== 'none' && currentZoom >= 0.95) {
      ctx.strokeStyle = tile.zone === 'residential' ? '#22c55e' : 
                        tile.zone === 'commercial' ? '#3b82f6' : '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 2]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  
  // Draw gray base tile for buildings (called after water tiles)
  function drawGreyBaseTile(ctx: CanvasRenderingContext2D, x: number, y: number, tile: Tile, currentZoom: number) {
    const w = TILE_WIDTH;
    const h = TILE_HEIGHT;
    
    // Grey/concrete base tiles for ALL buildings (except parks)
    const topColor = '#6b7280';
    const leftColor = '#4b5563';
    const rightColor = '#9ca3af';
    const strokeColor = '#374151';
    
    // Draw the isometric diamond (top face)
    ctx.fillStyle = topColor;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w, y + h / 2);
    ctx.lineTo(x + w / 2, y + h);
    ctx.lineTo(x, y + h / 2);
    ctx.closePath();
    ctx.fill();
    
    // Draw grid lines only when zoomed in (hide when zoom < 0.6)
    if (currentZoom >= 0.6) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }
  
  // Helper function to check if a tile is water
  function isWater(gridX: number, gridY: number): boolean {
    if (gridX < 0 || gridX >= gridSize || gridY < 0 || gridY >= gridSize) return false;
    return grid[gridY][gridX].building.type === 'water';
  }
  
  // Draw beach effect on tiles adjacent to water (sidewalk-style)
  function drawBeach(ctx: CanvasRenderingContext2D, x: number, y: number, gridX: number, gridY: number) {
    const w = TILE_WIDTH;
    const h = TILE_HEIGHT;
    
    // Check which edges are adjacent to water (in isometric coordinates)
    const north = isWater(gridX - 1, gridY);  // top-left edge
    const east = isWater(gridX, gridY - 1);   // top-right edge
    const south = isWater(gridX + 1, gridY);  // bottom-right edge
    const west = isWater(gridX, gridY + 1);   // bottom-left edge
    
    // Beach/sidewalk configuration
    const beachWidth = w * 0.04; // Width of the beach strip (50% thinner)
    const beachColor = '#d4a574'; // Light sandy/tan color for beach
    const curbColor = '#b8956a'; // Darker color for curb edge
    
    // Diamond corner points
    const topCorner = { x: x + w / 2, y: y };
    const rightCorner = { x: x + w, y: y + h / 2 };
    const bottomCorner = { x: x + w / 2, y: y + h };
    const leftCorner = { x: x, y: y + h / 2 };
    
    // Draw beach strip helper - draws a strip along an edge facing water, optionally shortening at corners
    const drawBeachEdge = (
      startX: number, startY: number, 
      endX: number, endY: number,
      inwardDx: number, inwardDy: number,
      shortenStart: boolean = false,
      shortenEnd: boolean = false
    ) => {
      const swWidth = beachWidth;
      const shortenDist = swWidth * 0.707; // Distance to shorten at corners
      
      // Calculate edge direction vector
      const edgeDx = endX - startX;
      const edgeDy = endY - startY;
      const edgeLen = Math.hypot(edgeDx, edgeDy);
      const edgeDirX = edgeDx / edgeLen;
      const edgeDirY = edgeDy / edgeLen;
      
      // Apply shortening if needed
      let actualStartX = startX;
      let actualStartY = startY;
      let actualEndX = endX;
      let actualEndY = endY;
      
      if (shortenStart && edgeLen > shortenDist * 2) {
        actualStartX = startX + edgeDirX * shortenDist;
        actualStartY = startY + edgeDirY * shortenDist;
      }
      if (shortenEnd && edgeLen > shortenDist * 2) {
        actualEndX = endX - edgeDirX * shortenDist;
        actualEndY = endY - edgeDirY * shortenDist;
      }
      
      // Draw curb (darker line at outer edge)
      ctx.strokeStyle = curbColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(actualStartX, actualStartY);
      ctx.lineTo(actualEndX, actualEndY);
      ctx.stroke();
      
      // Draw beach fill
      ctx.fillStyle = beachColor;
      ctx.beginPath();
      ctx.moveTo(actualStartX, actualStartY);
      ctx.lineTo(actualEndX, actualEndY);
      ctx.lineTo(actualEndX + inwardDx * swWidth, actualEndY + inwardDy * swWidth);
      ctx.lineTo(actualStartX + inwardDx * swWidth, actualStartY + inwardDy * swWidth);
      ctx.closePath();
      ctx.fill();
    };
    
    // North edge beach (top-left edge: leftCorner to topCorner)
    // Inward direction points toward center-right and down
    if (north) {
      const inwardDx = 0.707; // ~45 degrees inward
      const inwardDy = 0.707;
      // Shorten at topCorner if east edge also has beach
      const shortenAtTop = east;
      // Shorten at leftCorner if west edge also has beach
      const shortenAtLeft = west;
      drawBeachEdge(leftCorner.x, leftCorner.y, topCorner.x, topCorner.y, inwardDx, inwardDy, shortenAtLeft, shortenAtTop);
    }
    
    // East edge beach (top-right edge: topCorner to rightCorner)
    // Inward direction points toward center-left and down
    if (east) {
      const inwardDx = -0.707;
      const inwardDy = 0.707;
      // Shorten at topCorner if north edge also has beach
      const shortenAtTop = north;
      // Shorten at rightCorner if south edge also has beach
      const shortenAtRight = south;
      drawBeachEdge(topCorner.x, topCorner.y, rightCorner.x, rightCorner.y, inwardDx, inwardDy, shortenAtTop, shortenAtRight);
    }
    
    // South edge beach (bottom-right edge: rightCorner to bottomCorner)
    // Inward direction points toward center-left and up
    if (south) {
      const inwardDx = -0.707;
      const inwardDy = -0.707;
      // Shorten at rightCorner if east edge also has beach
      const shortenAtRight = east;
      // Shorten at bottomCorner if west edge also has beach
      const shortenAtBottom = west;
      drawBeachEdge(rightCorner.x, rightCorner.y, bottomCorner.x, bottomCorner.y, inwardDx, inwardDy, shortenAtRight, shortenAtBottom);
    }
    
    // West edge beach (bottom-left edge: bottomCorner to leftCorner)
    // Inward direction points toward center-right and up
    if (west) {
      const inwardDx = 0.707;
      const inwardDy = -0.707;
      // Shorten at bottomCorner if south edge also has beach
      const shortenAtBottom = south;
      // Shorten at leftCorner if north edge also has beach
      const shortenAtLeft = north;
      drawBeachEdge(bottomCorner.x, bottomCorner.y, leftCorner.x, leftCorner.y, inwardDx, inwardDy, shortenAtBottom, shortenAtLeft);
    }
    
    // Draw corner beach pieces for adjacent edges that both face water
    // Corner pieces connect exactly where the shortened edge strips end
    const bwWidth = beachWidth;
    const shortenDist = bwWidth * 0.707;
    ctx.fillStyle = beachColor;
    
    // Helper to calculate where a shortened edge's inner endpoint is
    const getShortenedInnerEndpoint = (
      cornerX: number, cornerY: number,
      otherCornerX: number, otherCornerY: number,
      inwardDx: number, inwardDy: number
    ) => {
      // Edge direction FROM otherCorner TO corner (the direction the edge approaches the corner)
      const edgeDx = cornerX - otherCornerX;
      const edgeDy = cornerY - otherCornerY;
      const edgeLen = Math.hypot(edgeDx, edgeDy);
      const edgeDirX = edgeDx / edgeLen;
      const edgeDirY = edgeDy / edgeLen;
      // Shortened outer endpoint (move backwards from corner along edge)
      const shortenedOuterX = cornerX - edgeDirX * shortenDist;
      const shortenedOuterY = cornerY - edgeDirY * shortenDist;
      // Inner endpoint
      return {
        x: shortenedOuterX + inwardDx * bwWidth,
        y: shortenedOuterY + inwardDy * bwWidth
      };
    };
    
    // Top corner (where north and east edges meet)
    if (north && east) {
      const northInner = getShortenedInnerEndpoint(
        topCorner.x, topCorner.y, leftCorner.x, leftCorner.y,
        0.707, 0.707
      );
      const eastInner = getShortenedInnerEndpoint(
        topCorner.x, topCorner.y, rightCorner.x, rightCorner.y,
        -0.707, 0.707
      );
      ctx.beginPath();
      ctx.moveTo(topCorner.x, topCorner.y);
      ctx.lineTo(northInner.x, northInner.y);
      ctx.lineTo(eastInner.x, eastInner.y);
      ctx.closePath();
      ctx.fill();
    }
    
    // Right corner (where east and south edges meet)
    if (east && south) {
      const eastInner = getShortenedInnerEndpoint(
        rightCorner.x, rightCorner.y, topCorner.x, topCorner.y,
        -0.707, 0.707
      );
      const southInner = getShortenedInnerEndpoint(
        rightCorner.x, rightCorner.y, bottomCorner.x, bottomCorner.y,
        -0.707, -0.707
      );
      ctx.beginPath();
      ctx.moveTo(rightCorner.x, rightCorner.y);
      ctx.lineTo(eastInner.x, eastInner.y);
      ctx.lineTo(southInner.x, southInner.y);
      ctx.closePath();
      ctx.fill();
    }
    
    // Bottom corner (where south and west edges meet)
    if (south && west) {
      const southInner = getShortenedInnerEndpoint(
        bottomCorner.x, bottomCorner.y, rightCorner.x, rightCorner.y,
        -0.707, -0.707
      );
      const westInner = getShortenedInnerEndpoint(
        bottomCorner.x, bottomCorner.y, leftCorner.x, leftCorner.y,
        0.707, -0.707
      );
      ctx.beginPath();
      ctx.moveTo(bottomCorner.x, bottomCorner.y);
      ctx.lineTo(southInner.x, southInner.y);
      ctx.lineTo(westInner.x, westInner.y);
      ctx.closePath();
      ctx.fill();
    }
    
    // Left corner (where west and north edges meet)
    if (west && north) {
      const westInner = getShortenedInnerEndpoint(
        leftCorner.x, leftCorner.y, bottomCorner.x, bottomCorner.y,
        0.707, -0.707
      );
      const northInner = getShortenedInnerEndpoint(
        leftCorner.x, leftCorner.y, topCorner.x, topCorner.y,
        0.707, 0.707
      );
      ctx.beginPath();
      ctx.moveTo(leftCorner.x, leftCorner.y);
      ctx.lineTo(westInner.x, westInner.y);
      ctx.lineTo(northInner.x, northInner.y);
      ctx.closePath();
      ctx.fill();
    }
  }
  
  // Helper function to check if a tile has a road
  function hasRoad(gridX: number, gridY: number): boolean {
    if (gridX < 0 || gridX >= gridSize || gridY < 0 || gridY >= gridSize) return false;
    return grid[gridY][gridX].building.type === 'road';
  }
  
  // Draw road with proper adjacency, markings, and sidewalks
  function drawRoad(ctx: CanvasRenderingContext2D, x: number, y: number, gridX: number, gridY: number) {
    const w = TILE_WIDTH;
    const h = TILE_HEIGHT;
    const cx = x + w / 2;
    const cy = y + h / 2;
    
    // Check adjacency (in isometric coordinates)
    const north = hasRoad(gridX - 1, gridY);  // top-left edge
    const east = hasRoad(gridX, gridY - 1);   // top-right edge
    const south = hasRoad(gridX + 1, gridY);  // bottom-right edge
    const west = hasRoad(gridX, gridY + 1);   // bottom-left edge
    
    // Road width - aligned with gridlines
    const roadW = w * 0.14;
    const roadH = h * 0.14;
    
    // Sidewalk configuration
    const sidewalkWidth = w * 0.08; // Width of the sidewalk strip
    const sidewalkColor = '#9ca3af'; // Light gray for sidewalk
    const curbColor = '#6b7280'; // Darker gray for curb edge
    
    // Edge stop distance - extend roads almost to the edge for better connection
    // Using 0.98 means roads extend to 98% of the way to the edge
    const edgeStop = 0.98;
    
    // Calculate edge midpoints (where gridlines meet)
    const northEdgeX = x + w * 0.25;
    const northEdgeY = y + h * 0.25;
    const eastEdgeX = x + w * 0.75;
    const eastEdgeY = y + h * 0.25;
    const southEdgeX = x + w * 0.75;
    const southEdgeY = y + h * 0.75;
    const westEdgeX = x + w * 0.25;
    const westEdgeY = y + h * 0.75;
    
    // Calculate direction vectors for each edge (normalized)
    // These align with the gridline directions
    const northDx = (northEdgeX - cx) / Math.hypot(northEdgeX - cx, northEdgeY - cy);
    const northDy = (northEdgeY - cy) / Math.hypot(northEdgeX - cx, northEdgeY - cy);
    const eastDx = (eastEdgeX - cx) / Math.hypot(eastEdgeX - cx, eastEdgeY - cy);
    const eastDy = (eastEdgeY - cy) / Math.hypot(eastEdgeX - cx, eastEdgeY - cy);
    const southDx = (southEdgeX - cx) / Math.hypot(southEdgeX - cx, southEdgeY - cy);
    const southDy = (southEdgeY - cy) / Math.hypot(southEdgeX - cx, southEdgeY - cy);
    const westDx = (westEdgeX - cx) / Math.hypot(westEdgeX - cx, westEdgeY - cy);
    const westDy = (westEdgeY - cy) / Math.hypot(westEdgeX - cx, westEdgeY - cy);
    
    // Perpendicular vectors for road width (rotated 90 degrees)
    const getPerp = (dx: number, dy: number) => ({ nx: -dy, ny: dx });
    
    // ============================================
    // DRAW SIDEWALKS FIRST (underneath the road)
    // ============================================
    // Sidewalks appear on edges where there's NO adjacent road
    // They run along the outer perimeter of the tile edge
    
    // Diamond corner points
    const topCorner = { x: x + w / 2, y: y };
    const rightCorner = { x: x + w, y: y + h / 2 };
    const bottomCorner = { x: x + w / 2, y: y + h };
    const leftCorner = { x: x, y: y + h / 2 };
    
    // Draw sidewalk helper - draws a strip along an edge, optionally shortening at corners
    const drawSidewalkEdge = (
      startX: number, startY: number, 
      endX: number, endY: number,
      inwardDx: number, inwardDy: number,
      shortenStart: boolean = false,
      shortenEnd: boolean = false
    ) => {
      const swWidth = sidewalkWidth;
      const shortenDist = swWidth * 0.707; // Distance to shorten at corners
      
      // Calculate edge direction vector
      const edgeDx = endX - startX;
      const edgeDy = endY - startY;
      const edgeLen = Math.hypot(edgeDx, edgeDy);
      const edgeDirX = edgeDx / edgeLen;
      const edgeDirY = edgeDy / edgeLen;
      
      // Apply shortening if needed
      let actualStartX = startX;
      let actualStartY = startY;
      let actualEndX = endX;
      let actualEndY = endY;
      
      if (shortenStart && edgeLen > shortenDist * 2) {
        actualStartX = startX + edgeDirX * shortenDist;
        actualStartY = startY + edgeDirY * shortenDist;
      }
      if (shortenEnd && edgeLen > shortenDist * 2) {
        actualEndX = endX - edgeDirX * shortenDist;
        actualEndY = endY - edgeDirY * shortenDist;
      }
      
      // Draw curb (darker line at outer edge)
      ctx.strokeStyle = curbColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(actualStartX, actualStartY);
      ctx.lineTo(actualEndX, actualEndY);
      ctx.stroke();
      
      // Draw sidewalk fill
      ctx.fillStyle = sidewalkColor;
      ctx.beginPath();
      ctx.moveTo(actualStartX, actualStartY);
      ctx.lineTo(actualEndX, actualEndY);
      ctx.lineTo(actualEndX + inwardDx * swWidth, actualEndY + inwardDy * swWidth);
      ctx.lineTo(actualStartX + inwardDx * swWidth, actualStartY + inwardDy * swWidth);
      ctx.closePath();
      ctx.fill();
    };
    
    // North edge sidewalk (top-left edge: leftCorner to topCorner)
    // Inward direction points toward center-right and down
    if (!north) {
      const inwardDx = 0.707; // ~45 degrees inward
      const inwardDy = 0.707;
      // Shorten at topCorner if east edge also has sidewalk
      const shortenAtTop = !east;
      // Shorten at leftCorner if west edge also has sidewalk
      const shortenAtLeft = !west;
      drawSidewalkEdge(leftCorner.x, leftCorner.y, topCorner.x, topCorner.y, inwardDx, inwardDy, shortenAtLeft, shortenAtTop);
    }
    
    // East edge sidewalk (top-right edge: topCorner to rightCorner)
    // Inward direction points toward center-left and down
    if (!east) {
      const inwardDx = -0.707;
      const inwardDy = 0.707;
      // Shorten at topCorner if north edge also has sidewalk
      const shortenAtTop = !north;
      // Shorten at rightCorner if south edge also has sidewalk
      const shortenAtRight = !south;
      drawSidewalkEdge(topCorner.x, topCorner.y, rightCorner.x, rightCorner.y, inwardDx, inwardDy, shortenAtTop, shortenAtRight);
    }
    
    // South edge sidewalk (bottom-right edge: rightCorner to bottomCorner)
    // Inward direction points toward center-left and up
    if (!south) {
      const inwardDx = -0.707;
      const inwardDy = -0.707;
      // Shorten at rightCorner if east edge also has sidewalk
      const shortenAtRight = !east;
      // Shorten at bottomCorner if west edge also has sidewalk
      const shortenAtBottom = !west;
      drawSidewalkEdge(rightCorner.x, rightCorner.y, bottomCorner.x, bottomCorner.y, inwardDx, inwardDy, shortenAtRight, shortenAtBottom);
    }
    
    // West edge sidewalk (bottom-left edge: bottomCorner to leftCorner)
    // Inward direction points toward center-right and up
    if (!west) {
      const inwardDx = 0.707;
      const inwardDy = -0.707;
      // Shorten at bottomCorner if south edge also has sidewalk
      const shortenAtBottom = !south;
      // Shorten at leftCorner if north edge also has sidewalk
      const shortenAtLeft = !north;
      drawSidewalkEdge(bottomCorner.x, bottomCorner.y, leftCorner.x, leftCorner.y, inwardDx, inwardDy, shortenAtBottom, shortenAtLeft);
    }
    
    // Draw corner sidewalk pieces for non-adjacent edges that meet
    // Corner pieces connect exactly where the shortened edge strips end
    const swWidth = sidewalkWidth;
    const shortenDist = swWidth * 0.707;
    ctx.fillStyle = sidewalkColor;
    
    // Helper to calculate where a shortened edge's inner endpoint is
    const getShortenedInnerEndpoint = (
      cornerX: number, cornerY: number,
      otherCornerX: number, otherCornerY: number,
      inwardDx: number, inwardDy: number
    ) => {
      // Edge direction FROM otherCorner TO corner (the direction the edge approaches the corner)
      const edgeDx = cornerX - otherCornerX;
      const edgeDy = cornerY - otherCornerY;
      const edgeLen = Math.hypot(edgeDx, edgeDy);
      const edgeDirX = edgeDx / edgeLen;
      const edgeDirY = edgeDy / edgeLen;
      // Shortened outer endpoint (move backwards from corner along edge)
      const shortenedOuterX = cornerX - edgeDirX * shortenDist;
      const shortenedOuterY = cornerY - edgeDirY * shortenDist;
      // Inner endpoint
      return {
        x: shortenedOuterX + inwardDx * swWidth,
        y: shortenedOuterY + inwardDy * swWidth
      };
    };
    
    // Top corner (where north and east edges meet) - only if both don't have roads
    if (!north && !east) {
      const northInner = getShortenedInnerEndpoint(
        topCorner.x, topCorner.y, leftCorner.x, leftCorner.y,
        0.707, 0.707
      );
      const eastInner = getShortenedInnerEndpoint(
        topCorner.x, topCorner.y, rightCorner.x, rightCorner.y,
        -0.707, 0.707
      );
      ctx.beginPath();
      ctx.moveTo(topCorner.x, topCorner.y);
      ctx.lineTo(northInner.x, northInner.y);
      ctx.lineTo(eastInner.x, eastInner.y);
      ctx.closePath();
      ctx.fill();
    }
    
    // Right corner (where east and south edges meet)
    if (!east && !south) {
      const eastInner = getShortenedInnerEndpoint(
        rightCorner.x, rightCorner.y, topCorner.x, topCorner.y,
        -0.707, 0.707
      );
      const southInner = getShortenedInnerEndpoint(
        rightCorner.x, rightCorner.y, bottomCorner.x, bottomCorner.y,
        -0.707, -0.707
      );
      ctx.beginPath();
      ctx.moveTo(rightCorner.x, rightCorner.y);
      ctx.lineTo(eastInner.x, eastInner.y);
      ctx.lineTo(southInner.x, southInner.y);
      ctx.closePath();
      ctx.fill();
    }
    
    // Bottom corner (where south and west edges meet)
    if (!south && !west) {
      const southInner = getShortenedInnerEndpoint(
        bottomCorner.x, bottomCorner.y, rightCorner.x, rightCorner.y,
        -0.707, -0.707
      );
      const westInner = getShortenedInnerEndpoint(
        bottomCorner.x, bottomCorner.y, leftCorner.x, leftCorner.y,
        0.707, -0.707
      );
      ctx.beginPath();
      ctx.moveTo(bottomCorner.x, bottomCorner.y);
      ctx.lineTo(southInner.x, southInner.y);
      ctx.lineTo(westInner.x, westInner.y);
      ctx.closePath();
      ctx.fill();
    }
    
    // Left corner (where west and north edges meet)
    if (!west && !north) {
      const westInner = getShortenedInnerEndpoint(
        leftCorner.x, leftCorner.y, bottomCorner.x, bottomCorner.y,
        0.707, -0.707
      );
      const northInner = getShortenedInnerEndpoint(
        leftCorner.x, leftCorner.y, topCorner.x, topCorner.y,
        0.707, 0.707
      );
      ctx.beginPath();
      ctx.moveTo(leftCorner.x, leftCorner.y);
      ctx.lineTo(westInner.x, westInner.y);
      ctx.lineTo(northInner.x, northInner.y);
      ctx.closePath();
      ctx.fill();
    }
    
    // ============================================
    // DRAW ROAD SEGMENTS
    // ============================================
    ctx.fillStyle = '#4a4a4a';
    
    // North segment (to top-left) - aligned with gridline
    if (north) {
      const stopX = cx + (northEdgeX - cx) * edgeStop;
      const stopY = cy + (northEdgeY - cy) * edgeStop;
      const perp = getPerp(northDx, northDy);
      const halfWidth = roadW * 0.5;
      ctx.beginPath();
      ctx.moveTo(cx + perp.nx * halfWidth, cy + perp.ny * halfWidth);
      ctx.lineTo(stopX + perp.nx * halfWidth, stopY + perp.ny * halfWidth);
      ctx.lineTo(stopX - perp.nx * halfWidth, stopY - perp.ny * halfWidth);
      ctx.lineTo(cx - perp.nx * halfWidth, cy - perp.ny * halfWidth);
      ctx.closePath();
      ctx.fill();
    }
    
    // East segment (to top-right) - aligned with gridline
    if (east) {
      const stopX = cx + (eastEdgeX - cx) * edgeStop;
      const stopY = cy + (eastEdgeY - cy) * edgeStop;
      const perp = getPerp(eastDx, eastDy);
      const halfWidth = roadW * 0.5;
      ctx.beginPath();
      ctx.moveTo(cx + perp.nx * halfWidth, cy + perp.ny * halfWidth);
      ctx.lineTo(stopX + perp.nx * halfWidth, stopY + perp.ny * halfWidth);
      ctx.lineTo(stopX - perp.nx * halfWidth, stopY - perp.ny * halfWidth);
      ctx.lineTo(cx - perp.nx * halfWidth, cy - perp.ny * halfWidth);
      ctx.closePath();
      ctx.fill();
    }
    
    // South segment (to bottom-right) - aligned with gridline
    if (south) {
      const stopX = cx + (southEdgeX - cx) * edgeStop;
      const stopY = cy + (southEdgeY - cy) * edgeStop;
      const perp = getPerp(southDx, southDy);
      const halfWidth = roadW * 0.5;
      ctx.beginPath();
      ctx.moveTo(cx + perp.nx * halfWidth, cy + perp.ny * halfWidth);
      ctx.lineTo(stopX + perp.nx * halfWidth, stopY + perp.ny * halfWidth);
      ctx.lineTo(stopX - perp.nx * halfWidth, stopY - perp.ny * halfWidth);
      ctx.lineTo(cx - perp.nx * halfWidth, cy - perp.ny * halfWidth);
      ctx.closePath();
      ctx.fill();
    }
    
    // West segment (to bottom-left) - aligned with gridline
    if (west) {
      const stopX = cx + (westEdgeX - cx) * edgeStop;
      const stopY = cy + (westEdgeY - cy) * edgeStop;
      const perp = getPerp(westDx, westDy);
      const halfWidth = roadW * 0.5;
      ctx.beginPath();
      ctx.moveTo(cx + perp.nx * halfWidth, cy + perp.ny * halfWidth);
      ctx.lineTo(stopX + perp.nx * halfWidth, stopY + perp.ny * halfWidth);
      ctx.lineTo(stopX - perp.nx * halfWidth, stopY - perp.ny * halfWidth);
      ctx.lineTo(cx - perp.nx * halfWidth, cy - perp.ny * halfWidth);
      ctx.closePath();
      ctx.fill();
    }
    
    // Center intersection (always drawn)
    const centerSize = roadW * 1.4;
    ctx.beginPath();
    ctx.moveTo(cx, cy - centerSize);
    ctx.lineTo(cx + centerSize, cy);
    ctx.lineTo(cx, cy + centerSize);
    ctx.lineTo(cx - centerSize, cy);
    ctx.closePath();
    ctx.fill();
    
    // Draw road markings (yellow dashed lines) - aligned with gridlines
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 3]);
    ctx.lineCap = 'round';
    
    // Marking length - extend most of the way
    const markingLength = 0.85; // 85% of the way to edge stop
    
    // North marking (toward top-left)
    if (north) {
      const stopX = cx + (northEdgeX - cx) * edgeStop * markingLength;
      const stopY = cy + (northEdgeY - cy) * edgeStop * markingLength;
      ctx.beginPath();
      ctx.moveTo(cx + northDx * 2, cy + northDy * 2);
      ctx.lineTo(stopX + northDx * 2, stopY + northDy * 2);
      ctx.stroke();
    }
    
    // East marking (toward top-right)
    if (east) {
      const stopX = cx + (eastEdgeX - cx) * edgeStop * markingLength;
      const stopY = cy + (eastEdgeY - cy) * edgeStop * markingLength;
      ctx.beginPath();
      ctx.moveTo(cx + eastDx * 2, cy + eastDy * 2);
      ctx.lineTo(stopX + eastDx * 2, stopY + eastDy * 2);
      ctx.stroke();
    }
    
    // South marking (toward bottom-right)
    if (south) {
      const stopX = cx + (southEdgeX - cx) * edgeStop * markingLength;
      const stopY = cy + (southEdgeY - cy) * edgeStop * markingLength;
      ctx.beginPath();
      ctx.moveTo(cx + southDx * 2, cy + southDy * 2);
      ctx.lineTo(stopX + southDx * 2, stopY + southDy * 2);
      ctx.stroke();
    }
    
    // West marking (toward bottom-left)
    if (west) {
      const stopX = cx + (westEdgeX - cx) * edgeStop * markingLength;
      const stopY = cy + (westEdgeY - cy) * edgeStop * markingLength;
      ctx.beginPath();
      ctx.moveTo(cx + westDx * 2, cy + westDy * 2);
      ctx.lineTo(stopX + westDx * 2, stopY + westDy * 2);
      ctx.stroke();
    }
    
    ctx.setLineDash([]);
    ctx.lineCap = 'butt';
  }
  
  // Draw building sprite
  function drawBuilding(ctx: CanvasRenderingContext2D, x: number, y: number, tile: Tile) {
    const buildingType = tile.building.type;
    const w = TILE_WIDTH;
    const h = TILE_HEIGHT;
    
    // Handle roads separately with adjacency
    if (buildingType === 'road') {
      drawRoad(ctx, x, y, tile.x, tile.y);
      return;
    }
    
    // Check if this building type has a sprite in the tile renderer
    const hasTileSprite = BUILDING_TO_SPRITE[buildingType];
    
    if (hasTileSprite) {
      // ===== TILE RENDERER PATH =====
      // Handles both single-tile and multi-tile buildings
      // Get the filtered sprite sheet from cache (or fallback to unfiltered if not available)
      // Use the active sprite pack's source for cache lookup
      const activePack = getActiveSpritePack();
      const filteredSpriteSheet = imageCache.get(`${activePack.src}_filtered`) || imageCache.get(activePack.src);
      
      if (filteredSpriteSheet) {
        // Use naturalWidth/naturalHeight for accurate source dimensions
        const sheetWidth = filteredSpriteSheet.naturalWidth || filteredSpriteSheet.width;
        const sheetHeight = filteredSpriteSheet.naturalHeight || filteredSpriteSheet.height;
        
        // getSpriteCoords handles building type to sprite key mapping
        const coords = getSpriteCoords(buildingType, sheetWidth, sheetHeight);
        
        if (coords) {
          // Get building size to handle multi-tile buildings
          const buildingSize = getBuildingSize(buildingType);
          const isMultiTile = buildingSize.width > 1 || buildingSize.height > 1;
          
          // Calculate draw position for multi-tile buildings
          // Multi-tile buildings need to be positioned at the front-most corner
          let drawPosX = x;
          let drawPosY = y;
          
          if (isMultiTile) {
            // Calculate offset to position sprite at the front-most visible corner
            // In isometric view, the front-most corner is at (originX + width - 1, originY + height - 1)
            const frontmostOffsetX = buildingSize.width - 1;
            const frontmostOffsetY = buildingSize.height - 1;
            const screenOffsetX = (frontmostOffsetX - frontmostOffsetY) * (w / 2);
            const screenOffsetY = (frontmostOffsetX + frontmostOffsetY) * (h / 2);
            drawPosX = x + screenOffsetX;
            drawPosY = y + screenOffsetY;
          }
          
          // Calculate destination size preserving aspect ratio of source sprite
          // Scale factor: 1.2 base (reduced from 1.5 for ~20% smaller)
          // Multi-tile buildings scale with their footprint
          let scaleMultiplier = isMultiTile ? Math.max(buildingSize.width, buildingSize.height) : 1;
          // Special scale adjustment for airport (scaled up 15% from previous)
          if (buildingType === 'airport') {
            scaleMultiplier *= 0.8625; // 0.75 * 1.15 = 0.8625 (15% larger than before)
          }
          // Special scale adjustment for space_program (scaled up 25%)
          if (buildingType === 'space_program') {
            scaleMultiplier *= 1.25;
          }
          const destWidth = w * 1.2 * scaleMultiplier;
          const aspectRatio = coords.sh / coords.sw;  // height/width ratio of source
          const destHeight = destWidth * aspectRatio;
          
          // Position: center horizontally on tile/footprint, anchor bottom of sprite at tile bottom
          let drawX = drawPosX + w / 2 - destWidth / 2;
          
          // Apply per-sprite horizontal offset adjustments
          const spriteKey = BUILDING_TO_SPRITE[buildingType];
          const horizontalOffset = (spriteKey && SPRITE_HORIZONTAL_OFFSETS[spriteKey]) ? SPRITE_HORIZONTAL_OFFSETS[spriteKey] * w : 0;
          drawX += horizontalOffset;
          
          // Simple positioning: sprite bottom aligns with tile/footprint bottom
          // Add vertical push to compensate for transparent space at bottom of sprites
          let drawY: number;
          let verticalPush: number;
          if (isMultiTile) {
            // Multi-tile sprites need larger push to sit on their footprint
            const footprintDepth = buildingSize.width + buildingSize.height - 2;
            verticalPush = footprintDepth * h * 0.25;
          } else {
            // Single-tile sprites also need push (sprites have transparent bottom padding)
            verticalPush = destHeight * 0.15;
          }
          const extraOffset = (spriteKey && SPRITE_VERTICAL_OFFSETS[spriteKey]) ? SPRITE_VERTICAL_OFFSETS[spriteKey] * h : 0;
          verticalPush += extraOffset;
          
          drawY = drawPosY + h - destHeight + verticalPush;
          
          // Special handling for water sprites: scale to ~65% (30% bigger than 50%) and center on tile
          if (buildingType === 'water') {
            // Center the water sprite on the tile (not at bottom like buildings)
            const tileCenterX = drawPosX + w / 2;
            const tileCenterY = drawPosY + h / 2;
            
            // Scale to 65% (30% bigger than the previous 50%)
            const scaledWidth = destWidth * 0.65;
            const scaledHeight = destHeight * 0.65;
            
            // Draw the sprite scaled down and centered on tile (no rotation to maintain tiling)
            ctx.drawImage(
              filteredSpriteSheet,
              coords.sx, coords.sy, coords.sw, coords.sh,  // Source: exact tile from sprite sheet
              Math.round(tileCenterX - scaledWidth / 2), Math.round(tileCenterY - scaledHeight / 2),  // Centered position
              Math.round(scaledWidth), Math.round(scaledHeight) // Scaled size
            );
          } else {
            // Draw the sprite with correct aspect ratio (normal buildings)
            ctx.drawImage(
              filteredSpriteSheet,
              coords.sx, coords.sy, coords.sw, coords.sh,  // Source: exact tile from sprite sheet
              Math.round(drawX), Math.round(drawY),        // Destination position
              Math.round(destWidth), Math.round(destHeight) // Destination size (preserving aspect ratio)
            );
          }
        }
      }
    }
    
    // Draw fire effect
    if (tile.building.onFire) {
      const fireX = x + w / 2;
      const fireY = y - 10;
      
      ctx.fillStyle = 'rgba(255, 100, 0, 0.5)';
      ctx.beginPath();
      ctx.ellipse(fireX, fireY, 18, 25, 0, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = 'rgba(255, 200, 0, 0.8)';
      ctx.beginPath();
      ctx.ellipse(fireX, fireY + 5, 10, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = 'rgba(255, 255, 200, 0.9)';
      ctx.beginPath();
      ctx.ellipse(fireX, fireY + 8, 5, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      e.preventDefault();
      return;
    }
    
    if (e.button === 0) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = (e.clientX - rect.left) / zoom;
        const mouseY = (e.clientY - rect.top) / zoom;
        const { gridX, gridY } = screenToGrid(mouseX, mouseY, offset.x / zoom, offset.y / zoom);
        
        if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
          if (selectedTool === 'select') {
            setSelectedTile({ x: gridX, y: gridY });
          } else if (showsDragGrid) {
            // Start drag rectangle selection for zoning tools
            setDragStartTile({ x: gridX, y: gridY });
            setDragEndTile({ x: gridX, y: gridY });
            setIsDragging(true);
          } else if (supportsDragPlace) {
            // For roads, bulldoze, and other tools, start drag-to-place
            setDragStartTile({ x: gridX, y: gridY });
            setDragEndTile({ x: gridX, y: gridY });
            setIsDragging(true);
            // Place immediately on first click
            placeAtTile(gridX, gridY);
          }
        }
      }
    }
  }, [offset, gridSize, selectedTool, placeAtTile, zoom, showsDragGrid, supportsDragPlace, setSelectedTile]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
      return;
    }
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const mouseX = (e.clientX - rect.left) / zoom;
      const mouseY = (e.clientY - rect.top) / zoom;
      const { gridX, gridY } = screenToGrid(mouseX, mouseY, offset.x / zoom, offset.y / zoom);
      
      if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
        setHoveredTile({ x: gridX, y: gridY });
        
        // Update drag rectangle end point for zoning tools
        if (isDragging && showsDragGrid && dragStartTile) {
          setDragEndTile({ x: gridX, y: gridY });
        }
        // For roads and other tools, place as you drag
        else if (isDragging && supportsDragPlace && dragStartTile) {
          setDragEndTile({ x: gridX, y: gridY });
          // Place at current tile if it's different from last placed
          if (!lastPlacedTile || lastPlacedTile.x !== gridX || lastPlacedTile.y !== gridY) {
            placeAtTile(gridX, gridY);
            setLastPlacedTile({ x: gridX, y: gridY });
          }
        }
      } else {
        setHoveredTile(null);
      }
    }
  }, [isPanning, isDragging, dragStart, offset, gridSize, zoom, showsDragGrid, supportsDragPlace, dragStartTile, lastPlacedTile, placeAtTile, selectedTool, adjacentCities]);
  
  const handleMouseUp = useCallback(() => {
    // Check for road connection when dragging off edge
    if (isDragging && selectedTool === 'road' && dragStartTile && dragEndTile) {
      // Determine which edge we dragged off (use dragEndTile)
      let direction: 'north' | 'south' | 'east' | 'west' | null = null;
      if (dragEndTile.x < 0) direction = 'west';
      else if (dragEndTile.x >= gridSize) direction = 'east';
      else if (dragEndTile.y < 0) direction = 'north';
      else if (dragEndTile.y >= gridSize) direction = 'south';
      
      if (direction) {
        // Check if there's an unconnected city in this direction
        const city = adjacentCities.find(c => c.direction === direction && !c.connected);
        if (city) {
          setCityConnectionDialog({ direction });
          // Don't clear drag state yet - dialog will handle it
          setIsPanning(false);
          setIsDragging(false);
          setLastPlacedTile(null);
          return;
        }
      }
    }
    
    // Fill the drag rectangle when mouse is released (only for zoning tools)
    if (isDragging && dragStartTile && dragEndTile && showsDragGrid) {
      const minX = Math.min(dragStartTile.x, dragEndTile.x);
      const maxX = Math.max(dragStartTile.x, dragEndTile.x);
      const minY = Math.min(dragStartTile.y, dragEndTile.y);
      const maxY = Math.max(dragStartTile.y, dragEndTile.y);
      
      // Place at all tiles in the rectangle
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          placeAtTile(x, y);
        }
      }
    }
    // For roads and other tools, placement already happened during drag
    
    setIsPanning(false);
    setIsDragging(false);
    setLastPlacedTile(null);
    setDragStartTile(null);
    setDragEndTile(null);
  }, [isDragging, dragStartTile, dragEndTile, showsDragGrid, placeAtTile, selectedTool, adjacentCities, gridSize]);
  
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setZoom(z => Math.max(0.3, Math.min(2, z + delta)));
  }, []);
  
  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{ 
        cursor: isPanning ? 'grabbing' : isDragging ? 'crosshair' : 'default',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="block"
      />
      <canvas
        ref={carsCanvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="absolute inset-0 pointer-events-none"
      />
      
      {selectedTile && selectedTool === 'select' && (
        <TileInfoPanel
          tile={grid[selectedTile.y][selectedTile.x]}
          services={state.services}
          onClose={() => setSelectedTile(null)}
        />
      )}
      
      {hoveredTile && selectedTool !== 'select' && TOOL_INFO[selectedTool] && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-card/90 border border-border px-4 py-2 rounded-md text-sm">
          {isDragging && dragStartTile && dragEndTile && showsDragGrid ? (
            <>
              {TOOL_INFO[selectedTool].name} - {Math.abs(dragEndTile.x - dragStartTile.x) + 1}x{Math.abs(dragEndTile.y - dragStartTile.y) + 1} area
              {TOOL_INFO[selectedTool].cost > 0 && ` - $${TOOL_INFO[selectedTool].cost * (Math.abs(dragEndTile.x - dragStartTile.x) + 1) * (Math.abs(dragEndTile.y - dragStartTile.y) + 1)}`}
            </>
          ) : (
            <>
              {TOOL_INFO[selectedTool].name} at ({hoveredTile.x}, {hoveredTile.y})
              {TOOL_INFO[selectedTool].cost > 0 && ` - $${TOOL_INFO[selectedTool].cost}`}
              {showsDragGrid && ' - Drag to zone area'}
              {supportsDragPlace && !showsDragGrid && ' - Drag to place'}
            </>
          )}
        </div>
      )}
      
      {/* City Connection Dialog */}
      {cityConnectionDialog && (() => {
        const city = adjacentCities.find(c => c.direction === cityConnectionDialog.direction && !c.connected);
        if (!city) return null;
        
        return (
          <Dialog open={true} onOpenChange={() => {
            setCityConnectionDialog(null);
            setDragStartTile(null);
            setDragEndTile(null);
          }}>
            <DialogContent className="max-w-[400px]">
              <DialogHeader>
                <DialogTitle>Connect to City</DialogTitle>
                <DialogDescription>
                  You're dragging a road off the map. Would you like to connect to {city.name}?
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4 mt-4">
                <div className="text-sm text-muted-foreground">
                  Connecting to {city.name} will establish a trade route, providing:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>$5,000 one-time bonus</li>
                    <li>$200/month additional income</li>
                  </ul>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCityConnectionDialog(null);
                      setDragStartTile(null);
                      setDragEndTile(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      connectToCity(city.id);
                      setCityConnectionDialog(null);
                      setDragStartTile(null);
                      setDragEndTile(null);
                    }}
                  >
                    Connect to {city.name}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
      
    </div>
  );
}

// Overlay Mode Toggle
const OverlayModeToggle = React.memo(function OverlayModeToggle({ 
  overlayMode, 
  setOverlayMode 
}: { 
  overlayMode: OverlayMode; 
  setOverlayMode: (mode: OverlayMode) => void;
}) {
  return (
    <Card className="absolute bottom-4 left-4 p-2 shadow-lg bg-card/90 border-border/70 z-50">
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold mb-2">
        View Overlay
      </div>
      <div className="flex gap-1">
        <Button
          variant={overlayMode === 'none' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setOverlayMode('none')}
          className="h-8 px-3"
          title="No Overlay"
        >
          <CloseIcon size={14} />
        </Button>
        
        <Button
          variant={overlayMode === 'power' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setOverlayMode('power')}
          className={`h-8 px-3 ${overlayMode === 'power' ? 'bg-amber-500 hover:bg-amber-600' : ''}`}
          title="Power Grid"
        >
          <PowerIcon size={14} />
        </Button>
        
        <Button
          variant={overlayMode === 'water' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setOverlayMode('water')}
          className={`h-8 px-3 ${overlayMode === 'water' ? 'bg-cyan-500 hover:bg-cyan-600' : ''}`}
          title="Water Supply"
        >
          <WaterIcon size={14} />
        </Button>
        
        <Button
          variant={overlayMode === 'fire' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setOverlayMode('fire')}
          className={`h-8 px-3 ${overlayMode === 'fire' ? 'bg-red-500 hover:bg-red-600' : ''}`}
          title="Fire Coverage"
        >
          <FireIcon size={14} />
        </Button>
        
        <Button
          variant={overlayMode === 'police' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setOverlayMode('police')}
          className={`h-8 px-3 ${overlayMode === 'police' ? 'bg-blue-500 hover:bg-blue-600' : ''}`}
          title="Police Coverage"
        >
          <SafetyIcon size={14} />
        </Button>
        
        <Button
          variant={overlayMode === 'health' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setOverlayMode('health')}
          className={`h-8 px-3 ${overlayMode === 'health' ? 'bg-green-500 hover:bg-green-600' : ''}`}
          title="Health Coverage"
        >
          <MedicalCrossIcon size={14} />
        </Button>
        
        <Button
          variant={overlayMode === 'education' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setOverlayMode('education')}
          className={`h-8 px-3 ${overlayMode === 'education' ? 'bg-purple-500 hover:bg-purple-600' : ''}`}
          title="Education Coverage"
        >
          <EducationIcon size={14} />
        </Button>
      </div>
    </Card>
  );
});

// Main Game Component
export default function Game() {
  const { state, setTool, setActivePanel } = useGame();
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('none');
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);
  const isInitialMount = useRef(true);
  const initialSelectedToolRef = useRef<Tool | null>(null);
  const previousSelectedToolRef = useRef<Tool | null>(null);
  const hasCapturedInitialTool = useRef(false);
  const currentSelectedToolRef = useRef<Tool>(state.selectedTool);
  
  // Keep currentSelectedToolRef in sync with state
  useEffect(() => {
    currentSelectedToolRef.current = state.selectedTool;
  }, [state.selectedTool]);
  
  // Track the initial selectedTool after localStorage loads (with a small delay to allow state to load)
  useEffect(() => {
    if (!hasCapturedInitialTool.current) {
      // Use a timeout to ensure localStorage state has loaded
      const timeoutId = setTimeout(() => {
        initialSelectedToolRef.current = currentSelectedToolRef.current;
        previousSelectedToolRef.current = currentSelectedToolRef.current;
        hasCapturedInitialTool.current = true;
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, []); // Only run once on mount
  
  // Auto-set overlay when selecting utility tools (but not on initial page load)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    // Don't auto-set overlay until we've captured the initial tool
    if (!hasCapturedInitialTool.current) {
      return;
    }
    
    // Don't auto-set overlay if this matches the initial tool from localStorage
    if (initialSelectedToolRef.current !== null && 
        initialSelectedToolRef.current === state.selectedTool) {
      return;
    }
    
    // Don't auto-set overlay if tool hasn't changed
    if (previousSelectedToolRef.current === state.selectedTool) {
      return;
    }
    
    // Update previous tool reference
    previousSelectedToolRef.current = state.selectedTool;
    
    if (state.selectedTool === 'power_plant') {
      setOverlayMode('power');
    } else if (state.selectedTool === 'water_tower') {
      setOverlayMode('water');
    } else if (state.selectedTool === 'fire_station') {
      setOverlayMode('fire');
    } else if (state.selectedTool === 'police_station') {
      setOverlayMode('police');
    } else if (state.selectedTool === 'hospital') {
      setOverlayMode('health');
    } else if (state.selectedTool === 'school' || state.selectedTool === 'university') {
      setOverlayMode('education');
    }
  }, [state.selectedTool]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === 'Escape') {
        if (overlayMode !== 'none') {
          setOverlayMode('none');
        } else if (state.activePanel !== 'none') {
          setActivePanel('none');
        } else if (selectedTile) {
          setSelectedTile(null);
        } else if (state.selectedTool !== 'select') {
          setTool('select');
        }
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        setTool('bulldoze');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.activePanel, state.selectedTool, selectedTile, setActivePanel, setTool, overlayMode]);
  
  return (
    <TooltipProvider>
      <div className="w-full h-full min-h-[720px] overflow-hidden bg-background flex">
        <Sidebar />
        
        <div className="flex-1 flex flex-col">
          <TopBar />
          <StatsPanel />
          <div className="flex-1 relative overflow-visible">
            <CanvasIsometricGrid overlayMode={overlayMode} selectedTile={selectedTile} setSelectedTile={setSelectedTile} />
            <OverlayModeToggle overlayMode={overlayMode} setOverlayMode={setOverlayMode} />
            <MiniMap />
          </div>
        </div>
        
        {state.activePanel === 'budget' && <BudgetPanel />}
        {state.activePanel === 'achievements' && <AchievementsPanel />}
        {state.activePanel === 'statistics' && <StatisticsPanel />}
        {state.activePanel === 'advisors' && <AdvisorsPanel />}
        {state.activePanel === 'settings' && <SettingsPanel />}
        
      </div>
    </TooltipProvider>
  );
}
