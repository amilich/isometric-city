import { CardinalDirection } from '@/core/types';

export type GuestState =
  | 'walking'
  | 'queuing'
  | 'riding'
  | 'idle'
  | 'leaving';

export type GuestNeed = {
  hunger: number;
  thirst: number;
  energy: number;
  nausea: number;
  toilet: number;
  happiness: number;
};

export type GuestPreferences = {
  thrillTolerance: 'low' | 'medium' | 'high';
  preferredIntensity: number;
  likesWaterRides: boolean;
};

export interface Guest {
  id: number;
  tileX: number;
  tileY: number;
  direction: CardinalDirection;
  progress: number;
  speed: number;
  state: GuestState;
  path: { x: number; y: number }[];
  pathIndex: number;
  money: number;
  needs: GuestNeed;
  preferences: GuestPreferences;
  currentRideId: string | null;
  targetRideId: string | null;
  queueTile: { x: number; y: number } | null;
  lastDecisionTime: number;
  spriteVariant: number;
}
