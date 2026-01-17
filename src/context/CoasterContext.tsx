'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { compressToUTF16, decompressFromUTF16 } from 'lz-string';
import { isMobile } from 'react-device-detect';
import {
  COASTER_TOOL_INFO,
  CoasterGameState,
  CoasterTool,
  CoasterTile,
  CoasterFinance,
  RideCategory,
  RideType,
  Staff,
  TrackSegment,
} from '@/games/coaster/types';
import { simulateCoasterTick } from '@/games/coaster/simulation';

const STORAGE_KEY = 'coaster-tycoon-state';

const DEFAULT_GRID_SIZE = isMobile ? 46 : 64;

type CoasterContextValue = {
  state: CoasterGameState;
  latestStateRef: React.RefObject<CoasterGameState>;
  setTool: (tool: CoasterTool) => void;
  setSpeed: (speed: CoasterGameState['speed']) => void;
  setActivePanel: (panel: CoasterGameState['activePanel']) => void;
  setEntranceFee: (fee: number) => void;
  updateRide: (rideId: string, updates: Partial<CoasterGameState['rides'][number]>) => void;
  setParkName: (name: string) => void;
  setMaxGuests: (count: number) => void;
  placeAtTile: (x: number, y: number) => void;
  addMoney: (amount: number) => void;
  addNotification: (title: string, description: string) => void;
};

const CoasterContext = createContext<CoasterContextValue | null>(null);

const createBaseTile = (x: number, y: number): CoasterTile => ({
  x,
  y,
  zone: 'none',
  terrain: 'grass',
  path: null,
  track: null,
  rideId: null,
  rideType: null,
  facility: null,
  scenery: [],
  elevation: 0,
  hasQueueEntrance: false,
  hasQueueExit: false,
});

const createEmptyGrid = (size: number): CoasterTile[][] =>
  Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => createBaseTile(x, y))
  );

const createInitialFinance = (): CoasterFinance => ({
  money: 25000,
  entranceFee: 20,
  dailyIncome: 0,
  dailyExpenses: 0,
  loanBalance: 0,
  loanInterestRate: 0.06,
});

const createInitialState = (): CoasterGameState => {
  const gridSize = DEFAULT_GRID_SIZE;
  const grid = createEmptyGrid(gridSize);
  const entrance = { x: Math.floor(gridSize / 2), y: gridSize - 4 };

  // Create a small entrance plaza
  for (let i = -2; i <= 2; i += 1) {
    const tile = grid[entrance.y]?.[entrance.x + i];
    if (tile) {
      tile.path = 'path';
    }
  }

  return {
    id: `park-${Date.now()}`,
    parkName: 'Evergreen Gardens',
    grid,
    gridSize,
    parkEntrance: entrance,
    year: 1995,
    month: 4,
    day: 1,
    hour: 9,
    tick: 0,
    speed: 1,
    selectedTool: 'select',
    activePanel: 'none',
    guests: [],
    rides: [],
    coasterTrains: [],
    staff: [],
    finance: createInitialFinance(),
    parkRating: 75,
    maxGuests: 350,
    notifications: [],
    lastRideId: 0,
    lastGuestId: 0,
    lastStaffId: 0,
    guestSpawnTimer: 0,
    clouds: [],
    cloudSpawnTimer: 0,
  };
};

const loadGameState = (): CoasterGameState | null => {
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
    const parsed = JSON.parse(jsonString) as CoasterGameState;
    if (!parsed.grid || !parsed.gridSize) return null;
    return {
      ...parsed,
      parkEntrance: parsed.parkEntrance ?? { x: Math.floor(parsed.gridSize / 2), y: parsed.gridSize - 4 },
      guestSpawnTimer: parsed.guestSpawnTimer ?? 0,
      clouds: parsed.clouds ?? [],
      cloudSpawnTimer: parsed.cloudSpawnTimer ?? 0,
    };
  } catch {
    return null;
  }
};

const saveGameState = (state: CoasterGameState) => {
  if (typeof window === 'undefined') return;
  try {
    const compressed = compressToUTF16(JSON.stringify(state));
    localStorage.setItem(STORAGE_KEY, compressed);
  } catch (error) {
    console.error('Failed to save coaster state', error);
  }
};

