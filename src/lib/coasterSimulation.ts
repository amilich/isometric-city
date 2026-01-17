import { CardinalDirection, isInBounds } from '@/core/types';
import { CoasterBuildingType, CoasterParkState, CoasterTile, Finance, Guest, GuestThoughtType, ParkStats, PathInfo, Research, Staff, WeatherState, WeatherType } from '@/games/coaster/types';
import { findPath } from '@/lib/coasterPathfinding';
import { estimateQueueWaitMinutes, getRideDispatchCapacity } from '@/lib/coasterQueue';
import { msg } from 'gt-next';

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
const STAFF_SPEED = 0.32;
const CLEANLINESS_DECAY_PER_GUEST = 0.006;
const HANDYMAN_CLEANLINESS_BOOST = 0.25;
const ENTERTAINER_RADIUS = 4;
const SECURITY_RADIUS = 3;
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

  if (guest.state === 'leaving_park' && guest.path.length <= 1) {
    return { ...guest, age: guest.maxAge + 1 };
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
  entranceFee: number
): { type: GuestThoughtType; message: string } | null {
  if (guest.state === 'queuing' && guest.queueJoinTick !== null && tick - guest.queueJoinTick > QUEUE_THOUGHT_TICKS) {
    return { type: 'warning', message: msg('This line is taking forever.') };
  }
  if (guest.needs.bathroom < 60) {
    return { type: 'warning', message: msg('Need a restroom soon.') };
  }
  if (guest.needs.hunger < 70) {
    return { type: 'negative', message: msg('I am feeling hungry.') };
  }
  if (guest.needs.thirst < 70) {
    return { type: 'negative', message: msg('I could use a drink.') };
  }
  if (guest.needs.energy < 60) {
    return { type: 'neutral', message: msg('I need to rest a bit.') };
  }
  if (guest.state === 'on_ride') {
    return { type: 'positive', message: msg('This ride is fun!') };
  }
  if (entranceFee >= 15 && guest.age < 120) {
    return { type: 'negative', message: msg('That entrance fee was steep.') };
  }
  if (guest.happiness < 90) {
    return { type: 'negative', message: msg('This park is boring.') };
  }
  if (guest.happiness >= 170) {
    return { type: 'positive', message: msg('Great day at the park!') };
  }
  return null;
}

function updateGuestThoughts(guest: Guest, tick: number, entranceFee: number): Guest {
  const candidate = getGuestThoughtCandidate(guest, tick, entranceFee);
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

function shouldGuestLeavePark(guest: Guest): boolean {
  return guest.money <= LEAVE_PARK_MONEY
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

function updateStaff(state: CoasterParkState): CoasterParkState {
  const updatedStaff = state.staff.map((member) => updateStaffMovement(member, state.grid));
  const handymanCount = updatedStaff.filter((member) => member.type === 'handyman').length;
  const mechanicCount = updatedStaff.filter((member) => member.type === 'mechanic').length;
  const cleanlinessDecay = state.guests.length * CLEANLINESS_DECAY_PER_GUEST;
  const cleanlinessBoost = handymanCount * HANDYMAN_CLEANLINESS_BOOST;
  const nextCleanliness = clamp(state.stats.cleanliness - cleanlinessDecay + cleanlinessBoost);

  const mechanicBoost = mechanicCount * MECHANIC_UPTIME_BOOST;
  let maintenanceCost = 0;
  const updatedRides = state.rides.map((ride) => {
    const nextAge = ride.age + 1;
    let status = ride.status;
    let cycleTimer = ride.cycleTimer;
    let lastBreakdownTick = ride.stats.lastBreakdownTick;

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

    const wear = status === 'open' ? RIDE_UPTIME_DECAY : RIDE_UPTIME_DECAY * 0.2;
    const uptime = clampFloat(ride.stats.uptime - wear + mechanicBoost, 0.6, 1);
    const reliability = clampFloat(ride.stats.reliability - wear * 0.6 + mechanicBoost * 0.8, 0.6, 1);

    return {
      ...ride,
      age: nextAge,
      status,
      cycleTimer,
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
  nextGuests = nextGuests.filter((guest) => guest.age < guest.maxAge);
  let totalGuests = state.stats.totalGuests;

  const entertainers = state.staff.filter((member) => member.type === 'entertainer');
  const securityStaff = state.staff.filter((member) => member.type === 'security');
  nextGuests = nextGuests.map((guest) => applyQueuePatience(guest, state.tick));

  if (entertainers.length > 0 || securityStaff.length > 0) {
    nextGuests = nextGuests.map((guest) => applyStaffMoodEffects(guest, entertainers, securityStaff));
  }

  nextGuests = nextGuests.map((guest) => updateGuestThoughts(guest, state.tick, state.finance.entranceFee));

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
    if (!shouldGuestLeavePark(guest)) return guest;
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
      const rideOptions = availableRides.filter((ride) => {
        const capacity = queueCapacityByRide.get(ride.id) ?? ride.queue.maxLength;
        return (queueCounts.get(ride.id) ?? 0) < capacity;
      });
      if (rideOptions.length === 0) return guest;
      const weightedRides = rideOptions.map((ride) => {
        const queueLength = queueCounts.get(ride.id) ?? ride.queue.guestIds.length;
        const waitMinutes = estimateQueueWaitMinutes(queueLength, ride.stats.rideTime, ride.stats.capacity);
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
      const accessTile = findRideAccessTile(ride, state.grid);
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
    queueGuests.sort((a, b) => (a.queueJoinTick ?? 0) - (b.queueJoinTick ?? 0));
    const maxLength = queueCapacityByRide.get(rideId)
      ?? state.rides.find((ride) => ride.id === rideId)?.queue.maxLength
      ?? DEFAULT_QUEUE_LENGTH;
    if (queueGuests.length > maxLength) {
      const overflow = queueGuests.slice(maxLength);
      overflow.forEach((guest) => {
        guestUpdates.set(guest.id, {
          state: 'wandering',
          targetRideId: null,
          queueJoinTick: null,
          path: [],
          pathIndex: 0,
        });
      });
      queueMap.set(rideId, queueGuests.slice(0, maxLength));
    } else {
      queueMap.set(rideId, queueGuests);
    }
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
      const effect = SHOP_EFFECTS[guest.targetShop?.type ?? 'food_stall'];
      shopRevenue += effect?.cost ?? 0;
    });
  }

  if (state.tick % GUEST_SPAWN_INTERVAL === 0 && nextGuests.length < MAX_GUESTS) {
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
    entranceRevenue: 0,
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
  }

  const nextState: CoasterParkState = {
    ...state,
    tick: nextTick,
    hour,
    day,
    month,
    year,
    weather,
  };

  const withStaff = updateStaff(nextState);
  const withGuests = updateGuests(withStaff);
  return updateTrains(withGuests);
}
