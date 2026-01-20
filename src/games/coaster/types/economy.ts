/**
 * IsoCoaster Economy & Guest Types
 * Defines guests, money, satisfaction, and park management
 */

// =============================================================================
// WEATHER SYSTEM
// =============================================================================

export type WeatherType = 'sunny' | 'partly_cloudy' | 'cloudy' | 'rain' | 'storm' | 'hot' | 'cold';

export interface WeatherState {
  current: WeatherType;
  temperature: number; // Celsius
  nextChange: number; // Tick when weather will change
  forecast: WeatherType[]; // Next 3 weather conditions
}

export interface WeatherEffects {
  guestSpawnMultiplier: number; // Affects how many new guests arrive
  happinessModifier: number; // Added to guest happiness per tick
  thirstModifier: number; // Added to guest thirst per tick
  energyModifier: number; // Added to guest energy drain per tick
  outdoorRidePopularity: number; // Multiplier for outdoor ride preference
  waterRidePopularity: number; // Multiplier for water ride preference
  indoorRidePopularity: number; // Multiplier for indoor/covered ride preference
  foodSalesMultiplier: number; // Affects food stand revenue
  drinkSalesMultiplier: number; // Affects drink stand revenue
  leaveChanceMultiplier: number; // Multiplier for guests deciding to leave
}

export const WEATHER_EFFECTS: Record<WeatherType, WeatherEffects> = {
  sunny: {
    guestSpawnMultiplier: 1.15,  // Slight boost
    happinessModifier: 0.1,
    thirstModifier: 0.1,
    energyModifier: 0.02,
    outdoorRidePopularity: 1.1,
    waterRidePopularity: 1.2,
    indoorRidePopularity: 0.95,
    foodSalesMultiplier: 1.0,
    drinkSalesMultiplier: 1.2,
    leaveChanceMultiplier: 0.9,
  },
  partly_cloudy: {
    guestSpawnMultiplier: 1.05,
    happinessModifier: 0.05,
    thirstModifier: 0.02,
    energyModifier: 0,
    outdoorRidePopularity: 1.05,
    waterRidePopularity: 1.0,
    indoorRidePopularity: 1.0,
    foodSalesMultiplier: 1.0,
    drinkSalesMultiplier: 1.0,
    leaveChanceMultiplier: 0.95,
  },
  cloudy: {
    guestSpawnMultiplier: 1.0,  // Normal - baseline
    happinessModifier: 0,
    thirstModifier: 0,
    energyModifier: 0,
    outdoorRidePopularity: 1.0,
    waterRidePopularity: 0.9,
    indoorRidePopularity: 1.05,
    foodSalesMultiplier: 1.0,
    drinkSalesMultiplier: 0.95,
    leaveChanceMultiplier: 1.0,
  },
  rain: {
    guestSpawnMultiplier: 0.85,  // Mild reduction, not drastic
    happinessModifier: -0.1,
    thirstModifier: -0.05,
    energyModifier: 0.02,
    outdoorRidePopularity: 0.7,
    waterRidePopularity: 0.6,
    indoorRidePopularity: 1.3,
    foodSalesMultiplier: 0.9,
    drinkSalesMultiplier: 0.8,
    leaveChanceMultiplier: 1.15,  // Slightly more likely to leave
  },
  storm: {
    guestSpawnMultiplier: 0.7,  // Still get guests, just fewer
    happinessModifier: -0.2,
    thirstModifier: -0.1,
    energyModifier: 0.05,
    outdoorRidePopularity: 0.4,
    waterRidePopularity: 0.3,
    indoorRidePopularity: 1.5,
    foodSalesMultiplier: 0.8,
    drinkSalesMultiplier: 0.7,
    leaveChanceMultiplier: 1.3,  // Moderate increase
  },
  hot: {
    guestSpawnMultiplier: 1.0,
    happinessModifier: -0.05,
    thirstModifier: 0.2,
    energyModifier: 0.05,
    outdoorRidePopularity: 0.9,
    waterRidePopularity: 1.4,
    indoorRidePopularity: 1.1,
    foodSalesMultiplier: 0.95,
    drinkSalesMultiplier: 1.5,
    leaveChanceMultiplier: 1.05,
  },
  cold: {
    guestSpawnMultiplier: 0.9,
    happinessModifier: -0.03,
    thirstModifier: -0.05,
    energyModifier: 0.02,
    outdoorRidePopularity: 0.85,
    waterRidePopularity: 0.5,
    indoorRidePopularity: 1.2,
    foodSalesMultiplier: 1.15,
    drinkSalesMultiplier: 0.85,
    leaveChanceMultiplier: 1.08,
  },
};

