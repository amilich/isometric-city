import { CardinalDirection } from '@/core/types';
import { CoasterBuildingType, CoasterParkState, CoasterTile, Finance, Guest, ParkStats, PathInfo, Research, WeatherState } from '@/games/coaster/types';
import { findPath } from '@/lib/coasterPathfinding';

export const DEFAULT_COASTER_GRID_SIZE = 50;

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function createInitialGrid(size: number): CoasterTile[][] {
  const grid: CoasterTile[][] = [];
  for (let y = 0; y < size; y++) {
    const row: CoasterTile[] = [];
    for (let x = 0; x < size; x++) {
      row.push({
        x,
        y,
        terrain: 'grass',
        height: 0,
        path: null,
        building: null,
        rideId: null,
        track: null,
        scenery: null,
        zoneId: null,
      });
    }
    grid.push(row);
  }
  return grid;
}

const DIRECTION_VECTORS: Record<CardinalDirection, { dx: number; dy: number }> = {
  north: { dx: 0, dy: -1 },
  east: { dx: 1, dy: 0 },
  south: { dx: 0, dy: 1 },
  west: { dx: -1, dy: 0 },
};

const OPPOSITE_DIRECTION: Record<CardinalDirection, CardinalDirection> = {
  north: 'south',
  east: 'west',
  south: 'north',
  west: 'east',
};

const GUEST_SPAWN_INTERVAL = 8;
const MAX_GUESTS = 120;

function createGuest(id: number, tileX: number, tileY: number): Guest {
  const colors = ['#60a5fa', '#f87171', '#facc15', '#34d399', '#a78bfa'];
  const pickColor = () => colors[Math.floor(Math.random() * colors.length)];
  return {
    id,
    name: `Guest ${id}`,
    tileX,
    tileY,
    direction: 'south',
    progress: 0,
    state: 'wandering',
    stateTimer: 0,
    queueJoinTick: null,
    needs: {
      hunger: 200,
      thirst: 200,
      bathroom: 200,
      happiness: 180,
      nausea: 0,
      energy: 220,
    },
    happiness: 180,
    energy: 220,
    money: 50 + Math.floor(Math.random() * 50),
    thoughts: [],
    currentRideId: null,
    targetRideId: null,
    targetShop: null,
    path: [],
    pathIndex: 0,
    age: 0,
    maxAge: 600,
    colors: {
      skin: '#f3d9b1',
      shirt: pickColor(),
      pants: '#1f2937',
      hat: Math.random() > 0.6 ? pickColor() : undefined,
    },
    hasItem: null,
  };
}

function clamp(value: number, min = 0, max = 255): number {
  return Math.max(min, Math.min(max, value));
}

function updateGuestNeeds(guest: Guest): Guest {
  const nextNeeds = {
    hunger: clamp(guest.needs.hunger - 1.2),
    thirst: clamp(guest.needs.thirst - 1.5),
    bathroom: clamp(guest.needs.bathroom - 0.6),
    happiness: guest.needs.happiness,
    nausea: clamp(guest.needs.nausea - 0.8),
    energy: clamp(guest.needs.energy - 0.7),
  };

  let happiness = guest.happiness;
  if (nextNeeds.hunger < 80 || nextNeeds.thirst < 80) {
    happiness = clamp(happiness - 1);
  }
  if (nextNeeds.energy < 60) {
    happiness = clamp(happiness - 1);
  }

  return {
    ...guest,
    needs: { ...nextNeeds, happiness },
    happiness,
  };
}

const SHOP_EFFECTS: Record<CoasterBuildingType, { hunger?: number; thirst?: number; bathroom?: number; happiness?: number; cost: number }> = {
  food_stall: { hunger: 100, happiness: 6, cost: 5 },
  drink_stall: { thirst: 110, happiness: 4, cost: 3 },
  ice_cream_stall: { hunger: 80, happiness: 8, cost: 4 },
  souvenir_shop: { happiness: 10, cost: 6 },
  info_kiosk: { happiness: 2, cost: 2 },
  toilets: { bathroom: 140, happiness: 4, cost: 0 },
  atm: { happiness: 2, cost: 0 },
  first_aid: { happiness: 6, cost: 0 },
  staff_room: { happiness: 0, cost: 0 },
};

