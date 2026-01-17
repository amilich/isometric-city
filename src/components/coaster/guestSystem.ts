import { CoasterGameState, Guest, Ride } from '@/games/coaster/types';
import { CardinalDirection } from '@/core/types';

const GUEST_SPAWN_INTERVAL = 3.5;
const GUEST_SPEED_MIN = 0.45;
const GUEST_SPEED_MAX = 0.7;
const MAX_QUEUE_WAIT = 10;

const NEED_DECAY = {
  hunger: 0.05,
  thirst: 0.07,
  energy: 0.03,
  toilet: 0.06,
  nausea: 0.04,
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const directionFromStep = (from: { x: number; y: number }, to: { x: number; y: number }): CardinalDirection => {
  if (to.x < from.x) return 'north';
  if (to.x > from.x) return 'south';
  if (to.y < from.y) return 'east';
  return 'west';
};

const isPathTile = (state: CoasterGameState, x: number, y: number) => {
  if (x < 0 || y < 0 || x >= state.gridSize || y >= state.gridSize) return false;
  return Boolean(state.grid[y][x].path);
};

const findPath = (
  state: CoasterGameState,
  start: { x: number; y: number },
  end: { x: number; y: number }
): { x: number; y: number }[] | null => {
  const queue: { x: number; y: number; path: { x: number; y: number }[] }[] = [
    { x: start.x, y: start.y, path: [{ x: start.x, y: start.y }] },
  ];
  const visited = new Set<string>([`${start.x},${start.y}`]);

  const directions = [
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
  ];

  while (queue.length) {
    const current = queue.shift()!;
    if (current.x === end.x && current.y === end.y) {
      return current.path;
    }

    for (const dir of directions) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;
      const key = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= state.gridSize || ny >= state.gridSize) continue;
      if (visited.has(key)) continue;
      if (!isPathTile(state, nx, ny)) continue;
      visited.add(key);
      queue.push({
        x: nx,
        y: ny,
        path: [...current.path, { x: nx, y: ny }],
      });
    }
  }

  return null;
};

const chooseRide = (state: CoasterGameState, guest: Guest): Ride | null => {
  const openRides = state.rides.filter((ride) => ride.status !== 'closed');
  if (!openRides.length) return null;

  if (guest.needs.hunger < 35) {
    const food = openRides.filter((ride) => ride.type === 'food_stall');
    if (food.length) return food[Math.floor(Math.random() * food.length)];
  }

  if (guest.needs.thirst < 35) {
    const drinks = openRides.filter((ride) => ride.type === 'drink_stall');
    if (drinks.length) return drinks[Math.floor(Math.random() * drinks.length)];
  }

  if (guest.needs.toilet < 25) {
    const toilets = openRides.filter((ride) => ride.type === 'toilet');
    if (toilets.length) return toilets[Math.floor(Math.random() * toilets.length)];
  }

  const thrillRides = openRides.filter((ride) => ride.category === 'coaster' || ride.category === 'flat');
  return thrillRides.length ? thrillRides[Math.floor(Math.random() * thrillRides.length)] : openRides[0];
};

const spawnGuest = (state: CoasterGameState): Guest => {
  return {
    id: state.lastGuestId + 1,
    tileX: state.parkEntrance.x,
    tileY: state.parkEntrance.y,
    direction: 'north',
    progress: 0,
    speed: GUEST_SPEED_MIN + Math.random() * (GUEST_SPEED_MAX - GUEST_SPEED_MIN),
    state: 'walking',
    path: [],
    pathIndex: 0,
    money: 40 + Math.random() * 60,
    needs: {
      hunger: 80,
      thirst: 80,
      energy: 85,
      nausea: 0,
      toilet: 70,
      happiness: 80,
    },
    preferences: {
      thrillTolerance: Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low',
      preferredIntensity: 4 + Math.random() * 4,
      likesWaterRides: Math.random() > 0.6,
    },
    currentRideId: null,
    targetRideId: null,
    queueTile: null,
    lastDecisionTime: 0,
    stateTimer: 0,
    spriteVariant: Math.floor(Math.random() * 8),
  };
};

