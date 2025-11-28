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
import { getSpriteCoords, BUILDING_TO_SPRITE, SPRITE_VERTICAL_OFFSETS, SPRITE_HORIZONTAL_OFFSETS, SPRITE_ORDER, SpritePack, getActiveSpritePack } from '@/lib/renderConfig';
import exampleState from '@/resources/example_state.json';
import exampleState2 from '@/resources/example_state_2.json';
import exampleState3 from '@/resources/example_state_3.json';

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
import { CommandMenu } from '@/components/ui/CommandMenu';

// Import extracted game components, types, and utilities
import {
  TILE_WIDTH,
  TILE_HEIGHT,
  KEY_PAN_SPEED,
  Car,
  CarDirection,
  Airplane,
  AirplaneState,
  ContrailParticle,
  Helicopter,
  HelicopterState,
  RotorWashParticle,
  EmergencyVehicle,
  EmergencyVehicleType,
  EmergencyVehicleState,
  Pedestrian,
  PedestrianDestType,
  Boat,
  BoatState,
  WakeParticle,
  TourWaypoint,
  Firework,
  FireworkState,
  FireworkParticle,
  SmogParticle,
  FactorySmog,
  DirectionMeta,
  WorldRenderState,
  OverlayMode,
} from '@/components/game/types';
import {
  CAR_COLORS,
  PEDESTRIAN_SKIN_COLORS,
  PEDESTRIAN_SHIRT_COLORS,
  PEDESTRIAN_MIN_ZOOM,
  AIRPLANE_MIN_POPULATION,
  AIRPLANE_COLORS,
  CONTRAIL_MAX_AGE,
  CONTRAIL_SPAWN_INTERVAL,
  HELICOPTER_MIN_POPULATION,
  HELICOPTER_COLORS,
  ROTOR_WASH_MAX_AGE,
  ROTOR_WASH_SPAWN_INTERVAL,
  BOAT_COLORS,
  BOAT_MIN_ZOOM,
  WAKE_MAX_AGE,
  WAKE_SPAWN_INTERVAL,
  FIREWORK_BUILDINGS,
  FIREWORK_COLORS,
  FIREWORK_PARTICLE_COUNT,
  FIREWORK_PARTICLE_SPEED,
  FIREWORK_PARTICLE_MAX_AGE,
  FIREWORK_LAUNCH_SPEED,
  FIREWORK_SPAWN_INTERVAL_MIN,
  FIREWORK_SPAWN_INTERVAL_MAX,
  FIREWORK_SHOW_DURATION,
  FIREWORK_SHOW_CHANCE,
  SMOG_BUILDINGS,
  SMOG_PARTICLE_MAX_AGE,
  SMOG_PARTICLE_MAX_AGE_MOBILE,
  SMOG_SPAWN_INTERVAL_MEDIUM,
  SMOG_SPAWN_INTERVAL_LARGE,
  SMOG_SPAWN_INTERVAL_MOBILE_MULTIPLIER,
  SMOG_DRIFT_SPEED,
  SMOG_RISE_SPEED,
  SMOG_MAX_ZOOM,
  SMOG_FADE_ZOOM,
  SMOG_BASE_OPACITY,
  SMOG_PARTICLE_SIZE_MIN,
  SMOG_PARTICLE_SIZE_MAX,
  SMOG_PARTICLE_GROWTH,
  SMOG_MAX_PARTICLES_PER_FACTORY,
  SMOG_MAX_PARTICLES_PER_FACTORY_MOBILE,
  DIRECTION_META,
  OPPOSITE_DIRECTION,
} from '@/components/game/constants';
import {
  getOppositeDirection,
  isRoadTile,
  getDirectionOptions,
  pickNextDirection,
  findNearestRoadToBuilding,
  findPathOnRoads,
  getDirectionToTile,
  gridToScreen,
  screenToGrid,
} from '@/components/game/utils';
import {
  drawGreenBaseTile,
  drawGreyBaseTile,
  drawBeach,
  drawBeachOnWater,
} from '@/components/game/drawing';
import {
  getOverlayFillStyle,
  getOverlayForTool,
} from '@/components/game/overlays';
import { OverlayModeToggle } from '@/components/game/OverlayModeToggle';
import { Sidebar } from '@/components/game/Sidebar';