function calculateParkRating(guests: Guest[], rides: number, cleanliness: number): number {
  const averageHappiness = guests.length > 0
    ? guests.reduce((sum, guest) => sum + guest.happiness, 0) / guests.length
    : 180;
  const rideBonus = Math.min(160, rides * 12);
  return clamp(Math.round(averageHappiness * 0.7 + cleanliness * 0.2 + rideBonus), 0, 999);
}

function applyShopEffects(guest: Guest, shopType: CoasterBuildingType): Guest {
  const effect = SHOP_EFFECTS[shopType];
  if (!effect) return guest;
  const needs = {
    ...guest.needs,
    hunger: clamp(guest.needs.hunger + (effect.hunger ?? 0)),
    thirst: clamp(guest.needs.thirst + (effect.thirst ?? 0)),
    bathroom: clamp(guest.needs.bathroom + (effect.bathroom ?? 0)),
  };
  const happiness = clamp(guest.happiness + (effect.happiness ?? 0));
  return {
    ...guest,
    needs: { ...needs, happiness },
    happiness,
    money: Math.max(0, guest.money - effect.cost),
  };
}

function updateGuestMovement(guest: Guest, state: CoasterParkState): Guest {
  const grid = state.grid;
  const speed = 0.4;
  const nextAge = guest.age + 1;

  if (guest.state === 'on_ride') {
    const nextTimer = guest.stateTimer - 1;
    if (nextTimer <= 0) {
      const exitOptions = (Object.keys(DIRECTION_VECTORS) as CardinalDirection[])
        .map((direction) => {
          const delta = DIRECTION_VECTORS[direction];
          return { x: guest.tileX + delta.dx, y: guest.tileY + delta.dy };
        })
        .filter((pos) => grid[pos.y]?.[pos.x]?.path);
      const exitTile = exitOptions.length > 0 ? exitOptions[Math.floor(Math.random() * exitOptions.length)] : { x: guest.tileX, y: guest.tileY };
      return {
        ...guest,
        state: 'wandering',
        stateTimer: 0,
        targetRideId: null,
        currentRideId: null,
        queueJoinTick: null,
        path: [],
        pathIndex: 0,
        tileX: exitTile.x,
        tileY: exitTile.y,
        progress: 0,
        age: nextAge,
      };
    }
    return { ...guest, stateTimer: nextTimer, age: nextAge };
  }

  if (guest.state === 'at_shop') {
    const nextTimer = guest.stateTimer - 1;
    if (nextTimer <= 0) {
      const shopType = guest.targetShop?.type;
      const updatedGuest = shopType ? applyShopEffects(guest, shopType) : guest;
      return {
        ...updatedGuest,
        state: 'wandering',
        stateTimer: 0,
        targetShop: null,
        queueJoinTick: null,
        path: [],
        pathIndex: 0,
        progress: 0,
        age: nextAge,
      };
    }
    return { ...guest, stateTimer: nextTimer, age: nextAge };
  }

  if (guest.state === 'queuing') {
    return { ...guest, age: nextAge };
  }

  if (guest.path.length > 1 && guest.pathIndex < guest.path.length - 1) {
    const nextTarget = guest.path[guest.pathIndex + 1];
    const dx = nextTarget.x - guest.tileX;
    const dy = nextTarget.y - guest.tileY;
    const direction = dx > 0 ? 'east' : dx < 0 ? 'west' : dy > 0 ? 'south' : 'north';
    const nextProgress = guest.progress + speed;
    if (nextProgress < 1) {
      return { ...guest, progress: nextProgress, direction, age: nextAge };
    }
    const reachedEnd = guest.pathIndex + 1 >= guest.path.length - 1;
    const nextState = reachedEnd && guest.targetRideId
      ? 'queuing'
      : reachedEnd && guest.targetShop
        ? 'at_shop'
        : guest.state;
    return {
      ...guest,
      tileX: nextTarget.x,
      tileY: nextTarget.y,
      direction,
      progress: 0,
      pathIndex: guest.pathIndex + 1,
      state: nextState,
      stateTimer: nextState === 'at_shop' ? 4 : guest.stateTimer,
      queueJoinTick: nextState === 'queuing' ? state.tick : guest.queueJoinTick,
      path: reachedEnd ? [] : guest.path,
      age: nextAge,
    };
  }

  const nextProgress = guest.progress + speed;
  if (nextProgress < 1) {
    return { ...guest, progress: nextProgress, age: nextAge };
  }

  const currentTile = grid[guest.tileY]?.[guest.tileX];
  if (!currentTile?.path) {
    return { ...guest, progress: 0, age: nextAge };
  }

  const edges = currentTile.path.edges;
  const options = (Object.keys(edges) as CardinalDirection[]).filter((direction) => edges[direction]);
  if (options.length === 0) {
    return { ...guest, progress: 0, age: nextAge };
  }

  const preferredOptions = options.filter((direction) => direction !== OPPOSITE_DIRECTION[guest.direction]);
  const choices = preferredOptions.length > 0 ? preferredOptions : options;
  const nextDirection = choices[Math.floor(Math.random() * choices.length)];
  const vector = DIRECTION_VECTORS[nextDirection];
  const nextX = guest.tileX + vector.dx;
  const nextY = guest.tileY + vector.dy;
  if (!grid[nextY]?.[nextX]?.path) {
    return { ...guest, progress: 0, age: nextAge };
  }

  return {
    ...guest,
    tileX: nextX,
    tileY: nextY,
    direction: nextDirection,
    progress: 0,
    age: nextAge,
  };
}

