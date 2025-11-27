// Rendering configuration
// ============================================================================
// SPRITE PACK TYPE DEFINITION
// ============================================================================
// Each sprite pack contains all the configuration needed for a specific
// sprite sheet image, including layout, offsets, and building mappings.
// ============================================================================
export interface SpritePack {
  // Unique identifier for this sprite pack
  id: string;
  // Display name for the UI
  name: string;
  // Path to the sprite sheet image
  src: string;
  // Path to the construction sprite sheet (same layout, but buildings under construction)
  constructionSrc?: string;
  // Path to the abandoned sprite sheet (same layout, but buildings shown as abandoned/derelict)
  abandonedSrc?: string;
  // Path to the dense variants sprite sheet (alternative sprites for high-density buildings)
  denseSrc?: string;
  // Dense variant definitions: maps building type to available variants in the dense sheet
  // Each variant specifies row and column (0-indexed) in the dense sprite sheet
  denseVariants?: Record<string, { row: number; col: number }[]>;
  // Path to the parks sprite sheet (separate sheet for park/recreation buildings)
  parksSrc?: string;
  // Path to the parks construction sprite sheet (same layout as parks, but under construction)
  parksConstructionSrc?: string;
  // Parks layout configuration (columns and rows for the parks sheet)
  parksCols?: number;
  parksRows?: number;
  // Parks buildings: maps building type to position in parks sprite sheet
  // Each entry specifies the row and column (0-indexed) in the parks sprite sheet
  parksBuildings?: Record<string, { row: number; col: number }>;
  // Number of columns in the sprite sheet
  cols: number;
  // Number of rows in the sprite sheet
  rows: number;
  // Layout order: 'row' = left-to-right then top-to-bottom
  layout: 'row' | 'column';
  // The order of sprites in the sprite sheet (maps to grid positions)
  spriteOrder: readonly string[];
  // Per-sprite vertical offset adjustments (positive = down, negative = up)
  // Values are multiplied by tile height for consistent scaling
  verticalOffsets: Record<string, number>;
  // Per-sprite horizontal offset adjustments (positive = right, negative = left)
  // Values are multiplied by tile width for consistent scaling
  horizontalOffsets: Record<string, number>;
  // Per-building-type vertical offset overrides (takes precedence over sprite-key offsets)
  // Use this when multiple building types share a sprite but need different positioning
  buildingVerticalOffsets?: Record<string, number>;
  // Per-sprite vertical offset adjustments for CONSTRUCTION sprites only
  // These override verticalOffsets when rendering buildings under construction
  constructionVerticalOffsets?: Record<string, number>;
  // Per-building-type scale adjustments for CONSTRUCTION sprites only
  // Values are multiplied with the normal scale (e.g., 0.95 = 95% of normal size)
  constructionScales?: Record<string, number>;
  // Per-sprite vertical offset adjustments for ABANDONED sprites only
  // These override verticalOffsets when rendering abandoned buildings
  abandonedVerticalOffsets?: Record<string, number>;
  // Per-building-type scale adjustments for ABANDONED sprites only
  // Values are multiplied with the normal scale (e.g., 0.7 = 70% of normal size)
  abandonedScales?: Record<string, number>;
  // Per-building-type vertical offset adjustments for DENSE variant sprites only
  // These override verticalOffsets when rendering dense variants
  denseVerticalOffsets?: Record<string, number>;
  // Per-building-type scale adjustments for DENSE variant sprites only
  // Values are multiplied with the normal scale (e.g., 0.95 = 95% of normal size)
  denseScales?: Record<string, number>;
  // Per-building-type vertical offset adjustments for PARKS sprite sheet buildings
  // These are used when rendering parks buildings from the parks sprite sheet
  parksVerticalOffsets?: Record<string, number>;
  // Per-building-type horizontal offset adjustments for PARKS sprite sheet buildings
  parksHorizontalOffsets?: Record<string, number>;
  // Per-building-type scale adjustments for PARKS sprite sheet buildings
  // Values are multiplied with the normal scale (e.g., 0.95 = 95% of normal size)
  parksScales?: Record<string, number>;
  // Maps building types to sprite keys in spriteOrder
  buildingToSprite: Record<string, string>;
  // Optional global scale multiplier for all sprites in this pack
  globalScale?: number;
}

