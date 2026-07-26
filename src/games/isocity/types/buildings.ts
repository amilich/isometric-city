/**
 * IsoCity Building Types
 */

export type BuildingType =
  | 'empty' | 'grass' | 'water' | 'road' | 'bridge' | 'rail' | 'tree'
  // Residential
  | 'house_small' | 'house_medium' | 'mansion' | 'apartment_low' | 'apartment_high'
  // Commercial
  | 'shop_small' | 'shop_medium' | 'office_low' | 'office_high' | 'mall'
  // Industrial
  | 'factory_small' | 'factory_medium' | 'factory_large' | 'warehouse'
  // Services
  | 'police_station' | 'fire_station' | 'hospital' | 'school' | 'university'
  | 'park' | 'park_large' | 'tennis'
  // Utilities
  | 'power_plant' | 'water_tower'
  // Transportation
  | 'subway_station' | 'rail_station'
  // Special
  | 'stadium' | 'museum' | 'airport' | 'space_program' | 'city_hall' | 'amusement_park'
  // Parks (new sprite sheet)
  | 'basketball_courts' | 'playground_small' | 'playground_large'
  | 'baseball_field_small' | 'soccer_field_small' | 'football_field' | 'baseball_stadium'
  | 'community_center' | 'office_building_small' | 'swimming_pool' | 'skate_park'
  | 'mini_golf_course' | 'bleachers_field' | 'go_kart_track' | 'amphitheater'
  | 'greenhouse_garden' | 'animal_pens_farm' | 'cabin_house' | 'campground'
  | 'marina_docks_small' | 'pier_large' | 'roller_coaster_small'
  | 'community_garden' | 'pond_park' | 'park_gate' | 'mountain_lodge' | 'mountain_trailhead'
  // AI-generated custom buildings
  | 'custom';

export type BridgeType = 'small' | 'medium' | 'large' | 'suspension';
export type BridgeOrientation = 'ns' | 'ew';
export type BridgeTrackType = 'road' | 'rail';

export interface Building {
  type: BuildingType;
  level: number;
  population: number;
  jobs: number;
  powered: boolean;
  watered: boolean;
  onFire: boolean;
  fireProgress: number;
  age: number;
  constructionProgress: number;
  abandoned: boolean;
  flipped?: boolean;
  cityId?: string;
  bridgeType?: BridgeType;
  bridgeOrientation?: BridgeOrientation;
  bridgeVariant?: number;
  bridgePosition?: 'start' | 'middle' | 'end';
  bridgeIndex?: number;
  bridgeSpan?: number;
  bridgeTrackType?: BridgeTrackType;
  // Custom AI-generated building properties
  customSpriteUrl?: string;
  customBuildingId?: string;
  customSize?: number;
}

export const RESIDENTIAL_BUILDINGS: BuildingType[] = ['house_small', 'house_medium', 'mansion', 'apartment_low', 'apartment_high'];
export const COMMERCIAL_BUILDINGS: BuildingType[] = ['shop_small', 'shop_medium', 'office_low', 'office_high', 'mall'];
export const INDUSTRIAL_BUILDINGS: BuildingType[] = ['factory_small', 'factory_medium', 'warehouse', 'factory_large', 'factory_large'];

