/**
 * IsoCoaster Economy & Guest Types
 * Defines guests, money, satisfaction, and park management
 */

// =============================================================================
// GUEST TYPES
// =============================================================================

export type GuestState =
  | 'entering'        // Walking into park
  | 'walking'         // Walking on paths
  | 'queuing'         // In queue for ride
  | 'riding'          // On a ride
  | 'exiting_ride'    // Leaving ride exit
  | 'shopping'        // At a shop
  | 'eating'          // At a food stand
  | 'sitting'         // Resting on bench
  | 'watching'        // Watching show/entertainment
  | 'leaving'         // Heading to exit
  | 'lost';           // Can't find path

export type GuestThought =
  | 'happy'
  | 'excited'
  | 'hungry'
  | 'thirsty'
  | 'tired'
  | 'need_bathroom'
  | 'lost'
  | 'queue_too_long'
  | 'ride_was_great'
  | 'ride_was_scary'
  | 'ride_made_sick'
  | 'path_disgusting'
  | 'scenery_beautiful'
  | 'want_to_go_home'
  | 'cant_find_exit'
  | 'spent_too_much'
  | 'good_value';

export interface Guest {
  id: string;
  name: string;
  
  // Position
  tileX: number;
  tileY: number;
  progress: number; // 0-1 progress to next tile
  direction: 'north' | 'east' | 'south' | 'west';
  
  // State
  state: GuestState;
  lastState: GuestState;
  targetBuildingId: string | null;
  targetBuildingKind: 'ride' | 'food' | 'shop' | null;
  targetTileX: number;
  targetTileY: number;
  path: { x: number; y: number }[];
  pathIndex: number;
  
  // Queue state
  queueRideId: string | null;
  queuePosition: number;
  queueTimer: number; // Remaining wait/ride time
  decisionCooldown: number; // Time until next ride decision
  
  // Needs (0-100, higher = more urgent)
  hunger: number;
  thirst: number;
  bathroom: number;
  energy: number;
  happiness: number;
  nausea: number;
  
  // Preferences (affects ride choice)
  preferExcitement: number;  // 0-10
  preferIntensity: number;   // 0-10
  nauseaTolerance: number;   // 0-10
  
  // Money
  cash: number;
  totalSpent: number;
  
  // Tracking
  ridesRidden: string[];
  thoughts: GuestThought[];
  timeInPark: number; // seconds
  
  // Visual
  skinColor: string;
  shirtColor: string;
  pantsColor: string;
  hasHat: boolean;
  hatColor: string;
  walkOffset: number;
}

// =============================================================================
// PARK FINANCES
// =============================================================================

export interface ParkFinances {
  // Current balance
  cash: number;
  
  // Income (per month)
  incomeAdmissions: number;
  incomeRides: number;
  incomeFood: number;
  incomeShops: number;
  incomeTotal: number;
  
  // Expenses (per month)
  expenseWages: number;
  expenseUpkeep: number;
  expenseMarketing: number;
  expenseResearch: number;
  expenseTotal: number;
  
  // Profit
  profit: number;
  
  // Historical
  history: FinanceHistoryPoint[];
}

export interface FinanceHistoryPoint {
  month: number;
  year: number;
  income: number;
  expenses: number;
  profit: number;
  guests: number;
  parkValue: number;
}

// =============================================================================
// PARK STATS
// =============================================================================

export interface ParkStats {
  // Guest stats
  guestsInPark: number;
  guestsTotal: number;
  guestsSatisfied: number;
  guestsUnsatisfied: number;
  averageHappiness: number;
  
  // Ride stats
  totalRides: number;
  totalRidesRidden: number;
  averageQueueTime: number;
  
  // Financial stats
  parkValue: number;
  companyValue: number;
  
  // Rating
  parkRating: number; // 0-1000
}

// =============================================================================
// PARK SETTINGS
// =============================================================================

export interface ParkSettings {
  name: string;
  entranceFee: number;
  payPerRide: boolean; // If false, rides are free after admission
  
  // Operating hours
  openHour: number;
  closeHour: number;
  
  // Difficulty
  loanInterest: number;
  landCost: number;
  
  // Objectives (optional)
  objectives: ParkObjective[];
}

export interface ParkObjective {
  type: 'guests' | 'rating' | 'profit' | 'coasters' | 'park_value';
  target: number;
  deadline?: { month: number; year: number };
  completed: boolean;
}

// =============================================================================
// STAFF TYPES
// =============================================================================

export type StaffType = 'handyman' | 'mechanic' | 'security' | 'entertainer';

export interface Staff {
  id: string;
  type: StaffType;
  name: string;
  tileX: number;
  tileY: number;
  patrol: { x: number; y: number }[]; // Patrol area corners
  wage: number;
  energy: number;
  working: boolean;
}

// =============================================================================
// PRICE DEFAULTS
// =============================================================================

export const DEFAULT_PRICES = {
  parkEntrance: 50,
  rideTicket: 5,
  foodItem: 3,
  drinkItem: 2,
  shopItem: 10,
  
  // Staff wages (per month)
  handymanWage: 50,
  mechanicWage: 80,
  securityWage: 60,
  entertainerWage: 55,
};

// =============================================================================
// GUEST NAME GENERATOR
// =============================================================================

const FIRST_NAMES = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
  'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Charles', 'Karen', 'Emma', 'Oliver', 'Ava', 'Liam',
  'Sophia', 'Noah', 'Isabella', 'Mason', 'Mia', 'Ethan', 'Charlotte', 'Lucas',
  'Amelia', 'Benjamin', 'Harper', 'Alexander', 'Evelyn', 'Henry', 'Abigail', 'Sebastian',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
  'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
  'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young',
];

export function generateGuestName(): string {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${first} ${last}`;
}
