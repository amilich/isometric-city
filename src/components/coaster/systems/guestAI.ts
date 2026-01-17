/**
 * Guest AI System - Handles guest behavior, pathfinding, and decision making
 */

import { Guest, GuestState, ThoughtType, GuestThought } from '@/games/coaster/types/guests';
import { ParkTile, CoasterGameState } from '@/games/coaster/types/game';
import { Ride } from '@/games/coaster/types/rides';
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
  targetY: number
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

  // Generate thoughts
  updated = generateThoughts(updated);

  // Update time in park
  updated.timeInPark += deltaTime;
  if (updated.state === 'queuing') {
    updated.timeInQueue += deltaTime;
  }

  // Make decisions periodically (every ~30 ticks)
  if (state.tick % 30 === guest.id % 30) {
    const decision = makeDecision(updated, state);

    switch (decision.type) {
      case 'leave_park':
        updated = setGuestPath(updated, state.grid, state.gridSize, state.park.entranceX, state.park.entranceY);
        updated.state = 'leaving';
        break;

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
              updated = setGuestPath(updated, state.grid, state.gridSize, targetPath.x, targetPath.y);
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
  if (updated.path.length > 0 && updated.state !== 'on_ride' && updated.state !== 'sitting') {
    updated = moveGuest(updated, state.grid, state.gridSize, deltaTime);
  }

  // Check if should leave park
  if (updated.state === 'leaving' && updated.path.length === 0) {
    // At exit
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

/**
 * Update all guests
 */
export function updateAllGuests(state: CoasterGameState): Guest[] {
  return state.guests
    .map(guest => updateGuest(guest, state))
    .filter(guest => guest.state !== 'left');
}