// ============================================================================
// SPRITE PACK: SPRITES4 (Default)
// ============================================================================
const SPRITE_PACK_SPRITES4: SpritePack = {
  id: 'sprites4',
  name: 'Sprites 4',
  src: '/assets/sprites_red_water_new.png',
  constructionSrc: '/assets/sprites_red_water_new_construction.png',
  abandonedSrc: '/assets/sprites_red_water_new_abandoned.png',
  denseSrc: '/assets/sprites_red_water_new_dense.png',
  denseVariants: {
    // Residential high density (apartment_high) - Row 1, columns 2, 3, 4 (0-indexed: 1, 2, 3)
    apartment_high: [
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 0, col: 3 },
    ],
    // Commercial high density (mall) - Rows 3 and 4, all columns (0-indexed: rows 2, 3)
    mall: [
      { row: 2, col: 0 },
      { row: 2, col: 1 },
      { row: 2, col: 2 },
      { row: 2, col: 3 },
      { row: 2, col: 4 },
      { row: 3, col: 0 },
      { row: 3, col: 1 },
      { row: 3, col: 2 },
      { row: 3, col: 3 },
      { row: 3, col: 4 },
    ],
    // Industrial high density (factory_large) - Row 5, columns 1, 3, 5 (0-indexed: row 4, cols 0, 2, 4)
    factory_large: [
      { row: 4, col: 0 },
      { row: 4, col: 2 },
      { row: 4, col: 4 },
    ],
  },
  cols: 5,
  rows: 6,
  layout: 'row',
  globalScale: 0.8, // Scale down all buildings by 20%
  spriteOrder: [
    // Row 0 (indices 0-4, 5 columns)
    'residential',
    'commercial',
    'industrial',
    'fire_station',
    'hospital',
    // Row 1 (indices 5-9, 5 columns)
    'park',
    'park_large',
    'tennis',
    'police_station',
    'school',
    // Row 2 (indices 10-14, 5 columns)
    'university',
    'water_tower',
    'power_plant',
    'stadium',
    'space_program',
    // Row 3 (indices 15-19, 5 columns)
    'tree',
    'house_medium',
    'mansion',
    'house_small',
    'shop_medium',
    // Row 4 (indices 20-24, 5 columns)
    'shop_small',
    'warehouse',
    'factory_small',
    'factory_medium',
    'factory_large',
    // Row 5 (indices 25-29, 5 columns)
    'airport',
    'subway_station',
    'city_hall',
    'museum',
    'amusement_park',
  ] as const,
  verticalOffsets: {
    // Move sprites up (negative values) or down (positive values)
    // Values are multiplied by tile height
    residential: -0.4,
    commercial: -0.4,
    industrial: -0.5, // Shift factories down about half a tile from previous
    factory_small: -0.25, // Shift factory_small down 1/4 tile (relative to others)
    factory_medium: -0.5, // Same as industrial
    factory_large: -0.75, // Shift factory_large up slightly
    water_tower: -0.5,
    house_medium: -0.3,
    mansion: -0.35,
    house_small: -0.3,
    shop_medium: -0.15, // Shift down a tiny bit (less up than before)
    shop_small: -0.3,
    warehouse: -0.4,
    airport: -1.5, // Shift up a tiny bit more
    water: -0.2,
    subway_station: -0.2,
    fire_station: -0.2, // Shifted up to match police station
    police_station: -0.1, // Shifted down from previous position
    hospital: -0.5, // Shift up (reduced from previous)
    school: -0.4, // Shift down a tiny bit
    power_plant: -0.3, // Shift up
    park: -0.15, // Perfect position
    park_large: -0.85, // Shift up significantly (almost an entire tile)
    tennis: -0.2, // Shift up a bit
    city_hall: -0.6, // Shift up about 0.2 tiles
    amusement_park: -1.5, // Shift up about 1 tile
    space_program: -0.6, // Shift down a bit
    university: -0.55, // Shift up a tiny bit
    stadium: -1.2, // Shift up a ton
  },
  horizontalOffsets: {
    university: 0.0, // Shift right a tiny tiny bit more
    city_hall: 0.1, // Shift right about 0.2 tiles
  },
  buildingVerticalOffsets: {
    // Small houses
    house_small: -0.2, // Shifted up a bit
    house_medium: -0.05, // Was -0.3 from verticalOffsets, shifted down 0.25
    // 2x2 commercial buildings
    office_low: -0.5, // Shifted down 0.5 tiles from -1.0
    office_high: -0.7, // Shifted down 0.3 tiles from -1.0
    // 3x3 mall needs to shift up ~1 tile
    mall: -1.0,
    // 2x2 residential apartments need shifting up
    apartment_low: -1.0,
    apartment_high: -0.60, // Shifted down ~0.4 tiles from -1.0
  },
  constructionVerticalOffsets: {
    water_tower: 0.0, // Construction water tower shifted down 0.5 tiles from normal (-0.5 + 0.5 = 0.0)
    apartment_high: 2.6, // Construction apartment_high shifted down 3.2 tiles from normal (-0.60 + 3.2 = 2.6)
    apartment_low: 0.3, // Construction apartment_low shifted down 1.3 tiles from normal (-1.0 + 1.3 = 0.3)
    mall: -0.2, // Construction mall shifted down 0.8 tiles from normal (-1.0 + 0.8 = -0.2)
    office_high: 0.3, // Construction office_high shifted down 1.0 tiles from normal (-0.7 + 1.0 = 0.3)
  },
  constructionScales: {
    mall: 0.92, // Construction mall scaled down 8%
    office_high: 0.90, // Construction office_high scaled down 10%
    apartment_high: 0.65, // Construction apartment_high scaled down 35%
    apartment_low: 0.95, // Construction apartment_low scaled down 5%
  },
  abandonedVerticalOffsets: {
    // Abandoned apartments need different positioning than normal
    apartment_low: -0.25, // Normal is -1.0, abandoned shifts down 0.75: -1.0 + 0.75 = -0.25
    apartment_high: -0.15, // Shifted up 0.3 from previous 0.15
    house_medium: -0.05, // Normal is -0.05, abandoned matches normal position (moved up 0.5 tiles from 0.35, then down 0.1 tiles)
    house_small: -0.05, // Normal is -0.2, abandoned shifted up 0.15 tiles to match house_medium adjustment
  },
  abandonedScales: {
    // Abandoned factory_large needs to be scaled down 30%
    factory_large: 0.7,
  },
  denseVerticalOffsets: {
    // Dense apartment_high shifted down 0.2 tiles from -0.80
    apartment_high: -0.60, // Moved down 0.2 tiles from -0.80
  },
  denseScales: {
    // Dense apartment_high scaled down 10% total (5% more from 0.95)
    apartment_high: 0.90,
  },
  // Parks sprite sheet configuration (same offsets/scaling approach as dense)
  parksSrc: '/assets/sprites_red_water_new_parks.png',
  parksConstructionSrc: '/assets/sprites_red_water_new_parks_construction.png',
  parksCols: 5,
  parksRows: 6,
  parksBuildings: {
    // Row 0: tennis_court(skip), basketball_courts, playground_small, playground_large, baseball_field_small
    basketball_courts: { row: 0, col: 1 },
    playground_small: { row: 0, col: 2 },
    playground_large: { row: 0, col: 3 },
    baseball_field_small: { row: 0, col: 4 },
    // Row 1: soccer_field_small, football_field, baseball_stadium, community_center, office_building_small
    soccer_field_small: { row: 1, col: 0 },
    football_field: { row: 1, col: 1 },
    baseball_stadium: { row: 1, col: 2 },
    community_center: { row: 1, col: 3 },
    office_building_small: { row: 1, col: 4 },
    // Row 2: swimming_pool, skate_park, mini_golf_course, bleachers_field, go_kart_track
    swimming_pool: { row: 2, col: 0 },
    skate_park: { row: 2, col: 1 },
    mini_golf_course: { row: 2, col: 2 },
    bleachers_field: { row: 2, col: 3 },
    go_kart_track: { row: 2, col: 4 },
    // Row 3: amphitheater, greenhouse_garden, animal_pens_farm, cabin_house, campground
    amphitheater: { row: 3, col: 0 },
    greenhouse_garden: { row: 3, col: 1 },
    animal_pens_farm: { row: 3, col: 2 },
    cabin_house: { row: 3, col: 3 },
    campground: { row: 3, col: 4 },
    // Row 4: marina_docks_small, pier_large, beach_tile(skip), pier_broken(skip), roller_coaster_small
    marina_docks_small: { row: 4, col: 0 },
    pier_large: { row: 4, col: 1 },
    roller_coaster_small: { row: 4, col: 4 },
    // Row 5: community_garden, pond_park, park_gate, mountain_lodge, mountain_trailhead
    community_garden: { row: 5, col: 0 },
    pond_park: { row: 5, col: 1 },
    park_gate: { row: 5, col: 2 },
    mountain_lodge: { row: 5, col: 3 },
    mountain_trailhead: { row: 5, col: 4 },
  },
  parksVerticalOffsets: {
    // Same approach as denseVerticalOffsets - adjust as needed for proper positioning
    basketball_courts: -0.15,
    playground_small: -0.25,  // shifted up 0.1
    playground_large: -0.45,  // shifted down 0.6 tiles from -1.05
    baseball_field_small: -0.85,
    soccer_field_small: -0.20,  // shifted up slightly
    football_field: -0.85,
    baseball_stadium: -1.5,  // adjusted for scale, moved up 0.5 tiles
    community_center: -0.2,
    office_building_small: -0.3,
    swimming_pool: -0.20,  // shifted up slightly
    skate_park: -0.15,
    mini_golf_course: -0.85,
    bleachers_field: -0.2,
    go_kart_track: -0.35,  // shifted down 0.5
    amphitheater: -0.85,
    greenhouse_garden: -0.55,  // shifted down 0.3
    animal_pens_farm: -0.25,  // shifted up 0.1 tiles
    cabin_house: -0.2,
    campground: -0.15,
    marina_docks_small: 0.05,  // 2x2 building, shifted down 0.6 tiles
    pier_large: -0.15,  // 1x1 building now
    roller_coaster_small: -0.35,  // shifted down 0.5
    community_garden: -0.15,
    pond_park: -0.15,
    park_gate: -0.15,
    mountain_lodge: -0.85,
    mountain_trailhead: -1.5,  // now 3x3
  },
  parksHorizontalOffsets: {
    // swimming_pool: centered (no offset)
  },
  parksScales: {
    baseball_stadium: 0.81,  // 10% smaller than 0.90
    swimming_pool: 0.90,  // scaled down 10% total (5% more from 0.95)
    soccer_field_small: 0.95,  // scaled down 5%
  },
  buildingToSprite: {
    house_small: 'house_small',
    house_medium: 'house_medium',
    mansion: 'mansion',
    apartment_low: 'residential',
    apartment_high: 'residential',
    shop_small: 'shop_small',
    shop_medium: 'shop_medium',
    office_low: 'commercial',
    office_high: 'commercial',
    mall: 'commercial',
    factory_small: 'factory_small',
    factory_medium: 'factory_medium',
    factory_large: 'factory_large',
    warehouse: 'warehouse',
    police_station: 'police_station',
    fire_station: 'fire_station',
    hospital: 'hospital',
    school: 'school',
    university: 'university',
    park: 'park',
    park_large: 'park_large',
    tennis: 'tennis',
    power_plant: 'power_plant',
    water_tower: 'water_tower',
    stadium: 'stadium',
    museum: 'museum',
    airport: 'airport',
    space_program: 'space_program',
    tree: 'tree',
    water: 'water',
    subway_station: 'subway_station',
    city_hall: 'city_hall',
    amusement_park: 'amusement_park',
  },
};

