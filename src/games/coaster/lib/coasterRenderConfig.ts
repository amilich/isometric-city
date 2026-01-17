/**
 * Coaster Tycoon Sprite Render Configuration
 * Maps building types to sprite sheet locations with offsets and scales
 */

// =============================================================================
// SPRITE PACK INTERFACE
// =============================================================================

export interface CoasterSpritePack {
  id: string;
  name: string;
  sheets: SpriteSheet[];
}

export interface SpriteSheet {
  id: string;
  src: string;
  cols: number;
  rows: number;
  sprites: SpriteMapping[];
}

export interface SpriteMapping {
  name: string;
  row: number; // 0-indexed
  col: number; // 0-indexed
  offsetX?: number; // Pixel offset for alignment
  offsetY?: number;
  scale?: number; // Scale multiplier (default 1.0)
}

// =============================================================================
// SPRITE SHEETS CONFIGURATION
// =============================================================================

const STATIONS_SHEET: SpriteSheet = {
  id: 'stations',
  src: '/assets/coaster/stations.png',
  cols: 5,
  rows: 6,
  sprites: [
    // Row 0: Wooden Coaster Stations
    { name: 'station_wooden_1', row: 0, col: 0, offsetY: -20, scale: 1.2 },
    { name: 'station_wooden_2', row: 0, col: 1, offsetY: -20, scale: 1.2 },
    { name: 'station_wooden_3', row: 0, col: 2, offsetY: -20, scale: 1.2 },
    { name: 'station_wooden_4', row: 0, col: 3, offsetY: -20, scale: 1.2 },
    { name: 'station_wooden_5', row: 0, col: 4, offsetY: -20, scale: 1.2 },
    // Row 1: Steel Coaster Stations
    { name: 'station_steel_1', row: 1, col: 0, offsetY: -20, scale: 1.2 },
    { name: 'station_steel_2', row: 1, col: 1, offsetY: -20, scale: 1.2 },
    { name: 'station_steel_3', row: 1, col: 2, offsetY: -20, scale: 1.2 },
    { name: 'station_steel_4', row: 1, col: 3, offsetY: -20, scale: 1.2 },
    { name: 'station_steel_5', row: 1, col: 4, offsetY: -20, scale: 1.2 },
    // Row 2: Inverted Coaster Stations
    { name: 'station_inverted_1', row: 2, col: 0, offsetY: -20, scale: 1.2 },
    { name: 'station_inverted_2', row: 2, col: 1, offsetY: -20, scale: 1.2 },
    { name: 'station_inverted_3', row: 2, col: 2, offsetY: -20, scale: 1.2 },
    { name: 'station_inverted_4', row: 2, col: 3, offsetY: -20, scale: 1.2 },
    { name: 'station_inverted_5', row: 2, col: 4, offsetY: -20, scale: 1.2 },
    // Row 3: Water Coaster Stations
    { name: 'station_water_1', row: 3, col: 0, offsetY: -20, scale: 1.2 },
    { name: 'station_water_2', row: 3, col: 1, offsetY: -20, scale: 1.2 },
    { name: 'station_water_3', row: 3, col: 2, offsetY: -20, scale: 1.2 },
    { name: 'station_water_4', row: 3, col: 3, offsetY: -20, scale: 1.2 },
    { name: 'station_water_5', row: 3, col: 4, offsetY: -20, scale: 1.2 },
    // Row 4: Mine Train Stations
    { name: 'station_mine_1', row: 4, col: 0, offsetY: -20, scale: 1.2 },
    { name: 'station_mine_2', row: 4, col: 1, offsetY: -20, scale: 1.2 },
    { name: 'station_mine_3', row: 4, col: 2, offsetY: -20, scale: 1.2 },
    { name: 'station_mine_4', row: 4, col: 3, offsetY: -20, scale: 1.2 },
    { name: 'station_mine_5', row: 4, col: 4, offsetY: -20, scale: 1.2 },
    // Row 5: Futuristic Stations
    { name: 'station_futuristic_1', row: 5, col: 0, offsetY: -20, scale: 1.2 },
    { name: 'station_futuristic_2', row: 5, col: 1, offsetY: -20, scale: 1.2 },
    { name: 'station_futuristic_3', row: 5, col: 2, offsetY: -20, scale: 1.2 },
    { name: 'station_futuristic_4', row: 5, col: 3, offsetY: -20, scale: 1.2 },
    { name: 'station_futuristic_5', row: 5, col: 4, offsetY: -20, scale: 1.2 },
  ],
};

