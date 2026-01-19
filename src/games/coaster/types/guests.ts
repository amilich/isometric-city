/**
 * Coaster Tycoon Guest Types
 * Defines guests (peeps) and staff
 */

// =============================================================================
// GUEST STATES
// =============================================================================

export type GuestState =
  | 'entering'          // Walking into the park
  | 'walking'           // Walking around
  | 'queuing'           // In a ride queue
  | 'on_ride'           // Currently on a ride
  | 'leaving_ride'      // Exiting a ride
  | 'sitting'           // Resting on a bench
  | 'buying'            // At a shop
  | 'watching'          // Watching entertainment
  | 'using_facility'    // Using restroom, ATM, etc.
  | 'lost'              // Can't find destination
  | 'sick'              // Vomiting
  | 'leaving'           // Heading to exit
  | 'left';             // Has left the park

// =============================================================================
// GUEST INTENT
// =============================================================================

export type GuestIntentType =
  | 'ride'
  | 'shop'
  | 'bathroom'
  | 'bench'
  | 'exit'
  | 'wander';

export interface GuestIntent {
  type: GuestIntentType;
  targetId?: string;
  targetX?: number;
  targetY?: number;
}

// =============================================================================
// GUEST THOUGHTS
// =============================================================================

export type ThoughtType =
  // Positive
  | 'happy'
  | 'enjoying_ride'
  | 'good_value'
  | 'beautiful_park'
  | 'great_scenery'
  | 'clean_park'
  // Negative
  | 'hungry'
  | 'thirsty'
  | 'need_bathroom'
  | 'tired'
  | 'nauseous'
  | 'bored'
  | 'lost'
  | 'crowded'
  | 'expensive'
  | 'long_queue'
  | 'dirty_path'
  | 'vandalism'
  // Ride-related
  | 'want_to_ride'
  | 'too_intense'
  | 'not_intense_enough'
  | 'ride_was_great'
  | 'ride_was_boring';

export interface GuestThought {
  type: ThoughtType;
  subject?: string; // e.g., ride name
  timestamp: number;
}

// =============================================================================
// GUEST PREFERENCES
// =============================================================================

export interface GuestPreferences {
  intensityTolerance: number;    // 0-10, how intense rides they can handle
  nauseaTolerance: number;       // 0-10, how much nausea they can handle
  preferredRideTypes: string[];  // Favorite ride categories
  maxQueueWait: number;          // Max minutes they'll wait in queue
  spendingBudget: number;        // How much they're willing to spend
}

// =============================================================================
// GUEST INVENTORY
// =============================================================================

export interface GuestInventory {
  hasMap: boolean;
  hasUmbrella: boolean;
  hasBallon: boolean;
  hasSouvenir: boolean;
  food?: string;      // Currently holding food
  drink?: string;     // Currently holding drink
}

// =============================================================================
// GUEST
// =============================================================================

export interface Guest {
  id: number;
  name: string;
  
  // Position (in tile coordinates with sub-tile precision)
  x: number;
  y: number;
  
  // Movement
  targetX: number;
  targetY: number;
  path: { x: number; y: number }[];  // A* path to destination
  pathIndex: number;
  speed: number;                      // Current walking speed
  direction: number;                  // Facing direction (0-360)
  
  // Needs (0-255 scale, higher = more urgent)
  happiness: number;
  energy: number;
  hunger: number;
  thirst: number;
  nausea: number;
  bathroom: number;
  
  // Status
  state: GuestState;
  cash: number;
  ticketType: 'pay_per_ride' | 'wristband';
  intent?: GuestIntent;
  
  // Preferences
  preferences: GuestPreferences;
  
  // Inventory
  inventory: GuestInventory;
  
  // Thoughts and history
  thoughts: GuestThought[];
  ridesRidden: string[];       // IDs of rides they've been on
  shopsVisited: string[];      // IDs of shops they've visited
  
  // Timing
  timeInPark: number;          // Seconds since entering
  timeInQueue: number;         // Current queue wait time
  
  // Visual
  color: string;               // Shirt color for sprite
  variant: number;             // Sprite variant
}

// =============================================================================
// STAFF TYPES
// =============================================================================

export type StaffType =
  | 'handyman'       // Cleans paths, mows grass, waters flowers, empties bins
  | 'mechanic'       // Inspects and fixes rides
  | 'security'       // Prevents vandalism, catches thieves
  | 'entertainer';   // Improves guest happiness

export type EntertainmentCostume =
  | 'panda'
  | 'tiger'
  | 'elephant'
  | 'gorilla'
  | 'snowman'
  | 'knight'
  | 'astronaut'
  | 'pirate';

export type StaffState =
  | 'walking'
  | 'working'        // Cleaning, fixing, patrolling
  | 'heading_to_task'
  | 'idle';

// =============================================================================
// STAFF
// =============================================================================

