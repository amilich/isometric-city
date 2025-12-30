/**
 * Rise of Nations - Render Configuration
 * 
 * Sprite pack configuration for age-based building sprites.
 * Each age has its own sprite sheet with the same layout as sprites_red_water_new.
 */

import { Age } from '../types/ages';
import { RoNBuildingType } from '../types/buildings';

// Sprite pack type for RoN (simplified from IsoCity)
export interface RoNSpritePack {
  id: string;
  name: string;
  age: Age;
  src: string;
  cols: number;
  rows: number;
  layout: 'row';
  globalScale: number;
}

// Age sprite packs - one per asset in public/assets/ages/
export const AGE_SPRITE_PACKS: Record<Age, RoNSpritePack> = {
  classical: {
    id: 'classical',
    name: 'Classical Age',
    age: 'classical',
    src: '/assets/ages/classics.webp',
    cols: 5,
    rows: 6,
    layout: 'row',
    globalScale: 0.8,
  },
  medieval: {
    id: 'medieval',
    name: 'Medieval Age',
    age: 'medieval',
    src: '/assets/ages/medeival.webp', // Note: typo in filename
    cols: 5,
    rows: 6,
    layout: 'row',
    globalScale: 0.8,
  },
  enlightenment: {
    id: 'enlightenment',
    name: 'Enlightenment Age',
    age: 'enlightenment',
    src: '/assets/ages/enlightenment.webp',
    cols: 5,
    rows: 6,
    layout: 'row',
    globalScale: 0.8,
  },
  industrial: {
    id: 'industrial',
    name: 'Industrial Age',
    age: 'industrial',
    src: '/assets/ages/industrial.webp',
    cols: 5,
    rows: 6,
    layout: 'row',
    globalScale: 0.8,
  },
  modern: {
    id: 'modern',
    name: 'Modern Age',
    age: 'modern',
    src: '/assets/ages/modern.webp',
    cols: 5,
    rows: 6,
    layout: 'row',
    globalScale: 0.8,
  },
};

// Sprite order follows the same layout as sprites_red_water_new
// This maps grid positions to sprite keys
export const SPRITE_ORDER = [
  // Row 0 (indices 0-4)
  'residential_1',   // col 0
  'commercial_1',    // col 1
  'industrial_1',    // col 2
  'service_1',       // col 3 - fire station equivalent
  'service_2',       // col 4 - hospital equivalent
  // Row 1 (indices 5-9)
  'park_1',          // col 0 - park
  'park_2',          // col 1 - large park
  'recreation_1',    // col 2 - tennis equivalent
  'service_3',       // col 3 - police equivalent
  'education_1',     // col 4 - school equivalent
  // Row 2 (indices 10-14)
  'education_2',     // col 0 - university equivalent
  'utility_1',       // col 1 - water tower equivalent
  'utility_2',       // col 2 - power plant equivalent
  'special_1',       // col 3 - stadium equivalent
  'special_2',       // col 4 - space program equivalent
  // Row 3 (indices 15-19)
  'nature_1',        // col 0 - tree
  'residential_2',   // col 1 - medium house
  'residential_3',   // col 2 - mansion
  'residential_4',   // col 3 - small house
  'commercial_2',    // col 4 - medium shop
  // Row 4 (indices 20-24)
  'commercial_3',    // col 0 - small shop
  'industrial_2',    // col 1 - warehouse
  'industrial_3',    // col 2 - small factory
  'industrial_4',    // col 3 - medium factory
  'industrial_5',    // col 4 - large factory
  // Row 5 (indices 25-29)
  'special_3',       // col 0 - airport equivalent
  'transport_1',     // col 1 - subway station equivalent
  'city_center',     // col 2 - CITY CENTER / TOWN HALL - this is what we need!
  'culture_1',       // col 3 - museum equivalent
  'special_4',       // col 4 - amusement park equivalent
] as const;

