// CoasterContext for Rollercoaster Tycoon-style game
'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { compressToUTF16, decompressFromUTF16 } from 'lz-string';
import {
  CoasterParkState,
  CoasterTool,
  CoasterBuilding,
  CoasterBuildingType,
  PanelType,
  PathInfo,
  PathStyle,
  Ride,
  RideType,
  RideQueue,
  RideStats,
  SavedParkMeta,
  Scenery,
  SceneryType,
  TOOL_INFO,
} from '@/games/coaster/types';
import { isInGrid } from '@/core/types';
import {
  calculateSceneryScore,
  createInitialCoasterState,
  DEFAULT_COASTER_GRID_SIZE,
  simulateCoasterTick,
} from '@/lib/coasterSimulation';
import { RIDE_DEFINITIONS } from '@/lib/coasterRides';
import { STAFF_DEFINITIONS } from '@/lib/coasterStaff';
import { isResearchUnlocked, mergeResearchItems } from '@/lib/coasterResearch';

const STORAGE_KEY = 'coaster-game-state';
const SAVED_PARKS_INDEX_KEY = 'coaster-saved-parks-index';
const MAX_TERRAIN_HEIGHT = 4;
const MIN_TERRAIN_HEIGHT = 0;

const TOOL_RIDE_MAP: Partial<Record<CoasterTool, RideType>> = {
  ride_carousel: 'carousel',
  ride_ferris_wheel: 'ferris_wheel',
  ride_bumper_cars: 'bumper_cars',
  ride_swing: 'swing_ride',
  ride_haunted_house: 'haunted_house',
  ride_spiral_slide: 'spiral_slide',
  ride_coaster_wooden: 'coaster_wooden',
  ride_coaster_steel: 'coaster_steel',
};

const TOOL_SHOP_MAP: Partial<Record<CoasterTool, CoasterBuildingType>> = {
  shop_food: 'food_stall',
  shop_drink: 'drink_stall',
  shop_ice_cream: 'ice_cream_stall',
  shop_souvenir: 'souvenir_shop',
  shop_info: 'info_kiosk',
  shop_atm: 'atm',
  shop_first_aid: 'first_aid',
  shop_toilet: 'toilets',
  shop_staff_room: 'staff_room',
};

const SHOP_DEFAULTS: Record<CoasterBuildingType, { name: string; price: number; capacity: number }> = {
  food_stall: { name: 'Burger Stall', price: 5, capacity: 10 },
  drink_stall: { name: 'Soda Stall', price: 3, capacity: 8 },
  ice_cream_stall: { name: 'Ice Cream', price: 4, capacity: 8 },
  souvenir_shop: { name: 'Souvenir Shop', price: 6, capacity: 12 },
  info_kiosk: { name: 'Info Kiosk', price: 2, capacity: 6 },
  toilets: { name: 'Restrooms', price: 0, capacity: 6 },
  atm: { name: 'ATM', price: 0, capacity: 4 },
  first_aid: { name: 'First Aid', price: 0, capacity: 4 },
  staff_room: { name: 'Staff Room', price: 0, capacity: 4 },
};

const SCENERY_TOOL_MAP: Partial<Record<CoasterTool, SceneryType>> = {
  scenery_tree: 'tree',
  scenery_flower: 'flower',
  scenery_bench: 'bench',
  scenery_shrub: 'shrub',
  scenery_lamp: 'lamp',
  scenery_statue: 'statue',
  scenery_fountain: 'fountain',
  scenery_trash_can: 'trash_can',
  scenery_fence: 'fence',
};

function normalizeCoasterState(state: CoasterParkState): CoasterParkState {
  const grid = state.grid.map((row) => row.map((tile) => ({
    ...tile,
    litter: tile.litter ?? 0,
  })));
  return {
    ...state,
    grid,
    finance: {
      ...state.finance,
      entranceRevenue: state.finance.entranceRevenue ?? 0,
      staffCost: state.finance.staffCost ?? 0,
      maintenanceCost: state.finance.maintenanceCost ?? 0,
      researchCost: state.finance.researchCost ?? 0,
      loanInterestCost: state.finance.loanInterestCost ?? 0,
    },
    research: {
      ...state.research,
      activeResearchId: state.research?.activeResearchId ?? null,
      funding: state.research?.funding ?? 0.2,
      items: mergeResearchItems(state.research?.items ?? []),
    },
    stats: {
      ...state.stats,
      scenery: state.stats.scenery ?? 0,
    },
    coasterTrains: state.coasterTrains ?? [],
    rides: state.rides.map((ride) => ({
      ...ride,
      cycleTimer: ride.cycleTimer ?? 0,
      weatherClosed: ride.weatherClosed ?? false,
    })),
  };
}