export interface Staff {
  id: number;
  name: string;
  type: StaffType;
  
  // Position
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  path: { x: number; y: number }[];
  pathIndex: number;
  
  // Status
  state: StaffState;
  energy: number;         // Gets tired
  salary: number;         // Per month
  
  // Patrol zone (optional)
  patrolZone?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  
  // Type-specific
  costume?: EntertainmentCostume;  // For entertainers
  assignedRide?: string;           // For mechanics
  
  // Visual
  color: string;
  direction: number;
}

// =============================================================================
// STAFF DEFINITIONS
// =============================================================================

export interface StaffDefinition {
  type: StaffType;
  name: string;
  description: string;
  baseSalary: number;     // Per month
  walkSpeed: number;      // Tiles per second
}

export const STAFF_DEFINITIONS: Record<StaffType, StaffDefinition> = {
  handyman: {
    type: 'handyman',
    name: 'Handyman',
    description: 'Sweeps paths, empties bins, waters gardens',
    baseSalary: 500,
    walkSpeed: 1.5,
  },
  mechanic: {
    type: 'mechanic',
    name: 'Mechanic',
    description: 'Inspects and repairs rides',
    baseSalary: 800,
    walkSpeed: 1.2,
  },
  security: {
    type: 'security',
    name: 'Security Guard',
    description: 'Prevents vandalism and theft',
    baseSalary: 600,
    walkSpeed: 1.8,
  },
  entertainer: {
    type: 'entertainer',
    name: 'Entertainer',
    description: 'Cheers up guests in costume',
    baseSalary: 550,
    walkSpeed: 1.0,
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a random guest name
 */
const FIRST_NAMES = [
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Avery',
  'Emma', 'Olivia', 'Ava', 'Sophia', 'Isabella', 'Mia', 'Charlotte', 'Amelia',
  'Liam', 'Noah', 'Oliver', 'Elijah', 'William', 'James', 'Benjamin', 'Lucas',
  'Henry', 'Alexander', 'Michael', 'Daniel', 'Matthew', 'David', 'Joseph', 'Samuel',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White',
];

export function generateGuestName(): string {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${first} ${last}`;
}

/**
 * Generate random guest preferences
 */
export function generateGuestPreferences(): GuestPreferences {
  return {
    intensityTolerance: 3 + Math.random() * 7, // 3-10
    nauseaTolerance: 2 + Math.random() * 6,    // 2-8
    preferredRideTypes: [],
    maxQueueWait: 10 + Math.floor(Math.random() * 20), // 10-30 minutes
    spendingBudget: 50 + Math.floor(Math.random() * 150), // $50-200
  };
}

/**
 * Create a new guest with default values
 */
export function createGuest(id: number, entranceX: number, entranceY: number): Guest {
  const colors = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', 
    '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e',
  ];
  
  return {
    id,
    name: generateGuestName(),
    x: entranceX,
    y: entranceY,
    targetX: entranceX,
    targetY: entranceY,
    path: [],
    pathIndex: 0,
    speed: 1.0 + Math.random() * 0.5,
    direction: Math.random() * 360,
    happiness: 128 + Math.floor(Math.random() * 64), // Start fairly happy
    energy: 200 + Math.floor(Math.random() * 56),
    hunger: Math.floor(Math.random() * 50),
    thirst: Math.floor(Math.random() * 50),
    nausea: 0,
    bathroom: Math.floor(Math.random() * 30),
    state: 'entering',
    cash: 50 + Math.floor(Math.random() * 100),
    ticketType: 'pay_per_ride',
    intent: undefined,
    preferences: generateGuestPreferences(),
    inventory: {
      hasMap: false,
      hasUmbrella: false,
      hasBallon: false,
      hasSouvenir: false,
    },
    thoughts: [],
    ridesRidden: [],
    shopsVisited: [],
    timeInPark: 0,
    timeInQueue: 0,
    color: colors[Math.floor(Math.random() * colors.length)],
    variant: Math.floor(Math.random() * 4),
  };
}

/**
 * Create a new staff member
 */
export function createStaff(
  id: number, 
  type: StaffType, 
  x: number, 
  y: number,
  costume?: EntertainmentCostume
): Staff {
  const def = STAFF_DEFINITIONS[type];
  
  const staffColors: Record<StaffType, string> = {
    handyman: '#22c55e',    // Green
    mechanic: '#3b82f6',    // Blue
    security: '#6366f1',    // Indigo
    entertainer: '#f97316', // Orange
  };
  
  return {
    id,
    name: `${def.name} ${id}`,
    type,
    x,
    y,
    targetX: x,
    targetY: y,
    path: [],
    pathIndex: 0,
    state: 'idle',
    energy: 255,
    salary: def.baseSalary,
    costume: type === 'entertainer' ? costume : undefined,
    color: staffColors[type],
    direction: 0,
  };
}
