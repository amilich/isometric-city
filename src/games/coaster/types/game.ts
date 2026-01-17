/**
 * Coaster Tycoon Game State Types
 */

import { msg } from 'gt-next';
import { Building, BuildingType } from './buildings';
import { Coaster } from './tracks';
import { Guest, ParkFinances, ParkStats, ParkSettings, Staff } from './economy';

// =============================================================================
// TOOL TYPES
// =============================================================================

export type Tool =
  // Basic tools
  | 'select'
  | 'bulldoze'
  | 'path'
  | 'queue'
  
  // Coaster building
  | 'coaster_build'
  | 'coaster_station'
  
  // Trees & Vegetation
  | 'tree_oak' | 'tree_maple' | 'tree_birch' | 'tree_elm' | 'tree_willow'
  | 'tree_pine' | 'tree_spruce' | 'tree_fir' | 'tree_cedar' | 'tree_redwood'
  | 'tree_palm' | 'tree_banana' | 'tree_bamboo' | 'tree_coconut' | 'tree_tropical'
  | 'tree_cherry' | 'tree_magnolia' | 'tree_dogwood' | 'tree_jacaranda' | 'tree_wisteria'
  | 'bush_hedge' | 'bush_flowering' | 'topiary_ball' | 'topiary_spiral' | 'topiary_animal'
  | 'flowers_bed' | 'flowers_planter' | 'flowers_hanging' | 'flowers_wild' | 'ground_cover'
  
  // Path Furniture
  | 'bench_wooden' | 'bench_metal' | 'bench_ornate' | 'bench_modern' | 'bench_rustic'
  | 'lamp_victorian' | 'lamp_modern' | 'lamp_themed' | 'lamp_double' | 'lamp_pathway'
  | 'trash_can_basic' | 'trash_can_fancy' | 'trash_can_themed'
  
  // Food & Shops
  | 'food_hotdog' | 'food_burger' | 'food_icecream' | 'food_cotton_candy' | 'food_popcorn'
  | 'shop_souvenir' | 'shop_toys' | 'shop_photo' | 'restroom' | 'first_aid'
  
  // Flat Rides
  | 'ride_carousel' | 'ride_teacups' | 'ride_ferris_wheel' | 'ride_drop_tower' | 'ride_swing_ride'
  | 'ride_bumper_cars' | 'ride_go_karts' | 'ride_haunted_house' | 'ride_log_flume'
  
  // Infrastructure
  | 'park_entrance' | 'staff_building';

// =============================================================================
// TOOL INFO
// =============================================================================

export interface ToolInfo {
  name: string;
  cost: number;
  description: string;
  size?: { width: number; height: number };
  category: ToolCategory;
}

export type ToolCategory =
  | 'tools'
  | 'paths'
  | 'coasters'
  | 'trees'
  | 'flowers'
  | 'furniture'
  | 'food'
  | 'shops'
  | 'rides_small'
  | 'rides_large'
  | 'theming'
  | 'infrastructure';