// Default building sprite positions (used when age-specific mapping not available)
// Based on comprehensive sprite audit - see docs/sprite-audit/SPRITE_AUDIT.md
//
// IMPORTANT: Some buildings use IsoCity sheets instead of age sheets:
// - Farms use sprites_red_water_new_farm.png (has actual crop/barn sprites)
// - Airbase uses dedicated IsoCity airport sprite
export const BUILDING_SPRITE_MAP: Partial<Record<RoNBuildingType, { row: number; col: number }>> = {
  // City buildings
  city_center: { row: 5, col: 2 },
  small_city: { row: 5, col: 2 },
  large_city: { row: 5, col: 2 },
  major_city: { row: 5, col: 2 },

  // Economic buildings - NOTE: farm uses IsoCity farm sheet
  farm: { row: -2, col: -2 },        // Special: uses IsoCity farm sheet
  woodcutters_camp: { row: 3, col: 0 }, // Tree/nature area
  granary: { row: 4, col: 0 },       // Warehouse
  lumber_mill: { row: 4, col: 1 },   // Industrial building
  mine: { row: 4, col: 2 },          // Quarry/mining
  smelter: { row: 4, col: 3 },       // Kilns/furnaces
  market: { row: 3, col: 2 },        // Market stalls
  oil_well: { row: 2, col: 4 },      // Oil derrick (industrial+)
  oil_platform: { row: 4, col: 4 },  // Dock area (offshore)
  refinery: { row: 4, col: 4 },      // Industrial refinery

  // Knowledge buildings
  library: { row: 0, col: 1 },       // Temple with columns
  university: { row: 2, col: 0 },    // Large institution
  temple: { row: 5, col: 3 },        // Temple
  senate: { row: 0, col: 0 },        // Large palace

  // Military buildings
  barracks: { row: 1, col: 3 },      // Fortress compound
  stable: { row: 1, col: 2 },        // Stable area
  siege_factory: { row: 4, col: 1 }, // Workshop
  dock: { row: 4, col: 4 },          // Dock with crane
  auto_plant: { row: 0, col: 1 },    // Factory (modern)
  factory: { row: 4, col: 2 },       // Factory
  airbase: { row: -3, col: -3 },     // Special: uses IsoCity airport sprite

  // Defensive buildings
  tower: { row: 2, col: 1 },         // Tower
  stockade: { row: 0, col: 1 },      // Small fort/keep
  fort: { row: 1, col: 3 },          // Fortified building
  fortress: { row: 1, col: 3 },      // Large fortress
  castle: { row: 0, col: 0 },        // Castle
  bunker: { row: 4, col: 0 },        // Bunker style
  
  // Roads and terrain
  road: { row: -1, col: -1 },        // Special handling
  grass: { row: -1, col: -1 },
  water: { row: -1, col: -1 },
  empty: { row: -1, col: -1 },
};

