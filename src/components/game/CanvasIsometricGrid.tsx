'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useGame } from '@/context/GameContext';
import { TOOL_INFO, Tile, BuildingType, AdjacentCity, CompetitiveUnit } from '@/types/game';
import { getBuildingSize, requiresWaterAdjacency, getWaterAdjacency, getRoadAdjacency } from '@/lib/simulation';
import { FireIcon, SafetyIcon } from '@/components/ui/Icons';
import { getSpriteCoords, BUILDING_TO_SPRITE, SPRITE_VERTICAL_OFFSETS, SPRITE_HORIZONTAL_OFFSETS, getActiveSpritePack } from '@/lib/renderConfig';

// Import shadcn components
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

// Import extracted game components, types, and utilities
import {
  TILE_WIDTH,
  TILE_HEIGHT,
  KEY_PAN_SPEED,
  Car,
  Airplane,
  Helicopter,
  Seaplane,
  EmergencyVehicle,
  Boat,
  Barge,
  TourWaypoint,
  FactorySmog,
  OverlayMode,
  Pedestrian,
  Firework,
  WorldRenderState,
} from '@/components/game/types';
import {
  TRAFFIC_LIGHT_MIN_ZOOM,
  DIRECTION_ARROWS_MIN_ZOOM,
  MEDIAN_PLANTS_MIN_ZOOM,
  LANE_MARKINGS_MIN_ZOOM,
  SIDEWALK_MIN_ZOOM,
  SIDEWALK_MIN_ZOOM_MOBILE,
  SKIP_SMALL_ELEMENTS_ZOOM_THRESHOLD,
  ZOOM_MIN,
  ZOOM_MAX,
  WATER_ASSET_PATH,
  AIRPLANE_SPRITE_SRC,
} from '@/components/game/constants';
import {
  gridToScreen,
  screenToGrid,
} from '@/components/game/utils';
import {
  drawGreenBaseTile,
  drawGreyBaseTile,
  drawBeachOnWater,
  drawFoundationPlot,
} from '@/components/game/drawing';
import {
  getOverlayFillStyle,
} from '@/components/game/overlays';
import { drawPlaceholderBuilding } from '@/components/game/placeholders';
import { loadImage, loadSpriteImage, onImageLoaded, getCachedImage } from '@/components/game/imageLoader';
import { TileInfoPanel } from '@/components/game/panels';
import {
  findMarinasAndPiers,
  findAdjacentWaterTile,
  isOverWater,
  generateTourWaypoints,
} from '@/components/game/gridFinders';
import { drawAirplanes as drawAirplanesUtil, drawHelicopters as drawHelicoptersUtil, drawSeaplanes as drawSeaplanesUtil } from '@/components/game/drawAircraft';
import { useVehicleSystems, VehicleSystemRefs, VehicleSystemState } from '@/components/game/vehicleSystems';
import { useBuildingHelpers } from '@/components/game/buildingHelpers';
import { useAircraftSystems, AircraftSystemRefs, AircraftSystemState } from '@/components/game/aircraftSystems';
import { useBargeSystem, BargeSystemRefs, BargeSystemState } from '@/components/game/bargeSystem';
import { useBoatSystem, BoatSystemRefs, BoatSystemState } from '@/components/game/boatSystem';
import { useSeaplaneSystem, SeaplaneSystemRefs, SeaplaneSystemState } from '@/components/game/seaplaneSystem';
import { useEffectsSystems, EffectsSystemRefs, EffectsSystemState } from '@/components/game/effectsSystems';
import {
  analyzeMergedRoad,
  getTrafficLightState,
  drawTrafficLight,
  getTrafficFlowDirection,
  drawCrosswalks,
  ROAD_COLORS,
  drawRoadArrow,
} from '@/components/game/trafficSystem';
import { CrimeType, getCrimeName, getCrimeDescription, getFireDescriptionForTile, getFireNameForTile } from '@/components/game/incidentData';
import {
  drawRailTrack,
  drawRailTracksOnly,
  countRailTiles,
  isRailroadCrossing,
  findRailroadCrossings,
  drawRailroadCrossing,
  getCrossingStateForTile,
  GATE_ANIMATION_SPEED,
} from '@/components/game/railSystem';
import {
  spawnTrain,
  updateTrain,
  drawTrains,
  MIN_RAIL_TILES_FOR_TRAINS,
  MAX_TRAINS,
  TRAIN_SPAWN_INTERVAL,
  TRAINS_PER_RAIL_TILES,
} from '@/components/game/trainSystem';
import { Train } from '@/components/game/types';

// Props interface for CanvasIsometricGrid
export interface CanvasIsometricGridProps {
  overlayMode: OverlayMode;
  selectedTile: { x: number; y: number } | null;
  setSelectedTile: (tile: { x: number; y: number } | null) => void;
  isMobile?: boolean;
  navigationTarget?: { x: number; y: number } | null;
  onNavigationComplete?: () => void;
  onViewportChange?: (viewport: { offset: { x: number; y: number }; zoom: number; canvasSize: { width: number; height: number } }) => void;
  onBargeDelivery?: (cargoValue: number, cargoType: number) => void;
}