const createTrackSegment = (rideId: string | null, special?: TrackSegment['special']): TrackSegment => ({
  id: `track-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  rideId,
  type: 'track',
  direction: 'east',
  elevation: 0,
  slope: 'flat',
  special: special ?? null,
  isActive: true,
});

const rideTypeFromTool = (tool: CoasterTool): RideType | null => {
  switch (tool) {
    case 'carousel':
      return 'carousel';
    case 'ferris_wheel':
      return 'ferris_wheel';
    case 'swing_ride':
      return 'swing_ride';
    case 'junior_coaster':
      return 'junior_coaster';
    case 'log_flume':
      return 'log_flume';
    case 'food_stall':
      return 'food_stall';
    case 'drink_stall':
      return 'drink_stall';
    case 'souvenir_stall':
      return 'souvenir_stall';
    case 'toilet':
      return 'toilet';
    case 'information':
      return 'information';
    default:
      return null;
  }
};

const rideCategoryFromType = (type: RideType): RideCategory => {
  if (type === 'food_stall' || type === 'drink_stall' || type === 'souvenir_stall') {
    return 'stall';
  }
  if (type === 'toilet' || type === 'information') {
    return 'facility';
  }
  if (type === 'coaster') {
    return 'coaster';
  }
  return 'flat';
};

const defaultRideStats = (type: RideType) => {
  switch (type) {
    case 'carousel':
      return { price: 4, capacity: 18, duration: 45, excitement: 4, intensity: 2, nausea: 1, footprint: { width: 2, height: 2 } };
    case 'ferris_wheel':
      return { price: 6, capacity: 22, duration: 60, excitement: 5, intensity: 3, nausea: 2, footprint: { width: 2, height: 2 } };
    case 'swing_ride':
      return { price: 5, capacity: 20, duration: 55, excitement: 6, intensity: 5, nausea: 3, footprint: { width: 2, height: 2 } };
    case 'junior_coaster':
      return { price: 6, capacity: 14, duration: 50, excitement: 5, intensity: 3, nausea: 2, footprint: { width: 2, height: 2 } };
    case 'log_flume':
      return { price: 7, capacity: 16, duration: 65, excitement: 6, intensity: 4, nausea: 3, footprint: { width: 3, height: 2 } };
    case 'food_stall':
      return { price: 3, capacity: 1, duration: 12, excitement: 2, intensity: 1, nausea: 0, footprint: { width: 1, height: 1 } };
    case 'drink_stall':
      return { price: 2, capacity: 1, duration: 10, excitement: 2, intensity: 1, nausea: 0, footprint: { width: 1, height: 1 } };
    case 'souvenir_stall':
      return { price: 5, capacity: 1, duration: 14, excitement: 3, intensity: 1, nausea: 0, footprint: { width: 1, height: 1 } };
    case 'toilet':
      return { price: 0, capacity: 4, duration: 20, excitement: 1, intensity: 1, nausea: 0, footprint: { width: 1, height: 1 } };
    case 'information':
      return { price: 0, capacity: 1, duration: 15, excitement: 2, intensity: 1, nausea: 0, footprint: { width: 1, height: 1 } };
    case 'coaster':
      return { price: 8, capacity: 16, duration: 75, excitement: 7, intensity: 6, nausea: 4, footprint: { width: 1, height: 1 } };
  }
};

const findAdjacentRideId = (grid: CoasterTile[][], x: number, y: number): string | null => {
  const neighbors = [
    grid[y - 1]?.[x],
    grid[y + 1]?.[x],
    grid[y]?.[x - 1],
    grid[y]?.[x + 1],
  ];
  const match = neighbors.find((tile) => tile?.track?.rideId);
  return match?.track?.rideId ?? null;
};

const cloneGrid = (grid: CoasterTile[][]): CoasterTile[][] =>
  grid.map((row) => row.map((tile) => ({ ...tile, scenery: [...tile.scenery] })));

export function CoasterProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CoasterGameState>(() => loadGameState() ?? createInitialState());
  const latestStateRef = useRef(state);

  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setState((prev) => simulateCoasterTick(prev, (1 / 30) * prev.speed));
    }, 1000 / 30);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => saveGameState(state), 1000);
    return () => window.clearTimeout(timeout);
  }, [state]);

  const setTool = useCallback((tool: CoasterTool) => {
    setState((prev) => ({ ...prev, selectedTool: tool }));
  }, []);

  const setSpeed = useCallback((speed: CoasterGameState['speed']) => {
    setState((prev) => ({ ...prev, speed }));
  }, []);

  const setActivePanel = useCallback((panel: CoasterGameState['activePanel']) => {
    setState((prev) => ({ ...prev, activePanel: panel }));
  }, []);

  const setEntranceFee = useCallback((fee: number) => {
    setState((prev) => ({
      ...prev,
      finance: { ...prev.finance, entranceFee: fee },
    }));
  }, []);

  const updateRide = useCallback((rideId: string, updates: Partial<CoasterGameState['rides'][number]>) => {
    setState((prev) => ({
      ...prev,
      rides: prev.rides.map((ride) => (ride.id === rideId ? { ...ride, ...updates } : ride)),
    }));
  }, []);

  const setParkName = useCallback((name: string) => {
    setState((prev) => ({ ...prev, parkName: name }));
  }, []);

  const setMaxGuests = useCallback((count: number) => {
    setState((prev) => ({ ...prev, maxGuests: count }));
  }, []);

  const addMoney = useCallback((amount: number) => {
    setState((prev) => ({
      ...prev,
      finance: { ...prev.finance, money: prev.finance.money + amount },
    }));
  }, []);

  const addNotification = useCallback((title: string, description: string) => {
    setState((prev) => ({
      ...prev,
      notifications: [
        {
          id: `note-${Date.now()}`,
          title,
          description,
          timestamp: Date.now(),
        },
        ...prev.notifications,
      ].slice(0, 10),
    }));
  }, []);

  const placeAtTile = useCallback((x: number, y: number) => {
    setState((prev) => {
      if (x < 0 || y < 0 || x >= prev.gridSize || y >= prev.gridSize) return prev;

      const tool = prev.selectedTool;
      const toolInfo = COASTER_TOOL_INFO[tool];
      if (!toolInfo) return prev;
      if (toolInfo.cost > prev.finance.money) return prev;

      const grid = cloneGrid(prev.grid);
      const tile = { ...grid[y][x], scenery: [...grid[y][x].scenery] };

      let updated = false;
      let tileUpdated = false;
      let rides = prev.rides;
      let staff = prev.staff;
      let lastRideId = prev.lastRideId;
      let lastStaffId = prev.lastStaffId;
      let additionalCost = 0;

      if (tool === 'bulldoze') {
        if (tile.path || tile.track || tile.rideId || tile.facility || tile.scenery.length) {
          tile.path = null;
          tile.track = null;
          tile.rideId = null;
          tile.rideType = null;
          tile.facility = null;
          tile.scenery = [];
          tile.hasQueueEntrance = false;
          tile.hasQueueExit = false;
          updated = true;
          tileUpdated = true;
        }
      }

      if (tool === 'path' || tool === 'queue') {
        if (tile.terrain === 'grass' && !tile.track && !tile.rideId && !tile.facility) {
          tile.path = tool === 'path' ? 'path' : 'queue';
          updated = true;
          tileUpdated = true;
        }
      }

      if (tool === 'coaster_track') {
        if (!tile.track && !tile.rideId && !tile.facility && !tile.path) {
          const rideId = findAdjacentRideId(prev.grid, x, y);
          tile.track = createTrackSegment(rideId);
          updated = true;
          tileUpdated = true;
        }
      }

      if (tool === 'coaster_station') {
        if (!tile.track && !tile.rideId && !tile.facility && !tile.path) {
          const nextRideId = `ride-${prev.lastRideId + 1}`;
          const rideStats = defaultRideStats('coaster');
          tile.track = createTrackSegment(nextRideId, 'station');
          tile.rideId = nextRideId;
          tile.rideType = 'coaster';
          tile.hasQueueEntrance = true;
          tile.hasQueueExit = true;
          rides = [
            ...prev.rides,
            {
              id: nextRideId,
              name: `Coaster ${prev.lastRideId + 1}`,
              type: 'coaster',
              category: 'coaster',
              status: 'testing',
              price: rideStats.price,
              capacity: rideStats.capacity,
              duration: rideStats.duration,
              footprint: rideStats.footprint,
              tiles: [{ x, y }],
              entrance: { x, y: y + 1 },
              exit: { x, y: y - 1 },
              ratings: {
                excitement: rideStats.excitement,
                intensity: rideStats.intensity,
                nausea: rideStats.nausea,
              },
              performance: {
                guestsToday: 0,
                revenueToday: 0,
                waitTime: 0,
                satisfaction: 0.8,
              },
              createdAt: Date.now(),
            },
          ];
          lastRideId = prev.lastRideId + 1;

          const starterLoop = [
            { dx: 1, dy: 0 },
            { dx: 2, dy: 0, special: 'lift' as const },
            { dx: 3, dy: 0 },
            { dx: 3, dy: 1, special: 'loop' as const },
            { dx: 3, dy: 2 },
            { dx: 2, dy: 2, special: 'corkscrew' as const },
            { dx: 1, dy: 2 },
            { dx: 0, dy: 2, special: 'brakes' as const },
            { dx: -1, dy: 2 },
            { dx: -1, dy: 1, special: 'booster' as const },
            { dx: -1, dy: 0 },
          ];

          const trackCost = COASTER_TOOL_INFO.coaster_track.cost;
          const loopCost = trackCost * starterLoop.length;
          const canAffordLoop = prev.finance.money - toolInfo.cost >= loopCost;
          const canPlaceLoop = starterLoop.every((segment) => {
            const tx = x + segment.dx;
            const ty = y + segment.dy;
            const targetTile = grid[ty]?.[tx];
            return (
              targetTile &&
              !targetTile.track &&
              !targetTile.rideId &&
              !targetTile.facility &&
              !targetTile.path
            );
          });

          if (canAffordLoop && canPlaceLoop) {
            starterLoop.forEach((segment) => {
              const tx = x + segment.dx;
              const ty = y + segment.dy;
              const targetTile = { ...grid[ty][tx], scenery: [...grid[ty][tx].scenery] };
              targetTile.track = createTrackSegment(nextRideId, segment.special ?? null);
              grid[ty][tx] = targetTile;
            });
            additionalCost += loopCost;
          }

          const pathCost = COASTER_TOOL_INFO.path.cost;
          const queueCost = COASTER_TOOL_INFO.queue.cost;
          const entranceTarget = { x, y: y + 1 };
          const pathTargets: { x: number; y: number; type: 'path' | 'queue' }[] = [];
          let currentX = prev.parkEntrance.x;
          let currentY = prev.parkEntrance.y;

          while (currentX !== entranceTarget.x) {
            currentX += Math.sign(entranceTarget.x - currentX);
            pathTargets.push({ x: currentX, y: currentY, type: 'path' });
          }
          while (currentY !== entranceTarget.y) {
            currentY += Math.sign(entranceTarget.y - currentY);
            pathTargets.push({ x: currentX, y: currentY, type: 'path' });
          }

          if (
            pathTargets.length &&
            pathTargets[pathTargets.length - 1].x === entranceTarget.x &&
            pathTargets[pathTargets.length - 1].y === entranceTarget.y
          ) {
            pathTargets.pop();
          }

          pathTargets.push({ x: entranceTarget.x, y: entranceTarget.y, type: 'queue' });
          pathTargets.push({ x: entranceTarget.x, y: entranceTarget.y + 1, type: 'queue' });

          const pathEdits: { x: number; y: number; type: 'path' | 'queue' }[] = [];
          pathTargets.forEach((target) => {
            const targetTile = grid[target.y]?.[target.x];
            if (!targetTile) return;
            if (targetTile.track || targetTile.rideId || targetTile.facility) return;
            if (target.type === 'queue' && targetTile.path === 'queue') return;
            if (target.type === 'path' && targetTile.path) return;
            pathEdits.push(target);
          });

          const pathTotalCost = pathEdits.reduce(
            (sum, target) => sum + (target.type === 'queue' ? queueCost : pathCost),
            0
          );

          const availableFunds = prev.finance.money - toolInfo.cost - additionalCost;
          if (availableFunds >= pathTotalCost) {
            pathEdits.forEach((target) => {
              const updatedTile = { ...grid[target.y][target.x], scenery: [...grid[target.y][target.x].scenery] };
              updatedTile.path = target.type;
              grid[target.y][target.x] = updatedTile;
            });
            additionalCost += pathTotalCost;
          }

          updated = true;
          tileUpdated = true;
        }
      }

      if (
        tool === 'coaster_lift' ||
        tool === 'coaster_brakes' ||
        tool === 'coaster_booster' ||
        tool === 'coaster_loop' ||
        tool === 'coaster_corkscrew'
      ) {
        if (tile.track) {
          const specialMap: Record<string, TrackSegment['special']> = {
            coaster_lift: 'lift',
            coaster_brakes: 'brakes',
            coaster_booster: 'booster',
            coaster_loop: 'loop',
            coaster_corkscrew: 'corkscrew',
          };
          tile.track = { ...tile.track, special: specialMap[tool] };
          updated = true;
          tileUpdated = true;
        }
      }

      if (tool === 'tree' || tool === 'bench' || tool === 'lamp' || tool === 'fence') {
        if (!tile.track && !tile.rideId && !tile.facility) {
          const scenery = tool === 'tree' ? 'tree' : tool === 'bench' ? 'bench' : tool === 'lamp' ? 'lamp' : 'fence';
          if (!tile.scenery.includes(scenery)) {
            tile.scenery.push(scenery);
            updated = true;
            tileUpdated = true;
          }
        }
      }

      const rideType = rideTypeFromTool(tool);
      if (rideType) {
        const rideStats = defaultRideStats(rideType);
        const footprint = rideStats.footprint;
        const tilesToFill: { x: number; y: number }[] = [];
        let canPlace = true;

        for (let dy = 0; dy < footprint.height; dy += 1) {
          for (let dx = 0; dx < footprint.width; dx += 1) {
            const tx = x + dx;
            const ty = y + dy;
            const targetTile = grid[ty]?.[tx];
            if (!targetTile || targetTile.track || targetTile.rideId || targetTile.facility || targetTile.path) {
              canPlace = false;
              break;
            }
            tilesToFill.push({ x: tx, y: ty });
          }
          if (!canPlace) break;
        }

        if (canPlace) {
          const nextRideId = `ride-${prev.lastRideId + 1}`;
          tilesToFill.forEach((pos) => {
            const rideTile = { ...grid[pos.y][pos.x], scenery: [...grid[pos.y][pos.x].scenery] };
            rideTile.rideId = nextRideId;
            rideTile.rideType = rideType;
            if (rideCategoryFromType(rideType) !== 'coaster' && rideCategoryFromType(rideType) !== 'flat') {
              rideTile.facility = rideType;
            }
            grid[pos.y][pos.x] = rideTile;
          });

          rides = [
            ...prev.rides,
            {
              id: nextRideId,
              name: `${rideType.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase())} ${prev.lastRideId + 1}`,
              type: rideType,
              category: rideCategoryFromType(rideType),
              status: rideType === 'food_stall' || rideType === 'drink_stall' || rideType === 'souvenir_stall' ? 'open' : 'testing',
              price: rideStats.price,
              capacity: rideStats.capacity,
              duration: rideStats.duration,
              footprint: rideStats.footprint,
              tiles: tilesToFill,
              entrance: { x, y: y + footprint.height },
              exit: { x: x + footprint.width - 1, y: y - 1 },
              ratings: {
                excitement: rideStats.excitement,
                intensity: rideStats.intensity,
                nausea: rideStats.nausea,
              },
              performance: {
                guestsToday: 0,
                revenueToday: 0,
                waitTime: 0,
                satisfaction: 0.75,
              },
              createdAt: Date.now(),
            },
          ];
          lastRideId = prev.lastRideId + 1;
          updated = true;
          tileUpdated = false;
        }
      }

      if (
        tool === 'staff_handyman' ||
        tool === 'staff_mechanic' ||
        tool === 'staff_security' ||
        tool === 'staff_entertainer'
      ) {
        const staffTypeMap: Record<string, Staff['type']> = {
          staff_handyman: 'handyman',
          staff_mechanic: 'mechanic',
          staff_security: 'security',
          staff_entertainer: 'entertainer',
        };
        staff = [
          ...prev.staff,
          {
            id: prev.lastStaffId + 1,
            type: staffTypeMap[tool],
            tileX: prev.parkEntrance.x,
            tileY: prev.parkEntrance.y,
            direction: 'north',
            progress: 0,
            speed: 0.4,
            state: 'idle',
            path: [],
            pathIndex: 0,
            targetTile: null,
            assignedArea: null,
            mood: 0.8,
          },
        ];
        lastStaffId = prev.lastStaffId + 1;
        updated = true;
      }

      if (!updated) {
        return prev;
      }

      if (tileUpdated) {
        grid[y][x] = tile;
      }

      return {
        ...prev,
        grid,
        rides,
        staff,
        lastRideId,
        lastStaffId,
        finance: {
          ...prev.finance,
          money: prev.finance.money - toolInfo.cost - additionalCost,
        },
      };
    });
  }, []);

  const value: CoasterContextValue = {
    state,
    latestStateRef,
    setTool,
    setSpeed,
    setActivePanel,
    setEntranceFee,
    updateRide,
    setParkName,
    setMaxGuests,
    placeAtTile,
    addMoney,
    addNotification,
  };

  return <CoasterContext.Provider value={value}>{children}</CoasterContext.Provider>;
}

export const useCoaster = () => {
  const context = useContext(CoasterContext);
  if (!context) {
    throw new Error('useCoaster must be used within a CoasterProvider');
  }
  return context;
};
