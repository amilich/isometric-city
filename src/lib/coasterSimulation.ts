import { CardinalDirection, GridPosition, isInBounds } from '@/core/types';
import { CoasterBuildingType, CoasterParkState, CoasterTile, Finance, Guest, GuestItem, GuestThoughtType, ParkStats, PathInfo, Research, SceneryType, Staff, WeatherState, WeatherType } from '@/games/coaster/types';
import { findPath } from '@/lib/coasterPathfinding';
import { estimateQueueWaitMinutes, getRideDispatchCapacity } from '@/lib/coasterQueue';
import { createResearchItems } from '@/lib/coasterResearch';

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
        litter: 0,
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
const STAFF_SPEED = 0.32;
const CLEANLINESS_DECAY_PER_GUEST = 0.006;
const HANDYMAN_CLEANLINESS_BOOST = 0.25;
const STAFF_FATIGUE_DECAY = 0.05;
const STAFF_ROOM_RECOVERY = 0.45;
const STAFF_ROOM_RADIUS = 2;
const STAFF_MIN_EFFICIENCY = 0.35;
const LITTER_DROP_CHANCE = 0.03;
const LITTER_MAX = 3;
const LITTER_CLEANLINESS_PENALTY = 0.008;
const LITTER_HAPPINESS_PENALTY = 0.6;
const TRASH_CAN_RADIUS = 2;
const TRASH_CAN_USE_CHANCE = 0.7;
const TRASH_CAN_LITTER_MULTIPLIER = 0.25;
const ENTERTAINER_RADIUS = 4;
const PATH_BLOCKED_WAIT = 12;
const SECURITY_RADIUS = 3;
const SCENERY_RADIUS = 3;
const TRASH_CAN_CLEANLINESS_BOOST = 0.02;
const LAMP_NIGHT_BONUS = 0.25;
const BENCH_REST_THRESHOLD = 200;
const BENCH_REST_RADIUS = 3;
const BENCH_REST_TICKS = 25;
const BENCH_ENERGY_RECOVERY = 2.5;
const BENCH_HAPPINESS_RECOVERY = 0.3;
const ATM_VISIT_THRESHOLD = 30;
const ATM_TARGET_CASH = 100;
const MECHANIC_UPTIME_BOOST = 0.0012;
const RIDE_UPTIME_DECAY = 0.0005;
const PAYROLL_INTERVAL_DAYS = 7;
const QUEUE_GUESTS_PER_TILE = 4;
const MIN_QUEUE_LENGTH = 8;
const MAX_QUEUE_LENGTH = 80;
const DEFAULT_QUEUE_LENGTH = 30;
const THOUGHT_COOLDOWN = 120;
const MAX_THOUGHTS = 3;
const LEAVE_QUEUE_TICKS = 180;
const LEAVE_QUEUE_HAPPINESS = 130;
const LEAVE_PARK_HAPPINESS = 70;
const LEAVE_PARK_NEED = 25;
const LEAVE_PARK_ENERGY = 20;
const LEAVE_PARK_MONEY = 2;
const BREAKDOWN_INTERVAL_TICKS = 180;
const REPAIR_TICKS = 90;
const MAINTENANCE_BASE_COST = 120;
const QUEUE_PATIENCE_START = 15;
const QUEUE_PATIENCE_MEDIUM = 45;
const QUEUE_PATIENCE_HIGH = 90;
const QUEUE_PATIENCE_LOW_PENALTY = 0.2;
const QUEUE_PATIENCE_MEDIUM_PENALTY = 0.35;
const QUEUE_PATIENCE_HIGH_PENALTY = 0.5;
const QUEUE_THOUGHT_TICKS = 10;
const WEATHER_CHANGE_HOURS = 2;
const LOAN_INTEREST_HOUR = 6;
const BASE_ENTRANCE_FEE = 10;
const RESEARCH_RATE = 8;
const RESEARCH_COST_RATE = 18;
const RESEARCH_RATE_MULTIPLIER = 1.6;

function createGuest(id: number, tileX: number, tileY: number, entranceFee: number): Guest {
  const colors = ['#60a5fa', '#f87171', '#facc15', '#34d399', '#a78bfa'];
  const pickColor = () => colors[Math.floor(Math.random() * colors.length)];
  const entrancePenalty = Math.max(0, entranceFee - 10) * 3;
  const startingHappiness = clamp(180 - entrancePenalty);
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
      happiness: startingHappiness,
      nausea: 0,
      energy: 220,
    },
    happiness: startingHappiness,
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