// Age-specific building sprite overrides
// These override the default BUILDING_SPRITE_MAP for specific ages
// Based on comprehensive visual audit of each sprite sheet
export const AGE_BUILDING_OVERRIDES: Record<Age, Partial<Record<RoNBuildingType, { row: number; col: number }>>> = {
  classical: {
    // City - Row 5, Col 2 is temple (good city center)
    city_center: { row: 5, col: 2 },
    // Market - Row 3, Col 3 is actual market stalls with awnings (was 3,2 villa)
    market: { row: 3, col: 3 },
    // Library - Row 0, Col 1 is Parthenon-style temple - impressive!
    library: { row: 0, col: 1 },
    // University - Row 2, Col 0 is theater/amphitheater (cultural/education)
    university: { row: 2, col: 0 },
    // Temple - Row 2, Col 2 is fire temple/sanctuary
    temple: { row: 2, col: 2 },
    // Senate - Row 1, Col 4 is Greek temple with columns (civic building)
    senate: { row: 1, col: 4 },
    // Barracks - Row 1, Col 3 is WALLED MILITARY COMPOUND with watchtowers!
    barracks: { row: 1, col: 3 },
    // Stable - Row 3, Col 1 is house with garden (was 3,4 shop - inappropriate)
    stable: { row: 3, col: 1 },
    // Dock - Row 4, Col 4 is dock with crane
    dock: { row: 4, col: 4 },
    // Mine - Row 4, Col 2 is quarry
    mine: { row: 4, col: 2 },
    // Smelter - Row 4, Col 3 is kilns/furnaces
    smelter: { row: 4, col: 3 },
    // Granary - Row 5, Col 0 is warehouse
    granary: { row: 5, col: 0 },
    // Lumber mill - Row 4, Col 0 is period-appropriate workshop (was 4,1 industrial)
    lumber_mill: { row: 4, col: 0 },
    // Factory - Row 4, Col 0 is workshop
    factory: { row: 4, col: 0 },
    // Siege factory - Row 4, Col 0 is artisan workshop (was 4,1 industrial)
    siege_factory: { row: 4, col: 0 },
    // Tower - Row 2, Col 1 is watchtower
    tower: { row: 2, col: 1 },
    // Fort - Row 1, Col 3 is walled compound (was 2,4 lighthouse)
    fort: { row: 1, col: 3 },
    // Fortress - Row 1, Col 3 is walled compound (was 3,0 Pantheon)
    fortress: { row: 1, col: 3 },
    // Stockade - Row 4, Col 0 is basic fortification (was 0,1 Parthenon)
    stockade: { row: 4, col: 0 },
    // Woodcutters camp - Row 4, Col 0 is rustic workshop (was 3,0 Pantheon)
    woodcutters_camp: { row: 4, col: 0 },
    // Castle - Row 0, Col 0 is large palace
    castle: { row: 0, col: 0 },
  },
  medieval: {
    // City - Row 1, Col 0 is walled courtyard/garden
    city_center: { row: 1, col: 0 },
    // Small city - same as city_center
    small_city: { row: 1, col: 0 },
    // Large city - same as city_center
    large_city: { row: 1, col: 0 },
    // Major city - castle for progression
    major_city: { row: 0, col: 0 },
    // Market - Row 2, Col 0 is market square with stalls
    market: { row: 2, col: 0 },
    // Library - Row 0, Col: 4 is church/chapel
    library: { row: 0, col: 4 },
    // University - Row 3, Col 2 is gothic stone university
    university: { row: 3, col: 2 },
    // Temple - Row 5, Col 3 is gothic cathedral
    temple: { row: 5, col: 3 },
    // Senate - Row 1, Col 4 is Gothic abbey (was 5,2 anachronistic dome)
    senate: { row: 1, col: 4 },
    // Barracks - Row 1, Col 3 is walled fortress compound
    barracks: { row: 1, col: 3 },
    // Stable - Row 1, Col 2 is horse paddock - PERFECT!
    stable: { row: 1, col: 2 },
    // Dock - Row 5, Col 0 is waterfront building
    dock: { row: 5, col: 0 },
    // Mine - Row 4, Col 3 is mining complex with hoist (was 4,2 forge)
    mine: { row: 4, col: 3 },
    // Smelter - Row 0, Col 2 is windmill + forge
    smelter: { row: 0, col: 2 },
    // Granary - Row 4, Col 1 is large barn
    granary: { row: 4, col: 1 },
    // Lumber mill - Row 3, Col 3 is barn/workshop (was 0,3 watchtower)
    lumber_mill: { row: 3, col: 3 },
    // Tower - Row 0, Col 1 is stone keep
    tower: { row: 0, col: 1 },
    // Fort - Row 5, Col 1 is stone fortress
    fort: { row: 5, col: 1 },
    // Fortress - Row 5, Col 1 is stone fortress (distinct from barracks)
    fortress: { row: 5, col: 1 },
    // Stockade - Row 3, Col 1 is Tudor building with fenced area
    stockade: { row: 3, col: 1 },
    // Castle - Row 0, Col 0 is gray stone castle
    castle: { row: 0, col: 0 },
    // Siege factory - Row 4, Col 2 is forge (was 3,4 barn)
    siege_factory: { row: 4, col: 2 },
  },
  enlightenment: {
    // City - Row 0, Col 0 is Georgian mansion
    city_center: { row: 0, col: 0 },
    // Market - Row 4, Col 0 is shop building (was 0,3 fire station)
    market: { row: 4, col: 0 },
    // Library - Row 0, Col 4 is classical columns building
    library: { row: 0, col: 4 },
    // University - Row 2, Col 0 is OBSERVATORY - perfect for Age of Science!
    university: { row: 2, col: 0 },
    // Temple - Row 5, Col 3 is Greek temple
    temple: { row: 5, col: 3 },
    // Senate - Row 5, Col 2 is domed capitol
    senate: { row: 5, col: 2 },
    // Barracks - Row 1, Col 3 is brick compound (was 1,4 civic/museum)
    barracks: { row: 1, col: 3 },
    // Stable - Row 5, Col 0 is stagecoach station - PERFECT!
    stable: { row: 5, col: 0 },
    // Dock - Row 2, Col 4 is lighthouse with harbor
    dock: { row: 2, col: 4 },
    // Mine - Row 4, Col 3 is stone mill
    mine: { row: 4, col: 3 },
    // Smelter - Row 4, Col 2 is factory building (was 3,3 cottage!)
    smelter: { row: 4, col: 2 },
    // Granary - Row 4, Col 1 is warehouse with cart
    granary: { row: 4, col: 1 },
    // Lumber mill - Row 2, Col 2 is watermill
    lumber_mill: { row: 2, col: 2 },
    // Factory - Row 0, Col 2 is early factory with waterwheel
    factory: { row: 0, col: 2 },
    // Fort - Row 1, Col 3 is compound (was 5,1 bridge!)
    fort: { row: 1, col: 3 },
    // Tower - Row 1, Col 3 is compound (was 2,1 water tower)
    tower: { row: 1, col: 3 },
    // Fortress - Row 1, Col 3 is compound (or use medieval fallback)
    fortress: { row: 1, col: 3 },
    // Stockade - Row 1, Col 3 is compound (was 0,1 townhouse)
    stockade: { row: 1, col: 3 },
    // Bunker - Row 4, Col 2 is industrial building (was 4,0 shop)
    bunker: { row: 4, col: 2 },
    // Castle - Row 5, Col 2 is grand capitol (was 0,0 same as city_center)
    castle: { row: 5, col: 2 },
  },
  industrial: {
    // City - Row 5, Col 2 is grand city hall with clock tower
    city_center: { row: 5, col: 2 },
    // Market - Row 3, Col 4 is storefront shop
    market: { row: 3, col: 4 },
    // Library - Row 3, Col 2 is grand Victorian mansion with turret - distinctive!
    library: { row: 3, col: 2 },
    // University - Row 2, Col 0 is large Victorian school
    university: { row: 2, col: 0 },
    // Temple - Row 1, Col 4 is church with steeple
    temple: { row: 1, col: 4 },
    // Senate - Row 5, Col 3 is classical columns building
    senate: { row: 5, col: 3 },
    // Barracks - Row 5, Col 1 is large hangar/military depot
    barracks: { row: 5, col: 1 },
    // Stable - Row 5, Col 1 is transport depot (was 3,1 with bleeding)
    stable: { row: 5, col: 1 },
    // Dock - Row 5, Col 0 is train station
    dock: { row: 5, col: 0 },
    // Mine - Row 4, Col 2 is mining complex
    mine: { row: 4, col: 2 },
    // Smelter - Row 4, Col 3 is steel facility
    smelter: { row: 4, col: 3 },
    // Granary - Row 4, Col 0 is warehouse
    granary: { row: 4, col: 0 },
    // Lumber mill - Row 0, Col 2 is red brick industrial building
    lumber_mill: { row: 0, col: 2 },
    // Factory - Row 0, Col 1 is large factory - PERFECT!
    factory: { row: 0, col: 1 },
    // Oil well - Row 2, Col 4 is oil derrick - PERFECT!
    oil_well: { row: 2, col: 4 },
    // Refinery - Row 4, Col 4 is industrial refinery
    refinery: { row: 4, col: 4 },
    // Siege factory - Row 4, Col 1 is factory
    siege_factory: { row: 4, col: 1 },
    // Bunker - Row 0, Col 3 is gray brick fortified building (was 4,0 warehouse)
    bunker: { row: 0, col: 3 },
    // Fort - Row 0, Col 3 is gray brick building (fortified look)
    fort: { row: 0, col: 3 },
    // Fortress - Row 0, Col 3 is gray brick building
    fortress: { row: 0, col: 3 },
    // Castle - Row 0, Col 3 is gray brick institutional building (was 0,0 brownstones)
    castle: { row: 0, col: 3 },
    // Stockade - Row 0, Col 3 is gray institutional (was 0,1 factory - wrong!)
    stockade: { row: 0, col: 3 },
    // Tower - Row 0, Col 3 is gray institutional (was 2,1 water tower - wrong!)
    tower: { row: 0, col: 3 },
    // Woodcutters camp - Row 4, Col 0 is warehouse (was 3,0 tree - wrong!)
    woodcutters_camp: { row: 4, col: 0 },
    // Auto plant - Row 4, Col 2 is industrial manufacturing facility
    auto_plant: { row: 4, col: 2 },
  },
  modern: {
    // City - Row 0, Col 1 is tall skyscraper
    city_center: { row: 0, col: 1 },
    // Small city - Row 0, Col 0 is glass office tower
    small_city: { row: 0, col: 0 },
    // Large city - Row 0, Col 1 dark skyscraper
    large_city: { row: 0, col: 1 },
    // Major city - Row 5, Col 2 is capitol building
    major_city: { row: 5, col: 2 },
    // Market - Row 3, Col 4 is shop building
    market: { row: 3, col: 4 },
    // Library - Row 5, Col 3 is classical columns building
    library: { row: 5, col: 3 },
    // University - Row 2, Col 0 is government/campus complex
    university: { row: 2, col: 0 },
    // Temple - Row 5, Col 3 is classical columns building (was 0,4 hospital!)
    temple: { row: 5, col: 3 },
    // Senate - Row 5, Col 2 is domed capitol - PERFECT!
    senate: { row: 5, col: 2 },
    // Barracks - Row 1, Col 3 is police compound (was 0,3 fire station)
    barracks: { row: 1, col: 3 },
    // Airbase - Row 5, Col 0 is AIRPORT with runway! Use native sprite
    airbase: { row: 5, col: 0 },
    // Auto plant - Row 4, Col 2 is industrial manufacturing facility
    auto_plant: { row: 4, col: 2 },
    // Smelter - Row 4, Col 3 is industrial steel facility
    smelter: { row: 4, col: 3 },
    // Factory - Row 4, Col 2 is industrial factory
    factory: { row: 4, col: 2 },
    // Granary - Row 4, Col 1 is warehouse/logistics
    granary: { row: 4, col: 1 },
    // Stable - Row 4, Col 1 is warehouse/logistics depot
    stable: { row: 4, col: 1 },
    // Dock - Row 4, Col 1 is warehouse for modern port logistics
    dock: { row: 4, col: 1 },
    // Lumber mill - Row 4, Col 1 is warehouse for lumber logistics
    lumber_mill: { row: 4, col: 1 },
    // Woodcutters camp - Row 4, Col 1 is warehouse for lumber logistics
    woodcutters_camp: { row: 4, col: 1 },
    // Tower - Row 1, Col 3 is security compound (was 2,1 water tower)
    tower: { row: 1, col: 3 },
    // Fort - Row 1, Col 3 is security/police compound
    fort: { row: 1, col: 3 },
    // Fortress - Row 1, Col 3 is security compound
    fortress: { row: 1, col: 3 },
    // Stockade - Row 1, Col 3 is security compound
    stockade: { row: 1, col: 3 },
    // Castle - Row 1, Col 3 is security compound
    castle: { row: 1, col: 3 },
    // Bunker - Row 1, Col 3 is security compound
    bunker: { row: 1, col: 3 },
    // Oil well - Row 4, Col 4 is refinery complex (was 2,4 rocket!)
    oil_well: { row: 4, col: 4 },
    // Refinery - Row 4, Col 4 is refinery complex
    refinery: { row: 4, col: 4 },
    // Mine - Row 4, Col 2 is industrial facility
    mine: { row: 4, col: 2 },
    // Siege factory - Row 4, Col 1 is warehouse
    siege_factory: { row: 4, col: 1 },
  },
};

