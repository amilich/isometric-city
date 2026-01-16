import { CardinalDirection, GridPosition } from '@/core/types';
import { CoasterBuildingType } from './tiles';

export type GuestState =
  | 'entering'
  | 'wandering'
  | 'heading_to_ride'
  | 'queuing'
  | 'on_ride'
  | 'leaving_ride'
  | 'heading_to_shop'
  | 'at_shop'
  | 'sitting'
  | 'leaving_park';

export type GuestThoughtType =
  | 'positive'
  | 'negative'
  | 'neutral'
  | 'warning';

export type GuestThought = {
  id: string;
  type: GuestThoughtType;
  message: string;
  timestamp: number;
};

export type GuestNeeds = {
  hunger: number;
  thirst: number;
  bathroom: number;
  happiness: number;
  nausea: number;
  energy: number;
};

export type GuestItem =
  | 'balloon'
  | 'hat'
  | 'map'
  | 'food'
  | 'drink'
  | 'souvenir';

export type GuestColors = {
  skin: string;
  shirt: string;
  pants: string;
  hat?: string;
};

export type Guest = {
  id: number;
  name: string;
  tileX: number;
  tileY: number;
  direction: CardinalDirection;
  progress: number;
  state: GuestState;
  stateTimer: number;
  queueJoinTick: number | null;
  needs: GuestNeeds;
  happiness: number;
  energy: number;
  money: number;
  thoughts: GuestThought[];
  currentRideId: string | null;
  targetRideId: string | null;
  targetShop: { position: GridPosition; type: CoasterBuildingType } | null;
  path: GridPosition[];
  pathIndex: number;
  age: number;
  maxAge: number;
  colors: GuestColors;
  hasItem: GuestItem | null;
};