const TREES_SHEET: SpriteSheet = {
  id: 'trees',
  src: '/assets/coaster/trees.png',
  cols: 5,
  rows: 6,
  sprites: [
    // Row 0: Deciduous Trees
    { name: 'tree_oak', row: 0, col: 0, offsetY: -30, scale: 1.0 },
    { name: 'tree_maple', row: 0, col: 1, offsetY: -30, scale: 1.0 },
    { name: 'tree_birch', row: 0, col: 2, offsetY: -30, scale: 1.0 },
    { name: 'tree_elm', row: 0, col: 3, offsetY: -30, scale: 1.0 },
    { name: 'tree_willow', row: 0, col: 4, offsetY: -30, scale: 1.0 },
    // Row 1: Evergreen Trees
    { name: 'tree_pine', row: 1, col: 0, offsetY: -35, scale: 1.0 },
    { name: 'tree_spruce', row: 1, col: 1, offsetY: -35, scale: 1.0 },
    { name: 'tree_fir', row: 1, col: 2, offsetY: -35, scale: 1.0 },
    { name: 'tree_cedar', row: 1, col: 3, offsetY: -35, scale: 1.0 },
    { name: 'tree_redwood', row: 1, col: 4, offsetY: -40, scale: 1.1 },
    // Row 2: Tropical Trees
    { name: 'tree_palm', row: 2, col: 0, offsetY: -35, scale: 1.0 },
    { name: 'tree_banana', row: 2, col: 1, offsetY: -30, scale: 1.0 },
    { name: 'tree_bamboo', row: 2, col: 2, offsetY: -30, scale: 1.0 },
    { name: 'tree_coconut', row: 2, col: 3, offsetY: -35, scale: 1.0 },
    { name: 'tree_tropical', row: 2, col: 4, offsetY: -30, scale: 1.0 },
    // Row 3: Flowering Trees
    { name: 'tree_cherry', row: 3, col: 0, offsetY: -30, scale: 1.0 },
    { name: 'tree_magnolia', row: 3, col: 1, offsetY: -30, scale: 1.0 },
    { name: 'tree_dogwood', row: 3, col: 2, offsetY: -30, scale: 1.0 },
    { name: 'tree_jacaranda', row: 3, col: 3, offsetY: -30, scale: 1.0 },
    { name: 'tree_wisteria', row: 3, col: 4, offsetY: -30, scale: 1.0 },
    // Row 4: Bushes & Topiary
    { name: 'bush_hedge', row: 4, col: 0, offsetY: -10, scale: 0.9 },
    { name: 'bush_flowering', row: 4, col: 1, offsetY: -10, scale: 0.9 },
    { name: 'topiary_ball', row: 4, col: 2, offsetY: -10, scale: 0.9 },
    { name: 'topiary_spiral', row: 4, col: 3, offsetY: -15, scale: 0.9 },
    { name: 'topiary_animal', row: 4, col: 4, offsetY: -15, scale: 0.9 },
    // Row 5: Flowers & Ground Cover
    { name: 'flowers_bed', row: 5, col: 0, offsetY: -5, scale: 0.8 },
    { name: 'flowers_planter', row: 5, col: 1, offsetY: -10, scale: 0.8 },
    { name: 'flowers_hanging', row: 5, col: 2, offsetY: -15, scale: 0.8 },
    { name: 'flowers_wild', row: 5, col: 3, offsetY: -5, scale: 0.8 },
    { name: 'ground_cover', row: 5, col: 4, offsetY: -5, scale: 0.8 },
  ],
};

