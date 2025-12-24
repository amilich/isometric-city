// Game type definitions for Truncgil MyCity

export type BuildingType =
  | 'empty'
  | 'grass'
  | 'water'
  | 'road'
  | 'rail'
  | 'tree'
  // Residential
  | 'house_small'
  | 'house_medium'
  | 'mansion'
  | 'apartment_low'
  | 'apartment_high'
  // Commercial
  | 'shop_small'
  | 'shop_medium'
  | 'office_low'
  | 'office_high'
  | 'mall'
  // Industrial
  | 'factory_small'
  | 'factory_medium'
  | 'factory_large'
  | 'warehouse'
  // Services
  | 'police_station'
  | 'fire_station'
  | 'hospital'
  | 'school'
  | 'university'
  | 'park'
  | 'park_large'
  | 'tennis'
  // Utilities
  | 'power_plant'
  | 'water_tower'
  // Transportation
  | 'subway_station'
  | 'rail_station'
  // Special
  | 'stadium'
  | 'museum'
  | 'airport'
  | 'space_program'
  | 'city_hall'
  | 'amusement_park'
  // Parks (new sprite sheet)
  | 'basketball_courts'
  | 'playground_small'
  | 'playground_large'
  | 'baseball_field_small'
  | 'soccer_field_small'
  | 'football_field'
  | 'baseball_stadium'
  | 'community_center'
  | 'office_building_small'
  | 'swimming_pool'
  | 'skate_park'
  | 'mini_golf_course'
  | 'bleachers_field'
  | 'go_kart_track'
  | 'amphitheater'
  | 'greenhouse_garden'
  | 'animal_pens_farm'
  | 'cabin_house'
  | 'campground'
  | 'marina_docks_small'
  | 'pier_large'
  | 'roller_coaster_small'
  | 'community_garden'
  | 'pond_park'
  | 'park_gate'
  | 'mountain_lodge'
  | 'mountain_trailhead';

export type ZoneType = 'none' | 'residential' | 'commercial' | 'industrial';

export type Tool =
  | 'select'
  | 'bulldoze'
  | 'road'
  | 'rail'
  | 'subway'
  | 'tree'
  | 'zone_residential'
  | 'zone_commercial'
  | 'zone_industrial'
  | 'zone_dezone'
  | 'police_station'
  | 'fire_station'
  | 'hospital'
  | 'school'
  | 'university'
  | 'park'
  | 'park_large'
  | 'tennis'
  | 'power_plant'
  | 'water_tower'
  | 'subway_station'
  | 'rail_station'
  | 'stadium'
  | 'museum'
  | 'airport'
  | 'space_program'
  | 'city_hall'
  | 'amusement_park'
  // Park tools (new sprite sheet)
  | 'basketball_courts'
  | 'playground_small'
  | 'playground_large'
  | 'baseball_field_small'
  | 'soccer_field_small'
  | 'football_field'
  | 'baseball_stadium'
  | 'community_center'
  | 'office_building_small'
  | 'swimming_pool'
  | 'skate_park'
  | 'mini_golf_course'
  | 'bleachers_field'
  | 'go_kart_track'
  | 'amphitheater'
  | 'greenhouse_garden'
  | 'animal_pens_farm'
  | 'cabin_house'
  | 'campground'
  | 'marina_docks_small'
  | 'pier_large'
  | 'roller_coaster_small'
  | 'community_garden'
  | 'pond_park'
  | 'park_gate'
  | 'mountain_lodge'
  | 'mountain_trailhead';

export interface ToolInfo {
  name: string;
  cost: number;
  description: string;
  size?: number;
}

