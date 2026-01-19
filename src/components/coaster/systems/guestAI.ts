/**
 * Guest AI System - Handles guest behavior, pathfinding, and decision making
 */

import { Guest, GuestState, ThoughtType, GuestThought } from '@/games/coaster/types/guests';
import { CoasterGameState, ParkTile } from '@/games/coaster/types/game';
import { Ride } from '@/games/coaster/types/rides';
import { Shop, SHOP_DEFINITIONS, RIDE_DEFINITIONS } from '@/games/coaster/types/buildings';
import { findPathOnGrid, findNearestPath } from './pathSystem';

// =============================================================================
// CONSTANTS
// =============================================================================

const NEED_DECAY_RATES = {
  hunger: 0.08,    // Per tick
  thirst: 0.12,
  bathroom: 0.06,
  energy: -0.04,   // Decreases
  happiness: 0,    // Calculated from other factors
};

const NEED_THRESHOLDS = {
  low: 64,
  medium: 128,
  high: 192,
  critical: 224,
};

const HAPPINESS_MODIFIERS = {
  inQueue: -0.05,        // Per tick while queuing
  riddenGoodRide: 30,    // After riding a good ride
  riddenBadRide: -20,    // After a bad ride
  ate: 25,               // After eating
  drank: 20,             // After drinking
  usedBathroom: 30,      // After using bathroom
  foundPath: 5,          // After finding a path when lost
  gotLost: -15,          // When getting lost
  sawVomit: -5,          // When walking past vomit
  sawLitter: -2,         // When walking past litter
  niceScenery: 3,        // When near scenery
  crowded: -1,           // Per tick in crowded area
};

// =============================================================================
// NEED MANAGEMENT
// =============================================================================

/**
 * Update guest needs based on time passing
 */
export function updateGuestNeeds(guest: Guest, deltaTime: number): Guest {
  const updated = { ...guest };

  // Decay needs over time
  updated.hunger = Math.min(255, Math.max(0, updated.hunger + NEED_DECAY_RATES.hunger * deltaTime));
  updated.thirst = Math.min(255, Math.max(0, updated.thirst + NEED_DECAY_RATES.thirst * deltaTime));
  updated.bathroom = Math.min(255, Math.max(0, updated.bathroom + NEED_DECAY_RATES.bathroom * deltaTime));
  updated.energy = Math.min(255, Math.max(0, updated.energy + NEED_DECAY_RATES.energy * deltaTime));

  // Nausea decays over time (guests recover)
  updated.nausea = Math.max(0, updated.nausea - 0.1 * deltaTime);

  // Update happiness based on needs
  let happinessChange = 0;

  if (updated.hunger > NEED_THRESHOLDS.high) happinessChange -= 0.3;
  if (updated.thirst > NEED_THRESHOLDS.high) happinessChange -= 0.4;
  if (updated.bathroom > NEED_THRESHOLDS.high) happinessChange -= 0.5;
  if (updated.energy < NEED_THRESHOLDS.low) happinessChange -= 0.2;
  if (updated.nausea > NEED_THRESHOLDS.medium) happinessChange -= 0.5;

  updated.happiness = Math.min(255, Math.max(0, updated.happiness + happinessChange * deltaTime));

  return updated;
}

/**
 * Get the most urgent need for a guest
 */
export function getMostUrgentNeed(guest: Guest): 'hunger' | 'thirst' | 'bathroom' | 'energy' | 'nausea' | null {
  const needs = [
    { type: 'bathroom' as const, value: guest.bathroom },
    { type: 'thirst' as const, value: guest.thirst },
    { type: 'hunger' as const, value: guest.hunger },
    { type: 'nausea' as const, value: guest.nausea },
  ];

  // Sort by urgency
  needs.sort((a, b) => b.value - a.value);

  const mostUrgent = needs[0];
  if (mostUrgent.value > NEED_THRESHOLDS.medium) {
    return mostUrgent.type;
  }

  // Check energy separately (it's inverted - low is bad)
  if (guest.energy < NEED_THRESHOLDS.low) {
    return 'energy';
  }

  return null;
}