function clampFloat(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

function createWeather(type: WeatherType): WeatherState {
  switch (type) {
    case 'sunny':
      return {
        type,
        temperature: randomBetween(22, 30),
        rainLevel: 0,
        windSpeed: randomBetween(3, 6),
      };
    case 'cloudy':
      return {
        type,
        temperature: randomBetween(18, 24),
        rainLevel: 0.2,
        windSpeed: randomBetween(6, 10),
      };
    case 'rainy':
      return {
        type,
        temperature: randomBetween(14, 20),
        rainLevel: 0.7,
        windSpeed: randomBetween(10, 16),
      };
    case 'stormy':
      return {
        type,
        temperature: randomBetween(12, 18),
        rainLevel: 0.95,
        windSpeed: randomBetween(16, 22),
      };
    default:
      return {
        type: 'sunny',
        temperature: 22,
        rainLevel: 0,
        windSpeed: 5,
      };
  }
}

function getNextWeather(current: WeatherState): WeatherState {
  const options: WeatherType[] = ['sunny', 'cloudy', 'rainy', 'stormy'].filter(
    (option) => option !== current.type
  );
  const nextType = options[Math.floor(Math.random() * options.length)] ?? current.type;
  return createWeather(nextType);
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

function getGuestSpawnInterval(state: CoasterParkState): number {
  const ratingFactor = clampFloat(state.stats.rating / 600, 0.5, 1.6);
  const feeDelta = state.finance.entranceFee - BASE_ENTRANCE_FEE;
  const feeFactor = clampFloat(1 - feeDelta * 0.05, 0.4, 1.4);
  const weatherFactor = state.weather.type === 'sunny'
    ? 1.1
    : state.weather.type === 'cloudy'
      ? 1
      : state.weather.type === 'rainy'
        ? 0.85
        : 0.7;
  const combined = ratingFactor * feeFactor * weatherFactor;
  return Math.max(3, Math.round(GUEST_SPAWN_INTERVAL / Math.max(0.3, combined)));
}

function applyWeatherMood(guest: Guest, weather: WeatherState): Guest {
  let delta = 0;
  if (weather.type === 'sunny') {
    delta = 0.2;
  } else if (weather.type === 'rainy') {
    delta = -0.3;
  } else if (weather.type === 'stormy') {
    delta = -0.6;
  }
  if (delta === 0) return guest;
  const happiness = clamp(guest.happiness + delta);
  if (happiness === guest.happiness) return guest;
  return {
    ...guest,
    happiness,
    needs: {
      ...guest.needs,
      happiness,
    },
  };
}

const SHOP_EFFECTS: Record<CoasterBuildingType, { hunger?: number; thirst?: number; bathroom?: number; happiness?: number; nausea?: number; energy?: number; moneyDelta?: number; cost: number }> = {
  food_stall: { hunger: 100, happiness: 6, cost: 5 },
  drink_stall: { thirst: 110, happiness: 4, cost: 3 },
  ice_cream_stall: { hunger: 80, happiness: 8, cost: 4 },
  souvenir_shop: { happiness: 10, cost: 6 },
  info_kiosk: { happiness: 2, cost: 2 },
  toilets: { bathroom: 140, happiness: 4, cost: 0 },
  atm: { happiness: 2, cost: 0 },
  first_aid: { happiness: 6, nausea: -80, cost: 0 },
  staff_room: { happiness: 0, cost: 0 },
};

const SHOP_ITEM_OPTIONS: Partial<Record<CoasterBuildingType, GuestItem[]>> = {
  food_stall: ['food'],
  drink_stall: ['drink'],
  ice_cream_stall: ['food'],
  souvenir_shop: ['souvenir', 'hat', 'balloon'],
  info_kiosk: ['map'],
};

function getShopItem(shopType: CoasterBuildingType): GuestItem | null {
  const options = SHOP_ITEM_OPTIONS[shopType];
  if (!options || options.length === 0) return null;
  return options[Math.floor(Math.random() * options.length)] ?? null;
}

function getShopPrice(grid: CoasterTile[][], target: Guest['targetShop']): number {
  if (!target) return 0;
  const building = grid[target.position.y]?.[target.position.x]?.building;
  if (building) return building.price;
  return SHOP_EFFECTS[target.type]?.cost ?? 0;
}

function calculateParkRating(guests: Guest[], rides: number, cleanliness: number, sceneryScore: number): number {
  const averageHappiness = guests.length > 0
    ? guests.reduce((sum, guest) => sum + guest.happiness, 0) / guests.length
    : 180;
  const rideBonus = Math.min(160, rides * 12);
  const sceneryBonus = Math.min(120, sceneryScore * 0.4);
  return clamp(Math.round(averageHappiness * 0.7 + cleanliness * 0.2 + rideBonus + sceneryBonus), 0, 999);
}

function applyShopEffects(
  guest: Guest,
  shopType: CoasterBuildingType,
  priceOverride?: number,
  item?: GuestItem | null
): Guest {
  const effect = SHOP_EFFECTS[shopType];
  if (!effect) return guest;
  const cost = priceOverride ?? effect.cost ?? 0;
  const moneyDelta = shopType === 'atm'
    ? Math.max(0, ATM_TARGET_CASH - guest.money)
    : effect.moneyDelta ?? 0;
  const needs = {
    ...guest.needs,
    hunger: clamp(guest.needs.hunger + (effect.hunger ?? 0)),
    thirst: clamp(guest.needs.thirst + (effect.thirst ?? 0)),
    bathroom: clamp(guest.needs.bathroom + (effect.bathroom ?? 0)),
    nausea: clamp(guest.needs.nausea + (effect.nausea ?? 0)),
    energy: clamp(guest.needs.energy + (effect.energy ?? 0)),
  };
  const happiness = clamp(guest.happiness + (effect.happiness ?? 0));
  return {
    ...guest,
    needs: { ...needs, happiness },
    happiness,
    money: Math.max(0, guest.money - cost + moneyDelta),
    hasItem: item ?? guest.hasItem,
  };
}

function updateGuestMovement(guest: Guest, state: CoasterParkState): Guest {
  const grid = state.grid;
  const speed = 0.4;
  const nextAge = guest.age + 1;

  if (guest.path.length > 1 && guest.pathIndex < guest.path.length - 1) {
    const nextTarget = guest.path[guest.pathIndex + 1];
    const dx = nextTarget.x - guest.tileX;
    const dy = nextTarget.y - guest.tileY;
    const direction = dx > 0 ? 'east' : dx < 0 ? 'west' : dy > 0 ? 'south' : 'north';
    const nextTile = grid[nextTarget.y]?.[nextTarget.x];
    if (!nextTile?.path && guest.state !== 'leaving_park') {
      const waitTimer = guest.stateTimer + 1;
      if (waitTimer >= PATH_BLOCKED_WAIT) {
        return {
          ...guest,
          state: 'wandering',
          stateTimer: 0,
          targetRideId: null,
          targetShop: null,
          queueJoinTick: null,
          path: [],
          pathIndex: 0,
          progress: 0,
          age: nextAge,
        };
      }
      return { ...guest, stateTimer: waitTimer, direction, age: nextAge };
    }
  }

  if (guest.state === 'on_ride') {
    const nextTimer = guest.stateTimer - 1;
    if (nextTimer <= 0) {
      const ride = guest.currentRideId
        ? state.rides.find((item) => item.id === guest.currentRideId)
        : null;
      const exitAnchor = ride?.exit ?? { x: guest.tileX, y: guest.tileY };
      const exitOptions = [
        exitAnchor,
        ...((Object.keys(DIRECTION_VECTORS) as CardinalDirection[]).map((direction) => {
          const delta = DIRECTION_VECTORS[direction];
          return { x: exitAnchor.x + delta.dx, y: exitAnchor.y + delta.dy };
        })),
      ].filter((pos) => grid[pos.y]?.[pos.x]?.path);
      const fallbackOptions = (Object.keys(DIRECTION_VECTORS) as CardinalDirection[])
        .map((direction) => {
          const delta = DIRECTION_VECTORS[direction];
          return { x: guest.tileX + delta.dx, y: guest.tileY + delta.dy };
        })
        .filter((pos) => grid[pos.y]?.[pos.x]?.path);
      const availableExits = exitOptions.length > 0 ? exitOptions : fallbackOptions;
      const exitTile = availableExits.length > 0
        ? availableExits[Math.floor(Math.random() * availableExits.length)]
        : { x: guest.tileX, y: guest.tileY };
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

  if (guest.state === 'sitting') {
    const nextTimer = guest.stateTimer - 1;
    const energy = clamp(guest.needs.energy + BENCH_ENERGY_RECOVERY);
    const happiness = clamp(guest.happiness + BENCH_HAPPINESS_RECOVERY);
    const nextGuest = {
      ...guest,
      stateTimer: Math.max(0, nextTimer),
      needs: {
        ...guest.needs,
        energy,
        happiness,
      },
      happiness,
      age: nextAge,
    };
    if (nextTimer <= 0 || energy >= 230) {
      return {
        ...nextGuest,
        state: 'wandering',
        stateTimer: 0,
      };
    }
    return nextGuest;
  }

  if (guest.state === 'leaving_park' && guest.path.length <= 1) {
    return { ...guest, age: guest.maxAge + 1 };
  }

  if (guest.state === 'at_shop') {
    const target = guest.targetShop;
    const building = target ? grid[target.position.y]?.[target.position.x]?.building : null;
    if (!building || !building.open) {
      return {
        ...guest,
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
    const nextTimer = guest.stateTimer - 1;
    if (nextTimer <= 0) {
      const shopType = guest.targetShop?.type;
      const shopPrice = getShopPrice(grid, guest.targetShop);
      const shopItem = shopType ? getShopItem(shopType) : null;
      const updatedGuest = shopType ? applyShopEffects(guest, shopType, shopPrice, shopItem) : guest;
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
      return { ...guest, progress: nextProgress, direction, stateTimer: 0, age: nextAge };
    }
    const reachedEnd = guest.pathIndex + 1 >= guest.path.length - 1;
    if (reachedEnd && guest.state === 'leaving_park') {
      return {
        ...guest,
        tileX: nextTarget.x,
        tileY: nextTarget.y,
        direction,
        progress: 0,
        pathIndex: guest.pathIndex + 1,
        path: [],
        age: guest.maxAge + 1,
      };
    }

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

function updateStaffMovement(staff: Staff, grid: CoasterTile[][]): Staff {
  const nextFatigue = clamp(staff.fatigue + 0.12);
  const nextProgress = staff.progress + STAFF_SPEED;
  if (nextProgress < 1) {
    return { ...staff, progress: nextProgress, state: 'walking', fatigue: nextFatigue };
  }

  const currentTile = grid[staff.tileY]?.[staff.tileX];
  if (!currentTile?.path) {
    return { ...staff, progress: 0, state: 'idle', fatigue: nextFatigue };
  }

  const edges = currentTile.path.edges;
  const options = (Object.keys(edges) as CardinalDirection[]).filter((direction) => edges[direction]);
  if (options.length === 0) {
    return { ...staff, progress: 0, state: 'idle', fatigue: nextFatigue };
  }

  const patrolOptions = staff.patrolArea
    ? options.filter((direction) => {
      const vector = DIRECTION_VECTORS[direction];
      return isInBounds({ x: staff.tileX + vector.dx, y: staff.tileY + vector.dy }, staff.patrolArea);
    })
    : options;
  if (patrolOptions.length === 0) {
    return { ...staff, progress: 0, state: 'idle', fatigue: nextFatigue };
  }

  const preferredOptions = patrolOptions.filter((direction) => direction !== OPPOSITE_DIRECTION[staff.direction]);
  const choices = preferredOptions.length > 0 ? preferredOptions : patrolOptions;
  const nextDirection = choices[Math.floor(Math.random() * choices.length)];
  const vector = DIRECTION_VECTORS[nextDirection];
  const nextX = staff.tileX + vector.dx;
  const nextY = staff.tileY + vector.dy;
  if (!grid[nextY]?.[nextX]?.path) {
    return { ...staff, progress: 0, state: 'idle', fatigue: nextFatigue };
  }

  return {
    ...staff,
    tileX: nextX,
    tileY: nextY,
    direction: nextDirection,
    progress: 0,
    state: 'walking',
    fatigue: nextFatigue,
  };
}

function getStaffEfficiency(staff: Staff): number {
  return clampFloat(1 - staff.fatigue / 255, STAFF_MIN_EFFICIENCY, 1);
}

type ShopTarget = { position: { x: number; y: number }; type: CoasterBuildingType; price: number };
type SceneryTarget = { position: { x: number; y: number }; type: SceneryType };
type BenchTarget = { position: { x: number; y: number } };
type StaffRoomTarget = { position: { x: number; y: number } };
type TrashCanTarget = { position: { x: number; y: number } };

function findShopTargets(grid: CoasterTile[][]): ShopTarget[] {
  const targets: ShopTarget[] = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const building = grid[y][x].building;
      if (building && building.open) {
        targets.push({ position: { x, y }, type: building.type, price: building.price });
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
    if (target.price > guest.money) return;
    const distance = Math.abs(target.position.x - guest.tileX) + Math.abs(target.position.y - guest.tileY);
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = target;
    }
  });
  return closest;
}

function findSceneryTargets(grid: CoasterTile[][]): SceneryTarget[] {
  const targets: SceneryTarget[] = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const scenery = grid[y][x].scenery;
      if (scenery) {
        targets.push({ position: { x, y }, type: scenery.type });
      }
    }
  }
  return targets;
}

function findBenchTargets(grid: CoasterTile[][]): BenchTarget[] {
  const targets: BenchTarget[] = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const scenery = grid[y][x].scenery;
      if (scenery?.type === 'bench') {
        targets.push({ position: { x, y } });
      }
    }
  }
  return targets;
}

function findStaffRoomTargets(grid: CoasterTile[][]): StaffRoomTarget[] {
  const targets: StaffRoomTarget[] = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const building = grid[y][x].building;
      if (building?.type === 'staff_room') {
        targets.push({ position: { x, y } });
      }
    }
  }
  return targets;
}