export const BUILDING_STATS: Record<BuildingType, { maxPop: number; maxJobs: number; pollution: number; landValue: number }> = {
  empty: { maxPop: 0, maxJobs: 0, pollution: 0, landValue: 0 },
  grass: { maxPop: 0, maxJobs: 0, pollution: 0, landValue: 0 },
  water: { maxPop: 0, maxJobs: 0, pollution: 0, landValue: 5 },
  road: { maxPop: 0, maxJobs: 0, pollution: 2, landValue: 0 },
  bridge: { maxPop: 0, maxJobs: 0, pollution: 1, landValue: 5 },
  rail: { maxPop: 0, maxJobs: 0, pollution: 1, landValue: -2 },
  tree: { maxPop: 0, maxJobs: 0, pollution: -5, landValue: 2 },
  house_small: { maxPop: 6, maxJobs: 0, pollution: 0, landValue: 10 },
  house_medium: { maxPop: 14, maxJobs: 0, pollution: 0, landValue: 22 },
  mansion: { maxPop: 18, maxJobs: 0, pollution: 0, landValue: 60 },
  apartment_low: { maxPop: 120, maxJobs: 0, pollution: 2, landValue: 40 },
  apartment_high: { maxPop: 260, maxJobs: 0, pollution: 3, landValue: 55 },
  shop_small: { maxPop: 0, maxJobs: 10, pollution: 1, landValue: 16 },
  shop_medium: { maxPop: 0, maxJobs: 28, pollution: 2, landValue: 26 },
  office_low: { maxPop: 0, maxJobs: 90, pollution: 2, landValue: 40 },
  office_high: { maxPop: 0, maxJobs: 210, pollution: 3, landValue: 55 },
  mall: { maxPop: 0, maxJobs: 260, pollution: 6, landValue: 70 },
  factory_small: { maxPop: 0, maxJobs: 40, pollution: 15, landValue: -5 },
  factory_medium: { maxPop: 0, maxJobs: 90, pollution: 28, landValue: -10 },
  factory_large: { maxPop: 0, maxJobs: 180, pollution: 55, landValue: -18 },
  warehouse: { maxPop: 0, maxJobs: 60, pollution: 18, landValue: -6 },
  police_station: { maxPop: 0, maxJobs: 20, pollution: 0, landValue: 15 },
  fire_station: { maxPop: 0, maxJobs: 20, pollution: 0, landValue: 10 },
  hospital: { maxPop: 0, maxJobs: 80, pollution: 0, landValue: 25 },
  school: { maxPop: 0, maxJobs: 25, pollution: 0, landValue: 15 },
  university: { maxPop: 0, maxJobs: 100, pollution: 0, landValue: 35 },
  park: { maxPop: 0, maxJobs: 2, pollution: -10, landValue: 20 },
  park_large: { maxPop: 0, maxJobs: 6, pollution: -25, landValue: 50 },
  tennis: { maxPop: 0, maxJobs: 1, pollution: -5, landValue: 15 },
  power_plant: { maxPop: 0, maxJobs: 30, pollution: 30, landValue: -20 },
  water_tower: { maxPop: 0, maxJobs: 5, pollution: 0, landValue: 5 },
  stadium: { maxPop: 0, maxJobs: 50, pollution: 5, landValue: 40 },
  museum: { maxPop: 0, maxJobs: 40, pollution: 0, landValue: 45 },
  airport: { maxPop: 0, maxJobs: 200, pollution: 20, landValue: 50 },
  space_program: { maxPop: 0, maxJobs: 150, pollution: 5, landValue: 80 },
  subway_station: { maxPop: 0, maxJobs: 15, pollution: 0, landValue: 25 },
  rail_station: { maxPop: 0, maxJobs: 25, pollution: 2, landValue: 20 },
  city_hall: { maxPop: 0, maxJobs: 60, pollution: 0, landValue: 50 },
  amusement_park: { maxPop: 0, maxJobs: 100, pollution: 8, landValue: 60 },
  basketball_courts: { maxPop: 0, maxJobs: 2, pollution: -3, landValue: 12 },
  playground_small: { maxPop: 0, maxJobs: 1, pollution: -5, landValue: 15 },
  playground_large: { maxPop: 0, maxJobs: 2, pollution: -8, landValue: 18 },
  baseball_field_small: { maxPop: 0, maxJobs: 4, pollution: -10, landValue: 25 },
  soccer_field_small: { maxPop: 0, maxJobs: 2, pollution: -5, landValue: 15 },
  football_field: { maxPop: 0, maxJobs: 8, pollution: -8, landValue: 30 },
  baseball_stadium: { maxPop: 0, maxJobs: 60, pollution: 5, landValue: 45 },
  community_center: { maxPop: 0, maxJobs: 10, pollution: 0, landValue: 20 },
  office_building_small: { maxPop: 0, maxJobs: 25, pollution: 1, landValue: 22 },
  swimming_pool: { maxPop: 0, maxJobs: 5, pollution: -5, landValue: 18 },
  skate_park: { maxPop: 0, maxJobs: 2, pollution: -3, landValue: 12 },
  mini_golf_course: { maxPop: 0, maxJobs: 6, pollution: -8, landValue: 22 },
  bleachers_field: { maxPop: 0, maxJobs: 3, pollution: -5, landValue: 15 },
  go_kart_track: { maxPop: 0, maxJobs: 10, pollution: 5, landValue: 20 },
  amphitheater: { maxPop: 0, maxJobs: 15, pollution: -5, landValue: 35 },
  greenhouse_garden: { maxPop: 0, maxJobs: 8, pollution: -15, landValue: 28 },
  animal_pens_farm: { maxPop: 0, maxJobs: 4, pollution: 2, landValue: 10 },
  cabin_house: { maxPop: 4, maxJobs: 0, pollution: -3, landValue: 15 },
  campground: { maxPop: 0, maxJobs: 3, pollution: -8, landValue: 12 },
  marina_docks_small: { maxPop: 0, maxJobs: 8, pollution: 2, landValue: 25 },
  pier_large: { maxPop: 0, maxJobs: 12, pollution: 1, landValue: 30 },
  roller_coaster_small: { maxPop: 0, maxJobs: 20, pollution: 3, landValue: 40 },
  community_garden: { maxPop: 0, maxJobs: 2, pollution: -12, landValue: 18 },
  pond_park: { maxPop: 0, maxJobs: 2, pollution: -15, landValue: 22 },
  park_gate: { maxPop: 0, maxJobs: 1, pollution: -2, landValue: 8 },
  mountain_lodge: { maxPop: 0, maxJobs: 15, pollution: -5, landValue: 35 },
  mountain_trailhead: { maxPop: 0, maxJobs: 2, pollution: -10, landValue: 15 },
  // Custom buildings use dynamic stats from AI analysis
  custom: { maxPop: 0, maxJobs: 0, pollution: 0, landValue: 0 },
};
