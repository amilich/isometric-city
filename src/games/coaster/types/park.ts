import { msg } from 'gt-next';
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
  select: { name: msg('Select'), cost: 0, description: msg('Inspect rides, guests, and scenery') },
  pan: { name: msg('Pan'), cost: 0, description: msg('Move the camera around the park') },
  path: { name: msg('Path'), cost: 10, description: msg('Build footpaths for guests'), size: 1 },
  queue_path: { name: msg('Queue'), cost: 10, description: msg('Build queue paths for rides'), size: 1 },
  bulldoze: { name: msg('Bulldoze'), cost: 5, description: msg('Remove paths and objects') },
  terrain_raise: { name: msg('Raise Land'), cost: 20, description: msg('Increase terrain height') },
  terrain_lower: { name: msg('Lower Land'), cost: 20, description: msg('Decrease terrain height') },
  terrain_smooth: { name: msg('Smooth Land'), cost: 5, description: msg('Smooth terrain slopes') },
  water: { name: msg('Water'), cost: 30, description: msg('Place or remove water tiles') },
  coaster_track: { name: msg('Coaster Track'), cost: 15, description: msg('Lay coaster track segments'), size: 1 },
  scenery_tree: { name: msg('Tree'), cost: 15, description: msg('Plant a tree for scenery'), size: 1 },
  scenery_flower: { name: msg('Flowers'), cost: 10, description: msg('Place flower beds'), size: 1 },
  ride_carousel: { name: msg('Carousel'), cost: 800, description: msg('Gentle carousel ride'), size: 2 },
  ride_ferris_wheel: { name: msg('Ferris Wheel'), cost: 1200, description: msg('Observation wheel'), size: 2 },
  ride_bumper_cars: { name: msg('Bumper Cars'), cost: 1600, description: msg('Bumper cars pavilion'), size: 2 },
  ride_swing: { name: msg('Swing Ride'), cost: 900, description: msg('Classic swing ride'), size: 1 },
  ride_haunted_house: { name: msg('Haunted House'), cost: 1400, description: msg('Spooky dark ride'), size: 2 },
  ride_spiral_slide: { name: msg('Spiral Slide'), cost: 700, description: msg('Small spiral slide'), size: 1 },
  shop_food: { name: msg('Food Stall'), cost: 400, description: msg('Serve meals to guests'), size: 1 },
  shop_drink: { name: msg('Drink Stall'), cost: 350, description: msg('Serve drinks to guests'), size: 1 },
  shop_toilet: { name: msg('Toilets'), cost: 200, description: msg('Restrooms for guests'), size: 1 },
  staff_handyman: { name: msg('Handyman'), cost: 0, description: msg('Hire a handyman for cleaning') },
  staff_mechanic: { name: msg('Mechanic'), cost: 0, description: msg('Hire a mechanic for repairs') },
  staff_security: { name: msg('Security'), cost: 0, description: msg('Hire security for safety') },
  staff_entertainer: { name: msg('Entertainer'), cost: 0, description: msg('Hire entertainers for morale') },
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