// =============================================================================
// TARGET FINDING
// =============================================================================

function getPathTargetNear(
  state: CoasterGameState,
  x: number,
  y: number,
  maxDistance: number = 4
): { x: number; y: number } | null {
  return findNearestPath(state.grid, state.gridSize, x, y, maxDistance);
}

function findRideTarget(guest: Guest, state: CoasterGameState): { ride: Ride; target: { x: number; y: number } } | null {
  const eligibleRides = state.rides.filter(ride => {
    if (ride.status !== 'open') return false;
    if (ride.queueLength >= ride.maxQueueLength) return false;
    if (guest.ticketType === 'pay_per_ride' && guest.cash < ride.price) return false;

    const def = RIDE_DEFINITIONS[ride.type];
    if (!def) return false;

    // Respect intensity tolerance
    if (ride.stats.intensity > guest.preferences.intensityTolerance + 2) return false;

    return true;
  });

  if (eligibleRides.length === 0) return null;

  // Sort by distance + queue length
  const scored = eligibleRides
    .map(ride => {
      const dist = Math.abs(ride.entranceX - guest.x) + Math.abs(ride.entranceY - guest.y);
      const score = dist + ride.queueLength * 0.5;
      return { ride, score };
    })
    .sort((a, b) => a.score - b.score);

  for (const { ride } of scored.slice(0, 5)) {
    const target = getPathTargetNear(state, ride.entranceX, ride.entranceY, 6);
    if (target) {
      return { ride, target };
    }
  }

  return null;
}

function findShopTarget(
  guest: Guest,
  state: CoasterGameState,
  need: 'hunger' | 'thirst' | 'bathroom'
): { shop: Shop; target: { x: number; y: number } } | null {
  const eligibleShops = state.shops.filter(shop => {
    const def = SHOP_DEFINITIONS[shop.type];
    if (!def) return false;
    if (shop.status !== 'open') return false;
    if (def.satisfies !== need) return false;

    if (shop.price > 0 && guest.cash < shop.price) return false;

    return true;
  });

  if (eligibleShops.length === 0) return null;

  const scored = eligibleShops
    .map(shop => {
      const dist = Math.abs(shop.x - guest.x) + Math.abs(shop.y - guest.y);
      return { shop, score: dist };
    })
    .sort((a, b) => a.score - b.score);

  for (const { shop } of scored.slice(0, 5)) {
    const target = getPathTargetNear(state, shop.x, shop.y, 4);
    if (target) {
      return { shop, target };
    }
  }

  return null;
}

function findBenchTarget(state: CoasterGameState, guest: Guest): { x: number; y: number } | null {
  const maxDistance = 12;
  let closest: { x: number; y: number; score: number } | null = null;

  for (let y = 0; y < state.gridSize; y++) {
    for (let x = 0; x < state.gridSize; x++) {
      const tile = state.grid[y]?.[x];
      if (!tile?.building || tile.building.type !== 'bench') continue;

      const dist = Math.abs(x - guest.x) + Math.abs(y - guest.y);
      if (dist > maxDistance) continue;
      if (!closest || dist < closest.score) {
        closest = { x, y, score: dist };
      }
    }
  }

  if (!closest) return null;
  return getPathTargetNear(state, closest.x, closest.y, 4);
}

// =============================================================================
// THOUGHT SYSTEM
// =============================================================================

/**
 * Add a thought to a guest
 */
export function addThought(guest: Guest, type: ThoughtType, subject?: string): Guest {
  const thought: GuestThought = {
    type,
    subject,
    timestamp: Date.now(),
  };

  // Keep only last 10 thoughts
  const thoughts = [thought, ...guest.thoughts.slice(0, 9)];

  return { ...guest, thoughts };
}

/**
 * Generate thoughts based on guest state
 */