const FURNITURE_SHEET: SpriteSheet = {
  id: 'path_furniture',
  src: '/assets/coaster/path_furniture.png',
  cols: 5,
  rows: 6,
  sprites: [
    // Row 0: Benches
    { name: 'bench_wooden', row: 0, col: 0, offsetY: -5, scale: 0.7 },
    { name: 'bench_metal', row: 0, col: 1, offsetY: -5, scale: 0.7 },
    { name: 'bench_ornate', row: 0, col: 2, offsetY: -5, scale: 0.7 },
    { name: 'bench_modern', row: 0, col: 3, offsetY: -5, scale: 0.7 },
    { name: 'bench_rustic', row: 0, col: 4, offsetY: -5, scale: 0.7 },
    // Row 1: Lamps
    { name: 'lamp_victorian', row: 1, col: 0, offsetY: -25, scale: 0.8 },
    { name: 'lamp_modern', row: 1, col: 1, offsetY: -25, scale: 0.8 },
    { name: 'lamp_themed', row: 1, col: 2, offsetY: -25, scale: 0.8 },
    { name: 'lamp_double', row: 1, col: 3, offsetY: -25, scale: 0.8 },
    { name: 'lamp_pathway', row: 1, col: 4, offsetY: -15, scale: 0.7 },
    // Row 2: Trash Cans
    { name: 'trash_can_basic', row: 2, col: 0, offsetY: -10, scale: 0.7 },
    { name: 'trash_can_fancy', row: 2, col: 1, offsetY: -10, scale: 0.7 },
    { name: 'trash_can_themed', row: 2, col: 2, offsetY: -10, scale: 0.7 },
    { name: 'recycling_bin', row: 2, col: 3, offsetY: -10, scale: 0.7 },
    { name: 'trash_compactor', row: 2, col: 4, offsetY: -10, scale: 0.8 },
    // Row 3: Planters
    { name: 'planter_large', row: 3, col: 0, offsetY: -10, scale: 0.8 },
    { name: 'planter_small', row: 3, col: 1, offsetY: -10, scale: 0.7 },
    { name: 'planter_hanging', row: 3, col: 2, offsetY: -15, scale: 0.8 },
    { name: 'planter_themed', row: 3, col: 3, offsetY: -10, scale: 0.8 },
    { name: 'planter_tiered', row: 3, col: 4, offsetY: -15, scale: 0.8 },
    // Row 4: Signs
    { name: 'sign_directional', row: 4, col: 0, offsetY: -20, scale: 0.8 },
    { name: 'sign_ride', row: 4, col: 1, offsetY: -20, scale: 0.8 },
    { name: 'sign_info', row: 4, col: 2, offsetY: -15, scale: 0.8 },
    { name: 'sign_welcome', row: 4, col: 3, offsetY: -20, scale: 0.8 },
    { name: 'sign_sponsored', row: 4, col: 4, offsetY: -20, scale: 0.8 },
    // Row 5: Path Decorations
    { name: 'path_bollard', row: 5, col: 0, offsetY: -10, scale: 0.7 },
    { name: 'path_chain', row: 5, col: 1, offsetY: -10, scale: 0.8 },
    { name: 'path_railing', row: 5, col: 2, offsetY: -10, scale: 0.8 },
    { name: 'path_archway', row: 5, col: 3, offsetY: -25, scale: 0.9 },
    { name: 'path_gate', row: 5, col: 4, offsetY: -15, scale: 0.8 },
  ],
};