type ShopTarget = { position: { x: number; y: number }; type: CoasterBuildingType };

function findShopTargets(grid: CoasterTile[][]): ShopTarget[] {
  const targets: ShopTarget[] = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const building = grid[y][x].building;
      if (building) {
        targets.push({ position: { x, y }, type: building.type });
      }
    }
  }
  return targets;
}

function findClosestShop(guest: Guest, targets: ShopTarget[], types: CoasterBuildingType[]): ShopTarget | null {
  let closest: ShopTarget | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  targets.forEach((target) => {
    if (!types.includes(target.type)) return;
    const distance = Math.abs(target.position.x - guest.tileX) + Math.abs(target.position.y - guest.tileY);
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = target;
    }
  });
  return closest;
}

function updateTrains(state: CoasterParkState): CoasterParkState {
  const trackTiles: { x: number; y: number }[] = [];
  for (let y = 0; y < state.grid.length; y++) {
    for (let x = 0; x < state.grid[y].length; x++) {
      if (state.grid[y][x].track) {
        trackTiles.push({ x, y });
      }
    }
  }

  if (trackTiles.length === 0) {
    return { ...state, coasterTrains: [] };
  }

  let trains = state.coasterTrains;
  if (trains.length === 0 && trackTiles.length >= 4) {
    const spawn = trackTiles[0];
    trains = [{
      id: 1,
      tileX: spawn.x,
      tileY: spawn.y,
      direction: 'east',
      progress: 0,
      speed: 0.5,
    }];
  }

  const updatedTrains = trains.map((train) => {
    const currentTrack = state.grid[train.tileY]?.[train.tileX]?.track;
    if (!currentTrack) return train;
    const nextProgress = train.progress + train.speed;
    if (nextProgress < 1) {
      return { ...train, progress: nextProgress };
    }
    const connections = currentTrack.connections;
    const options = (Object.keys(connections) as CardinalDirection[]).filter((dir) => connections[dir]);
    if (options.length === 0) {
      return { ...train, progress: 0 };
    }
    const preferred = options.filter((dir) => dir !== OPPOSITE_DIRECTION[train.direction]);
    const choices = preferred.length > 0 ? preferred : options;
    const nextDirection = choices[Math.floor(Math.random() * choices.length)];
    const vector = DIRECTION_VECTORS[nextDirection];
    const nextX = train.tileX + vector.dx;
    const nextY = train.tileY + vector.dy;
    if (!state.grid[nextY]?.[nextX]?.track) {
      return { ...train, progress: 0 };
    }
    return {
      ...train,
      tileX: nextX,
      tileY: nextY,
      direction: nextDirection,
      progress: 0,
    };
  });

  return {
    ...state,
    coasterTrains: updatedTrains,
  };
}

