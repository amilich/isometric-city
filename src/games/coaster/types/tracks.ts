import { CardinalDirection, GridPosition } from '@/core/types';

export type TrackType = 'wooden' | 'steel' | 'suspended';

export type TrackPieceType =
  | 'straight'
  | 'curve_left'
  | 'curve_right'
  | 'slope_up'
  | 'slope_down'
  | 'slope_up_to_flat'
  | 'slope_down_to_flat'
  | 'flat_to_slope_up'
  | 'flat_to_slope_down'
  | 'bank_left'
  | 'bank_right'
  | 'unbank_left'
  | 'unbank_right'
  | 'chain_lift'
  | 'brakes'
  | 'block_brakes'
  | 'station'
  | 'loop'
  | 'corkscrew_left'
  | 'corkscrew_right';

export type TrackSegment = {
  id: string;
  type: TrackPieceType;
  trackType: TrackType;
  position: GridPosition;
  direction: CardinalDirection;
  height: number;
  slope: number;
  banked: boolean;
  chainLift: boolean;
  connections: {
    north: boolean;
    east: boolean;
    south: boolean;
    west: boolean;
  };
};

export type TrackPiece = TrackSegment & {
  sequenceIndex: number;
  speedLimit: number;
};

export type CoasterCar = {
  id: number;
  seatCount: number;
  positionOffset: number;
};

export type TrainState = 'loading' | 'dispatching' | 'running' | 'braking' | 'unloading';

export type CoasterTrain = {
  id: number;
  rideId: string;
  cars: CoasterCar[];
  state: TrainState;
  trackIndex: number;
  segmentProgress: number;
  velocity: number;
  passengers: number[];
  lastDispatchTick: number;
};

export type TrackTrain = {
  id: number;
  tileX: number;
  tileY: number;
  direction: CardinalDirection;
  progress: number;
  speed: number;
};
