'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { Tool, TOOL_INFO, Tile, BuildingType, AdjacentCity } from '@/types/game';
import { getBuildingSize, requiresWaterAdjacency, getWaterAdjacency } from '@/lib/simulation';
import { useMobile } from '@/hooks/useMobile';
import { MobileToolbar } from '@/components/mobile/MobileToolbar';
import { MobileTopBar } from '@/components/mobile/MobileTopBar';
import {
  PlayIcon,
  PauseIcon,
  FastForwardIcon,
  CloseIcon,
  RoadIcon,
  SubwayIcon,
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
import exampleState from '@/resources/example_state.json';

// Import shadcn components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCheatCodes } from '@/hooks/useCheatCodes';
import { VinnieDialog } from '@/components/VinnieDialog';

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

// Airplane types for airport animation
type AirplaneState = 'flying' | 'landing' | 'taking_off' | 'taxiing';

type ContrailParticle = {
  x: number;
  y: number;
  age: number;
  opacity: number;
};

type Airplane = {
  id: number;
  // Screen position (isometric coordinates)
  x: number;
  y: number;
  // Flight direction in radians
  angle: number;
  // Current state
  state: AirplaneState;
  // Speed (pixels per second in screen space)
  speed: number;
  // Altitude (0 = ground, 1 = cruising altitude) - affects scale and shadow
  altitude: number;
  // Target altitude for transitions
  targetAltitude: number;
  // Airport tile coordinates (for landing/takeoff reference)
  airportX: number;
  airportY: number;
  // Progress for landing/takeoff (0-1)
  stateProgress: number;
  // Contrail particles
  contrail: ContrailParticle[];
  // Time until despawn (for flying planes)
  lifeTime: number;
  // Plane color/style
  color: string;
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

// Pedestrian types and destinations
type PedestrianDestType = 'school' | 'commercial' | 'industrial' | 'park' | 'home';

type Pedestrian = {
  id: number;
  tileX: number;
  tileY: number;
  direction: CarDirection;
  progress: number;
  speed: number;
  age: number;
  maxAge: number;
  skinColor: string;
  shirtColor: string;
  walkOffset: number; // For walking animation
  sidewalkSide: 'left' | 'right'; // Which side of the road they walk on
  destType: PedestrianDestType;
  homeX: number;
  homeY: number;
  destX: number;
  destY: number;
  returningHome: boolean;
  path: { x: number; y: number }[];
  pathIndex: number;
};

// Boat types for water navigation
type BoatState = 'sailing' | 'docked' | 'arriving' | 'departing';

type WakeParticle = {
  x: number;
  y: number;
  age: number;
  opacity: number;
};

type Boat = {
  id: number;
  // Screen position (isometric coordinates)
  x: number;
  y: number;
  // Movement direction in radians
  angle: number;
  // Target angle for smooth turning
  targetAngle: number;
  // Current state
  state: BoatState;
  // Speed (pixels per second in screen space)
  speed: number;
  // Origin marina/pier tile coordinates
  originX: number;
  originY: number;
  // Destination marina/pier tile coordinates
  destX: number;
  destY: number;
  // Screen position of destination
  destScreenX: number;
  destScreenY: number;
  // Lifetime/age tracking
  age: number;
  // Boat color/style
  color: string;
  // Wake particles (similar to plane contrails)
  wake: WakeParticle[];
  // Progress for wake spawning
  wakeSpawnProgress: number;
  // Boat size variant (0 = small, 1 = medium)
  sizeVariant: number;
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
  canvasSize: { width: number; height: number };
};

const CAR_COLORS = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#c084fc'];

// Pedestrian appearance colors
const PEDESTRIAN_SKIN_COLORS = ['#fdbf7e', '#e0ac69', '#c68642', '#8d5524', '#613318'];
const PEDESTRIAN_SHIRT_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff', '#1f2937'];

// Minimum zoom level to show pedestrians (zoomed in)
const PEDESTRIAN_MIN_ZOOM = 0.5;

// Airplane system constants
const AIRPLANE_MIN_POPULATION = 5000; // Minimum population required for airplane activity
const AIRPLANE_COLORS = ['#ffffff', '#1e40af', '#dc2626', '#059669', '#7c3aed']; // Airline liveries
const CONTRAIL_MAX_AGE = 3.0; // seconds
const CONTRAIL_SPAWN_INTERVAL = 0.02; // seconds between contrail particles

// Boat system constants
const BOAT_COLORS = ['#ffffff', '#1e3a5f', '#8b4513', '#2f4f4f', '#c41e3a', '#1e90ff']; // Various boat hull colors
const BOAT_MIN_ZOOM = 0.3; // Minimum zoom level to show boats
const WAKE_MAX_AGE = 2.0; // seconds - how long wake particles last
const WAKE_SPAWN_INTERVAL = 0.03; // seconds between wake particles

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
  // Adjust for the fact that tile centers are offset by half a tile from gridToScreen coordinates
  // gridToScreen returns the top-left corner of the bounding box, but the visual center of the
  // diamond tile is at (screenX + TILE_WIDTH/2, screenY + TILE_HEIGHT/2)
  const adjustedX = screenX - offsetX - TILE_WIDTH / 2;
  const adjustedY = screenY - offsetY - TILE_HEIGHT / 2;
  
  const gridX = (adjustedX / (TILE_WIDTH / 2) + adjustedY / (TILE_HEIGHT / 2)) / 2;
  const gridY = (adjustedY / (TILE_HEIGHT / 2) - adjustedX / (TILE_WIDTH / 2)) / 2;
  
  // Use Math.round for accurate tile selection - this gives us the tile whose center is closest
  return { gridX: Math.round(gridX), gridY: Math.round(gridY) };
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
  subway: <SubwayIcon size={16} />,
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

// Hover Submenu Component for collapsible tool categories
// Implements triangle-rule safe zone for forgiving cursor navigation
const HoverSubmenu = React.memo(function HoverSubmenu({
  label,
  tools,
  selectedTool,
  money,
  onSelectTool,
}: {
  label: string;
  tools: Tool[];
  selectedTool: Tool;
  money: number;
  onSelectTool: (tool: Tool) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, buttonHeight: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMousePos = useRef<{ x: number; y: number } | null>(null);
  
  const hasSelectedTool = tools.includes(selectedTool);
  const SUBMENU_GAP = 12; // Gap between sidebar and submenu
  
  const clearCloseTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);
  
  const handleMouseEnter = useCallback(() => {
    clearCloseTimeout();
    // Calculate position based on button location
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.top,
        left: rect.right + SUBMENU_GAP,
        buttonHeight: rect.height,
      });
    }
    setIsOpen(true);
  }, [clearCloseTimeout]);
  
  // Triangle rule: Check if cursor is moving toward the submenu
  const isMovingTowardSubmenu = useCallback((e: React.MouseEvent) => {
    if (!lastMousePos.current || !submenuRef.current) return false;
    
    const submenuRect = submenuRef.current.getBoundingClientRect();
    const currentX = e.clientX;
    const currentY = e.clientY;
    const lastX = lastMousePos.current.x;
    const lastY = lastMousePos.current.y;
    
    // Check if moving rightward (toward submenu)
    const movingRight = currentX > lastX;
    
    // Check if cursor is within vertical bounds of submenu (with generous padding)
    const padding = 50;
    const withinVerticalBounds = 
      currentY >= submenuRect.top - padding && 
      currentY <= submenuRect.bottom + padding;
    
    return movingRight && withinVerticalBounds;
  }, []);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, []);
  
  const handleMouseLeave = useCallback((e: React.MouseEvent) => {
    // If moving toward submenu, use a longer delay
    const delay = isMovingTowardSubmenu(e) ? 300 : 100;
    
    clearCloseTimeout();
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, delay);
  }, [clearCloseTimeout, isMovingTowardSubmenu]);
  
  const handleSubmenuEnter = useCallback(() => {
    clearCloseTimeout();
  }, [clearCloseTimeout]);
  
  const handleSubmenuLeave = useCallback(() => {
    clearCloseTimeout();
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 100);
  }, [clearCloseTimeout]);
  
  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return (
    <div 
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Category Header Button */}
      <Button
        ref={buttonRef}
        variant={hasSelectedTool ? 'default' : 'ghost'}
        className={`w-full justify-between gap-2 px-3 py-2.5 h-auto text-sm group transition-all duration-200 ${
          hasSelectedTool ? 'bg-primary text-primary-foreground' : ''
        } ${isOpen ? 'bg-muted/80' : ''}`}
      >
        <span className="font-medium">{label}</span>
        <svg 
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Button>
      
      {/* Invisible bridge/safe-zone between button and submenu for triangle rule */}
      {isOpen && (
        <div
          className="fixed"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left - SUBMENU_GAP}px`,
            width: `${SUBMENU_GAP + 8}px`, // Overlap slightly with submenu
            height: `${Math.max(menuPosition.buttonHeight, 200)}px`, // Tall enough to cover path
            zIndex: 9998,
          }}
          onMouseEnter={handleSubmenuEnter}
          onMouseLeave={handleSubmenuLeave}
        />
      )}
      
      {/* Flyout Submenu - uses fixed positioning to escape all parent containers */}
      {isOpen && (
        <div 
          ref={submenuRef}
          className="fixed w-52 bg-sidebar backdrop-blur-sm border border-sidebar-border rounded-md shadow-xl overflow-hidden animate-submenu-in"
          style={{ 
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(96, 165, 250, 0.1)',
            zIndex: 9999,
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
          }}
          onMouseEnter={handleSubmenuEnter}
          onMouseLeave={handleSubmenuLeave}
        >
          <div className="px-3 py-2 border-b border-sidebar-border/50 bg-muted/30">
            <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">{label}</span>
          </div>
          <div className="p-1.5 flex flex-col gap-0.5 max-h-64 overflow-y-auto">
            {tools.map(tool => {
              const info = TOOL_INFO[tool];
              if (!info) return null;
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
                  title={`${info.description}${info.cost > 0 ? ` - Cost: $${info.cost}` : ''}`}
                >
                  <span className="flex-1 text-left truncate">{info.name}</span>
                  {info.cost > 0 && (
                    <span className={`text-xs ${isSelected ? 'opacity-80' : 'opacity-50'}`}>${info.cost.toLocaleString()}</span>
                  )}
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

// Memoized Sidebar Component
const Sidebar = React.memo(function Sidebar() {
  const { state, setTool, setActivePanel } = useGame();
  const { selectedTool, stats, activePanel } = state;
  
  // Direct tool categories (shown inline)
  const directCategories = useMemo(() => ({
    'TOOLS': ['select', 'bulldoze', 'road', 'subway'] as Tool[],
    'ZONES': ['zone_residential', 'zone_commercial', 'zone_industrial', 'zone_dezone'] as Tool[],
  }), []);
  
  // Submenu categories (hover to expand) - includes all new assets from main
  const submenuCategories = useMemo(() => [
    { 
      key: 'services', 
      label: 'Services', 
      tools: ['police_station', 'fire_station', 'hospital', 'school', 'university'] as Tool[]
    },
    { 
      key: 'parks', 
      label: 'Parks', 
      tools: ['park', 'park_large', 'tennis', 'playground_small', 'playground_large', 'community_garden', 'pond_park', 'park_gate', 'greenhouse_garden'] as Tool[]
    },
    { 
      key: 'sports', 
      label: 'Sports', 
      tools: ['basketball_courts', 'soccer_field_small', 'baseball_field_small', 'football_field', 'baseball_stadium', 'swimming_pool', 'skate_park', 'bleachers_field'] as Tool[]
    },
    { 
      key: 'recreation', 
      label: 'Recreation', 
      tools: ['mini_golf_course', 'go_kart_track', 'amphitheater', 'roller_coaster_small', 'campground', 'cabin_house', 'mountain_lodge', 'mountain_trailhead'] as Tool[]
    },
    { 
      key: 'waterfront', 
      label: 'Waterfront', 
      tools: ['marina_docks_small', 'pier_large'] as Tool[]
    },
    { 
      key: 'community', 
      label: 'Community', 
      tools: ['community_center', 'animal_pens_farm', 'office_building_small'] as Tool[]
    },
    { 
      key: 'utilities', 
      label: 'Utilities', 
      tools: ['power_plant', 'water_tower', 'subway_station'] as Tool[]
    },
    { 
      key: 'special', 
      label: 'Special', 
      tools: ['stadium', 'museum', 'airport', 'space_program', 'city_hall', 'amusement_park'] as Tool[]
    },
  ], []);
  
  return (
    <div className="w-56 bg-sidebar border-r border-sidebar-border flex flex-col h-full relative z-40">
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <span className="text-sidebar-foreground font-bold tracking-tight">ISOCITY</span>
        </div>
      </div>
      
      <ScrollArea className="flex-1 py-2">
        {/* Direct categories (TOOLS, ZONES) */}
        {Object.entries(directCategories).map(([category, tools]) => (
          <div key={category} className="mb-1">
            <div className="px-4 py-2 text-[10px] font-bold tracking-widest text-muted-foreground">
              {category}
            </div>
            <div className="px-2 flex flex-col gap-0.5">
              {tools.map(tool => {
                const info = TOOL_INFO[tool];
                if (!info) return null;
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
        
        {/* Separator */}
        <div className="mx-4 my-2 h-px bg-sidebar-border/50" />
        
        {/* Buildings header */}
        <div className="px-4 py-2 text-[10px] font-bold tracking-widest text-muted-foreground">
          BUILDINGS
        </div>
        
        {/* Submenu categories */}
        <div className="px-2 flex flex-col gap-0.5">
          {submenuCategories.map(({ key, label, tools }) => (
            <HoverSubmenu
              key={key}
              label={label}
              tools={tools}
              selectedTool={selectedTool}
              money={stats.money}
              onSelectTool={setTool}
            />
          ))}
        </div>
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

// Sun/Moon icon for time of day
const TimeOfDayIcon = ({ hour }: { hour: number }) => {
  const isNight = hour < 6 || hour >= 20;
  const isDawn = hour >= 6 && hour < 8;
  const isDusk = hour >= 18 && hour < 20;
  
  if (isNight) {
    // Moon icon
    return (
      <svg className="w-4 h-4 text-blue-300" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
      </svg>
    );
  } else if (isDawn || isDusk) {
    // Sunrise/sunset icon
    return (
      <svg className="w-4 h-4 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
      </svg>
    );
  } else {
    // Sun icon
    return (
      <svg className="w-4 h-4 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
      </svg>
    );
  }
};

// Memoized TopBar Component
const TopBar = React.memo(function TopBar() {
  const { state, setSpeed, setTaxRate, isSaving } = useGame();
  const { stats, year, month, hour, speed, taxRate, cityName } = state;
  
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
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-mono tabular-nums">
            <span>{monthNames[month - 1]} {year}</span>
            <TimeOfDayIcon hour={hour} />
          </div>
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
            max={50}
            step={1}
            className="w-16"
          />
          <span className="text-foreground text-xs font-mono tabular-nums w-8">{taxRate}%</span>
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
    <div className="flex flex-col items-start min-w-[70px]">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-0.5">{label}</div>
      <div className={`text-sm font-mono tabular-nums font-semibold ${colorClass}`}>{value}</div>
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
const MiniMap = React.memo(function MiniMap({ onNavigate, viewport }: { 
  onNavigate?: (gridX: number, gridY: number) => void;
  viewport?: { offset: { x: number; y: number }; zoom: number; canvasSize: { width: number; height: number } } | null;
}) {
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
        
        // Check for elevation first (hilly terrain shows as grey)
        const elevation = tile.elevation ?? 0;
        if (elevation > 0.2 && tile.building.type !== 'water' && tile.building.type !== 'road') {
          // Blend from green to grey based on elevation
          if (elevation >= 0.85) {
            color = '#d0d0d0'; // Snow-capped peaks - very light grey
          } else if (elevation >= 0.5) {
            color = '#8b8b8b'; // High elevation - grey
          } else {
            color = '#5a6a5a'; // Low hills - grey-green
          }
        } else if (tile.building.type === 'water') color = '#0ea5e9';
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
        else if (tile.building.type === 'park' || tile.building.type === 'park_large' || tile.building.type === 'tennis' ||
          ['basketball_courts', 'playground_small', 'playground_large', 'baseball_field_small', 
           'soccer_field_small', 'football_field', 'baseball_stadium', 'community_center',
           'swimming_pool', 'skate_park', 'mini_golf_course', 'bleachers_field', 'go_kart_track',
           'amphitheater', 'greenhouse_garden', 'animal_pens_farm', 'cabin_house', 'campground',
           'marina_docks_small', 'pier_large', 'roller_coaster_small', 'community_garden',
           'pond_park', 'park_gate', 'mountain_lodge', 'mountain_trailhead', 'office_building_small'].includes(tile.building.type)) color = '#84cc16';
        else if (tile.building.onFire) color = '#ef4444';
        
        ctx.fillStyle = color;
        ctx.fillRect(x * scale, y * scale, Math.ceil(scale), Math.ceil(scale));
      }
    }
    
    // Draw viewport rectangle
    if (viewport) {
      const { offset, zoom, canvasSize } = viewport;
      
      // Calculate the corners of the viewport in screen space
      // Then convert to grid coordinates
      const topLeftScreen = { x: 0, y: 0 };
      const topRightScreen = { x: canvasSize.width, y: 0 };
      const bottomLeftScreen = { x: 0, y: canvasSize.height };
      const bottomRightScreen = { x: canvasSize.width, y: canvasSize.height };
      
      // Convert screen corners to grid coordinates
      const screenToGridForMinimap = (screenX: number, screenY: number) => {
        const adjustedX = (screenX - offset.x) / zoom;
        const adjustedY = (screenY - offset.y) / zoom;
        const gridX = (adjustedX / (TILE_WIDTH / 2) + adjustedY / (TILE_HEIGHT / 2)) / 2;
        const gridY = (adjustedY / (TILE_HEIGHT / 2) - adjustedX / (TILE_WIDTH / 2)) / 2;
        return { gridX, gridY };
      };
      
      const topLeft = screenToGridForMinimap(topLeftScreen.x, topLeftScreen.y);
      const topRight = screenToGridForMinimap(topRightScreen.x, topRightScreen.y);
      const bottomLeft = screenToGridForMinimap(bottomLeftScreen.x, bottomLeftScreen.y);
      const bottomRight = screenToGridForMinimap(bottomRightScreen.x, bottomRightScreen.y);
      
      // Draw the viewport as a quadrilateral (it's a diamond in isometric)
      // Use a white stroke for visibility
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(topLeft.gridX * scale, topLeft.gridY * scale);
      ctx.lineTo(topRight.gridX * scale, topRight.gridY * scale);
      ctx.lineTo(bottomRight.gridX * scale, bottomRight.gridY * scale);
      ctx.lineTo(bottomLeft.gridX * scale, bottomLeft.gridY * scale);
      ctx.closePath();
      ctx.stroke();
    }
  }, [grid, gridSize, viewport]);

  const [isDragging, setIsDragging] = useState(false);
  
  const navigateToPosition = useCallback((e: React.MouseEvent<HTMLCanvasElement> | MouseEvent) => {
    if (!onNavigate) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    const size = 140;
    const scale = size / gridSize;
    
    const gridX = Math.floor(clickX / scale);
    const gridY = Math.floor(clickY / scale);
    
    // Clamp to valid grid coordinates
    const clampedX = Math.max(0, Math.min(gridSize - 1, gridX));
    const clampedY = Math.max(0, Math.min(gridSize - 1, gridY));
    
    onNavigate(clampedX, clampedY);
  }, [onNavigate, gridSize]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    navigateToPosition(e);
  }, [navigateToPosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      navigateToPosition(e);
    }
  }, [isDragging, navigateToPosition]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle mouse up outside the canvas
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => setIsDragging(false);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging]);
  
  return (
    <Card className="absolute bottom-6 right-8 p-3 shadow-lg bg-card/90 border-border/70">
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold mb-2">
        Minimap
      </div>
      <canvas
        ref={canvasRef}
        width={140}
        height={140}
        className="block rounded-md border border-border/60 cursor-pointer select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
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
              <div className="font-mono tabular-nums font-semibold text-green-400">{stats.population.toLocaleString()}</div>
            </Card>
            <Card className="p-3">
              <div className="text-muted-foreground text-xs mb-1">Jobs</div>
              <div className="font-mono tabular-nums font-semibold text-blue-400">{stats.jobs.toLocaleString()}</div>
            </Card>
            <Card className="p-3">
              <div className="text-muted-foreground text-xs mb-1">Treasury</div>
              <div className="font-mono tabular-nums font-semibold text-amber-400">${stats.money.toLocaleString()}</div>
            </Card>
            <Card className="p-3">
              <div className="text-muted-foreground text-xs mb-1">Monthly</div>
              <div className={`font-mono tabular-nums font-semibold ${stats.income - stats.expenses >= 0 ? 'text-green-400' : 'text-red-400'}`}>
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const [newCityName, setNewCityName] = useState(cityName);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const [importValue, setImportValue] = useState('');
  const [exportCopied, setExportCopied] = useState(false);
  const [importError, setImportError] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  
  // Initialize showSpriteTest from query parameter
  const spriteTestFromUrl = searchParams.get('spriteTest') === 'true';
  const [showSpriteTest, setShowSpriteTest] = useState(spriteTestFromUrl);
  const lastUrlValueRef = useRef(spriteTestFromUrl);
  const isUpdatingFromStateRef = useRef(false);
  
  // Sync state with query parameter when URL changes externally
  useEffect(() => {
    const spriteTestParam = searchParams.get('spriteTest') === 'true';
    // Only update if URL value actually changed and we're not updating from state
    if (spriteTestParam !== lastUrlValueRef.current && !isUpdatingFromStateRef.current) {
      lastUrlValueRef.current = spriteTestParam;
      setTimeout(() => setShowSpriteTest(spriteTestParam), 0);
    }
  }, [searchParams]);
  
  // Sync query parameter when showSpriteTest changes (but avoid loops)
  useEffect(() => {
    const currentParam = searchParams.get('spriteTest') === 'true';
    if (currentParam === showSpriteTest) return; // Already in sync
    
    isUpdatingFromStateRef.current = true;
    lastUrlValueRef.current = showSpriteTest;
    
    const params = new URLSearchParams(searchParams.toString());
    if (showSpriteTest) {
      params.set('spriteTest', 'true');
    } else {
      params.delete('spriteTest');
    }
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    router.replace(newUrl, { scroll: false });
    
    // Reset flag after URL update
    setTimeout(() => {
      isUpdatingFromStateRef.current = false;
    }, 0);
  }, [showSpriteTest, searchParams, router]);
  
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
            <Button
              variant="outline"
              className="w-full mt-2"
              onClick={() => {
                loadState(JSON.stringify(exampleState));
                setActivePanel('none');
              }}
            >
              Load Example State
            </Button>
          </div>
        </div>
      </DialogContent>
      
      {showSpriteTest && (
        <SpriteTestPanel onClose={() => {
          setShowSpriteTest(false);
          // Query param will be cleared by useEffect above
        }} />
      )}
    </Dialog>
  );
}

// Background color to filter
const BACKGROUND_COLOR = { r: 255, g: 0, b: 0 };
// Color distance threshold - pixels within this distance will be made transparent
const COLOR_THRESHOLD = 165; // Adjust this value to be more/less aggressive (increased from 10 for better filtering)

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
  const [activeTab, setActiveTab] = useState<string>('main');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [spriteSheets, setSpriteSheets] = useState<Record<string, HTMLImageElement | null>>({
    main: null,
    construction: null,
    abandoned: null,
    dense: null,
    parks: null,
    parksConstruction: null,
  });
  
  // Load all sprite sheets from current pack
  useEffect(() => {
    const loadSheet = (src: string | undefined, key: string): Promise<void> => {
      if (!src) {
        setSpriteSheets(prev => ({ ...prev, [key]: null }));
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          setSpriteSheets(prev => ({ ...prev, [key]: img }));
          resolve();
        };
        img.onerror = () => {
          setSpriteSheets(prev => ({ ...prev, [key]: null }));
          resolve();
        };
        img.src = src;
      });
    };
    
    Promise.all([
      loadSheet(currentSpritePack.src, 'main'),
      loadSheet(currentSpritePack.constructionSrc, 'construction'),
      loadSheet(currentSpritePack.abandonedSrc, 'abandoned'),
      loadSheet(currentSpritePack.denseSrc, 'dense'),
      loadSheet(currentSpritePack.parksSrc, 'parks'),
      loadSheet(currentSpritePack.parksConstructionSrc, 'parksConstruction'),
    ]);
  }, [currentSpritePack]);
  
  // Draw sprite test grid
  useEffect(() => {
    const canvas = canvasRef.current;
    const spriteSheet = spriteSheets[activeTab];
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
    
    const tileW = 64;
    const tileH = tileW * 0.6;
    const padding = 30;
    const labelHeight = 20;
    const cols = 5;
    
    let itemsToRender: Array<{ label: string; coords: { sx: number; sy: number; sw: number; sh: number }; index?: number }> = [];
    let sheetWidth = spriteSheet.naturalWidth || spriteSheet.width;
    let sheetHeight = spriteSheet.naturalHeight || spriteSheet.height;
    let sheetCols = currentSpritePack.cols;
    let sheetRows = currentSpritePack.rows;
    
    if (activeTab === 'main') {
      // Main sprite sheet - use spriteOrder
      currentSpritePack.spriteOrder.forEach((spriteKey, index) => {
        const buildingType = Object.entries(currentSpritePack.buildingToSprite).find(
          ([, value]) => value === spriteKey
        )?.[0] || spriteKey;
        const coords = getSpriteCoords(buildingType, sheetWidth, sheetHeight, currentSpritePack);
        if (coords) {
          itemsToRender.push({ label: spriteKey, coords, index });
        }
      });
    } else if (activeTab === 'construction' && currentSpritePack.constructionSrc) {
      // Construction sprite sheet - same layout as main
      currentSpritePack.spriteOrder.forEach((spriteKey, index) => {
        const buildingType = Object.entries(currentSpritePack.buildingToSprite).find(
          ([, value]) => value === spriteKey
        )?.[0] || spriteKey;
        const coords = getSpriteCoords(buildingType, sheetWidth, sheetHeight, currentSpritePack);
        if (coords) {
          itemsToRender.push({ label: `${spriteKey} (construction)`, coords, index });
        }
      });
    } else if (activeTab === 'abandoned' && currentSpritePack.abandonedSrc) {
      // Abandoned sprite sheet - same layout as main
      currentSpritePack.spriteOrder.forEach((spriteKey, index) => {
        const buildingType = Object.entries(currentSpritePack.buildingToSprite).find(
          ([, value]) => value === spriteKey
        )?.[0] || spriteKey;
        const coords = getSpriteCoords(buildingType, sheetWidth, sheetHeight, currentSpritePack);
        if (coords) {
          itemsToRender.push({ label: `${spriteKey} (abandoned)`, coords, index });
        }
      });
    } else if (activeTab === 'dense' && currentSpritePack.denseSrc && currentSpritePack.denseVariants) {
      // Dense sprite sheet - use denseVariants mapping
      sheetCols = currentSpritePack.cols;
      sheetRows = currentSpritePack.rows;
      const tileWidth = Math.floor(sheetWidth / sheetCols);
      const tileHeight = Math.floor(sheetHeight / sheetRows);
      
      Object.entries(currentSpritePack.denseVariants).forEach(([buildingType, variants]) => {
        variants.forEach((variant, variantIndex) => {
          const sx = variant.col * tileWidth;
          const sy = variant.row * tileHeight;
          itemsToRender.push({
            label: `${buildingType} (dense ${variantIndex + 1})`,
            coords: { sx, sy, sw: tileWidth, sh: tileHeight },
          });
        });
      });
    } else if (activeTab === 'parks' && currentSpritePack.parksSrc && currentSpritePack.parksBuildings) {
      // Parks sprite sheet - use parksBuildings mapping
      sheetCols = currentSpritePack.parksCols || currentSpritePack.cols;
      sheetRows = currentSpritePack.parksRows || currentSpritePack.rows;
      const tileWidth = Math.floor(sheetWidth / sheetCols);
      const tileHeight = Math.floor(sheetHeight / sheetRows);
      
      Object.entries(currentSpritePack.parksBuildings).forEach(([buildingType, pos]) => {
        const sx = pos.col * tileWidth;
        const sy = pos.row * tileHeight;
        itemsToRender.push({
          label: buildingType,
          coords: { sx, sy, sw: tileWidth, sh: tileHeight },
        });
      });
    } else if (activeTab === 'parksConstruction' && currentSpritePack.parksConstructionSrc && currentSpritePack.parksBuildings) {
      // Parks construction sprite sheet - same layout as parks
      sheetCols = currentSpritePack.parksCols || currentSpritePack.cols;
      sheetRows = currentSpritePack.parksRows || currentSpritePack.rows;
      const tileWidth = Math.floor(sheetWidth / sheetCols);
      const tileHeight = Math.floor(sheetHeight / sheetRows);
      
      Object.entries(currentSpritePack.parksBuildings).forEach(([buildingType, pos]) => {
        const sx = pos.col * tileWidth;
        const sy = pos.row * tileHeight;
        itemsToRender.push({
          label: `${buildingType} (construction)`,
          coords: { sx, sy, sw: tileWidth, sh: tileHeight },
        });
      });
    }
    
    const rows = Math.ceil(itemsToRender.length / cols);
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
    itemsToRender.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      
      // Calculate isometric position for this grid cell
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
      
      // Calculate destination size preserving aspect ratio
      const destWidth = tileW * 1.2;
      const aspectRatio = item.coords.sh / item.coords.sw;
      const destHeight = destWidth * aspectRatio;
      
      // Position: center on tile
      const drawX = baseX - destWidth / 2;
      const drawY = baseY + tileH / 2 - destHeight + destHeight * 0.15;
      
      // Draw sprite (using filtered version if available)
      const sheetSrc = activeTab === 'main' ? currentSpritePack.src :
                       activeTab === 'construction' ? currentSpritePack.constructionSrc :
                       activeTab === 'abandoned' ? currentSpritePack.abandonedSrc :
                       activeTab === 'dense' ? currentSpritePack.denseSrc :
                       activeTab === 'parksConstruction' ? currentSpritePack.parksConstructionSrc :
                       currentSpritePack.parksSrc;
      const filteredSpriteSheet = sheetSrc ? (imageCache.get(`${sheetSrc}_filtered`) || spriteSheet) : spriteSheet;
      
      ctx.drawImage(
        filteredSpriteSheet,
        item.coords.sx, item.coords.sy, item.coords.sw, item.coords.sh,
        Math.round(drawX), Math.round(drawY),
        Math.round(destWidth), Math.round(destHeight)
      );
      
      // Draw label
      ctx.fillStyle = '#888';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      const labelLines = item.label.split(' ');
      labelLines.forEach((line, i) => {
        ctx.fillText(line, baseX, baseY + tileH + 16 + i * 10);
      });
      
      // Draw index if available
      if (item.index !== undefined) {
        ctx.fillStyle = '#666';
        ctx.font = '8px monospace';
        ctx.fillText(`[${item.index}]`, baseX, baseY + tileH + 26 + labelLines.length * 10);
      }
    });
  }, [spriteSheets, activeTab, currentSpritePack]);
  
  const availableTabs = [
    { id: 'main', label: 'Main', available: !!spriteSheets.main },
    { id: 'construction', label: 'Construction', available: !!spriteSheets.construction },
    { id: 'abandoned', label: 'Abandoned', available: !!spriteSheets.abandoned },
    { id: 'dense', label: 'High Density', available: !!spriteSheets.dense },
    { id: 'parks', label: 'Parks', available: !!spriteSheets.parks },
    { id: 'parksConstruction', label: 'Parks Construction', available: !!spriteSheets.parksConstruction },
  ].filter(tab => tab.available);
  
  // Set first available tab if current tab is not available
  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.find(t => t.id === activeTab)) {
      setActiveTab(availableTabs[0].id);
    }
  }, [availableTabs, activeTab]);
  
  const currentSheetInfo = activeTab === 'main' ? currentSpritePack.src :
                          activeTab === 'construction' ? currentSpritePack.constructionSrc :
                          activeTab === 'abandoned' ? currentSpritePack.abandonedSrc :
                          activeTab === 'dense' ? currentSpritePack.denseSrc :
                          activeTab === 'parksConstruction' ? currentSpritePack.parksConstructionSrc :
                          currentSpritePack.parksSrc;
  
  const gridInfo = (activeTab === 'parks' || activeTab === 'parksConstruction') && currentSpritePack.parksCols && currentSpritePack.parksRows
    ? `${currentSpritePack.parksCols}x${currentSpritePack.parksRows}`
    : `${currentSpritePack.cols}x${currentSpritePack.rows}`;
  
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Sprite Test View</DialogTitle>
          <DialogDescription>
            View all sprite variants from &quot;{currentSpritePack.name}&quot;
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${availableTabs.length}, 1fr)` }}>
            {availableTabs.map(tab => (
              <TabsTrigger key={tab.id} value={tab.id} className="text-xs">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        
        <div className="overflow-auto max-h-[70vh] bg-[#1a1a2e] rounded-lg">
          <canvas
            ref={canvasRef}
            className="mx-auto"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>
        
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Sprite sheet: {currentSheetInfo} ({gridInfo} grid)</p>
          <p>Edit offsets in <code className="bg-muted px-1 rounded">src/lib/renderConfig.ts</code> → each sprite pack&apos;s verticalOffsets</p>
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

type OverlayMode = 'none' | 'power' | 'water' | 'fire' | 'police' | 'health' | 'education' | 'subway';

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
function CanvasIsometricGrid({ overlayMode, selectedTile, setSelectedTile, isMobile = false, navigationTarget, onNavigationComplete, onViewportChange }: {
  overlayMode: OverlayMode;
  selectedTile: { x: number; y: number } | null;
  setSelectedTile: (tile: { x: number; y: number } | null) => void;
  isMobile?: boolean;
  navigationTarget?: { x: number; y: number } | null;
  onNavigationComplete?: () => void;
  onViewportChange?: (viewport: { offset: { x: number; y: number }; zoom: number; canvasSize: { width: number; height: number } }) => void;
}) {
  const { state, placeAtTile, connectToCity, currentSpritePack } = useGame();
  const { grid, gridSize, selectedTool, speed, adjacentCities, waterBodies, hour } = state;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const carsCanvasRef = useRef<HTMLCanvasElement>(null);
  const lightingCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: isMobile ? 200 : 620, y: isMobile ? 100 : 160 });
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredTile, setHoveredTile] = useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(isMobile ? 0.6 : 1);
  const carsRef = useRef<Car[]>([]);
  const carIdRef = useRef(0);
  const carSpawnTimerRef = useRef(0);
  const emergencyVehiclesRef = useRef<EmergencyVehicle[]>([]);
  const emergencyVehicleIdRef = useRef(0);
  const emergencyDispatchTimerRef = useRef(0);
  const activeFiresRef = useRef<Set<string>>(new Set()); // Track fires that already have a truck dispatched
  const activeCrimesRef = useRef<Set<string>>(new Set()); // Track crimes that already have a car dispatched
  const activeCrimeIncidentsRef = useRef<Map<string, { x: number; y: number; type: 'robbery' | 'burglary' | 'disturbance' | 'traffic'; timeRemaining: number }>>(new Map()); // Persistent crime incidents
  const crimeSpawnTimerRef = useRef(0); // Timer for spawning new crime incidents
  
  // Pedestrian system refs
  const pedestriansRef = useRef<Pedestrian[]>([]);
  const pedestrianIdRef = useRef(0);
  const pedestrianSpawnTimerRef = useRef(0);
  
  // Touch gesture state for mobile
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const initialPinchDistanceRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(zoom);
  const lastTouchCenterRef = useRef<{ x: number; y: number } | null>(null);
  
  // Airplane system refs
  const airplanesRef = useRef<Airplane[]>([]);
  const airplaneIdRef = useRef(0);
  const airplaneSpawnTimerRef = useRef(0);

  // Boat system refs
  const boatsRef = useRef<Boat[]>([]);
  const boatIdRef = useRef(0);
  const boatSpawnTimerRef = useRef(0);

  // Performance: Cache expensive grid calculations
  const cachedRoadTileCountRef = useRef<{ count: number; gridVersion: number }>({ count: 0, gridVersion: -1 });
  const cachedPopulationRef = useRef<{ count: number; gridVersion: number }>({ count: 0, gridVersion: -1 });
  const gridVersionRef = useRef(0);

  const worldStateRef = useRef<WorldRenderState>({
    grid,
    gridSize,
    offset,
    zoom,
    speed,
    canvasSize: { width: 1200, height: 800 },
  });
  const [lastPlacedTile, setLastPlacedTile] = useState<{ x: number; y: number } | null>(null);
  const [roadDrawDirection, setRoadDrawDirection] = useState<'h' | 'v' | null>(null);
  const placedRoadTilesRef = useRef<Set<string>>(new Set());
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
    // Increment grid version to invalidate cached calculations
    gridVersionRef.current++;
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

  useEffect(() => {
    worldStateRef.current.canvasSize = canvasSize;
  }, [canvasSize]);

  // Notify parent of viewport changes for minimap
  useEffect(() => {
    onViewportChange?.({ offset, zoom, canvasSize });
  }, [offset, zoom, canvasSize, onViewportChange]);

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
        const { zoom: currentZoom, gridSize: n, canvasSize: cs } = worldStateRef.current;
        // Calculate bounds inline
        const padding = 100;
        const mapLeft = -(n - 1) * TILE_WIDTH / 2;
        const mapRight = (n - 1) * TILE_WIDTH / 2;
        const mapTop = 0;
        const mapBottom = (n - 1) * TILE_HEIGHT;
        const minOffsetX = padding - mapRight * currentZoom;
        const maxOffsetX = cs.width - padding - mapLeft * currentZoom;
        const minOffsetY = padding - mapBottom * currentZoom;
        const maxOffsetY = cs.height - padding - mapTop * currentZoom;
        
        setOffset(prev => ({
          x: Math.max(minOffsetX, Math.min(maxOffsetX, prev.x + dx)),
          y: Math.max(minOffsetY, Math.min(maxOffsetY, prev.y + dy)),
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
        maxAge: 1800 + Math.random() * 2700,
        color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
        laneOffset: (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 3),
      });
      return true;
    }
    
    return false;
  }, []);

  // Find residential buildings for pedestrian spawning
  const findResidentialBuildings = useCallback((): { x: number; y: number }[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return [];
    
    const residentials: { x: number; y: number }[] = [];
    const residentialTypes: BuildingType[] = ['house_small', 'house_medium', 'mansion', 'apartment_low', 'apartment_high'];
    
    for (let y = 0; y < currentGridSize; y++) {
      for (let x = 0; x < currentGridSize; x++) {
        // Include any residential building (not just populated ones)
        if (residentialTypes.includes(currentGrid[y][x].building.type)) {
          residentials.push({ x, y });
        }
      }
    }
    return residentials;
  }, []);

  // Find destinations for pedestrians (schools, commercial, industrial, parks)
  const findPedestrianDestinations = useCallback((): { x: number; y: number; type: PedestrianDestType }[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return [];
    
    const destinations: { x: number; y: number; type: PedestrianDestType }[] = [];
    const schoolTypes: BuildingType[] = ['school', 'university'];
    const commercialTypes: BuildingType[] = ['shop_small', 'shop_medium', 'office_low', 'office_high', 'mall'];
    const industrialTypes: BuildingType[] = ['factory_small', 'factory_medium', 'factory_large', 'warehouse'];
    const parkTypes: BuildingType[] = ['park', 'park_large', 'tennis', 
      'basketball_courts', 'playground_small', 'playground_large', 'baseball_field_small',
      'soccer_field_small', 'football_field', 'baseball_stadium', 'community_center',
      'swimming_pool', 'skate_park', 'mini_golf_course', 'bleachers_field', 'go_kart_track',
      'amphitheater', 'greenhouse_garden', 'animal_pens_farm', 'cabin_house', 'campground',
      'marina_docks_small', 'pier_large', 'roller_coaster_small', 'community_garden',
      'pond_park', 'park_gate', 'mountain_lodge', 'mountain_trailhead'];
    
    for (let y = 0; y < currentGridSize; y++) {
      for (let x = 0; x < currentGridSize; x++) {
        const buildingType = currentGrid[y][x].building.type;
        if (schoolTypes.includes(buildingType)) {
          destinations.push({ x, y, type: 'school' });
        } else if (commercialTypes.includes(buildingType)) {
          // Include any commercial building
          destinations.push({ x, y, type: 'commercial' });
        } else if (industrialTypes.includes(buildingType)) {
          // Include any industrial building
          destinations.push({ x, y, type: 'industrial' });
        } else if (parkTypes.includes(buildingType)) {
          destinations.push({ x, y, type: 'park' });
        }
      }
    }
    return destinations;
  }, []);

  // Spawn a pedestrian from a residential building to a destination
  const spawnPedestrian = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return false;
    
    const residentials = findResidentialBuildings();
    if (residentials.length === 0) {
      return false;
    }
    
    const destinations = findPedestrianDestinations();
    if (destinations.length === 0) {
      return false;
    }
    
    // Pick a random residential building as home
    const home = residentials[Math.floor(Math.random() * residentials.length)];
    
    // Pick a random destination
    const dest = destinations[Math.floor(Math.random() * destinations.length)];
    
    // Find path from home to destination via roads
    const path = findPathOnRoads(currentGrid, currentGridSize, home.x, home.y, dest.x, dest.y);
    if (!path || path.length === 0) {
      return false;
    }
    
    // Start at a random point along the path for better distribution
    const startIndex = Math.floor(Math.random() * path.length);
    const startTile = path[startIndex];
    
    // Determine initial direction based on next tile in path
    let direction: CarDirection = 'south';
    if (startIndex + 1 < path.length) {
      const nextTile = path[startIndex + 1];
      const dir = getDirectionToTile(startTile.x, startTile.y, nextTile.x, nextTile.y);
      if (dir) direction = dir;
    } else if (startIndex > 0) {
      // At end of path, use previous tile to determine direction
      const prevTile = path[startIndex - 1];
      const dir = getDirectionToTile(prevTile.x, prevTile.y, startTile.x, startTile.y);
      if (dir) direction = dir;
    }
    
    pedestriansRef.current.push({
      id: pedestrianIdRef.current++,
      tileX: startTile.x,
      tileY: startTile.y,
      direction,
      progress: Math.random(),
      speed: 0.12 + Math.random() * 0.08, // Pedestrians are slower than cars
      pathIndex: startIndex,
      age: 0,
      maxAge: 60 + Math.random() * 90, // 60-150 seconds lifespan
      skinColor: PEDESTRIAN_SKIN_COLORS[Math.floor(Math.random() * PEDESTRIAN_SKIN_COLORS.length)],
      shirtColor: PEDESTRIAN_SHIRT_COLORS[Math.floor(Math.random() * PEDESTRIAN_SHIRT_COLORS.length)],
      walkOffset: Math.random() * Math.PI * 2,
      sidewalkSide: Math.random() < 0.5 ? 'left' : 'right',
      destType: dest.type,
      homeX: home.x,
      homeY: home.y,
      destX: dest.x,
      destY: dest.y,
      returningHome: startIndex >= path.length - 1, // If starting at end, they're returning
      path,
    });
    
    return true;
  }, [findResidentialBuildings, findPedestrianDestinations]);

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

  // Spawn new crime incidents periodically (persistent like fires)
  const spawnCrimeIncidents = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) return;
    
    const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2 : 3;
    crimeSpawnTimerRef.current -= delta * speedMultiplier;
    
    // Spawn new crimes every 3-5 seconds (game time adjusted)
    if (crimeSpawnTimerRef.current > 0) return;
    crimeSpawnTimerRef.current = 3 + Math.random() * 2;
    
    // Collect eligible tiles for crime (buildings with activity)
    const eligibleTiles: { x: number; y: number; policeCoverage: number }[] = [];
    
    for (let y = 0; y < currentGridSize; y++) {
      for (let x = 0; x < currentGridSize; x++) {
        const tile = currentGrid[y][x];
        // Only consider populated buildings (residential/commercial/industrial)
        // FIX: Proper parentheses for operator precedence
        const isBuilding = tile.building.type !== 'grass' && 
            tile.building.type !== 'water' && 
            tile.building.type !== 'road' && 
            tile.building.type !== 'tree' &&
            tile.building.type !== 'empty';
        const hasActivity = tile.building.population > 0 || tile.building.jobs > 0;
        
        if (isBuilding && hasActivity) {
          const policeCoverage = state.services.police[y]?.[x] || 0;
          // Crime can happen anywhere, but more likely in low-coverage areas
          eligibleTiles.push({ x, y, policeCoverage });
        }
      }
    }
    
    if (eligibleTiles.length === 0) return;
    
    // Determine how many new crimes to spawn (based on city size and coverage)
    const avgCoverage = eligibleTiles.reduce((sum, t) => sum + t.policeCoverage, 0) / eligibleTiles.length;
    const baseChance = avgCoverage < 20 ? 0.4 : avgCoverage < 40 ? 0.25 : avgCoverage < 60 ? 0.15 : 0.08;
    
    // Max active crimes based on population (more people = more potential crime)
    const population = state.stats.population;
    const maxActiveCrimes = Math.max(2, Math.floor(population / 500));
    
    if (activeCrimeIncidentsRef.current.size >= maxActiveCrimes) return;
    
    // Try to spawn 1-2 crimes
    const crimesToSpawn = Math.random() < 0.3 ? 2 : 1;
    
    for (let i = 0; i < crimesToSpawn; i++) {
      if (activeCrimeIncidentsRef.current.size >= maxActiveCrimes) break;
      if (Math.random() > baseChance) continue;
      
      // Weight selection toward low-coverage areas
      const weightedTiles = eligibleTiles.filter(t => {
        const key = `${t.x},${t.y}`;
        if (activeCrimeIncidentsRef.current.has(key)) return false;
        // Higher weight for lower coverage
        const weight = Math.max(0.1, 1 - t.policeCoverage / 100);
        return Math.random() < weight;
      });
      
      if (weightedTiles.length === 0) continue;
      
      const target = weightedTiles[Math.floor(Math.random() * weightedTiles.length)];
      const key = `${target.x},${target.y}`;
      
      // Different crime types with different durations
      const crimeTypes: Array<'robbery' | 'burglary' | 'disturbance' | 'traffic'> = ['robbery', 'burglary', 'disturbance', 'traffic'];
      const crimeType = crimeTypes[Math.floor(Math.random() * crimeTypes.length)];
      const duration = crimeType === 'traffic' ? 15 : crimeType === 'disturbance' ? 20 : 30; // Seconds to resolve if no police
      
      activeCrimeIncidentsRef.current.set(key, {
        x: target.x,
        y: target.y,
        type: crimeType,
        timeRemaining: duration,
      });
    }
  }, [state.services.police, state.stats.population]);
  
  // Update crime incidents (decay over time if not responded to)
  const updateCrimeIncidents = useCallback((delta: number) => {
    const { speed: currentSpeed } = worldStateRef.current;
    if (currentSpeed === 0) return;
    
    const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2 : 3;
    const keysToDelete: string[] = [];
    
    // Iterate and track which crimes to delete
    activeCrimeIncidentsRef.current.forEach((crime, key) => {
      // If police car is responding, don't decay
      if (activeCrimesRef.current.has(key)) return;
      
      // Update time remaining by creating a new crime object
      const newTimeRemaining = crime.timeRemaining - delta * speedMultiplier;
      if (newTimeRemaining <= 0) {
        // Crime "resolved" without police (criminal escaped, situation de-escalated)
        keysToDelete.push(key);
      } else {
        // Update the crime's time remaining
        activeCrimeIncidentsRef.current.set(key, { ...crime, timeRemaining: newTimeRemaining });
      }
    });
    
    // Delete expired crimes
    keysToDelete.forEach(key => activeCrimeIncidentsRef.current.delete(key));
  }, []);
  
  // Find active crime incidents that need police response
  const findCrimeIncidents = useCallback((): { x: number; y: number }[] => {
    return Array.from(activeCrimeIncidentsRef.current.values()).map(c => ({ x: c.x, y: c.y }));
  }, []);

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
    
    // Limit police dispatches per update (increased for more action)
    let dispatched = 0;
    const maxDispatchPerCheck = Math.max(3, Math.min(6, policeStations.length * 2)); // Scale with stations
    for (const crime of crimes) {
      if (dispatched >= maxDispatchPerCheck) break;
      
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
    
    for (const vehicle of [...emergencyVehiclesRef.current]) {
      // Update flash timer for lights
      vehicle.flashTimer += delta * 8;
      
      if (vehicle.state === 'responding') {
        // Check if vehicle is still on a valid road (road might have been bulldozed)
        if (!isRoadTile(currentGrid, currentGridSize, vehicle.tileX, vehicle.tileY)) {
          const targetKey = `${vehicle.targetX},${vehicle.targetY}`;
          if (vehicle.type === 'fire_truck') {
            activeFiresRef.current.delete(targetKey);
          } else {
            activeCrimesRef.current.delete(targetKey);
            activeCrimeIncidentsRef.current.delete(targetKey); // Also clear the crime incident
          }
          continue; // Remove vehicle
        }
        
        // At the scene - spend some time responding
        vehicle.respondTime += delta * speedMultiplier;
        const respondDuration = vehicle.type === 'fire_truck' ? 8 : 5; // Fire trucks stay longer
        
        if (vehicle.respondTime >= respondDuration) {
          // Done responding - crime is resolved, calculate return path
          const targetKey = `${vehicle.targetX},${vehicle.targetY}`;
          
          // Clear the crime incident when police finish responding
          if (vehicle.type === 'police_car') {
            activeCrimeIncidentsRef.current.delete(targetKey);
          }
          
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
          } else if (returnPath && returnPath.length === 1) {
            // Already at station's road - remove vehicle
            if (vehicle.type === 'fire_truck') {
              activeFiresRef.current.delete(targetKey);
            } else {
              activeCrimesRef.current.delete(targetKey);
            }
            continue;
          } else {
            // Can't find return path - remove vehicle and clear tracking
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
          activeCrimeIncidentsRef.current.delete(targetKey); // Also clear the crime incident
        }
        continue;
      }
      
      // Bounds check - remove vehicle if out of bounds
      if (vehicle.tileX < 0 || vehicle.tileX >= currentGridSize || 
          vehicle.tileY < 0 || vehicle.tileY >= currentGridSize) {
        const targetKey = `${vehicle.targetX},${vehicle.targetY}`;
        if (vehicle.type === 'fire_truck') {
          activeFiresRef.current.delete(targetKey);
        } else {
          activeCrimesRef.current.delete(targetKey);
          activeCrimeIncidentsRef.current.delete(targetKey); // Also clear the crime incident
        }
        continue; // Remove vehicle
      }
      
      // Move vehicle along path
      vehicle.progress += vehicle.speed * delta * speedMultiplier;
      
      let shouldRemove = false;
      
      // Handle edge case: path has only 1 tile (already at destination)
      if (vehicle.path.length === 1 && vehicle.state === 'dispatching') {
        vehicle.state = 'responding';
        vehicle.respondTime = 0;
        vehicle.progress = 0;
        updatedVehicles.push(vehicle);
        continue;
      }
      
      while (vehicle.progress >= 1 && vehicle.pathIndex < vehicle.path.length - 1) {
        vehicle.pathIndex++;
        vehicle.progress -= 1;
        
        const currentTile = vehicle.path[vehicle.pathIndex];
        
        // Validate the next tile is in bounds
        if (currentTile.x < 0 || currentTile.x >= currentGridSize || 
            currentTile.y < 0 || currentTile.y >= currentGridSize) {
          shouldRemove = true;
          break;
        }
        
        vehicle.tileX = currentTile.x;
        vehicle.tileY = currentTile.y;
        
        // Check if reached destination
        if (vehicle.pathIndex >= vehicle.path.length - 1) {
          if (vehicle.state === 'dispatching') {
            // Arrived at emergency scene
            vehicle.state = 'responding';
            vehicle.respondTime = 0;
            vehicle.progress = 0; // Reset progress to keep vehicle centered on road tile
          } else if (vehicle.state === 'returning') {
            // Arrived back at station - remove vehicle
            shouldRemove = true;
          }
          break;
        }
        
        // Update direction for next segment
        if (vehicle.pathIndex + 1 < vehicle.path.length) {
          const nextTile = vehicle.path[vehicle.pathIndex + 1];
          const dir = getDirectionToTile(vehicle.tileX, vehicle.tileY, nextTile.x, nextTile.y);
          if (dir) vehicle.direction = dir;
        }
      }
      
      if (shouldRemove) {
        const targetKey = `${vehicle.targetX},${vehicle.targetY}`;
        if (vehicle.type === 'fire_truck') {
          activeFiresRef.current.delete(targetKey);
        } else {
          activeCrimesRef.current.delete(targetKey);
          activeCrimeIncidentsRef.current.delete(targetKey); // Also clear the crime incident
        }
        continue; // Don't add to updated list
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
    for (const car of [...carsRef.current]) {
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

  // Update pedestrians - only when zoomed in enough
  const updatePedestrians = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed, zoom: currentZoom } = worldStateRef.current;
    
    // Clear pedestrians if zoomed out
    if (currentZoom < PEDESTRIAN_MIN_ZOOM) {
      pedestriansRef.current = [];
      return;
    }
    
    if (!currentGrid || currentGridSize <= 0) {
      pedestriansRef.current = [];
      return;
    }
    
    // Speed multiplier
    const speedMultiplier = currentSpeed === 0 ? 0 : currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2.5 : 4;
    
    // Get cached road tile count (only recalculate when grid changes)
    const currentGridVersion = gridVersionRef.current;
    let roadTileCount: number;
    if (cachedRoadTileCountRef.current.gridVersion === currentGridVersion) {
      roadTileCount = cachedRoadTileCountRef.current.count;
    } else {
      // Recalculate and cache
      roadTileCount = 0;
      for (let y = 0; y < currentGridSize; y++) {
        for (let x = 0; x < currentGridSize; x++) {
          if (currentGrid[y][x].building.type === 'road') {
            roadTileCount++;
          }
        }
      }
      cachedRoadTileCountRef.current = { count: roadTileCount, gridVersion: currentGridVersion };
    }
    
    // Spawn many pedestrians - scale with road network size (3 pedestrians per road tile)
    const maxPedestrians = Math.max(200, roadTileCount * 3);
    pedestrianSpawnTimerRef.current -= delta;
    if (pedestriansRef.current.length < maxPedestrians && pedestrianSpawnTimerRef.current <= 0) {
      // Spawn many pedestrians at once
      let spawnedCount = 0;
      const spawnBatch = Math.min(50, Math.max(20, Math.floor(roadTileCount / 10)));
      for (let i = 0; i < spawnBatch; i++) {
        if (spawnPedestrian()) {
          spawnedCount++;
        }
      }
      pedestrianSpawnTimerRef.current = spawnedCount > 0 ? 0.02 : 0.01; // Very fast spawning
    }
    
    const updatedPedestrians: Pedestrian[] = [];
    
    for (const ped of [...pedestriansRef.current]) {
      let alive = true;
      
      // Update age
      ped.age += delta;
      if (ped.age > ped.maxAge) {
        continue;
      }
      
      // Update walk animation
      ped.walkOffset += delta * 8;
      
      // Check if still on valid road
      if (!isRoadTile(currentGrid, currentGridSize, ped.tileX, ped.tileY)) {
        continue;
      }
      
      // Move pedestrian along path
      ped.progress += ped.speed * delta * speedMultiplier;
      
      // Handle single-tile paths (already at destination)
      if (ped.path.length === 1 && ped.progress >= 1) {
        if (!ped.returningHome) {
          ped.returningHome = true;
          const returnPath = findPathOnRoads(currentGrid, currentGridSize, ped.destX, ped.destY, ped.homeX, ped.homeY);
          if (returnPath && returnPath.length > 0) {
            ped.path = returnPath;
            ped.pathIndex = 0;
            ped.progress = 0;
            ped.tileX = returnPath[0].x;
            ped.tileY = returnPath[0].y;
            if (returnPath.length > 1) {
              const nextTile = returnPath[1];
              const dir = getDirectionToTile(returnPath[0].x, returnPath[0].y, nextTile.x, nextTile.y);
              if (dir) ped.direction = dir;
            }
          } else {
            continue; // Remove pedestrian
          }
        } else {
          continue; // Arrived home, remove
        }
      }
      
      while (ped.progress >= 1 && ped.pathIndex < ped.path.length - 1) {
        ped.pathIndex++;
        ped.progress -= 1;
        
        const currentTile = ped.path[ped.pathIndex];
        
        // Bounds check
        if (currentTile.x < 0 || currentTile.x >= currentGridSize ||
            currentTile.y < 0 || currentTile.y >= currentGridSize) {
          alive = false;
          break;
        }
        
        ped.tileX = currentTile.x;
        ped.tileY = currentTile.y;
        
        // Check if reached end of path
        if (ped.pathIndex >= ped.path.length - 1) {
          if (!ped.returningHome) {
            // Arrived at destination - start returning home
            ped.returningHome = true;
            const returnPath = findPathOnRoads(currentGrid, currentGridSize, ped.destX, ped.destY, ped.homeX, ped.homeY);
            if (returnPath && returnPath.length > 0) {
              ped.path = returnPath;
              ped.pathIndex = 0;
              ped.progress = 0;
              // Update direction for return trip
              if (returnPath.length > 1) {
                const nextTile = returnPath[1];
                const dir = getDirectionToTile(returnPath[0].x, returnPath[0].y, nextTile.x, nextTile.y);
                if (dir) ped.direction = dir;
              }
            } else {
              alive = false;
            }
          } else {
            // Arrived back home - remove pedestrian
            alive = false;
          }
          break;
        }
        
        // Update direction for next segment
        if (ped.pathIndex + 1 < ped.path.length) {
          const nextTile = ped.path[ped.pathIndex + 1];
          const dir = getDirectionToTile(ped.tileX, ped.tileY, nextTile.x, nextTile.y);
          if (dir) ped.direction = dir;
        }
      }
      
      if (alive) {
        updatedPedestrians.push(ped);
      }
    }
    
    pedestriansRef.current = updatedPedestrians;
  }, [spawnPedestrian]);

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

  // Draw pedestrians with simple SVG-style sprites
  const drawPedestrians = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    
    // Don't draw pedestrians if zoomed out
    if (currentZoom < PEDESTRIAN_MIN_ZOOM) {
      return;
    }
    
    // Early exit if no pedestrians
    if (!currentGrid || currentGridSize <= 0 || pedestriansRef.current.length === 0) {
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
    
    // Helper function to check if pedestrian is behind a building
    const isPedBehindBuilding = (pedTileX: number, pedTileY: number): boolean => {
      const pedDepth = pedTileX + pedTileY;
      
      for (let dy = 0; dy <= 1; dy++) {
        for (let dx = 0; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          
          const checkX = pedTileX + dx;
          const checkY = pedTileY + dy;
          
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
          if (buildingDepth > pedDepth) {
            return true;
          }
        }
      }
      
      return false;
    };
    
    pedestriansRef.current.forEach(ped => {
      const { screenX, screenY } = gridToScreen(ped.tileX, ped.tileY, 0, 0);
      const centerX = screenX + TILE_WIDTH / 2;
      const centerY = screenY + TILE_HEIGHT / 2;
      const meta = DIRECTION_META[ped.direction];
      
      // Pedestrians walk on sidewalks - offset them toward the edge of the road
      const sidewalkOffset = ped.sidewalkSide === 'left' ? -12 : 12;
      const pedX = centerX + meta.vec.dx * ped.progress + meta.normal.nx * sidewalkOffset;
      const pedY = centerY + meta.vec.dy * ped.progress + meta.normal.ny * sidewalkOffset;
      
      // Viewport culling
      if (pedX < viewLeft - 20 || pedX > viewRight + 20 || pedY < viewTop - 40 || pedY > viewBottom + 40) {
        return;
      }
      
      // Check if pedestrian is behind a building
      if (isPedBehindBuilding(ped.tileX, ped.tileY)) {
        return;
      }
      
      ctx.save();
      ctx.translate(pedX, pedY);
      
      // Walking animation - bob up and down and sway
      const walkBob = Math.sin(ped.walkOffset) * 0.8;
      const walkSway = Math.sin(ped.walkOffset * 0.5) * 0.5;
      
      // Scale for pedestrian (smaller, more realistic)
      const scale = 0.35;
      
      // Draw simple stick figure pedestrian (SVG-style)
      // Head
      ctx.fillStyle = ped.skinColor;
      ctx.beginPath();
      ctx.arc(walkSway * scale, (-12 + walkBob) * scale, 3 * scale, 0, Math.PI * 2);
      ctx.fill();
      
      // Body (shirt)
      ctx.fillStyle = ped.shirtColor;
      ctx.beginPath();
      ctx.ellipse(walkSway * scale, (-5 + walkBob) * scale, 2.5 * scale, 4 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Legs (animated)
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 1.5 * scale;
      ctx.lineCap = 'round';
      
      // Left leg
      const leftLegSwing = Math.sin(ped.walkOffset) * 3;
      ctx.beginPath();
      ctx.moveTo(walkSway * scale, (-1 + walkBob) * scale);
      ctx.lineTo((walkSway - 1 + leftLegSwing) * scale, (5 + walkBob) * scale);
      ctx.stroke();
      
      // Right leg
      const rightLegSwing = Math.sin(ped.walkOffset + Math.PI) * 3;
      ctx.beginPath();
      ctx.moveTo(walkSway * scale, (-1 + walkBob) * scale);
      ctx.lineTo((walkSway + 1 + rightLegSwing) * scale, (5 + walkBob) * scale);
      ctx.stroke();
      
      // Arms (animated)
      ctx.strokeStyle = ped.skinColor;
      ctx.lineWidth = 1.2 * scale;
      
      // Left arm
      const leftArmSwing = Math.sin(ped.walkOffset + Math.PI) * 2;
      ctx.beginPath();
      ctx.moveTo((walkSway - 2) * scale, (-6 + walkBob) * scale);
      ctx.lineTo((walkSway - 3 + leftArmSwing) * scale, (-2 + walkBob) * scale);
      ctx.stroke();
      
      // Right arm
      const rightArmSwing = Math.sin(ped.walkOffset) * 2;
      ctx.beginPath();
      ctx.moveTo((walkSway + 2) * scale, (-6 + walkBob) * scale);
      ctx.lineTo((walkSway + 3 + rightArmSwing) * scale, (-2 + walkBob) * scale);
      ctx.stroke();
      
      ctx.restore();
    });
    
    ctx.restore();
  }, []);

  // Find all airports in the city
  const findAirports = useCallback((): { x: number; y: number }[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return [];
    
    const airports: { x: number; y: number }[] = [];
    for (let y = 0; y < currentGridSize; y++) {
      for (let x = 0; x < currentGridSize; x++) {
        if (currentGrid[y][x].building.type === 'airport') {
          airports.push({ x, y });
        }
      }
    }
    return airports;
  }, []);

  // Find all marinas and piers in the city (boat spawn/destination points)
  const findMarinasAndPiers = useCallback((): { x: number; y: number; type: 'marina' | 'pier' }[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return [];
    
    const docks: { x: number; y: number; type: 'marina' | 'pier' }[] = [];
    for (let y = 0; y < currentGridSize; y++) {
      for (let x = 0; x < currentGridSize; x++) {
        const buildingType = currentGrid[y][x].building.type;
        if (buildingType === 'marina_docks_small') {
          docks.push({ x, y, type: 'marina' });
        } else if (buildingType === 'pier_large') {
          docks.push({ x, y, type: 'pier' });
        }
      }
    }
    return docks;
  }, []);

  // Find water tile adjacent to a marina/pier for boat positioning
  const findAdjacentWaterTile = useCallback((dockX: number, dockY: number): { x: number; y: number } | null => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return null;
    
    // Check adjacent tiles for water
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [dx, dy] of directions) {
      const nx = dockX + dx;
      const ny = dockY + dy;
      if (nx >= 0 && nx < currentGridSize && ny >= 0 && ny < currentGridSize) {
        if (currentGrid[ny][nx].building.type === 'water') {
          return { x: nx, y: ny };
        }
      }
    }
    return null;
  }, []);

  // Check if a screen position is over water (for boat pathfinding)
  // Uses inverse of gridToScreen: screenX = (x - y) * TILE_WIDTH/2, screenY = (x + y) * TILE_HEIGHT/2
  // Solving: x = screenX/TILE_WIDTH + screenY/TILE_HEIGHT, y = screenY/TILE_HEIGHT - screenX/TILE_WIDTH
  const screenToTile = useCallback((screenX: number, screenY: number): { tileX: number; tileY: number } => {
    const tileX = Math.floor(screenX / TILE_WIDTH + screenY / TILE_HEIGHT);
    const tileY = Math.floor(screenY / TILE_HEIGHT - screenX / TILE_WIDTH);
    return { tileX, tileY };
  }, []);

  const isOverWater = useCallback((screenX: number, screenY: number): boolean => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return false;
    
    const { tileX, tileY } = screenToTile(screenX, screenY);
    
    if (tileX < 0 || tileX >= currentGridSize || tileY < 0 || tileY >= currentGridSize) {
      return false;
    }
    
    return currentGrid[tileY][tileX].building.type === 'water';
  }, [screenToTile]);

  // Update airplanes - spawn, move, and manage lifecycle
  const updateAirplanes = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;
    
    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
      return;
    }

    // Find airports and check population
    const airports = findAirports();
    
    // Get cached population count (only recalculate when grid changes)
    const currentGridVersion = gridVersionRef.current;
    let totalPopulation: number;
    if (cachedPopulationRef.current.gridVersion === currentGridVersion) {
      totalPopulation = cachedPopulationRef.current.count;
    } else {
      // Recalculate and cache
      totalPopulation = 0;
      for (let y = 0; y < currentGridSize; y++) {
        for (let x = 0; x < currentGridSize; x++) {
          totalPopulation += currentGrid[y][x].building.population || 0;
        }
      }
      cachedPopulationRef.current = { count: totalPopulation, gridVersion: currentGridVersion };
    }

    // No airplanes if no airport or insufficient population
    if (airports.length === 0 || totalPopulation < AIRPLANE_MIN_POPULATION) {
      airplanesRef.current = [];
      return;
    }

    // Calculate max airplanes based on population (1 per 3.5k population, min 18, max 54)
    const maxAirplanes = Math.min(54, Math.max(18, Math.floor(totalPopulation / 3500) * 3));
    
    // Speed multiplier based on game speed
    const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 1.5 : 2;

    // Spawn timer
    airplaneSpawnTimerRef.current -= delta;
    if (airplanesRef.current.length < maxAirplanes && airplaneSpawnTimerRef.current <= 0) {
      // Pick a random airport
      const airport = airports[Math.floor(Math.random() * airports.length)];
      
      // Convert airport tile to screen coordinates
      const { screenX: airportScreenX, screenY: airportScreenY } = gridToScreen(airport.x, airport.y, 0, 0);
      const airportCenterX = airportScreenX + TILE_WIDTH * 2; // Center of 4x4 airport
      const airportCenterY = airportScreenY + TILE_HEIGHT * 2;
      
      // Decide if taking off or arriving from distance
      const isTakingOff = Math.random() < 0.5;
      
      if (isTakingOff) {
        // Taking off from airport
        const angle = Math.random() * Math.PI * 2; // Random direction
        airplanesRef.current.push({
          id: airplaneIdRef.current++,
          x: airportCenterX,
          y: airportCenterY,
          angle: angle,
          state: 'taking_off',
          speed: 30 + Math.random() * 20, // Slow during takeoff
          altitude: 0,
          targetAltitude: 1,
          airportX: airport.x,
          airportY: airport.y,
          stateProgress: 0,
          contrail: [],
          lifeTime: 30 + Math.random() * 20, // 30-50 seconds of flight
          color: AIRPLANE_COLORS[Math.floor(Math.random() * AIRPLANE_COLORS.length)],
        });
      } else {
        // Arriving from the edge of the map
        const edge = Math.floor(Math.random() * 4);
        let startX: number, startY: number, angle: number;
        
        // Calculate map bounds in screen space
        const mapCenterX = 0;
        const mapCenterY = currentGridSize * TILE_HEIGHT / 2;
        const mapExtent = currentGridSize * TILE_WIDTH;
        
        switch (edge) {
          case 0: // From top
            startX = mapCenterX + (Math.random() - 0.5) * mapExtent;
            startY = mapCenterY - mapExtent / 2 - 200;
            angle = Math.PI / 2 + (Math.random() - 0.5) * 0.5; // Roughly downward
            break;
          case 1: // From right
            startX = mapCenterX + mapExtent / 2 + 200;
            startY = mapCenterY + (Math.random() - 0.5) * mapExtent / 2;
            angle = Math.PI + (Math.random() - 0.5) * 0.5; // Roughly leftward
            break;
          case 2: // From bottom
            startX = mapCenterX + (Math.random() - 0.5) * mapExtent;
            startY = mapCenterY + mapExtent / 2 + 200;
            angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.5; // Roughly upward
            break;
          default: // From left
            startX = mapCenterX - mapExtent / 2 - 200;
            startY = mapCenterY + (Math.random() - 0.5) * mapExtent / 2;
            angle = 0 + (Math.random() - 0.5) * 0.5; // Roughly rightward
            break;
        }
        
        // Calculate angle to airport
        const angleToAirport = Math.atan2(airportCenterY - startY, airportCenterX - startX);
        
        airplanesRef.current.push({
          id: airplaneIdRef.current++,
          x: startX,
          y: startY,
          angle: angleToAirport,
          state: 'flying',
          speed: 80 + Math.random() * 40, // Faster when cruising
          altitude: 1,
          targetAltitude: 1,
          airportX: airport.x,
          airportY: airport.y,
          stateProgress: 0,
          contrail: [],
          lifeTime: 30 + Math.random() * 20,
          color: AIRPLANE_COLORS[Math.floor(Math.random() * AIRPLANE_COLORS.length)],
        });
      }
      
      airplaneSpawnTimerRef.current = 5 + Math.random() * 10; // 5-15 seconds between spawns
    }

    // Update existing airplanes
    const updatedAirplanes: Airplane[] = [];
    
    for (const plane of airplanesRef.current) {
      // Update contrail particles
      plane.contrail = plane.contrail
        .map(p => ({ ...p, age: p.age + delta, opacity: Math.max(0, 1 - p.age / CONTRAIL_MAX_AGE) }))
        .filter(p => p.age < CONTRAIL_MAX_AGE);
      
      // Add new contrail particles at high altitude
      if (plane.altitude > 0.7) {
        plane.stateProgress += delta;
        if (plane.stateProgress >= CONTRAIL_SPAWN_INTERVAL) {
          plane.stateProgress -= CONTRAIL_SPAWN_INTERVAL;
          // Add two contrail particles (left and right engine)
          const perpAngle = plane.angle + Math.PI / 2;
          const engineOffset = 4 * (0.5 + plane.altitude * 0.5);
          plane.contrail.push(
            { x: plane.x + Math.cos(perpAngle) * engineOffset, y: plane.y + Math.sin(perpAngle) * engineOffset, age: 0, opacity: 1 },
            { x: plane.x - Math.cos(perpAngle) * engineOffset, y: plane.y - Math.sin(perpAngle) * engineOffset, age: 0, opacity: 1 }
          );
        }
      }
      
      // Update based on state
      switch (plane.state) {
        case 'taking_off': {
          // Move forward and climb
          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.altitude = Math.min(1, plane.altitude + delta * 0.3); // Climb rate
          plane.speed = Math.min(120, plane.speed + delta * 20); // Accelerate
          
          if (plane.altitude >= 1) {
            plane.state = 'flying';
          }
          break;
        }
        
        case 'flying': {
          // Move forward at cruising speed
          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;
          
          plane.lifeTime -= delta;
          
          // Check if near airport and should land
          const { screenX: airportScreenX, screenY: airportScreenY } = gridToScreen(plane.airportX, plane.airportY, 0, 0);
          const airportCenterX = airportScreenX + TILE_WIDTH * 2;
          const airportCenterY = airportScreenY + TILE_HEIGHT * 2;
          const distToAirport = Math.hypot(plane.x - airportCenterX, plane.y - airportCenterY);
          
          // Start landing approach when close enough and lifetime is low
          if (distToAirport < 400 && plane.lifeTime < 10) {
            plane.state = 'landing';
            plane.targetAltitude = 0;
            // Adjust angle to point at airport
            plane.angle = Math.atan2(airportCenterY - plane.y, airportCenterX - plane.x);
          } else if (plane.lifeTime <= 0) {
            // Despawn if too far from airport and out of time
            continue;
          }
          break;
        }
        
        case 'landing': {
          // Descend and slow down while approaching airport
          const { screenX: airportScreenX, screenY: airportScreenY } = gridToScreen(plane.airportX, plane.airportY, 0, 0);
          const airportCenterX = airportScreenX + TILE_WIDTH * 2;
          const airportCenterY = airportScreenY + TILE_HEIGHT * 2;
          
          // Adjust angle to point at airport
          const angleToAirport = Math.atan2(airportCenterY - plane.y, airportCenterX - plane.x);
          plane.angle = angleToAirport;
          
          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.altitude = Math.max(0, plane.altitude - delta * 0.25); // Descend
          plane.speed = Math.max(30, plane.speed - delta * 15); // Decelerate
          
          const distToAirport = Math.hypot(plane.x - airportCenterX, plane.y - airportCenterY);
          if (distToAirport < 50 || plane.altitude <= 0) {
            // Landed - remove plane
            continue;
          }
          break;
        }
        
        case 'taxiing':
          // Not implemented - planes just land and disappear
          continue;
      }
      
      updatedAirplanes.push(plane);
    }
    
    airplanesRef.current = updatedAirplanes;
  }, [findAirports]);

  // Draw airplanes with contrails
  const drawAirplanes = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    
    // Early exit if no airplanes
    if (!currentGrid || currentGridSize <= 0 || airplanesRef.current.length === 0) {
      return;
    }
    
    ctx.save();
    ctx.scale(dpr * currentZoom, dpr * currentZoom);
    ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);
    
    const viewWidth = canvas.width / (dpr * currentZoom);
    const viewHeight = canvas.height / (dpr * currentZoom);
    const viewLeft = -currentOffset.x / currentZoom - 200;
    const viewTop = -currentOffset.y / currentZoom - 200;
    const viewRight = viewWidth - currentOffset.x / currentZoom + 200;
    const viewBottom = viewHeight - currentOffset.y / currentZoom + 200;
    
    for (const plane of airplanesRef.current) {
      // Draw contrails first (behind plane)
      if (plane.contrail.length > 0) {
        ctx.save();
        for (const particle of plane.contrail) {
          // Skip if outside viewport
          if (particle.x < viewLeft || particle.x > viewRight || particle.y < viewTop || particle.y > viewBottom) {
            continue;
          }
          
          const size = 3 + particle.age * 8; // Contrails expand over time
          const opacity = particle.opacity * 0.4 * plane.altitude; // Fade with altitude
          
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      
      // Skip plane rendering if outside viewport
      if (plane.x < viewLeft - 50 || plane.x > viewRight + 50 || plane.y < viewTop - 50 || plane.y > viewBottom + 50) {
        continue;
      }
      
      // Draw shadow (when low altitude)
      if (plane.altitude < 0.8) {
        const shadowOffset = (1 - plane.altitude) * 15;
        const shadowScale = 0.6 + plane.altitude * 0.4;
        const shadowOpacity = 0.3 * (1 - plane.altitude);
        
        ctx.save();
        ctx.translate(plane.x + shadowOffset, plane.y + shadowOffset * 0.5);
        ctx.rotate(plane.angle);
        ctx.scale(shadowScale, shadowScale * 0.5);
        ctx.fillStyle = `rgba(0, 0, 0, ${shadowOpacity})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      
      // Draw airplane
      ctx.save();
      ctx.translate(plane.x, plane.y);
      ctx.rotate(plane.angle);
      
      // Scale based on altitude (appears larger when higher/closer)
      const altitudeScale = 0.7 + plane.altitude * 0.5;
      ctx.scale(altitudeScale, altitudeScale);
      
      // Fuselage - cylindrical body (rounded rectangle shape)
      ctx.fillStyle = plane.color;
      ctx.beginPath();
      // Draw a more cylindrical fuselage using a rounded rect approach
      const fuselageLength = 18;
      const fuselageWidth = 2.5; // Thinner for more cylindrical look
      ctx.moveTo(-fuselageLength, -fuselageWidth);
      ctx.lineTo(fuselageLength - 2, -fuselageWidth);
      ctx.quadraticCurveTo(fuselageLength, -fuselageWidth * 0.5, fuselageLength, 0);
      ctx.quadraticCurveTo(fuselageLength, fuselageWidth * 0.5, fuselageLength - 2, fuselageWidth);
      ctx.lineTo(-fuselageLength, fuselageWidth);
      ctx.quadraticCurveTo(-fuselageLength - 2, fuselageWidth, -fuselageLength - 2, 0);
      ctx.quadraticCurveTo(-fuselageLength - 2, -fuselageWidth, -fuselageLength, -fuselageWidth);
      ctx.closePath();
      ctx.fill();
      
      // Wings - connected to fuselage body
      ctx.fillStyle = plane.color;
      ctx.beginPath();
      ctx.moveTo(0, -fuselageWidth);
      ctx.lineTo(-8, -18);
      ctx.lineTo(-12, -18);
      ctx.lineTo(-4, -fuselageWidth);
      ctx.closePath();
      ctx.fill();
      
      ctx.beginPath();
      ctx.moveTo(0, fuselageWidth);
      ctx.lineTo(-8, 18);
      ctx.lineTo(-12, 18);
      ctx.lineTo(-4, fuselageWidth);
      ctx.closePath();
      ctx.fill();
      
      // Tail fin
      ctx.fillStyle = plane.color;
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(-18, -8);
      ctx.lineTo(-20, -8);
      ctx.lineTo(-18, 0);
      ctx.closePath();
      ctx.fill();
      
      // Horizontal stabilizers
      ctx.beginPath();
      ctx.moveTo(-16, -2);
      ctx.lineTo(-18, -6);
      ctx.lineTo(-20, -6);
      ctx.lineTo(-18, -2);
      ctx.closePath();
      ctx.fill();
      
      ctx.beginPath();
      ctx.moveTo(-16, 2);
      ctx.lineTo(-18, 6);
      ctx.lineTo(-20, 6);
      ctx.lineTo(-18, 2);
      ctx.closePath();
      ctx.fill();
      
      // Engine nacelles
      ctx.fillStyle = '#475569'; // Dark gray
      ctx.beginPath();
      ctx.ellipse(-2, -8, 4, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-2, 8, 4, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    }
    
    ctx.restore();
  }, []);

  // Update boats - spawn, move, and manage lifecycle
  const updateBoats = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed, zoom: currentZoom } = worldStateRef.current;
    
    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
      return;
    }

    // Clear boats if zoomed out too far
    if (currentZoom < BOAT_MIN_ZOOM) {
      boatsRef.current = [];
      return;
    }

    // Find marinas and piers
    const docks = findMarinasAndPiers();
    
    // No boats if no docks
    if (docks.length === 0) {
      boatsRef.current = [];
      return;
    }

    // Calculate max boats based on number of docks (5 boats per dock, max 50)
    const maxBoats = Math.min(50, docks.length * 5);
    
    // Speed multiplier based on game speed
    const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 1.5 : 2;

    // Spawn timer
    boatSpawnTimerRef.current -= delta;
    if (boatsRef.current.length < maxBoats && boatSpawnTimerRef.current <= 0) {
      // Pick a random dock as origin
      const originDock = docks[Math.floor(Math.random() * docks.length)];
      
      // Find adjacent water tile for positioning
      const waterTile = findAdjacentWaterTile(originDock.x, originDock.y);
      if (waterTile) {
        // Pick a destination dock (different from origin, or same if only one dock)
        let destDock = originDock;
        if (docks.length > 1) {
          const otherDocks = docks.filter(d => d.x !== originDock.x || d.y !== originDock.y);
          destDock = otherDocks[Math.floor(Math.random() * otherDocks.length)];
        }
        
        // Find water tile near destination
        const destWaterTile = findAdjacentWaterTile(destDock.x, destDock.y);
        if (destWaterTile) {
          // Convert to screen coordinates
          const { screenX: originScreenX, screenY: originScreenY } = gridToScreen(waterTile.x, waterTile.y, 0, 0);
          const { screenX: destScreenX, screenY: destScreenY } = gridToScreen(destWaterTile.x, destWaterTile.y, 0, 0);
          
          // Calculate angle to destination
          const angle = Math.atan2(destScreenY - originScreenY, destScreenX - originScreenX);
          
          boatsRef.current.push({
            id: boatIdRef.current++,
            x: originScreenX + TILE_WIDTH / 2,
            y: originScreenY + TILE_HEIGHT / 2,
            angle: angle,
            targetAngle: angle,
            state: 'departing',
            speed: 15 + Math.random() * 10, // Boats are slower than cars
            originX: originDock.x,
            originY: originDock.y,
            destX: destDock.x,
            destY: destDock.y,
            destScreenX: destScreenX + TILE_WIDTH / 2,
            destScreenY: destScreenY + TILE_HEIGHT / 2,
            age: 0,
            color: BOAT_COLORS[Math.floor(Math.random() * BOAT_COLORS.length)],
            wake: [],
            wakeSpawnProgress: 0,
            sizeVariant: Math.random() < 0.7 ? 0 : 1, // 70% small boats, 30% medium
          });
        }
      }
      
      boatSpawnTimerRef.current = 1 + Math.random() * 2; // 1-3 seconds between spawns
    }

    // Update existing boats
    const updatedBoats: Boat[] = [];
    
    for (const boat of boatsRef.current) {
      boat.age += delta;
      
      // Update wake particles (similar to contrails)
      boat.wake = boat.wake
        .map(p => ({ ...p, age: p.age + delta, opacity: Math.max(0, 1 - p.age / WAKE_MAX_AGE) }))
        .filter(p => p.age < WAKE_MAX_AGE);
      
      // Distance to destination
      const distToDest = Math.hypot(boat.x - boat.destScreenX, boat.y - boat.destScreenY);
      
      // Calculate next position
      let nextX = boat.x;
      let nextY = boat.y;
      
      switch (boat.state) {
        case 'departing': {
          // Move away from dock, then switch to sailing
          nextX = boat.x + Math.cos(boat.angle) * boat.speed * delta * speedMultiplier;
          nextY = boat.y + Math.sin(boat.angle) * boat.speed * delta * speedMultiplier;
          
          if (boat.age > 2) {
            boat.state = 'sailing';
          }
          break;
        }
        
        case 'sailing': {
          // Navigate toward destination with gentle course corrections
          const angleToDestination = Math.atan2(boat.destScreenY - boat.y, boat.destScreenX - boat.x);
          boat.targetAngle = angleToDestination;
          
          // Smooth turning
          let angleDiff = boat.targetAngle - boat.angle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          boat.angle += angleDiff * Math.min(1, delta * 2);
          
          // Calculate next position
          nextX = boat.x + Math.cos(boat.angle) * boat.speed * delta * speedMultiplier;
          nextY = boat.y + Math.sin(boat.angle) * boat.speed * delta * speedMultiplier;
          
          // Check if approaching destination
          if (distToDest < 60) {
            boat.state = 'arriving';
          }
          
          // Safety: remove boats that have been sailing too long (stuck)
          if (boat.age > 60) {
            continue;
          }
          break;
        }
        
        case 'arriving': {
          // Slow down and dock
          boat.speed = Math.max(5, boat.speed - delta * 8);
          
          const angleToDestination = Math.atan2(boat.destScreenY - boat.y, boat.destScreenX - boat.x);
          boat.targetAngle = angleToDestination;
          
          // Smooth turning
          let angleDiff = boat.targetAngle - boat.angle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          boat.angle += angleDiff * Math.min(1, delta * 3);
          
          nextX = boat.x + Math.cos(boat.angle) * boat.speed * delta * speedMultiplier;
          nextY = boat.y + Math.sin(boat.angle) * boat.speed * delta * speedMultiplier;
          
          // Check if docked
          if (distToDest < 15) {
            boat.state = 'docked';
            // Set up return trip - swap origin and destination
            const tempX = boat.originX;
            const tempY = boat.originY;
            boat.originX = boat.destX;
            boat.originY = boat.destY;
            boat.destX = tempX;
            boat.destY = tempY;
            
            // Update screen destination
            const destWaterTile = findAdjacentWaterTile(boat.destX, boat.destY);
            if (destWaterTile) {
              const { screenX, screenY } = gridToScreen(destWaterTile.x, destWaterTile.y, 0, 0);
              boat.destScreenX = screenX + TILE_WIDTH / 2;
              boat.destScreenY = screenY + TILE_HEIGHT / 2;
            }
            
            boat.age = 0; // Reset age for return trip timer
            boat.wake = []; // Clear wake when docked
          }
          break;
        }
        
        case 'docked': {
          // Wait at dock, then depart
          if (boat.age > 3 + Math.random() * 3) {
            boat.state = 'departing';
            boat.speed = 15 + Math.random() * 10;
            boat.age = 0;
            
            // Calculate angle to new destination
            const angle = Math.atan2(boat.destScreenY - boat.y, boat.destScreenX - boat.x);
            boat.angle = angle;
            boat.targetAngle = angle;
          }
          break;
        }
      }
      
      // Check if next position is over water (skip for docked boats)
      if (boat.state !== 'docked') {
        if (!isOverWater(nextX, nextY)) {
          // Next position would be on land - remove the boat
          continue;
        }
        
        // Update position
        boat.x = nextX;
        boat.y = nextY;
        
        // Add wake particles when moving
        boat.wakeSpawnProgress += delta;
        if (boat.wakeSpawnProgress >= WAKE_SPAWN_INTERVAL) {
          boat.wakeSpawnProgress -= WAKE_SPAWN_INTERVAL;
          
          // Add wake particles behind the boat (two trails like plane contrails)
          const perpAngle = boat.angle + Math.PI / 2;
          const wakeOffset = 3;
          const behindBoat = -6; // Position behind the boat
          
          boat.wake.push(
            { 
              x: boat.x + Math.cos(boat.angle) * behindBoat + Math.cos(perpAngle) * wakeOffset, 
              y: boat.y + Math.sin(boat.angle) * behindBoat + Math.sin(perpAngle) * wakeOffset, 
              age: 0, 
              opacity: 1 
            },
            { 
              x: boat.x + Math.cos(boat.angle) * behindBoat - Math.cos(perpAngle) * wakeOffset, 
              y: boat.y + Math.sin(boat.angle) * behindBoat - Math.sin(perpAngle) * wakeOffset, 
              age: 0, 
              opacity: 1 
            }
          );
        }
      }
      
      updatedBoats.push(boat);
    }
    
    boatsRef.current = updatedBoats;
  }, [findMarinasAndPiers, findAdjacentWaterTile, isOverWater]);

  // Draw boats with wakes
  const drawBoats = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    
    // Don't draw boats if zoomed out
    if (currentZoom < BOAT_MIN_ZOOM) {
      return;
    }
    
    // Early exit if no boats
    if (!currentGrid || currentGridSize <= 0 || boatsRef.current.length === 0) {
      return;
    }
    
    ctx.save();
    ctx.scale(dpr * currentZoom, dpr * currentZoom);
    ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);
    
    const viewWidth = canvas.width / (dpr * currentZoom);
    const viewHeight = canvas.height / (dpr * currentZoom);
    const viewLeft = -currentOffset.x / currentZoom - 100;
    const viewTop = -currentOffset.y / currentZoom - 100;
    const viewRight = viewWidth - currentOffset.x / currentZoom + 100;
    const viewBottom = viewHeight - currentOffset.y / currentZoom + 100;
    
    for (const boat of boatsRef.current) {
      // Draw wake particles first (behind boat) - similar to plane contrails
      if (boat.wake.length > 0) {
        for (const particle of boat.wake) {
          // Skip if outside viewport
          if (particle.x < viewLeft || particle.x > viewRight || particle.y < viewTop || particle.y > viewBottom) {
            continue;
          }
          
          // Wake particles expand and fade over time
          const size = 2 + particle.age * 4;
          const opacity = particle.opacity * 0.5;
          
          ctx.fillStyle = `rgba(200, 220, 255, ${opacity})`;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      
      // Skip boat rendering if outside viewport
      if (boat.x < viewLeft || boat.x > viewRight || boat.y < viewTop || boat.y > viewBottom) {
        continue;
      }
      
      ctx.save();
      ctx.translate(boat.x, boat.y);
      ctx.rotate(boat.angle);
      
      const scale = boat.sizeVariant === 0 ? 0.8 : 1.0;
      ctx.scale(scale, scale);
      
      // Draw small foam/splash at stern when moving
      if (boat.state !== 'docked') {
        const foamOpacity = Math.min(0.5, boat.speed / 30);
        ctx.fillStyle = `rgba(255, 255, 255, ${foamOpacity})`;
        ctx.beginPath();
        ctx.ellipse(-7, 0, 3, 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Draw boat hull (simple sailboat/motorboat shape)
      ctx.fillStyle = boat.color;
      ctx.beginPath();
      // Hull - pointed bow, flat stern
      ctx.moveTo(10, 0); // Bow
      ctx.quadraticCurveTo(8, -4, 0, -4); // Starboard side
      ctx.lineTo(-8, -3); // Stern starboard
      ctx.lineTo(-8, 3); // Stern port
      ctx.lineTo(0, 4); // Port side
      ctx.quadraticCurveTo(8, 4, 10, 0); // Back to bow
      ctx.closePath();
      ctx.fill();
      
      // Hull outline
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      
      // Deck (lighter color)
      const hullHSL = boat.color === '#ffffff' ? 'hsl(0, 0%, 95%)' : 
                      boat.color === '#1e3a5f' ? 'hsl(210, 52%, 35%)' :
                      boat.color === '#8b4513' ? 'hsl(30, 75%, 40%)' :
                      boat.color === '#2f4f4f' ? 'hsl(180, 25%, 35%)' :
                      boat.color === '#c41e3a' ? 'hsl(350, 75%, 50%)' :
                      'hsl(210, 80%, 50%)';
      ctx.fillStyle = hullHSL;
      ctx.beginPath();
      ctx.ellipse(0, 0, 5, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Cabin/cockpit
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(-3, -1.5, 4, 3);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 0.3;
      ctx.strokeRect(-3, -1.5, 4, 3);
      
      // Mast or antenna
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(2, 0);
      ctx.lineTo(2, -8);
      ctx.stroke();
      
      // Flag or light at top
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.moveTo(2, -8);
      ctx.lineTo(5, -7);
      ctx.lineTo(2, -6);
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();
    }
    
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
    setTimeout(() => setImagesLoaded(false), 0);
    const imagesToLoad: Promise<HTMLImageElement>[] = [
      loadSpriteImage(currentSpritePack.src, true),
      loadImage('/assets/water.png') // Preload water.png
    ];
    
    // Also load construction sprite sheet if available
    if (currentSpritePack.constructionSrc) {
      imagesToLoad.push(loadSpriteImage(currentSpritePack.constructionSrc, true));
    }
    
    // Also load abandoned sprite sheet if available
    if (currentSpritePack.abandonedSrc) {
      imagesToLoad.push(loadSpriteImage(currentSpritePack.abandonedSrc, true));
    }
    
    // Also load dense variants sprite sheet if available
    if (currentSpritePack.denseSrc) {
      imagesToLoad.push(loadSpriteImage(currentSpritePack.denseSrc, true));
    }
    
    // Also load parks sprite sheet if available
    if (currentSpritePack.parksSrc) {
      imagesToLoad.push(loadSpriteImage(currentSpritePack.parksSrc, true));
    }
    
    // Also load parks construction sprite sheet if available
    if (currentSpritePack.parksConstructionSrc) {
      imagesToLoad.push(loadSpriteImage(currentSpritePack.parksConstructionSrc, true));
    }

    Promise.all(imagesToLoad)
      .then(() => setImagesLoaded(true))
      .catch(console.error);
  }, [currentSpritePack]);
  
  // Helper function to check if a tile is part of a multi-tile building footprint
  const isPartOfMultiTileBuilding = useCallback((gridX: number, gridY: number): boolean => {
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
  }, [grid, gridSize]);
  
  // Helper function to find the origin of a multi-tile building that contains a given tile
  // Returns the origin coordinates and building type, or null if not part of a multi-tile building
  const findBuildingOrigin = useCallback((gridX: number, gridY: number): { originX: number; originY: number; buildingType: BuildingType } | null => {
    const maxSize = 4; // Maximum building size
    
    // First check if this tile itself has a multi-tile building
    const tile = grid[gridY]?.[gridX];
    if (!tile) return null;
    
    // If this tile has a real building (not empty), check if it's multi-tile
    if (tile.building.type !== 'empty' && 
        tile.building.type !== 'grass' && 
        tile.building.type !== 'water' && 
        tile.building.type !== 'road' && 
        tile.building.type !== 'tree') {
      const size = getBuildingSize(tile.building.type);
      if (size.width > 1 || size.height > 1) {
        return { originX: gridX, originY: gridY, buildingType: tile.building.type };
      }
      return null; // Single-tile building
    }
    
    // If this is an 'empty' tile, search for the origin building
    if (tile.building.type === 'empty') {
      for (let dy = 0; dy < maxSize; dy++) {
        for (let dx = 0; dx < maxSize; dx++) {
          const originX = gridX - dx;
          const originY = gridY - dy;
          
          if (originX >= 0 && originX < gridSize && originY >= 0 && originY < gridSize) {
            const originTile = grid[originY][originX];
            
            if (originTile.building.type !== 'empty' && 
                originTile.building.type !== 'grass' &&
                originTile.building.type !== 'water' &&
                originTile.building.type !== 'road' &&
                originTile.building.type !== 'tree') {
              const size = getBuildingSize(originTile.building.type);
              
              // Check if the clicked tile is within this building's footprint
              if (size.width > 1 || size.height > 1) {
                if (gridX >= originX && gridX < originX + size.width &&
                    gridY >= originY && gridY < originY + size.height) {
                  return { originX, originY, buildingType: originTile.building.type };
                }
              }
            }
          }
        }
      }
    }
    
    return null;
  }, [grid, gridSize]);
  
// Helper function to check if a tile is part of a park building footprint
  // Note: buildings with grey bases (baseball_stadium, swimming_pool, community_center, office_building_small) are NOT included
  const isPartOfParkBuilding = useCallback((gridX: number, gridY: number): boolean => {
    const maxSize = 4; // Maximum building size
    const parkBuildings: BuildingType[] = ['park_large', 'baseball_field_small', 'football_field',
      'mini_golf_course', 'go_kart_track', 'amphitheater', 'greenhouse_garden',
      'marina_docks_small', 'roller_coaster_small', 'mountain_lodge', 'playground_large', 'mountain_trailhead'];

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
  }, [grid, gridSize]);
  
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
        if (lightingCanvasRef.current) {
          lightingCanvasRef.current.style.width = `${rect.width}px`;
          lightingCanvasRef.current.style.height = `${rect.height}px`;
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
    const roadQueue: BuildingDraw[] = []; // Roads drawn above water
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
    
    // Helper function to check if a tile is water
    function isWater(gridX: number, gridY: number): boolean {
      if (gridX < 0 || gridX >= gridSize || gridY < 0 || gridY >= gridSize) return false;
      return grid[gridY][gridX].building.type === 'water';
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
      ctx.lineWidth = 0.8;  // Thinner lines
      ctx.setLineDash([1.5, 2]);  // Smaller, more frequent dots
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
    
    // Draw isometric tile base with elevation support
    function drawIsometricTile(ctx: CanvasRenderingContext2D, x: number, y: number, tile: Tile, highlight: boolean, currentZoom: number, skipGreyBase: boolean = false, skipGreenBase: boolean = false) {
      const w = TILE_WIDTH;
      const h = TILE_HEIGHT;
      
      // Get elevation (default to 0 for backwards compatibility)
      const elevation = tile.elevation ?? 0;
      
      // Calculate height offset based on elevation
      // Max elevation of 1 creates a height of about 1.5 tile heights
      const maxHeightPixels = h * 1.5;
      const elevationHeight = elevation * maxHeightPixels;
      
      // Determine tile colors (top face and shading)
      let topColor = '#4a7c3f'; // grass
      let leftColor = '#3d6634';
      let rightColor = '#5a8f4f';
      let strokeColor = '#2d4a26';
      
      // For elevated tiles, blend towards grey (mountain peaks)
      // Higher elevation = more grey
      if (elevation > 0 && tile.building.type !== 'water' && tile.building.type !== 'road') {
        // Interpolate between grass green and grey based on elevation
        // At elevation 0.1+, start showing grey tint
        // At elevation 0.5+, mostly grey (rocky)
        // At elevation 0.75+, light grey (snowy peaks)
        const greyStart = 0.1;  // Start grey earlier to make hills more visible
        const greyFull = 0.5;   // Fully grey at lower elevation
        const snowStart = 0.75; // Snow starts earlier
        
        if (elevation >= snowStart) {
          // Snow-capped peaks - very light grey/white
          const snowBlend = Math.min(1, (elevation - snowStart) / (1 - snowStart));
          topColor = lerpColor('#8b8b8b', '#e5e5e5', snowBlend);
          leftColor = lerpColor('#6b6b6b', '#c5c5c5', snowBlend);
          rightColor = lerpColor('#9b9b9b', '#f0f0f0', snowBlend);
          strokeColor = lerpColor('#5b5b5b', '#a0a0a0', snowBlend);
        } else if (elevation >= greyStart) {
          // Rocky terrain - blend from green to grey
          const blend = Math.min(1, (elevation - greyStart) / (greyFull - greyStart));
          topColor = lerpColor('#4a7c3f', '#7a7a7a', blend);
          leftColor = lerpColor('#3d6634', '#5a5a5a', blend);
          rightColor = lerpColor('#5a8f4f', '#9a9a9a', blend);
          strokeColor = lerpColor('#2d4a26', '#4a4a4a', blend);
        }
      }

      // These get grey bases: baseball_stadium, community_center, swimming_pool, office_building_small
      const allParkTypes = ['park', 'park_large', 'tennis', 'basketball_courts', 'playground_small',
        'playground_large', 'baseball_field_small', 'soccer_field_small', 'football_field',
        'skate_park', 'mini_golf_course', 'bleachers_field', 'go_kart_track', 'amphitheater', 
        'greenhouse_garden', 'animal_pens_farm', 'cabin_house', 'campground', 'marina_docks_small', 
        'pier_large', 'roller_coaster_small', 'community_garden', 'pond_park', 'park_gate', 
        'mountain_lodge', 'mountain_trailhead'];
      const isPark = allParkTypes.includes(tile.building.type) ||
                     (tile.building.type === 'empty' && isPartOfParkBuilding(tile.x, tile.y));
      // Check if this is a building (not grass, empty, water, road, tree, or parks)
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
      
      // Override colors for special tile types (takes precedence over elevation)
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
      } else if (isPark && elevation === 0) {
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
      } else if (elevation === 0) {
        // Only apply zone colors for flat terrain
        if (tile.zone === 'residential') {
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
      }
      
      // Skip drawing green base for grass/empty tiles adjacent to water (will be drawn later over water)
      const shouldSkipDrawing = skipGreenBase && (tile.building.type === 'grass' || tile.building.type === 'empty');
      
      // Draw elevated tile with 3D sides
      if (!shouldSkipDrawing) {
        // Calculate the Y offset for elevation (moves the tile up)
        const yOffset = -elevationHeight;
        
        if (elevation > 0.05) {
          // Draw left face (front-left side) for elevated tiles
          ctx.fillStyle = leftColor;
          ctx.beginPath();
          ctx.moveTo(x, y + h / 2 + yOffset);  // Top-left of top face
          ctx.lineTo(x + w / 2, y + h + yOffset);  // Bottom of top face
          ctx.lineTo(x + w / 2, y + h);  // Bottom at ground level
          ctx.lineTo(x, y + h / 2);  // Left at ground level
          ctx.closePath();
          ctx.fill();
          
          // Draw right face (front-right side) for elevated tiles
          ctx.fillStyle = rightColor;
          ctx.beginPath();
          ctx.moveTo(x + w / 2, y + h + yOffset);  // Bottom of top face
          ctx.lineTo(x + w, y + h / 2 + yOffset);  // Top-right of top face
          ctx.lineTo(x + w, y + h / 2);  // Right at ground level
          ctx.lineTo(x + w / 2, y + h);  // Bottom at ground level
          ctx.closePath();
          ctx.fill();
        }
        
        // Draw the isometric diamond (top face) - offset by elevation
        ctx.fillStyle = topColor;
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y + yOffset);
        ctx.lineTo(x + w, y + h / 2 + yOffset);
        ctx.lineTo(x + w / 2, y + h + yOffset);
        ctx.lineTo(x, y + h / 2 + yOffset);
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
        const yOffset = -elevationHeight;
        // Draw a semi-transparent fill for better visibility
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y + yOffset);
        ctx.lineTo(x + w, y + h / 2 + yOffset);
        ctx.lineTo(x + w / 2, y + h + yOffset);
        ctx.lineTo(x, y + h / 2 + yOffset);
        ctx.closePath();
        ctx.fill();
        
        // Draw white border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    
    // Helper function to interpolate between two hex colors
    function lerpColor(color1: string, color2: string, t: number): string {
      const r1 = parseInt(color1.slice(1, 3), 16);
      const g1 = parseInt(color1.slice(3, 5), 16);
      const b1 = parseInt(color1.slice(5, 7), 16);
      
      const r2 = parseInt(color2.slice(1, 3), 16);
      const g2 = parseInt(color2.slice(3, 5), 16);
      const b2 = parseInt(color2.slice(5, 7), 16);
      
      const r = Math.round(r1 + (r2 - r1) * t);
      const g = Math.round(g1 + (g2 - g1) * t);
      const b = Math.round(b1 + (b2 - b1) * t);
      
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
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
      
      // Check if this building type has a sprite in the tile renderer or parks sheet
      const activePack = getActiveSpritePack();
      const hasTileSprite = BUILDING_TO_SPRITE[buildingType] || 
        (activePack.parksBuildings && activePack.parksBuildings[buildingType]);
      
      if (hasTileSprite) {
        // Special handling for water: use separate water.png image
        if (buildingType === 'water') {
          const waterImage = imageCache.get('/assets/water.png');
          if (waterImage) {
            // Center the water sprite on the tile
            const tileCenterX = x + w / 2;
            const tileCenterY = y + h / 2;
            
            // Scale to 71.5% of tile size (65% * 1.1 = 10% expansion)
            const destWidth = w * 1.2 * 0.715;
            const aspectRatio = (waterImage.naturalHeight || waterImage.height) / (waterImage.naturalWidth || waterImage.width);
            const destHeight = destWidth * aspectRatio;
            
            // Draw the water image centered on tile (can overflow/clip at map edges)
            ctx.drawImage(
              waterImage,
              0, 0, waterImage.naturalWidth || waterImage.width, waterImage.naturalHeight || waterImage.height,
              Math.round(tileCenterX - destWidth / 2), Math.round(tileCenterY - destHeight / 2),
              Math.round(destWidth), Math.round(destHeight)
            );
          }
        } else {
          // ===== TILE RENDERER PATH =====
          // Handles both single-tile and multi-tile buildings
          // Get the filtered sprite sheet from cache (or fallback to unfiltered if not available)
          // Use the active sprite pack's source for cache lookup (activePack already defined above)
          
          // Check if building is under construction (constructionProgress < 100)
          const isUnderConstruction = tile.building.constructionProgress !== undefined &&
                                       tile.building.constructionProgress < 100;
          
          // Check if building is abandoned
          const isAbandoned = tile.building.abandoned === true;

          // Use appropriate sprite sheet based on building state
          // Priority: parks construction > construction > abandoned > parks > dense variants > normal
          let spriteSource = activePack.src;
          let useDenseVariant: { row: number; col: number } | null = null;
          let useParksBuilding: { row: number; col: number } | null = null;
          
          // Check if this is a parks building first
          const isParksBuilding = activePack.parksBuildings && activePack.parksBuildings[buildingType];
          
          if (isUnderConstruction && isParksBuilding && activePack.parksConstructionSrc) {
            // Parks building under construction - use parks construction sheet
            useParksBuilding = activePack.parksBuildings![buildingType];
            spriteSource = activePack.parksConstructionSrc;
          } else if (isUnderConstruction && activePack.constructionSrc) {
            spriteSource = activePack.constructionSrc;
          } else if (isAbandoned && activePack.abandonedSrc) {
            spriteSource = activePack.abandonedSrc;
          } else if (isParksBuilding && activePack.parksSrc) {
            // Check if this building type is from the parks sprite sheet
            useParksBuilding = activePack.parksBuildings![buildingType];
            spriteSource = activePack.parksSrc;
          } else if (activePack.denseSrc && activePack.denseVariants && activePack.denseVariants[buildingType]) {
            // Check if this building type has dense variants available
            const variants = activePack.denseVariants[buildingType];
            // Use deterministic random based on tile position to select variant
            // This ensures the same building always shows the same variant
            const seed = (tile.x * 31 + tile.y * 17) % 100;
            // ~50% chance to use a dense variant (when seed < 50)
            if (seed < 50 && variants.length > 0) {
              // Select which dense variant to use based on position
              const variantIndex = (tile.x * 7 + tile.y * 13) % variants.length;
              useDenseVariant = variants[variantIndex];
              spriteSource = activePack.denseSrc;
            }
          }

          const filteredSpriteSheet = imageCache.get(`${spriteSource}_filtered`) || imageCache.get(spriteSource);
          
          if (filteredSpriteSheet) {
            // Use naturalWidth/naturalHeight for accurate source dimensions
            const sheetWidth = filteredSpriteSheet.naturalWidth || filteredSpriteSheet.width;
            const sheetHeight = filteredSpriteSheet.naturalHeight || filteredSpriteSheet.height;
            
            // Get sprite coordinates - either from parks, dense variant, or normal mapping
            let coords: { sx: number; sy: number; sw: number; sh: number } | null;
            let isDenseVariant = false;
            let isParksBuilding = false;
            if (useParksBuilding) {
              isParksBuilding = true;
              // Calculate coordinates from parks sprite sheet using its own grid dimensions
              const parksCols = activePack.parksCols || 5;
              const parksRows = activePack.parksRows || 6;
              const tileWidth = Math.floor(sheetWidth / parksCols);
              const tileHeight = Math.floor(sheetHeight / parksRows);
              let sourceY = useParksBuilding.row * tileHeight;
              let sourceH = tileHeight;
              
              // Special handling for marina_docks_small (2x2) - shift source down to avoid capturing
              // content from the sprite above it in the sprite sheet
              if (buildingType === 'marina_docks_small') {
                sourceY += tileHeight * 0.15; // Shift down 15% to avoid row above
              }
              
              coords = {
                sx: useParksBuilding.col * tileWidth,
                sy: sourceY,
                sw: tileWidth,
                sh: sourceH,
              };
            } else if (useDenseVariant) {
              isDenseVariant = true;
              // Calculate coordinates directly from dense variant row/col
              const tileWidth = Math.floor(sheetWidth / activePack.cols);
              const tileHeight = Math.floor(sheetHeight / activePack.rows);
              let sourceY = useDenseVariant.row * tileHeight;
              let sourceH = tileHeight;
              // For mall dense variants (rows 2-3), shift source Y down to avoid capturing
              // content from the row above that bleeds into the cell boundary
              if (buildingType === 'mall') {
                sourceY += tileHeight * 0.12; // Shift down ~12% to avoid row above
              }
              // For apartment_high dense variants, add a bit more height to avoid cutoff at bottom
              if (buildingType === 'apartment_high') {
                sourceH = tileHeight * 1.05; // Add 5% more height at bottom
              }
              coords = {
                sx: useDenseVariant.col * tileWidth,
                sy: sourceY,
                sw: tileWidth,
                sh: sourceH,
              };
            } else {
              // getSpriteCoords handles building type to sprite key mapping
              coords = getSpriteCoords(buildingType, sheetWidth, sheetHeight);
            }
            
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
              // Special scale adjustment for airport (scaled up 5%)
              if (buildingType === 'airport') {
                scaleMultiplier *= 1.05; // Scale up by 5%
              }
              // Special scale adjustment for school (scaled up 5%)
              if (buildingType === 'school') {
                scaleMultiplier *= 1.05; // Scale up by 5%
              }
              // Special scale adjustment for university (scaled down 5%)
              if (buildingType === 'university') {
                scaleMultiplier *= 0.95; // Scale down by 5%
              }
              // Special scale adjustment for space_program (scaled up 10%)
              if (buildingType === 'space_program') {
                scaleMultiplier *= 1.1; // Scale up by 10%
              }
              // Special scale adjustment for stadium (scaled down 30%)
              if (buildingType === 'stadium') {
                scaleMultiplier *= 0.7; // Scale down by 30%
              }
              // Special scale adjustment for water_tower (scaled down 10%)
              if (buildingType === 'water_tower') {
                scaleMultiplier *= 0.9; // Scale down by 10%
              }
              // Special scale adjustment for house_small (scaled up 8%)
              if (buildingType === 'house_small') {
                scaleMultiplier *= 1.08; // Scale up by 8%
              }
              // Special scale adjustment for apartments
              if (buildingType === 'apartment_low') {
                scaleMultiplier *= 1.15; // Scale up by 15%
              }
              if (buildingType === 'apartment_high') {
                scaleMultiplier *= 1.38; // Scale up by 38% (20% + 15%)
              }
              // Special scale adjustment for office_high (scaled up 20%)
              if (buildingType === 'office_high') {
                scaleMultiplier *= 1.20;
              }
              // Special scale adjustment for dense mall variants (scaled down 15%)
              if (buildingType === 'mall' && isDenseVariant) {
                scaleMultiplier *= 0.85;
              }
              // Apply dense-specific scale if building uses dense variant and has custom scale in config
              if (isDenseVariant && activePack.denseScales && buildingType in activePack.denseScales) {
                scaleMultiplier *= activePack.denseScales[buildingType];
              }
              // Apply parks-specific scale if building is from parks sheet and has custom scale in config
              if (isParksBuilding && activePack.parksScales && buildingType in activePack.parksScales) {
                scaleMultiplier *= activePack.parksScales[buildingType];
              }
              // Apply construction-specific scale if building is under construction and has custom scale
              if (isUnderConstruction && activePack.constructionScales && buildingType in activePack.constructionScales) {
                scaleMultiplier *= activePack.constructionScales[buildingType];
              }
              // Apply abandoned-specific scale if building is abandoned and has custom scale
              if (isAbandoned && activePack.abandonedScales && buildingType in activePack.abandonedScales) {
                scaleMultiplier *= activePack.abandonedScales[buildingType];
              }
              // Apply global scale from sprite pack if available
              const globalScale = activePack.globalScale ?? 1;
              const destWidth = w * 1.2 * scaleMultiplier * globalScale;
              const aspectRatio = coords.sh / coords.sw;  // height/width ratio of source
              const destHeight = destWidth * aspectRatio;
              
              // Position: center horizontally on tile/footprint, anchor bottom of sprite at tile bottom
              let drawX = drawPosX + w / 2 - destWidth / 2;
              
              // Apply per-sprite horizontal offset adjustments
              const spriteKey = BUILDING_TO_SPRITE[buildingType];
              let horizontalOffset = (spriteKey && SPRITE_HORIZONTAL_OFFSETS[spriteKey]) ? SPRITE_HORIZONTAL_OFFSETS[spriteKey] * w : 0;
              // Apply parks-specific horizontal offset if available
              if (isParksBuilding && activePack.parksHorizontalOffsets && buildingType in activePack.parksHorizontalOffsets) {
                horizontalOffset = activePack.parksHorizontalOffsets[buildingType] * w;
              }
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
              // Use state-specific offset if available, then fall back to building-type or sprite-key offsets
              // Priority: construction > abandoned > parks > dense > building-type > sprite-key
              let extraOffset = 0;
              if (isUnderConstruction && activePack.constructionVerticalOffsets && spriteKey && spriteKey in activePack.constructionVerticalOffsets) {
                extraOffset = activePack.constructionVerticalOffsets[spriteKey] * h;
              } else if (isAbandoned && activePack.abandonedVerticalOffsets && buildingType in activePack.abandonedVerticalOffsets) {
                // Abandoned buildings may need different positioning than normal
                extraOffset = activePack.abandonedVerticalOffsets[buildingType] * h;
              } else if (isParksBuilding && activePack.parksVerticalOffsets && buildingType in activePack.parksVerticalOffsets) {
                // Parks buildings may need specific positioning
                extraOffset = activePack.parksVerticalOffsets[buildingType] * h;
              } else if (isDenseVariant && activePack.denseVerticalOffsets && buildingType in activePack.denseVerticalOffsets) {
                // Dense variants may need different positioning than normal
                extraOffset = activePack.denseVerticalOffsets[buildingType] * h;
              } else if (activePack.buildingVerticalOffsets && buildingType in activePack.buildingVerticalOffsets) {
                // Building-type-specific offset (for buildings sharing sprites but needing different positioning)
                extraOffset = activePack.buildingVerticalOffsets[buildingType] * h;
              } else if (spriteKey && SPRITE_VERTICAL_OFFSETS[spriteKey]) {
                extraOffset = SPRITE_VERTICAL_OFFSETS[spriteKey] * h;
              }
              verticalPush += extraOffset;
              
              drawY = drawPosY + h - destHeight + verticalPush;
              
              // Check if building should be horizontally flipped (used for waterfront buildings like marina/pier)
              // Some buildings are mirrored by default and the flip flag inverts that
              const defaultMirroredBuildings = ['marina_docks_small', 'pier_large'];
              const isDefaultMirrored = defaultMirroredBuildings.includes(buildingType);
              const isFlipped = isDefaultMirrored ? !tile.building.flipped : tile.building.flipped === true;
              
              if (isFlipped) {
                // Apply horizontal flip around the center of the sprite
                ctx.save();
                const centerX = Math.round(drawX + destWidth / 2);
                ctx.translate(centerX, 0);
                ctx.scale(-1, 1);
                ctx.translate(-centerX, 0);
                
                // Draw the flipped sprite
                ctx.drawImage(
                  filteredSpriteSheet,
                  coords.sx, coords.sy, coords.sw, coords.sh,
                  Math.round(drawX), Math.round(drawY),
                  Math.round(destWidth), Math.round(destHeight)
                );
                
                ctx.restore();
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
        
        // Check if this tile is selected or part of a selected multi-tile building
        let isSelected = selectedTile?.x === x && selectedTile?.y === y;
        if (!isSelected && selectedTile) {
          // Check if selected tile is a multi-tile building that includes this tile
          const selectedOrigin = grid[selectedTile.y]?.[selectedTile.x];
          if (selectedOrigin) {
            const selectedSize = getBuildingSize(selectedOrigin.building.type);
            if (selectedSize.width > 1 || selectedSize.height > 1) {
              // Check if current tile is within the selected building's footprint
              if (x >= selectedTile.x && x < selectedTile.x + selectedSize.width &&
                  y >= selectedTile.y && y < selectedTile.y + selectedSize.height) {
                isSelected = true;
              }
            }
          }
        }
        
        // Check if tile is in drag selection rectangle (only show for zoning tools)
        const isInDragRect = showsDragGrid && dragStartTile && dragEndTile && 
          x >= Math.min(dragStartTile.x, dragEndTile.x) &&
          x <= Math.max(dragStartTile.x, dragEndTile.x) &&
          y >= Math.min(dragStartTile.y, dragEndTile.y) &&
          y <= Math.max(dragStartTile.y, dragEndTile.y);

        // Check if this tile needs a gray base tile (buildings except parks)
        // These get grey bases: baseball_stadium, community_center, swimming_pool, office_building_small
        const allParkTypesCheck = ['park', 'park_large', 'tennis', 'basketball_courts', 'playground_small',
          'playground_large', 'baseball_field_small', 'soccer_field_small', 'football_field',
          'skate_park', 'mini_golf_course', 'bleachers_field', 'go_kart_track', 'amphitheater', 
          'greenhouse_garden', 'animal_pens_farm', 'cabin_house', 'campground', 'marina_docks_small', 
          'pier_large', 'roller_coaster_small', 'community_garden', 'pond_park', 'park_gate', 
          'mountain_lodge', 'mountain_trailhead'];
        const isPark = allParkTypesCheck.includes(tile.building.type) ||
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
        
        // Check if this is a park that needs a green base tile
        const needsGreenBaseForPark = (tile.building.type === 'park' || tile.building.type === 'park_large') ||
                                      (tile.building.type === 'empty' && isPartOfParkBuilding(x, y));
        
        // Draw base tile for all tiles (including water), but skip gray bases for buildings and green bases for grass/empty adjacent to water or parks
        drawIsometricTile(ctx, screenX, screenY, tile, !!(isHovered || isSelected || isInDragRect), zoom, true, needsGreenBaseOverWater || needsGreenBaseForPark);
        
        if (needsGreyBase) {
          baseTileQueue.push({ screenX, screenY, tile, depth: x + y });
        }
        
        if (needsGreenBaseOverWater || needsGreenBaseForPark) {
          greenBaseTileQueue.push({ screenX, screenY, tile, depth: x + y });
        }
        
        // Separate water tiles into their own queue (drawn after base tiles, below other buildings)
        if (tile.building.type === 'water') {
          const size = getBuildingSize(tile.building.type);
          const depth = x + y + size.width + size.height - 2;
          waterQueue.push({ screenX, screenY, tile, depth });
        }
        // Roads go to their own queue (drawn above water)
        else if (tile.building.type === 'road') {
          const depth = x + y;
          roadQueue.push({ screenX, screenY, tile, depth });
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
        
        // For subway overlay, show ALL non-water tiles (valid placement areas + existing subway)
        // For other overlays, show buildings only
        const showOverlay =
          overlayMode !== 'none' &&
          (overlayMode === 'subway' 
            ? tile.building.type !== 'water'  // For subway mode, show all non-water tiles
            : (tile.building.type !== 'grass' &&
               tile.building.type !== 'water' &&
               tile.building.type !== 'road'));
        if (showOverlay) {
          overlayQueue.push({ screenX, screenY, tile });
        }
      }
    }
    
    // Draw water sprites (after base tiles, below other buildings)
    // Add clipping to prevent water from overflowing map boundaries
    ctx.save();
    // Create clipping path for map boundaries - form a diamond shape around the map
    // Get the four corner tiles of the map
    const topLeft = gridToScreen(0, 0, 0, 0);
    const topRight = gridToScreen(gridSize - 1, 0, 0, 0);
    const bottomRight = gridToScreen(gridSize - 1, gridSize - 1, 0, 0);
    const bottomLeft = gridToScreen(0, gridSize - 1, 0, 0);
    const w = TILE_WIDTH;
    const h = TILE_HEIGHT;
    
    // Create clipping path following the outer edges of the map
    // The path goes around the perimeter: top -> right -> bottom -> left -> back to top
    ctx.beginPath();
    // Start at top point (top-left tile's top corner)
    ctx.moveTo(topLeft.screenX + w / 2, topLeft.screenY);
    // Go to right point (top-right tile's right corner)
    ctx.lineTo(topRight.screenX + w, topRight.screenY + h / 2);
    // Go to bottom point (bottom-right tile's bottom corner)
    ctx.lineTo(bottomRight.screenX + w / 2, bottomRight.screenY + h);
    // Go to left point (bottom-left tile's left corner)
    ctx.lineTo(bottomLeft.screenX, bottomLeft.screenY + h / 2);
    // Close the path back to top
    ctx.closePath();
    ctx.clip();
    
    waterQueue
      .sort((a, b) => a.depth - b.depth)
      .forEach(({ tile, screenX, screenY }) => {
        drawBuilding(ctx, screenX, screenY, tile);
      });
    
    ctx.restore(); // Remove clipping after drawing water
    
    // Draw roads (above water, needs full redraw including base tile)
    roadQueue
      .sort((a, b) => a.depth - b.depth)
      .forEach(({ tile, screenX, screenY }) => {
        // Draw road base tile first (grey diamond)
        const w = TILE_WIDTH;
        const h = TILE_HEIGHT;
        ctx.fillStyle = '#4a4a4a';
        ctx.beginPath();
        ctx.moveTo(screenX + w / 2, screenY);
        ctx.lineTo(screenX + w, screenY + h / 2);
        ctx.lineTo(screenX + w / 2, screenY + h);
        ctx.lineTo(screenX, screenY + h / 2);
        ctx.closePath();
        ctx.fill();
        
        // Draw road markings and sidewalks
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
      } else if (overlayMode === 'subway') {
        // Underground view overlay - darker tint to simulate underground, bright amber for subway lines
        if (tile.hasSubway) {
          fillStyle = 'rgba(245, 158, 11, 0.7)'; // Bright amber for existing subway
        } else {
          fillStyle = 'rgba(40, 30, 20, 0.4)'; // Dark brown tint for "underground" view
        }
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
    
    // Draw water body names (after everything else so they're on top)
    if (waterBodies && waterBodies.length > 0) {
      ctx.save();
      ctx.font = `${Math.max(10, 12 / zoom)}px sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.lineWidth = 2;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Use same viewport calculation as main rendering (accounting for DPR)
      const viewWidth = canvasSize.width / (dpr * zoom);
      const viewHeight = canvasSize.height / (dpr * zoom);
      const viewLeft = -offset.x / zoom - TILE_WIDTH;
      const viewTop = -offset.y / zoom - TILE_HEIGHT * 2;
      const viewRight = viewWidth - offset.x / zoom + TILE_WIDTH;
      const viewBottom = viewHeight - offset.y / zoom + TILE_HEIGHT * 2;
      
      for (const waterBody of waterBodies) {
        if (waterBody.tiles.length === 0) continue;
        
        // Convert grid coordinates to screen coordinates (context is already translated)
        const { screenX, screenY } = gridToScreen(waterBody.centerX, waterBody.centerY, 0, 0);
        
        // Only draw if visible on screen (with some padding for text)
        if (screenX >= viewLeft - 100 && screenX <= viewRight + 100 &&
            screenY >= viewTop - 50 && screenY <= viewBottom + 50) {
          // Draw text with outline for better visibility, centered on tile
          ctx.strokeText(waterBody.name, screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT / 2);
          ctx.fillText(waterBody.name, screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT / 2);
        }
      }
      
      ctx.restore();
    }
    
    ctx.restore();
  }, [grid, gridSize, offset, zoom, hoveredTile, selectedTile, overlayMode, imagesLoaded, canvasSize, dragStartTile, dragEndTile, state.services, currentSpritePack, waterBodies, isPartOfMultiTileBuilding, isPartOfParkBuilding, showsDragGrid]);
  
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
        spawnCrimeIncidents(delta); // Spawn new crime incidents
        updateCrimeIncidents(delta); // Update/decay crime incidents
        updateEmergencyVehicles(delta); // Update emergency vehicles!
        updatePedestrians(delta); // Update pedestrians (zoom-gated)
        updateAirplanes(delta); // Update airplanes (airport required)
        updateBoats(delta); // Update boats (marina/pier required)
      }
      drawCars(ctx);
      drawPedestrians(ctx); // Draw pedestrians (zoom-gated)
      drawBoats(ctx); // Draw boats on water
      drawEmergencyVehicles(ctx); // Draw emergency vehicles!
      drawAirplanes(ctx); // Draw airplanes above everything
    };
    
    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [canvasSize.width, canvasSize.height, updateCars, drawCars, spawnCrimeIncidents, updateCrimeIncidents, updateEmergencyVehicles, drawEmergencyVehicles, updatePedestrians, drawPedestrians, updateAirplanes, drawAirplanes, updateBoats, drawBoats]);
  
  // Day/Night cycle lighting rendering
  useEffect(() => {
    const canvas = lightingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    
    // Calculate darkness based on hour (0-23)
    // Dawn: 5-7, Day: 7-18, Dusk: 18-20, Night: 20-5
    const getDarkness = (h: number): number => {
      if (h >= 7 && h < 18) return 0; // Full daylight
      if (h >= 5 && h < 7) return 1 - (h - 5) / 2; // Dawn transition
      if (h >= 18 && h < 20) return (h - 18) / 2; // Dusk transition
      return 1; // Night
    };
    
    // Get ambient color based on time
    const getAmbientColor = (h: number): { r: number; g: number; b: number } => {
      if (h >= 7 && h < 18) return { r: 255, g: 255, b: 255 }; // Daylight
      if (h >= 5 && h < 7) { // Dawn - warm orange tint
        const t = (h - 5) / 2;
        return { 
          r: Math.round(60 + 40 * t),
          g: Math.round(40 + 30 * t),
          b: Math.round(70 + 20 * t)
        };
      }
      if (h >= 18 && h < 20) { // Dusk - warm purple tint  
        const t = (h - 18) / 2;
        return { 
          r: Math.round(100 - 40 * t),
          g: Math.round(70 - 30 * t),
          b: Math.round(90 - 20 * t)
        };
      }
      // Night - deep blue tint
      return { r: 20, g: 30, b: 60 };
    };
    
    const darkness = getDarkness(hour);
    const ambient = getAmbientColor(hour);
    
    // Clear canvas
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // If it's full daylight, just clear and return
    if (darkness <= 0.01) return;
    
    // Apply darkness overlay (semi-transparent dark layer)
    const alpha = darkness * 0.55; // Maximum 55% darkening at night
    ctx.fillStyle = `rgba(${ambient.r}, ${ambient.g}, ${ambient.b}, ${alpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Now use destination-out to "cut holes" in the darkness where lights are
    // This creates the effect of lights illuminating through the darkness
    ctx.globalCompositeOperation = 'destination-out';
    
    // Apply zoom and offset transformation
    ctx.save();
    ctx.scale(dpr * zoom, dpr * zoom);
    ctx.translate(offset.x / zoom, offset.y / zoom);
    
    // Calculate viewport bounds
    const viewWidth = canvas.width / (dpr * zoom);
    const viewHeight = canvas.height / (dpr * zoom);
    const viewLeft = -offset.x / zoom - TILE_WIDTH * 2;
    const viewTop = -offset.y / zoom - TILE_HEIGHT * 4;
    const viewRight = viewWidth - offset.x / zoom + TILE_WIDTH * 2;
    const viewBottom = viewHeight - offset.y / zoom + TILE_HEIGHT * 4;
    
    const gridToScreen = (gx: number, gy: number) => ({
      screenX: (gx - gy) * TILE_WIDTH / 2,
      screenY: (gx + gy) * TILE_HEIGHT / 2,
    });
    
    // Light intensity scales with darkness - lights punch through more at full night
    const lightIntensity = Math.min(1, darkness * 1.2);
    
    // Draw light cutouts for each tile
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const { screenX, screenY } = gridToScreen(x, y);
        
        // Skip tiles outside viewport
        if (screenX + TILE_WIDTH < viewLeft || screenX > viewRight ||
            screenY + TILE_HEIGHT * 3 < viewTop || screenY > viewBottom) {
          continue;
        }
        
        const tile = grid[y][x];
        const buildingType = tile.building.type;
        const tileCenterX = screenX + TILE_WIDTH / 2;
        const tileCenterY = screenY + TILE_HEIGHT / 2;
        
        // Street lights on roads - cut circles of light through darkness
        if (buildingType === 'road') {
          const lightRadius = 28;
          const gradient = ctx.createRadialGradient(
            tileCenterX, tileCenterY, 0,
            tileCenterX, tileCenterY, lightRadius
          );
          gradient.addColorStop(0, `rgba(255, 255, 255, ${0.7 * lightIntensity})`);
          gradient.addColorStop(0.4, `rgba(255, 255, 255, ${0.35 * lightIntensity})`);
          gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(tileCenterX, tileCenterY, lightRadius, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Building windows glow at night - cut through darkness
        const isBuilding = 
          buildingType !== 'grass' && 
          buildingType !== 'empty' && 
          buildingType !== 'water' && 
          buildingType !== 'road' && 
          buildingType !== 'tree' &&
          buildingType !== 'park' &&
          buildingType !== 'park_large' &&
          buildingType !== 'tennis';
        
        if (isBuilding && tile.building.powered) {
          // Different buildings get different light intensities
          const isResidential = ['house_small', 'house_medium', 'mansion', 'apartment_low', 'apartment_high'].includes(buildingType);
          const isCommercial = ['shop_small', 'shop_medium', 'office_low', 'office_high', 'mall'].includes(buildingType);
          
          // Stronger glow for commercial (they stay lit), dimmer for residential
          const glowStrength = isCommercial ? 0.85 : isResidential ? 0.6 : 0.7;
          
          // Number of window lights based on building size
          let numWindows = 2;
          if (buildingType?.includes('medium') || buildingType?.includes('low')) numWindows = 3;
          if (buildingType?.includes('high') || buildingType === 'mall') numWindows = 5;
          if (buildingType === 'mansion' || buildingType === 'office_high') numWindows = 4;
          
          // Draw window light cutouts
          const windowSize = 5;
          const buildingHeight = -18;
          
          // Use deterministic pseudo-random based on tile position
          const seed = x * 1000 + y;
          const pseudoRandom = (n: number) => {
            const s = Math.sin(seed + n * 12.9898) * 43758.5453;
            return s - Math.floor(s);
          };
          
          for (let i = 0; i < numWindows; i++) {
            // Some windows are lit, some aren't
            const isLit = pseudoRandom(i) < (isResidential ? 0.55 : 0.75);
            if (!isLit) continue;
            
            const wx = tileCenterX + (pseudoRandom(i + 10) - 0.5) * 22;
            const wy = tileCenterY + buildingHeight + (pseudoRandom(i + 20) - 0.5) * 16;
            
            // Radial gradient to cut through darkness
            const gradient = ctx.createRadialGradient(wx, wy, 0, wx, wy, windowSize * 2.5);
            gradient.addColorStop(0, `rgba(255, 255, 255, ${glowStrength * lightIntensity})`);
            gradient.addColorStop(0.5, `rgba(255, 255, 255, ${glowStrength * 0.4 * lightIntensity})`);
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(wx, wy, windowSize * 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
          
          // Building casts light on the ground
          const groundGlow = ctx.createRadialGradient(
            tileCenterX, tileCenterY + TILE_HEIGHT / 4, 0,
            tileCenterX, tileCenterY + TILE_HEIGHT / 4, TILE_WIDTH * 0.6
          );
          groundGlow.addColorStop(0, `rgba(255, 255, 255, ${0.25 * lightIntensity})`);
          groundGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
          
          ctx.fillStyle = groundGlow;
          ctx.beginPath();
          ctx.ellipse(tileCenterX, tileCenterY + TILE_HEIGHT / 4, TILE_WIDTH * 0.6, TILE_HEIGHT / 2.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    
    ctx.restore();
    
    // Now add colored light glows on TOP using source-over
    ctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.scale(dpr * zoom, dpr * zoom);
    ctx.translate(offset.x / zoom, offset.y / zoom);
    
    // Add colored glow for special buildings (emergency services, etc.)
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const { screenX, screenY } = gridToScreen(x, y);
        
        if (screenX + TILE_WIDTH < viewLeft || screenX > viewRight ||
            screenY + TILE_HEIGHT * 3 < viewTop || screenY > viewBottom) {
          continue;
        }
        
        const tile = grid[y][x];
        const buildingType = tile.building.type;
        const tileCenterX = screenX + TILE_WIDTH / 2;
        const tileCenterY = screenY + TILE_HEIGHT / 2;
        
        // Special colored glows for emergency services
        if (tile.building.powered) {
          let glowColor: { r: number; g: number; b: number } | null = null;
          let glowRadius = 20;
          
          if (buildingType === 'hospital') {
            glowColor = { r: 255, g: 80, b: 80 }; // Red cross glow
            glowRadius = 25;
          } else if (buildingType === 'fire_station') {
            glowColor = { r: 255, g: 100, b: 50 }; // Orange-red glow
            glowRadius = 22;
          } else if (buildingType === 'police_station') {
            glowColor = { r: 60, g: 140, b: 255 }; // Blue glow
            glowRadius = 22;
          } else if (buildingType === 'power_plant') {
            glowColor = { r: 255, g: 200, b: 50 }; // Yellow industrial glow
            glowRadius = 30;
          }
          
          if (glowColor) {
            const gradient = ctx.createRadialGradient(
              tileCenterX, tileCenterY - 15, 0,
              tileCenterX, tileCenterY - 15, glowRadius
            );
            gradient.addColorStop(0, `rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, ${0.5 * lightIntensity})`);
            gradient.addColorStop(0.5, `rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, ${0.2 * lightIntensity})`);
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(tileCenterX, tileCenterY - 15, glowRadius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        
        // Street light warm glow overlay
        if (buildingType === 'road') {
          const gradient = ctx.createRadialGradient(
            tileCenterX, tileCenterY, 0,
            tileCenterX, tileCenterY, 20
          );
          gradient.addColorStop(0, `rgba(255, 210, 130, ${0.25 * lightIntensity})`);
          gradient.addColorStop(0.5, `rgba(255, 190, 100, ${0.1 * lightIntensity})`);
          gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(tileCenterX, tileCenterY, 20, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    
  }, [grid, gridSize, hour, offset, zoom, canvasSize.width, canvasSize.height]);
  
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
            // For multi-tile buildings, select the origin tile
            const origin = findBuildingOrigin(gridX, gridY);
            if (origin) {
              setSelectedTile({ x: origin.originX, y: origin.originY });
            } else {
              setSelectedTile({ x: gridX, y: gridY });
            }
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
            // Reset road drawing state for new drag
            setRoadDrawDirection(null);
            placedRoadTilesRef.current.clear();
            // Place immediately on first click
            placeAtTile(gridX, gridY);
            // Track initial tile for roads and subways
            if (selectedTool === 'road' || selectedTool === 'subway') {
              placedRoadTilesRef.current.add(`${gridX},${gridY}`);
            }
          }
        }
      }
    }
  }, [offset, gridSize, selectedTool, placeAtTile, zoom, showsDragGrid, supportsDragPlace, setSelectedTile, findBuildingOrigin]);
  
  // Calculate camera bounds based on grid size
  const getMapBounds = useCallback((currentZoom: number, canvasW: number, canvasH: number) => {
    const n = gridSize;
    const padding = 100; // Allow some over-scroll
    
    // Map bounds in world coordinates
    const mapLeft = -(n - 1) * TILE_WIDTH / 2;
    const mapRight = (n - 1) * TILE_WIDTH / 2;
    const mapTop = 0;
    const mapBottom = (n - 1) * TILE_HEIGHT;
    
    const minOffsetX = padding - mapRight * currentZoom;
    const maxOffsetX = canvasW - padding - mapLeft * currentZoom;
    const minOffsetY = padding - mapBottom * currentZoom;
    const maxOffsetY = canvasH - padding - mapTop * currentZoom;
    
    return { minOffsetX, maxOffsetX, minOffsetY, maxOffsetY };
  }, [gridSize]);
  
  // Clamp offset to keep camera within reasonable bounds
  const clampOffset = useCallback((newOffset: { x: number; y: number }, currentZoom: number) => {
    const bounds = getMapBounds(currentZoom, canvasSize.width, canvasSize.height);
    return {
      x: Math.max(bounds.minOffsetX, Math.min(bounds.maxOffsetX, newOffset.x)),
      y: Math.max(bounds.minOffsetY, Math.min(bounds.maxOffsetY, newOffset.y)),
    };
  }, [getMapBounds, canvasSize.width, canvasSize.height]);

  // Handle minimap navigation - center the view on the target tile
  useEffect(() => {
    if (!navigationTarget) return;
    
    // Convert grid coordinates to screen coordinates
    const { screenX, screenY } = gridToScreen(navigationTarget.x, navigationTarget.y, 0, 0);
    
    // Calculate offset to center this position on the canvas
    const centerX = canvasSize.width / 2;
    const centerY = canvasSize.height / 2;
    
    const newOffset = {
      x: centerX - screenX * zoom,
      y: centerY - screenY * zoom,
    };
    
    // Clamp and set the new offset - this is a legitimate use case for responding to navigation requests
    const bounds = getMapBounds(zoom, canvasSize.width, canvasSize.height);
    setOffset({ // eslint-disable-line
      x: Math.max(bounds.minOffsetX, Math.min(bounds.maxOffsetX, newOffset.x)),
      y: Math.max(bounds.minOffsetY, Math.min(bounds.maxOffsetY, newOffset.y)),
    });
    
    // Signal that navigation is complete
    onNavigationComplete?.();
  }, [navigationTarget, zoom, canvasSize.width, canvasSize.height, getMapBounds, onNavigationComplete]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      const newOffset = {
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      };
      setOffset(clampOffset(newOffset, zoom));
      return;
    }
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const mouseX = (e.clientX - rect.left) / zoom;
      const mouseY = (e.clientY - rect.top) / zoom;
      const { gridX, gridY } = screenToGrid(mouseX, mouseY, offset.x / zoom, offset.y / zoom);
      
      if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
        // Only update hovered tile if it actually changed to avoid unnecessary re-renders
        setHoveredTile(prev => (prev?.x === gridX && prev?.y === gridY) ? prev : { x: gridX, y: gridY });
        
        // Update drag rectangle end point for zoning tools
        if (isDragging && showsDragGrid && dragStartTile) {
          setDragEndTile({ x: gridX, y: gridY });
        }
        // For roads and subways, use straight-line snapping
        else if (isDragging && (selectedTool === 'road' || selectedTool === 'subway') && dragStartTile) {
          const dx = Math.abs(gridX - dragStartTile.x);
          const dy = Math.abs(gridY - dragStartTile.y);
          
          // Lock direction after moving at least 1 tile
          let direction = roadDrawDirection;
          if (!direction && (dx > 0 || dy > 0)) {
            // Lock to the axis with more movement, or horizontal if equal
            direction = dx >= dy ? 'h' : 'v';
            setRoadDrawDirection(direction);
          }
          
          // Calculate target position along the locked axis
          let targetX = gridX;
          let targetY = gridY;
          if (direction === 'h') {
            targetY = dragStartTile.y; // Lock to horizontal
          } else if (direction === 'v') {
            targetX = dragStartTile.x; // Lock to vertical
          }
          
          setDragEndTile({ x: targetX, y: targetY });
          
          // Place all tiles from start to target in a straight line
          const minX = Math.min(dragStartTile.x, targetX);
          const maxX = Math.max(dragStartTile.x, targetX);
          const minY = Math.min(dragStartTile.y, targetY);
          const maxY = Math.max(dragStartTile.y, targetY);
          
          for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
              const key = `${x},${y}`;
              if (!placedRoadTilesRef.current.has(key)) {
                placeAtTile(x, y);
                placedRoadTilesRef.current.add(key);
              }
            }
          }
        }
        // For other drag-to-place tools, place continuously
        else if (isDragging && supportsDragPlace && dragStartTile) {
          placeAtTile(gridX, gridY);
        }
      }
    }
  }, [isPanning, dragStart, offset, zoom, gridSize, isDragging, showsDragGrid, dragStartTile, selectedTool, roadDrawDirection, supportsDragPlace, placeAtTile, clampOffset]);
  
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
          setRoadDrawDirection(null);
          placedRoadTilesRef.current.clear();
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
      
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          placeAtTile(x, y);
        }
      }
    }
    
    // Clear drag state
    setIsDragging(false);
    setDragStartTile(null);
    setDragEndTile(null);
    setIsPanning(false);
    setRoadDrawDirection(null);
    placedRoadTilesRef.current.clear();
    
    // Clear hovered tile when mouse leaves
    if (!containerRef.current) {
      setHoveredTile(null);
    }
  }, [isDragging, gridSize, showsDragGrid, supportsDragPlace, dragStartTile, placeAtTile, selectedTool, dragEndTile, adjacentCities]);
  
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // Mouse position relative to canvas (in screen pixels)
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Calculate new zoom
    const zoomDelta = e.deltaY > 0 ? -0.05 : 0.05;
    const newZoom = Math.max(0.3, Math.min(2, zoom + zoomDelta));
    
    if (newZoom === zoom) return;
    
    // World position under the mouse before zoom
    // screen = world * zoom + offset → world = (screen - offset) / zoom
    const worldX = (mouseX - offset.x) / zoom;
    const worldY = (mouseY - offset.y) / zoom;
    
    // After zoom, keep the same world position under the mouse
    // mouseX = worldX * newZoom + newOffset.x → newOffset.x = mouseX - worldX * newZoom
    const newOffsetX = mouseX - worldX * newZoom;
    const newOffsetY = mouseY - worldY * newZoom;
    
    // Clamp to map bounds
    const clampedOffset = clampOffset({ x: newOffsetX, y: newOffsetY }, newZoom);
    
    setOffset(clampedOffset);
    setZoom(newZoom);
  }, [zoom, offset, clampOffset]);

  // Touch handlers for mobile
  const getTouchDistance = useCallback((touch1: React.Touch, touch2: React.Touch) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const getTouchCenter = useCallback((touch1: React.Touch, touch2: React.Touch) => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2,
    };
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      // Single touch - could be pan or tap
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
      setDragStart({ x: touch.clientX - offset.x, y: touch.clientY - offset.y });
      setIsPanning(true);
    } else if (e.touches.length === 2) {
      // Two finger touch - pinch to zoom
      const distance = getTouchDistance(e.touches[0], e.touches[1]);
      initialPinchDistanceRef.current = distance;
      initialZoomRef.current = zoom;
      lastTouchCenterRef.current = getTouchCenter(e.touches[0], e.touches[1]);
      setIsPanning(false);
    }
  }, [offset, zoom, getTouchDistance, getTouchCenter]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();

    if (e.touches.length === 1 && isPanning && !initialPinchDistanceRef.current) {
      // Single touch pan
      const touch = e.touches[0];
      const newOffset = {
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y,
      };
      setOffset(clampOffset(newOffset, zoom));
    } else if (e.touches.length === 2 && initialPinchDistanceRef.current !== null) {
      // Pinch to zoom
      const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
      const scale = currentDistance / initialPinchDistanceRef.current;
      const newZoom = Math.max(0.3, Math.min(2, initialZoomRef.current * scale));

      const currentCenter = getTouchCenter(e.touches[0], e.touches[1]);
      const rect = containerRef.current?.getBoundingClientRect();
      
      if (rect && lastTouchCenterRef.current) {
        // Calculate center position relative to canvas
        const centerX = currentCenter.x - rect.left;
        const centerY = currentCenter.y - rect.top;

        // World position at pinch center
        const worldX = (centerX - offset.x) / zoom;
        const worldY = (centerY - offset.y) / zoom;

        // Keep the same world position under the pinch center after zoom
        const newOffsetX = centerX - worldX * newZoom;
        const newOffsetY = centerY - worldY * newZoom;

        // Also account for pan movement during pinch
        const panDeltaX = currentCenter.x - lastTouchCenterRef.current.x;
        const panDeltaY = currentCenter.y - lastTouchCenterRef.current.y;

        const clampedOffset = clampOffset(
          { x: newOffsetX + panDeltaX, y: newOffsetY + panDeltaY },
          newZoom
        );

        setOffset(clampedOffset);
        setZoom(newZoom);
        lastTouchCenterRef.current = currentCenter;
      }
    }
  }, [isPanning, dragStart, zoom, offset, clampOffset, getTouchDistance, getTouchCenter]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touchStart = touchStartRef.current;
    
    if (e.touches.length === 0) {
      // All fingers lifted
      if (touchStart && e.changedTouches.length === 1) {
        const touch = e.changedTouches[0];
        const deltaX = Math.abs(touch.clientX - touchStart.x);
        const deltaY = Math.abs(touch.clientY - touchStart.y);
        const deltaTime = Date.now() - touchStart.time;

        // Detect tap (short duration, minimal movement)
        if (deltaTime < 300 && deltaX < 10 && deltaY < 10) {
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            const mouseX = (touch.clientX - rect.left) / zoom;
            const mouseY = (touch.clientY - rect.top) / zoom;
            const { gridX, gridY } = screenToGrid(mouseX, mouseY, offset.x / zoom, offset.y / zoom);

            if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
              if (selectedTool === 'select') {
                const origin = findBuildingOrigin(gridX, gridY);
                if (origin) {
                  setSelectedTile({ x: origin.originX, y: origin.originY });
                } else {
                  setSelectedTile({ x: gridX, y: gridY });
                }
              } else {
                placeAtTile(gridX, gridY);
              }
            }
          }
        }
      }

      // Reset all touch state
      setIsPanning(false);
      setIsDragging(false);
      touchStartRef.current = null;
      initialPinchDistanceRef.current = null;
      lastTouchCenterRef.current = null;
    } else if (e.touches.length === 1) {
      // Went from 2 touches to 1 - reset to pan mode
      const touch = e.touches[0];
      setDragStart({ x: touch.clientX - offset.x, y: touch.clientY - offset.y });
      setIsPanning(true);
      initialPinchDistanceRef.current = null;
      lastTouchCenterRef.current = null;
    }
  }, [zoom, offset, gridSize, selectedTool, placeAtTile, setSelectedTile, findBuildingOrigin]);
  
  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden touch-none"
      style={{ 
        cursor: isPanning ? 'grabbing' : isDragging ? 'crosshair' : 'default',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="absolute top-0 left-0"
      />
      <canvas
        ref={carsCanvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="absolute top-0 left-0 pointer-events-none"
      />
      <canvas
        ref={lightingCanvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="absolute top-0 left-0 pointer-events-none"
        style={{ mixBlendMode: 'multiply' }}
      />
      
      {selectedTile && selectedTool === 'select' && (
        <TileInfoPanel
          tile={grid[selectedTile.y][selectedTile.x]}
          services={state.services}
          onClose={() => setSelectedTile(null)}
        />
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
                  You&apos;ve dragged a road to the {cityConnectionDialog.direction} edge of the map. Connect to a nearby city to enable trade.
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
      
      {hoveredTile && selectedTool !== 'select' && TOOL_INFO[selectedTool] && (() => {
        // Check if this is a waterfront building tool and if placement is valid
        const buildingType = (selectedTool as string) as BuildingType;
        const isWaterfrontTool = requiresWaterAdjacency(buildingType);
        let isWaterfrontPlacementInvalid = false;
        
        if (isWaterfrontTool && hoveredTile) {
          const size = getBuildingSize(buildingType);
          const waterCheck = getWaterAdjacency(grid, hoveredTile.x, hoveredTile.y, size.width, size.height, gridSize);
          isWaterfrontPlacementInvalid = !waterCheck.hasWater;
        }
        
        return (
          <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-md text-sm ${
            isWaterfrontPlacementInvalid 
              ? 'bg-destructive/90 border border-destructive-foreground/30 text-destructive-foreground' 
              : 'bg-card/90 border border-border'
          }`}>
            {isDragging && dragStartTile && dragEndTile && showsDragGrid ? (
              <>
                {TOOL_INFO[selectedTool].name} - {Math.abs(dragEndTile.x - dragStartTile.x) + 1}x{Math.abs(dragEndTile.y - dragStartTile.y) + 1} area
                {TOOL_INFO[selectedTool].cost > 0 && ` - $${TOOL_INFO[selectedTool].cost * (Math.abs(dragEndTile.x - dragStartTile.x) + 1) * (Math.abs(dragEndTile.y - dragStartTile.y) + 1)}`}
              </>
            ) : isWaterfrontPlacementInvalid ? (
              <>
                {TOOL_INFO[selectedTool].name} must be placed next to water
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
          className={`h-8 px-3 ${overlayMode === 'water' ? 'bg-blue-500 hover:bg-blue-600' : ''}`}
          title="Water System"
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
          className={`h-8 px-3 ${overlayMode === 'police' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
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
          <HealthIcon size={14} />
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
        
        <Button
          variant={overlayMode === 'subway' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setOverlayMode('subway')}
          className={`h-8 px-3 ${overlayMode === 'subway' ? 'bg-yellow-500 hover:bg-yellow-600' : ''}`}
          title="Subway Coverage"
        >
          <SubwayIcon size={14} />
        </Button>
      </div>
    </Card>
  );
});

export default function Game() {
  const { state, setTool, setActivePanel, addMoney, addNotification } = useGame();
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('none');
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);
  const [navigationTarget, setNavigationTarget] = useState<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState<{ offset: { x: number; y: number }; zoom: number; canvasSize: { width: number; height: number } } | null>(null);
  const isInitialMount = useRef(true);
  const { isMobileDevice, isSmallScreen } = useMobile();
  const isMobile = isMobileDevice || isSmallScreen;
  
  // Cheat code system
  const {
    triggeredCheat,
    showVinnieDialog,
    setShowVinnieDialog,
    clearTriggeredCheat,
  } = useCheatCodes();
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
    
    // Subway tool sets overlay when actively selected (not on page load)
    if (state.selectedTool === 'subway' || state.selectedTool === 'subway_station') {
      setTimeout(() => {
        setOverlayMode('subway');
      }, 0);
      previousSelectedToolRef.current = state.selectedTool;
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
    
    setTimeout(() => {
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
      } else if (state.selectedTool === 'subway_station') {
        setOverlayMode('subway');
      } else {
        setOverlayMode('none');
      }
    }, 0);
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

  // Debug logging for zone growth issues
  useEffect(() => {
    if (!selectedTile) return;
    
    const tile = state.grid[selectedTile.y]?.[selectedTile.x];
    if (!tile) return;
    
    // Only log for zoned tiles
    if (tile.zone === 'none') return;
    
    const { x, y } = selectedTile;
    const gridSize = state.gridSize;
    const grid = state.grid;
    const services = state.services;
    
    // Check all growth conditions
    const hasPower = services.power[y]?.[x] ?? false;
    const hasWater = services.water[y]?.[x] ?? false;
    const buildingType = tile.building.type;
    const isEmptyZone = buildingType === 'grass';
    const isMultiTilePlaceholder = buildingType === 'empty';
    
    // Building sizes for multi-tile buildings (must match simulation.ts)
    const BUILDING_SIZES: Record<string, { width: number; height: number }> = {
      stadium: { width: 4, height: 4 },
      airport: { width: 4, height: 4 },
      amusement_park: { width: 4, height: 4 },
      university: { width: 3, height: 3 },
      hospital: { width: 3, height: 3 },
      power_plant: { width: 2, height: 2 },
      space_program: { width: 3, height: 3 },
      park_large: { width: 3, height: 3 },
      mansion: { width: 2, height: 2 },
      apartment_low: { width: 2, height: 2 },
      apartment_high: { width: 2, height: 2 },
      office_low: { width: 2, height: 2 },
      office_high: { width: 2, height: 2 },
      mall: { width: 3, height: 3 },
      factory_medium: { width: 2, height: 2 },
      factory_large: { width: 3, height: 3 },
      warehouse: { width: 2, height: 2 },
      city_hall: { width: 2, height: 2 },
      // Parks (new sprite sheet)
      playground_large: { width: 2, height: 2 },
      baseball_field_small: { width: 2, height: 2 },
      football_field: { width: 2, height: 2 },
      baseball_stadium: { width: 3, height: 3 },
      mini_golf_course: { width: 2, height: 2 },
      go_kart_track: { width: 2, height: 2 },
      amphitheater: { width: 2, height: 2 },
      greenhouse_garden: { width: 2, height: 2 },
      marina_docks_small: { width: 2, height: 2 },
      roller_coaster_small: { width: 2, height: 2 },
      mountain_lodge: { width: 2, height: 2 },
      mountain_trailhead: { width: 3, height: 3 },
    };
    
    const getBuildingSize = (type: string) => BUILDING_SIZES[type] || { width: 1, height: 1 };
    
    // If this is an 'empty' tile (part of multi-tile building), find the origin
    // Must verify the building's footprint actually covers this tile
    const findOrigin = (): { originX: number; originY: number; buildingType: string; size: { width: number; height: number } } | null => {
      if (!isMultiTilePlaceholder) return null;
      
      // Search nearby tiles to find the origin (up to 4 tiles away for 4x4 buildings)
      for (let dy = 0; dy < 4; dy++) {
        for (let dx = 0; dx < 4; dx++) {
          const checkX = x - dx;
          const checkY = y - dy;
          if (checkX >= 0 && checkY >= 0 && checkX < gridSize && checkY < gridSize) {
            const checkTile = grid[checkY][checkX];
            if (checkTile.building.type !== 'empty' &&
                checkTile.building.type !== 'grass' &&
                checkTile.building.type !== 'water' &&
                checkTile.building.type !== 'road' &&
                checkTile.building.type !== 'tree') {
              const size = getBuildingSize(checkTile.building.type);
              // Verify this building's footprint actually includes our tile
              if (x >= checkX && x < checkX + size.width &&
                  y >= checkY && y < checkY + size.height) {
                return { originX: checkX, originY: checkY, buildingType: checkTile.building.type, size };
              }
            }
          }
        }
      }
      return null;
    };
    
    // Check road access (simplified version of hasRoadAccess from simulation.ts)
    const checkRoadAccess = (): { hasAccess: boolean; reason: string } => {
      const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      const visited = new Set<string>();
      const queue: { x: number; y: number; dist: number }[] = [{ x, y, dist: 0 }];
      visited.add(`${x},${y}`);
      const maxDistance = 8;
      const startZone = tile.zone;
      
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current.dist >= maxDistance) continue;
        
        for (const [dx, dy] of directions) {
          const nx = current.x + dx;
          const ny = current.y + dy;
          const key = `${nx},${ny}`;
          
          if (visited.has(key)) continue;
          if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) continue;
          
          visited.add(key);
          const neighbor = grid[ny][nx];
          
          if (neighbor.building.type === 'road') {
            return { hasAccess: true, reason: `Found road at (${nx}, ${ny}), distance ${current.dist + 1}` };
          }
          
          if (neighbor.zone === startZone && 
              (neighbor.building.type === 'grass' || neighbor.building.type === 'tree')) {
            queue.push({ x: nx, y: ny, dist: current.dist + 1 });
          }
        }
      }
      
      return { hasAccess: false, reason: `No road found within ${maxDistance} tiles through same zone` };
    };
    
    // Check if building can spawn (for multi-tile buildings)
    const checkCanSpawn = (): { canSpawn: boolean; reason: string } => {
      if (!isEmptyZone) {
        return { canSpawn: false, reason: 'Tile already has a building' };
      }
      
      // Check for smallest building in zone (1x1)
      // Residential starts with house_small (1x1), commercial with shop_small (1x1), industrial with factory_small (1x1)
      return { canSpawn: true, reason: 'Space available for 1x1 building' };
    };
    
    const roadCheck = checkRoadAccess();
    const spawnCheck = checkCanSpawn();
    
    // Build diagnostic message
    const issues: string[] = [];
    if (!isEmptyZone && !isMultiTilePlaceholder) issues.push(`Has building (${buildingType})`);
    if (!hasPower) issues.push('No power');
    if (!hasWater) issues.push('No water');
    if (!roadCheck.hasAccess) issues.push(`No road access: ${roadCheck.reason}`);
    if (!spawnCheck.canSpawn && isEmptyZone) issues.push(spawnCheck.reason);
    
    console.group(`🏗️ Zone Diagnostic: (${x}, ${y}) - ${tile.zone}`);
    
    // Special handling for 'empty' placeholder tiles
    if (isMultiTilePlaceholder) {
      const origin = findOrigin();
      if (origin) {
        console.log(`✅ This tile is part of a multi-tile building`);
        console.log(`   Origin: (${origin.originX}, ${origin.originY})`);
        console.log(`   Building type: ${origin.buildingType} (${origin.size.width}x${origin.size.height})`);
      } else {
        console.log(`🐛 BUG: ORPHANED 'empty' TILE DETECTED!`);
        console.log(`   This tile has type 'empty' but no valid parent building found.`);
        console.log(`   This prevents new buildings from growing here.`);
        console.log(`   Cause: Likely from partial building demolition, abandonment cleanup, or a bug.`);
        console.log(`   Fix: Bulldoze this tile to reset it to grass.`);
      }
      console.groupEnd();
      return;
    }
    
    console.log(`Building: ${buildingType}${isEmptyZone ? ' (empty zone - can grow)' : ''}`);
    console.log(`Power: ${hasPower ? '✅' : '❌'}`);
    console.log(`Water: ${hasWater ? '✅' : '❌'}`);
    console.log(`Road Access: ${roadCheck.hasAccess ? '✅' : '❌'} - ${roadCheck.reason}`);
    if (isEmptyZone) {
      console.log(`Can Spawn: ${spawnCheck.canSpawn ? '✅' : '❌'} - ${spawnCheck.reason}`);
    }
    
    if (isEmptyZone && issues.length === 0) {
      console.log(`✅ All conditions met! Building should grow (5% chance per tick)`);
    } else if (isEmptyZone) {
      console.log(`❌ Issues preventing growth:`, issues);
    } else {
      console.log(`ℹ️ Tile has existing building - checking evolution conditions`);
      const demand = state.stats.demand;
      const zoneDemand = tile.zone === 'residential' ? demand.residential :
                        tile.zone === 'commercial' ? demand.commercial : demand.industrial;
      console.log(`Zone demand: ${zoneDemand}`);
    }
    console.groupEnd();
  }, [selectedTile, state.grid, state.gridSize, state.services, state.stats.demand]);

  // Handle cheat code triggers
  useEffect(() => {
    if (!triggeredCheat) return;

    switch (triggeredCheat.type) {
      case 'konami':
        addMoney(triggeredCheat.amount);
        addNotification(
          'Retro Cheat Activated!',
          'Your accountants are confused but not complaining. You received $50,000!',
          'trophy'
        );
        clearTriggeredCheat();
        break;

      case 'motherlode':
        addMoney(triggeredCheat.amount);
        addNotification(
          'Motherlode!',
          'You received $50,000. The Sims would be proud!',
          'cash'
        );
        clearTriggeredCheat();
        break;

      case 'fund':
        addMoney(triggeredCheat.amount);
        addNotification(
          'Emergency Funds',
          'You received $10,000 in emergency city funding.',
          'cash'
        );
        clearTriggeredCheat();
        break;

      case 'vinnie':
        // Vinnie dialog is handled by VinnieDialog component
        clearTriggeredCheat();
        break;
    }
  }, [triggeredCheat, addMoney, addNotification, clearTriggeredCheat]);

  // Mobile layout
  if (isMobile) {
    return (
      <TooltipProvider>
        <div className="w-full h-full overflow-hidden bg-background flex flex-col">
          {/* Mobile Top Bar */}
          <MobileTopBar />
          
          {/* Main canvas area - fills remaining space, with padding for top/bottom bars */}
          <div className="flex-1 relative overflow-hidden" style={{ paddingTop: '72px', paddingBottom: '76px' }}>
            <CanvasIsometricGrid 
              overlayMode={overlayMode} 
              selectedTile={selectedTile} 
              setSelectedTile={setSelectedTile}
              isMobile={true}
            />
            
            {/* Compact overlay toggle for mobile */}
            <Card className="absolute top-2 right-2 p-1.5 shadow-lg bg-card/90 border-border/70 z-30">
              <div className="flex gap-1">
                <Button
                  variant={overlayMode === 'none' ? 'default' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setOverlayMode('none')}
                >
                  <CloseIcon size={14} />
                </Button>
                <Button
                  variant={overlayMode === 'power' ? 'default' : 'ghost'}
                  size="icon"
                  className={`h-8 w-8 ${overlayMode === 'power' ? 'bg-amber-500 hover:bg-amber-600' : ''}`}
                  onClick={() => setOverlayMode('power')}
                >
                  <PowerIcon size={14} />
                </Button>
                <Button
                  variant={overlayMode === 'water' ? 'default' : 'ghost'}
                  size="icon"
                  className={`h-8 w-8 ${overlayMode === 'water' ? 'bg-blue-500 hover:bg-blue-600' : ''}`}
                  onClick={() => setOverlayMode('water')}
                >
                  <WaterIcon size={14} />
                </Button>
                <Button
                  variant={overlayMode === 'fire' ? 'default' : 'ghost'}
                  size="icon"
                  className={`h-8 w-8 ${overlayMode === 'fire' ? 'bg-red-500 hover:bg-red-600' : ''}`}
                  onClick={() => setOverlayMode('fire')}
                >
                  <FireIcon size={14} />
                </Button>
              </div>
            </Card>
          </div>
          
          {/* Mobile Bottom Toolbar */}
          <MobileToolbar onOpenPanel={(panel) => setActivePanel(panel)} />
          
          {/* Panels - render as fullscreen modals on mobile */}
          {state.activePanel === 'budget' && <BudgetPanel />}
          {state.activePanel === 'achievements' && <AchievementsPanel />}
          {state.activePanel === 'statistics' && <StatisticsPanel />}
          {state.activePanel === 'advisors' && <AdvisorsPanel />}
          {state.activePanel === 'settings' && <SettingsPanel />}
          
          <VinnieDialog open={showVinnieDialog} onOpenChange={setShowVinnieDialog} />
        </div>
      </TooltipProvider>
    );
  }

  // Desktop layout
  return (
    <TooltipProvider>
      <div className="w-full h-full min-h-[720px] overflow-hidden bg-background flex">
        <Sidebar />
        
        <div className="flex-1 flex flex-col">
          <TopBar />
          <StatsPanel />
          <div className="flex-1 relative overflow-visible">
            <CanvasIsometricGrid 
              overlayMode={overlayMode} 
              selectedTile={selectedTile} 
              setSelectedTile={setSelectedTile}
              navigationTarget={navigationTarget}
              onNavigationComplete={() => setNavigationTarget(null)}
              onViewportChange={setViewport}
            />
            <OverlayModeToggle overlayMode={overlayMode} setOverlayMode={setOverlayMode} />
            <MiniMap onNavigate={(x, y) => setNavigationTarget({ x, y })} viewport={viewport} />
          </div>
        </div>
        
        {state.activePanel === 'budget' && <BudgetPanel />}
        {state.activePanel === 'achievements' && <AchievementsPanel />}
        {state.activePanel === 'statistics' && <StatisticsPanel />}
        {state.activePanel === 'advisors' && <AdvisorsPanel />}
        {state.activePanel === 'settings' && <SettingsPanel />}
        
        <VinnieDialog open={showVinnieDialog} onOpenChange={setShowVinnieDialog} />
      </div>
    </TooltipProvider>
  );
}
