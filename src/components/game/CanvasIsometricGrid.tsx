'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useMessages, T, Var, useGT } from 'gt-next';
import { useGame } from '@/context/GameContext';
import { useCustomBuildingsOptional } from '@/context/CustomBuildingsContext';
import { TOOL_INFO, Tile, Building, BuildingType, AdjacentCity, Tool } from '@/types/game';
import { getBuildingSize, requiresWaterAdjacency, getWaterAdjacency } from '@/lib/simulation';
import { FireIcon, SafetyIcon } from '@/components/ui/Icons';
import { getSpriteCoords, BUILDING_TO_SPRITE, SPRITE_VERTICAL_OFFSETS, SPRITE_HORIZONTAL_OFFSETS, getActiveSpritePack } from '@/lib/renderConfig';
import { selectSpriteSource, calculateSpriteCoords, calculateSpriteScale, calculateSpriteOffsets, getSpriteRenderInfo } from '@/components/game/buildingSprite';

// Import shadcn components
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

// Import extracted game components, types, and utilities
import {
  TILE_WIDTH,
  TILE_HEIGHT,
  KEY_PAN_SPEED,
  Car,
  Bus,
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
  Cloud,
  WorldRenderState,
} from '@/components/game/types';
import {
  SKIP_SMALL_ELEMENTS_ZOOM_THRESHOLD,
  ZOOM_MIN,
  ZOOM_MAX,
  WATER_ASSET_PATH,
  AIRPLANE_SPRITE_SRC,
  TRAIN_MIN_ZOOM,
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
  OVERLAY_TO_BUILDING_TYPES,
  OVERLAY_CIRCLE_COLORS,
  OVERLAY_CIRCLE_FILL_COLORS,
  OVERLAY_HIGHLIGHT_COLORS,
} from '@/components/game/overlays';
import { SERVICE_CONFIG, SERVICE_RANGE_INCREASE_PER_LEVEL } from '@/lib/simulation';
import { drawPlaceholderBuilding } from '@/components/game/placeholders';
import { loadImage, loadSpriteImage, onImageLoaded, getCachedImage, getContentBounds } from '@/components/game/imageLoader';
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
} from '@/components/game/trafficSystem';
import { drawRoad, RoadDrawingOptions } from '@/components/game/roadDrawing';
import {
  drawBridgeTile,
  drawSuspensionBridgeTowers,
  drawSuspensionBridgeOverlay,
} from '@/components/game/bridgeDrawing';
import { CrimeType, getCrimeName, getCrimeDescription, getFireDescriptionForTile, getFireNameForTile } from '@/components/game/incidentData';
import {
  drawRailTrack,
  drawRailTracksOnly,
  countRailTiles,
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
  MAX_TRAINS_MOBILE,
  TRAIN_SPAWN_INTERVAL,
  TRAIN_SPAWN_INTERVAL_MOBILE,
  TRAINS_PER_RAIL_TILES,
  TRAINS_PER_RAIL_TILES_MOBILE,
} from '@/components/game/trainSystem';
import { Train } from '@/components/game/types';
import { useLightingSystem } from '@/components/game/lightingSystem';

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
  const { state, latestStateRef, placeAtTile, placeCustomBuilding, finishTrackDrag, connectToCity, checkAndDiscoverCities, currentSpritePack, visualHour } = useGame();
  const { grid, gridSize, selectedTool, speed, adjacentCities, waterBodies, gameVersion } = state;
  
  // Custom buildings context for AI-generated building placement
  const customBuildingsCtx = useCustomBuildingsOptional();
  const selectedCustomBuildingId = customBuildingsCtx?.selectedCustomBuildingId ?? null;
  const selectedCustomBuilding = selectedCustomBuildingId 
    ? customBuildingsCtx?.getCustomBuilding(selectedCustomBuildingId) 
    : null;
  const clearCustomSelection = customBuildingsCtx?.clearSelection;
  
  // PERF: Use latestStateRef for real-time grid access in animation loops
  // This avoids waiting for React state sync which is throttled for performance
  const m = useMessages();
  const gt = useGT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoverCanvasRef = useRef<HTMLCanvasElement>(null); // PERF: Separate canvas for hover/selection highlights
  const carsCanvasRef = useRef<HTMLCanvasElement>(null);
  const buildingsCanvasRef = useRef<HTMLCanvasElement>(null); // Buildings rendered on top of cars/trains
  const airCanvasRef = useRef<HTMLCanvasElement>(null); // Aircraft + fireworks rendered above buildings
  const lightingCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderPendingRef = useRef<number | null>(null); // PERF: Track pending render frame
  const lastMainRenderTimeRef = useRef<number>(0); // PERF: Throttle main renders at high speed
  const [offset, setOffset] = useState({ x: isMobile ? 200 : 620, y: isMobile ? 100 : 160 });
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isWheelZooming, setIsWheelZooming] = useState(false); // State to trigger re-render when wheel zooming stops
  const isPanningRef = useRef(false); // Ref for animation loop to check panning state
  const isPinchZoomingRef = useRef(false); // Ref for animation loop to check pinch zoom state
  const isWheelZoomingRef = useRef(false); // Ref for animation loop to check desktop wheel zoom state
  const wheelZoomTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Timeout to detect end of wheel zoom
  const zoomRef = useRef(isMobile ? 0.6 : 1); // Ref for animation loop to check zoom level
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const panCandidateRef = useRef<{ startX: number; startY: number; gridX: number; gridY: number } | null>(null);
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
  const carsRef = useRef<Car[]>([]);
  const carIdRef = useRef(0);
  const carSpawnTimerRef = useRef(0);
  const busesRef = useRef<Bus[]>([]);
  const busIdRef = useRef(0);
  const busSpawnTimerRef = useRef(0);
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

  // Cloud system refs
  const cloudsRef = useRef<Cloud[]>([]);
  const cloudIdRef = useRef(0);
  const cloudSpawnTimerRef = useRef(0);

  // Traffic light system timer (cumulative time for cycling through states)
  const trafficLightTimerRef = useRef(0);

  // Performance: Cache expensive grid calculations
  const cachedRoadTileCountRef = useRef<{ count: number; gridVersion: number }>({ count: 0, gridVersion: -1 });
  const cachedPopulationRef = useRef<{ count: number; gridVersion: number }>({ count: 0, gridVersion: -1 });
  // PERF: Cache intersection status per-tile to avoid repeated getDirectionOptions() calls
  const cachedIntersectionMapRef = useRef<{ map: Map<number, boolean>; gridVersion: number }>({ map: new Map(), gridVersion: -1 });
  const gridVersionRef = useRef(0);
  
  // Performance: Cache road merge analysis (expensive calculation done per-road-tile)
  const roadAnalysisCacheRef = useRef<Map<string, ReturnType<typeof analyzeMergedRoad>>>(new Map());
  const roadAnalysisCacheVersionRef = useRef(-1);

  // PERF: Cache background gradient - only recreate when canvas height changes
  const bgGradientCacheRef = useRef<{ gradient: CanvasGradient | null; height: number }>({ gradient: null, height: 0 });

  // PERF: Render queue arrays cached across frames to reduce GC pressure
  // These are cleared at the start of each render frame with .length = 0
  type BuildingDrawItem = { screenX: number; screenY: number; tile: Tile; depth: number };
  type OverlayDrawItem = { screenX: number; screenY: number; tile: Tile };
  const renderQueuesRef = useRef({
    buildingQueue: [] as BuildingDrawItem[],
    waterQueue: [] as BuildingDrawItem[],
    roadQueue: [] as BuildingDrawItem[],
    bridgeQueue: [] as BuildingDrawItem[],
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
  // Note: zone_water uses supportsDragPlace behavior (place on click/drag) instead of rectangle selection
  const showsDragGrid = ['zone_residential', 'zone_commercial', 'zone_industrial', 'zone_dezone'].includes(selectedTool);
  
  // Roads, bulldoze, and other tools support drag-to-place but don't show the grid
  const supportsDragPlace = selectedTool !== 'select';

  const PAN_DRAG_THRESHOLD = 6;

  // Use extracted building helpers (with pre-computed tile metadata for O(1) lookups)
  const { isPartOfMultiTileBuilding, findBuildingOrigin, isPartOfParkBuilding, getTileMetadata } = useBuildingHelpers(grid, gridSize);

  // Use extracted vehicle systems
  const vehicleSystemRefs: VehicleSystemRefs = {
    carsRef,
    carIdRef,
    carSpawnTimerRef,
    busesRef,
    busIdRef,
    busSpawnTimerRef,
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
    cachedIntersectionMapRef,
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
    updateBuses,
    updatePedestrians,
    drawCars,
    drawBuses,
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
    cloudsRef,
    cloudIdRef,
    cloudSpawnTimerRef,
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
    updateClouds,
    drawClouds,
  } = useEffectsSystems(effectsSystemRefs, effectsSystemState);
  
  // PERF: Sync worldStateRef from latestStateRef (real-time) instead of React state (throttled)
  // This runs on every animation frame via the render loop, not on React state changes
  useEffect(() => {
    // Initial sync from React state
    worldStateRef.current.grid = grid;
    worldStateRef.current.gridSize = gridSize;
    gridVersionRef.current++;
    crossingPositionsRef.current = findRailroadCrossings(grid, gridSize);
  }, [grid, gridSize]);
  
  // PERF: Continuously sync from latestStateRef for real-time grid updates
  // This allows canvas to see simulation changes before React state syncs
  useEffect(() => {
    let animFrameId: number;
    let lastGridVersion = 0;
    
    const syncFromRef = () => {
      animFrameId = requestAnimationFrame(syncFromRef);
      
      // Only update if latestStateRef has newer data
      const latest = latestStateRef.current;
      if (latest && latest.grid !== worldStateRef.current.grid) {
        worldStateRef.current.grid = latest.grid;
        worldStateRef.current.gridSize = latest.gridSize;
        // Only recalculate crossings if grid actually changed
        const newVersion = gridVersionRef.current + 1;
        if (newVersion !== lastGridVersion) {
          lastGridVersion = newVersion;
          gridVersionRef.current = newVersion;
          crossingPositionsRef.current = findRailroadCrossings(latest.grid, latest.gridSize);
        }
      }
    };
    
    animFrameId = requestAnimationFrame(syncFromRef);
    return () => cancelAnimationFrame(animFrameId);
  }, [latestStateRef]);

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
    
    // Clear clouds
    cloudsRef.current = [];
    cloudIdRef.current = 0;
    cloudSpawnTimerRef.current = 0;
    
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

    // Calculate max trains based on rail network size - lower limits on mobile
    const maxTrainsLimit = isMobile ? MAX_TRAINS_MOBILE : MAX_TRAINS;
    const trainsPerTile = isMobile ? TRAINS_PER_RAIL_TILES_MOBILE : TRAINS_PER_RAIL_TILES;
    const maxTrains = Math.min(maxTrainsLimit, Math.ceil(railTileCount / trainsPerTile));
    
    // Speed multiplier based on game speed
    const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2 : 3;

    // Spawn timer - slower on mobile
    const spawnInterval = isMobile ? TRAIN_SPAWN_INTERVAL_MOBILE : TRAIN_SPAWN_INTERVAL;
    trainSpawnTimerRef.current -= delta;
    if (trainsRef.current.length < maxTrains && trainSpawnTimerRef.current <= 0) {
      const newTrain = spawnTrain(currentGrid, currentGridSize, trainIdRef);
      if (newTrain) {
        trainsRef.current.push(newTrain);
      }
      trainSpawnTimerRef.current = spawnInterval;
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
    
    // Skip drawing trains when very zoomed out (for large map performance)
    if (currentZoom < TRAIN_MIN_ZOOM) {
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
      if (currentSpritePack.servicesSrc) {
        loadSpriteImage(currentSpritePack.servicesSrc, true).catch(console.error);
      }
      if (currentSpritePack.infrastructureSrc) {
        loadSpriteImage(currentSpritePack.infrastructureSrc, true).catch(console.error);
      }
      if (currentSpritePack.mansionsSrc) {
        loadSpriteImage(currentSpritePack.mansionsSrc, true).catch(console.error);
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
      
      // PERF: Throttle main renders at 3x speed to reduce dropped frames
      // At high speed, we can skip some renders since simulation ticks are frequent
      const currentSpeed = worldStateRef.current.speed;
      const now = performance.now();
      const timeSinceLastRender = now - lastMainRenderTimeRef.current;
      const minRenderInterval = currentSpeed === 3 ? 50 : 0; // Skip renders within 50ms at 3x speed
      
      if (timeSinceLastRender < minRenderInterval) {
        return; // Skip this render, next tick will trigger a new one
      }
      lastMainRenderTimeRef.current = now;
      
      const dpr = window.devicePixelRatio || 1;
    
      // Disable image smoothing for crisp pixel art
      ctx.imageSmoothingEnabled = false;
    
      // PERF: Clear canvas with cached gradient background - only recreate when canvas height changes
      const bgCache = bgGradientCacheRef.current;
      if (!bgCache.gradient || bgCache.height !== canvas.height) {
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#0f1419');
        gradient.addColorStop(0.5, '#141c24');
        gradient.addColorStop(1, '#1a2a1f');
        bgCache.gradient = gradient;
        bgCache.height = canvas.height;
      }
      ctx.fillStyle = bgCache.gradient;
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
    queues.bridgeQueue.length = 0;
    queues.railQueue.length = 0;
    queues.beachQueue.length = 0;
    queues.baseTileQueue.length = 0;
    queues.greenBaseTileQueue.length = 0;
    queues.overlayQueue.length = 0;

    const buildingQueue = queues.buildingQueue;
    const waterQueue = queues.waterQueue;
    const roadQueue = queues.roadQueue;
    const bridgeQueue = queues.bridgeQueue;
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
    
    // Helper function to check if a tile is water
    function isWater(gridX: number, gridY: number): boolean {
      if (gridX < 0 || gridX >= gridSize || gridY < 0 || gridY >= gridSize) return false;
      return grid[gridY][gridX].building.type === 'water';
    }
    
    // Helper function to check if a tile has a road or bridge
    function hasRoad(gridX: number, gridY: number): boolean {
      if (gridX < 0 || gridX >= gridSize || gridY < 0 || gridY >= gridSize) return false;
      const type = grid[gridY][gridX].building.type;
      return type === 'road' || type === 'bridge';
    }
    
    // Helper function to check if a tile is a bridge (for beach exclusion)
    function isBridge(gridX: number, gridY: number): boolean {
      if (gridX < 0 || gridX >= gridSize || gridY < 0 || gridY >= gridSize) return false;
      return grid[gridY][gridX].building.type === 'bridge';
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

    // Create road drawing options for the extracted drawRoad function
    const roadDrawingOptions: RoadDrawingOptions = {
      hasRoad,
      getMergeInfo: getCachedMergeInfo,
      isMobile,
      isPanning: isPanningRef.current,
      isPinchZooming: isPinchZoomingRef.current,
      trafficLightTimer: trafficLightTimerRef.current,
    };
    
    
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
      } else if (tile.building.type === 'road' || tile.building.type === 'bridge') {
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
      // Also skip bridge tiles - they will have water drawn underneath them in the road queue
      const shouldSkipDrawing = (skipGreenBase && (tile.building.type === 'grass' || tile.building.type === 'empty' || tile.building.type === 'tree')) || 
                                tile.building.type === 'bridge';
      
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
      
      // Handle custom AI-generated buildings
      // Note: Background is already removed by fal.ai server-side
      if (buildingType === 'custom' && tile.building.customSpriteUrl) {
        const spriteUrl = tile.building.customSpriteUrl;
        let customImg = getCachedImage(spriteUrl);
        
        // If not cached, start loading it
        if (!customImg) {
          loadImage(spriteUrl).catch((err) => {
            console.warn('Failed to load custom building sprite:', err);
          });
          // Draw placeholder while loading
          ctx.fillStyle = 'rgba(139, 92, 246, 0.5)'; // Semi-transparent purple
          ctx.beginPath();
          ctx.moveTo(x + w / 2, y);
          ctx.lineTo(x + w, y + h / 2);
          ctx.lineTo(x + w / 2, y + h);
          ctx.lineTo(x, y + h / 2);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#8B5CF6';
          ctx.lineWidth = 2;
          ctx.stroke();
          return;
        }
        
        if (customImg.complete && customImg.naturalWidth > 0) {
          const customSize = tile.building.customSize || 1;
          
          // Calculate sprite dimensions based on building size
          const scaleMultiplier = customSize;
          const baseWidth = w * 1.2 * scaleMultiplier;
          const aspectRatio = customImg.naturalHeight / customImg.naturalWidth;
          const spriteHeight = baseWidth * aspectRatio;
          
          // Get content bounds to properly center the sprite
          // This handles AI-generated images that aren't perfectly centered
          const bounds = getContentBounds(spriteUrl, customImg);
          
          // x, y is the screen position of the origin tile (top-left in grid)
          // For an NxN isometric footprint, we need to:
          // 1. Find the screen center of the footprint (offset from origin)
          // 2. Center the sprite horizontally there
          // 3. Position vertically so bottom aligns with front edge
          
          // For square NxN footprint, center offset from origin:
          // - X offset: 0 (symmetric diamond)
          // - Y offset: (N-1) * (h/2) to reach the center row
          const centerYOffset = (customSize - 1) * (h / 2);
          
          // Front edge Y offset (where bottom of sprite should align)
          // Front corner is at grid (origin.x + N-1, origin.y + N-1)
          // Screen Y offset = (N-1 + N-1) * (h/2) = (N-1) * h
          const frontYOffset = (customSize - 1) * h;
          
          // Content-aware centering correction:
          // bounds.centerOffsetX tells us how far the content is shifted from image center
          // If content is shifted right (positive offset), we need to shift the sprite LEFT
          // to compensate, so we subtract the offset
          const contentCorrectionX = -bounds.centerOffsetX * baseWidth;
          
          // For vertical: if content is shifted down in the image, we need to shift sprite UP
          // But we also want the BOTTOM of the content to align with the tile, not the image bottom
          // Calculate where the content bottom is relative to image bottom
          const imgHeight = customImg.naturalHeight;
          const contentBottomFromImgBottom = imgHeight - bounds.maxY;
          const contentBottomRatio = contentBottomFromImgBottom / imgHeight;
          const contentCorrectionY = contentBottomRatio * spriteHeight;
          
          // Center sprite horizontally over the footprint, with content correction
          // The footprint center is at x + w/2 (since X doesn't shift for square)
          const spriteX = x + (w / 2) - (baseWidth / 2) + contentCorrectionX;
          
          // Position sprite bottom at the front edge of footprint
          // Front edge screen Y = y + frontYOffset + h (bottom of front tile)
          // Sprite bottom should be there, so spriteY = frontEdgeY - spriteHeight
          // Add content correction to align actual content bottom (not image bottom) with tile
          const frontEdgeY = y + frontYOffset + h;
          const spriteY = frontEdgeY - spriteHeight + (h * 0.15) + contentCorrectionY;
          
          ctx.drawImage(customImg, spriteX, spriteY, baseWidth, spriteHeight);
        } else {
          // Fallback: draw a placeholder diamond while loading
          ctx.fillStyle = 'rgba(139, 92, 246, 0.5)';
          ctx.beginPath();
          ctx.moveTo(x + w / 2, y);
          ctx.lineTo(x + w, y + h / 2);
          ctx.lineTo(x + w / 2, y + h);
          ctx.lineTo(x, y + h / 2);
          ctx.closePath();
          ctx.fill();
        }
        return;
      }
      
      // Handle roads separately with adjacency
      if (buildingType === 'road') {
        drawRoad(ctx, x, y, tile.x, tile.y, zoom, roadDrawingOptions);
        return;
      }
      
      // Handle bridges with special rendering
      if (buildingType === 'bridge') {
        drawBridgeTile(ctx, x, y, tile.building, tile.x, tile.y, zoom);
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
            
            // PERF: When zoomed out (zoom < 0.5), use single pass water rendering to reduce draw calls
            // At low zoom, the blending detail is not visible anyway
            if (zoom < 0.5) {
              // Simplified single-pass water at low zoom
              const destWidth = w * 1.15;
              const destHeight = destWidth * aspectRatio;
              ctx.globalAlpha = 0.9;
              ctx.drawImage(
                waterImage,
                srcX, srcY, cropW, cropH,
                Math.round(tileCenterX - destWidth / 2),
                Math.round(tileCenterY - destHeight / 2),
                Math.round(destWidth),
                Math.round(destHeight)
              );
            } else if (adjacentCount >= 2) {
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
          // Handles both single-tile and multi-tile buildings using extracted sprite utilities
          
          // Check if building is under construction (constructionProgress < 100)
          const isUnderConstruction = tile.building.constructionProgress !== undefined &&
                                       tile.building.constructionProgress < 100;
          
          // Construction has two phases:
          // Phase 1 (0-40%): Foundation/dirt plot phase - just show a dirt mound
          // Phase 2 (40-100%): Construction scaffolding phase - show construction sprite
          const constructionProgress = tile.building.constructionProgress ?? 100;
          const isFoundationPhase = isUnderConstruction && constructionProgress < 40;
          
          // If in foundation phase, draw the foundation plot and skip sprite rendering
          if (isFoundationPhase) {
            // Get building size to handle multi-tile foundations
            const buildingSize = getBuildingSize(buildingType);
            
            // For multi-tile buildings, we only draw the foundation from the origin tile
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
            return;
          }
          
          // Use extracted utilities to determine sprite source, coords, scale, and offsets
          const spriteSourceInfo = selectSpriteSource(buildingType, tile.building, tile.x, tile.y, activePack);
          const filteredSpriteSheet = getCachedImage(spriteSourceInfo.source, true) || getCachedImage(spriteSourceInfo.source);
          
          if (filteredSpriteSheet) {
            const sheetWidth = filteredSpriteSheet.naturalWidth || filteredSpriteSheet.width;
            const sheetHeight = filteredSpriteSheet.naturalHeight || filteredSpriteSheet.height;
            
            // Calculate sprite coordinates using extracted utility
            const coords = calculateSpriteCoords(buildingType, spriteSourceInfo, sheetWidth, sheetHeight, activePack);
            
            if (coords) {
              // Calculate scale and offsets using extracted utilities
              const scaleMultiplier = calculateSpriteScale(buildingType, spriteSourceInfo, tile.building, activePack);
              const offsets = calculateSpriteOffsets(buildingType, spriteSourceInfo, tile.building, activePack);
              
              // Get building size for positioning
              const buildingSize = getBuildingSize(buildingType);
              const isMultiTile = buildingSize.width > 1 || buildingSize.height > 1;
              
              // Calculate draw position for multi-tile buildings
              let drawPosX = x;
              let drawPosY = y;
              
              if (isMultiTile) {
                const frontmostOffsetX = buildingSize.width - 1;
                const frontmostOffsetY = buildingSize.height - 1;
                const screenOffsetX = (frontmostOffsetX - frontmostOffsetY) * (w / 2);
                const screenOffsetY = (frontmostOffsetX + frontmostOffsetY) * (h / 2);
                drawPosX = x + screenOffsetX;
                drawPosY = y + screenOffsetY;
              }
              
              // Calculate destination size
              const destWidth = w * 1.2 * scaleMultiplier;
              const aspectRatio = coords.sh / coords.sw;
              const destHeight = destWidth * aspectRatio;
              
              // Calculate final position with offsets
              const drawX = drawPosX + w / 2 - destWidth / 2 + offsets.horizontal * w;
              
              let verticalPush: number;
              if (isMultiTile) {
                const footprintDepth = buildingSize.width + buildingSize.height - 2;
                verticalPush = footprintDepth * h * 0.25;
              } else {
                verticalPush = destHeight * 0.15;
              }
              verticalPush += offsets.vertical * h;
              
              const drawY = drawPosY + h - destHeight + verticalPush;
              
              // Determine flip based on road adjacency or random
              const isWaterfrontAsset = requiresWaterAdjacency(buildingType);
              const shouldRoadMirror = (() => {
                if (isWaterfrontAsset) return false;
                
                const originMetadata = getTileMetadata(tile.x, tile.y);
                if (originMetadata?.hasAdjacentRoad) {
                  return originMetadata.shouldFlipForRoad;
                }
                
                const mirrorSeed = (tile.x * 47 + tile.y * 83) % 100;
                return mirrorSeed < 50;
              })();
              
              const baseFlipped = tile.building.flipped === true;
              const isFlipped = baseFlipped !== shouldRoadMirror;
              
              if (isFlipped) {
                ctx.save();
                const centerX = Math.round(drawX + destWidth / 2);
                ctx.translate(centerX, 0);
                ctx.scale(-1, 1);
                ctx.translate(-centerX, 0);
                
                ctx.drawImage(
                  filteredSpriteSheet,
                  coords.sx, coords.sy, coords.sw, coords.sh,
                  Math.round(drawX), Math.round(drawY),
                  Math.round(destWidth), Math.round(destHeight)
                );
                
                ctx.restore();
              } else {
                ctx.drawImage(
                  filteredSpriteSheet,
                  coords.sx, coords.sy, coords.sw, coords.sh,
                  Math.round(drawX), Math.round(drawY),
                  Math.round(destWidth), Math.round(destHeight)
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
        // Bridges go to a separate queue (drawn after roads to cover centerlines)
        else if (tile.building.type === 'bridge') {
          const depth = x + y;
          bridgeQueue.push({ screenX, screenY, tile, depth });
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
            // Use customSize for custom buildings, otherwise use getBuildingSize
            const size = tile.building.type === 'custom' && tile.building.customSize
              ? { width: tile.building.customSize, height: tile.building.customSize }
              : getBuildingSize(tile.building.type);
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
    // PERF: Skip beach rendering when zoomed out - detail is not visible
    if (zoom >= 0.4) {
      // PERF: Use for loop instead of forEach
      for (let i = 0; i < waterQueue.length; i++) {
        const { tile, screenX, screenY } = waterQueue[i];
        // Compute land adjacency for each edge (opposite of water adjacency)
        // Only consider tiles within bounds - don't draw beaches on map edges
        // Also exclude beaches next to marina docks, piers, and bridges (bridges are over water)
        const adjacentLand = {
          north: (tile.x - 1 >= 0 && tile.x - 1 < gridSize && tile.y >= 0 && tile.y < gridSize) && !isWater(tile.x - 1, tile.y) && !hasMarinaPier(tile.x - 1, tile.y) && !isBridge(tile.x - 1, tile.y),
          east: (tile.x >= 0 && tile.x < gridSize && tile.y - 1 >= 0 && tile.y - 1 < gridSize) && !isWater(tile.x, tile.y - 1) && !hasMarinaPier(tile.x, tile.y - 1) && !isBridge(tile.x, tile.y - 1),
          south: (tile.x + 1 >= 0 && tile.x + 1 < gridSize && tile.y >= 0 && tile.y < gridSize) && !isWater(tile.x + 1, tile.y) && !hasMarinaPier(tile.x + 1, tile.y) && !isBridge(tile.x + 1, tile.y),
          west: (tile.x >= 0 && tile.x < gridSize && tile.y + 1 >= 0 && tile.y + 1 < gridSize) && !isWater(tile.x, tile.y + 1) && !hasMarinaPier(tile.x, tile.y + 1) && !isBridge(tile.x, tile.y + 1),
        };
        drawBeachOnWater(ctx, screenX, screenY, adjacentLand);
      }
    }
    
    // PERF: Pre-compute tile dimensions once outside loops
    const tileWidth = TILE_WIDTH;
    const tileHeight = TILE_HEIGHT;
    const halfTileWidth = tileWidth / 2;
    const halfTileHeight = tileHeight / 2;
    
    // Draw green base tiles for grass/empty tiles adjacent to water BEFORE bridges
    // This ensures bridge railings are drawn on top of the green base tiles
    insertionSortByDepth(greenBaseTileQueue);
    for (let i = 0; i < greenBaseTileQueue.length; i++) {
      const { tile, screenX, screenY } = greenBaseTileQueue[i];
      drawGreenBaseTile(ctx, screenX, screenY, tile, zoom);
    }
    
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
    
    // Draw bridges AFTER roads to ensure bridge decks cover road centerlines
    insertionSortByDepth(bridgeQueue);
    for (let i = 0; i < bridgeQueue.length; i++) {
      const { tile, screenX, screenY } = bridgeQueue[i];
      
      // Draw water tile underneath the bridge
      drawWaterTileAt(ctx, screenX, screenY, tile.x, tile.y);
      
      // Draw bridge structure
      drawBuilding(ctx, screenX, screenY, tile);
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
    
    // Draw gray building base tiles (after rail, before crossings)
    insertionSortByDepth(baseTileQueue);
    // PERF: Use for loop instead of forEach
    for (let i = 0; i < baseTileQueue.length; i++) {
      const { tile, screenX, screenY } = baseTileQueue[i];
      drawGreyBaseTile(ctx, screenX, screenY, tile, zoom);
    }
    
    // Draw suspension bridge towers AGAIN on main canvas after base tiles
    // Draw suspension bridge FRONT towers on main canvas after base tiles
    // Only the front tower is drawn here (back tower was drawn before deck in drawBridgeTile)
    for (let i = 0; i < bridgeQueue.length; i++) {
      const { tile, screenX, screenY } = bridgeQueue[i];
      if (tile.building.bridgeType === 'suspension') {
        drawSuspensionBridgeTowers(ctx, screenX, screenY, tile.building, zoom);
      }
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
        
        // Draw suspension bridge towers ON TOP of buildings
        // These need to appear above nearby buildings for proper visual layering
        for (let i = 0; i < bridgeQueue.length; i++) {
          const { tile, screenX, screenY } = bridgeQueue[i];
          if (tile.building.bridgeType === 'suspension') {
            drawSuspensionBridgeTowers(buildingsCtx, screenX, screenY, tile.building, zoom);
          }
        }
        
        // Draw suspension bridge cables ON TOP of towers
        for (let i = 0; i < bridgeQueue.length; i++) {
          const { tile, screenX, screenY } = bridgeQueue[i];
          if (tile.building.bridgeType === 'suspension') {
            drawSuspensionBridgeOverlay(buildingsCtx, screenX, screenY, tile.building, zoom);
          }
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
          
          const fillStyle = getOverlayFillStyle(overlayMode, tile, coverage);
          // Only draw if there's actually a color to show
          if (fillStyle !== 'rgba(0, 0, 0, 0)') {
            buildingsCtx.fillStyle = fillStyle;
            buildingsCtx.beginPath();
            buildingsCtx.moveTo(screenX + halfTileWidth, screenY);
            buildingsCtx.lineTo(screenX + tileWidth, screenY + halfTileHeight);
            buildingsCtx.lineTo(screenX + halfTileWidth, screenY + tileHeight);
            buildingsCtx.lineTo(screenX, screenY + halfTileHeight);
            buildingsCtx.closePath();
            buildingsCtx.fill();
          }
        }
        
        // Draw service radius circles and building highlights for the active overlay
        if (overlayMode !== 'none' && overlayMode !== 'subway') {
          const serviceBuildingTypes = OVERLAY_TO_BUILDING_TYPES[overlayMode];
          const circleColor = OVERLAY_CIRCLE_COLORS[overlayMode];
          const circleFillColor = OVERLAY_CIRCLE_FILL_COLORS[overlayMode];
          const highlightColor = OVERLAY_HIGHLIGHT_COLORS[overlayMode];
          
          // Find all service buildings of this type and draw their radii
          for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
              const tile = grid[y][x];
              if (!serviceBuildingTypes.includes(tile.building.type)) continue;
              
              // Skip buildings under construction
              if (tile.building.constructionProgress !== undefined && tile.building.constructionProgress < 100) continue;
              
              // Skip abandoned buildings (they don't provide coverage in simulation)
              if (tile.building.abandoned) continue;
              
              // Get service config for this building type
              const config = SERVICE_CONFIG[tile.building.type as keyof typeof SERVICE_CONFIG];
              if (!config || !('range' in config)) continue;
              
              // Calculate effective range based on building level (linear increase per level)
              // Level 1: 100%, Level 2: 120%, Level 3: 140%, Level 4: 160%, Level 5: 180%
              const baseRange = config.range;
              const effectiveRange = baseRange * (1 + (tile.building.level - 1) * SERVICE_RANGE_INCREASE_PER_LEVEL);
              const range = Math.floor(effectiveRange);
              
              // NOTE: For multi-tile service buildings (e.g. 2x2 hospital, 3x3 university),
              // coverage is computed from the building's anchor tile (top-left of footprint)
              // in the simulation. We center the radius on that same tile to keep the
              // overlay consistent with actual service coverage.
              const { screenX: bldgScreenX, screenY: bldgScreenY } = gridToScreen(x, y, 0, 0);
              const centerX = bldgScreenX + halfTileWidth;
              const centerY = bldgScreenY + halfTileHeight;
              
              // Draw isometric ellipse for the radius
              // In isometric view, a circle becomes an ellipse
              // The radius in tiles needs to be converted to screen pixels
              const radiusX = range * halfTileWidth;
              const radiusY = range * halfTileHeight;
              
              buildingsCtx.strokeStyle = circleColor;
              buildingsCtx.lineWidth = 2 / zoom; // Keep line width consistent at different zoom levels
              buildingsCtx.beginPath();
              buildingsCtx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
              buildingsCtx.stroke();
              
              // Draw a subtle filled ellipse for better visibility
              buildingsCtx.fillStyle = circleFillColor;
              buildingsCtx.fill();
              
              // Draw highlight glow around the service building
              buildingsCtx.strokeStyle = highlightColor;
              buildingsCtx.lineWidth = 3 / zoom;
              buildingsCtx.beginPath();
              buildingsCtx.moveTo(bldgScreenX + halfTileWidth, bldgScreenY);
              buildingsCtx.lineTo(bldgScreenX + tileWidth, bldgScreenY + halfTileHeight);
              buildingsCtx.lineTo(bldgScreenX + halfTileWidth, bldgScreenY + tileHeight);
              buildingsCtx.lineTo(bldgScreenX, bldgScreenY + halfTileHeight);
              buildingsCtx.closePath();
              buildingsCtx.stroke();
              
              // Draw a dot at the building center
              buildingsCtx.fillStyle = highlightColor;
              buildingsCtx.beginPath();
              buildingsCtx.arc(centerX, centerY, 4 / zoom, 0, Math.PI * 2);
              buildingsCtx.fill();
            }
          }
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
    
    // Draw hovered tile highlight (with multi-tile preview for buildings)
    if (hoveredTile && hoveredTile.x >= 0 && hoveredTile.x < gridSize && hoveredTile.y >= 0 && hoveredTile.y < gridSize) {
      // Check if a custom building is selected for placement
      if (selectedCustomBuilding) {
        const customSize = selectedCustomBuilding.size;
        // Draw highlight for each tile in the custom building footprint
        for (let dx = 0; dx < customSize; dx++) {
          for (let dy = 0; dy < customSize; dy++) {
            const tx = hoveredTile.x + dx;
            const ty = hoveredTile.y + dy;
            if (tx >= 0 && tx < gridSize && ty >= 0 && ty < gridSize) {
              const { screenX, screenY } = gridToScreen(tx, ty, 0, 0);
              // Use purple highlight for custom buildings
              drawHighlight(screenX, screenY, 'rgba(139, 92, 246, 0.3)', '#a78bfa');
            }
          }
        }
      } else {
        // Check if selectedTool is a building type (not a non-building tool)
        const nonBuildingTools: Tool[] = ['select', 'bulldoze', 'road', 'rail', 'subway', 'tree', 'zone_residential', 'zone_commercial', 'zone_industrial', 'zone_dezone', 'zone_water', 'zone_land'];
        const isBuildingTool = selectedTool && !nonBuildingTools.includes(selectedTool);
        
        if (isBuildingTool) {
          // Get building size and draw preview for all tiles in footprint
          const buildingType = selectedTool as BuildingType;
          const buildingSize = getBuildingSize(buildingType);
          
          // Draw highlight for each tile in the building footprint
          for (let dx = 0; dx < buildingSize.width; dx++) {
            for (let dy = 0; dy < buildingSize.height; dy++) {
              const tx = hoveredTile.x + dx;
              const ty = hoveredTile.y + dy;
              if (tx >= 0 && tx < gridSize && ty >= 0 && ty < gridSize) {
                const { screenX, screenY } = gridToScreen(tx, ty, 0, 0);
                drawHighlight(screenX, screenY);
              }
            }
          }
        } else {
          // Single tile highlight for non-building tools
          const { screenX, screenY } = gridToScreen(hoveredTile.x, hoveredTile.y, 0, 0);
          drawHighlight(screenX, screenY);
        }
      }
    }
    
    // Draw selected tile highlight (including multi-tile buildings)
    if (selectedTile && selectedTile.x >= 0 && selectedTile.x < gridSize && selectedTile.y >= 0 && selectedTile.y < gridSize) {
      const selectedOrigin = grid[selectedTile.y]?.[selectedTile.x];
      if (selectedOrigin) {
        // Use customSize for custom buildings, otherwise use getBuildingSize
        const selectedSize = selectedOrigin.building.type === 'custom' && selectedOrigin.building.customSize
          ? { width: selectedOrigin.building.customSize, height: selectedOrigin.building.customSize }
          : getBuildingSize(selectedOrigin.building.type);
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
    
    // Draw road/rail drag preview with bridge validity indication
    if (isDragging && (selectedTool === 'road' || selectedTool === 'rail') && dragStartTile && dragEndTile) {
      const minX = Math.min(dragStartTile.x, dragEndTile.x);
      const maxX = Math.max(dragStartTile.x, dragEndTile.x);
      const minY = Math.min(dragStartTile.y, dragEndTile.y);
      const maxY = Math.max(dragStartTile.y, dragEndTile.y);
      
      // Collect all tiles in the path
      const pathTiles: { x: number; y: number; isWater: boolean }[] = [];
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
            const tile = grid[y][x];
            pathTiles.push({ x, y, isWater: tile.building.type === 'water' });
          }
        }
      }
      
      // Analyze the path for bridge validity
      // A valid bridge: water tiles that are bounded by land/road on both ends
      // An invalid partial crossing: water tiles that don't form a complete bridge
      const analyzePathForBridges = () => {
        const result: Map<string, 'valid' | 'invalid' | 'land'> = new Map();
        
        // Determine if this is a horizontal or vertical path
        const isHorizontal = maxX - minX > maxY - minY;
        
        // Sort tiles by their position along the path
        const sortedTiles = [...pathTiles].sort((a, b) => 
          isHorizontal ? a.x - b.x : a.y - b.y
        );
        
        // Find water segments and check if they're valid bridges
        let i = 0;
        while (i < sortedTiles.length) {
          const tile = sortedTiles[i];
          
          if (!tile.isWater) {
            // Land tile - always valid
            result.set(`${tile.x},${tile.y}`, 'land');
            i++;
            continue;
          }
          
          // Found water - find the extent of this water segment
          const waterStart = i;
          while (i < sortedTiles.length && sortedTiles[i].isWater) {
            i++;
          }
          const waterEnd = i - 1;
          const waterLength = waterEnd - waterStart + 1;
          
          // Check if this water segment is bounded by land on both sides
          const hasLandBefore = waterStart > 0 && !sortedTiles[waterStart - 1].isWater;
          const hasLandAfter = waterEnd < sortedTiles.length - 1 && !sortedTiles[waterEnd + 1].isWater;
          
          // Also check if there's existing land/road adjacent to the start/end of path
          let hasExistingLandBefore = false;
          let hasExistingLandAfter = false;
          
          if (waterStart === 0) {
            // Check the tile before the path start
            const firstWater = sortedTiles[waterStart];
            const checkX = isHorizontal ? firstWater.x - 1 : firstWater.x;
            const checkY = isHorizontal ? firstWater.y : firstWater.y - 1;
            if (checkX >= 0 && checkY >= 0 && checkX < gridSize && checkY < gridSize) {
              const prevTile = grid[checkY][checkX];
              hasExistingLandBefore = prevTile.building.type !== 'water';
            }
          }
          
          if (waterEnd === sortedTiles.length - 1) {
            // Check the tile after the path end
            const lastWater = sortedTiles[waterEnd];
            const checkX = isHorizontal ? lastWater.x + 1 : lastWater.x;
            const checkY = isHorizontal ? lastWater.y : lastWater.y + 1;
            if (checkX >= 0 && checkY >= 0 && checkX < gridSize && checkY < gridSize) {
              const nextTile = grid[checkY][checkX];
              hasExistingLandAfter = nextTile.building.type !== 'water';
            }
          }
          
          const isValidBridge = (hasLandBefore || hasExistingLandBefore) && 
                                (hasLandAfter || hasExistingLandAfter) &&
                                waterLength <= 10; // Max bridge span
          
          // Mark all water tiles in this segment
          for (let j = waterStart; j <= waterEnd; j++) {
            const waterTile = sortedTiles[j];
            result.set(`${waterTile.x},${waterTile.y}`, isValidBridge ? 'valid' : 'invalid');
          }
        }
        
        return result;
      };
      
      const bridgeAnalysis = analyzePathForBridges();
      
      // Draw preview for each tile in the path
      for (const tile of pathTiles) {
        const { screenX, screenY } = gridToScreen(tile.x, tile.y, 0, 0);
        const key = `${tile.x},${tile.y}`;
        const status = bridgeAnalysis.get(key) || 'land';
        
        if (status === 'valid') {
          // Valid bridge - show blue/cyan placeholder
          drawHighlight(screenX, screenY, 'rgba(59, 130, 246, 0.5)', '#3b82f6');
        } else if (status === 'invalid') {
          // Invalid water crossing - show red
          drawHighlight(screenX, screenY, 'rgba(239, 68, 68, 0.5)', '#ef4444');
        }
        // Land tiles don't need special preview - they're already being placed
      }
    }
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, [hoveredTile, selectedTile, selectedTool, offset, zoom, gridSize, grid, isDragging, dragStartTile, dragEndTile, selectedCustomBuilding]);
  
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
      
      // PERF: Skip ALL vehicle/entity updates during mobile panning/zooming (not just drawing)
      // This provides a massive performance boost for big cities on mobile
      const skipMobileUpdates = isMobile && (isPanningRef.current || isPinchZoomingRef.current);
      
      if (delta > 0 && !skipMobileUpdates) {
        updateCars(delta);
        updateBuses(delta);
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
        updateClouds(delta, visualHour); // Update atmospheric clouds
        navLightFlashTimerRef.current += delta * 3; // Update nav light flash timer
        trafficLightTimerRef.current += delta; // Update traffic light cycle timer
        crossingFlashTimerRef.current += delta; // Update crossing flash timer
        
        // Update railroad crossing gate angles based on train proximity
        // PERF: Use cached crossing positions instead of O(n²) grid scan
        const trains = trainsRef.current;
        const gateAngles = crossingGateAnglesRef.current;
        // PERF: Access speed via worldStateRef to avoid animation restart on speed change
        const currentSpeed = worldStateRef.current.speed;
        const gateSpeedMult = currentSpeed === 0 ? 0 : currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2.5 : 4;
        const crossings = crossingPositionsRef.current;
        const currentGridSize = worldStateRef.current.gridSize;
        
        // Iterate only over known crossings (O(k) where k = number of crossings)
        for (let i = 0; i < crossings.length; i++) {
          const { x: gx, y: gy } = crossings[i];
          // PERF: Use numeric key instead of string concatenation
          const key = gy * currentGridSize + gx;
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
        drawBuses(ctx);
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
        drawClouds(airCtx, visualHour); // Draw atmospheric clouds (above helicopters)
        drawAirplanes(airCtx); // Draw airplanes above clouds
        drawFireworks(airCtx); // Draw fireworks above everything (nighttime only)
      }
    };
    
    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  // PERF: Removed grid, gridSize, speed from deps - they're accessed via worldStateRef to avoid restarting animation on every tick
  }, [canvasSize.width, canvasSize.height, updateCars, updateBuses, drawCars, drawBuses, spawnCrimeIncidents, updateCrimeIncidents, updateEmergencyVehicles, drawEmergencyVehicles, updatePedestrians, drawPedestrians, drawRecreationPedestrians, updateAirplanes, drawAirplanes, updateHelicopters, drawHelicopters, updateSeaplanes, drawSeaplanes, updateBoats, drawBoats, updateBarges, drawBarges, updateTrains, drawTrainsCallback, drawIncidentIndicators, updateFireworks, drawFireworks, updateSmog, drawSmog, updateClouds, drawClouds, visualHour, isMobile]);
  
  // Day/Night cycle lighting rendering - extracted to useLightingSystem hook
  useLightingSystem({
    canvasRef: lightingCanvasRef,
    worldStateRef,
    visualHour,
    offset,
    zoom,
    canvasWidth: canvasSize.width,
    canvasHeight: canvasSize.height,
    isMobile,
    isPanningRef,
    isPinchZoomingRef,
    isWheelZoomingRef,
    isPanning,
    isWheelZooming,
  });
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      panCandidateRef.current = null;
      e.preventDefault();
      return;
    }
    
    if (e.button === 0) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = (e.clientX - rect.left) / zoom;
        const mouseY = (e.clientY - rect.top) / zoom;
        const { gridX, gridY } = screenToGrid(mouseX, mouseY, offset.x / zoom, offset.y / zoom);

        const isInsideGrid = gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize;
        if (!isInsideGrid) {
          setIsPanning(true);
          setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
          panCandidateRef.current = null;
          return;
        }

        // Handle custom building placement (AI-generated buildings)
        if (selectedCustomBuilding && selectedCustomBuildingId) {
          panCandidateRef.current = null;
          const placed = placeCustomBuilding(gridX, gridY, {
            id: selectedCustomBuilding.id,
            name: selectedCustomBuilding.name,
            spriteUrl: selectedCustomBuilding.spriteUrl,
            size: selectedCustomBuilding.size,
            cost: selectedCustomBuilding.cost,
            stats: selectedCustomBuilding.stats,
          });
          if (placed && clearCustomSelection) {
            // Clear selection after successful placement
            clearCustomSelection();
          }
          return;
        }
        
        if (selectedTool === 'select') {
          const tile = grid[gridY]?.[gridX];
          const isOpenTile = tile?.building.type === 'empty' ||
            tile?.building.type === 'grass' ||
            tile?.building.type === 'water';
          if (isOpenTile) {
            panCandidateRef.current = { startX: e.clientX, startY: e.clientY, gridX, gridY };
            return;
          }
          panCandidateRef.current = null;
          // For multi-tile buildings, select the origin tile
          const origin = findBuildingOrigin(gridX, gridY);
          if (origin) {
            setSelectedTile({ x: origin.originX, y: origin.originY });
          } else {
            setSelectedTile({ x: gridX, y: gridY });
          }
        } else if (showsDragGrid) {
          panCandidateRef.current = null;
          // Start drag rectangle selection for zoning tools
          setDragStartTile({ x: gridX, y: gridY });
          setDragEndTile({ x: gridX, y: gridY });
          setIsDragging(true);
        } else if (supportsDragPlace) {
          panCandidateRef.current = null;
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
  }, [offset, gridSize, selectedTool, placeAtTile, placeCustomBuilding, zoom, showsDragGrid, supportsDragPlace, setSelectedTile, findBuildingOrigin, grid, selectedCustomBuilding, selectedCustomBuildingId, clearCustomSelection]);
  
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
    if (!isPanning && panCandidateRef.current) {
      const { startX, startY } = panCandidateRef.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) >= PAN_DRAG_THRESHOLD || Math.abs(dy) >= PAN_DRAG_THRESHOLD) {
        setIsPanning(true);
        setDragStart({ x: startX - offset.x, y: startY - offset.y });
        panCandidateRef.current = null;
        const newOffset = {
          x: e.clientX - (startX - offset.x),
          y: e.clientY - (startY - offset.y),
        };
        setOffset(clampOffset(newOffset, zoom));
        return;
      }
    }

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
          // Skip water tiles - they'll be handled on mouse up for bridge creation
          const minX = Math.min(dragStartTile.x, targetX);
          const maxX = Math.max(dragStartTile.x, targetX);
          const minY = Math.min(dragStartTile.y, targetY);
          const maxY = Math.max(dragStartTile.y, targetY);
          
          for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
              const key = `${x},${y}`;
              if (!placedRoadTilesRef.current.has(key)) {
                // Skip water tiles during drag - they'll show preview and be handled on mouse up
                const tile = grid[y]?.[x];
                if (tile && tile.building.type === 'water') {
                  // Don't place on water during drag, just mark as "seen"
                  placedRoadTilesRef.current.add(key);
                  continue;
                }
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
    if (panCandidateRef.current && !isPanning && selectedTool === 'select') {
      const { gridX, gridY } = panCandidateRef.current;
      panCandidateRef.current = null;
      const origin = findBuildingOrigin(gridX, gridY);
      if (origin) {
        setSelectedTile({ x: origin.originX, y: origin.originY });
      } else {
        setSelectedTile({ x: gridX, y: gridY });
      }
    } else {
      panCandidateRef.current = null;
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
    
    // After placing roads or rail, create bridges for valid water crossings and check for city discovery
    if (isDragging && (selectedTool === 'road' || selectedTool === 'rail') && dragStartTile && dragEndTile) {
      // Collect all tiles in the drag path
      const minX = Math.min(dragStartTile.x, dragEndTile.x);
      const maxX = Math.max(dragStartTile.x, dragEndTile.x);
      const minY = Math.min(dragStartTile.y, dragEndTile.y);
      const maxY = Math.max(dragStartTile.y, dragEndTile.y);
      
      const pathTiles: { x: number; y: number }[] = [];
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          pathTiles.push({ x, y });
        }
      }
      
      // Create bridges for valid water crossings in the drag path
      finishTrackDrag(pathTiles, selectedTool as 'road' | 'rail');
      
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
  }, [isDragging, showsDragGrid, dragStartTile, placeAtTile, finishTrackDrag, selectedTool, dragEndTile, checkAndDiscoverCities, findBuildingOrigin, setSelectedTile, isPanning]);
  
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // Mouse position relative to canvas (in screen pixels)
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Calculate new zoom with proportional scaling for smoother feel
    // Use smaller base delta (0.05) and scale by current zoom for consistent feel at all levels
    const baseZoomDelta = 0.05;
    const scaledDelta = baseZoomDelta * Math.max(0.5, zoom); // Scale with zoom, min 0.5x
    const zoomDelta = e.deltaY > 0 ? -scaledDelta : scaledDelta;
    const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom + zoomDelta));
    
    if (newZoom === zoom) return;
    
    // PERF: Track wheel zooming state to disable lights during zoom (like mobile pinch zoom)
    if (!isWheelZoomingRef.current) {
      isWheelZoomingRef.current = true;
      setIsWheelZooming(true);
    }
    if (wheelZoomTimeoutRef.current) {
      clearTimeout(wheelZoomTimeoutRef.current);
    }
    wheelZoomTimeoutRef.current = setTimeout(() => {
      isWheelZoomingRef.current = false;
      setIsWheelZooming(false); // Trigger re-render to restore lights
    }, 150); // Wait 150ms after last wheel event to consider zooming complete
    
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
      className="overflow-hidden relative w-full h-full touch-none"
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
            <DialogContent 
              className="max-w-[400px]"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <DialogHeader>
                <T>
                  <DialogTitle>City Discovered!</DialogTitle>
                </T>
                <T>
                  <DialogDescription>
                    Your road has reached the <Var>{cityConnectionDialog.direction}</Var> border! You&apos;ve discovered <Var>{city.name}</Var>.
                  </DialogDescription>
                </T>
              </DialogHeader>
              <div className="flex flex-col gap-4 mt-4">
                <T>
                  <div className="text-sm text-muted-foreground">
                    Connecting to <Var>{city.name}</Var> will establish a trade route, providing:
                    <ul className="mt-2 space-y-1 list-disc list-inside">
                      <li>$5,000 one-time bonus</li>
                      <li>$200/month additional income</li>
                    </ul>
                  </div>
                </T>
                <div className="flex gap-2 justify-end">
                  <T>
                    <Button
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCityConnectionDialog(null);
                        setDragStartTile(null);
                        setDragEndTile(null);
                      }}
                    >
                      Maybe Later
                    </Button>
                  </T>
                  <T>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        connectToCity(city.id);
                        setCityConnectionDialog(null);
                        setDragStartTile(null);
                        setDragEndTile(null);
                      }}
                    >
                      Connect to <Var>{city.name}</Var>
                    </Button>
                  </T>
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

        const toolName = m(TOOL_INFO[selectedTool].name);

        return (
          <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-md text-sm ${
            isWaterfrontPlacementInvalid
              ? 'border bg-destructive/90 border-destructive-foreground/30 text-destructive-foreground'
              : 'border bg-card/90 border-border'
          }`}>
            {isDragging && dragStartTile && dragEndTile && showsDragGrid ? (
              <>
                {(() => {
                  const areaWidth = Math.abs(dragEndTile.x - dragStartTile.x) + 1;
                  const areaHeight = Math.abs(dragEndTile.y - dragStartTile.y) + 1;
                  const totalCost = TOOL_INFO[selectedTool].cost * areaWidth * areaHeight;
                  return (
                    <>
                      {gt('{toolName} - {width}x{height} area', { toolName, width: areaWidth, height: areaHeight })}
                      {TOOL_INFO[selectedTool].cost > 0 && ` - $${totalCost}`}
                    </>
                  );
                })()}
              </>
            ) : isWaterfrontPlacementInvalid ? (
              <>
                {gt('{toolName} must be placed next to water', { toolName })}
              </>
            ) : (
              <>
                {gt('{toolName} at ({x}, {y})', { toolName, x: hoveredTile.x, y: hoveredTile.y })}
                {TOOL_INFO[selectedTool].cost > 0 && ` - $${TOOL_INFO[selectedTool].cost}`}
                {showsDragGrid && gt(' - Drag to zone area')}
                {supportsDragPlace && !showsDragGrid && gt(' - Drag to place')}
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
              <div className="flex gap-2 items-center mb-1">
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
                      : gt('Incident')}
                </span>
              </div>
              
              {/* Description */}
              <p className="text-[11px] text-muted-foreground leading-tight">
                {hoveredIncident.type === 'fire'
                  ? getFireDescriptionForTile(hoveredIncident.x, hoveredIncident.y)
                  : hoveredIncident.crimeType
                    ? getCrimeDescription(hoveredIncident.crimeType)
                    : gt('Incident reported.')}
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