const FOOD_SHEET: SpriteSheet = {
  id: 'food',
  src: '/assets/coaster/food.png',
  cols: 5,
  rows: 6,
  sprites: [
    // Row 0: American Food
    { name: 'food_hotdog', row: 0, col: 0, offsetY: -15, scale: 0.9 },
    { name: 'food_burger', row: 0, col: 1, offsetY: -15, scale: 0.9 },
    { name: 'food_fries', row: 0, col: 2, offsetY: -15, scale: 0.9 },
    { name: 'food_corndog', row: 0, col: 3, offsetY: -15, scale: 0.9 },
    { name: 'food_pretzel', row: 0, col: 4, offsetY: -15, scale: 0.9 },
    // Row 1: Sweet Treats
    { name: 'food_icecream', row: 1, col: 0, offsetY: -15, scale: 0.9 },
    { name: 'food_cotton_candy', row: 1, col: 1, offsetY: -15, scale: 0.9 },
    { name: 'food_candy_apple', row: 1, col: 2, offsetY: -15, scale: 0.9 },
    { name: 'food_churros', row: 1, col: 3, offsetY: -15, scale: 0.9 },
    { name: 'food_funnel_cake', row: 1, col: 4, offsetY: -15, scale: 0.9 },
    // Row 2: Drinks
    { name: 'drink_soda', row: 2, col: 0, offsetY: -15, scale: 0.9 },
    { name: 'drink_lemonade', row: 2, col: 1, offsetY: -15, scale: 0.9 },
    { name: 'drink_smoothie', row: 2, col: 2, offsetY: -15, scale: 0.9 },
    { name: 'drink_coffee', row: 2, col: 3, offsetY: -15, scale: 0.9 },
    { name: 'drink_slushie', row: 2, col: 4, offsetY: -15, scale: 0.9 },
    // Row 3: Snacks
    { name: 'snack_popcorn', row: 3, col: 0, offsetY: -15, scale: 0.9 },
    { name: 'snack_nachos', row: 3, col: 1, offsetY: -15, scale: 0.9 },
    { name: 'snack_pizza', row: 3, col: 2, offsetY: -15, scale: 0.9 },
    { name: 'snack_cookies', row: 3, col: 3, offsetY: -15, scale: 0.9 },
    { name: 'snack_donuts', row: 3, col: 4, offsetY: -15, scale: 0.9 },
    // Row 4: International
    { name: 'food_tacos', row: 4, col: 0, offsetY: -15, scale: 0.9 },
    { name: 'food_noodles', row: 4, col: 1, offsetY: -15, scale: 0.9 },
    { name: 'food_kebab', row: 4, col: 2, offsetY: -15, scale: 0.9 },
    { name: 'food_crepes', row: 4, col: 3, offsetY: -15, scale: 0.9 },
    { name: 'food_waffles', row: 4, col: 4, offsetY: -15, scale: 0.9 },
    // Row 5: Themed Carts
    { name: 'cart_pirate', row: 5, col: 0, offsetY: -15, scale: 0.9 },
    { name: 'cart_space', row: 5, col: 1, offsetY: -15, scale: 0.9 },
    { name: 'cart_medieval', row: 5, col: 2, offsetY: -15, scale: 0.9 },
    { name: 'cart_western', row: 5, col: 3, offsetY: -15, scale: 0.9 },
    { name: 'cart_tropical', row: 5, col: 4, offsetY: -15, scale: 0.9 },
  ],
};

// =============================================================================
// DEFAULT COASTER SPRITE PACK
// =============================================================================

export const COASTER_SPRITE_PACK: CoasterSpritePack = {
  id: 'default',
  name: 'Coaster Tycoon Default',
  sheets: [
    STATIONS_SHEET,
    TREES_SHEET,
    FURNITURE_SHEET,
    FOOD_SHEET,
    // Additional sheets configured similarly...
  ],
};

// =============================================================================
// SPRITE LOOKUP HELPER
// =============================================================================

export function getSpriteInfo(
  buildingType: string,
  pack: CoasterSpritePack = COASTER_SPRITE_PACK
): { sheet: SpriteSheet; sprite: SpriteMapping } | null {
  for (const sheet of pack.sheets) {
    const sprite = sheet.sprites.find(s => s.name === buildingType);
    if (sprite) {
      return { sheet, sprite };
    }
  }
  return null;
}

/**
 * Get the source rectangle for a sprite in its sheet
 */
export function getSpriteRect(
  sheet: SpriteSheet,
  sprite: SpriteMapping,
  sheetWidth: number,
  sheetHeight: number
): { sx: number; sy: number; sw: number; sh: number } {
  const cellWidth = sheetWidth / sheet.cols;
  const cellHeight = sheetHeight / sheet.rows;
  
  return {
    sx: sprite.col * cellWidth,
    sy: sprite.row * cellHeight,
    sw: cellWidth,
    sh: cellHeight,
  };
}

/**
 * Get all sprite sheets that need to be loaded
 */
export function getAllSpritePaths(pack: CoasterSpritePack = COASTER_SPRITE_PACK): string[] {
  return pack.sheets.map(sheet => sheet.src);
}