export const TOOL_INFO: Record<Tool, ToolInfo> = {
  select: { name: msg('Select'), cost: 0, description: msg('Select and inspect'), category: 'tools' },
  bulldoze: { name: msg('Bulldoze'), cost: 10, description: msg('Remove objects'), category: 'tools' },
  path: { name: msg('Path'), cost: 10, description: msg('Build guest walkways'), category: 'paths' },
  queue: { name: msg('Queue Line'), cost: 15, description: msg('Build ride queues'), category: 'paths' },

  coaster_build: { name: msg('Build Coaster'), cost: 0, description: msg('Design roller coaster track'), category: 'coasters' },
  coaster_station: { name: msg('Coaster Station'), cost: 500, description: msg('Place coaster station'), category: 'coasters', size: { width: 2, height: 1 } },

  // Trees (sample - will be expanded)
  tree_oak: { name: msg('Oak Tree'), cost: 30, description: msg('Deciduous shade tree'), category: 'trees' },
  tree_maple: { name: msg('Maple Tree'), cost: 30, description: msg('Colorful maple tree'), category: 'trees' },
  tree_birch: { name: msg('Birch Tree'), cost: 25, description: msg('White bark birch'), category: 'trees' },
  tree_elm: { name: msg('Elm Tree'), cost: 30, description: msg('Classic elm tree'), category: 'trees' },
  tree_willow: { name: msg('Willow Tree'), cost: 40, description: msg('Weeping willow'), category: 'trees' },
  tree_pine: { name: msg('Pine Tree'), cost: 25, description: msg('Evergreen pine'), category: 'trees' },
  tree_spruce: { name: msg('Spruce Tree'), cost: 25, description: msg('Blue spruce'), category: 'trees' },
  tree_fir: { name: msg('Fir Tree'), cost: 25, description: msg('Douglas fir'), category: 'trees' },
  tree_cedar: { name: msg('Cedar Tree'), cost: 35, description: msg('Aromatic cedar'), category: 'trees' },
  tree_redwood: { name: msg('Redwood'), cost: 50, description: msg('Giant redwood'), category: 'trees' },
  tree_palm: { name: msg('Palm Tree'), cost: 40, description: msg('Tropical palm'), category: 'trees' },
  tree_banana: { name: msg('Banana Tree'), cost: 35, description: msg('Tropical banana plant'), category: 'trees' },
  tree_bamboo: { name: msg('Bamboo'), cost: 20, description: msg('Bamboo cluster'), category: 'trees' },
  tree_coconut: { name: msg('Coconut Palm'), cost: 45, description: msg('Tropical coconut palm'), category: 'trees' },
  tree_tropical: { name: msg('Tropical Tree'), cost: 40, description: msg('Exotic tropical tree'), category: 'trees' },
  tree_cherry: { name: msg('Cherry Blossom'), cost: 50, description: msg('Beautiful cherry blossom'), category: 'trees' },
  tree_magnolia: { name: msg('Magnolia'), cost: 45, description: msg('Flowering magnolia'), category: 'trees' },
  tree_dogwood: { name: msg('Dogwood'), cost: 40, description: msg('Flowering dogwood'), category: 'trees' },
  tree_jacaranda: { name: msg('Jacaranda'), cost: 50, description: msg('Purple jacaranda'), category: 'trees' },
  tree_wisteria: { name: msg('Wisteria'), cost: 55, description: msg('Cascading wisteria'), category: 'trees' },
  bush_hedge: { name: msg('Hedge'), cost: 15, description: msg('Trimmed hedge'), category: 'trees' },
  bush_flowering: { name: msg('Flowering Bush'), cost: 20, description: msg('Colorful flowering bush'), category: 'trees' },
  topiary_ball: { name: msg('Topiary Ball'), cost: 35, description: msg('Sculpted ball topiary'), category: 'trees' },
  topiary_spiral: { name: msg('Topiary Spiral'), cost: 45, description: msg('Spiral topiary'), category: 'trees' },
  topiary_animal: { name: msg('Animal Topiary'), cost: 60, description: msg('Animal-shaped topiary'), category: 'trees' },
  flowers_bed: { name: msg('Flower Bed'), cost: 20, description: msg('Colorful flower bed'), category: 'flowers' },
  flowers_planter: { name: msg('Flower Planter'), cost: 25, description: msg('Planter with flowers'), category: 'flowers' },
  flowers_hanging: { name: msg('Hanging Flowers'), cost: 30, description: msg('Hanging flower basket'), category: 'flowers' },
  flowers_wild: { name: msg('Wildflowers'), cost: 15, description: msg('Natural wildflowers'), category: 'flowers' },
  ground_cover: { name: msg('Ground Cover'), cost: 10, description: msg('Low ground cover plants'), category: 'flowers' },

  // Path furniture
  bench_wooden: { name: msg('Wooden Bench'), cost: 50, description: msg('Classic wooden bench'), category: 'furniture' },
  bench_metal: { name: msg('Metal Bench'), cost: 60, description: msg('Modern metal bench'), category: 'furniture' },
  bench_ornate: { name: msg('Ornate Bench'), cost: 80, description: msg('Decorative bench'), category: 'furniture' },
  bench_modern: { name: msg('Modern Bench'), cost: 70, description: msg('Contemporary bench'), category: 'furniture' },
  bench_rustic: { name: msg('Rustic Bench'), cost: 55, description: msg('Rustic log bench'), category: 'furniture' },
  lamp_victorian: { name: msg('Victorian Lamp'), cost: 100, description: msg('Classic street lamp'), category: 'furniture' },
  lamp_modern: { name: msg('Modern Lamp'), cost: 80, description: msg('Contemporary lamp'), category: 'furniture' },
  lamp_themed: { name: msg('Themed Lamp'), cost: 120, description: msg('Themed decorative lamp'), category: 'furniture' },
  lamp_double: { name: msg('Double Lamp'), cost: 150, description: msg('Double-headed lamp'), category: 'furniture' },
  lamp_pathway: { name: msg('Pathway Light'), cost: 60, description: msg('Low pathway light'), category: 'furniture' },
  trash_can_basic: { name: msg('Trash Can'), cost: 30, description: msg('Basic trash can'), category: 'furniture' },
  trash_can_fancy: { name: msg('Fancy Trash Can'), cost: 50, description: msg('Decorative trash can'), category: 'furniture' },
  trash_can_themed: { name: msg('Themed Trash Can'), cost: 70, description: msg('Themed trash can'), category: 'furniture' },

  // Food
  food_hotdog: { name: msg('Hot Dog Stand'), cost: 200, description: msg('Sells hot dogs'), category: 'food' },
  food_burger: { name: msg('Burger Stand'), cost: 250, description: msg('Sells burgers'), category: 'food' },
  food_icecream: { name: msg('Ice Cream Stand'), cost: 200, description: msg('Sells ice cream'), category: 'food' },
  food_cotton_candy: { name: msg('Cotton Candy'), cost: 150, description: msg('Sells cotton candy'), category: 'food' },
  food_popcorn: { name: msg('Popcorn Stand'), cost: 180, description: msg('Sells popcorn'), category: 'food' },

  // Shops
  shop_souvenir: { name: msg('Souvenir Shop'), cost: 400, description: msg('Sells souvenirs'), category: 'shops' },
  shop_toys: { name: msg('Toy Shop'), cost: 350, description: msg('Sells toys and plushies'), category: 'shops' },
  shop_photo: { name: msg('Photo Shop'), cost: 300, description: msg('On-ride photo sales'), category: 'shops' },
  restroom: { name: msg('Restroom'), cost: 300, description: msg('Guest restroom'), category: 'shops' },
  first_aid: { name: msg('First Aid'), cost: 400, description: msg('Medical station'), category: 'shops' },

  // Rides
  ride_carousel: { name: msg('Carousel'), cost: 5000, description: msg('Classic merry-go-round'), category: 'rides_small', size: { width: 2, height: 2 } },
  ride_teacups: { name: msg('Teacups'), cost: 4000, description: msg('Spinning teacups'), category: 'rides_small', size: { width: 2, height: 2 } },
  ride_ferris_wheel: { name: msg('Ferris Wheel'), cost: 15000, description: msg('Giant observation wheel'), category: 'rides_large', size: { width: 3, height: 3 } },
  ride_drop_tower: { name: msg('Drop Tower'), cost: 20000, description: msg('Thrilling drop ride'), category: 'rides_large', size: { width: 2, height: 2 } },
  ride_swing_ride: { name: msg('Swing Ride'), cost: 12000, description: msg('Flying swings'), category: 'rides_large', size: { width: 3, height: 3 } },
  ride_bumper_cars: { name: msg('Bumper Cars'), cost: 6000, description: msg('Classic bumper cars'), category: 'rides_small', size: { width: 3, height: 2 } },
  ride_go_karts: { name: msg('Go-Karts'), cost: 8000, description: msg('Racing go-karts'), category: 'rides_small', size: { width: 4, height: 3 } },
  ride_haunted_house: { name: msg('Haunted House'), cost: 10000, description: msg('Spooky dark ride'), category: 'rides_large', size: { width: 3, height: 3 } },
  ride_log_flume: { name: msg('Log Flume'), cost: 25000, description: msg('Water splash ride'), category: 'rides_large', size: { width: 2, height: 2 } },

  // Infrastructure
  park_entrance: { name: msg('Park Entrance'), cost: 1000, description: msg('Main park entrance'), category: 'infrastructure', size: { width: 3, height: 1 } },
  staff_building: { name: msg('Staff Building'), cost: 500, description: msg('Staff facilities'), category: 'infrastructure', size: { width: 2, height: 2 } },
};