function updateGuests(state: CoasterParkState): CoasterParkState {
  let nextGuests = state.guests.map((guest) => updateGuestNeeds(guest));
  nextGuests = nextGuests.map((guest) => updateGuestMovement(guest, state));
  nextGuests = nextGuests.filter((guest) => guest.age < guest.maxAge);
  let totalGuests = state.stats.totalGuests;

  nextGuests = nextGuests.map((guest) => {
    if ((guest.state === 'queuing' || guest.state === 'heading_to_ride') && guest.targetRideId) {
      const rideExists = state.rides.some((ride) => ride.id === guest.targetRideId);
      if (!rideExists) {
        return {
          ...guest,
          state: 'wandering',
          targetRideId: null,
          queueJoinTick: null,
          path: [],
          pathIndex: 0,
        };
      }
    }
    return guest;
  });

  const shopTargets = findShopTargets(state.grid);
  if (shopTargets.length > 0) {
    nextGuests = nextGuests.map((guest) => {
      if (guest.state !== 'wandering' || guest.targetRideId || guest.targetShop) return guest;
      if (guest.needs.hunger < 110) {
        const shop = findClosestShop(guest, shopTargets, ['food_stall', 'ice_cream_stall']);
        if (shop) {
          const path = findPath({ x: guest.tileX, y: guest.tileY }, shop.position, state.grid);
          if (path && path.length > 1) {
            return {
              ...guest,
              state: 'heading_to_shop',
              targetShop: shop,
              path,
              pathIndex: 0,
              progress: 0,
            };
          }
        }
      }
      if (guest.needs.thirst < 110) {
        const shop = findClosestShop(guest, shopTargets, ['drink_stall']);
        if (shop) {
          const path = findPath({ x: guest.tileX, y: guest.tileY }, shop.position, state.grid);
          if (path && path.length > 1) {
            return {
              ...guest,
              state: 'heading_to_shop',
              targetShop: shop,
              path,
              pathIndex: 0,
              progress: 0,
            };
          }
        }
      }
      if (guest.needs.bathroom < 80) {
        const shop = findClosestShop(guest, shopTargets, ['toilets']);
        if (shop) {
          const path = findPath({ x: guest.tileX, y: guest.tileY }, shop.position, state.grid);
          if (path && path.length > 1) {
            return {
              ...guest,
              state: 'heading_to_shop',
              targetShop: shop,
              path,
              pathIndex: 0,
              progress: 0,
            };
          }
        }
      }
      return guest;
    });
  }

  const availableRides = state.rides.filter((ride) => ride.status === 'open');
  if (availableRides.length > 0) {
    nextGuests = nextGuests.map((guest) => {
      if (guest.state !== 'wandering' || guest.targetRideId || guest.targetShop) return guest;
      const ride = availableRides[Math.floor(Math.random() * availableRides.length)];
      const queueEntry = ride.queue.entry;
      const queuePath = state.grid[queueEntry.y]?.[queueEntry.x]?.path;
      const target = queuePath && queuePath.isQueue ? queueEntry : ride.entrance;
      const path = findPath({ x: guest.tileX, y: guest.tileY }, target, state.grid);
      if (!path || path.length < 2) return guest;
      return {
        ...guest,
        state: 'heading_to_ride',
        targetRideId: ride.id,
        path,
        pathIndex: 0,
        progress: 0,
      };
    });
  }

  const queueMap = new Map<string, Guest[]>();
  nextGuests.forEach((guest) => {
    if (guest.state !== 'queuing' || !guest.targetRideId) return;
    const queueGuests = queueMap.get(guest.targetRideId) ?? [];
    queueGuests.push(guest);
    queueMap.set(guest.targetRideId, queueGuests);
  });
  queueMap.forEach((queueGuests, rideId) => {
    queueGuests.sort((a, b) => (a.queueJoinTick ?? 0) - (b.queueJoinTick ?? 0));
    queueMap.set(rideId, queueGuests);
  });

  let updatedRides = state.rides.map((ride) => ({
    ...ride,
    queue: { ...ride.queue, guestIds: (queueMap.get(ride.id) ?? []).map((guest) => guest.id) },
  }));
  let rideRevenue = 0;

  const guestUpdates = new Map<number, Partial<Guest>>();
  updatedRides = updatedRides.map((ride) => {
    const queueGuests = queueMap.get(ride.id) ?? [];
    const cycleTicks = Math.max(4, Math.round(ride.stats.rideTime / 10));
    const nextTimer = Math.max(0, ride.cycleTimer - 1);
    if (nextTimer > 0 || queueGuests.length === 0) {
      return { ...ride, cycleTimer: nextTimer };
    }

    const dispatchCount = Math.min(ride.stats.capacity, queueGuests.length);
    const boardingGuests = queueGuests.slice(0, dispatchCount);
    if (dispatchCount === 0) {
      return { ...ride, cycleTimer: nextTimer };
    }

    const revenue = dispatchCount * ride.price;
    rideRevenue += revenue;
    boardingGuests.forEach((guest) => {
      guestUpdates.set(guest.id, {
        state: 'on_ride',
        stateTimer: cycleTicks,
        currentRideId: ride.id,
        targetRideId: null,
        queueJoinTick: null,
        path: [],
        pathIndex: 0,
        progress: 0,
        money: Math.max(0, guest.money - ride.price),
        happiness: Math.min(255, guest.happiness + Math.round(ride.excitement / 12)),
        needs: {
          ...guest.needs,
          nausea: clamp(guest.needs.nausea + Math.round(ride.nausea / 8)),
        },
      });
    });

    return {
      ...ride,
      cycleTimer: cycleTicks,
      stats: {
        ...ride.stats,
        totalRiders: ride.stats.totalRiders + dispatchCount,
        totalRevenue: ride.stats.totalRevenue + revenue,
      },
    };
  });

  if (guestUpdates.size > 0) {
    nextGuests = nextGuests.map((guest) => {
      const update = guestUpdates.get(guest.id);
      return update ? { ...guest, ...update } : guest;
    });
  }

  const shopEntries = nextGuests.filter(
    (guest) => guest.state === 'at_shop' && guest.stateTimer === 4 && guest.targetShop
  );
  let shopRevenue = 0;
  if (shopEntries.length > 0) {
    shopEntries.forEach((guest) => {
      const effect = SHOP_EFFECTS[guest.targetShop?.type ?? 'food_stall'];
      shopRevenue += effect?.cost ?? 0;
    });
  }

  if (state.tick % GUEST_SPAWN_INTERVAL === 0 && nextGuests.length < MAX_GUESTS) {
    const entranceTile = state.grid[state.parkEntrance.y]?.[state.parkEntrance.x];
    if (entranceTile?.path) {
      const nextId = state.guests.length > 0 ? Math.max(...state.guests.map((g) => g.id)) + 1 : 1;
      nextGuests = [...nextGuests, createGuest(nextId, state.parkEntrance.x, state.parkEntrance.y)];
      totalGuests += 1;
    }
  }

  return {
    ...state,
    guests: nextGuests,
    rides: updatedRides,
    finance: rideRevenue > 0 || shopRevenue > 0 ? {
      ...state.finance,
      cash: state.finance.cash + rideRevenue + shopRevenue,
      rideRevenue: state.finance.rideRevenue + rideRevenue,
      shopRevenue: state.finance.shopRevenue + shopRevenue,
      income: state.finance.income + rideRevenue + shopRevenue,
    } : state.finance,
    stats: {
      ...state.stats,
      guestsInPark: nextGuests.length,
      totalGuests,
      rating: calculateParkRating(nextGuests, updatedRides.length, state.stats.cleanliness),
      excitement: updatedRides.length > 0
        ? Math.round(updatedRides.reduce((sum, ride) => sum + ride.excitement, 0) / updatedRides.length)
        : state.stats.excitement,
      nausea: nextGuests.length > 0
        ? Math.round(nextGuests.reduce((sum, guest) => sum + guest.needs.nausea, 0) / nextGuests.length)
        : 0,
    },
  };
}

