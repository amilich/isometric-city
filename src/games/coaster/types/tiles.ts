import { ZoneType } from '@/types/game';
import { TrackSegment } from './tracks';
import { RideType } from './rides';

export type TerrainType = 'grass' | 'water';

export type PathType = 'path' | 'queue';

export type SceneryType =
  | 'tree'
  | 'bench'
  | 'lamp'
  | 'fence'
  | 'flower_bed';

export type FacilityType =
  | 'food_stall'
  | 'drink_stall'
  | 'souvenir_stall'
  | 'toilet'
  | 'information';

export interface CoasterTile {
  x: number;
  y: number;
  zone: ZoneType;
  terrain: TerrainType;
  path: PathType | null;
  track: TrackSegment | null;
  rideId: string | null;
  rideType: RideType | null;
  facility: FacilityType | null;
  scenery: SceneryType[];
  elevation: number;
  hasQueueEntrance: boolean;
  hasQueueExit: boolean;
}
