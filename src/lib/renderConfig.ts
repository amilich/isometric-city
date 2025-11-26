// Rendering configuration
// Set to true to use a single sprite sheet instead of individual PNG files
export const USE_TILE_RENDERER = true;

// Sprite sheet configuration
export const SPRITE_SHEET = {
  // Path to the sprite sheet
  src: '/assets/sprites3.png',
  // Number of columns in the sprite sheet (5 columns confirmed)
  cols: 5,
  // Number of rows - using 6 because: 5 main rows + partial 6th row means
  // the 5 content rows don't fill full 2048px. 6 rows = 341px per row
  rows: 6,
  // Layout order: 'row' = left-to-right then top-to-bottom, 'column' = top-to-bottom then left-to-right
  layout: 'row' as 'row' | 'column',
};

// ============================================================================
// SPRITE ORDER CONFIGURATION
// ============================================================================
// This defines the order of sprites in your sprite sheet.
// Arranged as a 5x5 grid, reading left-to-right, top-to-bottom (if layout='row')
//
// Your sprite sheet should be arranged like this:
//   Col 0       Col 1       Col 2       Col 3       Col 4
// +----------+----------+----------+----------+----------+
// | Index 0  | Index 1  | Index 2  | Index 3  | Index 4  |  Row 0
// +----------+----------+----------+----------+----------+
// | Index 5  | Index 6  | Index 7  | Index 8  | Index 9  |  Row 1
// +----------+----------+----------+----------+----------+
// | Index 10 | Index 11 | Index 12 | Index 13 | Index 14 |  Row 2
// +----------+----------+----------+----------+----------+
// | Index 15 | Index 16 | Index 17 | Index 18 | Index 19 |  Row 3
// +----------+----------+----------+----------+----------+
// | Index 20 | Index 21 | Index 22 | Index 23 | Index 24 |  Row 4
// +----------+----------+----------+----------+----------+
//
// MODIFY THIS ARRAY to match how YOUR sprite sheet is arranged!
// ============================================================================
export const SPRITE_ORDER = [
  // Row 0 (indices 0-4)
  'residential',
  'commercial',
  'industrial',
  'fire_station',
  'hospital',
  // Row 1 (indices 5-9)
  'park',
  'park_large',
  'tennis',
  'police_station',
  'school',
  // Row 2 (indices 10-14)
  'university',
  'water_tower',
  'power_plant',
  'stadium',
  'space_program',
  // Row 3 (indices 15-19)
  'tree',
  'house_medium',
  'mansion',
  'house_small',
  'shop_medium',
  // Row 4 (indices 20-24)
  'shop_small',
  'warehouse',
  'factory_small',
  'factory_medium',
  'museum',
] as const;

// ============================================================================
// SPRITE VERTICAL OFFSET ADJUSTMENTS
// ============================================================================
// Fine-tune vertical positioning for individual sprites.
// Positive values push the sprite DOWN, negative values push it UP.
// Values are multiplied by tile height (TILE_HEIGHT) for consistent scaling.
// ============================================================================
export const SPRITE_VERTICAL_OFFSETS: Record<string, number> = {
  // Single-tile buildings that need adjustment
  park: 0.20,           // Small park - push down ~20%
  park_large: 0.20,     // Large park - push down ~20%
  police_station: 0.25, // Police station - push down more
  school: 0.20,         // School - push down ~20%
  tennis: 0.10,         // Tennis court - push down ~10%
  water_tower: -0.30,   // Water tower - push up ~12px
  // Add more as needed
};

// ============================================================================
// BUILDING TYPE TO SPRITE KEY MAPPING
// ============================================================================
// Maps game building types to sprite keys in SPRITE_ORDER
// Some building types share the same sprite (e.g., apartment_low uses 'residential')
// ============================================================================
export const BUILDING_TO_SPRITE: Record<string, string> = {
  // Residential buildings
  house_small: 'house_small',
  house_medium: 'house_medium',
  mansion: 'mansion',
  apartment_low: 'residential',
  apartment_high: 'residential',
  // Commercial buildings
  shop_small: 'shop_small',
  shop_medium: 'shop_medium',
  office_low: 'commercial',
  office_high: 'commercial',
  mall: 'commercial',
  // Industrial buildings
  factory_small: 'industrial',
  factory_medium: 'industrial',
  factory_large: 'industrial',
  warehouse: 'warehouse',
  // Service buildings
  police_station: 'police_station',
  fire_station: 'fire_station',
  hospital: 'hospital',
  school: 'school',
  university: 'university',
  park: 'park',
  park_large: 'park_large',
  tennis: 'tennis',
  // Utilities
  power_plant: 'power_plant',
  water_tower: 'water_tower',
  // Special buildings
  stadium: 'stadium',
  museum: 'museum',
  space_program: 'space_program',
  // Nature
  tree: 'tree',
};

// Get the sprite sheet coordinates for a building type
export function getSpriteCoords(
  buildingType: string,
  spriteSheetWidth: number,
  spriteSheetHeight: number
): { sx: number; sy: number; sw: number; sh: number } | null {
  // First, map building type to sprite key
  const spriteKey = BUILDING_TO_SPRITE[buildingType];
  if (!spriteKey) return null;
  
  // Find index in sprite order
  const index = SPRITE_ORDER.indexOf(spriteKey as typeof SPRITE_ORDER[number]);
  if (index === -1) return null;
  
  // Calculate tile dimensions - the sprite sheet has different column/row counts
  // so we need separate width and height calculations
  const tileWidth = Math.floor(spriteSheetWidth / SPRITE_SHEET.cols);
  const tileHeight = Math.floor(spriteSheetHeight / SPRITE_SHEET.rows);
  
  let col: number;
  let row: number;
  
  if (SPRITE_SHEET.layout === 'column') {
    col = Math.floor(index / SPRITE_SHEET.rows);
    row = index % SPRITE_SHEET.rows;
  } else {
    col = index % SPRITE_SHEET.cols;
    row = Math.floor(index / SPRITE_SHEET.cols);
  }
  
  // Use exact integer positions based on tile dimensions
  return {
    sx: col * tileWidth,
    sy: row * tileHeight,
    sw: tileWidth,
    sh: tileHeight,
  };
}