export function generateThoughts(guest: Guest): Guest {
  let updated = guest;

  // Need-based thoughts
  if (guest.hunger > NEED_THRESHOLDS.high && !hasRecentThought(guest, 'hungry')) {
    updated = addThought(updated, 'hungry');
  }
  if (guest.thirst > NEED_THRESHOLDS.high && !hasRecentThought(guest, 'thirsty')) {
    updated = addThought(updated, 'thirsty');
  }
  if (guest.bathroom > NEED_THRESHOLDS.high && !hasRecentThought(guest, 'need_bathroom')) {
    updated = addThought(updated, 'need_bathroom');
  }
  if (guest.nausea > NEED_THRESHOLDS.medium && !hasRecentThought(guest, 'nauseous')) {
    updated = addThought(updated, 'nauseous');
  }
  if (guest.energy < NEED_THRESHOLDS.low && !hasRecentThought(guest, 'tired')) {
    updated = addThought(updated, 'tired');
  }

  // Happiness thoughts
  if (guest.happiness > 200 && !hasRecentThought(guest, 'happy')) {
    updated = addThought(updated, 'happy');
  }

  return updated;
}

/**
 * Check if guest has a recent thought of this type
 */
function hasRecentThought(guest: Guest, type: ThoughtType): boolean {
  const recent = guest.thoughts.find(t => t.type === type);
  if (!recent) return false;
  return Date.now() - recent.timestamp < 30000; // 30 seconds
}

// =============================================================================
// DECISION MAKING
// =============================================================================

export type GuestDecision =
  | { type: 'wander' }
  | { type: 'find_ride'; rideType?: string }
  | { type: 'find_food' }
  | { type: 'find_drink' }
  | { type: 'find_bathroom' }
  | { type: 'find_bench' }
  | { type: 'leave_park' }
  | { type: 'queue_for_ride'; rideId: string }
  | { type: 'continue_current' };

/**
 * Make a decision for the guest based on their state
 */
export function makeDecision(guest: Guest, state: CoasterGameState): GuestDecision {
  // Very unhappy guests may leave
  if (guest.happiness < 30) {
    return { type: 'leave_park' };
  }

  // Been in park too long - time to go
  if (guest.timeInPark > 3600) { // 1 hour
    return { type: 'leave_park' };
  }

  // Check urgent needs first
  const urgentNeed = getMostUrgentNeed(guest);
  if (urgentNeed) {
    switch (urgentNeed) {
      case 'hunger':
        return { type: 'find_food' };
      case 'thirst':
        return { type: 'find_drink' };
      case 'bathroom':
        return { type: 'find_bathroom' };
      case 'energy':
        return { type: 'find_bench' };
      case 'nausea':
        // Wait for nausea to pass - find bench
        return { type: 'find_bench' };
    }
  }

  // If currently doing something, continue
  if (guest.state === 'queuing' || guest.state === 'on_ride' || guest.state === 'buying') {
    return { type: 'continue_current' };
  }

  // Look for a ride
  if (state.rides.length > 0 && guest.ridesRidden.length < 10) {
    // Find a ride they haven't been on recently
    const availableRides = state.rides.filter(r => 
      r.status === 'open' && 
      !guest.ridesRidden.slice(-5).includes(r.id) &&
      r.queueLength < r.maxQueueLength
    );

    if (availableRides.length > 0) {
      // Pick a ride that matches their preferences
      const suitableRide = findSuitableRide(guest, availableRides);
      if (suitableRide) {
        return { type: 'queue_for_ride', rideId: suitableRide.id };
      }
    }
  }

  // Default: wander around
  return { type: 'wander' };
}

/**
 * Find a ride suitable for this guest's preferences
 */
function findSuitableRide(guest: Guest, rides: Ride[]): Ride | null {
  // Filter by intensity tolerance
  const suitable = rides.filter(ride => {
    const intensity = ride.stats.intensity;
    return intensity <= guest.preferences.intensityTolerance;
  });

  if (suitable.length === 0) {
    // If no rides match preferences, try any ride with low intensity
    return rides.find(r => r.stats.intensity < 5) || rides[0];
  }

  // Prefer rides with shorter queues
  suitable.sort((a, b) => a.queueLength - b.queueLength);

  // Some randomness in selection
  const index = Math.floor(Math.random() * Math.min(3, suitable.length));
  return suitable[index];
}