// Helper to get age-specific sprite position
export function getAgeSpritePosition(
  buildingType: RoNBuildingType,
  age: Age
): { row: number; col: number } | null {
  // Check for age-specific override first
  const ageOverride = AGE_BUILDING_OVERRIDES[age]?.[buildingType];
  if (ageOverride) return ageOverride;
  
  // Fall back to default mapping
  const defaultPos = BUILDING_SPRITE_MAP[buildingType];
  if (defaultPos && defaultPos.row >= 0) return defaultPos;
  
  return null;
}

// IsoCity Farm Sheet positions - for age-appropriate farm sprites
// Sheet: /assets/sprites_red_water_new_farm.png (5x6 grid)
// Based on detailed audit of farm sheet - each age gets distinct look
export const ISOCITY_FARM_POSITIONS: Record<Age, { row: number; col: number }> = {
  classical: { row: 3, col: 1 },    // Vineyard - ancient Mediterranean agriculture
  medieval: { row: 2, col: 4 },     // Windmill - ICONIC medieval farming
  enlightenment: { row: 2, col: 2 }, // Storage barn - larger scale operations
  industrial: { row: 1, col: 0 },   // Dairy farm with red barn + silo
  modern: { row: 3, col: 4 },       // Greenhouse - high-tech agriculture
};