function createDefaultStats(): ParkStats {
  return {
    guestsInPark: 0,
    totalGuests: 0,
    rating: 550,
    cleanliness: 80,
    excitement: 40,
    nausea: 0,
  };
}

function createDefaultFinance(): Finance {
  return {
    cash: 12000,
    loan: 0,
    loanInterestRate: 0.04,
    entranceFee: 10,
    income: 0,
    expenses: 0,
    rideRevenue: 0,
    shopRevenue: 0,
    staffCost: 0,
    maintenanceCost: 0,
    researchCost: 0,
    transactions: [],
  };
}

function createDefaultResearch(): Research {
  return {
    activeResearchId: null,
    funding: 0.2,
    items: [],
  };
}

function createDefaultWeather(): WeatherState {
  return {
    type: 'sunny',
    temperature: 22,
    rainLevel: 0,
    windSpeed: 5,
  };
}

function createPathInfo(edges: PathInfo['edges']): PathInfo {
  return {
    style: 'concrete',
    isQueue: false,
    queueRideId: null,
    edges,
    slope: 'flat',
    railing: false,
    isBridge: false,
  };
}

export function createInitialCoasterState(
  size: number = DEFAULT_COASTER_GRID_SIZE,
  parkName: string = 'Coaster Park'
): CoasterParkState {
  const entranceX = Math.floor(size / 2);
  const entranceY = size - 2;

  const grid = createInitialGrid(size);
  if (grid[entranceY]?.[entranceX]) {
    const northTile = grid[entranceY - 1]?.[entranceX];
    grid[entranceY][entranceX] = {
      ...grid[entranceY][entranceX],
      path: createPathInfo({ north: Boolean(northTile), east: false, south: false, west: false }),
    };
    if (northTile) {
      grid[entranceY - 1][entranceX] = {
        ...northTile,
        path: createPathInfo({ north: false, east: false, south: true, west: false }),
      };
    }
  }

  return {
    id: generateUUID(),
    parkName,
    grid,
    gridSize: size,
    year: 1,
    month: 1,
    day: 1,
    hour: 9,
    tick: 0,
    speed: 1,
    selectedTool: 'select',
    stats: createDefaultStats(),
    finance: createDefaultFinance(),
    rides: [],
    guests: [],
    staff: [],
    coasterTrains: [],
    research: createDefaultResearch(),
    weather: createDefaultWeather(),
    activePanel: 'none',
    parkEntrance: { x: entranceX, y: entranceY },
    parkExit: { x: entranceX, y: entranceY + 1 < size ? entranceY + 1 : entranceY },
    gameVersion: 0,
  };
}

export function simulateCoasterTick(state: CoasterParkState): CoasterParkState {
  const nextTick = state.tick + 1;
  let { hour, day, month, year } = state;

  if (nextTick % 60 === 0) {
    hour = (hour + 1) % 24;
    if (hour === 0) {
      day += 1;
      if (day > 30) {
        day = 1;
        month += 1;
        if (month > 12) {
          month = 1;
          year += 1;
        }
      }
    }
  }

  const nextState: CoasterParkState = {
    ...state,
    tick: nextTick,
    hour,
    day,
    month,
    year,
  };

  const withGuests = updateGuests(nextState);
  return updateTrains(withGuests);
}