// =============================================================================
// MOVEMENT
// =============================================================================

/**
 * Move guest along their path
 */
export function moveGuest(
  guest: Guest,
  grid: ParkTile[][],
  gridSize: number,
  deltaTime: number
): Guest {
  if (guest.path.length === 0 || guest.pathIndex >= guest.path.length) {
    // No path - try to find one
    return guest;
  }

  const target = guest.path[guest.pathIndex];
  const dx = target.x - guest.x;
  const dy = target.y - guest.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < 0.1) {
    // Reached waypoint
    guest = { ...guest, pathIndex: guest.pathIndex + 1 };

    if (guest.pathIndex >= guest.path.length) {
      // Reached destination
      guest.path = [];
      guest.pathIndex = 0;
    }
  } else {
    // Move toward waypoint
    const moveDistance = guest.speed * deltaTime * 0.02;
    const moveRatio = Math.min(1, moveDistance / distance);

    guest = {
      ...guest,
      x: guest.x + dx * moveRatio,
      y: guest.y + dy * moveRatio,
      direction: Math.atan2(dy, dx) * (180 / Math.PI),
    };
  }

  return guest;
}

/**
 * Set a path for the guest to follow
 */
export function setGuestPath(
  guest: Guest,
  grid: ParkTile[][],
  gridSize: number,
  targetX: number,
  targetY: number,
  intent?: Guest['intent']
): Guest {
  const startX = Math.floor(guest.x);
  const startY = Math.floor(guest.y);

  const path = findPathOnGrid(grid, gridSize, startX, startY, targetX, targetY);

  if (path) {
    return {
      ...guest,
      path,
      pathIndex: 0,
      targetX,
      targetY,
      state: 'walking' as GuestState,
      intent,
    };
  } else {
    // Couldn't find path - guest is lost
    return addThought({ ...guest, state: 'lost' as GuestState }, 'lost');
  }
}

// =============================================================================
// MAIN UPDATE FUNCTION
// =============================================================================

/**
 * Update a single guest for one tick
 */