// ============================================================================
// SPRITE PACKS REGISTRY
// ============================================================================
// Add new sprite packs here. Each pack can have completely different
// sprite arrangements, offsets, and scaling.
// ============================================================================
export const SPRITE_PACKS: SpritePack[] = [
  SPRITE_PACK_SPRITES4,
];

// Default sprite pack ID
export const DEFAULT_SPRITE_PACK_ID = 'sprites4';

// Get a sprite pack by ID
export function getSpritePack(id: string): SpritePack {
  return SPRITE_PACKS.find(pack => pack.id === id) || SPRITE_PACKS[0];
}

// ============================================================================
// BACKWARDS COMPATIBILITY EXPORTS
// ============================================================================
// These exports maintain compatibility with existing code that uses the old API.
// They default to the first sprite pack (RED).
// ============================================================================

// Get active sprite pack (this will be overridden by the selected pack in context)
let _activeSpritePack: SpritePack = SPRITE_PACKS[0];

export function setActiveSpritePack(pack: SpritePack) {
  _activeSpritePack = pack;
}

export function getActiveSpritePack(): SpritePack {
  return _activeSpritePack;
}

// Legacy exports that read from the active sprite pack
export const SPRITE_SHEET = {
  get src() { return _activeSpritePack.src; },
  get cols() { return _activeSpritePack.cols; },
  get rows() { return _activeSpritePack.rows; },
  get layout() { return _activeSpritePack.layout; },
};

