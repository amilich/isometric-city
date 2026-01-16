import { GridPosition } from '@/core/types';
import { Finance, Research } from './economy';
import { Guest } from './guests';
import { Ride } from './rides';
import { Staff } from './staff';
import { CoasterTile } from './tiles';
import { TrackTrain } from './tracks';

export type PanelType =
  | 'none'
  | 'rides'
  | 'guests'
  | 'finance'
  | 'staff'
  | 'research'
  | 'park';

export type WeatherType = 'sunny' | 'cloudy' | 'rainy' | 'stormy';

export type WeatherState = {
  type: WeatherType;
  temperature: number;
  rainLevel: number;
  windSpeed: number;
};

export type ParkStats = {
  guestsInPark: number;
  totalGuests: number;
  rating: number;
  cleanliness: number;
  excitement: number;
  nausea: number;
};

export type CoasterTool =
  | 'select'
  | 'pan'
  | 'path'
  | 'queue_path'
  | 'bulldoze'
  | 'terrain_raise'
  | 'terrain_lower'
  | 'terrain_smooth'
  | 'water'
  | 'coaster_track'
  | 'scenery_tree'
  | 'scenery_flower'
  | 'ride_carousel'
  | 'ride_ferris_wheel'
  | 'ride_bumper_cars'
  | 'ride_swing'
  | 'ride_haunted_house'
  | 'ride_spiral_slide'
  | 'shop_food'
  | 'shop_drink'
  | 'shop_toilet'
  | 'staff_handyman'
  | 'staff_mechanic'
  | 'staff_security'
  | 'staff_entertainer';

export type ToolInfo = {
  name: string;
  cost: number;
  description: string;
  size?: number;
};

export const TOOL_INFO: Record<CoasterTool, ToolInfo> = {
  select: { name: 'Select', cost: 0, description: 'Inspect rides, guests, and scenery' },
  pan: { name: 'Pan', cost: 0, description: 'Move the camera around the park' },
  path: { name: 'Path', cost: 10, description: 'Build footpaths for guests', size: 1 },
  queue_path: { name: 'Queue', cost: 10, description: 'Build queue paths for rides', size: 1 },
  bulldoze: { name: 'Bulldoze', cost: 5, description: 'Remove paths and objects' },
  terrain_raise: { name: 'Raise Land', cost: 20, description: 'Increase terrain height' },
  terrain_lower: { name: 'Lower Land', cost: 20, description: 'Decrease terrain height' },
  terrain_smooth: { name: 'Smooth Land', cost: 5, description: 'Smooth terrain slopes' },
  water: { name: 'Water', cost: 30, description: 'Place or remove water tiles' },
  coaster_track: { name: 'Coaster Track', cost: 15, description: 'Lay coaster track segments', size: 1 },
  scenery_tree: { name: 'Tree', cost: 15, description: 'Plant a tree for scenery', size: 1 },
  scenery_flower: { name: 'Flowers', cost: 10, description: 'Place flower beds', size: 1 },
  ride_carousel: { name: 'Carousel', cost: 800, description: 'Gentle carousel ride', size: 2 },
  ride_ferris_wheel: { name: 'Ferris Wheel', cost: 1200, description: 'Observation wheel', size: 2 },
  ride_bumper_cars: { name: 'Bumper Cars', cost: 1600, description: 'Bumper cars pavilion', size: 2 },
  ride_swing: { name: 'Swing Ride', cost: 900, description: 'Classic swing ride', size: 1 },
  ride_haunted_house: { name: 'Haunted House', cost: 1400, description: 'Spooky dark ride', size: 2 },
  ride_spiral_slide: { name: 'Spiral Slide', cost: 700, description: 'Small spiral slide', size: 1 },
  shop_food: { name: 'Food Stall', cost: 400, description: 'Serve meals to guests', size: 1 },
  shop_drink: { name: 'Drink Stall', cost: 350, description: 'Serve drinks to guests', size: 1 },
  shop_toilet: { name: 'Toilets', cost: 200, description: 'Restrooms for guests', size: 1 },
  staff_handyman: { name: 'Handyman', cost: 0, description: 'Hire a handyman for cleaning' },
  staff_mechanic: { name: 'Mechanic', cost: 0, description: 'Hire a mechanic for repairs' },
  staff_security: { name: 'Security', cost: 0, description: 'Hire security for safety' },
  staff_entertainer: { name: 'Entertainer', cost: 0, description: 'Hire entertainers for morale' },
};

export type SavedParkMeta = {
  id: string;
  parkName: string;
  guests: number;
  rating: number;
  cash: number;
  year: number;
  month: number;
  gridSize: number;
  savedAt: number;
};

export type CoasterParkState = {
  id: string;
  parkName: string;
  grid: CoasterTile[][];
  gridSize: number;
  year: number;
  month: number;
  day: number;
  hour: number;
  tick: number;
  speed: 0 | 1 | 2 | 3;
  selectedTool: CoasterTool;
  stats: ParkStats;
  finance: Finance;
  rides: Ride[];
  guests: Guest[];
  staff: Staff[];
  coasterTrains: TrackTrain[];
  research: Research;
  weather: WeatherState;
  activePanel: PanelType;
  parkEntrance: GridPosition;
  parkExit: GridPosition;
  gameVersion: number;
};