export const TOOL_INFO: Record<Tool, ToolInfo> = {
  select: { name: 'Seç', cost: 0, description: 'Bilgi almak için tıklayın' },
  bulldoze: { name: 'Yık', cost: 10, description: 'Binaları ve bölgeleri kaldır' },
  road: { name: 'Yol', cost: 25, description: 'Şehrinizi bağlayın' },
  rail: { name: 'Ray', cost: 40, description: 'Demiryolu hatları inşa et' },
  subway: { name: 'Metro', cost: 50, description: 'Yeraltı ulaşımı' },
  tree: { name: 'Ağaç', cost: 15, description: 'Çevreyi iyileştirmek için ağaç dik' },
  zone_residential: { name: 'Konut', cost: 50, description: 'Evler için bölge' },
  zone_commercial: { name: 'Ticari', cost: 50, description: 'Dükkanlar ve ofisler için bölge' },
  zone_industrial: { name: 'Endüstriyel', cost: 50, description: 'Fabrikalar için bölge' },
  zone_dezone: { name: 'Bölgeyi Kaldır', cost: 0, description: 'Bölgelemeyi kaldır' },
  police_station: { name: 'Polis', cost: 500, description: 'Güvenliği artır', size: 1 },
  fire_station: { name: 'İtfaiye', cost: 500, description: 'Yangınları söndür', size: 1 },
  hospital: { name: 'Hastane', cost: 1000, description: 'Sağlığı iyileştir (2x2)', size: 2 },
  school: { name: 'Okul', cost: 400, description: 'Temel eğitim (2x2)', size: 2 },
  university: { name: 'Üniversite', cost: 2000, description: 'Yüksek eğitim (3x3)', size: 3 },
  park: { name: 'Küçük Park', cost: 150, description: 'Mutluluğu ve arsa değerini artır (1x1)', size: 1 },
  park_large: { name: 'Büyük Park', cost: 600, description: 'Büyük park (3x3)', size: 3 },
  tennis: { name: 'Tenis Kortu', cost: 200, description: 'Spor tesisi', size: 1 },
  power_plant: { name: 'Enerji Santrali', cost: 3000, description: 'Elektrik üret (2x2)', size: 2 },
  water_tower: { name: 'Su Kulesi', cost: 1000, description: 'Su sağla', size: 1 },
  subway_station: { name: 'Metro İstasyonu', cost: 750, description: 'Metro ağına erişim', size: 1 },
  rail_station: { name: 'Tren İstasyonu', cost: 1000, description: 'Yolcu tren istasyonu', size: 2 },
  stadium: { name: 'Stadyum', cost: 5000, description: 'Ticari talebi artırır (3x3)', size: 3 },
  museum: { name: 'Müze', cost: 4000, description: 'Ticari ve konut talebini artırır (3x3)', size: 3 },
  airport: { name: 'Havalimanı', cost: 10000, description: 'Ticari ve endüstriyel talebi artırır (4x4)', size: 4 },
  space_program: { name: 'Uzay Programı', cost: 15000, description: 'Endüstriyel ve konut talebini artırır (3x3)', size: 3 },
  city_hall: { name: 'Belediye Binası', cost: 6000, description: 'Tüm talep türlerini artırır (2x2)', size: 2 },
  amusement_park: { name: 'Lunapark', cost: 12000, description: 'Ticari talebe büyük destek (4x4)', size: 4 },
  // Parks (new sprite sheet)
  basketball_courts: { name: 'Basketbol Sahası', cost: 250, description: 'Açık hava basketbol tesisi', size: 1 },
  playground_small: { name: 'Küçük Oyun Parkı', cost: 200, description: 'Çocuk oyun alanı', size: 1 },
  playground_large: { name: 'Büyük Oyun Parkı', cost: 350, description: 'Daha fazla ekipmanlı büyük oyun alanı (2x2)', size: 2 },
  baseball_field_small: { name: 'Beyzbol Sahası', cost: 800, description: 'Yerel beyzbol sahası (2x2)', size: 2 },
  soccer_field_small: { name: 'Futbol Sahası', cost: 400, description: 'Futbol sahası', size: 1 },
  football_field: { name: 'Futbol Stadyumu', cost: 1200, description: 'Futbol stadyumu (2x2)', size: 2 },
  baseball_stadium: { name: 'Beyzbol Stadyumu', cost: 6000, description: 'Profesyonel beyzbol sahası (3x3)', size: 3 },
  community_center: { name: 'Toplum Merkezi', cost: 500, description: 'Yerel toplum merkezi', size: 1 },
  office_building_small: { name: 'Küçük Ofis', cost: 600, description: 'Küçük ofis binası', size: 1 },
  swimming_pool: { name: 'Yüzme Havuzu', cost: 450, description: 'Halka açık yüzme tesisi', size: 1 },
  skate_park: { name: 'Kaykay Parkı', cost: 300, description: 'Kaykay parkı', size: 1 },
  mini_golf_course: { name: 'Mini Golf', cost: 700, description: 'Minyatür golf sahası (2x2)', size: 2 },
  bleachers_field: { name: 'Tribünlü Saha', cost: 350, description: 'Oturma alanlı spor sahası', size: 1 },
  go_kart_track: { name: 'Go-Kart Pisti', cost: 1000, description: 'Yarış eğlencesi (2x2)', size: 2 },
  amphitheater: { name: 'Amfitiyatro', cost: 1500, description: 'Açık hava performans alanı (2x2)', size: 2 },
  greenhouse_garden: { name: 'Sera Bahçesi', cost: 800, description: 'Botanik sera (2x2)', size: 2 },
  animal_pens_farm: { name: 'Hayvan Çiftliği', cost: 400, description: 'Hayvanat bahçesi / çiftlik hayvanları', size: 1 },
  cabin_house: { name: 'Ahşap Ev', cost: 300, description: 'Kırsal kulübe', size: 1 },
  campground: { name: 'Kamp Alanı', cost: 250, description: 'Açık hava kamp alanı', size: 1 },
  marina_docks_small: { name: 'Marina', cost: 1200, description: 'Tekne iskeleleri (2x2, suya bitişik olmalı)', size: 2 },
  pier_large: { name: 'İskele', cost: 600, description: 'Sahil iskelesi (suya bitişik olmalı)', size: 1 },
  roller_coaster_small: { name: 'Hız Treni', cost: 3000, description: 'Heyecan verici sürüş (2x2)', size: 2 },
  community_garden: { name: 'Hobi Bahçesi', cost: 200, description: 'Ortak bahçecilik alanı', size: 1 },
  pond_park: { name: 'Gölet Parkı', cost: 350, description: 'Manzaralı gölet parkı', size: 1 },
  park_gate: { name: 'Park Kapısı', cost: 150, description: 'Dekoratif park girişi', size: 1 },
  mountain_lodge: { name: 'Dağ Evi', cost: 1500, description: 'Doğa tatil evi (2x2)', size: 2 },
  mountain_trailhead: { name: 'Patika Girişi', cost: 400, description: 'Yürüyüş parkuru girişi (3x3)', size: 3 },
};

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
  constructionProgress: number; // 0-100, building is under construction until 100
  abandoned: boolean; // Building is abandoned due to low demand, produces nothing
  flipped?: boolean; // Horizontally mirror the sprite (used for waterfront buildings to face water)
}

