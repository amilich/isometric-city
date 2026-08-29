// Volumetric descriptions of every building type for the 3D renderer.
// The isometric renderer draws sprites; here each building type is described as
// real geometry (height, silhouette style, materials) so it can be extruded into
// the world and lit by an actual sun.

import { BuildingType } from '@/games/isocity/types';
import { TEX } from './textureAtlas';

export type BuildingStyle =
  | 'house'   // pitched roof, small footprint
  | 'block'   // flat roof with parapet
  | 'tower'   // stacked setbacks, tallest tier is thinnest
  | 'slab'    // low wide volume (warehouses, malls, sheds)
  | 'plaza'   // ground-level surface only (parks, courts, fields)
  | 'tank'    // cylindrical volume (water tower, silos)
  | 'dome';   // rounded top (stadium, museum, space program)

export interface Building3DSpec {
  /** Height of the main volume in tile units (1 unit == 1 tile edge). */
  height: number;
  /** Deterministic per-instance height jitter, as a fraction of height. */
  variance: number;
  /** Wall / body color. */
  wall: string;
  /** Roof color. */
  roof: string;
  style: BuildingStyle;
  /** Whether facades get procedural windows (lit at night). */
  windows: boolean;
  /** How far the volume is inset from its footprint, in tile units. */
  inset: number;
}

const DEFAULT_SPEC: Building3DSpec = {
  height: 0.9,
  variance: 0.1,
  wall: '#c8c3b8',
  roof: '#8a8580',
  style: 'block',
  windows: true,
  inset: 0.12,
};