// IsoCity sheet path for farms
export const ISOCITY_FARM_SHEET = '/assets/sprites_red_water_new_farm.webp';
export const ISOCITY_FARM_COLS = 5;
export const ISOCITY_FARM_ROWS = 6;

// IsoCity airport for airbase
export const ISOCITY_AIRPORT_SHEET = '/assets/buildings/airport.webp';

// Vertical offset adjustments per building type (multiplied by tile height)
// 3x3 buildings need larger offsets (like IsoCity mall at -1.5)
// 1x1 economic buildings have smaller offsets
export const BUILDING_VERTICAL_OFFSETS: Partial<Record<RoNBuildingType, number>> = {
  // City centers (3x3 buildings)
  city_center: -1.2,
  small_city: -1.2,
  large_city: -1.5,     // Skyscrapers are tall
  major_city: -1.6,
  
  // Economic buildings (1x1)
  farm: -0.2,
  woodcutters_camp: -0.5, // Shifted up 0.3 more
  lumber_mill: -0.4,
  mine: -0.3,
  granary: -0.35,
  
  // Industrial buildings (tall smokestacks!)
  smelter: -0.7,        // Shifted down 0.3 tiles from -1.0
  factory: -0.6,        // Smokestacks extend high
  oil_well: -1.2,       // Oil derricks are tall
  refinery: -1.3,       // Tall distillation columns
  oil_platform: -0.8,
  
  // Knowledge buildings
  library: -0.8,
  university: -0.8,     // Shifted up for better cropping
  temple: -0.4,
  senate: -0.5,
  
  // Military buildings
  barracks: -0.8,       // Increased for better cropping
  stable: -0.7,         // Increased
  siege_factory: -0.8,  // Increased for lower cropping
  auto_plant: -0.5,
  
  // Defensive buildings
  tower: -0.5,          // Shifted up 0.2
  fort: -1.2,
  fortress: -1.2,
  castle: -1.2,
  bunker: -0.35,
  stockade: -0.4,
  
  // Special buildings
  airbase: -1.5,
  dock: -1.8,           // Shifted up for lower cropping
  market: -0.7,         // Increased for better cropping
};