function createRideStats(rideType: RideType): RideStats {
  const definition = RIDE_DEFINITIONS[rideType];
  return {
    rideTime: definition.rideTime,
    capacity: definition.capacity,
    reliability: 0.92,
    uptime: 1,
    totalRiders: 0,
    totalRevenue: 0,
    lastBreakdownTick: null,
  };
}

function createRideQueue(entry: { x: number; y: number }, exit: { x: number; y: number }): RideQueue {
  return {
    guestIds: [],
    maxLength: 30,
    entry,
    exit,
  };
}

type CoasterContextValue = {
  state: CoasterParkState;
  latestStateRef: React.RefObject<CoasterParkState>;
  setTool: (tool: CoasterTool) => void;
  setSpeed: (speed: 0 | 1 | 2 | 3) => void;
  setActivePanel: (panel: PanelType) => void;
  placeAtTile: (x: number, y: number) => void;
  buildRide: (rideType: RideType, x: number, y: number) => boolean;
  buildPath: (x: number, y: number) => void;
  setRidePrice: (rideId: string, price: number) => void;
  setShopPrice: (position: { x: number; y: number }, price: number) => void;
  toggleShopOpen: (position: { x: number; y: number }) => void;
  toggleRideStatus: (rideId: string) => void;
  hireStaff: (type: 'handyman' | 'mechanic' | 'security' | 'entertainer') => void;
  setStaffPatrolArea: (staffId: number, center: { x: number; y: number }, radius?: number) => void;
  clearStaffPatrolArea: (staffId: number) => void;
  setEntranceFee: (fee: number) => void;
  setParkName: (name: string) => void;
  takeLoan: (amount: number) => void;
  repayLoan: (amount: number) => void;
  setResearchFunding: (funding: number) => void;
  setActiveResearch: (researchId: string | null) => void;
  newGame: (name?: string, size?: number) => void;
  loadState: (stateString: string) => boolean;
  exportState: () => string;
  hasExistingGame: boolean;
  isStateReady: boolean;
  savedParks: SavedParkMeta[];
  savePark: () => void;
  loadSavedPark: (parkId: string) => boolean;
  deleteSavedPark: (parkId: string) => void;
};

const CoasterContext = createContext<CoasterContextValue | null>(null);

function loadCoasterState(): CoasterParkState | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;

    let jsonString = decompressFromUTF16(saved);
    if (!jsonString || !jsonString.startsWith('{')) {
      if (saved.startsWith('{')) {
        jsonString = saved;
      } else {
        return null;
      }
    }
    const parsed = JSON.parse(jsonString);
    if (parsed?.grid && parsed?.gridSize) {
      return normalizeCoasterState(parsed as CoasterParkState);
    }
    return null;
  } catch {
    return null;
  }
}

function saveCoasterState(state: CoasterParkState): void {
  if (typeof window === 'undefined') return;
  try {
    const compressed = compressToUTF16(JSON.stringify(state));
    localStorage.setItem(STORAGE_KEY, compressed);
  } catch (error) {
    console.error('Failed to save coaster state:', error);
  }
}

function loadSavedParks(): SavedParkMeta[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(SAVED_PARKS_INDEX_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? (parsed as SavedParkMeta[]) : [];
  } catch {
    return [];
  }
}

function saveSavedParks(parks: SavedParkMeta[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SAVED_PARKS_INDEX_KEY, JSON.stringify(parks));
  } catch (error) {
    console.error('Failed to save park index:', error);
  }
}