const SPECS: Partial<Record<BuildingType, Building3DSpec>> = {
  // ---- Residential -------------------------------------------------------
  house_small: { height: 0.7, variance: 0.15, wall: '#e8d9b8', roof: '#a8563f', style: 'house', windows: true, inset: 0.2 },
  house_medium: { height: 1.0, variance: 0.15, wall: '#efe2c4', roof: '#94493a', style: 'house', windows: true, inset: 0.16 },
  mansion: { height: 1.35, variance: 0.1, wall: '#f4ecd8', roof: '#7d4a3c', style: 'house', windows: true, inset: 0.1 },
  cabin_house: { height: 0.7, variance: 0.12, wall: '#9b6a41', roof: '#5c4030', style: 'house', windows: true, inset: 0.24 },
  apartment_low: { height: 2.2, variance: 0.25, wall: '#d6c9b4', roof: '#6f665c', style: 'block', windows: true, inset: 0.12 },
  apartment_high: { height: 4.2, variance: 0.4, wall: '#cfd4d8', roof: '#5f6a70', style: 'tower', windows: true, inset: 0.14 },

  // ---- Commercial --------------------------------------------------------
  shop_small: { height: 0.85, variance: 0.1, wall: '#e6cfa8', roof: '#7d7368', style: 'block', windows: true, inset: 0.1 },
  shop_medium: { height: 1.3, variance: 0.15, wall: '#e3c9a0', roof: '#75695d', style: 'block', windows: true, inset: 0.08 },
  office_low: { height: 3.0, variance: 0.3, wall: '#a9c3d4', roof: '#5d6d78', style: 'block', windows: true, inset: 0.12 },
  office_high: { height: 6.5, variance: 0.6, wall: '#8fb3cc', roof: '#4e5f6b', style: 'tower', windows: true, inset: 0.14 },
  office_building_small: { height: 1.6, variance: 0.15, wall: '#b9c9d6', roof: '#5d6d78', style: 'block', windows: true, inset: 0.14 },
  mall: { height: 1.5, variance: 0.1, wall: '#dcd2c4', roof: '#8e8579', style: 'slab', windows: true, inset: 0.06 },

  // ---- Industrial --------------------------------------------------------
  factory_small: { height: 1.1, variance: 0.12, wall: '#b3aca2', roof: '#6d675f', style: 'slab', windows: true, inset: 0.1 },
  factory_medium: { height: 1.6, variance: 0.15, wall: '#a8a196', roof: '#645e57', style: 'slab', windows: true, inset: 0.08 },
  factory_large: { height: 2.2, variance: 0.2, wall: '#9d968b', roof: '#5c5750', style: 'slab', windows: true, inset: 0.06 },
  warehouse: { height: 1.2, variance: 0.08, wall: '#b8b3a8', roof: '#7b756c', style: 'slab', windows: false, inset: 0.06 },

  // ---- Services ----------------------------------------------------------
  police_station: { height: 1.2, variance: 0.05, wall: '#8fa6c4', roof: '#3f5877', style: 'block', windows: true, inset: 0.12 },
  fire_station: { height: 1.2, variance: 0.05, wall: '#c26a5c', roof: '#7d3a31', style: 'block', windows: true, inset: 0.12 },
  hospital: { height: 2.4, variance: 0.1, wall: '#eef1f3', roof: '#9aa8b0', style: 'block', windows: true, inset: 0.1 },
  school: { height: 1.2, variance: 0.05, wall: '#e2c89e', roof: '#8a5c46', style: 'slab', windows: true, inset: 0.1 },
  university: { height: 1.9, variance: 0.1, wall: '#e6dcc4', roof: '#7c5a44', style: 'block', windows: true, inset: 0.12 },
  community_center: { height: 1.0, variance: 0.05, wall: '#dfd3bb', roof: '#7f6f5c', style: 'block', windows: true, inset: 0.14 },

  // ---- Utilities ---------------------------------------------------------
  power_plant: { height: 1.8, variance: 0.05, wall: '#9c9a95', roof: '#5a5854', style: 'slab', windows: false, inset: 0.08 },
  water_tower: { height: 2.1, variance: 0.05, wall: '#b9c6cc', roof: '#7f8c92', style: 'tank', windows: false, inset: 0.3 },

  // ---- Transportation ----------------------------------------------------
  subway_station: { height: 0.5, variance: 0, wall: '#b0aca4', roof: '#5f5b55', style: 'block', windows: false, inset: 0.24 },
  rail_station: { height: 1.3, variance: 0.05, wall: '#d8c9ae', roof: '#6b5a48', style: 'slab', windows: true, inset: 0.1 },

  // ---- Special -----------------------------------------------------------
  stadium: { height: 2.0, variance: 0, wall: '#dedbd4', roof: '#b6c2c8', style: 'dome', windows: false, inset: 0.06 },
  baseball_stadium: { height: 1.8, variance: 0, wall: '#dcd8d0', roof: '#b0bcc2', style: 'dome', windows: false, inset: 0.08 },
  museum: { height: 1.8, variance: 0, wall: '#efe8d8', roof: '#c6bda8', style: 'dome', windows: true, inset: 0.12 },
  airport: { height: 1.4, variance: 0, wall: '#dfe3e6', roof: '#9fb0ba', style: 'slab', windows: true, inset: 0.05 },
  space_program: { height: 3.2, variance: 0, wall: '#e8eaec', roof: '#aeb8be', style: 'tank', windows: false, inset: 0.3 },
  city_hall: { height: 2.0, variance: 0, wall: '#f0e9d8', roof: '#9c8a6c', style: 'dome', windows: true, inset: 0.14 },
  amusement_park: { height: 1.2, variance: 0.2, wall: '#e0a0b8', roof: '#b3557a', style: 'plaza', windows: false, inset: 0.1 },
  roller_coaster_small: { height: 1.6, variance: 0.1, wall: '#d8899f', roof: '#a44a6a', style: 'plaza', windows: false, inset: 0.12 },
  mountain_lodge: { height: 1.2, variance: 0.1, wall: '#a2724a', roof: '#5b4030', style: 'house', windows: true, inset: 0.14 },
  greenhouse_garden: { height: 0.9, variance: 0.05, wall: '#c8e6d6', roof: '#a7d0bf', style: 'house', windows: false, inset: 0.14 },
  animal_pens_farm: { height: 0.6, variance: 0.1, wall: '#b98a5e', roof: '#7b5738', style: 'slab', windows: false, inset: 0.18 },
  marina_docks_small: { height: 0.4, variance: 0.05, wall: '#c9b697', roof: '#8a7455', style: 'slab', windows: false, inset: 0.14 },
  pier_large: { height: 0.25, variance: 0, wall: '#c2ab8a', roof: '#8a7455', style: 'slab', windows: false, inset: 0.1 },
  amphitheater: { height: 0.7, variance: 0, wall: '#d8cfbe', roof: '#a89c88', style: 'plaza', windows: false, inset: 0.1 },
  park_gate: { height: 0.6, variance: 0, wall: '#c7b18d', roof: '#7d6a50', style: 'block', windows: false, inset: 0.3 },
  campground: { height: 0.45, variance: 0.1, wall: '#c8a86a', roof: '#7d6a44', style: 'house', windows: false, inset: 0.28 },
  bleachers_field: { height: 0.5, variance: 0, wall: '#c9c4b8', roof: '#8d887c', style: 'plaza', windows: false, inset: 0.12 },
};

export interface PlazaSurface {
  color: string;
  height: number;
  /** Atlas layer for the ground surface. */
  texture: number;
}

