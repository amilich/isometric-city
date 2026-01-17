import { BaseTile } from '@/core/types';
import { TrackSegment } from './tracks';

export type TerrainType = 'grass' | 'dirt' | 'sand' | 'rock' | 'water';

export type PathStyle = 'concrete' | 'wood' | 'gravel' | 'queue';

export type PathSlope =
  | 'flat'
  | 'up-north'
  | 'up-east'
  | 'up-south'
  | 'up-west'
  | 'down-north'
  | 'down-east'
  | 'down-south'
  | 'down-west';

export type PathEdges = {
  north: boolean;
  east: boolean;
  south: boolean;
  west: boolean;
};

export type PathInfo = {
  style: PathStyle;
  isQueue: boolean;
  queueRideId: string | null;
  edges: PathEdges;
  slope: PathSlope;
  railing: boolean;
  isBridge: boolean;
};

export type SceneryType =
  | 'tree'
  | 'shrub'
  | 'flower'
  | 'bench'
  | 'lamp'
  | 'fence'
  | 'trash_can'
  | 'statue'
  | 'fountain';

export type Scenery = {
  type: SceneryType;
  variant: number;
  rotation: 0 | 90 | 180 | 270;
};

export type CoasterBuildingType =
  | 'food_stall'
  | 'drink_stall'
  | 'ice_cream_stall'
  | 'souvenir_shop'
  | 'info_kiosk'
  | 'toilets'
  | 'atm'
  | 'first_aid'
  | 'staff_room';

export type CoasterBuilding = {
  type: CoasterBuildingType;
  name: string;
  price: number;
  capacity: number;
  open: boolean;
};

export interface CoasterTile extends BaseTile {
  terrain: TerrainType;
  height: number;
  path: PathInfo | null;
  building: CoasterBuilding | null;
  rideId?: string | null;
  track: TrackSegment | null;
  scenery: Scenery | null;
  litter: number;
  zoneId?: string | null;
}
