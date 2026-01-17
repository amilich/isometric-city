/**
 * Coaster Tycoon Game State Types
 */

import { msg } from 'gt-next';
import { PathSurface, PathType, ParkBuilding, SceneryType, RideType, ShopType, Shop } from './buildings';
import { Guest, Staff } from './guests';
import { Ride, TrackElement, TrackPieceType } from './rides';

// =============================================================================
// TERRAIN
// =============================================================================

export type TerrainType = 'grass' | 'sand' | 'dirt' | 'rock' | 'water';

// =============================================================================
// PARK TILE
// =============================================================================

export interface ParkTile {
  x: number;
  y: number;
  
  // Terrain
  terrain: TerrainType;
  height: number;           // 0-15 height levels (each ~2m)
  
  // Path (optional)
  path?: {
    surface: PathSurface;
    type: PathType;
    connections: {
      north: boolean;
      east: boolean;
      south: boolean;
      west: boolean;
    };
    queueRideId?: string;   // If this is a queue path for a ride
    litter: number;         // 0-100 cleanliness
    vomit: boolean;
  };
  
  // Building (optional) - ride, shop, or scenery
  building?: ParkBuilding;
  
  // Track piece (optional) - for coasters/tracked rides
  trackPiece?: {
    rideId: string;
    element: TrackElement;
  };
  
  // Ownership
  owned: boolean;           // Is this tile part of the park?
  forSale: boolean;         // Can it be purchased?
  purchasePrice: number;
}

// =============================================================================
// WEATHER
// =============================================================================

export type WeatherType = 'sunny' | 'cloudy' | 'light_rain' | 'heavy_rain' | 'thunder' | 'snow';

export interface Weather {
  current: WeatherType;
  temperature: number;      // Celsius
  windSpeed: number;        // km/h
}

// =============================================================================
// FINANCES
// =============================================================================

export interface FinancialRecord {
  month: number;
  year: number;
  
  // Income
  parkEntranceFees: number;
  rideTickets: number;
  shopSales: number;
  facilityUsage: number;
  
  // Expenses
  rideRunning: number;
  shopRunning: number;
  staffWages: number;
  marketing: number;
  research: number;
  loanInterest: number;
  construction: number;
  
  // Totals
  totalIncome: number;
  totalExpenses: number;
  profit: number;
}

export interface Finances {
  cash: number;
  loan: number;
  maxLoan: number;
  loanInterestRate: number;  // Per year (e.g., 10 = 10%)
  
  parkValue: number;
  companyValue: number;
  
  // Current period
  currentMonthRecord: FinancialRecord;
  
  // History
  history: FinancialRecord[];
}

// =============================================================================
// RESEARCH
// =============================================================================

export type ResearchCategory = 
  | 'roller_coasters'
  | 'thrill_rides'
  | 'gentle_rides'
  | 'water_rides'
  | 'shops'
  | 'scenery'
  | 'transport';

export interface ResearchItem {
  type: string;             // RideType or ShopType
  category: ResearchCategory;
  name: string;
  researchCost: number;
}

export interface Research {
  currentItem?: ResearchItem;
  progress: number;         // 0-100%
  funding: number;          // Per month
  
  unlockedRides: string[];
  unlockedShops: string[];
  unlockedScenery: string[];
  
  priorities: ResearchCategory[];
}

// =============================================================================
// MARKETING
// =============================================================================

export type CampaignType =
  | 'park_entry_free'       // Free entry for a week
  | 'park_entry_half'       // Half price entry
  | 'ride_free'             // Free specific ride
  | 'advertising_campaign'  // General advertising
  | 'vouchers';             // Discount vouchers

export interface MarketingCampaign {
  type: CampaignType;
  rideId?: string;          // For ride-specific campaigns
  weeksRemaining: number;
  cost: number;
}

// =============================================================================
// AWARDS
// =============================================================================

export type AwardType =
  | 'most_beautiful'
  | 'best_value'
  | 'safest'
  | 'best_staff'
  | 'cleanest'
  | 'best_food'
  | 'most_disappointing'    // Negative award
  | 'worst_value'           // Negative award
  | 'most_untidy';          // Negative award

export interface Award {
  type: AwardType;
  year: number;
  month: number;
}

// =============================================================================
// PARK INFO
// =============================================================================

export interface ParkInfo {
  name: string;
  
  // Entrance
  entranceX: number;
  entranceY: number;
  entranceFee: number;
  
  // Operating hours
  openingHour: number;      // 0-23
  closingHour: number;
  isOpen: boolean;
  
  // Rating
  parkRating: number;       // 0-999
  parkRatingHistory: number[]; // Last 30 days
  
  // Objectives
  objective?: ParkObjective;
}

export interface ParkObjective {
  type: 'guests' | 'park_value' | 'rating' | 'profit' | 'coasters';
  target: number;
  deadline?: { year: number; month: number };
  completed: boolean;
}