// Age-specific vertical offset adjustments (added to base offset)
// Use this for buildings that need different offsets in different eras
// Updated December 2025 based on comprehensive offset audit
export const AGE_VERTICAL_OFFSETS: Partial<Record<Age, Partial<Record<RoNBuildingType, number>>>> = {
  classical: {
    library: -0.5,      // Crop lower for Classical library
    market: -0.5,       // Crop lower - asset above bleeding through
    dock: -0.3,         // Additional shift for dock
    lumber_mill: 0.9,   // Shift DOWN - was 0.4 tiles too high (fixed from 0.5)
    barracks: -0.3,     // Crop lower
    stable: -0.3,       // Crop lower
    tower: -0.2,        // Shift up 0.2
  },
  medieval: {
    market: -0.2,       // Additional shift for market
    city_center: -0.5,  // Crop lower down
    small_city: -0.5,   // Same as city_center (was missing)
    large_city: -0.5,   // Same as city_center (was missing)
    fort: 0.6,          // Shift DOWN 0.6 tiles
    fortress: 0.6,      // Same as fort for consistency (was missing)
    temple: -0.3,       // Shift UP for tall cathedral (was missing)
    tower: -0.2,        // Shift UP for tall keep (was missing)
    mine: -0.2,         // Shift UP for hoist tower (was missing)
  },
  enlightenment: {
    market: 0.2,        // Shift DOWN (well-cropped, just needs position adjustment)
    fort: 0.6,          // Same as medieval fort (uses medieval sprite)
    senate: -0.4,       // Shift UP for tall dome (was missing)
    fortress: 0.4,      // Shift DOWN - modest building (was missing)
    stockade: -0.2,     // Shift UP to match tower/barracks (was missing)
    bunker: -0.15,      // Shift UP for smokestacks (was missing)
    siege_factory: 0.3, // Shift DOWN - warehouse is shorter (was missing)
    lumber_mill: -0.2,  // Shift UP for watermill (was missing)
    temple: 0.1,        // Shift DOWN slightly (was missing)
    small_city: -0.2,   // Shift UP for domed capitol (was missing)
  },
  industrial: {
    market: -1.0,       // Much lower cropping needed - still seeing blue base
    library: -0.8,      // Crop way lower at top and bottom
    stable: -0.5,       // Crop lower at top and bottom
    fort: 0.6,          // Shift DOWN 0.6 tiles
    siege_factory: -0.3, // Crop 0.3 tiles lower
    lumber_mill: -0.2,  // Shift UP for tall smokestacks (was missing)
    temple: -0.2,       // Shift UP for church steeple (was missing)
    bunker: -0.15,      // Bring closer to fort (was missing)
  },
  modern: {
    market: -0.8,       // Needs grey base + lower cropping
    city_center: -1.0,  // Full tile shift up - bottom cropped too tight
    small_city: -1.0,   // Full tile shift up - bottom cropped too tight
    large_city: -1.0,   // Full tile shift up - bottom cropped too tight
    major_city: -0.5,   // Reduced - capitol dome is low-rise (was -1.0)
    temple: -0.4,       // Match library offset (was missing)
    dock: 1.1,          // Shift DOWN - warehouse sprite doesn't need -1.8 (was missing)
    fort: 0.7,          // Shift DOWN - same sprite as tower (was missing)
    fortress: 0.7,      // Shift DOWN - same sprite as tower (was missing)
    castle: 0.7,        // Shift DOWN - same sprite as tower (was missing)
  },
};

