/**
 * IsoCoaster Game State Types
 */

import { Building, BuildingType } from './buildings';
import { Coaster, TrackPiece, TrackDirection } from './tracks';
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
  | 'coaster_track'
  | 'coaster_turn_left'
  | 'coaster_turn_right'
  | 'coaster_slope_up'
  | 'coaster_slope_down'
  | 'coaster_loop'
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
  
  // Fountains & Water Features
  | 'fountain_small_1' | 'fountain_small_2' | 'fountain_small_3' | 'fountain_small_4' | 'fountain_small_5'
  | 'fountain_medium_1' | 'fountain_medium_2' | 'fountain_medium_3' | 'fountain_medium_4' | 'fountain_medium_5'
  | 'fountain_large_1' | 'fountain_large_2' | 'fountain_large_3' | 'fountain_large_4' | 'fountain_large_5'
  | 'pond_small' | 'pond_medium' | 'pond_large' | 'pond_koi' | 'pond_lily'
  | 'splash_pad' | 'water_jets' | 'mist_fountain' | 'interactive_fountain' | 'dancing_fountain'
  
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
  | 'fountains'
  | 'food'
  | 'shops'
  | 'rides_small'
  | 'rides_large'
  | 'theming'
  | 'infrastructure';

export const TOOL_INFO: Record<Tool, ToolInfo> = {
  select: { name: 'Select', cost: 0, description: 'Select and inspect', category: 'tools' },
  bulldoze: { name: 'Bulldoze', cost: 10, description: 'Remove objects', category: 'tools' },
  path: { name: 'Path', cost: 10, description: 'Build guest walkways', category: 'paths' },
  queue: { name: 'Queue Line', cost: 15, description: 'Build ride queues', category: 'paths' },
  
  coaster_build: { name: 'Coaster Build Mode', cost: 0, description: 'Start building a coaster', category: 'coasters' },
  coaster_track: { name: 'Track: Straight', cost: 20, description: 'Place straight track segments', category: 'coasters' },
  coaster_turn_left: { name: 'Track: Left Turn', cost: 25, description: 'Place a left turn segment', category: 'coasters' },
  coaster_turn_right: { name: 'Track: Right Turn', cost: 25, description: 'Place a right turn segment', category: 'coasters' },
  coaster_slope_up: { name: 'Track: Slope Up', cost: 30, description: 'Place a rising track segment', category: 'coasters' },
  coaster_slope_down: { name: 'Track: Slope Down', cost: 30, description: 'Place a descending track segment', category: 'coasters' },
  coaster_loop: { name: 'Track: Loop', cost: 150, description: 'Place a vertical loop element', category: 'coasters' },
  coaster_station: { name: 'Coaster Station', cost: 500, description: 'Place coaster station', category: 'coasters', size: { width: 2, height: 1 } },
  
  // Trees (sample - will be expanded)
  tree_oak: { name: 'Oak Tree', cost: 30, description: 'Deciduous shade tree', category: 'trees' },
  tree_maple: { name: 'Maple Tree', cost: 30, description: 'Colorful maple tree', category: 'trees' },
  tree_birch: { name: 'Birch Tree', cost: 25, description: 'White bark birch', category: 'trees' },
  tree_elm: { name: 'Elm Tree', cost: 30, description: 'Classic elm tree', category: 'trees' },
  tree_willow: { name: 'Willow Tree', cost: 40, description: 'Weeping willow', category: 'trees' },
  tree_pine: { name: 'Pine Tree', cost: 25, description: 'Evergreen pine', category: 'trees' },
  tree_spruce: { name: 'Spruce Tree', cost: 25, description: 'Blue spruce', category: 'trees' },
  tree_fir: { name: 'Fir Tree', cost: 25, description: 'Douglas fir', category: 'trees' },
  tree_cedar: { name: 'Cedar Tree', cost: 35, description: 'Aromatic cedar', category: 'trees' },
  tree_redwood: { name: 'Redwood', cost: 50, description: 'Giant redwood', category: 'trees' },
  tree_palm: { name: 'Palm Tree', cost: 40, description: 'Tropical palm', category: 'trees' },
  tree_banana: { name: 'Banana Tree', cost: 35, description: 'Tropical banana plant', category: 'trees' },
  tree_bamboo: { name: 'Bamboo', cost: 20, description: 'Bamboo cluster', category: 'trees' },
  tree_coconut: { name: 'Coconut Palm', cost: 45, description: 'Tropical coconut palm', category: 'trees' },
  tree_tropical: { name: 'Tropical Tree', cost: 40, description: 'Exotic tropical tree', category: 'trees' },
  tree_cherry: { name: 'Cherry Blossom', cost: 50, description: 'Beautiful cherry blossom', category: 'trees' },
  tree_magnolia: { name: 'Magnolia', cost: 45, description: 'Flowering magnolia', category: 'trees' },
  tree_dogwood: { name: 'Dogwood', cost: 40, description: 'Flowering dogwood', category: 'trees' },
  tree_jacaranda: { name: 'Jacaranda', cost: 50, description: 'Purple jacaranda', category: 'trees' },
  tree_wisteria: { name: 'Wisteria', cost: 55, description: 'Cascading wisteria', category: 'trees' },
  bush_hedge: { name: 'Hedge', cost: 15, description: 'Trimmed hedge', category: 'trees' },
  bush_flowering: { name: 'Flowering Bush', cost: 20, description: 'Colorful flowering bush', category: 'trees' },
  topiary_ball: { name: 'Topiary Ball', cost: 35, description: 'Sculpted ball topiary', category: 'trees' },
  topiary_spiral: { name: 'Topiary Spiral', cost: 45, description: 'Spiral topiary', category: 'trees' },
  topiary_animal: { name: 'Animal Topiary', cost: 60, description: 'Animal-shaped topiary', category: 'trees' },
  flowers_bed: { name: 'Flower Bed', cost: 20, description: 'Colorful flower bed', category: 'flowers' },
  flowers_planter: { name: 'Flower Planter', cost: 25, description: 'Planter with flowers', category: 'flowers' },
  flowers_hanging: { name: 'Hanging Flowers', cost: 30, description: 'Hanging flower basket', category: 'flowers' },
  flowers_wild: { name: 'Wildflowers', cost: 15, description: 'Natural wildflowers', category: 'flowers' },
  ground_cover: { name: 'Ground Cover', cost: 10, description: 'Low ground cover plants', category: 'flowers' },
  
  // Path furniture
  bench_wooden: { name: 'Wooden Bench', cost: 50, description: 'Classic wooden bench', category: 'furniture' },
  bench_metal: { name: 'Metal Bench', cost: 60, description: 'Modern metal bench', category: 'furniture' },
  bench_ornate: { name: 'Ornate Bench', cost: 80, description: 'Decorative bench', category: 'furniture' },
  bench_modern: { name: 'Modern Bench', cost: 70, description: 'Contemporary bench', category: 'furniture' },
  bench_rustic: { name: 'Rustic Bench', cost: 55, description: 'Rustic log bench', category: 'furniture' },
  lamp_victorian: { name: 'Victorian Lamp', cost: 100, description: 'Classic street lamp', category: 'furniture' },
  lamp_modern: { name: 'Modern Lamp', cost: 80, description: 'Contemporary lamp', category: 'furniture' },
  lamp_themed: { name: 'Themed Lamp', cost: 120, description: 'Themed decorative lamp', category: 'furniture' },
  lamp_double: { name: 'Double Lamp', cost: 150, description: 'Double-headed lamp', category: 'furniture' },
  lamp_pathway: { name: 'Pathway Light', cost: 60, description: 'Low pathway light', category: 'furniture' },
  trash_can_basic: { name: 'Trash Can', cost: 30, description: 'Basic trash can', category: 'furniture' },
  trash_can_fancy: { name: 'Fancy Trash Can', cost: 50, description: 'Decorative trash can', category: 'furniture' },
  trash_can_themed: { name: 'Themed Trash Can', cost: 70, description: 'Themed trash can', category: 'furniture' },
  
  // Fountains - Small
  fountain_small_1: { name: 'Small Fountain', cost: 150, description: 'Simple small fountain', category: 'fountains' },
  fountain_small_2: { name: 'Small Tiered Fountain', cost: 175, description: 'Small tiered fountain', category: 'fountains' },
  fountain_small_3: { name: 'Small Classic Fountain', cost: 180, description: 'Classic small fountain', category: 'fountains' },
  fountain_small_4: { name: 'Small Modern Fountain', cost: 200, description: 'Modern small fountain', category: 'fountains' },
  fountain_small_5: { name: 'Small Ornate Fountain', cost: 220, description: 'Ornate small fountain', category: 'fountains' },
  
  // Fountains - Medium
  fountain_medium_1: { name: 'Medium Fountain', cost: 350, description: 'Standard medium fountain', category: 'fountains' },
  fountain_medium_2: { name: 'Medium Tiered Fountain', cost: 400, description: 'Tiered medium fountain', category: 'fountains' },
  fountain_medium_3: { name: 'Medium Classic Fountain', cost: 425, description: 'Classic medium fountain', category: 'fountains' },
  fountain_medium_4: { name: 'Medium Modern Fountain', cost: 450, description: 'Modern medium fountain', category: 'fountains' },
  fountain_medium_5: { name: 'Medium Ornate Fountain', cost: 500, description: 'Ornate medium fountain', category: 'fountains' },
  
  // Fountains - Large
  fountain_large_1: { name: 'Large Fountain', cost: 800, description: 'Grand large fountain', category: 'fountains', size: { width: 2, height: 2 } },
  fountain_large_2: { name: 'Large Tiered Fountain', cost: 900, description: 'Tiered large fountain', category: 'fountains', size: { width: 2, height: 2 } },
  fountain_large_3: { name: 'Large Classic Fountain', cost: 950, description: 'Classic large fountain', category: 'fountains', size: { width: 2, height: 2 } },
  fountain_large_4: { name: 'Large Modern Fountain', cost: 1000, description: 'Modern large fountain', category: 'fountains', size: { width: 2, height: 2 } },
  fountain_large_5: { name: 'Large Ornate Fountain', cost: 1200, description: 'Ornate large fountain', category: 'fountains', size: { width: 2, height: 2 } },
  
  // Ponds
  pond_small: { name: 'Small Pond', cost: 200, description: 'Small decorative pond', category: 'fountains' },
  pond_medium: { name: 'Medium Pond', cost: 350, description: 'Medium decorative pond', category: 'fountains' },
  pond_large: { name: 'Large Pond', cost: 500, description: 'Large decorative pond', category: 'fountains', size: { width: 2, height: 2 } },
  pond_koi: { name: 'Koi Pond', cost: 600, description: 'Pond with koi fish', category: 'fountains' },
  pond_lily: { name: 'Lily Pond', cost: 400, description: 'Pond with water lilies', category: 'fountains' },
  
  // Interactive Water Features
  splash_pad: { name: 'Splash Pad', cost: 450, description: 'Interactive splash zone', category: 'fountains' },
  water_jets: { name: 'Water Jets', cost: 300, description: 'Jumping water jets', category: 'fountains' },
  mist_fountain: { name: 'Mist Fountain', cost: 350, description: 'Cooling mist fountain', category: 'fountains' },
  interactive_fountain: { name: 'Interactive Fountain', cost: 550, description: 'Guest-activated fountain', category: 'fountains' },
  dancing_fountain: { name: 'Dancing Fountain', cost: 800, description: 'Choreographed water show', category: 'fountains', size: { width: 2, height: 2 } },
  
  // Food
  food_hotdog: { name: 'Hot Dog Stand', cost: 200, description: 'Sells hot dogs', category: 'food' },
  food_burger: { name: 'Burger Stand', cost: 250, description: 'Sells burgers', category: 'food' },
  food_icecream: { name: 'Ice Cream Stand', cost: 200, description: 'Sells ice cream', category: 'food' },
  food_cotton_candy: { name: 'Cotton Candy', cost: 150, description: 'Sells cotton candy', category: 'food' },
  food_popcorn: { name: 'Popcorn Stand', cost: 180, description: 'Sells popcorn', category: 'food' },
  
  // Shops
  shop_souvenir: { name: 'Souvenir Shop', cost: 400, description: 'Sells souvenirs', category: 'shops' },
  shop_toys: { name: 'Toy Shop', cost: 350, description: 'Sells toys and plushies', category: 'shops' },
  shop_photo: { name: 'Photo Shop', cost: 300, description: 'On-ride photo sales', category: 'shops' },
  restroom: { name: 'Restroom', cost: 300, description: 'Guest restroom', category: 'shops' },
  first_aid: { name: 'First Aid', cost: 400, description: 'Medical station', category: 'shops' },
  
  // Rides
  ride_carousel: { name: 'Carousel', cost: 5000, description: 'Classic merry-go-round', category: 'rides_small', size: { width: 2, height: 2 } },
  ride_teacups: { name: 'Teacups', cost: 4000, description: 'Spinning teacups', category: 'rides_small', size: { width: 2, height: 2 } },
  ride_ferris_wheel: { name: 'Ferris Wheel', cost: 15000, description: 'Giant observation wheel', category: 'rides_large', size: { width: 3, height: 3 } },
  ride_drop_tower: { name: 'Drop Tower', cost: 20000, description: 'Thrilling drop ride', category: 'rides_large', size: { width: 2, height: 2 } },
  ride_swing_ride: { name: 'Swing Ride', cost: 12000, description: 'Flying swings', category: 'rides_large', size: { width: 3, height: 3 } },
  ride_bumper_cars: { name: 'Bumper Cars', cost: 6000, description: 'Classic bumper cars', category: 'rides_small', size: { width: 3, height: 2 } },
  ride_go_karts: { name: 'Go-Karts', cost: 8000, description: 'Racing go-karts', category: 'rides_small', size: { width: 4, height: 3 } },
  ride_haunted_house: { name: 'Haunted House', cost: 10000, description: 'Spooky dark ride', category: 'rides_large', size: { width: 3, height: 3 } },
  ride_log_flume: { name: 'Log Flume', cost: 25000, description: 'Water splash ride', category: 'rides_large', size: { width: 2, height: 2 } },
  
  // Infrastructure
  park_entrance: { name: 'Park Entrance', cost: 1000, description: 'Main park entrance', category: 'infrastructure', size: { width: 3, height: 1 } },
  staff_building: { name: 'Staff Building', cost: 500, description: 'Staff facilities', category: 'infrastructure', size: { width: 2, height: 2 } },
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
  trackPiece: TrackPiece | null;
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
  buildingCoasterPath: { x: number; y: number }[];
  buildingCoasterHeight: number;
  buildingCoasterLastDirection: TrackDirection | null;
  
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
    trackPiece: null,
    elevation: 0,
  };
}