/** Green, flat surfaces: rendered as ground decoration rather than a volume. */
const PLAZA_TYPES: Partial<Record<BuildingType, PlazaSurface>> = {
  park: { color: '#5f9b52', height: 0.02, texture: TEX.GRASS },
  park_large: { color: '#5f9b52', height: 0.02, texture: TEX.GRASS },
  pond_park: { color: '#4f8f66', height: 0.02, texture: TEX.GRASS },
  community_garden: { color: '#6ba053', height: 0.03, texture: TEX.GRASS },
  tennis: { color: '#3f7d5e', height: 0.02, texture: TEX.GRASS },
  basketball_courts: { color: '#a5714a', height: 0.02, texture: TEX.PAVING },
  playground_small: { color: '#b58a5c', height: 0.02, texture: TEX.PAVING },
  playground_large: { color: '#b58a5c', height: 0.02, texture: TEX.PAVING },
  soccer_field_small: { color: '#4f9450', height: 0.02, texture: TEX.GRASS },
  football_field: { color: '#4f9450', height: 0.02, texture: TEX.GRASS },
  baseball_field_small: { color: '#6a9e52', height: 0.02, texture: TEX.GRASS },
  skate_park: { color: '#9a9a9a', height: 0.02, texture: TEX.PAVING },
  swimming_pool: { color: '#3f88b8', height: 0.02, texture: TEX.PAVING },
  mini_golf_course: { color: '#57a05c', height: 0.02, texture: TEX.GRASS },
  go_kart_track: { color: '#7a7a7a', height: 0.02, texture: TEX.PAVING },
  mountain_trailhead: { color: '#6f8f56', height: 0.02, texture: TEX.GRASS },
};

export function getBuilding3DSpec(type: BuildingType): Building3DSpec {
  return SPECS[type] ?? DEFAULT_SPEC;
}

export function getPlazaSurface(type: BuildingType): PlazaSurface | null {
  return PLAZA_TYPES[type] ?? null;
}

export interface BuildingTextures {
  /** Atlas layer used on the walls. */
  wall: number;
  /** Atlas layer used on the roof. */
  roof: number;
}

const STYLE_TEXTURES: Record<BuildingStyle, BuildingTextures> = {
  house: { wall: TEX.STUCCO, roof: TEX.ROOF_SHINGLE },
  block: { wall: TEX.CONCRETE_PANEL, roof: TEX.ROOF_GRAVEL },
  tower: { wall: TEX.GLASS, roof: TEX.ROOF_GRAVEL },
  slab: { wall: TEX.METAL_PANEL, roof: TEX.ROOF_METAL },
  plaza: { wall: TEX.PAVING, roof: TEX.PAVING },
  tank: { wall: TEX.METAL_PANEL, roof: TEX.ROOF_METAL },
  dome: { wall: TEX.CONCRETE_PANEL, roof: TEX.ROOF_METAL },
};

/** Types whose material reads differently from their silhouette style. */
const TEXTURE_OVERRIDES: Partial<Record<BuildingType, Partial<BuildingTextures>>> = {
  apartment_low: { wall: TEX.BRICK },
  apartment_high: { wall: TEX.CONCRETE_PANEL },
  shop_small: { wall: TEX.BRICK },
  shop_medium: { wall: TEX.BRICK },
  office_low: { wall: TEX.GLASS },
  office_building_small: { wall: TEX.GLASS },
  mall: { wall: TEX.CONCRETE_PANEL, roof: TEX.ROOF_GRAVEL },
  school: { wall: TEX.BRICK, roof: TEX.ROOF_SHINGLE },
  university: { wall: TEX.BRICK, roof: TEX.ROOF_SHINGLE },
  police_station: { wall: TEX.BRICK },
  fire_station: { wall: TEX.BRICK },
  hospital: { wall: TEX.CONCRETE_PANEL },
  city_hall: { wall: TEX.CONCRETE_PANEL },
  museum: { wall: TEX.CONCRETE_PANEL },
  rail_station: { wall: TEX.BRICK, roof: TEX.ROOF_METAL },
  cabin_house: { wall: TEX.STUCCO, roof: TEX.ROOF_SHINGLE },
  mountain_lodge: { wall: TEX.STUCCO, roof: TEX.ROOF_SHINGLE },
  marina_docks_small: { wall: TEX.STUCCO, roof: TEX.ROOF_METAL },
  pier_large: { wall: TEX.STUCCO, roof: TEX.ROOF_METAL },
};

export function getBuildingTextures(type: BuildingType): BuildingTextures {
  const base = STYLE_TEXTURES[getBuilding3DSpec(type).style];
  const override = TEXTURE_OVERRIDES[type];
  return override ? { ...base, ...override } : base;
}

/** Types that are terrain / infrastructure rather than a placed volume. */
export const NON_VOLUME_TYPES = new Set<BuildingType>(['empty', 'grass', 'water', 'road', 'bridge', 'rail', 'tree']);

/** Convert '#rrggbb' to linear-ish 0..1 rgb triples. */
export function hexToRgb(hex: string): [number, number, number] {
  const value = hex.startsWith('#') ? hex.slice(1) : hex;
  const num = parseInt(value, 16);
  return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
}

/** Deterministic hash in [0,1) so a tile always looks the same across rebuilds. */
export function tileHash(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2246822519) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