function findTrashCanTargets(grid: CoasterTile[][]): TrashCanTarget[] {
  const targets: TrashCanTarget[] = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      if (grid[y][x].scenery?.type === 'trash_can') {
        targets.push({ position: { x, y } });
      }
    }
  }
  return targets;
}

function countSceneryType(grid: CoasterTile[][], type: SceneryType): number {
  let count = 0;
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      if (grid[y][x].scenery?.type === type) {
        count += 1;
      }
    }
  }
  return count;
}

function countLitter(grid: CoasterTile[][]): number {
  let count = 0;
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      count += grid[y][x].litter ?? 0;
    }
  }
  return count;
}

const SCENERY_EFFECTS: Record<SceneryType, { happiness: number; beauty: boolean }> = {
  tree: { happiness: 0.35, beauty: true },
  flower: { happiness: 0.45, beauty: true },
  shrub: { happiness: 0.3, beauty: true },
  bench: { happiness: 0.2, beauty: false },
  lamp: { happiness: 0.25, beauty: true },
  statue: { happiness: 0.6, beauty: true },
  fountain: { happiness: 0.7, beauty: true },
  trash_can: { happiness: 0.15, beauty: false },
  fence: { happiness: 0.1, beauty: false },
};

const SCENERY_RATING_WEIGHTS: Record<SceneryType, number> = {
  tree: 4,
  flower: 4,
  shrub: 3,
  bench: 2,
  lamp: 3,
  statue: 6,
  fountain: 7,
  trash_can: 1,
  fence: 1,
};