// Canvas-based Isometric Grid - HIGH PERFORMANCE
export function CanvasIsometricGrid({ overlayMode, selectedTile, setSelectedTile, isMobile = false, navigationTarget, onNavigationComplete, onViewportChange, onBargeDelivery }: CanvasIsometricGridProps) {
  const { state, placeAtTile, connectToCity, checkAndDiscoverCities, currentSpritePack, visualHour, issueUnitOrders } = useGame();
  const { grid, gridSize, selectedTool, speed, adjacentCities, waterBodies, gameVersion } = state;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoverCanvasRef = useRef<HTMLCanvasElement>(null); // PERF: Separate canvas for hover/selection highlights
  const carsCanvasRef = useRef<HTMLCanvasElement>(null);
  const buildingsCanvasRef = useRef<HTMLCanvasElement>(null); // Buildings rendered on top of cars/trains
  const airCanvasRef = useRef<HTMLCanvasElement>(null); // Aircraft + fireworks rendered above buildings
  const lightingCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderPendingRef = useRef<number | null>(null); // PERF: Track pending render frame
  const [offset, setOffset] = useState({ x: isMobile ? 200 : 620, y: isMobile ? 100 : 160 });
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const isPanningRef = useRef(false); // Ref for animation loop to check panning state
  const isPinchZoomingRef = useRef(false); // Ref for animation loop to check pinch zoom state
  const zoomRef = useRef(isMobile ? 0.6 : 1); // Ref for animation loop to check zoom level
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredTile, setHoveredTile] = useState<{ x: number; y: number } | null>(null);
  const [hoveredIncident, setHoveredIncident] = useState<{
    x: number;
    y: number;
    type: 'fire' | 'crime';
    crimeType?: CrimeType;
    screenX: number;
    screenY: number;
  } | null>(null);
  const [zoom, setZoom] = useState(isMobile ? 0.6 : 1);

  // Competitive / RTS overlays (units, fog, orders)
  const isCompetitive = state.gameMode === 'competitive' && !!state.competitive;
  const competitiveUnits = useMemo<CompetitiveUnit[]>(() => state.competitive?.units ?? [], [state.competitive?.units]);
  const fogRevealed = state.competitive?.fog.revealed;
  const humanPlayerId = state.competitive?.humanPlayerId;
  const playerColorById = useMemo(() => {
    const entries = state.competitive?.players?.map(p => [p.id, p.color] as const) ?? [];
    return new Map(entries);
  }, [state.competitive?.players]);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const selectedUnitIdsRef = useRef<string[]>([]);
  useEffect(() => {
    selectedUnitIdsRef.current = selectedUnitIds;
  }, [selectedUnitIds]);
  const pendingSelectTileRef = useRef<{ x: number; y: number } | null>(null);
  const [unitDragStartWorld, setUnitDragStartWorld] = useState<{ x: number; y: number } | null>(null);
  const [unitDragEndWorld, setUnitDragEndWorld] = useState<{ x: number; y: number } | null>(null);
  const [isUnitSelecting, setIsUnitSelecting] = useState(false);
  
  // Note: unit selection is intentionally local UI state; we avoid resetting it in an effect
  // to comply with the project's lint rules around setState-in-effect.

  const carsRef = useRef<Car[]>([]);
  const carIdRef = useRef(0);
  const carSpawnTimerRef = useRef(0);
  const emergencyVehiclesRef = useRef<EmergencyVehicle[]>([]);
  const emergencyVehicleIdRef = useRef(0);
  const emergencyDispatchTimerRef = useRef(0);
  const activeFiresRef = useRef<Set<string>>(new Set()); // Track fires that already have a truck dispatched
  const activeCrimesRef = useRef<Set<string>>(new Set()); // Track crimes that already have a car dispatched
  const activeCrimeIncidentsRef = useRef<Map<string, { x: number; y: number; type: CrimeType; timeRemaining: number }>>(new Map()); // Persistent crime incidents
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

  // Helicopter system refs
  const helicoptersRef = useRef<Helicopter[]>([]);
  const helicopterIdRef = useRef(0);
  const helicopterSpawnTimerRef = useRef(0);

  // Seaplane system refs
  const seaplanesRef = useRef<Seaplane[]>([]);
  const seaplaneIdRef = useRef(0);
  const seaplaneSpawnTimerRef = useRef(0);

  // Boat system refs
  const boatsRef = useRef<Boat[]>([]);
  const boatIdRef = useRef(0);
  const boatSpawnTimerRef = useRef(0);

  // Barge system refs (ocean cargo ships)
  const bargesRef = useRef<Barge[]>([]);
  const bargeIdRef = useRef(0);
  const bargeSpawnTimerRef = useRef(0);

  // Train system refs
  const trainsRef = useRef<Train[]>([]);
  const trainIdRef = useRef(0);
  const trainSpawnTimerRef = useRef(0);

  // Navigation light flash timer for planes/helicopters/boats at night
  const navLightFlashTimerRef = useRef(0);

  // Railroad crossing state
  const crossingFlashTimerRef = useRef(0);
  const crossingGateAnglesRef = useRef<Map<number, number>>(new Map()); // key = y * gridSize + x, value = angle (0=open, 90=closed)
  const crossingPositionsRef = useRef<{x: number, y: number}[]>([]); // Cached crossing positions for O(1) iteration

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

  // Traffic light system timer (cumulative time for cycling through states)
  const trafficLightTimerRef = useRef(0);

  // Performance: Cache expensive grid calculations
  const cachedRoadTileCountRef = useRef<{ count: number; gridVersion: number }>({ count: 0, gridVersion: -1 });
  const cachedPopulationRef = useRef<{ count: number; gridVersion: number }>({ count: 0, gridVersion: -1 });
  const gridVersionRef = useRef(0);
  
  // Performance: Cache road merge analysis (expensive calculation done per-road-tile)
  const roadAnalysisCacheRef = useRef<Map<string, ReturnType<typeof analyzeMergedRoad>>>(new Map());
  const roadAnalysisCacheVersionRef = useRef(-1);

  // PERF: Render queue arrays cached across frames to reduce GC pressure
  // These are cleared at the start of each render frame with .length = 0
  type BuildingDrawItem = { screenX: number; screenY: number; tile: Tile; depth: number };
  type OverlayDrawItem = { screenX: number; screenY: number; tile: Tile };
  const renderQueuesRef = useRef({
    buildingQueue: [] as BuildingDrawItem[],
    waterQueue: [] as BuildingDrawItem[],
    roadQueue: [] as BuildingDrawItem[],
    railQueue: [] as BuildingDrawItem[],
    beachQueue: [] as BuildingDrawItem[],
    baseTileQueue: [] as BuildingDrawItem[],
    greenBaseTileQueue: [] as BuildingDrawItem[],
    overlayQueue: [] as OverlayDrawItem[],
  });

  const worldStateRef = useRef<WorldRenderState>({
    grid,
    gridSize,
    offset,
    zoom,
    speed,
    canvasSize: { width: 1200, height: 800 },
  });
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

  // Use extracted building helpers (with pre-computed tile metadata for O(1) lookups)
  const { isPartOfMultiTileBuilding, findBuildingOrigin, isPartOfParkBuilding, getTileMetadata } = useBuildingHelpers(grid, gridSize);

  // Use extracted vehicle systems
  const vehicleSystemRefs: VehicleSystemRefs = {
    carsRef,
    carIdRef,
    carSpawnTimerRef,
    emergencyVehiclesRef,
    emergencyVehicleIdRef,
    emergencyDispatchTimerRef,
    activeFiresRef,
    activeCrimesRef,
    activeCrimeIncidentsRef,
    crimeSpawnTimerRef,
    pedestriansRef,
    pedestrianIdRef,
    pedestrianSpawnTimerRef,
    trafficLightTimerRef,
    trainsRef,
  };

  const vehicleSystemState: VehicleSystemState = {
    worldStateRef,
    gridVersionRef,
    cachedRoadTileCountRef,
    state: {
      services: state.services,
      stats: state.stats,
    },
    isMobile,
  };

  const {
    spawnRandomCar,
    spawnPedestrian,
    spawnCrimeIncidents,
    updateCrimeIncidents,
    findCrimeIncidents,
    dispatchEmergencyVehicle,
    updateEmergencyDispatch,
    updateEmergencyVehicles,
    updateCars,
    updatePedestrians,
    drawCars,
    drawPedestrians,
    drawRecreationPedestrians,
    drawEmergencyVehicles,
    drawIncidentIndicators,
  } = useVehicleSystems(vehicleSystemRefs, vehicleSystemState);

  // Use extracted aircraft systems
  const aircraftSystemRefs: AircraftSystemRefs = {
    airplanesRef,
    airplaneIdRef,
    airplaneSpawnTimerRef,
    helicoptersRef,
    helicopterIdRef,
    helicopterSpawnTimerRef,
  };

  const aircraftSystemState: AircraftSystemState = {
    worldStateRef,
    gridVersionRef,
    cachedPopulationRef,
    isMobile,
  };

  const {
    updateAirplanes,
    updateHelicopters,
  } = useAircraftSystems(aircraftSystemRefs, aircraftSystemState);

  // Use extracted seaplane system
  const seaplaneSystemRefs: SeaplaneSystemRefs = {
    seaplanesRef,
    seaplaneIdRef,
    seaplaneSpawnTimerRef,
  };

  const seaplaneSystemState: SeaplaneSystemState = {
    worldStateRef,
    gridVersionRef,
    cachedPopulationRef,
    isMobile,
  };

  const {
    updateSeaplanes,
  } = useSeaplaneSystem(seaplaneSystemRefs, seaplaneSystemState);

  // Use extracted barge system
  const bargeSystemRefs: BargeSystemRefs = {
    bargesRef,
    bargeIdRef,
    bargeSpawnTimerRef,
  };

  const bargeSystemState: BargeSystemState = {
    worldStateRef,
    isMobile,
    visualHour,
    onBargeDelivery,
  };

  const {
    updateBarges,
    drawBarges,
  } = useBargeSystem(bargeSystemRefs, bargeSystemState);

  // Use extracted boat system
  const boatSystemRefs: BoatSystemRefs = {
    boatsRef,
    boatIdRef,
    boatSpawnTimerRef,
  };

  const boatSystemState: BoatSystemState = {
    worldStateRef,
    isMobile,
    visualHour,
  };

  const {
    updateBoats,
    drawBoats,
  } = useBoatSystem(boatSystemRefs, boatSystemState);

  // Use extracted effects systems (fireworks and smog)
  const effectsSystemRefs: EffectsSystemRefs = {
    fireworksRef,
    fireworkIdRef,
    fireworkSpawnTimerRef,
    fireworkShowActiveRef,
    fireworkShowStartTimeRef,
    fireworkLastHourRef,
    factorySmogRef,
    smogLastGridVersionRef,
  };

  const effectsSystemState: EffectsSystemState = {
    worldStateRef,
    gridVersionRef,
    isMobile,
  };

  const {
    updateFireworks,
    drawFireworks,
    updateSmog,
    drawSmog,
  } = useEffectsSystems(effectsSystemRefs, effectsSystemState);
  
  useEffect(() => {
    worldStateRef.current.grid = grid;
    worldStateRef.current.gridSize = gridSize;
    // Increment grid version to invalidate cached calculations
    gridVersionRef.current++;
    // Cache crossing positions for O(n) iteration instead of O(n²) grid scan
    crossingPositionsRef.current = findRailroadCrossings(grid, gridSize);
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

  // Clear all vehicles/entities when game version changes (new game, load state, etc.)
  useEffect(() => {
    // Clear all vehicle refs
    carsRef.current = [];
    carIdRef.current = 0;
    carSpawnTimerRef.current = 0;
    emergencyVehiclesRef.current = [];
    emergencyVehicleIdRef.current = 0;
    emergencyDispatchTimerRef.current = 0;
    activeFiresRef.current.clear();
    activeCrimesRef.current.clear();
    activeCrimeIncidentsRef.current.clear();
    crimeSpawnTimerRef.current = 0;
    
    // Clear pedestrians
    pedestriansRef.current = [];
    pedestrianIdRef.current = 0;
    pedestrianSpawnTimerRef.current = 0;
    
    // Clear aircraft
    airplanesRef.current = [];
    airplaneIdRef.current = 0;
    airplaneSpawnTimerRef.current = 0;
    helicoptersRef.current = [];
    helicopterIdRef.current = 0;
    helicopterSpawnTimerRef.current = 0;
    seaplanesRef.current = [];
    seaplaneIdRef.current = 0;
    seaplaneSpawnTimerRef.current = 0;

    // Clear boats
    boatsRef.current = [];
    boatIdRef.current = 0;
    boatSpawnTimerRef.current = 0;
    
    // Clear barges
    bargesRef.current = [];
    bargeIdRef.current = 0;
    bargeSpawnTimerRef.current = 0;
    
    // Clear trains
    trainsRef.current = [];
    trainIdRef.current = 0;
    trainSpawnTimerRef.current = 0;
    
    // Clear fireworks
    fireworksRef.current = [];
    fireworkIdRef.current = 0;
    fireworkSpawnTimerRef.current = 0;
    fireworkShowActiveRef.current = false;
    
    // Clear factory smog
    factorySmogRef.current = [];
    smogLastGridVersionRef.current = -1;
    
    // Reset traffic light timer
    trafficLightTimerRef.current = 0;
  }, [gameVersion]);

  // Sync isPanning state to ref for animation loop access
  useEffect(() => {
    isPanningRef.current = isPanning;
  }, [isPanning]);
  
  // Sync zoom state to ref for animation loop access
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

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

  // Find marinas and piers (uses imported utility)
  const findMarinasAndPiersCallback = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findMarinasAndPiers(currentGrid, currentGridSize);
  }, []);

  // Find adjacent water tile (uses imported utility)
  const findAdjacentWaterTileCallback = useCallback((dockX: number, dockY: number) => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findAdjacentWaterTile(currentGrid, currentGridSize, dockX, dockY);
  }, []);

  // Check if screen position is over water (uses imported utility)
  const isOverWaterCallback = useCallback((screenX: number, screenY: number): boolean => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return isOverWater(currentGrid, currentGridSize, screenX, screenY);
  }, []);

  // Generate tour waypoints (uses imported utility)
  const generateTourWaypointsCallback = useCallback((startTileX: number, startTileY: number): TourWaypoint[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return generateTourWaypoints(currentGrid, currentGridSize, startTileX, startTileY);
  }, []);

  // Draw airplanes with contrails (uses extracted utility)
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
    const viewBounds = {
      viewLeft: -currentOffset.x / currentZoom - 200,
      viewTop: -currentOffset.y / currentZoom - 200,
      viewRight: viewWidth - currentOffset.x / currentZoom + 200,
      viewBottom: viewHeight - currentOffset.y / currentZoom + 200,
    };
    
    // Use extracted utility function for drawing
    drawAirplanesUtil(ctx, airplanesRef.current, viewBounds, visualHour, navLightFlashTimerRef.current, isMobile);
    
    ctx.restore();
  }, [visualHour, isMobile]);

  // Draw helicopters with rotor wash (uses extracted utility)
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
    const viewBounds = {
      viewLeft: -currentOffset.x / currentZoom - 100,
      viewTop: -currentOffset.y / currentZoom - 100,
      viewRight: viewWidth - currentOffset.x / currentZoom + 100,
      viewBottom: viewHeight - currentOffset.y / currentZoom + 100,
    };
    
    // Use extracted utility function for drawing
    drawHelicoptersUtil(ctx, helicoptersRef.current, viewBounds, visualHour, navLightFlashTimerRef.current, isMobile, currentZoom);
    
    ctx.restore();
  }, [visualHour, isMobile]);

  // Draw seaplanes with wakes and contrails (uses extracted utility)
  const drawSeaplanes = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;

    // Early exit if no seaplanes
    if (!currentGrid || currentGridSize <= 0 || seaplanesRef.current.length === 0) {
      return;
    }

    ctx.save();
    ctx.scale(dpr * currentZoom, dpr * currentZoom);
    ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);

    const viewWidth = canvas.width / (dpr * currentZoom);
    const viewHeight = canvas.height / (dpr * currentZoom);
    const viewBounds = {
      viewLeft: -currentOffset.x / currentZoom - 200,
      viewTop: -currentOffset.y / currentZoom - 200,
      viewRight: viewWidth - currentOffset.x / currentZoom + 200,
      viewBottom: viewHeight - currentOffset.y / currentZoom + 200,
    };

    // Use extracted utility function for drawing
    drawSeaplanesUtil(ctx, seaplanesRef.current, viewBounds, visualHour, navLightFlashTimerRef.current, isMobile);

    ctx.restore();
  }, [visualHour, isMobile]);

  // Boats are now handled by useBoatSystem hook (see above)

  // Update trains - spawn, move, and manage lifecycle
  const updateTrains = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;

    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
      return;
    }

    // Count rail tiles
    const railTileCount = countRailTiles(currentGrid, currentGridSize);
    
    // No trains if not enough rail
    if (railTileCount < MIN_RAIL_TILES_FOR_TRAINS) {
      trainsRef.current = [];
      return;
    }

    // Calculate max trains based on rail network size
    const maxTrains = Math.min(MAX_TRAINS, Math.ceil(railTileCount / TRAINS_PER_RAIL_TILES));
    
    // Speed multiplier based on game speed
    const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2 : 3;

    // Spawn timer
    trainSpawnTimerRef.current -= delta;
    if (trainsRef.current.length < maxTrains && trainSpawnTimerRef.current <= 0) {
      const newTrain = spawnTrain(currentGrid, currentGridSize, trainIdRef);
      if (newTrain) {
        trainsRef.current.push(newTrain);
      }
      trainSpawnTimerRef.current = TRAIN_SPAWN_INTERVAL;
    }

    // Update existing trains (pass all trains for collision detection)
    const allTrains = trainsRef.current;
    trainsRef.current = trainsRef.current.filter(train => 
      updateTrain(train, delta, speedMultiplier, currentGrid, currentGridSize, allTrains, isMobile)
    );
  }, [isMobile]);

  // Draw trains on the rail network
  const drawTrainsCallback = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize, canvasSize: size } = worldStateRef.current;

    if (!currentGrid || currentGridSize <= 0 || trainsRef.current.length === 0) {
      return;
    }

    drawTrains(ctx, trainsRef.current, currentOffset, currentZoom, size, currentGrid, currentGridSize, visualHour, isMobile);
  }, [visualHour, isMobile]);

  // Fireworks and smog are now handled by useEffectsSystems hook (see above)



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
    loadImage(WATER_ASSET_PATH).catch(console.error);
    
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
      if (currentSpritePack.shopsSrc) {
        loadSpriteImage(currentSpritePack.shopsSrc, true).catch(console.error);
      }
      if (currentSpritePack.stationsSrc) {
        loadSpriteImage(currentSpritePack.stationsSrc, true).catch(console.error);
      }
      if (currentSpritePack.modernSrc) {
        loadSpriteImage(currentSpritePack.modernSrc, true).catch(console.error);
      }
      // Load airplane sprite sheet (always loaded, not dependent on sprite pack)
      loadSpriteImage(AIRPLANE_SPRITE_SRC, false).catch(console.error);
    };
    
    // Load secondary sheets after 50ms to prioritize first paint
    const timer = setTimeout(loadSecondarySheets, 50);
    return () => clearTimeout(timer);
  }, [currentSpritePack]);
  
  // Building helper functions moved to buildingHelpers.ts
  
  // Update canvas size on resize with high-DPI support
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current && canvasRef.current) {
        const dpr = window.devicePixelRatio || 1;
        const rect = containerRef.current.getBoundingClientRect();
        
        // Set display size
        canvasRef.current.style.width = `${rect.width}px`;
        canvasRef.current.style.height = `${rect.height}px`;
        if (hoverCanvasRef.current) {
          hoverCanvasRef.current.style.width = `${rect.width}px`;
          hoverCanvasRef.current.style.height = `${rect.height}px`;
        }
        if (carsCanvasRef.current) {
          carsCanvasRef.current.style.width = `${rect.width}px`;
          carsCanvasRef.current.style.height = `${rect.height}px`;
        }
        if (buildingsCanvasRef.current) {
          buildingsCanvasRef.current.style.width = `${rect.width}px`;
          buildingsCanvasRef.current.style.height = `${rect.height}px`;
        }
        if (airCanvasRef.current) {
          airCanvasRef.current.style.width = `${rect.width}px`;
          airCanvasRef.current.style.height = `${rect.height}px`;
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
  
  // Main render function - PERF: Uses requestAnimationFrame throttling to batch multiple state updates
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imagesLoaded) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // PERF: Cancel any pending render to avoid duplicate work
    if (renderPendingRef.current !== null) {
      cancelAnimationFrame(renderPendingRef.current);
    }
    
    // PERF: Defer render to next animation frame - batches multiple state updates into one render
    renderPendingRef.current = requestAnimationFrame(() => {
      renderPendingRef.current = null;
      
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
    
    // PERF: Pre-compute visible diagonal range to skip entire rows of tiles
    // In isometric rendering, screenY = (x + y) * (TILE_HEIGHT / 2), so sum = x + y = screenY * 2 / TILE_HEIGHT
    // Add padding for tall buildings that may extend above their tile position
    const visibleMinSum = Math.max(0, Math.floor((viewTop - TILE_HEIGHT * 6) * 2 / TILE_HEIGHT));
    const visibleMaxSum = Math.min(gridSize * 2 - 2, Math.ceil((viewBottom + TILE_HEIGHT) * 2 / TILE_HEIGHT));
    
    // PERF: Use cached render queue arrays to avoid GC pressure
    // Clear arrays by setting length = 0 (much faster than recreating)
    const queues = renderQueuesRef.current;
    queues.buildingQueue.length = 0;
    queues.waterQueue.length = 0;
    queues.roadQueue.length = 0;
    queues.railQueue.length = 0;
    queues.beachQueue.length = 0;
    queues.baseTileQueue.length = 0;
    queues.greenBaseTileQueue.length = 0;
    queues.overlayQueue.length = 0;

    const buildingQueue = queues.buildingQueue;
    const waterQueue = queues.waterQueue;
    const roadQueue = queues.roadQueue;
    const railQueue = queues.railQueue;
    const beachQueue = queues.beachQueue;
    const baseTileQueue = queues.baseTileQueue;
    const greenBaseTileQueue = queues.greenBaseTileQueue;
    const overlayQueue = queues.overlayQueue;
    
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
    
    // Helper function to check if a tile is adjacent to water (uses pre-computed metadata for O(1) lookup)
    function isAdjacentToWater(gridX: number, gridY: number): boolean {
      const metadata = getTileMetadata(gridX, gridY);
      return metadata?.isAdjacentToWater ?? false;
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
    
    // Helper to get cached road merge analysis (invalidates when grid changes)
    function getCachedMergeInfo(gx: number, gy: number): ReturnType<typeof analyzeMergedRoad> {
      const currentVersion = gridVersionRef.current;
      if (roadAnalysisCacheVersionRef.current !== currentVersion) {
        roadAnalysisCacheRef.current.clear();
        roadAnalysisCacheVersionRef.current = currentVersion;
      }
      
      const key = `${gx},${gy}`;
      let info = roadAnalysisCacheRef.current.get(key);
      if (!info) {
        info = analyzeMergedRoad(grid, gridSize, gx, gy);
        roadAnalysisCacheRef.current.set(key, info);
      }
      return info;
    }
    
    // Draw sophisticated road with merged avenues/highways, traffic lights, and proper lane directions
    function drawRoad(ctx: CanvasRenderingContext2D, x: number, y: number, gridX: number, gridY: number, currentZoom: number) {
      const w = TILE_WIDTH;
      const h = TILE_HEIGHT;
      const cx = x + w / 2;
      const cy = y + h / 2;
      
      // Check adjacency (in isometric coordinates)
      const north = hasRoad(gridX - 1, gridY);  // top-left edge
      const east = hasRoad(gridX, gridY - 1);   // top-right edge
      const south = hasRoad(gridX + 1, gridY);  // bottom-right edge
      const west = hasRoad(gridX, gridY + 1);   // bottom-left edge
      const adj = { north, east, south, west };
      
      // Analyze if this road is part of a merged avenue/highway (CACHED for performance)
      const mergeInfo = getCachedMergeInfo(gridX, gridY);
      
      // Calculate base road width based on road type
      const laneWidthRatio = mergeInfo.type === 'highway' ? 0.16 :
                            mergeInfo.type === 'avenue' ? 0.15 :
                            0.14;
      const roadW = w * laneWidthRatio;
      
      // Sidewalk configuration
      const sidewalkWidth = w * 0.08;
      const sidewalkColor = ROAD_COLORS.SIDEWALK;
      const curbColor = ROAD_COLORS.CURB;
      
      // Edge stop distance
      const edgeStop = 0.98;
      
      // Calculate edge midpoints
      const northEdgeX = x + w * 0.25;
      const northEdgeY = y + h * 0.25;
      const eastEdgeX = x + w * 0.75;
      const eastEdgeY = y + h * 0.25;
      const southEdgeX = x + w * 0.75;
      const southEdgeY = y + h * 0.75;
      const westEdgeX = x + w * 0.25;
      const westEdgeY = y + h * 0.75;
      
      // Direction vectors
      const northDx = (northEdgeX - cx) / Math.hypot(northEdgeX - cx, northEdgeY - cy);
      const northDy = (northEdgeY - cy) / Math.hypot(northEdgeX - cx, northEdgeY - cy);
      const eastDx = (eastEdgeX - cx) / Math.hypot(eastEdgeX - cx, eastEdgeY - cy);
      const eastDy = (eastEdgeY - cy) / Math.hypot(eastEdgeX - cx, eastEdgeY - cy);
      const southDx = (southEdgeX - cx) / Math.hypot(southEdgeX - cx, southEdgeY - cy);
      const southDy = (southEdgeY - cy) / Math.hypot(southEdgeX - cx, southEdgeY - cy);
      const westDx = (westEdgeX - cx) / Math.hypot(westEdgeX - cx, westEdgeY - cy);
      const westDy = (westEdgeY - cy) / Math.hypot(westEdgeX - cx, westEdgeY - cy);
      
      const getPerp = (dx: number, dy: number) => ({ nx: -dy, ny: dx });
      
      // Diamond corners
      const topCorner = { x: x + w / 2, y: y };
      const rightCorner = { x: x + w, y: y + h / 2 };
      const bottomCorner = { x: x + w / 2, y: y + h };
      const leftCorner = { x: x, y: y + h / 2 };
      
      // ============================================
      // DRAW SIDEWALKS (only on outer edges of merged roads)
      // ============================================
      // Use mobile-specific zoom threshold (lower = visible when more zoomed out)
      const sidewalkMinZoom = isMobile ? SIDEWALK_MIN_ZOOM_MOBILE : SIDEWALK_MIN_ZOOM;
      const showSidewalks = currentZoom >= sidewalkMinZoom;
      
      const isOuterEdge = (edgeDir: 'north' | 'east' | 'south' | 'west') => {
        // For merged roads, only draw sidewalks on the outermost tiles
        if (mergeInfo.type === 'single') return true;
        
        if (mergeInfo.orientation === 'ns') {
          // NS roads: sidewalks on east/west edges of outermost tiles
          if (edgeDir === 'east') return mergeInfo.side === 'right';
          if (edgeDir === 'west') return mergeInfo.side === 'left';
          return true; // north/south always have sidewalks if no road
        }
        if (mergeInfo.orientation === 'ew') {
          // EW roads: sidewalks on north/south edges of outermost tiles
          if (edgeDir === 'north') return mergeInfo.side === 'left';
          if (edgeDir === 'south') return mergeInfo.side === 'right';
          return true;
        }
        return true;
      };
      
      const drawSidewalkEdge = (
        startX: number, startY: number,
        endX: number, endY: number,
        inwardDx: number, inwardDy: number,
        shortenStart: boolean = false,
        shortenEnd: boolean = false
      ) => {
        const swWidth = sidewalkWidth;
        const shortenDist = swWidth * 0.707;
        
        const edgeDx = endX - startX;
        const edgeDy = endY - startY;
        const edgeLen = Math.hypot(edgeDx, edgeDy);
        const edgeDirX = edgeDx / edgeLen;
        const edgeDirY = edgeDy / edgeLen;
        
        let actualStartX = startX, actualStartY = startY;
        let actualEndX = endX, actualEndY = endY;
        
        if (shortenStart && edgeLen > shortenDist * 2) {
          actualStartX = startX + edgeDirX * shortenDist;
          actualStartY = startY + edgeDirY * shortenDist;
        }
        if (shortenEnd && edgeLen > shortenDist * 2) {
          actualEndX = endX - edgeDirX * shortenDist;
          actualEndY = endY - edgeDirY * shortenDist;
        }
        
        ctx.strokeStyle = curbColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(actualStartX, actualStartY);
        ctx.lineTo(actualEndX, actualEndY);
        ctx.stroke();
        
        ctx.fillStyle = sidewalkColor;
        ctx.beginPath();
        ctx.moveTo(actualStartX, actualStartY);
        ctx.lineTo(actualEndX, actualEndY);
        ctx.lineTo(actualEndX + inwardDx * swWidth, actualEndY + inwardDy * swWidth);
        ctx.lineTo(actualStartX + inwardDx * swWidth, actualStartY + inwardDy * swWidth);
        ctx.closePath();
        ctx.fill();
      };
      
      // Draw sidewalks on edges without roads (only on outer edges for merged roads)
      if (showSidewalks && !north && isOuterEdge('north')) {
        drawSidewalkEdge(leftCorner.x, leftCorner.y, topCorner.x, topCorner.y, 0.707, 0.707, !west && isOuterEdge('west'), !east && isOuterEdge('east'));
      }
      if (showSidewalks && !east && isOuterEdge('east')) {
        drawSidewalkEdge(topCorner.x, topCorner.y, rightCorner.x, rightCorner.y, -0.707, 0.707, !north && isOuterEdge('north'), !south && isOuterEdge('south'));
      }
      if (showSidewalks && !south && isOuterEdge('south')) {
        drawSidewalkEdge(rightCorner.x, rightCorner.y, bottomCorner.x, bottomCorner.y, -0.707, -0.707, !east && isOuterEdge('east'), !west && isOuterEdge('west'));
      }
      if (showSidewalks && !west && isOuterEdge('west')) {
        drawSidewalkEdge(bottomCorner.x, bottomCorner.y, leftCorner.x, leftCorner.y, 0.707, -0.707, !south && isOuterEdge('south'), !north && isOuterEdge('north'));
      }
      
      // Corner sidewalk pieces
      const swWidth = sidewalkWidth;
      const shortenDist = swWidth * 0.707;
      ctx.fillStyle = sidewalkColor;
      
      const getShortenedInnerEndpoint = (cornerX: number, cornerY: number, otherCornerX: number, otherCornerY: number, inwardDx: number, inwardDy: number) => {
        const edgeDx = cornerX - otherCornerX;
        const edgeDy = cornerY - otherCornerY;
        const edgeLen = Math.hypot(edgeDx, edgeDy);
        const edgeDirX = edgeDx / edgeLen;
        const edgeDirY = edgeDy / edgeLen;
        const shortenedOuterX = cornerX - edgeDirX * shortenDist;
        const shortenedOuterY = cornerY - edgeDirY * shortenDist;
        return { x: shortenedOuterX + inwardDx * swWidth, y: shortenedOuterY + inwardDy * swWidth };
      };
      
      // Draw corner pieces only for outer edges (when zoomed in enough)
      if (showSidewalks && !north && !east && isOuterEdge('north') && isOuterEdge('east')) {
        const northInner = getShortenedInnerEndpoint(topCorner.x, topCorner.y, leftCorner.x, leftCorner.y, 0.707, 0.707);
        const eastInner = getShortenedInnerEndpoint(topCorner.x, topCorner.y, rightCorner.x, rightCorner.y, -0.707, 0.707);
        ctx.beginPath();
        ctx.moveTo(topCorner.x, topCorner.y);
        ctx.lineTo(northInner.x, northInner.y);
        ctx.lineTo(eastInner.x, eastInner.y);
        ctx.closePath();
        ctx.fill();
      }
      if (showSidewalks && !east && !south && isOuterEdge('east') && isOuterEdge('south')) {
        const eastInner = getShortenedInnerEndpoint(rightCorner.x, rightCorner.y, topCorner.x, topCorner.y, -0.707, 0.707);
        const southInner = getShortenedInnerEndpoint(rightCorner.x, rightCorner.y, bottomCorner.x, bottomCorner.y, -0.707, -0.707);
        ctx.beginPath();
        ctx.moveTo(rightCorner.x, rightCorner.y);
        ctx.lineTo(eastInner.x, eastInner.y);
        ctx.lineTo(southInner.x, southInner.y);
        ctx.closePath();
        ctx.fill();
      }
      if (showSidewalks && !south && !west && isOuterEdge('south') && isOuterEdge('west')) {
        const southInner = getShortenedInnerEndpoint(bottomCorner.x, bottomCorner.y, rightCorner.x, rightCorner.y, -0.707, -0.707);
        const westInner = getShortenedInnerEndpoint(bottomCorner.x, bottomCorner.y, leftCorner.x, leftCorner.y, 0.707, -0.707);
        ctx.beginPath();
        ctx.moveTo(bottomCorner.x, bottomCorner.y);
        ctx.lineTo(southInner.x, southInner.y);
        ctx.lineTo(westInner.x, westInner.y);
        ctx.closePath();
        ctx.fill();
      }
      if (showSidewalks && !west && !north && isOuterEdge('west') && isOuterEdge('north')) {
        const westInner = getShortenedInnerEndpoint(leftCorner.x, leftCorner.y, bottomCorner.x, bottomCorner.y, 0.707, -0.707);
        const northInner = getShortenedInnerEndpoint(leftCorner.x, leftCorner.y, topCorner.x, topCorner.y, 0.707, 0.707);
        ctx.beginPath();
        ctx.moveTo(leftCorner.x, leftCorner.y);
        ctx.lineTo(westInner.x, westInner.y);
        ctx.lineTo(northInner.x, northInner.y);
        ctx.closePath();
        ctx.fill();
      }
      
      // ============================================
      // DRAW ROAD SURFACE
      // ============================================
      // Use different asphalt color for highways
      ctx.fillStyle = mergeInfo.type === 'highway' ? '#3d3d3d' : 
                      mergeInfo.type === 'avenue' ? '#454545' : ROAD_COLORS.ASPHALT;
      
      // Draw road segments
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
      
      // Center intersection
      const centerSize = roadW * 1.4;
      ctx.beginPath();
      ctx.moveTo(cx, cy - centerSize);
      ctx.lineTo(cx + centerSize, cy);
      ctx.lineTo(cx, cy + centerSize);
      ctx.lineTo(cx - centerSize, cy);
      ctx.closePath();
      ctx.fill();
      
      // Interior sidewalk corners - small isometric diamonds at corners where two roads meet
      // Each corner drawn independently based on its two adjacent road directions
      if (showSidewalks) {
        ctx.fillStyle = sidewalkColor;
        const cs = swWidth * 0.8;
        const isFourWay = north && east && south && west;
        
        // Top corner - draw if north AND east both have roads
        if (north && east) {
          ctx.beginPath();
          ctx.moveTo(topCorner.x, topCorner.y);
          ctx.lineTo(topCorner.x - cs, topCorner.y + cs * 0.5);
          ctx.lineTo(topCorner.x, topCorner.y + cs);
          ctx.lineTo(topCorner.x + cs, topCorner.y + cs * 0.5);
          ctx.closePath();
          ctx.fill();
        }
        
        // Right corner - draw if east AND south both have roads
        if (east && south) {
          ctx.beginPath();
          ctx.moveTo(rightCorner.x, rightCorner.y);
          if (isFourWay) {
            // At 4-way intersections, use rotated shape (tall/narrow)
            ctx.lineTo(rightCorner.x - cs * 0.625, rightCorner.y - cs * 1.25);
            ctx.lineTo(rightCorner.x - cs * 1.25, rightCorner.y);
            ctx.lineTo(rightCorner.x - cs * 0.625, rightCorner.y + cs * 1.25);
          } else {
            // At T-intersections/corners, use flat shape
            ctx.lineTo(rightCorner.x - cs, rightCorner.y - cs * 0.5);
            ctx.lineTo(rightCorner.x - cs * 2, rightCorner.y);
            ctx.lineTo(rightCorner.x - cs, rightCorner.y + cs * 0.5);
          }
          ctx.closePath();
          ctx.fill();
        }
        
        // Bottom corner - draw if south AND west both have roads
        if (south && west) {
          ctx.beginPath();
          ctx.moveTo(bottomCorner.x, bottomCorner.y);
          ctx.lineTo(bottomCorner.x + cs, bottomCorner.y - cs * 0.5);
          ctx.lineTo(bottomCorner.x, bottomCorner.y - cs);
          ctx.lineTo(bottomCorner.x - cs, bottomCorner.y - cs * 0.5);
          ctx.closePath();
          ctx.fill();
        }
        
        // Left corner - draw if west AND north both have roads
        if (west && north) {
          ctx.beginPath();
          ctx.moveTo(leftCorner.x, leftCorner.y);
          if (isFourWay) {
            // At 4-way intersections, use rotated shape (tall/narrow)
            ctx.lineTo(leftCorner.x + cs * 0.625, leftCorner.y - cs * 1.25);
            ctx.lineTo(leftCorner.x + cs * 1.25, leftCorner.y);
            ctx.lineTo(leftCorner.x + cs * 0.625, leftCorner.y + cs * 1.25);
          } else {
            // At T-intersections/corners, use flat shape
            ctx.lineTo(leftCorner.x + cs, leftCorner.y - cs * 0.5);
            ctx.lineTo(leftCorner.x + cs * 2, leftCorner.y);
            ctx.lineTo(leftCorner.x + cs, leftCorner.y + cs * 0.5);
          }
          ctx.closePath();
          ctx.fill();
        }
      }
      
      // ============================================
      // DRAW LANE MARKINGS AND MEDIANS
      // ============================================
      if (currentZoom >= LANE_MARKINGS_MIN_ZOOM) {
        const connectionCount = [north, east, south, west].filter(Boolean).length;
        const isIntersection = connectionCount >= 3;
        
        // For merged roads, draw white lane divider lines instead of yellow center
        if (mergeInfo.type !== 'single' && mergeInfo.side === 'center') {
          // Center tiles of merged roads get white lane dividers
          ctx.strokeStyle = ROAD_COLORS.LANE_MARKING;
          ctx.lineWidth = 0.6;
          ctx.setLineDash([2, 3]);
          
          if (mergeInfo.orientation === 'ns' && (north || south)) {
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            if (north) ctx.lineTo(northEdgeX, northEdgeY);
            ctx.moveTo(cx, cy);
            if (south) ctx.lineTo(southEdgeX, southEdgeY);
            ctx.stroke();
          } else if (mergeInfo.orientation === 'ew' && (east || west)) {
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            if (east) ctx.lineTo(eastEdgeX, eastEdgeY);
            ctx.moveTo(cx, cy);
            if (west) ctx.lineTo(westEdgeX, westEdgeY);
            ctx.stroke();
          }
          ctx.setLineDash([]);
        }
        
        // Draw median on the boundary between opposing traffic
        if (mergeInfo.hasMedian && mergeInfo.mergeWidth >= 2) {
          // Determine if this tile is at the median boundary
          const medianPosition = Math.floor(mergeInfo.mergeWidth / 2) - 1;
          
          if (mergeInfo.positionInMerge === medianPosition) {
            // Draw median divider (double yellow or planted median)
            if (mergeInfo.orientation === 'ns') {
              // Median runs NS - draw on the west edge of this tile
              if (mergeInfo.medianType === 'plants' && currentZoom >= MEDIAN_PLANTS_MIN_ZOOM) {
                // Draw planted median
                ctx.fillStyle = '#6b7280'; // Concrete base
                const medianW = 3;
                ctx.fillRect(westEdgeX - medianW, westEdgeY - 2, medianW * 2, (southEdgeY - westEdgeY) + 4);
                
                // Draw small plants/shrubs
                ctx.fillStyle = '#4a7c3f';
                const plantSpacing = 10;
                const numPlants = Math.floor(Math.abs(southEdgeY - westEdgeY) / plantSpacing);
                for (let i = 1; i < numPlants; i++) {
                  const py = westEdgeY + (southEdgeY - westEdgeY) * (i / numPlants);
                  const px = westEdgeX + (southEdgeX - westEdgeX) * (i / numPlants);
                  ctx.beginPath();
                  ctx.arc(px, py - 1, 2, 0, Math.PI * 2);
                  ctx.fill();
                }
              } else {
                // Draw double yellow line
                ctx.strokeStyle = ROAD_COLORS.CENTER_LINE;
                ctx.lineWidth = 1.2;
                ctx.setLineDash([]);
                
                const offsetX = -1.5;
                ctx.beginPath();
                ctx.moveTo(northEdgeX + offsetX, northEdgeY);
                ctx.lineTo(southEdgeX + offsetX, southEdgeY);
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(northEdgeX + offsetX + 3, northEdgeY);
                ctx.lineTo(southEdgeX + offsetX + 3, southEdgeY);
                ctx.stroke();
              }
            } else if (mergeInfo.orientation === 'ew') {
              // Median runs EW - draw on the south edge of this tile
              if (mergeInfo.medianType === 'plants' && currentZoom >= MEDIAN_PLANTS_MIN_ZOOM) {
                ctx.fillStyle = '#6b7280';
                const medianW = 3;
                ctx.fillRect(eastEdgeX - 2, eastEdgeY - medianW, (westEdgeX - eastEdgeX) + 4, medianW * 2);
                
                ctx.fillStyle = '#4a7c3f';
                const plantSpacing = 10;
                const numPlants = Math.floor(Math.abs(westEdgeX - eastEdgeX) / plantSpacing);
                for (let i = 1; i < numPlants; i++) {
                  const px = eastEdgeX + (westEdgeX - eastEdgeX) * (i / numPlants);
                  const py = eastEdgeY + (westEdgeY - eastEdgeY) * (i / numPlants);
                  ctx.beginPath();
                  ctx.arc(px, py - 1, 2, 0, Math.PI * 2);
                  ctx.fill();
                }
              } else {
                ctx.strokeStyle = ROAD_COLORS.CENTER_LINE;
                ctx.lineWidth = 1.2;
                ctx.setLineDash([]);
                
                const offsetY = -1.5;
                ctx.beginPath();
                ctx.moveTo(eastEdgeX, eastEdgeY + offsetY);
                ctx.lineTo(westEdgeX, westEdgeY + offsetY);
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(eastEdgeX, eastEdgeY + offsetY + 3);
                ctx.lineTo(westEdgeX, westEdgeY + offsetY + 3);
                ctx.stroke();
              }
            }
          }
        }
        
        // Draw yellow center dashes for non-intersection roads only
        // Skip if this tile IS an intersection (3+ adjacent roads)
        const thisIsIntersection = [north, east, south, west].filter(Boolean).length >= 3;
        if (!thisIsIntersection) {
          ctx.strokeStyle = ROAD_COLORS.CENTER_LINE;
          ctx.lineWidth = 0.8;
          ctx.setLineDash([1.5, 2]);
          ctx.lineCap = 'round';
          
          // Helper to check if adjacent tile is an intersection
          const isAdjIntersection = (adjX: number, adjY: number): boolean => {
            if (!hasRoad(adjX, adjY)) return false;
            const aN = hasRoad(adjX - 1, adjY);
            const aE = hasRoad(adjX, adjY - 1);
            const aS = hasRoad(adjX + 1, adjY);
            const aW = hasRoad(adjX, adjY + 1);
            return [aN, aE, aS, aW].filter(Boolean).length >= 3;
          };
          
          // Line stops before sidewalk markers if approaching intersection, otherwise extends
          const markingOverlap = 8;
          const markingStartOffset = 0;
          const stopBeforeCrosswalk = 0.58; // Stop at 58% toward edge - just before sidewalk corner markers
          
          if (north) {
            const adjIsIntersection = isAdjIntersection(gridX - 1, gridY);
            if (adjIsIntersection) {
              // Stop before crosswalk
              const stopX = cx + (northEdgeX - cx) * stopBeforeCrosswalk;
              const stopY = cy + (northEdgeY - cy) * stopBeforeCrosswalk;
              ctx.beginPath();
              ctx.moveTo(cx + northDx * markingStartOffset, cy + northDy * markingStartOffset);
              ctx.lineTo(stopX, stopY);
              ctx.stroke();
            } else {
              ctx.beginPath();
              ctx.moveTo(cx + northDx * markingStartOffset, cy + northDy * markingStartOffset);
              ctx.lineTo(northEdgeX + northDx * markingOverlap, northEdgeY + northDy * markingOverlap);
              ctx.stroke();
            }
          }
          if (east) {
            const adjIsIntersection = isAdjIntersection(gridX, gridY - 1);
            if (adjIsIntersection) {
              const stopX = cx + (eastEdgeX - cx) * stopBeforeCrosswalk;
              const stopY = cy + (eastEdgeY - cy) * stopBeforeCrosswalk;
              ctx.beginPath();
              ctx.moveTo(cx + eastDx * markingStartOffset, cy + eastDy * markingStartOffset);
              ctx.lineTo(stopX, stopY);
              ctx.stroke();
            } else {
              ctx.beginPath();
              ctx.moveTo(cx + eastDx * markingStartOffset, cy + eastDy * markingStartOffset);
              ctx.lineTo(eastEdgeX + eastDx * markingOverlap, eastEdgeY + eastDy * markingOverlap);
              ctx.stroke();
            }
          }
          if (south) {
            const adjIsIntersection = isAdjIntersection(gridX + 1, gridY);
            if (adjIsIntersection) {
              const stopX = cx + (southEdgeX - cx) * stopBeforeCrosswalk;
              const stopY = cy + (southEdgeY - cy) * stopBeforeCrosswalk;
              ctx.beginPath();
              ctx.moveTo(cx + southDx * markingStartOffset, cy + southDy * markingStartOffset);
              ctx.lineTo(stopX, stopY);
              ctx.stroke();
            } else {
              ctx.beginPath();
              ctx.moveTo(cx + southDx * markingStartOffset, cy + southDy * markingStartOffset);
              ctx.lineTo(southEdgeX + southDx * markingOverlap, southEdgeY + southDy * markingOverlap);
              ctx.stroke();
            }
          }
          if (west) {
            const adjIsIntersection = isAdjIntersection(gridX, gridY + 1);
            if (adjIsIntersection) {
              const stopX = cx + (westEdgeX - cx) * stopBeforeCrosswalk;
              const stopY = cy + (westEdgeY - cy) * stopBeforeCrosswalk;
              ctx.beginPath();
              ctx.moveTo(cx + westDx * markingStartOffset, cy + westDy * markingStartOffset);
              ctx.lineTo(stopX, stopY);
              ctx.stroke();
            } else {
              ctx.beginPath();
              ctx.moveTo(cx + westDx * markingStartOffset, cy + westDy * markingStartOffset);
              ctx.lineTo(westEdgeX + westDx * markingOverlap, westEdgeY + westDy * markingOverlap);
              ctx.stroke();
            }
          }
          
          ctx.setLineDash([]);
          ctx.lineCap = 'butt';
        }
        
        // Draw directional arrows for merged roads
        if (mergeInfo.type !== 'single' && currentZoom >= DIRECTION_ARROWS_MIN_ZOOM && mergeInfo.side !== 'center') {
          const flowDirs = getTrafficFlowDirection(mergeInfo);
          if (flowDirs.length === 1) {
            drawRoadArrow(ctx, cx, cy, flowDirs[0], currentZoom);
          }
        }
        
        // ============================================
        // DRAW CROSSWALKS (on tiles adjacent to real intersections with traffic lights)
        // ============================================
        drawCrosswalks({
          ctx,
          x,
          y,
          gridX,
          gridY,
          zoom: currentZoom,
          roadW,
          adj: { north, east, south, west },
          hasRoad,
        });
        
        // ============================================
        // DRAW TRAFFIC LIGHTS AT INTERSECTIONS
        // ============================================
        // PERF: Skip traffic lights during mobile panning/zooming for better performance
        const skipTrafficLights = isMobile && (isPanningRef.current || isPinchZoomingRef.current);
        if (isIntersection && currentZoom >= TRAFFIC_LIGHT_MIN_ZOOM && !skipTrafficLights) {
          const trafficTime = trafficLightTimerRef.current;
          const lightState = getTrafficLightState(trafficTime);
          
          // Draw traffic lights at corners where roads meet
          // Position them at the corners of the intersection
          if (north && west) {
            drawTrafficLight(ctx, x, y, lightState, 'nw', currentZoom);
          }
          if (north && east) {
            drawTrafficLight(ctx, x, y, lightState, 'ne', currentZoom);
          }
          if (south && west) {
            drawTrafficLight(ctx, x, y, lightState, 'sw', currentZoom);
          }
          if (south && east) {
            drawTrafficLight(ctx, x, y, lightState, 'se', currentZoom);
          }
        }
      }
    }
    
    // Draw isometric tile base
    function drawIsometricTile(ctx: CanvasRenderingContext2D, x: number, y: number, tile: Tile, highlight: boolean, currentZoom: number, skipGreyBase: boolean = false, skipGreenBase: boolean = false) {
      const w = TILE_WIDTH;
      const h = TILE_HEIGHT;
      
      // Determine tile colors (top face and shading)
      let topColor = '#4a7c3f'; // grass
      let strokeColor = '#2d4a26';

      // PERF: Use pre-computed tile metadata for grey base check (O(1) lookup)
      const tileRenderMetadata = getTileMetadata(tile.x, tile.y);
      const isPark = tileRenderMetadata?.isPartOfParkBuilding || 
                     ['park', 'park_large', 'tennis', 'basketball_courts', 'playground_small',
                      'playground_large', 'baseball_field_small', 'soccer_field_small', 'football_field',
                      'skate_park', 'mini_golf_course', 'bleachers_field', 'go_kart_track', 'amphitheater', 
                      'greenhouse_garden', 'animal_pens_farm', 'cabin_house', 'campground', 'marina_docks_small', 
                      'pier_large', 'roller_coaster_small', 'community_garden', 'pond_park', 'park_gate', 
                      'mountain_lodge', 'mountain_trailhead'].includes(tile.building.type);
      const hasGreyBase = tileRenderMetadata?.needsGreyBase ?? false;
      
      if (tile.building.type === 'water') {
        topColor = '#2563eb';
        strokeColor = '#1e3a8a';
      } else if (tile.building.type === 'road') {
        topColor = '#4a4a4a';
        strokeColor = '#333';
      } else if (isPark) {
        topColor = '#4a7c3f';
        strokeColor = '#2d4a26';
      } else if (hasGreyBase && !skipGreyBase) {
        // Grey/concrete base tiles for ALL buildings (except parks)
        // Skip if skipGreyBase is true (will be drawn later after water)
        topColor = '#6b7280';
        strokeColor = '#374151';
      } else if (tile.zone === 'residential') {
        if (tile.building.type !== 'grass' && tile.building.type !== 'empty') {
          topColor = '#3d7c3f';
        } else {
          topColor = '#2d5a2d';
        }
        strokeColor = '#22c55e';
      } else if (tile.zone === 'commercial') {
        if (tile.building.type !== 'grass' && tile.building.type !== 'empty') {
          topColor = '#3a5c7c';
        } else {
          topColor = '#2a4a6a';
        }
        strokeColor = '#3b82f6';
      } else if (tile.zone === 'industrial') {
        if (tile.building.type !== 'grass' && tile.building.type !== 'empty') {
          topColor = '#7c5c3a';
        } else {
          topColor = '#6a4a2a';
        }
        strokeColor = '#f59e0b';
      }
      
      // Skip drawing green base for tiles adjacent to water (will be drawn later over water)
      // This includes grass, empty, and tree tiles - all have green bases
      const shouldSkipDrawing = skipGreenBase && (tile.building.type === 'grass' || tile.building.type === 'empty' || tile.building.type === 'tree');
      
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
    
    // Helper function to draw water tile at a given screen position
    // Used for marina/pier buildings that sit on water
    function drawWaterTileAt(ctx: CanvasRenderingContext2D, screenX: number, screenY: number, gridX: number, gridY: number) {
      const waterImage = getCachedImage(WATER_ASSET_PATH);
      if (!waterImage) return;
      
      const w = TILE_WIDTH;
      const h = TILE_HEIGHT;
      const tileCenterX = screenX + w / 2;
      const tileCenterY = screenY + h / 2;
      
      // Random subcrop of water texture based on tile position for variety
      const imgW = waterImage.naturalWidth || waterImage.width;
      const imgH = waterImage.naturalHeight || waterImage.height;
      
      // Deterministic "random" offset based on tile position
      const seedX = ((gridX * 7919 + gridY * 6271) % 1000) / 1000;
      const seedY = ((gridX * 4177 + gridY * 9311) % 1000) / 1000;
      
      // Take a subcrop for variety
      const cropScale = 0.35;
      const cropW = imgW * cropScale;
      const cropH = imgH * cropScale;
      const maxOffsetX = imgW - cropW;
      const maxOffsetY = imgH - cropH;
      const srcX = seedX * maxOffsetX;
      const srcY = seedY * maxOffsetY;
      
      ctx.save();
      // Clip to isometric diamond shape
      ctx.beginPath();
      ctx.moveTo(screenX + w / 2, screenY);           // top
      ctx.lineTo(screenX + w, screenY + h / 2);       // right
      ctx.lineTo(screenX + w / 2, screenY + h);       // bottom
      ctx.lineTo(screenX, screenY + h / 2);           // left
      ctx.closePath();
      ctx.clip();
      
      const aspectRatio = cropH / cropW;
      const jitterX = (seedX - 0.5) * w * 0.3;
      const jitterY = (seedY - 0.5) * h * 0.3;
      
      // Draw water with slight transparency
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
      
      ctx.restore();
    }
    
    // Draw building sprite
    function drawBuilding(ctx: CanvasRenderingContext2D, x: number, y: number, tile: Tile) {
      const buildingType = tile.building.type;
      const w = TILE_WIDTH;
      const h = TILE_HEIGHT;
      
      // Handle roads separately with adjacency
      if (buildingType === 'road') {
        drawRoad(ctx, x, y, tile.x, tile.y, zoom);
        return;
      }
      
      // Draw water tiles underneath marina/pier buildings
      if (buildingType === 'marina_docks_small' || buildingType === 'pier_large') {
        const buildingSize = getBuildingSize(buildingType);
        // Draw water tiles for each tile in the building's footprint
        for (let dx = 0; dx < buildingSize.width; dx++) {
          for (let dy = 0; dy < buildingSize.height; dy++) {
            const tileGridX = tile.x + dx;
            const tileGridY = tile.y + dy;
            const { screenX, screenY } = gridToScreen(tileGridX, tileGridY, 0, 0);
            drawWaterTileAt(ctx, screenX, screenY, tileGridX, tileGridY);
          }
        }
      }
      
      // Check if this building type has a sprite in the tile renderer, parks sheet, or stations sheet
      const activePack = getActiveSpritePack();
      const hasTileSprite = BUILDING_TO_SPRITE[buildingType] || 
        (activePack.parksBuildings && activePack.parksBuildings[buildingType]) ||
        (activePack.stationsVariants && activePack.stationsVariants[buildingType]);
      
      if (hasTileSprite) {
        // Special handling for water: use separate water.png image with blending for adjacent water tiles
        if (buildingType === 'water') {
          const waterImage = getCachedImage(WATER_ASSET_PATH);
          
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
            
            // Expand individual edges toward water neighbors only
            // Each edge should only expand if THAT specific edge direction has water
            const topExpand = (adjacentWater.north && adjacentWater.east) ? expand * 0.3 : 0;
            const rightExpand = (adjacentWater.east && adjacentWater.south) ? expand * 0.3 : 0;
            const bottomExpand = (adjacentWater.south && adjacentWater.west) ? expand * 0.3 : 0;
            const leftExpand = (adjacentWater.west && adjacentWater.north) ? expand * 0.3 : 0;
            
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
          
          // Construction has two phases:
          // Phase 1 (0-40%): Foundation/dirt plot phase - just show a dirt mound
          // Phase 2 (40-100%): Construction scaffolding phase - show construction sprite
          const constructionProgress = tile.building.constructionProgress ?? 100;
          const isFoundationPhase = isUnderConstruction && constructionProgress < 40;
          const isConstructionPhase = isUnderConstruction && constructionProgress >= 40;
          
          // If in foundation phase, draw the foundation plot and skip sprite rendering
          if (isFoundationPhase) {
            // Get building size to handle multi-tile foundations
            const buildingSize = getBuildingSize(buildingType);
            
            // For multi-tile buildings, we only draw the foundation from the origin tile
            // (the other tiles are 'empty' and won't have this building type)
            if (buildingSize.width > 1 || buildingSize.height > 1) {
              // Draw foundation plots for each tile in the footprint
              for (let dy = 0; dy < buildingSize.height; dy++) {
                for (let dx = 0; dx < buildingSize.width; dx++) {
                  const plotX = x + (dx - dy) * (w / 2);
                  const plotY = y + (dx + dy) * (h / 2);
                  drawFoundationPlot(ctx, plotX, plotY, w, h, zoom);
                }
              }
            } else {
              // Single-tile building - just draw one foundation
              drawFoundationPlot(ctx, x, y, w, h, zoom);
            }
            // Skip the sprite rendering for this tile (foundation plot is already drawn)
            return;
          }
          
          // Check if building is abandoned
          const isAbandoned = tile.building.abandoned === true;

          // Use appropriate sprite sheet based on building state
          // Priority: parks construction > construction > abandoned > parks > dense/modern variants > farm variants > normal
          let spriteSource = activePack.src;
          let useDenseVariant: { row: number; col: number } | null = null;
          let useModernVariant: { row: number; col: number } | null = null;
          let useFarmVariant: { row: number; col: number } | null = null;
          let useShopVariant: { row: number; col: number } | null = null;
          let useStationVariant: { row: number; col: number } | null = null;
          let useParksBuilding: { row: number; col: number } | null = null;
          
          // Check if this is a parks building first
          const isParksBuilding = activePack.parksBuildings && activePack.parksBuildings[buildingType];
          
          if (isConstructionPhase && isParksBuilding && activePack.parksConstructionSrc) {
            // Parks building under construction (phase 2) - use parks construction sheet
            useParksBuilding = activePack.parksBuildings![buildingType];
            spriteSource = activePack.parksConstructionSrc;
          } else if (isConstructionPhase && activePack.constructionSrc) {
            // Regular building under construction (phase 2) - use construction sheet
            spriteSource = activePack.constructionSrc;
          } else if (isAbandoned && activePack.abandonedSrc) {
            spriteSource = activePack.abandonedSrc;
          } else if (isParksBuilding && activePack.parksSrc) {
            // Check if this building type is from the parks sprite sheet
            useParksBuilding = activePack.parksBuildings![buildingType];
            spriteSource = activePack.parksSrc;
          } else if (activePack.denseSrc && activePack.denseVariants && activePack.denseVariants[buildingType]) {
            // Check if this building type has dense variants available
            const denseVariants = activePack.denseVariants[buildingType];
            const modernVariants = activePack.modernSrc && activePack.modernVariants && activePack.modernVariants[buildingType]
              ? activePack.modernVariants[buildingType]
              : [];
            // Use deterministic random based on tile position to select variant
            // This ensures the same building always shows the same variant
            const seed = (tile.x * 31 + tile.y * 17) % 100;
            // ~50% chance to use a dense/modern variant (when seed < 50)
            if (seed < 50 && (denseVariants.length > 0 || modernVariants.length > 0)) {
              // Combine both variant pools and select from them
              const allVariants = [
                ...denseVariants.map(v => ({ ...v, source: 'dense' as const })),
                ...modernVariants.map(v => ({ ...v, source: 'modern' as const })),
              ];
              const variantIndex = (tile.x * 7 + tile.y * 13) % allVariants.length;
              const selectedVariant = allVariants[variantIndex];
              if (selectedVariant.source === 'modern') {
                useModernVariant = { row: selectedVariant.row, col: selectedVariant.col };
                spriteSource = activePack.modernSrc!;
              } else {
                useDenseVariant = { row: selectedVariant.row, col: selectedVariant.col };
                spriteSource = activePack.denseSrc;
              }
            }
          } else if (activePack.modernSrc && activePack.modernVariants && activePack.modernVariants[buildingType]) {
            // Check if this building type has modern variants available (without dense variants)
            const variants = activePack.modernVariants[buildingType];
            const seed = (tile.x * 31 + tile.y * 17) % 100;
            if (seed < 50 && variants.length > 0) {
              const variantIndex = (tile.x * 7 + tile.y * 13) % variants.length;
              useModernVariant = variants[variantIndex];
              spriteSource = activePack.modernSrc;
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
          } else if (activePack.shopsSrc && activePack.shopsVariants && activePack.shopsVariants[buildingType]) {
            // Check if this building type has shop variants available (low-density commercial)
            const variants = activePack.shopsVariants[buildingType];
            // Use deterministic random based on tile position to select variant
            // This ensures the same building always shows the same variant
            const seed = (tile.x * 31 + tile.y * 17) % 100;
            // ~50% chance to use a shop variant (when seed < 50)
            if (seed < 50 && variants.length > 0) {
              // Select which shop variant to use based on position
              const variantIndex = (tile.x * 7 + tile.y * 13) % variants.length;
              useShopVariant = variants[variantIndex];
              spriteSource = activePack.shopsSrc;
            }
          } else if (activePack.stationsSrc && activePack.stationsVariants && activePack.stationsVariants[buildingType]) {
            // Check if this building type has station variants available (rail stations)
            const variants = activePack.stationsVariants[buildingType];
            // Use deterministic random based on tile position to select variant
            // This ensures the same building always shows the same variant
            const seed = (tile.x * 31 + tile.y * 17) % 100;
            // Always use a station variant if available (100% chance)
            if (variants.length > 0) {
              // Select which station variant to use based on position
              const variantIndex = (tile.x * 7 + tile.y * 13) % variants.length;
              useStationVariant = variants[variantIndex];
              spriteSource = activePack.stationsSrc;
            }
          }

          const filteredSpriteSheet = getCachedImage(spriteSource, true) || getCachedImage(spriteSource);
          
          if (filteredSpriteSheet) {
            // Use naturalWidth/naturalHeight for accurate source dimensions
            const sheetWidth = filteredSpriteSheet.naturalWidth || filteredSpriteSheet.width;
            const sheetHeight = filteredSpriteSheet.naturalHeight || filteredSpriteSheet.height;
            
            // Get sprite coordinates - either from parks, dense variant, modern variant, farm variant, shop variant, station variant, or normal mapping
            let coords: { sx: number; sy: number; sw: number; sh: number } | null;
            let isDenseVariant = false;
            let isModernVariant = false;
            let isFarmVariant = false;
            let isShopVariant = false;
            let isStationVariant = false;
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
              
              // Special handling for buildings that have content bleeding from row above - shift source down to avoid capturing
              // content from the sprite above it in the sprite sheet
              if (buildingType === 'marina_docks_small') {
                sourceY += tileHeight * 0.15; // Shift down 15% to avoid row above clipping (reduced from 25%)
                sourceH = tileHeight * 0.85; // Reduce height by 15% to avoid row below clipping
              } else if (buildingType === 'pier_large') {
                sourceY += tileHeight * 0.2; // Shift down 20% to avoid row above clipping
                sourceH = tileHeight * 0.8; // Reduce height by 20% to avoid row below clipping
              } else if (buildingType === 'amphitheater') {
                sourceY += tileHeight * 0.1; // Shift down 10% to avoid row above clipping
              } else if (buildingType === 'mini_golf_course') {
                sourceY += tileHeight * 0.2; // Shift down 20% to crop lower from the top
                sourceH = tileHeight * 0.8; // Reduce height by 20% to maintain proper aspect
              } else if (buildingType === 'cabin_house') {
                sourceY += tileHeight * 0.1; // Shift down 10% to avoid row above clipping
              } else if (buildingType === 'go_kart_track') {
                sourceY += tileHeight * 0.1; // Shift down 10% to avoid row above clipping
              } else if (buildingType === 'greenhouse_garden') {
                sourceY += tileHeight * 0.1; // Shift down 10% to crop asset above it
                sourceH = tileHeight * 0.9; // Reduce height by 10% to maintain proper aspect
              }
              
              // Special handling for buildings that need more height to avoid bottom clipping
              if (buildingType === 'bleachers_field') {
                sourceH = tileHeight * 1.1; // Increase height by 10% to avoid bottom clipping
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
              // For factory_large dense variants (row 4), shift source Y down to avoid capturing
              // content from the row above that bleeds into the cell boundary
              if (buildingType === 'factory_large') {
                sourceY += tileHeight * 0.05; // Shift down ~5% to avoid row above
                sourceH = tileHeight * 0.95; // Reduce height slightly to avoid row below clipping
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
            } else if (useModernVariant) {
              isModernVariant = true;
              // Calculate coordinates directly from modern variant row/col (same layout as dense: cols/rows)
              const tileWidth = Math.floor(sheetWidth / activePack.cols);
              const tileHeight = Math.floor(sheetHeight / activePack.rows);
              let sourceY = useModernVariant.row * tileHeight;
              let sourceH = tileHeight;
              // For mall modern variants (rows 2-3), shift source Y down to avoid capturing
              // content from the row above that bleeds into the cell boundary
              if (buildingType === 'mall') {
                sourceY += tileHeight * 0.25; // Shift down ~25% to avoid row above (more than dense due to taller assets)
              }
              // For apartment_high modern variants, add a bit more height to avoid cutoff at bottom
              if (buildingType === 'apartment_high') {
                sourceH = tileHeight * 1.05; // Add 5% more height at bottom
              }
              coords = {
                sx: useModernVariant.col * tileWidth,
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
            } else if (useShopVariant) {
              isShopVariant = true;
              // Calculate coordinates directly from shop variant row/col
              const shopsCols = activePack.shopsCols || 5;
              const shopsRows = activePack.shopsRows || 6;
              const tileWidth = Math.floor(sheetWidth / shopsCols);
              const tileHeight = Math.floor(sheetHeight / shopsRows);
              const sourceY = useShopVariant.row * tileHeight;
              const sourceH = tileHeight;
              coords = {
                sx: useShopVariant.col * tileWidth,
                sy: sourceY,
                sw: tileWidth,
                sh: sourceH,
              };
            } else if (useStationVariant) {
              isStationVariant = true;
              // Calculate coordinates directly from station variant row/col
              const stationsCols = activePack.stationsCols || 5;
              const stationsRows = activePack.stationsRows || 6;
              const tileWidth = Math.floor(sheetWidth / stationsCols);
              const tileHeight = Math.floor(sheetHeight / stationsRows);
              let sourceY = useStationVariant.row * tileHeight;
              let sourceH = tileHeight;
              
              // Special handling for rows that have content bleeding from row above
              // Third row (row 2, 0-indexed) - shift down to avoid capturing content from row above
              if (useStationVariant.row === 2) {
                sourceY += tileHeight * 0.1; // Shift down 10% to avoid row above clipping
              }
              // Fourth row (row 3, 0-indexed) - shift down to avoid capturing content from row above
              // Also reduce height slightly to crop out bottom clipping from row below
              if (useStationVariant.row === 3) {
                sourceY += tileHeight * 0.1; // Shift down 10% to avoid row above clipping
                sourceH -= tileHeight * 0.05; // Reduce height by 5% to crop bottom clipping
              }
              // Fifth row (row 4, 0-indexed) - shift down to avoid capturing content from row above
              // Also reduce height to crop out bottom clipping from row below
              if (useStationVariant.row === 4) {
                sourceY += tileHeight * 0.1; // Shift down 10% to avoid row above clipping
                sourceH -= tileHeight * 0.1; // Reduce height by 10% to crop bottom clipping
              }
              
              coords = {
                sx: useStationVariant.col * tileWidth,
                sy: sourceY,
                sw: tileWidth,
                sh: sourceH,
              };
            } else {
              // getSpriteCoords handles building type to sprite key mapping
              coords = getSpriteCoords(buildingType, sheetWidth, sheetHeight);
              
              // Special cropping for factory_large base sprite - crop bottom to remove asset below
              if (buildingType === 'factory_large' && coords) {
                const tileHeight = Math.floor(sheetHeight / activePack.rows);
                coords.sh = coords.sh - tileHeight * 0.08; // Crop 8% from bottom
              }
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
              // Special scale adjustment for space_program (scaled up 6%)
              if (buildingType === 'space_program') {
                scaleMultiplier *= 1.06; // Scale up by 6% (was 10%, reduced 4%)
              }
              // Special scale adjustment for stadium (scaled down 30%)
              if (buildingType === 'stadium') {
                scaleMultiplier *= 0.7; // Scale down by 30%
              }
              // Special scale adjustment for water_tower (scaled down 10%)
              if (buildingType === 'water_tower') {
                scaleMultiplier *= 0.9; // Scale down by 10%
              }
              // Special scale adjustment for subway_station (scaled down 30%)
              if (buildingType === 'subway_station') {
                scaleMultiplier *= 0.7; // Scale down by 30%
              }
              // Special scale adjustment for police_station (scaled down 3%)
              if (buildingType === 'police_station') {
                scaleMultiplier *= 0.97; // Scale down by 3%
              }
              // Special scale adjustment for fire_station (scaled down 3%)
              if (buildingType === 'fire_station') {
                scaleMultiplier *= 0.97; // Scale down by 3%
              }
              // Special scale adjustment for hospital (scaled down 10%)
              if (buildingType === 'hospital') {
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
              // Special scale adjustment for modern mall variants (scaled down 15%)
              if (buildingType === 'mall' && isModernVariant) {
                scaleMultiplier *= 0.85;
              }
              // Apply dense-specific scale if building uses dense variant and has custom scale in config
              if (isDenseVariant && activePack.denseScales && buildingType in activePack.denseScales) {
                scaleMultiplier *= activePack.denseScales[buildingType];
              }
              // Apply modern-specific scale if building uses modern variant and has custom scale in config
              if (isModernVariant && activePack.modernScales && buildingType in activePack.modernScales) {
                scaleMultiplier *= activePack.modernScales[buildingType];
              }
              // Apply farm-specific scale if building uses farm variant and has custom scale in config
              if (isFarmVariant && activePack.farmsScales && buildingType in activePack.farmsScales) {
                scaleMultiplier *= activePack.farmsScales[buildingType];
              }
              // Apply shop-specific scale if building uses shop variant and has custom scale in config
              if (isShopVariant && activePack.shopsScales && buildingType in activePack.shopsScales) {
                scaleMultiplier *= activePack.shopsScales[buildingType];
              }
              // Apply station-specific scale if building uses station variant and has custom scale in config
              if (isStationVariant && activePack.stationsScales && buildingType in activePack.stationsScales) {
                scaleMultiplier *= activePack.stationsScales[buildingType];
              }
              // Apply parks-specific scale if building is from parks sheet and has custom scale in config
              if (isParksBuilding && activePack.parksScales && buildingType in activePack.parksScales) {
                scaleMultiplier *= activePack.parksScales[buildingType];
              }
              // Apply construction-specific scale if building is in construction phase (phase 2) and has custom scale
              if (isConstructionPhase && activePack.constructionScales && buildingType in activePack.constructionScales) {
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
              // Apply shop-specific horizontal offset if available
              if (isShopVariant && activePack.shopsHorizontalOffsets && buildingType in activePack.shopsHorizontalOffsets) {
                horizontalOffset = activePack.shopsHorizontalOffsets[buildingType] * w;
              }
              // Apply station-specific horizontal offset if available
              if (isStationVariant && activePack.stationsHorizontalOffsets && buildingType in activePack.stationsHorizontalOffsets) {
                horizontalOffset = activePack.stationsHorizontalOffsets[buildingType] * w;
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
              if (isConstructionPhase && isParksBuilding && activePack.parksConstructionVerticalOffsets && buildingType in activePack.parksConstructionVerticalOffsets) {
                // Parks building in construction phase (phase 2) - use parks construction offset
                extraOffset = activePack.parksConstructionVerticalOffsets[buildingType] * h;
              } else if (isConstructionPhase && activePack.constructionVerticalOffsets && buildingType in activePack.constructionVerticalOffsets) {
                // Regular building in construction phase (phase 2) - use construction offset
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
              } else if (isModernVariant && activePack.modernVerticalOffsets && buildingType in activePack.modernVerticalOffsets) {
                // Modern variants may need different positioning than normal
                extraOffset = activePack.modernVerticalOffsets[buildingType] * h;
              } else if (isFarmVariant && activePack.farmsVerticalOffsets && buildingType in activePack.farmsVerticalOffsets) {
                // Farm variants may need different positioning than normal
                extraOffset = activePack.farmsVerticalOffsets[buildingType] * h;
              } else if (isShopVariant && activePack.shopsVerticalOffsets && buildingType in activePack.shopsVerticalOffsets) {
                // Shop variants may need different positioning than normal
                extraOffset = activePack.shopsVerticalOffsets[buildingType] * h;
              } else if (isStationVariant && activePack.stationsVerticalOffsets && buildingType in activePack.stationsVerticalOffsets) {
                // Station variants may need different positioning than normal
                extraOffset = activePack.stationsVerticalOffsets[buildingType] * h;
              } else if (activePack.buildingVerticalOffsets && buildingType in activePack.buildingVerticalOffsets) {
                // Building-type-specific offset (for buildings sharing sprites but needing different positioning)
                extraOffset = activePack.buildingVerticalOffsets[buildingType] * h;
              } else if (spriteKey && SPRITE_VERTICAL_OFFSETS[spriteKey]) {
                extraOffset = SPRITE_VERTICAL_OFFSETS[spriteKey] * h;
              }
              // Special vertical offset adjustment for hospital (shift up 0.1 tiles)
              if (buildingType === 'hospital') {
                extraOffset -= 0.1 * h; // Shift up by 0.1 tiles
              }
              verticalPush += extraOffset;
              
              drawY = drawPosY + h - destHeight + verticalPush;
              
              // Check if building should be horizontally flipped
              // Some buildings are mirrored by default and the flip flag inverts that
              // Note: marina and pier are NOT in this list - they face the default direction
              const defaultMirroredBuildings: string[] = [];
              const isDefaultMirrored = defaultMirroredBuildings.includes(buildingType);
              
              // Check if this is a waterfront asset - these use water-facing logic set at build time
              const isWaterfrontAsset = requiresWaterAdjacency(buildingType);
              
              // Determine flip based on road adjacency for non-waterfront buildings
              // Buildings should face roads when possible, otherwise fall back to random
              const shouldRoadMirror = (() => {
                if (isWaterfrontAsset) return false; // Waterfront buildings use water-facing logic
                
                const roadCheck = getRoadAdjacency(grid, tile.x, tile.y, buildingSize.width, buildingSize.height, gridSize);
                if (roadCheck.hasRoad) {
                  // Face the road
                  return roadCheck.shouldFlip;
                }
                
                // No road adjacent - fall back to deterministic random mirroring for visual variety
                const mirrorSeed = (tile.x * 47 + tile.y * 83) % 100;
                return mirrorSeed < 50;
              })();
              
              // Final flip decision: combine default mirror state, explicit flip flag, and road/random mirror
              const baseFlipped = isDefaultMirrored ? !tile.building.flipped : tile.building.flipped === true;
              const isFlipped = baseFlipped !== shouldRoadMirror; // XOR: if both true or both false, no flip; if one true, flip
              
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
    // PERF: Only iterate through diagonal bands that intersect the visible viewport
    for (let sum = visibleMinSum; sum <= visibleMaxSum; sum++) {
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
        
        // PERF: Hover and selection highlights are now rendered on a separate canvas layer
        // Only keep drag rect and subway station highlights in main render (these change infrequently)
        
        // Check if tile is in drag selection rectangle (only show for zoning tools)
        const isInDragRect = showsDragGrid && dragStartTile && dragEndTile && 
          x >= Math.min(dragStartTile.x, dragEndTile.x) &&
          x <= Math.max(dragStartTile.x, dragEndTile.x) &&
          y >= Math.min(dragStartTile.y, dragEndTile.y) &&
          y <= Math.max(dragStartTile.y, dragEndTile.y);

        // PERF: Use pre-computed tile metadata (O(1) lookup instead of expensive per-tile calculations)
        const tileMetadata = getTileMetadata(x, y);
        const needsGreyBase = tileMetadata?.needsGreyBase ?? false;
        const needsGreenBaseOverWater = tileMetadata?.needsGreenBaseOverWater ?? false;
        const needsGreenBaseForPark = tileMetadata?.needsGreenBaseForPark ?? false;
        
        // Draw base tile for all tiles (including water), but skip gray bases for buildings and green bases for grass/empty adjacent to water or parks
        // Highlight subway stations when subway overlay is active
        const isSubwayStationHighlight = overlayMode === 'subway' && tile.building.type === 'subway_station';
        drawIsometricTile(ctx, screenX, screenY, tile, !!(isInDragRect || isSubwayStationHighlight), zoom, true, needsGreenBaseOverWater || needsGreenBaseForPark);
        
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
        // Rail tiles - drawn after roads, above water
        else if (tile.building.type === 'rail') {
          const depth = x + y;
          railQueue.push({ screenX, screenY, tile, depth });
        }
        // Check for beach tiles (grass/empty tiles adjacent to water) - use pre-computed metadata
        else if ((tile.building.type === 'grass' || tile.building.type === 'empty') &&
                 (tileMetadata?.isAdjacentToWater ?? false)) {
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
    // PERF: Use for loop instead of forEach to avoid function call overhead
    for (let i = 0; i < waterQueue.length; i++) {
      const { tile, screenX, screenY } = waterQueue[i];
      drawBuilding(ctx, screenX, screenY, tile);
    }
    
    ctx.restore(); // Remove clipping after drawing water
    
    // Draw beaches on water tiles (after water, outside clipping region)
    // Note: waterQueue is already sorted from above
    // PERF: Use for loop instead of forEach
    for (let i = 0; i < waterQueue.length; i++) {
      const { tile, screenX, screenY } = waterQueue[i];
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
    }
    
    // PERF: Pre-compute tile dimensions once outside loops
    const tileWidth = TILE_WIDTH;
    const tileHeight = TILE_HEIGHT;
    const halfTileWidth = tileWidth / 2;
    const halfTileHeight = tileHeight / 2;
    
    // Draw roads (above water, needs full redraw including base tile)
    insertionSortByDepth(roadQueue);
    // PERF: Use for loop instead of forEach
    for (let i = 0; i < roadQueue.length; i++) {
      const { tile, screenX, screenY } = roadQueue[i];
      // Draw road base tile first (grey diamond)
      ctx.fillStyle = '#4a4a4a';
      ctx.beginPath();
      ctx.moveTo(screenX + halfTileWidth, screenY);
      ctx.lineTo(screenX + tileWidth, screenY + halfTileHeight);
      ctx.lineTo(screenX + halfTileWidth, screenY + tileHeight);
      ctx.lineTo(screenX, screenY + halfTileHeight);
      ctx.closePath();
      ctx.fill();
      
      // Draw road markings and sidewalks
      drawBuilding(ctx, screenX, screenY, tile);
      
      // If this road has a rail overlay, draw just the rail tracks (ties and rails, no ballast)
      // Crossing signals/gates are drawn later (after rail tiles) to avoid z-order issues
      if (tile.hasRailOverlay) {
        drawRailTracksOnly(ctx, screenX, screenY, tile.x, tile.y, grid, gridSize, zoom);
      }
    }
    
    // Draw rail tracks (above water, similar to roads)
    insertionSortByDepth(railQueue);
    // PERF: Use for loop instead of forEach
    for (let i = 0; i < railQueue.length; i++) {
      const { tile, screenX, screenY } = railQueue[i];
      // Draw rail base tile first (dark gravel colored diamond)
      ctx.fillStyle = '#5B6345'; // Dark gravel color for contrast with ballast
      ctx.beginPath();
      ctx.moveTo(screenX + halfTileWidth, screenY);
      ctx.lineTo(screenX + tileWidth, screenY + halfTileHeight);
      ctx.lineTo(screenX + halfTileWidth, screenY + tileHeight);
      ctx.lineTo(screenX, screenY + halfTileHeight);
      ctx.closePath();
      ctx.fill();
      
      // Draw edge shading for depth
      ctx.strokeStyle = '#4B5335';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(screenX + halfTileWidth, screenY + tileHeight);
      ctx.lineTo(screenX, screenY + halfTileHeight);
      ctx.lineTo(screenX + halfTileWidth, screenY);
      ctx.stroke();
      
      // Draw the rail tracks
      drawRailTrack(ctx, screenX, screenY, tile.x, tile.y, grid, gridSize, zoom);
    }
    
    // Draw green base tiles for grass/empty tiles adjacent to water (after rail, before crossings)
    insertionSortByDepth(greenBaseTileQueue);
    // PERF: Use for loop instead of forEach
    for (let i = 0; i < greenBaseTileQueue.length; i++) {
      const { tile, screenX, screenY } = greenBaseTileQueue[i];
      drawGreenBaseTile(ctx, screenX, screenY, tile, zoom);
    }
    
    // Draw gray building base tiles (after rail, before crossings)
    insertionSortByDepth(baseTileQueue);
    // PERF: Use for loop instead of forEach
    for (let i = 0; i < baseTileQueue.length; i++) {
      const { tile, screenX, screenY } = baseTileQueue[i];
      drawGreyBaseTile(ctx, screenX, screenY, tile, zoom);
    }
    
    // Draw railroad crossing signals and gates AFTER base tiles to ensure they appear on top
    // PERF: Build a Set of crossing keys for O(1) lookup instead of calling isRailroadCrossing
    const crossingKeySet = new Set<number>();
    const cachedCrossings = crossingPositionsRef.current;
    for (let i = 0; i < cachedCrossings.length; i++) {
      const { x, y } = cachedCrossings[i];
      crossingKeySet.add(y * gridSize + x);
    }
    
    // PERF: Pre-compute constants used in loop
    const currentTrains = trainsRef.current;
    const currentFlashTimer = crossingFlashTimerRef.current;
    const gateAnglesMap = crossingGateAnglesRef.current;
    
    // Only iterate roads with rail overlay that are crossings
    // PERF: Use for loop instead of forEach
    for (let i = 0; i < roadQueue.length; i++) {
      const { tile, screenX, screenY } = roadQueue[i];
      if (tile.hasRailOverlay) {
        // PERF: Use numeric key and Set lookup instead of isRailroadCrossing call
        const crossingKey = tile.y * gridSize + tile.x;
        if (crossingKeySet.has(crossingKey)) {
          const gateAngle = gateAnglesMap.get(crossingKey) ?? 0;
          const crossingState = getCrossingStateForTile(currentTrains, tile.x, tile.y);
          const isActive = crossingState !== 'open';
          
          drawRailroadCrossing(
            ctx,
            screenX,
            screenY,
            tile.x,
            tile.y,
            grid,
            gridSize,
            zoom,
            currentFlashTimer,
            gateAngle,
            isActive
          );
        }
      }
    }
    
    // Note: Beach drawing has been moved to water tiles (drawBeachOnWater)
    // The beachQueue is no longer used for drawing beaches on land tiles
    
    
    // Draw buildings sorted by depth so multi-tile sprites sit above adjacent tiles
    // NOTE: Building sprites are now drawn on a separate canvas (buildingsCanvasRef) 
    // that renders on top of cars/trains. We render them here so we can use the same
    // drawBuilding function and context.
    insertionSortByDepth(buildingQueue);
    
    // Render buildings on the buildings canvas (on top of cars/trains)
    const buildingsCanvas = buildingsCanvasRef.current;
    if (buildingsCanvas) {
      // Set canvas size in memory (scaled for DPI)
      buildingsCanvas.width = canvasSize.width;
      buildingsCanvas.height = canvasSize.height;
      
      const buildingsCtx = buildingsCanvas.getContext('2d');
      if (buildingsCtx) {
        // Clear buildings canvas
        buildingsCtx.setTransform(1, 0, 0, 1, 0, 0);
        buildingsCtx.clearRect(0, 0, buildingsCanvas.width, buildingsCanvas.height);
        
        // Apply same transform as main canvas
        buildingsCtx.scale(dpr, dpr);
        buildingsCtx.translate(offset.x, offset.y);
        buildingsCtx.scale(zoom, zoom);
        
        // Disable image smoothing for crisp pixel art
        buildingsCtx.imageSmoothingEnabled = false;
        
        // Draw buildings on the buildings canvas
        // PERF: Use for loop instead of forEach
        for (let i = 0; i < buildingQueue.length; i++) {
          const { tile, screenX, screenY } = buildingQueue[i];
          drawBuilding(buildingsCtx, screenX, screenY, tile);
        }
        
        // NOTE: Recreation pedestrians are now drawn in the animation loop on the air canvas
        // so their animations are smooth (the buildings canvas only updates when grid changes)
        
        // Draw overlays on the buildings canvas so they appear ON TOP of buildings
        // (The buildings canvas is layered above the main canvas, so overlays must be drawn here)
        // PERF: Use for loop instead of forEach
        for (let i = 0; i < overlayQueue.length; i++) {
          const { tile, screenX, screenY } = overlayQueue[i];
          // Get service coverage for this tile
          const coverage = {
            fire: state.services.fire[tile.y][tile.x],
            police: state.services.police[tile.y][tile.x],
            health: state.services.health[tile.y][tile.x],
            education: state.services.education[tile.y][tile.x],
          };
          
          buildingsCtx.fillStyle = getOverlayFillStyle(overlayMode, tile, coverage);
          buildingsCtx.beginPath();
          buildingsCtx.moveTo(screenX + halfTileWidth, screenY);
          buildingsCtx.lineTo(screenX + tileWidth, screenY + halfTileHeight);
          buildingsCtx.lineTo(screenX + halfTileWidth, screenY + tileHeight);
          buildingsCtx.lineTo(screenX, screenY + halfTileHeight);
          buildingsCtx.closePath();
          buildingsCtx.fill();
        }
        
        buildingsCtx.setTransform(1, 0, 0, 1, 0, 0);
      }
    }
    
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
    }); // End requestAnimationFrame callback
    
    // PERF: Cleanup - cancel pending render on unmount or deps change
    return () => {
      if (renderPendingRef.current !== null) {
        cancelAnimationFrame(renderPendingRef.current);
        renderPendingRef.current = null;
      }
    };
  // PERF: hoveredTile and selectedTile removed from deps - now rendered on separate hover canvas layer
  }, [grid, gridSize, offset, zoom, overlayMode, imagesLoaded, imageLoadVersion, canvasSize, dragStartTile, dragEndTile, state.services, currentSpritePack, waterBodies, getTileMetadata, showsDragGrid, isMobile]);
  
  // PERF: Lightweight hover/selection overlay - renders ONLY tile highlights
  // This runs frequently (on mouse move) but is extremely fast since it only draws simple shapes
  useEffect(() => {
    const canvas = hoverCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    
    // Clear the hover canvas
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply transform (same as main canvas)
    ctx.scale(dpr, dpr);
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);
    
    // Helper to draw highlight diamond
    const drawHighlight = (screenX: number, screenY: number, color: string = 'rgba(255, 255, 255, 0.25)', strokeColor: string = '#ffffff') => {
      const w = TILE_WIDTH;
      const h = TILE_HEIGHT;
      
      // Draw semi-transparent fill
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(screenX + w / 2, screenY);
      ctx.lineTo(screenX + w, screenY + h / 2);
      ctx.lineTo(screenX + w / 2, screenY + h);
      ctx.lineTo(screenX, screenY + h / 2);
      ctx.closePath();
      ctx.fill();
      
      // Draw border
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    };
    
    // Draw hovered tile highlight
    if (hoveredTile && hoveredTile.x >= 0 && hoveredTile.x < gridSize && hoveredTile.y >= 0 && hoveredTile.y < gridSize) {
      const { screenX, screenY } = gridToScreen(hoveredTile.x, hoveredTile.y, 0, 0);
      drawHighlight(screenX, screenY);
    }
    
    // Draw selected tile highlight (including multi-tile buildings)
    if (selectedTile && selectedTile.x >= 0 && selectedTile.x < gridSize && selectedTile.y >= 0 && selectedTile.y < gridSize) {
      const selectedOrigin = grid[selectedTile.y]?.[selectedTile.x];
      if (selectedOrigin) {
        const selectedSize = getBuildingSize(selectedOrigin.building.type);
        // Draw highlight for each tile in the building footprint
        for (let dx = 0; dx < selectedSize.width; dx++) {
          for (let dy = 0; dy < selectedSize.height; dy++) {
            const tx = selectedTile.x + dx;
            const ty = selectedTile.y + dy;
            if (tx >= 0 && tx < gridSize && ty >= 0 && ty < gridSize) {
              const { screenX, screenY } = gridToScreen(tx, ty, 0, 0);
              drawHighlight(screenX, screenY, 'rgba(100, 200, 255, 0.3)', '#60a5fa');
            }
          }
        }
      }
    }

    // Competitive: unit drag-selection rectangle (screen-space)
    if (isCompetitive && isUnitSelecting && unitDragStartWorld && unitDragEndWorld) {
      const minX = Math.min(unitDragStartWorld.x, unitDragEndWorld.x);
      const minY = Math.min(unitDragStartWorld.y, unitDragEndWorld.y);
      const maxX = Math.max(unitDragStartWorld.x, unitDragEndWorld.x);
      const maxY = Math.max(unitDragStartWorld.y, unitDragEndWorld.y);
      const w = Math.max(0, maxX - minX);
      const h = Math.max(0, maxY - minY);
      if (w > 1 && h > 1) {
        ctx.fillStyle = 'rgba(96, 165, 250, 0.14)';
        ctx.strokeStyle = 'rgba(96, 165, 250, 0.75)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(minX, minY, w, h);
        ctx.fill();
        ctx.stroke();
      }
    }
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, [hoveredTile, selectedTile, offset, zoom, gridSize, grid, isCompetitive, isUnitSelecting, unitDragStartWorld, unitDragEndWorld]);

  const drawMilitaryUnits = useCallback((ctx: CanvasRenderingContext2D) => {
    if (!isCompetitive || !humanPlayerId) return;
    if (competitiveUnits.length === 0) return;
    if (!grid || gridSize <= 0) return;

    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;

    ctx.save();
    ctx.scale(dpr * zoom, dpr * zoom);
    ctx.translate(offset.x / zoom, offset.y / zoom);

    const viewWidth = canvas.width / (dpr * zoom);
    const viewHeight = canvas.height / (dpr * zoom);
    const viewLeft = -offset.x / zoom - TILE_WIDTH * 2;
    const viewTop = -offset.y / zoom - TILE_HEIGHT * 4;
    const viewRight = viewWidth - offset.x / zoom + TILE_WIDTH * 2;
    const viewBottom = viewHeight - offset.y / zoom + TILE_HEIGHT * 4;

    const selected = new Set(selectedUnitIdsRef.current);

    for (const u of competitiveUnits) {
      const tileX = Math.max(0, Math.min(gridSize - 1, Math.floor(u.x)));
      const tileY = Math.max(0, Math.min(gridSize - 1, Math.floor(u.y)));

      // Hide enemy units in fog
      if (fogRevealed && u.ownerId !== humanPlayerId && !fogRevealed[tileY]?.[tileX]) {
        continue;
      }

      const { screenX, screenY } = gridToScreen(u.x, u.y, 0, 0);
      const cx = screenX + TILE_WIDTH / 2;
      const cy = screenY + TILE_HEIGHT / 2;

      if (cx < viewLeft - 80 || cx > viewRight + 80 || cy < viewTop - 80 || cy > viewBottom + 80) continue;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 6, 10, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      const color = playerColorById.get(u.ownerId) ?? '#e2e8f0';
      const isSelected = selected.has(u.id);

      // Unit body
      ctx.fillStyle = color;
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1.5;

      if (u.type === 'infantry') {
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (u.type === 'tank') {
        ctx.beginPath();
        ctx.roundRect(cx - 8, cy - 5, 16, 10, 2);
        ctx.fill();
        ctx.stroke();
        // turret
        ctx.beginPath();
        ctx.roundRect(cx - 3, cy - 8, 6, 6, 2);
        ctx.fill();
      } else {
        // helicopter
        ctx.beginPath();
        ctx.moveTo(cx, cy - 9);
        ctx.lineTo(cx + 9, cy + 6);
        ctx.lineTo(cx - 9, cy + 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Selection ring
      if (isSelected) {
        ctx.strokeStyle = 'rgba(96,165,250,0.95)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 12, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Low health indicator
      if (u.hp < u.maxHp) {
        const pct = Math.max(0, Math.min(1, u.hp / u.maxHp));
        const barW = 18;
        const barH = 3;
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(cx - barW / 2, cy - 18, barW, barH);
        ctx.fillStyle = pct > 0.6 ? '#22c55e' : pct > 0.3 ? '#f59e0b' : '#ef4444';
        ctx.fillRect(cx - barW / 2, cy - 18, barW * pct, barH);
      }
    }

    ctx.restore();
  }, [isCompetitive, humanPlayerId, competitiveUnits, fogRevealed, playerColorById, grid, gridSize, offset.x, offset.y, zoom]);

  const drawFogOfWar = useCallback((ctx: CanvasRenderingContext2D) => {
    if (!isCompetitive || !fogRevealed) return;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;

    ctx.save();
    ctx.scale(dpr * zoom, dpr * zoom);
    ctx.translate(offset.x / zoom, offset.y / zoom);

    const viewWidth = canvas.width / (dpr * zoom);
    const viewHeight = canvas.height / (dpr * zoom);
    const viewLeft = -offset.x / zoom - TILE_WIDTH * 2;
    const viewTop = -offset.y / zoom - TILE_HEIGHT * 4;
    const viewRight = viewWidth - offset.x / zoom + TILE_WIDTH * 2;
    const viewBottom = viewHeight - offset.y / zoom + TILE_HEIGHT * 4;

    // Approximate visible grid range based on center
    const centerWorldX = viewWidth / 2 - offset.x / zoom;
    const centerWorldY = viewHeight / 2 - offset.y / zoom;
    const centerGrid = screenToGrid(centerWorldX, centerWorldY, 0, 0);
    const range = Math.ceil(Math.max(viewWidth / (TILE_WIDTH / 2), viewHeight / (TILE_HEIGHT / 2))) + 10;
    const minGX = Math.max(0, Math.floor(centerGrid.gridX - range));
    const maxGX = Math.min(gridSize - 1, Math.ceil(centerGrid.gridX + range));
    const minGY = Math.max(0, Math.floor(centerGrid.gridY - range));
    const maxGY = Math.min(gridSize - 1, Math.ceil(centerGrid.gridY + range));

    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;

    for (let y = minGY; y <= maxGY; y++) {
      for (let x = minGX; x <= maxGX; x++) {
        if (fogRevealed[y]?.[x]) continue;
        const { screenX, screenY } = gridToScreen(x, y, 0, 0);
        const cx = screenX + TILE_WIDTH / 2;
        const cy = screenY + TILE_HEIGHT / 2;
        if (cx < viewLeft - 64 || cx > viewRight + 64 || cy < viewTop - 64 || cy > viewBottom + 64) continue;

        ctx.beginPath();
        ctx.moveTo(screenX + TILE_WIDTH / 2, screenY);
        ctx.lineTo(screenX + TILE_WIDTH, screenY + TILE_HEIGHT / 2);
        ctx.lineTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT);
        ctx.lineTo(screenX, screenY + TILE_HEIGHT / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    ctx.restore();
  }, [isCompetitive, fogRevealed, gridSize, offset.x, offset.y, zoom]);
  
  // Animate decorative car traffic AND emergency vehicles on top of the base canvas
  useEffect(() => {
    const canvas = carsCanvasRef.current;
    const airCanvas = airCanvasRef.current;
    if (!canvas || !airCanvas) return;
    const ctx = canvas.getContext('2d');
    const airCtx = airCanvas.getContext('2d');
    if (!ctx || !airCtx) return;
    
    ctx.imageSmoothingEnabled = false;
    airCtx.imageSmoothingEnabled = false;
    
    const clearAirCanvas = () => {
      airCtx.setTransform(1, 0, 0, 1, 0, 0);
      airCtx.clearRect(0, 0, airCanvas.width, airCanvas.height);
    };
    
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
        updateSeaplanes(delta); // Update seaplanes (bay/large water required)
        updateBoats(delta); // Update boats (marina/pier required)
        updateBarges(delta); // Update ocean barges (ocean marinas required)
        updateTrains(delta); // Update trains on rail network
        updateFireworks(delta, visualHour); // Update fireworks (nighttime only)
        updateSmog(delta); // Update factory smog particles
        navLightFlashTimerRef.current += delta * 3; // Update nav light flash timer
        trafficLightTimerRef.current += delta; // Update traffic light cycle timer
        crossingFlashTimerRef.current += delta; // Update crossing flash timer
        
        // Update railroad crossing gate angles based on train proximity
        // PERF: Use cached crossing positions instead of O(n²) grid scan
        const trains = trainsRef.current;
        const gateAngles = crossingGateAnglesRef.current;
        const gateSpeedMult = speed === 0 ? 0 : speed === 1 ? 1 : speed === 2 ? 2.5 : 4;
        const crossings = crossingPositionsRef.current;
        
        // Iterate only over known crossings (O(k) where k = number of crossings)
        for (let i = 0; i < crossings.length; i++) {
          const { x: gx, y: gy } = crossings[i];
          // PERF: Use numeric key instead of string concatenation
          const key = gy * gridSize + gx;
          const currentAngle = gateAngles.get(key) ?? 0;
          const crossingState = getCrossingStateForTile(trains, gx, gy);
          
          // Determine target angle based on state
          const targetAngle = crossingState === 'open' ? 0 : 90;
          
          // Animate gate toward target
          if (currentAngle !== targetAngle) {
            const angleDelta = GATE_ANIMATION_SPEED * delta * gateSpeedMult;
            if (currentAngle < targetAngle) {
              gateAngles.set(key, Math.min(targetAngle, currentAngle + angleDelta));
            } else {
              gateAngles.set(key, Math.max(targetAngle, currentAngle - angleDelta));
            }
          }
        }
      }
      // PERF: Skip drawing animated elements during mobile panning/zooming for better performance
      const skipAnimatedElements = isMobile && (isPanningRef.current || isPinchZoomingRef.current);
      // PERF: Skip small elements (boats, helis, smog) on desktop when panning while very zoomed out
      const skipSmallElements = !isMobile && isPanningRef.current && zoomRef.current < SKIP_SMALL_ELEMENTS_ZOOM_THRESHOLD;
      
      if (skipAnimatedElements) {
        // Clear the canvases but don't draw anything - hides all animated elements while panning/zooming
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        clearAirCanvas();
      } else {
        drawCars(ctx);
        if (!skipSmallElements) {
          drawBoats(ctx); // Draw boats on water (skip when panning zoomed out on desktop)
        }
        drawBarges(ctx); // Draw ocean barges (larger, keep visible)
        drawTrainsCallback(ctx); // Draw trains on rail network
        if (!skipSmallElements) {
          drawSmog(ctx); // Draw factory smog (skip when panning zoomed out on desktop)
        }
        drawPedestrians(ctx); // Draw walking pedestrians (below buildings)
        drawEmergencyVehicles(ctx); // Draw emergency vehicles!
        clearAirCanvas();
        
        // Draw incident indicators on air canvas (above buildings so tooltips are visible)
        drawIncidentIndicators(airCtx, delta); // Draw fire/crime incident indicators!
        
        // Draw recreation pedestrians on air canvas (above parks, not other buildings)
        drawRecreationPedestrians(airCtx); // Draw recreation pedestrians (at parks, benches, etc.)
        
        if (!skipSmallElements) {
          drawHelicopters(airCtx); // Draw helicopters (skip when panning zoomed out on desktop)
          drawSeaplanes(airCtx); // Draw seaplanes (skip when panning zoomed out on desktop)
        }
        drawMilitaryUnits(airCtx); // Competitive RTS units (above buildings)
        drawAirplanes(airCtx); // Draw airplanes above everything
        drawFireworks(airCtx); // Draw fireworks above everything (nighttime only)
        drawFogOfWar(airCtx); // Fog-of-war overlay (covers everything)
      }
    };
    
    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [canvasSize.width, canvasSize.height, updateCars, drawCars, spawnCrimeIncidents, updateCrimeIncidents, updateEmergencyVehicles, drawEmergencyVehicles, updatePedestrians, drawPedestrians, drawRecreationPedestrians, updateAirplanes, drawAirplanes, updateHelicopters, drawHelicopters, updateSeaplanes, drawSeaplanes, updateBoats, drawBoats, updateBarges, drawBarges, updateTrains, drawTrainsCallback, drawIncidentIndicators, updateFireworks, drawFireworks, updateSmog, drawSmog, drawMilitaryUnits, drawFogOfWar, visualHour, isMobile, grid, gridSize, speed]);
  
  // Day/Night cycle lighting rendering - optimized for performance
  useEffect(() => {
    const canvas = lightingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // PERF: Hide lighting during mobile panning/zooming for better performance
    if (isMobile && (isPanningRef.current || isPinchZoomingRef.current)) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    
    const dpr = window.devicePixelRatio || 1;
    
    // Calculate darkness based on visualHour (0-23)
    // Dawn: 5-7, Day: 7-18, Dusk: 18-20, Night: 20-5
    const getDarkness = (h: number): number => {
      if (h >= 7 && h < 18) return 0; // Full daylight
      if (h >= 5 && h < 7) return 1 - (h - 5) / 2; // Dawn transition
      if (h >= 18 && h < 20) return (h - 18) / 2; // Dusk transition
      return 1; // Night
    };
    
    const darkness = getDarkness(visualHour);
    
    // Clear canvas first
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // If it's full daylight, just clear and return (early exit)
    if (darkness <= 0.01) return;
    
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
    
    const ambient = getAmbientColor(visualHour);
    
    // Apply darkness overlay
    const alpha = darkness * 0.6;
    ctx.fillStyle = `rgba(${ambient.r}, ${ambient.g}, ${ambient.b}, ${alpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Calculate viewport bounds once
    const viewWidth = canvas.width / (dpr * zoom);
    const viewHeight = canvas.height / (dpr * zoom);
    const viewLeft = -offset.x / zoom - TILE_WIDTH * 2;
    const viewTop = -offset.y / zoom - TILE_HEIGHT * 4;
    const viewRight = viewWidth - offset.x / zoom + TILE_WIDTH * 2;
    const viewBottom = viewHeight - offset.y / zoom + TILE_HEIGHT * 4;
    
    // PERF: Pre-compute visible diagonal range to skip entire rows of tiles
    // In isometric rendering, screenY = (x + y) * (TILE_HEIGHT / 2), so sum = x + y = screenY * 2 / TILE_HEIGHT
    // Add padding for tall buildings that may extend above their tile position
    const visibleMinSum = Math.max(0, Math.floor((viewTop - TILE_HEIGHT * 6) * 2 / TILE_HEIGHT));
    const visibleMaxSum = Math.min(gridSize * 2 - 2, Math.ceil((viewBottom + TILE_HEIGHT) * 2 / TILE_HEIGHT));
    
    const gridToScreen = (gx: number, gy: number) => ({
      screenX: (gx - gy) * TILE_WIDTH / 2,
      screenY: (gx + gy) * TILE_HEIGHT / 2,
    });
    
    const lightIntensity = Math.min(1, darkness * 1.3);
    
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
    
    // PERF: On mobile, sample fewer lights to reduce gradient count
    const roadSampleRate = isMobile ? 3 : 1; // Every 3rd road on mobile
    let roadCounter = 0;
    
    // PERF: Only iterate through diagonal bands that intersect the visible viewport
    // This skips entire rows of tiles that can't possibly be visible, significantly reducing iterations
    for (let sum = visibleMinSum; sum <= visibleMaxSum; sum++) {
      for (let x = Math.max(0, sum - gridSize + 1); x <= Math.min(sum, gridSize - 1); x++) {
        const y = sum - x;
        if (y < 0 || y >= gridSize) continue;
        
        const { screenX, screenY } = gridToScreen(x, y);
        
        // Viewport culling for horizontal bounds
        if (screenX + TILE_WIDTH < viewLeft || screenX > viewRight ||
            screenY + TILE_HEIGHT * 3 < viewTop || screenY > viewBottom) {
          continue;
        }
        
        const tile = grid[y][x];
        const buildingType = tile.building.type;
        
        if (buildingType === 'road') {
          roadCounter++;
          // PERF: On mobile, only include every Nth road light
          if (roadCounter % roadSampleRate === 0) {
            lightCutouts.push({ x, y, type: 'road' });
            if (!isMobile) {
              coloredGlows.push({ x, y, type: 'road' });
            }
          }
        } else if (!nonLitTypes.has(buildingType) && tile.building.powered) {
          lightCutouts.push({ x, y, type: 'building', buildingType, seed: x * 1000 + y });
          
          // Check for special colored glows (skip on mobile for performance)
          if (!isMobile && (buildingType === 'hospital' || buildingType === 'fire_station' || 
              buildingType === 'police_station' || buildingType === 'power_plant')) {
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
        gradient.addColorStop(0, `rgba(255, 255, 255, ${0.75 * lightIntensity})`);
        gradient.addColorStop(0.4, `rgba(255, 255, 255, ${0.4 * lightIntensity})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(tileCenterX, tileCenterY, lightRadius, 0, Math.PI * 2);
        ctx.fill();
      } else if (light.type === 'building' && light.buildingType && light.seed !== undefined) {
        const buildingType = light.buildingType;
        const isResidential = residentialTypes.has(buildingType);
        const isCommercial = commercialTypes.has(buildingType);
        const glowStrength = isCommercial ? 0.9 : isResidential ? 0.65 : 0.75;
        
        // PERF: On mobile, skip individual window lights - just use ground glow
        if (!isMobile) {
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
        }
        
        // Ground glow (on mobile, use a simpler/stronger single gradient)
        const groundGlowRadius = isMobile ? TILE_WIDTH * 0.5 : TILE_WIDTH * 0.6;
        const groundGlowAlpha = isMobile ? 0.4 : 0.28;
        const groundGlow = ctx.createRadialGradient(
          tileCenterX, tileCenterY + TILE_HEIGHT / 4, 0,
          tileCenterX, tileCenterY + TILE_HEIGHT / 4, groundGlowRadius
        );
        groundGlow.addColorStop(0, `rgba(255, 255, 255, ${groundGlowAlpha * lightIntensity})`);
        groundGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = groundGlow;
        ctx.beginPath();
        ctx.ellipse(tileCenterX, tileCenterY + TILE_HEIGHT / 4, groundGlowRadius, TILE_HEIGHT / 2.5, 0, 0, Math.PI * 2);
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
        gradient.addColorStop(0, `rgba(255, 210, 130, ${0.3 * lightIntensity})`);
        gradient.addColorStop(0.5, `rgba(255, 190, 100, ${0.15 * lightIntensity})`);
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
          gradient.addColorStop(0, `rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, ${0.55 * lightIntensity})`);
          gradient.addColorStop(0.5, `rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, ${0.25 * lightIntensity})`);
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
    
  }, [grid, gridSize, visualHour, offset, zoom, canvasSize.width, canvasSize.height, isMobile, isPanning]);
  
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
        const worldX = mouseX - offset.x / zoom;
        const worldY = mouseY - offset.y / zoom;
        const { gridX, gridY } = screenToGrid(mouseX, mouseY, offset.x / zoom, offset.y / zoom);
        
        if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
          if (selectedTool === 'select') {
            // Competitive RTS: click/drag selects units; click selects tile if no unit drag
            if (isCompetitive && humanPlayerId) {
              // Try to select a friendly unit under cursor first
              const hitRadius = 26;
              const friendlyUnits = competitiveUnits.filter(u => u.ownerId === humanPlayerId);
              let hitUnit: CompetitiveUnit | null = null;
              for (const u of friendlyUnits) {
                const { screenX, screenY } = gridToScreen(u.x, u.y, 0, 0);
                const cx = screenX + TILE_WIDTH / 2;
                const cy = screenY + TILE_HEIGHT / 2;
                const dist = Math.hypot(worldX - cx, worldY - cy);
                if (dist <= hitRadius) {
                  hitUnit = u;
                  break;
                }
              }

              if (hitUnit) {
                setSelectedTile(null);
                setIsUnitSelecting(false);
                setUnitDragStartWorld(null);
                setUnitDragEndWorld(null);
                pendingSelectTileRef.current = null;

                setSelectedUnitIds((prev) => {
                  if (e.shiftKey) {
                    return prev.includes(hitUnit!.id)
                      ? prev.filter(id => id !== hitUnit!.id)
                      : prev.concat([hitUnit!.id]);
                  }
                  return [hitUnit!.id];
                });
              } else {
                // Start drag selection; tile selection happens on mouse up if no drag distance
                pendingSelectTileRef.current = { x: gridX, y: gridY };
                setIsUnitSelecting(true);
                setUnitDragStartWorld({ x: worldX, y: worldY });
                setUnitDragEndWorld({ x: worldX, y: worldY });
              }
            } else {
              // Sandbox: For multi-tile buildings, select the origin tile
              const origin = findBuildingOrigin(gridX, gridY);
              if (origin) {
                setSelectedTile({ x: origin.originX, y: origin.originY });
              } else {
                setSelectedTile({ x: gridX, y: gridY });
              }
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
            // Track initial tile for roads, rail, and subways
            if (selectedTool === 'road' || selectedTool === 'rail' || selectedTool === 'subway') {
              placedRoadTilesRef.current.add(`${gridX},${gridY}`);
            }
          }
        }
      }
    }
  }, [offset, gridSize, selectedTool, placeAtTile, zoom, showsDragGrid, supportsDragPlace, setSelectedTile, findBuildingOrigin, isCompetitive, humanPlayerId, competitiveUnits]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (!isCompetitive || !humanPlayerId) return;
    e.preventDefault();

    const unitIds = selectedUnitIdsRef.current;
    if (unitIds.length === 0) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = (e.clientX - rect.left) / zoom;
    const mouseY = (e.clientY - rect.top) / zoom;
    const { gridX, gridY } = screenToGrid(mouseX, mouseY, offset.x / zoom, offset.y / zoom);

    if (gridX < 0 || gridX >= gridSize || gridY < 0 || gridY >= gridSize) return;

    // Can't command into unrevealed fog
    if (fogRevealed && !fogRevealed[gridY]?.[gridX]) return;

    const tile = grid[gridY]?.[gridX];
    if (!tile) return;

    const buildingType = tile.building.type;
    const isAttackable = !(buildingType === 'water' || buildingType === 'grass' || buildingType === 'tree' || buildingType === 'road' || buildingType === 'rail' || buildingType === 'empty');

    if (isAttackable && tile.building.ownerId && tile.building.ownerId !== humanPlayerId) {
      // Attack enemy building (use origin tile for multi-tile buildings)
      const origin = findBuildingOrigin(gridX, gridY);
      const target = origin ? { x: origin.originX, y: origin.originY } : { x: gridX, y: gridY };
      issueUnitOrders(unitIds, { kind: 'attack', target });
    } else {
      // Move command
      issueUnitOrders(unitIds, { kind: 'move', target: { x: gridX, y: gridY } });
    }
  }, [isCompetitive, humanPlayerId, grid, gridSize, offset.x, offset.y, zoom, fogRevealed, findBuildingOrigin, issueUnitOrders]);
  
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
      const worldX = mouseX - offset.x / zoom;
      const worldY = mouseY - offset.y / zoom;
      const { gridX, gridY } = screenToGrid(mouseX, mouseY, offset.x / zoom, offset.y / zoom);
      
      if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
        // Only update hovered tile if it actually changed to avoid unnecessary re-renders
        setHoveredTile(prev => (prev?.x === gridX && prev?.y === gridY) ? prev : { x: gridX, y: gridY });

        // Competitive: update unit selection rectangle
        if (isCompetitive && isUnitSelecting && unitDragStartWorld) {
          setUnitDragEndWorld({ x: worldX, y: worldY });
        }
        
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
        // For roads, rail, and subways, use straight-line snapping
        else if (isDragging && (selectedTool === 'road' || selectedTool === 'rail' || selectedTool === 'subway') && dragStartTile) {
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
  }, [isPanning, dragStart, offset, zoom, gridSize, isDragging, showsDragGrid, dragStartTile, selectedTool, roadDrawDirection, supportsDragPlace, placeAtTile, clampOffset, grid, isCompetitive, isUnitSelecting, unitDragStartWorld]);
  
  const handleMouseUp = useCallback(() => {
    // Competitive: finish unit drag-selection / click-to-select-tile
    if (isCompetitive && isUnitSelecting && unitDragStartWorld && unitDragEndWorld && humanPlayerId) {
      const dx = Math.abs(unitDragEndWorld.x - unitDragStartWorld.x);
      const dy = Math.abs(unitDragEndWorld.y - unitDragStartWorld.y);
      const didDrag = dx > 6 || dy > 6;

      if (didDrag) {
        const minX = Math.min(unitDragStartWorld.x, unitDragEndWorld.x);
        const minY = Math.min(unitDragStartWorld.y, unitDragEndWorld.y);
        const maxX = Math.max(unitDragStartWorld.x, unitDragEndWorld.x);
        const maxY = Math.max(unitDragStartWorld.y, unitDragEndWorld.y);

        const picked: string[] = [];
        for (const u of competitiveUnits) {
          if (u.ownerId !== humanPlayerId) continue;
          const { screenX, screenY } = gridToScreen(u.x, u.y, 0, 0);
          const cx = screenX + TILE_WIDTH / 2;
          const cy = screenY + TILE_HEIGHT / 2;
          if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
            picked.push(u.id);
          }
        }

        setSelectedTile(null);
        setSelectedUnitIds(picked);
      } else {
        // Treat as a click on a tile (and clear unit selection)
        const pending = pendingSelectTileRef.current;
        if (pending) {
          const origin = findBuildingOrigin(pending.x, pending.y);
          if (origin) setSelectedTile({ x: origin.originX, y: origin.originY });
          else setSelectedTile({ x: pending.x, y: pending.y });
        }
        setSelectedUnitIds([]);
      }

      pendingSelectTileRef.current = null;
      setIsUnitSelecting(false);
      setUnitDragStartWorld(null);
      setUnitDragEndWorld(null);
      return;
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
    
    // After placing roads or rail, check if any cities should be discovered
    // This happens after any road/rail placement (drag or click) reaches an edge
    if (isDragging && (selectedTool === 'road' || selectedTool === 'rail')) {
      // Use setTimeout to allow state to update first, then check for discoverable cities
      setTimeout(() => {
        checkAndDiscoverCities((discoveredCity) => {
          // Show dialog for the newly discovered city
          setCityConnectionDialog({ direction: discoveredCity.direction });
        });
      }, 50);
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
  }, [isCompetitive, isUnitSelecting, unitDragStartWorld, unitDragEndWorld, humanPlayerId, competitiveUnits, setSelectedTile, findBuildingOrigin, isDragging, showsDragGrid, dragStartTile, placeAtTile, selectedTool, dragEndTile, checkAndDiscoverCities]);
  
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // Mouse position relative to canvas (in screen pixels)
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Calculate new zoom
    const zoomDelta = e.deltaY > 0 ? -0.05 : 0.05;
    const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom + zoomDelta));
    
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
      isPinchZoomingRef.current = false;
    } else if (e.touches.length === 2) {
      // Two finger touch - pinch to zoom
      const distance = getTouchDistance(e.touches[0], e.touches[1]);
      initialPinchDistanceRef.current = distance;
      initialZoomRef.current = zoom;
      lastTouchCenterRef.current = getTouchCenter(e.touches[0], e.touches[1]);
      setIsPanning(false);
      isPinchZoomingRef.current = true;
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
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, initialZoomRef.current * scale));

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
      isPinchZoomingRef.current = false;
      touchStartRef.current = null;
      initialPinchDistanceRef.current = null;
      lastTouchCenterRef.current = null;
    } else if (e.touches.length === 1) {
      // Went from 2 touches to 1 - reset to pan mode
      const touch = e.touches[0];
      setDragStart({ x: touch.clientX - offset.x, y: touch.clientY - offset.y });
      setIsPanning(true);
      isPinchZoomingRef.current = false;
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
      onContextMenu={handleContextMenu}
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
      {/* PERF: Separate canvas for hover/selection highlights - avoids full redraw on mouse move */}
      <canvas
        ref={hoverCanvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="absolute top-0 left-0 pointer-events-none"
      />
      <canvas
        ref={carsCanvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="absolute top-0 left-0 pointer-events-none"
      />
      <canvas
        ref={buildingsCanvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="absolute top-0 left-0 pointer-events-none"
      />
      <canvas
        ref={airCanvasRef}
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
        // Find a discovered but not connected city in this direction
        const city = adjacentCities.find(c => c.direction === cityConnectionDialog.direction && c.discovered && !c.connected);
        if (!city) return null;
        
        return (
          <Dialog open={true} onOpenChange={() => {
            setCityConnectionDialog(null);
            setDragStartTile(null);
            setDragEndTile(null);
          }}>
            <DialogContent className="max-w-[400px]">
              <DialogHeader>
                <DialogTitle>City Discovered!</DialogTitle>
                <DialogDescription>
                  Your road has reached the {cityConnectionDialog.direction} border! You&apos;ve discovered {city.name}.
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
                    Maybe Later
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
            <div className="bg-sidebar border border-sidebar-border rounded-md shadow-lg px-3 py-2 w-[220px]">
              {/* Header */}
              <div className="flex items-center gap-2 mb-1">
                {hoveredIncident.type === 'fire' ? (
                  <FireIcon size={14} className="text-red-400" />
                ) : (
                  <SafetyIcon size={14} className="text-blue-400" />
                )}
                <span className="text-xs font-semibold text-sidebar-foreground">
                  {hoveredIncident.type === 'fire' 
                    ? getFireNameForTile(hoveredIncident.x, hoveredIncident.y)
                    : hoveredIncident.crimeType 
                      ? getCrimeName(hoveredIncident.crimeType)
                      : 'Incident'}
                </span>
              </div>
              
              {/* Description */}
              <p className="text-[11px] text-muted-foreground leading-tight">
                {hoveredIncident.type === 'fire' 
                  ? getFireDescriptionForTile(hoveredIncident.x, hoveredIncident.y)
                  : hoveredIncident.crimeType 
                    ? getCrimeDescription(hoveredIncident.crimeType)
                    : 'Incident reported.'}
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