export const SPRITE_ORDER = _activeSpritePack.spriteOrder;

export const SPRITE_VERTICAL_OFFSETS = new Proxy({} as Record<string, number>, {
  get(_, key: string) {
    return _activeSpritePack.verticalOffsets[key] ?? 0;
  },
  has(_, key: string) {
    return key in _activeSpritePack.verticalOffsets;
  },
});

export const SPRITE_HORIZONTAL_OFFSETS = new Proxy({} as Record<string, number>, {
  get(_, key: string) {
    return _activeSpritePack.horizontalOffsets[key] ?? 0;
  },
  has(_, key: string) {
    return key in _activeSpritePack.horizontalOffsets;
  },
});

export const BUILDING_TO_SPRITE = new Proxy({} as Record<string, string>, {
  get(_, key: string) {
    return _activeSpritePack.buildingToSprite[key];
  },
  has(_, key: string) {
    return key in _activeSpritePack.buildingToSprite;
  },
});

// Get the sprite sheet coordinates for a building type
export function getSpriteCoords(
  buildingType: string,
  spriteSheetWidth: number,
  spriteSheetHeight: number,
  pack?: SpritePack
): { sx: number; sy: number; sw: number; sh: number } | null {
  const activePack = pack || _activeSpritePack;
  
  // First, map building type to sprite key
  const spriteKey = activePack.buildingToSprite[buildingType];
  if (!spriteKey) return null;
  
  // Find index in sprite order
  const index = activePack.spriteOrder.indexOf(spriteKey);
  if (index === -1) return null;
  
  // Calculate tile dimensions
  const tileWidth = Math.floor(spriteSheetWidth / activePack.cols);
  const tileHeight = Math.floor(spriteSheetHeight / activePack.rows);
  
  let col: number;
  let row: number;
  
  if (activePack.layout === 'column') {
    col = Math.floor(index / activePack.rows);
    row = index % activePack.rows;
  } else {
    col = index % activePack.cols;
    row = Math.floor(index / activePack.cols);
  }
  
  // Special handling for sprites4 pack: rows 1-4 include content from rows above, shift source Y down
  let sy = row * tileHeight;
  if (activePack.id === 'sprites4' && row > 0 && row <= 4) {
    if (row <= 2) {
      // Rows 1-2: small cumulative shift
      const overlapAmount = tileHeight * 0.1;
      sy += overlapAmount * row;
    } else if (row === 3) {
      // Row 3: minimal shift to avoid picking up content from rows above
      sy += tileHeight * 0.1;
    } else if (row === 4) {
      // Row 4: small shift to avoid picking up house_medium from row 3
      sy += tileHeight * 0.05;
    }
  }
  // Row 5: no shift to avoid cross-contamination
  
  // Special handling for sprites4 pack: adjust source height for certain sprites
  let sh = tileHeight;
  if (activePack.id === 'sprites4') {
    if (spriteKey === 'residential' || spriteKey === 'commercial') {
      sh = tileHeight * 1.1; // Add 10% more height at bottom
    }
  }
  
  return {
    sx: col * tileWidth,
    sy: sy,
    sw: tileWidth,
    sh: sh,
  };
}

// Helper to get offsets for a specific pack
export function getSpriteOffsets(
  buildingType: string,
  pack?: SpritePack
): { vertical: number; horizontal: number } {
  const activePack = pack || _activeSpritePack;
  const spriteKey = activePack.buildingToSprite[buildingType];
  
  return {
    vertical: spriteKey ? (activePack.verticalOffsets[spriteKey] ?? 0) : 0,
    horizontal: spriteKey ? (activePack.horizontalOffsets[spriteKey] ?? 0) : 0,
  };
}
