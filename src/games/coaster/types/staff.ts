import { CardinalDirection, GridBounds, GridPosition } from '@/core/types';

export type StaffType = 'handyman' | 'mechanic' | 'security' | 'entertainer';

export type StaffState =
  | 'idle'
  | 'walking'
  | 'working'
  | 'responding'
  | 'returning';

export type PatrolRoute = {
  id: string;
  name: string;
  waypoints: GridPosition[];
};

export type Staff = {
  id: number;
  name: string;
  type: StaffType;
  tileX: number;
  tileY: number;
  direction: CardinalDirection;
  progress: number;
  state: StaffState;
  patrolArea: GridBounds | null;
  patrolRouteId: string | null;
  target: GridPosition | null;
  wage: number;
  fatigue: number;
};