function getSceneryMoodBoost(
  guest: Guest,
  targets: SceneryTarget[],
  radius: number,
  isNight: boolean
): { boost: number; beauty: boolean } {
  let boost = 0;
  let beauty = false;
  targets.forEach((target) => {
    const distance = Math.abs(target.position.x - guest.tileX) + Math.abs(target.position.y - guest.tileY);
    if (distance > radius) return;
    const effect = SCENERY_EFFECTS[target.type];
    if (!effect) return;
    let happiness = effect.happiness;
    if (target.type === 'lamp' && isNight) {
      happiness += LAMP_NIGHT_BONUS;
    }
    if (happiness > boost) {
      boost = happiness;
    }
    if (effect.beauty) {
      beauty = true;
    }
  });
  return { boost, beauty };
}

export function calculateSceneryScore(grid: CoasterTile[][]): number {
  let score = 0;
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const type = grid[y][x].scenery?.type;
      if (!type) continue;
      score += SCENERY_RATING_WEIGHTS[type] ?? 0;
    }
  }
  return clamp(score, 0, 255);
}

function isBenchNearby(guest: Guest, targets: BenchTarget[], radius: number): boolean {
  return targets.some((target) => (
    Math.abs(target.position.x - guest.tileX) + Math.abs(target.position.y - guest.tileY) <= radius
  ));
}

function isStaffRoomNearby(staff: Staff, targets: StaffRoomTarget[], radius: number): boolean {
  return targets.some((target) => (
    Math.abs(target.position.x - staff.tileX) + Math.abs(target.position.y - staff.tileY) <= radius
  ));
}

function isTrashCanNearby(guest: Guest, targets: TrashCanTarget[], radius: number): boolean {
  return targets.some((target) => (
    Math.abs(target.position.x - guest.tileX) + Math.abs(target.position.y - guest.tileY) <= radius
  ));
}

function applySceneryMood(guest: Guest, boost: number): Guest {
  const happiness = clamp(guest.happiness + boost);
  if (happiness === guest.happiness) return guest;
  return {
    ...guest,
    happiness,
    needs: {
      ...guest.needs,
      happiness,
    },
  };
}

function findRideAccessTile(ride: CoasterParkState['rides'][number], grid: CoasterTile[][]): { x: number; y: number } | null {
  const queueEntry = ride.queue.entry;
  const queuePath = grid[queueEntry.y]?.[queueEntry.x]?.path;
  const queueConnected = queuePath?.isQueue && Object.values(queuePath.edges).some(Boolean);
  if (queueConnected) {
    return queueEntry;
  }

  const { x: rideX, y: rideY } = ride.position;
  const { width, height } = ride.size;
  const candidates: { x: number; y: number }[] = [];
  for (let dx = 0; dx < width; dx++) {
    candidates.push({ x: rideX + dx, y: rideY - 1 });
    candidates.push({ x: rideX + dx, y: rideY + height });
  }
  for (let dy = 0; dy < height; dy++) {
    candidates.push({ x: rideX - 1, y: rideY + dy });
    candidates.push({ x: rideX + width, y: rideY + dy });
  }
  const accessTile = candidates.find((pos) => grid[pos.y]?.[pos.x]?.path);
  return accessTile ?? ride.entrance;
}

function findQueueJoinTile(
  ride: CoasterParkState['rides'][number],
  grid: CoasterTile[][],
  queueLength: number
): GridPosition | null {
  const queueEntry = ride.queue.entry;
  const queuePath = grid[queueEntry.y]?.[queueEntry.x]?.path;
  const queueConnected = queuePath?.isQueue && Object.values(queuePath.edges).some(Boolean);
  if (!queueConnected) return null;
  const queueTiles = buildQueuePathOrder(grid, ride.id, queueEntry);
  if (queueTiles.length === 0) return queueEntry;
  const tileIndex = Math.min(queueTiles.length - 1, Math.floor(queueLength / QUEUE_GUESTS_PER_TILE));
  return queueTiles[tileIndex];
}

function buildQueuePathOrder(
  grid: CoasterTile[][],
  rideId: string,
  entry: GridPosition
): GridPosition[] {
  const startTile = grid[entry.y]?.[entry.x]?.path;
  if (!startTile?.isQueue || startTile.queueRideId !== rideId) return [];

  const visited = new Set<string>();
  const queue: Array<{ pos: GridPosition; distance: number }> = [{ pos: entry, distance: 0 }];
  const ordered: Array<{ pos: GridPosition; distance: number }> = [];
  const directionOrder: CardinalDirection[] = ['north', 'east', 'south', 'west'];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const key = `${current.pos.x},${current.pos.y}`;
    if (visited.has(key)) continue;
    visited.add(key);
    ordered.push(current);

    const path = grid[current.pos.y]?.[current.pos.x]?.path;
    if (!path?.isQueue || path.queueRideId !== rideId) continue;
    directionOrder.forEach((direction) => {
      if (!path.edges[direction]) return;
      const delta = DIRECTION_VECTORS[direction];
      const next = { x: current.pos.x + delta.dx, y: current.pos.y + delta.dy };
      const nextPath = grid[next.y]?.[next.x]?.path;
      if (!nextPath?.isQueue || nextPath.queueRideId !== rideId) return;
      if (!nextPath.edges[OPPOSITE_DIRECTION[direction]]) return;
      queue.push({ pos: next, distance: current.distance + 1 });
    });
  }

  return ordered
    .sort((a, b) => a.distance - b.distance || a.pos.y - b.pos.y || a.pos.x - b.pos.x)
    .map((entry) => entry.pos);
}

function isStaffNearby(guest: Guest, staffMembers: Staff[], radius: number): boolean {
  return staffMembers.some((member) => (
    Math.abs(member.tileX - guest.tileX) + Math.abs(member.tileY - guest.tileY) <= radius
  ));
}

function applyStaffMoodEffects(guest: Guest, entertainers: Staff[], securityStaff: Staff[]): Guest {
  let happiness = guest.happiness;
  let nausea = guest.needs.nausea;

  if (entertainers.length > 0 && isStaffNearby(guest, entertainers, ENTERTAINER_RADIUS)) {
    happiness = clamp(happiness + 0.6);
  }

  if (securityStaff.length > 0 && isStaffNearby(guest, securityStaff, SECURITY_RADIUS)) {
    happiness = clamp(happiness + 0.3);
    nausea = clamp(nausea - 0.5);
  }

  if (happiness === guest.happiness && nausea === guest.needs.nausea) {
    return guest;
  }

  return {
    ...guest,
    happiness,
    needs: {
      ...guest.needs,
      happiness,
      nausea,
    },
  };
}

function calculateQueueCapacities(state: CoasterParkState): Map<string, number> {
  const queueTileCounts = new Map<string, number>();
  for (let y = 0; y < state.grid.length; y++) {
    for (let x = 0; x < state.grid[y].length; x++) {
      const path = state.grid[y][x].path;
      if (!path?.isQueue || !path.queueRideId) continue;
      queueTileCounts.set(path.queueRideId, (queueTileCounts.get(path.queueRideId) ?? 0) + 1);
    }
  }

  const queueCapacities = new Map<string, number>();
  state.rides.forEach((ride) => {
    const tileCount = queueTileCounts.get(ride.id) ?? 0;
    if (tileCount === 0) {
      queueCapacities.set(ride.id, DEFAULT_QUEUE_LENGTH);
      return;
    }
    const capacity = Math.max(MIN_QUEUE_LENGTH, Math.min(MAX_QUEUE_LENGTH, tileCount * QUEUE_GUESTS_PER_TILE));
    queueCapacities.set(ride.id, capacity);
  });
  return queueCapacities;
}