// Construction sprite positions - maps building types to IsoCity construction sheet
// Sheet: /assets/sprites_red_water_new_construction.png (5x6 grid)
// Based on visual audit of construction sprites - December 2025
export const CONSTRUCTION_SPRITE_MAP: Partial<Record<RoNBuildingType, { row: number; col: number }>> = {
  // City buildings (3x3) - use large institutional construction
  city_center: { row: 5, col: 2 },    // Government building framing
  small_city: { row: 5, col: 2 },     // Government building framing
  large_city: { row: 5, col: 2 },     // Government building framing  
  major_city: { row: 5, col: 2 },     // Government building framing
  
  // Economic buildings (1x1) - use small/industrial construction
  farm: { row: 0, col: 2 },           // Small house framing
  woodcutters_camp: { row: 3, col: 0 }, // Tree with scaffolding
  granary: { row: 4, col: 0 },        // Basement pit
  lumber_mill: { row: 3, col: 4 },    // Industrial brick framing
  mine: { row: 2, col: 1 },           // Large circular excavation
  smelter: { row: 2, col: 4 },        // Industrial framework
  market: { row: 3, col: 1 },         // Brick building framing
  oil_well: { row: 2, col: 4 },       // Industrial framework
  oil_platform: { row: 2, col: 4 },   // Industrial framework
  refinery: { row: 4, col: 4 },       // Large industrial complex
  
  // Knowledge buildings (2x2) - use institutional construction
  library: { row: 5, col: 3 },        // Columned building framing
  university: { row: 2, col: 0 },     // Columns/institutional
  temple: { row: 3, col: 2 },         // Curved/domed framing
  senate: { row: 5, col: 2 },         // Government building framing
  
  // Military buildings (2x2) - use walled/fortress construction
  barracks: { row: 0, col: 0 },       // Foundation pit with scaffolding
  stable: { row: 1, col: 4 },         // House framing with walls
  siege_factory: { row: 2, col: 2 },  // Steel framework
  dock: { row: 4, col: 1 },           // Circular base/harbor
  auto_plant: { row: 4, col: 3 },     // Industrial construction
  factory: { row: 4, col: 3 },        // Industrial construction
  airbase: { row: 5, col: 0 },        // Airport/runway construction
  missile_silo: { row: 4, col: 0 },   // Deep pit
  
  // Defensive buildings - use fortress/castle construction
  tower: { row: 0, col: 4 },          // Detailed framework
  stockade: { row: 0, col: 2 },       // Small house framing
  fort: { row: 3, col: 3 },           // Castle/fortress framework
  fortress: { row: 3, col: 3 },       // Castle/fortress framework
  castle: { row: 3, col: 3 },         // Castle/fortress framework
  bunker: { row: 4, col: 0 },         // Basement pit
  lookout: { row: 0, col: 4 },        // Detailed framework
  observation_post: { row: 0, col: 4 }, // Detailed framework
  redoubt: { row: 0, col: 0 },        // Foundation pit
  
  // Anti-air buildings
  air_defense_gun: { row: 2, col: 2 }, // Steel framework
  radar_air_defense: { row: 2, col: 2 }, // Steel framework
  sam_installation: { row: 2, col: 2 }, // Steel framework
};

// Default construction positions by building size (fallback)
export const CONSTRUCTION_SIZE_DEFAULTS = {
  small: { row: 0, col: 2 },   // 1x1 buildings
  medium: { row: 2, col: 0 },  // 2x2 buildings
  large: { row: 4, col: 3 },   // 3x3+ buildings
};

// Construction-specific vertical offset adjustments
// These are ADDITIONAL offsets for buildings under construction (scaffolding sprites)
// Positive = shift down, Negative = shift up (crop from top)
export const CONSTRUCTION_VERTICAL_OFFSETS: Partial<Record<RoNBuildingType, number>> = {
  // City buildings - align with final building position
  city_center: -0.5,
  small_city: -0.5,
  large_city: -0.5,
  major_city: -0.5,
  
  // Economic buildings
  lumber_mill: 0.3,     // Shift down 0.3 tiles
  smelter: 0.1,         // Slight shift for construction
  market: 0.0,          // Will use cropTop instead
  granary: 0.2,         // Shift down slightly
  mine: 0.0,            // Neutral
  oil_well: 0.5,        // Shift down - derrick is tall
  refinery: 0.3,        // Shift down
  woodcutters_camp: 0.2, // Shift down
  
  // Knowledge buildings
  library: -0.3,        // Shift up for columned building
  university: -0.2,     // Shift up
  temple: -0.2,         // Shift up for domed building
  senate: -0.3,         // Shift up
  
  // Military buildings
  barracks: 0.0,        // Neutral
  stable: 0.0,          // Neutral
  auto_plant: -0.3,     // Shift up 0.3 tiles
  factory: 0.0,         // Neutral
  dock: 0.3,            // Shift down for harbor
  airbase: -0.5,        // Shift up for airport
  
  // Defensive buildings
  tower: 0.0,           // Neutral
  fort: -0.3,           // Shift up
  fortress: -0.3,       // Shift up
  castle: -0.5,         // Shift up for large castle
  bunker: 0.2,          // Shift down
};

// Construction-specific top cropping (fraction of sprite height to remove from top)
// This removes bleeding from adjacent sprites in the sprite sheet
export const CONSTRUCTION_CROP_TOP: Partial<Record<RoNBuildingType, number>> = {
  smelter: 0.1,         // Crop 0.2 tiles lower at top (~10% of sprite)
  market: 0.15,         // Cut off 0.3 tiles lower (~15% of sprite)
};

// Construction-specific bottom cropping (fraction of sprite height to remove from bottom)
export const CONSTRUCTION_CROP_BOTTOM: Partial<Record<RoNBuildingType, number>> = {
  smelter: 0.05,        // Crop bottom slightly
  market: 0.05,         // Crop bottom slightly
};