export function updateGuest(
  guest: Guest,
  state: CoasterGameState,
  deltaTime: number = 1
): Guest {
  // Update needs
  let updated = updateGuestNeeds(guest, deltaTime);

  // Resting behavior
  if (updated.state === 'sitting') {
    updated.energy = Math.min(255, updated.energy + 0.6 * deltaTime);
    updated.happiness = Math.min(255, updated.happiness + 0.3 * deltaTime);
    if (updated.energy > 220) {
      updated.state = 'walking';
    }
  }

  // Generate thoughts
  updated = generateThoughts(updated);

  // Update time in park
  updated.timeInPark += deltaTime;
  if (updated.state === 'queuing') {
    updated.timeInQueue += deltaTime;
    updated.happiness = Math.max(0, updated.happiness + HAPPINESS_MODIFIERS.inQueue * deltaTime);

    if (updated.timeInQueue > updated.preferences.maxQueueWait) {
      updated = addThought(updated, 'long_queue');
      updated.timeInQueue = 0;
      updated.state = 'walking';
      updated.intent = undefined;
    }
  }

  // Make decisions periodically (every ~30 ticks)
  if (state.tick % 30 === guest.id % 30 && updated.state !== 'on_ride') {
    const decision = makeDecision(updated, state);

    switch (decision.type) {
      case 'leave_park':
        updated = setGuestPath(
          updated,
          state.grid,
          state.gridSize,
          state.park.entranceX,
          state.park.entranceY,
          { type: 'exit' }
        );
        updated.state = 'leaving';
        break;

      case 'find_food': {
        const target = findShopTarget(updated, state, 'hunger');
        if (target) {
          updated = setGuestPath(
            updated,
            state.grid,
            state.gridSize,
            target.target.x,
            target.target.y,
            { type: 'shop', targetId: target.shop.id }
          );
        }
        break;
      }

      case 'find_drink': {
        const target = findShopTarget(updated, state, 'thirst');
        if (target) {
          updated = setGuestPath(
            updated,
            state.grid,
            state.gridSize,
            target.target.x,
            target.target.y,
            { type: 'shop', targetId: target.shop.id }
          );
        }
        break;
      }

      case 'find_bathroom': {
        const target = findShopTarget(updated, state, 'bathroom');
        if (target) {
          updated = setGuestPath(
            updated,
            state.grid,
            state.gridSize,
            target.target.x,
            target.target.y,
            { type: 'bathroom', targetId: target.shop.id }
          );
        }
        break;
      }

      case 'find_bench': {
        const benchTarget = findBenchTarget(state, updated);
        if (benchTarget) {
          updated = setGuestPath(
            updated,
            state.grid,
            state.gridSize,
            benchTarget.x,
            benchTarget.y,
            { type: 'bench', targetX: benchTarget.x, targetY: benchTarget.y }
          );
        }
        break;
      }

      case 'queue_for_ride': {
        const ride = state.rides.find(r => r.id === decision.rideId);
        if (ride) {
          const target = getPathTargetNear(state, ride.entranceX, ride.entranceY, 6);
          if (target) {
            updated = setGuestPath(
              updated,
              state.grid,
              state.gridSize,
              target.x,
              target.y,
              { type: 'ride', targetId: ride.id }
            );
          }
        } else {
          const rideTarget = findRideTarget(updated, state);
          if (rideTarget) {
            updated = setGuestPath(
              updated,
              state.grid,
              state.gridSize,
              rideTarget.target.x,
              rideTarget.target.y,
              { type: 'ride', targetId: rideTarget.ride.id }
            );
          }
        }
        break;
      }

      case 'wander':
        if (updated.state === 'walking' && updated.path.length > 0) {
          // Continue current path
        } else {
          // Pick a random nearby path
          const nearbyPath = findNearestPath(
            state.grid,
            state.gridSize,
            Math.floor(updated.x),
            Math.floor(updated.y),
            5
          );
          if (nearbyPath) {
            const wanderX = nearbyPath.x + Math.floor(Math.random() * 10) - 5;
            const wanderY = nearbyPath.y + Math.floor(Math.random() * 10) - 5;
            const targetPath = findNearestPath(state.grid, state.gridSize, wanderX, wanderY, 5);
            if (targetPath) {
              updated = setGuestPath(
                updated,
                state.grid,
                state.gridSize,
                targetPath.x,
                targetPath.y,
                { type: 'wander', targetX: targetPath.x, targetY: targetPath.y }
              );
            }
          }
        }
        break;

      case 'continue_current':
        // Do nothing
        break;
    }
  }

  // Move if has a path
  if (
    updated.path.length > 0 &&
    updated.state !== 'on_ride' &&
    updated.state !== 'sitting' &&
    updated.state !== 'queuing' &&
    updated.state !== 'buying'
  ) {
    updated = moveGuest(updated, state.grid, state.gridSize, deltaTime);
  }

  // Check if should leave park
  if (updated.state === 'leaving' && updated.path.length === 0) {
    const distToExit = Math.sqrt(
      Math.pow(updated.x - state.park.entranceX, 2) +
      Math.pow(updated.y - state.park.entranceY, 2)
    );
    if (distToExit < 2) {
      updated.state = 'left';
    }
  }

  return updated;
}

// =============================================================================
// INTERACTIONS
// =============================================================================

function isGuestNear(guest: Guest, x: number, y: number, threshold: number = 0.8): boolean {
  return Math.abs(guest.x - x) < threshold && Math.abs(guest.y - y) < threshold;
}