// HEIGHT_RATIO is still used locally in some places
const HEIGHT_RATIO = 0.60;

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
  const { stats, year, month, day, hour, speed, taxRate, cityName } = state;
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formattedDate = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}-${year}`;
  
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
            <Tooltip>
              <TooltipTrigger asChild>
                <span>{monthNames[month - 1]} {year}</span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{formattedDate}</p>
              </TooltipContent>
            </Tooltip>
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
            max={100}
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

type TrafficLightPhase = 'ns' | 'ew';
type TrafficLightStage = 'green' | 'yellow' | 'red';

type TrafficLightState = {
  tileX: number;
  tileY: number;
  axes: { ns: number; ew: number };
  currentPhase: TrafficLightPhase;
  timer: number;
  nsGreen: number;
  ewGreen: number;
};

const TRAFFIC_LIGHT_YELLOW = 0.85;
const TRAFFIC_LIGHT_ALL_RED = 0.35;

const DIRECTION_TO_AXIS: Record<CarDirection, TrafficLightPhase> = {
  north: 'ns',
  south: 'ns',
  east: 'ew',
  west: 'ew',
};

const getTrafficLightKey = (x: number, y: number) => `${x},${y}`;

const getLightStageForAxis = (light: TrafficLightState, axis: TrafficLightPhase): TrafficLightStage => {
  if (!light.axes[axis]) {
    return 'red';
  }

  if (light.currentPhase !== axis) {
    return 'red';
  }

  const greenDuration = axis === 'ns' ? light.nsGreen : light.ewGreen;
  if (light.timer < greenDuration) {
    return 'green';
  }
  if (light.timer < greenDuration + TRAFFIC_LIGHT_YELLOW) {
    return 'yellow';
  }
  return 'red';
};

const getAxisColor = (light: TrafficLightState, axis: TrafficLightPhase): string | null => {
  if (!light.axes[axis]) {
    return null;
  }
  const stage = getLightStageForAxis(light, axis);
  if (stage === 'green') return '#22c55e';
  if (stage === 'yellow') return '#facc15';
  return '#dc2626';
};

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

// Canvas-based Minimap - Memoized with throttled grid rendering
const MiniMap = React.memo(function MiniMap({ onNavigate, viewport }: { 
  onNavigate?: (gridX: number, gridY: number) => void;
  viewport?: { offset: { x: number; y: number }; zoom: number; canvasSize: { width: number; height: number } } | null;
}) {
  const { state } = useGame();
  const { grid, gridSize, tick } = state;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridImageRef = useRef<ImageData | null>(null);
  const lastGridRenderTickRef = useRef(-1);
  
  // Pre-compute color map for faster lookups
  const serviceBuildings = useMemo(() => new Set([
    'police_station', 'fire_station', 'hospital', 'school', 'university'
  ]), []);
  
  const parkBuildings = useMemo(() => new Set([
    'park', 'park_large', 'tennis', 'basketball_courts', 'playground_small', 
    'playground_large', 'baseball_field_small', 'soccer_field_small', 'football_field', 
    'baseball_stadium', 'community_center', 'swimming_pool', 'skate_park', 
    'mini_golf_course', 'bleachers_field', 'go_kart_track', 'amphitheater', 
    'greenhouse_garden', 'animal_pens_farm', 'cabin_house', 'campground',
    'marina_docks_small', 'pier_large', 'roller_coaster_small', 'community_garden',
    'pond_park', 'park_gate', 'mountain_lodge', 'mountain_trailhead', 'office_building_small'
  ]), []);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const size = 140;
    const scale = size / gridSize;
    
    // Only re-render grid portion every 10 ticks (or on first render)
    // This significantly reduces CPU usage while keeping minimap responsive
    const shouldRenderGrid = lastGridRenderTickRef.current === -1 || 
                             tick - lastGridRenderTickRef.current >= 10;
    
    if (shouldRenderGrid) {
      lastGridRenderTickRef.current = tick;
      
      ctx.fillStyle = '#0b1723';
      ctx.fillRect(0, 0, size, size);
      
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const tile = grid[y][x];
          const buildingType = tile.building.type;
          let color = '#2d5a3d';
          
          // Prioritized color checks using Set for common cases
          if (buildingType === 'water') color = '#0ea5e9';
          else if (buildingType === 'road') color = '#6b7280';
          else if (buildingType === 'tree') color = '#166534';
          else if (tile.building.onFire) color = '#ef4444';
          else if (tile.zone === 'residential' && buildingType !== 'grass') color = '#22c55e';
          else if (tile.zone === 'residential') color = '#14532d';
          else if (tile.zone === 'commercial' && buildingType !== 'grass') color = '#38bdf8';
          else if (tile.zone === 'commercial') color = '#1d4ed8';
          else if (tile.zone === 'industrial' && buildingType !== 'grass') color = '#f59e0b';
          else if (tile.zone === 'industrial') color = '#b45309';
          else if (serviceBuildings.has(buildingType)) color = '#c084fc';
          else if (buildingType === 'power_plant') color = '#f97316';
          else if (buildingType === 'water_tower') color = '#06b6d4';
          else if (parkBuildings.has(buildingType)) color = '#84cc16';
          
          ctx.fillStyle = color;
          ctx.fillRect(x * scale, y * scale, Math.ceil(scale), Math.ceil(scale));
        }
      }
      
      // Save the grid portion for quick viewport-only updates
      gridImageRef.current = ctx.getImageData(0, 0, size, size);
    } else if (gridImageRef.current) {
      // Restore cached grid image, then just draw viewport
      ctx.putImageData(gridImageRef.current, 0, 0);
    }
    
    // Draw viewport rectangle (always updated)
    if (viewport) {
      const { offset, zoom, canvasSize } = viewport;
      
      const screenToGridForMinimap = (screenX: number, screenY: number) => {
        const adjustedX = (screenX - offset.x) / zoom;
        const adjustedY = (screenY - offset.y) / zoom;
        const gridX = (adjustedX / (TILE_WIDTH / 2) + adjustedY / (TILE_HEIGHT / 2)) / 2;
        const gridY = (adjustedY / (TILE_HEIGHT / 2) - adjustedX / (TILE_WIDTH / 2)) / 2;
        return { gridX, gridY };
      };
      
      const topLeft = screenToGridForMinimap(0, 0);
      const topRight = screenToGridForMinimap(canvasSize.width, 0);
      const bottomLeft = screenToGridForMinimap(0, canvasSize.height);
      const bottomRight = screenToGridForMinimap(canvasSize.width, canvasSize.height);
      
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
  }, [grid, gridSize, viewport, tick, serviceBuildings, parkBuildings]);

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
  onClose,
  isMobile = false
}: { 
  tile: Tile; 
  services: { police: number[][]; fire: number[][]; health: number[][]; education: number[][]; power: boolean[][]; water: boolean[][] };
  onClose: () => void;
  isMobile?: boolean;
}) {
  const { x, y } = tile;
  
  return (
    <Card className={`${isMobile ? 'fixed left-0 right-0 w-full rounded-none border-x-0 border-t border-b z-30' : 'absolute top-4 right-4 w-72'}`} style={isMobile ? { top: 'calc(72px + env(safe-area-inset-top, 0px))' } : undefined}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-sans">Tile ({x}, {y})</CardTitle>
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
              <div className="text-muted-foreground text-xs mb-1">Weekly</div>
              <div className={`font-mono tabular-nums font-semibold ${stats.income - stats.expenses >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${Math.floor((stats.income - stats.expenses) / 4).toLocaleString()}
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
            <Button
              variant="outline"
              className="w-full mt-2"
              onClick={() => {
                loadState(JSON.stringify(exampleState2));
                setActivePanel('none');
              }}
            >
              Load Example State 2
            </Button>
            <Button
              variant="outline"
              className="w-full mt-2"
              onClick={() => {
                loadState(JSON.stringify(exampleState3));
                setActivePanel('none');
              }}
            >
              Load Example State 3
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
const COLOR_THRESHOLD = 155; // Adjust this value to be more/less aggressive (increased from 10 for better filtering)

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

// Image cache for building sprites
const imageCache = new Map<string, HTMLImageElement>();

// Event emitter for image loading progress (to trigger re-renders)
type ImageLoadCallback = () => void;
const imageLoadCallbacks = new Set<ImageLoadCallback>();

function onImageLoaded(callback: ImageLoadCallback): () => void {
  imageLoadCallbacks.add(callback);
  return () => { imageLoadCallbacks.delete(callback); };
}

function notifyImageLoaded() {
  imageLoadCallbacks.forEach(cb => cb());
}

function loadImage(src: string): Promise<HTMLImageElement> {
  if (imageCache.has(src)) {
    return Promise.resolve(imageCache.get(src)!);
  }
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(src, img);
      notifyImageLoaded(); // Notify listeners that a new image is available
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

// ============================================================================
// PLACEHOLDER BUILDING COLORS
// ============================================================================
// Colors for rendering buildings before sprites are loaded
// Based on zone/category for visual consistency

const PLACEHOLDER_COLORS: Record<string, { top: string; left: string; right: string; height: number }> = {
  // Residential - greens
  house_small: { top: '#4ade80', left: '#22c55e', right: '#86efac', height: 0.6 },
  house_medium: { top: '#4ade80', left: '#22c55e', right: '#86efac', height: 0.8 },
  mansion: { top: '#22c55e', left: '#16a34a', right: '#4ade80', height: 1.0 },
  apartment_low: { top: '#22c55e', left: '#16a34a', right: '#4ade80', height: 1.2 },
  apartment_high: { top: '#16a34a', left: '#15803d', right: '#22c55e', height: 1.8 },
  // Commercial - blues
  shop_small: { top: '#60a5fa', left: '#3b82f6', right: '#93c5fd', height: 0.5 },
  shop_medium: { top: '#60a5fa', left: '#3b82f6', right: '#93c5fd', height: 0.7 },
  office_low: { top: '#3b82f6', left: '#2563eb', right: '#60a5fa', height: 1.3 },
  office_high: { top: '#2563eb', left: '#1d4ed8', right: '#3b82f6', height: 2.0 },
  mall: { top: '#1d4ed8', left: '#1e40af', right: '#2563eb', height: 1.0 },
  // Industrial - oranges/ambers
  factory_small: { top: '#fbbf24', left: '#f59e0b', right: '#fcd34d', height: 0.6 },
  factory_medium: { top: '#f59e0b', left: '#d97706', right: '#fbbf24', height: 0.9 },
  factory_large: { top: '#d97706', left: '#b45309', right: '#f59e0b', height: 1.2 },
  warehouse: { top: '#fbbf24', left: '#f59e0b', right: '#fcd34d', height: 0.7 },
  // Services - purples/pinks
  police_station: { top: '#818cf8', left: '#6366f1', right: '#a5b4fc', height: 0.8 },
  fire_station: { top: '#f87171', left: '#ef4444', right: '#fca5a5', height: 0.8 },
  hospital: { top: '#f472b6', left: '#ec4899', right: '#f9a8d4', height: 1.2 },
  school: { top: '#c084fc', left: '#a855f7', right: '#d8b4fe', height: 0.8 },
  university: { top: '#a855f7', left: '#9333ea', right: '#c084fc', height: 1.0 },
  // Parks - teals
  park: { top: '#2dd4bf', left: '#14b8a6', right: '#5eead4', height: 0.2 },
  park_large: { top: '#14b8a6', left: '#0d9488', right: '#2dd4bf', height: 0.3 },
  tennis: { top: '#5eead4', left: '#2dd4bf', right: '#99f6e4', height: 0.2 },
  tree: { top: '#22c55e', left: '#16a34a', right: '#4ade80', height: 0.5 },
  // Utilities - grays
  power_plant: { top: '#9ca3af', left: '#6b7280', right: '#d1d5db', height: 1.0 },
  water_tower: { top: '#60a5fa', left: '#3b82f6', right: '#93c5fd', height: 1.4 },
  subway_station: { top: '#6b7280', left: '#4b5563', right: '#9ca3af', height: 0.5 },
  // Special - golds
  stadium: { top: '#fbbf24', left: '#f59e0b', right: '#fcd34d', height: 0.8 },
  museum: { top: '#e879f9', left: '#d946ef', right: '#f0abfc', height: 0.9 },
  airport: { top: '#9ca3af', left: '#6b7280', right: '#d1d5db', height: 0.4 },
  space_program: { top: '#f1f5f9', left: '#e2e8f0', right: '#f8fafc', height: 1.5 },
  city_hall: { top: '#fbbf24', left: '#f59e0b', right: '#fcd34d', height: 1.2 },
  amusement_park: { top: '#fb7185', left: '#f43f5e', right: '#fda4af', height: 0.8 },
  // Default for unknown/park buildings
  default: { top: '#9ca3af', left: '#6b7280', right: '#d1d5db', height: 0.6 },
};

/**
 * Draw a placeholder isometric building box when sprites aren't loaded yet.
 * Uses simple colored 3D boxes that match the zone/category.
 */
function drawPlaceholderBuilding(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  buildingType: string,
  tileWidth: number,
  tileHeight: number
): void {
  const colors = PLACEHOLDER_COLORS[buildingType] || PLACEHOLDER_COLORS.default;
  const boxHeight = tileHeight * colors.height;
  
  const w = tileWidth;
  const h = tileHeight;
  const cx = x + w / 2;
  const topY = y - boxHeight;
  
  // Draw left face (darker)
  ctx.fillStyle = colors.left;
  ctx.beginPath();
  ctx.moveTo(x, y + h / 2);
  ctx.lineTo(cx, y + h);
  ctx.lineTo(cx, topY + h);
  ctx.lineTo(x, topY + h / 2);
  ctx.closePath();
  ctx.fill();
  
  // Draw right face (lighter)
  ctx.fillStyle = colors.right;
  ctx.beginPath();
  ctx.moveTo(x + w, y + h / 2);
  ctx.lineTo(cx, y + h);
  ctx.lineTo(cx, topY + h);
  ctx.lineTo(x + w, topY + h / 2);
  ctx.closePath();
  ctx.fill();
  
  // Draw top face
  ctx.fillStyle = colors.top;
  ctx.beginPath();
  ctx.moveTo(cx, topY);
  ctx.lineTo(x + w, topY + h / 2);
  ctx.lineTo(cx, topY + h);
  ctx.lineTo(x, topY + h / 2);
  ctx.closePath();
  ctx.fill();
  
  // Add subtle edge lines
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(cx, topY);
  ctx.lineTo(x + w, topY + h / 2);
  ctx.lineTo(cx, topY + h);
  ctx.lineTo(x, topY + h / 2);
  ctx.closePath();
  ctx.stroke();
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
  const [hoveredIncident, setHoveredIncident] = useState<{
    x: number;
    y: number;
    type: 'fire' | 'crime';
    crimeType?: 'robbery' | 'burglary' | 'disturbance' | 'traffic';
    screenX: number;
    screenY: number;
  } | null>(null);
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
  const trafficLightsRef = useRef<Map<string, TrafficLightState>>(new Map());
  
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

  // Helicopter system refs
  const helicoptersRef = useRef<Helicopter[]>([]);
  const helicopterIdRef = useRef(0);
  const helicopterSpawnTimerRef = useRef(0);

  // Boat system refs
  const boatsRef = useRef<Boat[]>([]);
  const boatIdRef = useRef(0);
  const boatSpawnTimerRef = useRef(0);

  // Navigation light flash timer for planes/helicopters/boats at night
  const navLightFlashTimerRef = useRef(0);

  // Firework system refs
  const fireworksRef = useRef<Firework[]>([]);
  const fireworkIdRef = useRef(0);
  const fireworkSpawnTimerRef = useRef(0);
  const fireworkShowActiveRef = useRef(false);
  const fireworkShowStartTimeRef = useRef(0);
  const fireworkLastHourRef = useRef(-1); // Track hour changes to detect night transitions

  // Factory smog system refs
  const factorySmogRef = useRef<FactorySmog[]>([]);
  const smogLastGridVersionRef = useRef(-1); // Track when to rebuild factory list

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
  // Track progressive image loading - start true to render immediately with placeholders
  const [imagesLoaded, setImagesLoaded] = useState(true);
  // Counter to trigger re-renders when new images become available
  const [imageLoadVersion, setImageLoadVersion] = useState(0);
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
    if (!grid || gridSize <= 0) {
      trafficLightsRef.current = new Map();
      return;
    }

    const newLights = new Map<string, TrafficLightState>();
    const hasRoadAt = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
      return grid[y][x].building.type === 'road';
    };

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        if (!hasRoadAt(x, y)) continue;
        const north = hasRoadAt(x - 1, y);
        const east = hasRoadAt(x, y - 1);
        const south = hasRoadAt(x + 1, y);
        const west = hasRoadAt(x, y + 1);
        const axisNS = (north ? 1 : 0) + (south ? 1 : 0);
        const axisEW = (east ? 1 : 0) + (west ? 1 : 0);
        const connectionCount = axisNS + axisEW;

        if (connectionCount >= 3 && axisNS > 0 && axisEW > 0) {
          const nsGreen = 3.2 + axisNS * 0.45;
          const ewGreen = 3.2 + axisEW * 0.45;
          const startingPhase: TrafficLightPhase = axisNS >= axisEW ? 'ns' : 'ew';
          const cycle =
            (startingPhase === 'ns' ? nsGreen : ewGreen) + TRAFFIC_LIGHT_YELLOW + TRAFFIC_LIGHT_ALL_RED;

          newLights.set(getTrafficLightKey(x, y), {
            tileX: x,
            tileY: y,
            axes: { ns: axisNS, ew: axisEW },
            currentPhase: startingPhase,
            timer: Math.random() * cycle,
            nsGreen,
            ewGreen,
          });
        }
      }
    }

    trafficLightsRef.current = newLights;
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
        waitingForLight: false,
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
    const lightDelta = delta * speedMultiplier;

    if (lightDelta > 0) {
      trafficLightsRef.current.forEach((light) => {
        const activeGreen = light.currentPhase === 'ns' ? light.nsGreen : light.ewGreen;
        const activeCycle = activeGreen + TRAFFIC_LIGHT_YELLOW + TRAFFIC_LIGHT_ALL_RED;
        light.timer += lightDelta;
        if (light.timer >= activeCycle) {
          light.timer -= activeCycle;
          if (light.axes.ns > 0 && light.axes.ew > 0) {
            light.currentPhase = light.currentPhase === 'ns' ? 'ew' : 'ns';
          } else {
            // Single-axis intersections get stuck green
            light.timer = Math.min(light.timer, activeGreen * 0.5);
          }
        }
      });
    }

    const shouldStopForTrafficLight = (nextX: number, nextY: number, direction: CarDirection): boolean => {
      const light = trafficLightsRef.current.get(getTrafficLightKey(nextX, nextY));
      if (!light) return false;
      const axis = DIRECTION_TO_AXIS[direction];
      if (!light.axes[axis]) return false;
      const stage = getLightStageForAxis(light, axis);
      return stage !== 'green';
    };
    
    // Reduce max cars on mobile for better performance
    const baseMaxCars = 160;
    const maxCars = Math.min(baseMaxCars, Math.max(16, Math.floor(currentGridSize * (2))));
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
      if (car.waitingForLight === undefined) {
        car.waitingForLight = false;
      }
      
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
        const nextX = car.tileX + meta.step.x;
        const nextY = car.tileY + meta.step.y;

        if (shouldStopForTrafficLight(nextX, nextY, car.direction)) {
          car.waitingForLight = true;
          car.progress = Math.min(car.progress, 0.98);
          break;
        }

        if (!isRoadTile(currentGrid, currentGridSize, nextX, nextY)) {
          alive = false;
          break;
        }

        car.tileX = nextX;
        car.tileY = nextY;
        car.waitingForLight = false;
        
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
  }, [spawnRandomCar, isMobile]);

  // Update pedestrians - only when zoomed in enough
  const updatePedestrians = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed, zoom: currentZoom } = worldStateRef.current;
    
    // Clear pedestrians if zoomed out (mobile requires higher zoom level)
    const minZoomForPedestrians = isMobile ? 0.8 : PEDESTRIAN_MIN_ZOOM;
    if (currentZoom < minZoomForPedestrians) {
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
    
    // Spawn pedestrians - scale with road network size, reduced on mobile
    // Mobile: max 50 pedestrians, 0.8 per road tile
    // Desktop: max 200+ pedestrians, 3 per road tile
    const maxPedestrians = isMobile 
      ? Math.min(50, Math.max(20, Math.floor(roadTileCount * 0.8)))
      : Math.max(200, roadTileCount * 3);
    pedestrianSpawnTimerRef.current -= delta;
    if (pedestriansRef.current.length < maxPedestrians && pedestrianSpawnTimerRef.current <= 0) {
      // Spawn fewer pedestrians at once on mobile
      let spawnedCount = 0;
      const spawnBatch = isMobile 
        ? Math.min(8, Math.max(3, Math.floor(roadTileCount / 25)))
        : Math.min(50, Math.max(20, Math.floor(roadTileCount / 10)));
      for (let i = 0; i < spawnBatch; i++) {
        if (spawnPedestrian()) {
          spawnedCount++;
        }
      }
      // Slower spawn rate on mobile
      pedestrianSpawnTimerRef.current = spawnedCount > 0 ? (isMobile ? 0.15 : 0.02) : (isMobile ? 0.08 : 0.01);
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
      
      // Handle case where pedestrian is already at the last tile with progress >= 1
      // (can happen when spawned at end of path, or if progress accumulates)
      if (alive && ped.progress >= 1 && ped.pathIndex >= ped.path.length - 1) {
        if (!ped.returningHome) {
          // Arrived at destination - start returning home
          ped.returningHome = true;
          const returnPath = findPathOnRoads(currentGrid, currentGridSize, ped.destX, ped.destY, ped.homeX, ped.homeY);
          if (returnPath && returnPath.length > 0) {
            ped.path = returnPath;
            ped.pathIndex = 0;
            ped.progress = 0;
            ped.tileX = returnPath[0].x;
            ped.tileY = returnPath[0].y;
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
      }
      
      if (alive) {
        updatedPedestrians.push(ped);
      }
    }
    
    pedestriansRef.current = updatedPedestrians;
  }, [spawnPedestrian, isMobile]);

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

    const drawIntersectionLights = () => {
      trafficLightsRef.current.forEach((light) => {
        const { screenX, screenY } = gridToScreen(light.tileX, light.tileY, 0, 0);
        const centerX = screenX + TILE_WIDTH / 2;
        const centerY = screenY + TILE_HEIGHT / 2;

        if (
          centerX < viewLeft - 80 ||
          centerX > viewRight + 80 ||
          centerY < viewTop - 120 ||
          centerY > viewBottom + 120
        ) {
          return;
        }

        const corners = {
          top: { x: screenX + TILE_WIDTH / 2, y: screenY },
          right: { x: screenX + TILE_WIDTH, y: screenY + TILE_HEIGHT / 2 },
          bottom: { x: screenX + TILE_WIDTH / 2, y: screenY + TILE_HEIGHT },
          left: { x: screenX, y: screenY + TILE_HEIGHT / 2 },
        };

        const drawLight = (corner: { x: number; y: number }, axis: TrafficLightPhase) => {
          const color = getAxisColor(light, axis);
          if (!color) return;
          const poleX = (corner.x * 2 + centerX) / 3;
          const poleY = (corner.y * 2 + centerY) / 3;
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(poleX - 1.4, poleY - 7, 2.8, 7);
          ctx.fillStyle = '#475569';
          ctx.fillRect(poleX - 2.4, poleY - 10, 4.8, 3.5);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(poleX, poleY - 11.5, 2, 0, Math.PI * 2);
          ctx.fill();
        };

        drawLight(corners.right, 'ns');
        drawLight(corners.left, 'ns');
        drawLight(corners.top, 'ew');
        drawLight(corners.bottom, 'ew');
      });
    };

    drawIntersectionLights();
    
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
      
      if (car.waitingForLight) {
        ctx.fillStyle = '#f87171';
        ctx.fillRect(-11 * scale, -3 * scale, 2 * scale, 2.6 * scale);
        ctx.fillRect(-11 * scale, 0.4 * scale, 2 * scale, 2.6 * scale);
      }

      ctx.restore();
    });
    
    ctx.restore();
  }, []);

  // Draw pedestrians with simple SVG-style sprites
  const drawPedestrians = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    
    // Don't draw pedestrians if zoomed out (mobile requires higher zoom)
    const minZoomForPedestrians = isMobile ? 0.8 : PEDESTRIAN_MIN_ZOOM;
    if (currentZoom < minZoomForPedestrians) {
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
  }, [isMobile]);

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

  // Find all heliports (hospitals, airports, police stations, and non-dense malls) in the city
  const findHeliports = useCallback((): { x: number; y: number; type: 'hospital' | 'airport' | 'police' | 'mall'; size: number }[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return [];
    
    const heliports: { x: number; y: number; type: 'hospital' | 'airport' | 'police' | 'mall'; size: number }[] = [];
    for (let y = 0; y < currentGridSize; y++) {
      for (let x = 0; x < currentGridSize; x++) {
        const buildingType = currentGrid[y][x].building.type;
        if (buildingType === 'hospital') {
          heliports.push({ x, y, type: 'hospital', size: 2 }); // Hospital is 2x2
        } else if (buildingType === 'airport') {
          heliports.push({ x, y, type: 'airport', size: 4 }); // Airport is 4x4
        } else if (buildingType === 'police_station') {
          heliports.push({ x, y, type: 'police', size: 1 }); // Police station is 1x1
        } else if (buildingType === 'mall') {
          // Only malls using the basic commercial sprite (not dense variants) can have heliports
          // Dense variants are selected when seed < 50, so we want seed >= 50 (non-dense)
          const seed = (x * 31 + y * 17) % 100;
          if (seed >= 50) {
            heliports.push({ x, y, type: 'mall', size: 3 }); // Mall is 3x3
          }
        }
      }
    }
    return heliports;
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

  // Find all connected water tiles from a starting water tile using BFS
  // Returns array of water tile coordinates belonging to the same body of water
  const findConnectedWaterTiles = useCallback((startTileX: number, startTileY: number, maxTiles: number = 200): { x: number; y: number }[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return [];
    
    const visited = new Set<string>();
    const waterTiles: { x: number; y: number }[] = [];
    const queue: { x: number; y: number }[] = [{ x: startTileX, y: startTileY }];
    
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]; // 4-directional for cleaner water bodies
    
    while (queue.length > 0 && waterTiles.length < maxTiles) {
      const { x, y } = queue.shift()!;
      const key = `${x},${y}`;
      
      if (visited.has(key)) continue;
      visited.add(key);
      
      if (x < 0 || x >= currentGridSize || y < 0 || y >= currentGridSize) continue;
      if (currentGrid[y][x].building.type !== 'water') continue;
      
      waterTiles.push({ x, y });
      
      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        if (!visited.has(`${nx},${ny}`)) {
          queue.push({ x: nx, y: ny });
        }
      }
    }
    
    return waterTiles;
  }, []);

  // Generate random tour waypoints within a body of water
  // Creates a scenic tour route that explores the water body
  const generateTourWaypoints = useCallback((startTileX: number, startTileY: number): TourWaypoint[] => {
    // Find all water tiles connected to the starting point
    const waterTiles = findConnectedWaterTiles(startTileX, startTileY);
    
    if (waterTiles.length < 3) return []; // Too small for a tour
    
    // Determine number of waypoints based on body of water size (2-6 waypoints)
    const numWaypoints = Math.min(6, Math.max(2, Math.floor(waterTiles.length / 10)));
    
    // Spread waypoints across the water body
    // We'll pick tiles that are spread out from each other
    const waypoints: TourWaypoint[] = [];
    const usedIndices = new Set<number>();
    
    // First, try to pick tiles at the edges/corners of the water body for a better tour
    // Sort water tiles by distance from center to get outer tiles first
    const centerX = waterTiles.reduce((sum, t) => sum + t.x, 0) / waterTiles.length;
    const centerY = waterTiles.reduce((sum, t) => sum + t.y, 0) / waterTiles.length;
    
    const tilesWithDist = waterTiles.map((tile, idx) => ({
      ...tile,
      idx,
      distFromCenter: Math.hypot(tile.x - centerX, tile.y - centerY)
    }));
    
    // Sort by distance from center (outer tiles first), but add randomness
    tilesWithDist.sort((a, b) => (b.distFromCenter - a.distFromCenter) + (Math.random() - 0.5) * 3);
    
    for (let i = 0; i < numWaypoints && i < tilesWithDist.length; i++) {
      const tile = tilesWithDist[i];
      
      // Check that this waypoint is reasonably far from previous ones
      let tooClose = false;
      for (const wp of waypoints) {
        const dist = Math.hypot(tile.x - wp.tileX, tile.y - wp.tileY);
        if (dist < 3) { // Minimum distance between waypoints
          tooClose = true;
          break;
        }
      }
      
      if (!tooClose) {
        const { screenX, screenY } = gridToScreen(tile.x, tile.y, 0, 0);
        waypoints.push({
          screenX: screenX + TILE_WIDTH / 2,
          screenY: screenY + TILE_HEIGHT / 2,
          tileX: tile.x,
          tileY: tile.y
        });
        usedIndices.add(tile.idx);
      }
    }
    
    // If we didn't get enough waypoints, add some random ones
    while (waypoints.length < numWaypoints && waypoints.length < waterTiles.length) {
      const randomIdx = Math.floor(Math.random() * waterTiles.length);
      if (!usedIndices.has(randomIdx)) {
        const tile = waterTiles[randomIdx];
        const { screenX, screenY } = gridToScreen(tile.x, tile.y, 0, 0);
        waypoints.push({
          screenX: screenX + TILE_WIDTH / 2,
          screenY: screenY + TILE_HEIGHT / 2,
          tileX: tile.x,
          tileY: tile.y
        });
        usedIndices.add(randomIdx);
      }
    }
    
    return waypoints;
  }, [findConnectedWaterTiles]);

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
      // Update contrail particles - shorter duration on mobile for performance
      const contrailMaxAge = isMobile ? 0.8 : CONTRAIL_MAX_AGE;
      const contrailSpawnInterval = isMobile ? 0.06 : CONTRAIL_SPAWN_INTERVAL;
      plane.contrail = plane.contrail
        .map(p => ({ ...p, age: p.age + delta, opacity: Math.max(0, 1 - p.age / contrailMaxAge) }))
        .filter(p => p.age < contrailMaxAge);
      
      // Add new contrail particles at high altitude (less frequent on mobile)
      if (plane.altitude > 0.7) {
        plane.stateProgress += delta;
        if (plane.stateProgress >= contrailSpawnInterval) {
          plane.stateProgress -= contrailSpawnInterval;
          // Add two contrail particles (left and right engine) - single particle on mobile
          const perpAngle = plane.angle + Math.PI / 2;
          const engineOffset = 4 * (0.5 + plane.altitude * 0.5);
          if (isMobile) {
            // Single centered contrail particle on mobile
            plane.contrail.push({ x: plane.x, y: plane.y, age: 0, opacity: 1 });
          } else {
            plane.contrail.push(
              { x: plane.x + Math.cos(perpAngle) * engineOffset, y: plane.y + Math.sin(perpAngle) * engineOffset, age: 0, opacity: 1 },
              { x: plane.x - Math.cos(perpAngle) * engineOffset, y: plane.y - Math.sin(perpAngle) * engineOffset, age: 0, opacity: 1 }
            );
          }
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
  }, [findAirports, isMobile]);

  // Update helicopters - spawn, move between hospitals/airports, and manage lifecycle
  const updateHelicopters = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;
    
    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
      return;
    }

    // Find heliports
    const heliports = findHeliports();
    
    // Get cached population count
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

    // No helicopters if fewer than 2 heliports or insufficient population
    if (heliports.length < 2 || totalPopulation < HELICOPTER_MIN_POPULATION) {
      helicoptersRef.current = [];
      return;
    }

    // Calculate max helicopters based on heliports and population (1 per 1k population, min 6, max 60)
    // Also scale with number of heliports available
    const populationBased = Math.floor(totalPopulation / 1000);
    const heliportBased = Math.floor(heliports.length * 2.5);
    const maxHelicopters = Math.min(60, Math.max(6, Math.min(populationBased, heliportBased)));
    
    // Speed multiplier based on game speed
    const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 1.5 : 2;

    // Spawn timer
    helicopterSpawnTimerRef.current -= delta;
    if (helicoptersRef.current.length < maxHelicopters && helicopterSpawnTimerRef.current <= 0) {
      // Pick a random origin heliport
      const originIndex = Math.floor(Math.random() * heliports.length);
      const origin = heliports[originIndex];
      
      // Pick a different destination heliport
      const otherHeliports = heliports.filter((_, i) => i !== originIndex);
      if (otherHeliports.length > 0) {
        const dest = otherHeliports[Math.floor(Math.random() * otherHeliports.length)];
        
        // Convert origin tile to screen coordinates
        const { screenX: originScreenX, screenY: originScreenY } = gridToScreen(origin.x, origin.y, 0, 0);
        const originCenterX = originScreenX + TILE_WIDTH * origin.size / 2;
        const originCenterY = originScreenY + TILE_HEIGHT * origin.size / 2;
        
        // Convert destination tile to screen coordinates
        const { screenX: destScreenX, screenY: destScreenY } = gridToScreen(dest.x, dest.y, 0, 0);
        const destCenterX = destScreenX + TILE_WIDTH * dest.size / 2;
        const destCenterY = destScreenY + TILE_HEIGHT * dest.size / 2;
        
        // Calculate angle to destination
        const angleToDestination = Math.atan2(destCenterY - originCenterY, destCenterX - originCenterX);
        
        helicoptersRef.current.push({
          id: helicopterIdRef.current++,
          x: originCenterX,
          y: originCenterY,
          angle: angleToDestination,
          state: 'taking_off',
          speed: 15 + Math.random() * 10, // Slow during takeoff
          altitude: 0,
          targetAltitude: 0.5, // Helicopters fly lower than planes
          originX: origin.x,
          originY: origin.y,
          originType: origin.type,
          destX: dest.x,
          destY: dest.y,
          destType: dest.type,
          destScreenX: destCenterX,
          destScreenY: destCenterY,
          stateProgress: 0,
          rotorWash: [],
          rotorAngle: 0,
          color: HELICOPTER_COLORS[Math.floor(Math.random() * HELICOPTER_COLORS.length)],
        });
      }
      
      helicopterSpawnTimerRef.current = 0.8 + Math.random() * 2.2; // 0.8-3 seconds between spawns
    }

    // Update existing helicopters
    const updatedHelicopters: Helicopter[] = [];
    
    for (const heli of helicoptersRef.current) {
      // Update rotor animation
      heli.rotorAngle += delta * 25; // Fast rotor spin
      
      // Update rotor wash particles - shorter duration on mobile
      const washMaxAge = isMobile ? 0.4 : ROTOR_WASH_MAX_AGE;
      const washSpawnInterval = isMobile ? 0.08 : ROTOR_WASH_SPAWN_INTERVAL;
      heli.rotorWash = heli.rotorWash
        .map(p => ({ ...p, age: p.age + delta, opacity: Math.max(0, 1 - p.age / washMaxAge) }))
        .filter(p => p.age < washMaxAge);
      
      // Add new rotor wash particles when flying
      if (heli.altitude > 0.2 && heli.state === 'flying') {
        heli.stateProgress += delta;
        if (heli.stateProgress >= washSpawnInterval) {
          heli.stateProgress -= washSpawnInterval;
          // Single small rotor wash particle behind helicopter
          const behindAngle = heli.angle + Math.PI;
          const offsetDist = 6;
          heli.rotorWash.push({
            x: heli.x + Math.cos(behindAngle) * offsetDist,
            y: heli.y + Math.sin(behindAngle) * offsetDist,
            age: 0,
            opacity: 1
          });
        }
      }
      
      // Update based on state
      switch (heli.state) {
        case 'taking_off': {
          // Rise vertically first, then start moving
          heli.altitude = Math.min(0.5, heli.altitude + delta * 0.4);
          heli.speed = Math.min(50, heli.speed + delta * 15);
          
          // Start moving once at cruising altitude
          if (heli.altitude >= 0.3) {
            heli.x += Math.cos(heli.angle) * heli.speed * delta * speedMultiplier * 0.5;
            heli.y += Math.sin(heli.angle) * heli.speed * delta * speedMultiplier * 0.5;
          }
          
          if (heli.altitude >= 0.5) {
            heli.state = 'flying';
          }
          break;
        }
        
        case 'flying': {
          // Move toward destination
          heli.x += Math.cos(heli.angle) * heli.speed * delta * speedMultiplier;
          heli.y += Math.sin(heli.angle) * heli.speed * delta * speedMultiplier;
          
          // Check if near destination
          const distToDest = Math.hypot(heli.x - heli.destScreenX, heli.y - heli.destScreenY);
          
          if (distToDest < 80) {
            heli.state = 'landing';
            heli.targetAltitude = 0;
          }
          break;
        }
        
        case 'landing': {
          // Approach destination and descend
          const distToDest = Math.hypot(heli.x - heli.destScreenX, heli.y - heli.destScreenY);
          
          // Slow down as we get closer
          heli.speed = Math.max(10, heli.speed - delta * 20);
          
          // Keep moving toward destination if not there yet
          if (distToDest > 15) {
            const angleToDestination = Math.atan2(heli.destScreenY - heli.y, heli.destScreenX - heli.x);
            heli.angle = angleToDestination;
            heli.x += Math.cos(heli.angle) * heli.speed * delta * speedMultiplier;
            heli.y += Math.sin(heli.angle) * heli.speed * delta * speedMultiplier;
          }
          
          // Descend
          heli.altitude = Math.max(0, heli.altitude - delta * 0.3);
          
          // Landed - remove helicopter
          if (heli.altitude <= 0 && distToDest < 20) {
            continue;
          }
          break;
        }
        
        case 'hovering':
          // Not used currently - helicopters just fly direct
          break;
      }
      
      updatedHelicopters.push(heli);
    }
    
    helicoptersRef.current = updatedHelicopters;
  }, [findHeliports, isMobile]);

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
      
      // Navigation lights at night (hour >= 20 || hour < 6)
      const isNight = hour >= 20 || hour < 6;
      if (isNight) {
        const flashTimer = navLightFlashTimerRef.current;
        const strobeOn = Math.sin(flashTimer * 8) > 0.85; // Sharp, brief flash
        
        // Red nav light on port (left) wingtip
        ctx.fillStyle = '#ff3333';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(-10, -17, 1.2, 0, Math.PI * 2);
        ctx.fill();
        
        // Green nav light on starboard (right) wingtip
        ctx.fillStyle = '#33ff33';
        ctx.shadowColor = '#00ff00';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(-10, 17, 1.2, 0, Math.PI * 2);
        ctx.fill();
        
        // White strobe/anti-collision light on tail (flashing) - BRIGHT
        if (strobeOn) {
          // Draw multiple layers for intense brightness
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 35;
          ctx.beginPath();
          ctx.arc(-18, 0, 2.5, 0, Math.PI * 2);
          ctx.fill();
          // Inner bright core
          ctx.shadowBlur = 20;
          ctx.beginPath();
          ctx.arc(-18, 0, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        
        ctx.shadowBlur = 0;
      }
      
      ctx.restore();
    }
    
    ctx.restore();
  }, [hour]);

  // Draw helicopters with rotor wash
  const drawHelicopters = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    
    // Early exit if no helicopters
    if (!currentGrid || currentGridSize <= 0 || helicoptersRef.current.length === 0) {
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
    
    for (const heli of helicoptersRef.current) {
      // Draw rotor wash/exhaust particles first (behind helicopter)
      if (heli.rotorWash.length > 0) {
        ctx.save();
        for (const particle of heli.rotorWash) {
          // Skip if outside viewport
          if (particle.x < viewLeft || particle.x > viewRight || particle.y < viewTop || particle.y > viewBottom) {
            continue;
          }
          
          const size = 1.5 + particle.age * 4; // Smaller than plane contrails
          const opacity = particle.opacity * 0.25 * heli.altitude;
          
          ctx.fillStyle = `rgba(200, 200, 200, ${opacity})`;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      
      // Skip helicopter rendering if outside viewport
      if (heli.x < viewLeft - 30 || heli.x > viewRight + 30 || heli.y < viewTop - 30 || heli.y > viewBottom + 30) {
        continue;
      }
      
      // Draw shadow (always visible since helicopters fly lower)
      const shadowOffset = (0.5 - heli.altitude) * 10 + 3;
      const shadowScale = 0.5 + heli.altitude * 0.3;
      const shadowOpacity = 0.25 * (0.6 - heli.altitude * 0.3);
      
      ctx.save();
      ctx.translate(heli.x + shadowOffset, heli.y + shadowOffset * 0.5);
      ctx.rotate(heli.angle);
      ctx.scale(shadowScale, shadowScale * 0.5);
      ctx.fillStyle = `rgba(0, 0, 0, ${shadowOpacity})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      
      // Draw helicopter
      ctx.save();
      ctx.translate(heli.x, heli.y);
      ctx.rotate(heli.angle);
      
      // Scale based on altitude (smaller than planes)
      const altitudeScale = 0.5 + heli.altitude * 0.3;
      ctx.scale(altitudeScale, altitudeScale);
      
      // Main body - oval/teardrop shape
      ctx.fillStyle = heli.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Cockpit bubble (front)
      ctx.fillStyle = '#87ceeb'; // Light blue glass
      ctx.beginPath();
      ctx.ellipse(5, 0, 3, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Tail boom
      ctx.fillStyle = heli.color;
      ctx.beginPath();
      ctx.moveTo(-6, -1);
      ctx.lineTo(-16, -0.5);
      ctx.lineTo(-16, 0.5);
      ctx.lineTo(-6, 1);
      ctx.closePath();
      ctx.fill();
      
      // Tail rotor (vertical)
      ctx.fillStyle = '#374151';
      ctx.beginPath();
      ctx.ellipse(-15, 0, 1, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Landing skids
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      // Left skid
      ctx.moveTo(-4, 3.5);
      ctx.lineTo(4, 3.5);
      ctx.moveTo(-2, 4);
      ctx.lineTo(-2, 6);
      ctx.lineTo(2, 6);
      ctx.lineTo(2, 4);
      // Right skid
      ctx.moveTo(-4, -3.5);
      ctx.lineTo(4, -3.5);
      ctx.moveTo(-2, -4);
      ctx.lineTo(-2, -6);
      ctx.lineTo(2, -6);
      ctx.lineTo(2, -4);
      ctx.stroke();
      
      // Navigation lights at night (hour >= 20 || hour < 6)
      const isNight = hour >= 20 || hour < 6;
      if (isNight) {
        const flashTimer = navLightFlashTimerRef.current;
        const strobeOn = Math.sin(flashTimer * 8) > 0.82; // Sharp, brief flash
        
        // Red nav light on port (left) side
        ctx.fillStyle = '#ff3333';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 5, 0.8, 0, Math.PI * 2);
        ctx.fill();
        
        // Green nav light on starboard (right) side
        ctx.fillStyle = '#33ff33';
        ctx.shadowColor = '#00ff00';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, -5, 0.8, 0, Math.PI * 2);
        ctx.fill();
        
        // Red anti-collision beacon on tail (flashing) - BRIGHT
        if (strobeOn) {
          // Draw multiple layers for intense brightness
          ctx.fillStyle = '#ff4444';
          ctx.shadowColor = '#ff0000';
          ctx.shadowBlur = 25;
          ctx.beginPath();
          ctx.arc(-14, 0, 2, 0, Math.PI * 2);
          ctx.fill();
          // Inner bright core
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(-14, 0, 1, 0, Math.PI * 2);
          ctx.fill();
        }
        
        ctx.shadowBlur = 0;
      }
      
      ctx.restore();
      
      // Draw main rotor (drawn separately so it's always on top)
      ctx.save();
      ctx.translate(heli.x, heli.y);
      
      // Rotor hub
      ctx.fillStyle = '#1f2937';
      ctx.beginPath();
      ctx.arc(0, 0, 2 * altitudeScale, 0, Math.PI * 2);
      ctx.fill();
      
      // Rotor blades (spinning effect - draw as blurred disc)
      const rotorRadius = 12 * altitudeScale;
      ctx.strokeStyle = `rgba(100, 100, 100, ${0.4 + Math.sin(heli.rotorAngle * 4) * 0.1})`;
      ctx.lineWidth = 1.5 * altitudeScale;
      ctx.beginPath();
      ctx.arc(0, 0, rotorRadius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Draw rotor blade lines (2 blades, rotating)
      ctx.strokeStyle = 'rgba(50, 50, 50, 0.6)';
      ctx.lineWidth = 1.5 * altitudeScale;
      ctx.beginPath();
      ctx.moveTo(Math.cos(heli.rotorAngle) * rotorRadius, Math.sin(heli.rotorAngle) * rotorRadius);
      ctx.lineTo(Math.cos(heli.rotorAngle + Math.PI) * rotorRadius, Math.sin(heli.rotorAngle + Math.PI) * rotorRadius);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(Math.cos(heli.rotorAngle + Math.PI/2) * rotorRadius, Math.sin(heli.rotorAngle + Math.PI/2) * rotorRadius);
      ctx.lineTo(Math.cos(heli.rotorAngle + Math.PI * 1.5) * rotorRadius, Math.sin(heli.rotorAngle + Math.PI * 1.5) * rotorRadius);
      ctx.stroke();
      
      ctx.restore();
    }
    
    ctx.restore();
  }, [hour]);

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

    // Calculate max boats based on number of docks (3 boats per dock, max 25)
    const maxBoats = Math.min(25, docks.length * 3);
    
    // Speed multiplier based on game speed
    const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 1.5 : 2;

    // Spawn timer
    boatSpawnTimerRef.current -= delta;
    if (boatsRef.current.length < maxBoats && boatSpawnTimerRef.current <= 0) {
      // Pick a random dock as home base
      const homeDock = docks[Math.floor(Math.random() * docks.length)];
      
      // Find adjacent water tile for positioning
      const waterTile = findAdjacentWaterTile(homeDock.x, homeDock.y);
      if (waterTile) {
        // Generate tour waypoints within the connected body of water
        const tourWaypoints = generateTourWaypoints(waterTile.x, waterTile.y);
        
        // Convert to screen coordinates
        const { screenX: originScreenX, screenY: originScreenY } = gridToScreen(waterTile.x, waterTile.y, 0, 0);
        const homeScreenX = originScreenX + TILE_WIDTH / 2;
        const homeScreenY = originScreenY + TILE_HEIGHT / 2;
        
        // Set first tour waypoint as initial destination (or home if no waypoints)
        let firstDestScreenX = homeScreenX;
        let firstDestScreenY = homeScreenY;
        if (tourWaypoints.length > 0) {
          firstDestScreenX = tourWaypoints[0].screenX;
          firstDestScreenY = tourWaypoints[0].screenY;
        }
        
        // Calculate angle to first destination
        const angle = Math.atan2(firstDestScreenY - originScreenY, firstDestScreenX - originScreenX);
        
        boatsRef.current.push({
          id: boatIdRef.current++,
          x: homeScreenX,
          y: homeScreenY,
          angle: angle,
          targetAngle: angle,
          state: 'departing',
          speed: 15 + Math.random() * 10, // Boats are slower than cars
          originX: homeDock.x,
          originY: homeDock.y,
          destX: homeDock.x, // Will be updated based on tour/return
          destY: homeDock.y,
          destScreenX: firstDestScreenX,
          destScreenY: firstDestScreenY,
          age: 0,
          color: BOAT_COLORS[Math.floor(Math.random() * BOAT_COLORS.length)],
          wake: [],
          wakeSpawnProgress: 0,
          sizeVariant: Math.random() < 0.7 ? 0 : 1, // 70% small boats, 30% medium
          tourWaypoints: tourWaypoints,
          tourWaypointIndex: 0,
          homeScreenX: homeScreenX,
          homeScreenY: homeScreenY,
        });
      }
      
      boatSpawnTimerRef.current = 1 + Math.random() * 2; // 1-3 seconds between spawns
    }

    // Update existing boats
    const updatedBoats: Boat[] = [];
    
    for (const boat of boatsRef.current) {
      boat.age += delta;
      
      // Update wake particles (similar to contrails) - shorter on mobile
      const wakeMaxAge = isMobile ? 0.6 : WAKE_MAX_AGE;
      boat.wake = boat.wake
        .map(p => ({ ...p, age: p.age + delta, opacity: Math.max(0, 1 - p.age / wakeMaxAge) }))
        .filter(p => p.age < wakeMaxAge);
      
      // Distance to destination
      const distToDest = Math.hypot(boat.x - boat.destScreenX, boat.y - boat.destScreenY);
      
      // Calculate next position
      let nextX = boat.x;
      let nextY = boat.y;
      
      switch (boat.state) {
        case 'departing': {
          // Move away from dock, then switch to touring (or sailing if no waypoints)
          nextX = boat.x + Math.cos(boat.angle) * boat.speed * delta * speedMultiplier;
          nextY = boat.y + Math.sin(boat.angle) * boat.speed * delta * speedMultiplier;
          
          if (boat.age > 2) {
            // Start touring if we have waypoints, otherwise head home
            if (boat.tourWaypoints.length > 0) {
              boat.state = 'touring';
              boat.tourWaypointIndex = 0;
              // Set first waypoint as destination
              boat.destScreenX = boat.tourWaypoints[0].screenX;
              boat.destScreenY = boat.tourWaypoints[0].screenY;
            } else {
              // No tour, just sail around briefly then return
              boat.state = 'sailing';
              boat.destScreenX = boat.homeScreenX;
              boat.destScreenY = boat.homeScreenY;
            }
          }
          break;
        }
        
        case 'touring': {
          // Navigate through tour waypoints
          const angleToWaypoint = Math.atan2(boat.destScreenY - boat.y, boat.destScreenX - boat.x);
          boat.targetAngle = angleToWaypoint;
          
          // Smooth turning (slightly slower for leisurely tour)
          let angleDiff = boat.targetAngle - boat.angle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          boat.angle += angleDiff * Math.min(1, delta * 1.8);
          
          // Calculate next position
          nextX = boat.x + Math.cos(boat.angle) * boat.speed * delta * speedMultiplier;
          nextY = boat.y + Math.sin(boat.angle) * boat.speed * delta * speedMultiplier;
          
          // Check if reached current waypoint
          if (distToDest < 40) {
            boat.tourWaypointIndex++;
            
            // Check if there are more waypoints
            if (boat.tourWaypointIndex < boat.tourWaypoints.length) {
              // Move to next waypoint
              const nextWaypoint = boat.tourWaypoints[boat.tourWaypointIndex];
              boat.destScreenX = nextWaypoint.screenX;
              boat.destScreenY = nextWaypoint.screenY;
            } else {
              // Tour complete - head back home
              boat.state = 'sailing';
              boat.destScreenX = boat.homeScreenX;
              boat.destScreenY = boat.homeScreenY;
              boat.age = 0; // Reset age for the return trip
            }
          }
          
          // Safety: remove boats that have been touring too long (stuck)
          if (boat.age > 120) {
            continue;
          }
          break;
        }
        
        case 'sailing': {
          // Navigate toward home dock with gentle course corrections
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
          
          // Check if approaching home dock
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
          // Slow down and dock at home
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
          
          // Check if docked at home
          if (distToDest < 15) {
            boat.state = 'docked';
            boat.age = 0; // Reset age for dock timer
            boat.wake = []; // Clear wake when docked
          }
          break;
        }
        
        case 'docked': {
          // Wait at dock, then generate a new tour and depart
          if (boat.age > 3 + Math.random() * 3) {
            // Generate fresh tour waypoints for the next trip
            const waterTile = findAdjacentWaterTile(boat.originX, boat.originY);
            if (waterTile) {
              boat.tourWaypoints = generateTourWaypoints(waterTile.x, waterTile.y);
              boat.tourWaypointIndex = 0;
            }
            
            boat.state = 'departing';
            boat.speed = 15 + Math.random() * 10;
            boat.age = 0;
            
            // Set initial destination for departure
            if (boat.tourWaypoints.length > 0) {
              boat.destScreenX = boat.tourWaypoints[0].screenX;
              boat.destScreenY = boat.tourWaypoints[0].screenY;
            } else {
              // No waypoints - pick a random direction temporarily
              boat.destScreenX = boat.homeScreenX + (Math.random() - 0.5) * 200;
              boat.destScreenY = boat.homeScreenY + (Math.random() - 0.5) * 200;
            }
            
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
        
        // Add wake particles when moving (simpler on mobile)
        const wakeSpawnInterval = isMobile ? 0.08 : WAKE_SPAWN_INTERVAL;
        boat.wakeSpawnProgress += delta;
        if (boat.wakeSpawnProgress >= wakeSpawnInterval) {
          boat.wakeSpawnProgress -= wakeSpawnInterval;

          // Add single wake particle behind the boat
          const behindBoat = -6; // Position behind the boat
          boat.wake.push({
            x: boat.x + Math.cos(boat.angle) * behindBoat,
            y: boat.y + Math.sin(boat.angle) * behindBoat,
            age: 0,
            opacity: 1
          });
        }
      }
      
      updatedBoats.push(boat);
    }
    
    boatsRef.current = updatedBoats;
  }, [findMarinasAndPiers, findAdjacentWaterTile, isOverWater, generateTourWaypoints, isMobile]);

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
          const size = 1.2 + particle.age * 2;
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
      
      const scale = boat.sizeVariant === 0 ? 0.5 : 0.65;
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
      
      // Navigation lights at night (hour >= 20 || hour < 6)
      const isNight = hour >= 20 || hour < 6;
      if (isNight) {
        // White masthead light at top of mast (always on)
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffcc';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(2, -9, 0.8, 0, Math.PI * 2);
        ctx.fill();
        
        // Red port light (left side)
        ctx.fillStyle = '#ff3333';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(-6, 2, 0.6, 0, Math.PI * 2);
        ctx.fill();
        
        // Green starboard light (right side)
        ctx.fillStyle = '#33ff33';
        ctx.shadowColor = '#00ff00';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(-6, -2, 0.6, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
      }
      
      ctx.restore();
    }
    
    ctx.restore();
  }, [hour]);

  // Find all buildings that can have fireworks
  const findFireworkBuildings = useCallback((): { x: number; y: number; type: BuildingType }[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return [];
    
    const buildings: { x: number; y: number; type: BuildingType }[] = [];
    for (let y = 0; y < currentGridSize; y++) {
      for (let x = 0; x < currentGridSize; x++) {
        const buildingType = currentGrid[y][x].building.type;
        if (FIREWORK_BUILDINGS.includes(buildingType)) {
          buildings.push({ x, y, type: buildingType });
        }
      }
    }
    return buildings;
  }, []);

  // Update fireworks - spawn, animate, and manage lifecycle
  const updateFireworks = useCallback((delta: number, currentHour: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;

    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
      return;
    }

    // Disable fireworks on mobile for performance
    if (isMobile) {
      fireworksRef.current = [];
      return;
    }

    // Check if it's night time (hour >= 20 or hour < 5)
    const isNight = currentHour >= 20 || currentHour < 5;
    
    // Detect transition to night - decide if this will be a firework night
    if (currentHour !== fireworkLastHourRef.current) {
      const wasNight = fireworkLastHourRef.current >= 20 || (fireworkLastHourRef.current >= 0 && fireworkLastHourRef.current < 5);
      fireworkLastHourRef.current = currentHour;
      
      // If we just transitioned into night (hour 20)
      if (currentHour === 20 && !wasNight) {
        // Roll for firework show
        if (Math.random() < FIREWORK_SHOW_CHANCE) {
          const fireworkBuildings = findFireworkBuildings();
          if (fireworkBuildings.length > 0) {
            fireworkShowActiveRef.current = true;
            fireworkShowStartTimeRef.current = 0;
          }
        }
      }
      
      // End firework show if transitioning out of night
      if (!isNight && wasNight) {
        fireworkShowActiveRef.current = false;
        fireworksRef.current = [];
      }
    }

    // No fireworks during day or if no show is active
    if (!isNight || !fireworkShowActiveRef.current) {
      // Clear any remaining fireworks
      if (fireworksRef.current.length > 0 && !fireworkShowActiveRef.current) {
        fireworksRef.current = [];
      }
      return;
    }

    // Update show timer
    fireworkShowStartTimeRef.current += delta;
    
    // End show after duration
    if (fireworkShowStartTimeRef.current > FIREWORK_SHOW_DURATION) {
      fireworkShowActiveRef.current = false;
      return;
    }

    // Find buildings that can launch fireworks
    const fireworkBuildings = findFireworkBuildings();
    if (fireworkBuildings.length === 0) {
      fireworkShowActiveRef.current = false;
      return;
    }

    // Speed multiplier based on game speed
    const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 1.5 : 2;

    // Spawn timer
    fireworkSpawnTimerRef.current -= delta;
    if (fireworkSpawnTimerRef.current <= 0) {
      // Pick a random building to launch from
      const building = fireworkBuildings[Math.floor(Math.random() * fireworkBuildings.length)];
      
      // Get building screen position
      const { screenX, screenY } = gridToScreen(building.x, building.y, 0, 0);
      
      // Add some randomness to launch position within the building
      const launchX = screenX + TILE_WIDTH / 2 + (Math.random() - 0.5) * TILE_WIDTH * 0.5;
      const launchY = screenY + TILE_HEIGHT / 2;
      
      // Target height (how high the firework goes before exploding)
      const targetY = launchY - 50 - Math.random() * 50;
      
      // Create firework
      fireworksRef.current.push({
        id: fireworkIdRef.current++,
        x: launchX,
        y: launchY,
        vx: (Math.random() - 0.5) * 20, // Slight horizontal variance
        vy: -FIREWORK_LAUNCH_SPEED,
        state: 'launching',
        targetY: targetY,
        color: FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
        particles: [],
        age: 0,
        sourceTileX: building.x,
        sourceTileY: building.y,
      });
      
      // Reset spawn timer with random interval
      fireworkSpawnTimerRef.current = FIREWORK_SPAWN_INTERVAL_MIN + Math.random() * (FIREWORK_SPAWN_INTERVAL_MAX - FIREWORK_SPAWN_INTERVAL_MIN);
    }

    // Update existing fireworks
    const updatedFireworks: Firework[] = [];
    
    for (const firework of fireworksRef.current) {
      firework.age += delta;
      
      switch (firework.state) {
        case 'launching': {
          // Move upward
          firework.x += firework.vx * delta * speedMultiplier;
          firework.y += firework.vy * delta * speedMultiplier;
          
          // Check if reached target height
          if (firework.y <= firework.targetY) {
            firework.state = 'exploding';
            firework.age = 0;
            
            // Create explosion particles
            const particleCount = FIREWORK_PARTICLE_COUNT;
            for (let i = 0; i < particleCount; i++) {
              const angle = (i / particleCount) * Math.PI * 2 + Math.random() * 0.3;
              const speed = FIREWORK_PARTICLE_SPEED * (0.5 + Math.random() * 0.5);
              
              firework.particles.push({
                x: firework.x,
                y: firework.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                age: 0,
                maxAge: FIREWORK_PARTICLE_MAX_AGE * (0.7 + Math.random() * 0.3),
                color: firework.color,
                size: 2 + Math.random() * 2,
                trail: [],
              });
            }
          }
          break;
        }
        
        case 'exploding': {
          // Update particles
          let allFaded = true;
          for (const particle of firework.particles) {
            // Add current position to trail before updating
            particle.trail.push({ x: particle.x, y: particle.y, age: 0 });
            // Limit trail length
            while (particle.trail.length > 8) {
              particle.trail.shift();
            }
            // Age trail particles
            for (const tp of particle.trail) {
              tp.age += delta;
            }
            // Remove old trail particles
            particle.trail = particle.trail.filter(tp => tp.age < 0.3);
            
            particle.age += delta;
            particle.x += particle.vx * delta * speedMultiplier;
            particle.y += particle.vy * delta * speedMultiplier;
            
            // Apply gravity
            particle.vy += 150 * delta;
            
            // Apply drag
            particle.vx *= 0.98;
            particle.vy *= 0.98;
            
            if (particle.age < particle.maxAge) {
              allFaded = false;
            }
          }
          
          if (allFaded) {
            firework.state = 'fading';
            firework.age = 0;
          }
          break;
        }
        
        case 'fading': {
          // Remove firework after fading
          if (firework.age > 0.5) {
            continue; // Don't add to updated list
          }
          break;
        }
      }
      
      updatedFireworks.push(firework);
    }
    
    fireworksRef.current = updatedFireworks;
  }, [findFireworkBuildings, isMobile]);

  // Draw fireworks
  const drawFireworks = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    
    // Early exit if no fireworks
    if (!currentGrid || currentGridSize <= 0 || fireworksRef.current.length === 0) {
      return;
    }
    
    ctx.save();
    ctx.scale(dpr * currentZoom, dpr * currentZoom);
    ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);
    
    const viewWidth = canvas.width / (dpr * currentZoom);
    const viewHeight = canvas.height / (dpr * currentZoom);
    const viewLeft = -currentOffset.x / currentZoom - 100;
    const viewTop = -currentOffset.y / currentZoom - 200;
    const viewRight = viewWidth - currentOffset.x / currentZoom + 100;
    const viewBottom = viewHeight - currentOffset.y / currentZoom + 100;
    
    for (const firework of fireworksRef.current) {
      // Skip if outside viewport
      if (firework.x < viewLeft || firework.x > viewRight || firework.y < viewTop || firework.y > viewBottom) {
        continue;
      }
      
      if (firework.state === 'launching') {
        // Draw launching trail
        const gradient = ctx.createLinearGradient(
          firework.x, firework.y,
          firework.x - firework.vx * 0.1, firework.y - firework.vy * 0.1
        );
        gradient.addColorStop(0, firework.color);
        gradient.addColorStop(1, 'rgba(255, 200, 100, 0)');
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(firework.x, firework.y);
        ctx.lineTo(
          firework.x - firework.vx * 0.08,
          firework.y - firework.vy * 0.08
        );
        ctx.stroke();
        
        // Draw the firework head (bright point)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(firework.x, firework.y, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Glow effect
        ctx.fillStyle = firework.color;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(firework.x, firework.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        
      } else if (firework.state === 'exploding' || firework.state === 'fading') {
        // Draw particles
        for (const particle of firework.particles) {
          const alpha = Math.max(0, 1 - particle.age / particle.maxAge);
          if (alpha <= 0) continue;
          
          // Draw particle trail
          if (particle.trail.length > 1) {
            ctx.strokeStyle = particle.color;
            ctx.lineWidth = particle.size * 0.5;
            ctx.lineCap = 'round';
            ctx.globalAlpha = alpha * 0.3;
            
            ctx.beginPath();
            ctx.moveTo(particle.trail[0].x, particle.trail[0].y);
            for (let i = 1; i < particle.trail.length; i++) {
              ctx.lineTo(particle.trail[i].x, particle.trail[i].y);
            }
            ctx.lineTo(particle.x, particle.y);
            ctx.stroke();
          }
          
          // Draw particle
          ctx.globalAlpha = alpha;
          ctx.fillStyle = particle.color;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
          ctx.fill();
          
          // Bright center
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = alpha * 0.7;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size * alpha * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
    
    ctx.restore();
  }, []);

  // Find all factories that should emit smog (medium and large)
  const findSmogFactories = useCallback((): { x: number; y: number; type: 'factory_medium' | 'factory_large' }[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return [];
    
    const factories: { x: number; y: number; type: 'factory_medium' | 'factory_large' }[] = [];
    for (let y = 0; y < currentGridSize; y++) {
      for (let x = 0; x < currentGridSize; x++) {
        const tile = currentGrid[y][x];
        const buildingType = tile.building.type;
        // Only include operating factories (powered, not abandoned, not under construction)
        if ((buildingType === 'factory_medium' || buildingType === 'factory_large') &&
            tile.building.powered &&
            !tile.building.abandoned &&
            tile.building.constructionProgress >= 100) {
          factories.push({ x, y, type: buildingType });
        }
      }
    }
    return factories;
  }, []);

  // Update smog particles - spawn new particles and update existing ones
  const updateSmog = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed, zoom: currentZoom } = worldStateRef.current;
    
    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
      return;
    }
    
    // Skip smog updates entirely when zoomed in enough that it won't be visible
    if (currentZoom > SMOG_FADE_ZOOM) {
      return;
    }
    
    const speedMultiplier = [0, 1, 2, 4][currentSpeed] || 1;
    const adjustedDelta = delta * speedMultiplier;
    
    // Mobile performance optimizations
    const maxParticles = isMobile ? SMOG_MAX_PARTICLES_PER_FACTORY_MOBILE : SMOG_MAX_PARTICLES_PER_FACTORY;
    const particleMaxAge = isMobile ? SMOG_PARTICLE_MAX_AGE_MOBILE : SMOG_PARTICLE_MAX_AGE;
    const spawnMultiplier = isMobile ? SMOG_SPAWN_INTERVAL_MOBILE_MULTIPLIER : 1;
    
    // Rebuild factory list if grid has changed
    const currentGridVersion = gridVersionRef.current;
    if (smogLastGridVersionRef.current !== currentGridVersion) {
      smogLastGridVersionRef.current = currentGridVersion;
      
      const factories = findSmogFactories();
      
      // Create new smog entries for factories, preserving existing particles where possible
      const existingSmogMap = new Map<string, FactorySmog>();
      for (const smog of factorySmogRef.current) {
        existingSmogMap.set(`${smog.tileX},${smog.tileY}`, smog);
      }
      
      factorySmogRef.current = factories.map(factory => {
        const key = `${factory.x},${factory.y}`;
        const existing = existingSmogMap.get(key);
        
        // Calculate screen position for the factory (chimney position)
        const { screenX, screenY } = gridToScreen(factory.x, factory.y, 0, 0);
        // Offset to chimney position (varies by factory size) - positioned near rooftop/smokestacks
        const chimneyOffsetX = factory.type === 'factory_large' ? TILE_WIDTH * 1.2 : TILE_WIDTH * 0.6;
        const chimneyOffsetY = factory.type === 'factory_large' ? -TILE_HEIGHT * 1.2 : -TILE_HEIGHT * 0.7;
        
        if (existing && existing.buildingType === factory.type) {
          // Update screen position but keep particles
          existing.screenX = screenX + chimneyOffsetX;
          existing.screenY = screenY + chimneyOffsetY;
          return existing;
        }
        
        return {
          tileX: factory.x,
          tileY: factory.y,
          screenX: screenX + chimneyOffsetX,
          screenY: screenY + chimneyOffsetY,
          buildingType: factory.type,
          particles: [],
          spawnTimer: Math.random(), // Randomize initial spawn timing
        };
      });
    }
    
    // Update each factory's smog
    for (const smog of factorySmogRef.current) {
      // Update spawn timer with mobile multiplier
      const baseSpawnInterval = smog.buildingType === 'factory_large' 
        ? SMOG_SPAWN_INTERVAL_LARGE 
        : SMOG_SPAWN_INTERVAL_MEDIUM;
      const spawnInterval = baseSpawnInterval * spawnMultiplier;
      
      smog.spawnTimer += adjustedDelta;
      
      // Spawn new particles (only if below particle limit)
      while (smog.spawnTimer >= spawnInterval && smog.particles.length < maxParticles) {
        smog.spawnTimer -= spawnInterval;
        
        // Calculate spawn position with some randomness around the chimney
        const spawnX = smog.screenX + (Math.random() - 0.5) * 8;
        const spawnY = smog.screenY + (Math.random() - 0.5) * 4;
        
        // Random initial velocity with upward and slight horizontal drift
        const vx = (Math.random() - 0.5) * SMOG_DRIFT_SPEED * 2;
        const vy = -SMOG_RISE_SPEED * (0.8 + Math.random() * 0.4);
        
        // Random particle properties
        const size = SMOG_PARTICLE_SIZE_MIN + Math.random() * (SMOG_PARTICLE_SIZE_MAX - SMOG_PARTICLE_SIZE_MIN);
        const maxAge = particleMaxAge * (0.7 + Math.random() * 0.6);
        
        smog.particles.push({
          x: spawnX,
          y: spawnY,
          vx,
          vy,
          age: 0,
          maxAge,
          size,
          opacity: SMOG_BASE_OPACITY * (0.8 + Math.random() * 0.4),
        });
      }
      
      // Reset spawn timer if we hit the particle limit to prevent buildup
      if (smog.particles.length >= maxParticles) {
        smog.spawnTimer = 0;
      }
      
      // Update existing particles
      smog.particles = smog.particles.filter(particle => {
        particle.age += adjustedDelta;
        
        if (particle.age >= particle.maxAge) {
          return false; // Remove old particles
        }
        
        // Update position with drift
        particle.x += particle.vx * adjustedDelta;
        particle.y += particle.vy * adjustedDelta;
        
        // Slow down horizontal drift over time
        particle.vx *= 0.995;
        
        // Slow down vertical rise as particle ages
        particle.vy *= 0.998;
        
        // Grow particle size over time
        particle.size += SMOG_PARTICLE_GROWTH * adjustedDelta;
        
        return true;
      });
    }
  }, [findSmogFactories, isMobile]);

  // Draw smog particles
  const drawSmog = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    
    // Early exit if no factories or zoom is too high (smog fades when zoomed in)
    if (!currentGrid || currentGridSize <= 0 || factorySmogRef.current.length === 0) {
      return;
    }
    
    // Calculate zoom-based opacity modifier
    // Smog is fully visible below SMOG_MAX_ZOOM, fades between MAX and FADE, invisible above FADE
    let zoomOpacity = 1;
    if (currentZoom > SMOG_FADE_ZOOM) {
      return; // Don't draw at all when fully zoomed in
    } else if (currentZoom > SMOG_MAX_ZOOM) {
      // Fade out between MAX and FADE zoom levels
      zoomOpacity = 1 - (currentZoom - SMOG_MAX_ZOOM) / (SMOG_FADE_ZOOM - SMOG_MAX_ZOOM);
    }
    
    ctx.save();
    ctx.scale(dpr * currentZoom, dpr * currentZoom);
    ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);
    
    // Calculate viewport bounds
    const viewWidth = canvas.width / (dpr * currentZoom);
    const viewHeight = canvas.height / (dpr * currentZoom);
    const viewLeft = -currentOffset.x / currentZoom - 100;
    const viewTop = -currentOffset.y / currentZoom - 200;
    const viewRight = viewWidth - currentOffset.x / currentZoom + 100;
    const viewBottom = viewHeight - currentOffset.y / currentZoom + 100;
    
    // Draw all smog particles
    for (const smog of factorySmogRef.current) {
      for (const particle of smog.particles) {
        // Skip if outside viewport
        if (particle.x < viewLeft || particle.x > viewRight || 
            particle.y < viewTop || particle.y > viewBottom) {
          continue;
        }
        
        // Calculate age-based opacity (fade in quickly, fade out slowly)
        const ageRatio = particle.age / particle.maxAge;
        let ageOpacity: number;
        if (ageRatio < 0.1) {
          // Quick fade in
          ageOpacity = ageRatio / 0.1;
        } else {
          // Slow fade out
          ageOpacity = 1 - ((ageRatio - 0.1) / 0.9);
        }
        
        const finalOpacity = particle.opacity * ageOpacity * zoomOpacity;
        if (finalOpacity <= 0.01) continue;
        
        // Draw smog particle as a soft, slightly gray circle
        ctx.fillStyle = `rgba(100, 100, 110, ${finalOpacity})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Add a lighter inner glow for depth
        const innerSize = particle.size * 0.6;
        ctx.fillStyle = `rgba(140, 140, 150, ${finalOpacity * 0.5})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y - particle.size * 0.1, innerSize, 0, Math.PI * 2);
        ctx.fill();
      }
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

  // Animation time ref for incident indicator pulsing
  const incidentAnimTimeRef = useRef(0);
  
  // Draw incident indicators (fires and crimes) with pulsing effect
  const drawIncidentIndicators = useCallback((ctx: CanvasRenderingContext2D, delta: number) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    
    if (!currentGrid || currentGridSize <= 0) return;
    
    // Update animation time
    incidentAnimTimeRef.current += delta;
    const animTime = incidentAnimTimeRef.current;
    
    ctx.save();
    ctx.scale(dpr * currentZoom, dpr * currentZoom);
    ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);
    
    const viewWidth = canvas.width / (dpr * currentZoom);
    const viewHeight = canvas.height / (dpr * currentZoom);
    const viewLeft = -currentOffset.x / currentZoom - TILE_WIDTH * 2;
    const viewTop = -currentOffset.y / currentZoom - TILE_HEIGHT * 4;
    const viewRight = viewWidth - currentOffset.x / currentZoom + TILE_WIDTH * 2;
    const viewBottom = viewHeight - currentOffset.y / currentZoom + TILE_HEIGHT * 4;
    
    // Draw crime incident indicators
    activeCrimeIncidentsRef.current.forEach((crime) => {
      const { screenX, screenY } = gridToScreen(crime.x, crime.y, 0, 0);
      const centerX = screenX + TILE_WIDTH / 2;
      const centerY = screenY + TILE_HEIGHT / 2;
      
      // View culling
      if (centerX < viewLeft || centerX > viewRight || centerY < viewTop || centerY > viewBottom) {
        return;
      }
      
      // Pulsing effect
      const pulse = Math.sin(animTime * 4) * 0.3 + 0.7;
      const outerPulse = Math.sin(animTime * 3) * 0.5 + 0.5;
      
      // Outer glow ring (expanding pulse) - smaller
      ctx.beginPath();
      ctx.arc(centerX, centerY - 8, 18 + outerPulse * 6, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(59, 130, 246, ${0.25 * (1 - outerPulse)})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Inner pulsing glow (smaller)
      const gradient = ctx.createRadialGradient(centerX, centerY - 8, 0, centerX, centerY - 8, 14 * pulse);
      gradient.addColorStop(0, `rgba(59, 130, 246, ${0.5 * pulse})`);
      gradient.addColorStop(0.5, `rgba(59, 130, 246, ${0.2 * pulse})`);
      gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
      ctx.beginPath();
      ctx.arc(centerX, centerY - 8, 14 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Crime icon (small shield with exclamation)
      ctx.save();
      ctx.translate(centerX, centerY - 12);
      
      // Shield background (smaller)
      ctx.fillStyle = `rgba(30, 64, 175, ${0.9 * pulse})`;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(6, -4);
      ctx.lineTo(6, 2);
      ctx.quadraticCurveTo(0, 8, 0, 8);
      ctx.quadraticCurveTo(0, 8, -6, 2);
      ctx.lineTo(-6, -4);
      ctx.closePath();
      ctx.fill();
      
      // Shield border
      ctx.strokeStyle = `rgba(147, 197, 253, ${pulse})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Exclamation mark (smaller)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-1, -4, 2, 5);
      ctx.beginPath();
      ctx.arc(0, 4, 1.5, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    });
    
    // Draw fire indicators (for tiles on fire without visual fire effect already)
    for (let y = 0; y < currentGridSize; y++) {
      for (let x = 0; x < currentGridSize; x++) {
        const tile = currentGrid[y][x];
        if (!tile.building.onFire) continue;
        
        const { screenX, screenY } = gridToScreen(x, y, 0, 0);
        const centerX = screenX + TILE_WIDTH / 2;
        const centerY = screenY + TILE_HEIGHT / 2;
        
        // View culling
        if (centerX < viewLeft || centerX > viewRight || centerY < viewTop || centerY > viewBottom) {
          continue;
        }
        
        // Pulsing effect for fire (faster)
        const pulse = Math.sin(animTime * 6) * 0.3 + 0.7;
        const outerPulse = Math.sin(animTime * 4) * 0.5 + 0.5;
        
        // Outer glow ring (expanding pulse) - red/orange
        ctx.beginPath();
        ctx.arc(centerX, centerY - 12, 22 + outerPulse * 8, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.3 * (1 - outerPulse)})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Inner danger icon (smaller)
        ctx.save();
        ctx.translate(centerX, centerY - 15);
        
        // Warning triangle background (smaller)
        ctx.fillStyle = `rgba(220, 38, 38, ${0.9 * pulse})`;
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(8, 5);
        ctx.lineTo(-8, 5);
        ctx.closePath();
        ctx.fill();
        
        // Triangle border
        ctx.strokeStyle = `rgba(252, 165, 165, ${pulse})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Fire flame icon inside (smaller)
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(0, -3);
        ctx.quadraticCurveTo(2.5, 0, 2, 2.5);
        ctx.quadraticCurveTo(0.5, 1.5, 0, 2.5);
        ctx.quadraticCurveTo(-0.5, 1.5, -2, 2.5);
        ctx.quadraticCurveTo(-2.5, 0, 0, -3);
        ctx.fill();
        
        ctx.restore();
      }
    }
    
    ctx.restore();
  }, []);

  // Progressive image loading - load sprites in background, render immediately
  // Subscribe to image load notifications to trigger re-renders as assets become available
  useEffect(() => {
    const unsubscribe = onImageLoaded(() => {
      // Trigger re-render when any new image loads
      setImageLoadVersion(v => v + 1);
    });
    return unsubscribe;
  }, []);
  
  // Load sprite sheets on mount and when sprite pack changes
  // This now runs in background - rendering starts immediately with placeholders
  useEffect(() => {
    // Load images progressively - each will trigger a re-render when ready
    // Priority: main sprite sheet first, then water, then secondary sheets
    
    // High priority - main sprite sheet
    loadSpriteImage(currentSpritePack.src, true).catch(console.error);
    
    // High priority - water texture
    loadImage('/assets/water.png').catch(console.error);
    
    // Medium priority - load secondary sheets after a small delay
    // This allows the main content to render first
    const loadSecondarySheets = () => {
      if (currentSpritePack.constructionSrc) {
        loadSpriteImage(currentSpritePack.constructionSrc, true).catch(console.error);
      }
      if (currentSpritePack.abandonedSrc) {
        loadSpriteImage(currentSpritePack.abandonedSrc, true).catch(console.error);
      }
      if (currentSpritePack.denseSrc) {
        loadSpriteImage(currentSpritePack.denseSrc, true).catch(console.error);
      }
      if (currentSpritePack.parksSrc) {
        loadSpriteImage(currentSpritePack.parksSrc, true).catch(console.error);
      }
      if (currentSpritePack.parksConstructionSrc) {
        loadSpriteImage(currentSpritePack.parksConstructionSrc, true).catch(console.error);
      }
      if (currentSpritePack.farmsSrc) {
        loadSpriteImage(currentSpritePack.farmsSrc, true).catch(console.error);
      }
    };
    
    // Load secondary sheets after 50ms to prioritize first paint
    const timer = setTimeout(loadSecondarySheets, 50);
    return () => clearTimeout(timer);
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
  
// PERF: Static Set for park building lookups (O(1) instead of O(n) array includes)
  const parkBuildingsSet = useMemo(() => new Set<BuildingType>([
    'park_large', 'baseball_field_small', 'football_field',
    'mini_golf_course', 'go_kart_track', 'amphitheater', 'greenhouse_garden',
    'marina_docks_small', 'roller_coaster_small', 'mountain_lodge', 'playground_large', 'mountain_trailhead'
  ]), []);
  
  // Helper function to check if a tile is part of a park building footprint
  // Note: buildings with grey bases (baseball_stadium, swimming_pool, community_center, office_building_small) are NOT included
  const isPartOfParkBuilding = useCallback((gridX: number, gridY: number): boolean => {
    const maxSize = 4; // Maximum building size

    for (let dy = 0; dy < maxSize; dy++) {
      for (let dx = 0; dx < maxSize; dx++) {
        const originX = gridX - dx;
        const originY = gridY - dy;

        if (originX >= 0 && originX < gridSize && originY >= 0 && originY < gridSize) {
          const originTile = grid[originY][originX];

          // PERF: Use Set.has() instead of array.includes() for O(1) lookup
          if (parkBuildingsSet.has(originTile.building.type)) {
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
  }, [grid, gridSize, parkBuildingsSet]);
  
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
    
    // PERF: Reuse queue arrays across frames to avoid GC pressure
    // Arrays are cleared by setting length = 0 which is faster than recreating
    const buildingQueue: BuildingDraw[] = [];
    const waterQueue: BuildingDraw[] = [];
    const roadQueue: BuildingDraw[] = []; // Roads drawn above water
    const beachQueue: BuildingDraw[] = [];
    const baseTileQueue: BuildingDraw[] = [];
    const greenBaseTileQueue: BuildingDraw[] = [];
    const overlayQueue: OverlayDraw[] = [];
    
    // PERF: Insertion sort for nearly-sorted arrays (O(n) vs O(n log n) for .sort())
    // Since tiles are iterated in diagonal order, queues are already nearly sorted
    function insertionSortByDepth<T extends { depth: number }>(arr: T[]): void {
      for (let i = 1; i < arr.length; i++) {
        const current = arr[i];
        let j = i - 1;
        // Only move elements that are strictly greater (maintains stability)
        while (j >= 0 && arr[j].depth > current.depth) {
          arr[j + 1] = arr[j];
          j--;
        }
        arr[j + 1] = current;
      }
    }
    
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

    function getRoadConnections(gridX: number, gridY: number) {
      if (!hasRoad(gridX, gridY)) return null;
      return {
        north: hasRoad(gridX - 1, gridY),
        east: hasRoad(gridX, gridY - 1),
        south: hasRoad(gridX + 1, gridY),
        west: hasRoad(gridX, gridY + 1),
      };
    }
    
    // Helper function to check if a tile has a marina dock or pier (no beaches next to these)
    // Also checks 'empty' tiles that are part of multi-tile marina buildings
    function hasMarinaPier(gridX: number, gridY: number): boolean {
      if (gridX < 0 || gridX >= gridSize || gridY < 0 || gridY >= gridSize) return false;
      const buildingType = grid[gridY][gridX].building.type;
      if (buildingType === 'marina_docks_small' || buildingType === 'pier_large') return true;
      
      // Check if this is an 'empty' tile that belongs to a marina (2x2 building)
      // Marina is 2x2, so check up to 1 tile away for the origin
      if (buildingType === 'empty') {
        for (let dy = 0; dy <= 1; dy++) {
          for (let dx = 0; dx <= 1; dx++) {
            const checkX = gridX - dx;
            const checkY = gridY - dy;
            if (checkX >= 0 && checkY >= 0 && checkX < gridSize && checkY < gridSize) {
              const checkType = grid[checkY][checkX].building.type;
              if (checkType === 'marina_docks_small') {
                // Verify this tile is within the 2x2 footprint
                if (gridX >= checkX && gridX < checkX + 2 && gridY >= checkY && gridY < checkY + 2) {
                  return true;
                }
              }
            }
          }
        }
      }
      return false;
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
      const connectionCount = (north ? 1 : 0) + (east ? 1 : 0) + (south ? 1 : 0) + (west ? 1 : 0);
      const nsStrength = (north ? 1 : 0) + (south ? 1 : 0);
      const ewStrength = (east ? 1 : 0) + (west ? 1 : 0);
      const dominantAxis: TrafficLightPhase = nsStrength >= ewStrength ? 'ns' : 'ew';
      const neighborConnections = {
        north: getRoadConnections(gridX - 1, gridY),
        east: getRoadConnections(gridX, gridY - 1),
        south: getRoadConnections(gridX + 1, gridY),
        west: getRoadConnections(gridX, gridY + 1),
      };
      const parallelNS =
        (north || south) &&
        ((neighborConnections.east && neighborConnections.east.north && neighborConnections.east.south) ||
          (neighborConnections.west && neighborConnections.west.north && neighborConnections.west.south));
      const parallelEW =
        (east || west) &&
        ((neighborConnections.north && neighborConnections.north.east && neighborConnections.north.west) ||
          (neighborConnections.south && neighborConnections.south.east && neighborConnections.south.west));
      const highCapacity = connectionCount >= 3 || parallelNS || parallelEW;
      
      // Road width - aligned with gridlines
      const widthScale = highCapacity ? 1.35 : 1;
      const roadW = w * 0.14 * widthScale;
      const roadH = h * 0.14 * widthScale;
      
      // Sidewalk configuration
      const sidewalkWidth = w * 0.08; // Width of the sidewalk strip
      const sidewalkColor = '#9ca3af'; // Light gray for sidewalk
      const curbColor = '#6b7280'; // Darker gray for curb edge
      
      // Edge stop distance - extend roads almost to the edge for better connection
      // Using 0.98 means roads extend to 98% of the way to the edge
      const edgeStop = highCapacity ? 1.02 : 0.98;
      
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
      const northPerp = getPerp(northDx, northDy);
      const eastPerp = getPerp(eastDx, eastDy);
      const southPerp = getPerp(southDx, southDy);
      const westPerp = getPerp(westDx, westDy);
      
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
      const asphaltColor = highCapacity ? '#3b3f45' : '#4a4a4a';
      ctx.fillStyle = asphaltColor;
      
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
      
      if (highCapacity && (nsStrength >= 2 || ewStrength >= 2)) {
        const axisVec = dominantAxis === 'ns' ? { dx: northDx, dy: northDy } : { dx: eastDx, dy: eastDy };
        const perpVec = dominantAxis === 'ns' ? northPerp : eastPerp;
        const medianHalfWidth = roadW * 0.35;
        const medianLength = roadW * (connectionCount === 4 ? 2.6 : 2.0);
        ctx.fillStyle = '#1f2937';
        ctx.beginPath();
        ctx.moveTo(cx + axisVec.dx * medianLength, cy + axisVec.dy * medianLength);
        ctx.lineTo(cx + perpVec.nx * medianHalfWidth, cy + perpVec.ny * medianHalfWidth);
        ctx.lineTo(cx - axisVec.dx * medianLength, cy - axisVec.dy * medianLength);
        ctx.lineTo(cx - perpVec.nx * medianHalfWidth, cy - perpVec.ny * medianHalfWidth);
        ctx.closePath();
        ctx.fill();

        const planterCount = connectionCount === 4 ? 3 : 2;
        const planterSeed = ((gridX + 31) * 73856093) ^ ((gridY + 17) * 19349663);
        for (let i = 0; i < planterCount; i++) {
          const t = (i + 1) / (planterCount + 1) - 0.5;
          const offset = t * medianLength * 1.4;
          const px = cx + axisVec.dx * offset;
          const py = cy + axisVec.dy * offset;
          const variant = (planterSeed + i * 13) % 5;
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(px, py, medianHalfWidth * 0.45, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = variant === 0 ? '#fbbf24' : '#22c55e';
          ctx.beginPath();
          ctx.arc(px, py - 1, medianHalfWidth * (variant === 0 ? 0.32 : 0.36), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (connectionCount >= 3) {
        const turnWidth = roadW * 0.45;
        const turnLength = w * 0.18;
        const drawTurnLane = (dirDx: number, dirDy: number, perp: { nx: number; ny: number }) => {
          ctx.fillStyle = '#56606e';
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + dirDx * turnLength + perp.nx * turnWidth, cy + dirDy * turnLength + perp.ny * turnWidth);
          ctx.lineTo(cx + dirDx * turnLength - perp.nx * turnWidth, cy + dirDy * turnLength - perp.ny * turnWidth);
          ctx.closePath();
          ctx.fill();
        };

        if (dominantAxis === 'ns') {
          if (east) drawTurnLane(eastDx, eastDy, eastPerp);
          if (west) drawTurnLane(westDx, westDy, westPerp);
        } else {
          if (north) drawTurnLane(northDx, northDy, northPerp);
          if (south) drawTurnLane(southDx, southDy, southPerp);
        }
      }
      
      // Draw road markings (yellow dashed lines) - aligned with gridlines
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 0.8;  // Thinner lines
      ctx.setLineDash([1.5, 2]);  // Smaller, more frequent dots
      ctx.lineCap = 'round';
      
      // Extend past tile edge to overlap with adjacent tile's marking
      // This ensures continuous yellow lines across tile boundaries
      const markingOverlap = 4; // pixels past edge for overlap
      const markingStartOffset = 2; // pixels from center
      
      // North marking (toward top-left)
      if (north) {
        ctx.beginPath();
        ctx.moveTo(cx + northDx * markingStartOffset, cy + northDy * markingStartOffset);
        ctx.lineTo(northEdgeX + northDx * markingOverlap, northEdgeY + northDy * markingOverlap);
        ctx.stroke();
      }
      
      // East marking (toward top-right)
      if (east) {
        ctx.beginPath();
        ctx.moveTo(cx + eastDx * markingStartOffset, cy + eastDy * markingStartOffset);
        ctx.lineTo(eastEdgeX + eastDx * markingOverlap, eastEdgeY + eastDy * markingOverlap);
        ctx.stroke();
      }
      
      // South marking (toward bottom-right)
      if (south) {
        ctx.beginPath();
        ctx.moveTo(cx + southDx * markingStartOffset, cy + southDy * markingStartOffset);
        ctx.lineTo(southEdgeX + southDx * markingOverlap, southEdgeY + southDy * markingOverlap);
        ctx.stroke();
      }
      
      // West marking (toward bottom-left)
      if (west) {
        ctx.beginPath();
        ctx.moveTo(cx + westDx * markingStartOffset, cy + westDy * markingStartOffset);
        ctx.lineTo(westEdgeX + westDx * markingOverlap, westEdgeY + westDy * markingOverlap);
        ctx.stroke();
      }
      
      if (highCapacity) {
        const laneSpacing = roadW * 0.35;
        const stripeStart = markingStartOffset * 1.2;
        const drawLaneStripe = (
          dirDx: number,
          dirDy: number,
          edgeX: number,
          edgeY: number,
          perp: { nx: number; ny: number },
          offset: number
        ) => {
          ctx.beginPath();
          ctx.moveTo(
            cx + dirDx * stripeStart + perp.nx * offset,
            cy + dirDy * stripeStart + perp.ny * offset
          );
          ctx.lineTo(
            edgeX + dirDx * markingOverlap + perp.nx * offset,
            edgeY + dirDy * markingOverlap + perp.ny * offset
          );
          ctx.stroke();
        };

        ctx.strokeStyle = 'rgba(229, 231, 235, 0.8)';
        ctx.lineWidth = 0.6;
        ctx.setLineDash([3, 2]);
        const offsets = [-laneSpacing, laneSpacing];
        if (north) {
          offsets.forEach((offset) => drawLaneStripe(northDx, northDy, northEdgeX, northEdgeY, northPerp, offset));
        }
        if (east) {
          offsets.forEach((offset) => drawLaneStripe(eastDx, eastDy, eastEdgeX, eastEdgeY, eastPerp, offset));
        }
        if (south) {
          offsets.forEach((offset) => drawLaneStripe(southDx, southDy, southEdgeX, southEdgeY, southPerp, offset));
        }
        if (west) {
          offsets.forEach((offset) => drawLaneStripe(westDx, westDy, westEdgeX, westEdgeY, westPerp, offset));
        }
      }
      
      ctx.setLineDash([]);
      ctx.lineCap = 'butt';
    }
    
    // Draw isometric tile base
    function drawIsometricTile(ctx: CanvasRenderingContext2D, x: number, y: number, tile: Tile, highlight: boolean, currentZoom: number, skipGreyBase: boolean = false, skipGreenBase: boolean = false) {
      const w = TILE_WIDTH;
      const h = TILE_HEIGHT;
      
      // Determine tile colors (top face and shading)
      let topColor = '#4a7c3f'; // grass
      let leftColor = '#3d6634';
      let rightColor = '#5a8f4f';
      let strokeColor = '#2d4a26';

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
        // Draw a semi-transparent fill for better visibility
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y);
        ctx.lineTo(x + w, y + h / 2);
        ctx.lineTo(x + w / 2, y + h);
        ctx.lineTo(x, y + h / 2);
        ctx.closePath();
        ctx.fill();
        
        // Draw white border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
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
        // Special handling for water: use separate water.png image with blending for adjacent water tiles
        if (buildingType === 'water') {
          const waterImage = imageCache.get('/assets/water.png');
          
          // Check which adjacent tiles are also water for blending
          const gridX = tile.x;
          const gridY = tile.y;
          const adjacentWater = {
            north: gridX > 0 && grid[gridY]?.[gridX - 1]?.building.type === 'water',
            east: gridY > 0 && grid[gridY - 1]?.[gridX]?.building.type === 'water',
            south: gridX < gridSize - 1 && grid[gridY]?.[gridX + 1]?.building.type === 'water',
            west: gridY < gridSize - 1 && grid[gridY + 1]?.[gridX]?.building.type === 'water',
          };
          
          // Count adjacent water tiles
          const adjacentCount = (adjacentWater.north ? 1 : 0) + (adjacentWater.east ? 1 : 0) + 
                               (adjacentWater.south ? 1 : 0) + (adjacentWater.west ? 1 : 0);
          
          if (waterImage) {
            // Center the water sprite on the tile
            const tileCenterX = x + w / 2;
            const tileCenterY = y + h / 2;
            
            // Random subcrop of water texture based on tile position for variety
            const imgW = waterImage.naturalWidth || waterImage.width;
            const imgH = waterImage.naturalHeight || waterImage.height;
            
            // Deterministic "random" offset based on tile position
            const seedX = ((gridX * 7919 + gridY * 6271) % 1000) / 1000;
            const seedY = ((gridX * 4177 + gridY * 9311) % 1000) / 1000;
            
            // Take a subcrop - use 35% of the image, offset randomly for variety
            const cropScale = 0.35;
            const cropW = imgW * cropScale;
            const cropH = imgH * cropScale;
            const maxOffsetX = imgW - cropW;
            const maxOffsetY = imgH - cropH;
            const srcX = seedX * maxOffsetX;
            const srcY = seedY * maxOffsetY;
            
            // Create a clipping path - expand toward adjacent WATER tiles only
            // This allows blending between water tiles while preventing bleed onto land
            const expand = w * 0.4; // How much to expand toward water neighbors
            
            // Calculate expanded corners based on water adjacency
            // North edge (top-left): between left and top corners
            // East edge (top-right): between top and right corners
            // South edge (bottom-right): between right and bottom corners
            // West edge (bottom-left): between bottom and left corners
            const topY = y - (adjacentWater.north && adjacentWater.east ? expand * 0.5 : 0);
            const rightX = x + w + ((adjacentWater.east && adjacentWater.south) ? expand * 0.5 : 0);
            const bottomY = y + h + ((adjacentWater.south && adjacentWater.west) ? expand * 0.5 : 0);
            const leftX = x - ((adjacentWater.west && adjacentWater.north) ? expand * 0.5 : 0);
            
            // Expand individual edges toward water neighbors
            const topExpand = (adjacentWater.north || adjacentWater.east) ? expand * 0.3 : 0;
            const rightExpand = (adjacentWater.east || adjacentWater.south) ? expand * 0.3 : 0;
            const bottomExpand = (adjacentWater.south || adjacentWater.west) ? expand * 0.3 : 0;
            const leftExpand = (adjacentWater.west || adjacentWater.north) ? expand * 0.3 : 0;
            
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(x + w / 2, topY - topExpand);                    // top
            ctx.lineTo(rightX + rightExpand, y + h / 2);                // right
            ctx.lineTo(x + w / 2, bottomY + bottomExpand);              // bottom
            ctx.lineTo(leftX - leftExpand, y + h / 2);                  // left
            ctx.closePath();
            ctx.clip();
            
            const aspectRatio = cropH / cropW;
            const savedAlpha = ctx.globalAlpha;
            
            // Jitter for variety
            const jitterX = (seedX - 0.5) * w * 0.3;
            const jitterY = (seedY - 0.5) * h * 0.3;
            
            // For tiles with more water neighbors, draw blended passes
            if (adjacentCount >= 2) {
              // Two passes: large soft outer, smaller solid core
              // Outer pass - large, semi-transparent for blending
              const outerScale = 2.0 + adjacentCount * 0.3;
              const outerWidth = w * outerScale;
              const outerHeight = outerWidth * aspectRatio;
              ctx.globalAlpha = 0.35;
              ctx.drawImage(
                waterImage,
                srcX, srcY, cropW, cropH,
                Math.round(tileCenterX - outerWidth / 2 + jitterX),
                Math.round(tileCenterY - outerHeight / 2 + jitterY),
                Math.round(outerWidth),
                Math.round(outerHeight)
              );
              
              // Core pass - full opacity
              const coreScale = 1.1;
              const coreWidth = w * coreScale;
              const coreHeight = coreWidth * aspectRatio;
              ctx.globalAlpha = 0.9;
              ctx.drawImage(
                waterImage,
                srcX, srcY, cropW, cropH,
                Math.round(tileCenterX - coreWidth / 2 + jitterX * 0.5),
                Math.round(tileCenterY - coreHeight / 2 + jitterY * 0.5),
                Math.round(coreWidth),
                Math.round(coreHeight)
              );
            } else {
              // Edge tile with few water neighbors - single contained draw
              const destWidth = w * 1.15;
              const destHeight = destWidth * aspectRatio;
              
              ctx.globalAlpha = 0.95;
              ctx.drawImage(
                waterImage,
                srcX, srcY, cropW, cropH,
                Math.round(tileCenterX - destWidth / 2 + jitterX * 0.3),
                Math.round(tileCenterY - destHeight / 2 + jitterY * 0.3),
                Math.round(destWidth),
                Math.round(destHeight)
              );
            }
            
            ctx.globalAlpha = savedAlpha;
            ctx.restore();
          } else {
            // Water image not loaded yet - draw placeholder diamond
            ctx.fillStyle = '#0ea5e9';
            ctx.beginPath();
            ctx.moveTo(x + w / 2, y);
            ctx.lineTo(x + w, y + h / 2);
            ctx.lineTo(x + w / 2, y + h);
            ctx.lineTo(x, y + h / 2);
            ctx.closePath();
            ctx.fill();
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
          // Priority: parks construction > construction > abandoned > parks > dense variants > farm variants > normal
          let spriteSource = activePack.src;
          let useDenseVariant: { row: number; col: number } | null = null;
          let useFarmVariant: { row: number; col: number } | null = null;
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
          } else if (activePack.farmsSrc && activePack.farmsVariants && activePack.farmsVariants[buildingType]) {
            // Check if this building type has farm variants available (low-density industrial)
            const variants = activePack.farmsVariants[buildingType];
            // Use deterministic random based on tile position to select variant
            // This ensures the same building always shows the same variant
            const seed = (tile.x * 31 + tile.y * 17) % 100;
            // ~50% chance to use a farm variant (when seed < 50)
            if (seed < 50 && variants.length > 0) {
              // Select which farm variant to use based on position
              const variantIndex = (tile.x * 7 + tile.y * 13) % variants.length;
              useFarmVariant = variants[variantIndex];
              spriteSource = activePack.farmsSrc;
            }
          }

          const filteredSpriteSheet = imageCache.get(`${spriteSource}_filtered`) || imageCache.get(spriteSource);
          
          if (filteredSpriteSheet) {
            // Use naturalWidth/naturalHeight for accurate source dimensions
            const sheetWidth = filteredSpriteSheet.naturalWidth || filteredSpriteSheet.width;
            const sheetHeight = filteredSpriteSheet.naturalHeight || filteredSpriteSheet.height;
            
            // Get sprite coordinates - either from parks, dense variant, farm variant, or normal mapping
            let coords: { sx: number; sy: number; sw: number; sh: number } | null;
            let isDenseVariant = false;
            let isFarmVariant = false;
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
            } else if (useFarmVariant) {
              isFarmVariant = true;
              // Calculate coordinates directly from farm variant row/col
              const farmsCols = activePack.farmsCols || 5;
              const farmsRows = activePack.farmsRows || 6;
              const tileWidth = Math.floor(sheetWidth / farmsCols);
              const tileHeight = Math.floor(sheetHeight / farmsRows);
              const sourceY = useFarmVariant.row * tileHeight;
              const sourceH = tileHeight;
              coords = {
                sx: useFarmVariant.col * tileWidth,
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
              // Special scale adjustment for airport (no scaling - was scaled up 5%, now scaled down 5%)
              if (buildingType === 'airport') {
                scaleMultiplier *= 1.0; // Scale down 5% from previous 1.05
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
              // Apply farm-specific scale if building uses farm variant and has custom scale in config
              if (isFarmVariant && activePack.farmsScales && buildingType in activePack.farmsScales) {
                scaleMultiplier *= activePack.farmsScales[buildingType];
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
              // Apply farm-specific horizontal offset if available
              if (isFarmVariant && activePack.farmsHorizontalOffsets && buildingType in activePack.farmsHorizontalOffsets) {
                horizontalOffset = activePack.farmsHorizontalOffsets[buildingType] * w;
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
              // Priority: parks-construction > construction > abandoned > parks > dense > building-type > sprite-key
              let extraOffset = 0;
              if (isUnderConstruction && isParksBuilding && activePack.parksConstructionVerticalOffsets && buildingType in activePack.parksConstructionVerticalOffsets) {
                // Parks building under construction - use parks construction offset
                extraOffset = activePack.parksConstructionVerticalOffsets[buildingType] * h;
              } else if (isUnderConstruction && activePack.constructionVerticalOffsets && buildingType in activePack.constructionVerticalOffsets) {
                extraOffset = activePack.constructionVerticalOffsets[buildingType] * h;
              } else if (isAbandoned && activePack.abandonedVerticalOffsets && buildingType in activePack.abandonedVerticalOffsets) {
                // Abandoned buildings may need different positioning than normal
                extraOffset = activePack.abandonedVerticalOffsets[buildingType] * h;
              } else if (isParksBuilding && activePack.parksVerticalOffsets && buildingType in activePack.parksVerticalOffsets) {
                // Parks buildings may need specific positioning
                extraOffset = activePack.parksVerticalOffsets[buildingType] * h;
              } else if (isDenseVariant && activePack.denseVerticalOffsets && buildingType in activePack.denseVerticalOffsets) {
                // Dense variants may need different positioning than normal
                extraOffset = activePack.denseVerticalOffsets[buildingType] * h;
              } else if (isFarmVariant && activePack.farmsVerticalOffsets && buildingType in activePack.farmsVerticalOffsets) {
                // Farm variants may need different positioning than normal
                extraOffset = activePack.farmsVerticalOffsets[buildingType] * h;
              } else if (activePack.buildingVerticalOffsets && buildingType in activePack.buildingVerticalOffsets) {
                // Building-type-specific offset (for buildings sharing sprites but needing different positioning)
                extraOffset = activePack.buildingVerticalOffsets[buildingType] * h;
              } else if (spriteKey && SPRITE_VERTICAL_OFFSETS[spriteKey]) {
                extraOffset = SPRITE_VERTICAL_OFFSETS[spriteKey] * h;
              }
              verticalPush += extraOffset;
              
              drawY = drawPosY + h - destHeight + verticalPush;
              
              // Check if building should be horizontally flipped
              // Some buildings are mirrored by default and the flip flag inverts that
              const defaultMirroredBuildings = ['marina_docks_small', 'pier_large'];
              const isDefaultMirrored = defaultMirroredBuildings.includes(buildingType);
              
              // Add 50% random mirroring for visual variety (deterministic based on tile position)
              // Use a different seed than dense variants to get independent randomness
              const mirrorSeed = (tile.x * 47 + tile.y * 83) % 100;
              const shouldRandomMirror = mirrorSeed < 50;
              
              // Final flip decision: combine default mirror state, explicit flip flag, and random mirror
              const baseFlipped = isDefaultMirrored ? !tile.building.flipped : tile.building.flipped === true;
              const isFlipped = baseFlipped !== shouldRandomMirror; // XOR: if both true or both false, no flip; if one true, flip
              
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
          } else {
            // Sprite sheet not loaded yet - draw placeholder building
            drawPlaceholderBuilding(ctx, x, y, buildingType, w, h);
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
        // Highlight subway stations when subway overlay is active
        const isSubwayStationHighlight = overlayMode === 'subway' && tile.building.type === 'subway_station';
        drawIsometricTile(ctx, screenX, screenY, tile, !!(isHovered || isSelected || isInDragRect || isSubwayStationHighlight), zoom, true, needsGreenBaseOverWater || needsGreenBaseForPark);
        
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
    
    // PERF: Use insertion sort instead of .sort() - O(n) for nearly-sorted data
    insertionSortByDepth(waterQueue);
    waterQueue.forEach(({ tile, screenX, screenY }) => {
      drawBuilding(ctx, screenX, screenY, tile);
    });
    
    ctx.restore(); // Remove clipping after drawing water
    
    // Draw beaches on water tiles (after water, outside clipping region)
    // Note: waterQueue is already sorted from above
    waterQueue.forEach(({ tile, screenX, screenY }) => {
        // Compute land adjacency for each edge (opposite of water adjacency)
        // Only consider tiles within bounds - don't draw beaches on map edges
        // Also exclude beaches next to marina docks and piers
        const adjacentLand = {
          north: (tile.x - 1 >= 0 && tile.x - 1 < gridSize && tile.y >= 0 && tile.y < gridSize) && !isWater(tile.x - 1, tile.y) && !hasMarinaPier(tile.x - 1, tile.y),
          east: (tile.x >= 0 && tile.x < gridSize && tile.y - 1 >= 0 && tile.y - 1 < gridSize) && !isWater(tile.x, tile.y - 1) && !hasMarinaPier(tile.x, tile.y - 1),
          south: (tile.x + 1 >= 0 && tile.x + 1 < gridSize && tile.y >= 0 && tile.y < gridSize) && !isWater(tile.x + 1, tile.y) && !hasMarinaPier(tile.x + 1, tile.y),
          west: (tile.x >= 0 && tile.x < gridSize && tile.y + 1 >= 0 && tile.y + 1 < gridSize) && !isWater(tile.x, tile.y + 1) && !hasMarinaPier(tile.x, tile.y + 1),
        };
        drawBeachOnWater(ctx, screenX, screenY, adjacentLand);
      });
    
    // Draw roads (above water, needs full redraw including base tile)
    insertionSortByDepth(roadQueue);
    roadQueue.forEach(({ tile, screenX, screenY }) => {
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
    insertionSortByDepth(greenBaseTileQueue);
    greenBaseTileQueue.forEach(({ tile, screenX, screenY }) => {
      drawGreenBaseTile(ctx, screenX, screenY, tile, zoom);
    });
    
    // Draw gray building base tiles (after water, before buildings)
    insertionSortByDepth(baseTileQueue);
    baseTileQueue.forEach(({ tile, screenX, screenY }) => {
      drawGreyBaseTile(ctx, screenX, screenY, tile, zoom);
    });
    
    // Note: Beach drawing has been moved to water tiles (drawBeachOnWater)
    // The beachQueue is no longer used for drawing beaches on land tiles
    
    
    // Draw buildings sorted by depth so multi-tile sprites sit above adjacent tiles
    insertionSortByDepth(buildingQueue);
    buildingQueue.forEach(({ tile, screenX, screenY }) => {
      drawBuilding(ctx, screenX, screenY, tile);
    });
    
    // Draw overlays last so they remain visible on top of buildings
    overlayQueue.forEach(({ tile, screenX, screenY }) => {
      // Get service coverage for this tile
      const coverage = {
        fire: state.services.fire[tile.y][tile.x],
        police: state.services.police[tile.y][tile.x],
        health: state.services.health[tile.y][tile.x],
        education: state.services.education[tile.y][tile.x],
      };
      
      ctx.fillStyle = getOverlayFillStyle(overlayMode, tile, coverage);
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
  }, [grid, gridSize, offset, zoom, hoveredTile, selectedTile, overlayMode, imagesLoaded, imageLoadVersion, canvasSize, dragStartTile, dragEndTile, state.services, currentSpritePack, waterBodies, isPartOfMultiTileBuilding, isPartOfParkBuilding, showsDragGrid]);
  
  // Animate decorative car traffic AND emergency vehicles on top of the base canvas
  useEffect(() => {
    const canvas = carsCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.imageSmoothingEnabled = false;
    
    let animationFrameId: number;
    let lastTime = performance.now();
    let lastRenderTime = 0;
    
    // Target 30fps on mobile (33ms per frame), 60fps on desktop (16ms per frame)
    const targetFrameTime = isMobile ? 33 : 16;
    
    const render = (time: number) => {
      animationFrameId = requestAnimationFrame(render);
      
      // Frame rate limiting for mobile - skip frames to maintain target FPS
      const timeSinceLastRender = time - lastRenderTime;
      if (isMobile && timeSinceLastRender < targetFrameTime) {
        return; // Skip this frame on mobile to reduce CPU load
      }
      
      const delta = Math.min((time - lastTime) / 1000, 0.3);
      lastTime = time;
      lastRenderTime = time;
      
      if (delta > 0) {
        updateCars(delta);
        spawnCrimeIncidents(delta); // Spawn new crime incidents
        updateCrimeIncidents(delta); // Update/decay crime incidents
        updateEmergencyVehicles(delta); // Update emergency vehicles!
        updatePedestrians(delta); // Update pedestrians (zoom-gated)
        updateAirplanes(delta); // Update airplanes (airport required)
        updateHelicopters(delta); // Update helicopters (hospital/airport required)
        updateBoats(delta); // Update boats (marina/pier required)
        updateFireworks(delta, hour); // Update fireworks (nighttime only)
        updateSmog(delta); // Update factory smog particles
        navLightFlashTimerRef.current += delta * 3; // Update nav light flash timer
      }
      drawCars(ctx);
      drawPedestrians(ctx); // Draw pedestrians (zoom-gated)
      drawBoats(ctx); // Draw boats on water
      drawSmog(ctx); // Draw factory smog (above ground, below aircraft)
      drawEmergencyVehicles(ctx); // Draw emergency vehicles!
      drawIncidentIndicators(ctx, delta); // Draw fire/crime incident indicators!
      drawHelicopters(ctx); // Draw helicopters (below planes, above ground)
      drawAirplanes(ctx); // Draw airplanes above everything
      drawFireworks(ctx); // Draw fireworks above everything (nighttime only)
    };
    
    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [canvasSize.width, canvasSize.height, updateCars, drawCars, spawnCrimeIncidents, updateCrimeIncidents, updateEmergencyVehicles, drawEmergencyVehicles, updatePedestrians, drawPedestrians, updateAirplanes, drawAirplanes, updateHelicopters, drawHelicopters, updateBoats, drawBoats, drawIncidentIndicators, updateFireworks, drawFireworks, updateSmog, drawSmog, hour, isMobile]);
  
  // Day/Night cycle lighting rendering - optimized for performance
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
    
    const darkness = getDarkness(hour);
    
    // Clear canvas first
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // If it's full daylight, just clear and return (early exit)
    if (darkness <= 0.01) return;
    
    // On mobile, use simplified lighting (just the overlay, skip individual lights)
    // This significantly reduces CPU usage on mobile devices
    if (isMobile && darkness > 0) {
      const getAmbientColor = (h: number): { r: number; g: number; b: number } => {
        if (h >= 7 && h < 18) return { r: 255, g: 255, b: 255 };
        if (h >= 5 && h < 7) {
          const t = (h - 5) / 2;
          return { r: Math.round(60 + 40 * t), g: Math.round(40 + 30 * t), b: Math.round(70 + 20 * t) };
        }
        if (h >= 18 && h < 20) {
          const t = (h - 18) / 2;
          return { r: Math.round(100 - 40 * t), g: Math.round(70 - 30 * t), b: Math.round(90 - 20 * t) };
        }
        return { r: 20, g: 30, b: 60 };
      };
      const ambient = getAmbientColor(hour);
      const alpha = darkness * 0.45; // Slightly less darkening on mobile
      ctx.fillStyle = `rgba(${ambient.r}, ${ambient.g}, ${ambient.b}, ${alpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }
    
    // Get ambient color based on time
    const getAmbientColor = (h: number): { r: number; g: number; b: number } => {
      if (h >= 7 && h < 18) return { r: 255, g: 255, b: 255 };
      if (h >= 5 && h < 7) {
        const t = (h - 5) / 2;
        return { r: Math.round(60 + 40 * t), g: Math.round(40 + 30 * t), b: Math.round(70 + 20 * t) };
      }
      if (h >= 18 && h < 20) {
        const t = (h - 18) / 2;
        return { r: Math.round(100 - 40 * t), g: Math.round(70 - 30 * t), b: Math.round(90 - 20 * t) };
      }
      return { r: 20, g: 30, b: 60 };
    };
    
    const ambient = getAmbientColor(hour);
    
    // Apply darkness overlay
    const alpha = darkness * 0.55;
    ctx.fillStyle = `rgba(${ambient.r}, ${ambient.g}, ${ambient.b}, ${alpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Calculate viewport bounds once
    const viewWidth = canvas.width / (dpr * zoom);
    const viewHeight = canvas.height / (dpr * zoom);
    const viewLeft = -offset.x / zoom - TILE_WIDTH * 2;
    const viewTop = -offset.y / zoom - TILE_HEIGHT * 4;
    const viewRight = viewWidth - offset.x / zoom + TILE_WIDTH * 2;
    const viewBottom = viewHeight - offset.y / zoom + TILE_HEIGHT * 4;
    
    // Calculate grid bounds to only iterate visible tiles
    // Convert viewport bounds to approximate grid coordinates
    const minGridY = Math.max(0, Math.floor((viewTop / TILE_HEIGHT) - gridSize / 2));
    const maxGridY = Math.min(gridSize - 1, Math.ceil((viewBottom / TILE_HEIGHT) + gridSize / 2));
    const minGridX = Math.max(0, Math.floor((viewLeft / TILE_WIDTH) + gridSize / 2));
    const maxGridX = Math.min(gridSize - 1, Math.ceil((viewRight / TILE_WIDTH) + gridSize / 2));
    
    const gridToScreen = (gx: number, gy: number) => ({
      screenX: (gx - gy) * TILE_WIDTH / 2,
      screenY: (gx + gy) * TILE_HEIGHT / 2,
    });
    
    const lightIntensity = Math.min(1, darkness * 1.2);
    
    // Pre-calculate pseudo-random function
    const pseudoRandom = (seed: number, n: number) => {
      const s = Math.sin(seed + n * 12.9898) * 43758.5453;
      return s - Math.floor(s);
    };
    
    // Set for building types that are not lit
    const nonLitTypes = new Set(['grass', 'empty', 'water', 'road', 'tree', 'park', 'park_large', 'tennis']);
    const residentialTypes = new Set(['house_small', 'house_medium', 'mansion', 'apartment_low', 'apartment_high']);
    const commercialTypes = new Set(['shop_small', 'shop_medium', 'office_low', 'office_high', 'mall']);
    
    // Collect light sources in a single pass through visible tiles
    const lightCutouts: Array<{x: number, y: number, type: 'road' | 'building', buildingType?: string, seed?: number}> = [];
    const coloredGlows: Array<{x: number, y: number, type: string}> = [];
    
    // Single pass through visible tiles to collect light sources
    for (let y = minGridY; y <= maxGridY; y++) {
      for (let x = minGridX; x <= maxGridX; x++) {
        const { screenX, screenY } = gridToScreen(x, y);
        
        // Viewport culling
        if (screenX + TILE_WIDTH < viewLeft || screenX > viewRight ||
            screenY + TILE_HEIGHT * 3 < viewTop || screenY > viewBottom) {
          continue;
        }
        
        const tile = grid[y][x];
        const buildingType = tile.building.type;
        
        if (buildingType === 'road') {
          lightCutouts.push({ x, y, type: 'road' });
          coloredGlows.push({ x, y, type: 'road' });
        } else if (!nonLitTypes.has(buildingType) && tile.building.powered) {
          lightCutouts.push({ x, y, type: 'building', buildingType, seed: x * 1000 + y });
          
          // Check for special colored glows
          if (buildingType === 'hospital' || buildingType === 'fire_station' || 
              buildingType === 'police_station' || buildingType === 'power_plant') {
            coloredGlows.push({ x, y, type: buildingType });
          }
        }
      }
    }
    
    // Draw light cutouts (destination-out)
    ctx.globalCompositeOperation = 'destination-out';
    ctx.save();
    ctx.scale(dpr * zoom, dpr * zoom);
    ctx.translate(offset.x / zoom, offset.y / zoom);
    
    for (const light of lightCutouts) {
      const { screenX, screenY } = gridToScreen(light.x, light.y);
      const tileCenterX = screenX + TILE_WIDTH / 2;
      const tileCenterY = screenY + TILE_HEIGHT / 2;
      
      if (light.type === 'road') {
        const lightRadius = 28;
        const gradient = ctx.createRadialGradient(tileCenterX, tileCenterY, 0, tileCenterX, tileCenterY, lightRadius);
        gradient.addColorStop(0, `rgba(255, 255, 255, ${0.7 * lightIntensity})`);
        gradient.addColorStop(0.4, `rgba(255, 255, 255, ${0.35 * lightIntensity})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(tileCenterX, tileCenterY, lightRadius, 0, Math.PI * 2);
        ctx.fill();
      } else if (light.type === 'building' && light.buildingType && light.seed !== undefined) {
        const buildingType = light.buildingType;
        const isResidential = residentialTypes.has(buildingType);
        const isCommercial = commercialTypes.has(buildingType);
        const glowStrength = isCommercial ? 0.85 : isResidential ? 0.6 : 0.7;
        
        let numWindows = 2;
        if (buildingType.includes('medium') || buildingType.includes('low')) numWindows = 3;
        if (buildingType.includes('high') || buildingType === 'mall') numWindows = 5;
        if (buildingType === 'mansion' || buildingType === 'office_high') numWindows = 4;
        
        const windowSize = 5;
        const buildingHeight = -18;
        
        for (let i = 0; i < numWindows; i++) {
          const isLit = pseudoRandom(light.seed, i) < (isResidential ? 0.55 : 0.75);
          if (!isLit) continue;
          
          const wx = tileCenterX + (pseudoRandom(light.seed, i + 10) - 0.5) * 22;
          const wy = tileCenterY + buildingHeight + (pseudoRandom(light.seed, i + 20) - 0.5) * 16;
          
          const gradient = ctx.createRadialGradient(wx, wy, 0, wx, wy, windowSize * 2.5);
          gradient.addColorStop(0, `rgba(255, 255, 255, ${glowStrength * lightIntensity})`);
          gradient.addColorStop(0.5, `rgba(255, 255, 255, ${glowStrength * 0.4 * lightIntensity})`);
          gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(wx, wy, windowSize * 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Ground glow
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
    
    ctx.restore();
    
    // Draw colored glows (source-over)
    ctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.scale(dpr * zoom, dpr * zoom);
    ctx.translate(offset.x / zoom, offset.y / zoom);
    
    for (const glow of coloredGlows) {
      const { screenX, screenY } = gridToScreen(glow.x, glow.y);
      const tileCenterX = screenX + TILE_WIDTH / 2;
      const tileCenterY = screenY + TILE_HEIGHT / 2;
      
      if (glow.type === 'road') {
        const gradient = ctx.createRadialGradient(tileCenterX, tileCenterY, 0, tileCenterX, tileCenterY, 20);
        gradient.addColorStop(0, `rgba(255, 210, 130, ${0.25 * lightIntensity})`);
        gradient.addColorStop(0.5, `rgba(255, 190, 100, ${0.1 * lightIntensity})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(tileCenterX, tileCenterY, 20, 0, Math.PI * 2);
        ctx.fill();
      } else {
        let glowColor: { r: number; g: number; b: number } | null = null;
        let glowRadius = 20;
        
        if (glow.type === 'hospital') {
          glowColor = { r: 255, g: 80, b: 80 };
          glowRadius = 25;
        } else if (glow.type === 'fire_station') {
          glowColor = { r: 255, g: 100, b: 50 };
          glowRadius = 22;
        } else if (glow.type === 'police_station') {
          glowColor = { r: 60, g: 140, b: 255 };
          glowRadius = 22;
        } else if (glow.type === 'power_plant') {
          glowColor = { r: 255, g: 200, b: 50 };
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
    }
    
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    
  }, [grid, gridSize, hour, offset, zoom, canvasSize.width, canvasSize.height, isMobile]);
  
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
        
        // Check for fire or crime incidents at this tile for tooltip display
        const tile = grid[gridY]?.[gridX];
        const crimeKey = `${gridX},${gridY}`;
        const crimeIncident = activeCrimeIncidentsRef.current.get(crimeKey);
        
        if (tile?.building.onFire) {
          // Fire incident
          setHoveredIncident({
            x: gridX,
            y: gridY,
            type: 'fire',
            screenX: e.clientX,
            screenY: e.clientY,
          });
        } else if (crimeIncident) {
          // Crime incident
          setHoveredIncident({
            x: gridX,
            y: gridY,
            type: 'crime',
            crimeType: crimeIncident.type,
            screenX: e.clientX,
            screenY: e.clientY,
          });
        } else {
          // No incident at this tile
          setHoveredIncident(null);
        }
        
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
  }, [isPanning, dragStart, offset, zoom, gridSize, isDragging, showsDragGrid, dragStartTile, selectedTool, roadDrawDirection, supportsDragPlace, placeAtTile, clampOffset, grid]);
  
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
      
      {selectedTile && selectedTool === 'select' && !isMobile && (
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
      
      {/* Incident Tooltip - shows when hovering over fire or crime */}
      {hoveredIncident && (() => {
        // Calculate position to avoid overflow
        const tooltipWidth = 200;
        const padding = 16;
        const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
        
        // Check if tooltip would overflow right edge
        const wouldOverflowRight = hoveredIncident.screenX + padding + tooltipWidth > viewportWidth - padding;
        const left = wouldOverflowRight 
          ? hoveredIncident.screenX - tooltipWidth - padding 
          : hoveredIncident.screenX + padding;
        
        return (
          <div 
            className="fixed pointer-events-none z-[100]"
            style={{ left, top: hoveredIncident.screenY - 8 }}
          >
            <div className="bg-sidebar border border-sidebar-border rounded-md shadow-lg px-3 py-2 w-[200px]">
              {/* Header */}
              <div className="flex items-center gap-2 mb-1">
                {hoveredIncident.type === 'fire' ? (
                  <FireIcon size={14} className="text-red-400" />
                ) : (
                  <SafetyIcon size={14} className="text-blue-400" />
                )}
                <span className="text-xs font-semibold text-sidebar-foreground">
                  {hoveredIncident.type === 'fire' ? 'Fire' : 
                   hoveredIncident.crimeType === 'robbery' ? 'Robbery' :
                   hoveredIncident.crimeType === 'burglary' ? 'Burglary' :
                   hoveredIncident.crimeType === 'disturbance' ? 'Disturbance' :
                   'Traffic Incident'}
                </span>
              </div>
              
              {/* Description */}
              <p className="text-[11px] text-muted-foreground leading-tight">
                {hoveredIncident.type === 'fire' 
                  ? 'Building on fire. Fire trucks responding.'
                  : hoveredIncident.crimeType === 'robbery' ? 'Armed robbery in progress.'
                  : hoveredIncident.crimeType === 'burglary' ? 'Break-in detected.'
                  : hoveredIncident.crimeType === 'disturbance' ? 'Public disturbance reported.'
                  : 'Traffic violation in progress.'}
              </p>
              
              {/* Location */}
              <div className="mt-1.5 pt-1.5 border-t border-sidebar-border/50 text-[10px] text-muted-foreground/60 font-mono">
                ({hoveredIncident.x}, {hoveredIncident.y})
              </div>
            </div>
          </div>
        );
      })()}
      
    </div>
  );
}

export default function Game() {
  const { state, setTool, setActivePanel, addMoney, addNotification, setSpeed } = useGame();
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
    
    // Select tool always resets overlay to none (user is explicitly switching to select)
    if (state.selectedTool === 'select') {
      setTimeout(() => {
        setOverlayMode('none');
      }, 0);
      previousSelectedToolRef.current = state.selectedTool;
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
      setOverlayMode(getOverlayForTool(state.selectedTool));
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
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        // Toggle pause/unpause: if paused (speed 0), resume to normal (speed 1)
        // If running, pause (speed 0)
        setSpeed(state.speed === 0 ? 1 : 0);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.activePanel, state.selectedTool, state.speed, selectedTile, setActivePanel, setTool, setSpeed, overlayMode]);

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
          <MobileTopBar 
            selectedTile={selectedTile && state.selectedTool === 'select' ? state.grid[selectedTile.y][selectedTile.x] : null}
            services={state.services}
            onCloseTile={() => setSelectedTile(null)}
          />
          
          {/* Main canvas area - fills remaining space, with padding for top/bottom bars */}
          <div className="flex-1 relative overflow-hidden" style={{ paddingTop: '72px', paddingBottom: '76px' }}>
            <CanvasIsometricGrid 
              overlayMode={overlayMode} 
              selectedTile={selectedTile} 
              setSelectedTile={setSelectedTile}
              isMobile={true}
            />
          </div>
          
          {/* Mobile Bottom Toolbar */}
          <MobileToolbar 
            onOpenPanel={(panel) => setActivePanel(panel)}
            overlayMode={overlayMode}
            setOverlayMode={setOverlayMode}
          />
          
          {/* Panels - render as fullscreen modals on mobile */}
          {state.activePanel === 'budget' && <BudgetPanel />}
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
        {state.activePanel === 'statistics' && <StatisticsPanel />}
        {state.activePanel === 'advisors' && <AdvisorsPanel />}
        {state.activePanel === 'settings' && <SettingsPanel />}
        
        <VinnieDialog open={showVinnieDialog} onOpenChange={setShowVinnieDialog} />
        <CommandMenu />
      </div>
    </TooltipProvider>
  );
}