export function CoasterProvider({ children, startFresh = false }: { children: React.ReactNode; startFresh?: boolean }) {
  const [state, setState] = useState<CoasterParkState>(() =>
    createInitialCoasterState(DEFAULT_COASTER_GRID_SIZE, 'Coaster Park')
  );
  const [hasExistingGame, setHasExistingGame] = useState(false);
  const [isStateReady, setIsStateReady] = useState(false);
  const [savedParks, setSavedParks] = useState<SavedParkMeta[]>([]);
  const latestStateRef = useRef(state);
  const skipNextSaveRef = useRef(false);
  const stateChangedRef = useRef(false);

  useEffect(() => {
    if (!startFresh) {
      const saved = loadCoasterState();
      if (saved) {
        skipNextSaveRef.current = true;
        setState(saved);
        setHasExistingGame(true);
      } else {
        setHasExistingGame(false);
      }
    } else {
      setHasExistingGame(false);
    }
    setSavedParks(loadSavedParks());
    setIsStateReady(true);
  }, [startFresh]);

  useEffect(() => {
    latestStateRef.current = state;
    stateChangedRef.current = true;
  }, [state]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (skipNextSaveRef.current) {
        skipNextSaveRef.current = false;
        return;
      }
      if (!stateChangedRef.current) return;
      saveCoasterState(latestStateRef.current);
      setHasExistingGame(true);
      stateChangedRef.current = false;
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (state.speed === 0) return;
    const interval = setInterval(() => {
      setState((prev) => simulateCoasterTick(prev));
    }, state.speed === 1 ? 700 : state.speed === 2 ? 450 : 300);
    return () => clearInterval(interval);
  }, [state.speed]);

  const setTool = useCallback((tool: CoasterTool) => {
    setState((prev) => ({ ...prev, selectedTool: tool, activePanel: 'none' }));
  }, []);

  const setSpeed = useCallback((speed: 0 | 1 | 2 | 3) => {
    setState((prev) => ({ ...prev, speed }));
  }, []);

  const setActivePanel = useCallback((panel: PanelType) => {
    setState((prev) => ({ ...prev, activePanel: panel }));
  }, []);

  const applyRidePlacement = useCallback((prev: CoasterParkState, rideType: RideType, x: number, y: number) => {
    const definition = RIDE_DEFINITIONS[rideType];
    if (!definition) return prev;
    const researchRequirement = rideType === 'coaster_wooden'
      ? 'coaster_wooden'
      : rideType === 'coaster_steel'
        ? 'coaster_steel'
        : null;
    if (researchRequirement && !isResearchUnlocked(prev.research.items, researchRequirement)) {
      return prev;
    }

    const { width, height } = definition.size;
    if (x < 0 || y < 0 || x + width > prev.gridSize || y + height > prev.gridSize) {
      return prev;
    }

    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const tile = prev.grid[y + dy][x + dx];
        if (!tile) return prev;
        if (tile.terrain === 'water' || tile.path || tile.rideId || tile.building || tile.track || tile.scenery) {
          return prev;
        }
      }
    }

    const toolKey = (Object.keys(TOOL_RIDE_MAP) as CoasterTool[]).find((tool) => TOOL_RIDE_MAP[tool] === rideType);
    const toolCost = toolKey ? TOOL_INFO[toolKey].cost : 0;
    if (toolCost > 0 && prev.finance.cash < toolCost) return prev;

    const grid = prev.grid.map((row) => row.slice());
    const rideId = `ride-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    for (let dy = 0; dy < height; dy++) {
      const row = grid[y + dy].slice();
      for (let dx = 0; dx < width; dx++) {
        row[x + dx] = { ...row[x + dx], rideId };
      }
      grid[y + dy] = row;
    }

    const entrance = { x, y: Math.min(prev.gridSize - 1, y + height) };
    const exit = { x: Math.min(prev.gridSize - 1, x + width - 1), y: Math.min(prev.gridSize - 1, y + height) };

    const ride: Ride = {
      id: rideId,
      type: rideType,
      category: definition.category,
      name: definition.name,
      position: { x, y },
      size: { width, height },
      entrance,
      exit,
      queue: createRideQueue(entrance, exit),
      stats: createRideStats(rideType),
      status: 'open',
      price: definition.basePrice,
      excitement: definition.excitement,
      intensity: definition.intensity,
      nausea: definition.nausea,
      age: 0,
      color: definition.color,
      cycleTimer: 0,
      weatherClosed: false,
    };

    return {
      ...prev,
      grid,
      rides: [...prev.rides, ride],
      finance: {
        ...prev.finance,
        cash: prev.finance.cash - toolCost,
      },
    };
  }, []);

  const placeAtTile = useCallback((x: number, y: number) => {
    setState((prev) => {
      if (!isInGrid({ x, y }, prev.gridSize)) return prev;

      const selectedTool = prev.selectedTool;
      const tile = prev.grid[y][x];
      if (!tile) return prev;
      const toolInfo = TOOL_INFO[selectedTool];
      const toolCost = toolInfo?.cost ?? 0;
      if (toolCost > 0 && prev.finance.cash < toolCost) return prev;

      const grid = prev.grid.map((row) => row.slice());

      const updateTile = (tileX: number, tileY: number, next: Partial<typeof tile>) => {
        if (!grid[tileY] || !grid[tileY][tileX]) return;
        const row = grid[tileY].slice();
        row[tileX] = { ...grid[tileY][tileX], ...next };
        grid[tileY] = row;
      };

      const opposite: Record<keyof PathInfo['edges'], keyof PathInfo['edges']> = {
        north: 'south',
        east: 'west',
        south: 'north',
        west: 'east',
      };

      const getPathEdges = (tileX: number, tileY: number) => ({
        north: Boolean(grid[tileY - 1]?.[tileX]?.path),
        east: Boolean(grid[tileY]?.[tileX + 1]?.path),
        south: Boolean(grid[tileY + 1]?.[tileX]?.path),
        west: Boolean(grid[tileY]?.[tileX - 1]?.path),
      });

      const getTrackConnections = (tileX: number, tileY: number) => ({
        north: Boolean(grid[tileY - 1]?.[tileX]?.track),
        east: Boolean(grid[tileY]?.[tileX + 1]?.track),
        south: Boolean(grid[tileY + 1]?.[tileX]?.track),
        west: Boolean(grid[tileY]?.[tileX - 1]?.track),
      });

      const syncNeighborEdges = (tileX: number, tileY: number, edges: PathInfo['edges']) => {
        (Object.keys(edges) as Array<keyof PathInfo['edges']>).forEach((direction) => {
          const delta = direction === 'north' ? { dx: 0, dy: -1 }
            : direction === 'east' ? { dx: 1, dy: 0 }
            : direction === 'south' ? { dx: 0, dy: 1 }
            : { dx: -1, dy: 0 };
          const nx = tileX + delta.dx;
          const ny = tileY + delta.dy;
          const neighbor = grid[ny]?.[nx];
          if (!neighbor?.path) return;
          const neighborEdges = {
            ...neighbor.path.edges,
            [opposite[direction]]: edges[direction],
          };
          updateTile(nx, ny, { path: { ...neighbor.path, edges: neighborEdges } });
        });
      };

      const findAdjacentRideId = (tileX: number, tileY: number) => {
        const neighbors = [
          { x: tileX, y: tileY - 1 },
          { x: tileX + 1, y: tileY },
          { x: tileX, y: tileY + 1 },
          { x: tileX - 1, y: tileY },
        ];
        for (const neighbor of neighbors) {
          const rideId = grid[neighbor.y]?.[neighbor.x]?.rideId;
          if (rideId) return { rideId, isDirect: true };
        }
        for (const neighbor of neighbors) {
          const queueRideId = grid[neighbor.y]?.[neighbor.x]?.path?.queueRideId;
          if (queueRideId) return { rideId: queueRideId, isDirect: false };
        }
        return null;
      };

      const syncNeighborTracks = (tileX: number, tileY: number, connections: ReturnType<typeof getTrackConnections>) => {
        (Object.keys(connections) as Array<keyof PathInfo['edges']>).forEach((direction) => {
          const delta = direction === 'north' ? { dx: 0, dy: -1 }
            : direction === 'east' ? { dx: 1, dy: 0 }
            : direction === 'south' ? { dx: 0, dy: 1 }
            : { dx: -1, dy: 0 };
          const nx = tileX + delta.dx;
          const ny = tileY + delta.dy;
          const neighbor = grid[ny]?.[nx];
          if (!neighbor?.track) return;
          const neighborConnections = {
            ...neighbor.track.connections,
            [opposite[direction]]: connections[direction],
          };
          updateTile(nx, ny, { track: { ...neighbor.track, connections: neighborConnections } });
        });
      };

      const createPath = (style: PathStyle, isQueue: boolean, queueRideId: string | null): PathInfo => ({
        style,
        isQueue,
        queueRideId,
        edges: getPathEdges(x, y),
        slope: 'flat',
        railing: false,
        isBridge: false,
      });

      const propagateQueueRideId = (startX: number, startY: number, queueRideId: string) => {
        const stack = [{ x: startX, y: startY }];
        const visited = new Set<string>();
        while (stack.length > 0) {
          const current = stack.pop();
          if (!current) continue;
          const key = `${current.x},${current.y}`;
          if (visited.has(key)) continue;
          visited.add(key);
          const currentTile = grid[current.y]?.[current.x];
          if (!currentTile?.path || currentTile.path.style !== 'queue') continue;
          if (currentTile.path.queueRideId && currentTile.path.queueRideId !== queueRideId) {
            continue;
          }
          if (currentTile.path.queueRideId !== queueRideId) {
            updateTile(current.x, current.y, {
              path: {
                ...currentTile.path,
                queueRideId,
              },
            });
          }
          const edges = currentTile.path.edges;
          (Object.keys(edges) as Array<keyof PathInfo['edges']>).forEach((direction) => {
            if (!edges[direction]) return;
            const delta = direction === 'north'
              ? { dx: 0, dy: -1 }
              : direction === 'east'
                ? { dx: 1, dy: 0 }
                : direction === 'south'
                  ? { dx: 0, dy: 1 }
                  : { dx: -1, dy: 0 };
            const nx = current.x + delta.dx;
            const ny = current.y + delta.dy;
            const neighbor = grid[ny]?.[nx];
            if (neighbor?.path?.style === 'queue') {
              stack.push({ x: nx, y: ny });
            }
          });
        }
      };

      const applyCost = (nextState: CoasterParkState) => {
        const stateWithCost = toolCost > 0
          ? {
            ...nextState,
            finance: {
              ...nextState.finance,
              cash: nextState.finance.cash - toolCost,
            },
          }
          : nextState;
        return {
          ...stateWithCost,
          stats: {
            ...stateWithCost.stats,
            scenery: calculateSceneryScore(stateWithCost.grid),
          },
        };
      };

      if (selectedTool === 'terrain_raise' || selectedTool === 'terrain_lower' || selectedTool === 'terrain_smooth') {
        const isEditable = !tile.path && !tile.rideId && !tile.building && !tile.track && !tile.scenery && tile.terrain !== 'water';
        if (!isEditable) {
          return prev;
        }
        if (selectedTool === 'terrain_raise') {
          if (tile.height >= MAX_TERRAIN_HEIGHT) return prev;
          updateTile(x, y, { height: tile.height + 1 });
          return applyCost({ ...prev, grid });
        }
        if (selectedTool === 'terrain_lower') {
          if (tile.height <= MIN_TERRAIN_HEIGHT) return prev;
          updateTile(x, y, { height: tile.height - 1 });
          return applyCost({ ...prev, grid });
        }
        const neighborOffsets = [
          { dx: 0, dy: 0 },
          { dx: 0, dy: -1 },
          { dx: 1, dy: 0 },
          { dx: 0, dy: 1 },
          { dx: -1, dy: 0 },
        ];
        let sum = 0;
        let count = 0;
        neighborOffsets.forEach((offset) => {
          const neighbor = grid[y + offset.dy]?.[x + offset.dx];
          if (!neighbor) return;
          sum += neighbor.height;
          count += 1;
        });
        if (count === 0) return prev;
        const averaged = Math.max(MIN_TERRAIN_HEIGHT, Math.min(MAX_TERRAIN_HEIGHT, Math.round(sum / count)));
        if (averaged === tile.height) return prev;
        updateTile(x, y, { height: averaged });
        return applyCost({ ...prev, grid });
      }

      if (selectedTool === 'path' || selectedTool === 'queue_path') {
        const adjacentRide = selectedTool === 'queue_path' ? findAdjacentRideId(x, y) : null;
        const queueRideId = adjacentRide?.rideId ?? null;
        const shouldUpdateQueueEntry = adjacentRide?.isDirect ?? false;
        const newPath = createPath(selectedTool === 'queue_path' ? 'queue' : 'concrete', selectedTool === 'queue_path', queueRideId);
        if (tile.terrain === 'water' || tile.rideId || tile.building) {
          return prev;
        }
        if (tile.path && tile.path.style === newPath.style && tile.path.isQueue === newPath.isQueue) {
          return prev;
        }
        updateTile(x, y, { path: newPath, litter: 0 });
        syncNeighborEdges(x, y, newPath.edges);
        if (queueRideId) {
          propagateQueueRideId(x, y, queueRideId);
        }
        const rides = queueRideId
          ? prev.rides.map((ride) =>
            ride.id === queueRideId
              ? { ...ride, queue: { ...ride.queue, entry: shouldUpdateQueueEntry ? { x, y } : ride.queue.entry } }
              : ride
          )
          : prev.rides;
        return applyCost({ ...prev, grid, rides });
      }

      if (selectedTool === 'coaster_track') {
        if (tile.terrain === 'water' || tile.path || tile.rideId || tile.building || tile.scenery) {
          return prev;
        }
        if (tile.track) return prev;
        const connections = getTrackConnections(x, y);
        const track = {
          id: `track-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          type: 'straight' as const,
          trackType: 'wooden' as const,
          position: { x, y },
          direction: 'north' as const,
          height: tile.height,
          slope: 0,
          banked: false,
          chainLift: false,
          connections,
        };
        updateTile(x, y, { track });
        syncNeighborTracks(x, y, connections);
        return applyCost({ ...prev, grid });
      }

      const sceneryType = SCENERY_TOOL_MAP[selectedTool];
      if (sceneryType) {
        const scenery: Scenery = { type: sceneryType, variant: 0, rotation: 0 };
        if (tile.scenery?.type === sceneryType) {
          return prev;
        }
        updateTile(x, y, { scenery });
        return applyCost({ ...prev, grid });
      }

      const shopType = TOOL_SHOP_MAP[selectedTool];
      if (shopType) {
        if (tile.terrain === 'water' || tile.path || tile.rideId || tile.track || tile.scenery) {
          return prev;
        }
        if (tile.building?.type === shopType) {
          return prev;
        }
        const defaults = SHOP_DEFAULTS[shopType];
        const building: CoasterBuilding = {
          type: shopType,
          name: defaults.name,
          price: defaults.price,
          capacity: defaults.capacity,
          open: true,
        };
        updateTile(x, y, { building });
        return applyCost({ ...prev, grid });
      }

      if (selectedTool === 'water') {
        updateTile(x, y, { terrain: tile.terrain === 'water' ? 'grass' : 'water', litter: 0 });
        return applyCost({ ...prev, grid });
      }

      if (selectedTool === 'bulldoze') {
        const hasAnything = tile.path || tile.scenery || tile.building || tile.track || tile.rideId;
        if (!hasAnything) {
          return prev;
        }
        let rides = prev.rides;
        if (tile.rideId) {
          const rideId = tile.rideId;
          rides = prev.rides.filter((ride) => ride.id !== rideId);
          for (let rowIndex = 0; rowIndex < grid.length; rowIndex++) {
            const row = grid[rowIndex].slice();
            let rowUpdated = false;
            for (let colIndex = 0; colIndex < row.length; colIndex++) {
              if (row[colIndex].rideId === rideId) {
                row[colIndex] = { ...row[colIndex], rideId: null };
                rowUpdated = true;
              }
            }
            if (rowUpdated) {
              grid[rowIndex] = row;
            }
          }
        }

        updateTile(x, y, {
          path: null,
          scenery: null,
          building: null,
          rideId: null,
          track: null,
          litter: 0,
        });
        syncNeighborEdges(x, y, { north: false, east: false, south: false, west: false });
        if (tile.track) {
          syncNeighborTracks(x, y, { north: false, east: false, south: false, west: false });
        }
        if (tile.path?.queueRideId) {
          rides = rides.map((ride) =>
            ride.id === tile.path?.queueRideId ? { ...ride, queue: { ...ride.queue, entry: ride.entrance } } : ride
          );
        }
        return applyCost({ ...prev, grid, rides });
      }

      const rideType = TOOL_RIDE_MAP[selectedTool];
      if (rideType) {
        return applyRidePlacement(prev, rideType, x, y);
      }

      return prev;
    });
  }, [applyRidePlacement]);

  const buildRide = useCallback((rideType: RideType, x: number, y: number) => {
    let success = false;
    setState((prev) => {
      const next = applyRidePlacement(prev, rideType, x, y);
      success = next !== prev;
      return next;
    });
    return success;
  }, [applyRidePlacement]);

  const buildPath = useCallback((_x: number, _y: number) => {
    // Placeholder - path placement logic will be added in Phase 2
  }, []);

  const setRidePrice = useCallback((rideId: string, price: number) => {
    const clampedPrice = Math.max(0, Math.min(25, Math.round(price)));
    setState((prev) => ({
      ...prev,
      rides: prev.rides.map((ride) =>
        ride.id === rideId ? { ...ride, price: clampedPrice } : ride
      ),
    }));
  }, []);

  const setShopPrice = useCallback((position: { x: number; y: number }, price: number) => {
    const clampedPrice = Math.max(0, Math.min(20, Math.round(price)));
    setState((prev) => {
      const tile = prev.grid[position.y]?.[position.x];
      if (!tile?.building) return prev;
      const grid = prev.grid.map((row, rowIndex) =>
        rowIndex === position.y ? row.map((cell, colIndex) => {
          if (colIndex !== position.x) return cell;
          return {
            ...cell,
            building: {
              ...cell.building,
              price: clampedPrice,
            },
          };
        }) : row
      );
      return {
        ...prev,
        grid,
      };
    });
  }, []);

  const toggleShopOpen = useCallback((position: { x: number; y: number }) => {
    setState((prev) => {
      const tile = prev.grid[position.y]?.[position.x];
      if (!tile?.building) return prev;
      const grid = prev.grid.map((row, rowIndex) =>
        rowIndex === position.y ? row.map((cell, colIndex) => {
          if (colIndex !== position.x) return cell;
          return {
            ...cell,
            building: {
              ...cell.building,
              open: !cell.building.open,
            },
          };
        }) : row
      );
      return {
        ...prev,
        grid,
      };
    });
  }, []);

  const toggleRideStatus = useCallback((rideId: string) => {
    setState((prev) => ({
      ...prev,
      rides: prev.rides.map((ride) => {
        if (ride.id !== rideId) return ride;
        if (prev.weather.type === 'stormy') {
          return ride;
        }
        if (ride.weatherClosed) {
          return ride;
        }
        if (ride.status !== 'open' && ride.status !== 'closed') {
          return ride;
        }
        const nextStatus = ride.status === 'open' ? 'closed' : 'open';
        return {
          ...ride,
          status: nextStatus,
          cycleTimer: nextStatus === 'closed' ? 0 : ride.cycleTimer,
        };
      }),
    }));
  }, []);

  const hireStaff = useCallback((type: 'handyman' | 'mechanic' | 'security' | 'entertainer') => {
    const definition = STAFF_DEFINITIONS.find((staff) => staff.type === type);
    if (!definition) return;
    setState((prev) => {
      if (prev.finance.cash < definition.hiringFee) return prev;
      const nextId = prev.staff.length > 0 ? Math.max(...prev.staff.map((s) => s.id)) + 1 : 1;
      const nextStaff = {
        id: nextId,
        name: `${definition.name} ${nextId}`,
        type,
        tileX: prev.parkEntrance.x,
        tileY: prev.parkEntrance.y,
        direction: 'south',
        progress: 0,
        state: 'idle' as const,
        patrolArea: null,
        patrolRouteId: null,
        target: null,
        wage: definition.wage,
        fatigue: 0,
      };
      return {
        ...prev,
        staff: [...prev.staff, nextStaff],
        finance: {
          ...prev.finance,
          cash: prev.finance.cash - definition.hiringFee,
          expenses: prev.finance.expenses + definition.hiringFee,
        },
      };
    });
  }, []);

  const setStaffPatrolArea = useCallback((staffId: number, center: { x: number; y: number }, radius: number = 4) => {
    setState((prev) => {
      const minX = Math.max(0, center.x - radius);
      const minY = Math.max(0, center.y - radius);
      const maxX = Math.min(prev.gridSize - 1, center.x + radius);
      const maxY = Math.min(prev.gridSize - 1, center.y + radius);
      return {
        ...prev,
        staff: prev.staff.map((member) => (
          member.id === staffId
            ? {
              ...member,
              patrolArea: { minX, minY, maxX, maxY },
              target: null,
              state: 'walking',
            }
            : member
        )),
      };
    });
  }, []);

  const clearStaffPatrolArea = useCallback((staffId: number) => {
    setState((prev) => ({
      ...prev,
      staff: prev.staff.map((member) => (
        member.id === staffId
          ? { ...member, patrolArea: null, target: null }
          : member
      )),
    }));
  }, []);

  const setEntranceFee = useCallback((fee: number) => {
    const clampedFee = Math.max(0, Math.min(20, Math.round(fee)));
    setState((prev) => ({
      ...prev,
      finance: {
        ...prev.finance,
        entranceFee: clampedFee,
      },
    }));
  }, []);

  const setParkName = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setState((prev) => ({
      ...prev,
      parkName: trimmed,
    }));
  }, []);

  const setResearchFunding = useCallback((funding: number) => {
    const clampedFunding = Math.max(0, Math.min(1, funding));
    setState((prev) => ({
      ...prev,
      research: {
        ...prev.research,
        funding: clampedFunding,
      },
    }));
  }, []);

  const setActiveResearch = useCallback((researchId: string | null) => {
    setState((prev) => {
      if (!researchId) {
        return { ...prev, research: { ...prev.research, activeResearchId: null } };
      }
      const target = prev.research.items.find((item) => item.id === researchId);
      if (!target || target.unlocked) return prev;
      return {
        ...prev,
        research: {
          ...prev.research,
          activeResearchId: researchId,
        },
      };
    });
  }, []);

  const takeLoan = useCallback((amount: number) => {
    const nextAmount = Math.max(0, Math.round(amount));
    if (nextAmount <= 0) return;
    setState((prev) => ({
      ...prev,
      finance: {
        ...prev.finance,
        cash: prev.finance.cash + nextAmount,
        loan: prev.finance.loan + nextAmount,
      },
    }));
  }, []);

  const repayLoan = useCallback((amount: number) => {
    const nextAmount = Math.max(0, Math.round(amount));
    if (nextAmount <= 0) return;
    setState((prev) => {
      const payment = Math.min(nextAmount, prev.finance.loan, prev.finance.cash);
      if (payment <= 0) return prev;
      return {
        ...prev,
        finance: {
          ...prev.finance,
          cash: prev.finance.cash - payment,
          loan: prev.finance.loan - payment,
        },
      };
    });
  }, []);

  const newGame = useCallback((name?: string, size?: number) => {
    const fresh = createInitialCoasterState(size ?? DEFAULT_COASTER_GRID_SIZE, name ?? 'Coaster Park');
    skipNextSaveRef.current = true;
    setState(fresh);
  }, []);

  const loadState = useCallback((stateString: string) => {
    try {
      const parsed = JSON.parse(stateString);
      if (parsed?.grid && parsed?.gridSize) {
        skipNextSaveRef.current = true;
        setState(normalizeCoasterState(parsed as CoasterParkState));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const exportState = useCallback(() => JSON.stringify(state), [state]);

  const savePark = useCallback(() => {
    const parkMeta: SavedParkMeta = {
      id: state.id,
      parkName: state.parkName,
      guests: state.stats.guestsInPark,
      rating: state.stats.rating,
      cash: state.finance.cash,
      year: state.year,
      month: state.month,
      gridSize: state.gridSize,
      savedAt: Date.now(),
    };
    if (typeof window !== 'undefined') {
      try {
        const compressed = compressToUTF16(JSON.stringify(state));
        localStorage.setItem(`coaster-park-${state.id}`, compressed);
      } catch (error) {
        console.error('Failed to save park state:', error);
      }
    }
    setSavedParks((prev) => {
      const existingIndex = prev.findIndex((park) => park.id === state.id);
      const next = [...prev];
      if (existingIndex >= 0) {
        next[existingIndex] = parkMeta;
      } else {
        next.push(parkMeta);
      }
      next.sort((a, b) => b.savedAt - a.savedAt);
      saveSavedParks(next);
      return next;
    });
  }, [state]);

  const loadSavedPark = useCallback((parkId: string) => {
    const saved = localStorage.getItem(`coaster-park-${parkId}`);
    if (!saved) return false;
    let jsonString = decompressFromUTF16(saved);
    if (!jsonString || !jsonString.startsWith('{')) {
      if (saved.startsWith('{')) {
        jsonString = saved;
      } else {
        return false;
      }
    }
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed?.grid && parsed?.gridSize) {
        skipNextSaveRef.current = true;
        setState(normalizeCoasterState(parsed as CoasterParkState));
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }, []);

  const deleteSavedPark = useCallback((parkId: string) => {
    setSavedParks((prev) => {
      const next = prev.filter((park) => park.id !== parkId);
      saveSavedParks(next);
      return next;
    });
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`coaster-park-${parkId}`);
    }
  }, []);

  const value: CoasterContextValue = {
    state,
    latestStateRef,
    setTool,
    setSpeed,
    setActivePanel,
    placeAtTile,
    buildRide,
    buildPath,
    setRidePrice,
    setShopPrice,
    toggleShopOpen,
    toggleRideStatus,
    hireStaff,
    setStaffPatrolArea,
    clearStaffPatrolArea,
    setEntranceFee,
    setParkName,
    takeLoan,
    repayLoan,
    setResearchFunding,
    setActiveResearch,
    newGame,
    loadState,
    exportState,
    hasExistingGame,
    isStateReady,
    savedParks,
    savePark,
    loadSavedPark,
    deleteSavedPark,
  };

  return <CoasterContext.Provider value={value}>{children}</CoasterContext.Provider>;
}

export function useCoaster() {
  const ctx = useContext(CoasterContext);
  if (!ctx) {
    throw new Error('useCoaster must be used within a CoasterProvider');
  }
  return ctx;
}