function getGuestThoughtCandidate(
  guest: Guest,
  tick: number,
  entranceFee: number,
  sceneryNearby: boolean,
  messyNearby: boolean
): { type: GuestThoughtType; message: string } | null {
  if (guest.state === 'queuing' && guest.queueJoinTick !== null && tick - guest.queueJoinTick > QUEUE_THOUGHT_TICKS) {
    return { type: 'warning', message: 'This line is taking forever.' };
  }
  if (messyNearby) {
    return { type: 'negative', message: 'This place is messy.' };
  }
  if (guest.state === 'sitting') {
    return { type: 'neutral', message: 'Taking a quick break.' };
  }
  if (guest.needs.bathroom < 60) {
    return { type: 'warning', message: 'Need a restroom soon.' };
  }
  if (guest.needs.hunger < 70) {
    return { type: 'negative', message: 'I am feeling hungry.' };
  }
  if (guest.needs.thirst < 70) {
    return { type: 'negative', message: 'I could use a drink.' };
  }
  if (guest.needs.energy < 60) {
    return { type: 'neutral', message: 'I need to rest a bit.' };
  }
  if (guest.state === 'on_ride') {
    return { type: 'positive', message: 'This ride is fun!' };
  }
  if (sceneryNearby) {
    return { type: 'positive', message: 'The park looks beautiful.' };
  }
  if (entranceFee >= 15 && guest.age < 120) {
    return { type: 'negative', message: 'That entrance fee was steep.' };
  }
  if (guest.happiness < 90) {
    return { type: 'negative', message: 'This park is boring.' };
  }
  if (guest.happiness >= 170) {
    return { type: 'positive', message: 'Great day at the park!' };
  }
  return null;
}

function updateGuestThoughts(
  guest: Guest,
  tick: number,
  entranceFee: number,
  sceneryNearby: boolean,
  messyNearby: boolean
): Guest {
  const candidate = getGuestThoughtCandidate(guest, tick, entranceFee, sceneryNearby, messyNearby);
  if (!candidate) return guest;
  const lastThought = guest.thoughts[0];
  if (lastThought && lastThought.message === candidate.message && tick - lastThought.timestamp < THOUGHT_COOLDOWN) {
    return guest;
  }
  const nextThought = {
    id: `thought-${guest.id}-${tick}`,
    type: candidate.type,
    message: candidate.message,
    timestamp: tick,
  };
  return {
    ...guest,
    thoughts: [nextThought, ...guest.thoughts].slice(0, MAX_THOUGHTS),
  };
}

function shouldGuestLeavePark(guest: Guest, canUseATM: boolean): boolean {
  const lowMoney = guest.money <= LEAVE_PARK_MONEY && !canUseATM;
  return lowMoney
    || guest.happiness < LEAVE_PARK_HAPPINESS
    || guest.needs.energy < LEAVE_PARK_ENERGY
    || guest.needs.hunger < LEAVE_PARK_NEED
    || guest.needs.thirst < LEAVE_PARK_NEED
    || guest.needs.bathroom < LEAVE_PARK_NEED;
}

function applyQueuePatience(guest: Guest, tick: number): Guest {
  if (guest.state !== 'queuing' || guest.queueJoinTick === null) return guest;
  const waitTicks = tick - guest.queueJoinTick;
  if (waitTicks < QUEUE_PATIENCE_START) return guest;
  const penalty = waitTicks >= QUEUE_PATIENCE_HIGH
    ? QUEUE_PATIENCE_HIGH_PENALTY
    : waitTicks >= QUEUE_PATIENCE_MEDIUM
      ? QUEUE_PATIENCE_MEDIUM_PENALTY
      : QUEUE_PATIENCE_LOW_PENALTY;
  const happiness = clamp(guest.happiness - penalty);
  if (happiness === guest.happiness) return guest;
  return {
    ...guest,
    happiness,
    needs: {
      ...guest.needs,
      happiness,
    },
  };
}

function updateResearch(state: CoasterParkState): CoasterParkState {
  const { activeResearchId, funding, items } = state.research;
  if (!activeResearchId || funding <= 0) return state;
  const researchCost = Math.round(funding * RESEARCH_COST_RATE);
  if (researchCost > 0 && state.finance.cash < researchCost) {
    return state;
  }
  const researchBoost = researchCost > 0
    ? 1 + (researchCost / 1000) * RESEARCH_RATE_MULTIPLIER
    : 1;
  const updatedItems = items.map((item) => {
    if (item.id !== activeResearchId || item.unlocked) return item;
    const nextProgress = Math.min(item.cost, item.progress + funding * RESEARCH_RATE * researchBoost);
    return {
      ...item,
      progress: nextProgress,
      unlocked: nextProgress >= item.cost,
    };
  });

  const activeItem = updatedItems.find((item) => item.id === activeResearchId);
  const nextActiveId = activeItem && !activeItem.unlocked ? activeResearchId : null;
  return {
    ...state,
    finance: researchCost > 0 ? {
      ...state.finance,
      cash: state.finance.cash - researchCost,
      researchCost: state.finance.researchCost + researchCost,
      expenses: state.finance.expenses + researchCost,
    } : state.finance,
    research: {
      ...state.research,
      activeResearchId: nextActiveId,
      items: updatedItems,
    },
  };
}