// =============================================================================
// TILE TYPE
// =============================================================================

export interface Tile {
  x: number;
  y: number;
  terrain: 'grass' | 'water' | 'sand' | 'rock';
  building: Building;
  path: boolean;
  queue: boolean;
  queueRideId: string | null;
  hasCoasterTrack: boolean;
  coasterTrackId: string | null;
  elevation: number; // For terrain height
}

// =============================================================================
// NOTIFICATION TYPE
// =============================================================================

export interface Notification {
  id: string;
  title: string;
  description: string;
  icon: 'info' | 'warning' | 'success' | 'error' | 'guest' | 'ride' | 'money';
  timestamp: number;
  tileX?: number;
  tileY?: number;
}

// =============================================================================
// GAME STATE
// =============================================================================

export interface GameState {
  id: string;
  
  // Grid
  grid: Tile[][];
  gridSize: number;
  
  // Time
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  tick: number;
  speed: 0 | 1 | 2 | 3;
  
  // Park
  settings: ParkSettings;
  stats: ParkStats;
  finances: ParkFinances;
  
  // Entities
  guests: Guest[];
  staff: Staff[];
  coasters: Coaster[];
  
  // UI State
  selectedTool: Tool;
  activePanel: 'none' | 'finances' | 'guests' | 'rides' | 'staff' | 'settings';
  notifications: Notification[];
  
  // Active coaster building (if any)
  buildingCoasterId: string | null;
  
  // Version for save compatibility
  gameVersion: number;
}

// =============================================================================
// DEFAULT BUILDING
// =============================================================================

export function createEmptyBuilding(): Building {
  return {
    type: 'empty',
    level: 0,
    variant: 0,
    excitement: 0,
    intensity: 0,
    nausea: 0,
    capacity: 0,
    cycleTime: 0,
    price: 0,
    operating: false,
    broken: false,
    age: 0,
    constructionProgress: 100,
  };
}

// =============================================================================
// DEFAULT TILE
// =============================================================================

export function createEmptyTile(x: number, y: number): Tile {
  return {
    x,
    y,
    terrain: 'grass',
    building: createEmptyBuilding(),
    path: false,
    queue: false,
    queueRideId: null,
    hasCoasterTrack: false,
    coasterTrackId: null,
    elevation: 0,
  };
}