// =============================================================================
// TOOLS
// =============================================================================

export type CoasterTool =
  // Selection & Destruction
  | 'select'
  | 'bulldoze'
  
  // Paths
  | 'path_standard'
  | 'path_queue'
  
  // Terrain
  | 'terrain_raise'
  | 'terrain_lower'
  | 'terrain_smooth'
  | 'terrain_water'
  | 'terrain_own_land'
  
  // Rides (selected from menu)
  | 'place_ride'

  // Shops (selected from menu)
  | 'place_shop'
  
  // Scenery (selected from menu)
  | 'place_scenery'
  
  // Staff
  | 'hire_handyman'
  | 'hire_mechanic'
  | 'hire_security'
  | 'hire_entertainer';

export interface ToolInfo {
  name: string;
  cost: number;
  description: string;
}

export const TOOL_INFO: Record<CoasterTool, ToolInfo> = {
  select: { name: msg('Select'), cost: 0, description: msg('Select and inspect items') },
  bulldoze: { name: msg('Demolish'), cost: 0, description: msg('Remove paths, rides, and scenery') },
  path_standard: { name: msg('Footpath'), cost: 20, description: msg('Build guest walkways') },
  path_queue: { name: msg('Queue Path'), cost: 25, description: msg('Build ride queue lines') },
  terrain_raise: { name: msg('Raise Land'), cost: 50, description: msg('Raise terrain height') },
  terrain_lower: { name: msg('Lower Land'), cost: 50, description: msg('Lower terrain height') },
  terrain_smooth: { name: msg('Smooth Land'), cost: 30, description: msg('Smooth terrain slopes') },
  terrain_water: { name: msg('Add Water'), cost: 100, description: msg('Create water features') },
  terrain_own_land: { name: msg('Buy Land'), cost: 0, description: msg('Purchase land for the park') },
  place_ride: { name: msg('Place Ride'), cost: 0, description: msg('Build a new ride') },
  place_shop: { name: msg('Place Shop'), cost: 0, description: msg('Build a new shop or facility') },
  place_scenery: { name: msg('Place Scenery'), cost: 0, description: msg('Add decorations') },
  hire_handyman: { name: msg('Hire Handyman'), cost: 500, description: msg('Employ a cleaner') },
  hire_mechanic: { name: msg('Hire Mechanic'), cost: 800, description: msg('Employ a mechanic') },
  hire_security: { name: msg('Hire Security'), cost: 600, description: msg('Employ a guard') },
  hire_entertainer: { name: msg('Hire Entertainer'), cost: 550, description: msg('Employ an entertainer') },
};

// =============================================================================
// NOTIFICATIONS
// =============================================================================

export type NotificationType =
  | 'ride_completed'
  | 'ride_breakdown'
  | 'ride_fixed'
  | 'guest_lost'
  | 'guest_drowned'
  | 'award_won'
  | 'award_lost'
  | 'research_complete'
  | 'objective_complete'
  | 'objective_failed'
  | 'vandalism'
  | 'rating_change';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  rideId?: string;
  guestId?: number;
  read: boolean;
}

// =============================================================================
// GAME STATE
// =============================================================================

export interface CoasterGameState {
  id: string;
  
  // Grid
  grid: ParkTile[][];
  gridSize: number;
  
  // Time
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  tick: number;
  speed: 0 | 1 | 2 | 3;
  
  // Park Info
  park: ParkInfo;
  
  // Weather
  weather: Weather;
  
  // Entities
  guests: Guest[];
  staff: Staff[];
  rides: Ride[];
  shops: Shop[];
  
  // Finances
  finances: Finances;
  
  // Research
  research: Research;
  
  // Marketing
  activeCampaigns: MarketingCampaign[];
  
  // Awards
  awards: Award[];
  
  // UI State
  selectedTool: CoasterTool;
  selectedRideType?: RideType;
  selectedShopType?: ShopType;
  selectedSceneryType?: SceneryType;
  activePanel: 'none' | 'rides' | 'guests' | 'staff' | 'finances' | 'research' | 'park' | 'settings';
  trackBuildRideId?: string;
  selectedTrackPiece?: TrackPieceType;
  trackBuildError?: string;
  
  // Notifications
  notifications: Notification[];
  
  // Game version (for migrations)
  gameVersion: number;
}

// =============================================================================
// SAVED GAME METADATA
// =============================================================================

export interface SavedParkMeta {
  id: string;
  parkName: string;
  guestCount: number;
  cash: number;
  parkRating: number;
  year: number;
  month: number;
  gridSize: number;
  savedAt: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const DEFAULT_GRID_SIZE = 64;
export const MAX_GUESTS = 10000;
export const MAX_STAFF = 200;
export const MAX_RIDES = 255;
export const TILE_HEIGHT_UNIT = 2; // meters per height level