function updateStaff(state: CoasterParkState): CoasterParkState {
  let grid = state.grid;
  const updateGridTile = (tileX: number, tileY: number, updates: Partial<CoasterTile>) => {
    if (!grid[tileY] || !grid[tileY][tileX]) return;
    if (grid === state.grid) {
      grid = state.grid.map((row) => row.slice());
    }
    const row = grid[tileY].slice();
    row[tileX] = { ...grid[tileY][tileX], ...updates };
    grid[tileY] = row;
  };

  const movedStaff = state.staff.map((member) => updateStaffMovement(member, grid));
  const staffRooms = findStaffRoomTargets(grid);
  const updatedStaff = movedStaff.map((member) => {
    let fatigue = clamp(member.fatigue - STAFF_FATIGUE_DECAY);
    if (staffRooms.length > 0 && isStaffRoomNearby(member, staffRooms, STAFF_ROOM_RADIUS)) {
      fatigue = clamp(fatigue - STAFF_ROOM_RECOVERY);
    }
    const currentTile = grid[member.tileY]?.[member.tileX];
    if (currentTile?.path && (currentTile.litter ?? 0) > 0) {
      updateGridTile(member.tileX, member.tileY, { litter: Math.max(0, (currentTile.litter ?? 0) - 1) });
    }
    if (fatigue === member.fatigue) return member;
    return { ...member, fatigue };
  });
  const handymanEffort = updatedStaff
    .filter((member) => member.type === 'handyman')
    .reduce((sum, member) => sum + getStaffEfficiency(member), 0);
  const mechanicEffort = updatedStaff
    .filter((member) => member.type === 'mechanic')
    .reduce((sum, member) => sum + getStaffEfficiency(member), 0);
  const mechanicCount = updatedStaff.filter((member) => member.type === 'mechanic').length;
  const cleanlinessDecay = state.guests.length * CLEANLINESS_DECAY_PER_GUEST;
  const trashCanCount = countSceneryType(state.grid, 'trash_can');
  const litterCount = countLitter(grid);
  const litterPenalty = litterCount * LITTER_CLEANLINESS_PENALTY;
  const cleanlinessBoost = handymanEffort * HANDYMAN_CLEANLINESS_BOOST
    + trashCanCount * TRASH_CAN_CLEANLINESS_BOOST;
  const nextCleanliness = clamp(state.stats.cleanliness - cleanlinessDecay - litterPenalty + cleanlinessBoost);

  const mechanicBoost = mechanicEffort * MECHANIC_UPTIME_BOOST;
  const isStormy = state.weather.type === 'stormy';
  let maintenanceCost = 0;
  const updatedRides = state.rides.map((ride) => {
    const nextAge = ride.age + 1;
    let status = ride.status;
    let cycleTimer = ride.cycleTimer;
    let lastBreakdownTick = ride.stats.lastBreakdownTick;
    let weatherClosed = ride.weatherClosed;

    if (status === 'broken' && mechanicCount > 0 && lastBreakdownTick !== null) {
      if (state.tick - lastBreakdownTick >= REPAIR_TICKS) {
        status = 'open';
        lastBreakdownTick = state.tick;
        maintenanceCost += MAINTENANCE_BASE_COST;
      }
    }

    if (status === 'open' && nextAge > 0 && nextAge % BREAKDOWN_INTERVAL_TICKS === 0) {
      status = 'broken';
      cycleTimer = 0;
      lastBreakdownTick = state.tick;
    }

    if (status === 'broken') {
      weatherClosed = false;
    }

    if (isStormy) {
      if (status === 'open') {
        status = 'closed';
        cycleTimer = 0;
        weatherClosed = true;
      }
    } else if (weatherClosed && status === 'closed') {
      status = 'open';
      weatherClosed = false;
    }

    const wear = status === 'open' ? RIDE_UPTIME_DECAY : RIDE_UPTIME_DECAY * 0.2;
    const uptime = clampFloat(ride.stats.uptime - wear + mechanicBoost, 0.6, 1);
    const reliability = clampFloat(ride.stats.reliability - wear * 0.6 + mechanicBoost * 0.8, 0.6, 1);

    return {
      ...ride,
      age: nextAge,
      status,
      cycleTimer,
      weatherClosed,
      stats: {
        ...ride.stats,
        uptime,
        reliability,
        lastBreakdownTick,
      },
    };
  });

  const payrollDue = updatedStaff.length > 0
    && state.hour === 0
    && state.tick % 60 === 0
    && state.day % PAYROLL_INTERVAL_DAYS === 0;
  let finance = state.finance;
  if (payrollDue) {
    const payrollTotal = updatedStaff.reduce((sum, member) => sum + member.wage, 0);
    if (payrollTotal > 0) {
      finance = {
        ...state.finance,
        cash: state.finance.cash - payrollTotal,
        staffCost: state.finance.staffCost + payrollTotal,
        expenses: state.finance.expenses + payrollTotal,
      };
    }
  }
  if (maintenanceCost > 0) {
    finance = {
      ...finance,
      cash: finance.cash - maintenanceCost,
      maintenanceCost: finance.maintenanceCost + maintenanceCost,
      expenses: finance.expenses + maintenanceCost,
    };
  }

  return {
    ...state,
    grid,
    staff: updatedStaff,
    rides: updatedRides,
    finance,
    stats: {
      ...state.stats,
      cleanliness: nextCleanliness,
    },
  };
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
  nextGuests = nextGuests.map((guest) => applyWeatherMood(guest, state.weather));
  nextGuests = nextGuests.map((guest) => updateGuestMovement(guest, state));
  let grid = state.grid;
  const updateGridTile = (tileX: number, tileY: number, updates: Partial<CoasterTile>) => {
    if (!grid[tileY] || !grid[tileY][tileX]) return;
    if (grid === state.grid) {
      grid = state.grid.map((row) => row.slice());
    }
    const row = grid[tileY].slice();
    row[tileX] = { ...grid[tileY][tileX], ...updates };
    grid[tileY] = row;
  };

  const trashCanTargets = findTrashCanTargets(grid);
  nextGuests = nextGuests.map((guest) => {
    const tile = grid[guest.tileY]?.[guest.tileX];
    const canDrop = guest.hasItem === 'food' || guest.hasItem === 'drink';
    if (!tile?.path || !canDrop) return guest;
    const litter = tile.litter ?? 0;
    if (litter >= LITTER_MAX) return guest;
    const trashNearby = trashCanTargets.length > 0 && isTrashCanNearby(guest, trashCanTargets, TRASH_CAN_RADIUS);
    if (trashNearby && Math.random() < TRASH_CAN_USE_CHANCE) {
      return { ...guest, hasItem: null };
    }
    const dropChance = trashNearby ? LITTER_DROP_CHANCE * TRASH_CAN_LITTER_MULTIPLIER : LITTER_DROP_CHANCE;
    if (Math.random() > dropChance) return guest;
    updateGridTile(guest.tileX, guest.tileY, { litter: litter + 1 });
    return { ...guest, hasItem: null };
  });
  nextGuests = nextGuests.map((guest) => {
    if ((guest.state === 'heading_to_shop' || guest.state === 'at_shop') && guest.targetShop) {
      const building = state.grid[guest.targetShop.position.y]?.[guest.targetShop.position.x]?.building;
      if (!building || !building.open) {
        return {
          ...guest,
          state: 'wandering',
          stateTimer: 0,
          targetShop: null,
          queueJoinTick: null,
          path: [],
          pathIndex: 0,
          progress: 0,
        };
      }
    }
    return guest;
  });
  nextGuests = nextGuests.filter((guest) => guest.age < guest.maxAge);
  let totalGuests = state.stats.totalGuests;

  const benchTargets = findBenchTargets(state.grid);
  if (benchTargets.length > 0) {
    nextGuests = nextGuests.map((guest) => {
      if (guest.state === 'on_ride' || guest.state === 'at_shop' || guest.state === 'queuing' || guest.state === 'sitting' || guest.state === 'leaving_park') {
        return guest;
      }
      if (guest.needs.energy >= BENCH_REST_THRESHOLD) return guest;
      if (!isBenchNearby(guest, benchTargets, BENCH_REST_RADIUS)) return guest;
      return {
        ...guest,
        state: 'sitting',
        stateTimer: BENCH_REST_TICKS,
        targetRideId: null,
        targetShop: null,
        path: [],
        pathIndex: 0,
        progress: 0,
      };
    });
  }

  const shopTargets = findShopTargets(state.grid);
  const atmTargets = shopTargets.filter((target) => target.type === 'atm');

  const entertainers = state.staff.filter((member) => member.type === 'entertainer');
  const securityStaff = state.staff.filter((member) => member.type === 'security');
  nextGuests = nextGuests.map((guest) => applyQueuePatience(guest, state.tick));

  if (entertainers.length > 0 || securityStaff.length > 0) {
    nextGuests = nextGuests.map((guest) => applyStaffMoodEffects(guest, entertainers, securityStaff));
  }

  const sceneryTargets = findSceneryTargets(grid);
  const isNight = state.hour >= 19 || state.hour < 6;
  if (sceneryTargets.length > 0) {
    nextGuests = nextGuests.map((guest) => {
      const { boost, beauty } = getSceneryMoodBoost(guest, sceneryTargets, SCENERY_RADIUS, isNight);
      const boostedGuest = boost > 0 ? applySceneryMood(guest, boost) : guest;
      const messyNearby = (grid[guest.tileY]?.[guest.tileX]?.litter ?? 0) > 0;
      const thoughtGuest = updateGuestThoughts(boostedGuest, state.tick, state.finance.entranceFee, beauty, messyNearby);
      if (!messyNearby) return thoughtGuest;
      const happiness = clamp(thoughtGuest.happiness - LITTER_HAPPINESS_PENALTY);
      if (happiness === thoughtGuest.happiness) return thoughtGuest;
      return {
        ...thoughtGuest,
        happiness,
        needs: {
          ...thoughtGuest.needs,
          happiness,
        },
      };
    });
  } else {
    nextGuests = nextGuests.map((guest) => {
      const messyNearby = (grid[guest.tileY]?.[guest.tileX]?.litter ?? 0) > 0;
      const thoughtGuest = updateGuestThoughts(guest, state.tick, state.finance.entranceFee, false, messyNearby);
      if (!messyNearby) return thoughtGuest;
      const happiness = clamp(thoughtGuest.happiness - LITTER_HAPPINESS_PENALTY);
      if (happiness === thoughtGuest.happiness) return thoughtGuest;
      return {
        ...thoughtGuest,
        happiness,
        needs: {
          ...thoughtGuest.needs,
          happiness,
        },
      };
    });
  }

  nextGuests = nextGuests.map((guest) => {
    if (guest.state !== 'queuing' || guest.queueJoinTick === null) return guest;
    const waitTicks = state.tick - guest.queueJoinTick;
    if (waitTicks < LEAVE_QUEUE_TICKS || guest.happiness >= LEAVE_QUEUE_HAPPINESS) return guest;
    return {
      ...guest,
      state: 'wandering',
      targetRideId: null,
      queueJoinTick: null,
      path: [],
      pathIndex: 0,
      progress: 0,
    };
  });

  const exitTarget = state.grid[state.parkExit.y]?.[state.parkExit.x]?.path
    ? state.parkExit
    : state.parkEntrance;
  nextGuests = nextGuests.map((guest) => {
    if (guest.state === 'leaving_park' || guest.state === 'on_ride' || guest.state === 'at_shop') return guest;
    const canUseATM = atmTargets.some((target) => target.price <= guest.money);
    if (!shouldGuestLeavePark(guest, canUseATM)) return guest;
    const path = findPath({ x: guest.tileX, y: guest.tileY }, exitTarget, state.grid);
    if (!path || path.length < 2) {
      return { ...guest, age: guest.maxAge + 1 };
    }
    return {
      ...guest,
      state: 'leaving_park',
      targetRideId: null,
      targetShop: null,
      queueJoinTick: null,
      path,
      pathIndex: 0,
      progress: 0,
    };
  });

  const queueCapacityByRide = calculateQueueCapacities(state);
  const queueCounts = new Map<string, number>();
  nextGuests.forEach((guest) => {
    if ((guest.state === 'queuing' || guest.state === 'heading_to_ride') && guest.targetRideId) {
      queueCounts.set(guest.targetRideId, (queueCounts.get(guest.targetRideId) ?? 0) + 1);
    }
  });


  nextGuests = nextGuests.map((guest) => {
    if ((guest.state === 'queuing' || guest.state === 'heading_to_ride') && guest.targetRideId) {
      const ride = state.rides.find((item) => item.id === guest.targetRideId);
      if (!ride || ride.status !== 'open') {
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

  if (shopTargets.length > 0) {
    nextGuests = nextGuests.map((guest) => {
      if (guest.state !== 'wandering' || guest.targetRideId || guest.targetShop) return guest;
      if (guest.money <= ATM_VISIT_THRESHOLD) {
        const shop = findClosestShop(guest, shopTargets, ['atm']);
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
      if (guest.needs.nausea > 110) {
        const shop = findClosestShop(guest, shopTargets, ['first_aid']);
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
      if (!guest.hasItem && guest.money >= 2 && Math.random() < 0.03) {
        const shop = findClosestShop(guest, shopTargets, ['info_kiosk']);
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
      if (guest.happiness > 140 && guest.money >= 6 && Math.random() < 0.02) {
        const shop = findClosestShop(guest, shopTargets, ['souvenir_shop']);
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
      const rideOptions = availableRides.filter((ride) => {
        if (ride.price > guest.money) return false;
        const capacity = queueCapacityByRide.get(ride.id) ?? ride.queue.maxLength;
        return (queueCounts.get(ride.id) ?? 0) < capacity;
      });
      if (rideOptions.length === 0) return guest;
      const weightedRides = rideOptions.map((ride) => {
        const queueLength = queueCounts.get(ride.id) ?? ride.queue.guestIds.length;
        const waitMinutes = estimateQueueWaitMinutes(queueLength, ride.stats.rideTime, getRideDispatchCapacity(ride));
        const excitementBoost = Math.max(1, ride.excitement / 15);
        const weight = excitementBoost / (1 + waitMinutes);
        return { ride, weight };
      });
      const totalWeight = weightedRides.reduce((sum, item) => sum + item.weight, 0);
      let roll = Math.random() * totalWeight;
      let ride = weightedRides[0].ride;
      for (const option of weightedRides) {
        roll -= option.weight;
        if (roll <= 0) {
          ride = option.ride;
          break;
        }
      }
      const queueLength = queueCounts.get(ride.id) ?? ride.queue.guestIds.length;
      const queueJoinTile = findQueueJoinTile(ride, state.grid, queueLength);
      const accessTile = queueJoinTile ?? findRideAccessTile(ride, state.grid);
      if (!accessTile) return guest;
      const path = findPath({ x: guest.tileX, y: guest.tileY }, accessTile, state.grid);
      if (!path || path.length < 2) return guest;
      queueCounts.set(ride.id, (queueCounts.get(ride.id) ?? 0) + 1);
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
  const guestUpdates = new Map<number, Partial<Guest>>();
  queueMap.forEach((queueGuests, rideId) => {
    const ride = state.rides.find((item) => item.id === rideId);
    let filteredGuests = queueGuests;
    if (ride) {
      const affordableGuests = queueGuests.filter((guest) => guest.money >= ride.price);
      if (affordableGuests.length !== queueGuests.length) {
        queueGuests.forEach((guest) => {
          if (guest.money >= ride.price) return;
          guestUpdates.set(guest.id, {
            state: 'wandering',
            targetRideId: null,
            queueJoinTick: null,
            path: [],
            pathIndex: 0,
          });
        });
        filteredGuests = affordableGuests;
      }
    }
    filteredGuests.sort((a, b) => (a.queueJoinTick ?? 0) - (b.queueJoinTick ?? 0));
    const maxLength = queueCapacityByRide.get(rideId)
      ?? state.rides.find((ride) => ride.id === rideId)?.queue.maxLength
      ?? DEFAULT_QUEUE_LENGTH;
    if (filteredGuests.length > maxLength) {
      const overflow = filteredGuests.slice(maxLength);
      overflow.forEach((guest) => {
        guestUpdates.set(guest.id, {
          state: 'wandering',
          targetRideId: null,
          queueJoinTick: null,
          path: [],
          pathIndex: 0,
        });
      });
      queueMap.set(rideId, filteredGuests.slice(0, maxLength));
    } else {
      queueMap.set(rideId, filteredGuests);
    }
  });

  queueMap.forEach((queueGuests, rideId) => {
    const ride = state.rides.find((item) => item.id === rideId);
    if (!ride) return;
    const queueTiles = buildQueuePathOrder(state.grid, rideId, ride.queue.entry);
    if (queueTiles.length === 0) return;
    queueGuests.forEach((guest, index) => {
      const tileIndex = Math.floor(index / QUEUE_GUESTS_PER_TILE);
      const tile = queueTiles[Math.min(tileIndex, queueTiles.length - 1)];
      guestUpdates.set(guest.id, {
        tileX: tile.x,
        tileY: tile.y,
        progress: 0,
      });
    });
  });

  let updatedRides = state.rides.map((ride) => ({
    ...ride,
    queue: {
      ...ride.queue,
      guestIds: (queueMap.get(ride.id) ?? []).map((guest) => guest.id),
      maxLength: queueCapacityByRide.get(ride.id) ?? ride.queue.maxLength,
    },
  }));
  let rideRevenue = 0;
  let entranceRevenue = 0;
  updatedRides = updatedRides.map((ride) => {
    if (ride.status !== 'open') {
      return { ...ride, cycleTimer: 0 };
    }
    const queueGuests = queueMap.get(ride.id) ?? [];
    const cycleTicks = Math.max(10, Math.round(ride.stats.rideTime));
    const nextTimer = Math.max(0, ride.cycleTimer - 1);
    if (nextTimer > 0 || queueGuests.length === 0) {
      return { ...ride, cycleTimer: nextTimer };
    }

    const dispatchCapacity = getRideDispatchCapacity(ride);
    const dispatchCount = Math.min(dispatchCapacity, queueGuests.length);
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
      shopRevenue += getShopPrice(grid, guest.targetShop);
    });
  }

  const sceneryScore = calculateSceneryScore(grid);

  const spawnInterval = getGuestSpawnInterval(state);
  if (state.tick % spawnInterval === 0 && nextGuests.length < MAX_GUESTS) {
    const entranceTile = state.grid[state.parkEntrance.y]?.[state.parkEntrance.x];
    if (entranceTile?.path) {
      const nextId = state.guests.length > 0 ? Math.max(...state.guests.map((g) => g.id)) + 1 : 1;
      const newGuest = createGuest(nextId, state.parkEntrance.x, state.parkEntrance.y, state.finance.entranceFee);
      const entranceFee = state.finance.entranceFee;
      const adjustedGuest = {
        ...newGuest,
        money: Math.max(0, newGuest.money - entranceFee),
      };
      entranceRevenue += entranceFee;
      nextGuests = [...nextGuests, adjustedGuest];
      totalGuests += 1;
    }
  }

  return {
    ...state,
    guests: nextGuests,
    grid,
    rides: updatedRides,
    finance: rideRevenue > 0 || shopRevenue > 0 || entranceRevenue > 0 ? {
      ...state.finance,
      cash: state.finance.cash + rideRevenue + shopRevenue + entranceRevenue,
      entranceRevenue: state.finance.entranceRevenue + entranceRevenue,
      rideRevenue: state.finance.rideRevenue + rideRevenue,
      shopRevenue: state.finance.shopRevenue + shopRevenue,
      income: state.finance.income + rideRevenue + shopRevenue + entranceRevenue,
    } : state.finance,
    stats: {
      ...state.stats,
      guestsInPark: nextGuests.length,
      totalGuests,
      rating: calculateParkRating(nextGuests, updatedRides.length, state.stats.cleanliness, sceneryScore),
      scenery: sceneryScore,
      litter: countLitter(grid),
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
    scenery: 0,
    litter: 0,
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
    entranceRevenue: 0,
    rideRevenue: 0,
    shopRevenue: 0,
    staffCost: 0,
    maintenanceCost: 0,
    researchCost: 0,
    loanInterestCost: 0,
    transactions: [],
  };
}

function createDefaultResearch(): Research {
  return {
    activeResearchId: null,
    funding: 0.2,
    items: createResearchItems(),
  };
}

function createDefaultWeather(): WeatherState {
  return createWeather('sunny');
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
  let { hour, day, month, year, weather } = state;
  let finance = state.finance;

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
    if (hour % WEATHER_CHANGE_HOURS === 0) {
      weather = getNextWeather(weather);
    }
    if (hour % LOAN_INTEREST_HOUR === 0 && finance.loan > 0) {
      const interest = Math.round(finance.loan * finance.loanInterestRate);
      finance = {
        ...finance,
        cash: finance.cash - interest,
        loanInterestCost: finance.loanInterestCost + interest,
        expenses: finance.expenses + interest,
      };
    }
  }

  const nextState: CoasterParkState = {
    ...state,
    tick: nextTick,
    hour,
    day,
    month,
    year,
    weather,
    finance,
  };

  const withResearch = updateResearch(nextState);
  const withStaff = updateStaff(withResearch);
  const withGuests = updateGuests(withStaff);
  return updateTrains(withGuests);
}
