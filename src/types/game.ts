// Game type definitions for BNBCITY

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
  select: { name: '选择', cost: 0, description: '点击查看地块信息' },
  bulldoze: { name: '推土机', cost: 10, description: '移除建筑和分区' },
  road: { name: '道路', cost: 25, description: '连接你的城市' },
  rail: { name: '铁路', cost: 40, description: '建造铁轨' },
  subway: { name: '地铁', cost: 50, description: '地下交通' },
  tree: { name: '树木', cost: 15, description: '种植树木以改善环境' },
  zone_residential: { name: '住宅', cost: 50, description: '住房分区' },
  zone_commercial: { name: '商业', cost: 50, description: '商店和办公室分区' },
  zone_industrial: { name: '工业', cost: 50, description: '工厂分区' },
  zone_dezone: { name: '取消分区', cost: 0, description: '移除分区' },
  police_station: { name: '警察局', cost: 500, description: '提高安全', size: 1 },
  fire_station: { name: '消防站', cost: 500, description: '灭火', size: 1 },
  hospital: { name: '医院', cost: 1000, description: '改善健康 (2x2)', size: 2 },
  school: { name: '学校', cost: 400, description: '基础教育 (2x2)', size: 2 },
  university: { name: '大学', cost: 2000, description: '高等教育 (3x3)', size: 3 },
  park: { name: '小公园', cost: 150, description: '提升幸福度和地价 (1x1)', size: 1 },
  park_large: { name: '大公园', cost: 600, description: '大公园 (3x3)', size: 3 },
  tennis: { name: '网球场', cost: 200, description: '娱乐设施', size: 1 },
  power_plant: { name: '电厂', cost: 3000, description: '发电 (2x2)', size: 2 },
  water_tower: { name: '水塔', cost: 1000, description: '供水', size: 1 },
  subway_station: { name: '地铁站', cost: 750, description: '地铁网络接入', size: 1 },
  rail_station: { name: '火车站', cost: 1000, description: '客运铁路站', size: 2 },
  stadium: { name: '体育场', cost: 5000, description: '提升商业需求 (3x3)', size: 3 },
  museum: { name: '博物馆', cost: 4000, description: '提升商业和住宅需求 (3x3)', size: 3 },
  airport: { name: '机场', cost: 10000, description: '提升商业和工业需求 (4x4)', size: 4 },
  space_program: { name: '太空项目', cost: 15000, description: '提升工业和住宅需求 (3x3)', size: 3 },
  city_hall: { name: '市政厅', cost: 6000, description: '提升所有需求 (2x2)', size: 2 },
  amusement_park: { name: '游乐园', cost: 12000, description: '大幅提升商业需求 (4x4)', size: 4 },
  // Parks (new sprite sheet)
  basketball_courts: { name: '篮球场', cost: 250, description: '户外篮球设施', size: 1 },
  playground_small: { name: '小游乐场', cost: 200, description: '儿童游乐场', size: 1 },
  playground_large: { name: '大游乐场', cost: 350, description: '大型游乐场 (2x2)', size: 2 },
  baseball_field_small: { name: '棒球场', cost: 800, description: '本地棒球场 (2x2)', size: 2 },
  soccer_field_small: { name: '足球场', cost: 400, description: '足球场', size: 1 },
  football_field: { name: '橄榄球场', cost: 1200, description: '橄榄球体育场 (2x2)', size: 2 },
  baseball_stadium: { name: '棒球体育场', cost: 6000, description: '专业棒球场 (3x3)', size: 3 },
  community_center: { name: '社区中心', cost: 500, description: '本地社区枢纽', size: 1 },
  office_building_small: { name: '小办公楼', cost: 600, description: '小型办公建筑', size: 1 },
  swimming_pool: { name: '游泳池', cost: 450, description: '公共游泳设施', size: 1 },
  skate_park: { name: '滑板公园', cost: 300, description: '滑板公园', size: 1 },
  mini_golf_course: { name: '迷你高尔夫', cost: 700, description: '迷你高尔夫球场 (2x2)', size: 2 },
  bleachers_field: { name: '看台球场', cost: 350, description: '带座位的体育场', size: 1 },
  go_kart_track: { name: '卡丁车赛道', cost: 1000, description: '赛车娱乐 (2x2)', size: 2 },
  amphitheater: { name: '露天剧场', cost: 1500, description: '户外演艺场地 (2x2)', size: 2 },
  greenhouse_garden: { name: '温室花园', cost: 800, description: '植物温室 (2x2)', size: 2 },
  animal_pens_farm: { name: '动物园', cost: 400, description: '宠物动物园/农场', size: 1 },
  cabin_house: { name: '木屋', cost: 300, description: '乡村小屋度假地', size: 1 },
  campground: { name: '露营地', cost: 250, description: '户外露营区', size: 1 },
  marina_docks_small: { name: '码头', cost: 1200, description: '游艇码头 (2x2，必须靠近水)', size: 2 },
  pier_large: { name: '栈桥', cost: 600, description: '滨水栈桥 (必须靠近水)', size: 1 },
  roller_coaster_small: { name: '过山车', cost: 3000, description: '刺激游乐设施 (2x2)', size: 2 },
  community_garden: { name: '社区花园', cost: 200, description: '共享园艺空间', size: 1 },
  pond_park: { name: '池塘公园', cost: 350, description: '有景观池塘的公园', size: 1 },
  park_gate: { name: '公园门', cost: 150, description: '装饰性公园入口', size: 1 },
  mountain_lodge: { name: '山林小屋', cost: 1500, description: '自然度假小屋 (2x2)', size: 2 },
  mountain_trailhead: { name: '登山口', cost: 400, description: '登山入口 (3x3)', size: 3 },
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