export function updateGuests(state: CoasterGameState, deltaSeconds: number): CoasterGameState {
  let guests = [...state.guests];
  let guestSpawnTimer = state.guestSpawnTimer + deltaSeconds;
  let finance = { ...state.finance };
  let lastGuestId = state.lastGuestId;
  const rides = state.rides.map((ride) => ({
    ...ride,
    performance: { ...ride.performance },
  }));

  const spawnInterval = Math.max(1.8, GUEST_SPAWN_INTERVAL - state.parkRating / 100);

  if (guestSpawnTimer >= spawnInterval && guests.length < state.maxGuests) {
    guestSpawnTimer = 0;
    const guest = spawnGuest(state);
    let guestMoney = guest.money;
    if (guestMoney >= finance.entranceFee) {
      guestMoney -= finance.entranceFee;
      finance.money += finance.entranceFee;
      finance.dailyIncome += finance.entranceFee;
    }
    guests.push({ ...guest, money: guestMoney });
    lastGuestId += 1;
  }

  guests = guests.map((guest) => {
    const needs = {
      hunger: clamp(guest.needs.hunger - NEED_DECAY.hunger * deltaSeconds, 0, 100),
      thirst: clamp(guest.needs.thirst - NEED_DECAY.thirst * deltaSeconds, 0, 100),
      energy: clamp(guest.needs.energy - NEED_DECAY.energy * deltaSeconds, 0, 100),
      toilet: clamp(guest.needs.toilet - NEED_DECAY.toilet * deltaSeconds, 0, 100),
      nausea: clamp(guest.needs.nausea - NEED_DECAY.nausea * deltaSeconds, 0, 100),
      happiness: guest.needs.happiness,
    };

    let stateTimer = guest.stateTimer + deltaSeconds;
    let money = guest.money;
    let currentRideId = guest.currentRideId;
    let targetRideId = guest.targetRideId;
    let path = guest.path;
    let pathIndex = guest.pathIndex;
    let tileX = guest.tileX;
    let tileY = guest.tileY;
    let progress = guest.progress;
    let direction = guest.direction;
    let guestState = guest.state;

    if (needs.hunger < 15 || needs.thirst < 15 || needs.energy < 10) {
      needs.happiness = clamp(needs.happiness - deltaSeconds * 0.4, 0, 100);
    } else {
      needs.happiness = clamp(needs.happiness + deltaSeconds * 0.1, 0, 100);
    }

    if (needs.happiness < 15 && guestState !== 'leaving') {
      guestState = 'leaving';
      targetRideId = null;
      path = [];
      pathIndex = 0;
    }

    if (guestState === 'walking' || guestState === 'leaving') {
      if (guestState === 'leaving') {
        if (!path.length) {
          const exitPath = findPath(state, { x: tileX, y: tileY }, state.parkEntrance);
          if (exitPath) {
            path = exitPath;
            pathIndex = 0;
          }
        }
      } else if (!targetRideId) {
        const nextRide = chooseRide(state, guest);
        if (nextRide && nextRide.entrance) {
          const targetPath = findPath(state, { x: tileX, y: tileY }, nextRide.entrance);
          if (targetPath) {
            targetRideId = nextRide.id;
            path = targetPath;
            pathIndex = 0;
          }
        }
      }

      if (path.length > 1) {
        const nextIndex = Math.min(pathIndex + 1, path.length - 1);
        const nextTile = path[nextIndex];
        progress += guest.speed * deltaSeconds;
        if (progress >= 1) {
          progress = 0;
          tileX = nextTile.x;
          tileY = nextTile.y;
          pathIndex = nextIndex;
          if (pathIndex === path.length - 1 && targetRideId) {
            guestState = 'queuing';
            stateTimer = 0;
          }
        }
        direction = directionFromStep({ x: tileX, y: tileY }, nextTile);
      }
    }

    if (guestState === 'queuing' && targetRideId) {
        const ride = rides.find((r) => r.id === targetRideId);
      if (!ride) {
        guestState = 'walking';
        targetRideId = null;
      } else if (stateTimer >= Math.min(MAX_QUEUE_WAIT, ride.performance.waitTime + 2)) {
        guestState = 'riding';
        stateTimer = 0;
        currentRideId = ride.id;
        targetRideId = null;
        ride.performance.waitTime = Math.max(0, ride.performance.waitTime - 1);
      } else {
        ride.performance.waitTime = Math.min(MAX_QUEUE_WAIT, ride.performance.waitTime + deltaSeconds * 0.2);
      }
    }

    if (guestState === 'riding' && currentRideId) {
      const ride = rides.find((r) => r.id === currentRideId);
      if (!ride) {
        guestState = 'walking';
        currentRideId = null;
      } else if (stateTimer >= ride.duration / 10) {
        guestState = 'walking';
        stateTimer = 0;
        currentRideId = null;
        if (ride.exit) {
          tileX = ride.exit.x;
          tileY = ride.exit.y;
        }
        if (money >= ride.price) {
          money -= ride.price;
          finance.money += ride.price;
          finance.dailyIncome += ride.price;
          ride.performance.revenueToday += ride.price;
        }
        ride.performance.guestsToday += 1;
        needs.happiness = clamp(needs.happiness + ride.ratings.excitement * 1.5, 0, 100);
        needs.nausea = clamp(needs.nausea + ride.ratings.nausea * 4, 0, 100);

        if (ride.type === 'food_stall') {
          needs.hunger = clamp(needs.hunger + 45, 0, 100);
        }
        if (ride.type === 'drink_stall') {
          needs.thirst = clamp(needs.thirst + 55, 0, 100);
        }
        if (ride.type === 'toilet') {
          needs.toilet = clamp(needs.toilet + 60, 0, 100);
        }
        if (ride.type === 'souvenir_stall') {
          needs.happiness = clamp(needs.happiness + 10, 0, 100);
        }
      }
    }

    return {
      ...guest,
      needs,
      money,
      tileX,
      tileY,
      progress,
      direction,
      path,
      pathIndex,
      state: guestState,
      currentRideId,
      targetRideId,
      stateTimer,
    };
  });

  guests = guests.filter(
    (guest) =>
      !(
        guest.state === 'leaving' &&
        guest.tileX === state.parkEntrance.x &&
        guest.tileY === state.parkEntrance.y &&
        guest.pathIndex >= guest.path.length - 1
      )
  );

  return {
    ...state,
    guests,
    guestSpawnTimer,
    lastGuestId,
    finance,
    rides,
  };
}
