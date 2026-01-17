import { CardinalDirection } from '@/core/types';

export type StaffType =
  | 'handyman'
  | 'mechanic'
  | 'security'
  | 'entertainer';

export type StaffState =
  | 'idle'
  | 'walking'
  | 'working'
  | 'responding';

export interface Staff {
  id: number;
  type: StaffType;
  tileX: number;
  tileY: number;
  direction: CardinalDirection;
  progress: number;
  speed: number;
  state: StaffState;
  path: { x: number; y: number }[];
  pathIndex: number;
  targetTile: { x: number; y: number } | null;
  assignedArea: { minX: number; minY: number; maxX: number; maxY: number } | null;
  mood: number;
}
