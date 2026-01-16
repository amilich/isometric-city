import { GridPosition } from '@/core/types';
import { CoasterTrain, TrackPiece } from './tracks';

export type RideCategory = 'gentle' | 'thrill' | 'coaster' | 'water' | 'transport';

export type RideType =
  | 'carousel'
  | 'ferris_wheel'
  | 'bumper_cars'
  | 'swing_ride'
  | 'haunted_house'
  | 'spiral_slide'
  | 'coaster_wooden'
  | 'coaster_steel';

export type RideStatus = 'building' | 'testing' | 'open' | 'closed' | 'broken';

export type RideQueue = {
  guestIds: number[];
  maxLength: number;
  entry: GridPosition;
  exit: GridPosition;
};

export type RideStats = {
  rideTime: number;
  capacity: number;
  reliability: number;
  uptime: number;
  totalRiders: number;
  totalRevenue: number;
  lastBreakdownTick: number | null;
};

export type Ride = {
  id: string;
  type: RideType;
  category: RideCategory;
  name: string;
  position: GridPosition;
  size: { width: number; height: number };
  entrance: GridPosition;
  exit: GridPosition;
  queue: RideQueue;
  stats: RideStats;
  status: RideStatus;
  price: number;
  excitement: number;
  intensity: number;
  nausea: number;
  age: number;
  color: string;
  cycleTimer: number;
  trackPieces?: TrackPiece[];
  trains?: CoasterTrain[];
};
