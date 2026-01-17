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
    { name: 'station_inverted_5', row: 2, col: 4, offsetY: -14, scale: 1.15 },
    // Row 3: Water Coaster Stations
    { name: 'station_water_1', row: 3, col: 0, offsetY: -20, scale: 1.2 },
    { name: 'station_water_2', row: 3, col: 1, offsetY: -20, scale: 1.2 },
    { name: 'station_water_3', row: 3, col: 2, offsetY: -20, scale: 1.2 },
    { name: 'station_water_4', row: 3, col: 3, offsetY: -20, scale: 1.2 },
    { name: 'station_water_5', row: 3, col: 4, offsetX: -6, offsetY: -20, scale: 1.15 },
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
  cols: 6,
  rows: 6,
  sprites: [
    // Row 0: Deciduous Trees
    { name: 'tree_oak', row: 0, col: 0, offsetY: -30, scale: 1.0 },
    { name: 'tree_maple', row: 0, col: 1, offsetY: -30, scale: 1.0 },
    { name: 'tree_birch', row: 0, col: 2, offsetY: -30, scale: 1.0 },
    { name: 'tree_elm', row: 0, col: 3, offsetY: -30, scale: 1.0 },
    { name: 'tree_willow', row: 0, col: 4, offsetY: -30, scale: 1.0 },
    { name: 'tree_deciduous_extra', row: 0, col: 5, offsetY: -30, scale: 1.0 },
    // Row 1: Evergreen Trees
    { name: 'tree_pine', row: 1, col: 0, offsetY: -35, scale: 1.0 },
    { name: 'tree_spruce', row: 1, col: 1, offsetY: -35, scale: 1.0 },
    { name: 'tree_fir', row: 1, col: 2, offsetY: -35, scale: 1.0 },
    { name: 'tree_cedar', row: 1, col: 3, offsetY: -35, scale: 1.0 },
    { name: 'tree_redwood', row: 1, col: 4, offsetY: -40, scale: 1.1 },
    { name: 'tree_evergreen_extra', row: 1, col: 5, offsetY: -35, scale: 1.0 },
    // Row 2: Tropical Trees
    { name: 'tree_palm', row: 2, col: 0, offsetY: -35, scale: 1.0 },
    { name: 'tree_banana', row: 2, col: 1, offsetY: -30, scale: 1.0 },
    { name: 'tree_bamboo', row: 2, col: 2, offsetY: -30, scale: 1.0 },
    { name: 'tree_coconut', row: 2, col: 3, offsetY: -35, scale: 1.0 },
    { name: 'tree_tropical', row: 2, col: 4, offsetY: -30, scale: 1.0 },
    { name: 'tree_tropical_extra', row: 2, col: 5, offsetY: -30, scale: 1.0 },
    // Row 3: Flowering Trees
    { name: 'tree_cherry', row: 3, col: 0, offsetY: -30, scale: 1.0 },
    { name: 'tree_magnolia', row: 3, col: 1, offsetY: -30, scale: 1.0 },
    { name: 'tree_dogwood', row: 3, col: 2, offsetY: -30, scale: 1.0 },
    { name: 'tree_jacaranda', row: 3, col: 3, offsetY: -30, scale: 1.0 },
    { name: 'tree_wisteria', row: 3, col: 4, offsetY: -30, scale: 1.0 },
    { name: 'tree_flowering_extra', row: 3, col: 5, offsetY: -30, scale: 1.0 },
    // Row 4: Bushes & Topiary
    { name: 'bush_hedge', row: 4, col: 0, offsetY: -10, scale: 0.9 },
    { name: 'bush_flowering', row: 4, col: 1, offsetY: -10, scale: 0.9 },
    { name: 'topiary_ball', row: 4, col: 2, offsetY: -10, scale: 0.9 },
    { name: 'topiary_spiral', row: 4, col: 3, offsetY: -15, scale: 0.9 },
    { name: 'topiary_animal', row: 4, col: 4, offsetY: -15, scale: 0.9 },
    { name: 'flowers_square_bed', row: 4, col: 5, offsetY: -5, scale: 0.8 },
    // Row 5: Flowers & Ground Cover
    { name: 'flowers_bed', row: 5, col: 0, offsetY: -5, scale: 0.8 },
    { name: 'flowers_planter', row: 5, col: 1, offsetY: -10, scale: 0.8 },
    { name: 'flowers_hanging', row: 5, col: 2, offsetY: -15, scale: 0.8 },
    { name: 'flowers_wild', row: 5, col: 3, offsetY: -5, scale: 0.8 },
    { name: 'ground_cover', row: 5, col: 4, offsetY: -5, scale: 0.8 },
    { name: 'ground_stones', row: 5, col: 5, offsetY: -5, scale: 0.8 },
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
    { name: 'sign_welcome', row: 4, col: 3, offsetX: -10, offsetY: -20, scale: 0.8 },
    { name: 'sign_sponsored', row: 4, col: 4, offsetY: -20, scale: 0.8 },
    // Row 5: Path Decorations
    { name: 'path_bollard', row: 5, col: 0, offsetY: -10, scale: 0.7 },
    { name: 'path_chain', row: 5, col: 1, offsetY: -10, scale: 0.8 },
    { name: 'path_railing', row: 5, col: 2, offsetY: -10, scale: 0.8 },
    { name: 'path_archway', row: 5, col: 3, offsetX: -8, offsetY: -25, scale: 0.9 },
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

const FOUNTAINS_SHEET: SpriteSheet = {
  id: 'fountains',
  src: '/assets/coaster/fountains.png',
  cols: 5,
  rows: 6,
  sprites: [
    // Row 0: Small fountains
    { name: 'fountain_small_1', row: 0, col: 0, offsetY: -10, scale: 0.9 },
    { name: 'fountain_small_2', row: 0, col: 1, offsetY: -10, scale: 0.9 },
    { name: 'fountain_small_3', row: 0, col: 2, offsetY: -10, scale: 0.9 },
    { name: 'fountain_small_4', row: 0, col: 3, offsetY: -10, scale: 0.9 },
    { name: 'fountain_small_5', row: 0, col: 4, offsetY: -10, scale: 0.9 },
    // Row 1: Medium fountains
    { name: 'fountain_medium_1', row: 1, col: 0, offsetY: -20, scale: 1.0 },
    { name: 'fountain_medium_2', row: 1, col: 1, offsetY: -20, scale: 1.0 },
    { name: 'fountain_medium_3', row: 1, col: 2, offsetY: -20, scale: 1.0 },
    { name: 'fountain_medium_4', row: 1, col: 3, offsetY: -20, scale: 1.0 },
    { name: 'fountain_medium_5', row: 1, col: 4, offsetY: -20, scale: 1.0 },
    // Row 2: Large fountains
    { name: 'fountain_large_1', row: 2, col: 0, offsetY: -30, scale: 1.1 },
    { name: 'fountain_large_2', row: 2, col: 1, offsetY: -30, scale: 1.1 },
    { name: 'fountain_large_3', row: 2, col: 2, offsetY: -30, scale: 1.1 },
    { name: 'fountain_large_4', row: 2, col: 3, offsetX: -5, offsetY: -30, scale: 1.05 },
    { name: 'fountain_large_5', row: 2, col: 4, offsetY: -30, scale: 1.1 },
    // Row 3: Ponds
    { name: 'pond_small', row: 3, col: 0, offsetY: -5, scale: 0.9 },
    { name: 'pond_medium', row: 3, col: 1, offsetY: -5, scale: 0.9 },
    { name: 'pond_large', row: 3, col: 2, offsetY: -5, scale: 0.9 },
    { name: 'pond_koi', row: 3, col: 3, offsetY: -5, scale: 0.9 },
    { name: 'pond_lily', row: 3, col: 4, offsetY: -5, scale: 0.85 },
    // Row 4: Waterfalls & streams
    { name: 'waterfall_small', row: 4, col: 0, offsetY: -10, scale: 0.9 },
    { name: 'waterfall_medium', row: 4, col: 1, offsetY: -10, scale: 0.9 },
    { name: 'waterfall_large', row: 4, col: 2, offsetY: -15, scale: 1.0 },
    { name: 'stream_section', row: 4, col: 3, offsetY: -5, scale: 0.9 },
    { name: 'rapids_section', row: 4, col: 4, offsetY: -5, scale: 0.9 },
    // Row 5: Interactive water
    { name: 'splash_pad', row: 5, col: 0, offsetY: -5, scale: 0.9 },
    { name: 'water_jets', row: 5, col: 1, offsetY: -5, scale: 0.9 },
    { name: 'mist_fountain', row: 5, col: 2, offsetY: -5, scale: 0.9 },
    { name: 'interactive_fountain', row: 5, col: 3, offsetY: -5, scale: 0.9 },
    { name: 'dancing_fountain', row: 5, col: 4, offsetY: -5, scale: 0.9 },
  ],
};

const SHOPS_SHEET: SpriteSheet = {
  id: 'shops',
  src: '/assets/coaster/shops.png',
  cols: 5,
  rows: 6,
  sprites: [
    // Row 0: Gift shops
    { name: 'shop_souvenir_1', row: 0, col: 0, offsetY: -15, scale: 0.95 },
    { name: 'shop_souvenir_2', row: 0, col: 1, offsetY: -15, scale: 0.95 },
    { name: 'shop_photo', row: 0, col: 2, offsetY: -15, scale: 0.95 },
    { name: 'shop_ticket', row: 0, col: 3, offsetY: -15, scale: 0.95 },
    { name: 'shop_collectibles', row: 0, col: 4, offsetY: -15, scale: 0.95 },
    // Row 1: Toy shops
    { name: 'shop_toys', row: 1, col: 0, offsetY: -15, scale: 0.95 },
    { name: 'shop_plush', row: 1, col: 1, offsetY: -15, scale: 0.95 },
    { name: 'shop_apparel', row: 1, col: 2, offsetY: -15, scale: 0.95 },
    { name: 'shop_bricks', row: 1, col: 3, offsetY: -15, scale: 0.95 },
    { name: 'shop_rc', row: 1, col: 4, offsetY: -15, scale: 0.95 },
    // Row 2: Candy shops
    { name: 'shop_candy', row: 2, col: 0, offsetY: -15, scale: 0.95 },
    { name: 'shop_fudge', row: 2, col: 1, offsetY: -15, scale: 0.95 },
    { name: 'shop_jewelry', row: 2, col: 2, offsetY: -15, scale: 0.95 },
    { name: 'shop_popcorn', row: 2, col: 3, offsetY: -15, scale: 0.95 },
    { name: 'shop_soda_fountain', row: 2, col: 4, offsetY: -15, scale: 0.95 },
    // Row 3: Carnival games
    { name: 'game_ring_toss', row: 3, col: 0, offsetY: -10, scale: 0.9 },
    { name: 'game_balloon', row: 3, col: 1, offsetY: -10, scale: 0.9 },
    { name: 'game_shooting', row: 3, col: 2, offsetY: -10, scale: 0.9 },
    { name: 'game_darts', row: 3, col: 3, offsetY: -10, scale: 0.9 },
    { name: 'game_basketball', row: 3, col: 4, offsetY: -10, scale: 0.9 },
    // Row 4: Entertainment
    { name: 'arcade_building', row: 4, col: 0, offsetY: -15, scale: 0.95 },
    { name: 'vr_experience', row: 4, col: 1, offsetY: -15, scale: 0.95 },
    { name: 'photo_booth', row: 4, col: 2, offsetY: -10, scale: 0.9 },
    { name: 'caricature', row: 4, col: 3, offsetY: -10, scale: 0.9 },
    { name: 'face_paint', row: 4, col: 4, offsetY: -10, scale: 0.9 },
    // Row 5: Services
    { name: 'restroom', row: 5, col: 0, offsetY: -15, scale: 0.95 },
    { name: 'first_aid', row: 5, col: 1, offsetY: -15, scale: 0.95 },
    { name: 'lockers', row: 5, col: 2, offsetY: -15, scale: 0.95 },
    { name: 'stroller_rental', row: 5, col: 3, offsetY: -10, scale: 0.9 },
    { name: 'atm', row: 5, col: 4, offsetY: -10, scale: 0.9 },
  ],
};

const RIDES_SMALL_SHEET: SpriteSheet = {
  id: 'rides_small',
  src: '/assets/coaster/rides_small.png',
  cols: 5,
  rows: 6,
  sprites: [
    // Row 0: Kiddie rides
    { name: 'ride_kiddie_coaster', row: 0, col: 0, offsetY: -20, scale: 1.0 },
    { name: 'ride_kiddie_train', row: 0, col: 1, offsetY: -20, scale: 1.0 },
    { name: 'ride_kiddie_planes', row: 0, col: 2, offsetY: -20, scale: 1.0 },
    { name: 'ride_kiddie_boats', row: 0, col: 3, offsetY: -20, scale: 1.0 },
    { name: 'ride_kiddie_cars', row: 0, col: 4, offsetY: -20, scale: 1.0 },
    // Row 1: Spinning rides
    { name: 'ride_teacups', row: 1, col: 0, offsetY: -20, scale: 1.0 },
    { name: 'ride_scrambler', row: 1, col: 1, offsetY: -20, scale: 1.0 },
    { name: 'ride_tilt_a_whirl', row: 1, col: 2, offsetY: -20, scale: 1.0 },
    { name: 'ride_spinning_apples', row: 1, col: 3, offsetY: -20, scale: 1.0 },
    { name: 'ride_whirlwind', row: 1, col: 4, offsetY: -20, scale: 1.0 },
    // Row 2: Classic rides
    { name: 'ride_carousel', row: 2, col: 0, offsetY: -20, scale: 1.0 },
    { name: 'ride_antique_cars', row: 2, col: 1, offsetY: -20, scale: 1.0 },
    { name: 'ride_monorail_car', row: 2, col: 2, offsetY: -20, scale: 1.0 },
    { name: 'ride_sky_ride_car', row: 2, col: 3, offsetY: -20, scale: 1.0 },
    { name: 'ride_train_car', row: 2, col: 4, offsetY: -20, scale: 1.0 },
    // Row 3: Driving rides
    { name: 'ride_bumper_cars', row: 3, col: 0, offsetY: -20, scale: 1.0 },
    { name: 'ride_go_karts', row: 3, col: 1, offsetY: -20, scale: 1.0 },
    { name: 'ride_simulator', row: 3, col: 2, offsetY: -20, scale: 1.0 },
    { name: 'ride_motion_theater', row: 3, col: 3, offsetY: -20, scale: 1.0 },
    { name: 'ride_4d_theater', row: 3, col: 4, offsetY: -20, scale: 1.0 },
    // Row 4: Water rides
    { name: 'ride_bumper_boats', row: 4, col: 0, offsetY: -20, scale: 1.0 },
    { name: 'ride_paddle_boats', row: 4, col: 1, offsetY: -20, scale: 1.0 },
    { name: 'ride_lazy_river', row: 4, col: 2, offsetY: -20, scale: 1.0 },
    { name: 'ride_water_play', row: 4, col: 3, offsetY: -20, scale: 1.0 },
    { name: 'ride_splash_zone', row: 4, col: 4, offsetY: -20, scale: 1.0 },
    // Row 5: Dark rides
    { name: 'ride_haunted_house', row: 5, col: 0, offsetY: -20, scale: 1.0 },
    { name: 'ride_ghost_train', row: 5, col: 1, offsetY: -20, scale: 1.0 },
    { name: 'ride_dark_ride', row: 5, col: 2, offsetY: -20, scale: 1.0 },
    { name: 'ride_tunnel', row: 5, col: 3, offsetY: -20, scale: 1.0 },
    { name: 'ride_themed_facade', row: 5, col: 4, offsetY: -20, scale: 1.0 },
  ],
};

const RIDES_LARGE_SHEET: SpriteSheet = {
  id: 'rides_large',
  src: '/assets/coaster/rides_large.png',
  cols: 5,
  rows: 6,
  sprites: [
    // Row 0: Ferris wheels
    { name: 'ride_ferris_classic', row: 0, col: 0, offsetY: -50, scale: 1.1 },
    { name: 'ride_ferris_modern', row: 0, col: 1, offsetY: -50, scale: 1.1 },
    { name: 'ride_ferris_observation', row: 0, col: 2, offsetY: -55, scale: 1.15 },
    { name: 'ride_ferris_double', row: 0, col: 3, offsetY: -50, scale: 1.1 },
    { name: 'ride_ferris_led', row: 0, col: 4, offsetY: -55, scale: 1.15 },
    // Row 1: Drop rides
    { name: 'ride_drop_tower', row: 1, col: 0, offsetY: -55, scale: 1.1 },
    { name: 'ride_space_shot', row: 1, col: 1, offsetY: -60, scale: 1.15 },
    { name: 'ride_observation_tower', row: 1, col: 2, offsetY: -60, scale: 1.15 },
    { name: 'ride_sky_swing', row: 1, col: 3, offsetY: -50, scale: 1.1 },
    { name: 'ride_star_flyer', row: 1, col: 4, offsetY: -55, scale: 1.1 },
    // Row 2: Swing rides
    { name: 'ride_swing_ride', row: 2, col: 0, offsetY: -40, scale: 1.05 },
    { name: 'ride_wave_swinger', row: 2, col: 1, offsetY: -40, scale: 1.05 },
    { name: 'ride_flying_scooters', row: 2, col: 2, offsetY: -40, scale: 1.05 },
    { name: 'ride_enterprise', row: 2, col: 3, offsetY: -40, scale: 1.05 },
    { name: 'ride_loop_o_plane', row: 2, col: 4, offsetY: -40, scale: 1.05 },
    // Row 3: Thrill rides
    { name: 'ride_top_spin', row: 3, col: 0, offsetY: -40, scale: 1.05 },
    { name: 'ride_frisbee', row: 3, col: 1, offsetY: -40, scale: 1.05 },
    { name: 'ride_afterburner', row: 3, col: 2, offsetY: -40, scale: 1.05 },
    { name: 'ride_inversion', row: 3, col: 3, offsetY: -40, scale: 1.05 },
    { name: 'ride_meteorite', row: 3, col: 4, offsetY: -40, scale: 1.05 },
    // Row 4: Transport rides
    { name: 'ride_log_flume', row: 4, col: 0, offsetX: 6, offsetY: -30, scale: 1.05 },
    { name: 'ride_rapids', row: 4, col: 1, offsetY: -30, scale: 1.05 },
    { name: 'ride_train_station', row: 4, col: 2, offsetY: -30, scale: 1.05 },
    { name: 'ride_monorail_station', row: 4, col: 3, offsetY: -30, scale: 1.05 },
    { name: 'ride_chairlift', row: 4, col: 4, offsetY: -30, scale: 0.95 },
    // Row 5: Shows
    { name: 'show_4d', row: 5, col: 0, offsetY: -25, scale: 1.0 },
    { name: 'show_stunt', row: 5, col: 1, offsetY: -25, scale: 1.0 },
    { name: 'show_dolphin', row: 5, col: 2, offsetY: -25, scale: 1.0 },
    { name: 'show_amphitheater', row: 5, col: 3, offsetY: -25, scale: 1.0 },
    { name: 'show_parade_float', row: 5, col: 4, offsetY: -22, scale: 1.0 },
  ],
};

const THEME_CLASSIC_SHEET: SpriteSheet = {
  id: 'theme_classic',
  src: '/assets/coaster/theme_classic.png',
  cols: 5,
  rows: 6,
  sprites: [
    // Row 0: Medieval/Fantasy
    { name: 'theme_castle_tower', row: 0, col: 0, offsetY: -20, scale: 0.95 },
    { name: 'theme_castle_wall', row: 0, col: 1, offsetY: -15, scale: 0.95 },
    { name: 'theme_drawbridge', row: 0, col: 2, offsetY: -20, scale: 0.95 },
    { name: 'theme_knight_statue', row: 0, col: 3, offsetY: -20, scale: 0.9 },
    { name: 'theme_dragon_statue', row: 0, col: 4, offsetY: -25, scale: 0.95 },
    // Row 1: Pirate
    { name: 'theme_pirate_ship', row: 1, col: 0, offsetY: -20, scale: 0.95 },
    { name: 'theme_treasure_chest', row: 1, col: 1, offsetY: -10, scale: 0.9 },
    { name: 'theme_skull_rock', row: 1, col: 2, offsetY: -20, scale: 0.95 },
    { name: 'theme_cannon', row: 1, col: 3, offsetY: -15, scale: 0.9 },
    { name: 'theme_anchor', row: 1, col: 4, offsetY: -15, scale: 0.9 },
    // Row 2: Old West
    { name: 'theme_saloon', row: 2, col: 0, offsetY: -15, scale: 0.95 },
    { name: 'theme_water_tower', row: 2, col: 1, offsetY: -25, scale: 1.0 },
    { name: 'theme_wagon_wheel', row: 2, col: 2, offsetY: -15, scale: 0.9 },
    { name: 'theme_cactus', row: 2, col: 3, offsetY: -10, scale: 0.9 },
    { name: 'theme_windmill', row: 2, col: 4, offsetY: -20, scale: 0.95 },
    // Row 3: Jungle/Safari
    { name: 'theme_temple_ruins', row: 3, col: 0, offsetY: -20, scale: 0.95 },
    { name: 'theme_tiki_statue', row: 3, col: 1, offsetY: -15, scale: 0.9 },
    { name: 'theme_safari_jeep', row: 3, col: 2, offsetY: -15, scale: 0.9 },
    { name: 'theme_elephant_statue', row: 3, col: 3, offsetY: -20, scale: 0.95 },
    { name: 'theme_bamboo_hut', row: 3, col: 4, offsetY: -15, scale: 0.9 },
    // Row 4: Space/Sci-Fi
    { name: 'theme_rocket_ship', row: 4, col: 0, offsetY: -20, scale: 0.95 },
    { name: 'theme_ufo', row: 4, col: 1, offsetY: -20, scale: 0.95 },
    { name: 'theme_robot_statue', row: 4, col: 2, offsetY: -25, scale: 0.95 },
    { name: 'theme_portal', row: 4, col: 3, offsetY: -20, scale: 0.95 },
    { name: 'theme_satellite', row: 4, col: 4, offsetY: -20, scale: 0.95 },
    // Row 5: Underwater/Ocean
    { name: 'theme_coral_reef', row: 5, col: 0, offsetY: -10, scale: 0.9 },
    { name: 'theme_submarine', row: 5, col: 1, offsetY: -15, scale: 0.95 },
    { name: 'theme_diving_helmet', row: 5, col: 2, offsetY: -15, scale: 0.95 },
    { name: 'theme_treasure', row: 5, col: 3, offsetY: -15, scale: 0.9 },
    { name: 'theme_seashell', row: 5, col: 4, offsetY: -10, scale: 0.9 },
  ],
};

const THEME_MODERN_SHEET: SpriteSheet = {
  id: 'theme_modern',
  src: '/assets/coaster/theme_modern.png',
  cols: 5,
  rows: 6,
  sprites: [
    // Row 0: Halloween
    { name: 'theme_haunted_tree', row: 0, col: 0, offsetY: -20, scale: 0.95 },
    { name: 'theme_gravestone', row: 0, col: 1, offsetY: -15, scale: 0.9 },
    { name: 'theme_pumpkin', row: 0, col: 2, offsetY: -15, scale: 0.9 },
    { name: 'theme_witch_cauldron', row: 0, col: 3, offsetY: -20, scale: 0.9 },
    { name: 'theme_skeleton', row: 0, col: 4, offsetY: -25, scale: 0.95 },
    // Row 1: Christmas/Winter
    { name: 'theme_christmas_tree', row: 1, col: 0, offsetY: -25, scale: 0.95 },
    { name: 'theme_snowman', row: 1, col: 1, offsetY: -15, scale: 0.9 },
    { name: 'theme_presents', row: 1, col: 2, offsetY: -10, scale: 0.9 },
    { name: 'theme_candy_cane', row: 1, col: 3, offsetY: -15, scale: 0.9 },
    { name: 'theme_ice_sculpture', row: 1, col: 4, offsetY: -20, scale: 0.95 },
    // Row 2: Spring/Easter
    { name: 'theme_giant_egg', row: 2, col: 0, offsetY: -15, scale: 0.9 },
    { name: 'theme_bunny_statue', row: 2, col: 1, offsetY: -15, scale: 0.9 },
    { name: 'theme_flower_arch', row: 2, col: 2, offsetY: -20, scale: 0.95 },
    { name: 'theme_butterfly', row: 2, col: 3, offsetY: -15, scale: 0.9 },
    { name: 'theme_bird_bath', row: 2, col: 4, offsetY: -15, scale: 0.9 },
    // Row 3: Circus/Carnival
    { name: 'theme_circus_tent', row: 3, col: 0, offsetY: -20, scale: 0.95 },
    { name: 'theme_strongman', row: 3, col: 1, offsetY: -20, scale: 0.9 },
    { name: 'theme_clown_statue', row: 3, col: 2, offsetY: -20, scale: 0.9 },
    { name: 'theme_balloon_arch', row: 3, col: 3, offsetY: -20, scale: 0.95 },
    { name: 'theme_carnival_banner', row: 3, col: 4, offsetY: -20, scale: 0.95 },
    // Row 4: Sports
    { name: 'theme_trophy', row: 4, col: 0, offsetY: -20, scale: 0.9 },
    { name: 'theme_mascot', row: 4, col: 1, offsetY: -20, scale: 0.9 },
    { name: 'theme_scoreboard', row: 4, col: 2, offsetY: -20, scale: 0.95 },
    { name: 'theme_goal_post', row: 4, col: 3, offsetY: -20, scale: 0.95 },
    { name: 'theme_checkered_flag', row: 4, col: 4, offsetX: 6, offsetY: -20, scale: 0.95 },
    // Row 5: Modern art
    { name: 'theme_geometric', row: 5, col: 0, offsetY: -20, scale: 0.95 },
    { name: 'theme_water_wall', row: 5, col: 1, offsetY: -20, scale: 0.95 },
    { name: 'theme_led_cube', row: 5, col: 2, offsetY: -20, scale: 0.95 },
    { name: 'theme_mirror_ball', row: 5, col: 3, offsetY: -20, scale: 0.95 },
    { name: 'theme_kinetic', row: 5, col: 4, offsetY: -20, scale: 0.95 },
  ],
};

const QUEUE_ELEMENTS_SHEET: SpriteSheet = {
  id: 'queue_elements',
  src: '/assets/coaster/queue_elements.png',
  cols: 5,
  rows: 6,
  sprites: [
    // Row 0: Barriers
    { name: 'queue_post_metal', row: 0, col: 0, offsetY: -15, scale: 0.8 },
    { name: 'queue_rope', row: 0, col: 1, offsetY: -15, scale: 0.85 },
    { name: 'queue_chain', row: 0, col: 2, offsetY: -15, scale: 0.85 },
    { name: 'queue_retractable', row: 0, col: 3, offsetY: -15, scale: 0.85 },
    { name: 'queue_fence', row: 0, col: 4, offsetY: -15, scale: 0.85 },
    // Row 1: Queue covers
    { name: 'queue_canopy', row: 1, col: 0, offsetY: -20, scale: 0.9 },
    { name: 'queue_pergola', row: 1, col: 1, offsetY: -20, scale: 0.9 },
    { name: 'queue_tunnel', row: 1, col: 2, offsetY: -20, scale: 0.9 },
    { name: 'queue_covered', row: 1, col: 3, offsetY: -20, scale: 0.9 },
    { name: 'queue_mister', row: 1, col: 4, offsetY: -20, scale: 0.9 },
    // Row 2: Queue entertainment
    { name: 'queue_tv', row: 2, col: 0, offsetY: -15, scale: 0.85 },
    { name: 'queue_game', row: 2, col: 1, offsetY: -15, scale: 0.85 },
    { name: 'queue_prop', row: 2, col: 2, offsetY: -15, scale: 0.85 },
    { name: 'queue_animatronic', row: 2, col: 3, offsetY: -20, scale: 0.9 },
    { name: 'queue_photo_op', row: 2, col: 4, offsetY: -20, scale: 0.9 },
    // Row 3: Themed queue
    { name: 'queue_cave', row: 3, col: 0, offsetY: -20, scale: 0.9 },
    { name: 'queue_jungle', row: 3, col: 1, offsetY: -20, scale: 0.9 },
    { name: 'queue_space', row: 3, col: 2, offsetY: -20, scale: 0.9 },
    { name: 'queue_castle', row: 3, col: 3, offsetY: -20, scale: 0.9 },
    { name: 'queue_industrial', row: 3, col: 4, offsetY: -20, scale: 0.9 },
    // Row 4: Queue signage
    { name: 'queue_wait_sign', row: 4, col: 0, offsetY: -15, scale: 0.85 },
    { name: 'queue_height', row: 4, col: 1, offsetY: -15, scale: 0.85 },
    { name: 'queue_rules', row: 4, col: 2, offsetY: -15, scale: 0.85 },
    { name: 'queue_logo', row: 4, col: 3, offsetY: -15, scale: 0.85 },
    { name: 'queue_sponsor', row: 4, col: 4, offsetY: -15, scale: 0.85 },
    // Row 5: Queue amenities
    { name: 'queue_fountain', row: 5, col: 0, offsetY: -15, scale: 0.85 },
    { name: 'queue_sanitizer', row: 5, col: 1, offsetY: -15, scale: 0.85 },
    { name: 'queue_charger', row: 5, col: 2, offsetY: -15, scale: 0.85 },
    { name: 'queue_umbrella', row: 5, col: 3, offsetY: -15, scale: 0.85 },
    { name: 'queue_cooling', row: 5, col: 4, offsetY: -15, scale: 0.85 },
  ],
};

const INFRASTRUCTURE_SHEET: SpriteSheet = {
  id: 'infrastructure',
  src: '/assets/coaster/infrastructure.png',
  cols: 5,
  rows: 6,
  sprites: [
    // Row 0: Entrances
    { name: 'infra_main_entrance', row: 0, col: 0, offsetY: -25, scale: 1.0 },
    { name: 'infra_themed_entrance', row: 0, col: 1, offsetY: -25, scale: 1.0 },
    { name: 'infra_vip_entrance', row: 0, col: 2, offsetY: -25, scale: 1.0 },
    { name: 'infra_exit_gate', row: 0, col: 3, offsetY: -20, scale: 0.95 },
    { name: 'infra_turnstile', row: 0, col: 4, offsetY: -20, scale: 0.95 },
    // Row 1: Admin buildings
    { name: 'infra_office', row: 1, col: 0, offsetY: -15, scale: 0.95 },
    { name: 'infra_maintenance', row: 1, col: 1, offsetY: -15, scale: 0.95 },
    { name: 'infra_warehouse', row: 1, col: 2, offsetY: -15, scale: 0.95 },
    { name: 'infra_security', row: 1, col: 3, offsetY: -15, scale: 0.95 },
    { name: 'infra_break_room', row: 1, col: 4, offsetY: -15, scale: 0.95 },
    // Row 2: Guest services
    { name: 'infra_guest_relations', row: 2, col: 0, offsetY: -15, scale: 0.95 },
    { name: 'infra_lost_found', row: 2, col: 1, offsetY: -15, scale: 0.95 },
    { name: 'infra_package_pickup', row: 2, col: 2, offsetY: -15, scale: 0.95 },
    { name: 'infra_ticket_booth', row: 2, col: 3, offsetY: -15, scale: 0.95 },
    { name: 'infra_season_pass', row: 2, col: 4, offsetY: -15, scale: 0.95 },
    // Row 3: Transport
    { name: 'infra_tram_stop', row: 3, col: 0, offsetY: -15, scale: 0.9 },
    { name: 'infra_bus_stop', row: 3, col: 1, offsetY: -15, scale: 0.9 },
    { name: 'infra_shuttle', row: 3, col: 2, offsetY: -10, scale: 0.9 },
    { name: 'infra_golf_cart', row: 3, col: 3, offsetY: -10, scale: 0.9 },
    { name: 'infra_utility_vehicle', row: 3, col: 4, offsetY: -10, scale: 0.9 },
    // Row 4: Utilities
    { name: 'infra_generator', row: 4, col: 0, offsetY: -15, scale: 0.9 },
    { name: 'infra_dumpster', row: 4, col: 1, offsetY: -15, scale: 0.9 },
    { name: 'infra_loading_dock', row: 4, col: 2, offsetY: -15, scale: 0.9 },
    { name: 'infra_container', row: 4, col: 3, offsetY: -15, scale: 0.9 },
    { name: 'infra_utility_box', row: 4, col: 4, offsetY: -10, scale: 0.9 },
    // Row 5: Safety
    { name: 'infra_first_aid_station', row: 5, col: 0, offsetY: -15, scale: 0.9 },
    { name: 'infra_defibrillator', row: 5, col: 1, offsetY: -10, scale: 0.9 },
    { name: 'infra_fire_extinguisher', row: 5, col: 2, offsetY: -10, scale: 0.9 },
    { name: 'infra_emergency_phone', row: 5, col: 3, offsetY: -10, scale: 0.9 },
    { name: 'infra_evacuation', row: 5, col: 4, offsetY: -10, scale: 0.9 },
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
    FOUNTAINS_SHEET,
    SHOPS_SHEET,
    RIDES_SMALL_SHEET,
    RIDES_LARGE_SHEET,
    THEME_CLASSIC_SHEET,
    THEME_MODERN_SHEET,
    QUEUE_ELEMENTS_SHEET,
    INFRASTRUCTURE_SHEET,
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