// Age-specific cropping for FINISHED buildings (not construction)
// Format: { age: { building: { cropTop: fraction, cropBottom: fraction } } }
// Based on comprehensive sprite audit - December 2025
export const AGE_BUILDING_CROP: Partial<Record<Age, Partial<Record<RoNBuildingType, { cropTop?: number; cropBottom?: number }>>>> = {
  classical: {
    university: { cropTop: 0.05 },      // Minor bleeding at top
    barracks: { cropTop: 0.05 },        // Minor bleeding at top
    tower: { cropTop: 0.05 },           // Minor bleeding at top
    market: { cropTop: 0.10 },          // Bleeding from above
  },
  medieval: {
    market: { cropTop: 0.12 },          // Bleeding from above
    university: { cropTop: 0.10 },      // Bleeding from above
    barracks: { cropTop: 0.05 },        // Minor bleeding
    granary: { cropTop: 0.05 },         // Minor bleeding
  },
  enlightenment: {
    university: { cropTop: 0.05 },      // Minor bleeding at top
    dock: { cropTop: 0.05 },            // Minor bleeding at top
    mine: { cropTop: 0.05 },            // Minor bleeding at top
    granary: { cropTop: 0.05 },         // Minor bleeding at top
    lumber_mill: { cropTop: 0.08 },     // Bleeding at top
    woodcutters_camp: { cropTop: 0.10 }, // Bleeding at top
  },
  industrial: {
    market: { cropTop: 0.30, cropBottom: 0.1 },  // Severe bleeding (increased from 0.25)
    library: { cropTop: 0.15, cropBottom: 0.15 }, // Bleeding at top and bottom
    university: { cropTop: 0.15, cropBottom: 0.15 }, // Bleeding at top and bottom
    oil_well: { cropTop: 0.25, cropBottom: 0.2 }, // Increased for severe bleeding
    stable: { cropTop: 0.25, cropBottom: 0.05 },  // Severe bleeding at top
    mine: { cropTop: 0.15, cropBottom: 0.10 },    // Bleeding at top and bottom
    siege_factory: { cropTop: 0.15 },             // Bleeding at top
    tower: { cropTop: 0.10 },                     // Bleeding at top
    woodcutters_camp: { cropTop: 0.25 },          // Severe bleeding at top
    temple: { cropTop: 0.08 },                    // Minor bleeding at top
    fortress: { cropTop: 0.15 },                  // Bleeding at top
    granary: { cropTop: 0.08 },                   // Minor bleeding at top
  },
  modern: {
    university: { cropTop: 0.05 },      // Minor bleeding at top
    market: { cropTop: 0.10 },          // Minor bleeding at top and bottom
  },
};

// Scale adjustments per building type
// 1x1 economic buildings scaled to fit nicely in one tile
export const BUILDING_SCALES: Partial<Record<RoNBuildingType, number>> = {
  city_center: 1.0,
  small_city: 1.1,
  large_city: 1.2,
  major_city: 1.3,
  farm: 0.85,           // 1x1 - fit in single tile
  woodcutters_camp: 0.85, // 1x1
  lumber_mill: 0.9,     // 1x1
  mine: 0.9,            // 1x1
  castle: 0.7,
  fortress: 0.7,
  fort: 0.8,
  airbase: 1.0,
};

// Age-specific scale adjustments (multiplied with base scale)
export const AGE_BUILDING_SCALES: Partial<Record<Age, Partial<Record<RoNBuildingType, number>>>> = {
  medieval: {
    fort: 1.3,  // Scale up by 30%
  },
  enlightenment: {
    fort: 1.3,  // Same as medieval (uses medieval sprite)
  },
  industrial: {
    fort: 1.3,  // Same as medieval (uses medieval sprite)
  },
};

// Get sprite coordinates for a building
export function getSpriteCoords(
  buildingType: RoNBuildingType,
  sheetWidth: number,
  sheetHeight: number,
  pack: RoNSpritePack
): { sx: number; sy: number; sw: number; sh: number } | null {
  const pos = BUILDING_SPRITE_MAP[buildingType];
  if (!pos || pos.row < 0) return null;
  
  const tileWidth = Math.floor(sheetWidth / pack.cols);
  const tileHeight = Math.floor(sheetHeight / pack.rows);
  
  return {
    sx: pos.col * tileWidth,
    sy: pos.row * tileHeight,
    sw: tileWidth,
    sh: tileHeight,
  };
}

// Tile dimensions for isometric rendering (matching IsoCity)
// TILE_HEIGHT = TILE_WIDTH * 0.6 for proper isometric ratio
export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 38.4; // 64 * 0.6

// Unit sprite colors by player
export const PLAYER_COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#22c55e', // Green
  '#f59e0b', // Orange
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#84cc16', // Lime
];
