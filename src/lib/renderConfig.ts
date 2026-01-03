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
  // Path to the modern variants sprite sheet (alternative sprites for modern-style high-density buildings)
  modernSrc?: string;
  // Modern variant definitions: maps building type to available variants in the modern sheet
  // Each variant specifies row and column (0-indexed) in the modern sprite sheet
  modernVariants?: Record<string, { row: number; col: number }[]>;
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
  // Per-building-type vertical offset adjustments for MODERN variant sprites only
  // These override verticalOffsets when rendering modern variants
  modernVerticalOffsets?: Record<string, number>;
  // Per-building-type scale adjustments for MODERN variant sprites only
  // Values are multiplied with the normal scale (e.g., 0.95 = 95% of normal size)
  modernScales?: Record<string, number>;
  // Per-building-type vertical offset adjustments for PARKS sprite sheet buildings
  // These are used when rendering parks buildings from the parks sprite sheet
  parksVerticalOffsets?: Record<string, number>;
  // Per-building-type horizontal offset adjustments for PARKS sprite sheet buildings
  parksHorizontalOffsets?: Record<string, number>;
  // Per-building-type scale adjustments for PARKS sprite sheet buildings
  // Values are multiplied with the normal scale (e.g., 0.95 = 95% of normal size)
  parksScales?: Record<string, number>;
  // Per-building-type vertical offset adjustments for PARKS CONSTRUCTION sprites only
  // These override parksVerticalOffsets when rendering parks buildings under construction
  parksConstructionVerticalOffsets?: Record<string, number>;
  // Path to the farms sprite sheet (separate sheet for farm/agricultural buildings)
  farmsSrc?: string;
  // Farms layout configuration (columns and rows for the farms sheet)
  farmsCols?: number;
  farmsRows?: number;
  // Farms variants: maps building type to available variants in the farms sheet
  // Each variant specifies row and column (0-indexed) in the farms sprite sheet
  farmsVariants?: Record<string, { row: number; col: number }[]>;
  // Per-building-type vertical offset adjustments for FARMS sprite sheet buildings
  farmsVerticalOffsets?: Record<string, number>;
  // Per-building-type horizontal offset adjustments for FARMS sprite sheet buildings
  farmsHorizontalOffsets?: Record<string, number>;
  // Per-building-type scale adjustments for FARMS sprite sheet buildings
  farmsScales?: Record<string, number>;
  // Path to the shops sprite sheet (alternate variants for shop buildings)
  shopsSrc?: string;
  // Shops layout configuration (columns and rows for the shops sheet)
  shopsCols?: number;
  shopsRows?: number;
  // Shops variants: maps building type to available variants in the shops sheet
  // Each variant specifies row and column (0-indexed) in the shops sprite sheet
  shopsVariants?: Record<string, { row: number; col: number }[]>;
  // Per-building-type vertical offset adjustments for SHOPS sprite sheet buildings
  shopsVerticalOffsets?: Record<string, number>;
  // Per-building-type horizontal offset adjustments for SHOPS sprite sheet buildings
  shopsHorizontalOffsets?: Record<string, number>;
  // Per-building-type scale adjustments for SHOPS sprite sheet buildings
  shopsScales?: Record<string, number>;
  // Path to the stations sprite sheet (rail station variants)
  stationsSrc?: string;
  // Stations layout configuration (columns and rows for the stations sheet)
  stationsCols?: number;
  stationsRows?: number;
  // Stations variants: maps building type to available variants in the stations sheet
  // Each variant specifies row and column (0-indexed) in the stations sprite sheet
  stationsVariants?: Record<string, { row: number; col: number }[]>;
  // Per-building-type vertical offset adjustments for STATIONS sprite sheet buildings
  stationsVerticalOffsets?: Record<string, number>;
  // Per-building-type horizontal offset adjustments for STATIONS sprite sheet buildings
  stationsHorizontalOffsets?: Record<string, number>;
  // Per-building-type scale adjustments for STATIONS sprite sheet buildings
  stationsScales?: Record<string, number>;
  // Path to the services sprite sheet (for service buildings with level variants)
  servicesSrc?: string;
  // Services layout configuration (columns and rows for the services sheet)
  servicesCols?: number;
  servicesRows?: number;
  // Services variants: maps building type to available level variants in the services sheet
  // Each variant specifies row and column (0-indexed) in the services sprite sheet
  servicesVariants?: Record<string, { row: number; col: number }[]>;
  // Per-building-type vertical offset adjustments for SERVICES sprite sheet buildings
  servicesVerticalOffsets?: Record<string, number>;
  // Per-building-type horizontal offset adjustments for SERVICES sprite sheet buildings
  servicesHorizontalOffsets?: Record<string, number>;
  // Per-building-type scale adjustments for SERVICES sprite sheet buildings
  servicesScales?: Record<string, number>;
  // Path to the infrastructure sprite sheet (water/power/waste management buildings with level variants)
  infrastructureSrc?: string;
  // Infrastructure layout configuration (columns and rows for the infrastructure sheet)
  infrastructureCols?: number;
  infrastructureRows?: number;
  // Infrastructure variants: maps building type to available level variants in the infrastructure sheet
  // Each variant specifies row and column (0-indexed) in the infrastructure sprite sheet
  infrastructureVariants?: Record<string, { row: number; col: number }[]>;
  // Per-building-type vertical offset adjustments for INFRASTRUCTURE sprite sheet buildings
  infrastructureVerticalOffsets?: Record<string, number>;
  // Per-building-type horizontal offset adjustments for INFRASTRUCTURE sprite sheet buildings
  infrastructureHorizontalOffsets?: Record<string, number>;
  // Per-building-type scale adjustments for INFRASTRUCTURE sprite sheet buildings
  infrastructureScales?: Record<string, number>;
  // Path to the mansions sprite sheet (alternate mansion variants)
  mansionsSrc?: string;
  // Mansions layout configuration (columns and rows for the mansions sheet)
  mansionsCols?: number;
  mansionsRows?: number;
  // Mansions variants: maps building type to available variants in the mansions sheet
  // Each variant specifies row and column (0-indexed) in the mansions sprite sheet
  mansionsVariants?: Record<string, { row: number; col: number }[]>;
  // Per-building-type vertical offset adjustments for MANSIONS sprite sheet buildings
  mansionsVerticalOffsets?: Record<string, number>;
  // Per-building-type horizontal offset adjustments for MANSIONS sprite sheet buildings
  mansionsHorizontalOffsets?: Record<string, number>;
  // Per-building-type scale adjustments for MANSIONS sprite sheet buildings
  mansionsScales?: Record<string, number>;
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
  name: 'Default Theme',
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
    // Office low density - Row 4, columns 1, 2, 4 (0-indexed: row 3, cols 0, 1, 3)
    office_low: [
      { row: 3, col: 0 },
      { row: 3, col: 1 },
      { row: 3, col: 3 },
    ],
    // Office high density - Row 3 columns 1-3, Row 2 column 1 (0-indexed: row 2 cols 0-2, row 1 col 0)
    office_high: [
      { row: 1, col: 0 },
      { row: 2, col: 0 },
      { row: 2, col: 1 },
      { row: 2, col: 2 },
    ],
    // Commercial high density (mall) - Row 2 col 5, Row 3 cols 4-5, Row 4 most columns (0-indexed: row 1 col 4, row 2 cols 3-4, row 3 except col 3)
    mall: [
      { row: 1, col: 4 },
      { row: 2, col: 3 },
      { row: 2, col: 4 },
      { row: 3, col: 0 },
      { row: 3, col: 1 },
      { row: 3, col: 2 },
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
    factory_medium: -0.3, // Shifted down 0.2 from -0.5
    factory_large: -1.15, // Shifted up 0.3 from -0.85 (cropped bottom, shifted up)
    water_tower: -0.5,
    house_medium: -0.3,
    mansion: -0.35,
    house_small: -0.3,
    shop_medium: -0.15, // Shift down a tiny bit (less up than before)
    shop_small: -0.3,
    warehouse: -0.4,
    airport: -1.5, // Original position
    water: -0.2,
    subway_station: -0.4, // Shifted up 0.2 tiles
    fire_station: -0.3, // Shifted up 0.1 tiles
    police_station: -0.2, // Shifted up 0.1 tiles
    hospital: -0.65, // Shift up (reduced from previous), shifted up 0.15 tiles
    school: -0.35, // Shifted down 0.05 tiles from -0.4
    power_plant: -0.3, // Shift up
    park: -0.125, // Adjusted position
    park_large: -0.77, // Shift up significantly (almost an entire tile)
    tennis: -0.2, // Shifted up 0.1 tiles from -0.1
    city_hall: -0.6, // Shift up about 0.2 tiles
    amusement_park: -1.5, // Shift up about 1 tile
    space_program: -0.95, // Shifted down 0.05 tiles
    university: -0.55, // Shift up a tiny bit
    stadium: -1.2, // Shift up a ton
    museum: -1.0, // Shift up 1 tile
    tree: -0.3, // Shift up 0.3 tiles
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
    office_low: -0.7, // Shifted up 0.2 from -0.5
    office_high: -0.7, // Shifted down 0.3 tiles from -1.0
    // 3x3 mall needs to shift up ~1.5 tiles (non-dense)
    mall: -1.5,
    // 2x2 residential apartments need shifting up
    apartment_low: -0.9,  // shifted up 0.3 from -0.6
    apartment_high: -0.60, // Shifted down ~0.4 tiles from -1.0
  },
  constructionVerticalOffsets: {
    water_tower: -0.1, // Construction water tower shifted up 0.1 tiles
    apartment_high: -0.4, // Construction apartment_high shifted up 3 tiles from previous (2.6 - 3.0 = -0.4)
    apartment_low: -0.5, // Construction apartment_low shifted up 0.5 tiles from previous (0.3 - 0.5 = -0.2), moved up 0.3 tiles
    mall: -1.0, // Construction mall shifted up 0.8 tiles from previous (-0.2 - 0.8 = -1.0)
    office_high: -0.5, // Construction office_high shifted up 0.5 tiles from previous (0.3 - 0.5 = -0.2), moved up 0.3 tiles
    office_low: -0.4, // Construction office_low shifted down 0.1 tiles from previous (-0.5 + 0.1 = -0.4)
    hospital: -0.7, // Construction hospital shifted up 0.8 tiles
    tennis: -0.2, // Construction tennis shifted up 0.1 tiles from normal -0.1
  },
  constructionScales: {
    mall: 0.92, // Construction mall scaled down 8%
    office_high: 0.80, // Construction office_high scaled down 20%
    apartment_high: 0.65, // Construction apartment_high scaled down 35%
    apartment_low: 0.80, // Construction apartment_low scaled down 20%
  },
  abandonedVerticalOffsets: {
    // Abandoned apartments need different positioning than normal
    apartment_low: -0.45, // Normal is -1.0, abandoned shifts down 0.75: -1.0 + 0.75 = -0.25, moved up 0.2 tiles
    apartment_high: -0.35, // Shifted up 0.3 from previous 0.15, moved up 0.2 tiles
    house_medium: -0.05, // Normal is -0.05, abandoned matches normal position (moved up 0.5 tiles from 0.35, then down 0.1 tiles)
    house_small: -0.05, // Normal is -0.2, abandoned shifted up 0.15 tiles to match house_medium adjustment
    mansion: -0.25, // Normal is -0.35, abandoned shifted down 0.1 tiles (-0.35 + 0.1 = -0.25)
    office_high: -0.2, // Normal is -0.7, abandoned shifted down 0.5 tiles (-0.7 + 0.5 = -0.2)
    tree: -0.3, // Abandoned tree moved up 0.3 tiles
    factory_small: -0.05, // Normal is -0.25, shifted down 0.2 tiles
  },
  abandonedScales: {
    // Abandoned factory_large needs to be scaled down 30%
    factory_large: 0.7,
  },
  denseVerticalOffsets: {
    // Dense apartment_high shifted up 0.2 tiles from -0.60
    apartment_high: -0.80, // Shifted up 0.2 tiles from -0.60
    factory_large: -1.15, // Dense variant shifted up 0.1 tiles from -1.05
    mall: -1.5, // Dense mall shifted up 0.5 tiles from -1.0
    office_low: -0.4, // Dense office_low shifted down 0.3 tiles from -0.7
    office_high: -0.7, // Dense office_high shifted up 0.2 tiles from -0.5
  },
  denseScales: {
    // Dense apartment_high scaled down 10% total (5% more from 0.95)
    apartment_high: 0.90,
    office_high: 1.3, // Dense office_high scaled up 30%
  },
  // Modern sprite sheet configuration (same layout as dense: 5 cols, 6 rows)
  modernSrc: '/assets/sprites_red_water_new_modern.png',
  modernVariants: {
    // High density residential (apartment_high) - Row 1, columns 1-2 (0-indexed: row 0, cols 0-1)
    apartment_high: [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ],
    // High density commercial (mall) - Row 3 col 1, Row 4 cols 1, 4, 5 (0-indexed: row 2 col 0, row 3 cols 0, 3, 4)
    mall: [
      { row: 2, col: 0 },
      { row: 3, col: 0 },
      { row: 3, col: 3 },
      { row: 3, col: 4 },
    ],
  },
  modernVerticalOffsets: {
    // Adjust these as needed for proper positioning
    apartment_high: -0.80,
    mall: -1.3, // Shifted down 0.7 tiles from -2.0
  },
  modernScales: {
    // Adjust these as needed for proper sizing
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
    basketball_courts: -0.25, 
    playground_small: -0.25,  // shifted up 0.1
    playground_large: -0.60,  // shifted down 0.05 from -0.65
    baseball_field_small: -0.55,  // shifted down 0.3 from -0.85
    soccer_field_small: -0.20,  // shifted up slightly
    football_field: -0.55,  // shifted down 0.3
    baseball_stadium: -1.35,  // adjusted for scale, moved up 0.5 tiles, shifted down 0.15 tiles
    community_center: -0.2,
    office_building_small: -0.3,
    swimming_pool: -0.20,  // shifted up slightly
    skate_park: -0.25,  // shifted up 0.1 tiles
    mini_golf_course: -0.60,  // shifted up 0.05 tiles from -0.55
    bleachers_field: -0.2,  // shifted down 0.1 tiles from -0.3
    go_kart_track: -0.30,  // shifted down 0.1 tiles from -0.40
    amphitheater: -0.40,  // shifted down 0.05 tiles from -0.45
    greenhouse_garden: -0.75,  // shifted up 0.2 tiles from -0.55
    animal_pens_farm: -0.25,  // shifted up 0.1 tiles
    cabin_house: -0.2,
    campground: -0.15,
    marina_docks_small: -0.45,  // 2x2 building, shifted up 0.7 tiles from 0.25
    pier_large: -0.1,  // 1x1 building, shifted down 0.1 tiles from -0.2
    roller_coaster_small: -0.50,  // shifted up 0.15 tiles from -0.35
    community_garden: -0.15,
    pond_park: -0.15,  // shifted down 0.08 tiles from -0.23
    park_gate: -0.15,
    mountain_lodge: -0.55,  // shifted down 0.3 from -0.85
    mountain_trailhead: -1.0,  // 3x3, shifted down 0.5 tiles
  },
  parksHorizontalOffsets: {
    // swimming_pool: centered (no offset)
  },
  parksScales: {
    baseball_stadium: 0.81,  // 10% smaller than 0.90
    baseball_field_small: 0.855,  // scaled down 10% from 0.95
    basketball_courts: 0.9,  // scaled down 10%
    football_field: 0.855,  // scaled down 5% (from 0.9)
    swimming_pool: 0.90,  // scaled down 10% total (5% more from 0.95)
    soccer_field_small: 0.95,  // scaled down 5%
    go_kart_track: 0.92,  // scaled down 8%
    mini_golf_course: 0.95,  // scaled down 5%
    amphitheater: 0.90,  // scaled down 10%
    greenhouse_garden: 0.90,  // scaled down 10%
  },
  parksConstructionVerticalOffsets: {
    baseball_field_small: -0.55,  // shifted down 0.3 from normal -0.85
    mountain_lodge: -0.55,  // shifted down 0.3 from normal -0.85
  },
  // Farms sprite sheet configuration (variants for low-density industrial)
  farmsSrc: '/assets/sprites_red_water_new_farm.png',
  farmsCols: 5,
  farmsRows: 6,
  farmsVariants: {
    // Farm sprites for 1x1 low-density industrial (factory_small only)
    // Excluding rows 2, 3, 4 which have clipping issues (assets bleed from row above)
    factory_small: [
      // Row 0 (top row - no clipping possible)
      { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 }, { row: 0, col: 4 },
      // Row 1 (verified OK)
      { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }, { row: 1, col: 4 },
      // Row 5 (bottom row)
      { row: 5, col: 0 }, { row: 5, col: 1 }, { row: 5, col: 2 }, { row: 5, col: 3 }, { row: 5, col: 4 },
    ],
  },
  farmsVerticalOffsets: {
    // Adjust these as needed for proper positioning
    factory_small: -0.25,
  },
  farmsHorizontalOffsets: {},
  farmsScales: {},
  // Shops sprite sheet configuration (variants for shop_small and shop_medium)
  shopsSrc: '/assets/sprites_red_water_new_shops.png',
  shopsCols: 5,
  shopsRows: 6,
  shopsVariants: {
    // Shop sprites for 1x1 low-density commercial (shop_small and shop_medium)
    // Available rows: 0, 1 (except col 0), 3 (except col 3), 4, 5 (except col 4)
    shop_small: [
      // Row 0 (entire row)
      { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 }, { row: 0, col: 4 },
      // Row 1 (except col 0)
      { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }, { row: 1, col: 4 },
      // Row 3 (except col 3)
      { row: 3, col: 0 }, { row: 3, col: 1 },
    ],
    shop_medium: [
      // Row 3 (except col 3) - continued
      { row: 3, col: 2 }, { row: 3, col: 4 },
      // Row 4 (entire row)
      { row: 4, col: 0 }, { row: 4, col: 1 }, { row: 4, col: 2 }, { row: 4, col: 3 }, { row: 4, col: 4 },
      // Row 5 (except cols 1, 3, and 4)
      { row: 5, col: 0 }, { row: 5, col: 2 },
    ],
  },
  shopsVerticalOffsets: {
    // Shifted up 0.1 from -0.25
    shop_small: -0.35,
    shop_medium: -0.35,
  },
  shopsHorizontalOffsets: {},
  shopsScales: {
    shop_small: 0.90,  // Scale down 10% total
    shop_medium: 0.90, // Scale down 10% total
  },
  // Stations sprite sheet configuration (rail station variants)
  stationsSrc: '/assets/sprites_red_water_new_stations.png',
  stationsCols: 5,
  stationsRows: 6,
  stationsVariants: {
    // Rail station sprites (2x2 buildings)
    // Row 2 (3rd row): cols 0, 1, 2
    // Row 3 (4th row): cols 2, 3
    // Row 4 (5th row): cols 1, 2, 3
    // Row 5 (6th row): cols 0, 1
    rail_station: [
      // Third row, columns 1-3 (0-indexed: row 2, cols 0-2)
      { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 },
      // Fourth row, columns 3-4 (0-indexed: row 3, cols 2-3)
      { row: 3, col: 2 }, { row: 3, col: 3 },
      // Fifth row, columns 2-4 (0-indexed: row 4, cols 1-3)
      { row: 4, col: 1 }, { row: 4, col: 2 }, { row: 4, col: 3 },
      // Sixth row, columns 1-2 (0-indexed: row 5, cols 0-1)
      { row: 5, col: 0 }, { row: 5, col: 1 },
    ],
  },
  stationsVerticalOffsets: {
    rail_station: -0.6, // Shift up to align with 2x2 building footprint
  },
  stationsHorizontalOffsets: {},
  stationsScales: {
    rail_station: 0.85, // Scale down 15% for better fit
  },
  // Services sprite sheet configuration (service buildings with level progression)
  servicesSrc: '/assets/sprites_red_water_new_services.png',
  servicesCols: 5,
  servicesRows: 6,
  servicesVariants: {
    // Police Station levels - Row 0, columns 1-5 (0-indexed: row 0, cols 0-4)
    police_station: [
      { row: 0, col: 0 }, // Level 1
      { row: 0, col: 1 }, // Level 2
      { row: 0, col: 2 }, // Level 3
      { row: 0, col: 3 }, // Level 4
      { row: 0, col: 4 }, // Level 5
    ],
    // Fire Station levels - Row 1, columns 1-5 (0-indexed: row 1, cols 0-4)
    fire_station: [
      { row: 1, col: 0 }, // Level 1
      { row: 1, col: 1 }, // Level 2
      { row: 1, col: 2 }, // Level 3
      { row: 1, col: 3 }, // Level 4
      { row: 1, col: 4 }, // Level 5
    ],
    // Hospital levels - Row 2, columns 1-5 (0-indexed: row 2, cols 0-4)
    hospital: [
      { row: 2, col: 0 }, // Level 1
      { row: 2, col: 1 }, // Level 2
      { row: 2, col: 2 }, // Level 3
      { row: 2, col: 3 }, // Level 4
      { row: 2, col: 4 }, // Level 5
    ],
    // School levels - Row 3, columns 1-5 (0-indexed: row 3, cols 0-4)
    school: [
      { row: 3, col: 0 }, // Level 1
      { row: 3, col: 1 }, // Level 2
      { row: 3, col: 2 }, // Level 3
      { row: 3, col: 3 }, // Level 4
      { row: 3, col: 4 }, // Level 5
    ],
    // University levels - Row 4, columns 1-5 (0-indexed: row 4, cols 0-4)
    university: [
      { row: 4, col: 0 }, // Level 1
      { row: 4, col: 1 }, // Level 2
      { row: 4, col: 2 }, // Level 3
      { row: 4, col: 3 }, // Level 4
      { row: 4, col: 4 }, // Level 5
    ],
    // Infrastructure levels - Row 5 (0-indexed: row 5)
    // Water Tower and Power Plant variants
    power_plant: [
      { row: 5, col: 0 }, // Level 1
      { row: 5, col: 1 }, // Level 1
      { row: 5, col: 2 }, // Level 2
      { row: 5, col: 3 }, // Level 3
      { row: 5, col: 4 }, // Level 4
    ],
  },
  servicesVerticalOffsets: {
    // Adjust vertical positioning for each service building type
    police_station: -0.3,
    fire_station: -0.3,
    hospital: -0.50,
    school: -0.30,
    university: -0.85,
    power_plant: -0.3,
  },
  servicesHorizontalOffsets: {
    // Adjust horizontal positioning if needed
  },
  servicesScales: {
    // Scale adjustments for better visual fit
    // Add specific scales if buildings need resizing
  },
  // Infrastructure sprite sheet configuration (utility buildings with level progression)
  infrastructureSrc: '/assets/sprites_red_water_new_services-2.png',
  infrastructureCols: 5,
  infrastructureRows: 6,
  infrastructureVariants: {
    // Water Tower levels - Row 1, columns 1-5 (0-indexed: row 0, cols 0-4)
    water_tower: [
      { row: 0, col: 0 }, // Level 1
      { row: 0, col: 1 }, // Level 2
      { row: 0, col: 2 }, // Level 3
      { row: 0, col: 3 }, // Level 4
      { row: 0, col: 4 }, // Level 5
    ],
  },
  infrastructureVerticalOffsets: {
    water_tower: -0.5, // Match existing water_tower offset
  },
  infrastructureHorizontalOffsets: {},
  infrastructureScales: {},
  // Mansions sprite sheet with 35 alternate mansion designs
  mansionsSrc: '/assets/mansion_alternates.png',
  mansionsCols: 5,
  mansionsRows: 7,
  mansionsVariants: {
    mansion: [
      // Row 0 only (temporarily)
      { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 }, { row: 0, col: 4 },
    ],
  },
  mansionsVerticalOffsets: {
    mansion: -0.65, // Shifted down 0.3 tiles from -0.95
  },
  mansionsScales: {
    mansion: 0.90, // Same as modern apartment_high scale
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
    // rail_station uses stationsVariants from the stations sprite sheet
    city_hall: 'city_hall',
    amusement_park: 'amusement_park',
  },
};

