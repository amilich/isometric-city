import { msg } from 'gt-next';
import { CoasterTile } from './tiles';
import { Guest } from './guests';
import { Ride, CoasterTrain } from './rides';
import { Staff } from './staff';

export type CoasterTool =
  | 'select'
  | 'bulldoze'
  | 'path'
  | 'queue'
  | 'coaster_track'
  | 'coaster_station'
  | 'coaster_lift'
  | 'coaster_brakes'
  | 'coaster_booster'
  | 'coaster_loop'
  | 'coaster_corkscrew'
  | 'carousel'
  | 'ferris_wheel'
  | 'swing_ride'
  | 'food_stall'
  | 'drink_stall'
  | 'souvenir_stall'
  | 'toilet'
  | 'information'
  | 'tree'
  | 'bench'
  | 'lamp'
  | 'fence'
  | 'staff_handyman'
  | 'staff_mechanic'
  | 'staff_security'
  | 'staff_entertainer';

export interface CoasterToolInfo {
  name: string;
  cost: number;
  description: string;
  size?: number;
}

export const COASTER_TOOL_INFO: Record<CoasterTool, CoasterToolInfo> = {
  select: { name: msg('Select'), cost: 0, description: msg('Inspect tiles and rides') },
  bulldoze: { name: msg('Bulldoze'), cost: 15, description: msg('Remove paths, rides, and scenery') },
  path: { name: msg('Path'), cost: 8, description: msg('Build park walking paths') },
  queue: { name: msg('Queue'), cost: 6, description: msg('Build ride queue lines') },
  coaster_track: { name: msg('Coaster Track'), cost: 15, description: msg('Build coaster track') },
  coaster_station: { name: msg('Coaster Station'), cost: 180, description: msg('Place coaster station platform') },
  coaster_lift: { name: msg('Lift Hill'), cost: 25, description: msg('Add lift hill chain section') },
  coaster_brakes: { name: msg('Brakes'), cost: 22, description: msg('Add braking section') },
  coaster_booster: { name: msg('Booster'), cost: 28, description: msg('Add booster section') },
  coaster_loop: { name: msg('Loop'), cost: 45, description: msg('Add vertical loop section') },
  coaster_corkscrew: { name: msg('Corkscrew'), cost: 45, description: msg('Add corkscrew section') },
  carousel: { name: msg('Carousel'), cost: 900, description: msg('Gentle classic ride'), size: 2 },
  ferris_wheel: { name: msg('Ferris Wheel'), cost: 1800, description: msg('Scenic high ride'), size: 2 },
  swing_ride: { name: msg('Swing Ride'), cost: 1400, description: msg('Spinning thrill ride'), size: 2 },
  food_stall: { name: msg('Food Stall'), cost: 450, description: msg('Feeds hungry guests') },
  drink_stall: { name: msg('Drink Stall'), cost: 450, description: msg('Quenches thirst') },
  souvenir_stall: { name: msg('Souvenir Stall'), cost: 600, description: msg('Extra income and happiness') },
  toilet: { name: msg('Restrooms'), cost: 500, description: msg('Reduce guest toilet needs') },
  information: { name: msg('Information Booth'), cost: 650, description: msg('Boosts guest confidence') },
  tree: { name: msg('Tree'), cost: 20, description: msg('Adds scenery and shade') },
  bench: { name: msg('Bench'), cost: 35, description: msg('Lets guests rest') },
  lamp: { name: msg('Lamp'), cost: 40, description: msg('Lights paths at night') },
  fence: { name: msg('Fence'), cost: 25, description: msg('Decorative fencing') },
  staff_handyman: { name: msg('Handyman'), cost: 0, description: msg('Hire a handyman') },
  staff_mechanic: { name: msg('Mechanic'), cost: 0, description: msg('Hire a mechanic') },
  staff_security: { name: msg('Security'), cost: 0, description: msg('Hire security') },
  staff_entertainer: { name: msg('Entertainer'), cost: 0, description: msg('Hire entertainer') },
};

export interface CoasterFinance {
  money: number;
  entranceFee: number;
  dailyIncome: number;
  dailyExpenses: number;
  loanBalance: number;
  loanInterestRate: number;
}

export interface CoasterGameState {
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
  activePanel: 'none' | 'finances' | 'rides' | 'guests' | 'settings';
  guests: Guest[];
  rides: Ride[];
  coasterTrains: CoasterTrain[];
  staff: Staff[];
  finance: CoasterFinance;
  parkRating: number;
  maxGuests: number;
  notifications: { id: string; title: string; description: string; timestamp: number }[];
  lastRideId: number;
  lastGuestId: number;
  lastStaffId: number;
}
