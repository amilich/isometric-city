import { CardinalDirection } from '@/core/types';

export type TrackDirection = CardinalDirection;

export type TrackSpecial =
  | 'station'
  | 'lift'
  | 'brakes'
  | 'booster'
  | 'loop'
  | 'corkscrew';

export type TrackSlope = 'flat' | 'up' | 'down';

export type TrackConnections = {
  north: boolean;
  east: boolean;
  south: boolean;
  west: boolean;
};

export type TrackPieceType = 'track';

export interface TrackSegment {
  id: string;
  rideId: string | null;
  type: TrackPieceType;
  direction: TrackDirection;
  elevation: number;
  slope: TrackSlope;
  special?: TrackSpecial | null;
  isActive: boolean;
}