export interface Tile {
  x: number;
  y: number;
  zone: ZoneType;
  building: Building;
  landValue: number;
  pollution: number;
  crime: number;
  traffic: number;
  hasSubway: boolean;
  hasRailOverlay?: boolean; // Rail tracks overlaid on road (road base with rail tracks on top)
}

export interface Stats {
  population: number;
  jobs: number;
  money: number;
  income: number;
  expenses: number;
  happiness: number;
  health: number;
  education: number;
  safety: number;
  environment: number;
  demand: {
    residential: number;
    commercial: number;
    industrial: number;
  };
}

export interface BudgetCategory {
  name: string;
  funding: number;
  cost: number;
}

export interface Budget {
  police: BudgetCategory;
  fire: BudgetCategory;
  health: BudgetCategory;
  education: BudgetCategory;
  transportation: BudgetCategory;
  parks: BudgetCategory;
  power: BudgetCategory;
  water: BudgetCategory;
}

export interface ServiceCoverage {
  police: number[][];
  fire: number[][];
  health: number[][];
  education: number[][];
  power: boolean[][];
  water: boolean[][];
}

export interface Notification {
  id: string;
  title: string;
  description: string;
  icon: string;
  timestamp: number;
}

export interface AdvisorMessage {
  name: string;
  icon: string;
  messages: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface HistoryPoint {
  year: number;
  month: number;
  population: number;
  money: number;
  happiness: number;
}

export interface AdjacentCity {
  id: string;
  name: string;
  direction: 'north' | 'south' | 'east' | 'west';
  connected: boolean;
  discovered: boolean; // City becomes discovered when a road reaches its edge
}

export interface WaterBody {
  id: string;
  name: string;
  type: 'lake' | 'ocean';
  tiles: { x: number; y: number }[];
  centerX: number;
  centerY: number;
}

export interface GameState {
  id: string; // Unique UUID for this game
  grid: Tile[][];
  gridSize: number;
  cityName: string;
  year: number;
  month: number;
  day: number;
  hour: number; // 0-23 for day/night cycle
  tick: number;
  speed: 0 | 1 | 2 | 3;
  selectedTool: Tool;
  taxRate: number;
  effectiveTaxRate: number; // Lagging tax rate that gradually moves toward taxRate (affects demand)
  stats: Stats;
  budget: Budget;
  services: ServiceCoverage;
  notifications: Notification[];
  advisorMessages: AdvisorMessage[];
  history: HistoryPoint[];
  activePanel: 'none' | 'budget' | 'statistics' | 'advisors' | 'settings';
  disastersEnabled: boolean;
  adjacentCities: AdjacentCity[];
  waterBodies: WaterBody[];
  gameVersion: number; // Increments when a new game starts - used to clear transient state like vehicles
}

// Saved city metadata for the multi-save system
export interface SavedCityMeta {
  id: string; // Same as GameState.id
  cityName: string;
  population: number;
  money: number;
  year: number;
  month: number;
  gridSize: number;
  savedAt: number; // timestamp
}

// Building evolution paths based on zone and level
export const RESIDENTIAL_BUILDINGS: BuildingType[] = ['house_small', 'house_medium', 'mansion', 'apartment_low', 'apartment_high'];
export const COMMERCIAL_BUILDINGS: BuildingType[] = ['shop_small', 'shop_medium', 'office_low', 'office_high', 'mall'];
export const INDUSTRIAL_BUILDINGS: BuildingType[] = ['factory_small', 'factory_medium', 'warehouse', 'factory_large', 'factory_large'];

export const BUILDING_STATS: Record<BuildingType, { maxPop: number; maxJobs: number; pollution: number; landValue: number }> = {
  empty: { maxPop: 0, maxJobs: 0, pollution: 0, landValue: 0 },
  grass: { maxPop: 0, maxJobs: 0, pollution: 0, landValue: 0 },
  water: { maxPop: 0, maxJobs: 0, pollution: 0, landValue: 5 },
  road: { maxPop: 0, maxJobs: 0, pollution: 2, landValue: 0 },
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
  // Parks (new sprite sheet)
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
};