export const WEATHER_DISPLAY: Record<WeatherType, { name: string; icon: string; color: string }> = {
  sunny: { name: 'Sunny', icon: '☀️', color: '#fbbf24' },
  partly_cloudy: { name: 'Partly Cloudy', icon: '⛅', color: '#94a3b8' },
  cloudy: { name: 'Cloudy', icon: '☁️', color: '#64748b' },
  rain: { name: 'Rain', icon: '🌧️', color: '#3b82f6' },
  storm: { name: 'Storm', icon: '⛈️', color: '#6366f1' },
  hot: { name: 'Heat Wave', icon: '🔥', color: '#ef4444' },
  cold: { name: 'Cold', icon: '❄️', color: '#06b6d4' },
};

// Weather transition probabilities based on current weather
// Balanced for fun gameplay - good weather is more common, bad weather clears quickly
export const WEATHER_TRANSITIONS: Record<WeatherType, Partial<Record<WeatherType, number>>> = {
  sunny: { sunny: 0.6, partly_cloudy: 0.25, hot: 0.1, cloudy: 0.05 },
  partly_cloudy: { sunny: 0.4, partly_cloudy: 0.35, cloudy: 0.15, rain: 0.05, hot: 0.05 },
  cloudy: { cloudy: 0.25, partly_cloudy: 0.35, sunny: 0.2, rain: 0.15, cold: 0.05 },
  rain: { partly_cloudy: 0.35, cloudy: 0.35, rain: 0.2, storm: 0.05, sunny: 0.05 },  // Rain clears up faster
  storm: { rain: 0.3, cloudy: 0.4, partly_cloudy: 0.25, storm: 0.05 },  // Storms clear quickly
  hot: { sunny: 0.45, hot: 0.3, partly_cloudy: 0.2, storm: 0.05 },
  cold: { partly_cloudy: 0.35, cloudy: 0.3, cold: 0.2, sunny: 0.15 },  // Cold clears up
};

// Season affects base weather probabilities
// Balanced for fun - always some good weather in every season
export function getSeasonalWeatherBias(month: number): Partial<Record<WeatherType, number>> {
  // Spring (March-May): Mild mix, slightly rainy but mostly nice
  if (month >= 3 && month <= 5) {
    return { sunny: 1.2, partly_cloudy: 1.1, rain: 0.9, cloudy: 1.0 };
  }
  // Summer (June-August): Mostly sunny and hot
  if (month >= 6 && month <= 8) {
    return { sunny: 1.4, hot: 1.3, partly_cloudy: 1.0, storm: 0.7, rain: 0.5 };
  }
  // Fall (September-November): Mild, some clouds
  if (month >= 9 && month <= 11) {
    return { cloudy: 1.1, partly_cloudy: 1.2, sunny: 0.9, cold: 0.8, rain: 0.8 };
  }
  // Winter (December-February): Colder but still playable
  return { cold: 1.2, cloudy: 1.1, partly_cloudy: 1.0, sunny: 0.8 };
}

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
  | 'exiting_building' // Walking out of shop/food stand
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
  | 'good_value'
  // Weather-related thoughts
  | 'weather_great'
  | 'getting_wet'
  | 'too_hot'
  | 'too_cold'
  | 'need_shelter'
  | 'perfect_day';

// Guest thought display text
export const GUEST_THOUGHT_TEXT: Record<GuestThought, string> = {
  happy: "I'm having a great time!",
  excited: "This is so exciting!",
  hungry: "I'm getting hungry...",
  thirsty: "I need a drink!",
  tired: "My feet are killing me.",
  need_bathroom: "Where's the restroom?",
  lost: "I can't find my way...",
  queue_too_long: "This queue is too long!",
  ride_was_great: "That ride was amazing!",
  ride_was_scary: "That was terrifying!",
  ride_made_sick: "I feel sick...",
  path_disgusting: "This path is disgusting!",
  scenery_beautiful: "The scenery here is beautiful!",
  want_to_go_home: "I want to go home.",
  cant_find_exit: "Where's the exit?",
  spent_too_much: "I've spent too much money.",
  good_value: "Great value for money!",
  weather_great: "What lovely weather!",
  getting_wet: "I'm getting soaked!",
  too_hot: "It's so hot today!",
  too_cold: "Brrr, it's cold!",
  need_shelter: "I need to find shelter!",
  perfect_day: "Perfect day for the park!",
};

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
  
  // Approach state (for walking into shops/food stands)
  approachProgress: number; // 0 = on path, 1 = at building
  initialActivityTime: number; // Total time for eating/shopping (to calculate approach progress)
  activityStartTime: number; // Real-time timestamp when activity started (for smooth animation)
  
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