// ============================================================================
// SPRITE PACK: SPRITES4 HARRY POTTER (Harry Potter themed variant)
// ============================================================================
// Same layout and configuration as SPRITES4, but with Harry Potter themed artwork
const SPRITE_PACK_SPRITES4_HARRY: SpritePack = {
  ...SPRITE_PACK_SPRITES4,
  id: 'sprites4-harry',
  name: 'Harry Potter Theme',
  src: '/assets/sprites_red_water_new_harry.png',
  denseSrc: '/assets/sprites_red_water_new_harry_dense.png',
  modernSrc: '/assets/sprites_red_water_new_harry_dense.png',
  constructionSrc: '/assets/sprites_red_water_new_harry_construction.png',
  // Note: Uses same construction, abandoned, dense, and parks sheets as the default
  // If you have Harry Potter themed variants for those, update these paths:
  // constructionSrc: '/assets/sprites_red_water_new_harry_construction.png',
  // abandonedSrc: '/assets/sprites_red_water_new_harry_abandoned.png',
  // denseSrc: '/assets/sprites_red_water_new_harry_dense.png',
};

// ============================================================================
// SPRITE PACK: SPRITES4 CHINA (Chinese themed variant)
// ============================================================================
// Same layout and configuration as SPRITES4, but with Chinese themed artwork
const SPRITE_PACK_SPRITES4_CHINA: SpritePack = {
  ...SPRITE_PACK_SPRITES4,
  id: 'sprites4-china',
  name: 'Chinese Theme',
  src: '/assets/sprites_red_water_new_china.png',
  // Note: Uses same construction, abandoned, dense, and parks sheets as the default
  // If you have Chinese themed variants for those, update these paths:
  // constructionSrc: '/assets/sprites_red_water_new_china_construction.png',
  // abandonedSrc: '/assets/sprites_red_water_new_china_abandoned.png',
  // denseSrc: '/assets/sprites_red_water_new_china_dense.png',
};

// ============================================================================
// SPRITE PACKS REGISTRY
// ============================================================================
// Add new sprite packs here. Each pack can have completely different
// sprite arrangements, offsets, and scaling.
// ============================================================================
export const SPRITE_PACKS: SpritePack[] = [
  SPRITE_PACK_SPRITES4,
  SPRITE_PACK_SPRITES4_HARRY,
  SPRITE_PACK_SPRITES4_CHINA,
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
  
  // Special handling for sprites4-based packs: rows 1-4 include content from rows above, shift source Y down
  // This applies to sprites4 and all its themed variants (harry, china, etc.)
  const isSprites4Based = activePack.id.startsWith('sprites4');
  let sy = row * tileHeight;
  if (isSprites4Based && row > 0 && row <= 4) {
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
  
  // Special handling for sprites4-based packs: adjust source height for certain sprites
  let sh = tileHeight;
  if (isSprites4Based) {
    if (spriteKey === 'residential' || spriteKey === 'commercial') {
      sh = tileHeight * 1.1; // Add 10% more height at bottom
    }
    if (spriteKey === 'space_program') {
      sh = tileHeight * 0.92; // Crop 8% off the bottom
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