export function processGuestInteractions(state: CoasterGameState): CoasterGameState {
  const guests: Guest[] = state.guests.map(guest => ({ ...guest }));
  const rides = state.rides.map(ride => ({
    ...ride,
    guestsInQueue: [...ride.guestsInQueue],
    guestsOnRide: [...ride.guestsOnRide],
  }));
  const shops = state.shops.map(shop => ({ ...shop }));
  const finances = {
    ...state.finances,
    currentMonthRecord: { ...state.finances.currentMonthRecord },
  };

  const rideMap = new Map(rides.map(ride => [ride.id, ride]));
  const shopMap = new Map(shops.map(shop => [shop.id, shop]));

  const updatedGuests: Guest[] = guests.map(guest => {
    if (!guest.intent) return guest;

    if (guest.intent.type === 'ride') {
      const ride = guest.intent.targetId ? rideMap.get(guest.intent.targetId) : undefined;
      if (!ride || ride.status !== 'open') {
        return { ...guest, intent: undefined };
      }

      if (isGuestNear(guest, ride.entranceX, ride.entranceY)) {
        if (!ride.guestsInQueue.includes(guest.id) && !ride.guestsOnRide.includes(guest.id)) {
          ride.guestsInQueue.push(guest.id);
          ride.queueLength = ride.guestsInQueue.length;
        }

        return {
          ...guest,
          state: 'queuing',
          timeInQueue: 0,
        };
      }
    }

    if (guest.intent.type === 'shop' || guest.intent.type === 'bathroom') {
      const shop = guest.intent.targetId ? shopMap.get(guest.intent.targetId) : undefined;
      if (!shop) {
        return { ...guest, intent: undefined };
      }

      if (isGuestNear(guest, shop.x, shop.y)) {
        const def = SHOP_DEFINITIONS[shop.type];
        if (!def) {
          return { ...guest, intent: undefined };
        }

        if (shop.price > 0 && guest.cash < shop.price) {
          return addThought({ ...guest, intent: undefined, state: 'walking' }, 'expensive');
        }

        const updatedGuest = { ...guest };
        if (shop.price > 0) {
          updatedGuest.cash -= shop.price;
          finances.cash += shop.price;
          if (def.category === 'facility') {
            finances.currentMonthRecord.facilityUsage += shop.price;
          } else {
            finances.currentMonthRecord.shopSales += shop.price;
          }
          shop.totalSales += 1;
          shop.totalRevenue += shop.price;
          shop.lastVisitedAt = state.tick;
        }

        if (def.satisfies === 'hunger') {
          updatedGuest.hunger = Math.max(0, updatedGuest.hunger - 180);
          updatedGuest.happiness = Math.min(255, updatedGuest.happiness + 20);
        } else if (def.satisfies === 'thirst') {
          updatedGuest.thirst = Math.max(0, updatedGuest.thirst - 200);
          updatedGuest.happiness = Math.min(255, updatedGuest.happiness + 18);
        } else if (def.satisfies === 'bathroom') {
          updatedGuest.bathroom = Math.max(0, updatedGuest.bathroom - 230);
          updatedGuest.happiness = Math.min(255, updatedGuest.happiness + 15);
        } else if (def.satisfies === 'cash') {
          updatedGuest.cash += 50;
        }

        return addThought({
          ...updatedGuest,
          intent: undefined,
          state: 'walking',
          shopsVisited: [...updatedGuest.shopsVisited, shop.id],
        }, 'good_value');
      }
    }

    if (guest.intent.type === 'bench') {
      if (guest.intent.targetX !== undefined && guest.intent.targetY !== undefined) {
        if (isGuestNear(guest, guest.intent.targetX, guest.intent.targetY)) {
          return {
            ...guest,
            state: 'sitting',
            intent: undefined,
            energy: Math.min(255, guest.energy + 40),
            happiness: Math.min(255, guest.happiness + 10),
          };
        }
      }
    }

    return guest;
  });

  return {
    ...state,
    guests: updatedGuests,
    rides: Array.from(rideMap.values()),
    shops: Array.from(shopMap.values()),
    finances,
  };
}

/**
 * Update all guests
 */
export function updateAllGuests(state: CoasterGameState): Guest[] {
  return state.guests
    .map(guest => updateGuest(guest, state))
    .filter(guest => guest.state !== 'left');
}
