export type RideType =
  | 'coaster'
  | 'carousel'
  | 'ferris_wheel'
  | 'swing_ride'
  | 'food_stall'
  | 'drink_stall'
  | 'souvenir_stall'
  | 'toilet'
  | 'information';

export type RideStatus = 'closed' | 'testing' | 'open';

export type RideCategory =
  | 'coaster'
  | 'flat'
  | 'facility'
  | 'stall';

export type RideFootprint = {
  width: number;
  height: number;
};

export type RideEntrance = {
  x: number;
  y: number;
};

export type RideExit = {
  x: number;
  y: number;
};

export interface RideRatings {
  excitement: number;
  intensity: number;
  nausea: number;
}

export interface RidePerformance {
  guestsToday: number;
  revenueToday: number;
  waitTime: number;
  satisfaction: number;
}

export interface Ride {
  id: string;
  name: string;
  type: RideType;
  category: RideCategory;
  status: RideStatus;
  price: number;
  capacity: number;
  duration: number;
  footprint: RideFootprint;
  tiles: { x: number; y: number }[];
  entrance: RideEntrance | null;
  exit: RideExit | null;
  ratings: RideRatings;
  performance: RidePerformance;
  createdAt: number;
}

export interface CoasterTrain {
  id: string;
  rideId: string;
  cars: CoasterCar[];
  segmentIndex: number;
  progress: number;
  speed: number;
  state: 'loading' | 'running' | 'waiting';
  lastDispatchTime: number;
}

export interface CoasterCar {
  id: string;
  trainId: string;
  offset: number;
  guestIds: number[];
  color: string;
}
