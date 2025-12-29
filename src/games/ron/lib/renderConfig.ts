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

// Age sprite packs - all share the same layout as sprites_red_water_new
export const AGE_SPRITE_PACKS: Record<Age, RoNSpritePack> = {
  ancient: {
    id: 'ancient',
    name: 'Ancient Age',
    age: 'ancient',
    src: '/assets/ages/classics.webp', // Use classics for ancient too
    cols: 5,
    rows: 6,
    layout: 'row',
    globalScale: 0.8,
  },
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

// Mapping from RoN building types to sprite sheet positions (row, col)
// Based on the 5x6 grid layout
export const BUILDING_SPRITE_MAP: Partial<Record<RoNBuildingType, { row: number; col: number }>> = {
  // City buildings - City center is at row 5 (0-indexed: 5), col 3 (0-indexed: 2)
  city_center: { row: 5, col: 2 },
  small_city: { row: 5, col: 2 },    // Same sprite, different upgrade level
  large_city: { row: 5, col: 2 },
  major_city: { row: 5, col: 2 },
  
  // Economic buildings
  farm: { row: 0, col: 2 },          // Use industrial slot for farms
  woodcutters_camp: { row: 3, col: 0 }, // Tree slot
  granary: { row: 4, col: 1 },       // Warehouse slot
  lumber_mill: { row: 4, col: 2 },   // Factory slot
  mine: { row: 4, col: 3 },          // Factory slot
  smelter: { row: 4, col: 4 },       // Large factory slot
  market: { row: 0, col: 1 },        // Commercial slot
  oil_well: { row: 2, col: 2 },      // Power plant (industrial)
  refinery: { row: 4, col: 4 },      // Large factory
  
  // Knowledge buildings  
  library: { row: 1, col: 4 },       // School slot
  university: { row: 2, col: 0 },    // University slot
  temple: { row: 1, col: 0 },        // Park slot (religious)
  senate: { row: 5, col: 2 },        // City hall style
  
  // Military buildings
  barracks: { row: 0, col: 2 },      // Industrial style building
  stable: { row: 0, col: 2 },        // Industrial style
  siege_factory: { row: 4, col: 3 }, // Factory style
  dock: { row: 5, col: 0 },          // Airport slot (near water)
  auto_plant: { row: 4, col: 4 },    // Large factory
  factory: { row: 4, col: 3 },       // Medium factory
  airbase: { row: 5, col: 0 },       // Airport slot
  
  // Defensive buildings
  tower: { row: 1, col: 3 },         // Police station style (tall)
  stockade: { row: 3, col: 0 },      // Tree/nature area
  fort: { row: 2, col: 3 },          // Stadium style (fortress-like)
  fortress: { row: 2, col: 3 },
  castle: { row: 2, col: 3 },
  bunker: { row: 4, col: 1 },        // Warehouse style
  
  // Roads and terrain
  road: { row: -1, col: -1 },        // Special handling
  grass: { row: -1, col: -1 },
  water: { row: -1, col: -1 },
  empty: { row: -1, col: -1 },
};

// Vertical offset adjustments per building type (multiplied by tile height)
export const BUILDING_VERTICAL_OFFSETS: Partial<Record<RoNBuildingType, number>> = {
  city_center: -0.6,
  small_city: -0.6,
  large_city: -0.6,
  major_city: -0.6,
  farm: -0.4,
  barracks: -0.4,
  library: -0.35,
  university: -0.55,
  market: -0.4,
  tower: -0.2,
  fort: -1.2,
  fortress: -1.2,
  castle: -1.2,
  mine: -0.3,
  factory: -0.3,
  airbase: -1.5,
  dock: -1.5,
};

// Scale adjustments per building type
export const BUILDING_SCALES: Partial<Record<RoNBuildingType, number>> = {
  city_center: 1.0,
  small_city: 1.1,
  large_city: 1.2,
  major_city: 1.3,
  castle: 0.7,
  fortress: 0.7,
  fort: 0.8,
  airbase: 1.0,
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
